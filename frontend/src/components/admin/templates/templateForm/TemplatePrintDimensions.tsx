'use client';

import React from 'react';
import { FormSection, FormGrid, AdminInput, AdminSelect } from '@/components/admin/shared';
import { TemplateFormData, TemplateFormErrors, ProductOption } from './types';
import { Layers, RotateCcw } from 'lucide-react';

interface TemplatePrintDimensionsProps {
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  selectedProduct?: ProductOption | null;
  onCustomize?: () => void;
  errors?: TemplateFormErrors;
}

const PRINT_SIDE_OPTIONS = [
  { value: 'front', label: 'Front Side Only' },
  { value: 'back', label: 'Back Side Only' },
  { value: 'both', label: 'Front and Back' },
];

export const TemplatePrintDimensions: React.FC<TemplatePrintDimensionsProps> = ({
  formData,
  setFormData,
  selectedProduct,
  onCustomize,
  errors = {},
}) => {
  const handleSideChange = (val: string) => {
    onCustomize?.();
    setFormData((prev) => ({
      ...prev,
      print_sides: val as 'front' | 'back' | 'both',
    }));
  };

  const handleNumericChange = (
    field: 'width_mm' | 'height_mm' | 'margin_mm' | 'bleed_mm' | 'safe_area_mm',
    rawVal: string,
    isNullable: boolean = false
  ) => {
    onCustomize?.();
    if (rawVal === '') {
      setFormData((prev) => ({
        ...prev,
        [field]: isNullable ? null : 0,
      }));
      return;
    }

    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed)) {
      setFormData((prev) => ({
        ...prev,
        [field]: parsed,
      }));
    }
  };

  const handleResetToProduct = () => {
    if (!selectedProduct) return;
    setFormData((prev) => ({
      ...prev,
      print_sides: selectedProduct.print_sides || 'front',
      width_mm: selectedProduct.width_mm !== null && selectedProduct.width_mm !== undefined ? selectedProduct.width_mm : null,
      height_mm: selectedProduct.height_mm !== null && selectedProduct.height_mm !== undefined ? selectedProduct.height_mm : null,
      margin_mm: selectedProduct.margin_mm ?? 0,
      bleed_mm: selectedProduct.bleed_mm ?? 0,
      safe_area_mm: selectedProduct.safe_area_mm ?? 0,
    }));
  };

  return (
    <FormSection
      title="Print Size and Sides"
      description="Configure print sides and document dimensions. Values initially inherit from the selected product and can be customized specifically for this template."
      action={
        selectedProduct && (
          <button
            type="button"
            onClick={handleResetToProduct}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 border border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs"
            title="Reset measurements to match selected product"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Copy Product Specs</span>
          </button>
        )
      }
    >
      <div className="space-y-4">
        <FormGrid cols={3} gap="md">
          {/* Print Sides Selection */}
          <AdminSelect
            label="Print Sides"
            value={formData.print_sides || 'front'}
            options={PRINT_SIDE_OPTIONS}
            onChange={(e) => handleSideChange(e.target.value)}
            helperText="Single side (Front/Back) or dual side (Front and Back) canvases."
          />

          {/* Width in mm */}
          <AdminInput
            label="Width (mm)"
            type="number"
            step="any"
            min="0.1"
            placeholder="e.g. 90"
            value={formData.width_mm !== null && formData.width_mm !== undefined ? formData.width_mm : ''}
            error={errors.width_mm}
            onChange={(e) => handleNumericChange('width_mm', e.target.value, true)}
            helperText="Trimmed document width in millimetres."
          />

          {/* Height in mm */}
          <AdminInput
            label="Height (mm)"
            type="number"
            step="any"
            min="0.1"
            placeholder="e.g. 50"
            value={formData.height_mm !== null && formData.height_mm !== undefined ? formData.height_mm : ''}
            error={errors.height_mm}
            onChange={(e) => handleNumericChange('height_mm', e.target.value, true)}
            helperText="Trimmed document height in millimetres."
          />
        </FormGrid>

        <FormGrid cols={3} gap="md">
          {/* Bleed in mm */}
          <AdminInput
            label="Bleed (mm)"
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 3"
            value={formData.bleed_mm !== null && formData.bleed_mm !== undefined ? formData.bleed_mm : 0}
            error={errors.bleed_mm}
            onChange={(e) => handleNumericChange('bleed_mm', e.target.value, false)}
            helperText="Outer boundary trimmed post-printing (default 0)."
          />

          {/* Safe Area in mm */}
          <AdminInput
            label="Safe Area (mm)"
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 3"
            value={formData.safe_area_mm !== null && formData.safe_area_mm !== undefined ? formData.safe_area_mm : 0}
            error={errors.safe_area_mm}
            onChange={(e) => handleNumericChange('safe_area_mm', e.target.value, false)}
            helperText="Inner safety boundary for text and logos (default 0)."
          />

          {/* Margin in mm */}
          <AdminInput
            label="Margin (mm)"
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 2"
            value={formData.margin_mm !== null && formData.margin_mm !== undefined ? formData.margin_mm : 0}
            error={errors.margin_mm}
            onChange={(e) => handleNumericChange('margin_mm', e.target.value, false)}
            helperText="Inside guide margin for designer alignment (default 0)."
          />
        </FormGrid>

        {/* Visual summary info */}
        <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Sides:</strong>{' '}
              {formData.print_sides === 'both'
                ? 'Front and Back (Dual Canvas)'
                : formData.print_sides === 'back'
                ? 'Back Side Only'
                : 'Front Side Only'}
              {formData.width_mm && formData.height_mm ? (
                <>
                  {' '}• <strong>Artwork Size:</strong> {formData.width_mm} × {formData.height_mm} mm
                </>
              ) : (
                ' • Using Product / Fallback Dimension'
              )}
              {formData.bleed_mm > 0 ? ` • Bleed: ${formData.bleed_mm} mm` : ''}
              {formData.safe_area_mm > 0 ? ` • Safe: ${formData.safe_area_mm} mm` : ''}
              {formData.margin_mm > 0 ? ` • Margin: ${formData.margin_mm} mm` : ''}
            </span>
          </div>
        </div>
      </div>
    </FormSection>
  );
};

export default TemplatePrintDimensions;
