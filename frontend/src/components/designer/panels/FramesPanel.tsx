'use client';

import React, { useState, useEffect, useMemo } from 'react';
import NextImage from 'next/image';
import { Search, Shapes, Sparkles, X, Info, Layers } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { DesignAsset, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { LoadingState, EmptyState } from '@/components/admin/shared';
import { FRAME_PRESETS, FRAME_SVG_PATHS } from '../data/framesData';
import { FrameShapeType, FramePreset } from '@/types/designer';

interface FramesPanelProps {
  canvasManager: CanvasManager | null;
}

type JsonObject = Record<string, any>;

const asObject = (value: unknown): JsonObject => {
  if (!value) return {};
  if (typeof value === 'object') return value as JsonObject;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const firstString = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();

const positiveNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue > 0) return numberValue;
  }
  return undefined;
};

const getFrameAssetConfig = (asset: DesignAsset) => {
  const metadata = asObject(asset.metadata);
  const frame = asObject(metadata.frame);
  const fabric = asObject(asset.fabric_json);

  return {
    overlayUrl: firstString(
      asset.file_url,
      frame.overlayUrl,
      frame.overlay_url,
      metadata.overlayUrl,
      metadata.overlay_url,
      asset.thumbnail_url
    ),
    maskUrl: firstString(
      frame.maskUrl,
      frame.mask_url,
      metadata.maskUrl,
      metadata.mask_url,
      fabric.maskUrl,
      fabric.mask_url
    ),
    maskType: firstString(frame.maskType, metadata.maskType, fabric.maskType) || 'svg_mask',
    photoFit: (firstString(frame.photoFit, metadata.photoFit, fabric.photoFit) === 'contain'
      ? 'contain'
      : 'cover') as 'cover' | 'contain',
    shape: firstString(frame.shape, metadata.shape, fabric.shape, fabric.frameShape) || 'custom-svg',
    width: positiveNumber(frame.width, metadata.width, fabric.width),
    height: positiveNumber(frame.height, metadata.height, fabric.height),
  };
};

const CanvaFramePreviewCard: React.FC<{ preset: FramePreset; onClick: () => void }> = ({
  preset,
  onClick,
}) => {
  const pathD = (FRAME_SVG_PATHS as Record<string, string>)[preset.shape] || FRAME_SVG_PATHS.circle;
  const clipId = `preview-clip-${preset.shape}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Add ${preset.name} Frame`}
      className="group relative flex flex-col items-center justify-between p-2 rounded-2xl border border-gray-200/90 bg-white hover:border-purple-500 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden text-left"
    >
      <div className="relative w-full aspect-square flex items-center justify-center p-1">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-xs group-hover:scale-105 transition-transform duration-200"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={pathD} />
            </clipPath>
            <linearGradient id={`sky-${preset.shape}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ea8de" />
              <stop offset="45%" stopColor="#72bfe8" />
              <stop offset="85%" stopColor="#9dd5f2" />
              <stop offset="100%" stopColor="#cbeaf8" />
            </linearGradient>
            <linearGradient id={`hillBack-${preset.shape}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64a322" />
              <stop offset="100%" stopColor="#467b12" />
            </linearGradient>
            <linearGradient id={`hillMid-${preset.shape}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#82c330" />
              <stop offset="100%" stopColor="#5a9718" />
            </linearGradient>
            <linearGradient id={`hillFront-${preset.shape}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9bdc3e" />
              <stop offset="100%" stopColor="#76b825" />
            </linearGradient>
          </defs>

          {/* Masked Canva Landscape artwork */}
          <g clipPath={`url(#${clipId})`}>
            <rect width="100" height="100" fill={`url(#sky-${preset.shape})`} />
            <g fill="#ffffff" opacity="0.95">
              <ellipse cx="54" cy="36" rx="16" ry="8" />
              <ellipse cx="40" cy="39" rx="11" ry="6" />
              <ellipse cx="67" cy="39" rx="9" ry="5.5" />
              <circle cx="48" cy="32" r="8" />
              <circle cx="59" cy="33" r="7" />
            </g>
            <path
              d="M -4,68 Q 24,48 56,57 Q 82,64 104,50 L 104,104 L -4,104 Z"
              fill={`url(#hillBack-${preset.shape})`}
            />
            <path
              d="M -4,77 Q 32,56 68,68 Q 88,74 104,66 L 104,104 L -4,104 Z"
              fill={`url(#hillMid-${preset.shape})`}
            />
            <path
              d="M -4,88 Q 38,65 104,82 L 104,104 L -4,104 Z"
              fill={`url(#hillFront-${preset.shape})`}
            />
          </g>

          {/* Stroke outline */}
          <path
            d={pathD}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1.5"
            className="group-hover:stroke-purple-300 transition-colors"
          />
        </svg>
      </div>

      <div className="w-full mt-1.5 text-center">
        <span className="text-[11px] font-semibold text-gray-700 block truncate group-hover:text-purple-700 transition-colors">
          {preset.name}
        </span>
      </div>
    </button>
  );
};

export const FramesPanel: React.FC<FramesPanelProps> = ({ canvasManager }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [adminFrames, setAdminFrames] = useState<DesignAsset[]>([]);
  const [adminCategories, setAdminCategories] = useState<DesignAssetCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [assetsRes, catsRes] = await Promise.all([
          designAssetService.getPublicAssets({ asset_type: 'frame', per_page: 50 }),
          designAssetService.getPublicCategories('frame'),
        ]);
        if (!isMounted) return;
        setAdminFrames(assetsRes.data || []);
        setAdminCategories(catsRes || []);
      } catch (err) {
        console.error('Failed to load frames', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddCanvaFrame = (shape: FrameShapeType) => {
    if (!canvasManager) return;
    canvasManager.addFrame(shape);
  };

  const handleAddAdminFrame = (asset: DesignAsset) => {
    if (!canvasManager) return;

    const config = getFrameAssetConfig(asset);

    if (config.overlayUrl) {
      void canvasManager.addFrameAsset(config.overlayUrl, {
        assetId: asset.id,
        name: asset.name,
        provider: asset.provider || 'admin',
        overlayUrl: config.overlayUrl,
        maskUrl: config.maskUrl,
        maskType: config.maskType,
        photoFit: config.photoFit,
        shape: config.shape,
        width: config.width,
        height: config.height,
      });
    } else {
      canvasManager.addFrame('rounded-rect' as FrameShapeType);
    }
  };

  // Filter Canva presets
  const filteredPresets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return FRAME_PRESETS.filter((preset) => {
      const matchesSearch =
        !q ||
        preset.name.toLowerCase().includes(q) ||
        preset.shape.toLowerCase().includes(q) ||
        (preset.description && preset.description.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedCategory === 'All') return true;
      if (selectedCategory === 'Basic Shapes') return preset.category === 'basic';
      if (selectedCategory === 'Devices') return preset.category === 'devices';
      if (selectedCategory === 'Novelty') return preset.category === 'creative';

      return false;
    });
  }, [searchQuery, selectedCategory]);

  // Filter admin frames
  const filteredAdminFrames = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return adminFrames.filter((frame) => {
      const matchesSearch =
        !q ||
        frame.name.toLowerCase().includes(q) ||
        (frame.category?.name && frame.category.name.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedCategory === 'All') return true;
      if (selectedCategory === 'Custom Frames') return true;
      return frame.category?.name === selectedCategory;
    });
  }, [adminFrames, searchQuery, selectedCategory]);

  // Combined categories list
  const categoryChips = useMemo(() => {
    const defaultChips = ['All', 'Basic Shapes', 'Devices', 'Novelty'];
    if (adminFrames.length > 0) {
      defaultChips.push('Custom Frames');
    }
    const apiCats = adminCategories.map((c) => c.name).filter((n) => !defaultChips.includes(n));
    return [...defaultChips, ...apiCats];
  }, [adminFrames.length, adminCategories]);

  const totalResults = filteredPresets.length + filteredAdminFrames.length;

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto custom-scrollbar bg-slate-50/50 select-none">
      {/* Header */}
      <div className="flex flex-col gap-2.5 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Shapes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Frames
              </h3>
              <p className="text-[10px] text-gray-500 font-medium">
                Canva photo masks & shapes
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-3.5 h-3.5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search frames (e.g. circle, arch, phone)..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:font-normal shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Helpful Canva Tooltip */}
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-purple-50/70 border border-purple-100/80 text-[11px] text-purple-900 leading-snug shadow-2xs">
        <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
        <span>
          Click any frame to add it. Then click or drag <strong>any photo</strong> to instantly crop and fit inside!
        </span>
      </div>

      {/* Category Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {categoryChips.map((chip) => (
          <button
            key={chip}
            onClick={() => setSelectedCategory(chip)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition whitespace-nowrap shadow-2xs ${selectedCategory === chip
                ? 'bg-purple-600 text-white shadow-purple-200'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Content Section */}
      <div className="space-y-4">
        {loading ? (
          <LoadingState message="Loading frames..." />
        ) : totalResults === 0 ? (
          <EmptyState title="No frames found matching your search" />
        ) : (
          <>
            {/* Canva Frame Presets */}
            {filteredPresets.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    {selectedCategory === 'All' ? 'Photo Frames' : selectedCategory}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-400">
                    {filteredPresets.length} shapes
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {filteredPresets.map((preset) => (
                    <CanvaFramePreviewCard
                      key={preset.id}
                      preset={preset}
                      onClick={() => handleAddCanvaFrame(preset.shape)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Custom Admin Frames */}
            {filteredAdminFrames.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    Custom & Overlay Frames
                  </span>
                  <span className="text-[10px] font-semibold text-gray-400">
                    {filteredAdminFrames.length} items
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {filteredAdminFrames.map((frame) => {
                    const config = getFrameAssetConfig(frame);
                    const frameUrl = frame.thumbnail_url || config.overlayUrl;
                    return (
                      <button
                        key={frame.id}
                        onClick={() => handleAddAdminFrame(frame)}
                        className="group relative flex flex-col items-center justify-between p-2 rounded-2xl border border-gray-200 bg-white hover:border-purple-400 hover:shadow-md transition-all overflow-hidden"
                      >
                        <div className="relative w-full aspect-square flex items-center justify-center p-1">
                          {frameUrl ? (
                            <NextImage
                              src={frameUrl}
                              alt={frame.name}
                              fill
                              unoptimized
                              sizes="(max-width: 768px) 33vw, 150px"
                              className="p-1 object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <Shapes className="w-8 h-8 text-purple-300 group-hover:scale-110 transition-transform" />
                          )}
                        </div>

                        <div className="w-full mt-1.5 text-center">
                          <span className="text-[11px] font-semibold text-gray-700 block truncate px-1 group-hover:text-purple-700 transition-colors">
                            {frame.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
