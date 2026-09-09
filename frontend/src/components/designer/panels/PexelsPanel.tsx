'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  Plus,
  Check,
  Wallpaper,
  X,
  Camera,
  ExternalLink,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import {
  pexelsService,
  PexelsPhoto,
  PexelsOrientation,
} from '@/services/pexelsService';

interface PexelsPanelProps {
  canvasManager: CanvasManager | null;
}

const QUICK_SEARCH_CHIPS = [
  'wallpaper',
  'business',
  'nature',
  'texture',
  'architecture',
  'flowers',
  'food',
  'office',
  'technology',
  'travel',
  'minimal',
  'lifestyle',
];

export const PexelsPanel: React.FC<PexelsPanelProps> = ({ canvasManager }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [orientation, setOrientation] = useState<PexelsOrientation>('all');

  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isInserting, setIsInserting] = useState<number | null>(null);
  const [insertSuccess, setInsertSuccess] = useState<number | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 380);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch Pexels photos
  const fetchPexelsPhotos = useCallback(
    async (pageToLoad: number, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await pexelsService.search({
          query: debouncedQuery,
          orientation,
          page: pageToLoad,
          perPage: 24,
        });

        if (append) {
          setPhotos((prev) => [...prev, ...(response.photos || [])]);
        } else {
          setPhotos(response.photos || []);
        }

        setTotalResults(response.total_results || 0);
        setHasNext(Boolean(response.next_page));
      } catch (err: any) {
        console.error('Pexels search failed:', err);
        setError(err.message || 'Failed to search Pexels photos.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, orientation]
  );

  // Trigger search on filter / query change
  useEffect(() => {
    setPage(1);
    fetchPexelsPhotos(1, false);
  }, [fetchPexelsPhotos]);

  const handleLoadMore = () => {
    if (loadingMore || loading || !hasNext) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPexelsPhotos(nextPage, true);
  };

  // Add photo onto canvas
  const handleAddToCanvas = async (photo: PexelsPhoto) => {
    if (!canvasManager) return;
    setIsInserting(photo.id);
    try {
      // Use large2x or large for high-resolution print quality
      const targetUrl =
        photo.src.large2x || photo.src.large || photo.src.original;

      await canvasManager.addImageFromUrl(targetUrl, {
        name: photo.alt || `Pexels-${photo.id}`,
        naturalWidth: photo.width,
        naturalHeight: photo.height,
      });

      setInsertSuccess(photo.id);
      setTimeout(() => setInsertSuccess(null), 1500);
    } catch (err) {
      console.error('Failed to add Pexels photo to canvas:', err);
    } finally {
      setIsInserting(null);
    }
  };

  // Set photo as full canvas background
  const handleSetAsBackground = async (photo: PexelsPhoto) => {
    if (!canvasManager) return;
    setIsInserting(photo.id);
    try {
      const targetUrl =
        photo.src.large2x || photo.src.large || photo.src.original;

      await canvasManager.setBackgroundImage(targetUrl, {
        name: photo.alt || `Pexels-BG-${photo.id}`,
        fit: 'cover',
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        opacity: 1.0,
        blur: 0,
      });

      setInsertSuccess(photo.id);
      setTimeout(() => setInsertSuccess(null), 1500);
    } catch (err) {
      console.error('Failed to set Pexels background:', err);
    } finally {
      setIsInserting(null);
    }
  };

  // Drag start for dragging directly onto the canvas
  const handleDragStart = (e: React.DragEvent, photo: PexelsPhoto) => {
    const targetUrl =
      photo.src.large2x || photo.src.large || photo.src.medium;
    e.dataTransfer.setData('text/plain', targetUrl);
    e.dataTransfer.setData('application/x-pexels-url', targetUrl);
    e.dataTransfer.effectAllowed = 'copy';

    // Drag image ghost
    const dragGhost = document.createElement('div');
    dragGhost.style.position = 'absolute';
    dragGhost.style.top = '-9999px';
    dragGhost.style.width = '80px';
    dragGhost.style.height = '80px';
    dragGhost.style.backgroundImage = `url(${photo.src.small || photo.src.tiny})`;
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
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#05a081] text-white shadow-xs">
              <Camera className="w-3 h-3" />
            </span>
            <span>Pexels Photography</span>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
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
            placeholder="Search high-res stock photos on Pexels..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#05a081]/20 focus:border-[#05a081] transition shadow-2xs"
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

        {/* Orientation Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs border border-slate-200/70">
          {[
            { id: 'all', label: 'All' },
            { id: 'landscape', label: 'Landscape' },
            { id: 'portrait', label: 'Portrait' },
            { id: 'square', label: 'Square' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOrientation(tab.id as PexelsOrientation)}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                orientation === tab.id
                  ? 'bg-white text-[#05a081] shadow-sm ring-1 ring-black/[0.03]'
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
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-50 border border-gray-200 text-gray-600 hover:text-[#05a081] hover:border-[#05a081]/40 hover:bg-emerald-50/50 whitespace-nowrap transition"
              >
                #{chip}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end pt-0.5">
          <span className="text-[10px] font-medium text-slate-400">
            {totalResults > 0
              ? `${totalResults.toLocaleString()} photos`
              : 'Curated collection'}
          </span>
        </div>
      </div>

      {/* Photos Grid Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5">
        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs flex flex-col gap-1.5">
            <span className="font-semibold">Unable to load Pexels photos:</span>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchPexelsPhotos(1, false)}
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
        ) : photos.length > 0 ? (
          <>
            {/* 2-Column Responsive Image Grid */}
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo) => {
                const isCurrentInserting = isInserting === photo.id;
                const isCurrentSuccess = insertSuccess === photo.id;

                return (
                  <div
                    key={photo.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, photo)}
                    onClick={() => handleAddToCanvas(photo)}
                    className="group relative rounded-2xl border border-slate-200/80 bg-slate-100 overflow-hidden cursor-pointer shadow-sm hover:shadow-[0_12px_28px_rgba(5,160,129,0.2)] hover:border-[#05a081] hover:-translate-y-0.5 transition-all duration-200 aspect-[4/3] flex items-center justify-center select-none"
                    title={`Click to add to canvas or drag onto artwork (${photo.alt || 'Photo by ' + photo.photographer})`}
                  >
                    {/* Thumbnail Image */}
                    <img
                      src={photo.src.medium || photo.src.small}
                      alt={photo.alt || 'Pexels photo'}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                    />

                    {/* Subtle Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      {/* Top Action: Set as Background */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetAsBackground(photo);
                          }}
                          className="p-1.5 rounded-lg bg-black/45 hover:bg-[#05a081] text-white transition-colors backdrop-blur-md shadow-sm"
                          title="Set as full background"
                        >
                          <Wallpaper className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Bottom Info & Add button */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-white text-[9px] drop-shadow-xs">
                          <span className="truncate max-w-[80px]">
                            @{photo.photographer}
                          </span>
                          <span className="opacity-80">
                            {photo.width && photo.height
                              ? `${photo.width}×${photo.height}`
                              : ''}
                          </span>
                        </div>

                        <div className="w-full py-1.5 rounded-lg bg-gradient-to-r from-[#05a081] to-emerald-600 hover:from-[#04886e] hover:to-emerald-700 text-white text-[10px] font-bold text-center flex items-center justify-center gap-1 shadow-lg transition">
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
                    <span>Load more photos</span>
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
              No Pexels photos found
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
