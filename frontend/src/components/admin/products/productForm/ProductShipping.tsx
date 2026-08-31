'use client';

import React from 'react';
import { FormSection, FormGrid, AdminNumberInput, AdminSwitch } from '@/components/admin/shared';
import { ProductFormData } from './types';

interface ProductShippingProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}

export const ProductShipping: React.FC<ProductShippingProps> = ({
  formData,
  setFormData,
}) => {
  return (
    <FormSection
      title="Shipping & Package Dimensions"
      description="Enter physical weight and packaged dimensions to calculate accurate live courier rates and parcel limits."
    >
      <div className="space-y-4">
        <AdminSwitch
          label="Free Shipping"
          description="Waive shipping costs for this item at checkout."
          checked={formData.free_shipping}
          onChange={(val) => setFormData((prev) => ({ ...prev, free_shipping: val }))}
        />

        {!formData.free_shipping && (
          <FormGrid cols={4} gap="md" className="pt-2 border-t border-gray-100">
            <AdminNumberInput
              label="Weight"
              suffix="kg"
              step={0.01}
              min={0}
              placeholder="0.5"
              value={formData.weight_kg ?? ''}
              onChange={(val) => setFormData((prev) => ({ ...prev, weight_kg: val }))}
            />

            <AdminNumberInput
              label="Length"
              suffix="cm"
              step={0.1}
              min={0}
              placeholder="20"
              value={formData.length_cm ?? ''}
              onChange={(val) => setFormData((prev) => ({ ...prev, length_cm: val }))}
            />

            <AdminNumberInput
              label="Width"
              suffix="cm"
              step={0.1}
              min={0}
              placeholder="15"
              value={formData.width_cm ?? ''}
              onChange={(val) => setFormData((prev) => ({ ...prev, width_cm: val }))}
            />

            <AdminNumberInput
              label="Height"
              suffix="cm"
              step={0.1}
              min={0}
              placeholder="5"
              value={formData.height_cm ?? ''}
              onChange={(val) => setFormData((prev) => ({ ...prev, height_cm: val }))}
            />
          </FormGrid>
        )}
      </div>
    </FormSection>
  );
};

export default ProductShipping;
