'use client';

import React, { useState } from 'react';
import { X, Maximize2, Sparkles, Check } from 'lucide-react';
import { DocumentSettings, UnitType } from '@/types/designer';

interface CustomBannerSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: DocumentSettings;
  onApply: (newSettings: Partial<DocumentSettings>) => void;
}

interface BannerPreset {
  name: string;
  category: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

const BANNER_PRESETS: BannerPreset[] = [
  {
    name: 'Standard Pull-Up Banner',
    category: 'Retractable Banners',
    widthMm: 850,
    heightMm: 2000,
    description: '850 × 2000 mm (Standard trade show roll-up banner)',
  },
  {
    name: 'Wide Pull-Up Banner',
    category: 'Retractable Banners',
    widthMm: 1200,
    heightMm: 2000,
    description: '1200 × 2000 mm (Wide format exhibition roll-up)',
  },
  {
    name: 'Vinyl Banner 2m × 1m',
    category: 'Vinyl Outdoor Banners',
    widthMm: 2000,
    heightMm: 1000,
    description: '2000 × 1000 mm (Standard outdoor event vinyl banner)',
  },
  {
    name: 'Vinyl Banner 3m × 1m',
    category: 'Vinyl Outdoor Banners',
    widthMm: 3000,
    heightMm: 1000,
    description: '3000 × 1000 mm (Wide road/fence banner)',
  },
  {
    name: 'Large Street Banner 4m × 1.2m',
    category: 'Vinyl Outdoor Banners',
    widthMm: 4000,
    heightMm: 1200,
    description: '4000 × 1200 mm (Building facade or fence banner)',
  },
  {
    name: 'Mesh Fence Banner 3m × 1.5m',
    category: 'Outdoor Mesh Banners',
    widthMm: 3000,
    heightMm: 1500,
    description: '3000 × 1500 mm (Wind-resistant construction/event mesh)',
  },
  {
    name: 'Table Cloth Banner',
    category: 'Exhibition & Displays',
    widthMm: 1800,
    heightMm: 750,
    description: '1800 × 750 mm (Fitted display table runner/cover)',
  },
  {
    name: 'Teardrop Flying Flag',
    category: 'Outdoor Flags',
    widthMm: 750,
    heightMm: 2200,
    description: '750 × 2200 mm (Medium outdoor wind feather flag)',
  },
];

export const CustomBannerSizeModal: React.FC<CustomBannerSizeModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onApply,
}) => {
  const [unit, setUnit] = useState<UnitType | 'cm'>(
    currentSettings.unit === 'in' ? 'in' : 'mm'
  );
  const [width, setWidth] = useState<string>(
    currentSettings.unit === 'in'
      ? String(currentSettings.width)
      : String(currentSettings.width)
  );
  const [height, setHeight] = useState<string>(
    currentSettings.unit === 'in'
      ? String(currentSettings.height)
      : String(currentSettings.height)
  );
  const [bleed, setBleed] = useState<number>(currentSettings.bleed || 5);
  const [safeArea, setSafeArea] = useState<number>(currentSettings.safeArea || 10);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: BannerPreset) => {
    setSelectedPreset(preset.name);
    if (unit === 'in') {
      setWidth(Number((preset.widthMm / 25.4).toFixed(2)).toString());
      setHeight(Number((preset.heightMm / 25.4).toFixed(2)).toString());
    } else if (unit === 'cm') {
      setWidth((preset.widthMm / 10).toString());
      setHeight((preset.heightMm / 10).toString());
    } else {
      setWidth(preset.widthMm.toString());
      setHeight(preset.heightMm.toString());
    }
  };

  const handleApply = () => {
    const numW = parseFloat(width);
    const numH = parseFloat(height);
    if (isNaN(numW) || isNaN(numH) || numW <= 0 || numH <= 0) {
      alert('Please enter valid positive dimensions for width and height.');
      return;
    }

    // Convert cm to mm if needed
    let finalW = numW;
    let finalH = numH;
    let finalUnit: UnitType = 'mm';

    if (unit === 'cm') {
      finalW = numW * 10;
      finalH = numH * 10;
      finalUnit = 'mm';
    } else if (unit === 'in') {
      finalW = numW;
      finalH = numH;
      finalUnit = 'in';
    }

    onApply({
      width: finalW,
      height: finalH,
      unit: finalUnit,
      bleed,
      safeArea,
      name: selectedPreset ? `${selectedPreset}` : `Custom Banner (${finalW}×${finalH}${finalUnit})`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600">
              <Maximize2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Custom Banner & Artwork Size</h2>
              <p className="text-xs text-gray-500">Configure custom width, height, resolution and presets</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Unit Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Measurement Unit</label>
            <div className="grid grid-cols-3 gap-2">
              {(['mm', 'cm', 'in'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    // Convert current numbers to new unit
                    const currentW = parseFloat(width) || 0;
                    const currentH = parseFloat(height) || 0;
                    if (currentW > 0 && currentH > 0) {
                      let mmW = currentW;
                      let mmH = currentH;
                      if (unit === 'cm') { mmW *= 10; mmH *= 10; }
                      else if (unit === 'in') { mmW *= 25.4; mmH *= 25.4; }

                      if (u === 'in') {
                        setWidth(Number((mmW / 25.4).toFixed(2)).toString());
                        setHeight(Number((mmH / 25.4).toFixed(2)).toString());
                      } else if (u === 'cm') {
                        setWidth(Number((mmW / 10).toFixed(1)).toString());
                        setHeight(Number((mmH / 10).toFixed(1)).toString());
                      } else {
                        setWidth(Math.round(mmW).toString());
                        setHeight(Math.round(mmH).toString());
                      }
                    }
                    setUnit(u);
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${unit === u
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {u === 'mm' && 'Millimeters (mm)'}
                  {u === 'cm' && 'Centimeters (cm)'}
                  {u === 'in' && 'Inches (in)'}
                </button>
              ))}
            </div>
          </div>

          {/* Width and Height Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex justify-between">
                <span>Width ({unit})</span>
                <span className="text-[11px] text-gray-400">Horizontal</span>
              </label>
              <input
                type="number"
                step="any"
                min="1"
                value={width}
                onChange={(e) => {
                  setWidth(e.target.value);
                  setSelectedPreset(null);
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-sm font-semibold text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex justify-between">
                <span>Height ({unit})</span>
                <span className="text-[11px] text-gray-400">Vertical</span>
              </label>
              <input
                type="number"
                step="any"
                min="1"
                value={height}
                onChange={(e) => {
                  setHeight(e.target.value);
                  setSelectedPreset(null);
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-sm font-semibold text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Bleed & Safe Margin */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex justify-between">
                <span></span>
                <span className="text-[11px] text-red-500 font-medium">Bleed</span>
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={bleed}
                onChange={(e) => setBleed(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-xs font-medium text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex justify-between">
                <span></span>
                <span className="text-[11px] text-emerald-600 font-medium">Inside Trim</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={safeArea}
                onChange={(e) => setSafeArea(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-xs font-medium text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Banner Presets */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Standard Commercial Banner Presets</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BANNER_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-left p-3 rounded-xl border transition flex items-start justify-between ${isSelected
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50/60'
                      }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">{preset.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{preset.description}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Apply Artwork Dimensions</span>
          </button>
        </div>
      </div>
    </div>
  );
};
