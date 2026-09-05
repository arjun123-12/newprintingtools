'use client';

import React, { useState, useEffect } from 'react';
import { Search, Loader2, Plus, Grid2X2, List, Sparkles } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { freepikService, FreepikAsset } from '@/services/freepikService';

interface IconsPanelProps {
  canvasManager: CanvasManager | null;
}

export const IconsPanel: React.FC<IconsPanelProps> = ({ canvasManager }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<FreepikAsset[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isInserting, setIsInserting] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchResults(1, query);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const fetchResults = async (targetPage: number, searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasNext(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await freepikService.searchIcons(searchQuery, targetPage, 20);
      
      if (response.success) {
        if (targetPage === 1) {
          setResults(response.data.items);
        } else {
          setResults(prev => [...prev, ...response.data.items]);
        }
        setHasNext(response.data.pagination.has_next);
        setPage(targetPage);
      }
    } catch (error) {
      console.error('Failed to fetch icon results:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = () => {
    if (!isSearching && hasNext) {
      fetchResults(page + 1, query);
    }
  };

  const handleUseAsset = async (asset: FreepikAsset) => {
    if (!canvasManager) return;

    try {
      setIsInserting(asset.id);
      
      const response = await freepikService.useIcon(asset.id);
      
      let targetUrl = asset.preview_url;
      let targetTitle = asset.title;

      if (response.success && response.data?.url) {
        targetUrl = response.data.url;
        targetTitle = response.data.title || asset.title;
      }

      await canvasManager.addImageFromUrl(targetUrl, {
        name: targetTitle,
      });
    } catch (err) {
      console.error('Failed to use icon, falling back to preview:', err);
      // Fallback to preview url
      await canvasManager.addImageFromUrl(asset.preview_url, {
        name: asset.title,
      });
    } finally {
      setIsInserting(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white p-4 pb-0">
      {/* Global Header & Search */}
      <div className="flex-none mb-4">
        <h2 className="text-[14px] font-bold text-gray-900 mb-3 tracking-wide">Icons</h2>
        <div className="relative w-full mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent transition-colors"
            placeholder="Search icons..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        
        {/* View Mode */}
        <div className="flex justify-end mb-2">
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200/80">
            <button
              type="button"
              title="Grid View"
              className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white text-[#8b5cf6] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="List View"
              className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white text-[#8b5cf6] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-20 relative">
        {!query ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Sparkles className="w-8 h-8 text-purple-300 mb-3" />
            <p className="text-sm font-medium text-gray-800">Search for icons</p>
            <p className="text-xs text-gray-500 mt-1">Powered by Freepik</p>
          </div>
        ) : (
          <div className={`gap-2.5 ${viewMode === 'grid' ? 'grid grid-cols-2' : 'flex flex-col space-y-2'}`}>
            {results.map((img) => (
              <div
                key={img.id}
                onClick={() => handleUseAsset(img)}
                className={`group relative rounded-xl border border-gray-200 bg-white hover:border-[#8b5cf6] overflow-hidden cursor-pointer transition shadow-2xs ${viewMode === 'grid' ? 'aspect-square flex flex-col' : 'flex items-center p-2 gap-3 hover:bg-purple-50/40'}`}
              >
                <div className={`shrink-0 overflow-hidden bg-gray-100 rounded-lg relative flex items-center justify-center ${viewMode === 'grid' ? 'w-full h-full' : 'w-14 h-14'}`}>
                  <img src={img.thumbnail_url} alt={img.title} className="w-3/4 h-3/4 object-contain group-hover:scale-110 transition duration-200" loading="lazy" />
                  {viewMode === 'grid' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUseAsset(img); }}
                        className="flex items-center gap-1.5 text-white text-xs font-semibold bg-purple-600/80 hover:bg-purple-600 px-3 py-1.5 rounded-lg backdrop-blur-sm"
                      >
                        {isInserting === img.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /><span>Use</span></>}
                      </button>
                    </div>
                  )}
                </div>
                {viewMode === 'list' && (
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-gray-800 truncate leading-snug">{img.title}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">By {img.author?.name || 'Freepik'}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleUseAsset(img); }}
                        className="px-2.5 py-1.5 bg-purple-50 text-[#8b5cf6] font-bold text-[11px] rounded-lg group-hover:bg-[#8b5cf6] group-hover:text-white transition flex items-center justify-center gap-1"
                      >
                        {isInserting === img.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3 h-3" /><span>Add</span></>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Loading / Load More */}
        {isSearching && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-[#8b5cf6]" />
          </div>
        )}

        {hasNext && !isSearching && query && (
          <div className="pt-4 pb-2">
            <button
              onClick={handleLoadMore}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-xs transition"
            >
              Load more results
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
