"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifySellerOrderPaid = notifySellerOrderPaid;
const resend_1 = require("resend");
const resend = process.env.RESEND_API_KEY
    ? new resend_1.Resend(process.env.RESEND_API_KEY)
    : null;
async function notifySellerOrderPaid(sellerEmail, storeName, productTitle, qty) {
    if (!resend) {
        console.log(`[email demo] New order for ${storeName}: ${qty}x ${productTitle} → ${sellerEmail}`);
        return;
    }
    await resend.emails.send({
        from: process.env.FROM_EMAIL ?? "Craft & Co <orders@craftco.com>",
        to: sellerEmail,
        subject: `New order for ${productTitle}`,
        html: `<p>Hi ${storeName},</p><p>You have a new order: <strong>${qty}x ${productTitle}</strong>.</p><p>Log in to your seller dashboard to mark it shipped.</p>`,
    });
}
