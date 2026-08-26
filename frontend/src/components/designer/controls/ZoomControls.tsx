'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, ChevronDown } from 'lucide-react';
import { ZOOM_PRESETS } from '../canvas/CanvasManager';

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitCanvas: () => void;
  compact?: boolean;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitCanvas,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const zoomPercent = Math.round(zoom * 100);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-1 bg-white text-gray-700 border border-gray-200 rounded-lg p-1 shadow-sm">
      {/* Zoom Out */}
      <button
        type="button"
        onClick={onZoomOut}
        title="Zoom Out (Ctrl + -)"
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition disabled:opacity-40"
        disabled={zoom <= 0.1}
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      {/* Preset Dropdown Trigger */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 text-xs font-semibold text-gray-800 transition w-16 justify-between border border-transparent hover:border-gray-200"
        >
          <span>{zoomPercent}%</span>
          <ChevronDown className="w-3 h-3 text-gray-500" />
        </button>

        {isOpen && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-36 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50 max-h-64 overflow-y-auto ${
              compact ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
            }`}
          >
            <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Zoom Presets
            </div>
            {ZOOM_PRESETS.map((preset) => {
              const presetPct = Math.round(preset * 100);
              const isCurrent = Math.abs(zoom - preset) < 0.02;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    onZoomChange(preset);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center justify-between ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span>{presetPct}%</span>
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                </button>
              );
            })}
            <div className="border-t border-gray-100 my-1" />
            <button
              type="button"
              onClick={() => {
                onFitCanvas();
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Maximize className="w-3.5 h-3.5 text-gray-500" />
              <span>Fit to Screen</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onResetZoom();
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
              <span>Reset (100%)</span>
            </button>
          </div>
        )}
      </div>

      {/* Zoom In */}
      <button
        type="button"
        onClick={onZoomIn}
        title="Zoom In (Ctrl + +)"
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition disabled:opacity-40"
        disabled={zoom >= 8.0}
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      {!compact && (
        <>
          <div className="h-4 w-px bg-gray-200 mx-0.5" />
          {/* Fit */}
          <button
            type="button"
            onClick={onFitCanvas}
            title="Fit Canvas to Screen"
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
          >
            <Maximize className="w-4 h-4" />
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={onResetZoom}
            title="Reset Zoom to 100%"
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};
