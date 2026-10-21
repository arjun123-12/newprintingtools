'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RotateCcw,
  Play,
  Pause,
  Sun,
  Eye,
  Layers,
  Sparkles,
  Compass,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { DocumentSettings, CanvasDimensions } from '@/types/designer';

interface Artwork3DViewerProps {
  previewUrl: string;
  backPreviewUrl?: string | null;
  documentSettings: DocumentSettings;
  dimensions: CanvasDimensions;
  className?: string;
  isCompact?: boolean;
  autoRotateInitially?: boolean;
  activeSide?: 'front' | 'back';
}

export const Artwork3DViewer: React.FC<Artwork3DViewerProps> = ({
  previewUrl,
  backPreviewUrl,
  documentSettings,
  dimensions,
  className = '',
  isCompact = false,
  autoRotateInitially,
  activeSide,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Rotation angles in degrees
  const [rotX, setRotX] = useState<number>(isCompact ? 10 : 14);
  const [rotY, setRotY] = useState<number>(isCompact ? -12 : -15);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; startRotX: number; startRotY: number }>({
    x: 0,
    y: 0,
    startRotX: 14,
    startRotY: -15,
  });

  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(
    autoRotateInitially ?? !isCompact
  );
  const [materialFinish, setMaterialFinish] = useState<'matte' | 'glossy'>('glossy');
  const [environmentTheme, setEnvironmentTheme] = useState<'dark' | 'studio' | 'clean'>('dark');

  // Sync orientation when activeSide is provided externally (e.g. customer clicking Front/Back toggle)
  useEffect(() => {
    if (!activeSide) return;
    if (activeSide === 'back') {
      setIsAutoRotating(false);
      setRotX(0);
      setRotY(180);
    } else if (activeSide === 'front') {
      setIsAutoRotating(false);
      setRotX(isCompact ? 10 : 14);
      setRotY(isCompact ? -12 : -15);
    }
  }, [activeSide, isCompact]);

  // Gentle front-facing auto-rotate oscillation to prevent the front artwork from disappearing
  useEffect(() => {
    if (!isAutoRotating || isDragging) return;

    let animId: number;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      // Oscillate smoothly within -20° to +20° so the front artwork remains in clear view while showcasing 3D depth
      const angle = Math.sin(elapsed * 1.2) * 20;
      setRotY(angle);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isAutoRotating, isDragging]);

  // Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setIsAutoRotating(false);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startRotX: rotX,
      startRotY: rotY,
    });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    const sensitivity = 0.45;
    const nextRotX = Math.max(-75, Math.min(75, dragStart.startRotX - deltaY * sensitivity));
    const nextRotY = dragStart.startRotY + deltaX * sensitivity;

    setRotX(nextRotX);
    setRotY(nextRotY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // Preset Camera Angles
  const applyPreset = (x: number, y: number) => {
    setIsAutoRotating(false);
    setRotX(x);
    setRotY(y);
  };

  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 640);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Read intrinsic dimensions of the artwork image to preserve exact orientation and aspect ratio
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [backNaturalDimensions, setBackNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!previewUrl) {
      setNaturalDimensions(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setNaturalDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      }
    };
    img.src = previewUrl;
    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    }
  }, [previewUrl]);

  useEffect(() => {
    if (!backPreviewUrl) {
      setBackNaturalDimensions(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setBackNaturalDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      }
    };
    img.src = backPreviewUrl;
    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setBackNaturalDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    }
  }, [backPreviewUrl]);

  // Dimensions & Aspect Ratio Calculation:
  // Priority: intrinsic image width & height (front or back active), then documentSettings, then dimensions
  const activeNatural = (activeSide === 'back' && backNaturalDimensions)
    ? backNaturalDimensions
    : (naturalDimensions || backNaturalDimensions);

  const intrinsicRatio = activeNatural && activeNatural.width > 0 && activeNatural.height > 0
    ? activeNatural.width / activeNatural.height
    : null;

  const widthMm = documentSettings?.width ? Number(documentSettings.width) : 0;
  const heightMm = documentSettings?.height ? Number(documentSettings.height) : 0;
  const settingsRatio = widthMm > 0 && heightMm > 0 ? widthMm / heightMm : null;
  const dimensionsRatio = dimensions?.widthPx && dimensions?.heightPx
    ? Number(dimensions.widthPx) / Number(dimensions.heightPx)
    : null;

  // Preserve true orientation: landscape (> 1.0) or portrait (< 1.0)
  const aspectRatio = intrinsicRatio || settingsRatio || dimensionsRatio || 1.54;

  // Base display sizes for responsive 3D card
  const maxAvailableWidth = isCompact ? 240 : isMobile ? 310 : 640;
  const maxAvailableHeight = isCompact ? 180 : isMobile ? 210 : 410;

  let baseCardWidth: number;
  let baseCardHeight: number;

  if (isCompact) {
    if (aspectRatio >= 1.0) {
      baseCardWidth = Math.min(240, 180 * aspectRatio);
      baseCardHeight = baseCardWidth / aspectRatio;
    } else {
      baseCardHeight = Math.min(180, 240 / aspectRatio);
      baseCardWidth = baseCardHeight * aspectRatio;
    }
  } else if (aspectRatio >= 1.0) {
    baseCardWidth = Math.min(maxAvailableWidth, maxAvailableHeight * aspectRatio);
    baseCardHeight = baseCardWidth / aspectRatio;
  } else {
    baseCardHeight = Math.min(maxAvailableHeight, maxAvailableWidth / aspectRatio);
    baseCardWidth = baseCardHeight * aspectRatio;
  }

  // Dynamic Specular Glare Gradient based on rotation angle
  const glareAngle = (rotY + 45) % 360;
  const glareOpacity =
    materialFinish === 'glossy'
      ? Math.max(0.08, Math.min(0.45, Math.abs(Math.sin((rotY * Math.PI) / 180)) * 0.55))
      : 0.05;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center w-full h-full select-none overflow-hidden ${className} ${
        environmentTheme === 'studio'
          ? 'bg-radial from-slate-800 via-slate-900 to-slate-950'
          : environmentTheme === 'clean'
          ? 'bg-radial from-slate-100 via-slate-200 to-slate-300'
          : 'bg-radial from-slate-900 via-slate-950 to-black'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      {/* 3D Scene Viewport */}
      <div
        className="relative flex items-center justify-center w-full h-full"
        style={{
          perspective: isCompact ? '700px' : '1200px',
        }}
      >
        {/* 3D Transform Object with Paper Edge Thickness & Shadow */}
        <div
          className="relative transition-transform duration-75 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `scale(${zoom}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
            width: `${baseCardWidth}px`,
            height: `${baseCardHeight}px`,
          }}
        >
          {/* Ambient Realistic Ground Drop Shadow */}
          <div
            className="absolute inset-x-0 bottom-[-24px] h-[36px] bg-black/45 rounded-full filter blur-xl pointer-events-none transition-all duration-150"
            style={{
              transform: `rotateX(90deg) translateZ(-40px) scale(${1 + Math.abs(rotX) * 0.006})`,
              opacity: Math.max(0.2, 0.65 - Math.abs(rotX) * 0.005),
            }}
          />

          {/* FRONT FACE (Printed Artwork) */}
          <div
            className="absolute inset-0 bg-transparent rounded-none overflow-hidden backface-hidden ring-1 ring-black/10"
            style={{
              transform: 'translateZ(1.5px)',
              boxShadow:
                '0 0 0 1px rgba(0,0,0,0.08), 1px 1px 0 #cbd5e1, 2px 2px 0 #94a3b8, 0 20px 45px -10px rgba(0,0,0,0.5)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="3D Front Artwork"
              className="w-full h-full object-fill select-none pointer-events-none block rounded-none"
            />

            {/* Dynamic Specular Light Glare */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-150"
              style={{
                background: `linear-gradient(${glareAngle}deg, transparent 20%, rgba(255,255,255,${glareOpacity}) 50%, transparent 80%)`,
                mixBlendMode: 'overlay',
              }}
            />

            {/* Fine Paper Surface Texture */}
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 0)',
                backgroundSize: '4px 4px',
              }}
            />
          </div>

          {/* BACK FACE (Printed Artwork or Clean Backing) */}
          <div
            className="absolute inset-0 bg-[#fbfbfb] rounded-none overflow-hidden backface-hidden ring-1 ring-black/10 flex flex-col items-center justify-center"
            style={{
              transform: 'rotateY(180deg) translateZ(1.5px)',
              boxShadow:
                '0 0 0 1px rgba(0,0,0,0.08), -1px 1px 0 #cbd5e1, -2px 2px 0 #94a3b8, 0 20px 45px -10px rgba(0,0,0,0.5)',
            }}
          >
            {backPreviewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={backPreviewUrl}
                alt="3D Back Artwork"
                className="w-full h-full object-fill select-none pointer-events-none block rounded-none"
              />
            ) : (
              <div className="w-full h-full bg-[#fcfcfc]" />
            )}

            {/* Dynamic Back Specular Glare */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(${(glareAngle + 180) % 360}deg, transparent 20%, rgba(255,255,255,${glareOpacity * 0.7}) 50%, transparent 80%)`,
                mixBlendMode: 'overlay',
              }}
            />
          </div>

          {/* 3D Extruded Edge Layers (Paper Core Thickness) */}
          <div
            className="absolute inset-0 bg-slate-300 pointer-events-none rounded-none"
            style={{
              transform: 'translateZ(0px)',
              boxShadow: '0 0 0 1px #cbd5e1',
            }}
          />
        </div>
      </div>

      {/* Floating Interactive Controls Bar (Full Mode Only) */}
      {!isCompact && (
        <div
          className="absolute bottom-2 sm:bottom-4 inset-x-0 mx-auto w-max max-w-[95%] z-20 flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-2 rounded-xl sm:rounded-2xl shadow-2xl text-xs text-white"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Auto-Rotate Play/Pause */}
          <button
            type="button"
            onClick={() => setIsAutoRotating((prev) => !prev)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-semibold text-[11px] sm:text-xs transition ${
              isAutoRotating
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title="Auto-Rotate 360°"
          >
            {isAutoRotating ? <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
            <span>{isAutoRotating ? 'Spinning' : 'Auto Spin'}</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Camera View Angle Presets */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-800/80 p-0.5 rounded-lg sm:rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => applyPreset(18, -26)}
              className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Isometric 3D View"
            >
              Isometric
            </button>
            <button
              type="button"
              onClick={() => applyPreset(0, 0)}
              className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Direct Front 2D/3D View"
            >
              Front
            </button>
            {backPreviewUrl && (
              <button
                type="button"
                onClick={() => applyPreset(0, 180)}
                className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-medium text-purple-300 hover:text-purple-200 hover:bg-slate-700 transition"
                title="Direct Back 2D/3D View"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => applyPreset(6, 85)}
              className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Side Profile / Thickness"
            >
              Edge
            </button>
            <button
              type="button"
              onClick={() => applyPreset(60, 0)}
              className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Top Perspective"
            >
              Top
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Finish Coating: Glossy vs Matte */}
          <div className="hidden sm:flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700 text-[11px]">
            <button
              type="button"
              onClick={() => setMaterialFinish('glossy')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                materialFinish === 'glossy'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Gloss Lamination Sheen"
            >
              <Sparkles className="w-3 h-3" />
              <span>Gloss</span>
            </button>
            <button
              type="button"
              onClick={() => setMaterialFinish('matte')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                materialFinish === 'matte'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Matte Finish"
            >
              <Sun className="w-3 h-3" />
              <span>Matte</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Zoom In / Out / Reset */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
              className="hidden sm:inline-flex p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="hidden sm:inline-flex p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setRotX(18);
                setRotY(-26);
                setZoom(1.0);
              }}
              className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Reset 3D Orientation"
            >
              <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Drag Hint */}
      {!isCompact && (
        <div className="hidden sm:flex absolute top-4 left-6 pointer-events-none bg-slate-900/60 backdrop-blur-xs border border-slate-800 px-3 py-1 rounded-full text-[11px] text-slate-400 items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-purple-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Click and drag to rotate in 360° space</span>
        </div>
      )}
    </div>
  );
};
