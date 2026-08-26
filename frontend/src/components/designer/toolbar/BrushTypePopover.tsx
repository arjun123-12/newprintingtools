'use client';

import React from 'react';
import {
  Paintbrush,
  Pencil,
  Highlighter,
  Feather,
  Sparkles,
  Eraser,
  Check,
} from 'lucide-react';
import { BrushType } from '@/types/designer';

interface BrushTypePopoverProps {
  currentTool: BrushType;
  onSelectTool: (tool: BrushType) => void;
  onClose: () => void;
}

export const BRUSH_TOOLS_LIST = [
  {
    id: 'brush' as BrushType,
    name: 'Freehand Brush',
    desc: 'Smooth natural curves & pressure simulation',
    icon: Paintbrush,
    defaultSize: 12,
    defaultOpacity: 1.0,
  },
  {
    id: 'pencil' as BrushType,
    name: 'Pencil Tool',
    desc: 'Crisp, fine detailed vector sketching',
    icon: Pencil,
    defaultSize: 4,
    defaultOpacity: 1.0,
  },
  {
    id: 'marker' as BrushType,
    name: 'Marker Tool',
    desc: 'Translucent wide chisel strokes & highlighters',
    icon: Highlighter,
    defaultSize: 24,
    defaultOpacity: 0.35,
  },
  {
    id: 'calligraphy' as BrushType,
    name: 'Calligraphy Pen',
    desc: 'Flat-nib italic angle artistic lettering',
    icon: Feather,
    defaultSize: 16,
    defaultOpacity: 1.0,
  },
  {
    id: 'spray' as BrushType,
    name: 'Spray Paint',
    desc: 'Atmospheric particle spray & splatter textures',
    icon: Sparkles,
    defaultSize: 28,
    defaultOpacity: 0.8,
  },
  {
    id: 'eraser' as BrushType,
    name: 'Eraser',
    desc: 'Clean path eraser tool',
    icon: Eraser,
    defaultSize: 20,
    defaultOpacity: 1.0,
  },
];

export const BrushTypePopover: React.FC<BrushTypePopoverProps> = ({
  currentTool,
  onSelectTool,
  onClose,
}) => {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-1.5"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-1">
        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <Paintbrush className="w-3.5 h-3.5 text-blue-600" />
          <span>Select Brush Type</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-0.5">
        {BRUSH_TOOLS_LIST.map((tool) => {
          const Icon = tool.icon;
          const isSelected = currentTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => {
                onSelectTool(tool.id);
                onClose();
              }}
              className={`p-2.5 rounded-xl border flex flex-col items-start gap-1 transition text-left group ${
                isSelected
                  ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-2xs'
                  : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`p-1 rounded-lg transition ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 group-hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </div>
              <span className="text-[11px] font-bold leading-tight">{tool.name}</span>
              <span className="text-[9px] text-gray-500 leading-snug line-clamp-2">
                {tool.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
