"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = require("../utils/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    role: zod_1.z.enum(["BUYER", "SELLER"]),
    storeName: zod_1.z.string().optional(),
    bio: zod_1.z.string().optional(),
});
router.post("/register", async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);
        const existing = await prisma_1.prisma.user.findUnique({ where: { email: data.email } });
        if (existing)
            return res.status(400).json({ error: "Email already registered" });
        const passwordHash = await bcryptjs_1.default.hash(data.password, 10);
        const status = data.role === "SELLER" ? "PENDING" : "ACTIVE";
        const user = await prisma_1.prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                role: data.role,
                status,
                ...(data.role === "SELLER"
                    ? {
                        sellerProfile: {
                            create: {
                                storeName: data.storeName ?? "My Shop",
                                bio: data.bio ?? "",
                            },
                        },
                    }
                    : {}),
            },
            include: { sellerProfile: true },
        });
        const token = (0, auth_1.signToken)({
            id: user.id,
            email: user.email,
            role: user.role,
            status: user.status,
            sellerProfileId: user.sellerProfile?.id,
        });
        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.status,
                sellerProfile: user.sellerProfile,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: err.issues[0]?.message });
        }
        res.status(500).json({ error: "Registration failed" });
    }
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
router.post("/login", async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({
            where: { email: data.email },
            include: { sellerProfile: true },
        });
        if (!user)
            return res.status(401).json({ error: "Invalid credentials" });
        const valid = await bcryptjs_1.default.compare(data.password, user.passwordHash);
        if (!valid)
            return res.status(401).json({ error: "Invalid credentials" });
        const token = (0, auth_1.signToken)({
            id: user.id,
            email: user.email,
            role: user.role,
            status: user.status,
            sellerProfileId: user.sellerProfile?.id,
        });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.status,
                sellerProfile: user.sellerProfile,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: err.issues[0]?.message });
        }
        res.status(500).json({ error: "Login failed" });
    }
});
router.get("/me", auth_1.requireAuth, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        include: { sellerProfile: true },
    });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        sellerProfile: user.sellerProfile,
    });
});
exports.default = router;
