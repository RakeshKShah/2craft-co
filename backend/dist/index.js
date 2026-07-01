"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_cron_1 = __importDefault(require("node-cron"));
const auth_1 = __importDefault(require("./routes/auth"));
const products_1 = __importDefault(require("./routes/products"));
const seller_1 = __importDefault(require("./routes/seller"));
const orders_1 = __importDefault(require("./routes/orders"));
const reviews_1 = __importDefault(require("./routes/reviews"));
const admin_1 = __importDefault(require("./routes/admin"));
const payouts_1 = require("./services/payouts");
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 4000;
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(express_1.default.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", auth_1.default);
app.use("/products", products_1.default);
app.use("/seller", seller_1.default);
app.use("/orders", orders_1.default);
app.use("/reviews", reviews_1.default);
app.use("/admin", admin_1.default);
// BR-06: Cron runs every Monday at 9:00 AM
node_cron_1.default.schedule("0 9 * * 1", () => {
    console.log("[cron] Running weekly payouts...");
    (0, payouts_1.runWeeklyPayouts)()
        .then((r) => console.log("[cron] Payouts complete:", r))
        .catch((e) => console.error("[cron] Payout error:", e));
});
app.listen(PORT, () => {
    console.log(`Craft & Co API running on http://localhost:${PORT}`);
});
