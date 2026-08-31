'use client';

import React from 'react';
import { FormSection, FormGrid, AdminNumberInput, AdminSwitch } from '@/components/admin/shared';
import { ProductFormData, FormErrors } from './types';

interface ProductConfigurationProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  errors: FormErrors;
}

export const ProductConfiguration: React.FC<ProductConfigurationProps> = ({
  formData,
  setFormData,
  errors,
}) => {
  return (
    <FormSection
      title="Product Configuration"
      description="Production timing, order minimums, online design features, and visibility controls."
    >
      <div className="space-y-6">
        <FormGrid cols={2} gap="md">
          <AdminNumberInput
            label="Minimum Order Quantity"
            placeholder="1"
            min={1}
            value={formData.min_quantity}
            required
            error={errors.min_quantity}
            onChange={(val) => setFormData((prev) => ({ ...prev, min_quantity: typeof val === 'number' ? val : 1 }))}
            helperText="The lowest number of units a customer can purchase in one order."
          />

          <AdminNumberInput
            label="Turnaround Time"
            suffix="Business Days"
            placeholder="3"
            min={1}
            value={formData.turnaround_days}
            required
            error={errors.turnaround_days}
            onChange={(val) => setFormData((prev) => ({ ...prev, turnaround_days: typeof val === 'number' ? val : 3 }))}
            helperText="Standard production lead time required before dispatch."
          />
        </FormGrid>

        <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AdminSwitch
            label="Allow Online Custom Design"
            description="Enables the interactive Fabric.js canvas & 3D previewer for this product."
            checked={formData.allow_custom_design}
            onChange={(val) => setFormData((prev) => ({ ...prev, allow_custom_design: val }))}
          />

          <AdminSwitch
            label="Allow Customer File Upload"
            description="Allows customers to upload print-ready PDF, PSD, or AI files with preflight checks."
            checked={formData.allow_customer_upload}
            onChange={(val) => setFormData((prev) => ({ ...prev, allow_customer_upload: val }))}
          />

          <AdminSwitch
            label="Product Active / Published"
            description="Controls whether this product is visible in customer catalog searches."
            checked={formData.is_active}
            onChange={(val) =>
              setFormData((prev) => ({
                ...prev,
                is_active: val,
                status: val ? 'published' : 'draft',
              }))
            }
          />

          <AdminSwitch
            label="Featured Product Badge"
            description="Showcases this item on homepage hero sections and popular categories."
            checked={formData.is_featured}
            onChange={(val) => setFormData((prev) => ({ ...prev, is_featured: val }))}
          />
        </div>
      </div>
    </FormSection>
  );
};

export default ProductConfiguration;
