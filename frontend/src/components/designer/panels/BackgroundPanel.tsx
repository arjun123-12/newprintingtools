'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  UploadCloud,
  RotateCcw,
  Layers,
  Sliders,
  Sparkles,
  Palette,
  Image as ImageIcon,
  Check,
  Move,
  ZoomIn,
  Sun,
  Maximize2,
  Minimize2,
  StretchHorizontal,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { BackgroundSettings } from '@/types/designer';
import {
  BACKGROUND_CATEGORIES,
  SOLID_COLOR_PALETTES,
  GRADIENT_PRESETS,
  STOCK_BACKGROUND_IMAGES,
  BackgroundImageItem,
  GradientPreset,
} from '../data/backgroundsData';

interface BackgroundPanelProps {
  canvasManager: CanvasManager | null;
}

export const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ canvasManager }) => {
  const [activeSubTab, setActiveSubTab] = useState<'photos' | 'colors' | 'adjust'>('photos');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bgSettings, setBgSettings] = useState<BackgroundSettings>({
    type: 'color',
    color: '#ffffff',
  });
  const [customColor, setCustomColor] = useState<string>('#ffffff');
  const [gradientAngle, setGradientAngle] = useState<number>(135);
  const [gradientType, setGradientType] = useState<'linear' | 'radial'>('linear');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync with CanvasManager background state
  useEffect(() => {
    if (!canvasManager) return;
    setBgSettings(canvasManager.getBackgroundSettings());

    const unsubscribe = canvasManager.onBackgroundChange((settings) => {
      setBgSettings(settings);
      if (settings.type === 'color' && settings.color) {
        setCustomColor(settings.color);
      }
      if (settings.type === 'gradient' && settings.gradient) {
        setGradientAngle(settings.gradient.angle);
        setGradientType(settings.gradient.type);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [canvasManager]);

  // Filter stock backgrounds
  const filteredBackgrounds = STOCK_BACKGROUND_IMAGES.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Action handlers
  const handleSelectColor = (color: string) => {
    if (!canvasManager) return;
    setCustomColor(color);
    canvasManager.setBackgroundColor(color);
  };

  const handleSelectGradient = (preset: GradientPreset) => {
    if (!canvasManager) return;
    setGradientAngle(preset.angle);
    setGradientType(preset.type);
    canvasManager.setBackgroundGradient({
      type: preset.type,
      angle: preset.angle,
      stops: preset.stops,
    });
  };

  const handleCustomGradientAngleChange = (angle: number) => {
    if (!canvasManager) return;
    setGradientAngle(angle);
    if (bgSettings.type === 'gradient' && bgSettings.gradient) {
      canvasManager.setBackgroundGradient({
        ...bgSettings.gradient,
        angle,
      });
    }
  };

  const handleSelectImage = async (item: BackgroundImageItem) => {
    if (!canvasManager) return;
    await canvasManager.setBackgroundImage(item.url, {
      name: item.title,
      fit: 'cover',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      opacity: 1.0,
      blur: 0,
    });
    setActiveSubTab('adjust');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasManager) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const url = event.target?.result as string;
        if (url) {
          await canvasManager.setBackgroundImage(url, {
            name: file.name,
            fit: 'cover',
            scale: 1.0,
            offsetX: 0,
            offsetY: 0,
            opacity: 1.0,
            blur: 0,
          });
          setActiveSubTab('adjust');
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error reading background file:', err);
      setIsUploading(false);
    }
  };

  const handleImageFitChange = (fit: 'cover' | 'contain' | 'stretch') => {
    if (!canvasManager || !bgSettings.image) return;
    canvasManager.updateBackground({
      image: {
        ...bgSettings.image,
        fit,
      },
    });
  };

  const handleImageScaleChange = (scale: number) => {
    if (!canvasManager || !bgSettings.image) return;
    canvasManager.updateBackground({
      image: {
        ...bgSettings.image,
        scale,
      },
    });
  };

  const handleImageOffsetChange = (axis: 'offsetX' | 'offsetY', val: number) => {
    if (!canvasManager || !bgSettings.image) return;
    canvasManager.updateBackground({
      image: {
        ...bgSettings.image,
        [axis]: val,
      },
    });
  };

  const handleImageOpacityChange = (opacity: number) => {
    if (!canvasManager || !bgSettings.image) return;
    canvasManager.updateBackground({
      image: {
        ...bgSettings.image,
        opacity,
      },
    });
  };

  const handleReset = () => {
    if (!canvasManager) return;
    canvasManager.resetBackground();
  };

  const handleConvertToLayer = () => {
    if (!canvasManager) return;
    canvasManager.convertBackgroundToLayer();
  };

  return (
    <div className="flex flex-col h-full select-none text-xs text-gray-700 bg-white">
      {/* Top Segmented Sub-Nav */}
      <div className="p-3 border-b border-gray-200 bg-gray-50/70">
        <div className="grid grid-cols-3 gap-1 bg-gray-200/70 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveSubTab('photos')}
            className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1.5 ${
              activeSubTab === 'photos'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Textures</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('colors')}
            className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1.5 ${
              activeSubTab === 'colors'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Colors</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('adjust')}
            className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1.5 ${
              activeSubTab === 'adjust'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Adjust</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
        {/* ========================================================================= */}
        {/* SUBTAB 1: PHOTOS, TEXTURES, & PATTERNS */}
        {/* ========================================================================= */}
        {activeSubTab === 'photos' && (
          <div className="space-y-3">
            {/* Custom Upload Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-2.5 px-3 rounded-lg border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 text-blue-600 font-semibold flex items-center justify-center gap-2 transition"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isUploading ? 'Uploading Image...' : 'Upload Custom Background'}</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search marble, wood, texture..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-100/80 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
              {BACKGROUND_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Background Gallery Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {filteredBackgrounds.map((bg) => (
                <div
                  key={bg.id}
                  onClick={() => handleSelectImage(bg)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', bg.url);
                  }}
                  className="group relative h-28 rounded-lg overflow-hidden border border-gray-200 cursor-pointer shadow-xs hover:shadow-md hover:border-blue-500 transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bg.thumbnail}
                    alt={bg.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span className="text-[11px] font-medium text-white line-clamp-1">
                      {bg.title}
                    </span>
                  </div>
                  {bgSettings.type === 'image' && bgSettings.image?.url === bg.url && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredBackgrounds.length === 0 && (
              <div className="py-8 text-center text-gray-400 space-y-1">
                <ImageIcon className="w-8 h-8 mx-auto text-gray-300" />
                <p>No backgrounds found for &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 2: SOLID COLORS & GRADIENTS */}
        {/* ========================================================================= */}
        {activeSubTab === 'colors' && (
          <div className="space-y-4">
            {/* Custom Color Picker Card */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <label className="font-semibold text-gray-700 block text-[11px]">
                Custom Color Picker
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  className="w-8 h-8 rounded-md border border-gray-300 cursor-pointer bg-white p-0.5"
                />
                <input
                  type="text"
                  value={customColor.toUpperCase()}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded-md font-mono text-xs uppercase"
                />
              </div>
            </div>

            {/* Curated Solid Color Palettes */}
            {SOLID_COLOR_PALETTES.map((palette) => (
              <div key={palette.name} className="space-y-1.5">
                <span className="font-semibold text-gray-600 text-[11px]">{palette.name}</span>
                <div className="grid grid-cols-9 gap-1.5">
                  {palette.colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleSelectColor(c)}
                      style={{ backgroundColor: c }}
                      title={c}
                      className={`h-6 rounded-md border transition relative ${
                        bgSettings.type === 'color' && bgSettings.color?.toLowerCase() === c.toLowerCase()
                          ? 'border-blue-600 ring-2 ring-blue-500/40 shadow-xs'
                          : 'border-gray-200 hover:scale-110'
                      }`}
                    >
                      {bgSettings.type === 'color' && bgSettings.color?.toLowerCase() === c.toLowerCase() && (
                        <Check
                          className={`w-3 h-3 absolute inset-0 m-auto ${
                            c.toLowerCase() === '#ffffff' || c.toLowerCase() === '#f8fafc'
                              ? 'text-gray-900'
                              : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Gradient Presets */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700 text-[11px]">Designer Gradients</span>
                <span className="text-[10px] text-gray-400">{gradientAngle}° Angle</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {GRADIENT_PRESETS.map((grad) => (
                  <button
                    key={grad.id}
                    type="button"
                    onClick={() => handleSelectGradient(grad)}
                    style={{ background: grad.css }}
                    title={grad.name}
                    className={`h-12 rounded-lg border border-gray-200 relative shadow-xs hover:scale-105 transition ${
                      bgSettings.type === 'gradient' &&
                      bgSettings.gradient?.stops[0]?.color === grad.stops[0]?.color
                        ? 'ring-2 ring-blue-500 border-blue-600 shadow-md'
                        : ''
                    }`}
                  >
                    {bgSettings.type === 'gradient' &&
                      bgSettings.gradient?.stops[0]?.color === grad.stops[0]?.color && (
                        <Check className="w-3.5 h-3.5 absolute inset-0 m-auto text-white drop-shadow-md" />
                      )}
                  </button>
                ))}
              </div>

              {/* Gradient Angle Slider */}
              <div className="pt-2 space-y-1">
                <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                  <span>Gradient Direction Angle</span>
                  <span>{gradientAngle}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={gradientAngle}
                  onChange={(e) => handleCustomGradientAngleChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 3: ADJUST & BACKGROUND CONTROLS */}
        {/* ========================================================================= */}
        {activeSubTab === 'adjust' && (
          <div className="space-y-4">
            {/* Active Background Status Card */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Active Background</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                  {bgSettings.type}
                </span>
              </div>

              {bgSettings.type === 'image' && bgSettings.image && (
                <div className="flex items-center gap-2 pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bgSettings.image.url}
                    alt="Current Background"
                    className="w-12 h-12 object-cover rounded-md border border-gray-300"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 line-clamp-1">
                      {bgSettings.image.name || 'Background Image'}
                    </p>
                    <p className="text-[10px] text-gray-400">Locked to bottom layer</p>
                  </div>
                </div>
              )}

              {bgSettings.type === 'color' && (
                <div className="flex items-center gap-2 pt-1">
                  <div
                    style={{ backgroundColor: bgSettings.color || '#ffffff' }}
                    className="w-8 h-8 rounded-md border border-gray-300 shadow-xs"
                  />
                  <span className="font-mono text-gray-800 uppercase font-semibold">
                    {bgSettings.color || '#ffffff'}
                  </span>
                </div>
              )}
            </div>

            {/* Image Fit Controls (Only visible for images) */}
            {bgSettings.type === 'image' && (
              <>
                <div className="space-y-2">
                  <label className="font-semibold text-gray-700 block">Fit & Scaling</label>
                  <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => handleImageFitChange('cover')}
                      className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1 ${
                        bgSettings.image?.fit === 'cover'
                          ? 'bg-white text-blue-600 shadow-xs font-bold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Cover</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleImageFitChange('contain')}
                      className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1 ${
                        bgSettings.image?.fit === 'contain'
                          ? 'bg-white text-blue-600 shadow-xs font-bold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Contain</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleImageFitChange('stretch')}
                      className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1 ${
                        bgSettings.image?.fit === 'stretch'
                          ? 'bg-white text-blue-600 shadow-xs font-bold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <StretchHorizontal className="w-3.5 h-3.5" />
                      <span>Stretch</span>
                    </button>
                  </div>
                </div>

                {/* Scale Zoom Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-gray-600">
                    <span className="flex items-center gap-1">
                      <ZoomIn className="w-3.5 h-3.5" /> Scale / Zoom
                    </span>
                    <span>{Math.round((bgSettings.image?.scale || 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.05"
                    value={bgSettings.image?.scale || 1.0}
                    onChange={(e) => handleImageScaleChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Position Offset X & Y */}
                <div className="space-y-3 pt-1">
                  <span className="font-semibold text-gray-700 block flex items-center gap-1">
                    <Move className="w-3.5 h-3.5" /> Reposition Offset
                  </span>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                      <span>Horizontal Offset (X)</span>
                      <span>{bgSettings.image?.offsetX || 0} px</span>
                    </div>
                    <input
                      type="range"
                      min="-300"
                      max="300"
                      step="5"
                      value={bgSettings.image?.offsetX || 0}
                      onChange={(e) => handleImageOffsetChange('offsetX', Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                      <span>Vertical Offset (Y)</span>
                      <span>{bgSettings.image?.offsetY || 0} px</span>
                    </div>
                    <input
                      type="range"
                      min="-300"
                      max="300"
                      step="5"
                      value={bgSettings.image?.offsetY || 0}
                      onChange={(e) => handleImageOffsetChange('offsetY', Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>

                {/* Opacity Slider */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-medium text-gray-600">
                    <span className="flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5" /> Background Opacity
                    </span>
                    <span>{Math.round((bgSettings.image?.opacity ?? 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgSettings.image?.opacity ?? 1.0}
                    onChange={(e) => handleImageOpacityChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Convert to Regular Layer Button */}
                <div className="pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleConvertToLayer}
                    className="w-full py-2 px-3 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium flex items-center justify-center gap-2 transition"
                  >
                    <Layers className="w-4 h-4 text-gray-500" />
                    <span>Convert to Movable Layer</span>
                  </button>
                </div>
              </>
            )}

            {/* Reset Background Button */}
            <div className="pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2 px-3 rounded-lg border border-red-200 bg-red-50/40 hover:bg-red-50 text-red-600 font-semibold flex items-center justify-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset to Plain White</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackgroundPanel;
