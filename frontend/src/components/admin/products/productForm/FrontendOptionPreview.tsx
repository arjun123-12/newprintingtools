'use client';

import React, { useState } from 'react';
import { Eye, Check, DollarSign, Sparkles } from 'lucide-react';
import { AttributeItem } from './types';

interface FrontendOptionPreviewProps {
  productName?: string;
  basePrice?: number;
  attributes: AttributeItem[];
  quantityBreaks?: number[];
}

export const FrontendOptionPreview: React.FC<FrontendOptionPreviewProps> = ({
  productName = 'Product Name',
  basePrice = 49.99,
  attributes = [],
  quantityBreaks = [100, 250, 500, 1000, 2000],
}) => {
  const [selectedQty, setSelectedQty] = useState<number>(quantityBreaks[0] || 100);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const handleSelectOption = (attrCode: string, valueStr: string) => {
    setSelectedOptions((prev) => ({ ...prev, [attrCode]: valueStr }));
  };

  // Calculate unit price dynamically based on chosen quantity break & attribute modifiers
  const calculateTotal = () => {
    let unitPrice = Number(basePrice) || 0;

    attributes.forEach((attr) => {
      const selectedValCode = selectedOptions[attr.code] || attr.values[0]?.value;
      const valObj = attr.values.find((v) => v.value === selectedValCode);

      if (valObj) {
        // If price modifier has quantity break table
        const anyVal = valObj as any;
        if (anyVal.priceModifiers && typeof anyVal.priceModifiers[selectedQty] === 'number') {
          unitPrice += Number(anyVal.priceModifiers[selectedQty]);
        } else if (typeof valObj.price_modifier_amount === 'number') {
          unitPrice += Number(valObj.price_modifier_amount);
        }
      }
    });

    const total = unitPrice * selectedQty;
    return {
      unitPrice: unitPrice.toFixed(4),
      total: total.toFixed(2),
    };
  };

  const pricing = calculateTotal();

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

      {/* Quantity Breaks Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
          Order Quantity
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {quantityBreaks.map((qty) => {
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

      {/* Interactive Attributes Preview */}
      <div className="space-y-3.5 pt-1">
        {attributes.length > 0 ? (
          attributes.map((attr) => {
            const currentSelected = selectedOptions[attr.code] || attr.values[0]?.value;

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
                  {attr.values.map((val) => {
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
            No attributes added yet. Use the builder to add paper stocks, sides, and sizes.
          </div>
        )}
      </div>

      {/* Calculated Price Summary Card */}
      <div className="p-3 bg-slate-900 text-white rounded-xl space-y-2 mt-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Unit Rate ({selectedQty} qty):</span>
          <span className="font-mono font-semibold">${pricing.unitPrice}/unit</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 pt-2">
          <span className="text-xs font-bold text-slate-200">Estimated Total:</span>
          <span className="text-base font-extrabold text-blue-400 font-mono">${pricing.total}</span>
        </div>
      </div>
    </div>
  );
};

export default FrontendOptionPreview;
