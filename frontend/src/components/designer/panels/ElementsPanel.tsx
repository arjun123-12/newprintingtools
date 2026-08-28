'use client';

import React from 'react';
import { Square, Circle, Triangle, Star, Crop, Sparkles, Plus, ChevronRight } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { FRAME_PRESETS, FRAME_SVG_PATHS } from '../data/framesData';
import { FrameShapeType, ActiveSidebarTab } from '@/types/designer';

interface ElementsPanelProps {
  canvasManager: CanvasManager | null;
  onSelectTab?: (tab: ActiveSidebarTab) => void;
}

export const ElementsPanel: React.FC<ElementsPanelProps> = ({ canvasManager, onSelectTab }) => {
  const handleAddShape = (type: string, color = '#2563eb') => {
    if (!canvasManager) return;
    canvasManager.addShape(type, color);
  };

  const handleAddFrame = (shape: FrameShapeType) => {
    if (!canvasManager) return;
    canvasManager.addFrame(shape);
  };

  const renderFrameThumbnail = (shape: FrameShapeType) => {
    const pathD = FRAME_SVG_PATHS[shape] || FRAME_SVG_PATHS.circle;
    const clipId = `el_clip_${shape}`;

    return (
      <svg
        viewBox="0 0 100 100"
        className="w-10 h-10 drop-shadow-2xs transition-transform duration-200 group-hover:scale-110"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={pathD} clipRule="evenodd" />
          </clipPath>

          <linearGradient id={`el_sky_${shape}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ea8de" />
            <stop offset="60%" stopColor="#72bfe8" />
            <stop offset="100%" stopColor="#cbeaf8" />
          </linearGradient>
          <linearGradient id={`el_hillB_${shape}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64a322" />
            <stop offset="100%" stopColor="#467b12" />
          </linearGradient>
          <linearGradient id={`el_hillM_${shape}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#82c330" />
            <stop offset="100%" stopColor="#5a9718" />
          </linearGradient>
          <linearGradient id={`el_hillF_${shape}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9bdc3e" />
            <stop offset="100%" stopColor="#76b825" />
          </linearGradient>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <rect width="100" height="100" fill={`url(#el_sky_${shape})`} />
          <g fill="#ffffff" opacity="0.95">
            <ellipse cx="54" cy="36" rx="16" ry="8" />
            <ellipse cx="40" cy="39" rx="11" ry="6" />
            <ellipse cx="67" cy="39" rx="9" ry="5" />
          </g>
          <path
            d="M -5,68 Q 24,48 56,57 Q 82,64 105,50 L 105,105 L -5,105 Z"
            fill={`url(#el_hillB_${shape})`}
          />
          <path
            d="M -5,77 Q 32,56 68,68 Q 88,74 105,66 L 105,105 L -5,105 Z"
            fill={`url(#el_hillM_${shape})`}
          />
          <path
            d="M -5,88 Q 38,65 105,82 L 105,105 L -5,105 Z"
            fill={`url(#el_hillF_${shape})`}
          />
        </g>
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
    <div className="p-4 space-y-5 select-none custom-scrollbar">
      {/* Canva Photo Frames (Top Spotlight) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wider">
            <Crop className="w-3.5 h-3.5 text-[#8b3dff]" />
            <span>Frames</span>
          </div>
          {onSelectTab && (
            <button
              type="button"
              onClick={() => onSelectTab('frames')}
              className="text-[11px] font-semibold text-[#8b3dff] hover:text-purple-700 flex items-center gap-0.5 transition"
            >
              <span>See all</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {FRAME_PRESETS.slice(0, 6).map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => handleAddFrame(frame.shape)}
              className="flex flex-col items-center justify-center p-2 rounded-xl border border-gray-200 bg-white hover:bg-purple-50/40 hover:border-[#8b3dff] transition group shadow-2xs cursor-pointer"
              title={`Insert ${frame.name} Frame`}
            >
              <div className="mb-1">{renderFrameThumbnail(frame.shape)}</div>
              <span className="text-[10px] font-semibold text-gray-700 group-hover:text-[#8b3dff] truncate max-w-full">
                {frame.name.replace(' Frame', '')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Basic Shapes */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Shapes
          </h3>
          <span className="text-[10px] text-gray-400">Vector</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleAddShape('rect', '#2563eb')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 transition group shadow-2xs"
            title="Rectangle"
          >
            <Square className="w-6 h-6 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-medium text-gray-600">Rect</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddShape('circle', '#10b981')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-emerald-300 transition group shadow-2xs"
            title="Circle"
          >
            <Circle className="w-6 h-6 text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-medium text-gray-600">Circle</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddShape('triangle', '#f59e0b')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-amber-300 transition group shadow-2xs"
            title="Triangle"
          >
            <Triangle className="w-6 h-6 text-amber-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-medium text-gray-600">Triangle</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddShape('star', '#8b5cf6')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-purple-300 transition group shadow-2xs"
            title="Star"
          >
            <Star className="w-6 h-6 text-purple-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-medium text-gray-600">Star</span>
          </button>
        </div>
      </div>

      {/* Quick Banners & Badges */}
      {/* <div className="border-t border-gray-100 pt-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Quick Accent Banners</span>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleAddShape('rect', '#ef4444')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-xs font-medium transition shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-red-500" />
              <span>Red Sale Badge</span>
            </div>
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>

          <button
            type="button"
            onClick={() => handleAddShape('rect', '#6366f1')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-xs font-medium transition shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-indigo-500" />
              <span>Indigo Header Strip</span>
            </div>
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div> */}
    </div>
  );
};
