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
        <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Customer Artwork Module</h3>
            <p className="mt-1 text-xs text-slate-600">Set the shape and artwork guidance shown in the customer designer. Existing size, bleed, and pricing settings stay unchanged.</p>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-violet-100 bg-white p-3">
            <input type="checkbox" checked={formData.artwork_module.enabled} onChange={(e) => setFormData((prev) => ({ ...prev, artwork_module: { ...prev.artwork_module, enabled: e.target.checked } }))} className="mt-0.5 h-4 w-4 accent-violet-600" />
            <span><span className="block text-sm font-semibold text-slate-800">Enable shaped artwork canvas</span><span className="mt-0.5 block text-xs text-slate-500">Show the configured cut shape and product guidance in the artwork editor.</span></span>
          </label>
          {formData.artwork_module.enabled && <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Module type
              <select value={formData.artwork_module.type} onChange={(e) => setFormData((prev) => ({ ...prev, artwork_module: { ...prev.artwork_module, type: e.target.value as typeof prev.artwork_module.type } }))} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="generic">General artwork</option><option value="sticker">Sticker</option><option value="label">Label</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Artwork / cut shape
              <select value={formData.artwork_module.shape} onChange={(e) => setFormData((prev) => ({ ...prev, artwork_module: { ...prev.artwork_module, shape: e.target.value as typeof prev.artwork_module.shape } }))} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="rectangle">Rectangle</option><option value="rounded_rectangle">Rounded rectangle</option><option value="circle">Circle</option><option value="oval">Oval</option><option value="pill">Pill</option><option value="custom_die_cut">Custom die-cut (rectangular preview guide)</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Cut-line color
              <input type="color" value={formData.artwork_module.cut_line_color} onChange={(e) => setFormData((prev) => ({ ...prev, artwork_module: { ...prev.artwork_module, cut_line_color: e.target.value } }))} className="mt-1.5 block h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Customer guidance
              <input maxLength={500} value={formData.artwork_module.customer_note} onChange={(e) => setFormData((prev) => ({ ...prev, artwork_module: { ...prev.artwork_module, customer_note: e.target.value } }))} placeholder="Example: Keep important text inside the cut line." className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
            </label>
          </div>}
        </section>
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
            placeholder="5"
            min={1}
            value={formData.turnaround_days}
            required
            error={errors.turnaround_days}
            onChange={(val) => setFormData((prev) => ({ ...prev, turnaround_days: typeof val === 'number' ? val : 5 }))}
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
