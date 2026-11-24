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
  children: React.ReactNode;
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
  children,
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
    <footer className="z-30 grid shrink-0 grid-cols-1 items-center gap-x-3 gap-y-1 border-t border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-2xs select-none sm:grid-cols-2 sm:px-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Left Info: Selected Object Coordinates & Type */}
      <div className="order-2 flex min-w-0 items-center justify-center gap-3 sm:justify-start xl:order-1">
        {selected ? (
          <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-xs sm:justify-start text-slate-800">
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase font-sans text-2xs">
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
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 sm:justify-start">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-slate-800">
              {documentSettings.width} × {documentSettings.height} {documentSettings.unit}
            </span>
            <span className="text-gray-300">•</span>
            <span className="font-mono text-emerald-700 font-semibold">{documentSettings.dpi} DPI</span>
            <span className="text-gray-300">•</span>
            <span>+{documentSettings.bleed || 3}mm Bleed</span>
          </div>
        )}
      </div>

      <div className="order-1 flex min-w-0 justify-center sm:col-span-2 xl:order-2 xl:col-span-1">
        {children}
      </div>

      {/* Print warnings, guides and zoom */}
      <div className="order-3 flex min-w-0 flex-wrap items-center justify-center gap-2 sm:justify-end sm:gap-2.5">
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
