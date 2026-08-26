'use client';

import React from 'react';
import { Plus } from 'lucide-react';

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

const PALETTE_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'Charcoal', hex: '#334155' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Gold', hex: '#eab308' },
  { name: 'Teal', hex: '#14b8a6' },
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
  const isDashed =
    Array.isArray(strokeDashArray) &&
    strokeDashArray.length > 0 &&
    strokeDashArray[0] >= 6;
  const isDotted =
    Array.isArray(strokeDashArray) &&
    strokeDashArray.length > 0 &&
    strokeDashArray[0] <= 4;
  const isSolid = !strokeDashArray || strokeDashArray.length === 0;

  const currentHex = (stroke || '#000000').toUpperCase();

  const handleColorChange = (hex: string) => {
    if (onStrokeColorChange) {
      onStrokeColorChange(hex);
      if (strokeWidth === 0) onStrokeWidthChange(2);
    }
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-3.5 text-gray-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-900">Border Style</span>
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

      {/* 3. Sleek & Compact Border Color Picker */}
      {onStrokeColorChange && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-medium text-[11px]">Border Color</span>
            {/* Custom Hex + Color Wheel Picker */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg shadow-2xs">
              <span className="text-[10px] font-mono font-bold text-gray-700">{currentHex}</span>
              <div className="relative w-4 h-4 rounded-full overflow-hidden border border-gray-300 cursor-pointer shadow-2xs hover:scale-110 transition">
                <input
                  type="color"
                  value={stroke || '#000000'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="absolute -top-2 -left-2 w-8 h-8 cursor-pointer opacity-0"
                />
                <div className="w-full h-full" style={{ backgroundColor: stroke || '#000000' }} />
              </div>
            </div>
          </div>

          {/* Compact Swatches Grid (2 rows of 8 colors) */}
          <div className="grid grid-cols-8 gap-1.5">
            {/* Custom Color Trigger Button with Rainbow Plus */}
            <div className="relative w-6 h-6 rounded-lg border border-dashed border-gray-300 hover:border-blue-500 bg-gray-50 flex items-center justify-center cursor-pointer transition hover:scale-105">
              <input
                type="color"
                value={stroke || '#000000'}
                onChange={(e) => handleColorChange(e.target.value)}
                className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
                title="Pick Custom Color"
              />
              <Plus className="w-3 h-3 text-gray-500" />
            </div>

            {/* Curated Color Swatches */}
            {PALETTE_COLORS.slice(0, 15).map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => handleColorChange(c.hex)}
                title={c.name}
                className={`w-6 h-6 rounded-lg border transition shadow-2xs ${
                  stroke?.toLowerCase() === c.hex.toLowerCase()
                    ? 'ring-2 ring-blue-500 ring-offset-1 scale-110 z-10'
                    : 'border-gray-200/90 hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
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
