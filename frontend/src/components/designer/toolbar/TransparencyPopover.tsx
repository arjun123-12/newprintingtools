'use client';

import React from 'react';

interface TransparencyPopoverProps {
  opacity: number;
  onChange: (val: number) => void;
  onClose: () => void;
}

export const TransparencyPopover: React.FC<TransparencyPopoverProps> = ({
  opacity,
  onChange,
  onClose,
}) => {
  const percentage = Math.round((opacity !== undefined ? opacity : 1) * 100);

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-56 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-3"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-900">Transparency</span>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="100"
          value={percentage}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex items-center gap-0.5 bg-gray-100 px-2 py-1 rounded-lg">
          <input
            type="number"
            min="0"
            max="100"
            value={percentage}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            className="w-8 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
          />
          <span className="text-[10px] text-gray-500 font-bold">%</span>
        </div>
      </div>
    </div>
  );
};
