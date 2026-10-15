'use client';

import React, { useRef } from 'react';
import { FormSection, FormGrid, AdminInput, MultiCategorySelect } from '@/components/admin/shared';
import { ProductFormData, FormErrors, CategoryOption } from './types';
import { Sparkles } from 'lucide-react';

interface BasicInformationProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  errors: FormErrors;
  categories: CategoryOption[];
  categoriesLoading?: boolean;
  onCreateCategory?: (name: string) => Promise<{ id: string; name: string; slug?: string } | null>;
}

export const BasicInformation: React.FC<BasicInformationProps> = ({
  formData,
  setFormData,
  errors,
  categories,
  categoriesLoading,
  onCreateCategory,
}) => {
  // Track if the slug was manually customized by the user.
  // If formData.slug already has a value on initial load (e.g. editing an existing product),
  // preserve it as customized unless user clears it or clicks the auto-generate button.
  const isSlugCustomizedRef = useRef<boolean>(Boolean(formData.slug));

  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const getCategorySlugOrName = (categoryId: string): string => {
    const cat = categories.find((c) => String(c.id) === String(categoryId));
    if (!cat) return '';
    return cat.slug ? slugify(cat.slug) : slugify(cat.name);
  };

  const buildAutoSlug = (categoryId: string, productName: string): string => {
    const catPart = getCategorySlugOrName(categoryId);
    const prodPart = slugify(productName);
    if (catPart && prodPart) {
      return `${catPart}-${prodPart}`;
    }
    return prodPart || catPart;
  };

  const generateSlug = () => {
    const autoSlug = buildAutoSlug(formData.category_id, formData.name);
    if (autoSlug) {
      setFormData((prev) => ({ ...prev, slug: autoSlug }));
      isSlugCustomizedRef.current = false;
    }
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
              // Auto-generate SKU if not manually customized yet
              const autoSku =
                !prev.sku || prev.sku === prev.name.slice(0, 3).toUpperCase() + '-001'
                  ? (newName.slice(0, 3).toUpperCase() || 'PRD') + '-001'
                  : prev.sku;

              // Auto-generate slug using categoryname-productname if not manually customized
              const nextSlug =
                !isSlugCustomizedRef.current || !prev.slug
                  ? buildAutoSlug(prev.category_id, newName)
                  : prev.slug;

              return {
                ...prev,
                name: newName,
                sku: autoSku,
                slug: nextSlug,
              };
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

        <div className="sm:col-span-2">
          <MultiCategorySelect
            label="Product Categories"
            categories={categories}
            selectedIds={formData.category_ids?.length ? formData.category_ids : (formData.category_id ? [formData.category_id] : [])}
            primaryId={formData.category_id}
            required
            error={errors.category_id || errors.category_ids}
            loading={categoriesLoading}
            placeholder={categoriesLoading ? 'Loading categories…' : 'Select one or more categories to assign…'}
            helperText="Assign one or multiple categories to this product. The primary category is used for storefront URL slug generation."
            onCreateCategory={onCreateCategory}
            onSetPrimary={(newPrimaryId) => {
              setFormData((prev) => {
                const nextSlug = !isSlugCustomizedRef.current || !prev.slug
                  ? buildAutoSlug(newPrimaryId, prev.name)
                  : prev.slug;
                return {
                  ...prev,
                  category_id: newPrimaryId,
                  slug: nextSlug,
                };
              });
            }}
            onChange={(newIds) => {
              setFormData((prev) => {
                let nextPrimary = prev.category_id;
                if (!newIds.includes(nextPrimary)) {
                  nextPrimary = newIds.length > 0 ? newIds[0] : '';
                } else if (!nextPrimary && newIds.length > 0) {
                  nextPrimary = newIds[0];
                }

                const nextSlug = !isSlugCustomizedRef.current || !prev.slug
                  ? buildAutoSlug(nextPrimary, prev.name)
                  : prev.slug;

                return {
                  ...prev,
                  category_ids: newIds,
                  category_id: nextPrimary,
                  slug: nextSlug,
                };
              });
            }}
          />
        </div>

        <AdminInput
          label="URL Slug"
          placeholder="e.g. business-cards-premium-silk-cards"
          value={formData.slug}
          required
          error={errors.slug}
          onChange={(e) => {
            const newSlug = e.target.value;
            if (!newSlug.trim()) {
              isSlugCustomizedRef.current = false;
            } else {
              isSlugCustomizedRef.current = true;
            }
            setFormData((prev) => ({ ...prev, slug: newSlug }));
          }}
          suffixIcon={
            <button
              type="button"
              onClick={generateSlug}
              title="Auto-generate slug from category and product name"
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors pointer-events-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          }
          helperText="The canonical URL path segment for SEO: /products/[slug]"
        />
      </FormGrid>
    </FormSection>
  );
};

export default BasicInformation;
