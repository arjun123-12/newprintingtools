'use client';

import React from 'react';
import { Sparkles, Layers, FileText, Image as ImageIcon, Sliders } from 'lucide-react';

export interface PrintingFieldPreset {
  id: string;
  name: string;
  code: string;
  type: 'select' | 'radio' | 'color' | 'image_swatch' | 'custom_dimensions';
  category: 'default' | 'online_design' | 'product_builder' | 'upload_file';
  badgeNum: string;
  description: string;
  values: {
    label: string;
    value: string;
    description?: string;
    priceModifiers?: Record<number, number>;
  }[];
}

export const PRINTING_FIELD_PRESETS: PrintingFieldPreset[] = [
  // Online Design Fields (affecting canvas & print specs)
  {
    id: 'preset_sides',
    name: 'Front/Back Sides',
    code: 'printing_sides',
    type: 'radio',
    category: 'online_design',
    badgeNum: '②.3',
    description: 'Single side (front only) or double-sided printing.',
    values: [
      { label: 'Front side only', value: 'front_only', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
      { label: 'Both sides (Front & Back)', value: 'both_sides', priceModifiers: { 100: 0.15, 250: 0.10, 500: 0.08, 1000: 0.06, 2000: 0.05 } },
    ],
  },
  {
    id: 'preset_paper_stock',
    name: 'Color/Material/Paper Stock',
    code: 'paper_stock',
    type: 'image_swatch',
    category: 'online_design',
    badgeNum: '③',
    description: 'Paper weight and material stock (e.g. 350gsm Silk, 450gsm Heavy, Linen).',
    values: [
      { label: '350 GSM Silk Coated', value: '350gsm_silk', description: 'Standard smooth premium finish', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
      { label: '450 GSM Heavyweight Card', value: '450gsm_heavy', description: 'Ultra thick luxury cardstock', priceModifiers: { 100: 0.12, 250: 0.09, 500: 0.07, 1000: 0.05, 2000: 0.04 } },
      { label: '350 GSM 100% Recycled Kraft', value: '350gsm_kraft', description: 'Eco-friendly textured brown kraft', priceModifiers: { 100: 0.08, 250: 0.06, 500: 0.05, 1000: 0.04, 2000: 0.03 } },
      { label: '300 GSM Textured Linen', value: '300gsm_linen', description: 'Cross-hatch woven tactile finish', priceModifiers: { 100: 0.18, 250: 0.14, 500: 0.11, 1000: 0.09, 2000: 0.07 } },
    ],
  },
  {
    id: 'preset_size',
    name: 'Size / Dimensions',
    code: 'product_size',
    type: 'select',
    category: 'online_design',
    badgeNum: '④',
    description: 'Standard trimmed finished product size.',
    values: [
      { label: 'Standard (90 × 55 mm)', value: 'standard_90x55', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
      { label: 'Slim / Japanese (85 × 55 mm)', value: 'slim_85x55', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
      { label: 'Square (55 × 55 mm)', value: 'square_55x55', priceModifiers: { 100: 0.05, 250: 0.04, 500: 0.03, 1000: 0.02, 2000: 0.02 } },
    ],
  },
  {
    id: 'preset_orientation',
    name: 'Orientation',
    code: 'orientation',
    type: 'radio',
    category: 'online_design',
    badgeNum: '⑧',
    description: 'Horizontal (Landscape) or Vertical (Portrait) artwork layout.',
    values: [
      { label: 'Horizontal (Landscape)', value: 'horizontal', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
      { label: 'Vertical (Portrait)', value: 'vertical', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
    ],
  },
  {
    id: 'preset_corners',
    name: 'Rounded Corners',
    code: 'corner_style',
    type: 'image_swatch',
    category: 'online_design',
    badgeNum: '⑩',
    description: 'Die-cut corner radius for smooth ergonomic finish.',
    values: [
      { label: 'Square Corners (Standard)', value: 'square', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
      { label: '3mm Radius Rounded Corners', value: 'round_3mm', priceModifiers: { 100: 0.08, 250: 0.05, 500: 0.04, 1000: 0.03, 2000: 0.02 } },
      { label: '6mm Radius Rounded Corners', value: 'round_6mm', priceModifiers: { 100: 0.08, 250: 0.05, 500: 0.04, 1000: 0.03, 2000: 0.02 } },
    ],
  },
  {
    id: 'preset_finish',
    name: 'Lamination / Coating',
    code: 'finish_coating',
    type: 'image_swatch',
    category: 'online_design',
    badgeNum: '⑪',
    description: 'Protective and tactile laminate coatings.',
    values: [
      { label: 'Uncoated / Raw Matte', value: 'uncoated', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
      { label: 'Matt Lamination (Silky Soft)', value: 'matt_lam', priceModifiers: { 100: 0.06, 250: 0.04, 500: 0.03, 1000: 0.025, 2000: 0.02 } },
      { label: 'Gloss Lamination (High Shine)', value: 'gloss_lam', priceModifiers: { 100: 0.06, 250: 0.04, 500: 0.03, 1000: 0.025, 2000: 0.02 } },
      { label: 'Velvet Soft-Touch', value: 'velvet_touch', priceModifiers: { 100: 0.14, 250: 0.10, 500: 0.08, 1000: 0.06, 2000: 0.05 } },
    ],
  },
  {
    id: 'preset_folding',
    name: 'Folding Styles',
    code: 'folding_style',
    type: 'select',
    category: 'online_design',
    badgeNum: '⑫',
    description: 'Creasing and folding types for brochures and leaflets.',
    values: [
      { label: 'No Fold (Flat Sheet)', value: 'flat', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
      { label: 'Half Fold (Single Fold)', value: 'half_fold', priceModifiers: { 100: 0.04, 250: 0.03, 500: 0.02, 1000: 0.015, 2000: 0.01 } },
      { label: 'Tri-Fold / Letter Fold', value: 'tri_fold', priceModifiers: { 100: 0.06, 250: 0.04, 500: 0.03, 1000: 0.025, 2000: 0.02 } },
      { label: 'Z-Fold (Accordion)', value: 'z_fold', priceModifiers: { 100: 0.06, 250: 0.04, 500: 0.03, 1000: 0.025, 2000: 0.02 } },
    ],
  },
  {
    id: 'preset_custom_dim',
    name: 'Custom Dimensions (mm / cm)',
    code: 'custom_dimensions',
    type: 'custom_dimensions',
    category: 'online_design',
    badgeNum: '⑤',
    description: 'Dynamic customer width × height input calculator.',
    values: [
      { label: 'Custom Width × Height', value: 'user_dimensions', priceModifiers: { 100: 0, 250: 0, 500: 0, 1000: 0, 2000: 0 } },
    ],
  },
];

interface PrintingFieldsToolbarProps {
  onAddField: (preset: PrintingFieldPreset) => void;
  existingCodes?: string[];
}

export const PrintingFieldsToolbar: React.FC<PrintingFieldsToolbarProps> = ({
  onAddField,
  existingCodes = [],
}) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-4 select-none">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 tracking-tight">Printing Fields & Quick Builder</h4>
            <p className="text-[11px] text-gray-400">Click any preset to insert pre-configured print specifications and quantity matrices.</p>
          </div>
        </div>
      </div>

      {/* Online design fields group */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/50 inline-block">
          Online Design & Artwork Fields
        </span>
        <div className="flex flex-wrap gap-2">
          {PRINTING_FIELD_PRESETS.map((preset) => {
            const isAdded = existingCodes.includes(preset.code);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onAddField(preset)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-2xs
                  ${isAdded
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/70'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700'}
                `}
              >
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center">
                  {preset.badgeNum}
                </span>
                <span>{preset.name}</span>
                {isAdded && <span className="text-[10px] text-emerald-600 font-bold ml-0.5">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend footnote */}
      <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-4 text-[10px] text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white font-bold text-[8px] flex items-center justify-center">②</span>
          <span>Online design fields which effect custom design configuration</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-gray-500 text-white font-bold text-[8px] flex items-center justify-center">①</span>
          <span>Default pricing & delivery fields</span>
        </div>
      </div>
    </div>
  );
};

export default PrintingFieldsToolbar;
