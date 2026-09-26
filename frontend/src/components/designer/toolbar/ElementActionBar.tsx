'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock,
  Unlock,
  CopyPlus,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { SelectedObjectState } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { MoreMenuPopover } from './MoreMenuPopover';

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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Close popover when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update floating bar coordinates centered above the active object
  const updatePosition = useCallback(() => {
    if (!canvasManager) return;
    const canvas = canvasManager.getCanvas();
    if (!canvas) return;

    const active = canvas.getActiveObject();
    if (active) {
      active.setCoords();
      const rect = active.getBoundingRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const scaledLeft = rect.left * zoom;
        const scaledTop = rect.top * zoom;
        const scaledWidth = rect.width * zoom;
        const scaledHeight = rect.height * zoom;

        // Centered above the element's bounding box
        const centerX = scaledLeft + scaledWidth / 2;
        // Position ~46px above element; if too close to top edge, flip below
        let topY = scaledTop - 46;
        if (topY < 10) {
          topY = scaledTop + scaledHeight + 12;
        }

        setCoords({ x: centerX, y: topY });
        return;
      }
    }

    // Fallback using selected state coordinates scaled by zoom
    if (selected) {
      const selW = (selected.width || 0) * (selected.scaleX || 1);
      const selH = (selected.height || 0) * (selected.scaleY || 1);
      const centerX = (selected.left + selW / 2) * zoom;
      let topY = selected.top * zoom - 46;
      if (topY < 10) {
        topY = (selected.top + selH) * zoom + 12;
      }
      setCoords({ x: centerX, y: topY });
    }
  }, [canvasManager, selected, zoom]);

  // Position updates on selection, position, or zoom change (only when object is stationary)
  useEffect(() => {
    if (!isTransforming) {
      updatePosition();
    }
  }, [
    selected?.id,
    selected?.left,
    selected?.top,
    selected?.width,
    selected?.height,
    selected?.scaleX,
    selected?.scaleY,
    selected?.angle,
    zoom,
    isTransforming,
    updatePosition,
  ]);

  // Canvas interaction listener:
  // HIDE floating action bar when moving/scaling/rotating/transforming
  // SHOW and REPOSITION floating action bar when object settles/stops moving (stationary)
  useEffect(() => {
    if (!canvasManager) return;
    const canvas = canvasManager.getCanvas();
    if (!canvas) return;

    // Immediately hide when movement or transform begins
    const handleTransformStart = () => {
      setIsTransforming(true);
      setIsMoreOpen(false);
    };

    // When movement finishes (object modified, mouse released, or selection settled),
    // show bar at the new fixed/stationary position
    const handleTransformEnd = () => {
      setIsTransforming(false);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      animFrameRef.current = requestAnimationFrame(() => {
        animFrameRef.current = null;
        updatePosition();
      });
    };

    canvas.on('object:moving', handleTransformStart);
    canvas.on('object:scaling', handleTransformStart);
    canvas.on('object:rotating', handleTransformStart);
    canvas.on('object:skewing', handleTransformStart);
    canvas.on('before:transform', handleTransformStart);

    canvas.on('object:modified', handleTransformEnd);
    canvas.on('mouse:up', handleTransformEnd);
    canvas.on('selection:created', handleTransformEnd);
    canvas.on('selection:updated', handleTransformEnd);

    // Initial position sync
    updatePosition();

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      canvas.off('object:moving', handleTransformStart);
      canvas.off('object:scaling', handleTransformStart);
      canvas.off('object:rotating', handleTransformStart);
      canvas.off('object:skewing', handleTransformStart);
      canvas.off('before:transform', handleTransformStart);

      canvas.off('object:modified', handleTransformEnd);
      canvas.off('mouse:up', handleTransformEnd);
      canvas.off('selection:created', handleTransformEnd);
      canvas.off('selection:updated', handleTransformEnd);
    };
  }, [canvasManager, updatePosition]);

  if (!coords) return null;

  // Visible ONLY when object is fixed/stationary, NOT while moving/transforming
  const isVisible = !isTransforming;

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty('isLocked', !selected.isLocked);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasManager || selected.isLocked) return;
    canvasManager.duplicateSelected();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasManager || selected.isLocked) return;
    canvasManager.deleteSelected();
  };

  const handleMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMoreOpen((prev) => !prev);
    if (onOpenMore) {
      onOpenMore();
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        transform: 'translateX(-50%)',
      }}
      className={`z-30 select-none transition-all duration-150 ${
        isVisible ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'
      }`}
    >
      <div
        ref={barRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-0.5 bg-white/95 backdrop-blur-md px-1.5 py-1 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-gray-200/90 text-gray-700 animate-in fade-in zoom-in-95 duration-100"
      >
        {/* 1. Lock / Unlock */}
        <button
          type="button"
          onClick={handleToggleLock}
          title={selected.isLocked ? 'Unlock (Ctrl+L)' : 'Lock (Ctrl+L)'}
          className={`p-1.5 rounded-full transition flex items-center justify-center cursor-pointer ${
            selected.isLocked
              ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
          }`}
        >
          {selected.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>

        {/* 2. Duplicate (hidden if locked) */}
        {!selected.isLocked && (
          <button
            type="button"
            onClick={handleDuplicate}
            title="Duplicate (Ctrl+D)"
            className="p-1.5 rounded-full hover:bg-gray-100/90 text-gray-700 hover:text-gray-900 transition flex items-center justify-center cursor-pointer"
          >
            <CopyPlus className="w-4 h-4" />
          </button>
        )}

        {/* 3. Delete (hidden if locked) */}
        {!selected.isLocked && (
          <button
            type="button"
            onClick={handleDelete}
            title="Delete (Delete)"
            className="p-1.5 rounded-full hover:bg-red-50 text-gray-700 hover:text-red-600 transition flex items-center justify-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* 4. More actions (•••) */}
        <div className="relative">
          <button
            type="button"
            onClick={handleMore}
            title="More actions"
            className={`p-1.5 rounded-full transition flex items-center justify-center cursor-pointer ${
              isMoreOpen
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreOpen && (
            <MoreMenuPopover
              selected={selected}
              canvasManager={canvasManager}
              onClose={() => setIsMoreOpen(false)}
              align="left"
            />
          )}
        </div>
      </div>
    </div>
  );
};
