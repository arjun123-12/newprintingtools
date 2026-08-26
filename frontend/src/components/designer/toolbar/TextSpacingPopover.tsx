'use client';

import React from 'react';
import { ArrowLeftRight, ArrowUpDown } from 'lucide-react';

interface TextSpacingPopoverProps {
  charSpacing: number;
  lineHeight: number;
  onCharSpacingChange: (val: number) => void;
  onLineHeightChange: (val: number) => void;
  onClose: () => void;
}

export const TextSpacingPopover: React.FC<TextSpacingPopoverProps> = ({
  charSpacing,
  lineHeight,
  onCharSpacingChange,
  onLineHeightChange,
  onClose,
}) => {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-4 text-gray-800"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-900">Spacing</span>
      </div>

      {/* Letter Spacing */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-gray-600 font-medium text-[11px]">
            <ArrowLeftRight className="w-3.5 h-3.5 text-gray-400" />
            <span>Letter spacing</span>
          </span>
          <span className="font-mono text-xs font-bold text-gray-800">{charSpacing}</span>
        </div>
        <input
          type="range"
          min="-100"
          max="500"
          value={charSpacing}
          onChange={(e) => onCharSpacingChange(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Line Spacing */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-gray-600 font-medium text-[11px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <span>Line spacing</span>
          </span>
          <span className="font-mono text-xs font-bold text-gray-800">{lineHeight.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.5"
          step="0.05"
          value={lineHeight}
          onChange={(e) => onLineHeightChange(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>
    </div>
  );
};
