'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CanvasDimensions } from '@/types/designer';
import { CanvasManager } from './CanvasManager';

interface RulerProps {
  zoom: number;
  dimensions: CanvasDimensions;
  canvasManager: CanvasManager | null;
  paperRef: React.RefObject<HTMLDivElement>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const Ruler: React.FC<RulerProps> = ({
  zoom,
  dimensions,
  canvasManager,
  paperRef,
  containerRef,
}) => {
  const topRulerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bottomRulerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftRulerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightRulerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cursorPos, setCursorPos] = useState<{ xMm: number; yMm: number } | null>(null);
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

  // Pixels per mm at display zoom level
  const pxPerMm = (dpi / 25.4) * zoom;
  const displayW = Math.round(widthPx * zoom);
  const displayH = Math.round(heightPx * zoom);
  const rulerThickness = 24;

  // 1. Draw Top Horizontal Ruler
  const drawTopRuler = useCallback(() => {
    const canvas = topRulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayW * dpr;
    canvas.height = rulerThickness * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, displayW, rulerThickness);

    // Bottom border separating ruler from paper
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerThickness - 0.5);
    ctx.lineTo(displayW, rulerThickness - 0.5);
    ctx.stroke();

    let stepMm = 10;
    if (pxPerMm < 2) stepMm = 50;
    else if (pxPerMm < 4) stepMm = 20;
    else if (pxPerMm > 15) stepMm = 5;

    ctx.fillStyle = '#64748b';
    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';

    for (let mm = 0; mm <= widthMm; mm++) {
      const x = Math.round(mm * pxPerMm);
      if (x > displayW) break;

      const isMajor = mm % stepMm === 0;
      const isMedium = mm % (stepMm / 2) === 0;

      ctx.beginPath();
      if (isMajor) {
        ctx.strokeStyle = '#475569';
        ctx.moveTo(x + 0.5, rulerThickness - 12);
        ctx.lineTo(x + 0.5, rulerThickness);
        ctx.stroke();
        ctx.fillText(`${mm}`, x, 9);
      } else if (isMedium) {
        ctx.strokeStyle = '#94a3b8';
        ctx.moveTo(x + 0.5, rulerThickness - 7);
        ctx.lineTo(x + 0.5, rulerThickness);
        ctx.stroke();
      } else if (pxPerMm > 3) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.moveTo(x + 0.5, rulerThickness - 4);
        ctx.lineTo(x + 0.5, rulerThickness);
        ctx.stroke();
      }
    }

    // Cursor indicator
    if (cursorPos) {
      const curX = Math.round(cursorPos.xMm * pxPerMm);
      if (curX >= 0 && curX <= displayW) {
        ctx.strokeStyle = '#0284c7';
        ctx.fillStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curX + 0.5, 0);
        ctx.lineTo(curX + 0.5, rulerThickness);
        ctx.stroke();
      }
    }
  }, [displayW, widthMm, pxPerMm, cursorPos]);

  // 2. Draw Bottom Horizontal Ruler
  const drawBottomRuler = useCallback(() => {
    const canvas = bottomRulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayW * dpr;
    canvas.height = rulerThickness * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, displayW, rulerThickness);

    // Top border separating ruler from paper
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(displayW, 0.5);
    ctx.stroke();

    let stepMm = 10;
    if (pxPerMm < 2) stepMm = 50;
    else if (pxPerMm < 4) stepMm = 20;
    else if (pxPerMm > 15) stepMm = 5;

    ctx.fillStyle = '#64748b';
    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';

    for (let mm = 0; mm <= widthMm; mm++) {
      const x = Math.round(mm * pxPerMm);
      if (x > displayW) break;

      const isMajor = mm % stepMm === 0;
      const isMedium = mm % (stepMm / 2) === 0;

      ctx.beginPath();
      if (isMajor) {
        ctx.strokeStyle = '#475569';
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, 12);
        ctx.stroke();
        ctx.fillText(`${mm}`, x, 20);
      } else if (isMedium) {
        ctx.strokeStyle = '#94a3b8';
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, 7);
        ctx.stroke();
      } else if (pxPerMm > 3) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, 4);
        ctx.stroke();
      }
    }

    // Cursor indicator
    if (cursorPos) {
      const curX = Math.round(cursorPos.xMm * pxPerMm);
      if (curX >= 0 && curX <= displayW) {
        ctx.strokeStyle = '#0284c7';
        ctx.fillStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curX + 0.5, 0);
        ctx.lineTo(curX + 0.5, rulerThickness);
        ctx.stroke();
      }
    }
  }, [displayW, widthMm, pxPerMm, cursorPos]);

  // 3. Draw Left Vertical Ruler
  const drawLeftRuler = useCallback(() => {
    const canvas = leftRulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rulerThickness * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, rulerThickness, displayH);

    // Right border separating ruler from paper
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerThickness - 0.5, 0);
    ctx.lineTo(rulerThickness - 0.5, displayH);
    ctx.stroke();

    let stepMm = 10;
    if (pxPerMm < 2) stepMm = 50;
    else if (pxPerMm < 4) stepMm = 20;
    else if (pxPerMm > 15) stepMm = 5;

    ctx.fillStyle = '#64748b';
    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';

    for (let mm = 0; mm <= heightMm; mm++) {
      const y = Math.round(mm * pxPerMm);
      if (y > displayH) break;

      const isMajor = mm % stepMm === 0;
      const isMedium = mm % (stepMm / 2) === 0;

      ctx.beginPath();
      if (isMajor) {
        ctx.strokeStyle = '#475569';
        ctx.moveTo(rulerThickness - 12, y + 0.5);
        ctx.lineTo(rulerThickness, y + 0.5);
        ctx.stroke();

        ctx.save();
        ctx.translate(10, y + 3);
        ctx.fillText(`${mm}`, 0, 0);
        ctx.restore();
      } else if (isMedium) {
        ctx.strokeStyle = '#94a3b8';
        ctx.moveTo(rulerThickness - 7, y + 0.5);
        ctx.lineTo(rulerThickness, y + 0.5);
        ctx.stroke();
      } else if (pxPerMm > 3) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.moveTo(rulerThickness - 4, y + 0.5);
        ctx.lineTo(rulerThickness, y + 0.5);
        ctx.stroke();
      }
    }

    // Cursor indicator
    if (cursorPos) {
      const curY = Math.round(cursorPos.yMm * pxPerMm);
      if (curY >= 0 && curY <= displayH) {
        ctx.strokeStyle = '#0284c7';
        ctx.fillStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, curY + 0.5);
        ctx.lineTo(rulerThickness, curY + 0.5);
        ctx.stroke();
      }
    }
  }, [displayH, heightMm, pxPerMm, cursorPos]);

  // 4. Draw Right Vertical Ruler
  const drawRightRuler = useCallback(() => {
    const canvas = rightRulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rulerThickness * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, rulerThickness, displayH);

    // Left border separating ruler from paper
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, displayH);
    ctx.stroke();

    let stepMm = 10;
    if (pxPerMm < 2) stepMm = 50;
    else if (pxPerMm < 4) stepMm = 20;
    else if (pxPerMm > 15) stepMm = 5;

    ctx.fillStyle = '#64748b';
    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';

    for (let mm = 0; mm <= heightMm; mm++) {
      const y = Math.round(mm * pxPerMm);
      if (y > displayH) break;

      const isMajor = mm % stepMm === 0;
      const isMedium = mm % (stepMm / 2) === 0;

      ctx.beginPath();
      if (isMajor) {
        ctx.strokeStyle = '#475569';
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(12, y + 0.5);
        ctx.stroke();

        ctx.save();
        ctx.translate(14, y + 3);
        ctx.fillText(`${mm}`, 0, 0);
        ctx.restore();
      } else if (isMedium) {
        ctx.strokeStyle = '#94a3b8';
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(7, y + 0.5);
        ctx.stroke();
      } else if (pxPerMm > 3) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(4, y + 0.5);
        ctx.stroke();
      }
    }

    // Cursor indicator
    if (cursorPos) {
      const curY = Math.round(cursorPos.yMm * pxPerMm);
      if (curY >= 0 && curY <= displayH) {
        ctx.strokeStyle = '#0284c7';
        ctx.fillStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, curY + 0.5);
        ctx.lineTo(rulerThickness, curY + 0.5);
        ctx.stroke();
      }
    }
  }, [displayH, heightMm, pxPerMm, cursorPos]);

  useEffect(() => {
    drawTopRuler();
    drawBottomRuler();
    drawLeftRuler();
    drawRightRuler();
  }, [drawTopRuler, drawBottomRuler, drawLeftRuler, drawRightRuler]);

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

  // Handle Guide Dragging from any of the 4 Rulers
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

  return (
    <>
      {/* 1. TOP-LEFT CORNER UNIT BOX */}
      <div
        className="absolute top-0 left-0 w-6 h-6 bg-slate-100 border-r border-b border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-500 select-none z-20 shadow-xs"
        title="Artwork Rulers (Millimeters)"
      >
        mm
      </div>

      {/* 2. TOP HORIZONTAL RULER */}
      <div
        className="absolute top-0 left-6 h-6 border-b border-slate-300 bg-slate-50 cursor-row-resize overflow-hidden select-none z-10"
        style={{ width: `${displayW}px` }}
        onMouseDown={(e) => handleStartGuideDrag('horizontal', e)}
        title="Click and drag down to create a horizontal guideline"
      >
        <canvas
          ref={topRulerCanvasRef}
          style={{ width: `${displayW}px`, height: '24px' }}
          className="block"
        />
      </div>

      {/* 3. TOP-RIGHT CORNER BOX */}
      <div
        className="absolute top-0 w-6 h-6 bg-slate-100 border-l border-b border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-500 select-none z-20 shadow-xs"
        style={{ left: `${24 + displayW}px` }}
        title="Artwork Rulers (Millimeters)"
      >
        mm
      </div>

      {/* 4. LEFT VERTICAL RULER */}
      <div
        className="absolute top-6 left-0 w-6 border-r border-slate-300 bg-slate-50 cursor-col-resize overflow-hidden select-none z-10"
        style={{ height: `${displayH}px` }}
        onMouseDown={(e) => handleStartGuideDrag('vertical', e)}
        title="Click and drag right to create a vertical guideline"
      >
        <canvas
          ref={leftRulerCanvasRef}
          style={{ width: '24px', height: `${displayH}px` }}
          className="block"
        />
      </div>

      {/* 5. RIGHT VERTICAL RULER */}
      <div
        className="absolute top-6 w-6 border-l border-slate-300 bg-slate-50 cursor-col-resize overflow-hidden select-none z-10"
        style={{ left: `${24 + displayW}px`, height: `${displayH}px` }}
        onMouseDown={(e) => handleStartGuideDrag('vertical', e)}
        title="Click and drag left to create a vertical guideline"
      >
        <canvas
          ref={rightRulerCanvasRef}
          style={{ width: '24px', height: `${displayH}px` }}
          className="block"
        />
      </div>

      {/* 6. BOTTOM-LEFT CORNER BOX */}
      <div
        className="absolute left-0 w-6 h-6 bg-slate-100 border-r border-t border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-500 select-none z-20 shadow-xs"
        style={{ top: `${24 + displayH}px` }}
        title="Artwork Rulers (Millimeters)"
      >
        mm
      </div>

      {/* 7. BOTTOM HORIZONTAL RULER */}
      <div
        className="absolute left-6 h-6 border-t border-slate-300 bg-slate-50 cursor-row-resize overflow-hidden select-none z-10"
        style={{ top: `${24 + displayH}px`, width: `${displayW}px` }}
        onMouseDown={(e) => handleStartGuideDrag('horizontal', e)}
        title="Click and drag up to create a horizontal guideline"
      >
        <canvas
          ref={bottomRulerCanvasRef}
          style={{ width: `${displayW}px`, height: '24px' }}
          className="block"
        />
      </div>

      {/* 8. BOTTOM-RIGHT CORNER BOX */}
      <div
        className="absolute w-6 h-6 bg-slate-100 border-l border-t border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-500 select-none z-20 shadow-xs"
        style={{ top: `${24 + displayH}px`, left: `${24 + displayW}px` }}
        title="Artwork Rulers (Millimeters)"
      >
        mm
      </div>

      {/* Active Guide Drag Indicator */}
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
                  borderTop: '1px dashed #06b6d4',
                }
              : {
                  top: '24px',
                  left: `${24 + draggingGuide.currentPx * zoom}px`,
                  width: '1px',
                  height: `${displayH}px`,
                  borderLeft: '1px dashed #06b6d4',
                }
          }
        >
          <div className="absolute top-1 left-2 bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
            {draggingGuide.currentMm} mm
          </div>
        </div>
      )}
    </>
  );
};

export default Ruler;
