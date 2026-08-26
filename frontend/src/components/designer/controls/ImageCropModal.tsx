/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, X, RotateCcw, Crop, Sparkles } from 'lucide-react';
import { SelectedObjectState } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';

interface ImageCropModalProps {
  selected: SelectedObjectState;
  canvasManager: CanvasManager | null;
  onClose: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  selected,
  canvasManager,
  onClose,
}) => {
  const imageSrc = selected.originalSrc || selected.src;
  const naturalWidth = selected.naturalWidth || selected.width || 800;
  const naturalHeight = selected.naturalHeight || selected.height || 600;

  // Normalized crop percentages (0 to 1)
  const [cropBox, setCropBox] = useState({
    x: selected.cropX ? (selected.cropX / naturalWidth) * 100 : 0,
    y: selected.cropY ? (selected.cropY / naturalHeight) * 100 : 0,
    w: selected.cropWidth ? (selected.cropWidth / naturalWidth) * 100 : 100,
    h: selected.cropHeight ? (selected.cropHeight / naturalHeight) * 100 : 100,
  });

  const [aspectRatio, setAspectRatio] = useState<'free' | '1:1' | '4:3' | '16:9' | '3:2'>('free');

  const handleApply = () => {
    if (!canvasManager) return;

    const cropX = Math.round((cropBox.x / 100) * naturalWidth);
    const cropY = Math.round((cropBox.y / 100) * naturalHeight);
    const cropWidth = Math.round((cropBox.w / 100) * naturalWidth);
    const cropHeight = Math.round((cropBox.h / 100) * naturalHeight);

    canvasManager.applyCropToActiveImage({
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
      canvasManager.resetCropOnActiveImage();
    }
    onClose();
  };

  const handleAspectChange = (ratio: 'free' | '1:1' | '4:3' | '16:9' | '3:2') => {
    setAspectRatio(ratio);
    if (ratio === '1:1') {
      const size = Math.min(cropBox.w, cropBox.h);
      setCropBox((prev) => ({ ...prev, w: size, h: size }));
    } else if (ratio === '4:3') {
      const h = (cropBox.w * 3) / 4;
      setCropBox((prev) => ({ ...prev, h: Math.min(h, 100 - prev.y) }));
    } else if (ratio === '16:9') {
      const h = (cropBox.w * 9) / 16;
      setCropBox((prev) => ({ ...prev, h: Math.min(h, 100 - prev.y) }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900">Crop Image (Non-Destructive)</h2>
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
        <div className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-xs">
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
        </div>

        {/* Crop Preview Area */}
        <div className="relative p-6 flex items-center justify-center bg-[#18181b] min-h-[320px] max-h-[460px] overflow-hidden select-none">
          {imageSrc ? (
            <div className="relative max-h-[380px] max-w-full inline-block">
              {/* Dimmed Background Source Image */}
              <img
                src={imageSrc}
                alt="Crop preview"
                className="max-h-[380px] max-w-full object-contain opacity-40 rounded-xs"
              />

              {/* Active Crop Window Overlay */}
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move rounded-xs"
                style={{
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.w}%`,
                  height: `${cropBox.h}%`,
                }}
              >
                {/* Rule of Thirds Grid Lines */}
                <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none">
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-white/40" />
                  <div className="border-r border-white/40" />
                  <div />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-xs">No image source available to crop</div>
          )}
        </div>

        {/* Crop Controls: Sliders for X, Y, Width, Height */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex justify-between text-[11px] text-gray-500 font-medium mb-1">
              <span>Crop Width</span>
              <span>{Math.round(cropBox.w)}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={cropBox.w}
              onChange={(e) => setCropBox((p) => ({ ...p, w: Number(e.target.value) }))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-gray-500 font-medium mb-1">
              <span>Crop Height</span>
              <span>{Math.round(cropBox.h)}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={cropBox.h}
              onChange={(e) => setCropBox((p) => ({ ...p, h: Number(e.target.value) }))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
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
    </div>
  );
};
