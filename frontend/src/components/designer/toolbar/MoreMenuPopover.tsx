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
  Image as ImageIcon,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState, AlignmentType } from '@/types/designer';

interface MoreMenuPopoverProps {
  selected: SelectedObjectState;
  canvasManager: CanvasManager | null;
  onClose: () => void;
  align?: 'left' | 'right';
}

let copiedObjectStyle: Record<string, any> | null = null;

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

  const handleCopyStyle = () => {
    if (!canvasManager) return;
    const canvas = canvasManager.getCanvas();
    const active = canvas?.getActiveObject();
    if (active) {
      copiedObjectStyle = {
        fill: active.get('fill'),
        stroke: active.get('stroke'),
        strokeWidth: active.get('strokeWidth'),
        opacity: active.get('opacity'),
        shadow: active.get('shadow'),
        strokeDashArray: active.get('strokeDashArray'),
      };
      if ('fontFamily' in active) {
        copiedObjectStyle.fontFamily = (active as any).fontFamily;
        copiedObjectStyle.fontSize = (active as any).fontSize;
        copiedObjectStyle.fontWeight = (active as any).fontWeight;
        copiedObjectStyle.fontStyle = (active as any).fontStyle;
        copiedObjectStyle.textAlign = (active as any).textAlign;
      }
    }
    onClose();
  };

  const handlePasteStyle = () => {
    if (!canvasManager || !copiedObjectStyle) return;
    const canvas = canvasManager.getCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      active.set(copiedObjectStyle);
      canvas.requestRenderAll();
    }
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
      className={`absolute top-full ${
        align === 'left' ? 'left-0' : 'right-0'
      } mt-2 w-60 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/90 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none text-xs text-gray-800 space-y-0.5`}
    >
      {/* 1. Copy */}
      <button
        type="button"
        onClick={() =>
          handleAction(() => {
            if (!canvasManager) return;
            canvasManager.copySelected();
          })
        }
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/90 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <Copy className="w-4 h-4 text-gray-700" />
          <span>Copy</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-500 font-semibold">
          Ctrl+C
        </span>
      </button>

      {/* 2. Copy Style */}
      <button
        type="button"
        onClick={handleCopyStyle}
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/90 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <Paintbrush className="w-4 h-4 text-gray-700" />
          <span>Copy style</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-500 font-semibold">
          Ctrl+Alt+C
        </span>
      </button>

      {/* Paste Style (if style copied) */}
      {copiedObjectStyle && (
        <button
          type="button"
          onClick={handlePasteStyle}
          className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-purple-50 text-purple-700 font-medium transition cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Paintbrush className="w-4 h-4 text-purple-600" />
            <span>Paste style</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-[10px] font-mono text-purple-700 font-semibold">
            Apply
          </span>
        </button>
      )}

      {/* 3. Paste */}
      <button
        type="button"
        onClick={() =>
          handleAction(() => {
            if (!canvasManager) return;
            canvasManager.pasteClipboard();
          })
        }
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/90 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <Clipboard className="w-4 h-4 text-gray-700" />
          <span>Paste</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-500 font-semibold">
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
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/90 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <CopyPlus className="w-4 h-4 text-gray-700" />
          <span>Duplicate</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-500 font-semibold">
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
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-500 font-semibold uppercase">
          DELETE
        </span>
      </button>

      {/* Set image as background */}
      {selected.type === 'image' && (
        <button
          type="button"
          onClick={() =>
            handleAction(() => {
              if (!canvasManager) return;
              void canvasManager.setImageAsBackground();
            })
          }
          className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/90 text-gray-800 font-medium transition cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <ImageIcon className="w-4 h-4 text-gray-700" />
            <span>Set image as background</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-500 font-semibold">
            Ctrl+Alt+G
          </span>
        </button>
      )}

      <div className="my-1 border-t border-gray-100" />

      {/* 6. Layer Order Submenu */}
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setActiveSubmenu((prev) => (prev === 'layer' ? null : 'layer'))
          }
          className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/90 text-gray-800 font-medium transition cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-gray-700" />
            <span>Layer</span>
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {activeSubmenu === 'layer' && (
          <div
            className={`absolute ${
              align === 'left' ? 'left-full ml-1.5' : 'right-full mr-1.5'
            } top-0 w-48 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/90 p-1.5 z-60 animate-in fade-in zoom-in-95 duration-100 space-y-0.5`}
          >
            <button
              type="button"
              onClick={() => handleAction(() => canvasManager?.bringToFront())}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <ChevronsUp className="w-3.5 h-3.5 text-gray-500" />
              <span>Bring to front</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => canvasManager?.bringForward())}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              <span>Bring forward</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => canvasManager?.sendBackward())}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              <span>Send backward</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => canvasManager?.sendToBack())}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <ChevronsDown className="w-3.5 h-3.5 text-gray-500" />
              <span>Send to back</span>
            </button>
          </div>
        )}
      </div>

      {/* 7. Align to Page Submenu */}
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setActiveSubmenu((prev) => (prev === 'align' ? null : 'align'))
          }
          className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/90 text-gray-800 font-medium transition cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <AlignCenter className="w-4 h-4 text-gray-700" />
            <span>Align to page</span>
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {activeSubmenu === 'align' && (
          <div
            className={`absolute ${
              align === 'left' ? 'left-full ml-1.5' : 'right-full mr-1.5'
            } top-0 w-48 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/90 p-1.5 z-60 animate-in fade-in zoom-in-95 duration-100 space-y-0.5`}
          >
            <button
              type="button"
              onClick={() => handleAlign('top')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <AlignStartVertical className="w-3.5 h-3.5 text-gray-500" />
              <span>Top</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('middle')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <AlignCenterVertical className="w-3.5 h-3.5 text-gray-500" />
              <span>Middle</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('bottom')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <AlignEndVertical className="w-3.5 h-3.5 text-gray-500" />
              <span>Bottom</span>
            </button>
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              onClick={() => handleAlign('left')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <AlignLeft className="w-3.5 h-3.5 text-gray-500" />
              <span>Left</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('center')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <AlignCenter className="w-3.5 h-3.5 text-gray-500" />
              <span>Center</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('right')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 rounded-lg hover:bg-gray-100/90 transition text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
            >
              <AlignRight className="w-3.5 h-3.5 text-gray-500" />
              <span>Right</span>
            </button>
          </div>
        )}
      </div>

      <div className="my-1 border-t border-gray-100" />

      {/* 8. Lock / Unlock */}
      <button
        type="button"
        onClick={() =>
          handleAction(() =>
            canvasManager?.updateSelectedProperty('isLocked', !selected.isLocked)
          )
        }
        className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-gray-100/90 text-gray-800 font-medium transition cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          {selected.isLocked ? (
            <Unlock className="w-4 h-4 text-amber-600" />
          ) : (
            <Lock className="w-4 h-4 text-gray-700" />
          )}
          <span>{selected.isLocked ? 'Unlock' : 'Lock'}</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-500 font-semibold">
          Ctrl+L
        </span>
      </button>
    </div>
  );
};
