'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Type, Plus, Minus, Sparkles, Sliders } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';
import { ColorPicker } from '../controls/ColorPicker';
import { DesignAsset, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { LoadingState, EmptyState } from '@/components/admin/shared';
import { loadCustomFont } from '../utils/fonts';
import { formatImageUrl, getProxiedImageUrl } from '@/utils/imageUrl';

function hexToRgba(hex?: string, opacity: number = 1): string {
  if (!hex) return `rgba(0,0,0,${opacity})`;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
}

function getPresetTextStyle(preset: DesignAsset): React.CSSProperties {
  const config = preset.fabric_json || {};
  const textStyle = preset.metadata?.textStyle || preset.metadata?.textEffectConfig || {};

  // 1. Font Family
  const rawFamily =
    config.fontFamily ||
    textStyle.fontFamily ||
    preset.name ||
    'Inter';
  const cleanFamily = String(rawFamily).replace(/^["']|["']$/g, '').trim();

  // 2. Font Weight & Style
  const fontWeight =
    config.fontWeight ||
    textStyle.fontWeight ||
    'bold';
  const fontStyle =
    config.fontStyle ||
    textStyle.fontStyle ||
    'normal';

  // 3. Spacing & Line Height
  const charSpacing =
    config.charSpacing ??
    textStyle.letterSpacing;
  const letterSpacing =
    typeof charSpacing === 'number' && charSpacing !== 0
      ? `${charSpacing / 10}px`
      : undefined;
  const lineHeight =
    config.lineHeight ??
    textStyle.lineHeight ??
    1.2;

  // 4. Fill & Gradient
  let isGradient = false;
  let gradientCss = '';
  let solidColor = '#111827';

  // Check textStyle.fill
  const fillObj = textStyle.fill;
  if (fillObj) {
    if (fillObj.type === 'gradient' && fillObj.gradient) {
      isGradient = true;
      const g = fillObj.gradient;
      const angle = g.angle ?? 90;
      gradientCss = `linear-gradient(${angle}deg, ${g.color1 || '#f4510b'}, ${g.color2 || '#fbbf24'})`;
    } else if (fillObj.color) {
      solidColor = fillObj.color;
    }
  }

  // Check fabric_json.fill (takes precedence if preset fabric_json has specific colors)
  if (config.fill) {
    if (typeof config.fill === 'object' && config.fill !== null) {
      if (Array.isArray(config.fill.colorStops) && config.fill.colorStops.length > 0) {
        isGradient = true;
        let angle = 90;
        if (config.fill.coords) {
          const { x1 = 0, y1 = 0, x2 = 1, y2 = 0 } = config.fill.coords;
          const dx = x2 - x1;
          const dy = y2 - y1;
          angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);
          if (angle < 0) angle += 360;
        }
        const stops = config.fill.colorStops
          .map((s: any) => `${s.color} ${(s.offset ?? 0) * 100}%`)
          .join(', ');
        gradientCss = `linear-gradient(${angle}deg, ${stops})`;
      }
    } else if (typeof config.fill === 'string') {
      solidColor = config.fill;
      isGradient = false;
    }
  }

  // 5. Stroke
  let strokeCss: string | undefined = undefined;
  if (textStyle.stroke?.enabled && Number(textStyle.stroke.width) > 0) {
    const w = Math.min(Number(textStyle.stroke.width), 4);
    strokeCss = `${w}px ${textStyle.stroke.color || '#000000'}`;
  } else if (config.stroke && Number(config.strokeWidth) > 0) {
    const w = Math.min(Number(config.strokeWidth), 4);
    strokeCss = `${w}px ${config.stroke}`;
  }

  // 6. Shadow
  let shadowCss: string | undefined = undefined;
  if (textStyle.shadow?.enabled) {
    const s = textStyle.shadow;
    const shadowColor = hexToRgba(s.color || '#000000', s.opacity ?? 0.5);
    shadowCss = `${s.offsetX || 0}px ${s.offsetY || 0}px ${s.blur || 0}px ${shadowColor}`;
  } else if (config.shadow && typeof config.shadow === 'object') {
    const s = config.shadow;
    const shadowColor = s.color || 'rgba(0,0,0,0.5)';
    shadowCss = `${s.offsetX || 0}px ${s.offsetY || 0}px ${s.blur || 0}px ${shadowColor}`;
  }

  const baseStyle: React.CSSProperties = {
    fontFamily: `"${cleanFamily}", sans-serif`,
    fontWeight: fontWeight,
    fontStyle: fontStyle,
    letterSpacing: letterSpacing,
    lineHeight: lineHeight,
  };

  if (isGradient && gradientCss) {
    baseStyle.backgroundImage = gradientCss;
    baseStyle.WebkitBackgroundClip = 'text';
    baseStyle.WebkitTextFillColor = 'transparent';
  } else {
    baseStyle.color = solidColor;
  }

  if (strokeCss) {
    baseStyle.WebkitTextStroke = strokeCss;
    (baseStyle as any).paintOrder = 'stroke fill';
  }

  if (shadowCss) {
    baseStyle.textShadow = shadowCss;
  }

  return baseStyle;
}

interface TextPanelProps {
  canvasManager: CanvasManager | null;
  selected?: SelectedObjectState | null;
}

const DEFAULT_TEXT_SIZES_PT = {
  heading: 32,
  subheading: 20,
  body: 11,
} as const;

const getArtworkDpi = (canvasManager: CanvasManager | null): number =>
  Math.max(72, Number(canvasManager?.getDimensions().dpi) || 96);

const pointsToCanvasPixels = (
  points: number,
  canvasManager: CanvasManager | null
): number => (points * getArtworkDpi(canvasManager)) / 72;

const canvasPixelsToPoints = (
  pixels: number,
  canvasManager: CanvasManager | null
): number => (pixels * 72) / getArtworkDpi(canvasManager);

function extractResponseArray<T>(response: any): T[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

export const TextPanel: React.FC<TextPanelProps> = ({ canvasManager, selected }) => {
  const lastTextInsertAtRef = useRef(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const normalizedSelectedType = String(selected?.type || '')
    .toLowerCase()
    .replace(/[-_\s]/g, '');
  const isTextSelected = ['itext', 'textbox', 'text'].includes(
    normalizedSelectedType
  );

  const [presets, setPresets] = useState<DesignAsset[]>([]);
  const [categories, setCategories] = useState<DesignAssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setFontsLoadedTick] = useState(0);

  const artworkWidth = canvasManager?.getDimensions().widthPx || 1063;
  const currentFontSizePt = Math.max(
    1,
    Math.round(
      canvasPixelsToPoints(Number(selected?.fontSize) || 16, canvasManager) * 10
    ) / 10
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [assetsRes, catsRes] = await Promise.all([
          designAssetService.getPublicAssets({ asset_type: 'text', per_page: 50 }),
          designAssetService.getPublicCategories('text')
        ]);
        const nextPresets = extractResponseArray<DesignAsset>(assetsRes);
        const nextCategories = extractResponseArray<DesignAssetCategory>(catsRes)
          .filter(
            (category) =>
              category.asset_type === 'text' && category.is_active
          );

        setPresets(nextPresets);
        setCategories(nextCategories);

        // Preload any custom fonts attached to text presets
        const fontPromises = nextPresets.map(async (p) => {
          const rawFontUrl =
            p.file_url ||
            p.file_path ||
            p.metadata?.fontUrl ||
            p.metadata?.textStyle?.fontUrl ||
            p.metadata?.textEffectConfig?.fontUrl ||
            p.fabric_json?.fontUrl;
          const family =
            p.fabric_json?.fontFamily ||
            p.metadata?.textStyle?.fontFamily ||
            p.metadata?.textEffectConfig?.fontFamily;
          const weight =
            p.fabric_json?.fontWeight ||
            p.metadata?.textStyle?.fontWeight ||
            p.metadata?.textEffectConfig?.fontWeight ||
            'normal';
          const style =
            p.fabric_json?.fontStyle ||
            p.metadata?.textStyle?.fontStyle ||
            'normal';

          if (rawFontUrl && family) {
            await loadCustomFont(family, rawFontUrl, weight, style);
          }
        });
        await Promise.allSettled(fontPromises);
        setFontsLoadedTick((t) => t + 1);
        const fabric = canvasManager?.getCanvas();
        if (fabric) {
          fabric.getObjects().forEach((obj: any) => {
            if (['textbox', 'text', 'itext'].includes(String(obj.type || '').toLowerCase())) {
              obj.set({ dirty: true });
              obj.initDimensions?.();
            }
          });
          fabric.requestRenderAll();
        }
      } catch (err) {
        console.error('Failed to load text presets', err);
        setPresets([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [canvasManager]);

  useEffect(() => {
    if (presets.length === 0) return;
    let isMounted = true;
    const preload = async () => {
      const promises = presets.map(async (p) => {
        const rawFontUrl =
          p.file_url ||
          p.file_path ||
          p.metadata?.fontUrl ||
          p.metadata?.textStyle?.fontUrl ||
          p.metadata?.textEffectConfig?.fontUrl ||
          p.fabric_json?.fontUrl;
        const family =
          p.fabric_json?.fontFamily ||
          p.metadata?.textStyle?.fontFamily ||
          p.metadata?.textEffectConfig?.fontFamily;
        const weight =
          p.fabric_json?.fontWeight ||
          p.metadata?.textStyle?.fontWeight ||
          p.metadata?.textEffectConfig?.fontWeight ||
          'normal';
        const style =
          p.fabric_json?.fontStyle ||
          p.metadata?.textStyle?.fontStyle ||
          'normal';

        if (rawFontUrl && family) {
          await loadCustomFont(family, rawFontUrl, weight, style);
        }
      });
      await Promise.allSettled(promises);
      if (isMounted) {
        setFontsLoadedTick((t) => t + 1);
        const fabric = canvasManager?.getCanvas();
        if (fabric) {
          fabric.getObjects().forEach((obj: any) => {
            if (['textbox', 'text', 'itext'].includes(String(obj.type || '').toLowerCase())) {
              obj.set({ dirty: true });
              obj.initDimensions?.();
            }
          });
          fabric.requestRenderAll();
        }
      }
    };
    void preload();
    return () => {
      isMounted = false;
    };
  }, [presets, canvasManager]);

  const addTextOnce = (options: Parameters<CanvasManager['addText']>[0]) => {
    if (!canvasManager) return;

    const now = Date.now();
    if (now - lastTextInsertAtRef.current < 350) return;
    lastTextInsertAtRef.current = now;

    void canvasManager.addText(options);
  };

  const handleAddHeading = () => {
    addTextOnce({
      text: 'Add a heading',
      fontSizePt: DEFAULT_TEXT_SIZES_PT.heading,
      fontWeight: 'bold',
      fontFamily: 'Inter, sans-serif',
      fill: '#0f172a',
      width: Math.max(180, artworkWidth * 0.72),
    });
  };

  const handleAddSubheading = () => {
    addTextOnce({
      text: 'Add a subheading',
      fontSizePt: DEFAULT_TEXT_SIZES_PT.subheading,
      fontWeight: '600',
      fontFamily: 'Inter, sans-serif',
      fill: '#334155',
      width: Math.max(160, artworkWidth * 0.62),
    });
  };

  const handleAddBody = () => {
    addTextOnce({
      text: 'Add body text. Double-click to edit content directly on canvas.',
      fontSizePt: DEFAULT_TEXT_SIZES_PT.body,
      fontWeight: 'normal',
      fontFamily: 'Inter, sans-serif',
      fill: '#475569',
      width: Math.max(150, artworkWidth * 0.55),
    });
  };

  const handleAddPreset = (asset: DesignAsset) => {
    const config = asset.fabric_json || {};
    const textStyle = asset.metadata?.textStyle || asset.metadata?.textEffectConfig || {};
    const configuredPoints = Number(
      config.fontSizePt || asset.metadata?.fontSizePt || textStyle.fontSize || 0
    );
    const configuredWidth = Number(config.width) || Math.max(180, artworkWidth * 0.65);
    const rawFontUrl =
      asset.file_url ||
      asset.file_path ||
      asset.metadata?.fontUrl ||
      textStyle.fontUrl ||
      config.fontUrl;
    const fontUrl = rawFontUrl
      ? (getProxiedImageUrl(rawFontUrl) || formatImageUrl(rawFontUrl))
      : undefined;

    const family = config.fontFamily || textStyle.fontFamily || 'Inter';
    if (fontUrl && family) {
      void loadCustomFont(
        family,
        fontUrl,
        config.fontWeight || textStyle.fontWeight || 'normal',
        config.fontStyle || textStyle.fontStyle || 'normal'
      );
    }

    addTextOnce({
      ...config,
      text: config.text || textStyle.defaultText || asset.name,
      fontFamily: config.fontFamily || textStyle.fontFamily || 'Inter',
      fontWeight: config.fontWeight || textStyle.fontWeight || 'normal',
      fontStyle: config.fontStyle || textStyle.fontStyle || 'normal',
      width: configuredWidth,
      fontSizePt: configuredPoints > 0 ? configuredPoints : undefined,
      textAlign: config.textAlign || textStyle.textAlign || 'center',
      fill: config.fill || textStyle.fill?.color || '#0f172a',
      stroke: config.stroke || (textStyle.stroke?.enabled ? textStyle.stroke.color : undefined),
      strokeWidth: config.strokeWidth ?? (textStyle.stroke?.enabled ? textStyle.stroke.width : undefined),
      shadow: config.shadow || (textStyle.shadow?.enabled ? {
        color: textStyle.shadow.color,
        offsetX: textStyle.shadow.offsetX,
        offsetY: textStyle.shadow.offsetY,
        blur: textStyle.shadow.blur,
      } : undefined),
      charSpacing: config.charSpacing ?? textStyle.letterSpacing,
      lineHeight: config.lineHeight ?? textStyle.lineHeight,
      fontUrl,
      assetId: asset.id,
      provider: asset.provider || 'admin',
      sourceType: 'asset',
      editable: true,
      locked: false,
    } as any);
  };

  const filteredPresets =
    selectedCategoryId === 'all'
      ? presets
      : presets.filter(
        (preset) =>
          preset.category_id === selectedCategoryId ||
          preset.category?.id === selectedCategoryId
      );

  const currentStrokeWidth = selected?.strokeWidth || 0;
  const currentStrokeColor = selected?.stroke || '#000000';

  const handleUpdateProperty = (prop: keyof SelectedObjectState, val: any) => {
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty(prop, val);
  };

  const handleFontSizePtChange = (points: number) => {
    if (!canvasManager) return;
    const safePoints = Math.max(1, Math.min(500, points || 1));
    handleUpdateProperty(
      'fontSize',
      pointsToCanvasPixels(safePoints, canvasManager)
    );
  };

  return (
    <div className="p-4 space-y-5 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
            <Type className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Text Library
          </h3>
        </div>
      </div>

      {/* ACTIVE SELECTED TEXT QUICK CONTROLS */}
      {/* {isTextSelected && (
        <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-3 shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-purple-900 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              <span>Text Controls</span>
            </span>
            <span className="text-[10px] font-bold text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
              Active Element
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-purple-900 block">Edit Text</label>
            <input
              type="text"
              value={selected?.text || ''}
              onChange={(e) => handleUpdateProperty('text', e.target.value)}
              placeholder="Type your text..."
              className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-purple-900">
                Font Size
              </label>
              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-500">
                Points (pt)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleFontSizePtChange(currentFontSizePt - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-200 bg-white text-purple-700 transition hover:bg-purple-100"
                title="Decrease font size"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  value={currentFontSizePt}
                  onChange={(event) =>
                    handleFontSizePtChange(Number(event.target.value))
                  }
                  className="h-8 w-full rounded-lg border border-purple-200 bg-white px-2 pr-8 text-center text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-purple-400"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
                  pt
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleFontSizePtChange(currentFontSizePt + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-200 bg-white text-purple-700 transition hover:bg-purple-100"
                title="Increase font size"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-1">
              {[8, 10, 12, 14, 18, 24, 32, 48].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleFontSizePtChange(size)}
                  className={`flex-1 rounded-md border py-1 text-[9px] font-bold transition ${Math.round(currentFontSizePt) === size
                    ? 'border-purple-600 bg-purple-600 text-white'
                    : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-100'
                    }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-purple-200/60">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-purple-900">Border / Outline</label>
              <button
                type="button"
                onClick={() => handleUpdateProperty('strokeWidth', currentStrokeWidth > 0 ? 0 : 3)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition ${currentStrokeWidth > 0 ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-purple-200 text-purple-700 hover:bg-purple-100'
                  }`}
              >
                {currentStrokeWidth > 0 ? 'Border ON' : '+ Add Border'}
              </button>
            </div>
            {currentStrokeWidth > 0 && (
              <div className="space-y-2.5 bg-white p-2.5 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-semibold text-gray-700">Border Color</span>
                  <button
                    type="button"
                    onClick={() => setShowStrokePicker(!showStrokePicker)}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition shadow-2xs"
                  >
                    <div
                      className="w-4 h-4 rounded-lg border border-gray-300 shadow-2xs"
                      style={{ backgroundColor: currentStrokeColor }}
                    />
                    <span className="text-[10px] font-mono font-bold uppercase text-gray-700">
                      {currentStrokeColor}
                    </span>
                  </button>
                </div>
                {showStrokePicker && (
                  <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    <ColorPicker
                      label="Border Colour"
                      value={currentStrokeColor}
                      onChange={(hex) => {
                        if (typeof hex === 'string') {
                          handleUpdateProperty('stroke', hex);
                        } else if (canvasManager) {
                          canvasManager.setSelectedGradient(hex, true);
                        }
                      }}
                      onClose={() => setShowStrokePicker(false)}
                      canvasManager={canvasManager}
                      embedded={true}
                      allowGradient={true}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )} */}

      {/* Quick Add Cards */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Default Text Styles</span>
        <button onClick={handleAddHeading} className="w-full text-left p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-purple-50 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xl font-extrabold text-gray-900 group-hover:text-purple-700">Add a heading</span>
            <span className="text-[10px] font-bold text-gray-400">32 pt</span>
            <Plus className="w-4 h-4 text-gray-400" />
          </div>
        </button>
        <button onClick={handleAddSubheading} className="w-full text-left p-3 rounded-xl border border-gray-200 bg-white hover:bg-purple-50 transition group">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 group-hover:text-purple-700">Add a subheading</span>
            <span className="text-[10px] font-bold text-gray-400">20 pt</span>
            <Plus className="w-4 h-4 text-gray-400" />
          </div>
        </button>
        <button onClick={handleAddBody} className="w-full text-left p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-purple-50 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 group-hover:text-purple-700">Add body text</span>
            <span className="text-[10px] font-bold text-gray-400">11 pt</span>
            <Plus className="w-4 h-4 text-gray-400" />
          </div>
        </button>
      </div>

      {/* Presets */}
      <div className="space-y-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Library Presets</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition whitespace-nowrap ${selectedCategoryId === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition whitespace-nowrap ${selectedCategoryId === cat.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {loading ? (
            <LoadingState message="Loading presets..." />
          ) : filteredPresets.length === 0 ? (
            <EmptyState title="No Presets" />
          ) : (
            filteredPresets.map((preset) => {
              const previewStyle = getPresetTextStyle(preset);
              const previewText =
                preset.fabric_json?.text ||
                preset.metadata?.textStyle?.defaultText ||
                preset.metadata?.textEffectConfig?.defaultText ||
                preset.name ||
                'Sample Text';
              const fontName =
                preset.fabric_json?.fontFamily ||
                preset.metadata?.textStyle?.fontFamily ||
                preset.metadata?.textEffectConfig?.fontFamily ||
                preset.name;

              return (
                <button
                  key={preset.id}
                  onClick={() => handleAddPreset(preset)}
                  className="w-full text-left p-3.5 rounded-2xl border border-gray-200 bg-white hover:bg-purple-50/70 hover:border-purple-300 transition shadow-2xs flex flex-col gap-1 relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-600 bg-purple-100/80 px-2 py-0.5 rounded-md w-fit">
                      {preset.category?.name || 'Standard Text Presets'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold truncate max-w-[130px]">
                      {fontName}
                    </span>
                  </div>
                  <span
                    className="text-lg transition-colors truncate mt-0.5 block select-none"
                    style={previewStyle}
                  >
                    {previewText}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
