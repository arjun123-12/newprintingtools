'use client';

import React from 'react';
import { Sparkles, Sun, CircleDashed, ShieldAlert, Zap, XCircle } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';

interface EffectsPopoverProps {
  canvasManager: CanvasManager | null;
  onClose: () => void;
}

export const EffectsPopover: React.FC<EffectsPopoverProps> = ({ canvasManager, onClose }) => {
  const effects = [
    { id: 'none', label: 'None', desc: 'Default normal style', icon: XCircle },
    { id: 'shadow', label: 'Shadow', desc: 'Soft directional drop shadow', icon: Sun },
    { id: 'lift', label: 'Lift', desc: 'Elevated blur shadow', icon: Sparkles },
    { id: 'glow', label: 'Glow', desc: 'Vibrant surrounding glow', icon: Zap },
    { id: 'outline', label: 'Outline', desc: 'Solid outer stroke outline', icon: CircleDashed },
    { id: 'hollow', label: 'Hollow', desc: 'Transparent fill with outline', icon: CircleDashed },
    { id: 'neon', label: 'Neon', desc: 'Glowing neon sign effect', icon: Zap },
  ] as const;

  const handleApply = (effectId: typeof effects[number]['id']) => {
    if (!canvasManager) return;
    canvasManager.applyEffect(effectId);
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-2"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>Effects</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
        {effects.map((eff) => {
          const Icon = eff.icon;
          return (
            <button
              key={eff.id}
              type="button"
              onClick={() => handleApply(eff.id)}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-purple-50/70 hover:border-purple-300 flex flex-col items-start gap-1 transition text-left group"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 group-hover:text-purple-700">
                <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-600" />
                <span>{eff.label}</span>
              </div>
              <span className="text-[9px] text-gray-500 leading-tight">{eff.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
