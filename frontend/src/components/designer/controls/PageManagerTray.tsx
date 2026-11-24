'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { renderCanvasJsonToThumbnail } from '../utils/canvasThumbnail';

export interface PageData {
  id: string;
  thumbnail: string | null;
  canvasJson: Record<string, any>;
  side?: string;
  name?: string;
}

interface PageManagerTrayProps {
  pages: PageData[];
  activePageIndex: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  canAddPage?: boolean;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onUpdatePageThumbnail?: (index: number, thumb: string) => void;
  canvasManager: CanvasManager | null;
  printSides?: string;
  sideNames?: string[];
  onApplyDesignToBack?: () => void;
}

export const PageManagerTray: React.FC<PageManagerTrayProps> = ({
  pages,
  activePageIndex,
  onPageSelect,
  onAddPage,
  canAddPage = pages.length < 2,
  onDuplicatePage,
  onDeletePage,
  onUpdatePageThumbnail,
  canvasManager,
  printSides = 'both',
  sideNames,
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
    let cancelled = false;
    const pagesNeedingThumbnails: Array<{ page: PageData; index: number }> = [];

    pages.forEach((page, idx) => {
      if (page.thumbnail) {
        setLiveThumbnails((prev) => {
          if (prev[idx] === page.thumbnail) return prev;
          return { ...prev, [idx]: page.thumbnail! };
        });
      } else if (
        // The active page is captured from the live canvas below. Rendering it
        // again from JSON during startup competes with the editor's first paint.
        idx !== activePageIndex &&
        page.canvasJson &&
        (page.canvasJson.objects?.length > 0 || page.canvasJson.background)
      ) {
        pagesNeedingThumbnails.push({ page, index: idx });
      }
    });

    // Defer non-active page previews until after the initial editor paint and
    // render them one at a time so large documents do not create a startup burst.
    let nextPageTimer: ReturnType<typeof setTimeout> | null = null;
    const renderNextThumbnail = async (position: number) => {
      if (cancelled || position >= pagesNeedingThumbnails.length) return;

      const { page, index } = pagesNeedingThumbnails[position];
      const thumb = await renderCanvasJsonToThumbnail(page.canvasJson, 320, 200);
      if (!cancelled && thumb) {
        setLiveThumbnails((prev) => ({ ...prev, [index]: thumb }));
        onUpdatePageThumbnailRef.current?.(index, thumb);
      }

      if (!cancelled && position + 1 < pagesNeedingThumbnails.length) {
        nextPageTimer = setTimeout(() => {
          void renderNextThumbnail(position + 1);
        }, 100);
      }
    };

    if (pagesNeedingThumbnails.length > 0) {
      nextPageTimer = setTimeout(() => {
        void renderNextThumbnail(0);
      }, 1000);
    }

    return () => {
      cancelled = true;
      if (nextPageTimer) clearTimeout(nextPageTimer);
    };
  }, [pages, activePageIndex]);

  // Refresh the active thumbnail when artwork changes. The save path shares this snapshot.
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
          const dataUrl = await canvasManager.getPageThumbnail();
          if (dataUrl && isMounted && currentIdx === activePageIndexRef.current) {
            setLiveThumbnails((prev) => ({ ...prev, [currentIdx]: dataUrl }));
            onUpdatePageThumbnailRef.current?.(currentIdx, dataUrl);
          }
        } catch {
          // Ignore preview snapshot error
        }
      }, 300);
    };

    const unsubscribe = canvasManager.onChange(scheduleThumbUpdate);
    scheduleThumbUpdate();

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
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
    <section
      aria-label="Artwork pages"
      className="min-w-0 max-w-full select-none"
    >
      <div className="custom-scrollbar flex items-start gap-2 overflow-x-auto px-1 py-1">
        {displayPages.map((page, idx) => {
          const isActive = activePageIndex === idx;
          const label = getPageLabel(idx);
          const thumbSrc = liveThumbnails[idx] || page.thumbnail;

          return (
            <div key={page.id || idx} className="group w-[88px] shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => onPageSelect(idx)}
                  aria-label={`Switch to ${label}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-[54px] w-full items-center justify-center overflow-hidden rounded-lg border-2 bg-slate-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${isActive
                    ? 'border-violet-600'
                    : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {thumbSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbSrc}
                      alt=""
                      draggable={false}
                      className="pointer-events-none h-full w-full object-contain p-0.5"
                    />
                  )}
                </button>

                <div className="absolute right-1 top-0.5 flex h-6 items-center gap-0.5 rounded-md border border-slate-200 bg-white p-px shadow-sm transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => onDuplicatePage(idx)}
                    className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    aria-label={`Duplicate ${label}`}
                    title="Duplicate page"
                  >
                    <Copy aria-hidden="true" className="h-3 w-3" />
                  </button>
                  {displayPages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeletePage(idx)}
                      className="rounded p-1 text-slate-600 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Delete ${label}`}
                      title="Delete page"
                    >
                      <Trash2 aria-hidden="true" className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className={`mt-1 truncate text-center text-[11px] font-medium ${isActive ? 'text-violet-700' : 'text-slate-600'}`} title={label}>
                {label}
              </div>

              {idx === 0 && onApplyDesignToBack && (
                <button
                  type="button"
                  onClick={onApplyDesignToBack}
                  title="Copy and apply front-page design to back page"
                  className="mt-0.5 w-full rounded px-0.5 py-1 text-center text-[10px] font-medium text-violet-700 hover:bg-violet-50"
                >
                  Apply to Back
                </button>
              )}
            </div>
          );
        })}

        {canAddPage && (
          <button
            type="button"
            onClick={onAddPage}
            aria-label="Add page"
            title="Add a new blank page"
            className="flex h-[54px] w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-600 transition-colors hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
};

export default PageManagerTray;
