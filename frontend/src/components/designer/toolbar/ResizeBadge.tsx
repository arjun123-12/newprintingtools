'use client';

import React, { useState, useEffect } from 'react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';

interface ResizeBadgeProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
  zoom: number;
}

export const ResizeBadge: React.FC<ResizeBadgeProps> = ({
  canvasManager,
  selected,
  zoom,
}) => {
  const [resizeState, setResizeState] = useState<{
    visible: boolean;
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!canvasManager) return;
    const canvas = canvasManager.getCanvas();
    if (!canvas) return;

    let timeoutId: NodeJS.Timeout | null = null;

    const handleScaling = (opt: any) => {
      if (timeoutId) clearTimeout(timeoutId);
      const target = opt.target || canvas.getActiveObject();
      if (!target) return;

      const center = target.getCenterPoint ? target.getCenterPoint() : { x: target.left || 0, y: target.top || 0 };
      const w = Math.round(target.getScaledWidth());
      const h = Math.round(target.getScaledHeight());

      setResizeState({
        visible: true,
        width: w,
        height: h,
        x: center.x,
        y: center.y,
      });
    };

    const handleEndScale = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setResizeState((prev) => (prev ? { ...prev, visible: false } : null));
      }, 700);
    };

    canvas.on('object:scaling', handleScaling);
    canvas.on('object:modified', handleEndScale);
    canvas.on('mouse:up', handleEndScale);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      canvas.off('object:scaling', handleScaling);
      canvas.off('object:modified', handleEndScale);
      canvas.off('mouse:up', handleEndScale);
    };
  }, [canvasManager]);

  if (!resizeState || !resizeState.visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${resizeState.x * zoom}px`,
        top: `${resizeState.y * zoom}px`,
        transform: 'translate(-50%, -50%)',
      }}
      className="pointer-events-none z-50 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="bg-[#0f172a] text-white text-xs font-bold font-sans px-3 py-1.5 rounded-full shadow-2xl border border-slate-700/80 flex items-center justify-center gap-1.5 whitespace-nowrap backdrop-blur-md ring-2 ring-black/10">
        <span className="font-mono text-purple-300 font-bold">{resizeState.width}</span>
        <span className="text-gray-400 font-sans">×</span>
        <span className="font-mono text-purple-300 font-bold">{resizeState.height}</span>
        <span className="text-[10px] text-gray-400 font-normal">px</span>
      </div>
    </div>
  );
};
