import React from 'react';
import {
  Sparkles,
  Sun,
  CircleDashed,
  Zap,
  XCircle,
  Spline,
  Minus,
  Plus,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';

interface TextEffectsPanelProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState;
}

export const TextEffectsPanel: React.FC<TextEffectsPanelProps> = ({
  canvasManager,
  selected,
}) => {
  const effects = [
    { id: 'none', label: 'None', desc: 'Default style', icon: XCircle },
    { id: 'shadow', label: 'Shadow', desc: 'Drop shadow', icon: Sun },
    { id: 'lift', label: 'Lift', desc: 'Elevated blur', icon: Sparkles },
    { id: 'glow', label: 'Glow', desc: 'Vibrant glow', icon: Zap },
    { id: 'outline', label: 'Outline', desc: 'Solid outline', icon: CircleDashed },
    { id: 'hollow', label: 'Hollow', desc: 'Transparent fill', icon: CircleDashed },
    { id: 'neon', label: 'Neon', desc: 'Glowing neon', icon: Zap },
  ] as const;

  const currentCurve = selected?.curve || 0;

  const handleApply = (effectId: typeof effects[number]['id']) => {
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>Style & Curve Effects</span>
        </span>
      </div>

      {/* 1. Style Effects Grid */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
          Style
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {effects.map((eff) => {
            const Icon = eff.icon;
            return (
              <button
                key={eff.id}
                type="button"
                onClick={() => handleApply(eff.id)}
                className="p-1.5 rounded-xl border border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-300 flex items-center gap-2 transition text-left group shadow-2xs"
              >
                <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-600 flex-shrink-0" />
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

      {/* 2. Canva-Style Curve / Shape Section */}
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
              className={`py-1 text-[10px] font-bold rounded-lg border transition ${
                currentCurve === p.val
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
  );
};
