'use client';

import React from 'react';
import { FormSection, FormGrid, AdminNumberInput } from '@/components/admin/shared';
import { ProductFormData, FormErrors, PricingTierItem } from './types';
import { Plus, Trash2, DollarSign } from 'lucide-react';

interface ProductPricingProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  errors: FormErrors;
}

export const ProductPricing: React.FC<ProductPricingProps> = ({
  formData,
  setFormData,
  errors,
}) => {
  const addPricingTier = () => {
    const lastTier = formData.pricing_tiers[formData.pricing_tiers.length - 1];
    const nextMin = lastTier && typeof lastTier.maxQuantity === 'number' ? lastTier.maxQuantity + 1 : 100;

    const newTier: PricingTierItem = {
      id: `tier_${Date.now()}`,
      minQuantity: nextMin,
      maxQuantity: nextMin + 150,
      price: formData.base_price ? parseFloat((formData.base_price * 0.85).toFixed(2)) : 0,
    };

    setFormData((prev) => ({
      ...prev,
      pricing_tiers: [...prev.pricing_tiers, newTier],
    }));
  };

  const removePricingTier = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      pricing_tiers: prev.pricing_tiers.filter((_, i) => i !== index),
    }));
  };

  const updateTier = (index: number, field: keyof PricingTierItem, val: any) => {
    setFormData((prev) => {
      const updated = [...prev.pricing_tiers];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, pricing_tiers: updated };
    });
  };

  const calculateMargin = () => {
    if (typeof formData.cost_price !== 'number' || formData.cost_price <= 0) return null;
    const effectivePrice = typeof formData.sale_price === 'number' && formData.sale_price > 0 ? formData.sale_price : formData.base_price;
    if (effectivePrice <= 0) return null;
    const profit = effectivePrice - formData.cost_price;
    const marginPct = (profit / effectivePrice) * 100;
    return {
      profit: profit.toFixed(2),
      marginPct: marginPct.toFixed(1),
    };
  };

  const margin = calculateMargin();

  return (
    <FormSection
      title="Pricing & Volume Discounts"
      description="Set standard retail unit pricing, promotional sales, cost tracking, and bulk volume discount breaks."
    >
      <div className="space-y-6">
        {/* Core Pricing Grid */}
        <FormGrid cols={3} gap="md">
          <AdminNumberInput
            label="Base Price"
            prefix="$"
            placeholder="0.00"
            step={0.01}
            min={0}
            value={formData.base_price}
            required
            error={errors.base_price}
            onChange={(val) => setFormData((prev) => ({ ...prev, base_price: typeof val === 'number' ? val : 0 }))}
            helperText="Default single-unit retail price."
          />

          <AdminNumberInput
            label="Sale Price (Discounted)"
            prefix="$"
            placeholder="Optional"
            step={0.01}
            min={0}
            value={formData.sale_price ?? ''}
            error={errors.sale_price}
            onChange={(val) => setFormData((prev) => ({ ...prev, sale_price: val }))}
            helperText="Overrides base price with a discounted rate if set."
          />

          <AdminNumberInput
            label="Cost Price (Internal)"
            prefix="$"
            placeholder="0.00"
            step={0.01}
            min={0}
            value={formData.cost_price ?? ''}
            error={errors.cost_price}
            onChange={(val) => setFormData((prev) => ({ ...prev, cost_price: val }))}
            helperText="Wholesale print production cost for profit analysis."
          />
        </FormGrid>

        {/* Profit Margin Indicator */}
        {margin && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-medium">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Estimated Profit per Unit: <strong>${margin.profit}</strong></span>
            </div>
            <span className="font-bold text-emerald-700 bg-white px-2.5 py-0.5 rounded-md border border-emerald-200">
              {margin.marginPct}% Margin
            </span>
          </div>
        )}

        {/* Quantity Tier Pricing */}
        <div className="space-y-3 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-gray-700 select-none">
                Quantity Tier Pricing Matrix ({formData.pricing_tiers.length})
              </span>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Automatically applies volume rate discounts when customers order larger quantities.
              </p>
            </div>

            <button
              type="button"
              onClick={addPricingTier}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100/70 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Tier</span>
            </button>
          </div>

          {formData.pricing_tiers.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 text-gray-600 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Min Quantity</th>
                    <th className="py-3 px-4">Max Quantity</th>
                    <th className="py-3 px-4">Price per Unit</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {formData.pricing_tiers.map((tier, idx) => (
                    <tr key={tier.id || idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2 px-4 w-44">
                        <AdminNumberInput
                          min={1}
                          value={tier.minQuantity}
                          onChange={(val) => updateTier(idx, 'minQuantity', typeof val === 'number' ? val : 1)}
                        />
                      </td>
                      <td className="py-2 px-4 w-44">
                        <AdminNumberInput
                          placeholder="No limit"
                          min={tier.minQuantity}
                          value={tier.maxQuantity ?? ''}
                          onChange={(val) => updateTier(idx, 'maxQuantity', val)}
                        />
                      </td>
                      <td className="py-2 px-4 w-44">
                        <AdminNumberInput
                          prefix="$"
                          step={0.001}
                          value={tier.price}
                          onChange={(val) => updateTier(idx, 'price', typeof val === 'number' ? val : 0)}
                        />
                      </td>
                      <td className="py-2 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removePricingTier(idx)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 transition-colors rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-center">
              <p className="text-xs text-gray-500">No volume discount tiers added. Standard base price will apply for all order quantities.</p>
            </div>
          )}
        </div>
      </div>
    </FormSection>
  );
};

export default ProductPricing;
