'use client';

import React from 'react';
import { AlignmentType } from '@/types/designer';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Move,
} from 'lucide-react';

interface AlignmentControlsProps {
  onAlign: (type: AlignmentType) => void;
}

export const AlignmentControls: React.FC<AlignmentControlsProps> = ({
  onAlign,
}) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-semibold text-gray-500 block mb-1.5">
          Align to Canvas
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onAlign('left')}
            title="Align Left"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onAlign('center-h')}
            title="Center Horizontally"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onAlign('right')}
            title="Align Right"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onAlign('top')}
          title="Align Top"
          className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
        >
          <AlignVerticalJustifyStart className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onAlign('center-v')}
          title="Center Vertically"
          className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
        >
          <AlignVerticalJustifyCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onAlign('bottom')}
          title="Align Bottom"
          className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
        >
          <AlignVerticalJustifyEnd className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          onAlign('center-h');
          onAlign('center-v');
        }}
        className="w-full py-1.5 px-3 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-xs font-medium flex items-center justify-center gap-1.5 transition shadow-2xs"
      >
        <Move className="w-3.5 h-3.5" />
        <span>Center in Canvas</span>
      </button>
    </div>
  );
};
