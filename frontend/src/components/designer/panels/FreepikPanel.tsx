'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  Check,
  Wallpaper,
  X,
  Sparkles,
  ZoomIn,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import {
  freepikService,
  FreepikAsset,
} from '@/services/freepikService';

interface FreepikPanelProps {
  canvasManager: CanvasManager | null;
}

type FreepikMediaType = 'all' | 'photo' | 'vector' | 'icon';

type HighResolutionFreepikAsset = FreepikAsset & {
  original_url?: string;
  download_url?: string;
  full_url?: string;
  image_url?: string;
  url?: string;
  width?: number;
  height?: number;

  original?: {
    url?: string;
    width?: number;
    height?: number;
  };

  image?: {
    url?: string;
    width?: number;
    height?: number;
    source?: {
      url?: string;
    };
  };

  files?: Array<{
    url?: string;
    download_url?: string;
    width?: number;
    height?: number;
  }>;
};

type UsedFreepikAsset = {
  url?: string;
  original_url?: string;
  download_url?: string;
  file_url?: string;
  width?: number;
  height?: number;
};

const isUsableImageUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !/\.html?(\?.*)?$/i.test(value.trim());

/**
 * Return the largest/original source supplied by the API.
 * Thumbnail and preview URLs are deliberately only the final fallbacks.
 */
const getOriginalAssetUrl = (asset: FreepikAsset): string => {
  const item = asset as HighResolutionFreepikAsset;

  const largestFile = [...(item.files || [])]
    .filter((file) =>
      isUsableImageUrl(file.download_url || file.url)
    )
    .sort(
      (a, b) =>
        (Number(b.width) || 0) * (Number(b.height) || 0) -
        (Number(a.width) || 0) * (Number(a.height) || 0)
    )[0];

  const candidates = [
    item.original_url,
    item.download_url,
    item.full_url,
    item.original?.url,
    largestFile?.download_url,
    largestFile?.url,
    item.image?.source?.url,
    item.image?.url,
    item.image_url,
    asset.preview_url,
    asset.thumbnail_url,
  ];

  const chosen = candidates.find(isUsableImageUrl) || '';

  return chosen.startsWith('http://')
    ? chosen.replace('http://', 'https://')
    : chosen;
};

const getAssetDimensions = (
  asset: FreepikAsset
): {
  width?: number;
  height?: number;
} => {
  const item = asset as HighResolutionFreepikAsset;

  const largestFile = [...(item.files || [])].sort(
    (a, b) =>
      (Number(b.width) || 0) * (Number(b.height) || 0) -
      (Number(a.width) || 0) * (Number(a.height) || 0)
  )[0];

  const width =
    Number(item.original?.width) ||
    Number(largestFile?.width) ||
    Number(item.image?.width) ||
    Number(item.width) ||
    undefined;

  const height =
    Number(item.original?.height) ||
    Number(largestFile?.height) ||
    Number(item.image?.height) ||
    Number(item.height) ||
    undefined;

  return {
    width,
    height,
  };
};

const getStoredAssetUrl = (data: unknown): string => {
  if (!data || typeof data !== 'object') return '';

  const item = data as UsedFreepikAsset;

  return (
    [
      item.original_url,
      item.download_url,
      item.file_url,
      item.url,
    ].find(isUsableImageUrl) || ''
  );
};

const QUICK_SEARCH_CHIPS = [
  'background',
  'business',
  'pattern',
  'nature',
  'banner',
  'flyer',
  'flower',
  'technology',
  'food',
  'abstract',
  'mockup',
];

export const FreepikPanel: React.FC<FreepikPanelProps> = ({
  canvasManager,
}) => {
  /**
   * Default view = nature photos
   */
  const [query, setQuery] = useState('nature');
  const [debouncedQuery, setDebouncedQuery] = useState('nature');

  const [mediaType, setMediaType] =
    useState<FreepikMediaType>('all');

  const [images, setImages] = useState<FreepikAsset[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasNext, setHasNext] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] =
    useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  const [isInserting, setIsInserting] =
    useState<string | null>(null);

  const [insertSuccess, setInsertSuccess] =
    useState<string | null>(null);

  const [previewAsset, setPreviewAsset] =
    useState<FreepikAsset | null>(null);

  /**
   * Debounce search input
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 380);

    return () => clearTimeout(timer);
  }, [query]);

  /**
   * Search Freepik media
   *
   * IMPORTANT:
   * "All" is intentionally treated as:
   * nature + photo
   *
   * This prevents All from returning mixed/unorganized
   * vectors/icons/other assets.
   */
  const fetchFreepikMedia = useCallback(
    async (
      pageToLoad: number,
      append: boolean = false
    ) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        /**
         * If query is empty, use nature.
         */
        const searchQuery =
          debouncedQuery.trim() || 'nature';

        /**
         * All = nature photos only.
         *
         * Other tabs use the selected media type.
         */
        const searchMediaType: FreepikMediaType =
          mediaType === 'all'
            ? 'photo'
            : mediaType;

        const response =
          await freepikService.search(
            searchQuery,
            pageToLoad,
            24,
            searchMediaType
          );

        if (
          response.success &&
          response.data
        ) {
          const fetchedItems =
            response.data.items || [];

          if (append) {
            setImages((prev) => [
              ...prev,
              ...fetchedItems,
            ]);
          } else {
            setImages(fetchedItems);
          }

          setHasNext(
            Boolean(
              response.data.pagination?.has_next
            )
          );

          setTotalItems(
            (prevTotal) =>
              response.data.pagination
                ?.total_items ??
              (append
                ? prevTotal +
                fetchedItems.length
                : fetchedItems.length)
          );
        } else {
          if (!append) {
            setImages([]);
          }

          setHasNext(false);
          setTotalItems(0);
        }
      } catch (err: any) {
        console.error(
          'Freepik media search failed:',
          err
        );

        setError(
          err?.message ||
          'Failed to search Freepik media library.'
        );

        if (!append) {
          setImages([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, mediaType]
  );

  /**
   * Trigger search whenever query/filter changes.
   */
  useEffect(() => {
    setPage(1);
    fetchFreepikMedia(1, false);
  }, [fetchFreepikMedia]);

  /**
   * Load next page.
   */
  const handleLoadMore = () => {
    if (
      loadingMore ||
      loading ||
      !hasNext
    ) {
      return;
    }

    const nextPage = page + 1;

    setPage(nextPage);

    fetchFreepikMedia(
      nextPage,
      true
    );
  };

  /**
   * Add image onto canvas.
   *
   * CLICK = add as a normal image on the artwork.
   * It must NOT automatically fill a selected shape/frame.
   * Shape/frame filling is reserved for drag-hover/drop handling in CanvasManager.
   */
  const handleAddToCanvas = async (
    asset: FreepikAsset
  ) => {
    if (!canvasManager) return;

    setError(null);
    setIsInserting(asset.id);

    try {
      const originalUrl =
        getOriginalAssetUrl(asset);

      if (!originalUrl) {
        throw new Error(
          'No usable image URL was returned for this asset.'
        );
      }

      let targetUrl = originalUrl;

      /**
       * Ask backend to download and permanently
       * store the original source.
       */
      try {
        const used =
          await freepikService.useAsset(
            asset.id
          );

        const storedUrl =
          getStoredAssetUrl(
            used.data
          );

        if (
          used.success &&
          storedUrl
        ) {
          targetUrl = storedUrl;
        }
      } catch (useErr) {
        console.warn(
          'Using direct original URL for canvas insertion:',
          useErr
        );
      }

      const dimensions =
        getAssetDimensions(asset);

      await canvasManager.addImageFromUrl(
        targetUrl,
        {
          name:
            asset.title ||
            `Freepik-${asset.id}`,

          originalSrc:
            originalUrl,

          naturalWidth:
            dimensions.width,

          naturalHeight:
            dimensions.height,

          provider: 'freepik',

          providerAssetId:
            asset.id,
        },
        {
          // CLICK behavior: always add as a normal image.
          // Never auto-fill the currently selected shape/frame.
          // Shape/frame filling is reserved for drag-hover/drop handling.
          skipFrameSlotting: true,

          /**
           * Freepik click insert must NOT auto-shrink.
           * Keep the decoded source at 1:1 canvas pixel size.
           */
          preserveOriginalSize: true,
        }
      );

      setInsertSuccess(asset.id);

      setTimeout(() => {
        setInsertSuccess(null);
      }, 1500);
    } catch (err) {
      console.error(
        'Failed to add Freepik image to canvas:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to add the original image to the artwork.'
      );
    } finally {
      setIsInserting(null);
    }
  };

  /**
   * Set image as full canvas background.
   */
  const handleSetAsBackground = async (
    asset: FreepikAsset
  ) => {
    if (!canvasManager) return;

    setError(null);
    setIsInserting(asset.id);

    try {
      const originalUrl =
        getOriginalAssetUrl(asset);

      if (!originalUrl) {
        throw new Error(
          'No usable image URL was returned for this asset.'
        );
      }

      let targetUrl = originalUrl;

      try {
        const used =
          await freepikService.useAsset(
            asset.id
          );

        const storedUrl =
          getStoredAssetUrl(
            used.data
          );

        if (
          used.success &&
          storedUrl
        ) {
          targetUrl = storedUrl;
        }
      } catch (useErr) {
        console.warn(
          'Using direct original URL for background:',
          useErr
        );
      }

      await canvasManager.setBackgroundImage(
        targetUrl,
        {
          name:
            asset.title ||
            `Freepik-BG-${asset.id}`,

          fit: 'cover',

          scale: 1.0,

          offsetX: 0,

          offsetY: 0,

          opacity: 1.0,

          blur: 0,
        }
      );

      setInsertSuccess(asset.id);

      setTimeout(() => {
        setInsertSuccess(null);
      }, 1500);
    } catch (err) {
      console.error(
        'Failed to set Freepik background:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to use the original image as the artwork background.'
      );
    } finally {
      setIsInserting(null);
    }
  };

  /**
   * Drag start for dragging directly onto canvas.
   */
  const handleDragStart = (
    e: React.DragEvent,
    asset: FreepikAsset
  ) => {
    const targetUrl =
      getOriginalAssetUrl(asset);

    if (!targetUrl) {
      e.preventDefault();
      return;
    }

    e.dataTransfer.setData(
      'application/x-freepik-id',
      asset.id
    );

    e.dataTransfer.setData(
      'application/x-freepik-url',
      targetUrl
    );

    e.dataTransfer.setData(
      'text/plain',
      targetUrl
    );

    e.dataTransfer.effectAllowed =
      'copy';

    /**
     * Drag image ghost.
     */
    const dragGhost =
      document.createElement('div');

    dragGhost.style.position =
      'absolute';

    dragGhost.style.top =
      '-9999px';

    dragGhost.style.width =
      '80px';

    dragGhost.style.height =
      '80px';

    dragGhost.style.backgroundImage =
      `url(${targetUrl})`;

    dragGhost.style.backgroundSize =
      'cover';

    dragGhost.style.borderRadius =
      '8px';

    dragGhost.style.boxShadow =
      '0 10px 25px rgba(0,0,0,0.2)';

    document.body.appendChild(
      dragGhost
    );

    e.dataTransfer.setDragImage(
      dragGhost,
      40,
      40
    );

    setTimeout(() => {
      if (
        document.body.contains(
          dragGhost
        )
      ) {
        document.body.removeChild(
          dragGhost
        );
      }
    }, 0);
  };

  const displayedAssets = images;

  return (
    <div className="flex flex-col h-full bg-white select-none">

      {/* =========================================
          TOP SEARCH & FILTER BAR
      ========================================= */}
      <div className="p-3.5 border-b border-slate-100 flex flex-col gap-2.5 bg-slate-50/50">

        {/* Brand Banner */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">

            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
              <Sparkles className="w-3 h-3" />
            </span>

            <span>
              Freepik / Magnific Library
            </span>
          </div>

          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
            API Active
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">

          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

          <input
            type="text"
            value={query}
            onChange={(e) =>
              setQuery(e.target.value)
            }
            placeholder="Search millions of photos, vectors, icons..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
          />

          {query && (
            <button
              type="button"
              onClick={() =>
                setQuery('')
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* =========================================
            MEDIA TYPE FILTER TABS
        ========================================= */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs border border-slate-200/70">

          {[
            {
              id: 'all',
              label: 'All',
            },
            {
              id: 'photo',
              label: 'Photos',
            },
            {
              id: 'vector',
              label: 'Vectors',
            },
            {
              id: 'icon',
              label: 'Icons',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                const nextType =
                  tab.id as FreepikMediaType;

                setError(null);
                setImages([]);
                setTotalItems(0);
                setHasNext(false);
                setPage(1);

                /**
                 * IMPORTANT:
                 *
                 * Clicking All always resets
                 * to nature.
                 */
                if (
                  nextType === 'all'
                ) {
                  setQuery('nature');
                }

                setMediaType(
                  nextType
                );
              }}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${mediaType === tab.id
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/[0.03]'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* =========================================
            QUICK SEARCH CHIPS
        ========================================= */}
        {!query && (
          <div className="flex gap-1 overflow-x-auto pb-0.5 custom-scrollbar text-xs">

            {QUICK_SEARCH_CHIPS.map(
              (chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() =>
                    setQuery(chip)
                  }
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-50 border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 whitespace-nowrap transition"
                >
                  #{chip}
                </button>
              )
            )}

          </div>
        )}

        {/* Result Count */}
        <div className="flex items-center justify-end pt-0.5">

          <span className="text-[10px] font-medium text-slate-400">
            {totalItems > 0
              ? `${totalItems.toLocaleString()} results`
              : 'Popular assets'}
          </span>

        </div>
      </div>

      {/* =========================================
          MEDIA GRID CONTENT
      ========================================= */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5">

        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs flex flex-col gap-1.5">

            <span className="font-semibold">
              Freepik request failed:
            </span>

            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                fetchFreepikMedia(
                  1,
                  false
                )
              }
              className="mt-1 self-start px-3 py-1 bg-red-600 text-white rounded-md text-[11px] font-semibold hover:bg-red-700 transition"
            >
              Retry
            </button>

          </div>
        )}

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-2 gap-2">

            {Array.from({
              length: 12,
            }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-gray-100 animate-pulse border border-gray-200/60"
              />
            ))}

          </div>
        ) : displayedAssets.length > 0 ? (
          <>
            {/* =====================================
                2-COLUMN IMAGE GRID

                IMPORTANT:
                - hover = preview/actions
                - click = add normal image to artwork
                - drag/drop = artwork or shape/frame interaction
            ===================================== */}
            <div className="grid grid-cols-2 gap-2">

              {displayedAssets.map(
                (asset) => {
                  const isCurrentInserting =
                    isInserting ===
                    asset.id;

                  const isCurrentSuccess =
                    insertSuccess ===
                    asset.id;

                  const originalUrl =
                    getOriginalAssetUrl(
                      asset
                    );

                  return (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(
                          e,
                          asset
                        )
                      }
                      onClick={() => void handleAddToCanvas(asset)}
                      className="group relative rounded-2xl border border-slate-200/80 bg-slate-100 overflow-hidden cursor-pointer shadow-sm hover:shadow-[0_12px_28px_rgba(37,99,235,0.18)] hover:border-blue-400 hover:-translate-y-0.5 transition-all duration-200 aspect-[4/3] flex items-center justify-center select-none"
                      title={`Click to add ${asset.title || 'image'} to artwork, or drag it onto a shape/frame`}
                    >

                      {/* =================================
                          IMAGE
                      ================================= */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          originalUrl
                        }
                        alt={
                          asset.title ||
                          'Freepik image'
                        }
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                      />

                      {/* =================================
                          INSERTING OVERLAY
                      ================================= */}
                      {isCurrentInserting && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">

                          <div className="flex items-center gap-1.5 rounded-lg bg-black/65 px-3 py-2 text-white text-[10px] font-semibold">

                            <Loader2 className="w-3.5 h-3.5 animate-spin" />

                            <span>
                              Adding…
                            </span>

                          </div>

                        </div>
                      )}

                      {/* =================================
                          SUCCESS OVERLAY
                      ================================= */}
                      {isCurrentSuccess &&
                        !isCurrentInserting && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">

                            <div className="flex items-center gap-1.5 rounded-lg bg-green-600/90 px-3 py-2 text-white text-[10px] font-semibold shadow-lg">

                              <Check className="w-3.5 h-3.5" />

                              <span>
                                Added
                              </span>

                            </div>

                          </div>
                        )}

                      {/* =================================
                          HOVER ACTIONS
                          
                          ONLY:
                          - Background
                          - Preview
                          
                          NO ADD TO CANVAS BUTTON
                      ================================= */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">

                        {/* Top Actions */}
                        <div className="flex items-center justify-end gap-1.5">

                          {/* Background */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();

                              handleSetAsBackground(
                                asset
                              );
                            }}
                            className="flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1.5 text-[9px] font-semibold text-white transition-colors backdrop-blur-md shadow-sm hover:bg-blue-600"
                            title="Set as full background"
                          >
                            <Wallpaper className="w-3 h-3" />

                            <span>
                              Background
                            </span>
                          </button>

                          {/* Preview */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();

                              setPreviewAsset(
                                asset
                              );
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-white transition-colors backdrop-blur-md shadow-sm hover:bg-blue-600"
                            title="Preview image"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

            {/* =====================================
                LOAD MORE
            ===================================== */}
            {hasNext && (
              <div className="mt-4 pb-2 flex justify-center">

                <button
                  type="button"
                  onClick={
                    handleLoadMore
                  }
                  disabled={
                    loadingMore
                  }
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />

                      <span>
                        Loading more...
                      </span>
                    </>
                  ) : (
                    <span>
                      Load more assets
                    </span>
                  )}
                </button>

              </div>
            )}

          </>
        ) : (
          /* =====================================
             EMPTY SEARCH RESULTS
          ===================================== */
          <div className="h-48 flex flex-col items-center justify-center text-center p-4">

            <Search className="w-8 h-8 text-slate-300 mb-2" />

            <span className="text-xs font-semibold text-slate-600">
              No Freepik assets found
            </span>

            <span className="text-[11px] text-slate-400 mt-0.5">
              Try searching for different keywords or clear your query
            </span>

          </div>
        )}

      </div>

      {/* =========================================
          IMAGE PREVIEW MODAL
      ========================================= */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
          onClick={() =>
            setPreviewAsset(null)
          }
        >
          <div
            className="relative flex max-h-[90vh] max-w-4xl items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* Close */}
            <button
              type="button"
              onClick={() =>
                setPreviewAsset(null)
              }
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
              title="Close preview"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Preview Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getOriginalAssetUrl(
                previewAsset
              )}
              alt={
                previewAsset.title ||
                'Freepik image preview'
              }
              className="max-h-[86vh] max-w-full object-contain"
            />

          </div>
        </div>
      )}

    </div>
  );
};