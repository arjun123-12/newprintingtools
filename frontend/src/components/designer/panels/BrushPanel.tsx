'use client';

import React, { useState, useEffect } from 'react';
import {
  Paintbrush,
  Pencil,
  Highlighter,
  Feather,
  Sparkles,
  Eraser,
  Sliders,
  CheckCircle2,
  MousePointer,
  Circle,
  Square,
  Sparkle,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { BrushSettings, BrushType } from '@/types/designer';
import { ColorPicker } from '../controls/ColorPicker';
import { hexToCmyk, cmykToHex } from '../utils/cmyk';

interface BrushPanelProps {
  canvasManager: CanvasManager | null;
}

interface ToolPreset {
  id: BrushType;
  name: string;
  desc: string;
  icon: React.ElementType;
  defaultSize: number;
  defaultOpacity: number;
}

const BRUSH_TOOLS: ToolPreset[] = [
  {
    id: 'brush',
    name: 'Freehand Brush',
    desc: 'Smooth natural curves & pressure simulation',
    icon: Paintbrush,
    defaultSize: 12,
    defaultOpacity: 1.0,
  },
  {
    id: 'pencil',
    name: 'Pencil Tool',
    desc: 'Crisp, fine detailed vector sketching',
    icon: Pencil,
    defaultSize: 4,
    defaultOpacity: 1.0,
  },
  {
    id: 'marker',
    name: 'Marker Tool',
    desc: 'Translucent wide chisel strokes & highlighters',
    icon: Highlighter,
    defaultSize: 24,
    defaultOpacity: 0.35,
  },
  {
    id: 'calligraphy',
    name: 'Calligraphy Pen',
    desc: 'Flat-nib italic angle artistic lettering',
    icon: Feather,
    defaultSize: 16,
    defaultOpacity: 1.0,
  },
  {
    id: 'spray',
    name: 'Spray Paint',
    desc: 'Atmospheric particle spray & splatter textures',
    icon: Sparkles,
    defaultSize: 28,
    defaultOpacity: 0.8,
  },
  {
    id: 'eraser',
    name: 'Eraser',
    desc: 'Clean path eraser tool',
    icon: Eraser,
    defaultSize: 20,
    defaultOpacity: 1.0,
  },
];

export const BrushPanel: React.FC<BrushPanelProps> = ({ canvasManager }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [settings, setSettings] = useState<BrushSettings>({
    tool: 'brush',
    size: 12,
    color: '#2563eb',
    opacity: 1.0,
    smoothness: 1.0,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    sprayDensity: 25,
    sprayDotWidth: 2,
    calligraphyAngle: 45,
  });

  useEffect(() => {
    if (!canvasManager) return;

    setIsDrawing(canvasManager.isDrawingMode());
    setSettings(canvasManager.getBrushSettings());

    const unsubMode = canvasManager.onDrawingModeChange((mode) => setIsDrawing(mode));
    const unsubSettings = canvasManager.onBrushSettingsChange((s) => setSettings(s));

    return () => {
      unsubMode();
      unsubSettings();
      if (canvasManager) {
        canvasManager.disableDrawingMode();
        if (canvasManager.getBrushSettings().tool === 'eraser') {
          canvasManager.setBrushSettings({ tool: 'brush' });
        }
      }
    };
  }, [canvasManager]);

  const handleToggleDrawingMode = (enabled: boolean) => {
    if (!canvasManager) return;
    canvasManager.setDrawingMode(enabled);
    setIsDrawing(enabled);
  };
  const handleSelectTool = (tool: BrushType) => {
    if (!canvasManager) return;

    const preset = BRUSH_TOOLS.find((item) => item.id === tool);

    const updated: BrushSettings = {
      ...settings,
      tool,
      size: preset?.defaultSize ?? settings.size,
      opacity: preset?.defaultOpacity ?? settings.opacity,
    };

    setSettings(updated);
    canvasManager.setBrushSettings(updated);
    canvasManager.setDrawingMode(true);
    setIsDrawing(true);
  };
  const handleUpdateSetting = <K extends keyof BrushSettings>(
    key: K,
    val: BrushSettings[K]
  ) => {
    if (!canvasManager) return;

    const updated: BrushSettings = {
      ...settings,
      [key]: val,
    };

    setSettings(updated);
    canvasManager.setBrushSettings(updated);
  };

  return (
    <div className="p-4 space-y-5 select-none custom-scrollbar">
      {/* Header & Mode Toggle Button */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-1.5">
          <Paintbrush className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Illustrator Draw
          </h3>
        </div>
        <button
          type="button"
          onClick={() => handleToggleDrawingMode(!isDrawing)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${isDrawing
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          {isDrawing ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Drawing Active</span>
            </>
          ) : (
            <>
              <MousePointer className="w-3.5 h-3.5 text-gray-500" />
              <span>Start Drawing</span>
            </>
          )}
        </button>
      </div>

      {/* Drawing Tools Grid */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
          Brush Types
        </label>

        <div className="grid grid-cols-3 gap-1">
          {BRUSH_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isSelected = settings.tool === tool.id && isDrawing;

            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleSelectTool(tool.id)}
                className={`
        p-2.5 rounded-lg border
        flex flex-col items-start gap-1
        text-left transition-all duration-200
        shadow-xs group
        min-w-0 w-full
        ${isSelected
                    ? 'border-[#8b5cf6] bg-[#f3f0ff] ring-1 ring-[#8b5cf6]/20'
                    : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                  }
      `}
              >
                <div className="flex items-center justify-between w-full">
                  <div
                    className={`
            p-1 rounded-md transition
            ${isSelected
                        ? 'bg-[#7c3aed] text-white'
                        : 'bg-gray-100 text-gray-600 group-hover:text-gray-900'
                      }
          `}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" />
                  )}
                </div>

                <h4 className="text-[11px] font-semibold text-gray-900 break-words leading-tight">
                  {tool.name}
                </h4>
              </button>
            );
          })}
        </div>
      </div>

      {/* Brush Size & Live Tip Preview */}
      {/* <div className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-gray-700">Brush Size / Width</label>
          <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {settings.size}px
          </span>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={80}
            value={settings.size}
            onChange={(e) => handleUpdateSetting('size', Number(e.target.value))}
            className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />

         
          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <div
              className="rounded-full transition-all shadow-xs"
              style={{
                width: `${Math.min(settings.size, 34)}px`,
                height: `${Math.min(settings.size, 34)}px`,
                backgroundColor: settings.color,
                opacity: settings.opacity,
              }}
            />
          </div>
        </div>
      </div> */}

      {/*       
      <div className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-gray-700">Brush Opacity / Alpha</label>
          <span className="text-xs font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
            {Math.round(settings.opacity * 100)}%
          </span>
        </div>

        <input
          type="range"
          min={0.1}
          max={1.0}
          step={0.05}
          value={settings.opacity}
          onChange={(e) => handleUpdateSetting('opacity', Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div> */}


      {/* <div className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2.5">
        <label className="text-[11px] font-bold text-gray-700 block">Stroke End Caps</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['round', 'square', 'butt'] as const).map((cap) => (
            <button
              key={cap}
              type="button"
              onClick={() => handleUpdateSetting('strokeLineCap', cap)}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold capitalize border transition ${settings.strokeLineCap === cap
                ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
              {cap}
            </button>
          ))}
        </div>
      </div> */}


      {/* <div className="border-t border-gray-100 pt-3">
        <ColorPicker
          label="Brush Print Ink (CMYK)"
          value={settings.color}
          onChange={(hex) => handleUpdateSetting('color', hex)}
        />
      </div> */}
    </div>
  );
};
