"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../utils/prisma");
const auth_1 = require("../middleware/auth");
const payouts_1 = require("../services/payouts");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireRole)("ADMIN"));
router.get("/sellers", async (_req, res) => {
    const sellers = await prisma_1.prisma.sellerProfile.findMany({
        include: {
            user: { select: { id: true, email: true, status: true, createdAt: true } },
            _count: { select: { products: true } },
        },
        orderBy: { user: { createdAt: "desc" } },
    });
    res.json(sellers.map((s) => ({
        id: s.id,
        user_id: s.userId,
        email: s.user.email,
        store_name: s.storeName,
        bio: s.bio,
        status: s.user.status,
        product_count: s._count.products,
        created_at: s.user.createdAt,
    })));
});
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum(["ACTIVE", "SUSPENDED", "PENDING"]),
});
router.put("/sellers/:id", async (req, res) => {
    try {
        const { status } = statusSchema.parse(req.body);
        const seller = await prisma_1.prisma.sellerProfile.findUnique({
            where: { id: req.params.id },
            include: { user: true },
        });
        if (!seller)
            return res.status(404).json({ error: "Seller not found" });
        await prisma_1.prisma.user.update({
            where: { id: seller.userId },
            data: { status: status },
        });
        // BR-03: on suspend, set all products visible=false
        if (status === "SUSPENDED") {
            await (0, payouts_1.suspendSellerProducts)(seller.id);
        }
        else if (status === "ACTIVE") {
            await (0, payouts_1.activateSellerProducts)(seller.id);
        }
        res.json({ id: seller.id, status });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: err.issues[0]?.message });
        }
        res.status(500).json({ error: "Update failed" });
    }
});
// BR-04: includes visible=false products
router.get("/products", async (_req, res) => {
    const products = await prisma_1.prisma.product.findMany({
        include: { seller: { include: { user: { select: { status: true } } } } },
        orderBy: { createdAt: "desc" },
    });
    res.json(products.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        price_cents: p.priceCents,
        stock_qty: p.stockQty,
        status: p.status,
        visible: p.visible,
        store_name: p.seller.storeName,
        seller_status: p.seller.user.status,
    })));
});
router.delete("/products/:id", async (req, res) => {
    const product = await prisma_1.prisma.product.update({
        where: { id: req.params.id },
        data: { status: "REMOVED", visible: false },
    });
    res.json(product);
});
router.post("/payouts/run", async (_req, res) => {
    const result = await (0, payouts_1.runWeeklyPayouts)();
    res.json(result);
});
exports.default = router;
