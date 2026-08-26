'use client';

import React, { useState } from 'react';
import {
  Copy,
  Paintbrush,
  Clipboard,
  CopyPlus,
  Trash2,
  Lock,
  Unlock,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Layers,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState, AlignmentType } from '@/types/designer';

interface MoreMenuPopoverProps {
  selected: SelectedObjectState;
  canvasManager: CanvasManager | null;
  onClose: () => void;
  align?: 'left' | 'right';
}

export const MoreMenuPopover: React.FC<MoreMenuPopoverProps> = ({
  selected,
  canvasManager,
  onClose,
  align = 'right',
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<'layer' | 'align' | null>(null);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const handleAlign = (type: AlignmentType) => {
    if (!canvasManager) return;
    canvasManager.alignSelected(type);
    onClose();
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-full ${align === 'left' ? 'left-0' : 'right-0'
        } mt-2 w-60 bg-white backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none text-xs text-gray-800 space-y-0.5`}
    >
      {/* 1. Copy */}
      <button
        type="button"
        onClick={() =>
          handleAction(() => {
            if (!canvasManager) return;
            canvasManager.duplicateSelected();
          })
        }
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/80 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <Copy className="w-4 h-4 text-gray-700" />
          <span>Copy</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100/90 text-[10px] font-mono text-gray-600 font-semibold">
          Ctrl+C
        </span>
      </button>

      {/* 2. Copy Style */}
      <button
        type="button"
        onClick={() =>
          handleAction(() => {
            if (!canvasManager) return;
            canvasManager.duplicateSelected();
          })
        }
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/80 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <Paintbrush className="w-4 h-4 text-gray-700" />
          <span>Copy style</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100/90 text-[10px] font-mono text-gray-600 font-semibold">
          Ctrl+Alt+C
        </span>
      </button>

      {/* 3. Paste */}
      <button
        type="button"
        onClick={() =>
          handleAction(() => {
            if (!canvasManager) return;
            canvasManager.duplicateSelected();
          })
        }
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/80 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <Clipboard className="w-4 h-4 text-gray-700" />
          <span>Paste</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100/90 text-[10px] font-mono text-gray-600 font-semibold">
          Ctrl+V
        </span>
      </button>

      {/* 4. Duplicate */}
      <button
        type="button"
        onClick={() =>
          handleAction(() => {
            if (!canvasManager) return;
            canvasManager.duplicateSelected();
          })
        }
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/80 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <CopyPlus className="w-4 h-4 text-gray-700" />
          <span>Duplicate</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100/90 text-[10px] font-mono text-gray-600 font-semibold">
          Ctrl+D
        </span>
      </button>

      {/* 5. Delete */}
      <button
        type="button"
        onClick={() =>
          handleAction(() => {
            if (!canvasManager) return;
            canvasManager.deleteSelected();
          })
        }
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-red-50 text-gray-800 hover:text-red-600 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <Trash2 className="w-4 h-4 text-gray-700 hover:text-red-600" />
          <span>Delete</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100/90 text-[10px] font-mono text-gray-600 font-semibold uppercase">
          DELETE
        </span>
      </button>

      <div className="my-1 border-t border-gray-100" />

      {/* 6. Lock / Unlock */}
      <button
        type="button"
        onClick={() =>
          handleAction(() =>
            canvasManager?.updateSelectedProperty('isLocked', !selected.isLocked)
          )
        }
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/80 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          {selected.isLocked ? (
            <Unlock className="w-4 h-4 text-amber-600" />
          ) : (
            <Lock className="w-4 h-4 text-gray-700" />
          )}
          <span>{selected.isLocked ? 'Unlock' : 'Lock'}</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100/90 text-[10px] font-mono text-gray-600 font-semibold">
          Ctrl+L
        </span>
      </button>

      {/* 7. Layer Order Submenu */}
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setActiveSubmenu((prev) => (prev === 'layer' ? null : 'layer'))
          }
          className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/80 text-gray-800 font-medium transition cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-gray-700" />
            <span>Layer</span>
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {activeSubmenu === 'layer' && (
          <div className="absolute left-45 top-2 ml-1.5 w-48 bg-white backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 p-1.5 z-60 animate-in fade-in zoom-in-95 duration-100 space-y-0.5">
            <button
              type="button"
              onClick={() => handleAction(() => canvasManager?.bringToFront())}
              className="w-full px-3 py-1.5 flex items-center gap-2 rounded-lg hover:bg-gray-100/80 transition text-xs font-medium"
            >
              <ChevronsUp className="w-3.5 h-3.5 text-gray-500" />
              <span>Bring to front</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => canvasManager?.bringForward())}
              className="w-full px-3 py-1.5 flex items-center gap-2 rounded-lg hover:bg-gray-100/80 transition text-xs font-medium"
            >
              <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              <span>Bring forward</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => canvasManager?.sendBackward())}
              className="w-full px-3 py-1.5 flex items-center gap-2 rounded-lg hover:bg-gray-100/80 transition text-xs font-medium"
            >
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              <span>Send backward</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => canvasManager?.sendToBack())}
              className="w-full px-3 py-1.5 flex items-center gap-2 rounded-lg hover:bg-gray-100/80 transition text-xs font-medium"
            >
              <ChevronsDown className="w-3.5 h-3.5 text-gray-500" />
              <span>Send to back</span>
            </button>
          </div>
        )}
      </div>

      {/* 8. Align to Page Submenu */}
      {/* <div className="relative">
        <button
          type="button"
          onClick={() =>
            setActiveSubmenu((prev) => (prev === 'align' ? null : 'align'))
          }
          className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/80 text-gray-800 font-medium transition cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <AlignCenter className="w-4 h-4 text-gray-700" />
            <span>Align to page</span>
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {activeSubmenu === 'align' && (
          <div className="absolute left-10 top-0 ml-1.5 w-44 bg-white backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 p-2 z-60 animate-in fade-in zoom-in-95 duration-100 grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => handleAlign('top')}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex flex-col items-center gap-0.5 text-[9px] font-medium"
            >
              <AlignStartVertical className="w-3.5 h-3.5 text-gray-600" />
              <span>Top</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('middle')}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex flex-col items-center gap-0.5 text-[9px] font-medium"
            >
              <AlignCenterVertical className="w-3.5 h-3.5 text-gray-600" />
              <span>Middle</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('bottom')}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex flex-col items-center gap-0.5 text-[9px] font-medium"
            >
              <AlignEndVertical className="w-3.5 h-3.5 text-gray-600" />
              <span>Bottom</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('left')}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex flex-col items-center gap-0.5 text-[9px] font-medium"
            >
              <AlignLeft className="w-3.5 h-3.5 text-gray-600" />
              <span>Left</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('center')}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex flex-col items-center gap-0.5 text-[9px] font-medium"
            >
              <AlignCenter className="w-3.5 h-3.5 text-gray-600" />
              <span>Center</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('right')}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex flex-col items-center gap-0.5 text-[9px] font-medium"
            >
              <AlignRight className="w-3.5 h-3.5 text-gray-600" />
              <span>Right</span>
            </button>
          </div>
        )}
      </div> */}
    </div>
  );
};
