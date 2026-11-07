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
  Plus,
  Minus,
  Loader2,
  Package,
  Layers,
  ArrowLeft,
  CheckCircle2,
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import { cartService, CartData, CartItemData } from '@/services/cartService';
import { useCartStore } from '@/stores/cartStore';
import { useAuth } from '@/context/AuthContext';
import { useEnquiry } from '@/context/EnquiryContext';

export default function CartPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { openEnquiryModal, isAdmin } = useEnquiry();
  const { cart, fetchCart } = useCartStore();

  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<CartItemData | null>(null);

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

  return (
    <div className="relative isolate min-h-full bg-[linear-gradient(145deg,#eff8ff_0%,#f5f3ff_42%,#f8fafc_72%,#ffffff_100%)]">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 top-24 h-96 w-96 rounded-full bg-sky-300/20 blur-[100px]" />
      <div className="absolute -right-40 top-[28rem] h-[30rem] w-[30rem] rounded-full bg-violet-300/20 blur-[110px]" />
      <div className="absolute left-1/3 top-[58rem] h-80 w-80 rounded-full bg-cyan-200/20 blur-[100px]" />
    </div>
    <div className="relative z-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Top Header */}
      <div className="cart-enter relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-sky-100 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-sky-700 ring-1 ring-sky-100">
            <Sparkles className="h-3 w-3" /> Made for your next big idea
          </span>
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
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          <p className="text-sm font-semibold">Loading your cart...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="cart-enter bg-white rounded-3xl border border-dashed border-slate-300 p-12 sm:p-16 text-center space-y-5">
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
            {items.map((item, index) => {
              const productName = item.product?.name || 'Custom Print Product';
              const artworkName = item.artwork?.name || item.selected_options?.artwork_name || 'Customer Artwork';
              const artworkThumbnail = item.artwork?.thumbnail_url;
              const isUpdating = updatingItemId === item.id;

              return (
                <div
                  key={item.id}
                  className="cart-enter group bg-white/95 rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 hover:border-sky-200 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-5"
                  style={{ animationDelay: `${Math.min(index * 75, 450)}ms` }}
                >
                  {/* Artwork Preview Card */}
                  <div className="relative w-full sm:w-40 aspect-[4/3] bg-gradient-to-br from-slate-100 via-white to-sky-50 rounded-2xl border border-slate-200/80 flex items-center justify-center p-3 shrink-0 overflow-hidden">
                    {artworkThumbnail ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={artworkThumbnail} alt={artworkName} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain rounded drop-shadow-md transition-transform duration-300 group-hover:scale-105" />
                        <button type="button" onClick={() => setSelectedPreview(item)} className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-slate-950/65 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label={`View mockup for ${productName}`}>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-800 shadow-lg"><Eye className="h-3.5 w-3.5 text-sky-600" /> View mockup</span>
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setSelectedPreview(item)} className="flex flex-col items-center gap-1 text-slate-400 text-center" aria-label={`View preview for ${productName}`}>
                        <Layers className="w-6 h-6 stroke-1" />
                        <span className="text-[9px] font-semibold">Preview artwork</span>
                      </button>
                    )}

                    <span className="pointer-events-none absolute left-2 top-2 rounded-full border border-white/80 bg-white/85 px-2 py-1 text-[9px] font-bold text-slate-700 shadow-sm backdrop-blur">
                      YOUR DESIGN
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-2 w-full">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900">{productName}</h3>
                        <span className="text-base font-black text-slate-900 sm:hidden">
                          ${Number(item.subtotal_ex_gst).toFixed(2)}
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
                          ${Number(item.unit_price_ex_gst).toFixed(4)} / item (ex GST)
                      </span>
                    </div>

                    {/* Cart item actions */}
                    <div className="pt-2 flex items-center gap-3">
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
                        ${Number(item.subtotal_ex_gst).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400">product cost</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary Sidebar */}
          <div className="cart-enter cart-enter-late lg:col-span-4 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-lg shadow-slate-900/5 space-y-6 sticky top-24">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div><p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Ready to print</p><h3 className="mt-1 text-lg font-black text-slate-900">Order Summary</h3></div>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600"><ShoppingCart className="h-5 w-5" /></span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span>Products total</span>
                <span className="font-semibold text-slate-800">${subtotalExGst.toFixed(2)}</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-base font-black text-slate-900 block">Product cost</span>
                  <span className="text-[11px] text-slate-400">Excludes GST and delivery</span>
                </div>
                <span className="text-2xl font-black text-slate-900">
                  ${subtotalExGst.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {isAdmin ? (
                <Link
                  href="/checkout"
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-sky-600/20 hover:shadow-xl transition flex items-center justify-center gap-2"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    openEnquiryModal({
                      productName: items.map((i) => i.product?.name).filter(Boolean).join(', ') || 'Cart Items',
                      quantity: items.reduce((acc, i) => acc + (i.quantity || 0), 0) || undefined,
                      sourceUrl: '/cart',
                    })
                  }
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-sky-600/20 hover:shadow-xl transition flex items-center justify-center gap-2"
                >
                  <span>Request Quote for Cart Items</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

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
            </div>
          </div>
        </div>
      )}
    </div>
    {selectedPreview && (
      <div className="cart-preview-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Artwork mockup preview" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPreview(null); }}>
        <div className="cart-preview-panel relative w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
          <button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md transition hover:bg-white hover:text-slate-950" aria-label="Close mockup preview"><X className="h-5 w-5" /></button>
          <div className="grid md:grid-cols-[1.1fr_0.9fr]">
            <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-100 via-slate-100 to-indigo-100 p-8 sm:min-h-[480px]">
              {selectedPreview.product?.thumbnail_url && <img src={selectedPreview.product.thumbnail_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-[1px]" />}
              <div className="absolute inset-0 bg-white/20" />
              <div className="cart-mockup-float relative flex h-[260px] w-[min(100%,420px)] rotate-[-2deg] items-center justify-center rounded-xl border border-white/80 bg-white p-4 shadow-[0_30px_70px_-25px_rgba(15,23,42,0.45)] transition-transform duration-500 hover:rotate-0 sm:h-[340px] sm:p-7">
                {selectedPreview.artwork?.thumbnail_url ? <img src={selectedPreview.artwork.thumbnail_url} alt={selectedPreview.artwork.name || 'Artwork preview'} decoding="async" className="max-h-full max-w-full object-contain" /> : <div className="text-center text-slate-400"><Layers className="mx-auto h-12 w-12" /><p className="mt-3 text-sm font-semibold">Artwork preview unavailable</p></div>}
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">Print preview</span>
              </div>
            </div>
            <div className="flex flex-col justify-center p-7 sm:p-10">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-violet-700"><Sparkles className="h-3.5 w-3.5" /> Your custom design</span>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">{selectedPreview.product?.name || 'Custom print product'}</h2>
              <p className="mt-2 text-sm text-slate-500">{selectedPreview.artwork?.name || 'Your artwork'} · Quantity {selectedPreview.quantity.toLocaleString()}</p>
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">Product cost</p>
                <p className="mt-1 text-2xl font-black text-slate-900">${Number(selectedPreview.subtotal_ex_gst).toFixed(2)} <span className="text-xs font-medium text-slate-400">ex GST</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
