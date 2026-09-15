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

const clampZoom = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
};

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

  const safeZoom = clampZoom(zoom);
  const zoomPercent = Math.round(safeZoom * 100);

  /**
   * Close dropdown when clicking outside.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
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

  /**
   * Slider zoom.
   *
   * Slider value is percentage:
   * 10 -> 10%
   * 100 -> 100%
   * 800 -> 800%
   */
  const handleSliderChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const percentage = Number(event.target.value);

    if (!Number.isFinite(percentage)) {
      return;
    }

    onZoomChange(clampZoom(percentage / 100));
  };

  /**
   * Preset zoom.
   */
  const handlePresetZoom = (preset: number) => {
    onZoomChange(clampZoom(preset));
    setIsOpen(false);
  };

  /**
   * Zoom out.
   */
  const handleZoomOut = () => {
    if (safeZoom <= MIN_ZOOM) {
      return;
    }

    onZoomOut();
  };

  /**
   * Zoom in.
   */
  const handleZoomIn = () => {
    if (safeZoom >= MAX_ZOOM) {
      return;
    }

    onZoomIn();
  };

  /**
   * Reset to 100%.
   */
  const handleResetZoom = () => {
    onResetZoom();
    setIsOpen(false);
  };

  /**
   * Fit canvas to available screen.
   */
  const handleFitCanvas = () => {
    onFitCanvas();
    setIsOpen(false);
  };

  return (
    <div
      className="
        flex items-center gap-1
        rounded-full
        border border-gray-200
        bg-white
        px-1.5 py-1
        text-gray-700
        shadow-md
      "
    >
      {/* =========================
          ZOOM OUT
      ========================== */}
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={safeZoom <= MIN_ZOOM}
        aria-label="Zoom out"
        title="Zoom Out (Ctrl + -)"
        className="
          flex h-8 w-8 shrink-0
          items-center justify-center
          rounded-full
          text-gray-600
          transition
          hover:bg-gray-100
          hover:text-gray-900
          disabled:cursor-not-allowed
          disabled:opacity-35
        "
      >
        <Minus className="h-4 w-4" />
      </button>

      {/* =========================
          ZOOM SLIDER
      ========================== */}
      {!compact && (
        <div className="flex w-28 items-center px-1">
          <input
            type="range"
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            step={1}
            value={zoomPercent}
            onChange={handleSliderChange}
            aria-label="Canvas zoom"
            className="
              h-1.5
              w-full
              cursor-pointer
              appearance-none
              rounded-full
              bg-gray-200
              accent-[#8b3dff]
            "
          />
        </div>
      )}

      {/* =========================
          ZOOM DROPDOWN
      ========================== */}
      <div
        ref={dropdownRef}
        className="relative"
      >
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={`Zoom ${zoomPercent}% `}
          className="
            flex h-8
            min-w-[72px]
            items-center
            justify-center
            gap-1
            rounded-full
            px-2
            text-xs
            font-semibold
            text-gray-800
            transition
            hover:bg-gray-100
          "
        >
          <span>{zoomPercent}%</span>

          <ChevronDown
            className={`
h - 3.5 w - 3.5
text - gray - 500
transition - transform
              ${isOpen ? 'rotate-180' : ''}
`}
          />
        </button>

        {isOpen && (
          <div
            role="menu"
            className={`
absolute
left - 1 / 2
z - 50
w - 44
  - translate - x - 1 / 2
overflow - hidden
rounded - xl
              border border - gray - 200
bg - white
py - 1.5
shadow - xl
              ${compact
                ? 'top-full mt-2'
                : 'bottom-full mb-2'
              }
`}
          >
            {/* Dropdown title */}
            <p
              className="
                px-3 py-1.5
                text-[10px]
                font-bold
                uppercase
                tracking-wider
                text-gray-400
              "
            >
              Zoom
            </p>

            {/* Presets */}
            <div className="max-h-52 overflow-y-auto">
              {ZOOM_PRESETS.map((preset) => {
                const presetZoom = clampZoom(preset);
                const presetPercent = Math.round(
                  presetZoom * 100
                );

                const isCurrent =
                  Math.abs(safeZoom - presetZoom) < 0.01;

                return (
                  <button
                    key={preset}
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      handlePresetZoom(presetZoom)
                    }
                    className={`
flex
w - full
items - center
justify - between
px - 3
py - 2
text - left
text - xs
transition
                      ${isCurrent
                        ? 'bg-purple-50 font-semibold text-[#8b3dff]'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
`}
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

            {/* Fit */}
            <button
              type="button"
              role="menuitem"
              onClick={handleFitCanvas}
              className="
                flex
                w-full
                items-center
                gap-2
                px-3
                py-2
                text-left
                text-xs
                text-gray-700
                transition
                hover:bg-gray-50
              "
            >
              <Maximize className="h-4 w-4 text-gray-500" />

              <span>Fit to screen</span>
            </button>

            {/* Reset */}
            <button
              type="button"
              role="menuitem"
              onClick={handleResetZoom}
              className="
                flex
                w-full
                items-center
                gap-2
                px-3
                py-2
                text-left
                text-xs
                text-gray-700
                transition
                hover:bg-gray-50
              "
            >
              <RotateCcw className="h-4 w-4 text-gray-500" />

              <span>Reset to 100%</span>
            </button>
          </div>
        )}
      </div>

      {/* =========================
          ZOOM IN
      ========================== */}
      <button
        type="button"
        onClick={handleZoomIn}
        disabled={safeZoom >= MAX_ZOOM}
        aria-label="Zoom in"
        title="Zoom In (Ctrl + +)"
        className="
          flex h-8 w-8 shrink-0
          items-center justify-center
          rounded-full
          text-gray-600
          transition
          hover:bg-gray-100
          hover:text-gray-900
          disabled:cursor-not-allowed
          disabled:opacity-35
        "
      >
        <Plus className="h-4 w-4" />
      </button>

      {/* =========================
          FIT BUTTON
      ========================== */}
      {!compact && (
        <>
          <div className="mx-0.5 h-5 w-px bg-gray-200" />

          <button
            type="button"
            onClick={onFitCanvas}
            aria-label="Fit canvas to screen"
            title="Fit Canvas to Screen"
            className="
              flex h-8 w-8
              items-center
              justify-center
              rounded-full
              text-gray-600
              transition
              hover:bg-gray-100
              hover:text-gray-900
            "
          >
            <Maximize className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
};

export default ZoomControls;

