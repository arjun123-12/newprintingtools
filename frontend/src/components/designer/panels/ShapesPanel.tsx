'use client';

import React from 'react';
import { Square, Circle, Triangle, Star } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';

interface ShapesPanelProps {
  canvasManager: CanvasManager | null;
}

export const ShapesPanel: React.FC<ShapesPanelProps> = ({ canvasManager }) => {
  return (
    <div className="p-4 space-y-4 select-none custom-scrollbar">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
          Shapes
        </h3>
        <span className="text-[10px] text-gray-400">Vector Tools</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => canvasManager?.addShape('rect', '#2563eb')}
          className="p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 flex flex-col items-center justify-center gap-1.5 transition shadow-2xs group"
        >
          <Square className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold">Rectangle</span>
        </button>

        <button
          type="button"
          onClick={() => canvasManager?.addShape('circle', '#10b981')}
          className="p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 flex flex-col items-center justify-center gap-1.5 transition shadow-2xs group"
        >
          <Circle className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold">Circle</span>
        </button>

        <button
          type="button"
          onClick={() => canvasManager?.addShape('triangle', '#f59e0b')}
          className="p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 flex flex-col items-center justify-center gap-1.5 transition shadow-2xs group"
        >
          <Triangle className="w-6 h-6 text-amber-500 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold">Triangle</span>
        </button>

        <button
          type="button"
          onClick={() => canvasManager?.addShape('star', '#8b5cf6')}
          className="p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 flex flex-col items-center justify-center gap-1.5 transition shadow-2xs group"
        >
          <Star className="w-6 h-6 text-purple-500 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold">Star</span>
        </button>
      </div>
    </div>
  );
};
