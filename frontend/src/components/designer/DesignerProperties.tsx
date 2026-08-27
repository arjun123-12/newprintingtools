'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SelectedObjectState,
  DocumentSettings,
  CanvasDimensions,
} from '@/types/designer';
import { CanvasManager } from './canvas/CanvasManager';
import { ColorPicker } from './controls/ColorPicker';
import { ImageControls } from './controls/ImageControls';
import { ImageCropModal } from './controls/ImageCropModal';
import {
  Sliders,
  FileSpreadsheet,
  ShieldCheck,
  Crop,
  X,
  Type,
  ImageIcon,
  Paintbrush,
  Maximize2,
  Sparkles,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface DesignerPropertiesProps {
  selected: SelectedObjectState | null;
  documentSettings: DocumentSettings;
  dimensions?: CanvasDimensions;
  onUpdateDocumentSettings: (settings: Partial<DocumentSettings>) => void;
  canvasManager: CanvasManager | null;
  onOpenPreview?: () => void;
  onClose?: () => void;
}

export const DesignerProperties: React.FC<DesignerPropertiesProps> = ({
  selected,
  documentSettings,
  dimensions,
  onUpdateDocumentSettings,
  canvasManager,
  onOpenPreview,
  onClose,
}) => {

  const [isCropOpen, setIsCropOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate live artwork preview thumbnail
  const refreshPreview = useCallback(() => {
    if (!canvasManager) return;
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
    updateTimerRef.current = setTimeout(() => {
      try {
        const url = canvasManager.getCleanPreviewDataUrl(1.0);
        if (url) {
          setPreviewUrl(url);
        }
      } catch (err) {
        console.error('Failed to generate sidebar preview:', err);
      }
    }, 150);
  }, [canvasManager]);

  useEffect(() => {
    refreshPreview();
    if (!canvasManager) return;

    const unsubChange = canvasManager.onChange(() => {
      refreshPreview();
    });

    return () => {
      unsubChange();
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [canvasManager, refreshPreview]);

  const handleUpdateSelected = <K extends keyof SelectedObjectState>(
    prop: K,
    value: SelectedObjectState[K]
  ) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty(prop, value);
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

  const isText = Boolean(
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
    selected &&
    (selected.type === 'image' ||
      selected.type === 'fabricImage' ||
      selected.src !== undefined)
  );

  const formatTypeName = (type: string) => {
    if (isText) return 'Text';
    if (isPath) return 'Brush Path';
    if (type === 'rect') return 'Rectangle';
    if (type === 'circle') return 'Circle';
    if (isImage) return 'Image';
    return type;
  };

  const totalW = dimensions?.totalWidthPx || 1063;
  const totalH = dimensions?.totalHeightPx || 591;
  const bleedP = dimensions?.bleedPx || 0;
  const safeP = dimensions?.safeZonePx || 0;

  const trimL = totalW > 0 ? (bleedP / totalW) * 100 : 0;
  const trimT = totalH > 0 ? (bleedP / totalH) * 100 : 0;
  const trimW = totalW > 0 ? ((totalW - bleedP * 2) / totalW) * 100 : 100;
  const trimH = totalH > 0 ? ((totalH - bleedP * 2) / totalH) * 100 : 100;

  const safeL = totalW > 0 ? ((bleedP + safeP) / totalW) * 100 : 0;
  const safeT = totalH > 0 ? ((bleedP + safeP) / totalH) * 100 : 0;
  const safeW = totalW > 0 ? ((totalW - (bleedP + safeP) * 2) / totalW) * 100 : 100;
  const safeH = totalH > 0 ? ((totalH - (bleedP + safeP) * 2) / totalH) * 100 : 100;

  return (
    <>
      <aside className="relative w-80 flex-shrink-0 min-h-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto select-none custom-scrollbar z-30 shadow-xs">

        {/* ================================================================ */}
        {/* 1. CANVA-STYLE LIVE ARTWORK PREVIEW SECTION                      */}
        {/* ================================================================ */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close properties panel"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="p-4 border-b border-gray-100 space-y-3 bg-slate-50/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Artwork Preview
              </h3>
            </div>
            {onOpenPreview && (
              <button
                type="button"
                onClick={onOpenPreview}
                title="Open Fullscreen Preview"
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Full View</span>
              </button>
            )}
          </div>

          {/* Scaled Aspect-Ratio Preview Container */}
          <div
            onClick={onOpenPreview}
            role="button"
            tabIndex={0}
            title="Click to open presentation preview"
            className="group relative w-full rounded-xl border border-gray-200/90 bg-white shadow-2xs overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-center p-2"
            style={{
              maxHeight: '180px',
              minHeight: '100px',
            }}
          >
            <div
              className="relative w-full max-h-full flex items-center justify-center rounded shadow-xs overflow-hidden border border-gray-200"
              style={{
                aspectRatio: `${totalW} / ${totalH}`,
                maxHeight: '160px',
              }}
            >
              {previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt="Live Artwork Preview"
                  className="w-full h-full object-contain select-none group-hover:scale-[1.02] transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs animate-pulse">
                  Rendering preview...
                </div>
              )}

              {/* Guides Overlays */}
              {bleedP > 0 && (
                <>
                  {/* Bleed Edge */}
                  <div 
                    className="absolute pointer-events-none border border-rose-500 z-10 inset-0 opacity-70"
                    title="Bleed Edge"
                  />
                  {/* Trim Line */}
                  <div 
                    className="absolute pointer-events-none border border-black z-10 opacity-80"
                    title="Trim Line"
                    style={{
                      left: `${trimL}%`,
                      top: `${trimT}%`,
                      width: `${trimW}%`,
                      height: `${trimH}%`,
                    }}
                  />
                  {/* Safe Zone Line */}
                  <div 
                    className="absolute pointer-events-none border border-emerald-500 border-dashed z-10 opacity-70"
                    title="Safe Zone"
                    style={{
                      left: `${safeL}%`,
                      top: `${safeT}%`,
                      width: `${safeW}%`,
                      height: `${safeH}%`,
                    }}
                  />
                </>
              )}

              {/* Hover overlay hint */}
              <div className="absolute inset-0 bg-blue-900/15 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[1px]">
                <div className="bg-slate-900/80 px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1.5 shadow-lg">
                  <Maximize2 className="w-3 h-3" />
                  <span>Click to Expand</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info Badges */}
          <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
            <span className="truncate">
              {documentSettings.width} × {documentSettings.height} {documentSettings.unit}
            </span>
            <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {documentSettings.dpi} DPI
            </span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 2. PROPERTIES CONTENT (Selected Element OR Document Setup)      */}
        {/* ================================================================ */}
        {selected ? (
          <div className="d-none p-4 space-y-5 animate-in fade-in duration-150">
            {/* Header */}
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

            {/* Image Controls */}
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

            {/* Shape / Vector Color Controls */}
            {!isText && !isImage && !isPath && !selected.isMultiple && (
              <div className="space-y-3.5">
                <ColorPicker
                  label="Fill Color"
                  value={selected.fill || '#2563eb'}
                  onChange={handleFillChange}
                  canvasManager={canvasManager}
                />
                <ColorPicker
                  label="Border / Stroke Color"
                  value={selected.stroke || '#000000'}
                  onChange={handleStrokeChange}
                  canvasManager={canvasManager}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-5 animate-in fade-in duration-150">

            {/* <div className="flex items-center justify-between border-b border-gray-200 pb-3">
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
            </div> */}


            {/* <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/80 space-y-3 shadow-2xs">
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
                  +{documentSettings.bleed !== undefined ? documentSettings.bleed : 5} mm
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Safe Margin:</span>
                <span className="font-medium text-gray-700 font-mono">
                  {documentSettings.safeArea || 3} mm
                </span>
              </div>
            </div> */}

            {/* Canvas Background Color */}
            <div className="border-t border-gray-100 pt-4">
              <ColorPicker
                label="Canvas Background"
                value={documentSettings.backgroundColor || '#ffffff'}
                onChange={handleCanvasBgChange}
                canvasManager={canvasManager}
              />
            </div>

            {/* Commercial Print Specifications */}
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

