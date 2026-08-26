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
  RotateCw,
  Minus,
  Plus,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { AlignmentType, SelectedObjectState } from '@/types/designer';

interface PositionPopoverProps {
  selected?: SelectedObjectState | null;
  canvasManager: CanvasManager | null;
  onClose: () => void;
}

export const PositionPopover: React.FC<PositionPopoverProps> = ({
  selected,
  canvasManager,
  onClose,
}) => {
  const handleAlign = (type: AlignmentType) => {
    if (!canvasManager) return;
    canvasManager.alignSelected(type);
  };

  const currentAngle = Math.round(selected?.angle || 0);

  const handleAngleChange = (newAngle: number) => {
    if (!canvasManager) return;
    let normalized = newAngle % 360;
    if (normalized < 0) normalized += 360;
    canvasManager.updateSelectedProperty('angle', normalized);
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-68 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-3.5 text-gray-800"
    >
      {/* 1. Layer Ordering (Arrange) */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
          Layer Order
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => canvasManager?.bringForward()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition shadow-2xs"
          >
            <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
            <span>Forward</span>
          </button>
          <button
            type="button"
            onClick={() => canvasManager?.bringToFront()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition shadow-2xs"
          >
            <ChevronsUp className="w-3.5 h-3.5 text-gray-500" />
            <span>To front</span>
          </button>
          <button
            type="button"
            onClick={() => canvasManager?.sendBackward()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition shadow-2xs"
          >
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            <span>Backward</span>
          </button>
          <button
            type="button"
            onClick={() => canvasManager?.sendToBack()}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition shadow-2xs"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-gray-500" />
            <span>To back</span>
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* 2. Align to Page */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
          Align to Page
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleAlign('top')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition shadow-2xs"
          >
            <AlignStartVertical className="w-4 h-4 text-gray-500" />
            <span>Top</span>
          </button>
          <button
            type="button"
            onClick={() => handleAlign('middle')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition shadow-2xs"
          >
            <AlignCenterVertical className="w-4 h-4 text-gray-500" />
            <span>Middle</span>
          </button>
          <button
            type="button"
            onClick={() => handleAlign('bottom')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition shadow-2xs"
          >
            <AlignEndVertical className="w-4 h-4 text-gray-500" />
            <span>Bottom</span>
          </button>

          <button
            type="button"
            onClick={() => handleAlign('left')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition shadow-2xs"
          >
            <AlignLeft className="w-4 h-4 text-gray-500" />
            <span>Left</span>
          </button>
          <button
            type="button"
            onClick={() => handleAlign('center')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition shadow-2xs"
          >
            <AlignCenter className="w-4 h-4 text-gray-500" />
            <span>Center</span>
          </button>
          <button
            type="button"
            onClick={() => handleAlign('right')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-medium text-gray-700 transition shadow-2xs"
          >
            <AlignRight className="w-4 h-4 text-gray-500" />
            <span>Right</span>
          </button>
        </div>
      </div>

      {/* 3. Rotation Section (Requirement 12) */}
      {selected && (
        <>
          <div className="border-t border-gray-100" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <RotateCw className="w-3 h-3 text-gray-400" />
                <span>Rotation</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAngleChange(currentAngle - 1)}
                  title="Rotate -1°"
                  className="p-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-0.5 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200/60 shadow-2xs">
                  <input
                    type="number"
                    min="0"
                    max="360"
                    value={currentAngle}
                    onChange={(e) => handleAngleChange(Number(e.target.value))}
                    className="w-8 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
                  />
                  <span className="text-[10px] text-gray-500 font-bold">°</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAngleChange(currentAngle + 1)}
                  title="Rotate +1°"
                  className="p-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Quick Angle Buttons */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              {[0, 45, 90, 180].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => handleAngleChange(deg)}
                  className={`py-0.5 text-[10px] font-bold rounded-lg border transition ${
                    currentAngle === deg
                      ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
