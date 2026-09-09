'use client';

import React, { useState, useEffect } from 'react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';

interface RotationBadgeProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
  zoom: number;
}

export const RotationBadge: React.FC<RotationBadgeProps> = ({
  canvasManager,
  selected,
  zoom,
}) => {
  const [rotationState, setRotationState] = useState<{
    visible: boolean;
    angle: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!canvasManager) return;
    const canvas = canvasManager.getCanvas();
    if (!canvas) return;

    let timeoutId: NodeJS.Timeout | null = null;

    const handleRotating = (opt: any) => {
      if (timeoutId) clearTimeout(timeoutId);
      const target = opt.target || canvas.getActiveObject();
      if (!target) return;

      const center = target.getCenterPoint();
      let rawAngle = Math.round(target.angle || 0) % 360;
      if (rawAngle < 0) rawAngle += 360;

      setRotationState({
        visible: true,
        angle: rawAngle,
        x: center.x,
        y: center.y,
      });
    };

    const handleEndRotate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setRotationState((prev) => (prev ? { ...prev, visible: false } : null));
      }, 700);
    };

    canvas.on('object:rotating', handleRotating);
    canvas.on('object:modified', handleEndRotate);
    canvas.on('mouse:up', handleEndRotate);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      canvas.off('object:rotating', handleRotating);
      canvas.off('object:modified', handleEndRotate);
      canvas.off('mouse:up', handleEndRotate);
    };
  }, [canvasManager]);

  if (!rotationState || !rotationState.visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${rotationState.x * zoom}px`,
        top: `${rotationState.y * zoom}px`,
        transform: 'translate(-50%, -50%)',
      }}
      className="pointer-events-none z-50 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="bg-[#0f172a] text-white text-xs font-bold font-sans px-3 py-1.5 rounded-full shadow-2xl border border-slate-700/80 flex items-center justify-center whitespace-nowrap backdrop-blur-md ring-2 ring-black/10">
        <span className="font-mono text-emerald-400 font-bold">{rotationState.angle}°</span>
      </div>
    </div>
  );
};
