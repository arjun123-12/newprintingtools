'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Type,
  ImageIcon,
  Square,
  Crop,
  Paintbrush,
  Edit2,
  Check,
  GripVertical,
  SlidersHorizontal,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState, LayerItem } from '@/types/designer';

interface LayersPanelProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  canvasManager,
  selected,
}) => {
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Drag and drop reordering states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);
  const [dragAllowedId, setDragAllowedId] = useState<string | null>(null);

  // Synchronize layers from CanvasManager
  useEffect(() => {
    if (!canvasManager) return;

    setLayers(canvasManager.getLayersList());

    const unsubscribe = canvasManager.onLayersChange((updatedLayers) => {
      setLayers(updatedLayers);
    });

    return () => unsubscribe();
  }, [canvasManager]);

  // Reset drag permission on global mouseup/pointerup so only active handle clicks trigger dragging
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setDragAllowedId(null);
    };
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, []);

  const handleSelectLayer = (id: string) => {
    if (!canvasManager) return;
    canvasManager.selectObjectById(id);
  };

  const handleToggleVisibility = (e: React.MouseEvent, layer: LayerItem) => {
    e.stopPropagation();
    if (!canvasManager) return;
    canvasManager.setObjectVisibility(layer.id, !layer.isVisible);
  };

  const handleToggleLock = (e: React.MouseEvent, layer: LayerItem) => {
    e.stopPropagation();
    if (!canvasManager) return;
    canvasManager.setObjectLocked(layer.id, !layer.isLocked);
  };

  const handleStartRename = (e: React.MouseEvent, layer: LayerItem) => {
    e.stopPropagation();
    setEditingId(layer.id);
    setEditingName(layer.name);
  };

  const handleSaveRename = (id: string) => {
    if (!canvasManager) return;
    canvasManager.renameObject(id, editingName);
    setEditingId(null);
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!canvasManager) return;
    canvasManager.duplicateObjectById(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!canvasManager) return;
    canvasManager.deleteObjectById(id);
  };

  const handleReorder = (
    e: React.MouseEvent,
    id: string,
    direction: 'up' | 'down' | 'top' | 'bottom'
  ) => {
    e.stopPropagation();
    if (!canvasManager) return;
    canvasManager.reorderLayer(id, direction);
  };

  // Drag and drop handlers - only permitted when initiated strictly from the Grip handle
  const handleDragStart = (e: React.DragEvent, index: number, layer: LayerItem) => {
    if (dragAllowedId !== layer.id || layer.isLocked || editingId === layer.id) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layer.id);

    // Create a sleek, professional compact drag ghost pill instead of capturing the entire card
    try {
      const ghost = document.createElement('div');
      ghost.style.position = 'fixed';
      ghost.style.top = '-9999px';
      ghost.style.left = '-9999px';
      ghost.style.zIndex = '99999';
      ghost.style.pointerEvents = 'none';
      ghost.className =
        'flex items-center gap-2 px-3 py-1.5 bg-gray-900/95 text-white rounded-lg shadow-2xl text-xs font-medium border border-gray-700/80 backdrop-blur-sm';
      ghost.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
        <span class="font-mono text-[10px] text-blue-300 font-bold px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-500/30">Layer-${index + 1}</span>
        <span class="truncate max-w-[130px] text-white font-medium">${layer.name || 'Object'}</span>
      `;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 16);
      setTimeout(() => {
        if (document.body.contains(ghost)) {
          document.body.removeChild(ghost);
        }
      }, 0);
    } catch {
      // Fallback if setDragImage is unsupported
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDragOverIndex(null);
      setDropPosition(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';
    setDragOverIndex(index);
    setDropPosition(pos);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !e.currentTarget.contains(related)) {
      setDragOverIndex(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDropPosition(null);
      setDragAllowedId(null);
      return;
    }

    let destIndex = targetIndex;
    if (dropPosition === 'below' && draggedIndex < targetIndex) {
      destIndex = targetIndex;
    } else if (dropPosition === 'below' && draggedIndex > targetIndex) {
      destIndex = targetIndex + 1;
    } else if (dropPosition === 'above' && draggedIndex < targetIndex) {
      destIndex = targetIndex - 1;
    } else if (dropPosition === 'above' && draggedIndex > targetIndex) {
      destIndex = targetIndex;
    }
    destIndex = Math.max(0, Math.min(layers.length - 1, destIndex));

    if (canvasManager && layers[draggedIndex]) {
      canvasManager.moveLayer(layers[draggedIndex].id, destIndex);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
    setDragAllowedId(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
    setDragAllowedId(null);
  };

  const getLayerIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'textbox':
      case 'i-text':
      case 'text':
        return <Type className="w-3.5 h-3.5 text-blue-600" />;
      case 'image':
      case 'fabricimage':
        return <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />;
      case 'frame':
        return <Crop className="w-3.5 h-3.5 text-purple-600" />;
      case 'brush':
      case 'path':
        return <Paintbrush className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <Square className="w-3.5 h-3.5 text-indigo-500" />;
    }
  };

  return (
    <div className="p-4 space-y-4 select-none custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Layers
          </h3>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">
          {layers.length} {layers.length === 1 ? 'Object' : 'Objects'}
        </span>
      </div>

      {/* Layer List (Top layer is first) */}
      <div className="space-y-1.5 max-h-[520px] overflow-y-auto custom-scrollbar pr-0.5">
        {layers.map((layer, index) => {
          const isSelected = selected && selected.id === layer.id;
          const isEditing = editingId === layer.id;
          const isBeingDragged = draggedIndex === index;
          const isDropTarget = dragOverIndex === index;
          const canDrag = dragAllowedId === layer.id && !layer.isLocked && !isEditing;

          return (
            <div
              key={`${layer.id}_${index}`}
              draggable={canDrag}
              onDragStart={(e) => handleDragStart(e, index, layer)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleSelectLayer(layer.id)}
              className={`group relative rounded-xl border p-2.5 transition select-none ${
                isBeingDragged
                  ? 'opacity-30 border-blue-400 bg-blue-50/40 ring-2 ring-blue-400/40 ring-dashed'
                  : isSelected
                    ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/20'
                    : 'border-gray-200 bg-white hover:bg-gray-50/80 hover:border-gray-300'
              } ${!layer.isVisible ? 'opacity-50' : ''}`}
            >
              {/* Drop Target Insertion Line Indicators (Figma style) */}
              {isDropTarget && dropPosition === 'above' && (
                <div className="absolute -top-1 left-1.5 right-1.5 flex items-center z-30 pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-xs shrink-0" />
                  <div className="flex-1 h-0.5 bg-blue-600 shadow-xs" />
                  <div className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-xs shrink-0" />
                </div>
              )}
              {isDropTarget && dropPosition === 'below' && (
                <div className="absolute -bottom-1 left-1.5 right-1.5 flex items-center z-30 pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-xs shrink-0" />
                  <div className="flex-1 h-0.5 bg-blue-600 shadow-xs" />
                  <div className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-xs shrink-0" />
                </div>
              )}

              <div className="flex items-center justify-between">
                {/* Left: Drag Handle, Layer Badge, Icon & Name */}
                <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                  {/* Drag Handle - Strict Drag Trigger */}
                  <div
                    onMouseDown={(e) => {
                      if (e.button !== 0) return; // Only primary button
                      e.stopPropagation();
                      if (!layer.isLocked && !isEditing) {
                        setDragAllowedId(layer.id);
                      }
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      if (!layer.isLocked && !isEditing) {
                        setDragAllowedId(layer.id);
                      }
                    }}
                    className={`p-1 -ml-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50/80 rounded transition cursor-grab active:cursor-grabbing shrink-0 select-none ${
                      layer.isLocked
                        ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-400'
                        : ''
                    }`}
                    title={
                      layer.isLocked
                        ? 'Layer is locked'
                        : 'Click and drag this handle to reorder layer'
                    }
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>

                  {/* Layer Number Badge: Layer-1, Layer-2, ... */}
                  <span
                    className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md border tracking-tight shrink-0 transition select-none ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-blue-50/80 text-blue-700 border-blue-200/70'
                    }`}
                    title={`Layer Index: ${index + 1}`}
                  >
                    Layer-{index + 1}
                  </span>

                  {/* Icon */}
                  <div className="p-1 rounded-md bg-gray-50 border border-gray-100 flex-shrink-0 select-none">
                    {getLayerIcon(layer.type)}
                  </div>

                  {/* Name or Rename Input */}
                  {isEditing ? (
                    <div
                      className="flex items-center gap-1 flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(layer.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full text-xs py-0.5 px-1.5 rounded border border-blue-400 bg-white text-gray-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(layer.id)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Save name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDoubleClick={(e) => handleStartRename(e, layer)}
                      className="flex flex-col min-w-0"
                    >
                      <span className="text-xs font-semibold text-gray-800 truncate">
                        {layer.name}
                      </span>
                      {layer.textPreview && (
                        <span className="text-[10px] text-gray-400 truncate">
                          &quot;{layer.textPreview}&quot;
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Actions (Visibility, Lock, Order, Delete) */}
                <div className="flex items-center gap-0.5">
                  {/* Reorder Steppers */}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                    <button
                      type="button"
                      title="Bring to Top"
                      disabled={index === 0}
                      onClick={(e) => handleReorder(e, layer.id, 'top')}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-20 hidden sm:inline-flex"
                    >
                      <ChevronsUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      title="Bring Forward"
                      disabled={index === 0}
                      onClick={(e) => handleReorder(e, layer.id, 'up')}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Send Backward"
                      disabled={index === layers.length - 1}
                      onClick={(e) => handleReorder(e, layer.id, 'down')}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Send to Bottom"
                      disabled={index === layers.length - 1}
                      onClick={(e) => handleReorder(e, layer.id, 'bottom')}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-20 hidden sm:inline-flex"
                    >
                      <ChevronsDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Edit Name Button */}
                  <button
                    type="button"
                    title="Rename Layer"
                    onClick={(e) => handleStartRename(e, layer)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  {/* Lock / Unlock */}
                  <button
                    type="button"
                    title={layer.isLocked ? 'Unlock Layer' : 'Lock Layer'}
                    onClick={(e) => handleToggleLock(e, layer)}
                    className={`p-1 rounded transition ${
                      layer.isLocked
                        ? 'text-amber-600 bg-amber-50'
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {layer.isLocked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Visibility */}
                  <button
                    type="button"
                    title={layer.isVisible ? 'Hide Layer' : 'Show Layer'}
                    onClick={(e) => handleToggleVisibility(e, layer)}
                    className={`p-1 rounded transition ${
                      !layer.isVisible
                        ? 'text-rose-500 bg-rose-50'
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {layer.isVisible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Duplicate */}
                  <button
                    type="button"
                    title="Duplicate Layer"
                    onClick={(e) => handleDuplicate(e, layer.id)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="w-3 h-3" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    title="Delete Layer"
                    onClick={(e) => handleDelete(e, layer.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Adjustable Controls for Selected Layer: Opacity slider */}
              {isSelected && (
                <div
                  className="mt-2.5 pt-2 border-t border-blue-200/60 flex items-center justify-between gap-3 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                    <SlidersHorizontal className="w-3 h-3 text-blue-600" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-600">
                      Opacity
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 max-w-[150px]">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round((layer.opacity ?? 1) * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        canvasManager?.setObjectOpacity(layer.id, val);
                      }}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-[11px] font-mono font-bold text-gray-800 w-9 text-right">
                      {Math.round((layer.opacity ?? 1) * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {layers.length === 0 && (
          <div className="py-10 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No objects on canvas yet
          </div>
        )}
      </div>
    </div>
  );
};
