'use client';

import React, { useState } from 'react';
import {
  SelectedObjectState,
  DocumentSettings,
  AlignmentType,
} from '@/types/designer';
import { CanvasManager } from './canvas/CanvasManager';
import { TransformControls } from './controls/TransformControls';
import { AlignmentControls } from './controls/AlignmentControls';
import { ColorPicker } from './controls/ColorPicker';
import { TextControls } from './controls/TextControls';
import { ImageControls } from './controls/ImageControls';
import { ImageCropModal } from './controls/ImageCropModal';
import { BrushPathControls } from './controls/BrushPathControls';
import {
  Sliders,
  FileSpreadsheet,
  ShieldCheck,
  Crop,
  X,
  Type,
  ImageIcon,
  Paintbrush,
} from 'lucide-react';

interface DesignerPropertiesProps {
  selected: SelectedObjectState | null;
  documentSettings: DocumentSettings;
  onUpdateDocumentSettings: (settings: Partial<DocumentSettings>) => void;
  canvasManager: CanvasManager | null;
  onClose?: () => void;
}

export const DesignerProperties: React.FC<DesignerPropertiesProps> = ({
  selected,
  documentSettings,
  onUpdateDocumentSettings,
  canvasManager,
  onClose,
}) => {
  const [isCropOpen, setIsCropOpen] = useState(false);

  const handleUpdateSelected = <K extends keyof SelectedObjectState>(
    prop: K,
    value: SelectedObjectState[K]
  ) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty(prop, value);
  };

  const handleAlign = (type: AlignmentType) => {
    if (!canvasManager) return;
    canvasManager.alignSelected(type);
  };

  const handleFillChange = (color: string) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty('fill', color);
  };

  const handleStrokeChange = (color: string) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty('stroke', color);
  };

  const handleCanvasBgChange = (color: string) => {
    if (!canvasManager) return;
    canvasManager.setBackgroundColor(color);
    onUpdateDocumentSettings({ backgroundColor: color });
  };

  const isText =
    Boolean(
      selected &&
        (selected.type === 'textbox' ||
          selected.type === 'i-text' ||
          selected.type === 'text' ||
          selected.text !== undefined)
    );

  const isPath = Boolean(
    selected &&
      (selected.type === 'path' || selected.type === 'brush' || selected.isBrushPath)
  );

  const isImage = Boolean(
    selected && (selected.type === 'image' || selected.type === 'fabricImage' || selected.src !== undefined)
  );

  const formatTypeName = (type: string) => {
    if (isText) return 'Text';
    if (isPath) return 'Brush Path';
    if (type === 'rect') return 'Rectangle';
    if (type === 'circle') return 'Circle';
    if (isImage) return 'Image';
    return type;
  };

  return (
    <>
      <aside className="w-80 flex-shrink-0 min-h-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto select-none custom-scrollbar z-30 shadow-xs">
        {selected ? (
          /* Selected Object Properties */
          <div className="p-4 space-y-5 animate-in fade-in duration-150">
            {/* Header with Close / Deselect button */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                {isText ? (
                  <Type className="w-4 h-4 text-blue-600" />
                ) : isImage ? (
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                ) : isPath ? (
                  <Paintbrush className="w-4 h-4 text-blue-600" />
                ) : (
                  <Sliders className="w-4 h-4 text-blue-600" />
                )}
                <span className="font-bold text-sm text-gray-900 capitalize">
                  {selected.isMultiple
                    ? `Selection (${selected.count} objects)`
                    : `${formatTypeName(selected.type)} Properties`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {formatTypeName(selected.type)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (canvasManager) {
                      canvasManager.deselectAll();
                    }
                    if (onClose) {
                      onClose();
                    }
                  }}
                  title="Deselect object / Close panel"
                  className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Typography Controls (if text object) */}
            {isText && !selected.isMultiple && (
              <div className="pb-2">
                <TextControls selected={selected} onUpdate={handleUpdateSelected} />
              </div>
            )}

            {/* Vector Brush Path Controls (if drawn path) */}
            {isPath && !selected.isMultiple && (
              <div className="pb-2">
                <BrushPathControls selected={selected} onUpdate={handleUpdateSelected} />
              </div>
            )}

            {/* Image Controls & DPI Inspector (if image object) */}
            {isImage && !selected.isMultiple && (
              <div className="pb-2">
                <ImageControls
                  selected={selected}
                  onUpdate={handleUpdateSelected}
                  canvasManager={canvasManager}
                  onOpenCrop={() => setIsCropOpen(true)}
                />
              </div>
            )}

            {/* Color Controls (for generic shapes/non-text/non-image/non-path objects) */}
            {!isText && !isImage && !isPath && !selected.isMultiple && (
              <div className="space-y-3.5">
                <ColorPicker
                  label="Fill Color"
                  value={selected.fill || '#2563eb'}
                  onChange={handleFillChange}
                />
                <ColorPicker
                  label="Border / Stroke Color"
                  value={selected.stroke || '#000000'}
                  onChange={handleStrokeChange}
                />
              </div>
            )}

            {/* Transform & Coordinates */}
            <div className="border-t border-gray-100 pt-4">
              <TransformControls
                selected={selected}
                onUpdate={handleUpdateSelected}
                onBringForward={() => canvasManager?.bringForward()}
                onSendBackward={() => canvasManager?.sendBackward()}
                onBringToFront={() => canvasManager?.bringToFront()}
                onSendToBack={() => canvasManager?.sendToBack()}
                onDuplicate={() => canvasManager?.duplicateSelected()}
                onDelete={() => canvasManager?.deleteSelected()}
              />
            </div>

            {/* Alignment */}
            <div className="border-t border-gray-100 pt-4">
              <AlignmentControls onAlign={handleAlign} />
            </div>
          </div>
        ) : (
          /* Document & Canvas Properties (No Selection) */
          <div className="p-4 space-y-5 animate-in fade-in duration-150">
            {/* Header with Close / Collapse button */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-sm text-gray-900">
                  Document Setup
                </span>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  title="Hide properties panel"
                  className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Document Dimensions Card */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/80 space-y-3 shadow-2xs">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Target Print Size:</span>
                <span className="font-bold text-gray-900 font-mono">
                  {documentSettings.width} × {documentSettings.height} {documentSettings.unit}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Resolution:</span>
                <span className="font-bold text-emerald-600 font-mono">
                  {documentSettings.dpi} DPI (High Res)
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Bleed Area:</span>
                <span className="font-medium text-gray-700 font-mono">
                  +{documentSettings.bleed || 3} mm
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Safe Margin:</span>
                <span className="font-medium text-gray-700 font-mono">
                  {documentSettings.safeArea || 3} mm
                </span>
              </div>
            </div>

            {/* Canvas Background Color */}
            <div className="border-t border-gray-100 pt-4">
              <ColorPicker
                label="Canvas Background"
                value={documentSettings.backgroundColor || '#ffffff'}
                onChange={handleCanvasBgChange}
              />
            </div>

            {/* Print Standards Guide */}
            <div className="border-t border-gray-100 pt-4 space-y-2.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Print Specifications
              </span>

              <div className="flex items-start gap-2.5 text-xs text-gray-600 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <Crop className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800">Bleed & Safe Zones</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Keep critical artwork inside the safe zone to ensure clean cutting.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-gray-600 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800">300 DPI High-Resolution</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Full vector rendering with commercial print quality export.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Non-Destructive Image Crop Modal */}
      {isCropOpen && selected && (
        <ImageCropModal
          selected={selected}
          canvasManager={canvasManager}
          onClose={() => setIsCropOpen(false)}
        />
      )}
    </>
  );
};
