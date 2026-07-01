"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWeeklyPayouts = runWeeklyPayouts;
exports.syncProductStockStatus = syncProductStockStatus;
exports.suspendSellerProducts = suspendSellerProducts;
exports.activateSellerProducts = activateSellerProducts;
const prisma_1 = require("../utils/prisma");
async function runWeeklyPayouts() {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setHours(0, 0, 0, 0);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7);
    const unpaidItems = await prisma_1.prisma.orderItem.findMany({
        where: {
            payoutId: null,
            order: {
                status: { in: ["PAID", "SHIPPED", "DELIVERED"] },
                createdAt: { gte: periodStart, lt: periodEnd },
            },
        },
        include: { product: { include: { seller: true } } },
    });
    const bySeller = new Map();
    for (const item of unpaidItems) {
        const sellerId = item.product.sellerId;
        const list = bySeller.get(sellerId) ?? [];
        list.push(item);
        bySeller.set(sellerId, list);
    }
    const results = [];
    for (const [sellerId, items] of bySeller) {
        const amountCents = items.reduce((s, i) => s + i.sellerPayoutCents, 0);
        const seller = items[0].product.seller;
        const payout = await prisma_1.prisma.payout.create({
            data: {
                sellerId,
                amountCents,
                periodStart,
                periodEnd,
                status: "PENDING",
                orderItems: { connect: items.map((i) => ({ id: i.id })) },
            },
        });
        results.push(payout);
    }
    return {
        processed: results.length,
        totalAmountCents: results.reduce((s, p) => s + p.amountCents, 0),
        demoMode: true,
    };
}
async function syncProductStockStatus(productId) {
    const product = await prisma_1.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status === "REMOVED")
        return;
    await prisma_1.prisma.product.update({
        where: { id: productId },
        data: {
            status: product.stockQty <= 0 ? "SOLD_OUT" : "ACTIVE",
        },
    });
}
async function suspendSellerProducts(sellerId) {
    await prisma_1.prisma.product.updateMany({
        where: { sellerId },
        data: { visible: false },
    });
}
async function activateSellerProducts(sellerId) {
    const products = await prisma_1.prisma.product.findMany({ where: { sellerId, status: { not: "REMOVED" } } });
    for (const p of products) {
        await prisma_1.prisma.product.update({
            where: { id: p.id },
            data: {
                visible: true,
                status: p.stockQty <= 0 ? "SOLD_OUT" : "ACTIVE",
            },
        });
    }
}
