/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Search, Loader2, Plus, Grid2X2, List, Sparkles } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { formatImageUrl } from '@/utils/imageUrl';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

interface ProductImage {
  id: string;
  url: string;
  title: string;
  thumbnail_url: string;
}

interface StockPhotosPanelProps {
  canvasManager: CanvasManager | null;
}

export const StockPhotosPanel: React.FC<StockPhotosPanelProps> = ({ canvasManager }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ProductImage[]>([]);
  const [allImages, setAllImages] = useState<ProductImage[]>([]);
  const [isInserting, setIsInserting] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchImages();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(allImages);
    } else {
      const lowerQuery = query.toLowerCase();
      setResults(allImages.filter(img => img.title.toLowerCase().includes(lowerQuery)));
    }
  }, [query, allImages]);

  const fetchImages = async () => {
    setIsSearching(true);
    try {
      const res = await fetch(`${API_URL}/products`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const extracted: ProductImage[] = [];
          json.data.forEach((product: any) => {
            const catName = product.category_name?.toLowerCase() || '';
            if (catName.includes('photo') || catName.includes('image')) {
              if (product.featured_image_url) {
                extracted.push({
                  id: `${product.id}-main`,
                  url: product.featured_image_url,
                  thumbnail_url: product.featured_image_url,
                  title: product.name,
                });
              }
              if (Array.isArray(product.images)) {
                product.images.forEach((img: any) => {
                  if (img.url && img.url !== product.featured_image_url) {
                    extracted.push({
                      id: `${product.id}-${img.id || Math.random().toString(36).substr(2, 9)}`,
                      url: img.url,
                      thumbnail_url: img.url,
                      title: `${product.name} Image`,
                    });
                  }
                });
              }
            }
          });
          setAllImages(extracted);
          setResults(extracted);
        }
      }
    } catch (error) {
      console.error('Failed to fetch product images:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseAsset = async (asset: ProductImage) => {
    if (!canvasManager) return;

    try {
      setIsInserting(asset.id);
      await canvasManager.addImageFromUrl(asset.url, {
        name: asset.title,
      });
    } catch (err) {
      console.error('Failed to add product image:', err);
    } finally {
      setIsInserting(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white p-4 pb-0">
      {/* Global Header & Search */}
      <div className="flex-none mb-4">
        <h2 className="text-[14px] font-bold text-gray-900 mb-3 tracking-wide flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-blue-500" />
          Images
        </h2>
        <div className="relative w-full mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="Search photos..."
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
              className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="List View"
              className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
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
            <Sparkles className="w-8 h-8 text-blue-300 mb-3" />
            <p className="text-sm font-medium text-gray-800">No images found</p>
            <p className="text-xs text-gray-500 mt-1">Upload products in Admin</p>
          </div>
        ) : (
          <div className={`gap-2.5 ${viewMode === 'grid' ? 'grid grid-cols-2' : 'flex flex-col space-y-2'}`}>
            {results.map((img) => (
              <div
                key={img.id}
                onClick={() => handleUseAsset(img)}
                className={`group relative rounded-xl border border-gray-200 bg-white hover:border-blue-500 overflow-hidden cursor-pointer transition shadow-2xs ${viewMode === 'grid' ? 'aspect-square flex flex-col' : 'flex items-center p-2 gap-3 hover:bg-blue-50/40'}`}
              >
                <div className={`shrink-0 overflow-hidden bg-gray-100 rounded-lg relative flex items-center justify-center ${viewMode === 'grid' ? 'w-full h-full' : 'w-14 h-14'}`}>
                  <img src={formatImageUrl(img.thumbnail_url)} alt={img.title} className="w-full h-full object-cover group-hover:scale-110 transition duration-200" loading="lazy" />
                  {viewMode === 'grid' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUseAsset(img); }}
                        className="flex items-center gap-1.5 text-white text-xs font-semibold bg-blue-600/80 hover:bg-blue-600 px-3 py-1.5 rounded-lg backdrop-blur-sm"
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
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">Product Image</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleUseAsset(img); }}
                        className="px-2.5 py-1.5 bg-blue-50 text-blue-600 font-bold text-[11px] rounded-lg group-hover:bg-blue-600 group-hover:text-white transition flex items-center justify-center gap-1"
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
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}


      </div>
    </div>
  );
};
