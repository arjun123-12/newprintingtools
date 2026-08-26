'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Scissors,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { DocumentSettings, CanvasDimensions } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { PreflightReport } from '../utils/preflightCheck';

interface ArtworkPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentSettings: DocumentSettings;
  dimensions: CanvasDimensions;
  canvasManager: CanvasManager | null;
  preflightReport: PreflightReport | null;
  onExportPng: () => void;
  onExportJpg: () => void;
  onExportPsd: () => void;
}

export const ArtworkPreviewModal: React.FC<ArtworkPreviewModalProps> = ({
  isOpen,
  onClose,
  documentSettings,
  dimensions,
  canvasManager,
  preflightReport,
  onExportPng,
  onExportJpg,
  onExportPsd,
}) => {
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [showBleed, setShowBleed] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !canvasManager) return;
    setLoading(true);

    const canvas = canvasManager.getCanvas();
    if (!canvas) {
      setLoading(false);
      return;
    }

    try {
      // Generate clean raster snapshot without active selection or ruler guides
      canvas.discardActiveObject();
      canvas.requestRenderAll();

      const dataUrl = canvas.toDataURL({
        format: 'png',
        multiplier: 2, // High clarity for preview
        enableRetinaScaling: true,
      });

      setPreviewDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate preview image:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, canvasManager]);

  if (!isOpen) return null;

  const handleZoomIn = () => setPreviewZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 3.0));
  const handleZoomOut = () => setPreviewZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.25));
  const handleResetZoom = () => setPreviewZoom(1.0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white backdrop-blur-md animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Print Preview</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                {documentSettings.width} × {documentSettings.height} {documentSettings.unit} (300 DPI)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Clean visual rendering without editor guides or selection bounding boxes
            </p>
          </div>
        </div>

        {/* Center Controls: View Modes & Zoom */}
        <div className="flex items-center gap-2">
          {/* Trim / Bleed Toggle */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setShowBleed(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                !showBleed
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Trimmed Product</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBleed(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                showBleed
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>With Bleed (+{documentSettings.bleed}mm)</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-1 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2.5 font-mono text-slate-300 font-medium select-none">
              {Math.round(previewZoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition border-l border-slate-700 ml-1 pl-2"
              title="Actual Size (100%)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onExportPng}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
          <button
            type="button"
            onClick={onExportPsd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/20 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PSD</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="Close Preview (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Canvas Body */}
      <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-12 bg-radial from-slate-900 to-slate-950 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium">Rendering print preview...</p>
          </div>
        ) : previewDataUrl ? (
          <div
            className="relative shadow-2xl transition-transform duration-100 ease-out origin-center flex-shrink-0"
            style={{
              transform: `scale(${previewZoom})`,
            }}
          >
            {/* Product Card Container */}
            <div
              className={`relative bg-white shadow-2xl overflow-hidden rounded-xs ${
                showBleed ? 'ring-2 ring-red-500/50' : 'ring-1 ring-black/30'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewDataUrl}
                alt="Artwork Print Preview"
                className="block max-w-none select-none pointer-events-none"
                style={{
                  width: `${dimensions.widthPx}px`,
                  height: `${dimensions.heightPx}px`,
                }}
              />

              {/* Optional Bleed Indicator Inset in Preview */}
              {showBleed && dimensions.bleedPx > 0 && (
                <div
                  className="absolute inset-0 pointer-events-none border-2 border-dashed border-red-500/60"
                  style={{
                    margin: `${dimensions.bleedPx}px`,
                  }}
                >
                  <span className="absolute top-1 left-1.5 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                    Trim Line
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">Unable to render artwork preview.</div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="h-10 px-6 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          {preflightReport?.isReadyForPrint ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Print Quality: Commercial Ready (300 DPI)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Preflight notice: Some elements may need attention</span>
            </span>
          )}
        </div>
        <div className="text-slate-500 font-mono text-[11px]">
          {dimensions.widthPx} × {dimensions.heightPx} px @ 300 DPI
        </div>
      </div>
    </div>
  );
};
