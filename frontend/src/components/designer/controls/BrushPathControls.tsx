'use client';

import React from 'react';
import { SelectedObjectState } from '@/types/designer';
import { ColorPicker } from './ColorPicker';
import { Paintbrush, Sliders, Trash2, Copy, Layers } from 'lucide-react';

interface BrushPathControlsProps {
  selected: SelectedObjectState;
  onUpdate: <K extends keyof SelectedObjectState>(prop: K, value: SelectedObjectState[K]) => void;
  canvasManager?: any;
}

export const BrushPathControls: React.FC<BrushPathControlsProps> = ({
  selected,
  onUpdate,
  canvasManager,
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
              {selected.brushType || 'Brush'} Stroke
            </h4>
            <p className="text-[10px] text-gray-500 font-mono">
              Width: {strokeWidth}px • Opacity: {Math.round(opacity * 100)}%
            </p>
          </div>
        </div>
      </div>

      {/* Stroke Width Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700">Stroke Width</span>
          <span className="font-mono text-blue-600 font-bold">{strokeWidth}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="80"
          value={strokeWidth}
          onChange={(e) => onUpdate('strokeWidth', Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Stroke Opacity Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700">Opacity / Transparency</span>
          <span className="font-mono text-blue-600 font-bold">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="5"
          max="100"
          value={Math.round(opacity * 100)}
          onChange={(e) => onUpdate('opacity', Number(e.target.value) / 100)}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Stroke Line Cap */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-gray-700 block">End Cap Style</span>
        <div className="grid grid-cols-3 gap-1.5">
          {(['round', 'square', 'butt'] as const).map((cap) => (
            <button
              key={cap}
              type="button"
              onClick={() => onUpdate('strokeLineCap', cap)}
              className={`py-1.5 text-xs font-semibold rounded-lg border capitalize transition ${
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

      {/* Color Picker */}
      <div className="border-t border-gray-100 pt-3">
        <ColorPicker
          label="Stroke Color"
          value={strokeColor}
          onChange={(hex) => onUpdate('stroke', hex)}
          canvasManager={canvasManager}
        />
      </div>
    </div>
  );
};
