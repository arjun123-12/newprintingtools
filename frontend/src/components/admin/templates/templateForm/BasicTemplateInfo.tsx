'use client';

import React from 'react';
import { FormSection, FormGrid, AdminInput, AdminSelect } from '@/components/admin/shared';
import { TemplateFormData, TemplateFormErrors, ProductOption } from './types';

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
            setFormData((prev) => ({ ...prev, product_id: val }));
            onProductSelect?.(val);
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
      </FormGrid>
    </FormSection>
  );
};

export default BasicTemplateInfo;
