'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
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

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP_PERCENT = 5;

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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSliderChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const percentage = Number(event.target.value);
    const nextZoom = percentage / 100;

    onZoomChange(
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
    );
  };

  return (
    <div
      className="
        flex items-center gap-1 rounded-full
        border border-gray-200 bg-white px-1.5 py-1
        text-gray-700 shadow-md
      "
    >
      {/* Zoom out */}
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Zoom out"
        title="Zoom Out (Ctrl + -)"
        className="
          flex h-8 w-8 shrink-0 items-center justify-center
          rounded-full text-gray-600 transition
          hover:bg-gray-100 hover:text-gray-900
          disabled:cursor-not-allowed disabled:opacity-35
        "
      >
        <Minus className="h-4 w-4" />
      </button>

      {/* Canva-style zoom slider */}
      {!compact && (
        <div className="flex w-24 items-center px-1">
          <input
            type="range"
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            step={ZOOM_STEP_PERCENT}
            value={zoomPercent}
            onChange={handleSliderChange}
            aria-label="Canvas zoom"
            className="
              h-1.5 w-full cursor-pointer appearance-none
              rounded-full bg-gray-200 accent-[#8b3dff]
            "
          />
        </div>
      )}

      {/* Zoom percentage and dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="
            flex h-8 min-w-[72px] items-center justify-center
            gap-1 rounded-full px-2 text-xs font-semibold
            text-gray-800 transition hover:bg-gray-100
          "
        >
          <span>{zoomPercent}%</span>

          <ChevronDown
            className={`h-3.5 w-3.5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''
              }`}
          />
        </button>

        {isOpen && (
          <div
            role="menu"
            className={`absolute left-1/2 z-50 w-44 -translate-x-1/2
              overflow-hidden rounded-xl border border-gray-200
              bg-white py-1.5 shadow-xl ${compact
                ? 'top-full mt-2'
                : 'bottom-full mb-2'
              }`}
          >
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Zoom
            </p>

            <div className="max-h-52 overflow-y-auto">
              {ZOOM_PRESETS.map((preset) => {
                const presetPercent = Math.round(preset * 100);
                const isCurrent = Math.abs(zoom - preset) < 0.02;

                return (
                  <button
                    key={preset}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onZoomChange(preset);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between
                      px-3 py-2 text-left text-xs transition ${isCurrent
                        ? 'bg-purple-50 font-semibold text-[#8b3dff]'
                        : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <span>{presetPercent}%</span>

                    {isCurrent && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="my-1 border-t border-gray-100" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onFitCanvas();
                setIsOpen(false);
              }}
              className="
                flex w-full items-center gap-2 px-3 py-2
                text-left text-xs text-gray-700
                transition hover:bg-gray-50
              "
            >
              <Maximize className="h-4 w-4 text-gray-500" />
              <span>Fit to screen</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onResetZoom();
                setIsOpen(false);
              }}
              className="
                flex w-full items-center gap-2 px-3 py-2
                text-left text-xs text-gray-700
                transition hover:bg-gray-50
              "
            >
              <RotateCcw className="h-4 w-4 text-gray-500" />
              <span>Reset to 100%</span>
            </button>
          </div>
        )}
      </div>

      {/* Zoom in */}
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Zoom in"
        title="Zoom In (Ctrl + +)"
        className="
          flex h-8 w-8 shrink-0 items-center justify-center
          rounded-full text-gray-600 transition
          hover:bg-gray-100 hover:text-gray-900
          disabled:cursor-not-allowed disabled:opacity-35
        "
      >
        <Plus className="h-4 w-4" />
      </button>

      {!compact && (
        <>
          <div className="mx-0.5 h-5 w-px bg-gray-200" />

          <button
            type="button"
            onClick={onFitCanvas}
            aria-label="Fit canvas to screen"
            title="Fit Canvas to Screen"
            className="
              flex h-8 w-8 items-center justify-center
              rounded-full text-gray-600 transition
              hover:bg-gray-100 hover:text-gray-900
            "
          >
            <Maximize className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
};