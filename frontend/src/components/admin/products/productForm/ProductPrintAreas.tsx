'use client';

import React from 'react';
import { FormSection, AdminInput, AdminNumberInput, AdminSelect } from '@/components/admin/shared';
import { ProductFormData, PrintAreaItem } from './types';
import { Plus, Trash2, Printer } from 'lucide-react';

interface ProductPrintAreasProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  sideIndex: number;
}

export const ProductPrintAreas: React.FC<ProductPrintAreasProps> = ({
  formData,
  setFormData,
  sideIndex,
}) => {
  const sideObj = formData.sides[sideIndex];
  const areas = sideObj.print_areas || [];

  const addPrintArea = () => {
    const isFirst = areas.length === 0;

    const newArea: PrintAreaItem = {
      id: `area_${Date.now()}`,
      name: isFirst ? sideObj.name : `Print Area ${areas.length + 1}`,
      width_mm: formData.width_mm || 90,
      height_mm: formData.height_mm || 55,
      bleed_mm: formData.bleed_mm || 3,
      safe_zone_mm: formData.safe_area_mm || 3,
    };

    setFormData((prev) => {
      const newSides = [...prev.sides];
      newSides[sideIndex] = {
        ...newSides[sideIndex],
        print_areas: [...newSides[sideIndex].print_areas, newArea]
      };
      return { ...prev, sides: newSides };
    });
  };

  const removePrintArea = (index: number) => {
    setFormData((prev) => {
      const newSides = [...prev.sides];
      newSides[sideIndex] = {
        ...newSides[sideIndex],
        print_areas: newSides[sideIndex].print_areas.filter((_, i) => i !== index)
      };
      return { ...prev, sides: newSides };
    });
  };

  const updateArea = (index: number, field: keyof PrintAreaItem, val: any) => {
    setFormData((prev) => {
      const newSides = [...prev.sides];
      const updatedAreas = [...newSides[sideIndex].print_areas];
      updatedAreas[index] = { ...updatedAreas[index], [field]: val };
      newSides[sideIndex] = { ...newSides[sideIndex], print_areas: updatedAreas };
      
      return { ...prev, sides: newSides };
    });
  };

  return (
    <FormSection
      title={`${sideObj.name || `Side ${sideIndex + 1}`} Print Areas`}
      description={`Define the exact physical print boundaries, bleed margins, and safe cut zones for this side.`}
      action={
        <button
          type="button"
          onClick={addPrintArea}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100/70 transition-colors shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Print Area</span>
        </button>
      }
    >
      {areas.length > 0 ? (
        <div className="space-y-4">
          {areas.map((area, idx) => (
            <div
              key={area.id || idx}
              className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-4 transition-all"
            >
              <div className="flex items-center justify-between border-b border-gray-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-blue-600">
                    <Printer className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-900">
                    {area.name || `Area ${idx + 1}`}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => removePrintArea(idx)}
                  className="p-1.5 text-gray-400 hover:text-rose-600 transition-colors rounded-md"
                  title="Remove print area"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="sm:col-span-2">
                  <AdminInput
                    label="Area Name"
                    value={area.name}
                    placeholder="e.g. Front Cover"
                    onChange={(e) => updateArea(idx, 'name', e.target.value)}
                  />
                </div>

                <div>
                  <AdminNumberInput
                    label="Trim Width"
                    suffix="mm"
                    min={1}
                    value={area.width_mm}
                    onChange={(val) => updateArea(idx, 'width_mm', typeof val === 'number' ? val : 90)}
                  />
                </div>

                <div>
                  <AdminNumberInput
                    label="Trim Height"
                    suffix="mm"
                    min={1}
                    value={area.height_mm}
                    onChange={(val) => updateArea(idx, 'height_mm', typeof val === 'number' ? val : 55)}
                  />
                </div>

                <div>
                  <AdminNumberInput
                    label="Bleed Margin"
                    suffix="mm"
                    min={0}
                    step={0.5}
                    value={area.bleed_mm}
                    onChange={(val) => updateArea(idx, 'bleed_mm', typeof val === 'number' ? val : 3)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-200/40">
                <AdminNumberInput
                  label="Safe Zone Inset"
                  suffix="mm"
                  min={0}
                  step={0.5}
                  value={area.safe_zone_mm}
                  onChange={(val) => updateArea(idx, 'safe_zone_mm', typeof val === 'number' ? val : 3)}
                  helperText="Safe interior margin from the trim cut line for text and logos."
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center text-center">
          <Printer className="w-6 h-6 text-gray-400 mb-2" />
          <p className="text-xs font-semibold text-gray-700">No print areas configured</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Add at least one print area (e.g. Front 90×55mm) to activate bleed and safe zone checks in the designer.
          </p>
        </div>
      )}
    </FormSection>
  );
};

export default ProductPrintAreas;
