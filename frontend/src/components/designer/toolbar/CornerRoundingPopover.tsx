'use client';

import React from 'react';
import { Minus, Plus, X } from 'lucide-react';

interface CornerRoundingPopoverProps {
  rx: number;
  onChange: (radius: number) => void;
  onClose: () => void;
}

const PRESETS = [0, 6, 12, 20, 32, 50];

export const CornerRoundingPopover: React.FC<CornerRoundingPopoverProps> = ({
  rx = 0,
  onChange,
  onClose,
}) => {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-3 text-gray-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-900">Corner rounding</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Slider & Stepper */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={rx}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-[#7c3aed] cursor-pointer h-1.5 bg-gray-200 rounded-lg"
          />
          <div className="flex items-center h-8 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => onChange(Math.max(0, rx - 2))}
              className="px-1.5 h-full hover:bg-gray-200 text-gray-600 transition"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              min="0"
              max="100"
              value={rx}
              onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-10 bg-transparent text-center text-xs font-mono font-bold text-gray-800 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(Math.min(100, rx + 2))}
              className="px-1.5 h-full hover:bg-gray-200 text-gray-600 transition"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center justify-between gap-1 pt-1">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                rx === preset
                  ? 'bg-[#f0ebff] text-[#7c3aed] border border-[#8b5cf6]'
                  : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
