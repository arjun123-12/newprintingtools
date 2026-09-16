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
  Film,
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

type TextEffectId = typeof STYLE_EFFECTS[number]['id'];

interface ShadowSettings {
  direction: number;
  offset: number;
  blur: number;
  transparency: number;
  color: string;
}

const DEFAULT_SHADOW_SETTINGS: ShadowSettings = {
  direction: -45,
  offset: 20,
  blur: 10,
  transparency: 30,
  color: '#000000',
};

const ShadowSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, suffix = '', onChange }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-gray-800">{label}</span>
      <span className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700">
        {value}{suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-purple-600"
    />
  </div>
);

const CANVA_FILTERS = [
  { id: 'none', label: 'None', color: 'from-gray-100 to-gray-200', text: 'Natural' },
  { id: 'custom', label: 'Custom', color: 'from-purple-500 via-pink-500 to-amber-400', text: 'Custom Tune' },
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
  const normalizedSelectedType = String(selected?.type || '')
    .toLowerCase()
    .replace(/[-_\s]/g, '');
  const isEditableText = ['itext', 'textbox', 'text'].includes(
    normalizedSelectedType
  );
  const [activeTab, setActiveTab] = useState<'styles' | 'filters' | 'adjust'>('styles');
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [filterIntensity, setFilterIntensity] = useState<number>(100);
  const [showFilterCustomControls, setShowFilterCustomControls] = useState(false);
  const [curveEnabled, setCurveEnabled] = useState(false);
  const [curveAmount, setCurveAmount] = useState(0);
  const [activeEffect, setActiveEffect] = useState<TextEffectId>('none');
  const [shadowSettings, setShadowSettings] = useState<ShadowSettings>(
    DEFAULT_SHADOW_SETTINGS
  );

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

    if (isEditableText) {
      const savedCurve = Number((selected as any)?.curve) || 0;
      const savedShape = (selected as any)?.textShape;
      setCurveAmount(savedCurve);
      setCurveEnabled(savedShape === 'curve' || savedCurve !== 0);
    }

    const effectState = (canvasManager as any).getObjectEffectState?.() ||
      (canvasManager as any).getTextEffectState?.();
    setActiveEffect(effectState?.effect || (selected as any)?.textEffect || 'none');
    if (effectState?.settings) {
      setShadowSettings({
        ...DEFAULT_SHADOW_SETTINGS,
        ...effectState.settings,
      });
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

  const currentCurve = curveAmount;

  const handleApplyStyle = (effectId: TextEffectId) => {
    if (!canvasManager) return;
    setActiveEffect(effectId);
    const manager = canvasManager as any;
    if (effectId === 'shadow') {
      if (typeof manager.applyShadow === 'function') {
        manager.applyShadow(shadowSettings);
      } else if (typeof manager.applyEffect === 'function') {
        manager.applyEffect('shadow', shadowSettings);
      }
    } else if (typeof manager.applyEffect === 'function') {
      manager.applyEffect(effectId);
    }
  };

  const handleShadowSettingChange = <K extends keyof ShadowSettings>(
    key: K,
    value: ShadowSettings[K]
  ) => {
    const next = { ...shadowSettings, [key]: value };
    setShadowSettings(next);
    if (!canvasManager) return;
    const manager = canvasManager as any;
    if (typeof manager.applyShadow === 'function') {
      manager.applyShadow(next);
    } else if (typeof manager.applyEffect === 'function') {
      manager.applyEffect('shadow', next);
    }
  };

  const handleCurveChange = (val: number) => {
    if (!canvasManager) return;
    const nextCurve = Math.max(-100, Math.min(100, val));
    setCurveAmount(nextCurve);
    setCurveEnabled(true);

    const manager = canvasManager as any;
    if (typeof manager.applyTextCurve === 'function') {
      manager.applyTextCurve(nextCurve);
    } else {
      manager.updateSelectedProperty('curve', nextCurve);
    }
  };

  const handleStepCurve = (delta: number) => {
    handleCurveChange(Math.max(-100, Math.min(100, currentCurve + delta)));
  };

  const handleEnableCurve = () => {
    const nextCurve = currentCurve === 0 ? 50 : currentCurve;
    setCurveEnabled(true);
    handleCurveChange(nextCurve);
  };

  const handleRemoveCurve = () => {
    if (!canvasManager) return;
    setCurveEnabled(false);
    setCurveAmount(0);

    const manager = canvasManager as any;
    if (typeof manager.removeTextCurve === 'function') {
      manager.removeTextCurve();
    } else {
      manager.updateSelectedProperty('curve', 0);
    }
  };

  const handleApplyFilter = (filterId: string) => {
    setActiveFilter(filterId);
    if (!canvasManager) return;
    if (filterId === 'custom') {
      setShowFilterCustomControls(true);
      canvasManager.applyImageFilter('custom', filterIntensity / 100);
      canvasManager.applyImageAdjustment(adjustments);
    } else {
      canvasManager.applyImageFilter(filterId, filterIntensity / 100);
    }
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
    setShowFilterCustomControls(false);
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
      <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold text-gray-600">
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
                const isActive = activeEffect === eff.id;
                return (
                  <button
                    key={eff.id}
                    type="button"
                    onClick={() => handleApplyStyle(eff.id)}
                    className={`p-1.5 rounded-xl border flex items-center gap-2 transition text-left group shadow-2xs ${isActive
                      ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600'
                      : 'border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-300'
                      }`}
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

          {activeEffect === 'shadow' && (
            <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">Shadow settings</span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1">
                  <input
                    type="color"
                    value={shadowSettings.color}
                    onChange={(event) =>
                      handleShadowSettingChange('color', event.target.value)
                    }
                    className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Shadow color"
                  />
                  <span className="text-[10px] font-semibold uppercase text-gray-500">
                    {shadowSettings.color}
                  </span>
                </div>
              </div>

              {/* Quick Shadow Presets */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'Drop', direction: -45, offset: 20, blur: 10, transparency: 30 },
                  { label: 'Float', direction: 90, offset: 18, blur: 28, transparency: 25 },
                  { label: 'Crisp', direction: 45, offset: 8, blur: 0, transparency: 70 },
                  { label: 'Glow', direction: 0, offset: 0, blur: 24, transparency: 60 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const next = {
                        ...shadowSettings,
                        direction: preset.direction,
                        offset: preset.offset,
                        blur: preset.blur,
                        transparency: preset.transparency,
                      };
                      setShadowSettings(next);
                      const manager = canvasManager as any;
                      if (typeof manager?.applyShadow === 'function') {
                        manager.applyShadow(next);
                      } else if (typeof manager?.applyEffect === 'function') {
                        manager.applyEffect('shadow', next);
                      }
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-1 py-1 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 transition text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <ShadowSlider
                label="Direction"
                value={shadowSettings.direction}
                min={-180}
                max={180}
                suffix="°"
                onChange={(value) => handleShadowSettingChange('direction', value)}
              />
              <ShadowSlider
                label="Offset"
                value={shadowSettings.offset}
                min={0}
                max={100}
                onChange={(value) => handleShadowSettingChange('offset', value)}
              />
              <ShadowSlider
                label="Blur"
                value={shadowSettings.blur}
                min={0}
                max={100}
                onChange={(value) => handleShadowSettingChange('blur', value)}
              />
              <ShadowSlider
                label="Transparency"
                value={shadowSettings.transparency}
                min={0}
                max={100}
                suffix="%"
                onChange={(value) => handleShadowSettingChange('transparency', value)}
              />

              <button
                type="button"
                onClick={() => handleApplyStyle('none')}
                className="w-full rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition"
              >
                Remove shadow
              </button>
            </div>
          )}

          {/* Canva-style text Shape: only None and customizable Curve */}
          {isEditableText && (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <Spline className="h-3.5 w-3.5 text-purple-600" />
                Shape
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleRemoveCurve}
                  className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border transition ${!curveEnabled
                    ? 'border-purple-600 bg-purple-50 text-purple-700 ring-1 ring-purple-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
                    }`}
                >
                  <span className="text-xl font-bold">Ag</span>
                  <span className="text-[11px] font-semibold">None</span>
                </button>

                <button
                  type="button"
                  onClick={handleEnableCurve}
                  className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border transition ${curveEnabled
                    ? 'border-purple-600 bg-purple-50 text-purple-700 ring-1 ring-purple-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
                    }`}
                >
                  <Spline className="h-6 w-6" />
                  <span className="text-[11px] font-semibold">Curve</span>
                </button>
              </div>

              {curveEnabled && (
                <div className="space-y-2 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-800">Curve</span>
                    <div className="flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white">
                      <button
                        type="button"
                        onClick={() => handleStepCurve(-5)}
                        className="p-2 text-gray-600 hover:bg-gray-50"
                        aria-label="Decrease curve"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="-100"
                        max="100"
                        value={currentCurve}
                        onChange={(event) => handleCurveChange(Number(event.target.value))}
                        className="w-14 border-x border-gray-100 py-2 text-center text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepCurve(5)}
                        className="p-2 text-gray-600 hover:bg-gray-50"
                        aria-label="Increase curve"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: '¼ Arc', value: 25 },
                      { label: 'Semi', value: 50 },
                      { label: '¾ Arc', value: 75 },
                      { label: 'Circle', value: 100 },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handleCurveChange(preset.value)}
                        className={`rounded-lg border px-1 py-1.5 text-[9px] font-bold transition ${currentCurve === preset.value
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-100'
                          }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={currentCurve}
                    onChange={(event) => handleCurveChange(Number(event.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-purple-200 accent-purple-600"
                  />

                  <div className="flex justify-between text-[10px] font-medium text-gray-500">
                    <span>Curve down</span>
                    <span>Straight</span>
                    <span>Curve up</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveCurve}
                    className="w-full rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700"
                  >
                    Remove curve
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Canva Photo & Graphic Filters */}
      {activeTab === 'filters' && (
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
            <div className="space-y-2 p-3 bg-purple-50/60 rounded-xl border border-purple-100">
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

              <button
                type="button"
                onClick={() => setShowFilterCustomControls(!showFilterCustomControls)}
                className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-purple-200 bg-white text-purple-700 text-xs font-bold hover:bg-purple-100 transition shadow-2xs"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>{showFilterCustomControls || activeFilter === 'custom' ? 'Hide Custom Tuning' : 'Custom Filter Tuning'}</span>
              </button>
            </div>
          )}

          {/* Custom Filter Tuning Controls (when Custom filter selected or toggled) */}
          {(activeFilter === 'custom' || showFilterCustomControls) && (
            <div className="space-y-3 p-3 bg-purple-50/40 rounded-xl border border-purple-200 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-purple-600" />
                  <span>Custom Filter Tuning</span>
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
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Sun className="w-3 h-3 text-amber-500" />
                      <span>Brightness</span>
                    </span>
                    <span className="font-mono text-[10px]">{adjustments.brightness}</span>
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

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Contrast className="w-3 h-3 text-gray-700" />
                      <span>Contrast</span>
                    </span>
                    <span className="font-mono text-[10px]">{adjustments.contrast}</span>
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

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Palette className="w-3 h-3 text-rose-500" />
                      <span>Saturation</span>
                    </span>
                    <span className="font-mono text-[10px]">{adjustments.saturation}</span>
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

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      <span>Vibrance</span>
                    </span>
                    <span className="font-mono text-[10px]">{adjustments.vibrance}</span>
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

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-500" />
                      <span>Warmth</span>
                    </span>
                    <span className="font-mono text-[10px]">{adjustments.warmth}</span>
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

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Snowflake className="w-3 h-3 text-sky-500" />
                      <span>Blur</span>
                    </span>
                    <span className="font-mono text-[10px]">{adjustments.blur}</span>
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
      )}

      {/* TAB 3: Fine-Tune Adjustments */}
      {activeTab === 'adjust' && (
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

            {/* Hue / Tint */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-700 font-semibold">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Hue / Tint</span>
                </span>
                <span className="font-mono text-[11px]">{adjustments.hue}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={adjustments.hue}
                onChange={(e) => handleAdjustmentChange('hue', Number(e.target.value))}
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
