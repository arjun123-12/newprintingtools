'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
}

export const PageManagerTray: React.FC<PageManagerTrayProps> = ({
  pages,
  activePageIndex,
  onPageSelect,
  onUpdatePageThumbnail,
  canvasManager,
  printSides = 'both',
  sideNames,
}) => {
  // Store real-time live thumbnails for all pages
  const [liveThumbnails, setLiveThumbnails] = useState<Record<number, string>>({});
  const activePageIndexRef = useRef(activePageIndex);
  activePageIndexRef.current = activePageIndex;

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
            onUpdatePageThumbnail?.(idx, thumb);
          }
        });
      }
    });
  }, [pages, onUpdatePageThumbnail]);

  // Real-time canvas listener: continuously updates active page thumbnail on any canvas modification
  useEffect(() => {
    if (!canvasManager) return;
    let isMounted = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleThumbUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const currentIdx = activePageIndexRef.current;
          const dataUrl = await canvasManager.getCleanPreviewDataUrl(0.35);
          if (dataUrl && isMounted) {
            setLiveThumbnails((prev) => ({ ...prev, [currentIdx]: dataUrl }));
            onUpdatePageThumbnail?.(currentIdx, dataUrl);
          }
        } catch {
          // Ignore preview snapshot error
        }
      }, 120);
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
      // Trigger initial snapshot
      scheduleThumbUpdate();

      return () => {
        isMounted = false;
        if (debounceTimer) clearTimeout(debounceTimer);
        events.forEach((ev) => fabric.off(ev as any, scheduleThumbUpdate));
      };
    }
  }, [canvasManager, activePageIndex, onUpdatePageThumbnail]);

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
    <div className="absolute right-5 top-1/2 z-30 -translate-y-1/2">
      <div className="flex max-h-[60vh] flex-col items-center gap-5 overflow-y-auto px-1 py-2 custom-scrollbar">
        {displayPages.map((page, idx) => {
          const isActive = activePageIndex === idx;
          const label = getPageLabel(idx);
          const thumbSrc = liveThumbnails[idx] || page.thumbnail;

          return (
            <button
              key={page.id || idx}
              type="button"
              onClick={() => onPageSelect(idx)}
              className="group flex flex-col items-center gap-1.5"
              title={`Switch to ${label}`}
            >
              <div
                className={`relative flex h-[44px] w-[72px] items-center justify-center overflow-hidden rounded-[3px] bg-white transition-colors ${isActive
                    ? 'border-2 border-sky-500'
                    : 'border-2 border-gray-300 hover:border-gray-500'
                  }`}
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
                  <div className="h-full w-full bg-white" />
                )}

                {isActive && (
                  <div className="absolute left-0 top-0 h-2.5 w-2.5 bg-sky-500">
                    <div className="absolute left-0 top-0 h-1.5 w-1.5 bg-red-500" />
                  </div>
                )}
              </div>

              <span
                className={`text-[12px] leading-none ${isActive
                    ? 'font-semibold text-black dark:text-white'
                    : 'font-normal text-gray-800 group-hover:text-black dark:text-gray-200 dark:group-hover:text-white'
                  }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PageManagerTray;
