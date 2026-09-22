'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Minus, Pen } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';
import { ColorPicker } from '../controls/ColorPicker';

interface BorderPanelProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
  onClose?: () => void;
}

type StrokeStyle = 'none' | 'solid' | 'dashed' | 'dotted';

export const BorderPanel: React.FC<BorderPanelProps> = ({ canvasManager, selected }) => {
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
  const stroke = selected.stroke && selected.stroke !== 'transparent' ? selected.stroke : '#000000';
  const rx = selected.rx || 0;
  const strokeDashArray = selected.strokeDashArray;

  // Derive stroke style
  let currentStyle: StrokeStyle = 'none';
  if (strokeWidth > 0 && selected.stroke && selected.stroke !== 'transparent') {
    if (!strokeDashArray || strokeDashArray.length === 0) {
      currentStyle = 'solid';
    } else if (Array.isArray(strokeDashArray) && strokeDashArray[0] >= 5) {
      currentStyle = 'dashed';
    } else {
      currentStyle = 'dotted';
    }
  }

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

  const handleWidthChange = (width: number) => {
    const validW = Math.max(0, Math.min(100, width));
    if (validW > 0 && (!selected.stroke || selected.stroke === 'transparent' || selected.stroke === 'none')) {
      handleUpdate('stroke', stroke || '#000000');
    }
    handleUpdate('strokeWidth', validW);
  };

  const handleStepWidth = (delta: number) => {
    handleWidthChange(strokeWidth + delta);
  };

  const handleStepRadius = (delta: number) => {
    const newR = Math.max(0, Math.min(100, rx + delta));
    if (canvasManager) {
      canvasManager.setSelectedCornerRadius(newR, false);
    } else {
      handleUpdate('rx', newR);
    }
  };

  const handleStyleChange = (style: StrokeStyle) => {
    if (style === 'none') {
      // Explicitly remove the editable Fabric border.
      // Keeping only strokeWidth=0 can leave a stored SVG/object stroke behind
      // and make the next selection look like it has a default border again.
      handleUpdate('stroke', 'transparent');
      handleUpdate('strokeWidth', 0);
      handleUpdate('baseStrokeWidth', 0);
      handleUpdate('strokeDashArray', null);
      return;
    }

    if (!selected.stroke || selected.stroke === 'transparent' || selected.stroke === 'none') {
      handleUpdate('stroke', stroke || '#000000');
    }

    if (strokeWidth === 0) {
      handleUpdate('strokeWidth', 2);
    }

    switch (style) {
      case 'solid':
        handleUpdate('strokeDashArray', null);
        break;
      case 'dashed':
        handleUpdate('strokeDashArray', [8, 6]);
        break;
      case 'dotted':
        handleUpdate('strokeDashArray', [3, 3]);
        break;
    }
  };

  const canRoundCorners =
    Boolean(selected.isShape) ||
    Boolean(selected.isMultiple) ||
    selected.type === 'rect' ||
    selected.type === 'shape' ||
    selected.type === 'triangle' ||
    selected.type === 'polygon' ||
    selected.type === 'path' ||
    selected.type === 'image' ||
    selected.type === 'fabricImage' ||
    selected.type === 'group' ||
    selected.type === 'activeSelection' ||
    Boolean(selected.src) ||
    (Boolean(selected.isFrame) && (!selected.frameShape || selected.frameShape === 'rect'));

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
                className="w-7 h-7 rounded-lg border-2 border-white shadow-md flex-shrink-0 ring-1 ring-gray-200"
                style={{ backgroundColor: stroke }}
              />
              <div className="flex-1 text-left">
                <span className="text-xs font-semibold text-gray-900 block">Border colour</span>
                <span className="text-[10px] text-gray-500 font-mono uppercase">{stroke}</span>
              </div>
              <div
                className="w-4 h-4 rounded-lg border border-gray-300"
                style={{ backgroundColor: stroke }}
              />
            </button>

            {showColorPicker && (
              <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                <ColorPicker
                  label="Border Colour"
                  value={stroke || '#000000'}
                  onChange={(color) => {
                    if (typeof color === 'string') {
                      handleColorChange(color);
                    } else if (canvasManager) {
                      canvasManager.setSelectedGradient(color, true);
                    }
                  }}
                  onClose={() => setShowColorPicker(false)}
                  canvasManager={canvasManager}
                  embedded={true}
                  allowGradient={true}
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
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
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
            onChange={(e) => handleWidthChange(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#7c3aed]"
          />
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
                <div className="w-6 flex items-center justify-center h-3">{preview}</div>
                <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── 4. Corner Rounding (if supported) ─── */}
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
                      if (canvasManager) {
                        canvasManager.setSelectedCornerRadius(val, false);
                      } else {
                        handleUpdate('rx', val);
                      }
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
                if (canvasManager) {
                  canvasManager.setSelectedCornerRadius(val, false);
                } else {
                  handleUpdate('rx', val);
                }
              }}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#7c3aed]"
            />
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default BorderPanel;

