'use client';

import React from 'react';
import {
  Copy,
  Lock,
  Unlock,
  Trash2,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';

interface MoreMenuPopoverProps {
  selected: SelectedObjectState;
  canvasManager: CanvasManager | null;
  onClose: () => void;
}

export const MoreMenuPopover: React.FC<MoreMenuPopoverProps> = ({
  selected,
  canvasManager,
  onClose,
}) => {
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full right-0 mt-2 w-52 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 select-none text-xs text-gray-700 space-y-0.5"
    >
      <button
        type="button"
        onClick={() => handleAction(() => canvasManager?.duplicateSelected())}
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-gray-100/80 transition"
      >
        <span className="flex items-center gap-2">
          <Copy className="w-3.5 h-3.5 text-gray-500" />
          <span>Duplicate</span>
        </span>
        <span className="text-[10px] text-gray-400 font-mono">Ctrl+D</span>
      </button>

      <button
        type="button"
        onClick={() =>
          handleAction(() =>
            canvasManager?.updateSelectedProperty('isLocked', !selected.isLocked)
          )
        }
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-gray-100/80 transition"
      >
        <span className="flex items-center gap-2">
          {selected.isLocked ? (
            <Unlock className="w-3.5 h-3.5 text-amber-600" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-gray-500" />
          )}
          <span>{selected.isLocked ? 'Unlock' : 'Lock'}</span>
        </span>
      </button>

      <div className="my-1 border-t border-gray-100" />

      <button
        type="button"
        onClick={() => handleAction(() => canvasManager?.bringToFront())}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-gray-100/80 transition"
      >
        <ChevronsUp className="w-3.5 h-3.5 text-gray-500" />
        <span>Bring to front</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction(() => canvasManager?.bringForward())}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-gray-100/80 transition"
      >
        <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        <span>Bring forward</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction(() => canvasManager?.sendBackward())}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-gray-100/80 transition"
      >
        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        <span>Send backward</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction(() => canvasManager?.sendToBack())}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-gray-100/80 transition"
      >
        <ChevronsDown className="w-3.5 h-3.5 text-gray-500" />
        <span>Send to back</span>
      </button>

      <div className="my-1 border-t border-gray-100" />

      <button
        type="button"
        onClick={() => handleAction(() => canvasManager?.deleteSelected())}
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-red-50 text-red-600 transition"
      >
        <span className="flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
          <span>Delete</span>
        </span>
        <span className="text-[10px] text-red-400 font-mono">Del</span>
      </button>
    </div>
  );
};
