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
  RotateCcw,
  Sliders,
  History,
  ArrowRightLeft,
} from 'lucide-react';
import type { CanvasManager } from '../canvas/CanvasManager';
import { DesignerGradientValue, DesignerGradientStop } from '@/types/designer';
import {
  hexToRgb,
  rgbToHex,
  hexToHsv,
  hsvToHex,
  isValidHex,
  colorOrGradientToCss,
  getRecentColors,
  addRecentColor,
} from '@/utils/colorUtils';

export interface ColorPickerProps {
  label?: string;
  value: string | DesignerGradientValue;
  onChange: (value: string | DesignerGradientValue) => void;
  onClose?: () => void;
  allowGradient?: boolean;
  allowAlpha?: boolean;
  showAlpha?: boolean;
  recentColors?: string[];
  canvasManager?: CanvasManager | null;
  embedded?: boolean;
  className?: string;
  onGradientChange?: (gradient: DesignerGradientValue) => void;
}

// Re-export for backward compatibility
export type ColorGradientValue = DesignerGradientValue;
export type ColorGradientStop = DesignerGradientStop;

// --- Curated Canva-Style Solid Palettes ---

const BRAND_KIT_COLORS = [
  { name: 'Warm Brown', hex: '#6b5335' },
  { name: 'Rich Black', hex: '#1c1917' },
  { name: 'Soft Ice Blue', hex: '#d0dce5' },
  { name: 'Golden Ochre', hex: '#d4a017' },
  { name: 'Crimson Red', hex: '#b91c1c' },
  { name: 'Deep Emerald', hex: '#065f46' },
];

const PHOTO_COLORS = [
  { name: 'Warm Sand', hex: '#e2c2a4' },
  { name: 'Bright Magenta', hex: '#e14e9d' },
  { name: 'Olive Green', hex: '#597a2b' },
  { name: 'Espresso Brown', hex: '#4e2e28' },
  { name: 'Ruby Red', hex: '#c11e2b' },
];

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

// --- Curated Canva Gradient Presets ---

interface GradientPreset {
  name: string;
  colors: string[];
  angle?: number;
  type?: 'linear' | 'radial';
}

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
  { name: 'Radial Glow', colors: ['#ffffff', '#8ec5fc', '#7d2ae8'], type: 'radial' },
  { name: 'Radial Sunset', colors: ['#ffde59', '#ff5757', '#8b3dff'], type: 'radial' },
  { name: 'Radial Aqua', colors: ['#e0ffff', '#00c4cc', '#0047ff'], type: 'radial' },
];

// --- Canva Color Chart (HSV Spectrum + Hex/RGB inputs + Eyedropper) ---

interface CanvaColorChartProps {
  color: string;
  onChange: (hex: string) => void;
  onSelectAndClose?: (hex: string) => void;
  onClose?: () => void;
  allowAlpha?: boolean;
}

const CanvaColorChart: React.FC<CanvaColorChartProps> = ({
  color,
  onChange,
  onSelectAndClose,
  allowAlpha = false,
}) => {
  const initialHex = color && typeof color === 'string' && color.startsWith('#') ? color : '#7d2ae8';
  const [hsv, setHsv] = useState(() => hexToHsv(initialHex));
  const [hexInput, setHexInput] = useState(initialHex);
  const [inputMode, setInputMode] = useState<'hex' | 'rgb'>('hex');
  const [rgbState, setRgbState] = useState(() => hexToRgb(initialHex) || { r: 125, g: 42, b: 232, a: 1 });
  const [alpha, setAlpha] = useState<number>(100);

  const spectrumRef = useRef<HTMLDivElement | null>(null);
  const hueSliderRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSpectrum = useRef(false);
  const isDraggingHue = useRef(false);

  useEffect(() => {
    if (color && typeof color === 'string' && color.startsWith('#')) {
      setHexInput(color);
      const parsedHsv = hexToHsv(color);
      const parsedRgb = hexToRgb(color);
      if (parsedRgb) {
        setRgbState(parsedRgb);
        setAlpha(Math.round((parsedRgb.a ?? 1) * 100));
      }
      setHsv((prev) => {
        if (parsedHsv.s === 0 && parsedHsv.v > 0) {
          return { ...parsedHsv, h: prev.h };
        }
        return parsedHsv;
      });
    }
  }, [color]);

  const emitColor = useCallback((nextHex: string) => {
    onChange(nextHex);
    const parsedRgb = hexToRgb(nextHex);
    if (parsedRgb) setRgbState(parsedRgb);
  }, [onChange]);

  // Spectrum 2D Drag Handler
  const handleSpectrumMove = useCallback((clientX: number, clientY: number) => {
    if (!spectrumRef.current) return;
    const rect = spectrumRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);

    const nextHex = hsvToHex(hsv.h, s, v);
    setHsv((prev) => ({ ...prev, s, v }));
    setHexInput(nextHex);
    emitColor(nextHex);
  }, [hsv.h, emitColor]);

  // Hue Slider Drag Handler
  const handleHueMove = useCallback((clientX: number) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const h = Math.round((x / rect.width) * 360) % 360;

    const nextHex = hsvToHex(h, hsv.s, hsv.v);
    setHsv((prev) => ({ ...prev, h }));
    setHexInput(nextHex);
    emitColor(nextHex);
  }, [hsv.s, hsv.v, emitColor]);

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
    if (isValidHex(val)) {
      setHsv(hexToHsv(val));
      emitColor(val);
    }
  };

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      let val = hexInput.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (isValidHex(val)) {
        if (onSelectAndClose) {
          onSelectAndClose(val);
        } else {
          emitColor(val);
        }
      }
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', valueStr: string) => {
    const num = Math.max(0, Math.min(255, parseInt(valueStr) || 0));
    const nextRgb = { ...rgbState, [channel]: num };
    setRgbState(nextRgb);
    const hex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    setHexInput(hex);
    setHsv(hexToHsv(hex));
    emitColor(hex);
  };

  // Native Browser Eyedropper API
  const handleEyedropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const picker = new (window as any).EyeDropper();
        const result = await picker.open();
        if (result?.sRGBHex) {
          const hex = result.sRGBHex.toUpperCase();
          setHexInput(hex);
          emitColor(hex);
          if (onSelectAndClose) {
            onSelectAndClose(hex);
          }
        }
      } catch {
        // Gracefully ignore user cancellation
      }
    }
  };

  return (
    <div className="p-3 bg-white rounded-2xl border border-gray-200/90 shadow-sm space-y-3 select-none">
      {/* 1. 2D SATURATION & VALUE CANVAS */}
      <div
        ref={spectrumRef}
        onPointerDown={handlePointerDownSpectrum}
        onPointerMove={handlePointerMoveSpectrum}
        onPointerUp={handlePointerUpSpectrum}
        onPointerCancel={handlePointerUpSpectrum}
        className="relative w-full h-32 rounded-xl overflow-hidden cursor-crosshair shadow-inner"
        style={{
          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          touchAction: 'none',
        }}
      >
        {/* Horizontal White gradient (Saturation 0% to 100%) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #ffffff 0%, rgba(255,255,255,0) 100%)',
          }}
        />
        {/* Vertical Black gradient (Value 100% to 0%) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, #000000 0%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* Draggable Selector Thumb */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none ring-1 ring-black/30"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: hexInput,
          }}
        />
      </div>

      {/* 2. HUE RAINBOW SLIDER */}
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
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-white shadow-md -translate-x-1/2 pointer-events-none ring-1 ring-black/30"
            style={{
              left: `${(hsv.h / 360) * 100}%`,
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            }}
          />
        </div>
      </div>

      {/* 3. ALPHA SLIDER (OPTIONAL) */}
      {allowAlpha && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
            <span>Opacity</span>
            <span>{alpha}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))}
            className="w-full h-2 rounded-full accent-purple-600 cursor-pointer"
          />
        </div>
      )}

      {/* 4. HEX / RGB TOGGLE & INPUTS */}
      <div className="pt-2 border-t border-gray-100 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setInputMode('hex')}
              className={`px-2 py-0.5 rounded-md transition ${inputMode === 'hex' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'}`}
            >
              HEX
            </button>
            <button
              type="button"
              onClick={() => setInputMode('rgb')}
              className={`px-2 py-0.5 rounded-md transition ${inputMode === 'rgb' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'}`}
            >
              RGB
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Native Eyedropper API */}
            {typeof window !== 'undefined' && 'EyeDropper' in window && (
              <button
                type="button"
                onClick={handleEyedropper}
                title="Sample colour from screen"
                className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:border-purple-500 text-gray-700 hover:text-purple-600 transition shadow-2xs"
              >
                <Pipette className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Native Color Picker input trigger */}
            <div className="relative w-6 h-6 rounded-lg border border-gray-300 overflow-hidden cursor-pointer shadow-2xs hover:scale-105 transition" title="Open native OS colour picker">
              <input
                type="color"
                value={hexInput.startsWith('#') && hexInput.length === 7 ? hexInput : '#7d2ae8'}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setHexInput(val);
                  setHsv(hexToHsv(val));
                  emitColor(val);
                  if (onSelectAndClose) onSelectAndClose(val);
                }}
                className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer opacity-0"
              />
              <div className="w-full h-full" style={{ backgroundColor: hexInput }} />
            </div>
          </div>
        </div>

        {inputMode === 'hex' ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={hexInput.toUpperCase()}
                onChange={handleHexChange}
                onKeyDown={handleHexKeyDown}
                placeholder="#7D2AE8"
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-mono font-bold uppercase text-gray-900 focus:outline-none focus:border-purple-600 focus:bg-white transition"
              />
            </div>
            {onSelectAndClose && (
              <button
                type="button"
                onClick={() => onSelectAndClose(hexInput)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-2xs"
              >
                Select
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <span className="block text-[9px] font-bold text-gray-400 mb-0.5">R</span>
              <input
                type="number"
                min="0"
                max="255"
                value={rgbState.r}
                onChange={(e) => handleRgbChange('r', e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:border-purple-600 focus:bg-white text-center"
              />
            </div>
            <div>
              <span className="block text-[9px] font-bold text-gray-400 mb-0.5">G</span>
              <input
                type="number"
                min="0"
                max="255"
                value={rgbState.g}
                onChange={(e) => handleRgbChange('g', e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:border-purple-600 focus:bg-white text-center"
              />
            </div>
            <div>
              <span className="block text-[9px] font-bold text-gray-400 mb-0.5">B</span>
              <input
                type="number"
                min="0"
                max="255"
                value={rgbState.b}
                onChange={(e) => handleRgbChange('b', e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:border-purple-600 focus:bg-white text-center"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Gradient Editor (Linear, Radial, Multi-Stops, Angle, Presets, Apply/Cancel) ---

interface GradientEditorProps {
  initialGradient: DesignerGradientValue;
  onPreview: (gradient: DesignerGradientValue) => void;
  onApply: (gradient: DesignerGradientValue) => void;
  onCancel: () => void;
}

const GradientEditor: React.FC<GradientEditorProps> = ({
  initialGradient,
  onPreview,
  onApply,
  onCancel,
}) => {
  const [type, setType] = useState<'linear' | 'radial'>(initialGradient.type || 'linear');
  const [angle, setAngle] = useState<number>(initialGradient.angle ?? 90);
  const [stops, setStops] = useState<DesignerGradientStop[]>(
    initialGradient.stops && initialGradient.stops.length >= 2
      ? initialGradient.stops
      : [
          { offset: 0, color: '#7d2ae8' },
          { offset: 1, color: '#00c4cc' },
        ]
  );
  const [activeStop, setActiveStop] = useState<number>(0);

  const emit = useCallback(
    (nextType: 'linear' | 'radial', nextAngle: number, nextStops: DesignerGradientStop[]) => {
      onPreview({ type: nextType, angle: nextAngle, stops: nextStops });
    },
    [onPreview]
  );

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

  const updateStopPosition = (percent: number) => {
    const offset = Math.max(0, Math.min(100, percent)) / 100;
    const nextStops = stops.map((stop, index) =>
      index === activeStop ? { ...stop, offset } : stop
    );
    setStops(nextStops);
    emit(type, angle, nextStops);
  };

  const addStop = () => {
    if (stops.length >= 8) return;
    const current = stops[activeStop] || stops[0];
    const newOffset = Math.min(0.95, current.offset + 0.15);
    const newColor = '#ffffff';
    const nextStops = [...stops, { offset: newOffset, color: newColor }].sort(
      (a, b) => a.offset - b.offset
    );
    const newIndex = nextStops.findIndex((s) => s.offset === newOffset && s.color === newColor);
    setStops(nextStops);
    setActiveStop(newIndex >= 0 ? newIndex : nextStops.length - 1);
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

  const applyPreset = (preset: GradientPreset) => {
    const denominator = Math.max(preset.colors.length - 1, 1);
    const nextStops = preset.colors.map((color, index) => ({
      offset: index / denominator,
      color,
    }));
    const nextType = preset.type || 'linear';
    const nextAngle = preset.angle ?? 135;
    setType(nextType);
    setAngle(nextAngle);
    setStops(nextStops);
    setActiveStop(0);
    emit(nextType, nextAngle, nextStops);
  };

  const currentGradientVal: DesignerGradientValue = useMemo(
    () => ({ type, angle, stops }),
    [type, angle, stops]
  );

  const cssGradient = colorOrGradientToCss(currentGradientVal);

  return (
    <div className="space-y-3.5 rounded-2xl border border-gray-200 bg-white p-3 shadow-xs">
      {/* 1. LIVE GRADIENT PREVIEW BAR */}
      <div
        className="h-16 rounded-xl border border-black/10 shadow-inner flex items-end justify-end p-2 transition"
        style={{ background: cssGradient }}
      >
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-black/60 text-white rounded-md backdrop-blur-xs">
          {type === 'radial' ? 'Radial' : `${angle}° Linear`}
        </span>
      </div>

      {/* 2. GRADIENT TYPE SELECTOR (Linear vs Radial) */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {(['linear', 'radial'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => updateType(t)}
            className={`rounded-lg py-1.5 text-xs font-bold capitalize transition ${
              type === t ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 3. LINEAR ANGLE SLIDER & INPUT */}
      {type === 'linear' && (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700">
            <span>Angle</span>
            <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md font-mono text-[11px]">
              <input
                type="number"
                min="0"
                max="360"
                value={angle}
                onChange={(e) => updateAngle(Number(e.target.value) % 361)}
                className="w-8 bg-transparent text-right font-bold text-gray-900 focus:outline-none"
              />
              <span>°</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={angle}
            onChange={(e) => updateAngle(Number(e.target.value))}
            className="w-full h-2 rounded-full accent-purple-600 cursor-pointer"
          />
        </div>
      )}

      {/* 4. COLOUR STOPS BAR & CONTROLS */}
      <div className="space-y-2.5 pt-1 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-800">Colour Stops</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={addStop}
              disabled={stops.length >= 8}
              className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2 text-[10px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition shadow-2xs"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
            <button
              type="button"
              onClick={removeStop}
              disabled={stops.length <= 2}
              className="h-7 rounded-lg border border-gray-200 px-2 text-[10px] font-bold text-gray-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 transition shadow-2xs"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={reverseStops}
              title="Reverse stop order"
              className="h-7 rounded-lg border border-gray-200 px-2 text-[10px] font-bold text-gray-700 hover:bg-gray-50 transition shadow-2xs flex items-center gap-1"
            >
              <ArrowRightLeft className="h-3 w-3" /> Reverse
            </button>
          </div>
        </div>

        {/* Swatches for each stop */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {stops.map((stop, index) => (
            <button
              key={`${stop.offset}_${index}`}
              type="button"
              onClick={() => setActiveStop(index)}
              title={`Colour stop ${index + 1}: ${Math.round(stop.offset * 100)}%`}
              className={`h-9 min-w-9 flex-1 rounded-xl border transition shadow-2xs ${
                activeStop === index ? 'border-purple-600 ring-2 ring-purple-300 scale-105' : 'border-gray-200 hover:border-gray-400'
              }`}
              style={{ backgroundColor: stop.color }}
            />
          ))}
        </div>

        {/* Selected stop position slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
            <span>Stop {activeStop + 1} Position</span>
            <span>{Math.round((stops[activeStop]?.offset || 0) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round((stops[activeStop]?.offset || 0) * 100)}
            onChange={(e) => updateStopPosition(Number(e.target.value))}
            className="w-full h-2 rounded-full accent-purple-600 cursor-pointer"
          />
        </div>

        {/* Active stop color editor */}
        <CanvaColorChart
          color={stops[activeStop]?.color || '#7d2ae8'}
          onChange={updateStopColor}
        />
      </div>

      {/* 5. USEFUL GRADIENT PRESETS */}
      <div className="space-y-2 border-t border-gray-100 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-800">Gradient Library</span>
          <span className="text-[10px] font-semibold text-gray-400">{GRADIENT_PRESETS.length} presets</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              className="h-8 rounded-lg border border-gray-200 shadow-2xs transition hover:scale-110"
              style={{
                background:
                  preset.type === 'radial'
                    ? `radial-gradient(circle, ${preset.colors.join(', ')})`
                    : `linear-gradient(${preset.angle ?? 135}deg, ${preset.colors.join(', ')})`,
              }}
              title={preset.name}
            />
          ))}
        </div>
      </div>

      {/* 6. APPLY & CANCEL BUTTONS */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onApply(currentGradientVal)}
          className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" /> Apply
        </button>
      </div>
    </div>
  );
};

// --- Reusable Main ColorPicker Component ---

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label = 'Colour',
  value = '#2563eb',
  onChange,
  onClose,
  allowGradient = false,
  allowAlpha = false,
  showAlpha = false,
  recentColors: propRecentColors,
  canvasManager,
  embedded = false,
  className = '',
  onGradientChange,
}) => {
  const isInitialGradient = typeof value === 'object' && value !== null && 'stops' in value;

  const [mode, setMode] = useState<'solid' | 'gradient'>(
    allowGradient && isInitialGradient ? 'gradient' : 'solid'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSolid, setShowAllSolid] = useState(false);
  const [showAllGradients, setShowAllGradients] = useState(false);
  const [recentList, setRecentList] = useState<string[]>(() => {
    if (propRecentColors && propRecentColors.length > 0) return propRecentColors;
    return getRecentColors();
  });
  const [designColors, setDesignColors] = useState<string[]>([]);

  // Snapshot initial value so Cancel button in Gradient mode restores it completely
  const initialValueRef = useRef<string | DesignerGradientValue>(value);

  // Keep recent list synced with prop or localStorage
  useEffect(() => {
    if (propRecentColors && propRecentColors.length > 0) {
      setRecentList(propRecentColors);
    } else {
      setRecentList(getRecentColors());
    }
  }, [propRecentColors]);

  // Extract colors present in design
  useEffect(() => {
    if (canvasManager) {
      const colors = canvasManager.getColorsInDesign();
      setDesignColors(colors);
    } else {
      setDesignColors(['#000000', '#ffffff', '#2563eb', '#10b981', '#ef4444']);
    }
  }, [canvasManager, value]);

  // Handle ESC key to close popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Helper for selecting a solid color: applies immediately, saves to recents, and closes popover
  const handleSelectSolid = useCallback(
    (color: string) => {
      const updatedRecents = addRecentColor(color);
      setRecentList(updatedRecents);
      onChange(color);
      onClose?.();
    },
    [onChange, onClose]
  );

  // Helper for selecting a preset gradient directly from the panel
  const handleSelectPresetGradient = useCallback(
    (gradVal: DesignerGradientValue) => {
      gradVal.stops.forEach((s) => {
        if (typeof s.color === 'string') addRecentColor(s.color);
      });
      setRecentList(getRecentColors());
      onChange(gradVal);
      onGradientChange?.(gradVal);
      if (canvasManager) {
        canvasManager.setSelectedGradient(gradVal, false);
      }
    },
    [onChange, onGradientChange, canvasManager]
  );

  // Gradient live preview handler (without saving undo history state)
  const handleGradientPreview = useCallback(
    (gradient: DesignerGradientValue) => {
      onChange(gradient);
      onGradientChange?.(gradient);
      if (canvasManager) {
        // If current selection is object, use isLivePreview=true
        canvasManager.setSelectedGradient(gradient, true);
      }
    },
    [onChange, onGradientChange, canvasManager]
  );

  // Gradient Apply handler: commits gradient, saves undo history, and closes panel
  const handleGradientApply = useCallback(
    (gradient: DesignerGradientValue) => {
      // Add stop colors to recent list
      gradient.stops.forEach((s) => {
        if (typeof s.color === 'string') addRecentColor(s.color);
      });
      setRecentList(getRecentColors());

      onChange(gradient);
      onGradientChange?.(gradient);
      if (canvasManager) {
        canvasManager.setSelectedGradient(gradient, false);
      }
      onClose?.();
    },
    [onChange, onGradientChange, canvasManager, onClose]
  );

  // Gradient Cancel handler: restores original value and closes
  const handleGradientCancel = useCallback(() => {
    const restored = initialValueRef.current;
    if (typeof restored === 'string') {
      onChange(restored);
      if (canvasManager) canvasManager.updateSelectedProperty('fill', restored);
    } else if (typeof restored === 'object' && restored !== null) {
      onChange(restored);
      onGradientChange?.(restored);
      if (canvasManager) canvasManager.setSelectedGradient(restored, false);
    }
    onClose?.();
  }, [onChange, onGradientChange, canvasManager, onClose]);

  // Current solid color string
  const currentSolidHex = useMemo(() => {
    if (typeof value === 'string' && value.startsWith('#')) return value;
    if (typeof value === 'object' && value !== null && 'stops' in value && value.stops.length > 0) {
      return value.stops[0].color || '#7d2ae8';
    }
    return '#2563eb';
  }, [value]);

  const matchesSearch = (name: string, hex: string) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return name.toLowerCase().includes(q) || hex.toLowerCase().includes(q);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`flex flex-col bg-white select-none ${
        embedded ? 'w-full' : 'w-80 rounded-2xl border border-gray-200/90 shadow-2xl overflow-hidden'
      } ${className}`}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-bold text-gray-900">{label}</h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            title="Close colour picker"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* TABS: SOLID vs GRADIENT (Shown only where gradient is supported) */}
      {allowGradient && (
        <div className="px-3 pt-2.5 pb-1 bg-white">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode('solid')}
              className={`rounded-lg py-1.5 text-xs font-bold transition ${
                mode === 'solid' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Solid
            </button>
            <button
              type="button"
              onClick={() => setMode('gradient')}
              className={`rounded-lg py-1.5 text-xs font-bold transition ${
                mode === 'gradient' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Gradient
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT */}
      <div className="p-3.5 space-y-4 overflow-y-auto max-h-[520px] custom-scrollbar">
        {mode === 'gradient' && allowGradient ? (
          /* GRADIENT TAB CONTENT */
          <GradientEditor
            initialGradient={
              isInitialGradient
                ? (value as DesignerGradientValue)
                : {
                    type: 'linear',
                    angle: 90,
                    stops: [
                      { offset: 0, color: currentSolidHex },
                      { offset: 1, color: '#00c4cc' },
                    ],
                  }
            }
            onPreview={handleGradientPreview}
            onApply={handleGradientApply}
            onCancel={handleGradientCancel}
          />
        ) : (
          /* SOLID TAB CONTENT */
          <>
            {/* 1. SEARCH BAR */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search colour or hex..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-gray-200 bg-gray-50/70 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-600 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 2. RECENT COLORS */}
            {recentList.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                  <History className="w-3.5 h-3.5 text-purple-600" />
                  <span>Recent colours</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                  {recentList.filter((hex) => matchesSearch(hex, hex)).map((hex) => {
                    const isSelected = currentSolidHex.toLowerCase() === hex.toLowerCase();
                    const isWhite = hex.toLowerCase() === '#ffffff';
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => handleSelectSolid(hex)}
                        title={hex}
                        className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${
                          isWhite ? 'border border-gray-300' : ''
                        } ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''}`}
                        style={{ backgroundColor: hex }}
                      >
                        {isSelected && (
                          <Check
                            className={`w-3.5 h-3.5 ${isWhite ? 'text-gray-900' : 'text-white'}`}
                            strokeWidth={3}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. DOCUMENT / DESIGN COLORS */}
            {designColors.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-900 block">Document colours</span>
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                  {designColors.filter((hex) => matchesSearch(hex, hex)).map((hex) => {
                    const isSelected = currentSolidHex.toLowerCase() === hex.toLowerCase();
                    const isWhite = hex.toLowerCase() === '#ffffff';
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => handleSelectSolid(hex)}
                        title={hex}
                        className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${
                          isWhite ? 'border border-gray-300' : ''
                        } ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''}`}
                        style={{ backgroundColor: hex }}
                      >
                        {isSelected && (
                          <Check
                            className={`w-3.5 h-3.5 ${isWhite ? 'text-gray-900' : 'text-white'}`}
                            strokeWidth={3}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. CUSTOM COLOR PICKER CHART */}
            <div className="space-y-1.5 pt-1 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-900 block">Custom colour</span>
              <CanvaColorChart
                color={currentSolidHex}
                onChange={(hex) => {
                  onChange(hex);
                }}
                onSelectAndClose={handleSelectSolid}
                allowAlpha={allowAlpha || showAlpha}
              />
            </div>

            {/* 5. BRAND KIT SECTION */}
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Brand Kit</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                {BRAND_KIT_COLORS.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
                  const isSelected = currentSolidHex.toLowerCase() === item.hex.toLowerCase();
                  const isWhite = item.hex.toLowerCase() === '#ffffff';
                  return (
                    <button
                      key={item.hex}
                      type="button"
                      onClick={() => handleSelectSolid(item.hex)}
                      title={`${item.name} (${item.hex})`}
                      className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${
                        isWhite ? 'border border-gray-200' : ''
                      } ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''}`}
                      style={{ backgroundColor: item.hex }}
                    >
                      {isSelected && (
                        <Check
                          className={`w-3.5 h-3.5 ${isWhite ? 'text-gray-900' : 'text-white'}`}
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
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Photo colours</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                {PHOTO_COLORS.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
                  const isSelected = currentSolidHex.toLowerCase() === item.hex.toLowerCase();
                  return (
                    <button
                      key={item.hex}
                      type="button"
                      onClick={() => handleSelectSolid(item.hex)}
                      title={`${item.name} (${item.hex})`}
                      className={`relative w-8 h-8 rounded-full transition hover:scale-110 shrink-0 shadow-2xs flex items-center justify-center ${
                        isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''
                      }`}
                      style={{ backgroundColor: item.hex }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 7. DEFAULT SOLID COLOURS */}
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                  <Palette className="w-3.5 h-3.5 text-gray-700" />
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

              {/* Row 1: Grayscale */}
              <div className="grid grid-cols-7 gap-2">
                {DEFAULT_SOLID_ROW_1.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
                  const isSelected = currentSolidHex.toLowerCase() === item.hex.toLowerCase();
                  const isWhite = item.hex.toLowerCase() === '#ffffff';
                  return (
                    <button
                      key={item.hex}
                      type="button"
                      onClick={() => handleSelectSolid(item.hex)}
                      title={`${item.name} (${item.hex})`}
                      className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center ${
                        isWhite ? 'border border-gray-300' : ''
                      } ${isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''}`}
                      style={{ backgroundColor: item.hex }}
                    >
                      {isSelected && (
                        <Check
                          className={`w-3.5 h-3.5 ${isWhite || item.hex === '#e0e0e0' ? 'text-gray-900' : 'text-white'}`}
                          strokeWidth={3}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Spectrum */}
              <div className="grid grid-cols-7 gap-2">
                {DEFAULT_SOLID_ROW_2.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
                  const isSelected = currentSolidHex.toLowerCase() === item.hex.toLowerCase();
                  return (
                    <button
                      key={item.hex}
                      type="button"
                      onClick={() => handleSelectSolid(item.hex)}
                      title={`${item.name} (${item.hex})`}
                      className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center ${
                        isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''
                      }`}
                      style={{ backgroundColor: item.hex }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>

              {/* Extended Row */}
              {showAllSolid && (
                <div className="grid grid-cols-7 gap-2 pt-1 animate-in fade-in duration-150">
                  {EXTENDED_SOLID_COLORS.filter((c) => matchesSearch(c.name, c.hex)).map((item) => {
                    const isSelected = currentSolidHex.toLowerCase() === item.hex.toLowerCase();
                    const isLight = item.hex === '#ffde59' || item.hex === '#7ed957';
                    return (
                      <button
                        key={item.hex}
                        type="button"
                        onClick={() => handleSelectSolid(item.hex)}
                        title={`${item.name} (${item.hex})`}
                        className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center ${
                          isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''
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

            {/* 8. DEFAULT GRADIENTS (Canva Style) */}
            {allowGradient && (
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Gradients</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('gradient')}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 hover:underline"
                  >
                    Customise
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {GRADIENT_PRESETS.slice(0, showAllGradients ? GRADIENT_PRESETS.length : 14).map((preset) => {
                    const denominator = Math.max(preset.colors.length - 1, 1);
                    const stops: DesignerGradientStop[] = preset.colors.map((color, index) => ({
                      offset: index / denominator,
                      color,
                    }));
                    const gradVal: DesignerGradientValue = {
                      type: preset.type || 'linear',
                      angle: preset.angle ?? 135,
                      stops,
                    };
                    const cssBg = colorOrGradientToCss(gradVal);
                    const isSelected =
                      typeof value === 'object' &&
                      value !== null &&
                      'stops' in value &&
                      value.type === gradVal.type &&
                      value.stops?.length === gradVal.stops.length &&
                      value.stops.every((s, i) => s.color.toLowerCase() === gradVal.stops[i].color.toLowerCase());

                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleSelectPresetGradient(gradVal)}
                        title={preset.name}
                        className={`relative w-8 h-8 rounded-full transition hover:scale-110 shadow-2xs flex items-center justify-center justify-self-center border border-black/10 ${
                          isSelected ? 'ring-2 ring-purple-600 ring-offset-2 scale-105' : ''
                        }`}
                        style={{ background: cssBg }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-md" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>

                {GRADIENT_PRESETS.length > 14 && (
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowAllGradients((prev) => !prev)}
                      className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 hover:underline"
                    >
                      {showAllGradients ? 'Show less' : 'See all gradients'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ColorPicker;
