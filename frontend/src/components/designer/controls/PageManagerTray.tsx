'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, Copy, Layers, Eye } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { renderCanvasJsonToThumbnail } from '../utils/canvasThumbnail';

export interface PageData {
  id: string;
  thumbnail: string | null;
  canvasJson: Record<string, any>;
}

interface PageManagerTrayProps {
  pages: PageData[];
  activePageIndex: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onUpdatePageThumbnail?: (index: number, thumb: string) => void;
  canvasManager: CanvasManager | null;
  printSides?: string;
  sideNames?: string[];
  onOpenPreview?: () => void;
  onApplyDesignToBack?: () => void;
}

export const PageManagerTray: React.FC<PageManagerTrayProps> = ({
  pages,
  activePageIndex,
  onPageSelect,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onUpdatePageThumbnail,
  canvasManager,
  printSides = 'both',
  sideNames,
  onOpenPreview,
  onApplyDesignToBack,
}) => {
  // Store real-time live thumbnails for all pages
  const [liveThumbnails, setLiveThumbnails] = useState<Record<number, string>>({});
  const activePageIndexRef = useRef(activePageIndex);
  activePageIndexRef.current = activePageIndex;

  const onUpdatePageThumbnailRef = useRef(onUpdatePageThumbnail);
  onUpdatePageThumbnailRef.current = onUpdatePageThumbnail;

  // Initialize and synchronize thumbnails from incoming `pages` prop
  useEffect(() => {
    pages.forEach((page, idx) => {
      if (page.thumbnail) {
        setLiveThumbnails((prev) => {
          if (prev[idx] === page.thumbnail) return prev;
          return { ...prev, [idx]: page.thumbnail! };
        });
      } else if (
        page.canvasJson &&
        (page.canvasJson.objects?.length > 0 || page.canvasJson.background)
      ) {
        // Automatically render thumbnail from canvas JSON offscreen
        void renderCanvasJsonToThumbnail(page.canvasJson, 320, 200).then((thumb) => {
          if (thumb) {
            setLiveThumbnails((prev) => ({ ...prev, [idx]: thumb }));
            onUpdatePageThumbnailRef.current?.(idx, thumb);
          }
        });
      }
    });
  }, [pages]);

  // Real-time canvas listener: continuously updates active page thumbnail on any canvas modification
  useEffect(() => {
    if (!canvasManager) return;
    let isMounted = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleThumbUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const cv = canvasManager.getCanvas();
          if (!cv || (cv as any)._currentTransform) {
            // Do not capture thumbnail during user drag or transform
            return;
          }
          const currentIdx = activePageIndexRef.current;
          const dataUrl = await canvasManager.getCleanPreviewDataUrl(0.35);
          if (dataUrl && isMounted) {
            setLiveThumbnails((prev) => ({ ...prev, [currentIdx]: dataUrl }));
            onUpdatePageThumbnailRef.current?.(currentIdx, dataUrl);
          }
        } catch {
          // Ignore preview snapshot error
        }
      }, 300);
    };

    const fabric = canvasManager.getCanvas();
    if (fabric) {
      const events = [
        'object:modified',
        'object:added',
        'object:removed',
        'text:changed',
        'path:created',
        'canvas:cleared',
        'template:loaded',
      ];

      events.forEach((ev) => fabric.on(ev as any, scheduleThumbUpdate));
      scheduleThumbUpdate();

      return () => {
        isMounted = false;
        if (debounceTimer) clearTimeout(debounceTimer);
        events.forEach((ev) => fabric.off(ev as any, scheduleThumbUpdate));
      };
    }
  }, [canvasManager]);

  // Derive human-friendly labels (Front, Back, Page 1, Page 2, etc.)
  const getPageLabel = useCallback(
    (idx: number): string => {
      if (sideNames && sideNames[idx]) {
        return sideNames[idx];
      }
      if (pages.length === 1) {
        return 'Front';
      }
      if (pages.length === 2) {
        return idx === 0 ? 'Front' : 'Back';
      }
      if (printSides === 'both') {
        if (idx === 0) return 'Front';
        if (idx === 1) return 'Back';
      }
      return `Page ${idx + 1}`;
    },
    [pages.length, printSides, sideNames]
  );

  const displayPages = useMemo(() => {
    if (pages.length > 0) return pages;
    return [
      {
        id: 'page-front-default',
        thumbnail: null,
        canvasJson: {},
      },
    ];
  }, [pages]);

  return (
    <div className="absolute right-4 top-1/2 z-30 -translate-y-1/2 flex flex-col items-center">
      {/* Container card with backdrop blur and sleek borders */}
      <div className="flex max-h-[78vh] flex-col items-center gap-3 overflow-y-auto px-2 py-3 custom-scrollbar bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/90 shadow-xl select-none">
        {/* Tray Header */}
        <div className="flex items-center justify-between w-full px-1 border-b border-gray-100 pb-1.5">
          <div className="flex items-center gap-1.5 text-gray-700">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
              Pages
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-400 font-bold bg-gray-100 px-1.5 py-0.5 rounded-full">
            {displayPages.length}
          </span>
        </div>

        {/* Pages List */}
        <div className="flex flex-col items-center gap-3">
          {displayPages.map((page, idx) => {
            const isActive = activePageIndex === idx;
            const label = getPageLabel(idx);
            const thumbSrc = liveThumbnails[idx] || page.thumbnail;
            const isFront = idx === 0;

            return (
              <div
                key={page.id || idx}
                className="group relative flex flex-col items-center gap-1.5"
              >
                {/* Thumbnail card */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onPageSelect(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPageSelect(idx);
                    }
                  }}
                  className={`relative flex h-[84px] w-[124px] items-center justify-center overflow-hidden rounded-lg bg-white transition-all cursor-pointer ${
                    isActive
                      ? 'border-2 border-sky-500 shadow-md ring-2 ring-sky-500/20'
                      : 'border-2 border-gray-200 hover:border-gray-400 shadow-2xs'
                  }`}
                  title={`Switch to ${label}`}
                >
                  {thumbSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbSrc}
                      alt={label}
                      draggable={false}
                      className="pointer-events-none h-full w-full select-none object-contain p-0.5"
                    />
                  ) : (
                    <div className="h-full w-full bg-white flex items-center justify-center text-[10px] text-gray-300">
                      Blank
                    </div>
                  )}

                  {/* Active Page Marker Indicator */}
                  {isActive && (
                    <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                      <span>{idx + 1}</span>
                    </div>
                  )}

                  {/* Non-active index badge */}
                  {!isActive && (
                    <div className="absolute left-1.5 top-1.5 rounded bg-gray-900/60 px-1.5 py-0.5 text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>{idx + 1}</span>
                    </div>
                  )}

                  {/* Hover Actions Overlay: Duplicate & Delete */}
                  <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-xs rounded-md p-0.5 shadow-sm border border-gray-200">
                    {/* Duplicate Page Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicatePage(idx);
                      }}
                      className="p-1 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded transition"
                      title="Duplicate page"
                    >
                      <Copy className="w-3 h-3" />
                    </button>

                    {/* Delete Page Button */}
                    {displayPages.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePage(idx);
                        }}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete page"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Page Label */}
                <div className="flex items-center justify-center gap-1 w-full">
                  <span
                    className={`text-[11px] leading-tight transition ${
                      isActive
                        ? 'font-bold text-sky-600'
                        : 'font-medium text-gray-700 group-hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </span>
                </div>

                {/* "Apply this design to back page" Button (shown on Front page card) */}
                {isFront && onApplyDesignToBack && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onApplyDesignToBack();
                    }}
                    title="Copy and apply front-page design to back page"
                    className="flex items-center justify-center gap-1.5 w-[124px] py-1 px-1.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-bold shadow-2xs transition active:scale-95 cursor-pointer"
                  >
                    <Copy className="w-3 h-3 text-sky-600 shrink-0" />
                    <span className="truncate">Apply to Back</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Canva-like "Add Page" Button */}
        <div className="w-full pt-1 border-t border-gray-100 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onAddPage}
            className="flex items-center justify-center gap-1.5 w-[124px] py-2 px-2 rounded-xl border-2 border-dashed border-gray-300 hover:border-sky-500 hover:bg-sky-50/60 text-gray-600 hover:text-sky-700 transition cursor-pointer shadow-2xs group"
            title="Add a new blank page with matching dimensions and bleed settings"
          >
            <Plus className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-600 transition" />
            <span className="text-[11px] font-semibold">Add page</span>
          </button>

          {/* Quick Preview Toggle if handler provided */}
          {onOpenPreview && (
            <button
              type="button"
              onClick={onOpenPreview}
              className="flex items-center justify-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-700 py-0.5 transition"
              title="Preview all artwork pages"
            >
              <Eye className="w-3 h-3" />
              <span>Preview all</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageManagerTray;
