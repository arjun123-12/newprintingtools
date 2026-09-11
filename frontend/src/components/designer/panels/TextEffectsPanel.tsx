'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Sun,
  CircleDashed,
  Zap,
  XCircle,
  Spline,
  Minus,
  Plus,
  Sliders,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Flame,
  Snowflake,
  Contrast,
  Camera,
  Film,
  Compass,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';

interface TextEffectsPanelProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState;
}

const STYLE_EFFECTS = [
  { id: 'none', label: 'None', desc: 'Default style', icon: XCircle },
  { id: 'shadow', label: 'Shadow', desc: 'Drop shadow', icon: Sun },
  { id: 'lift', label: 'Lift', desc: 'Elevated blur', icon: Sparkles },
  { id: 'glow', label: 'Glow', desc: 'Vibrant glow', icon: Zap },
  { id: 'outline', label: 'Outline', desc: 'Solid outline', icon: CircleDashed },
  { id: 'hollow', label: 'Hollow', desc: 'Transparent fill', icon: CircleDashed },
  { id: 'neon', label: 'Neon', desc: 'Glowing neon', icon: Zap },
] as const;

const CANVA_FILTERS = [
  { id: 'none', label: 'None', color: 'from-gray-100 to-gray-200', text: 'Natural' },
  { id: 'solar', label: 'Solar', color: 'from-amber-300 to-yellow-500', text: 'Warm Golden' },
  { id: 'warm', label: 'Warm', color: 'from-orange-200 to-amber-400', text: 'Cozy Amber' },
  { id: 'cool', label: 'Cool', color: 'from-sky-200 to-blue-400', text: 'Arctic Fresh' },
  { id: 'vivid', label: 'Vivid', color: 'from-rose-400 to-pink-600', text: 'Punchy Colors' },
  { id: 'soft', label: 'Soft', color: 'from-pink-100 to-rose-200', text: 'Pastel Dream' },
  { id: 'vintage', label: 'Vintage', color: 'from-amber-200 to-stone-400', text: 'Analog Film' },
  { id: 'mono', label: 'Mono', color: 'from-gray-400 to-gray-800', text: 'Black & White' },
  { id: 'noir', label: 'Noir', color: 'from-zinc-700 to-black', text: 'High Contrast' },
  { id: 'sepia', label: 'Sepia', color: 'from-amber-700 to-yellow-900', text: 'Antique Tint' },
  { id: 'drama', label: 'Drama', color: 'from-indigo-600 to-slate-900', text: 'Cinematic' },
  { id: 'invert', label: 'Invert', color: 'from-purple-600 to-emerald-400', text: 'Negative' },
  { id: 'pixelate', label: 'Pixelate', color: 'from-blue-400 to-violet-600', text: '8-bit Retro' },
] as const;

export const TextEffectsPanel: React.FC<TextEffectsPanelProps> = ({
  canvasManager,
  selected,
}) => {
  const isEditableText =
    selected?.type === 'i-text' || selected?.type === 'textbox';
  const [activeTab, setActiveTab] = useState<'styles' | 'filters' | 'adjust'>('styles');
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [filterIntensity, setFilterIntensity] = useState<number>(100);

  const [adjustments, setAdjustments] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    vibrance: 0,
    blur: 0,
    hue: 0,
    warmth: 0,
  });

  // Sync state from canvas
  useEffect(() => {
    if (!canvasManager) return;

    // Image filters rasterize/cache pixels and are not appropriate for
    // editable vector text. Text keeps only Fabric-native style effects.
    if (isEditableText) {
      setActiveTab('styles');
      return;
    }

    const current = canvasManager.getImageAdjustments();
    setActiveFilter(current.activeFilter || 'none');
    setFilterIntensity(current.intensity ?? 100);
    setAdjustments({
      brightness: current.brightness || 0,
      contrast: current.contrast || 0,
      saturation: current.saturation || 0,
      vibrance: current.vibrance || 0,
      blur: current.blur || 0,
      hue: current.hue || 0,
      warmth: current.warmth || 0,
    });
  }, [canvasManager, selected, isEditableText]);

  const currentCurve = selected?.curve || 0;

  const handleApplyStyle = (effectId: typeof STYLE_EFFECTS[number]['id']) => {
    if (!canvasManager) return;
    canvasManager.applyEffect(effectId);
  };

  const handleCurveChange = (val: number) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty('curve', val);
  };

  const handleStepCurve = (delta: number) => {
    handleCurveChange(Math.max(-100, Math.min(100, currentCurve + delta)));
  };

  const handleApplyFilter = (filterId: string) => {
    setActiveFilter(filterId);
    if (!canvasManager) return;
    canvasManager.applyImageFilter(filterId, filterIntensity / 100);
  };

  const handleIntensityChange = (val: number) => {
    setFilterIntensity(val);
    if (!canvasManager) return;
    canvasManager.applyImageFilter(activeFilter, val / 100);
  };

  const handleAdjustmentChange = (prop: keyof typeof adjustments, val: number) => {
    const next = { ...adjustments, [prop]: val };
    setAdjustments(next);
    if (!canvasManager) return;
    canvasManager.applyImageAdjustment(next);
  };

  const handleResetAdjustments = () => {
    const reset = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      vibrance: 0,
      blur: 0,
      hue: 0,
      warmth: 0,
    };
    setAdjustments(reset);
    setActiveFilter('none');
    setFilterIntensity(100);
    if (!canvasManager) return;
    canvasManager.applyImageFilter('none');
    canvasManager.applyImageAdjustment(reset);
  };

  return (
    <div className="space-y-4 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>{isEditableText ? 'Vector Text Effects' : 'Effects, Filters & Adjust'}</span>
        </span>
      </div>

      {/* Sub-Tab Navigation (Canva Style) */}
      <div className={`grid ${isEditableText ? 'grid-cols-1' : 'grid-cols-3'} gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold text-gray-600`}>
        <button
          type="button"
          onClick={() => setActiveTab('styles')}
          className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'styles'
              ? 'bg-white text-purple-700 shadow-2xs font-extrabold'
              : 'hover:text-gray-900'
            }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Effects</span>
        </button>

        {!isEditableText && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('filters')}
              className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'filters'
                  ? 'bg-white text-purple-700 shadow-2xs font-extrabold'
                  : 'hover:text-gray-900'
                }`}
            >
              <Palette className="w-3 h-3" />
              <span>Filters</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('adjust')}
              className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'adjust'
                  ? 'bg-white text-purple-700 shadow-2xs font-extrabold'
                  : 'hover:text-gray-900'
                }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Adjust</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: Style Effects & Curved Text */}
      {activeTab === 'styles' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Style Effects Grid */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Style
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLE_EFFECTS.map((eff) => {
                const Icon = eff.icon;
                return (
                  <button
                    key={eff.id}
                    type="button"
                    onClick={() => handleApplyStyle(eff.id)}
                    className="p-1.5 rounded-xl border border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-300 flex items-center gap-2 transition text-left group shadow-2xs"
                  >
                    <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 group-hover:text-purple-700 truncate">
                        {eff.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canva-Style Curve / Shape Section */}
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Spline className="w-3.5 h-3.5 text-blue-600" />
                <span>Curved Text</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepCurve(-10)}
                  title="Decrease curve"
                  className="p-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-0.5 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200/60 shadow-2xs">
                  <input
                    type="number"
                    min="-100"
                    max="100"
                    value={currentCurve}
                    onChange={(e) => handleCurveChange(Number(e.target.value))}
                    className="w-8 bg-transparent text-xs font-mono font-bold text-gray-800 focus:outline-none text-right"
                  />
                  <span className="text-[10px] text-gray-500 font-bold">°</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStepCurve(10)}
                  title="Increase curve"
                  className="p-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Continuous Curve Slider */}
            <input
              type="range"
              min="-100"
              max="100"
              value={currentCurve}
              onChange={(e) => handleCurveChange(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />

            {/* Quick Curve Preset Buttons */}
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {[
                { label: 'None (0°)', val: 0 },
                { label: '-50°', val: -50 },
                { label: '+50°', val: 50 },
                { label: '+100°', val: 100 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleCurveChange(p.val)}
                  className={`py-1 text-[10px] font-bold rounded-lg border transition ${currentCurve === p.val
                      ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Canva Photo & Graphic Filters */}
      {!isEditableText && activeTab === 'filters' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Filter Presets
            </span>
            {activeFilter !== 'none' && (
              <button
                type="button"
                onClick={() => handleApplyFilter('none')}
                className="text-[10px] font-bold text-purple-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filters Swatch Grid */}
          <div className="grid grid-cols-3 gap-2">
            {CANVA_FILTERS.map((filter) => {
              const isSelected = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => handleApplyFilter(filter.id)}
                  className={`
                    p-1.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center group
                    ${isSelected
                      ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-600/30 shadow-xs'
                      : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/50'}
                  `}
                >
                  {/* Swatch preview circle */}
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-tr ${filter.color} border border-black/10 shadow-2xs flex items-center justify-center`}
                  >
                    {isSelected && <Sparkles className="w-3.5 h-3.5 text-white drop-shadow-sm" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-800 block line-clamp-1 group-hover:text-purple-700">
                      {filter.label}
                    </span>
                    <span className="text-[9px] text-gray-400 block line-clamp-1">
                      {filter.text}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filter Intensity Slider (when a filter is active) */}
          {activeFilter !== 'none' && (
            <div className="space-y-1.5 p-3 bg-purple-50/60 rounded-xl border border-purple-100">
              <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                <span>Filter Intensity</span>
                <span className="font-mono">{filterIntensity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={filterIntensity}
                onChange={(e) => handleIntensityChange(Number(e.target.value))}
                className="w-full h-1.5 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Fine-Tune Adjustments */}
      {!isEditableText && activeTab === 'adjust' && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Adjustments
            </span>
            <button
              type="button"
              onClick={handleResetAdjustments}
              className="text-[10px] font-bold text-gray-500 hover:text-purple-700 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Sliders list */}
          <div className="space-y-3">
            {/* Brightness */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-700 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Brightness</span>
                </span>
                <span className="font-mono text-[11px]">{adjustments.brightness}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.brightness}
                onChange={(e) => handleAdjustmentChange('brightness', Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Contrast */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-700 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Contrast className="w-3.5 h-3.5 text-gray-700" />
                  <span>Contrast</span>
                </span>
                <span className="font-mono text-[11px]">{adjustments.contrast}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.contrast}
                onChange={(e) => handleAdjustmentChange('contrast', Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-700 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-rose-500" />
                  <span>Saturation</span>
                </span>
                <span className="font-mono text-[11px]">{adjustments.saturation}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.saturation}
                onChange={(e) => handleAdjustmentChange('saturation', Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Vibrance */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-700 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>Vibrance</span>
                </span>
                <span className="font-mono text-[11px]">{adjustments.vibrance}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.vibrance}
                onChange={(e) => handleAdjustmentChange('vibrance', Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Warmth */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-700 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span>Warmth</span>
                </span>
                <span className="font-mono text-[11px]">{adjustments.warmth}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.warmth}
                onChange={(e) => handleAdjustmentChange('warmth', Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Blur */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-700 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                  <span>Blur</span>
                </span>
                <span className="font-mono text-[11px]">{adjustments.blur}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={adjustments.blur}
                onChange={(e) => handleAdjustmentChange('blur', Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextEffectsPanel;
