'use client';

import React from 'react';
import { FormSection, FormGrid, AdminInput, AdminSelect } from '@/components/admin/shared';
import { TemplateFormData, TemplateFormErrors, ProductOption } from './types';
import { CheckCircle2, Layers, AlertTriangle } from 'lucide-react';

interface BasicTemplateInfoProps {
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  errors: TemplateFormErrors;
  products: ProductOption[];
  productsLoading?: boolean;
  onProductSelect?: (productId: string) => void;
}

const TEMPLATE_CATEGORIES = [
  { value: 'Corporate', label: 'Corporate & Business' },
  { value: 'Modern', label: 'Modern & Minimal' },
  { value: 'Creative', label: 'Creative & Artistic' },
  { value: 'Luxury', label: 'Luxury & Elegant' },
  { value: 'Events', label: 'Events & Promotions' },
  { value: 'Health', label: 'Healthcare & Wellness' },
  { value: 'Food', label: 'Food & Hospitality' },
  { value: 'RealEstate', label: 'Real Estate & Property' },
  { value: 'General', label: 'General Starter' },
];

export const BasicTemplateInfo: React.FC<BasicTemplateInfoProps> = ({
  formData,
  setFormData,
  errors,
  products,
  productsLoading,
  onProductSelect,
}) => {
  const selectedProduct = products.find(
    (p) =>
      p.id === formData.product_id ||
      p.slug === formData.product_id ||
      p.name === formData.product_id
  );

  const folding = selectedProduct?.print_layout?.folding;
  const isFoldingEnabled = Boolean(folding?.enabled);
  const foldTypeLabel = isFoldingEnabled
    ? folding?.type
      ? folding.type
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join('-')
      : 'Folding Enabled'
    : 'No (Single Sheet)';
  const panelCount = isFoldingEnabled
    ? folding?.panelCount || folding?.panels?.length || 2
    : 1;

  return (
    <FormSection
      title="Template Details & Product Mapping"
      description="Define the template title, style category, and link it to a specific print product catalog item."
    >
      <FormGrid cols={2} gap="md">
        <div className="sm:col-span-2">
          <AdminInput
            label="Template Name"
            placeholder="e.g. Modern Minimalist Business Card Front & Back"
            value={formData.name}
            required
            error={errors.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            helperText="The title displayed in customer template browser and selection modals."
          />
        </div>

        <AdminSelect
          label="Associated Product"
          value={formData.product_id}
          required
          error={errors.product_id}
          placeholder={productsLoading ? 'Loading products…' : 'Select target product'}
          options={products.map((p) => ({ value: p.id, label: p.name }))}
          onChange={(e) => {
            const val = e.target.value;
            if (onProductSelect) {
              onProductSelect(val);
            } else {
              setFormData((prev) => ({ ...prev, product_id: val }));
            }
          }}
          helperText="Determines canvas trim dimensions, bleed margins, and preflight rules."
        />

        <AdminSelect
          label="Template Category / Style Theme"
          value={formData.category}
          options={TEMPLATE_CATEGORIES}
          onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
          helperText="Grouping category shown in template filter tabs."
        />

        {selectedProduct && (
          <div className="sm:col-span-2 mt-2 rounded-xl border border-sky-500/25 bg-slate-900/80 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                Selected Product Print Configuration
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-700/50">
                <span className="text-slate-400 block text-[11px] mb-0.5">Product</span>
                <span className="font-semibold text-white truncate block" title={selectedProduct.name}>
                  {selectedProduct.name}
                </span>
              </div>

              <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-700/50">
                <span className="text-slate-400 block text-[11px] mb-0.5">Size</span>
                <span className="font-semibold text-white">
                  {selectedProduct.width_mm ?? '—'} × {selectedProduct.height_mm ?? '—'} mm
                </span>
              </div>

              <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-700/50">
                <span className="text-slate-400 block text-[11px] mb-0.5">Bleed</span>
                <span className="font-semibold text-white">
                  {selectedProduct.bleed_mm ?? 0} mm
                </span>
              </div>

              <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-700/50">
                <span className="text-slate-400 block text-[11px] mb-0.5">Safe Margin</span>
                <span className="font-semibold text-white">
                  {selectedProduct.safe_area_mm ?? 0} mm
                </span>
              </div>

              <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-700/50">
                <span className="text-slate-400 block text-[11px] mb-0.5">Folding</span>
                <span className="font-semibold text-white">
                  {foldTypeLabel}
                </span>
              </div>

              <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-700/50">
                <span className="text-slate-400 block text-[11px] mb-0.5">Panels</span>
                <span className="font-semibold text-white flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  {panelCount}
                </span>
              </div>
            </div>
          </div>
        )}
      </FormGrid>
    </FormSection>
  );
};

export default BasicTemplateInfo;
