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

  // Synchronize layers from CanvasManager
  useEffect(() => {
    if (!canvasManager) return;

    setLayers(canvasManager.getLayersList());

    const unsubscribe = canvasManager.onLayersChange((updatedLayers) => {
      setLayers(updatedLayers);
    });

    return () => unsubscribe();
  }, [canvasManager]);

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
      <div className="space-y-1.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-0.5">
        {layers.map((layer, index) => {
          const isSelected = selected && selected.id === layer.id;
          const isEditing = editingId === layer.id;

          return (
            <div
              key={layer.id}
              onClick={() => handleSelectLayer(layer.id)}
              className={`group rounded-xl border p-2.5 flex items-center justify-between transition cursor-pointer shadow-2xs ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/20'
                  : 'border-gray-200 bg-white hover:bg-gray-50/80 hover:border-gray-300'
              } ${!layer.isVisible ? 'opacity-50' : ''}`}
            >
              {/* Left: Icon & Name */}
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                <div className="p-1 rounded-md bg-gray-50 border border-gray-100 flex-shrink-0">
                  {getLayerIcon(layer.type)}
                </div>

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
