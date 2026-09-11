'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import NextImage from 'next/image';
import {
  Search,
  UploadCloud,
  RotateCcw,
  Layers,
  Sliders,
  Palette,
  Image as ImageIcon,
  Check,
  Move,
  ZoomIn,
  Sun,
  Maximize2,
  Minimize2,
  StretchHorizontal,
  ArrowLeftRight,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { BackgroundSettings } from '@/types/designer';
import { ColorPicker } from '../controls/ColorPicker';
import {
  GRADIENT_PRESETS,
  GradientPreset,
} from '../data/backgroundsData';
import { DesignAsset, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { formatImageUrl } from '@/utils/imageUrl';

export interface UnifiedBackgroundItem {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  categoryName: string;
  tags?: string[];
  isAdmin: boolean;
  assetType?: string;
}

const BACKGROUND_PAGE_SIZE = 100;

const getAssetFileUrl = (asset: DesignAsset): string =>
  asset.file_url || (asset as DesignAsset & { asset_url?: string }).asset_url || '';

const getAssetThumbnailUrl = (asset: DesignAsset): string =>
  asset.thumbnail_url ||
  (asset as DesignAsset & { asset_thumbnail_url?: string }).asset_thumbnail_url ||
  getAssetFileUrl(asset);

/** Fetch every page of active background assets from the public designer API. */
const fetchAllBackgroundAssets = async (): Promise<DesignAsset[]> => {
  const firstPage = await designAssetService.getPublicAssets({
    asset_type: 'background',
    page: 1,
    per_page: BACKGROUND_PAGE_SIZE,
    sort: 'sort_order',
  });

  const remainingPageNumbers = Array.from(
    { length: Math.max(0, firstPage.last_page - 1) },
    (_, index) => index + 2
  );

  const remainingPages = await Promise.all(
    remainingPageNumbers.map((page) =>
      designAssetService.getPublicAssets({
        asset_type: 'background',
        page,
        per_page: BACKGROUND_PAGE_SIZE,
        sort: 'sort_order',
      })
    )
  );

  return [firstPage, ...remainingPages]
    .flatMap((response) => response.data || [])
    .filter(
      (asset) =>
        asset.asset_type === 'background' &&
        asset.is_active !== false &&
        Boolean(getAssetFileUrl(asset))
    );
};

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
  const [gradientStops, setGradientStops] = useState<Array<{ offset: number; color: string }>>([
    { offset: 0, color: '#f97316' },
    { offset: 1, color: '#ec4899' },
  ]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [unifiedItems, setUnifiedItems] = useState<UnifiedBackgroundItem[]>([]);
  const [bgCategories, setBgCategories] = useState<DesignAssetCategory[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [applyingBackgroundId, setApplyingBackgroundId] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string>('');

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
        if (settings.gradient.stops && settings.gradient.stops.length > 0) {
          setGradientStops(settings.gradient.stops);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [canvasManager]);

  const fetchBackgrounds = useCallback(async () => {
    try {
      setLoadingAssets(true);
      setAssetError('');
      const [assetsRes, catsRes] = await Promise.all([
        fetchAllBackgroundAssets(),
        designAssetService.getPublicCategories('background'),
      ]);

      const adminItems: UnifiedBackgroundItem[] = assetsRes
        .map((asset) => {
          const fullUrl = getAssetFileUrl(asset);
          const thumbUrl = getAssetThumbnailUrl(asset);
          return {
            id: `admin-${asset.id}`,
            name: asset.name,
            url: fullUrl,
            thumbnailUrl: thumbUrl,
            categoryName: asset.category?.name || 'Admin Uploads',
            tags: [asset.name, asset.asset_type, 'admin', 'upload'],
            isAdmin: true,
            assetType: asset.asset_type,
          };
        });

      setUnifiedItems(adminItems);
      setBgCategories(
        (catsRes || []).filter(
          (category) =>
            category.asset_type === 'background' &&
            category.is_active !== false
        )
      );
    } catch (err) {
      console.error('Failed to load backgrounds', err);
      setUnifiedItems([]);
      setBgCategories([]);
      setAssetError('Could not load background images from the admin library.');
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    fetchBackgrounds();
  }, [fetchBackgrounds]);

  // Derived available categories for filter pills
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    set.add('All');

    bgCategories.forEach((c) => {
      if (c.name) set.add(c.name);
    });

    unifiedItems.forEach((i) => {
      if (i.categoryName) {
        set.add(i.categoryName);
      }
    });

    return Array.from(set);
  }, [unifiedItems, bgCategories]);

  // Filter stock backgrounds and admin assets
  const filteredBackgrounds = useMemo(() => {
    return unifiedItems.filter((item) => {
      let matchesCategory = false;
      if (selectedCategory === 'All') {
        matchesCategory = true;
      } else {
        matchesCategory =
          item.categoryName.toLowerCase() === selectedCategory.toLowerCase() ||
          Boolean(item.tags?.some((t) => t.toLowerCase() === selectedCategory.toLowerCase()));
      }

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.categoryName.toLowerCase().includes(query) ||
        Boolean(item.tags?.some((t) => t.toLowerCase().includes(query)));

      return matchesCategory && matchesSearch;
    });
  }, [unifiedItems, selectedCategory, searchQuery]);

  // Action handlers
  const handleSelectColor = (color: string) => {
    if (!canvasManager) return;
    setCustomColor(color);
    canvasManager.setBackgroundColor(color);
  };

  const applyGradient = (
    type: 'linear' | 'radial',
    angle: number,
    stops: Array<{ offset: number; color: string }>
  ) => {
    if (!canvasManager) return;
    setGradientType(type);
    setGradientAngle(angle);
    setGradientStops(stops);
    canvasManager.setBackgroundGradient({
      type,
      angle,
      stops,
    });
  };

  const handleSelectGradient = (preset: GradientPreset) => {
    applyGradient(preset.type, preset.angle, preset.stops);
  };

  const handleUpdateStopColor = (index: number, newColor: string) => {
    const updated = gradientStops.map((stop, i) =>
      i === index ? { ...stop, color: newColor } : stop
    );
    applyGradient(gradientType, gradientAngle, updated);
  };

  const handleSwapGradientColors = () => {
    const updated = [...gradientStops].reverse().map((stop, i) => ({
      ...stop,
      offset: i === 0 ? 0 : i === gradientStops.length - 1 ? 1 : stop.offset,
    }));
    applyGradient(gradientType, gradientAngle, updated);
  };

  const handleAddMiddleStop = () => {
    if (gradientStops.length >= 3) return;
    const midColor = '#3b82f6';
    const updated = [
      gradientStops[0],
      { offset: 0.5, color: midColor },
      gradientStops[gradientStops.length - 1],
    ];
    applyGradient(gradientType, gradientAngle, updated);
  };

  const handleRemoveStop = (index: number) => {
    if (gradientStops.length <= 2) return;
    const updated = gradientStops
      .filter((_, i) => i !== index)
      .map((s, i, arr) => ({
        ...s,
        offset: i === 0 ? 0 : i === arr.length - 1 ? 1 : 0.5,
      }));
    applyGradient(gradientType, gradientAngle, updated);
  };

  const handleCustomGradientAngleChange = (angle: number) => {
    applyGradient(gradientType, angle, gradientStops);
  };

  const handleToggleGradientType = (type: 'linear' | 'radial') => {
    applyGradient(type, gradientAngle, gradientStops);
  };

  const handleSelectImage = async (item: UnifiedBackgroundItem) => {
    if (!canvasManager || applyingBackgroundId) return;
    const targetUrl = formatImageUrl(item.url);
    if (!targetUrl) return;

    try {
      setAssetError('');
      setApplyingBackgroundId(item.id);
      await canvasManager.setBackgroundImage(targetUrl, {
        name: item.name,
        fit: 'cover',
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        opacity: 1.0,
        blur: 0,
      });
      setActiveSubTab('adjust');
    } catch (err) {
      console.error('Failed to apply artwork background:', err);
      setAssetError('Could not apply this image as the artwork background.');
    } finally {
      setApplyingBackgroundId(null);
    }
  };

  const isItemActive = (item: UnifiedBackgroundItem) => {
    if (bgSettings.type !== 'image' || !bgSettings.image) return false;
    const activeUrl = bgSettings.image.url;
    const formattedItemUrl = formatImageUrl(item.url);
    return (
      activeUrl === item.url ||
      activeUrl === formattedItemUrl ||
      bgSettings.image.name === item.name
    );
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
            className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1.5 ${activeSubTab === 'photos'
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
            className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1.5 ${activeSubTab === 'colors'
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
            className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1.5 ${activeSubTab === 'adjust'
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

            {/* Search Input & Refresh Button */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search admin backgrounds..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-100/80 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
              <button
                type="button"
                onClick={fetchBackgrounds}
                title="Refresh backgrounds library"
                disabled={loadingAssets}
                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition shadow-2xs shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAssets ? 'animate-spin text-purple-600' : ''}`} />
              </button>
            </div>

            {assetError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{assetError}</span>
              </div>
            )}

            {/* Category Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
              {availableCategories.map((catName) => (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setSelectedCategory(catName)}
                  className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition shadow-2xs ${selectedCategory === catName
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {catName}
                </button>
              ))}
            </div>

            {/* Count & Status */}
            <div className="flex items-center justify-between text-[11px] text-gray-500 px-0.5">
              <span>{filteredBackgrounds.length} {filteredBackgrounds.length === 1 ? 'background' : 'backgrounds'}</span>
              {unifiedItems.some((i) => i.isAdmin) && (
                <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md">
                  {unifiedItems.filter((i) => i.isAdmin).length} Admin Backgrounds
                </span>
              )}
            </div>

            {/* Background Gallery Grid */}
            {loadingAssets ? (
              <div className="flex flex-col items-center justify-center p-8 text-gray-400 space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                <span className="text-xs font-medium">Loading backgrounds...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {filteredBackgrounds.map((bg) => {
                  const bgUrl = formatImageUrl(bg.thumbnailUrl || bg.url);
                  const active = isItemActive(bg);
                  const isApplying = applyingBackgroundId === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => void handleSelectImage(bg)}
                      disabled={!canvasManager || Boolean(applyingBackgroundId)}
                      className={`group relative rounded-xl border bg-gray-50 overflow-hidden cursor-pointer transition shadow-2xs aspect-[4/3] flex flex-col text-left ${active
                        ? 'border-blue-600 ring-2 ring-blue-500/30'
                        : 'border-gray-200 hover:border-purple-500'
                        } disabled:cursor-wait disabled:opacity-70`}
                    >
                      {bgUrl ? (
                        <NextImage
                          src={bgUrl}
                          alt={bg.name}
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 50vw, 200px"
                          className="object-cover group-hover:scale-105 transition duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}

                      {/* Badge for Admin uploaded assets */}
                      {bg.isAdmin && (
                        <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-purple-600/90 text-white text-[9px] font-bold tracking-wider uppercase shadow-xs backdrop-blur-xs">
                          Admin
                        </div>
                      )}

                      {/* Title overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 z-10">
                        <span className="text-[11px] font-medium text-white line-clamp-1">
                          {bg.name}
                        </span>
                      </div>

                      {/* Selected Checkmark Indicator */}
                      {active && (
                        <div className="absolute top-1.5 right-1.5 z-20 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3" />
                        </div>
                      )}

                      {isApplying && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredBackgrounds.length === 0 && !loadingAssets && (
              <div className="py-8 text-center text-gray-400 space-y-2">
                <ImageIcon className="w-8 h-8 mx-auto text-gray-300" />
                <p className="font-medium text-xs text-gray-500">No backgrounds found</p>
                <p className="text-[10px] text-gray-400">
                  Upload an active Background asset from the admin panel.
                </p>
                {selectedCategory !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('All')}
                    className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
                  >
                    View all backgrounds
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 2: SOLID COLORS & GRADIENTS */}
        {/* ========================================================================= */}
        {activeSubTab === 'colors' && (
          <div className="space-y-4">
            {/* Canva-Style Complete Color Picker */}
            <div className="rounded-2xl overflow-hidden">
              <ColorPicker
                label="Background Colour"
                value={bgSettings.type === 'color' && bgSettings.color ? bgSettings.color : customColor}
                onChange={(color) => handleSelectColor(color)}
                canvasManager={canvasManager}
              />
            </div>

            {/* Custom Editable Gradient Editor */}
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-gray-800 text-[11px]">Custom Gradient Editor</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 uppercase">
                  {gradientType} • {gradientAngle}°
                </span>
              </div>

              {/* Live Gradient Preview Bar */}
              <div
                className="w-full h-10 rounded-lg border border-gray-200 shadow-inner transition-all flex items-center justify-center relative overflow-hidden"
                style={{
                  background:
                    gradientType === 'linear'
                      ? `linear-gradient(${gradientAngle}deg, ${gradientStops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`
                      : `radial-gradient(circle, ${gradientStops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`,
                }}
              >
                <div className="px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-xs text-[10px] font-semibold tracking-wider">
                  Live Preview
                </div>
              </div>

              {/* Linear vs Radial Style Toggle & Swap Button */}
              <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-2 gap-1 bg-gray-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleToggleGradientType('linear')}
                    className={`py-1 text-[11px] font-semibold rounded-md transition ${gradientType === 'linear'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Linear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleGradientType('radial')}
                    className={`py-1 text-[11px] font-semibold rounded-md transition ${gradientType === 'radial'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Radial
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSwapGradientColors}
                  title="Reverse Color Stops"
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-[11px]">Flip</span>
                </button>
              </div>

              {/* Color Stops Input Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Gradient Color Stops
                  </span>
                  {gradientStops.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddMiddleStop}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Middle Color</span>
                    </button>
                  )}
                </div>

                {gradientStops.map((stop, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <span className="text-[10px] font-bold text-gray-400 w-12 shrink-0">
                      {idx === 0
                        ? 'Start'
                        : idx === gradientStops.length - 1
                          ? 'End'
                          : 'Mid'}
                    </span>
                    <input
                      type="color"
                      value={stop.color}
                      onChange={(e) => handleUpdateStopColor(idx, e.target.value)}
                      className="w-7 h-7 rounded-md border border-gray-300 cursor-pointer bg-white p-0.5 shrink-0"
                    />
                    <input
                      type="text"
                      value={stop.color.toUpperCase()}
                      onChange={(e) => handleUpdateStopColor(idx, e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-gray-300 rounded-md font-mono text-xs uppercase text-gray-800 focus:outline-hidden focus:border-blue-500"
                    />
                    {gradientStops.length > 2 && idx === 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(idx)}
                        title="Remove Color Stop"
                        className="p-1 text-gray-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Gradient Angle Slider (Only for Linear) */}
              {gradientType === 'linear' && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                    <span>Gradient Angle</span>
                    <span className="font-bold text-gray-700">{gradientAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={gradientAngle}
                    onChange={(e) => handleCustomGradientAngleChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  {/* Quick Angle Chips */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    {[0, 45, 90, 135, 180, 270].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => handleCustomGradientAngleChange(deg)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition ${gradientAngle === deg
                          ? 'bg-blue-50 border-blue-400 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Gradient Presets */}
            <div className="space-y-2 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700 text-[11px]">Designer Gradient Presets</span>
                <span className="text-[10px] text-gray-400">Click to customize</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {GRADIENT_PRESETS.map((grad) => (
                  <button
                    key={grad.id}
                    type="button"
                    onClick={() => handleSelectGradient(grad)}
                    style={{ background: grad.css }}
                    title={grad.name}
                    className={`h-12 rounded-lg border border-gray-200 relative shadow-xs hover:scale-105 transition ${bgSettings.type === 'gradient' &&
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
                      className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1 ${bgSettings.image?.fit === 'cover'
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
                      className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1 ${bgSettings.image?.fit === 'contain'
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
                      className={`py-1.5 px-2 rounded-md font-semibold text-center transition flex items-center justify-center gap-1 ${bgSettings.image?.fit === 'stretch'
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
