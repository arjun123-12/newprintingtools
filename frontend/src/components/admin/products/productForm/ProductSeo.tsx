'use client';

import React from 'react';
import { FormSection, FormGrid, AdminInput, AdminTextarea } from '@/components/admin/shared';
import { ProductFormData, FormErrors } from './types';
import { Globe } from 'lucide-react';

interface ProductSeoProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  errors: FormErrors;
}

export const ProductSeo: React.FC<ProductSeoProps> = ({
  formData,
  setFormData,
  errors,
}) => {
  const displayTitle = formData.meta_title || formData.name || 'Product Title';
  const displayDesc =
    formData.meta_description ||
    formData.short_description ||
    'High quality custom printing with fast turnaround and nationwide shipping. Order online with instant digital preview.';
  const displaySlug = formData.slug || 'product-slug';

  return (
    <FormSection
      title="Search Engine Optimization (SEO)"
      description="Optimize title tags and meta descriptions to improve discoverability on Google and search engines."
    >
      <div className="space-y-6">
        <FormGrid cols={1} gap="md">
          <AdminInput
            label="Meta Title"
            placeholder={formData.name ? `${formData.name} | PrintOps` : 'Custom Print Products | PrintOps'}
            value={formData.meta_title}
            maxLength={70}
            error={errors.meta_title}
            onChange={(e) => setFormData((prev) => ({ ...prev, meta_title: e.target.value }))}
            helperText="Recommended length: 50-60 characters."
          />

          <AdminTextarea
            label="Meta Description"
            placeholder="High quality custom business cards with fast turnaround, silk matte coating, and free nationwide dispatch…"
            value={formData.meta_description}
            maxLength={160}
            showCharCount
            rows={2}
            error={errors.meta_description}
            onChange={(e) => setFormData((prev) => ({ ...prev, meta_description: e.target.value }))}
            helperText="Recommended length: 120-155 characters."
          />
        </FormGrid>

        {/* Live Google Search Preview Card */}
        <div className="border-t border-gray-100 pt-5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>Search Result Preview</span>
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl max-w-xl space-y-1 shadow-2xs font-sans">
            <div className="text-xs text-gray-500 truncate">
              https://printops.com/products/{displaySlug}
            </div>
            <div className="text-sm font-semibold text-blue-700 hover:underline cursor-pointer truncate">
              {displayTitle}
            </div>
            <div className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
              {displayDesc}
            </div>
          </div>
        </div>
      </div>
    </FormSection>
  );
};

export default ProductSeo;
