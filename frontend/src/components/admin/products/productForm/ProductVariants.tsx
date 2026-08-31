'use client';

import React from 'react';
import { FormSection, AdminInput, AdminNumberInput, AdminSwitch } from '@/components/admin/shared';
import { ProductFormData, VariantItem } from './types';
import { Plus, Trash2, Layers, RefreshCw } from 'lucide-react';

interface ProductVariantsProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}

export const ProductVariants: React.FC<ProductVariantsProps> = ({
  formData,
  setFormData,
}) => {
  const addVariant = () => {
    const newVariant: VariantItem = {
      id: `var_${Date.now()}`,
      name: '',
      sku: `${formData.sku || 'PRD'}-V${formData.variants.length + 1}`,
      base_price: formData.base_price || 0,
      sale_price: '',
      stock: 100,
      is_active: true,
    };
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, newVariant],
    }));
  };

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariant = (index: number, field: keyof VariantItem, val: any) => {
    setFormData((prev) => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, variants: updated };
    });
  };

  const generateVariantsFromAttributes = () => {
    if (formData.attributes.length === 0) return;

    // Cartesion product of attribute values
    const attrValues = formData.attributes.map((a) => a.values.filter((v) => v.label.trim() !== ''));
    if (attrValues.some((vals) => vals.length === 0)) return;

    const combinations = attrValues.reduce<string[][]>(
      (acc, curr) => acc.flatMap((x) => curr.map((y) => [...x, y.label])),
      [[]]
    );

    const generated: VariantItem[] = combinations.map((combo, idx) => ({
      id: `var_gen_${Date.now()}_${idx}`,
      name: combo.join(' / '),
      sku: `${formData.sku || 'PRD'}-${combo.map((c) => c.slice(0, 3).toUpperCase()).join('-')}`,
      base_price: formData.base_price || 0,
      sale_price: '',
      stock: 100,
      is_active: true,
    }));

    setFormData((prev) => ({
      ...prev,
      variants: generated,
    }));
  };

  return (
    <FormSection
      title="Product Variants & SKUs"
      description="Define individual variant combinations with specific SKUs, pricing overrides, and inventory levels."
      action={
        <div className="flex items-center gap-2">
          {formData.attributes.length > 0 && (
            <button
              type="button"
              onClick={generateVariantsFromAttributes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200/80 rounded-lg transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Generate Combinations</span>
            </button>
          )}
          <button
            type="button"
            onClick={addVariant}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100/70 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Variant</span>
          </button>
        </div>
      }
    >
      {formData.variants.length > 0 ? (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 text-gray-600 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Variant Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Base Price</th>
                <th className="py-3 px-4">Sale Price</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4 text-center">Active</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {formData.variants.map((variant, idx) => (
                <tr key={variant.id || idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-2.5 px-4">
                    <AdminInput
                      value={variant.name}
                      placeholder="e.g. Standard Size / Matt"
                      onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                    />
                  </td>
                  <td className="py-2.5 px-4 w-40">
                    <AdminInput
                      value={variant.sku}
                      placeholder="SKU"
                      onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                    />
                  </td>
                  <td className="py-2.5 px-4 w-32">
                    <AdminNumberInput
                      prefix="$"
                      step={0.01}
                      value={variant.base_price}
                      onChange={(val) => updateVariant(idx, 'base_price', typeof val === 'number' ? val : 0)}
                    />
                  </td>
                  <td className="py-2.5 px-4 w-32">
                    <AdminNumberInput
                      prefix="$"
                      step={0.01}
                      value={variant.sale_price ?? ''}
                      onChange={(val) => updateVariant(idx, 'sale_price', val)}
                    />
                  </td>
                  <td className="py-2.5 px-4 w-28">
                    <AdminNumberInput
                      value={variant.stock ?? 0}
                      onChange={(val) => updateVariant(idx, 'stock', typeof val === 'number' ? val : 0)}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={variant.is_active}
                      onChange={(e) => updateVariant(idx, 'is_active', e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500/20"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
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
        <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center text-center">
          <Layers className="w-6 h-6 text-gray-400 mb-2" />
          <p className="text-xs font-semibold text-gray-700">No variants defined</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Create variants manually or generate combinations from your attributes above.
          </p>
        </div>
      )}
    </FormSection>
  );
};

export default ProductVariants;
