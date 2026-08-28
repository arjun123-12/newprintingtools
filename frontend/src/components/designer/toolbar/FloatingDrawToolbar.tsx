'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MousePointer2,
  Minus,
  Type,
  PenTool,
  StickyNote,
  Table,
  Sliders,
  Sparkles,
  Check,
  Palette,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { ActiveSidebarTab } from '@/types/designer';

interface FloatingDrawToolbarProps {
  canvasManager: CanvasManager | null;
  onClose: () => void;
  onSelectTab: (tab: ActiveSidebarTab | null) => void;
}

// Preset Canva Drawing Colors
const CANVA_DRAW_PALETTE = [
  '#000000', // Black
  '#3b82f6', // Ocean Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#eab308', // Gold
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b3dff', // Canva Purple
  '#64748b', // Slate
  '#ffffff', // White
];

export const FloatingDrawToolbar: React.FC<FloatingDrawToolbarProps> = ({
  canvasManager,
  onClose,
  onSelectTab,
}) => {
  const [activeTool, setActiveTool] = useState<string>('pencil');
  const [isPenFlyoutOpen, setIsPenFlyoutOpen] = useState<boolean>(true);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const [isWeightSliderOpen, setIsWeightSliderOpen] = useState<boolean>(false);

  // Brush settings state
  const [drawColor, setDrawColor] = useState<string>('#f59e0b');
  const [drawSize, setDrawSize] = useState<number>(6);
  const [drawOpacity, setDrawOpacity] = useState<number>(1.0);

  const colorPopRef = useRef<HTMLDivElement | null>(null);
  const weightPopRef = useRef<HTMLDivElement | null>(null);

  // Sync with CanvasManager brush settings
  useEffect(() => {
    if (!canvasManager) return;

    const updateState = () => {
      const isDrawing = canvasManager.isDrawingMode();
      const settings = canvasManager.getBrushSettings();
      if (isDrawing) {
        setActiveTool(settings.tool);
        setDrawColor(settings.color || '#f59e0b');
        setDrawSize(settings.size || 6);
        setDrawOpacity(settings.opacity !== undefined ? settings.opacity : 1.0);
      } else {
        setActiveTool('select');
      }
    };

    updateState();
    const unsub = canvasManager.onDrawingModeChange(updateState);
    const unsubBrush = canvasManager.onBrushSettingsChange(updateState);
    return () => {
      unsub();
      unsubBrush();
    };
  }, [canvasManager]);

  // Click outside listener for popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPopRef.current && !colorPopRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
      if (weightPopRef.current && !weightPopRef.current.contains(e.target as Node)) {
        setIsWeightSliderOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectDrawingTool = (tool: 'pencil' | 'marker' | 'brush' | 'eraser') => {
    if (!canvasManager) return;
    setActiveTool(tool);

    let defaultSize = drawSize;
    let defaultOpacity = drawOpacity;

    if (tool === 'pencil') {
      defaultSize = 4;
      defaultOpacity = 1.0;
    } else if (tool === 'marker') {
      defaultSize = 12;
      defaultOpacity = 0.75;
    } else if (tool === 'brush') {
      // Highlighter
      defaultSize = 24;
      defaultOpacity = 0.35;
    } else if (tool === 'eraser') {
      defaultSize = 20;
    }

    setDrawSize(defaultSize);
    setDrawOpacity(defaultOpacity);

    canvasManager.setBrushSettings({
      tool,
      size: defaultSize,
      color: drawColor,
      opacity: defaultOpacity,
    });
    canvasManager.setDrawingMode(true);
  };

  const handleColorChange = (color: string) => {
    setDrawColor(color);
    if (!canvasManager) return;
    canvasManager.setBrushSettings({
      ...canvasManager.getBrushSettings(),
      color,
    });
  };

  const handleSizeChange = (size: number) => {
    setDrawSize(size);
    if (!canvasManager) return;
    canvasManager.setBrushSettings({
      ...canvasManager.getBrushSettings(),
      size,
    });
  };

  const handleOpacityChange = (opacity: number) => {
    setDrawOpacity(opacity);
    if (!canvasManager) return;
    canvasManager.setBrushSettings({
      ...canvasManager.getBrushSettings(),
      opacity,
    });
  };

  return (
    <div className="absolute left-5 top-1/2 -translate-y-1/2 z-50 flex items-start gap-2.5 animate-in fade-in slide-in-from-left-4 duration-200 select-none">
      {/* 1. LEFT MAIN NAVIGATION DOCK */}
      <div className="flex flex-col items-center">
        {/* Close Button at top */}
        <button
          type="button"
          onClick={() => {
            canvasManager?.disableDrawingMode();
            onClose();
          }}
          className="w-8 h-8 mb-3 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition hover:shadow-lg"
          title="Close Draw Tools (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Vertical Dock Pill Container */}
        <div className="bg-white rounded-[26px] shadow-2xl border border-gray-200/90 py-3 px-2 flex flex-col items-center gap-2">
          {/* Select / Cursor Tool */}
          <button
            type="button"
            onClick={() => {
              canvasManager?.disableDrawingMode();
              setActiveTool('select');
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${activeTool === 'select'
              ? 'bg-slate-100 text-slate-900 shadow-2xs'
              : 'text-slate-700 hover:bg-slate-50'
              }`}
            title="Select & Move Tool"
          >
            <MousePointer2 className="w-4 h-4 -rotate-45" />
          </button>

          {/* Canva Pen Tool (Opens the Flyout Draw Drawer) */}
          <button
            type="button"
            onClick={() => {
              setIsPenFlyoutOpen((prev) => !prev);
              selectDrawingTool('pencil');
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isPenFlyoutOpen || activeTool !== 'select'
              ? 'bg-slate-200/80 text-rose-500 shadow-2xs ring-1 ring-slate-300'
              : 'text-slate-700 hover:bg-slate-50'
              }`}
            title="Draw & Pens"
          >
            <div className="relative flex flex-col items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
              <span className="w-3 h-0.5 bg-rose-500 rounded-full mt-0.5" />
            </div>
          </button>

          {/* Shapes Tool */}
          <button
            type="button"
            onClick={() => {
              canvasManager?.disableDrawingMode();
              onSelectTab('elements');
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
            title="Shapes & Elements"
          >
            <div className="relative w-4 h-4 flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-full bg-slate-500 absolute -top-0.5 -left-0.5 opacity-80" />
              <div className="w-3.5 h-3.5 rounded-xs bg-slate-900 absolute -bottom-0.5 -right-0.5" />
            </div>
          </button>

          {/* Line Tool */}
          {/* <button
            type="button"
            onClick={() => {
              canvasManager?.disableDrawingMode();
              onSelectTab('elements');
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
            title="Draw Lines"
          >
            <Minus className="w-4 h-4 -rotate-45 text-blue-500" strokeWidth={3} />
          </button> */}

          {/* Sticky Note */}
          <button
            type="button"
            onClick={() => {
              canvasManager?.disableDrawingMode();
              onSelectTab('elements');
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
            title="Sticky Note"
          >
            <StickyNote className="w-4 h-4 text-amber-500 fill-amber-500/90" />
          </button>

          {/* Text Tool */}
          {/* <button
            type="button"
            onClick={() => {
              canvasManager?.disableDrawingMode();
              onSelectTab('text');
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
            title="Add Text"
          >
            <span className="font-serif font-black text-purple-600 text-base leading-none">
              T
            </span>
          </button> */}

          {/* Signature / Freehand Pen */}
          {/* <button
            type="button"
            onClick={() => selectDrawingTool('pencil')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-800 hover:bg-slate-50 transition"
            title="Signature Path"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
              <path d="M10 17h4" />
            </svg>
          </button> */}

          {/* Grid / Table Tool */}
          {/* <button
            type="button"
            onClick={() => {
              canvasManager?.disableDrawingMode();
              onSelectTab('elements');
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
            title="Grid & Tables"
          >
            <Table className="w-4 h-4 text-blue-900" />
          </button> */}
        </div>
      </div>

      {/* 2. CANVA DRAWING TOOLS FLYOUT PANEL (Pens, Eraser, Swatch, Weight) */}
      {isPenFlyoutOpen && (
        <div className="bg-white rounded-[26px] shadow-2xl border border-gray-200/90 py-3.5 px-2 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-150 relative">
          {/* Tool 1: Fine-Tip Pen */}
          <button
            type="button"
            onClick={() => selectDrawingTool('pencil')}
            className={`group relative transition-all duration-150 ${activeTool === 'pencil' ? 'translate-x-2 drop-shadow-md scale-105' : 'hover:translate-x-1 opacity-90 hover:opacity-100'
              }`}
            title="Pen (Fine Tip)"
          >
            <svg width="58" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Pen Barrel */}
              <rect x="0" y="5" width="36" height="14" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
              {/* Blue Ring Accent */}
              <rect x="28" y="5" width="4" height="14" fill="#0284C7" />
              {/* White Cone Tip */}
              <path d="M36 5L48 9.5V14.5L36 19V5Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
              {/* Metal Collar */}
              <rect x="48" y="9" width="3" height="6" rx="0.5" fill="#0284C7" />
              {/* Fine Pointed Nib */}
              <path d="M51 9.8L58 12L51 14.2V9.8Z" fill="#0284C7" />
            </svg>
          </button>

          {/* Tool 2: Felt-Tip Marker */}
          <button
            type="button"
            onClick={() => selectDrawingTool('marker')}
            className={`group relative transition-all duration-150 ${activeTool === 'marker' ? 'translate-x-2 drop-shadow-md scale-105' : 'hover:translate-x-1 opacity-90 hover:opacity-100'
              }`}
            title="Marker (Felt Tip)"
          >
            <svg width="66" height="24" viewBox="0 0 68 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Marker Barrel */}
              <rect x="0" y="4" width="40" height="16" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
              {/* Orange Squiggle on Barrel */}
              <path d="M10 12Q13 9 16 12T22 12" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              {/* Orange Ring Accent */}
              <rect x="33" y="4" width="4" height="16" fill="#F59E0B" />
              {/* White Shoulder Cone */}
              <path d="M40 4L52 8.5V15.5L40 20V4Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
              {/* Orange Bullet Nib */}
              <path d="M52 8.5C52 8.5 59 10 60 12C59 14 52 15.5 52 15.5V8.5Z" fill="#F59E0B" />
            </svg>
          </button>

          {/* Tool 3: Highlighter */}
          <button
            type="button"
            onClick={() => selectDrawingTool('brush')}
            className={`group relative transition-all duration-150 ${activeTool === 'brush' ? 'translate-x-2 drop-shadow-md scale-105' : 'hover:translate-x-1 opacity-90 hover:opacity-100'
              }`}
            title="Highlighter (Chisel Tip)"
          >
            <svg width="58" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Wide Flat Barrel */}
              <rect x="0" y="3" width="34" height="18" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
              {/* Yellow Ring Accent */}
              <rect x="26" y="3" width="4" height="18" fill="#FACC15" />
              {/* White Shoulder */}
              <path d="M34 3L45 7V17L34 21V3Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
              {/* Angled Yellow Chisel Nib */}
              <path d="M45 7L54 7.5L50 16.5L45 17V7Z" fill="#FACC15" />
            </svg>
          </button>

          {/* Tool 4: Eraser */}
          <button
            type="button"
            onClick={() => selectDrawingTool('eraser')}
            className={`group relative transition-all duration-150 ${activeTool === 'eraser' ? 'translate-x-2 drop-shadow-md scale-105' : 'hover:translate-x-1 opacity-90 hover:opacity-100'
              }`}
            title="Eraser (Erase Drawing Strokes)"
          >
            <svg width="58" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Pink Body */}
              <rect x="0" y="4" width="42" height="16" rx="2" fill="#FB7185" />
              {/* White Center Band */}
              <rect x="30" y="4" width="4" height="16" fill="#FFFFFF" fillOpacity="0.85" />
              {/* Dark Pink Bevel End */}
              <path d="M42 4L49 6.5C51 7.5 52 9.5 52 12C52 14.5 51 16.5 49 17.5L42 20V4Z" fill="#E11D48" />
            </svg>
          </button>

          <div className="w-8 h-px bg-gray-200 my-0.5" />

          {/* Tool 5: Color Swatch Circle */}
          <div className="relative" ref={colorPopRef}>
            <button
              type="button"
              onClick={() => {
                setIsColorPickerOpen((prev) => !prev);
                setIsWeightSliderOpen(false);
              }}
              className="w-8 h-8 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform ring-1 ring-black/10"
              style={{ backgroundColor: drawColor }}
              title="Change Drawing Color"
            />

            {/* Canva Color Swatch Popover */}
            {isColorPickerOpen && (
              <div className="absolute left-full top-0 ml-3 bg-white rounded-2xl shadow-2xl border border-gray-200/90 p-3 w-56 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800">Drawing Color</span>
                  <button
                    type="button"
                    onClick={() => setIsColorPickerOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Preset Color Swatches Grid */}
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {CANVA_DRAW_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorChange(color)}
                      className={`w-6 h-6 rounded-full border border-black/10 transition hover:scale-110 flex items-center justify-center ${drawColor.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-purple-600 ring-offset-1' : ''
                        }`}
                      style={{ backgroundColor: color }}
                    >
                      {drawColor.toLowerCase() === color.toLowerCase() && (
                        <Check className={`w-3 h-3 ${color === '#ffffff' || color === '#eab308' ? 'text-black' : 'text-white'}`} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Hex Color Picker Input */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <input
                    type="color"
                    value={drawColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-7 h-7 rounded-lg border border-gray-200 cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={drawColor.toUpperCase()}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="flex-1 text-xs font-mono px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tool 6: Stroke Weight / Thickness (3 Horizontal Lines Icon) */}
          <div className="relative" ref={weightPopRef}>
            <button
              type="button"
              onClick={() => {
                setIsWeightSliderOpen((prev) => !prev);
                setIsColorPickerOpen(false);
              }}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${isWeightSliderOpen ? 'bg-slate-100 text-purple-600' : 'text-slate-800 hover:bg-slate-50'
                }`}
              title="Stroke Weight & Transparency"
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="w-4 h-0.5 bg-slate-900 rounded-full" />
                <span className="w-4 h-[3px] bg-slate-900 rounded-full" />
                <span className="w-4 h-1 bg-slate-900 rounded-full" />
              </div>
            </button>

            {/* Canva Weight & Transparency Popover */}
            {isWeightSliderOpen && (
              <div className="absolute left-full top-0 ml-3 bg-white rounded-2xl shadow-2xl border border-gray-200/90 p-4 w-60 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">Brush Settings</span>
                  <button
                    type="button"
                    onClick={() => setIsWeightSliderOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Weight / Size Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Weight</span>
                    <span className="font-mono font-semibold text-gray-900">{drawSize} px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={drawSize}
                    onChange={(e) => handleSizeChange(Number(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                  />
                </div>

                {/* Transparency / Opacity Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Transparency</span>
                    <span className="font-mono font-semibold text-gray-900">
                      {Math.round(drawOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={drawOpacity}
                    onChange={(e) => handleOpacityChange(Number(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                  />
                </div>

                {/* Live Nib Preview Dot */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-center">
                  <div
                    className="rounded-full shadow-xs transition-all"
                    style={{
                      width: `${Math.max(4, Math.min(drawSize, 36))}px`,
                      height: `${Math.max(4, Math.min(drawSize, 36))}px`,
                      backgroundColor: drawColor,
                      opacity: drawOpacity,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
