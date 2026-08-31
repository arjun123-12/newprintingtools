'use client';

import React from 'react';
import { FormSection, FormGrid, AdminNumberInput, AdminSwitch } from '@/components/admin/shared';
import { ProductFormData } from './types';

interface ProductInventoryProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}

export const ProductInventory: React.FC<ProductInventoryProps> = ({
  formData,
  setFormData,
}) => {
  return (
    <FormSection
      title="Inventory & Stock Management"
      description="Configure physical warehouse inventory tracking, stock counts, and low-inventory restock alerts."
    >
      <div className="space-y-4">
        <AdminSwitch
          label="Track Physical Inventory"
          description="Enable quantity counting for this product (disable for on-demand print-on-order items)."
          checked={formData.track_inventory}
          onChange={(val) => setFormData((prev) => ({ ...prev, track_inventory: val }))}
        />

        {formData.track_inventory && (
          <FormGrid cols={2} gap="md" className="pt-2 border-t border-gray-100 animate-in fade-in duration-150">
            <AdminNumberInput
              label="Current Stock Quantity"
              min={0}
              placeholder="0"
              value={formData.stock_quantity}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, stock_quantity: typeof val === 'number' ? val : 0 }))
              }
              helperText="Available quantity in inventory."
            />

            <AdminNumberInput
              label="Low Stock Alert Threshold"
              min={0}
              placeholder="10"
              value={formData.low_stock_threshold}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, low_stock_threshold: typeof val === 'number' ? val : 10 }))
              }
              helperText="Sends an admin notification when remaining stock drops below this number."
            />
          </FormGrid>
        )}
      </div>
    </FormSection>
  );
};

export default ProductInventory;
