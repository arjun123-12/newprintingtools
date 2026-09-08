'use client';

import React, { useState } from 'react';
import { FormSection, FormGrid, AdminNumberInput, AdminSwitch, AdminSelect } from '@/components/admin/shared';
import { ProductFormData, FormErrors, ProductSideItem } from './types';

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
  const [pendingSidesCount, setPendingSidesCount] = useState<number | null>(null);

  const handleSidesChange = (newCount: number) => {
    if (newCount === formData.sides_count) return;

    if (newCount < formData.sides_count) {
      // Need confirmation
      setPendingSidesCount(newCount);
    } else {
      // Add sides
      setFormData(prev => {
        const newSides = [...prev.sides];
        for (let i = prev.sides_count; i < newCount; i++) {
          const sideName = i === 0 ? 'Front' : i === 1 ? 'Back' : `Side ${i + 1}`;
          const sideType = i === 0 ? 'front' : i === 1 ? 'back' : 'inside';
          newSides.push({
            side_number: i + 1,
            name: sideName,
            type: sideType,
            sort_order: i + 1,
            is_active: true,
            print_areas: []
          });
        }
        return { ...prev, sides_count: newCount, sides: newSides };
      });
    }
  };

  const confirmSideReduction = () => {
    if (pendingSidesCount === null) return;
    setFormData(prev => ({
      ...prev,
      sides_count: pendingSidesCount,
      sides: prev.sides.slice(0, pendingSidesCount)
    }));
    setPendingSidesCount(null);
  };

  const cancelSideReduction = () => {
    setPendingSidesCount(null);
  };

  return (
    <FormSection
      title="Product Configuration"
      description="Production timing, order minimums, online design features, and visibility controls."
    >
      <div className="space-y-6">
        <FormGrid cols={2} gap="md">
          <div className="sm:col-span-2">
            <AdminSelect
              label="Number of Sides / Pages"
              value={formData.sides_count.toString()}
              onChange={(e) => handleSidesChange(parseInt(e.target.value, 10))}
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
              helperText="Determines how many independent printable surfaces or pages the user can design."
            />
            {pendingSidesCount !== null && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                <span className="text-amber-800 font-medium">
                  Reducing sides from {formData.sides_count} to {pendingSidesCount} will delete existing configuration for the removed sides. Continue?
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={cancelSideReduction} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                  <button type="button" onClick={confirmSideReduction} className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700">Yes, Remove Sides</button>
                </div>
              </div>
            )}
          </div>

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
