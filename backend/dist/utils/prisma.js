"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_FEE_RATE = exports.prisma = void 0;
exports.calcFees = calcFees;
exports.deriveProductStatus = deriveProductStatus;
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const client_1 = require("@prisma/client");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
exports.prisma = new client_1.PrismaClient({ adapter });
exports.PLATFORM_FEE_RATE = 0.1;
function calcFees(totalCents) {
    const platformFeeCents = Math.round(totalCents * exports.PLATFORM_FEE_RATE);
    const sellerPayoutCents = totalCents - platformFeeCents;
    return { platformFeeCents, sellerPayoutCents };
}
function deriveProductStatus(stockQty, status) {
    if (status === "REMOVED")
        return "removed";
    if (stockQty <= 0)
        return "sold_out";
    return "active";
}
