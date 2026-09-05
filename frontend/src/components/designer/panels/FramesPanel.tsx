'use client';

import React, { useState, useEffect } from 'react';
import { Search, Shapes, Image as ImageIcon } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { DesignAsset, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { LoadingState, EmptyState } from '@/components/admin/shared';

interface FramesPanelProps {
  canvasManager: CanvasManager | null;
}

export const FramesPanel: React.FC<FramesPanelProps> = ({ canvasManager }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const [frames, setFrames] = useState<DesignAsset[]>([]);
  const [categories, setCategories] = useState<DesignAssetCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [assetsRes, catsRes] = await Promise.all([
          designAssetService.getPublicAssets({ asset_type: 'frame', per_page: 50 }),
          designAssetService.getPublicCategories('frame')
        ]);
        setFrames(assetsRes.data);
        setCategories(catsRes);
      } catch (err) {
        console.error('Failed to load frames', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddFrame = (asset: DesignAsset) => {
    if (!canvasManager) return;

    const imageUrl = asset.file_url || asset.thumbnail_url;

    if (imageUrl) {
      // Admin-uploaded decorative frame image — add as an overlay on the canvas
      canvasManager.addFrameAsset(imageUrl, {
        assetId: asset.id,
        name: asset.name,
        provider: asset.provider || 'admin',
      });
    } else {
      // Fallback: use built-in clip-path shape frame
      const shape = asset.metadata?.shape || asset.fabric_json?.shape || 'rect';
      canvasManager.addFrame(shape as any);
    }
  };

  const filteredFrames = frames.filter((frame) => {
    const matchesSearch = frame.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || frame.category?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-4 space-y-5 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
            <Shapes className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Frames & Grids
          </h3>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-3.5 h-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search frames..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        <button
          onClick={() => setSelectedCategory('All')}
          className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition whitespace-nowrap shadow-2xs ${
            selectedCategory === 'All' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          All Frames
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.name)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition whitespace-nowrap shadow-2xs ${
              selectedCategory === cat.name ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Frame Grid */}
      <div className="space-y-3">
        {loading ? (
          <LoadingState message="Loading frames..." />
        ) : filteredFrames.length === 0 ? (
          <EmptyState title="No frames found" />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filteredFrames.map((frame) => (
              <button
                key={frame.id}
                onClick={() => handleAddFrame(frame)}
                className="group relative flex flex-col items-center justify-center p-2 rounded-2xl border border-gray-200 bg-white hover:border-indigo-400 hover:shadow-md transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-indigo-50/0 group-hover:bg-indigo-50/50 transition-colors z-0" />
                
                <div className="relative z-10 w-full aspect-square flex items-center justify-center p-2">
                  {frame.thumbnail_url || frame.file_url ? (
                    <img src={frame.thumbnail_url || frame.file_url} alt={frame.name} className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform" />
                  ) : (
                    <Shapes className="w-8 h-8 text-indigo-300 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                
                <div className="w-full mt-2 text-center relative z-10">
                  <span className="text-[10px] font-bold text-gray-700 block truncate px-1">
                    {frame.name}
                  </span>
                  <span className="text-[9px] text-gray-400 truncate hidden group-hover:block">
                    {frame.category?.name || 'Frame'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
