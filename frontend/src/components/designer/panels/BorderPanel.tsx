'use client';

import React from 'react';
import { Plus, Minus, Square } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';

interface BorderPanelProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
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

const WEIGHT_PRESETS = [0, 1, 2, 3, 4, 5, 8, 10, 15];

export const BorderPanel: React.FC<BorderPanelProps> = ({ canvasManager, selected }) => {
  if (!selected) {
    return (
      <div className="p-6 text-center text-gray-500 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <Square className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-gray-800">No element selected</h4>
        <p className="text-xs text-gray-500">
          Select an image, shape, or text box on your canvas to customize its border, stroke width, color, and corner rounding.
        </p>
      </div>
    );
  }

  const strokeWidth = selected.strokeWidth || 0;
  const stroke = selected.stroke || selected.fill || '#000000';
  const rx = selected.rx || 0;
  const strokeDashArray = selected.strokeDashArray;

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

  const handleUpdate = (prop: keyof SelectedObjectState, val: any) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty(prop, val);
  };

  const handleColorChange = (hex: string) => {
    handleUpdate('stroke', hex);
    if (strokeWidth === 0) {
      handleUpdate('strokeWidth', 2);
    }
  };

  const handleStepWidth = (delta: number) => {
    handleUpdate('strokeWidth', Math.max(0, strokeWidth + delta));
  };

  const handleStepRadius = (delta: number) => {
    const newR = Math.max(0, Math.min(100, rx + delta));
    handleUpdate('rx', newR);
    handleUpdate('ry', newR);
  };

  return (
    <div className="p-4 space-y-6 select-none custom-scrollbar overflow-y-auto">
      {/* 1. Border Style (None, Solid, Dashed, Dotted) */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
          Border Style
        </span>
        <div className="grid grid-cols-4 gap-2">
          {/* None */}
          <button
            type="button"
            onClick={() => {
              handleUpdate('strokeWidth', 0);
              handleUpdate('strokeDashArray', null);
            }}
            className={`p-2.5 rounded-xl border flex items-center justify-center transition ${
              strokeWidth === 0
                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs font-bold'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <span className="text-xs font-bold">None</span>
          </button>

          {/* Solid */}
          <button
            type="button"
            onClick={() => {
              if (strokeWidth === 0) handleUpdate('strokeWidth', 2);
              handleUpdate('strokeDashArray', null);
            }}
            title="Solid Line"
            className={`p-2.5 rounded-xl border flex items-center justify-center transition ${
              strokeWidth > 0 && isSolid
                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs font-bold'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="w-8 h-1 bg-current rounded-full" />
          </button>

          {/* Dashed */}
          <button
            type="button"
            onClick={() => {
              if (strokeWidth === 0) handleUpdate('strokeWidth', 2);
              handleUpdate('strokeDashArray', [8, 6]);
            }}
            title="Dashed Line"
            className={`p-2.5 rounded-xl border flex items-center justify-center transition ${
              strokeWidth > 0 && isDashed
                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs font-bold'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="w-8 border-t-2 border-dashed border-current" />
          </button>

          {/* Dotted */}
          <button
            type="button"
            onClick={() => {
              if (strokeWidth === 0) handleUpdate('strokeWidth', 2);
              handleUpdate('strokeDashArray', [2, 4]);
            }}
            title="Dotted Line"
            className={`p-2.5 rounded-xl border flex items-center justify-center transition ${
              strokeWidth > 0 && isDotted
                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs font-bold'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="w-8 border-t-2 border-dotted border-current" />
          </button>
        </div>
      </div>

      {/* 2. Border Weight / Width */}
      <div className="space-y-2.5 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Border Weight
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleStepWidth(-1)}
              title="Decrease width"
              className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-0.5 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs">
              <input
                type="number"
                min="0"
                max="50"
                value={strokeWidth}
                onChange={(e) => handleUpdate('strokeWidth', Math.max(0, Number(e.target.value)))}
                className="w-8 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
              />
              <span className="text-[10px] text-gray-500 font-bold">px</span>
            </div>
            <button
              type="button"
              onClick={() => handleStepWidth(1)}
              title="Increase width"
              className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Continuous Width Slider */}
        <input
          type="range"
          min="0"
          max="50"
          value={strokeWidth}
          onChange={(e) => handleUpdate('strokeWidth', Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        {/* Quick Weight Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {WEIGHT_PRESETS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => handleUpdate('strokeWidth', w)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
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

      {/* 3. Border Color */}
      <div className="space-y-2.5 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Border Color
          </span>
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg shadow-2xs">
            <span className="text-xs font-mono font-bold text-gray-700">{currentHex}</span>
            <div className="relative w-5 h-5 rounded-full overflow-hidden border border-gray-300 cursor-pointer shadow-2xs hover:scale-110 transition">
              <input
                type="color"
                value={stroke || '#000000'}
                onChange={(e) => handleColorChange(e.target.value)}
                className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer opacity-0"
              />
              <div className="w-full h-full" style={{ backgroundColor: stroke || '#000000' }} />
            </div>
          </div>
        </div>

        {/* Palette Color Swatches Grid */}
        <div className="grid grid-cols-8 gap-2">
          {/* Custom Color Plus */}
          <div className="relative w-8 h-8 rounded-xl border border-dashed border-gray-300 hover:border-blue-500 bg-gray-50 flex items-center justify-center cursor-pointer transition hover:scale-105">
            <input
              type="color"
              value={stroke || '#000000'}
              onChange={(e) => handleColorChange(e.target.value)}
              className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
              title="Pick Custom Color"
            />
            <Plus className="w-4 h-4 text-gray-500" />
          </div>

          {PALETTE_COLORS.slice(0, 15).map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => handleColorChange(c.hex)}
              title={c.name}
              className={`w-8 h-8 rounded-xl border transition shadow-2xs ${
                stroke?.toLowerCase() === c.hex.toLowerCase()
                  ? 'ring-2 ring-blue-500 ring-offset-1 scale-110 z-10'
                  : 'border-gray-200 hover:scale-105'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {/* 4. Corner Rounding / Radius */}
      <div className="space-y-2.5 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Corner Rounding
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleStepRadius(-1)}
              title="Decrease corner radius"
              className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-0.5 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs">
              <input
                type="number"
                min="0"
                max="100"
                value={rx}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value));
                  handleUpdate('rx', val);
                  handleUpdate('ry', val);
                }}
                className="w-8 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
              />
              <span className="text-[10px] text-gray-500 font-bold">px</span>
            </div>
            <button
              type="button"
              onClick={() => handleStepRadius(1)}
              title="Increase corner radius"
              className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={rx}
          onChange={(e) => {
            const val = Number(e.target.value);
            handleUpdate('rx', val);
            handleUpdate('ry', val);
          }}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        {/* Quick Radius Pills */}
        <div className="flex items-center justify-between gap-1 pt-1">
          {[
            { label: '0', val: 0 },
            { label: '4px', val: 4 },
            { label: '8px', val: 8 },
            { label: '16px', val: 16 },
            { label: '32px', val: 32 },
            { label: '64px', val: 64 },
            { label: 'Max', val: 100 },
          ].map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => {
                handleUpdate('rx', r.val);
                handleUpdate('ry', r.val);
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
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
    </div>
  );
};
