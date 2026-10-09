'use client';

import React, { useState, useMemo } from 'react';
import { Eye, Check, Layers } from 'lucide-react';
import { AttributeItem, FoldingPricingConfig, PrintingPricingConfig } from './types';

interface FrontendOptionPreviewProps {
  productName?: string;
  basePrice?: number;
  attributes: AttributeItem[];
  quantityBreaks?: number[];
  foldingPricing?: FoldingPricingConfig | null;
  printingPricing?: PrintingPricingConfig | null;
}

const DEFAULT_FOLDING_OPTIONS = [
  { label: 'No Folding (Flat Sheet)', value: 'no_fold' },
  { label: 'Half Fold', value: 'half_fold' },
  { label: 'Tri-Fold / Letter Fold', value: 'tri_fold' },
  { label: 'Z-Fold', value: 'z_fold' },
  { label: 'Gate Fold', value: 'gate_fold' },
  { label: 'Double Parallel Fold', value: 'double_parallel_fold' },
  { label: 'Custom Fold', value: 'custom_fold' },
];

export const FrontendOptionPreview: React.FC<FrontendOptionPreviewProps> = ({
  productName = 'Product Name',
  basePrice = 49.99,
  attributes = [],
  quantityBreaks = [100, 250, 500, 1000, 2000],
  foldingPricing,
  printingPricing,
}) => {
  const [selectedPrintingSide, setSelectedPrintingSide] = useState<string>('');
  const [selectedQty, setSelectedQty] = useState<number>(quantityBreaks[0] || 100);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedFolding, setSelectedFolding] = useState<string>('no_fold');

  const handleSelectOption = (attrCode: string, valueStr: string) => {
    setSelectedOptions((prev) => ({ ...prev, [attrCode]: valueStr }));
  };

  // Determine available printing configurations
  const isPrintingActive = Boolean(
    printingPricing?.enabled && printingPricing.options && printingPricing.options.length > 0
  );

  const availablePrintingOptions = useMemo(() => {
    if (!isPrintingActive || !printingPricing?.options) return [];
    return printingPricing.options.filter((o) => o.is_active !== false && o.active !== false);
  }, [isPrintingActive, printingPricing]);

  // Synchronize default printing side option
  React.useEffect(() => {
    if (availablePrintingOptions.length > 0) {
      const exists = availablePrintingOptions.some((o) => o.id === selectedPrintingSide);
      if (!exists) {
        const defaultOpt =
          availablePrintingOptions.find((o) => o.is_default) || availablePrintingOptions[0];
        setSelectedPrintingSide(defaultOpt.id);
      }
    }
  }, [availablePrintingOptions, selectedPrintingSide]);

  const activePrintingConfig = useMemo(() => {
    return (
      availablePrintingOptions.find((o) => o.id === selectedPrintingSide) ||
      availablePrintingOptions[0] ||
      null
    );
  }, [availablePrintingOptions, selectedPrintingSide]);

  // Quantity options (configured fixed-total tiers when printing pricing is active)
  const activeQuantityOptions = useMemo(() => {
    if (isPrintingActive && activePrintingConfig?.tiers && activePrintingConfig.tiers.length > 0) {
      return activePrintingConfig.tiers.map((t) => t.quantity);
    }
    return quantityBreaks;
  }, [isPrintingActive, activePrintingConfig, quantityBreaks]);

  React.useEffect(() => {
    if (activeQuantityOptions.length > 0 && !activeQuantityOptions.includes(selectedQty)) {
      setSelectedQty(activeQuantityOptions[0]);
    }
  }, [activeQuantityOptions, selectedQty]);

  // Determine available folding options
  const foldingAttr = attributes.find(
    (a) => a.code === 'folding_style' || a.name.toLowerCase() === 'folding'
  );

  const availableFoldingOptions = useMemo(() => {
    if (!foldingPricing?.enabled) return [];

    // Priority 1: Configured options from foldingPricing manager
    if (Array.isArray(foldingPricing?.options) && foldingPricing.options.length > 0) {
      return foldingPricing.options
        .filter((o) => o.active !== false && o.is_active !== false)
        .map((o) => ({
          value: o.id || o.type || 'no_fold',
          label: o.name || o.type || 'Option',
        }));
    }

    if (foldingAttr && foldingAttr.values.length > 0) {
      // Filter only active values
      return foldingAttr.values.filter((v) => v.is_active !== false);
    }

    // Fallback to configured active options from foldingPricing.options record or standard list
    return DEFAULT_FOLDING_OPTIONS.filter((opt) => {
      const optConf = (foldingPricing?.options as any)?.[opt.value];
      return !optConf || optConf.active !== false;
    });
  }, [foldingPricing, foldingAttr]);

  // Synchronize default folding option if none or invalid selected
  React.useEffect(() => {
    if (availableFoldingOptions.length > 0) {
      const exists = availableFoldingOptions.some((o) => o.value === selectedFolding);
      if (!exists) {
        setSelectedFolding(availableFoldingOptions[0].value);
      }
    }
  }, [availableFoldingOptions, selectedFolding]);

  // Calculate base printing price & folding charge
  const pricing = useMemo(() => {
    let unitBaseModifier = 0;

    // Attributes modifiers (excluding folding if managed separately)
    attributes.forEach((attr) => {
      if (attr.code === 'folding_style' || attr.name.toLowerCase() === 'folding') {
        return; // Handled by folding add-on pricing engine
      }

      const activeVals = attr.values.filter((v) => v.is_active !== false);
      const selectedValCode = selectedOptions[attr.code] || activeVals[0]?.value;
      const valObj = activeVals.find((v) => v.value === selectedValCode);

      if (valObj) {
        const anyVal = valObj as any;
        if (anyVal.priceModifiers && typeof anyVal.priceModifiers[selectedQty] === 'number') {
          unitBaseModifier += Number(anyVal.priceModifiers[selectedQty]);
        } else if (typeof valObj.price_modifier_amount === 'number') {
          unitBaseModifier += Number(valObj.price_modifier_amount);
        }
      }
    });

    let basePrintingTotal = 0;
    let baseUnitPrice = 0;
    let isFixedTierMatch = false;

    if (isPrintingActive && activePrintingConfig) {
      const matchedTier = (activePrintingConfig.tiers || []).find((t) => t.quantity === selectedQty);
      if (matchedTier) {
        basePrintingTotal = Number(matchedTier.total_price);
        baseUnitPrice = selectedQty > 0 ? basePrintingTotal / selectedQty : 0;
        isFixedTierMatch = true;
      }
    }

    if (!isFixedTierMatch) {
      baseUnitPrice = (Number(basePrice) || 0) + unitBaseModifier;
      basePrintingTotal = baseUnitPrice * selectedQty;
    } else {
      baseUnitPrice += unitBaseModifier;
      basePrintingTotal += unitBaseModifier * selectedQty;
    }

    // Folding Add-on Pricing calculation
    let foldingCharge = 0;
    const isFoldingActive = Boolean(foldingPricing?.enabled);

    // Find optConf in either array or dictionary
    const optConf = Array.isArray(foldingPricing?.options)
      ? foldingPricing.options.find(
          (o) => o.id === selectedFolding || o.type === selectedFolding || o.name === selectedFolding
        )
      : (foldingPricing?.options as any)?.[selectedFolding];

    const isFlatFold =
      selectedFolding === 'no_fold' ||
      selectedFolding === 'flat' ||
      selectedFolding.toLowerCase().includes('no fold') ||
      optConf?.type === 'no_fold';

    if (isFoldingActive && !isFlatFold) {
      const method = optConf?.pricing_method || foldingPricing?.pricing_method || 'quantity_based';
      const chargeVal = optConf?.charge ?? foldingPricing?.additional_charge ?? 0;
      const tiers = optConf?.tiers || foldingPricing?.tiers || [];

      if (method === 'per_order') {
        foldingCharge = Math.max(0, Number(chargeVal) || 0);
      } else if (method === 'per_copy') {
        foldingCharge = Math.max(0, (Number(chargeVal) || 0) * selectedQty);
      } else if (method === 'quantity_based') {
        if (tiers && tiers.length > 0) {
          const sorted = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
          const matched = sorted.find(
            (t) =>
              selectedQty >= t.min_quantity &&
              (t.max_quantity === null || t.max_quantity === '' || selectedQty <= Number(t.max_quantity))
          );
          if (matched) {
            foldingCharge = Math.max(0, Number(matched.charge) || 0);
          } else {
            const lastTier = sorted[sorted.length - 1];
            foldingCharge = Math.max(0, Number(lastTier?.charge) || 0);
          }
        } else {
          foldingCharge = Math.max(0, Number(chargeVal) || 0);
        }
      }
    }

    const estimatedTotal = basePrintingTotal + foldingCharge;
    const finalUnitRate = selectedQty > 0 ? estimatedTotal / selectedQty : 0;

    return {
      basePrintingTotal: basePrintingTotal.toFixed(2),
      perCardPrice: (selectedQty > 0 ? basePrintingTotal / selectedQty : 0).toFixed(2),
      foldingCharge: foldingCharge.toFixed(2),
      estimatedTotal: estimatedTotal.toFixed(2),
      unitRate: finalUnitRate.toFixed(4),
      isFoldingActive,
      isFlatFold,
      isFixedTierMatch,
    };
  }, [
    basePrice,
    attributes,
    selectedOptions,
    selectedQty,
    foldingPricing,
    selectedFolding,
    isPrintingActive,
    activePrintingConfig,
  ]);

  // Non-folding attributes for standard list display
  const nonFoldingAttributes = attributes.filter(
    (a) => a.code !== 'folding_style' && a.name.toLowerCase() !== 'folding'
  );

  const selectedFoldingLabel =
    availableFoldingOptions.find((o) => o.value === selectedFolding)?.label || selectedFolding;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4 font-sans select-none sticky top-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
            <Eye className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 tracking-tight">Live Storefront Preview</h4>
            <p className="text-[10px] text-gray-400">Interactive customer configurator</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          Live Sync
        </span>
      </div>

      {/* Product Title */}
      <div>
        <h3 className="text-sm font-extrabold text-gray-900 line-clamp-1">{productName || 'Print Product'}</h3>
        <p className="text-[11px] text-gray-400">Select options below to test dynamic pricing</p>
      </div>

      {/* ─── PRINTING SIDE SELECTOR (When printing pricing is active) ─── */}
      {isPrintingActive && availablePrintingOptions.length > 0 && (
        <div className="space-y-1.5 p-3 bg-sky-50/50 rounded-xl border border-sky-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-950">
              Printing Side Option
            </span>
            <span className="text-[10px] font-semibold text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-200">
              Fixed Tiers
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1">
            {availablePrintingOptions.map((opt) => {
              const isSelected = selectedPrintingSide === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedPrintingSide(opt.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center justify-between ${
                    isSelected
                      ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-sky-300 hover:bg-sky-50/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                    <span className="truncate">{opt.name}</span>
                  </div>
                  {opt.is_default && !isSelected && (
                    <span className="text-[10px] text-amber-600 font-normal">Default</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity Breaks Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
          Order Quantity {isPrintingActive && <span className="text-[10px] text-sky-600 font-normal lowercase">(configured tiers)</span>}
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {activeQuantityOptions.map((qty) => {
            const isSelected = selectedQty === qty;
            return (
              <button
                key={qty}
                type="button"
                onClick={() => setSelectedQty(qty)}
                className={`
                  py-1.5 px-1 rounded-lg text-center text-xs font-bold transition-all border
                  ${isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-102'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'}
                `}
              >
                {qty}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── FOLDING SELECTOR (Only shown when folding is enabled & configured) ─── */}
      {pricing.isFoldingActive && availableFoldingOptions.length > 0 && (
        <div className="space-y-2 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-950">
                Folding Style
              </span>
            </div>
            <span className="text-[10px] font-semibold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200">
              Add-on
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1">
            {availableFoldingOptions.map((opt) => {
              const isSelected = selectedFolding === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedFolding(opt.value)}
                  className={`
                    px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center justify-between
                    ${isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'}
                  `}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {opt.value === 'no_fold' && !isSelected && (
                    <span className="text-[10px] text-gray-400 font-normal">Flat</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Attributes Preview */}
      <div className="space-y-3.5 pt-1">
        {nonFoldingAttributes.length > 0 ? (
          nonFoldingAttributes.map((attr) => {
            const activeVals = attr.values.filter((v) => v.is_active !== false);
            const currentSelected = selectedOptions[attr.code] || activeVals[0]?.value;

            return (
              <div key={attr.id || attr.code} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    {attr.name}
                  </span>
                  {attr.is_required && (
                    <span className="text-[9px] text-rose-500 font-semibold">Required</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {activeVals.map((val) => {
                    const isSelected = currentSelected === val.value;
                    const anyVal = val as any;
                    const modPrice =
                      anyVal.priceModifiers && typeof anyVal.priceModifiers[selectedQty] === 'number'
                        ? anyVal.priceModifiers[selectedQty]
                        : val.price_modifier_amount || 0;

                    return (
                      <button
                        key={val.id || val.value}
                        type="button"
                        onClick={() => handleSelectOption(attr.code, val.value)}
                        className={`
                          px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all text-left flex items-center justify-between gap-2
                          ${isSelected
                            ? 'bg-blue-50 text-blue-800 border-blue-600 ring-1 ring-blue-600 shadow-2xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50/70'}
                        `}
                      >
                        <div className="flex items-center gap-1.5">
                          {isSelected && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                          <span>{val.label}</span>
                        </div>
                        {modPrice > 0 && (
                          <span className="text-[10px] text-gray-400 font-normal">
                            +${Number(modPrice).toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-3 text-center text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No printing attributes added yet. Use the builder to add paper stocks, sides, and sizes.
          </div>
        )}
      </div>

      {/* ─── CALCULATED PRICE SUMMARY CARD ─────────────────────────────────── */}
      <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2 mt-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Selected Quantity:</span>
          <span className="font-mono font-semibold text-white">{selectedQty} units</span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>{pricing.isFixedTierMatch ? 'Fixed Total Printing:' : 'Base Printing Price:'}</span>
          <span className="font-mono font-medium">${pricing.basePrintingTotal}</span>
        </div>

        {pricing.isFixedTierMatch && (
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span>Price Per Card:</span>
            <span className="font-mono font-semibold">${pricing.perCardPrice} / card</span>
          </div>
        )}

        {/* Show folding charge separately when folding is enabled */}
        {pricing.isFoldingActive && (
          <div className="flex items-center justify-between text-xs text-indigo-300 border-t border-slate-800/80 pt-1.5">
            <span className="truncate pr-2">Folding ({selectedFoldingLabel}):</span>
            <span className="font-mono font-semibold whitespace-nowrap">
              {Number(pricing.foldingCharge) > 0 ? `+$${pricing.foldingCharge}` : '$0.00 (Flat)'}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-800 pt-2">
          <div>
            <span className="text-xs font-bold text-slate-200 block">Estimated Total:</span>
            <span className="text-[10px] text-slate-400 font-mono">${pricing.unitRate}/unit</span>
          </div>
          <span className="text-lg font-extrabold text-blue-400 font-mono">${pricing.estimatedTotal}</span>
        </div>
      </div>
    </div>
  );
};

export default FrontendOptionPreview;
