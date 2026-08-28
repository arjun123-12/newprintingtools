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
  Rotate3d,
} from 'lucide-react';
import { DocumentSettings, CanvasDimensions } from '@/types/designer';

interface Artwork3DViewerProps {
  previewUrl: string;
  documentSettings: DocumentSettings;
  dimensions: CanvasDimensions;
  className?: string;
  isCompact?: boolean;
}

export const Artwork3DViewer: React.FC<Artwork3DViewerProps> = ({
  previewUrl,
  documentSettings,
  dimensions,
  className = '',
  isCompact = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Rotation angles in degrees
  const [rotX, setRotX] = useState<number>(isCompact ? 14 : 18);
  const [rotY, setRotY] = useState<number>(isCompact ? -18 : -26);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; startRotX: number; startRotY: number }>({
    x: 0,
    y: 0,
    startRotX: 18,
    startRotY: -26,
  });

  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(!isCompact);
  const [materialFinish, setMaterialFinish] = useState<'matte' | 'glossy'>('glossy');
  const [environmentTheme, setEnvironmentTheme] = useState<'dark' | 'studio' | 'clean'>('dark');

  // Auto-rotate animation frame
  useEffect(() => {
    if (!isAutoRotating || isDragging) return;

    let animId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      setRotY((prev) => (prev + delta * 22) % 360);
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

  // Dimensions & Aspect Ratio Calculation
  const widthMm = documentSettings.width || 85;
  const heightMm = documentSettings.height || 55;
  const aspectRatio = widthMm / heightMm;

  // Base display sizes for responsive 3D card
  const baseCardWidth = isCompact ? 160 : Math.min(420, 340 * (aspectRatio >= 1.0 ? 1.0 : aspectRatio));
  const baseCardHeight = baseCardWidth / aspectRatio;

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
            className="absolute inset-0 bg-white rounded-xs overflow-hidden backface-hidden ring-1 ring-black/10"
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
              className="w-full h-full object-cover select-none pointer-events-none block"
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

          {/* BACK FACE (Realistic Clean Matte Print Backing) */}
          <div
            className="absolute inset-0 bg-[#fbfbfb] rounded-xs overflow-hidden backface-hidden ring-1 ring-black/10 flex flex-col items-center justify-center p-4 text-slate-300"
            style={{
              transform: 'rotateY(180deg) translateZ(1.5px)',
              boxShadow:
                '0 0 0 1px rgba(0,0,0,0.08), -1px 1px 0 #cbd5e1, -2px 2px 0 #94a3b8, 0 20px 45px -10px rgba(0,0,0,0.5)',
            }}
          >
            <div className="border border-slate-200/80 rounded p-3 w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="w-6 h-6 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-400">
                <Rotate3d className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                {documentSettings.name || 'Commercial Print Product'}
              </span>
              <span className="text-[9px] text-slate-400 font-mono">
                {documentSettings.width} × {documentSettings.height} {documentSettings.unit}
              </span>
            </div>

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
            className="absolute inset-0 bg-slate-300 pointer-events-none"
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
          className="absolute bottom-4 inset-x-0 mx-auto w-max max-w-[95%] z-20 flex flex-wrap items-center justify-center gap-2 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-2xl text-xs text-white"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Auto-Rotate Play/Pause */}
          <button
            type="button"
            onClick={() => setIsAutoRotating((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition ${
              isAutoRotating
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title="Auto-Rotate 360°"
          >
            {isAutoRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isAutoRotating ? 'Spinning' : 'Auto Spin'}</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Camera View Angle Presets */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => applyPreset(18, -26)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Isometric 3D View"
            >
              Isometric
            </button>
            <button
              type="button"
              onClick={() => applyPreset(0, 0)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Direct Front 2D/3D View"
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => applyPreset(6, 85)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Side Profile / Thickness"
            >
              Edge
            </button>
            <button
              type="button"
              onClick={() => applyPreset(60, 0)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Top Perspective"
            >
              Top
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Finish Coating: Glossy vs Matte */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700 text-[11px]">
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
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
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
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Reset 3D Orientation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Drag Hint */}
      {!isCompact && (
        <div className="absolute top-4 left-6 pointer-events-none bg-slate-900/60 backdrop-blur-xs border border-slate-800 px-3 py-1 rounded-full text-[11px] text-slate-400 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-purple-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Click and drag to rotate in 360° space</span>
        </div>
      )}
    </div>
  );
};
