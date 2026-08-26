'use client';

import React from 'react';
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Minus, Plus } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';

interface RotatePopoverProps {
  selected: SelectedObjectState;
  canvasManager: CanvasManager | null;
  onClose: () => void;
}

const COMMON_ANGLES = [
  { label: '0°', val: 0 },
  { label: '45°', val: 45 },
  { label: '90°', val: 90 },
  { label: '135°', val: 135 },
  { label: '180°', val: 180 },
  { label: '270°', val: 270 },
  { label: '-45°', val: 315 },
  { label: '-90°', val: 270 },
];

export const RotatePopover: React.FC<RotatePopoverProps> = ({
  selected,
  canvasManager,
  onClose,
}) => {
  const currentAngle = Math.round(selected.angle || 0);

  const normalizeAngle = (ang: number) => {
    let a = ang % 360;
    if (a < 0) a += 360;
    return a;
  };

  const handleAngleChange = (newAngle: number) => {
    if (!canvasManager) return;
    const normalized = normalizeAngle(newAngle);
    canvasManager.updateSelectedProperty('angle', normalized);
  };

  const handleStep = (step: number) => {
    handleAngleChange(currentAngle + step);
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-3.5 text-gray-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <RotateCw className="w-3.5 h-3.5 text-blue-600" />
          <span>Rotate & Angle</span>
        </span>
        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
          {currentAngle}°
        </span>
      </div>

      {/* 1. Angle Stepper & Exact Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 font-medium text-[11px]">Rotation Angle</span>
          <div className="flex items-center gap-0.5 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200/60 shadow-2xs">
            <input
              type="number"
              min="-360"
              max="360"
              value={currentAngle}
              onChange={(e) => handleAngleChange(Number(e.target.value))}
              className="w-10 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
            />
            <span className="text-[10px] text-gray-500 font-bold">°</span>
          </div>
        </div>

        {/* Stepper with Minus / Plus and Quick Step */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStep(-15)}
            title="Rotate -15°"
            className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleStep(-1)}
            title="Step -1°"
            className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Continuous Rotation Slider */}
          <input
            type="range"
            min="0"
            max="360"
            value={normalizeAngle(currentAngle)}
            onChange={(e) => handleAngleChange(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />

          <button
            type="button"
            onClick={() => handleStep(1)}
            title="Step +1°"
            className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleStep(15)}
            title="Rotate +15°"
            className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Quick Useful Angle Snap Points */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
          Preset Angles
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {COMMON_ANGLES.map((a) => {
            const isSelected =
              normalizeAngle(currentAngle) === normalizeAngle(a.val);
            return (
              <button
                key={a.label}
                type="button"
                onClick={() => handleAngleChange(a.val)}
                className={`py-1 px-2 text-xs font-semibold rounded-lg border transition ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Quick Flip Controls */}
      <div className="space-y-1.5 border-t border-gray-100 pt-2.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
          Quick Flip
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!canvasManager) return;
              canvasManager.updateSelectedProperty('flipX', !selected.flipX);
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition ${
              selected.flipX
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Flip H</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!canvasManager) return;
              canvasManager.updateSelectedProperty('flipY', !selected.flipY);
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition ${
              selected.flipY
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FlipVertical className="w-3.5 h-3.5" />
            <span>Flip V</span>
          </button>
        </div>
      </div>
    </div>
  );
};
