import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatPrice } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

export function CartPage() {
  const { items, updateQty, remove, totalCents, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    if (!user) { navigate("/login"); return; }
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/orders/checkout", {
        items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
      });
      clear();
      navigate(`/orders?success=${data.order_id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-serif text-3xl">Your cart</h1>
      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed p-12 text-center">
          <p className="text-stone-500">Your cart is empty.</p>
          <Link to="/" className="mt-4 inline-block text-teal-800 hover:underline">Continue browsing</Link>
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-4">
            {items.map((item) => (
              <div key={item.product_id} className="flex gap-4 rounded-xl border bg-white p-4">
                {item.photo && <img src={item.photo} alt="" className="h-24 w-24 rounded-lg object-cover" />}
                <div className="flex flex-1 flex-col justify-between">
                  <h2 className="font-medium">{item.title}</h2>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateQty(item.product_id, item.qty - 1)} className="h-8 w-8 rounded-full border">−</button>
                    <span>{item.qty}</span>
                    <button type="button" onClick={() => updateQty(item.product_id, item.qty + 1)} className="h-8 w-8 rounded-full border">+</button>
                    <button type="button" onClick={() => remove(item.product_id)} className="text-sm text-red-600">Remove</button>
                  </div>
                </div>
                <p className="font-medium text-teal-900">{formatPrice(item.price_cents * item.qty)}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-between rounded-xl bg-white p-6 shadow-sm">
            <span className="text-lg font-medium">Total</span>
            <span className="text-2xl font-semibold text-teal-900">{formatPrice(totalCents)}</span>
          </div>
          {error && <p className="mt-4 text-red-600">{error}</p>}
          <button
            type="button"
            onClick={checkout}
            disabled={loading}
            className="mt-6 w-full rounded-full bg-teal-800 py-4 font-medium text-white hover:bg-teal-900 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Place Order"}
          </button>
        </>
      )}
    </div>
  );
}
