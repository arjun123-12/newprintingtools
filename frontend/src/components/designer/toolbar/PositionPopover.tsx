'use client';

import React from 'react';
import {
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { AlignmentType } from '@/types/designer';

interface PositionPopoverProps {
  canvasManager: CanvasManager | null;
  onClose: () => void;
}

export const PositionPopover: React.FC<PositionPopoverProps> = ({ canvasManager, onClose }) => {
  const handleAlign = (type: AlignmentType) => {
    if (!canvasManager) return;
    canvasManager.alignSelected(type);
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-3.5 text-gray-800"
    >
      {/* Layer Ordering (Arrange) */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
          Layer Order
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => canvasManager?.bringForward()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
          >
            <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
            <span>Forward</span>
          </button>
          <button
            type="button"
            onClick={() => canvasManager?.bringToFront()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
          >
            <ChevronsUp className="w-3.5 h-3.5 text-gray-500" />
            <span>To front</span>
          </button>
          <button
            type="button"
            onClick={() => canvasManager?.sendBackward()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
          >
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            <span>Backward</span>
          </button>
          <button
            type="button"
            onClick={() => canvasManager?.sendToBack()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-gray-500" />
            <span>To back</span>
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Align to Page */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
          Align to Page
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleAlign('top')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition"
          >
            <AlignStartVertical className="w-4 h-4 text-gray-500" />
            <span>Top</span>
          </button>
          <button
            type="button"
            onClick={() => handleAlign('middle')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition"
          >
            <AlignCenterVertical className="w-4 h-4 text-gray-500" />
            <span>Middle</span>
          </button>
          <button
            type="button"
            onClick={() => handleAlign('bottom')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition"
          >
            <AlignEndVertical className="w-4 h-4 text-gray-500" />
            <span>Bottom</span>
          </button>

          <button
            type="button"
            onClick={() => handleAlign('left')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition"
          >
            <AlignLeft className="w-4 h-4 text-gray-500" />
            <span>Left</span>
          </button>
          <button
            type="button"
            onClick={() => handleAlign('center')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition"
          >
            <AlignCenter className="w-4 h-4 text-gray-500" />
            <span>Center</span>
          </button>
          <button
            type="button"
            onClick={() => handleAlign('right')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition"
          >
            <AlignRight className="w-4 h-4 text-gray-500" />
            <span>Right</span>
          </button>
        </div>
      </div>
    </div>
  );
};
