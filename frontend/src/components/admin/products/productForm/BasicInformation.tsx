'use client';

import React from 'react';
import { FormSection, FormGrid, AdminInput, AdminSelect } from '@/components/admin/shared';
import { ProductFormData, FormErrors, CategoryOption } from './types';
import { Sparkles } from 'lucide-react';

interface BasicInformationProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  errors: FormErrors;
  categories: CategoryOption[];
  categoriesLoading?: boolean;
}

const PRODUCT_TYPE_OPTIONS = [
  { value: 'standard_print', label: 'Standard Print (Business Cards, Flyers, Brochures)' },
  { value: 'custom_dimension', label: 'Custom Dimension (Banners, Canvas, Posters)' },
  { value: 'apparel', label: 'Apparel (T-Shirts, Hoodies, Caps)' },
  { value: 'signage', label: 'Signage & Rigid Boards (Foam Board, Corflute, Acrylic)' },
  { value: 'stationery', label: 'Stationery & Office (Envelopes, Letterheads, Notepads)' },
];

export const BasicInformation: React.FC<BasicInformationProps> = ({
  formData,
  setFormData,
  errors,
  categories,
  categoriesLoading,
}) => {
  const generateSlug = () => {
    if (!formData.name) return;
    const autoSlug = formData.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setFormData((prev) => ({ ...prev, slug: autoSlug }));
  };

  return (
    <FormSection
      title="Basic Information"
      description="Essential identification and categorization details for this print product."
    >
      <FormGrid cols={2} gap="md">
        <AdminInput
          label="Product Name"
          placeholder="e.g. Premium Silk Business Cards"
          value={formData.name}
          required
          error={errors.name}
          onChange={(e) => {
            const newName = e.target.value;
            setFormData((prev) => {
              // Auto-generate SKU and slug if not manually customized yet
              const autoSku =
                !prev.sku || prev.sku === prev.name.slice(0, 3).toUpperCase() + '-001'
                  ? (newName.slice(0, 3).toUpperCase() || 'PRD') + '-001'
                  : prev.sku;
              return { ...prev, name: newName, sku: autoSku };
            });
          }}
          helperText="The public customer-facing name of the product."
        />

        <AdminInput
          label="SKU (Stock Keeping Unit)"
          placeholder="e.g. BC-SILK-001"
          value={formData.sku}
          required
          error={errors.sku}
          onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value.toUpperCase() }))}
          helperText="Unique identifier for inventory and production order routing."
        />

        <AdminSelect
          label="Category"
          value={formData.category_id}
          required
          error={errors.category_id}
          onChange={(e) => setFormData((prev) => ({ ...prev, category_id: e.target.value }))}
          placeholder={categoriesLoading ? 'Loading categories…' : 'Select a category'}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          helperText="Primary storefront and navigation category."
        />

        <AdminSelect
          label="Product Type"
          value={formData.product_type}
          required
          error={errors.product_type}
          onChange={(e) => setFormData((prev) => ({ ...prev, product_type: e.target.value as any }))}
          options={PRODUCT_TYPE_OPTIONS}
          helperText="Determines available print areas and online designer capabilities."
        />

        <div className="sm:col-span-2">
          <AdminInput
            label="URL Slug"
            placeholder="e.g. premium-silk-business-cards"
            value={formData.slug}
            required
            error={errors.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
            suffixIcon={
              <button
                type="button"
                onClick={generateSlug}
                title="Auto-generate slug from product name"
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors pointer-events-auto"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            }
            helperText="The canonical URL path segment for SEO: /products/[slug]"
          />
        </div>
      </FormGrid>
    </FormSection>
  );
};

export default BasicInformation;
