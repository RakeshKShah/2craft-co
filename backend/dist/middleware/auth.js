"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requireActiveSeller = requireActiveSeller;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../utils/prisma");
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
function signToken(user) {
    return jsonwebtoken_1.default.sign(user, JWT_SECRET, { expiresIn: "7d" });
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
}
async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const payload = verifyToken(header.slice(7));
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.id },
            include: { sellerProfile: true },
        });
        if (!user)
            return res.status(401).json({ error: "Unauthorized" });
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            status: user.status,
            sellerProfileId: user.sellerProfile?.id,
        };
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        next();
    };
}
function requireActiveSeller(req, res, next) {
    if (!req.user || req.user.role !== "SELLER") {
        return res.status(403).json({ error: "Seller access required" });
    }
    if (req.user.status !== "ACTIVE") {
        return res.status(403).json({ error: "Seller account must be active" });
    }
    next();
}
function optionalAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
        return next();
    try {
        req.user = verifyToken(header.slice(7));
    }
    catch {
        // ignore invalid token for public routes
    }
    next();
}
