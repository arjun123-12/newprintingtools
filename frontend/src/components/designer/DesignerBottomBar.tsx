'use client';

import React from 'react';
import {
  SelectedObjectState,
  DocumentSettings,
  CanvasDimensions,
} from '@/types/designer';
import { ZoomControls } from './controls/ZoomControls';
import { Eye, EyeOff } from 'lucide-react';
import { PreflightBadge } from './controls/PreflightBadge';
import { PreflightReport } from './utils/preflightCheck';
import { CanvasManager } from './canvas/CanvasManager';

interface DesignerBottomBarProps {
  selected: SelectedObjectState | null;
  documentSettings: DocumentSettings;
  dimensions: CanvasDimensions;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitCanvas: () => void;
  showGuides?: boolean;
  onToggleGuides?: () => void;
  preflightReport?: PreflightReport | null;
  canvasManager?: CanvasManager | null;
}

export const DesignerBottomBar: React.FC<DesignerBottomBarProps> = ({
  selected,
  documentSettings,
  dimensions,
  zoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitCanvas,
  showGuides = true,
  onToggleGuides,
  preflightReport,
  canvasManager,
}) => {
  return (
    <footer className="h-11 flex-shrink-0 bg-white border-t border-gray-200 text-gray-600 text-xs px-4 flex items-center justify-between z-30 select-none shadow-2xs">
      {/* Left Info: Selected Object Coordinates & Type */}
      <div className="flex items-center gap-3">
        {selected ? (
          <div className="flex items-center gap-2 text-[11px] font-mono text-gray-700">
            <span className="font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 uppercase font-sans text-[10px]">
              {selected.type}
            </span>
            <span>X: {selected.left}px</span>
            <span className="text-gray-300">•</span>
            <span>Y: {selected.top}px</span>
            <span className="text-gray-300">•</span>
            <span>W: {selected.width}px</span>
            <span className="text-gray-300">•</span>
            <span>H: {selected.height}px</span>
            {selected.angle !== 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span>{selected.angle}°</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-gray-700">
              {documentSettings.width} × {documentSettings.height} {documentSettings.unit}
            </span>
            <span className="text-gray-300">•</span>
            <span className="font-mono text-emerald-600 font-semibold">{documentSettings.dpi} DPI</span>
            <span className="text-gray-300">•</span>
            <span>+{documentSettings.bleed || 3}mm Bleed</span>
          </div>
        )}
      </div>

      {/* Center / Right: Print Warnings Pop-up, Guides status and Zoom controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {preflightReport && (
          <PreflightBadge
            report={preflightReport}
            canvasManager={canvasManager ?? null}
          />
        )}

        {onToggleGuides && (
          <button
            type="button"
            onClick={onToggleGuides}
            title="Toggle Print Guides (Trim, Bleed, Safe Zone)"
            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition ${
              showGuides
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {showGuides ? (
              <>
                <Eye className="w-3 h-3 text-emerald-600" />
                <span>Guides ON</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3 text-gray-400" />
                <span>Guides OFF</span>
              </>
            )}
          </button>
        )}

        {/* Zoom Controls */}
        <ZoomControls
          zoom={zoom}
          onZoomChange={onZoomChange}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onResetZoom={onResetZoom}
          onFitCanvas={onFitCanvas}
        />
      </div>
    </footer>
  );
};
