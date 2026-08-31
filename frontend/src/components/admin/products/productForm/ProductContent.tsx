'use client';

import React from 'react';
import { FormSection, FormGrid, AdminTextarea } from '@/components/admin/shared';
import { ProductFormData, FormErrors } from './types';

interface ProductContentProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  errors: FormErrors;
}

export const ProductContent: React.FC<ProductContentProps> = ({
  formData,
  setFormData,
  errors,
}) => {
  return (
    <FormSection
      title="Content & Descriptions"
      description="Provide informative marketing and specification copy for this print product."
    >
      <FormGrid cols={1} gap="md">
        <AdminTextarea
          label="Short Description"
          placeholder="Brief 1-2 sentence overview shown in product grids and search results…"
          value={formData.short_description}
          maxLength={500}
          showCharCount
          rows={2}
          error={errors.short_description}
          onChange={(e) => setFormData((prev) => ({ ...prev, short_description: e.target.value }))}
          helperText="Summarizes the material, finish, and key highlights."
        />

        <AdminTextarea
          label="Detailed Description"
          placeholder="Comprehensive product details, print guidelines, paper stock specifications, and finishing options…"
          value={formData.description}
          rows={5}
          error={errors.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          helperText="Displays in the full product page tab."
        />
      </FormGrid>
    </FormSection>
  );
};

export default ProductContent;
