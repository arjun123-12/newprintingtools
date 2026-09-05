'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';
import { cartService } from '@/services/cartService';

interface AddToCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  artworkId: string | null;
  artworkName: string;
  previewDataUrl: string | null;
  dimensionsText?: string;
}

const QUANTITY_OPTIONS = [100, 250, 500, 1000, 2500, 5000];

const PAPER_STOCKS = [
  { id: '350_matte', label: '350gsm Premium Matte Artboard' },
  { id: '400_gloss', label: '400gsm High Gloss Finish' },
  { id: '300_recycled', label: '300gsm 100% Recycled Kraft' },
];

export const AddToCartModal: React.FC<AddToCartModalProps> = ({
  isOpen,
  onClose,
  productId,
  artworkId,
  artworkName,
  previewDataUrl,
  dimensionsText,
}) => {
  const router = useRouter();

  const [quantity, setQuantity] = useState(250);
  const [paperStock, setPaperStock] = useState('350_matte');
  const [pricing, setPricing] = useState<{
    subtotalExGst: number;
    gstAmount: number;
    totalIncGst: number;
    unitPriceExGst: number;
  } | null>(null);

  const [loadingPrice, setLoadingPrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch dynamic price whenever quantity or options change
  useEffect(() => {
    if (!isOpen || !productId) return;

    let isMounted = true;
    const calculatePricing = async () => {
      setLoadingPrice(true);
      try {
        const response = await apiClient.post('/pricing/calculate', {
          product_id: productId,
          quantity,
          selected_options: { paper_stock: paperStock },
        });

        if (isMounted && response.data?.success && response.data?.data) {
          const d = response.data.data;
          setPricing({
            subtotalExGst: Number(d.subtotal_ex_gst || 0),
            gstAmount: Number(d.gst_amount || 0),
            totalIncGst: Number(d.total_inc_gst || 0),
            unitPriceExGst: Number(d.unit_price_ex_gst || 0),
          });
        }
      } catch (err) {
        console.warn('Live pricing calculation failed:', err);
      } finally {
        if (isMounted) setLoadingPrice(false);
      }
    };

    void calculatePricing();

    return () => {
      isMounted = false;
    };
  }, [isOpen, productId, quantity, paperStock]);

  if (!isOpen) return null;

  const handleAddToCart = async () => {
    if (!artworkId) {
      setError('Please wait a moment while your artwork is saving to the database.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await cartService.addItem({
        product_id: productId,
        artwork_id: artworkId,
        quantity,
        selected_options: {
          paper_stock: PAPER_STOCKS.find((p) => p.id === paperStock)?.label || paperStock,
          artwork_name: artworkName,
        },
      });

      setAddedSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Could not add item to cart.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm sm:text-base">Add Customized Design to Cart</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {addedSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-black text-slate-900">Added to Your Cart!</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Your custom artwork &ldquo;{artworkName}&rdquo; has been saved and linked to your cart.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition"
                >
                  Continue Editing
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/cart');
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <span>Go to Cart</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Artwork Summary preview */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="w-20 h-16 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
                  {previewDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={previewDataUrl}
                      alt={artworkName}
                      className="max-h-full max-w-full object-contain rounded"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <div className="space-y-0.5 overflow-hidden">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {artworkName || 'Custom Artwork'}
                  </h4>
                  {dimensionsText && (
                    <p className="text-[11px] text-slate-500">{dimensionsText}</p>
                  )}
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Ready for Production
                  </span>
                </div>
              </div>

              {/* Quantity Breaks */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Print Quantity
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {QUANTITY_OPTIONS.map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setQuantity(qty)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition ${
                        quantity === qty
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {qty.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paper Stock */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Material & Paper Stock
                </label>
                <div className="space-y-1.5">
                  {PAPER_STOCKS.map((stock) => (
                    <label
                      key={stock.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        paperStock === stock.id
                          ? 'bg-sky-50/70 border-sky-300 text-sky-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paper_stock"
                        value={stock.id}
                        checked={paperStock === stock.id}
                        onChange={() => setPaperStock(stock.id)}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span>{stock.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Live Pricing Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Unit Price:</span>
                  <span>
                    {loadingPrice
                      ? '...'
                      : `$${(pricing?.unitPriceExGst || 0).toFixed(4)} / each`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Subtotal (ex GST):</span>
                  <span>{loadingPrice ? '...' : `$${(pricing?.subtotalExGst || 0).toFixed(2)}`}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>GST (10% AU):</span>
                  <span>{loadingPrice ? '...' : `$${(pricing?.gstAmount || 0).toFixed(2)}`}</span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-300 font-bold block">Total Payable</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Free AU Delivery &gt; $150
                    </span>
                  </div>

                  <span className="text-xl font-black text-white">
                    {loadingPrice ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      `$${(pricing?.totalIncGst || 0).toFixed(2)}`
                    )}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={submitting || loadingPrice}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving to Cart...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    <span>Add {quantity.toLocaleString()} Items to Cart</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
