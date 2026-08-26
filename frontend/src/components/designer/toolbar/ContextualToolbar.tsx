'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Minus,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ArrowUpDown,
  Sparkles,
  Layers,
  MoreHorizontal,
  ChevronDown,
  Paintbrush,
  FlipHorizontal,
  FlipVertical,
  Crop,
  CaseUpper,
  Square,
  Circle,
  Play,
} from 'lucide-react';
import { SelectedObjectState, AlignmentType } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { FontPickerPopover } from './FontPickerPopover';
import { TextSpacingPopover } from './TextSpacingPopover';
import { TransparencyPopover } from './TransparencyPopover';
import { EffectsPopover } from './EffectsPopover';
import { PositionPopover } from './PositionPopover';
import { MoreMenuPopover } from './MoreMenuPopover';
import { ColorPicker } from '../controls/ColorPicker';

interface ContextualToolbarProps {
  selected: SelectedObjectState | null;
  canvasManager: CanvasManager | null;
  zoom: number;
}

type ActivePopoverType =
  | 'font'
  | 'color'
  | 'strokeColor'
  | 'spacing'
  | 'opacity'
  | 'effects'
  | 'animate'
  | 'position'
  | 'more'
  | null;

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  selected,
  canvasManager,
  zoom,
}) => {
  const [activePopover, setActivePopover] = useState<ActivePopoverType>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close popover when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset popover when selection changes
  useEffect(() => {
    setActivePopover(null);
  }, [selected?.id, selected?.type]);

  if (!selected) return null;

  const isText =
    selected.type === 'textbox' ||
    selected.type === 'i-text' ||
    selected.type === 'text' ||
    selected.text !== undefined;

  const isImage =
    selected.type === 'image' ||
    selected.type === 'fabricImage' ||
    selected.src !== undefined;

  const isPath =
    selected.type === 'path' ||
    selected.type === 'brush' ||
    Boolean(selected.isBrushPath);

  const isShape =
    !isText &&
    !isImage &&
    !isPath &&
    !selected.isMultiple &&
    (selected.type === 'rect' ||
      selected.type === 'circle' ||
      selected.type === 'triangle' ||
      selected.type === 'polygon' ||
      selected.type === 'line' ||
      selected.type === 'shape');

  const isBold =
    selected.fontWeight === 'bold' ||
    selected.fontWeight === 700 ||
    selected.fontWeight === '700';
  const isItalic = selected.fontStyle === 'italic';
  const isUnderline = Boolean(selected.underline);
  const textAlign = selected.textAlign || 'left';
  const fontSize = selected.fontSize || 32;

  const handleUpdate = <K extends keyof SelectedObjectState>(
    prop: K,
    value: SelectedObjectState[K]
  ) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty(prop, value);
  };

  const togglePopover = (popover: ActivePopoverType) => {
    setActivePopover((prev) => (prev === popover ? null : popover));
  };

  const cleanFontName = (family: string = '') => {
    return family.split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
  };

  return (
    <div
      ref={toolbarRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-xl border border-gray-200/90 text-gray-700 animate-in fade-in slide-in-from-top-2 duration-150 select-none max-w-[95vw] overflow-x-auto custom-scrollbar"
    >
      {/* ================================================================ */}
      {/* 1. TEXT ELEMENT CONTROLS (Canva Style) */}
      {/* ================================================================ */}
      {isText && !selected.isMultiple && (
        <>
          {/* Font Family Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('font')}
              title="Font Family"
              className={`h-8 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                activePopover === 'font'
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span className="truncate max-w-[100px]">
                {cleanFontName(selected.fontFamily)}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {activePopover === 'font' && (
              <FontPickerPopover
                currentFamily={selected.fontFamily || 'Inter'}
                onSelectFamily={(family) => {
                  handleUpdate('fontFamily', family);
                  setActivePopover(null);
                }}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>

          {/* Font Size Stepper */}
          <div className="flex items-center h-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => handleUpdate('fontSize', Math.max(fontSize - 2, 6))}
              title="Decrease Font Size"
              className="px-2 h-full hover:bg-gray-100 text-gray-600 transition"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              value={fontSize}
              min={6}
              max={400}
              onChange={(e) => handleUpdate('fontSize', Number(e.target.value))}
              className="w-10 text-center text-xs font-bold text-gray-800 focus:outline-none py-1"
            />
            <button
              type="button"
              onClick={() => handleUpdate('fontSize', Math.min(fontSize + 2, 400))}
              title="Increase Font Size"
              className="px-2 h-full hover:bg-gray-100 text-gray-600 transition"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Text Color Button with Color Indicator Bar */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('color')}
              title="Text Color"
              className={`h-8 px-2 rounded-xl border flex flex-col items-center justify-center transition ${
                activePopover === 'color'
                  ? 'bg-blue-50 border-blue-400'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="text-xs font-black text-gray-900 leading-none">A</span>
              <span
                className="w-4 h-1 rounded-full mt-0.5"
                style={{ backgroundColor: selected.fill || '#0f172a' }}
              />
            </button>

            {activePopover === 'color' && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <ColorPicker
                  label="Text Color"
                  value={selected.fill || '#0f172a'}
                  onChange={(color) => handleUpdate('fill', color)}
                />
              </div>
            )}
          </div>

          {/* Bold */}
          <button
            type="button"
            onClick={() => handleUpdate('fontWeight', isBold ? 'normal' : 'bold')}
            title="Bold (Ctrl+B)"
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
              isBold
                ? 'bg-blue-50 border-blue-300 text-blue-600 font-bold'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => handleUpdate('fontStyle', isItalic ? 'normal' : 'italic')}
            title="Italic (Ctrl+I)"
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
              isItalic
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Underline */}
          <button
            type="button"
            onClick={() => handleUpdate('underline', !isUnderline)}
            title="Underline (Ctrl+U)"
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
              isUnderline
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          {/* Case Upper/Lower */}
          <button
            type="button"
            onClick={() => {
              if (!selected.text) return;
              const isUpper = selected.text === selected.text.toUpperCase();
              handleUpdate('text', isUpper ? selected.text.toLowerCase() : selected.text.toUpperCase());
            }}
            title="Toggle Uppercase / Lowercase"
            className="w-8 h-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center transition"
          >
            <span className="text-[11px] font-bold">aA</span>
          </button>

          {/* Alignment Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const order: Array<'left' | 'center' | 'right' | 'justify'> = ['left', 'center', 'right', 'justify'];
              const next = order[(order.indexOf(textAlign) + 1) % order.length];
              handleUpdate('textAlign', next);
            }}
            title={`Text Alignment (${textAlign})`}
            className="w-8 h-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center transition"
          >
            {textAlign === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
            {textAlign === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
            {textAlign === 'right' && <AlignRight className="w-3.5 h-3.5" />}
            {textAlign === 'justify' && <AlignJustify className="w-3.5 h-3.5" />}
          </button>

          {/* List Button */}
          <button
            type="button"
            onClick={() => canvasManager?.toggleBulletList()}
            title="Bullet List"
            className="w-8 h-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center transition"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          {/* Spacing Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('spacing')}
              title="Letter & Line Spacing"
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
                activePopover === 'spacing'
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>

            {activePopover === 'spacing' && (
              <TextSpacingPopover
                charSpacing={selected.charSpacing || 0}
                lineHeight={selected.lineHeight || 1.16}
                onCharSpacingChange={(val) => handleUpdate('charSpacing', val)}
                onLineHeightChange={(val) => handleUpdate('lineHeight', val)}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* 2. IMAGE ELEMENT CONTROLS */}
      {/* ================================================================ */}
      {isImage && !selected.isMultiple && (
        <>
          {/* Flip Horizontal */}
          <button
            type="button"
            onClick={() => handleUpdate('flipX', !selected.flipX)}
            title="Flip Horizontal"
            className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
              selected.flipX
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flip H</span>
          </button>

          {/* Flip Vertical */}
          <button
            type="button"
            onClick={() => handleUpdate('flipY', !selected.flipY)}
            title="Flip Vertical"
            className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
              selected.flipY
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FlipVertical className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flip V</span>
          </button>
        </>
      )}

      {/* ================================================================ */}
      {/* 3. SHAPE ELEMENT CONTROLS */}
      {/* ================================================================ */}
      {isShape && (
        <>
          {/* Fill Color */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('color')}
              title="Fill Color"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                activePopover === 'color'
                  ? 'bg-blue-50 border-blue-400'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div
                className="w-4 h-4 rounded-md border border-gray-300"
                style={{ backgroundColor: selected.fill || '#2563eb' }}
              />
              <span>Color</span>
            </button>

            {activePopover === 'color' && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <ColorPicker
                  label="Shape Fill Color"
                  value={selected.fill || '#2563eb'}
                  onChange={(color) => handleUpdate('fill', color)}
                />
              </div>
            )}
          </div>

          {/* Border / Stroke Color */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('strokeColor')}
              title="Border Color"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                activePopover === 'strokeColor'
                  ? 'bg-blue-50 border-blue-400'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div
                className="w-4 h-4 rounded-md border-2 border-current"
                style={{ color: selected.stroke || '#000000' }}
              />
              <span>Border</span>
            </button>

            {activePopover === 'strokeColor' && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <ColorPicker
                  label="Border Color"
                  value={selected.stroke || '#000000'}
                  onChange={(color) => handleUpdate('stroke', color)}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* 4. BRUSH / DRAWING ELEMENT CONTROLS */}
      {/* ================================================================ */}
      {isPath && (
        <>
          {/* Stroke Color */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('color')}
              title="Stroke Color"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                activePopover === 'color'
                  ? 'bg-blue-50 border-blue-400'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full border border-gray-300"
                style={{ backgroundColor: selected.stroke || selected.fill || '#2563eb' }}
              />
              <span>Stroke</span>
            </button>

            {activePopover === 'color' && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <ColorPicker
                  label="Path Stroke Color"
                  value={selected.stroke || selected.fill || '#2563eb'}
                  onChange={(color) => {
                    handleUpdate('stroke', color);
                    handleUpdate('fill', color);
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* COMMON CONTROLS: Transparency, Effects, Animate, Position, More */}
      {/* ================================================================ */}

      {/* Transparency / Opacity Popover Button (Checkerboard Icon) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => togglePopover('opacity')}
          title="Transparency / Opacity"
          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
            activePopover === 'opacity'
              ? 'bg-blue-50 border-blue-400 text-blue-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {/* Checkerboard Pattern SVG */}
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <rect x="0" y="0" width="4" height="4" fill="#64748b" />
            <rect x="8" y="0" width="4" height="4" fill="#64748b" />
            <rect x="4" y="4" width="4" height="4" fill="#64748b" />
            <rect x="12" y="4" width="4" height="4" fill="#64748b" />
            <rect x="0" y="8" width="4" height="4" fill="#64748b" />
            <rect x="8" y="8" width="4" height="4" fill="#64748b" />
            <rect x="4" y="12" width="4" height="4" fill="#64748b" />
            <rect x="12" y="12" width="4" height="4" fill="#64748b" />
          </svg>
        </button>

        {activePopover === 'opacity' && (
          <TransparencyPopover
            opacity={selected.opacity}
            onChange={(val) => handleUpdate('opacity', val)}
            onClose={() => setActivePopover(null)}
          />
        )}
      </div>

      {/* Effects Popover Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => togglePopover('effects')}
          title="Effects (Shadow, Lift, Glow, Outline)"
          className={`h-8 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
            activePopover === 'effects'
              ? 'bg-purple-50 border-purple-400 text-purple-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span>Effects</span>
        </button>

        {activePopover === 'effects' && (
          <EffectsPopover
            canvasManager={canvasManager}
            onClose={() => setActivePopover(null)}
          />
        )}
      </div>

      {/* Animate Button (Canva Style UI) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => togglePopover('animate')}
          title="Animate"
          className={`h-8 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
            activePopover === 'animate'
              ? 'bg-blue-50 border-blue-400 text-blue-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span>Animate</span>
        </button>

        {activePopover === 'animate' && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-2">
            <span className="text-xs font-bold text-gray-900 block border-b border-gray-100 pb-2">
              Animation Style
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {['Fade', 'Pan', 'Rise', 'Pop', 'Wipe', 'Breathe'].map((anim) => (
                <button
                  key={anim}
                  type="button"
                  onClick={() => setActivePopover(null)}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-xs font-medium text-gray-700 text-left transition"
                >
                  {anim}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Position Popover Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => togglePopover('position')}
          title="Position & Alignment"
          className={`h-8 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
            activePopover === 'position'
              ? 'bg-blue-50 border-blue-400 text-blue-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span>Position</span>
        </button>

        {activePopover === 'position' && (
          <PositionPopover
            canvasManager={canvasManager}
            onClose={() => setActivePopover(null)}
          />
        )}
      </div>

      <div className="h-4 w-px bg-gray-200 mx-0.5" />

      {/* Copy Style / Roller Brush Button */}
      <button
        type="button"
        onClick={() => {
          if (!canvasManager) return;
          canvasManager.duplicateSelected();
        }}
        title="Duplicate / Copy Style"
        className="w-8 h-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center transition"
      >
        <Paintbrush className="w-3.5 h-3.5" />
      </button>

      {/* More Actions (•••) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => togglePopover('more')}
          title="More actions"
          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
            activePopover === 'more'
              ? 'bg-blue-50 border-blue-400 text-blue-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {activePopover === 'more' && (
          <MoreMenuPopover
            selected={selected}
            canvasManager={canvasManager}
            onClose={() => setActivePopover(null)}
          />
        )}
      </div>
    </div>
  );
};
