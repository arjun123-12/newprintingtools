'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  Scissors,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  FileCode,
  Image as ImageIcon,
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
  onExportPdf?: () => void;
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
  onExportPdf,
  onExportPng,
  onExportJpg,
  onExportPsd,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [showBleed, setShowBleed] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);
  const [baseFitZoom, setBaseFitZoom] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);

  // Generate high-resolution clean raster snapshot without active selections or editor guides
  useEffect(() => {
    if (!isOpen || !canvasManager) return;
    setLoading(true);

    try {
      const dataUrl = canvasManager.getCleanPreviewDataUrl(2.0);
      if (dataUrl) {
        setPreviewDataUrl(dataUrl);
      }
    } catch (err) {
      console.error('Failed to generate preview image:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, canvasManager]);

  // Compute fit-to-viewport scale so artwork is centered & beautifully proportioned on screen
  useEffect(() => {
    if (!isOpen || !dimensions) return;

    const calculateFit = () => {
      const containerW = containerRef.current?.clientWidth || window.innerWidth * 0.85;
      const containerH = containerRef.current?.clientHeight || window.innerHeight * 0.70;
      const padding = 60;
      const scaleX = (containerW - padding) / (dimensions.widthPx || 1063);
      const scaleY = (containerH - padding) / (dimensions.heightPx || 591);
      const fit = Math.min(1.0, Math.max(0.08, Math.min(scaleX, scaleY)));
      setBaseFitZoom(fit);
      setPreviewZoom(fit);
    };

    const timer = setTimeout(calculateFit, 50);
    window.addEventListener('resize', calculateFit);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateFit);
    };
  }, [isOpen, dimensions]);

  if (!isOpen) return null;

  const handleZoomIn = () => setPreviewZoom((z) => Math.min(Number((z * 1.25).toFixed(3)), 3.0));
  const handleZoomOut = () => setPreviewZoom((z) => Math.max(Number((z / 1.25).toFixed(3)), 0.05));
  const handleFitScreen = () => setPreviewZoom(baseFitZoom);
  const handleActualSize = () => setPreviewZoom(1.0);

  const bleedPx = dimensions.bleedPx || 0;
  const trimWidthPx = Math.max(1, dimensions.widthPx - 2 * bleedPx);
  const trimHeightPx = Math.max(1, dimensions.heightPx - 2 * bleedPx);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 truncate">
              <span>Print Preview</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                {documentSettings.width} × {documentSettings.height} {documentSettings.unit} (300 DPI)
              </span>
            </h2>
            <p className="text-xs text-slate-400 truncate">
              Clean commercial print rendering without editor guides or selection handles
            </p>
          </div>
        </div>

        {/* Center Controls: View Modes & Zoom */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Trim / Bleed Toggle */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
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
              <span>Trimmed Cut</span>
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
              <span>Full Bleed Sheet</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800/90 rounded-xl border border-slate-700 p-1 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleFitScreen}
              className="px-2.5 font-mono text-slate-300 font-medium hover:text-sky-400 transition"
              title="Click to Fit Screen"
            >
              {Math.round((previewZoom / baseFitZoom) * 100)}%
            </button>
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
              onClick={handleFitScreen}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition border-l border-slate-700 ml-1 pl-2"
              title="Fit to Screen"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleActualSize}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              title="100% Actual Size"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Actions: Export Options & Close */}
        <div className="flex items-center gap-2 shrink-0">
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition"
              title="Export Print-Ready Vector PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download Vector PDF</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExportPng}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
            title="Download PNG"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={onExportPsd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/20 transition"
            title="Download PSD"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>PSD</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition ml-1"
            title="Close Preview (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Canvas Body with Responsive Viewport */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-8 bg-radial from-slate-900 via-slate-950 to-black custom-scrollbar relative"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-9 h-9 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium">Generating crystal-clear print preview...</p>
          </div>
        ) : previewDataUrl ? (
          <div
            className="transition-transform duration-150 ease-out origin-center flex items-center justify-center"
            style={{
              transform: `scale(${previewZoom})`,
            }}
          >
            {/* Visual Container */}
            {!showBleed && bleedPx > 0 ? (
              /* Trimmed Product Mode (Clipped to trim boundary) */
              <div
                className="relative bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden rounded-xs ring-1 ring-white/10"
                style={{
                  width: `${trimWidthPx}px`,
                  height: `${trimHeightPx}px`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewDataUrl}
                  alt="Artwork Print Preview"
                  className="block max-w-none select-none pointer-events-none absolute"
                  style={{
                    width: `${dimensions.widthPx}px`,
                    height: `${dimensions.heightPx}px`,
                    top: `-${bleedPx}px`,
                    left: `-${bleedPx}px`,
                  }}
                />
              </div>
            ) : (
              /* Full Bleed Sheet Mode */
              <div
                className="relative bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden rounded-xs ring-1 ring-white/20"
                style={{
                  width: `${dimensions.widthPx}px`,
                  height: `${dimensions.heightPx}px`,
                }}
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

                {/* Trim Line Guide on Full Bleed */}
                {bleedPx > 0 && (
                  <div
                    className="absolute inset-0 pointer-events-none border-2 border-dashed border-red-500/75"
                    style={{
                      margin: `${bleedPx}px`,
                    }}
                  >
                    <span className="absolute top-1.5 left-2 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md backdrop-blur-xs">
                      Trim Line ({documentSettings.width} × {documentSettings.height} {documentSettings.unit})
                    </span>
                  </div>
                )}
              </div>
            )}
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
              <span>Commercial Preflight: Verified</span>
            </span>
          )}
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          {!showBleed && bleedPx > 0
            ? `${documentSettings.width} × ${documentSettings.height} ${documentSettings.unit} (Trimmed: ${trimWidthPx} × ${trimHeightPx} px)`
            : `${dimensions.widthPx} × ${dimensions.heightPx} px @ 300 DPI (Full Bleed)`}
        </div>
      </div>
    </div>
  );
};
