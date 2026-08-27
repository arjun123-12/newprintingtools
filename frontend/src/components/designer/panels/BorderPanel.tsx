'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Minus, X, Pen } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';
import { ColorPicker } from '../controls/ColorPicker';

interface BorderPanelProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
  onClose?: () => void;
}

const WEIGHT_PRESETS = [0, 1, 2, 3, 4, 5, 8, 10, 15, 20];
const RADIUS_PRESETS = [
  { label: '0', val: 0 },
  { label: '4px', val: 4 },
  { label: '8px', val: 8 },
  { label: '16px', val: 16 },
  { label: '32px', val: 32 },
  { label: '64px', val: 64 },
  { label: 'Max', val: 100 },
];

type StrokeStyle = 'none' | 'solid' | 'dashed' | 'dotted';
type StrokePosition = 'inside' | 'outside';

export const BorderPanel: React.FC<BorderPanelProps> = ({ canvasManager, selected, onClose }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close color picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);

  if (!selected) {
    return (
      <div className="flex flex-col h-full bg-white text-gray-800 select-none">
        {onClose && (
          <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-white shrink-0">
            <h2 className="font-bold text-sm text-gray-900">Stroke</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-6 text-center text-gray-500 space-y-3 my-auto">
          <div className="w-12 h-12 rounded-2xl bg-[#f0ebff] text-[#7c3aed] flex items-center justify-center mx-auto shadow-2xs">
            <Pen className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-800">No element selected</h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            Select an element on your canvas to customize its stroke style, weight, colour, and corner rounding.
          </p>
        </div>
      </div>
    );
  }

  const strokeWidth = selected.strokeWidth || 0;
  const stroke = selected.stroke || '#000000';
  const rx = selected.rx || 0;
  const strokeDashArray = selected.strokeDashArray;
  const paintFirst = selected.paintFirst || 'fill';

  // Derive stroke style
  let currentStyle: StrokeStyle = 'none';
  if (strokeWidth > 0) {
    if (!strokeDashArray || strokeDashArray.length === 0) {
      currentStyle = 'solid';
    } else if (strokeDashArray[0] >= 6) {
      currentStyle = 'dashed';
    } else {
      currentStyle = 'dotted';
    }
  }

  // Derive stroke position from paintFirst
  // paintFirst: 'stroke' => stroke is under fill => acts as "outside"
  // paintFirst: 'fill' => fill is under stroke => acts as "inside" (stroke overlaps fill)
  const currentPosition: StrokePosition = paintFirst === 'stroke' ? 'outside' : 'inside';

  const handleUpdate = (prop: keyof SelectedObjectState, val: any) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty(prop, val);
  };

  const handleColorChange = (hex: string) => {
    handleUpdate('stroke', hex);
    if (strokeWidth === 0) {
      handleUpdate('strokeWidth', 2);
    }
  };

  const handleStepWidth = (delta: number) => {
    handleUpdate('strokeWidth', Math.max(0, strokeWidth + delta));
  };

  const handleStepRadius = (delta: number) => {
    const newR = Math.max(0, Math.min(100, rx + delta));
    handleUpdate('rx', newR);
    handleUpdate('ry', newR);
  };

  const handleStyleChange = (style: StrokeStyle) => {
    switch (style) {
      case 'none':
        handleUpdate('strokeWidth', 0);
        handleUpdate('strokeDashArray', null);
        break;
      case 'solid':
        if (strokeWidth === 0) handleUpdate('strokeWidth', 2);
        handleUpdate('strokeDashArray', null);
        break;
      case 'dashed':
        if (strokeWidth === 0) handleUpdate('strokeWidth', 2);
        handleUpdate('strokeDashArray', [8, 6]);
        break;
      case 'dotted':
        if (strokeWidth === 0) handleUpdate('strokeWidth', 2);
        handleUpdate('strokeDashArray', [2, 4]);
        break;
    }
  };

  const handlePositionChange = (pos: StrokePosition) => {
    handleUpdate('paintFirst', pos === 'outside' ? 'stroke' : 'fill');
    handleUpdate('strokeUniform', true);
  };

  const canRoundCorners = selected.type === 'rect' || selected.type === 'shape' || selected.type === 'image' || selected.type === 'fabricImage' || Boolean(selected.src);

  const styles: { key: StrokeStyle; label: string; preview: React.ReactNode }[] = [
    {
      key: 'none',
      label: 'None',
      preview: <span className="text-[11px] font-bold">None</span>,
    },
    {
      key: 'solid',
      label: 'Solid',
      preview: <div className="w-full h-[2px] bg-current rounded-full" />,
    },
    {
      key: 'dashed',
      label: 'Dashed',
      preview: <div className="w-full border-t-[2px] border-dashed border-current" />,
    },
    {
      key: 'dotted',
      label: 'Dotted',
      preview: <div className="w-full border-t-[2px] border-dotted border-current" />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white text-gray-800 select-none overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-white shrink-0">
        <h2 className="font-bold text-sm text-gray-900">Stroke</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close stroke panel"
            className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
        {/* ─── 1. Stroke Colour ─── */}
        <div className="px-4 pt-4 pb-3 space-y-2">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Stroke colour
          </span>

          <div className="relative" ref={colorPickerRef}>
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${showColorPicker
                ? 'border-[#8b5cf6] bg-[#f0ebff]/50 shadow-sm'
                : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/70'
                }`}
            >
              <div
                className="w-7 h-7 rounded-full border-2 border-white shadow-md flex-shrink-0 ring-1 ring-gray-200"
                style={{ backgroundColor: stroke }}
              />
              <div className="flex-1 text-left">
                <span className="text-xs font-semibold text-gray-900 block">Border colour</span>
                <span className="text-[10px] text-gray-500 font-mono uppercase">{stroke}</span>
              </div>
              <div
                className="w-4 h-4 rounded-sm border border-gray-300"
                style={{ backgroundColor: stroke }}
              />
            </button>

            {showColorPicker && (
              <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                <ColorPicker
                  label=""
                  value={stroke || '#000000'}
                  onChange={(color) => handleColorChange(color)}
                  canvasManager={canvasManager}
                  embedded={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* ─── 2. Stroke Weight ─── */}
        <div className="px-4 py-3 space-y-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Weight
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStepWidth(-1)}
                title="Decrease stroke width"
                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center justify-center transition"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-0.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs min-w-[52px] justify-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={strokeWidth}
                  onChange={(e) => handleUpdate('strokeWidth', Math.max(0, Number(e.target.value)))}
                  className="w-7 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
                />
                <span className="text-[10px] text-gray-500 font-bold">px</span>
              </div>
              <button
                type="button"
                onClick={() => handleStepWidth(1)}
                title="Increase stroke width"
                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center justify-center transition"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Slider */}
          <input
            type="range"
            min="0"
            max="100"
            value={strokeWidth}
            onChange={(e) => handleUpdate('strokeWidth', Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#7c3aed]"
          />

          {/* Quick Weight Pills */}
          {/* <div className="flex flex-wrap items-center gap-1">
            {WEIGHT_PRESETS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => handleUpdate('strokeWidth', w)}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition ${strokeWidth === w
                    ? 'bg-[#f0ebff] border-[#8b5cf6] text-[#7c3aed] shadow-2xs'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {w === 0 ? '0' : `${w}px`}
              </button>
            ))}
          </div> */}
        </div>

        {/* ─── 3. Stroke Style ─── */}
        <div className="px-4 py-3 space-y-2.5 border-t border-gray-100">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Style
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {styles.map(({ key, label, preview }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleStyleChange(key)}
                title={label}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border transition ${currentStyle === key
                  ? 'bg-[#f0ebff] border-[#8b5cf6] text-[#7c3aed] shadow-2xs'
                  : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
              >
                <div className="w-6 flex items-center justify-center h-3">
                  {preview}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── 4. Stroke Position ─── */}
        {strokeWidth > 0 && (
          <div className="px-4 py-3 space-y-2.5 border-t border-gray-100">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Position
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(['inside', 'outside'] as StrokePosition[]).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => handlePositionChange(pos)}
                  className={`py-2.5 rounded-xl border text-xs font-bold capitalize transition flex items-center justify-center gap-2 ${currentPosition === pos
                    ? 'bg-[#f0ebff] border-[#8b5cf6] text-[#7c3aed] shadow-2xs'
                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                >
                  {/* Position icon */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                    {pos === 'inside' ? (
                      <>
                        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" opacity="0.25" />
                      </>
                    ) : (
                      <>
                        <rect x="1" y="1" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
                        <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" opacity="0.15" />
                      </>
                    )}
                  </svg>
                  {pos}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── 5. Corner Rounding (if supported) ─── */}
        {canRoundCorners && (
          <div className="px-4 py-3 space-y-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Corner rounding
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStepRadius(-1)}
                  title="Decrease corner radius"
                  className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center justify-center transition"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-0.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs min-w-[52px] justify-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={rx}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      handleUpdate('rx', val);
                      handleUpdate('ry', val);
                    }}
                    className="w-7 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
                  />
                  <span className="text-[10px] text-gray-500 font-bold">px</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStepRadius(1)}
                  title="Increase corner radius"
                  className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center justify-center transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={rx}
              onChange={(e) => {
                const val = Number(e.target.value);
                handleUpdate('rx', val);
                handleUpdate('ry', val);
              }}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#7c3aed]"
            />

            {/* Quick Radius Pills */}
            {/* <div className="flex flex-wrap items-center gap-1">
              {RADIUS_PRESETS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => {
                    handleUpdate('rx', r.val);
                    handleUpdate('ry', r.val);
                  }}
                  className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition ${rx === r.val
                    ? 'bg-[#f0ebff] border-[#8b5cf6] text-[#7c3aed] shadow-2xs'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div> */}
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  );
};
