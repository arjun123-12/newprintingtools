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
  MoreHorizontal,
  ChevronDown,
  Paintbrush,
  FlipHorizontal,
  FlipVertical,
  Check,
  CheckCircle2,
  MousePointer,
  Sparkles,
} from 'lucide-react';
import { SelectedObjectState, BrushSettings, BrushType } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { FontPickerPopover } from './FontPickerPopover';
import { TextSpacingPopover } from './TextSpacingPopover';
import { TransparencyPopover } from './TransparencyPopover';
import { EffectsPopover } from './EffectsPopover';
import { PositionPopover } from './PositionPopover';
import { MoreMenuPopover } from './MoreMenuPopover';
import { BrushTypePopover, BRUSH_TOOLS_LIST } from './BrushTypePopover';
import { BrushSizePopover } from './BrushSizePopover';
import { BrushCapsPopover } from './BrushCapsPopover';
import { BorderStylePopover } from './BorderStylePopover';
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
  | 'position'
  | 'more'
  | 'brushTool'
  | 'brushSize'
  | 'brushCaps'
  | 'borderStyle'
  | null;

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  selected,
  canvasManager,
  zoom,
}) => {
  const [activePopover, setActivePopover] = useState<ActivePopoverType>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
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

  const toolbarRef = useRef<HTMLDivElement>(null);

  // Sync drawing mode & brush settings from canvasManager
  useEffect(() => {
    if (!canvasManager) return;

    setIsDrawing(canvasManager.isDrawingMode());
    setBrushSettings(canvasManager.getBrushSettings());

    const unsubMode = canvasManager.onDrawingModeChange((mode) => setIsDrawing(mode));
    const unsubSettings = canvasManager.onBrushSettingsChange((s) => setBrushSettings(s));

    return () => {
      unsubMode();
      unsubSettings();
    };
  }, [canvasManager]);

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

  if (!selected && !isDrawing) return null;

  const isText =
    selected &&
    (selected.type === 'textbox' ||
      selected.type === 'i-text' ||
      selected.type === 'text' ||
      selected.text !== undefined);

  const isImage =
    selected &&
    (selected.type === 'image' ||
      selected.type === 'fabricImage' ||
      selected.src !== undefined);

  const isPath =
    selected &&
    (selected.type === 'path' ||
      selected.type === 'brush' ||
      Boolean(selected.isBrushPath));

  const isShape =
    selected &&
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
    selected &&
    (selected.fontWeight === 'bold' ||
      selected.fontWeight === 700 ||
      selected.fontWeight === '700');
  const isItalic = selected && selected.fontStyle === 'italic';
  const isUnderline = selected && Boolean(selected.underline);
  const textAlign = (selected && selected.textAlign) || 'left';
  const fontSize = (selected && selected.fontSize) || 32;

  const handleUpdate = <K extends keyof SelectedObjectState>(
    prop: K,
    value: SelectedObjectState[K]
  ) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty(prop, value);
  };

  const handleUpdateBrushSetting = <K extends keyof BrushSettings>(
    key: K,
    val: BrushSettings[K]
  ) => {
    if (!canvasManager) return;
    const updated = {
      ...brushSettings,
      [key]: val,
    };
    setBrushSettings(updated);
    canvasManager.setBrushSettings(updated);
  };

  const handleSelectBrushTool = (tool: BrushType) => {
    if (!canvasManager) return;
    const preset = BRUSH_TOOLS_LIST.find((item) => item.id === tool);
    const updated: BrushSettings = {
      ...brushSettings,
      tool,
      size: preset?.defaultSize ?? brushSettings.size,
      opacity: preset?.defaultOpacity ?? brushSettings.opacity,
    };
    setBrushSettings(updated);
    canvasManager.setBrushSettings(updated);
    canvasManager.setDrawingMode(true);
    setIsDrawing(true);
  };

  const togglePopover = (popover: ActivePopoverType) => {
    setActivePopover((prev) => (prev === popover ? null : popover));
  };

  const cleanFontName = (family: string = '') => {
    return family.split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
  };

  // Find active brush preset info
  const currentBrushPreset =
    BRUSH_TOOLS_LIST.find((t) => t.id === brushSettings.tool) || BRUSH_TOOLS_LIST[0];
  const CurrentBrushIcon = currentBrushPreset.icon;

  return (
    <div
      ref={toolbarRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-white/98 backdrop-blur-md px-2.5 py-1.5 rounded-2xl shadow-xl border border-gray-200/90 text-gray-700 animate-in fade-in slide-in-from-top-2 duration-150 select-none max-w-[95vw] overflow-visible"
    >
      {/* ================================================================ */}
      {/* 0. ACTIVE DRAWING MODE CONTROLS (Illustrator Draw / Brush)       */}
      {/* ================================================================ */}
      {isDrawing && (
        <>
          {/* Active Brush Tool Selector Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('brushTool')}
              title="Select Brush Type"
              className={`h-8 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                activePopover === 'brushTool'
                  ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
              }`}
            >
              <CurrentBrushIcon className="w-3.5 h-3.5 text-blue-600" />
              <span className="truncate max-w-[110px]">{currentBrushPreset.name}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {activePopover === 'brushTool' && (
              <BrushTypePopover
                currentTool={brushSettings.tool}
                onSelectTool={handleSelectBrushTool}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>

          {/* Brush Size Stepper & Popover */}
          <div className="relative flex items-center">
            <div className="flex items-center h-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() =>
                  handleUpdateBrushSetting('size', Math.max(brushSettings.size - 2, 1))
                }
                title="Decrease Brush Size"
                className="px-2 h-full hover:bg-gray-100 text-gray-600 transition"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => togglePopover('brushSize')}
                title="Brush Size & Width"
                className="px-1.5 py-1 text-xs font-mono font-bold text-gray-800 hover:text-blue-600 transition flex items-center gap-0.5"
              >
                <span>{brushSettings.size}</span>
                <span className="text-[10px] text-gray-400 font-sans">px</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateBrushSetting('size', Math.min(brushSettings.size + 2, 80))
                }
                title="Increase Brush Size"
                className="px-2 h-full hover:bg-gray-100 text-gray-600 transition"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {activePopover === 'brushSize' && (
              <BrushSizePopover
                size={brushSettings.size}
                color={brushSettings.color}
                opacity={brushSettings.opacity}
                onChange={(size) => handleUpdateBrushSetting('size', size)}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>

          {/* Brush Print Color (Ink / CMYK / Hex) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('color')}
              title="Brush Ink Color (CMYK & HEX)"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                activePopover === 'color'
                  ? 'bg-blue-50 border-blue-400'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full border border-gray-300 shadow-2xs flex-shrink-0"
                style={{ backgroundColor: brushSettings.color || '#2563eb' }}
              />
              <span className="hidden sm:inline text-gray-700">Ink Color</span>
            </button>

            {activePopover === 'color' && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <ColorPicker
                  label="Brush Print Ink (CMYK & RGB)"
                  value={brushSettings.color || '#2563eb'}
                  onChange={(color) => handleUpdateBrushSetting('color', color)}
                />
              </div>
            )}
          </div>

          {/* Brush Opacity / Alpha Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('opacity')}
              title="Brush Opacity / Alpha"
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
                activePopover === 'opacity'
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
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
                opacity={brushSettings.opacity}
                onChange={(val) => handleUpdateBrushSetting('opacity', val)}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>

          {/* Stroke End Caps Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('brushCaps')}
              title="Stroke End Caps & Joins"
              className={`h-8 px-2 rounded-xl border text-[11px] font-semibold capitalize transition ${
                activePopover === 'brushCaps'
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{brushSettings.strokeLineCap || 'round'}</span>
            </button>

            {activePopover === 'brushCaps' && (
              <BrushCapsPopover
                strokeLineCap={brushSettings.strokeLineCap}
                strokeLineJoin={brushSettings.strokeLineJoin}
                onChangeCap={(cap) => handleUpdateBrushSetting('strokeLineCap', cap)}
                onChangeJoin={(join) => handleUpdateBrushSetting('strokeLineJoin', join)}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>

          <div className="h-4 w-px bg-gray-200 mx-0.5" />

          {/* Done Drawing Button */}
          <button
            type="button"
            onClick={() => {
              if (canvasManager) {
                canvasManager.disableDrawingMode();
                setIsDrawing(false);
              }
            }}
            title="Finish Drawing Mode"
            className="h-8 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </>
      )}

      {/* ================================================================ */}
      {/* 1. TEXT ELEMENT CONTROLS (Canva Style)                           */}
      {/* ================================================================ */}
      {!isDrawing && isText && selected && !selected.isMultiple && (
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
              handleUpdate(
                'text',
                isUpper ? selected.text.toLowerCase() : selected.text.toUpperCase()
              );
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
              const order: Array<'left' | 'center' | 'right' | 'justify'> = [
                'left',
                'center',
                'right',
                'justify',
              ];
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

          {/* Text Border / Outline Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('borderStyle')}
              title="Text Border & Outline"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                activePopover === 'borderStyle'
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-xs border-2 border-current" />
              <span>Border</span>
            </button>

            {activePopover === 'borderStyle' && (
              <BorderStylePopover
                strokeWidth={selected.strokeWidth || 0}
                stroke={selected.stroke || '#000000'}
                rx={selected.rx || 0}
                strokeDashArray={selected.strokeDashArray}
                showCornerRadius={false}
                onStrokeWidthChange={(w) => handleUpdate('strokeWidth', w)}
                onStrokeDashArrayChange={(dash) => handleUpdate('strokeDashArray', dash as any)}
                onStrokeColorChange={(c) => handleUpdate('stroke', c)}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* 2. IMAGE ELEMENT CONTROLS                                        */}
      {/* ================================================================ */}
      {!isDrawing && isImage && selected && !selected.isMultiple && (
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

          {/* Border & Corner Rounding Button for Images */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('borderStyle')}
              title="Border Style & Corner Rounding"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                activePopover === 'borderStyle'
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-md border-2 border-current" />
              <span>Border</span>
            </button>

            {activePopover === 'borderStyle' && (
              <BorderStylePopover
                strokeWidth={selected.strokeWidth || 0}
                stroke={selected.stroke || '#000000'}
                rx={selected.rx || 0}
                strokeDashArray={selected.strokeDashArray}
                showCornerRadius={true}
                onStrokeWidthChange={(w) => handleUpdate('strokeWidth', w)}
                onStrokeDashArrayChange={(dash) => handleUpdate('strokeDashArray', dash as any)}
                onCornerRadiusChange={(r) => handleUpdate('rx', r)}
                onStrokeColorChange={(c) => handleUpdate('stroke', c)}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* 3. SHAPE ELEMENT CONTROLS                                        */}
      {/* ================================================================ */}
      {!isDrawing && isShape && selected && (
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
              <span>Border Color</span>
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

          {/* Border Style & Corner Rounding for Shapes */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('borderStyle')}
              title="Border Style & Corner Rounding"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                activePopover === 'borderStyle'
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-xs border-2 border-current" />
              <span>Border Style</span>
            </button>

            {activePopover === 'borderStyle' && (
              <BorderStylePopover
                strokeWidth={selected.strokeWidth || 0}
                stroke={selected.stroke || '#000000'}
                rx={selected.rx || 0}
                strokeDashArray={selected.strokeDashArray}
                showCornerRadius={selected.type === 'rect' || selected.type === 'shape'}
                onStrokeWidthChange={(w) => handleUpdate('strokeWidth', w)}
                onStrokeDashArrayChange={(dash) => handleUpdate('strokeDashArray', dash as any)}
                onCornerRadiusChange={(r) => handleUpdate('rx', r)}
                onStrokeColorChange={(c) => handleUpdate('stroke', c)}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* 4. BRUSH / DRAWING PATH OBJECT SELECTED                          */}
      {/* ================================================================ */}
      {!isDrawing && isPath && selected && (
        <>
          {/* Stroke Size Stepper & Popover */}
          <div className="relative flex items-center">
            <div className="flex items-center h-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() =>
                  handleUpdate('strokeWidth', Math.max((selected.strokeWidth || 4) - 2, 1))
                }
                title="Decrease Stroke Width"
                className="px-2 h-full hover:bg-gray-100 text-gray-600 transition"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => togglePopover('brushSize')}
                title="Stroke Width"
                className="px-1.5 py-1 text-xs font-mono font-bold text-gray-800 hover:text-blue-600 transition flex items-center gap-0.5"
              >
                <span>{selected.strokeWidth || 4}</span>
                <span className="text-[10px] text-gray-400 font-sans">px</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdate('strokeWidth', Math.min((selected.strokeWidth || 4) + 2, 80))
                }
                title="Increase Stroke Width"
                className="px-2 h-full hover:bg-gray-100 text-gray-600 transition"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {activePopover === 'brushSize' && (
              <BrushSizePopover
                size={selected.strokeWidth || 4}
                color={selected.stroke || selected.fill || '#2563eb'}
                opacity={selected.opacity}
                onChange={(size) => handleUpdate('strokeWidth', size)}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>

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

          {/* Stroke Border Style & Pattern */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('borderStyle')}
              title="Stroke Border Style & Pattern"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                activePopover === 'borderStyle'
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-xs border-2 border-current" />
              <span>Style</span>
            </button>

            {activePopover === 'borderStyle' && (
              <BorderStylePopover
                strokeWidth={selected.strokeWidth || 4}
                stroke={selected.stroke || selected.fill || '#2563eb'}
                rx={0}
                strokeDashArray={selected.strokeDashArray}
                showCornerRadius={false}
                onStrokeWidthChange={(w) => handleUpdate('strokeWidth', w)}
                onStrokeDashArrayChange={(dash) => handleUpdate('strokeDashArray', dash as any)}
                onStrokeColorChange={(c) => {
                  handleUpdate('stroke', c);
                  handleUpdate('fill', c);
                }}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>

          {/* Stroke End Caps Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => togglePopover('brushCaps')}
              title="Stroke End Caps"
              className={`h-8 px-2 rounded-xl border text-[11px] font-semibold capitalize transition ${
                activePopover === 'brushCaps'
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{selected.strokeLineCap || 'round'}</span>
            </button>

            {activePopover === 'brushCaps' && (
              <BrushCapsPopover
                strokeLineCap={selected.strokeLineCap || 'round'}
                strokeLineJoin={selected.strokeLineJoin || 'round'}
                onChangeCap={(cap) => handleUpdate('strokeLineCap', cap)}
                onChangeJoin={(join) => handleUpdate('strokeLineJoin', join)}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* COMMON CONTROLS: Transparency, Effects, Position, Duplicate, More */}
      {/* ================================================================ */}
      {!isDrawing && selected && (
        <>
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
        </>
      )}
    </div>
  );
};
