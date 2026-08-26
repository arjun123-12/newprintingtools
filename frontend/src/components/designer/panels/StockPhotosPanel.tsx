/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, Search, Plus, Sparkles } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { STOCK_IMAGES } from '../data/stockImagesData';
import { StockImage } from '@/types/designer';

interface StockPhotosPanelProps {
  canvasManager: CanvasManager | null;
}

const CATEGORIES = ['All', 'Business', 'Abstract', 'Nature', 'Food', 'Architecture', 'Technology'];

export const StockPhotosPanel: React.FC<StockPhotosPanelProps> = ({ canvasManager }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredImages = STOCK_IMAGES.filter((img) => {
    const matchesCat =
      selectedCategory === 'All' || img.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      img.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAddStockImage = (stockImg: StockImage) => {
    if (!canvasManager) return;
    canvasManager.addImageFromUrl(stockImg.url, {
      naturalWidth: stockImg.width,
      naturalHeight: stockImg.height,
      name: stockImg.title,
    });
  };

  return (
    <div className="p-4 space-y-4 select-none custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Stock Photos
          </h3>
        </div>
        <span className="text-[10px] text-gray-400">Royalty Free</span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search stock photos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50/70 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition text-[11px] ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 gap-2 pt-1 max-h-[460px] overflow-y-auto custom-scrollbar">
        {filteredImages.map((img) => (
          <div
            key={img.id}
            onClick={() => handleAddStockImage(img)}
            draggable
            onDragEnd={() => handleAddStockImage(img)}
            className="group relative rounded-xl border border-gray-200 bg-gray-50 hover:border-blue-500 overflow-hidden cursor-pointer transition shadow-2xs aspect-4/3 flex flex-col"
          >
            <img
              src={img.thumbnail}
              alt={img.title}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
            />

            {/* Category Tag */}
            <span className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white">
              {img.category}
            </span>

            {/* Hover Quick Add Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </div>
          </div>
        ))}

        {filteredImages.length === 0 && (
          <div className="col-span-2 py-8 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No photos found matching &quot;{searchQuery}&quot;
          </div>
        )}
      </div>
    </div>
  );
};
