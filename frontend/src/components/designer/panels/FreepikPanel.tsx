'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  Plus,
  Check,
  Wallpaper,
  X,
  Sparkles,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import {
  freepikService,
  FreepikAsset,
} from '@/services/freepikService';

interface FreepikPanelProps {
  canvasManager: CanvasManager | null;
}

type FreepikMediaType = 'all' | 'photo' | 'vector' | 'psd' | 'icon';

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

export const FreepikPanel: React.FC<FreepikPanelProps> = ({ canvasManager }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [mediaType, setMediaType] = useState<FreepikMediaType>('all');

  const [images, setImages] = useState<FreepikAsset[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isInserting, setIsInserting] = useState<string | null>(null);
  const [insertSuccess, setInsertSuccess] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 380);
    return () => clearTimeout(timer);
  }, [query]);

  // Search Freepik media
  const fetchFreepikMedia = useCallback(
    async (pageToLoad: number, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await freepikService.search(
          debouncedQuery,
          pageToLoad,
          24,
          mediaType
        );

        if (response.success && response.data) {
          const fetchedItems = response.data.items || [];
          if (append) {
            setImages((prev) => [...prev, ...fetchedItems]);
          } else {
            setImages(fetchedItems);
          }
          setHasNext(Boolean(response.data.pagination?.has_next));
          setTotalItems(
            response.data.pagination?.total_items ||
              (append ? images.length + fetchedItems.length : fetchedItems.length)
          );
        } else {
          if (!append) setImages([]);
          setHasNext(false);
        }
      } catch (err: any) {
        console.error('Freepik media search failed:', err);
        setError(err.message || 'Failed to search Freepik media library.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, mediaType]
  );

  // Trigger search on filter / query change
  useEffect(() => {
    setPage(1);
    fetchFreepikMedia(1, false);
  }, [fetchFreepikMedia]);

  const handleLoadMore = () => {
    if (loadingMore || loading || !hasNext) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFreepikMedia(nextPage, true);
  };

  // Add image onto canvas
  const handleAddToCanvas = async (asset: FreepikAsset) => {
    if (!canvasManager) return;
    setIsInserting(asset.id);
    try {
      let targetUrl = asset.preview_url;

      // Attempt to download/store permanently via backend
      try {
        const used = await freepikService.useAsset(asset.id, asset.preview_url);
        if (used.success && used.data?.url) {
          targetUrl = used.data.url;
        }
      } catch (useErr) {
        console.warn('Using direct preview URL for canvas insertion:', useErr);
      }

      await canvasManager.addImageFromUrl(targetUrl, {
        name: asset.title || `Freepik-${asset.id}`,
      });

      setInsertSuccess(asset.id);
      setTimeout(() => setInsertSuccess(null), 1500);
    } catch (err) {
      console.error('Failed to add Freepik image to canvas:', err);
    } finally {
      setIsInserting(null);
    }
  };

  // Set image as full canvas background
  const handleSetAsBackground = async (asset: FreepikAsset) => {
    if (!canvasManager) return;
    setIsInserting(asset.id);
    try {
      let targetUrl = asset.preview_url;

      try {
        const used = await freepikService.useAsset(asset.id, asset.preview_url);
        if (used.success && used.data?.url) {
          targetUrl = used.data.url;
        }
      } catch (useErr) {
        console.warn('Using direct preview URL for background:', useErr);
      }

      await canvasManager.setBackgroundImage(targetUrl, {
        name: asset.title || `Freepik-BG-${asset.id}`,
        fit: 'cover',
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        opacity: 1.0,
        blur: 0,
      });

      setInsertSuccess(asset.id);
      setTimeout(() => setInsertSuccess(null), 1500);
    } catch (err) {
      console.error('Failed to set Freepik background:', err);
    } finally {
      setIsInserting(null);
    }
  };

  // Drag start for dragging directly onto the canvas
  const handleDragStart = (e: React.DragEvent, asset: FreepikAsset) => {
    const targetUrl = asset.preview_url;
    e.dataTransfer.setData('application/x-freepik-id', asset.id);
    e.dataTransfer.setData('application/x-freepik-url', targetUrl);
    e.dataTransfer.setData('text/plain', targetUrl);
    e.dataTransfer.effectAllowed = 'copy';

    // Drag image ghost
    const dragGhost = document.createElement('div');
    dragGhost.style.position = 'absolute';
    dragGhost.style.top = '-9999px';
    dragGhost.style.width = '80px';
    dragGhost.style.height = '80px';
    dragGhost.style.backgroundImage = `url(${asset.thumbnail_url || targetUrl})`;
    dragGhost.style.backgroundSize = 'cover';
    dragGhost.style.borderRadius = '8px';
    dragGhost.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 40, 40);
    setTimeout(() => {
      if (document.body.contains(dragGhost)) {
        document.body.removeChild(dragGhost);
      }
    }, 0);
  };

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Top Search & Filter Bar */}
      <div className="p-3.5 border-b border-slate-100 flex flex-col gap-2.5 bg-slate-50/50">
        {/* Brand Banner */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
              <Sparkles className="w-3 h-3" />
            </span>
            <span>Freepik / Magnific Library</span>
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search millions of photos, vectors, PSD..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Media Type Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs border border-slate-200/70">
          {[
            { id: 'all', label: 'All' },
            { id: 'photo', label: 'Photos' },
            { id: 'vector', label: 'Vectors' },
            { id: 'psd', label: 'PSD' },
            { id: 'icon', label: 'Icons' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMediaType(tab.id as FreepikMediaType)}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                mediaType === tab.id
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/[0.03]'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quick Search Chips */}
        {!query && (
          <div className="flex gap-1 overflow-x-auto pb-0.5 custom-scrollbar text-xs">
            {QUICK_SEARCH_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setQuery(chip)}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-50 border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 whitespace-nowrap transition"
              >
                #{chip}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end pt-0.5">
          <span className="text-[10px] font-medium text-slate-400">
            {totalItems > 0 ? `${totalItems.toLocaleString()} results` : 'Popular assets'}
          </span>
        </div>
      </div>

      {/* Media Grid Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5">
        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs flex flex-col gap-1.5">
            <span className="font-semibold">Unable to load Freepik assets:</span>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchFreepikMedia(1, false)}
              className="mt-1 self-start px-3 py-1 bg-red-600 text-white rounded-md text-[11px] font-semibold hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-gray-100 animate-pulse border border-gray-200/60"
              />
            ))}
          </div>
        ) : images.length > 0 ? (
          <>
            {/* 2-Column Responsive Image Grid */}
            <div className="grid grid-cols-2 gap-2">
              {images.map((asset) => {
                const isCurrentInserting = isInserting === asset.id;
                const isCurrentSuccess = insertSuccess === asset.id;

                return (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, asset)}
                    onClick={() => handleAddToCanvas(asset)}
                    className="group relative rounded-2xl border border-slate-200/80 bg-slate-100 overflow-hidden cursor-pointer shadow-sm hover:shadow-[0_12px_28px_rgba(37,99,235,0.18)] hover:border-blue-400 hover:-translate-y-0.5 transition-all duration-200 aspect-[4/3] flex items-center justify-center select-none"
                    title={`Click to add to canvas or drag onto artwork (${asset.title})`}
                  >
                    {/* Thumbnail Image */}
                    <img
                      src={asset.thumbnail_url || asset.preview_url}
                      alt={asset.title || 'Freepik image'}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                    />

                    {/* Subtle Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      {/* Top Row: Type Tag & Set Background */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-black/50 text-white backdrop-blur-xs">
                          {asset.type || 'img'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetAsBackground(asset);
                          }}
                          className="p-1.5 rounded-lg bg-black/45 hover:bg-blue-600 text-white transition-colors backdrop-blur-md shadow-sm"
                          title="Set as full background"
                        >
                          <Wallpaper className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Bottom Info & Add button */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-white text-[9px] drop-shadow-xs">
                          <span className="truncate max-w-[80px]">
                            {asset.author?.name || 'Freepik'}
                          </span>
                        </div>

                        <div className="w-full py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-bold text-center flex items-center justify-center gap-1 shadow-lg transition">
                          {isCurrentInserting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isCurrentSuccess ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Added!</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Add to Canvas</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {hasNext && (
              <div className="mt-4 pb-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading more...</span>
                    </>
                  ) : (
                    <span>Load more assets</span>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty Search Results */
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
    </div>
  );
};
