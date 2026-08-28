'use client';

import React, { useState } from 'react';
import { Search, Crop, Sparkles, Smartphone, Shapes, Image as ImageIcon } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { FRAME_PRESETS, FRAME_SVG_PATHS, CANVA_LANDSCAPE_SVG_RAW } from '../data/framesData';
import { FramePreset, FrameShapeType } from '@/types/designer';

interface FramesPanelProps {
  canvasManager: CanvasManager | null;
}

export const FramesPanel: React.FC<FramesPanelProps> = ({ canvasManager }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'basic' | 'devices' | 'creative'>('all');

  const filteredPresets = FRAME_PRESETS.filter((preset) => {
    const matchesSearch =
      preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (preset.description && preset.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'all' || preset.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddFrame = (preset: FramePreset) => {
    if (!canvasManager) return;
    canvasManager.addFrame(preset.shape);
  };

  /**
   * Renders the authentic Canva landscape artwork clipped by the exact shape path.
   */
  const renderFrameThumbnail = (shape: FrameShapeType, presetName: string) => {
    const pathD = FRAME_SVG_PATHS[shape] || FRAME_SVG_PATHS.circle;
    const clipId = `clip_${shape}`;

    return (
      <svg
        viewBox="0 0 100 100"
        className="w-16 h-16 drop-shadow-xs transition-transform duration-200 group-hover:scale-105"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={pathD} clipRule="evenodd" />
          </clipPath>

          {/* Canva Sky Gradient */}
          <linearGradient id={`sky_${shape}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ea8de" />
            <stop offset="45%" stopColor="#72bfe8" />
            <stop offset="85%" stopColor="#9dd5f2" />
            <stop offset="100%" stopColor="#cbeaf8" />
          </linearGradient>

          {/* Canva Hill Gradients */}
          <linearGradient id={`hillB_${shape}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64a322" />
            <stop offset="100%" stopColor="#467b12" />
          </linearGradient>
          <linearGradient id={`hillM_${shape}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#82c330" />
            <stop offset="100%" stopColor="#5a9718" />
          </linearGradient>
          <linearGradient id={`hillF_${shape}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9bdc3e" />
            <stop offset="100%" stopColor="#76b825" />
          </linearGradient>
        </defs>

        {/* Group with shape clipPath */}
        <g clipPath={`url(#${clipId})`}>
          {/* Sky background */}
          <rect width="100" height="100" fill={`url(#sky_${shape})`} />

          {/* Cloud */}
          <g fill="#ffffff" opacity="0.95">
            <ellipse cx="54" cy="36" rx="16" ry="8" />
            <ellipse cx="40" cy="39" rx="11" ry="6" />
            <ellipse cx="67" cy="39" rx="9" ry="5" />
            <circle cx="48" cy="32" r="8" />
            <circle cx="59" cy="33" r="7" />
          </g>

          {/* Back Hill */}
          <path
            d="M -5,68 Q 24,48 56,57 Q 82,64 105,50 L 105,105 L -5,105 Z"
            fill={`url(#hillB_${shape})`}
          />

          {/* Middle Hill */}
          <path
            d="M -5,77 Q 32,56 68,68 Q 88,74 105,66 L 105,105 L -5,105 Z"
            fill={`url(#hillM_${shape})`}
          />

          {/* Front Bright Green Hill */}
          <path
            d="M -5,88 Q 38,65 105,82 L 105,105 L -5,105 Z"
            fill={`url(#hillF_${shape})`}
          />
        </g>

        {/* Outer outline contour for crisp shape definition */}
        <path
          d={pathD}
          fill="none"
          stroke="rgba(139, 61, 255, 0.25)"
          strokeWidth="1.2"
          className="group-hover:stroke-[#8b3dff] transition-colors"
        />
      </svg>
    );
  };

  return (
    <div className="p-4 space-y-4 select-none custom-scrollbar">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 p-3 rounded-2xl border border-purple-100 flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[#8b3dff] text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-purple-300">
          <Crop className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-gray-900">Canva Photo Frames</h3>
          <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
            Click to insert any frame. Drop photos directly onto frames or use Replace Photo.
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search frames (e.g. circle, phone, arch)..."
          className="w-full pl-8.5 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#8b3dff] focus:bg-white transition"
        />
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: 'All', icon: Shapes },
          { id: 'basic', label: 'Shapes', icon: Shapes },
          { id: 'devices', label: 'Devices', icon: Smartphone },
          { id: 'creative', label: 'Creative', icon: Sparkles },
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                isActive
                  ? 'bg-[#8b3dff] text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Frames Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleAddFrame(preset)}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-gray-200/90 bg-white hover:bg-purple-50/30 hover:border-[#8b3dff] transition-all group shadow-2xs hover:shadow-md cursor-pointer"
            title={`Insert ${preset.name} Frame`}
          >
            <div className="mb-2.5 flex items-center justify-center">
              {renderFrameThumbnail(preset.shape, preset.name)}
            </div>
            <span className="text-xs font-semibold text-gray-800 group-hover:text-[#8b3dff] transition-colors">
              {preset.name}
            </span>
            {preset.description && (
              <span className="text-[10px] text-gray-400 truncate max-w-full text-center mt-0.5">
                {preset.description}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredPresets.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-xs">No frames match &quot;{searchQuery}&quot;</p>
        </div>
      )}
    </div>
  );
};
