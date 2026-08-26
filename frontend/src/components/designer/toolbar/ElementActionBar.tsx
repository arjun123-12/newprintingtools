'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Copy, Trash2, MoreHorizontal } from 'lucide-react';
import { SelectedObjectState } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';

interface ElementActionBarProps {
  selected: SelectedObjectState;
  canvasManager: CanvasManager | null;
  zoom: number;
  onOpenMore?: () => void;
}

export const ElementActionBar: React.FC<ElementActionBarProps> = ({
  selected,
  canvasManager,
  zoom,
  onOpenMore,
}) => {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Update floating bar coordinates on selection change, zoom, or canvas events
  const updatePosition = () => {
    if (!canvasManager) return;
    const rect = canvasManager.getActiveObjectBoundingRect();
    if (rect) {
      // Centered above the element's bounding box
      const centerX = rect.left + rect.width / 2;
      // Position 44px above element; if too close to top, flip below
      let topY = rect.top - 46;
      if (topY < 10) {
        topY = rect.top + rect.height + 12;
      }
      setCoords({ x: centerX, y: topY });
    } else {
      // Fallback using selected state coordinates scaled by zoom
      const centerX = (selected.left + (selected.width * (selected.scaleX || 1)) / 2) * zoom;
      const topY = Math.max(selected.top * zoom - 46, 10);
      setCoords({ x: centerX, y: topY });
    }
  };

  useEffect(() => {
    updatePosition();
    if (!canvasManager) return;
    const canvas = canvasManager.getCanvas();
    if (!canvas) return;

    const handleCanvasEvent = () => updatePosition();
    canvas.on('object:moving', handleCanvasEvent);
    canvas.on('object:scaling', handleCanvasEvent);
    canvas.on('object:rotating', handleCanvasEvent);
    canvas.on('object:modified', handleCanvasEvent);
    canvas.on('after:render', handleCanvasEvent);

    return () => {
      canvas.off('object:moving', handleCanvasEvent);
      canvas.off('object:scaling', handleCanvasEvent);
      canvas.off('object:rotating', handleCanvasEvent);
      canvas.off('object:modified', handleCanvasEvent);
      canvas.off('after:render', handleCanvasEvent);
    };
  }, [canvasManager, selected, zoom]);

  if (!coords) return null;

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty('isLocked', !selected.isLocked);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasManager) return;
    canvasManager.duplicateSelected();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasManager) return;
    canvasManager.deleteSelected();
  };

  const handleMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenMore) {
      onOpenMore();
    }
  };

  return (
    <div
      ref={barRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        transform: 'translateX(-50%)',
      }}
      className="z-40 flex items-center gap-1 bg-white/95 backdrop-blur-md px-1.5 py-1 rounded-full shadow-lg border border-gray-200/90 text-gray-700 animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Lock / Unlock */}
      <button
        type="button"
        onClick={handleToggleLock}
        title={selected.isLocked ? 'Unlock (Ctrl+L)' : 'Lock (Ctrl+L)'}
        className={`p-1.5 rounded-full hover:bg-gray-100 transition ${
          selected.isLocked ? 'text-amber-600 bg-amber-50' : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        {selected.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      </button>

      {/* Duplicate */}
      <button
        type="button"
        onClick={handleDuplicate}
        title="Duplicate (Ctrl+D)"
        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={handleDelete}
        title="Delete (Del / Backspace)"
        className="p-1.5 rounded-full hover:bg-red-50 text-gray-600 hover:text-red-600 transition"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* More */}
      <button
        type="button"
        onClick={handleMore}
        title="More actions"
        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
