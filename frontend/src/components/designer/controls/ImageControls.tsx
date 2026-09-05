'use client';

import React, { useRef } from 'react';
import {
  Crop,
  RefreshCw,
  FlipHorizontal,
  FlipVertical,
  ShieldCheck,
  AlertTriangle,
  FileImage,
  Sparkles,
} from 'lucide-react';
import { SelectedObjectState } from '@/types/designer';
import { calculateImageQuality, formatFileSize, getQualityBadgeDetails } from '../utils/imageQuality';
import { CanvasManager } from '../canvas/CanvasManager';
import { assetService } from '../services/assetService';
import { useState } from 'react';

interface ImageControlsProps {
  selected: SelectedObjectState;
  onUpdate: <K extends keyof SelectedObjectState>(prop: K, value: SelectedObjectState[K]) => void;
  canvasManager: CanvasManager | null;
  onOpenCrop: () => void;
}

export const ImageControls: React.FC<ImageControlsProps> = ({
  selected,
  onUpdate,
  canvasManager,
  onOpenCrop,
}) => {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // Compute live print quality info
  const naturalWidth = selected.naturalWidth || selected.width || 800;
  const naturalHeight = selected.naturalHeight || selected.height || 600;
  const renderedWidth = selected.width || 400;
  const renderedHeight = selected.height || 300;
  const fileSizeBytes = selected.fileSizeBytes || 0;

  const quality = calculateImageQuality(
    naturalWidth,
    naturalHeight,
    renderedWidth,
    renderedHeight,
    fileSizeBytes,
    300
  );

  const badge = getQualityBadgeDetails(quality.status);

  const handleReplaceImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canvasManager) return;

    try {
      const asset = await assetService.uploadFile(file);
      canvasManager.replaceActiveImage(asset.url, {
        naturalWidth: asset.naturalWidth,
        naturalHeight: asset.naturalHeight,
        fileSizeBytes: asset.fileSizeBytes,
      });
    } catch (err) {
      console.error('Failed to replace image:', err);
    }
  };

  const [progressMsg, setProgressMsg] = useState<string>('');

  const handleRemoveBackground = async () => {
    if (!canvasManager) return;
    try {
      setIsRemovingBg(true);
      setProgressMsg('Initializing...');
      await canvasManager.removeBackgroundFromSelectedImage((progress) => {
        if (progress.message) {
          setProgressMsg(progress.message);
        }
      });
    } catch (err: any) {
      alert(err.message || 'Failed to remove background.');
    } finally {
      setIsRemovingBg(false);
      setProgressMsg('');
    }
  };

  const handleRestoreOriginal = async () => {
    if (!canvasManager) return;
    await canvasManager.restoreOriginalImage();
  };

  const isSvg = selected.src?.toLowerCase().includes('.svg');
  const hasBackgroundRemoved = selected.backgroundRemoved;

  return (
    <div className="space-y-4">
      {/* Hidden File Input for Replace Image */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        onChange={handleReplaceImage}
        className="hidden"
      />

      {/* Commercial Print DPI & Quality Card */}
      <div className={`p-3.5 rounded-xl border ${badge.badgeBorder} ${badge.badgeBg} space-y-2.5 shadow-2xs`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {quality.status === 'excellent' || quality.status === 'good' ? (
              <ShieldCheck className={`w-4 h-4 ${badge.badgeText}`} />
            ) : (
              <AlertTriangle className={`w-4 h-4 ${badge.badgeText}`} />
            )}
            <span className={`text-xs font-bold ${badge.badgeText}`}>{badge.label}</span>
          </div>

          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/80 border border-black/5 text-gray-800">
            {quality.estimatedDpi} DPI
          </span>
        </div>

        <p className="text-[11px] text-gray-600 leading-relaxed">
          {badge.description}
        </p>

        {/* Dimension & File Metrics */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 text-[10px] font-mono text-gray-600">
          <div>
            <span className="text-gray-400 block font-sans">Source File:</span>
            <span className="font-semibold">{quality.originalWidth} x {quality.originalHeight} px</span>
          </div>
          <div>
            <span className="text-gray-400 block font-sans">Print Size:</span>
            <span className="font-semibold">{quality.printWidthMm} x {quality.printHeightMm} mm</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenCrop}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold shadow-2xs transition"
        >
          <Crop className="w-3.5 h-3.5 text-blue-600" />
          <span>Crop Image</span>
        </button>

        <button
          type="button"
          onClick={() => replaceInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold shadow-2xs transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
          <span>Replace Image</span>
        </button>
      </div>

      {!isSvg && (
        <button
          type="button"
          onClick={hasBackgroundRemoved ? handleRestoreOriginal : handleRemoveBackground}
          disabled={isRemovingBg || selected.isLocked}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed ${
            hasBackgroundRemoved
              ? 'border-orange-200 bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 text-orange-900'
              : 'border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-900'
          }`}
        >
          {isRemovingBg ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{progressMsg || 'Removing Background...'}</span>
            </>
          ) : hasBackgroundRemoved ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-orange-600" />
              <span>Restore Original</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Remove Background</span>
            </>
          )}
        </button>
      )}

      {/* Quick Flip Controls */}
      {/* <div className="space-y-1.5 pt-2 border-t border-gray-100">
        <label className="text-[11px] font-semibold text-gray-600 block">
          Flip Orientation
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onUpdate('flipX', !selected.flipX)}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-medium transition ${
              selected.flipX
                ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Flip X</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdate('flipY', !selected.flipY)}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-medium transition ${
              selected.flipY
                ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FlipVertical className="w-3.5 h-3.5" />
            <span>Flip Y</span>
          </button>
        </div>
      </div> */}
    </div>
  );
};
