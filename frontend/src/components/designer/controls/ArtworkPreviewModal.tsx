'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Scissors,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  FileCode,
  Image as ImageIcon,
  Rotate3d,
} from 'lucide-react';
import { DocumentSettings, CanvasDimensions } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { PreflightReport } from '../utils/preflightCheck';
import { Artwork3DViewer } from './Artwork3DViewer';
import { PageData } from './PageManagerTray';
import { renderCanvasJsonToThumbnail } from '../utils/canvasThumbnail';

interface ArtworkPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentSettings: DocumentSettings;
  dimensions: CanvasDimensions;
  canvasManager: CanvasManager | null;
  preflightReport: PreflightReport | null;
  pages?: PageData[];
  activePageIndex?: number;
  printSides?: string;
  onExportPdf?: () => void;
  onExportPng: () => void;
  onExportJpg: () => void;
  onExportPsd: () => void;
}

type PreviewMode = '3d' | 'trimmed' | 'bleed';

const LIVE_PREVIEW_INTERVAL_MS = 120;

const CANVAS_CHANGE_EVENTS = [
  'object:added',
  'object:modified',
  'object:removed',
  'object:moving',
  'object:scaling',
  'object:rotating',
  'object:skewing',
  'text:changed',
  'path:created',
  'canvas:cleared',
  'template:loaded',
] as const;

export const ArtworkPreviewModal: React.FC<ArtworkPreviewModalProps> = ({
  isOpen,
  onClose,
  documentSettings,
  dimensions,
  canvasManager,
  preflightReport,
  pages,
  activePageIndex = 0,
  printSides = 'both',
  onExportPdf,
  onExportPng,
  onExportJpg,
  onExportPsd,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [resolvedBackThumb, setResolvedBackThumb] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<PreviewMode>('3d');
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(activePageIndex || 0);
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);
  const [baseFitZoom, setBaseFitZoom] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);

  // Synchronize Back side thumbnail from pages or render offscreen
  useEffect(() => {
    if (!isOpen) return;

    if (pages && pages[1]) {
      if (pages[1].thumbnail) {
        setResolvedBackThumb(pages[1].thumbnail);
      } else if (pages[1].canvasJson) {
        void renderCanvasJsonToThumbnail(pages[1].canvasJson, 800, 500).then((thumb) => {
          if (thumb) setResolvedBackThumb(thumb);
        });
      }
    } else {
      setResolvedBackThumb(null);
    }
  }, [isOpen, pages]);

  // Keep the clean preview synchronized with edits made on the live Fabric canvas.
  useEffect(() => {
    if (!isOpen || !canvasManager) return;

    const fabricCanvas = canvasManager.getCanvas();
    if (!fabricCanvas) {
      setPreviewDataUrl(null);
      setLoading(false);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let animationFrameId: number | null = null;
    let lastPreviewTime = 0;
    let disposed = false;

    const refreshPreview = async (showLoading = false) => {
      if (disposed) return;

      if (showLoading) {
        setLoading(true);
      }

      try {
        // Clean preview excludes selections, controls, rulers, and editor guides.
        const dataUrl = await canvasManager.getCleanPreviewDataUrl(2.0);

        if (dataUrl && !disposed) {
          setPreviewDataUrl(dataUrl);
          lastPreviewTime = Date.now();
        } else if (!dataUrl && !disposed) {
          console.warn('ArtworkPreviewModal: getCleanPreviewDataUrl returned empty preview.');
        }
      } catch (error) {
        console.error('Failed to generate live preview image:', error);
      } finally {
        if (!disposed && showLoading) {
          setLoading(false);
        }
      }
    };

    const schedulePreviewRefresh = () => {
      if (disposed || timeoutId !== null) return;

      const elapsed = Date.now() - lastPreviewTime;
      const delay = Math.max(0, LIVE_PREVIEW_INTERVAL_MS - elapsed);

      timeoutId = setTimeout(() => {
        timeoutId = null;

        animationFrameId = window.requestAnimationFrame(() => {
          animationFrameId = null;
          refreshPreview(false);
        });
      }, delay);
    };

    const onTemplateLoaded = () => {
      refreshPreview(true);
    };

    refreshPreview(true);

    CANVAS_CHANGE_EVENTS.forEach((eventName) => {
      if (eventName === 'template:loaded') {
        fabricCanvas.on(eventName as any, onTemplateLoaded);
      } else {
        fabricCanvas.on(eventName as any, schedulePreviewRefresh);
      }
    });

    return () => {
      disposed = true;

      CANVAS_CHANGE_EVENTS.forEach((eventName) => {
        if (eventName === 'template:loaded') {
          fabricCanvas.off(eventName as any, onTemplateLoaded);
        } else {
          fabricCanvas.off(eventName as any, schedulePreviewRefresh);
        }
      });

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
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
          <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 truncate">
              <span>Presentation Studio</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                {documentSettings.width} × {documentSettings.height} {documentSettings.unit} (300 DPI)
              </span>
            </h2>
            <p className="text-xs text-slate-400 truncate">
              Interactive 3D product view and clean commercial print rendering
            </p>
          </div>
        </div>

        {/* Center Controls: View Modes (3D, Trimmed, Bleed) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* View Modes Selector */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === '3d'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Rotate3d className="w-3.5 h-3.5" />
              <span>3D Real Mockup</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('trimmed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'trimmed'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Trimmed Cut</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('bleed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'bleed'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full Bleed Sheet</span>
            </button>
          </div>

          {/* 2D Side Switcher (Front / Back / Pages) */}
          {viewMode !== '3d' && pages && pages.length > 1 && (
            <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
              {pages.map((p, idx) => (
                <button
                  key={p.id || idx}
                  type="button"
                  onClick={() => setSelectedPageIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                    selectedPageIndex === idx
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {idx === 0 ? 'Front' : idx === 1 ? 'Back' : `Page ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* 2D Zoom Controls (shown only when in 2D modes) */}
          {viewMode !== '3d' && (
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
          )}
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

      {/* Main Preview Canvas Body */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black relative"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-9 h-9 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium">Generating crystal-clear 3D presentation...</p>
          </div>
        ) : (previewDataUrl || (pages && pages[0]?.thumbnail)) ? (() => {
          const frontPreviewUrl =
            (activePageIndex === 0 && previewDataUrl) ||
            pages?.[0]?.thumbnail ||
            previewDataUrl ||
            '';

          const backPreviewUrl =
            (activePageIndex === 1 && previewDataUrl) ||
            resolvedBackThumb ||
            pages?.[1]?.thumbnail ||
            null;

          const current2dUrl =
            selectedPageIndex === 0
              ? frontPreviewUrl
              : selectedPageIndex === 1
              ? backPreviewUrl || frontPreviewUrl
              : pages?.[selectedPageIndex]?.thumbnail || frontPreviewUrl;

          return viewMode === '3d' ? (
            /* 3D INTERACTIVE PRESENTATION VIEW */
            <Artwork3DViewer
              previewUrl={frontPreviewUrl}
              backPreviewUrl={backPreviewUrl}
              documentSettings={documentSettings}
              dimensions={dimensions}
            />
          ) : (
            /* 2D VIEWPORT (Trimmed Cut OR Full Bleed Sheet) */
            <div
              className="w-full h-full overflow-auto flex items-center justify-center p-8 custom-scrollbar"
            >
              <div
                className="transition-transform duration-150 ease-out origin-center flex items-center justify-center"
                style={{
                  transform: `scale(${previewZoom})`,
                }}
              >
                {viewMode === 'trimmed' && bleedPx > 0 ? (
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
                      src={current2dUrl}
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
                      src={current2dUrl}
                      alt="Artwork Print Preview"
                      className="block max-w-none select-none pointer-events-none"
                      style={{
                        width: `${dimensions.widthPx}px`,
                        height: `${dimensions.heightPx}px`,
                      }}
                    />

                    {/* Clean Simple Trim Line on Full Bleed Sheet */}
                    {bleedPx > 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none border border-slate-900/60 border-dashed"
                        style={{
                          margin: `${bleedPx}px`,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })() : (
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
          {viewMode === '3d'
            ? `3D Realistic Interactive Product Mockup (${documentSettings.width} × ${documentSettings.height} ${documentSettings.unit})`
            : viewMode === 'trimmed' && bleedPx > 0
              ? `${documentSettings.width} × ${documentSettings.height} ${documentSettings.unit} (Trimmed Cut: ${trimWidthPx} × ${trimHeightPx} px)`
              : `${dimensions.widthPx} × ${dimensions.heightPx} px @ 300 DPI (Full Bleed)`}
        </div>
      </div>
    </div>
  );
};
