'use client';

import React from 'react';
import { SelectedObjectState } from '@/types/designer';
import { ColorPicker } from './ColorPicker';
import { Paintbrush, Sliders, Trash2, Copy, Layers } from 'lucide-react';

interface BrushPathControlsProps {
  selected: SelectedObjectState;
  onUpdate: <K extends keyof SelectedObjectState>(prop: K, value: SelectedObjectState[K]) => void;
}

export const BrushPathControls: React.FC<BrushPathControlsProps> = ({
  selected,
  onUpdate,
}) => {
  const strokeWidth = selected.strokeWidth || 4;
  const opacity = selected.opacity !== undefined ? selected.opacity : 1.0;
  const strokeColor = selected.stroke || '#2563eb';
  const strokeLineCap = selected.strokeLineCap || 'round';
  const strokeLineJoin = selected.strokeLineJoin || 'round';

  return (
    <div className="space-y-4 select-none">
      {/* Path Header */}
      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600 text-white">
            <Paintbrush className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 capitalize">
              {selected.name || 'Vector Brush Path'}
            </h4>
            <span className="text-[10px] text-blue-700 font-medium">
              Editable Vector Stroke
            </span>
          </div>
        </div>

        <div
          className="w-5 h-5 rounded-full border border-gray-300 shadow-2xs"
          style={{ backgroundColor: strokeColor }}
          title={strokeColor}
        />
      </div>

      {/* Stroke Width Slider */}
      <div className="p-3 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2">
        <div className="flex justify-between items-center text-[11px] font-bold text-gray-700">
          <span>Stroke Width</span>
          <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {strokeWidth}px
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={strokeWidth}
          onChange={(e) => onUpdate('strokeWidth', Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Opacity Slider */}
      <div className="p-3 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2">
        <div className="flex justify-between items-center text-[11px] font-bold text-gray-700">
          <span>Opacity</span>
          <span className="font-mono text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
            {Math.round(opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0.1}
          max={1.0}
          step={0.05}
          value={opacity}
          onChange={(e) => onUpdate('opacity', Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Stroke Cap & Join */}
      <div className="p-3 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2">
        <label className="text-[11px] font-bold text-gray-700 block">Line Caps</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['round', 'square', 'butt'] as const).map((cap) => (
            <button
              key={cap}
              type="button"
              onClick={() => onUpdate('strokeLineCap', cap)}
              className={`py-1 px-2 rounded-lg text-xs font-semibold capitalize border transition ${
                strokeLineCap === cap
                  ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cap}
            </button>
          ))}
        </div>
      </div>

      {/* CMYK Stroke Color */}
      <div className="border-t border-gray-100 pt-3">
        <ColorPicker
          label="Stroke Color (CMYK)"
          value={strokeColor}
          onChange={(hex) => onUpdate('stroke', hex)}
        />
      </div>
    </div>
  );
};
