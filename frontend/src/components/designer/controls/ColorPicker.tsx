'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Pipette,
  X,
  Palette,
  Sparkles,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';

interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (color: string) => void;
  canvasManager?: CanvasManager | null;
  onClose?: () => void;
  showAlpha?: boolean;
  embedded?: boolean;
  className?: string;
  allowGradient?: boolean;
  onGradientChange?: (gradient: ColorGradientValue) => void;
}

export interface ColorGradientStop {
  offset: number;
  color: string;
}

export interface ColorGradientValue {
  type: 'linear' | 'radial';
  angle: number;
  stops: ColorGradientStop[];
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

// --- HSV & Color Conversion Utilities ---

function hsvToHex(h: number, s: number, v: number): string {
  s = s / 100;
  v = v / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
  const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
  const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');
  return `#${rHex}${gHex}${bHex}`.toLowerCase();
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  if (cleaned.length !== 6) {
    return { h: 0, s: 100, v: 100 };
  }
  const r = parseInt(cleaned.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255 || 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = h * 60;
  }
  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
}

// --- Canva-Style Interactive 2D Color Spectrum & Hue Chart ---

interface CanvaColorChartProps {
  color: string;
  onChange: (hex: string) => void;
  onClose?: () => void;
  onPickEyedropper?: () => void;
}

const CanvaColorChart: React.FC<CanvaColorChartProps> = ({
  color,
  onChange,
  onClose,
  onPickEyedropper,
}) => {
  const [hsv, setHsv] = useState(() => hexToHsv(color || '#d97706'));
  const [hexInput, setHexInput] = useState(color || '#d97706');

  const spectrumRef = useRef<HTMLDivElement | null>(null);
  const hueSliderRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSpectrum = useRef(false);
  const isDraggingHue = useRef(false);

  useEffect(() => {
    if (color) {
      setHexInput(color);
      const parsed = hexToHsv(color);
      setHsv((prev) => {
        // Keep current hue if saturation is 0 (grayscale)
        if (parsed.s === 0 && parsed.v > 0) {
          return { ...parsed, h: prev.h };
        }
        return parsed;
      });
    }
  }, [color]);

  // Spectrum 2D Drag Handler
  const handleSpectrumMove = useCallback((clientX: number, clientY: number) => {
    if (!spectrumRef.current) return;
    const rect = spectrumRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);

    const nextHex = hsvToHex(hsv.h, s, v);
    setHsv({ ...hsv, s, v });
    setHexInput(nextHex);
    onChange(nextHex);
  }, [hsv, onChange]);

  // Hue Slider Drag Handler
  const handleHueMove = useCallback((clientX: number) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const h = Math.round((x / rect.width) * 360) % 360;

    const nextHex = hsvToHex(h, hsv.s, hsv.v);
    setHsv({ ...hsv, h });
    setHexInput(nextHex);
    onChange(nextHex);
  }, [hsv, onChange]);

  const handlePointerDownSpectrum = (e: React.PointerEvent) => {
    isDraggingSpectrum.current = true;
    handleSpectrumMove(e.clientX, e.clientY);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMoveSpectrum = (e: React.PointerEvent) => {
    if (isDraggingSpectrum.current) {
      handleSpectrumMove(e.clientX, e.clientY);
    }
  };

  const handlePointerUpSpectrum = (e: React.PointerEvent) => {
    isDraggingSpectrum.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handlePointerDownHue = (e: React.PointerEvent) => {
    isDraggingHue.current = true;
    handleHueMove(e.clientX);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMoveHue = (e: React.PointerEvent) => {
    if (isDraggingHue.current) {
      handleHueMove(e.clientX);
    }
  };

  const handlePointerUpHue = (e: React.PointerEvent) => {
    isDraggingHue.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    setHexInput(val);
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val);
    }
  };

  return (
    <div className="p-3 bg-white rounded-2xl border border-gray-200/90 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-bold text-gray-900">Custom Color Chart</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-bold text-gray-500 hover:text-gray-900"
          >
            Done
          </button>
        )}
      </div>

      {/* 1. 2D SATURATION / BRIGHTNESS SPECTRUM AREA */}
      <div
        ref={spectrumRef}
        onPointerDown={handlePointerDownSpectrum}
        onPointerMove={handlePointerMoveSpectrum}
        onPointerUp={handlePointerUpSpectrum}
        onPointerCancel={handlePointerUpSpectrum}
        className="relative w-full h-32 rounded-xl cursor-crosshair overflow-hidden shadow-inner ring-1 ring-black/5"
        style={{
          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          backgroundImage:
            'linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, transparent)',
          touchAction: 'none',
        }}
      >
        {/* Draggable Circle Picker Marker */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none ring-1 ring-black/30"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* 2. RAINBOW HUE SLIDER */}
      <div className="space-y-1">
        <div
          ref={hueSliderRef}
          onPointerDown={handlePointerDownHue}
          onPointerMove={handlePointerMoveHue}
          onPointerUp={handlePointerUpHue}
          onPointerCancel={handlePointerUpHue}
          className="relative w-full h-3.5 rounded-full cursor-pointer shadow-inner ring-1 ring-black/10"
          style={{
            background:
              'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
            touchAction: 'none',
          }}
        >
          {/* Draggable Hue Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-white shadow-md -translate-x-1/2 pointer-events-none ring-1 ring-black/30"
            style={{
              left: `${(hsv.h / 360) * 100}%`,
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            }}
          />
        </div>
      </div>

      {/* 3. HEX INPUT & EYEDROPPER CONTROLS */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        {/* Selected Color Box */}
        <div
          className="w-8 h-8 rounded-lg border border-gray-300 shadow-2xs shrink-0 ring-1 ring-black/5"
          style={{ backgroundColor: color }}
        />

        {/* Hex Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={hexInput.toUpperCase()}
            onChange={handleHexChange}
            placeholder="#D97706"
            className="w-full pl-2.5 pr-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-mono font-bold uppercase text-gray-900 focus:outline-none focus:border-purple-600 focus:bg-white transition"
          />
        </div>

        {/* Pipette / Eyedropper Button */}
        {typeof window !== 'undefined' && 'EyeDropper' in window && onPickEyedropper && (
          <button
            type="button"
            onClick={onPickEyedropper}
            title="Pick color from screen"
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-purple-600 transition shadow-2xs shrink-0"
          >
            <Pipette className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

interface GradientEditorProps {
  value: string;
  onChange: (gradient: ColorGradientValue) => void;
  onPickEyedropper: () => void;
}

interface GradientPreset {
  name: string;
  colors: string[];
  angle?: number;
  type?: 'linear' | 'radial';
}

// A broad Canva-style gradient library. These are original curated presets,
// grouped visually from vivid and pastel through metallic and dark themes.
const GRADIENT_PRESETS: GradientPreset[] = [
  { name: 'Canva Purple Aqua', colors: ['#7d2ae8', '#00c4cc'] },
  { name: 'Sunset', colors: ['#ff5757', '#ffde59'] },
  { name: 'Electric Violet', colors: ['#0047ff', '#cb6ce6'] },
  { name: 'Fresh Mint', colors: ['#00d287', '#00c4cc'] },
  { name: 'Berry', colors: ['#f43f5e', '#8b5cf6'] },
  { name: 'Midnight', colors: ['#111827', '#64748b'] },
  { name: 'Ocean', colors: ['#0052d4', '#4364f7', '#6fb1fc'] },
  { name: 'Aurora', colors: ['#00f5a0', '#00d9f5', '#7d2ae8'] },
  { name: 'Instagram', colors: ['#833ab4', '#fd1d1d', '#fcb045'] },
  { name: 'Peach', colors: ['#ffecd2', '#fcb69f'] },
  { name: 'Cotton Candy', colors: ['#fbc2eb', '#a6c1ee'] },
  { name: 'Lavender', colors: ['#e0c3fc', '#8ec5fc'] },
  { name: 'Rose Gold', colors: ['#f4c4c4', '#dba39a', '#b76e79'] },
  { name: 'Golden Hour', colors: ['#fff3b0', '#e09f3e', '#9e2a2b'] },
  { name: 'Tropical', colors: ['#f9d423', '#ff4e50'] },
  { name: 'Mango', colors: ['#ffe259', '#ffa751'] },
  { name: 'Fire', colors: ['#ff512f', '#dd2476'] },
  { name: 'Candy', colors: ['#ff6a88', '#ff99ac', '#fbc2eb'] },
  { name: 'Sky', colors: ['#56ccf2', '#2f80ed'] },
  { name: 'Ice', colors: ['#e0ffff', '#80deea', '#00acc1'] },
  { name: 'Deep Sea', colors: ['#2c3e50', '#4ca1af'] },
  { name: 'Emerald', colors: ['#11998e', '#38ef7d'] },
  { name: 'Forest', colors: ['#134e5e', '#71b280'] },
  { name: 'Lime', colors: ['#a8ff78', '#78ffd6'] },
  { name: 'Royal', colors: ['#141e30', '#243b55', '#7d2ae8'] },
  { name: 'Neon', colors: ['#fc00ff', '#00dbde'] },
  { name: 'Galaxy', colors: ['#0f0c29', '#302b63', '#24243e'] },
  { name: 'Chrome', colors: ['#f5f7fa', '#c3cfe2', '#6b7280'] },
  { name: 'Gold', colors: ['#fff7ad', '#ffa800', '#7a4b00'] },
  { name: 'Silver', colors: ['#ffffff', '#bdc3c7', '#2c3e50'] },
  { name: 'Black Glow', colors: ['#000000', '#434343'] },
  { name: 'Radial Glow', colors: ['#ffffff', '#8ec5fc', '#7d2ae8'], type: 'radial' },
  { name: 'Radial Sunset', colors: ['#ffde59', '#ff5757', '#8b3dff'], type: 'radial' },
  { name: 'Radial Aqua', colors: ['#e0ffff', '#00c4cc', '#0047ff'], type: 'radial' },
];

const GradientEditor: React.FC<GradientEditorProps> = ({
  value,
  onChange,
  onPickEyedropper,
}) => {
  const [type, setType] = useState<'linear' | 'radial'>('linear');
  const [angle, setAngle] = useState(90);
  const [stops, setStops] = useState<ColorGradientStop[]>([
    { offset: 0, color: value || '#7d2ae8' },
    { offset: 1, color: '#00c4cc' },
  ]);
  const [activeStop, setActiveStop] = useState(0);

  const emit = useCallback((nextType: 'linear' | 'radial', nextAngle: number, nextStops: ColorGradientStop[]) => {
    onChange({ type: nextType, angle: nextAngle, stops: nextStops });
  }, [onChange]);

  const updateType = (nextType: 'linear' | 'radial') => {
    setType(nextType);
    emit(nextType, angle, stops);
  };

  const updateAngle = (nextAngle: number) => {
    setAngle(nextAngle);
    emit(type, nextAngle, stops);
  };

  const updateStopColor = (color: string) => {
    const nextStops = stops.map((stop, index) =>
      index === activeStop ? { ...stop, color } : stop
    );
    setStops(nextStops);
    emit(type, angle, nextStops);
  };

  const applyPreset = (preset: GradientPreset) => {
    const denominator = Math.max(preset.colors.length - 1, 1);
    const nextStops = preset.colors.map((color, index) => ({
      offset: index / denominator,
      color,
    }));
    const nextType = preset.type || 'linear';
    const nextAngle = preset.angle ?? angle;
    setType(nextType);
    setAngle(nextAngle);
    setStops(nextStops);
    setActiveStop(0);
    emit(nextType, nextAngle, nextStops);
  };

  const updateStopPosition = (positionPercent: number) => {
    const offset = Math.max(0, Math.min(100, positionPercent)) / 100;
    const nextStops = stops
      .map((stop, index) => index === activeStop ? { ...stop, offset } : stop)
      .sort((a, b) => a.offset - b.offset);
    const activeColor = stops[activeStop]?.color;
    const nextActiveIndex = Math.max(0, nextStops.findIndex((stop) => stop.color === activeColor && stop.offset === offset));
    setStops(nextStops);
    setActiveStop(nextActiveIndex);
    emit(type, angle, nextStops);
  };

  const addStop = () => {
    if (stops.length >= 8) return;
    const ordered = [...stops].sort((a, b) => a.offset - b.offset);
    let insertAfter = 0;
    let largestGap = -1;
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const gap = ordered[index + 1].offset - ordered[index].offset;
      if (gap > largestGap) {
        largestGap = gap;
        insertAfter = index;
      }
    }
    const left = ordered[insertAfter];
    const right = ordered[insertAfter + 1] || left;
    const nextStop = {
      offset: (left.offset + right.offset) / 2,
      color: left.color,
    };
    const nextStops = [...ordered, nextStop].sort((a, b) => a.offset - b.offset);
    const nextIndex = nextStops.indexOf(nextStop);
    setStops(nextStops);
    setActiveStop(nextIndex);
    emit(type, angle, nextStops);
  };

  const removeStop = () => {
    if (stops.length <= 2) return;
    const nextStops = stops.filter((_, index) => index !== activeStop);
    const nextActive = Math.min(activeStop, nextStops.length - 1);
    setStops(nextStops);
    setActiveStop(nextActive);
    emit(type, angle, nextStops);
  };

  const reverseStops = () => {
    const nextStops = stops
      .map((stop) => ({ ...stop, offset: 1 - stop.offset }))
      .reverse();
    setStops(nextStops);
    setActiveStop(Math.max(0, nextStops.length - 1 - activeStop));
    emit(type, angle, nextStops);
  };

  const cssGradient = type === 'radial'
    ? `radial-gradient(circle, ${stops.map((stop) => `${stop.color} ${stop.offset * 100}%`).join(', ')})`
    : `linear-gradient(${angle}deg, ${stops.map((stop) => `${stop.color} ${stop.offset * 100}%`).join(', ')})`;

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="h-20 rounded-xl border border-black/10 shadow-inner" style={{ background: cssGradient }} />

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {(['linear', 'radial'] as const).map((gradientType) => (
          <button
            key={gradientType}
            type="button"
            onClick={() => updateType(gradientType)}
            className={`rounded-lg py-1.5 text-[11px] font-bold capitalize transition ${type === gradientType ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            {gradientType}
          </button>
        ))}
      </div>

      {type === 'linear' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600">
            <span>Angle</span><span>{angle}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={angle}
            onChange={(event) => updateAngle(Number(event.target.value))}
            className="w-full accent-purple-600"
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-700">Custom colour stops</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={addStop}
              disabled={stops.length >= 8}
              className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2 text-[10px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
            <button
              type="button"
              onClick={removeStop}
              disabled={stops.length <= 2}
              className="h-7 rounded-lg border border-gray-200 px-2 text-[10px] font-bold text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              Remove
            </button>
            <button type="button" onClick={reverseStops} className="h-7 rounded-lg border border-gray-200 px-2 text-[10px] font-bold text-gray-600 hover:bg-gray-50">
              Reverse
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {stops.map((stop, index) => (
            <button
              key={`${stop.offset}_${index}`}
              type="button"
              onClick={() => setActiveStop(index)}
              title={`Colour stop ${index + 1}: ${Math.round(stop.offset * 100)}%`}
              className={`h-9 min-w-9 flex-1 rounded-xl border transition ${activeStop === index ? 'border-purple-600 ring-2 ring-purple-200' : 'border-gray-200'}`}
              style={{ backgroundColor: stop.color }}
            />
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
            <span>Selected stop position</span>
            <span>{Math.round((stops[activeStop]?.offset || 0) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round((stops[activeStop]?.offset || 0) * 100)}
            onChange={(event) => updateStopPosition(Number(event.target.value))}
            className="w-full accent-purple-600"
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-700">Gradient library</span>
          <span className="text-[9px] font-semibold text-gray-400">{GRADIENT_PRESETS.length} presets</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              className="h-9 rounded-lg border border-gray-200 shadow-sm transition hover:scale-105"
              style={{
                background: preset.type === 'radial'
                  ? `radial-gradient(circle, ${preset.colors.join(', ')})`
                  : `linear-gradient(${preset.angle ?? 135}deg, ${preset.colors.join(', ')})`,
              }}
              title={preset.name}
            />
          ))}
        </div>
      </div>

      <CanvaColorChart
        color={stops[activeStop]?.color || '#7d2ae8'}
        onChange={updateStopColor}
        onPickEyedropper={onPickEyedropper}
      />
    </div>
  );
};

// --- Main ColorPicker Component ---

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label = 'Colour',
  value = '#2563eb',
  onChange,
  canvasManager,
  onClose,
  embedded = false,
  className,
  allowGradient = false,
  onGradientChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Canva-style behaviour: opening the colour panel immediately exposes the
  // spectrum; the user does not need to click the rainbow plus button first.
  const [showCustomPicker, setShowCustomPicker] = useState(true);
  const [mode, setMode] = useState<'solid' | 'gradient'>('solid');
  const [showAllSolid, setShowAllSolid] = useState(false);
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
    setMode('solid');
    onChange(hex);
    setHexInput(hex);
  };

  const openGradientMode = () => {
    setMode('gradient');
    onGradientChange?.({
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: value || '#7d2ae8' },
        { offset: 1, color: '#00c4cc' },
      ],
    });
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
      {/* 1. TOP HEADER (Title & Close) */}
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
        {/* Canva-style Solid / Gradient switcher */}
        {allowGradient && onGradientChange && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode('solid')}
              className={`rounded-lg py-2 text-xs font-bold transition ${mode === 'solid' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Solid
            </button>
            <button
              type="button"
              onClick={openGradientMode}
              className={`rounded-lg py-2 text-xs font-bold transition ${mode === 'gradient' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Gradient
            </button>
          </div>
        )}

        {/* 2. SEARCH INPUT */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder='Try "blue" or "#00c4cc"'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-gray-50/70 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-600 focus:bg-white transition"
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

        {/* Direct Hex candidate apply */}
        {searchHexCandidate && /^#[0-9A-Fa-f]{3,6}$/.test(searchHexCandidate) && (
          <div className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full border border-black/15 shadow-xs"
                style={{ backgroundColor: searchHexCandidate }}
              />
              <span className="text-xs font-mono font-bold text-purple-900">
                {searchHexCandidate.toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectColor(searchHexCandidate)}
              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
            >
              Apply
            </button>
          </div>
        )}

        {/* 3. CANVA DIRECT COLOR SPECTRUM CHART (Direct Interactive Color Chart) */}
        {mode === 'gradient' && onGradientChange && (
          <GradientEditor
            value={value}
            onChange={onGradientChange}
            onPickEyedropper={handlePickEyedropper}
          />
        )}

        {mode === 'solid' && showCustomPicker && (
          <CanvaColorChart
            color={value}
            onChange={onChange}
            onClose={() => setShowCustomPicker(false)}
            onPickEyedropper={handlePickEyedropper}
          />
        )}

        {/* 4. COLOURS IN THIS DESIGN (Document Colors) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
            <Palette className="w-4 h-4 text-purple-600" />
            <span>Colours in this design</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {/* Add Custom Color Circle Button with Canva Rainbow conic-gradient */}
            <button
              type="button"
              onClick={() => {
                setMode('solid');
                setShowCustomPicker((prev) => !prev);
              }}
              title="Add a new custom color"
              className={`relative w-8 h-8 rounded-full p-[2px] shrink-0 transition hover:scale-110 shadow-xs ${showCustomPicker ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''
                }`}
              style={{
                background:
                  'conic-gradient(from 0deg, #ff0000, #ff8800, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
              }}
            >
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-gray-700">
                <Plus className="w-4 h-4 text-gray-800" strokeWidth={2.5} />
              </div>
            </button>

            {/* Eyedropper Tool Circle Button */}
            {typeof window !== 'undefined' && 'EyeDropper' in window && (
              <button
                type="button"
                onClick={handlePickEyedropper}
                title="Pick color from design"
                className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 hover:text-purple-600 transition hover:scale-110 shadow-xs shrink-0"
              >
                <Pipette className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Design Colors Swatches */}
            {designColors.map((colorHex, idx) => {
              const isSelected = value.toLowerCase() === colorHex.toLowerCase();
              const isWhite = colorHex.toLowerCase() === '#ffffff' || colorHex.toLowerCase() === '#fff';
              return (
                <button
                  key={`${colorHex}_${idx}`}
                  type="button"
                  onClick={() => handleSelectColor(colorHex)}
                  title={colorHex}
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${isWhite ? 'border border-gray-200' : ''
                    } ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''}`}
                  style={{ backgroundColor: colorHex }}
                >
                  {isSelected && (
                    <Check
                      className={`w-3.5 h-3.5 ${isWhite || colorHex.toLowerCase() === '#ffde59' ? 'text-gray-900' : 'text-white'
                        }`}
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. BRAND KIT SECTION */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Brand Kit</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 truncate max-w-full font-medium">
            Colors from ORIGINAL LOGO DESIGN
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
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${isWhite ? 'border border-gray-200' : ''
                    } ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''}`}
                  style={{ backgroundColor: item.hex }}
                >
                  {isSelected && (
                    <Check
                      className={`w-3.5 h-3.5 ${isWhite ? 'text-gray-900' : 'text-white'
                        }`}
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. PHOTO COLOURS SECTION */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span>Photo colours</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
              <ImageIcon className="w-4 h-4" />
            </div>

            {PHOTO_COLORS.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
              const isSelected = value.toLowerCase() === item.hex.toLowerCase();
              return (
                <button
                  key={item.hex}
                  type="button"
                  onClick={() => handleSelectColor(item.hex)}
                  title={`${item.name} (${item.hex})`}
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''
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

        {/* 7. DEFAULT SOLID COLOURS SECTION */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <Palette className="w-4 h-4 text-gray-700" />
              <span>Default solid colours</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAllSolid((prev) => !prev)}
              className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 hover:underline"
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
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center ${isWhite ? 'border border-gray-300' : ''
                    } ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''}`}
                  style={{ backgroundColor: item.hex }}
                >
                  {isSelected && (
                    <Check
                      className={`w-3.5 h-3.5 ${isWhite || item.hex === '#e0e0e0' ? 'text-gray-900' : 'text-white'
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
                  className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''
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
                    className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''
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

export default ColorPicker;
