'use client';

import React, { useState, useEffect } from 'react';
import {
  hexToCmyk,
  cmykToHex,
  calculateTotalInkCoverage,
  COMMERCIAL_CMYK_SWATCHES,
  CMYKColor,
} from '../utils/cmyk';
import { Sliders, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
}) => {
  const [mode, setMode] = useState<'cmyk' | 'hex'>('cmyk');
  const [cmyk, setCmyk] = useState<CMYKColor>(() => hexToCmyk(value || '#000000'));

  // Sync CMYK state whenever external value changes
  useEffect(() => {
    if (value) {
      setCmyk(hexToCmyk(value));
    }
  }, [value]);

  const handleCmykChange = (channel: keyof CMYKColor, val: number) => {
    const clamped = Math.min(Math.max(Number(val) || 0, 0), 100);
    const updated = { ...cmyk, [channel]: clamped };
    setCmyk(updated);
    const hex = cmykToHex(updated.c, updated.m, updated.y, updated.k);
    onChange(hex);
  };

  const handleSelectPreset = (hex: string) => {
    onChange(hex);
    setCmyk(hexToCmyk(hex));
  };

  const ink = calculateTotalInkCoverage(cmyk.c, cmyk.m, cmyk.y, cmyk.k);

  return (
    <div className="space-y-3 select-none">
      {/* Header with Mode Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
          {label}
        </label>
        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setMode('cmyk')}
            className={`px-2 py-0.5 rounded-md transition ${
              mode === 'cmyk'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            CMYK (Print)
          </button>
          <button
            type="button"
            onClick={() => setMode('hex')}
            className={`px-2 py-0.5 rounded-md transition ${
              mode === 'hex'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            HEX / RGB
          </button>
        </div>
      </div>

      {/* Main Preview Swatch & Breakdown */}
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-200 bg-gray-50/80 shadow-2xs">
        {/* Color preview circle / native picker trigger */}
        <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-gray-300 shadow-xs flex-shrink-0 cursor-pointer ring-1 ring-black/5">
          <input
            type="color"
            value={value.startsWith('#') ? value : '#2563eb'}
            onChange={(e) => {
              onChange(e.target.value);
              setCmyk(hexToCmyk(e.target.value));
            }}
            className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer opacity-0"
          />
          <div className="w-full h-full" style={{ backgroundColor: value }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-gray-900">
            <span className="text-blue-600 font-sans font-semibold text-[11px]">CMYK Values:</span>
            <span>C:{cmyk.c}% M:{cmyk.m}% Y:{cmyk.y}% K:{cmyk.k}%</span>
          </div>

          {/* Total Ink Density (TIC) Bar */}
          <div className="mt-1.5 flex items-center justify-between text-[10px]">
            <span className="text-gray-500 font-medium font-sans">
              Total Ink Limit: <strong className={ink.isOverLimit ? 'text-amber-600' : 'text-gray-700'}>{ink.total}%</strong> / 300%
            </span>
            {ink.isOverLimit && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                <AlertTriangle className="w-3 h-3" /> Over 300%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CMYK Channels Sliders */}
      {mode === 'cmyk' ? (
        <div className="space-y-2 p-3 rounded-xl border border-gray-200 bg-white shadow-2xs">
          {/* Cyan (C) */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-cyan-700">
              <span>Cyan (C)</span>
              <span>{cmyk.c}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={cmyk.c}
                onChange={(e) => handleCmykChange('c', Number(e.target.value))}
                className="w-full h-1.5 bg-cyan-100 rounded-lg appearance-none cursor-pointer accent-cyan-600"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={cmyk.c}
                onChange={(e) => handleCmykChange('c', Number(e.target.value))}
                className="w-12 px-1 py-0.5 text-xs text-center border border-gray-200 rounded font-mono font-bold"
              />
            </div>
          </div>

          {/* Magenta (M) */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-pink-700">
              <span>Magenta (M)</span>
              <span>{cmyk.m}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={cmyk.m}
                onChange={(e) => handleCmykChange('m', Number(e.target.value))}
                className="w-full h-1.5 bg-pink-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={cmyk.m}
                onChange={(e) => handleCmykChange('m', Number(e.target.value))}
                className="w-12 px-1 py-0.5 text-xs text-center border border-gray-200 rounded font-mono font-bold"
              />
            </div>
          </div>

          {/* Yellow (Y) */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-amber-700">
              <span>Yellow (Y)</span>
              <span>{cmyk.y}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={cmyk.y}
                onChange={(e) => handleCmykChange('y', Number(e.target.value))}
                className="w-full h-1.5 bg-amber-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={cmyk.y}
                onChange={(e) => handleCmykChange('y', Number(e.target.value))}
                className="w-12 px-1 py-0.5 text-xs text-center border border-gray-200 rounded font-mono font-bold"
              />
            </div>
          </div>

          {/* Key / Black (K) */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-gray-800">
              <span>Key / Black (K)</span>
              <span>{cmyk.k}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={cmyk.k}
                onChange={(e) => handleCmykChange('k', Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={cmyk.k}
                onChange={(e) => handleCmykChange('k', Number(e.target.value))}
                className="w-12 px-1 py-0.5 text-xs text-center border border-gray-200 rounded font-mono font-bold"
              />
            </div>
          </div>
        </div>
      ) : (
        /* HEX / RGB Direct Input Mode */
        <div className="p-3 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2">
          <label className="text-[10px] font-semibold text-gray-500 block">HEX Color Code</label>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setCmyk(hexToCmyk(e.target.value));
            }}
            placeholder="#000000"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 uppercase font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      )}

      {/* Commercial Print Process CMYK Swatches */}
      <div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
          Process CMYK Print Palette
        </span>
        <div className="grid grid-cols-6 gap-1.5">
          {COMMERCIAL_CMYK_SWATCHES.map((preset) => {
            const isSelected = value.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleSelectPreset(preset.hex)}
                className={`w-full h-6.5 rounded-md border transition relative group ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/40 scale-105 shadow-xs'
                    : 'border-gray-200 hover:scale-105 shadow-2xs'
                }`}
                style={{ backgroundColor: preset.hex }}
                title={`${preset.name} (C:${preset.cmyk.c} M:${preset.cmyk.m} Y:${preset.cmyk.y} K:${preset.cmyk.k})`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
