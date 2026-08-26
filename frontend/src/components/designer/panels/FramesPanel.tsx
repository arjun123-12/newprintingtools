'use client';

import React from 'react';
import { Circle, Square, Hexagon, Heart, Star, Diamond, Crop } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { FRAME_PRESETS } from '../data/framesData';
import { FramePreset, FrameShapeType } from '@/types/designer';

interface FramesPanelProps {
  canvasManager: CanvasManager | null;
}

export const FramesPanel: React.FC<FramesPanelProps> = ({ canvasManager }) => {
  const getIcon = (shape: FrameShapeType) => {
    switch (shape) {
      case 'circle':
        return <Circle className="w-8 h-8 text-blue-600" />;
      case 'heart':
        return <Heart className="w-8 h-8 text-rose-500 fill-rose-500/10" />;
      case 'star':
        return <Star className="w-8 h-8 text-amber-500 fill-amber-500/10" />;
      case 'hexagon':
        return <Hexagon className="w-8 h-8 text-emerald-500" />;
      case 'diamond':
        return <Diamond className="w-8 h-8 text-purple-500" />;
      case 'rounded-rect':
      default:
        return <Square className="w-8 h-8 text-indigo-500 rounded-lg" />;
    }
  };

  const handleAddFrame = (preset: FramePreset) => {
    if (!canvasManager) return;
    canvasManager.addFrame(preset.shape);
  };

  return (
    <div className="p-4 space-y-4 select-none custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Crop className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Photo Frames
          </h3>
        </div>
        <span className="text-[10px] text-gray-400">ClipMasks</span>
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Click to insert photo frames. You can crop, move, and replace images within any frame mask.
      </p>

      {/* Frames Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {FRAME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleAddFrame(preset)}
            draggable
            onDragEnd={() => handleAddFrame(preset)}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 transition group shadow-2xs"
          >
            <div className="mb-2 group-hover:scale-110 transition-transform">
              {getIcon(preset.shape)}
            </div>
            <span className="text-xs font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
              {preset.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
