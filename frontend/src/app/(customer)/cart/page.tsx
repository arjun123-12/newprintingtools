'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Trash2,
  Palette,
  ArrowRight,
  ShieldCheck,
  Truck,
  Plus,
  Minus,
  Loader2,
  Package,
  Layers,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { cartService, CartData, CartItemData } from '@/services/cartService';
import { useCartStore } from '@/stores/cartStore';
import { useAuth } from '@/context/AuthContext';

export default function CartPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { cart, fetchCart } = useCartStore();

  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchCart();
      setLoading(false);
    };
    void load();
  }, [fetchCart]);

  const handleUpdateQuantity = async (itemId: string, currentQty: number, delta: number) => {
    const newQty = Math.max(1, currentQty + delta);
    if (newQty === currentQty) return;

    setUpdatingItemId(itemId);
    try {
      await cartService.updateItem(itemId, newQty);
      await fetchCart();
    } catch (err) {
      console.warn('Failed to update quantity:', err);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setUpdatingItemId(itemId);
    try {
      await cartService.removeItem(itemId);
      await fetchCart();
    } catch (err) {
      console.warn('Failed to remove item:', err);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleClearCart = async () => {
    if (!confirm('Are you sure you want to empty your shopping cart?')) return;
    setLoading(true);
    try {
      await cartService.clearCart();
      await fetchCart();
    } finally {
      setLoading(false);
    }
  };

  const items = cart?.items || [];
  const subtotalExGst = Number(cart?.subtotal_ex_gst || 0);
  const gstAmount = Number(cart?.gst_amount || 0);
  const totalIncGst = Number(cart?.total_inc_gst || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-sky-600" />
            <span>Shopping Cart</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isAuthenticated ? (
              <span>Your cart is saved persistently to your account ({user?.email}).</span>
            ) : (
              <span>
                You are checking out as a guest.{' '}
                <Link href="/login?redirect=/cart" className="text-sky-600 font-bold hover:underline">
                  Sign in
                </Link>{' '}
                to permanently link this cart to your profile.
              </span>
            )}
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClearCart}
            className="text-xs text-slate-400 hover:text-rose-600 font-medium flex items-center gap-1 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Empty Cart</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          <p className="text-sm font-semibold">Loading your cart...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 sm:p-16 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
            <ShoppingCart className="w-8 h-8 stroke-1" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-800">Your Cart is Currently Empty</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Select any print product, customize it with our ready-to-print Admin templates, and add it here.
            </p>
          </div>

          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <Package className="w-4 h-4" />
            <span>Browse Print Products</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-8 space-y-4">
            {items.map((item) => {
              const productName = item.product?.name || 'Custom Print Product';
              const artworkName = item.artwork?.name || item.selected_options?.artwork_name || 'Customer Artwork';
              const artworkThumbnail = item.artwork?.thumbnail_url;
              const isUpdating = updatingItemId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm hover:shadow transition flex flex-col sm:flex-row items-start sm:items-center gap-5"
                >
                  {/* Artwork Preview Card */}
                  <div className="relative w-full sm:w-36 aspect-[4/3] bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center p-2 shrink-0 overflow-hidden group">
                    {artworkThumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={artworkThumbnail}
                        alt={artworkName}
                        className="max-h-full max-w-full object-contain rounded drop-shadow-sm"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400 text-center">
                        <Layers className="w-6 h-6 stroke-1" />
                        <span className="text-[9px] font-semibold">Custom Artwork</span>
                      </div>
                    )}

                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-white/90 backdrop-blur-xs text-[9px] font-bold text-slate-700 border border-slate-200 shadow-2xs">
                      Custom Design
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-2 w-full">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900">{productName}</h3>
                        <span className="text-base font-black text-slate-900 sm:hidden">
                          ${Number(item.total_inc_gst).toFixed(2)}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-sky-700 flex items-center gap-1">
                        <Palette className="w-3.5 h-3.5" />
                        <span>Artwork: {artworkName}</span>
                      </p>
                    </div>

                    {/* Selected Options Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {item.selected_options?.paper_stock && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">
                          {item.selected_options.paper_stock}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">
                        ${Number(item.unit_price_ex_gst).toFixed(4)} / item
                      </span>
                    </div>

                    {/* Action Bar (Edit Design & Remove) */}
                    <div className="pt-2 flex items-center gap-3">
                      {item.artwork_id && (
                        <Link
                          href={`/design/${item.product_id}?artworkId=${item.artwork_id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline"
                        >
                          <Palette className="w-3.5 h-3.5" />
                          <span>Edit Design</span>
                        </Link>
                      )}

                      <span className="text-slate-300">|</span>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-rose-600 transition disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>

                  {/* Quantity and Price */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50 overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity, -50)}
                        disabled={isUpdating || item.quantity <= 50}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 transition disabled:opacity-30"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-bold text-slate-800 min-w-[3rem] text-center">
                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity, 50)}
                        disabled={isUpdating}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 transition disabled:opacity-30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right hidden sm:block">
                      <span className="text-lg font-black text-slate-900 block">
                        ${Number(item.total_inc_gst).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400">inc GST</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6 sticky top-24">
            <h3 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
              Order Summary
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span>Subtotal (ex GST)</span>
                <span className="font-semibold text-slate-800">${subtotalExGst.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <span>GST (10% AU)</span>
                <span className="font-semibold text-slate-800">${gstAmount.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <span>Delivery</span>
                <span className="font-semibold text-emerald-600">
                  {totalIncGst >= 150 ? 'FREE' : '$15.00'}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-base font-black text-slate-900 block">Total Due</span>
                  <span className="text-[11px] text-slate-400">All prices in AUD</span>
                </div>
                <span className="text-2xl font-black text-slate-900">
                  ${(totalIncGst + (totalIncGst >= 150 ? 0 : 15)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="/checkout"
                className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-sky-600/20 hover:shadow-xl transition flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/products"
                className="w-full py-2.5 px-4 text-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs block transition"
              >
                Continue Shopping
              </Link>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-2 text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>100% Quality & Reprint Guarantee</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Truck className="w-4 h-4 text-sky-500" />
                <span>Free AU shipping over $150</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
