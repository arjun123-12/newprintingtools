'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Scissors,
  Layers,
  Sparkles,
  Rotate3d,
  BookOpen,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { DocumentSettings, CanvasDimensions } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { PreflightReport } from '../utils/preflightCheck';
import { Artwork3DViewer } from './Artwork3DViewer';
import { PageData } from './PageManagerTray';
import { renderCanvasJsonToThumbnail, renderCanvasJsonToPrintPreview } from '../utils/canvasThumbnail';

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

export type PreviewMode = '3d' | 'spread' | 'trimmed' | 'bleed' | 'grid';

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
  pages,
  activePageIndex = 0,
  printSides = 'both',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [resolvedPageThumbs, setResolvedPageThumbs] = useState<Record<number, string>>({});
  const [viewMode, setViewMode] = useState<PreviewMode>('3d');
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(activePageIndex || 0);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState<number>(0);
  const [selected3dPairIndex, setSelected3dPairIndex] = useState<number>(0);
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);
  const [baseFitZoom, setBaseFitZoom] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);

  // Synchronize initial page selections when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedPageIndex(activePageIndex || 0);
      setCurrentSpreadIndex(Math.floor((activePageIndex || 0) / 2));
      setSelected3dPairIndex(Math.floor((activePageIndex || 0) / 2));
    }
  }, [isOpen, activePageIndex]);

  // Pre-render high-res print-quality previews for all pages from canvasJson
  useEffect(() => {
    if (!isOpen || !pages) return;

    const bleed = Math.max(0, Number(dimensions?.bleedPx) || 0);
    const trimW = Math.max(1, Number(dimensions?.widthPx) || 1063);
    const trimH = Math.max(1, Number(dimensions?.heightPx) || 591);
    const totalW = Number(dimensions?.totalWidthPx) || (trimW + bleed * 2);
    const totalH = Number(dimensions?.totalHeightPx) || (trimH + bleed * 2);

    pages.forEach((page, idx) => {
      // Prioritize full print-quality vector rendering directly from canvas JSON
      if (page.canvasJson && (page.canvasJson.objects?.length > 0 || page.canvasJson.background)) {
        void renderCanvasJsonToPrintPreview(page.canvasJson, totalW, totalH, 2.5).then((thumb) => {
          if (thumb) {
            setResolvedPageThumbs((prev) => ({ ...prev, [idx]: thumb }));
          }
        });
      } else if (page.thumbnail) {
        // Fallback to static thumbnail only if no canvas JSON is available
        setResolvedPageThumbs((prev) => {
          if (prev[idx]) return prev;
          return { ...prev, [idx]: page.thumbnail! };
        });
      }
    });
  }, [isOpen, pages, dimensions]);

  // Keep the clean active canvas preview synchronized at ultra-sharp print resolution
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
        const dataUrl = await canvasManager.getCleanPreviewDataUrl(2.5);
        if (dataUrl && !disposed) {
          setPreviewDataUrl(dataUrl);
          lastPreviewTime = Date.now();
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
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, canvasManager]);

  const bleedPx = Math.max(0, Number(dimensions?.bleedPx) || 0);
  const trimWidthPx = Math.max(1, Number(dimensions?.widthPx) || 1063);
  const trimHeightPx = Math.max(1, Number(dimensions?.heightPx) || 591);
  const totalWidthPx = Number(dimensions?.totalWidthPx) || (trimWidthPx + bleedPx * 2);
  const totalHeightPx = Number(dimensions?.totalHeightPx) || (trimHeightPx + bleedPx * 2);

  // Compute fit-to-viewport scale
  useEffect(() => {
    if (!isOpen || !dimensions) return;

    const calculateFit = () => {
      const containerW = containerRef.current?.clientWidth || window.innerWidth * 0.85;
      const containerH = containerRef.current?.clientHeight || window.innerHeight * 0.70;
      const padding = 60;
      const targetW =
        viewMode === 'spread'
          ? trimWidthPx * 2 + 50
          : viewMode === 'bleed'
          ? totalWidthPx
          : trimWidthPx;
      const targetH = viewMode === 'bleed' ? totalHeightPx : trimHeightPx;
      const scaleX = (containerW - padding) / targetW;
      const scaleY = (containerH - padding) / targetH;
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
  }, [isOpen, dimensions, viewMode, trimWidthPx, trimHeightPx, totalWidthPx, totalHeightPx]);

  const displayPages = useMemo(() => {
    if (pages && pages.length > 0) return pages;
    return [
      {
        id: 'page-1',
        thumbnail: previewDataUrl,
        canvasJson: {},
      },
    ];
  }, [pages, previewDataUrl]);

  const totalPages = displayPages.length;
  const totalSpreads = Math.ceil(totalPages / 2);

  // Helper to get image URL for any page index
  const getPageUrl = (idx: number): string => {
    if (idx === activePageIndex && previewDataUrl) {
      return previewDataUrl;
    }
    return resolvedPageThumbs[idx] || displayPages[idx]?.thumbnail || (idx === 0 ? previewDataUrl : '') || '';
  };

  const getPageLabel = (idx: number): string => {
    if (totalPages === 1) return 'Front';
    if (totalPages === 2) return idx === 0 ? 'Front' : 'Back';
    if (printSides === 'both') {
      if (idx === 0) return 'Front (Page 1)';
      if (idx === 1) return 'Back (Page 2)';
    }
    return `Page ${idx + 1}`;
  };

  if (!isOpen) return null;

  const handleZoomIn = () => setPreviewZoom((z) => Math.min(Number((z * 1.25).toFixed(3)), 3.0));
  const handleZoomOut = () => setPreviewZoom((z) => Math.max(Number((z / 1.25).toFixed(3)), 0.05));
  const handleFitScreen = () => setPreviewZoom(baseFitZoom);
  const handleActualSize = () => setPreviewZoom(1.0);

  // Spread pages
  const leftPageIndex = currentSpreadIndex * 2;
  const rightPageIndex = currentSpreadIndex * 2 + 1;
  const leftPageUrl = getPageUrl(leftPageIndex);
  const rightPageUrl = rightPageIndex < totalPages ? getPageUrl(rightPageIndex) : null;

  // 3D pair pages
  const pair3dFrontIdx = selected3dPairIndex * 2;
  const pair3dBackIdx = selected3dPairIndex * 2 + 1;
  const front3dUrl = getPageUrl(pair3dFrontIdx);
  const back3dUrl = pair3dBackIdx < totalPages ? getPageUrl(pair3dBackIdx) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0 gap-4">
        {/* Left: Title & Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 truncate">
              <span>Presentation Studio</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                {documentSettings.width} × {documentSettings.height} {documentSettings.unit} ({totalPages} {totalPages === 1 ? 'Page' : 'Pages'})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 font-semibold border border-emerald-800/60 flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>300 DPI Print Clarity</span>
              </span>
            </h2>
            <p className="text-xs text-slate-400 truncate">
              Vector print proof quality • Two-page spreads, trimmed commercial print, and full bleed sheet
            </p>
          </div>
        </div>

        {/* Center: View Modes Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            {/* 3D Real Mockup */}
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rotate3d className="w-3.5 h-3.5" />
              <span>3D Real Mockup</span>
            </button>

            {/* Two Pages (Spread / Side-by-Side) */}
            <button
              type="button"
              onClick={() => setViewMode('spread')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'spread'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Preview two pages side by side"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Two Pages (Spread)</span>
            </button>

            {/* Single Trimmed Cut */}
            <button
              type="button"
              onClick={() => setViewMode('trimmed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'trimmed'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Trimmed Cut</span>
            </button>

            {/* Full Bleed Sheet */}
            <button
              type="button"
              onClick={() => setViewMode('bleed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'bleed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full Bleed</span>
            </button>

            {/* All Pages Grid */}
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="View all pages in a gallery grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All Pages ({totalPages})</span>
            </button>
          </div>

          {/* 2D Zoom Controls */}
          {viewMode !== '3d' && viewMode !== 'grid' && (
            <div className="flex items-center bg-slate-800/90 rounded-xl border border-slate-700 p-1 text-xs">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFitScreen}
                className="px-2 font-mono text-slate-300 font-medium hover:text-sky-400 transition cursor-pointer"
                title="Click to Fit Screen"
              >
                {Math.round((previewZoom / baseFitZoom) * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFitScreen}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition border-l border-slate-700 ml-1 pl-2 cursor-pointer"
                title="Fit to Screen"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleActualSize}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="100% Actual Size"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Close */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="Close Preview (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sub-Header: Secondary Navigation Controls based on active mode */}
      <div className="h-11 px-6 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between shrink-0 text-xs">
        {/* Mode-specific secondary navigator */}
        {viewMode === '3d' && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">3D Mockup Model:</span>
            {totalSpreads > 1 ? (
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSpreads }).map((_, sIdx) => {
                  const p1 = sIdx * 2 + 1;
                  const p2 = sIdx * 2 + 2;
                  const isCur = selected3dPairIndex === sIdx;
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setSelected3dPairIndex(sIdx)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                        isCur
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {sIdx === 0 ? 'Front & Back (Pages 1 & 2)' : `Pages ${p1} & ${p2 <= totalPages ? p2 : 'Blank'}`}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-slate-300 font-semibold bg-slate-800/70 px-2 py-0.5 rounded-md border border-slate-700">
                Front & Back Sides
              </span>
            )}
            <span className="text-[11px] text-slate-500 ml-2">
              (Click and drag to rotate in 3D • Flip with animation)
            </span>
          </div>
        )}

        {viewMode === 'spread' && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Two-Page Spread:</span>
              <button
                type="button"
                disabled={currentSpreadIndex === 0}
                onClick={() => setCurrentSpreadIndex((s) => Math.max(0, s - 1))}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Spread"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSpreads }).map((_, sIdx) => {
                  const p1 = sIdx * 2 + 1;
                  const p2 = sIdx * 2 + 2;
                  const isCur = currentSpreadIndex === sIdx;
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setCurrentSpreadIndex(sIdx)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                        isCur
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {sIdx === 0 ? 'Pages 1 & 2 (Front & Back)' : `Pages ${p1} & ${p2 <= totalPages ? p2 : 'Blank'}`}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={currentSpreadIndex >= totalSpreads - 1}
                onClick={() => setCurrentSpreadIndex((s) => Math.min(totalSpreads - 1, s + 1))}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Next Spread"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-slate-400 text-xs">
              Showing Spread {currentSpreadIndex + 1} of {totalSpreads}
            </div>
          </div>
        )}

        {(viewMode === 'trimmed' || viewMode === 'bleed') && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Select Page:</span>
              <button
                type="button"
                disabled={selectedPageIndex === 0}
                onClick={() => setSelectedPageIndex((p) => Math.max(0, p - 1))}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[65vw] custom-scrollbar py-0.5">
                {displayPages.map((_, pIdx) => {
                  const isCur = selectedPageIndex === pIdx;
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setSelectedPageIndex(pIdx)}
                      className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 cursor-pointer ${
                        isCur
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {getPageLabel(pIdx)}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={selectedPageIndex >= totalPages - 1}
                onClick={() => setSelectedPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-slate-400 text-xs">
              Page {selectedPageIndex + 1} of {totalPages} ({viewMode === 'trimmed' ? 'Trimmed Cut' : 'Full Bleed'})
            </div>
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="flex items-center justify-between w-full">
            <span className="text-slate-400">
              Gallery Overview • Click any page to preview individually or view as a spread
            </span>
            <span className="font-semibold text-amber-400">{totalPages} Total Pages</span>
          </div>
        )}
      </div>

      {/* Main Preview Content Body */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black relative"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-9 h-9 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium">Generating crystal-clear presentation...</p>
          </div>
        ) : (
          (() => {
            /* 1. 3D INTERACTIVE PRESENTATION VIEW */
            if (viewMode === '3d') {
              return (
                <Artwork3DViewer
                  previewUrl={front3dUrl}
                  backPreviewUrl={back3dUrl}
                  documentSettings={documentSettings}
                  dimensions={dimensions}
                />
              );
            }

            /* 2. TWO PAGES SPREAD (Side by Side) */
            if (viewMode === 'spread') {
              return (
                <div className="w-full h-full overflow-auto flex flex-col items-center justify-center p-8 custom-scrollbar">
                  <div
                    className="transition-transform duration-150 ease-out origin-center flex flex-col items-center gap-4"
                    style={{
                      transform: `scale(${previewZoom})`,
                    }}
                  >
                    {/* The 2-Page Side-by-Side Spread Container */}
                    <div className="flex items-center gap-3">
                      {/* Left Page (Page 2k + 1) */}
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xs font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                          {getPageLabel(leftPageIndex)}
                        </span>
                        <div
                          className="relative bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden rounded-xs ring-1 ring-white/10"
                          style={{
                            width: `${trimWidthPx}px`,
                            height: `${trimHeightPx}px`,
                          }}
                        >
                          {leftPageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={leftPageUrl}
                              alt={getPageLabel(leftPageIndex)}
                              className="block max-w-none select-none pointer-events-none absolute"
                              style={{
                                width: `${totalWidthPx}px`,
                                height: `${totalHeightPx}px`,
                                top: `-${bleedPx}px`,
                                left: `-${bleedPx}px`,
                                imageRendering: '-webkit-optimize-contrast',
                              }}
                            />
                          ) : (
                            <div className="h-full w-full bg-white flex items-center justify-center text-slate-300 text-xs">
                              Blank Page
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Subtle spine divider */}
                      <div className="h-32 w-px bg-slate-700/60 shadow-sm" />

                      {/* Right Page (Page 2k + 2) */}
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xs font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                          {rightPageIndex < totalPages ? getPageLabel(rightPageIndex) : 'End of Document'}
                        </span>
                        <div
                          className="relative bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden rounded-xs ring-1 ring-white/10"
                          style={{
                            width: `${trimWidthPx}px`,
                            height: `${trimHeightPx}px`,
                          }}
                        >
                          {rightPageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rightPageUrl}
                              alt={getPageLabel(rightPageIndex)}
                              className="block max-w-none select-none pointer-events-none absolute"
                              style={{
                                width: `${totalWidthPx}px`,
                                height: `${totalHeightPx}px`,
                                top: `-${bleedPx}px`,
                                left: `-${bleedPx}px`,
                                imageRendering: '-webkit-optimize-contrast',
                              }}
                            />
                          ) : (
                            <div className="h-full w-full bg-slate-900/50 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-xs gap-1">
                              <span>No Page</span>
                              <span className="text-[10px] text-slate-600">Single side</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            /* 3. ALL PAGES GRID VIEW */
            if (viewMode === 'grid') {
              return (
                <div className="w-full h-full overflow-y-auto p-8 custom-scrollbar">
                  <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {displayPages.map((_, idx) => {
                      const pUrl = getPageUrl(idx);
                      const isLeftOfSpread = idx % 2 === 0;

                      return (
                        <div
                          key={idx}
                          className="group relative flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-850 transition shadow-lg"
                        >
                          {/* Card Thumbnail */}
                          <div
                            onClick={() => {
                              setSelectedPageIndex(idx);
                              setViewMode('trimmed');
                            }}
                            className="relative w-full aspect-[3/2] bg-white rounded-lg overflow-hidden shadow-md cursor-pointer border border-slate-700/80 group-hover:ring-2 group-hover:ring-blue-500/40 transition"
                          >
                            {pUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={pUrl}
                                alt={getPageLabel(idx)}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                                Blank
                              </div>
                            )}

                            {/* Badge */}
                            <div className="absolute left-2 top-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-700">
                              #{idx + 1}
                            </div>
                          </div>

                          {/* Info & Action Buttons */}
                          <div className="flex items-center justify-between w-full px-1">
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {getPageLabel(idx)}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPageIndex(idx);
                                  setViewMode('trimmed');
                                }}
                                className="px-2 py-1 text-[10px] font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white transition flex items-center gap-1 cursor-pointer"
                                title="Inspect single page"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentSpreadIndex(Math.floor(idx / 2));
                                  setViewMode('spread');
                                }}
                                className="px-2 py-1 text-[10px] font-semibold rounded bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white transition flex items-center gap-1 border border-blue-500/30 cursor-pointer"
                                title="Open in 2-page spread"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>{isLeftOfSpread ? 'Spread' : 'Spread'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            /* 4. SINGLE PAGE: TRIMMED OR FULL BLEED SHEET */
            const current2dUrl = getPageUrl(selectedPageIndex);

            return (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-8 custom-scrollbar">
                <div
                  className="transition-transform duration-150 ease-out origin-center flex items-center justify-center"
                  style={{
                    transform: `scale(${previewZoom})`,
                  }}
                >
                  {viewMode === 'trimmed' ? (
                    /* Trimmed Cut Mode */
                    <div
                      className="relative bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden rounded-xs ring-1 ring-white/10"
                      style={{
                        width: `${trimWidthPx}px`,
                        height: `${trimHeightPx}px`,
                      }}
                    >
                      {current2dUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={current2dUrl}
                          alt={getPageLabel(selectedPageIndex)}
                          className="block max-w-none select-none pointer-events-none absolute"
                          style={{
                            width: `${totalWidthPx}px`,
                            height: `${totalHeightPx}px`,
                            top: `-${bleedPx}px`,
                            left: `-${bleedPx}px`,
                            imageRendering: '-webkit-optimize-contrast',
                          }}
                        />
                      ) : (
                        <div className="h-full w-full bg-white flex items-center justify-center text-slate-300 text-xs">
                          Blank Page
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Full Bleed Sheet Mode */
                    <div
                      className="relative bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden rounded-xs ring-1 ring-white/20"
                      style={{
                        width: `${totalWidthPx}px`,
                        height: `${totalHeightPx}px`,
                      }}
                    >
                      {current2dUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={current2dUrl}
                          alt={getPageLabel(selectedPageIndex)}
                          className="block max-w-none select-none pointer-events-none"
                          style={{
                            width: `${totalWidthPx}px`,
                            height: `${totalHeightPx}px`,
                            imageRendering: '-webkit-optimize-contrast',
                          }}
                        />
                      ) : (
                        <div className="h-full w-full bg-white flex items-center justify-center text-slate-300 text-xs">
                          Blank Page
                        </div>
                      )}

                      {/* Clean Commercial Trim Cut Marks on Full Bleed Sheet */}
                      {bleedPx > 0 && (
                        <div
                          className="absolute pointer-events-none border border-red-500/80 border-dashed"
                          style={{
                            top: `${bleedPx}px`,
                            left: `${bleedPx}px`,
                            width: `${trimWidthPx}px`,
                            height: `${trimHeightPx}px`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};

export default ArtworkPreviewModal;
