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
  Check,
  GripVertical,
  MoreVertical,
  Edit2,
  SlidersHorizontal,
  ImageIcon,
  Type,
  Crop,
  Paintbrush,
  Square,
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Drag and drop reordering states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);

  // Synchronize layers from CanvasManager
  useEffect(() => {
    if (!canvasManager) return;

    setLayers(canvasManager.getLayersList());

    const unsubscribe = canvasManager.onLayersChange((updatedLayers) => {
      setLayers(updatedLayers);
    });

    return () => unsubscribe();
  }, [canvasManager]);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuOpenId && !(e.target as HTMLElement).closest('.layer-menu-container')) {
        setMenuOpenId(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpenId]);

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
    setMenuOpenId(null);
    setEditingId(layer.id);
    setEditingName(layer.isCustomNamed ? layer.name : (layer.textPreview || layer.name));
  };

  const handleSaveRename = (id: string) => {
    if (!canvasManager) return;
    canvasManager.renameObject(id, editingName);
    setEditingId(null);
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMenuOpenId(null);
    if (!canvasManager) return;
    canvasManager.duplicateObjectById(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMenuOpenId(null);
    if (!canvasManager) return;
    canvasManager.deleteObjectById(id);
  };

  const handleReorder = (
    e: React.MouseEvent,
    id: string,
    direction: 'up' | 'down' | 'top' | 'bottom'
  ) => {
    e.stopPropagation();
    setMenuOpenId(null);
    if (!canvasManager) return;
    canvasManager.reorderLayer(id, direction);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number, layer: LayerItem) => {
    if (layer.isLocked || editingId === layer.id) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layer.id);

    // Create a sleek drag ghost
    try {
      const ghost = document.createElement('div');
      ghost.style.position = 'fixed';
      ghost.style.top = '-9999px';
      ghost.style.left = '-9999px';
      ghost.style.zIndex = '99999';
      ghost.style.pointerEvents = 'none';
      ghost.className =
        'flex items-center gap-2 px-3 py-2 bg-gray-900/95 text-white rounded-xl shadow-2xl text-xs font-semibold border border-purple-500/40 backdrop-blur-md';
      ghost.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-[#8b3dff]"></span>
        <span class="truncate max-w-[140px] text-white font-medium">${layer.name || 'Layer'}</span>
      `;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 16);
      setTimeout(() => {
        if (document.body.contains(ghost)) {
          document.body.removeChild(ghost);
        }
      }, 0);
    } catch {
      // Fallback
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
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
  };

  const renderShapePreview = (layer: LayerItem) => {
    const rawType = (layer.shapeType || layer.type || '').toLowerCase();
    const fillColor = layer.fill || '#84cc16';

    if (rawType.includes('ribbon') || rawType.includes('bookmark')) {
      return (
        <svg viewBox="0 0 24 32" className="w-6 h-8 fill-current" style={{ color: fillColor }}>
          <path d="M2 2h20v28l-10-6-10 6V2z" />
        </svg>
      );
    }
    if (rawType.includes('circle')) {
      return (
        <div
          className="w-7 h-7 rounded-full shadow-2xs"
          style={{
            backgroundColor: fillColor,
            border: layer.stroke ? `1.5px solid ${layer.stroke}` : undefined,
          }}
        />
      );
    }
    if (rawType.includes('triangle')) {
      return (
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" style={{ color: fillColor }}>
          <polygon points="12 2 22 22 2 22" />
        </svg>
      );
    }
    if (rawType.includes('star')) {
      return (
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" style={{ color: fillColor }}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    }
    if (rawType.includes('rect') || rawType.includes('square')) {
      return (
        <div
          className="w-7 h-7 rounded-md shadow-2xs"
          style={{
            backgroundColor: fillColor,
            border: layer.stroke ? `1.5px solid ${layer.stroke}` : undefined,
          }}
        />
      );
    }
    return (
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold shadow-2xs"
        style={{ backgroundColor: fillColor }}
      >
        <Square className="w-4 h-4 text-white" />
      </div>
    );
  };

  const renderLayerCenterContent = (layer: LayerItem) => {
    const rawType = (layer.type || '').toLowerCase();
    const isText = rawType === 'text' || rawType === 'textbox' || rawType === 'i-text';
    const isImage = rawType === 'image' || rawType === 'fabricimage';
    const isFrame = rawType === 'frame' || (layer.shapeType || '').includes('frame');
    const isBrush = rawType === 'brush' || rawType === 'path';
    const isShape = !isText && !isImage && !isFrame && !isBrush;

    // If user has customized the layer name, display that custom name
    if (layer.isCustomNamed && layer.name) {
      return (
        <div className="flex items-center justify-center gap-2 max-w-full">
          {layer.thumbnail && (
            <img
              src={layer.thumbnail}
              alt=""
              className="w-6 h-6 object-contain rounded shrink-0 pointer-events-none select-none"
            />
          )}
          <span className="font-bold text-gray-900 text-sm md:text-[15px] truncate max-w-[200px] tracking-tight">
            {layer.name}
          </span>
        </div>
      );
    }

    // 1. Text Layer: Bold text preview matching Canva design
    if (isText) {
      return (
        <span className="font-bold text-gray-900 text-sm md:text-[15px] truncate max-w-[210px] tracking-tight">
          {layer.textPreview || layer.name || 'Text'}
        </span>
      );
    }

    // 2. Image Layer: Centered thumbnail preview
    if (isImage) {
      if (layer.thumbnail) {
        return (
          <div className="h-10 max-w-[120px] flex items-center justify-center overflow-hidden">
            <img
              src={layer.thumbnail}
              alt={layer.name}
              className="max-h-10 max-w-full object-contain rounded select-none pointer-events-none"
            />
          </div>
        );
      }
      return (
        <div className="flex items-center gap-1.5 text-gray-700">
          <ImageIcon className="w-5 h-5 text-gray-500" />
          <span className="text-xs font-bold truncate max-w-[150px]">{layer.name}</span>
        </div>
      );
    }

    // 3. Frame Layer: Centered circular landscape preview
    if (isFrame) {
      if (layer.thumbnail) {
        return (
          <div className="h-10 w-10 rounded-full overflow-hidden border border-gray-300 flex items-center justify-center shadow-2xs">
            <img
              src={layer.thumbnail}
              alt={layer.name}
              className="w-full h-full object-cover select-none pointer-events-none"
            />
          </div>
        );
      }
      // Canva-style landscape frame placeholder
      return (
        <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-300 relative bg-gradient-to-b from-sky-200 to-sky-100 flex items-center justify-center shadow-2xs">
          <div className="absolute -bottom-1 w-11 h-5 bg-emerald-500 rounded-t-full" />
          <div className="absolute top-1 right-2 w-2 h-2 rounded-full bg-white/80" />
        </div>
      );
    }

    // 4. Brush / Drawing path
    if (isBrush) {
      return (
        <div className="flex items-center justify-center gap-1.5 text-gray-700">
          <Paintbrush className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold truncate max-w-[140px]">{layer.name}</span>
        </div>
      );
    }

    // 5. Shape Layer: Centered shape preview
    if (isShape) {
      return (
        <div className="flex items-center justify-center">
          {renderShapePreview(layer)}
        </div>
      );
    }

    // Fallback: Default layer name
    return (
      <span className="font-bold text-gray-900 text-sm truncate max-w-[180px]">
        {layer.name}
      </span>
    );
  };

  return (
    <div className="p-4 space-y-3.5 select-none custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#7d2ae8]" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Layers
          </h3>
        </div>
        <span className="text-[11px] text-gray-400 font-mono font-medium">
          {layers.length} {layers.length === 1 ? 'Object' : 'Objects'}
        </span>
      </div>

      {/* Canva-Style Layer Cards Stack (Top visual object is first) */}
      <div className="space-y-2 max-h-[560px] overflow-y-auto custom-scrollbar pr-0.5">
        {layers.map((layer, index) => {
          const isSelected = selected && selected.id === layer.id;
          const isEditing = editingId === layer.id;
          const isBeingDragged = draggedIndex === index;
          const isDropTarget = dragOverIndex === index;
          const isMenuOpen = menuOpenId === layer.id;
          const canDrag = !layer.isLocked && !isEditing;

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
              className={`group relative rounded-2xl transition select-none ${
                isBeingDragged
                  ? 'opacity-30 border-2 border-dashed border-[#7d2ae8] bg-[#e4e7eb]'
                  : isSelected
                    ? 'border-2 border-[#7d2ae8] bg-[#eaedf0] shadow-sm'
                    : 'border-2 border-transparent bg-[#e4e7eb] hover:bg-[#d9dee4]'
              } ${!layer.isVisible ? 'opacity-40' : ''}`}
            >
              {/* Canva Drop Target Insertion Line */}
              {isDropTarget && dropPosition === 'above' && (
                <div className="absolute -top-1.5 left-2 right-2 flex items-center z-40 pointer-events-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#7d2ae8] ring-2 ring-white shadow-xs shrink-0" />
                  <div className="flex-1 h-1 bg-[#7d2ae8] shadow-xs rounded-full" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#7d2ae8] ring-2 ring-white shadow-xs shrink-0" />
                </div>
              )}
              {isDropTarget && dropPosition === 'below' && (
                <div className="absolute -bottom-1.5 left-2 right-2 flex items-center z-40 pointer-events-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#7d2ae8] ring-2 ring-white shadow-xs shrink-0" />
                  <div className="flex-1 h-1 bg-[#7d2ae8] shadow-xs rounded-full" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#7d2ae8] ring-2 ring-white shadow-xs shrink-0" />
                </div>
              )}

              {/* Card Container */}
              <div className="min-h-[56px] h-14 px-3 flex items-center justify-between gap-3">
                {/* Left: 6-dots drag handle */}
                <div
                  className={`p-1 -ml-1 text-gray-500 hover:text-gray-900 rounded-md transition cursor-grab active:cursor-grabbing shrink-0 select-none ${
                    layer.isLocked ? 'opacity-30 cursor-not-allowed' : ''
                  }`}
                  title={layer.isLocked ? 'Layer is locked' : 'Drag to reorder layer'}
                >
                  <GripVertical className="w-4 h-4 text-gray-600" />
                </div>

                {/* Center: Editable Name or Canva Visual Content */}
                <div
                  onDoubleClick={(e) => handleStartRename(e, layer)}
                  className="flex-1 flex items-center justify-center min-w-0 cursor-pointer overflow-hidden px-1"
                  title="Double click to rename"
                >
                  {isEditing ? (
                    <div
                      className="flex items-center gap-1.5 w-full max-w-[220px]"
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
                        onBlur={() => handleSaveRename(layer.id)}
                        className="w-full text-center text-sm font-bold py-1 px-2.5 rounded-lg border-2 border-[#7d2ae8] bg-white text-gray-900 shadow-sm focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(layer.id)}
                        className="p-1.5 text-white bg-[#7d2ae8] hover:bg-[#6b21d6] rounded-lg shadow-xs shrink-0 transition"
                        title="Save name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    renderLayerCenterContent(layer)
                  )}
                </div>

                {/* Right: Canva 3-dots Menu Button */}
                <div className="relative layer-menu-container shrink-0">
                  <button
                    type="button"
                    title="Layer actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(isMenuOpen ? null : layer.id);
                    }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition shrink-0 ${
                      isSelected
                        ? 'bg-[#5d6470] text-white hover:bg-[#4b5260] shadow-xs'
                        : isMenuOpen
                          ? 'bg-[#5d6470] text-white'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-300/60 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-9 z-50 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 text-xs text-gray-700 animate-in fade-in zoom-in-95 duration-100"
                    >
                      {/* Rename */}
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(e, layer)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 text-left font-medium"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        <span>Rename</span>
                      </button>

                      <div className="h-px bg-gray-100 my-1" />

                      {/* Bring Forward */}
                      <button
                        type="button"
                        onClick={(e) => handleReorder(e, layer.id, 'up')}
                        disabled={index === 0}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 text-left font-medium disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                        <span>Bring forward</span>
                      </button>

                      {/* Send Backward */}
                      <button
                        type="button"
                        onClick={(e) => handleReorder(e, layer.id, 'down')}
                        disabled={index === layers.length - 1}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 text-left font-medium disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        <span>Send backward</span>
                      </button>

                      {/* Bring to Front */}
                      <button
                        type="button"
                        onClick={(e) => handleReorder(e, layer.id, 'top')}
                        disabled={index === 0}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 text-left font-medium disabled:opacity-30"
                      >
                        <ChevronsUp className="w-3.5 h-3.5 text-gray-500" />
                        <span>Bring to front</span>
                      </button>

                      {/* Send to Back */}
                      <button
                        type="button"
                        onClick={(e) => handleReorder(e, layer.id, 'bottom')}
                        disabled={index === layers.length - 1}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 text-left font-medium disabled:opacity-30"
                      >
                        <ChevronsDown className="w-3.5 h-3.5 text-gray-500" />
                        <span>Send to back</span>
                      </button>

                      <div className="h-px bg-gray-100 my-1" />

                      {/* Lock / Unlock */}
                      <button
                        type="button"
                        onClick={(e) => {
                          handleToggleLock(e, layer);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 text-left font-medium"
                      >
                        {layer.isLocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Unlock layer</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-gray-500" />
                            <span>Lock layer</span>
                          </>
                        )}
                      </button>

                      {/* Visibility */}
                      <button
                        type="button"
                        onClick={(e) => {
                          handleToggleVisibility(e, layer);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 text-left font-medium"
                      >
                        {layer.isVisible ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                            <span>Hide layer</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Show layer</span>
                          </>
                        )}
                      </button>

                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={(e) => handleDuplicate(e, layer.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 text-left font-medium"
                      >
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        <span>Duplicate</span>
                      </button>

                      <div className="h-px bg-gray-100 my-1" />

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, layer.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-50 text-red-600 text-left font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Delete layer</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Adjustable Controls for Selected Layer: Opacity Slider */}
              {isSelected && (
                <div
                  className="px-3 pb-2.5 pt-1.5 border-t border-purple-200/60 flex items-center justify-between gap-3 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                    <SlidersHorizontal className="w-3 h-3 text-[#7d2ae8]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-600">
                      Opacity
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round((layer.opacity ?? 1) * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        canvasManager?.setObjectOpacity(layer.id, val);
                      }}
                      className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[#7d2ae8]"
                    />
                    <span className="text-[11px] font-mono font-bold text-gray-800 w-8 text-right">
                      {Math.round((layer.opacity ?? 1) * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {layers.length === 0 && (
          <div className="py-10 text-center text-xs text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            No objects on canvas yet
          </div>
        )}
      </div>
    </div>
  );
};
