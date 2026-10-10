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
import { useEnquiry } from '@/context/EnquiryContext';
import { safeLocalStorage } from '@/utils/storageHelper';

import {
  DEFAULT_PAPER_STOCKS,
  getStandaloneDesignerOptions,
  shouldFetchProductConfiguration,
} from './standaloneDesignerOptions';

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

export { DEFAULT_PAPER_STOCKS };

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

  const [quantity, setQuantity] = useState(100);
  const [selectedGsmId, setSelectedGsmId] = useState<string>('');
  const [gsmOptions, setGsmOptions] = useState<any[]>([]);
  const [printingSide, setPrintingSide] = useState<string>('');
  const [printingOptions, setPrintingOptions] = useState<any[]>([]);
  const [selectedFolding, setSelectedFolding] = useState<string>('no_fold');
  const [foldingOptions, setFoldingOptions] = useState<any[]>([]);
  const [pricing, setPricing] = useState<{
    subtotalExGst: number;
    gstAmount: number;
    totalIncGst: number;
    unitPriceExGst: number;
    perCardPrice?: number;
    printingPrice?: number;
    foldingCharge?: number;
    foldingName?: string;
    isPrintingConfig?: boolean;
    configName?: string;
    gsmName?: string;
  } | null>(null);

  const [loadingPrice, setLoadingPrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load product to discover configured printing options, GSM options, and folding options
  useEffect(() => {
    if (!isOpen || !productId) return;

    // Standalone designer flow: do not call GET /api/v1/products/default
    if (!shouldFetchProductConfiguration(productId)) {
      const standalone = getStandaloneDesignerOptions();
      setGsmOptions(standalone.gsmOptions);
      setSelectedGsmId(standalone.defaultGsmId);
      setPrintingOptions(standalone.printingOptions);
      setPrintingSide(standalone.defaultPrintingSide);
      setFoldingOptions(standalone.foldingOptions);
      setSelectedFolding(standalone.defaultFolding);
      return;
    }

    let isMounted = true;

    const fetchProduct = async () => {
      try {
        const res = await apiClient.get(`/products/${productId}`);
        const p = res.data?.data;
        if (!isMounted || !p) return;

        // 1. GSM Options
        if (p?.printing_pricing?.gsm_options && Array.isArray(p.printing_pricing.gsm_options)) {
          const activeGsm = p.printing_pricing.gsm_options.filter(
            (o: any) => o.is_active !== false && o.active !== false
          );
          if (activeGsm.length > 0) {
            setGsmOptions(activeGsm);
            const defGsm = activeGsm.find((o: any) => o.is_default) || activeGsm[0];
            setSelectedGsmId(defGsm.id);
          } else {
            setGsmOptions(DEFAULT_PAPER_STOCKS);
            setSelectedGsmId(DEFAULT_PAPER_STOCKS[0].id);
          }
        } else {
          setGsmOptions(DEFAULT_PAPER_STOCKS);
          setSelectedGsmId(DEFAULT_PAPER_STOCKS[0].id);
        }

        // 2. Printing Side Options
        if (p?.printing_pricing?.enabled && Array.isArray(p.printing_pricing.options)) {
          const activeOpts = p.printing_pricing.options.filter(
            (o: any) => o.is_active !== false && o.active !== false
          );
          setPrintingOptions(activeOpts);
          if (activeOpts.length > 0) {
            const defOpt = activeOpts.find((o: any) => o.is_default) || activeOpts[0];
            setPrintingSide(defOpt.id || 'front_only');
          }
        }

        // 3. Folding Options
        if (p?.folding_pricing?.enabled) {
          const rawOpts = p.folding_pricing.options;
          let list: any[] = [];
          if (Array.isArray(rawOpts)) {
            list = rawOpts.filter((o: any) => o.active !== false && o.is_active !== false);
          } else if (rawOpts && typeof rawOpts === 'object') {
            list = Object.entries(rawOpts)
              .filter(([_, o]: [string, any]) => o.active !== false && o.is_active !== false)
              .map(([k, o]: [string, any]) => ({ id: o.id || k, name: o.name || k, ...o }));
          }

          // Always ensure "No Folding" option exists
          const hasNoFold = list.some(
            (o: any) => o.id === 'no_fold' || o.type === 'no_fold' || (o.name && o.name.toLowerCase().includes('no fold'))
          );
          const finalFoldingList = hasNoFold
            ? list
            : [{ id: 'no_fold', name: 'No Folding (Flat)', pricing_method: 'per_order', charge: 0 }, ...list];

          setFoldingOptions(finalFoldingList);
          setSelectedFolding('no_fold');
        } else {
          setFoldingOptions([]);
          setSelectedFolding('no_fold');
        }
      } catch (err) {
        console.warn('Could not load product configuration:', err);
      }
    };

    void fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [isOpen, productId]);

  const activeGsmObj = gsmOptions.find((g) => g.id === selectedGsmId) || gsmOptions[0] || null;
  const currentPrintingConfig = printingOptions.find((o) => o.id === printingSide) || printingOptions[0] || null;
  const activeFoldingObj = foldingOptions.find((f) => f.id === selectedFolding) || null;

  // Available quantities based on selected GSM and printing configuration
  const availableQuantities = React.useMemo(() => {
    if (activeGsmObj) {
      if (activeGsmObj.side_tiers && activeGsmObj.side_tiers[printingSide]) {
        return activeGsmObj.side_tiers[printingSide].map((t: any) => t.quantity);
      }
      if (activeGsmObj.tiers && activeGsmObj.tiers.length > 0) {
        return activeGsmObj.tiers.map((t: any) => t.quantity);
      }
    }
    if (currentPrintingConfig?.tiers && currentPrintingConfig.tiers.length > 0) {
      return currentPrintingConfig.tiers.map((t: any) => t.quantity);
    }
    return QUANTITY_OPTIONS;
  }, [activeGsmObj, printingSide, currentPrintingConfig]);

  // When options change, ensure quantity matches an available tier
  useEffect(() => {
    if (availableQuantities.length > 0 && !availableQuantities.includes(quantity)) {
      setQuantity(availableQuantities[0]);
    }
  }, [availableQuantities, quantity]);

  // Fetch dynamic authoritative price whenever quantity, GSM, printingSide, or folding changes
  useEffect(() => {
    if (!isOpen || !productId) return;

    if (!shouldFetchProductConfiguration(productId)) {
      setLoadingPrice(false);
      setPricing(null);
      return;
    }

    let isMounted = true;
    const calculatePricing = async () => {
      setLoadingPrice(true);
      setError(null);
      try {
        const selected_options: Record<string, any> = {
          gsm_id: selectedGsmId,
          paper_stock: activeGsmObj?.name || activeGsmObj?.stock_name || 'Standard',
        };
        if (printingSide) {
          selected_options.printing_side_id = printingSide;
        }
        if (selectedFolding && selectedFolding !== 'no_fold') {
          selected_options.folding_style = selectedFolding;
        }

        const response = await apiClient.post('/pricing/calculate', {
          product_id: productId,
          quantity,
          selected_options,
        });

        if (isMounted && response.data?.success && response.data?.data) {
          const d = response.data.data;
          const printingDetails = d.printing_config_details || {};
          const foldingDetails = d.folding_details || {};

          setPricing({
            subtotalExGst: Number(d.subtotal_ex_gst || 0),
            gstAmount: Number(d.gst_amount || 0),
            totalIncGst: Number(d.total_inc_gst || 0),
            unitPriceExGst: Number(d.unit_price_ex_gst || 0),
            perCardPrice: printingDetails.per_card_price || (quantity > 0 ? Number(printingDetails.fixed_total_price || d.subtotal_ex_gst) / quantity : 0),
            printingPrice: Number(printingDetails.fixed_total_price ?? d.subtotal_ex_gst),
            foldingCharge: Number(foldingDetails.folding_charge || 0),
            foldingName: foldingDetails.style_name || activeFoldingObj?.name,
            isPrintingConfig: Boolean(printingDetails.enabled),
            configName: printingDetails.option_name,
            gsmName: printingDetails.gsm_name || activeGsmObj?.name,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          const msg = err.response?.data?.message || err.message || 'Live pricing calculation failed';
          console.warn('Live pricing calculation failed:', msg);
          setError(msg);
        }
      } finally {
        if (isMounted) setLoadingPrice(false);
      }
    };

    void calculatePricing();

    return () => {
      isMounted = false;
    };
  }, [isOpen, productId, quantity, selectedGsmId, printingSide, selectedFolding, activeGsmObj, activeFoldingObj]);

  const { openEnquiryModal, isAdmin } = useEnquiry();

  const handleAddToCart = async () => {
    if (!isAdmin) {
      onClose();
      openEnquiryModal({
        productId: productId === 'default' ? undefined : productId,
        productName: artworkName || 'Custom Artwork',
        quantity,
        specifications: {
          gsm: activeGsmObj?.name || activeGsmObj?.stock_name,
          printing_sides: currentPrintingConfig?.name || printingSide,
          folding: activeFoldingObj?.name || selectedFolding,
        },
      });
      return;
    }

    if (productId === 'default') {
      setError('Please select a catalog product before adding this design to the cart.');
      return;
    }

    let effectiveArtworkId = artworkId;
    if (!effectiveArtworkId && productId) {
      effectiveArtworkId = safeLocalStorage.getItem<string>('remembered_artwork_id_' + productId) || null;
    }

    if (!effectiveArtworkId) {
      setError('Please wait a moment while your artwork is saving to the database.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const selectedOpts: Record<string, any> = {
        gsm_id: selectedGsmId,
        gsm_name: activeGsmObj?.name || 'Standard GSM',
        paper_stock: activeGsmObj?.name || activeGsmObj?.stock_name || 'Standard Art Paper',
        artwork_name: artworkName,
      };

      if (printingSide) {
        selectedOpts.printing_side_id = printingSide;
        if (currentPrintingConfig?.name) {
          selectedOpts.printing_side_name = currentPrintingConfig.name;
        }
      }

      if (selectedFolding && selectedFolding !== 'no_fold') {
        selectedOpts.folding_style = selectedFolding;
        if (activeFoldingObj?.name) {
          selectedOpts.folding_name = activeFoldingObj.name;
        }
      }

      await cartService.addItem({
        product_id: productId,
        artwork_id: effectiveArtworkId,
        quantity,
        selected_options: selectedOpts,
      });

      setAddedSuccess(true);
      // Navigate directly to cart page
      onClose();
      router.push('/cart');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Could not add item to cart.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add Customized Design to Cart"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
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

              {/* Printing Configuration / Sides (When product has printing configurations) */}
              {printingOptions.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Printing Side Option
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {printingOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPrintingSide(opt.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition flex items-center justify-between ${
                          printingSide === opt.id
                            ? 'bg-sky-50 border-sky-500 text-sky-900 ring-1 ring-sky-500 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{opt.name}</span>
                        {printingSide === opt.id && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Breaks */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Print Quantity {printingOptions.length > 0 && <span className="text-[10px] text-sky-600 font-normal lowercase">(configured packages)</span>}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableQuantities.map((qty: number) => (
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

              {/* Paper Stock / GSM Options */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Paper Stock &amp; Weight (GSM)
                </label>
                <div className="space-y-1.5">
                  {gsmOptions.map((stock) => (
                    <label
                      key={stock.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        selectedGsmId === stock.id
                          ? 'bg-sky-50/70 border-sky-300 text-sky-900 font-semibold ring-1 ring-sky-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="gsm_option"
                          value={stock.id}
                          checked={selectedGsmId === stock.id}
                          onChange={() => setSelectedGsmId(stock.id)}
                          className="text-sky-600 focus:ring-sky-500"
                        />
                        <span>{stock.name}</span>
                        {stock.stock_name && (
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({stock.stock_name})
                          </span>
                        )}
                      </div>
                      {stock.gsm && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {stock.gsm} GSM
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Folding Options (When folding is configured for product) */}
              {foldingOptions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Folding Option (Add-on)
                    </label>
                    <span className="text-[10px] text-slate-400">Optional finishing</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {foldingOptions.map((fold) => {
                      const isSelected = selectedFolding === fold.id;
                      const isNoFold = fold.id === 'no_fold' || fold.type === 'no_fold' || fold.name?.toLowerCase().includes('no fold');
                      return (
                        <button
                          key={fold.id}
                          type="button"
                          onClick={() => setSelectedFolding(fold.id)}
                          className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-sky-50 border-sky-500 text-sky-900 ring-1 ring-sky-500 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="truncate">
                            <span className="block truncate">{fold.name}</span>
                            <span className="text-[10px] font-normal text-slate-400">
                              {isNoFold ? 'No charge ($0.00)' : fold.pricing_method ? `${fold.pricing_method.replace('_', ' ')}` : 'Add-on finishing'}
                            </span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Authoritative Live Pricing Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300">Live Price Breakdown</span>
                  <span className="text-[10px] font-semibold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                    Authoritative Backend Pricing
                  </span>
                </div>

                {/* Stock & Sides Summary */}
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-1 pt-0.5">
                  <span>Selected Specs:</span>
                  <span className="text-slate-200 font-medium">
                    {activeGsmObj?.name || 'Standard'} • {currentPrintingConfig?.name || 'Single-Sided'} • {quantity.toLocaleString()} qty
                  </span>
                </div>

                {/* Printing Fixed Total */}
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Printing Total ({quantity} cards):</span>
                  <span className="font-semibold text-white">
                    {loadingPrice ? '...' : `$${(pricing?.printingPrice ?? pricing?.subtotalExGst ?? 0).toFixed(2)}`}
                  </span>
                </div>

                {/* Folding Charge */}
                {pricing && pricing.foldingCharge !== undefined && pricing.foldingCharge > 0 && (
                  <div className="flex items-center justify-between text-xs text-amber-300">
                    <span>Folding ({pricing.foldingName || 'Finishing'}):</span>
                    <span className="font-semibold">+${pricing.foldingCharge.toFixed(2)}</span>
                  </div>
                )}

                {/* Price per card */}
                <div className="flex items-center justify-between text-xs text-emerald-400">
                  <span>Price Per Card (Auto):</span>
                  <span className="font-mono font-bold">
                    {loadingPrice
                      ? '...'
                      : `$${(pricing?.perCardPrice || (quantity > 0 ? (pricing?.printingPrice || 0) / quantity : 0)).toFixed(2)} / card`}
                  </span>
                </div>

                {/* Subtotal Ex GST */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Subtotal (ex GST):</span>
                  <span>{loadingPrice ? '...' : `$${(pricing?.subtotalExGst || 0).toFixed(2)}`}</span>
                </div>

                {/* GST */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>GST (10% AU):</span>
                  <span>{loadingPrice ? '...' : `$${(pricing?.gstAmount || 0).toFixed(2)}`}</span>
                </div>

                {/* Total Inc GST */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-300 font-bold block">Final Total Payable</span>
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
