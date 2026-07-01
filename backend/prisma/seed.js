"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
require("dotenv/config");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
const IMG = {
    jewelry: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80",
    ceramics: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=600&q=80",
    textiles: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80",
};
const seedProducts = [
    { title: "Silver Leaf Earrings", category: "jewelry", price: 4500, stock: 8, img: IMG.jewelry },
    { title: "Turquoise Pendant", category: "jewelry", price: 6200, stock: 0, img: IMG.jewelry },
    { title: "Hammered Copper Bracelet", category: "jewelry", price: 3800, stock: 5, img: IMG.jewelry },
    { title: "Beaded Anklet Set", category: "jewelry", price: 2200, stock: 12, img: IMG.jewelry },
    { title: "Hand-thrown Ceramic Mug", category: "ceramics", price: 3200, stock: 6, img: IMG.ceramics },
    { title: "Speckled Serving Bowl", category: "ceramics", price: 5400, stock: 0, img: IMG.ceramics },
    { title: "Stoneware Planter", category: "ceramics", price: 4800, stock: 4, img: IMG.ceramics },
    { title: "Glazed Tea Set", category: "ceramics", price: 8900, stock: 2, img: IMG.ceramics },
    { title: "Handwoven Linen Scarf", category: "textiles", price: 6800, stock: 7, img: IMG.textiles },
    { title: "Indigo Block Print Napkins", category: "textiles", price: 3600, stock: 10, img: IMG.textiles },
    { title: "Wool Wall Hanging", category: "textiles", price: 12500, stock: 3, img: IMG.textiles },
    { title: "Embroidered Tote Bag", category: "textiles", price: 4200, stock: 6, img: IMG.textiles },
];
async function main() {
    const accounts = [
        { email: "admin@craftco.com", password: "Admin1234!", role: "ADMIN", status: "ACTIVE" },
        { email: "seller@craftco.com", password: "Seller1234!", role: "SELLER", status: "ACTIVE", storeName: "River Clay Studio", bio: "Handmade ceramics and jewelry from the Pacific Northwest." },
        { email: "pending@craftco.com", password: "Pending1234!", role: "SELLER", status: "PENDING", storeName: "Waiting Workshop", bio: "Awaiting approval." },
        { email: "buyer@craftco.com", password: "Buyer1234!", role: "BUYER", status: "ACTIVE" },
    ];
    for (const acct of accounts) {
        const hash = await bcryptjs_1.default.hash(acct.password, 10);
        await prisma.user.upsert({
            where: { email: acct.email },
            update: { passwordHash: hash, status: acct.status },
            create: {
                email: acct.email,
                passwordHash: hash,
                role: acct.role,
                status: acct.status,
                ...(acct.role === "SELLER"
                    ? {
                        sellerProfile: {
                            create: {
                                storeName: acct.storeName,
                                bio: acct.bio ?? "",
                            },
                        },
                    }
                    : {}),
            },
        });
    }
    const seller = await prisma.user.findUnique({
        where: { email: "seller@craftco.com" },
        include: { sellerProfile: true },
    });
    if (seller?.sellerProfile) {
        for (const p of seedProducts) {
            const existing = await prisma.product.findFirst({
                where: { sellerId: seller.sellerProfile.id, title: p.title },
            });
            if (!existing) {
                await prisma.product.create({
                    data: {
                        sellerId: seller.sellerProfile.id,
                        title: p.title,
                        description: `Beautiful handmade ${p.title.toLowerCase()} crafted with care.`,
                        category: p.category,
                        priceCents: p.price,
                        stockQty: p.stock,
                        photos: [p.img],
                        status: p.stock <= 0 ? "SOLD_OUT" : "ACTIVE",
                        visible: true,
                    },
                });
            }
        }
    }
    console.log("Seeded Craft & Co accounts and 12 products");
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
