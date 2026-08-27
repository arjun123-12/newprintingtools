'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Plus,
  Pipette,
  X,
  Palette,
  Sparkles,
  Image as ImageIcon,
  Sliders,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  List,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { hexToCmyk, cmykToHex, calculateTotalInkCoverage, CMYKColor } from '../utils/cmyk';

interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (color: string) => void;
  canvasManager?: CanvasManager | null;
  onClose?: () => void;
  showAlpha?: boolean;
  embedded?: boolean;
  className?: string;
}

// Brand Kit Palette (from reference Canva design)
const BRAND_KIT_COLORS = [
  { name: 'Warm Brown', hex: '#6b5335' },
  { name: 'Rich Black', hex: '#1c1917' },
  { name: 'Soft Ice Blue', hex: '#d0dce5' },
  { name: 'Golden Ochre', hex: '#d4a017' },
  { name: 'Crimson Red', hex: '#b91c1c' },
  { name: 'Deep Emerald', hex: '#065f46' },
];

// Photo Colors Palette (from reference Canva design)
const PHOTO_COLORS = [
  { name: 'Warm Sand', hex: '#e2c2a4' },
  { name: 'Bright Magenta', hex: '#e14e9d' },
  { name: 'Olive Green', hex: '#597a2b' },
  { name: 'Espresso Brown', hex: '#4e2e28' },
  { name: 'Ruby Red', hex: '#c11e2b' },
];

// Default Canva Solid Colors
const DEFAULT_SOLID_ROW_1 = [
  { name: 'Black', hex: '#000000' },
  { name: 'Dark Gray', hex: '#4b4b4b' },
  { name: 'Dim Gray', hex: '#6e6e6e' },
  { name: 'Medium Gray', hex: '#9b9b9b' },
  { name: 'Silver', hex: '#b5b5b5' },
  { name: 'Light Gray', hex: '#e0e0e0' },
  { name: 'White', hex: '#ffffff' },
];

const DEFAULT_SOLID_ROW_2 = [
  { name: 'Vibrant Red', hex: '#ff2d20' },
  { name: 'Coral Pink', hex: '#ff5757' },
  { name: 'Hot Pink', hex: '#ff66c4' },
  { name: 'Lilac', hex: '#e1a5f5' },
  { name: 'Orchid Purple', hex: '#cb6ce6' },
  { name: 'Royal Purple', hex: '#7d4cf6' },
  { name: 'Electric Indigo', hex: '#4314e6' },
];

const EXTENDED_SOLID_COLORS = [
  { name: 'Electric Blue', hex: '#0047ff' },
  { name: 'Sky Blue', hex: '#00c4cc' },
  { name: 'Aqua Teal', hex: '#00d287' },
  { name: 'Lime Green', hex: '#7ed957' },
  { name: 'Canary Yellow', hex: '#ffde59' },
  { name: 'Orange Amber', hex: '#ff914d' },
  { name: 'Warm Chocolate', hex: '#8b572a' },
  { name: 'Navy Blue', hex: '#0f172a' },
  { name: 'Turquoise', hex: '#06b6d4' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'Zinc', hex: '#71717a' },
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label = 'Colour',
  value = '#2563eb',
  onChange,
  canvasManager,
  onClose,
  embedded = false,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showAllSolid, setShowAllSolid] = useState(false);
  const [showCmykDetails, setShowCmykDetails] = useState(false);
  const [designColors, setDesignColors] = useState<string[]>([]);
  const [hexInput, setHexInput] = useState(value);

  // Sync hex input when value changes externally
  useEffect(() => {
    if (value) {
      setHexInput(value);
    }
  }, [value]);

  // Extract colors present in design
  useEffect(() => {
    if (canvasManager) {
      const colors = canvasManager.getColorsInDesign();
      setDesignColors(colors);
    } else {
      setDesignColors(['#000000', '#ffffff', '#2563eb', '#10b981', '#ef4444']);
    }
  }, [canvasManager, value]);

  // Native Eyedropper API
  const handlePickEyedropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          onChange(result.sRGBHex);
          setHexInput(result.sRGBHex);
        }
      } catch {
        // User cancelled or not supported
      }
    }
  };

  const handleSelectColor = (hex: string) => {
    onChange(hex);
    setHexInput(hex);
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.trim();
    setHexInput(input);
    if (!input.startsWith('#')) {
      input = '#' + input;
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(input) || /^#[0-9A-Fa-f]{3}$/.test(input)) {
      onChange(input);
    }
  };

  const cmyk = useMemo(() => hexToCmyk(value || '#000000'), [value]);
  const ink = useMemo(() => calculateTotalInkCoverage(cmyk.c, cmyk.m, cmyk.y, cmyk.k), [cmyk]);

  const handleCmykSlider = (channel: keyof CMYKColor, val: number) => {
    const clamped = Math.min(Math.max(Number(val) || 0, 0), 100);
    const updated = { ...cmyk, [channel]: clamped };
    const hex = cmykToHex(updated.c, updated.m, updated.y, updated.k);
    onChange(hex);
    setHexInput(hex);
  };

  // Search filtering
  const query = searchQuery.trim().toLowerCase();
  const isSearchHex = query.startsWith('#') || /^[0-9a-fA-F]{3,6}$/.test(query);
  const searchHexCandidate = isSearchHex ? (query.startsWith('#') ? query : '#' + query) : null;

  const matchesSearch = (name: string, hex: string) => {
    if (!query) return true;
    return name.toLowerCase().includes(query) || hex.toLowerCase().includes(query);
  };

  return (
    <div
      className={
        className ||
        (embedded
          ? 'w-full h-full bg-white flex flex-col overflow-hidden select-none text-gray-800'
          : 'w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200/90 flex flex-col max-h-[520px] overflow-hidden select-none text-gray-800')
      }
    >
      {/* ================================================================ */}
      {/* 1. TOP HEADER (Title & Close)                                     */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 shrink-0 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-900 tracking-tight">
          {label}
        </h3>
        <div className="flex items-center gap-1">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* ================================================================ */}
        {/* 2. SEARCH INPUT                                                  */}
        {/* ================================================================ */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder='Try "blue" or "#00c4cc"'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-gray-50/70 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* If user searched a direct hex code, show quick action swatch */}
        {searchHexCandidate && /^#[0-9A-Fa-f]{3,6}$/.test(searchHexCandidate) && (
          <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full border border-black/15 shadow-xs"
                style={{ backgroundColor: searchHexCandidate }}
              />
              <span className="text-xs font-mono font-bold text-blue-900">
                {searchHexCandidate.toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectColor(searchHexCandidate)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
            >
              Apply
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* 3. CUSTOM COLOR SUB-PICKER (When `+` Add New Color is opened)    */}
        {/* ================================================================ */}
        {showCustomPicker && (
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3 animate-in fade-in zoom-in-95 duration-150 shadow-2xs">
            <div className="flex items-center justify-between border-b border-blue-100 pb-2">
              <span className="text-xs font-bold text-gray-900">Custom Color</span>
              <button
                type="button"
                onClick={() => setShowCustomPicker(false)}
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-800"
              >
                Done
              </button>
            </div>

            {/* Native / Custom Color Palette Trigger */}
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-300 shadow-xs ring-2 ring-black/5 shrink-0 cursor-pointer">
                <input
                  type="color"
                  value={value.startsWith('#') ? value : '#2563eb'}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  className="absolute -top-3 -left-3 w-20 h-20 cursor-pointer opacity-0"
                />
                <div className="w-full h-full" style={{ backgroundColor: value }} />
              </div>

              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Hex Color
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={hexInput}
                    onChange={handleHexInputChange}
                    placeholder="#2563EB"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-mono font-bold uppercase text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                  {typeof window !== 'undefined' && 'EyeDropper' in window && (
                    <button
                      type="button"
                      onClick={handlePickEyedropper}
                      title="Pick color from screen"
                      className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-blue-600 transition shadow-2xs shrink-0"
                    >
                      <Pipette className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Expandable CMYK Process Controls for Commercial Printing */}
            <div className="pt-1 border-t border-blue-100">
              <button
                type="button"
                onClick={() => setShowCmykDetails((prev) => !prev)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-blue-700 hover:text-blue-800 py-1"
              >
                <span>Process CMYK Channels ({cmyk.c}%, {cmyk.m}%, {cmyk.y}%, {cmyk.k}%)</span>
                {showCmykDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showCmykDetails && (
                <div className="space-y-2 mt-2 pt-2 border-t border-gray-200/80 bg-white p-2.5 rounded-lg">
                  {/* Cyan */}
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="w-4 text-cyan-600">C</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={cmyk.c}
                      onChange={(e) => handleCmykSlider('c', Number(e.target.value))}
                      className="flex-1 h-1.5 bg-cyan-100 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                    />
                    <span className="w-8 text-right font-mono">{cmyk.c}%</span>
                  </div>

                  {/* Magenta */}
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="w-4 text-pink-600">M</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={cmyk.m}
                      onChange={(e) => handleCmykSlider('m', Number(e.target.value))}
                      className="flex-1 h-1.5 bg-pink-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
                    />
                    <span className="w-8 text-right font-mono">{cmyk.m}%</span>
                  </div>

                  {/* Yellow */}
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="w-4 text-amber-500">Y</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={cmyk.y}
                      onChange={(e) => handleCmykSlider('y', Number(e.target.value))}
                      className="flex-1 h-1.5 bg-amber-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <span className="w-8 text-right font-mono">{cmyk.y}%</span>
                  </div>

                  {/* Black (K) */}
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="w-4 text-gray-800">K</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={cmyk.k}
                      onChange={(e) => handleCmykSlider('k', Number(e.target.value))}
                      className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                    />
                    <span className="w-8 text-right font-mono">{cmyk.k}%</span>
                  </div>

                  {/* Ink density */}
                  <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1">
                    <span>Total Ink (TIC): <strong>{ink.total}%</strong> / 300%</span>
                    {ink.isOverLimit && (
                      <span className="text-amber-600 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Over limit
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* 4. COLOURS IN THIS DESIGN (Document Colors)                     */}
        {/* ================================================================ */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
            <Palette className="w-4 h-4 text-blue-600" />
            <span>Colours in this design</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {/* 1. Add Custom Color Circle Button with Canva Rainbow conic-gradient */}
            <button
              type="button"
              onClick={() => setShowCustomPicker((prev) => !prev)}
              title="Add a new custom color"
              className="relative w-8 h-8 rounded-full p-[2px] shrink-0 transition hover:scale-110 shadow-xs"
              style={{
                background:
                  'conic-gradient(from 0deg, #ff0000, #ff8800, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
              }}
            >
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-gray-700">
                <Plus className="w-4 h-4 text-gray-800" strokeWidth={2.5} />
              </div>
            </button>

            {/* 2. Eyedropper Tool Circle Button */}
            {typeof window !== 'undefined' && 'EyeDropper' in window && (
              <button
                type="button"
                onClick={handlePickEyedropper}
                title="Pick color from design"
                className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 hover:text-blue-600 transition hover:scale-110 shadow-xs shrink-0"
              >
                <Pipette className="w-3.5 h-3.5" />
              </button>
            )}

            {/* 3. Design Colors Swatches */}
            {designColors.map((colorHex, idx) => {
              const isSelected = value.toLowerCase() === colorHex.toLowerCase();
              const isWhite = colorHex.toLowerCase() === '#ffffff' || colorHex.toLowerCase() === '#fff';
              return (
                <button
                  key={`${colorHex}_${idx}`}
                  type="button"
                  onClick={() => handleSelectColor(colorHex)}
                  title={colorHex}
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${
                    isWhite ? 'border border-gray-200' : ''
                  } ${isSelected ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' : ''}`}
                  style={{ backgroundColor: colorHex }}
                >
                  {isSelected && (
                    <Check
                      className={`w-3.5 h-3.5 ${
                        isWhite || colorHex.toLowerCase() === '#ffde59' ? 'text-gray-900' : 'text-white'
                      }`}
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* 5. BRAND KIT SECTION                                             */}
        {/* ================================================================ */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Brand Kit</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 truncate max-w-full font-medium">
            Colors from ORIGINAL LOGO DESIGN GLENELG PIZZ...
          </p>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {BRAND_KIT_COLORS.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
              const isSelected = value.toLowerCase() === item.hex.toLowerCase();
              const isWhite = item.hex.toLowerCase() === '#ffffff';
              return (
                <button
                  key={item.hex}
                  type="button"
                  onClick={() => handleSelectColor(item.hex)}
                  title={`${item.name} (${item.hex})`}
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${
                    isWhite ? 'border border-gray-200' : ''
                  } ${isSelected ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' : ''}`}
                  style={{ backgroundColor: item.hex }}
                >
                  {isSelected && (
                    <Check
                      className={`w-3.5 h-3.5 ${
                        isWhite ? 'text-gray-900' : 'text-white'
                      }`}
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* 6. PHOTO COLOURS SECTION                                         */}
        {/* ================================================================ */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span>Photo colours</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {/* Photo Thumbnail Icon */}
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
              <ImageIcon className="w-4 h-4" />
            </div>

            {/* Extracted Photo Colors Swatches */}
            {PHOTO_COLORS.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
              const isSelected = value.toLowerCase() === item.hex.toLowerCase();
              return (
                <button
                  key={item.hex}
                  type="button"
                  onClick={() => handleSelectColor(item.hex)}
                  title={`${item.name} (${item.hex})`}
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${
                    isSelected ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' : ''
                  }`}
                  style={{ backgroundColor: item.hex }}
                >
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* 7. DEFAULT SOLID COLOURS SECTION                                */}
        {/* ================================================================ */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <Palette className="w-4 h-4 text-gray-700" />
              <span>Default solid colours</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAllSolid((prev) => !prev)}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              {showAllSolid ? 'Show less' : 'See all'}
            </button>
          </div>

          {/* Row 1: Grayscale & Neutrals */}
          <div className="grid grid-cols-7 gap-2">
            {DEFAULT_SOLID_ROW_1.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
              const isSelected = value.toLowerCase() === item.hex.toLowerCase();
              const isWhite = item.hex.toLowerCase() === '#ffffff';
              return (
                <button
                  key={item.hex}
                  type="button"
                  onClick={() => handleSelectColor(item.hex)}
                  title={`${item.name} (${item.hex})`}
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center ${
                    isWhite ? 'border border-gray-300' : ''
                  } ${isSelected ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' : ''}`}
                  style={{ backgroundColor: item.hex }}
                >
                  {isSelected && (
                    <Check
                      className={`w-3.5 h-3.5 ${
                        isWhite || item.hex === '#e0e0e0' ? 'text-gray-900' : 'text-white'
                      }`}
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Row 2: Vivid Spectrum */}
          <div className="grid grid-cols-7 gap-2">
            {DEFAULT_SOLID_ROW_2.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
              const isSelected = value.toLowerCase() === item.hex.toLowerCase();
              return (
                <button
                  key={item.hex}
                  type="button"
                  onClick={() => handleSelectColor(item.hex)}
                  title={`${item.name} (${item.hex})`}
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center ${
                    isSelected ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' : ''
                  }`}
                  style={{ backgroundColor: item.hex }}
                >
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Extended Swatches when "See all" is toggled */}
          {showAllSolid && (
            <div className="grid grid-cols-7 gap-2 pt-1 animate-in fade-in duration-150">
              {EXTENDED_SOLID_COLORS.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
                const isSelected = value.toLowerCase() === item.hex.toLowerCase();
                const isLight = item.hex === '#ffde59' || item.hex === '#7ed957';
                return (
                  <button
                    key={item.hex}
                    type="button"
                    onClick={() => handleSelectColor(item.hex)}
                    title={`${item.name} (${item.hex})`}
                    className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center ${
                      isSelected ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' : ''
                    }`}
                    style={{ backgroundColor: item.hex }}
                  >
                    {isSelected && (
                      <Check
                        className={`w-3.5 h-3.5 ${isLight ? 'text-gray-900' : 'text-white'}`}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
