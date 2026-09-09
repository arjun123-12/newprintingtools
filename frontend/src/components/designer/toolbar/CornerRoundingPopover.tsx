'use client';

import React, { useMemo } from 'react';
import { RotateCcw, X } from 'lucide-react';

export interface CornerRoundingPopoverProps {
  rx: number;
  maxRadius?: number;
  onChange: (radius: number) => void;
  onClose: () => void;
}

export const CornerRoundingPopover: React.FC<CornerRoundingPopoverProps> = ({
  rx,
  maxRadius = 200,
  onChange,
  onClose,
}) => {
  const safeMax = useMemo(
    () => Math.max(1, Number.isFinite(maxRadius) ? maxRadius : 200),
    [maxRadius]
  );

  const radius = Math.min(safeMax, Math.max(0, Number(rx) || 0));
  const percentage = Math.round((radius / safeMax) * 100);
  const sliderStep = Math.max(0.1, safeMax / 100);

  const updateRadius = (value: number) => {
    const nextValue = Number.isFinite(value)
      ? Math.min(safeMax, Math.max(0, value))
      : 0;

    onChange(Number(nextValue.toFixed(2)));
  };

  const setPercentage = (value: number) => {
    updateRadius((safeMax * value) / 100);
  };

  return (
    <div
      className="absolute right-0 top-full z-[80] mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Corner rounding</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Round every corner equally
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <div className="relative h-11 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div
            className="absolute inset-y-0 left-0 bg-purple-100 transition-[width] duration-75"
            style={{ width: `${percentage}%` }}
          />
          <div className="relative flex h-full items-center justify-between px-3">
            <span className="text-xs font-semibold text-gray-600">Radius</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={Math.ceil(safeMax)}
                step={sliderStep}
                value={Number(radius.toFixed(1))}
                onChange={(event) => updateRadius(Number(event.target.value))}
                className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-xs font-bold text-gray-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              />
              <span className="text-[10px] font-medium text-gray-400">px</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => updateRadius(0)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
          title="Reset corner rounding"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={safeMax}
        step={sliderStep}
        value={radius}
        onChange={(event) => updateRadius(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-[#8b3dff]"
        aria-label="Corner radius"
      />

      <div className="mt-2 flex justify-between text-[10px] font-medium text-gray-400">
        <span>Square</span>
        <span>{percentage}% rounded</span>
        <span>Maximum</span>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1.5">
        {[0, 25, 50, 75, 100].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setPercentage(preset)}
            className={`rounded-lg border px-1 py-1.5 text-[10px] font-bold transition ${Math.abs(percentage - preset) <= 1
              ? 'border-[#8b3dff] bg-purple-50 text-[#7c3aed]'
              : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50'
              }`}
          >
            {preset}%
          </button>
        ))}
      </div>
    </div>
  );
};

export default CornerRoundingPopover;
