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
  { id: 'blur', label: 'Blur', desc: 'Blur effect', icon: SlidersHorizontal },
] as const;

type TextEffectId = typeof STYLE_EFFECTS[number]['id'];

interface ShadowSettings {
  direction: number;
  offset: number;
  blur: number;
  transparency: number;
  color: string;
}

interface LiftSettings {
  intensity: number;
  blur: number;
  transparency: number;
  color: string;
}

interface GlowSettings {
  blur: number;
  transparency: number;
  color: string;
}

interface OutlineSettings {
  thickness: number;
  color: string;
}

interface HollowSettings {
  thickness: number;
  color: string;
}

interface NeonSettings {
  intensity: number;
  color: string;
}

interface BlurSettings {
  blur: number;
}

const DEFAULT_SHADOW_SETTINGS: ShadowSettings = {
  direction: -45,
  offset: 20,
  blur: 10,
  transparency: 50,
  color: '#000000',
};

const DEFAULT_LIFT_SETTINGS: LiftSettings = {
  intensity: 60,
  blur: 24,
  transparency: 60,
  color: '#000000',
};

const DEFAULT_GLOW_SETTINGS: GlowSettings = {
  blur: 25,
  transparency: 85,
  color: '#2563eb',
};

const DEFAULT_OUTLINE_SETTINGS: OutlineSettings = {
  thickness: 3,
  color: '#6366f1',
};

const DEFAULT_HOLLOW_SETTINGS: HollowSettings = {
  thickness: 2,
  color: '#000000',
};

const DEFAULT_NEON_SETTINGS: NeonSettings = {
  intensity: 60,
  color: '#ec4899',
};

const DEFAULT_BLUR_SETTINGS: BlurSettings = {
  blur: 25,
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
  const [selectedEffect, setSelectedEffect] = useState<TextEffectId>('none');
  const [activeEffects, setActiveEffects] = useState<Record<string, boolean>>({});
  const [shadowSettings, setShadowSettings] = useState<ShadowSettings>(
    DEFAULT_SHADOW_SETTINGS
  );
  const [liftSettings, setLiftSettings] = useState<LiftSettings>(
    DEFAULT_LIFT_SETTINGS
  );
  const [glowSettings, setGlowSettings] = useState<GlowSettings>(
    DEFAULT_GLOW_SETTINGS
  );
  const [outlineSettings, setOutlineSettings] = useState<OutlineSettings>(
    DEFAULT_OUTLINE_SETTINGS
  );
  const [hollowSettings, setHollowSettings] = useState<HollowSettings>(
    DEFAULT_HOLLOW_SETTINGS
  );
  const [neonSettings, setNeonSettings] = useState<NeonSettings>(
    DEFAULT_NEON_SETTINGS
  );
  const [blurSettings, setBlurSettings] = useState<BlurSettings>(
    DEFAULT_BLUR_SETTINGS
  );

  const [adjustments, setAdjustments] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    vibrance: 0,
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
    const currEffect = (effectState?.effect || (selected as any)?.textEffect || 'none') as TextEffectId;
    const activeMap = (effectState?.activeEffects || {}) as Record<string, boolean>;
    setActiveEffects(activeMap);

    const activeList = Object.keys(activeMap).filter(k => activeMap[k]) as TextEffectId[];
    if (activeList.length > 0) {
      if (selectedEffect === 'none' || !activeMap[selectedEffect]) {
        setSelectedEffect(activeList.includes(currEffect) ? currEffect : activeList[0]);
      }
    } else {
      setSelectedEffect('none');
    }

    if (effectState?.allSettings) {
      if (effectState.allSettings.shadow) setShadowSettings({ ...DEFAULT_SHADOW_SETTINGS, ...effectState.allSettings.shadow });
      if (effectState.allSettings.lift) setLiftSettings({ ...DEFAULT_LIFT_SETTINGS, ...effectState.allSettings.lift });
      if (effectState.allSettings.glow) setGlowSettings({ ...DEFAULT_GLOW_SETTINGS, ...effectState.allSettings.glow });
      if (effectState.allSettings.outline) setOutlineSettings({ ...DEFAULT_OUTLINE_SETTINGS, ...effectState.allSettings.outline });
      if (effectState.allSettings.hollow) setHollowSettings({ ...DEFAULT_HOLLOW_SETTINGS, ...effectState.allSettings.hollow });
      if (effectState.allSettings.neon) setNeonSettings({ ...DEFAULT_NEON_SETTINGS, ...effectState.allSettings.neon });
      if (effectState.allSettings.blur) setBlurSettings({ ...DEFAULT_BLUR_SETTINGS, ...effectState.allSettings.blur });
    } else if (effectState?.settings) {
      if (currEffect === 'shadow') setShadowSettings({ ...DEFAULT_SHADOW_SETTINGS, ...effectState.settings });
      else if (currEffect === 'lift') setLiftSettings({ ...DEFAULT_LIFT_SETTINGS, ...effectState.settings });
      else if (currEffect === 'glow') setGlowSettings({ ...DEFAULT_GLOW_SETTINGS, ...effectState.settings });
      else if (currEffect === 'outline') setOutlineSettings({ ...DEFAULT_OUTLINE_SETTINGS, ...effectState.settings });
      else if (currEffect === 'hollow') setHollowSettings({ ...DEFAULT_HOLLOW_SETTINGS, ...effectState.settings });
      else if (currEffect === 'neon') setNeonSettings({ ...DEFAULT_NEON_SETTINGS, ...effectState.settings });
      else if (currEffect === 'blur') setBlurSettings({ ...DEFAULT_BLUR_SETTINGS, ...effectState.settings });
    }

    const current = canvasManager.getImageAdjustments();
    setActiveFilter(current.activeFilter || 'none');
    setFilterIntensity(current.intensity ?? 100);
    setAdjustments({
      brightness: current.brightness || 0,
      contrast: current.contrast || 0,
      saturation: current.saturation || 0,
      vibrance: current.vibrance || 0,
      hue: current.hue || 0,
      warmth: current.warmth || 0,
    });
  }, [canvasManager, selected, isEditableText]);

  const currentCurve = curveAmount;

  const handleSelectEffect = (effectId: TextEffectId) => {
    if (effectId === 'none') {
      handleClearAllEffects();
      return;
    }

    setSelectedEffect(effectId);
    if (!activeEffects[effectId]) {
      handleApplyStyle(effectId);
    }
  };

  const handleApplyStyle = (effectId: TextEffectId) => {
    if (!canvasManager) return;
    setSelectedEffect(effectId);
    setActiveEffects(prev => ({ ...prev, [effectId]: true }));
    const manager = canvasManager as any;

    let settings: any = undefined;
    if (effectId === 'shadow') settings = shadowSettings;
    else if (effectId === 'lift') settings = liftSettings;
    else if (effectId === 'glow') settings = glowSettings;
    else if (effectId === 'outline') {
      let outlineColor = outlineSettings.color;
      const selFill = String((selected as any)?.fill || '').toLowerCase();
      if ((!outlineColor || outlineColor === '#000000') && (selFill === '#000000' || selFill === '#111827' || selFill === 'black' || !selFill)) {
        outlineColor = '#6366f1';
        setOutlineSettings(prev => ({ ...prev, color: '#6366f1' }));
      }
      settings = { ...outlineSettings, color: outlineColor };
    }
    else if (effectId === 'hollow') {
      const selFill = String((selected as any)?.fill || '').toLowerCase();
      const hollowColor = (selFill && selFill !== 'transparent') ? (selected as any).fill : (hollowSettings.color || '#000000');
      setHollowSettings(prev => ({ ...prev, color: hollowColor }));
      settings = { ...hollowSettings, color: hollowColor };
    }
    else if (effectId === 'neon') settings = neonSettings;
    else if (effectId === 'blur') settings = blurSettings;

    if (typeof manager.applyEffect === 'function') {
      manager.applyEffect(effectId, settings);
    } else if (effectId === 'shadow' && typeof manager.applyShadow === 'function') {
      manager.applyShadow(settings);
    }
  };

  const handleRemoveEffect = (effectId: TextEffectId) => {
    if (!canvasManager) return;
    const nextMap = { ...activeEffects };
    delete nextMap[effectId];
    setActiveEffects(nextMap);

    const manager = canvasManager as any;
    if (typeof manager.removeEffect === 'function') {
      manager.removeEffect(effectId);
    } else if (typeof manager.applyEffect === 'function') {
      manager.applyEffect(effectId, null, { remove: true });
    }

    const remaining = Object.keys(nextMap).filter(k => nextMap[k]) as TextEffectId[];
    if (remaining.length > 0) {
      setSelectedEffect(remaining[0]);
    } else {
      setSelectedEffect('none');
    }
  };

  const handleClearAllEffects = () => {
    if (!canvasManager) return;
    setActiveEffects({});
    setSelectedEffect('none');
    const manager = canvasManager as any;
    if (typeof manager.clearAllEffects === 'function') {
      manager.clearAllEffects();
    } else if (typeof manager.applyEffect === 'function') {
      manager.applyEffect('none');
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

  const handleLiftSettingChange = <K extends keyof LiftSettings>(
    key: K,
    value: LiftSettings[K]
  ) => {
    const next = { ...liftSettings, [key]: value };
    setLiftSettings(next);
    (canvasManager as any)?.applyEffect?.('lift', next);
  };

  const handleGlowSettingChange = <K extends keyof GlowSettings>(
    key: K,
    value: GlowSettings[K]
  ) => {
    const next = { ...glowSettings, [key]: value };
    setGlowSettings(next);
    (canvasManager as any)?.applyEffect?.('glow', next);
  };

  const handleOutlineSettingChange = <K extends keyof OutlineSettings>(
    key: K,
    value: OutlineSettings[K]
  ) => {
    const next = { ...outlineSettings, [key]: value };
    setOutlineSettings(next);
    (canvasManager as any)?.applyEffect?.('outline', next);
  };

  const handleHollowSettingChange = <K extends keyof HollowSettings>(
    key: K,
    value: HollowSettings[K]
  ) => {
    const next = { ...hollowSettings, [key]: value };
    setHollowSettings(next);
    (canvasManager as any)?.applyEffect?.('hollow', next);
  };

  const handleNeonSettingChange = <K extends keyof NeonSettings>(
    key: K,
    value: NeonSettings[K]
  ) => {
    const next = { ...neonSettings, [key]: value };
    setNeonSettings(next);
    (canvasManager as any)?.applyEffect?.('neon', next);
  };

  const handleBlurSettingChange = <K extends keyof BlurSettings>(
    key: K,
    value: BlurSettings[K]
  ) => {
    const next = { ...blurSettings, [key]: value };
    setBlurSettings(next);
    (canvasManager as any)?.applyEffect?.('blur', next);
  };

  // Uses CanvasManager's non-destructive Fabric text-on-path curve engine.
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Style Effects
              </span>
              {Object.keys(activeEffects).some((k) => activeEffects[k]) && (
                <button
                  type="button"
                  onClick={handleClearAllEffects}
                  className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {/* None / Clean Reset button */}
              {(() => {
                const isNoneActive = !Object.keys(activeEffects).some((k) => activeEffects[k]);
                return (
                  <button
                    type="button"
                    onClick={handleClearAllEffects}
                    className={`p-2 rounded-xl border flex items-center gap-2 transition text-left group shadow-2xs ${
                      isNoneActive
                        ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600'
                        : 'border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-300'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-gray-400 group-hover:text-purple-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 group-hover:text-purple-700">None</div>
                      <div className="text-[10px] text-gray-400">Default style</div>
                    </div>
                  </button>
                );
              })()}

              {/* Stackable Effect Buttons */}
              {STYLE_EFFECTS.filter((eff) => eff.id !== 'none').map((eff) => {
                const Icon = eff.icon;
                const isApplied = Boolean(activeEffects[eff.id]);
                const isEditing = selectedEffect === eff.id && isApplied;
                return (
                  <button
                    key={eff.id}
                    type="button"
                    onClick={() => handleSelectEffect(eff.id)}
                    className={`p-2 rounded-xl border flex items-center gap-2 transition text-left group shadow-2xs ${
                      isEditing
                        ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-600/40'
                        : isApplied
                        ? 'border-purple-400 bg-purple-50/60 hover:bg-purple-100/70'
                        : 'border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-300'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${
                        isApplied ? 'text-purple-600' : 'text-gray-400 group-hover:text-purple-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-gray-800 group-hover:text-purple-700 truncate">
                          {eff.label}
                        </span>
                        {isApplied && (
                          <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.2 text-[9px] font-extrabold text-purple-700">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {isApplied ? (isEditing ? 'Editing now' : 'Click to edit') : '+ Add effect'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Effects Chips Strip */}
            {Object.keys(activeEffects).some((k) => activeEffects[k]) && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-purple-100 bg-purple-50/60 p-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-800">
                  Applied:
                </span>
                {Object.keys(activeEffects)
                  .filter((k) => activeEffects[k])
                  .map((effId) => {
                    const isEditing = selectedEffect === effId;
                    const label = STYLE_EFFECTS.find((e) => e.id === effId)?.label || effId;
                    return (
                      <div
                        key={effId}
                        onClick={() => setSelectedEffect(effId as TextEffectId)}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold transition ${
                          isEditing
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'border border-purple-200 bg-white text-purple-700 hover:bg-purple-100'
                        }`}
                      >
                        <span>{label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveEffect(effId as TextEffectId);
                          }}
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[11px] font-bold ${
                            isEditing
                              ? 'text-white hover:bg-purple-700'
                              : 'text-purple-600 hover:bg-purple-200'
                          }`}
                          title={`Remove ${label}`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {selectedEffect === 'shadow' && activeEffects.shadow && (
            <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sun className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-gray-900">Shadow settings</span>
                </div>
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
                onClick={() => handleRemoveEffect('shadow')}
                className="w-full rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition"
              >
                Remove shadow
              </button>
            </div>
          )}

          {selectedEffect === 'lift' && activeEffects.lift && (
            <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-gray-900">Lift settings</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1">
                  <input
                    type="color"
                    value={liftSettings.color}
                    onChange={(event) =>
                      handleLiftSettingChange('color', event.target.value)
                    }
                    className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Lift shadow color"
                  />
                  <span className="text-[10px] font-semibold uppercase text-gray-500">
                    {liftSettings.color}
                  </span>
                </div>
              </div>

              {/* Quick Lift Presets */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'Subtle', intensity: 25, blur: 12, transparency: 20 },
                  { label: 'Medium', intensity: 50, blur: 24, transparency: 30 },
                  { label: 'Strong', intensity: 75, blur: 36, transparency: 45 },
                  { label: 'High', intensity: 100, blur: 50, transparency: 60 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const next = {
                        ...liftSettings,
                        intensity: preset.intensity,
                        blur: preset.blur,
                        transparency: preset.transparency,
                      };
                      setLiftSettings(next);
                      (canvasManager as any)?.applyEffect?.('lift', next);
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-1 py-1 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 transition text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <ShadowSlider
                label="Intensity"
                value={liftSettings.intensity}
                min={0}
                max={100}
                onChange={(value) => handleLiftSettingChange('intensity', value)}
              />
              <ShadowSlider
                label="Blur"
                value={liftSettings.blur}
                min={0}
                max={100}
                onChange={(value) => handleLiftSettingChange('blur', value)}
              />
              <ShadowSlider
                label="Transparency"
                value={liftSettings.transparency}
                min={0}
                max={100}
                suffix="%"
                onChange={(value) => handleLiftSettingChange('transparency', value)}
              />

              <button
                type="button"
                onClick={() => handleRemoveEffect('lift')}
                className="w-full rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition"
              >
                Remove lift
              </button>
            </div>
          )}

          {selectedEffect === 'glow' && activeEffects.glow && (
            <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-gray-900">Glow settings</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1">
                  <input
                    type="color"
                    value={glowSettings.color}
                    onChange={(event) =>
                      handleGlowSettingChange('color', event.target.value)
                    }
                    className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Glow color"
                  />
                  <span className="text-[10px] font-semibold uppercase text-gray-500">
                    {glowSettings.color}
                  </span>
                </div>
              </div>

              {/* Quick Glow Presets */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'Blue', color: '#2563eb', blur: 20, transparency: 80 },
                  { label: 'Amber', color: '#f59e0b', blur: 25, transparency: 85 },
                  { label: 'Rose', color: '#f43f5e', blur: 25, transparency: 85 },
                  { label: 'Purple', color: '#9333ea', blur: 25, transparency: 85 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const next = {
                        ...glowSettings,
                        color: preset.color,
                        blur: preset.blur,
                        transparency: preset.transparency,
                      };
                      setGlowSettings(next);
                      (canvasManager as any)?.applyEffect?.('glow', next);
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-1 py-1 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 transition text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <ShadowSlider
                label="Blur / Size"
                value={glowSettings.blur}
                min={0}
                max={100}
                onChange={(value) => handleGlowSettingChange('blur', value)}
              />
              <ShadowSlider
                label="Transparency"
                value={glowSettings.transparency}
                min={0}
                max={100}
                suffix="%"
                onChange={(value) => handleGlowSettingChange('transparency', value)}
              />

              <button
                type="button"
                onClick={() => handleRemoveEffect('glow')}
                className="w-full rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition"
              >
                Remove glow
              </button>
            </div>
          )}

          {selectedEffect === 'outline' && activeEffects.outline && (
            <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CircleDashed className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-gray-900">Outline settings</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1">
                  <input
                    type="color"
                    value={outlineSettings.color}
                    onChange={(event) =>
                      handleOutlineSettingChange('color', event.target.value)
                    }
                    className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Outline color"
                  />
                  <span className="text-[10px] font-semibold uppercase text-gray-500">
                    {outlineSettings.color}
                  </span>
                </div>
              </div>

              {/* Quick Outline Presets */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'Thin', thickness: 1 },
                  { label: 'Medium', thickness: 3 },
                  { label: 'Thick', thickness: 6 },
                  { label: 'Bold', thickness: 12 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const next = { ...outlineSettings, thickness: preset.thickness };
                      setOutlineSettings(next);
                      (canvasManager as any)?.applyEffect?.('outline', next);
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-1 py-1 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 transition text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <ShadowSlider
                label="Thickness"
                value={outlineSettings.thickness}
                min={1}
                max={50}
                suffix="px"
                onChange={(value) => handleOutlineSettingChange('thickness', value)}
              />

              <button
                type="button"
                onClick={() => handleRemoveEffect('outline')}
                className="w-full rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition"
              >
                Remove outline
              </button>
            </div>
          )}

          {selectedEffect === 'hollow' && activeEffects.hollow && (
            <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CircleDashed className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-gray-900">Hollow settings</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1">
                  <input
                    type="color"
                    value={hollowSettings.color}
                    onChange={(event) =>
                      handleHollowSettingChange('color', event.target.value)
                    }
                    className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Hollow border color"
                  />
                  <span className="text-[10px] font-semibold uppercase text-gray-500">
                    {hollowSettings.color}
                  </span>
                </div>
              </div>

              {/* Quick Hollow Presets */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'Fine', thickness: 1 },
                  { label: 'Thin', thickness: 2 },
                  { label: 'Medium', thickness: 4 },
                  { label: 'Thick', thickness: 8 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const next = { ...hollowSettings, thickness: preset.thickness };
                      setHollowSettings(next);
                      (canvasManager as any)?.applyEffect?.('hollow', next);
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-1 py-1 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 transition text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <ShadowSlider
                label="Thickness"
                value={hollowSettings.thickness}
                min={1}
                max={50}
                suffix="px"
                onChange={(value) => handleHollowSettingChange('thickness', value)}
              />

              <button
                type="button"
                onClick={() => handleRemoveEffect('hollow')}
                className="w-full rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition"
              >
                Remove hollow
              </button>
            </div>
          )}

          {selectedEffect === 'neon' && activeEffects.neon && (
            <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-gray-900">Neon settings</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1">
                  <input
                    type="color"
                    value={neonSettings.color}
                    onChange={(event) =>
                      handleNeonSettingChange('color', event.target.value)
                    }
                    className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Neon color"
                  />
                  <span className="text-[10px] font-semibold uppercase text-gray-500">
                    {neonSettings.color}
                  </span>
                </div>
              </div>

              {/* Quick Neon Presets */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'Pink', color: '#ec4899', intensity: 60 },
                  { label: 'Cyan', color: '#06b6d4', intensity: 70 },
                  { label: 'Lime', color: '#84cc16', intensity: 65 },
                  { label: 'Amber', color: '#f59e0b', intensity: 70 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const next = {
                        ...neonSettings,
                        color: preset.color,
                        intensity: preset.intensity,
                      };
                      setNeonSettings(next);
                      (canvasManager as any)?.applyEffect?.('neon', next);
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-1 py-1 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 transition text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <ShadowSlider
                label="Intensity / Glow"
                value={neonSettings.intensity}
                min={1}
                max={100}
                onChange={(value) => handleNeonSettingChange('intensity', value)}
              />

              <button
                type="button"
                onClick={() => handleRemoveEffect('neon')}
                className="w-full rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition"
              >
                Remove neon
              </button>
            </div>
          )}

          {selectedEffect === 'blur' && activeEffects.blur && (
            <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-gray-900">Blur settings</span>
                </div>
              </div>

              {/* Quick Blur Presets */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'Soft', blur: 15 },
                  { label: 'Medium', blur: 35 },
                  { label: 'Strong', blur: 65 },
                  { label: 'Max', blur: 100 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const next = { blur: preset.blur };
                      setBlurSettings(next);
                      (canvasManager as any)?.applyEffect?.('blur', next);
                    }}
                    className="rounded-lg border border-purple-200 bg-white px-1 py-1 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 transition text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <ShadowSlider
                label="Blur Amount"
                value={blurSettings.blur}
                min={0}
                max={100}
                onChange={(value) => handleBlurSettingChange('blur', value)}
              />

              <button
                type="button"
                onClick={() => handleRemoveEffect('blur')}
                className="w-full rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition"
              >
                Remove blur
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
                    <div>
                      <span className="text-xs font-semibold text-gray-800">Curve</span>
                      <p className="mt-0.5 text-[9px] font-medium text-gray-400">
                        Canva-style bend
                      </p>
                    </div>
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

                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { label: 'Soft', value: 25 },
                      { label: 'Medium', value: 50 },
                      { label: 'Strong', value: 75 },
                      { label: 'Max', value: 90 },
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
                      <SlidersHorizontal className="w-3 h-3 text-indigo-500" />
                      <span>Hue / Tint</span>
                    </span>
                    <span className="font-mono text-[10px]">{adjustments.hue}°</span>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default TextEffectsPanel;
