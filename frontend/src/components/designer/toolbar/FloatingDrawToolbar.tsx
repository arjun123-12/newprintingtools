'use client';

import React, { useState, useEffect } from 'react';
import {
  X, MousePointer2, Pencil, Paintbrush,
  Minus, Square, Type, PenTool, Grid, StickyNote
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { ActiveSidebarTab } from '@/types/designer';

interface FloatingDrawToolbarProps {
  canvasManager: CanvasManager | null;
  onClose: () => void;
  onSelectTab: (tab: ActiveSidebarTab | null) => void;
}

export const FloatingDrawToolbar: React.FC<FloatingDrawToolbarProps> = ({
  canvasManager,
  onClose,
  onSelectTab,
}) => {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasManager) return;

    const updateState = () => {
      const drawing = canvasManager.isDrawingMode();
      if (drawing) {
        const settings = canvasManager.getBrushSettings();
        setActiveTool(settings.tool);
      } else {
        setActiveTool('select');
      }
    };

    updateState();
    const unsub = canvasManager.onDrawingModeChange(updateState);
    return () => unsub();
  }, [canvasManager]);

  const handleToolClick = (toolId: string) => {
    if (!canvasManager) return;

    if (toolId === 'select') {
      canvasManager.disableDrawingMode();
      setActiveTool('select');
      return;
    }

    if (toolId === 'pencil' || toolId === 'brush' || toolId === 'marker' || toolId === 'calligraphy') {
      const settings = canvasManager.getBrushSettings();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasManager.setBrushSettings({ ...settings, tool: toolId as any });
      canvasManager.setDrawingMode(true);
      setActiveTool(toolId);
      return;
    }

    if (toolId === 'line') {
      canvasManager.disableDrawingMode();
      onSelectTab('elements');
      return;
    }

    if (toolId === 'shape') {
      canvasManager.disableDrawingMode();
      onSelectTab('elements');
      return;
    }

    if (toolId === 'text') {
      canvasManager.disableDrawingMode();
      onSelectTab('text');
      return;
    }

    // if (toolId === 'table') {
    //   canvasManager.disableDrawingMode();
    //   alert('Table / Grid tool is not currently integrated.');
    //   return;
    // }
  };

  const getToolClass = (toolId: string) => {
    const isActive = activeTool === toolId;
    return `w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group ${isActive
      ? 'bg-[#f0ebff] text-[#7c3aed] shadow-sm'
      : 'text-gray-600 hover:bg-gray-100'
      }`;
  };

  const getIconClass = (toolId: string, customColor?: string) => {
    const isActive = activeTool === toolId;
    if (isActive) return 'w-5 h-5 text-[#7c3aed] transition-colors';
    return `w-5 h-5 transition-colors ${customColor ? customColor : 'text-gray-600'}`;
  };

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center animate-in fade-in slide-in-from-left-4 duration-300">
      {/* Close Button */}
      <button
        onClick={() => {
          canvasManager?.disableDrawingMode();
          onClose();
        }}
        className="w-9 h-9 mb-4 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition hover:shadow-lg"
        title="Close Draw Tools"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Toolbar Container */}
      <div className="bg-white rounded-[20px] shadow-xl border border-gray-200/70 p-2 flex flex-col gap-1">
        {/* Select / Pointer */}
        <button
          onClick={() => handleToolClick('select')}
          className={getToolClass('select')}
          title="Select"
        >
          <MousePointer2 className={getIconClass('select', 'text-[#7c3aed]')} />
        </button>

        {/* Pencil */}
        <button
          onClick={() => handleToolClick('pencil')}
          className={getToolClass('pencil')}
          title="Pencil"
        >
          <Pencil className={getIconClass('pencil', 'text-rose-500')} />
        </button>

        {/* Marker / Brush */}
        <button
          onClick={() => handleToolClick('brush')}
          className={getToolClass('brush')}
          title="Marker"
        >
          <div className="relative flex items-center justify-center">
            <Paintbrush className={getIconClass('brush', 'text-slate-800')} />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-slate-800 rounded-sm" />
          </div>
        </button>

        {/* Line */}
        <button
          onClick={() => handleToolClick('line')}
          className={getToolClass('line')}
          title="Line"
        >
          <Minus className={`${getIconClass('line', 'text-blue-500')} -rotate-45`} strokeWidth={3} />
        </button>

        {/* Shape */}
        <button
          onClick={() => handleToolClick('shape')}
          className={getToolClass('shape')}
          title="Shape"
        >
          <StickyNote className={getIconClass('shape', 'text-amber-500')} fill="currentColor" />
        </button>

        {/* Text */}
        <button
          onClick={() => handleToolClick('text')}
          className={getToolClass('text')}
          title="Text"
        >
          <Type className={getIconClass('text', 'text-purple-500')} strokeWidth={2.5} />
        </button>

        {/* Pen / Signature */}
        <button
          onClick={() => handleToolClick('calligraphy')}
          className={getToolClass('calligraphy')}
          title="Pen"
        >
          <PenTool className={getIconClass('calligraphy', 'text-slate-900')} />
        </button>

        {/* Table / Grid */}
        {/* <button
          onClick={() => handleToolClick('table')}
          className={getToolClass('table')}
          title="Table"
        >
          <Grid className={getIconClass('table', 'text-blue-900')} fill="currentColor" fillOpacity={0.2} />
        </button> */}
      </div>
    </div>
  );
};
