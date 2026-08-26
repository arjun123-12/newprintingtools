'use client';

import React from 'react';

interface BrushSizePopoverProps {
  size: number;
  color?: string;
  opacity?: number;
  onChange: (size: number) => void;
  onClose: () => void;
}

export const BrushSizePopover: React.FC<BrushSizePopoverProps> = ({
  size,
  color = '#2563eb',
  opacity = 1.0,
  onChange,
  onClose,
}) => {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-3.5"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-900">Brush Size / Width</span>
        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
          {size}px
        </span>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min="1"
          max="80"
          value={size}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        {/* Live Size Preview Circle */}
        <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-2xs">
          <div
            className="rounded-full transition-all shadow-xs"
            style={{
              width: `${Math.min(Math.max(size, 2), 36)}px`,
              height: `${Math.min(Math.max(size, 2), 36)}px`,
              backgroundColor: color,
              opacity: opacity,
            }}
          />
        </div>
      </div>

      {/* Preset Quick Buttons */}
      <div className="flex items-center justify-between gap-1 pt-1">
        {[2, 6, 12, 20, 32, 48].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition ${
              size === s
                ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {s}px
          </button>
        ))}
      </div>
    </div>
  );
};
