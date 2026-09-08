/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  Plus,
  Sparkles,
  Camera,
  Check,
  X,
  Wallpaper,
  ChevronDown,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import {
  pixabayService,
  PixabayImage,
  PixabayImageType,
} from '@/services/pixabayService';

interface PixabayPanelProps {
  canvasManager: CanvasManager | null;
}

const QUICK_SEARCH_CHIPS = [
  'Business',
  'Office',
  'Abstract',
  'Background',
  'Texture',
  'Minimalist',
  'Technology',
  'Nature',
  'Pattern',
  'Corporate',
];

export const PixabayPanel: React.FC<PixabayPanelProps> = ({ canvasManager }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [imageType, setImageType] = useState<PixabayImageType>('all');

  const [images, setImages] = useState<PixabayImage[]>([]);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isInserting, setIsInserting] = useState<number | null>(null);
  const [insertSuccess, setInsertSuccess] = useState<number | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 380);
    return () => clearTimeout(timer);
  }, [query]);

  // Load / Search images
  const fetchPixabayMedia = useCallback(
    async (pageToLoad: number, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await pixabayService.search({
          query: debouncedQuery,
          imageType,
          orientation: 'all',
          category: '',
          colors: '',
          editorsChoice: false,
          order: 'popular',
          page: pageToLoad,
          perPage: 28,
        });

        if (append) {
          setImages((prev) => [...prev, ...response.hits]);
        } else {
          setImages(response.hits || []);
        }
        setTotalHits(response.totalHits || 0);
      } catch (err: any) {
        console.error('Media library search failed:', err);
        setError(err.message || 'Failed to load the media library.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, imageType]
  );

  // Trigger search on filter / query change
  useEffect(() => {
    setPage(1);
    fetchPixabayMedia(1, false);
  }, [fetchPixabayMedia]);

  const handleLoadMore = () => {
    if (loadingMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPixabayMedia(nextPage, true);
  };

  // Add image onto canvas
  const handleAddToCanvas = async (img: PixabayImage) => {
    if (!canvasManager) return;
    setIsInserting(img.id);
    try {
      // Use largeImageURL (1280px) for crisp canvas rendering, with webformatURL fallback
      const targetUrl = img.largeImageURL || img.webformatURL;
      await canvasManager.addImageFromUrl(targetUrl, {
        name: img.tags?.split(',')[0]?.trim() || `Library-${img.id}`,
        naturalWidth: img.imageWidth || img.webformatWidth,
        naturalHeight: img.imageHeight || img.webformatHeight,
      });
      setInsertSuccess(img.id);
      setTimeout(() => setInsertSuccess(null), 1500);
    } catch (err) {
      console.error('Failed to add library image to canvas:', err);
    } finally {
      setIsInserting(null);
    }
  };

  // Set image as full canvas background
  const handleSetAsBackground = async (img: PixabayImage) => {
    if (!canvasManager) return;
    setIsInserting(img.id);
    try {
      const targetUrl = img.largeImageURL || img.webformatURL;
      await canvasManager.setBackgroundImage(targetUrl, {
        name: img.tags?.split(',')[0]?.trim() || `Library-BG-${img.id}`,
        fit: 'cover',
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        opacity: 1.0,
        blur: 0,
      });
      setInsertSuccess(img.id);
      setTimeout(() => setInsertSuccess(null), 1500);
    } catch (err) {
      console.error('Failed to set library background:', err);
    } finally {
      setIsInserting(null);
    }
  };

  // Drag and drop handler to allow dragging onto the canvas directly
  const handleDragStart = (e: React.DragEvent, img: PixabayImage) => {
    const targetUrl = img.largeImageURL || img.webformatURL;
    e.dataTransfer.setData('text/plain', targetUrl);
    e.dataTransfer.setData('application/x-pixabay-url', targetUrl);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white via-white to-slate-50/70 select-none">
      {/* Top Header & Search Area */}
      <div className="p-4 border-b border-slate-200/70 space-y-3 bg-white/90 backdrop-blur-xl shadow-[0_1px_12px_rgba(15,23,42,0.04)]">
        {/* Neutral library header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500 text-white shadow-[0_7px_18px_rgba(124,58,237,0.28)]">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs font-bold tracking-tight text-slate-900">Creative Library</p>
              <p className="text-[9px] text-slate-400">High-quality visual collection</p>
            </div>
          </div>
          <span className="text-[9px] font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200/70">
            Premium
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
          <input
            type="text"
            placeholder="Search 4M+ photos, vectors, graphics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 shadow-inner focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:shadow-[0_8px_24px_rgba(124,58,237,0.10)] transition-all"
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

        {/* Media Type Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs border border-slate-200/70">
          {[
            { id: 'all', label: 'All' },
            { id: 'photo', label: 'Photos' },
            { id: 'illustration', label: 'Art' },
            { id: 'vector', label: 'Vectors' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setImageType(tab.id as PixabayImageType)}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${imageType === tab.id
                ? 'bg-white text-violet-700 shadow-sm ring-1 ring-black/[0.03]'
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
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-50 border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50/50 whitespace-nowrap transition"
              >
                #{chip}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end pt-0.5">
          <span className="text-[10px] font-medium text-slate-400">
            {totalHits.toLocaleString()} results
          </span>
        </div>
      </div>

      {/* Media Grid Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5">
        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs flex flex-col gap-1.5">
            <span className="font-semibold">Unable to load library media:</span>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchPixabayMedia(1, false)}
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
              {images.map((img) => {
                const isCurrentInserting = isInserting === img.id;
                const isCurrentSuccess = insertSuccess === img.id;

                return (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, img)}
                    onClick={() => handleAddToCanvas(img)}
                    className="group relative rounded-2xl border border-slate-200/80 bg-slate-100 overflow-hidden cursor-pointer shadow-sm hover:shadow-[0_12px_28px_rgba(76,29,149,0.16)] hover:border-violet-400 hover:-translate-y-0.5 transition-all duration-200 aspect-[4/3] flex items-center justify-center select-none"
                    title={`Click to add to canvas or drag onto artwork (${img.tags})`}
                  >
                    {/* Thumbnail Image */}
                    <img
                      src={img.webformatURL || img.previewURL}
                      alt={img.tags || 'Creative library image'}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                    />

                    {/* Subtle Gradient Shadow */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      {/* Top Action: Set as Background */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetAsBackground(img);
                          }}
                          className="p-1.5 rounded-lg bg-black/45 hover:bg-violet-600 text-white transition-colors backdrop-blur-md shadow-sm"
                          title="Set as full background"
                        >
                          <Wallpaper className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Bottom Info & Add button */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-white text-[9px] drop-shadow-xs">
                          <span className="truncate max-w-[70px]">@{img.user}</span>
                          <span className="opacity-80">
                            {img.imageWidth && img.imageHeight
                              ? `${img.imageWidth}×${img.imageHeight}`
                              : ''}
                          </span>
                        </div>

                        <div className="w-full py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-[10px] font-bold text-center flex items-center justify-center gap-1 shadow-lg transition">
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

            {/* Pagination / Load More Button */}
            {images.length < totalHits && (
              <div className="mt-4 pt-2 pb-4 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-2.5 bg-white hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading more images...</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Load More ({images.length} of {totalHits.toLocaleString()})</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty Search State */
          <div className="py-12 text-center text-gray-400 space-y-2">
            <Camera className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-xs font-semibold text-gray-600">No media found</p>
            <p className="text-[11px] text-gray-400 max-w-[200px] mx-auto">
              Try a different search term or browse the complete collection.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setImageType('all');
              }}
              className="mt-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-semibold hover:bg-violet-200 transition"
            >
              Browse All
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
