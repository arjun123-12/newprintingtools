'use client';

import React, { useState } from 'react';
import { Palette, ChevronDown, ChevronUp } from 'lucide-react';
import { ColorPicker } from '../controls/ColorPicker';

interface BorderStylePopoverProps {
  strokeWidth: number;
  stroke: string;
  rx?: number;
  strokeDashArray?: number[];
  showCornerRadius?: boolean;
  onStrokeWidthChange: (width: number) => void;
  onStrokeDashArrayChange: (dash: number[] | null) => void;
  onCornerRadiusChange?: (radius: number) => void;
  onStrokeColorChange?: (color: string) => void;
  onClose: () => void;
}

const PRESET_BORDER_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'Charcoal', hex: '#334155' },
  { name: 'Gray', hex: '#94a3b8' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Purple', hex: '#9333ea' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Cyan', hex: '#0891b2' },
];

export const BorderStylePopover: React.FC<BorderStylePopoverProps> = ({
  strokeWidth,
  stroke = '#000000',
  rx = 0,
  strokeDashArray,
  showCornerRadius = true,
  onStrokeWidthChange,
  onStrokeDashArrayChange,
  onCornerRadiusChange,
  onStrokeColorChange,
  onClose,
}) => {
  const [showColorAdvanced, setShowColorAdvanced] = useState(false);

  const isDashed =
    Array.isArray(strokeDashArray) &&
    strokeDashArray.length > 0 &&
    strokeDashArray[0] >= 6;
  const isDotted =
    Array.isArray(strokeDashArray) &&
    strokeDashArray.length > 0 &&
    strokeDashArray[0] <= 4;
  const isSolid = !strokeDashArray || strokeDashArray.length === 0;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 max-h-[85vh] overflow-y-auto custom-scrollbar bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 p-4 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-4 text-gray-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-900">Border & Corner Rounding</span>
      </div>

      {/* 1. Border Style Selector (None, Solid, Dashed, Dotted) */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
          Border Style
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {/* None */}
          <button
            type="button"
            onClick={() => {
              onStrokeWidthChange(0);
              onStrokeDashArrayChange(null);
            }}
            title="None"
            className={`p-2 rounded-xl border flex items-center justify-center transition ${
              strokeWidth === 0
                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <span className="text-[10px] font-bold">None</span>
          </button>

          {/* Solid */}
          <button
            type="button"
            onClick={() => {
              if (strokeWidth === 0) onStrokeWidthChange(2);
              onStrokeDashArrayChange(null);
            }}
            title="Solid Line"
            className={`p-2 rounded-xl border flex items-center justify-center transition ${
              strokeWidth > 0 && isSolid
                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="w-6 h-0.5 bg-current rounded-full" />
          </button>

          {/* Dashed */}
          <button
            type="button"
            onClick={() => {
              if (strokeWidth === 0) onStrokeWidthChange(2);
              onStrokeDashArrayChange([8, 6]);
            }}
            title="Dashed Line"
            className={`p-2 rounded-xl border flex items-center justify-center transition ${
              strokeWidth > 0 && isDashed
                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="w-6 border-t-2 border-dashed border-current" />
          </button>

          {/* Dotted */}
          <button
            type="button"
            onClick={() => {
              if (strokeWidth === 0) onStrokeWidthChange(2);
              onStrokeDashArrayChange([2, 4]);
            }}
            title="Dotted Line"
            className={`p-2 rounded-xl border flex items-center justify-center transition ${
              strokeWidth > 0 && isDotted
                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="w-6 border-t-2 border-dotted border-current" />
          </button>
        </div>
      </div>

      {/* 2. Border Weight / Width */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 font-medium text-[11px]">Border weight</span>
          <div className="flex items-center gap-0.5 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200/60 shadow-2xs">
            <input
              type="number"
              min="0"
              max="50"
              value={strokeWidth}
              onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
              className="w-7 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
            />
            <span className="text-[10px] text-gray-500 font-bold">px</span>
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="50"
          value={strokeWidth}
          onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        {/* Quick Weight Pills */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          {[0, 1, 2, 4, 8, 16, 24].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onStrokeWidthChange(w)}
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded-lg border transition ${
                strokeWidth === w
                  ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {w === 0 ? '0' : `${w}px`}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Border Color Picker */}
      {onStrokeColorChange && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-medium text-[11px]">Border Color</span>
            <button
              type="button"
              onClick={() => setShowColorAdvanced((prev) => !prev)}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              <Palette className="w-3 h-3" />
              <span>{showColorAdvanced ? 'Simple' : 'CMYK & Custom'}</span>
              {showColorAdvanced ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Quick Swatches */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_BORDER_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  onStrokeColorChange(c.hex);
                  if (strokeWidth === 0) onStrokeWidthChange(2);
                }}
                title={c.name}
                className={`w-5 h-5 rounded-lg border transition shadow-2xs ${
                  stroke?.toLowerCase() === c.hex.toLowerCase()
                    ? 'ring-2 ring-blue-500 ring-offset-1 scale-110'
                    : 'border-gray-300 hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>

          {/* Advanced CMYK & Hex Color Picker Dropdown */}
          {showColorAdvanced && (
            <div className="pt-2">
              <ColorPicker
                label="Border Color (CMYK)"
                value={stroke || '#000000'}
                onChange={(c) => {
                  onStrokeColorChange(c);
                  if (strokeWidth === 0) onStrokeWidthChange(2);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. Corner Rounding / Radius (for shapes / rects / frames / images) */}
      {showCornerRadius && onCornerRadiusChange && (
        <div className="space-y-1.5 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium text-[11px]">Corner rounding</span>
            <div className="flex items-center gap-0.5 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200/60 shadow-2xs">
              <input
                type="number"
                min="0"
                max="100"
                value={rx}
                onChange={(e) => onCornerRadiusChange(Number(e.target.value))}
                className="w-8 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
              />
              <span className="text-[10px] text-gray-500 font-bold">px</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={rx}
            onChange={(e) => onCornerRadiusChange(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />

          {/* Quick Radius Pills */}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            {[
              { label: '0', val: 0 },
              { label: '8', val: 8 },
              { label: '16', val: 16 },
              { label: '32', val: 32 },
              { label: '64', val: 64 },
              { label: 'Max', val: 100 },
            ].map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => onCornerRadiusChange(r.val)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition ${
                  rx === r.val
                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
