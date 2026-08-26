'use client';

import React from 'react';
import { Square, Circle, Triangle, Star, Crop, Sparkles, Plus, Layers } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { FRAME_PRESETS } from '../data/framesData';

interface ElementsPanelProps {
  canvasManager: CanvasManager | null;
}

export const ElementsPanel: React.FC<ElementsPanelProps> = ({ canvasManager }) => {
  const handleAddShape = (type: string, color = '#2563eb') => {
    if (!canvasManager) return;
    canvasManager.addShape(type, color);
  };

  const handleAddFrame = (shape: any) => {
    if (!canvasManager) return;
    canvasManager.addFrame(shape);
  };

  return (
    <div className="p-4 space-y-5 select-none custom-scrollbar">
      {/* Basic Shapes */}
      <div>
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

      {/* Photo Frames */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wider">
            <Crop className="w-3.5 h-3.5 text-blue-600" />
            <span>Photo Frames</span>
          </div>
          <span className="text-[10px] text-gray-400">Clip Masks</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {FRAME_PRESETS.slice(0, 6).map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => handleAddFrame(frame.shape)}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 transition group shadow-2xs"
            >
              <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-1 group-hover:scale-110 transition-transform">
                <Crop className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium text-gray-700 truncate max-w-full">
                {frame.name.replace(' Frame', '')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Banners & Badges */}
      <div className="border-t border-gray-100 pt-4 space-y-2">
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
      </div>
    </div>
  );
};
