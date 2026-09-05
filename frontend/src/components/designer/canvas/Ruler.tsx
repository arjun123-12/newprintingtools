'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Ruler as RulerIcon,
} from 'lucide-react';
import { CanvasDimensions, DocumentSettings, SelectedObjectState } from '@/types/designer';
import { CanvasManager } from './CanvasManager';

interface RulerProps {
  zoom: number;
  dimensions: CanvasDimensions;
  canvasManager: CanvasManager | null;
  paperRef: React.RefObject<HTMLDivElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  selected?: SelectedObjectState | null;
  onUpdateDocumentSettings?: (settings: Partial<DocumentSettings>) => void;
}

export const Ruler: React.FC<RulerProps> = ({
  zoom,
  dimensions,
  canvasManager,
  paperRef,
  containerRef,
  selected = null,
  onUpdateDocumentSettings,
}) => {
  const topRulerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftRulerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [cursorPos, setCursorPos] = useState<{ xMm: number; yMm: number } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [draggingGuide, setDraggingGuide] = useState<{
    orientation: 'horizontal' | 'vertical';
    currentPx: number;
    currentMm: number;
  } | null>(null);

  const dpi = dimensions.dpi || 300;
  const widthMm = dimensions.widthMm || 90;
  const heightMm = dimensions.heightMm || 50;
  const widthPx = dimensions.widthPx || 1063;
  const heightPx = dimensions.heightPx || 591;

  // Active margin in mm (defaults to safeZoneMm or 3mm if unspecified)
  const currentMarginMm = useMemo(() => {
    if (dimensions.marginMm !== undefined) return dimensions.marginMm;
    if (dimensions.safeZoneMm !== undefined) return dimensions.safeZoneMm;
    return 3;
  }, [dimensions.marginMm, dimensions.safeZoneMm]);

  const [marginInput, setMarginInput] = useState<number>(currentMarginMm);

  useEffect(() => {
    setMarginInput(currentMarginMm);
  }, [currentMarginMm]);

  // Pixels per mm at display zoom level
  const pxPerMm = (dpi / 25.4) * zoom;
  const displayW = Math.round(widthPx * zoom);
  const displayH = Math.round(heightPx * zoom);
  const rulerThickness = 24;

  // Selected object projected range onto rulers (Canva-style object span)
  const selectedSpan = useMemo(() => {
    if (!selected) return null;
    const sX1 = Math.round(selected.left * zoom);
    const sX2 = Math.round((selected.left + selected.width * (selected.scaleX || 1)) * zoom);
    const sY1 = Math.round(selected.top * zoom);
    const sY2 = Math.round((selected.top + selected.height * (selected.scaleY || 1)) * zoom);
    return {
      x1: Math.max(0, Math.min(sX1, sX2)),
      x2: Math.min(displayW, Math.max(sX1, sX2)),
      y1: Math.max(0, Math.min(sY1, sY2)),
      y2: Math.min(displayH, Math.max(sY1, sY2)),
    };
  }, [selected, zoom, displayW, displayH]);

  // ----------------------------------------------------
  // 1. Draw Top Horizontal Ruler (Canva Aesthetic)
  // ----------------------------------------------------
  const drawTopRuler = useCallback(() => {
    const canvas = topRulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayW * dpr;
    canvas.height = rulerThickness * dpr;
    ctx.scale(dpr, dpr);

    // Clean Canva ruler background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, displayW, rulerThickness);

    // Subtle bottom hairline separating ruler from paper
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerThickness - 0.5);
    ctx.lineTo(displayW, rulerThickness - 0.5);
    ctx.stroke();

    // Canva Selected Object Range Highlight Span
    if (selectedSpan && selectedSpan.x2 > selectedSpan.x1) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.14)';
      ctx.fillRect(selectedSpan.x1, 0, selectedSpan.x2 - selectedSpan.x1, rulerThickness - 1);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(selectedSpan.x1 + 0.5, 0);
      ctx.lineTo(selectedSpan.x1 + 0.5, rulerThickness);
      ctx.moveTo(selectedSpan.x2 - 0.5, 0);
      ctx.lineTo(selectedSpan.x2 - 0.5, rulerThickness);
      ctx.stroke();
    }

    // Dynamic Step calculation
    let stepMm = 10;
    if (pxPerMm < 2) stepMm = 50;
    else if (pxPerMm < 4) stepMm = 20;
    else if (pxPerMm > 15) stepMm = 5;

    ctx.fillStyle = '#64748b';
    ctx.font = '500 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';

    for (let mm = 0; mm <= widthMm; mm++) {
      const x = Math.round(mm * pxPerMm);
      if (x > displayW) break;

      const isMajor = mm % stepMm === 0;
      const isMedium = mm % (stepMm / 2) === 0;

      ctx.beginPath();
      if (isMajor) {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.moveTo(x + 0.5, rulerThickness - 11);
        ctx.lineTo(x + 0.5, rulerThickness);
        ctx.stroke();

        ctx.fillText(`${mm}`, x, 9);
      } else if (isMedium) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.moveTo(x + 0.5, rulerThickness - 7);
        ctx.lineTo(x + 0.5, rulerThickness);
        ctx.stroke();
      } else if (pxPerMm > 3) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.moveTo(x + 0.5, rulerThickness - 4);
        ctx.lineTo(x + 0.5, rulerThickness);
        ctx.stroke();
      }
    }

    // Canva Margin Markers on Top Ruler (Violet Indicators at margin & width - margin)
    if (currentMarginMm > 0) {
      const leftMarginX = Math.round(currentMarginMm * pxPerMm);
      const rightMarginX = Math.round((widthMm - currentMarginMm) * pxPerMm);

      const drawMarginTick = (mx: number) => {
        if (mx >= 0 && mx <= displayW) {
          ctx.strokeStyle = '#8b5cf6';
          ctx.fillStyle = '#8b5cf6';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(mx + 0.5, rulerThickness - 14);
          ctx.lineTo(mx + 0.5, rulerThickness);
          ctx.stroke();

          // Diamond marker at top
          ctx.beginPath();
          ctx.arc(mx + 0.5, rulerThickness - 13, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      drawMarginTick(leftMarginX);
      drawMarginTick(rightMarginX);
    }

    // Canva Cursor Tracking Marker
    if (cursorPos) {
      const curX = Math.round(cursorPos.xMm * pxPerMm);
      if (curX >= 0 && curX <= displayW) {
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curX + 0.5, 0);
        ctx.lineTo(curX + 0.5, rulerThickness);
        ctx.stroke();
      }
    }
  }, [displayW, widthMm, pxPerMm, cursorPos, selectedSpan, currentMarginMm]);

  // ----------------------------------------------------
  // 2. Draw Left Vertical Ruler (Canva Aesthetic)
  // ----------------------------------------------------
  const drawLeftRuler = useCallback(() => {
    const canvas = leftRulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rulerThickness * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    // Clean Canva ruler background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rulerThickness, displayH);

    // Subtle right hairline separating ruler from paper
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerThickness - 0.5, 0);
    ctx.lineTo(rulerThickness - 0.5, displayH);
    ctx.stroke();

    // Canva Selected Object Range Highlight Span
    if (selectedSpan && selectedSpan.y2 > selectedSpan.y1) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.14)';
      ctx.fillRect(0, selectedSpan.y1, rulerThickness - 1, selectedSpan.y2 - selectedSpan.y1);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, selectedSpan.y1 + 0.5);
      ctx.lineTo(rulerThickness, selectedSpan.y1 + 0.5);
      ctx.moveTo(0, selectedSpan.y2 - 0.5);
      ctx.lineTo(rulerThickness, selectedSpan.y2 - 0.5);
      ctx.stroke();
    }

    let stepMm = 10;
    if (pxPerMm < 2) stepMm = 50;
    else if (pxPerMm < 4) stepMm = 20;
    else if (pxPerMm > 15) stepMm = 5;

    ctx.fillStyle = '#64748b';
    ctx.font = '500 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';

    for (let mm = 0; mm <= heightMm; mm++) {
      const y = Math.round(mm * pxPerMm);
      if (y > displayH) break;

      const isMajor = mm % stepMm === 0;
      const isMedium = mm % (stepMm / 2) === 0;

      ctx.beginPath();
      if (isMajor) {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.moveTo(rulerThickness - 11, y + 0.5);
        ctx.lineTo(rulerThickness, y + 0.5);
        ctx.stroke();

        ctx.save();
        ctx.translate(10, y + 3);
        ctx.fillText(`${mm}`, 0, 0);
        ctx.restore();
      } else if (isMedium) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.moveTo(rulerThickness - 7, y + 0.5);
        ctx.lineTo(rulerThickness, y + 0.5);
        ctx.stroke();
      } else if (pxPerMm > 3) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.moveTo(rulerThickness - 4, y + 0.5);
        ctx.lineTo(rulerThickness, y + 0.5);
        ctx.stroke();
      }
    }

    // Canva Margin Markers on Left Ruler
    if (currentMarginMm > 0) {
      const topMarginY = Math.round(currentMarginMm * pxPerMm);
      const bottomMarginY = Math.round((heightMm - currentMarginMm) * pxPerMm);

      const drawMarginTick = (my: number) => {
        if (my >= 0 && my <= displayH) {
          ctx.strokeStyle = '#8b5cf6';
          ctx.fillStyle = '#8b5cf6';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(rulerThickness - 14, my + 0.5);
          ctx.lineTo(rulerThickness, my + 0.5);
          ctx.stroke();

          // Diamond marker
          ctx.beginPath();
          ctx.arc(rulerThickness - 13, my + 0.5, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      drawMarginTick(topMarginY);
      drawMarginTick(bottomMarginY);
    }

    // Canva Cursor Tracking Marker
    if (cursorPos) {
      const curY = Math.round(cursorPos.yMm * pxPerMm);
      if (curY >= 0 && curY <= displayH) {
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, curY + 0.5);
        ctx.lineTo(rulerThickness, curY + 0.5);
        ctx.stroke();
      }
    }
  }, [displayH, heightMm, pxPerMm, cursorPos, selectedSpan, currentMarginMm]);

  useEffect(() => {
    drawTopRuler();
    drawLeftRuler();
  }, [drawTopRuler, drawLeftRuler]);

  // Track cursor position relative to artwork canvas
  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = paper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const unscaledXPx = x / zoom;
      const unscaledYPx = y / zoom;

      const xMm = Number(((unscaledXPx / dpi) * 25.4).toFixed(1));
      const yMm = Number(((unscaledYPx / dpi) * 25.4).toFixed(1));

      setCursorPos({ xMm, yMm });
    };

    const handleMouseLeave = () => {
      setCursorPos(null);
    };

    paper.addEventListener('mousemove', handleMouseMove);
    paper.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      paper.removeEventListener('mousemove', handleMouseMove);
      paper.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [paperRef, zoom, dpi]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  // Handle Guide Dragging from Canva Top or Left Ruler
  const handleStartGuideDrag = (orientation: 'horizontal' | 'vertical', e: React.MouseEvent) => {
    e.preventDefault();
    const paper = paperRef.current;
    if (!paper) return;

    const rect = paper.getBoundingClientRect();
    const currentPx = orientation === 'horizontal' ? (e.clientY - rect.top) / zoom : (e.clientX - rect.left) / zoom;
    const currentMm = Number(((currentPx / dpi) * 25.4).toFixed(1));

    setDraggingGuide({ orientation, currentPx, currentMm });

    const handleMove = (moveEv: MouseEvent) => {
      const moveRect = paper.getBoundingClientRect();
      const rawPx = orientation === 'horizontal'
        ? (moveEv.clientY - moveRect.top) / zoom
        : (moveEv.clientX - moveRect.left) / zoom;
      const mmVal = Number(((rawPx / dpi) * 25.4).toFixed(1));

      setDraggingGuide({
        orientation,
        currentPx: Math.round(rawPx),
        currentMm: mmVal,
      });
    };

    const handleUp = (upEv: MouseEvent) => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);

      const moveRect = paper.getBoundingClientRect();
      const finalPx = orientation === 'horizontal'
        ? (upEv.clientY - moveRect.top) / zoom
        : (upEv.clientX - moveRect.left) / zoom;

      const maxPx = orientation === 'horizontal' ? heightPx : widthPx;
      if (finalPx >= 0 && finalPx <= maxPx && canvasManager) {
        canvasManager.addUserGuide(orientation, Math.round(finalPx));
      }

      setDraggingGuide(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // Editable Margin change handler
  const handleApplyMargin = (newMargin: number) => {
    const clamped = Math.max(0, Math.min(newMargin, 50));
    setMarginInput(clamped);

    // 1. Update CanvasManager
    if (canvasManager) {
      canvasManager.updateMargin(clamped);
    }

    // 2. Propagate to parent DocumentSettings state
    if (onUpdateDocumentSettings) {
      onUpdateDocumentSettings({
        margin: clamped,
        safeArea: clamped,
      });
    }
  };

  const userGuides = canvasManager?.getUserGuides?.() || [];

  return (
    <>
      {/* 1. TOP-LEFT CORNER UNIT & MARGIN SETTINGS BUTTON */}
      <div className="absolute top-0 left-0 z-30">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`w-6 h-6 border-r border-b flex items-center justify-center text-[9px] font-bold transition select-none shadow-xs ${
            isSettingsOpen
              ? 'bg-blue-600 border-blue-700 text-white'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:text-blue-600'
          }`}
          title="Click to edit Margin and Ruler Settings"
        >
          <span>mm</span>
        </button>

        {/* Canva-Style Editable Rulers & Margin Popover */}
        {isSettingsOpen && (
          <div
            ref={popoverRef}
            className="absolute top-7 left-0 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <RulerIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Rulers & Margins</h4>
                  <p className="text-[10px] text-slate-400">Canva Print Specifications</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Editable Margin Stepper Control */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Artwork Margin</label>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {marginInput} mm
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Safe inner boundary to protect essential text, logos, and critical artwork.
              </p>

              {/* Interactive Number Stepper */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleApplyMargin(marginInput - 1)}
                  disabled={marginInput <= 0}
                  className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center text-slate-600 transition cursor-pointer"
                  title="Decrease margin by 1mm"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={marginInput}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) handleApplyMargin(val);
                    }}
                    className="w-full text-center py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
                    mm
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyMargin(marginInput + 1)}
                  disabled={marginInput >= 50}
                  className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center text-slate-600 transition cursor-pointer"
                  title="Increase margin by 1mm"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Margin Presets */}
              <div className="grid grid-cols-4 gap-1.5 pt-1.5">
                {[
                  { label: 'None', val: 0 },
                  { label: '2 mm', val: 2 },
                  { label: '3 mm', val: 3 },
                  { label: '5 mm', val: 5 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleApplyMargin(preset.val)}
                    className={`py-1 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${
                      marginInput === preset.val
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Document Print Info */}
            <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 text-[11px] space-y-1.5 mb-3">
              <div className="flex justify-between items-center text-slate-600">
                <span>Bleed Boundary:</span>
                <span className="font-semibold text-slate-800">{dimensions.bleedMm} mm</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Safe Area Zone:</span>
                <span className="font-semibold text-slate-800">{marginInput} mm</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Resolution:</span>
                <span className="font-semibold text-slate-800">{dimensions.dpi} DPI</span>
              </div>
            </div>

            {/* User Guidelines Management */}
            {userGuides.length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium">
                  {userGuides.length} active guideline{userGuides.length > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => canvasManager?.clearUserGuides?.()}
                  className="flex items-center gap-1 text-[10px] font-semibold text-red-600 hover:text-red-700 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Guides
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. TOP HORIZONTAL RULER (Canva Style) */}
      <div
        className="absolute top-0 left-6 h-6 border-b border-slate-200 bg-white cursor-row-resize overflow-hidden select-none z-10"
        style={{ width: `${displayW}px` }}
        onMouseDown={(e) => handleStartGuideDrag('horizontal', e)}
        title="Click and drag down to create a horizontal guideline. Click margin ticks to edit margins."
      >
        <canvas
          ref={topRulerCanvasRef}
          style={{ width: `${displayW}px`, height: '24px' }}
          className="block"
        />
      </div>

      {/* 3. LEFT VERTICAL RULER (Canva Style) */}
      <div
        className="absolute top-6 left-0 w-6 border-r border-slate-200 bg-white cursor-col-resize overflow-hidden select-none z-10"
        style={{ height: `${displayH}px` }}
        onMouseDown={(e) => handleStartGuideDrag('vertical', e)}
        title="Click and drag right to create a vertical guideline. Click margin ticks to edit margins."
      >
        <canvas
          ref={leftRulerCanvasRef}
          style={{ width: '24px', height: `${displayH}px` }}
          className="block"
        />
      </div>

      {/* 4. ACTIVE GUIDE DRAG INDICATOR WITH CANVA TOOLTIP */}
      {draggingGuide && (
        <div
          className="pointer-events-none absolute z-30"
          style={
            draggingGuide.orientation === 'horizontal'
              ? {
                  top: `${24 + draggingGuide.currentPx * zoom}px`,
                  left: '24px',
                  width: `${displayW}px`,
                  height: '1px',
                  borderTop: '1px dashed #2563eb',
                }
              : {
                  top: '24px',
                  left: `${24 + draggingGuide.currentPx * zoom}px`,
                  width: '1px',
                  height: `${displayH}px`,
                  borderLeft: '1px dashed #2563eb',
                }
          }
        >
          <div className="absolute top-1 left-2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-slate-700">
            {draggingGuide.currentMm} mm
          </div>
        </div>
      )}
    </>
  );
};

export default Ruler;
