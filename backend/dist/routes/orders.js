"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../utils/prisma");
const auth_1 = require("../middleware/auth");
const email_1 = require("../services/email");
const payouts_1 = require("../services/payouts");
const router = (0, express_1.Router)();
const checkoutSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        product_id: zod_1.z.string(),
        qty: zod_1.z.number().int().positive(),
    })).min(1),
});
router.post("/checkout", auth_1.requireAuth, (0, auth_1.requireRole)("BUYER"), async (req, res) => {
    try {
        const data = checkoutSchema.parse(req.body);
        const lineItems = [];
        let totalCents = 0;
        for (const item of data.items) {
            const product = await prisma_1.prisma.product.findFirst({
                where: {
                    id: item.product_id,
                    visible: true,
                    status: { in: ["ACTIVE", "SOLD_OUT"] },
                    stockQty: { gte: item.qty },
                },
                include: { seller: { include: { user: true } } },
            });
            if (!product || product.stockQty <= 0) {
                return res.status(400).json({ error: `Product ${item.product_id} unavailable` });
            }
            const lineTotal = product.priceCents * item.qty;
            totalCents += lineTotal;
            lineItems.push({ product, qty: item.qty, lineTotal });
        }
        const { platformFeeCents, sellerPayoutCents } = (0, prisma_1.calcFees)(totalCents);
        const order = await prisma_1.prisma.order.create({
            data: {
                buyerId: req.user.id,
                totalCents,
                platformFeeCents,
                status: "PENDING",
                items: {
                    create: lineItems.map(({ product, qty, lineTotal }) => {
                        const fees = (0, prisma_1.calcFees)(lineTotal);
                        return {
                            productId: product.id,
                            sellerId: product.sellerId,
                            qty,
                            priceAtPurchase: product.priceCents,
                            sellerPayoutCents: fees.sellerPayoutCents,
                        };
                    }),
                },
            },
            include: {
                items: { include: { product: { include: { seller: { include: { user: true } } } } } },
            },
        });
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
            for (const item of lineItems) {
                await tx.product.update({
                    where: { id: item.product.id },
                    data: { stockQty: { decrement: item.qty } },
                });
                await (0, payouts_1.syncProductStockStatus)(item.product.id);
            }
        });
        for (const item of order.items) {
            await (0, email_1.notifySellerOrderPaid)(item.product.seller.user.email, item.product.seller.storeName, item.product.title, item.qty);
        }
        return res.json({
            order_id: order.id,
            demo_mode: true,
            client_secret: null,
            message: "Order placed",
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: err.issues[0]?.message });
        }
        console.error(err);
        res.status(500).json({ error: "Checkout failed" });
    }
});
router.get("/", auth_1.requireAuth, (0, auth_1.requireRole)("BUYER"), async (req, res) => {
    const orders = await prisma_1.prisma.order.findMany({
        where: { buyerId: req.user.id },
        include: {
            items: { include: { product: true, review: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    res.json(orders);
});
router.get("/:id", auth_1.requireAuth, async (req, res) => {
    const order = await prisma_1.prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
            items: { include: { product: true, review: true } },
        },
    });
    if (!order)
        return res.status(404).json({ error: "Order not found" });
    const isBuyer = order.buyerId === req.user.id;
    const isSeller = order.items.some((i) => i.product.sellerId === req.user.sellerProfileId);
    const isAdmin = req.user.role === "ADMIN";
    if (!isBuyer && !isSeller && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
    }
    res.json(order);
});
router.post("/:id/ship", auth_1.requireAuth, async (req, res) => {
    if (req.user.role !== "SELLER" || req.user.status !== "ACTIVE") {
        return res.status(403).json({ error: "Active seller required" });
    }
    const order = await prisma_1.prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { product: true } } },
    });
    if (!order)
        return res.status(404).json({ error: "Order not found" });
    if (order.status !== "PAID" && order.status !== "SHIPPED") {
        return res.status(400).json({ error: "Order not ready to ship" });
    }
    const sellerItems = order.items.filter((i) => i.product.sellerId === req.user.sellerProfileId);
    if (sellerItems.length === 0) {
        return res.status(403).json({ error: "No items for your shop in this order" });
    }
    await prisma_1.prisma.order.update({
        where: { id: order.id },
        data: { status: "SHIPPED" },
    });
    res.json({ success: true, status: "SHIPPED" });
});
router.post("/:id/deliver", auth_1.requireAuth, async (req, res) => {
    const order = await prisma_1.prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order)
        return res.status(404).json({ error: "Order not found" });
    const isBuyer = order.buyerId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";
    if (!isBuyer && !isAdmin) {
        return res.status(403).json({ error: "Only the buyer or admin can confirm delivery" });
    }
    if (order.status !== "SHIPPED" && order.status !== "PAID") {
        return res.status(400).json({ error: "Order must be shipped before marking delivered" });
    }
    await prisma_1.prisma.order.update({
        where: { id: order.id },
        data: { status: "DELIVERED" },
    });
    res.json({ success: true, status: "DELIVERED" });
});
exports.default = router;
