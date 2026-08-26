'use client';

import React from 'react';
import { SelectedObjectState } from '@/types/designer';
import {
  FlipHorizontal,
  FlipVertical,
  Lock,
  Unlock,
  Copy,
  Trash2,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
} from 'lucide-react';

interface TransformControlsProps {
  selected: SelectedObjectState;
  onUpdate: <K extends keyof SelectedObjectState>(
    prop: K,
    value: SelectedObjectState[K]
  ) => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const TransformControls: React.FC<TransformControlsProps> = ({
  selected,
  onUpdate,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onDuplicate,
  onDelete,
}) => {
  return (
    <div className="space-y-4">
      {/* Position & Size Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-gray-500 block mb-1">
            X Position (px)
          </label>
          <input
            type="number"
            value={selected.left}
            onChange={(e) => onUpdate('left', Number(e.target.value))}
            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-500 block mb-1">
            Y Position (px)
          </label>
          <input
            type="number"
            value={selected.top}
            onChange={(e) => onUpdate('top', Number(e.target.value))}
            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 block mb-1">
            Width (px)
          </label>
          <input
            type="number"
            value={selected.width}
            onChange={(e) => onUpdate('width', Number(e.target.value))}
            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-500 block mb-1">
            Height (px)
          </label>
          <input
            type="number"
            value={selected.height}
            onChange={(e) => onUpdate('height', Number(e.target.value))}
            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Rotation */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-[11px] font-semibold text-gray-500">
            Rotation Angle
          </label>
          <span className="text-xs text-gray-700 font-mono font-medium">
            {selected.angle}°
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="360"
            value={selected.angle}
            onChange={(e) => onUpdate('angle', Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <input
            type="number"
            min="0"
            max="360"
            value={selected.angle}
            onChange={(e) => onUpdate('angle', Number(e.target.value))}
            className="w-14 bg-white border border-gray-200 rounded-lg px-1.5 py-1 text-xs text-gray-800 text-right font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Opacity */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-[11px] font-semibold text-gray-500">
            Opacity
          </label>
          <span className="text-xs text-gray-700 font-mono font-medium">
            {Math.round(selected.opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(selected.opacity * 100)}
          onChange={(e) => onUpdate('opacity', Number(e.target.value) / 100)}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Flip & Quick Actions */}
      <div className="border-t border-gray-100 pt-3">
        <label className="text-[11px] font-semibold text-gray-500 block mb-2">
          Transform & Actions
        </label>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onUpdate('flipX', !selected.flipX)}
            title="Flip Horizontal"
            className={`p-2 rounded-lg border flex items-center justify-center transition ${
              selected.flipX
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onUpdate('flipY', !selected.flipY)}
            title="Flip Vertical"
            className={`p-2 rounded-lg border flex items-center justify-center transition ${
              selected.flipY
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <FlipVertical className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onUpdate('isLocked', !selected.isLocked)}
            title={selected.isLocked ? 'Unlock Object' : 'Lock Object'}
            className={`p-2 rounded-lg border flex items-center justify-center transition ${
              selected.isLocked
                ? 'bg-amber-50 border-amber-300 text-amber-600'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {selected.isLocked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate (Ctrl + D)"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layer Stacking Order */}
      <div className="border-t border-gray-100 pt-3">
        <label className="text-[11px] font-semibold text-gray-500 block mb-2">
          Layer Position
        </label>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={onBringToFront}
            title="Bring to Front"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
          >
            <ChevronsUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onBringForward}
            title="Bring Forward"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onSendBackward}
            title="Send Backward"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onSendToBack}
            title="Send to Back"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition shadow-2xs"
          >
            <ChevronsDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete Button */}
      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={onDelete}
          className="w-full py-2 px-3 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold flex items-center justify-center gap-2 transition"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Object</span>
        </button>
      </div>
    </div>
  );
};
