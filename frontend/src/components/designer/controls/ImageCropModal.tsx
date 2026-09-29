/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, RotateCcw, Crop, Sparkles, Move, Maximize2 } from 'lucide-react';
import { SelectedObjectState } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';

interface ImageCropModalProps {
  selected: SelectedObjectState;
  canvasManager: CanvasManager | null;
  onClose: () => void;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  selected,
  canvasManager,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [elementPreview, setElementPreview] = useState<string | null>(
    selected.originalSrc || selected.src || null
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(!elementPreview);

  const naturalWidth = Math.max(
    selected.naturalWidth ||
      (selected.width ? Math.round(selected.width) : 400),
    20
  );
  const naturalHeight = Math.max(
    selected.naturalHeight ||
      (selected.height ? Math.round(selected.height) : 300),
    20
  );

  // Normalized crop percentages (0 to 100)
  const [cropBox, setCropBox] = useState(() => {
    const isCropped = Boolean(selected.isElementCropped);
    const initX = isCropped && selected.cropX ? (selected.cropX / naturalWidth) * 100 : 0;
    const initY = isCropped && selected.cropY ? (selected.cropY / naturalHeight) * 100 : 0;
    const initW = isCropped && selected.cropWidth ? (selected.cropWidth / naturalWidth) * 100 : 100;
    const initH = isCropped && selected.cropHeight ? (selected.cropHeight / naturalHeight) * 100 : 100;

    return {
      x: Math.max(0, Math.min(initX, 90)),
      y: Math.max(0, Math.min(initY, 90)),
      w: Math.max(10, Math.min(initW, 100 - initX)),
      h: Math.max(10, Math.min(initH, 100 - initY)),
    };
  });

  const [aspectRatio, setAspectRatio] = useState<'free' | '1:1' | '4:3' | '16:9' | '3:2'>('free');

  // Interactive preview container & drag state
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    initialBox: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // Generate high-resolution render preview for non-image objects (shapes, text, SVGs, groups)
  useEffect(() => {
    if (canvasManager) {
      const url = canvasManager.getActiveObjectPreviewUrl();
      if (url) {
        setElementPreview(url);
      }
      setIsLoadingPreview(false);
    }
  }, [canvasManager]);

  const handleApply = () => {
    if (!canvasManager) return;

    const cropX = Math.round((cropBox.x / 100) * naturalWidth);
    const cropY = Math.round((cropBox.y / 100) * naturalHeight);
    const cropWidth = Math.max(10, Math.round((cropBox.w / 100) * naturalWidth));
    const cropHeight = Math.max(10, Math.round((cropBox.h / 100) * naturalHeight));

    canvasManager.applyCropToActiveElement({
      cropX,
      cropY,
      cropWidth,
      cropHeight,
    });

    onClose();
  };

  const handleResetCrop = () => {
    setCropBox({ x: 0, y: 0, w: 100, h: 100 });
    if (canvasManager) {
      canvasManager.resetCropOnActiveElement();
    }
    onClose();
  };

  const handleAspectChange = (ratio: 'free' | '1:1' | '4:3' | '16:9' | '3:2') => {
    setAspectRatio(ratio);
    if (ratio === 'free') return;

    let targetRatio = 1;
    if (ratio === '1:1') targetRatio = 1;
    if (ratio === '4:3') targetRatio = 4 / 3;
    if (ratio === '16:9') targetRatio = 16 / 9;
    if (ratio === '3:2') targetRatio = 3 / 2;

    // Aspect ratio in element coordinate terms (taking naturalWidth / naturalHeight into account)
    const elementRatio = naturalWidth / naturalHeight;
    const boxRatio = targetRatio / elementRatio;

    setCropBox((prev) => {
      let newW = prev.w;
      let newH = newW / boxRatio;

      if (prev.y + newH > 100) {
        newH = 100 - prev.y;
        newW = newH * boxRatio;
      }
      if (prev.x + newW > 100) {
        newW = 100 - prev.x;
        newH = newW / boxRatio;
      }

      return {
        ...prev,
        w: Math.max(10, Math.min(newW, 100 - prev.x)),
        h: Math.max(10, Math.min(newH, 100 - prev.y)),
      };
    });
  };

  // Interactive mouse / touch drag handlers
  const handlePointerDown = (mode: DragMode, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...cropBox },
    };
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return;

    const { mode, startX, startY, initialBox } = dragRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaXPercent = ((e.clientX - startX) / rect.width) * 100;
    const deltaYPercent = ((e.clientY - startY) / rect.height) * 100;

    setCropBox(() => {
      let { x, y, w, h } = initialBox;

      if (mode === 'move') {
        x = Math.max(0, Math.min(x + deltaXPercent, 100 - w));
        y = Math.max(0, Math.min(y + deltaYPercent, 100 - h));
        return { x, y, w, h };
      }

      // Handle corner and edge resizing
      if (mode === 'se') {
        w = Math.max(10, Math.min(w + deltaXPercent, 100 - x));
        h = Math.max(10, Math.min(h + deltaYPercent, 100 - y));
      } else if (mode === 'sw') {
        const newX = Math.max(0, Math.min(x + deltaXPercent, x + w - 10));
        w = w + (x - newX);
        x = newX;
        h = Math.max(10, Math.min(h + deltaYPercent, 100 - y));
      } else if (mode === 'ne') {
        const newY = Math.max(0, Math.min(y + deltaYPercent, y + h - 10));
        h = h + (y - newY);
        y = newY;
        w = Math.max(10, Math.min(w + deltaXPercent, 100 - x));
      } else if (mode === 'nw') {
        const newX = Math.max(0, Math.min(x + deltaXPercent, x + w - 10));
        const newY = Math.max(0, Math.min(y + deltaYPercent, y + h - 10));
        w = w + (x - newX);
        h = h + (y - newY);
        x = newX;
        y = newY;
      } else if (mode === 'e') {
        w = Math.max(10, Math.min(w + deltaXPercent, 100 - x));
      } else if (mode === 'w') {
        const newX = Math.max(0, Math.min(x + deltaXPercent, x + w - 10));
        w = w + (x - newX);
        x = newX;
      } else if (mode === 's') {
        h = Math.max(10, Math.min(h + deltaYPercent, 100 - y));
      } else if (mode === 'n') {
        const newY = Math.max(0, Math.min(y + deltaYPercent, y + h - 10));
        h = h + (y - newY);
        y = newY;
      }

      return {
        x: Math.max(0, Math.min(x, 90)),
        y: Math.max(0, Math.min(y, 90)),
        w: Math.max(10, Math.min(w, 100 - x)),
        h: Math.max(10, Math.min(h, 100 - y)),
      };
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
      dragRef.current = null;
    }
  }, []);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Window-level pointer listeners for butter-smooth handle dragging outside preview area
  useEffect(() => {
    const onWindowPointerMove = (e: PointerEvent) => {
      if (!dragRef.current || !containerRef.current) return;

      const { mode, startX, startY, initialBox } = dragRef.current;
      const rect = containerRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const deltaXPercent = ((e.clientX - startX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - startY) / rect.height) * 100;

      setCropBox(() => {
        let { x, y, w, h } = initialBox;

        if (mode === 'move') {
          x = Math.max(0, Math.min(x + deltaXPercent, 100 - w));
          y = Math.max(0, Math.min(y + deltaYPercent, 100 - h));
          return { x, y, w, h };
        }

        // Corner and edge resizing
        if (mode === 'se') {
          w = Math.max(10, Math.min(w + deltaXPercent, 100 - x));
          h = Math.max(10, Math.min(h + deltaYPercent, 100 - y));
        } else if (mode === 'sw') {
          const newX = Math.max(0, Math.min(x + deltaXPercent, x + w - 10));
          w = w + (x - newX);
          x = newX;
          h = Math.max(10, Math.min(h + deltaYPercent, 100 - y));
        } else if (mode === 'ne') {
          const newY = Math.max(0, Math.min(y + deltaYPercent, y + h - 10));
          h = h + (y - newY);
          y = newY;
          w = Math.max(10, Math.min(w + deltaXPercent, 100 - x));
        } else if (mode === 'nw') {
          const newX = Math.max(0, Math.min(x + deltaXPercent, x + w - 10));
          const newY = Math.max(0, Math.min(y + deltaYPercent, y + h - 10));
          w = w + (x - newX);
          h = h + (y - newY);
          x = newX;
          y = newY;
        } else if (mode === 'e') {
          w = Math.max(10, Math.min(w + deltaXPercent, 100 - x));
        } else if (mode === 'w') {
          const newX = Math.max(0, Math.min(x + deltaXPercent, x + w - 10));
          w = w + (x - newX);
          x = newX;
        } else if (mode === 's') {
          h = Math.max(10, Math.min(h + deltaYPercent, 100 - y));
        } else if (mode === 'n') {
          const newY = Math.max(0, Math.min(y + deltaYPercent, y + h - 10));
          h = h + (y - newY);
          y = newY;
        }

        return {
          x: Math.max(0, Math.min(x, 90)),
          y: Math.max(0, Math.min(y, 90)),
          w: Math.max(10, Math.min(w, 100 - x)),
          h: Math.max(10, Math.min(h, 100 - y)),
        };
      });
    };

    const onWindowPointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
    };
  }, []);

  // Compute dynamic modal title based on selected element type
  const getModalTitle = () => {
    if (selected.isFrame) return 'Crop Frame Photo';
    if (selected.type === 'image' || selected.src) return 'Crop Image';
    if (selected.isShape) return 'Crop Shape';
    if (selected.text) return 'Crop Text';
    if (selected.type === 'group' || selected.isMultiple) return 'Crop Group';
    return 'Crop Element';
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 sm:p-6 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900">{getModalTitle()}</h2>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Non-Destructive
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aspect Ratio Presets */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-xs flex-wrap flex-shrink-0">
          <span className="text-[11px] font-semibold text-gray-500 mr-1">Aspect Ratio:</span>
          {(['free', '1:1', '4:3', '16:9', '3:2'] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => handleAspectChange(ratio)}
              className={`px-2.5 py-1 rounded-md capitalize transition ${
                aspectRatio === ratio
                  ? 'bg-blue-600 text-white font-medium shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {ratio === 'free' ? 'Freeform' : ratio}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-gray-400 hidden sm:inline">
            Drag corners to resize • Drag center to reposition
          </span>
        </div>

        {/* Crop Preview Area */}
        <div
          className="relative p-6 flex items-center justify-center bg-[#18181b] min-h-[260px] max-h-[440px] flex-1 overflow-hidden select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {elementPreview ? (
            <div
              ref={containerRef}
              className="relative max-h-[380px] max-w-full inline-block select-none touch-none"
            >
              {/* Dimmed Background Source Image / Element */}
              <img
                src={elementPreview}
                alt="Crop preview"
                className="max-h-[380px] max-w-full object-contain opacity-35 rounded-xs pointer-events-none block"
                draggable={false}
              />

              {/* Active Crop Window Overlay with Interactive Border & Handles */}
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] cursor-move rounded-xs select-none touch-none"
                style={{
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.w}%`,
                  height: `${cropBox.h}%`,
                }}
                onPointerDown={(e) => handlePointerDown('move', e)}
              >
                {/* Rule of Thirds Grid Lines */}
                <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none">
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div />
                </div>

                {/* Corner Resize Handles */}
                <div
                  onPointerDown={(e) => handlePointerDown('nw', e)}
                  className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-blue-600 rounded-full cursor-nwse-resize shadow-xs hover:scale-125 transition-transform"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('ne', e)}
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-blue-600 rounded-full cursor-nesw-resize shadow-xs hover:scale-125 transition-transform"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('sw', e)}
                  className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-blue-600 rounded-full cursor-nesw-resize shadow-xs hover:scale-125 transition-transform"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('se', e)}
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-blue-600 rounded-full cursor-nwse-resize shadow-xs hover:scale-125 transition-transform"
                />

                {/* Edge Resize Bars */}
                <div
                  onPointerDown={(e) => handlePointerDown('n', e)}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white/80 rounded-full cursor-ns-resize"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('s', e)}
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white/80 rounded-full cursor-ns-resize"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('w', e)}
                  className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-6 bg-white/80 rounded-full cursor-ew-resize"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('e', e)}
                  className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-6 bg-white/80 rounded-full cursor-ew-resize"
                />
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-xs">
              {isLoadingPreview ? 'Loading element preview...' : 'No preview available to crop'}
            </div>
          )}
        </div>

        {/* Crop Controls: Sliders for Width, Height, Position X, Position Y */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs flex-shrink-0">
          <div>
            <div className="flex justify-between text-[11px] text-gray-500 font-medium mb-1">
              <span>Width</span>
              <span>{Math.round(cropBox.w)}%</span>
            </div>
            <input
              type="range"
              min="10"
              max={100 - cropBox.x}
              value={cropBox.w}
              onChange={(e) => setCropBox((p) => ({ ...p, w: Number(e.target.value) }))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-gray-500 font-medium mb-1">
              <span>Height</span>
              <span>{Math.round(cropBox.h)}%</span>
            </div>
            <input
              type="range"
              min="10"
              max={100 - cropBox.y}
              value={cropBox.h}
              onChange={(e) => setCropBox((p) => ({ ...p, h: Number(e.target.value) }))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-gray-500 font-medium mb-1">
              <span>Position X</span>
              <span>{Math.round(cropBox.x)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max={100 - cropBox.w}
              value={cropBox.x}
              onChange={(e) => setCropBox((p) => ({ ...p, x: Number(e.target.value) }))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-gray-500 font-medium mb-1">
              <span>Position Y</span>
              <span>{Math.round(cropBox.y)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max={100 - cropBox.h}
              value={cropBox.y}
              onChange={(e) => setCropBox((p) => ({ ...p, y: Number(e.target.value) }))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={handleResetCrop}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition border border-gray-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Crop</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
