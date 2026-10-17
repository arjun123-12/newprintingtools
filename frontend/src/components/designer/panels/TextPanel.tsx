'use client';

import React, { useState, useEffect } from 'react';
import { Type, Sparkles } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';
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

function extractResponseArray<T>(response: any): T[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

export const TextPanel: React.FC<TextPanelProps> = ({ canvasManager, selected }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const normalizedSelectedType = String(selected?.type || '')
    .toLowerCase()
    .replace(/[-_\s]/g, '');
  const isTextSelected = Boolean(
    selected &&
    !selected.isMultiple &&
    (['itext', 'textbox', 'text'].includes(normalizedSelectedType) || selected.text !== undefined)
  );

  const [presets, setPresets] = useState<DesignAsset[]>([]);
  const [categories, setCategories] = useState<DesignAssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setFontsLoadedTick] = useState(0);

  const cleanFontName = (family: string = '') => {
    return family.split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
  };

  const isCurrentFont = (fontFamilyName?: string) => {
    if (!fontFamilyName || !selected?.fontFamily) return false;
    const currentClean = cleanFontName(selected.fontFamily).toLowerCase();
    const targetClean = cleanFontName(fontFamilyName).toLowerCase();
    return currentClean === targetClean;
  };

  const getActiveTextObject = () => {
    if (!canvasManager) return null;
    const canvas = canvasManager.getCanvas?.() || (canvasManager as any).canvas;
    const active = canvas?.getActiveObject?.();
    if (active && canvasManager.isTextObject(active)) {
      return active;
    }
    return null;
  };

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
          )
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        setPresets(nextPresets);
        setCategories(nextCategories);
      } catch (err) {
        console.error('Failed to load text presets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Preload custom fonts
  useEffect(() => {
    let isMounted = true;
    const preload = async () => {
      const promises = presets.map(async (preset) => {
        const config = preset.fabric_json || {};
        const textStyle =
          preset.metadata?.textStyle || preset.metadata?.textEffectConfig || {};
        const rawFontUrl =
          preset.file_url ||
          preset.file_path ||
          preset.metadata?.fontUrl ||
          textStyle.fontUrl ||
          config.fontUrl;
        const family =
          config.fontFamily ||
          textStyle.fontFamily ||
          preset.metadata?.fontFamily ||
          preset.name;
        const weight =
          config.fontWeight ||
          textStyle.fontWeight ||
          preset.metadata?.fontWeight ||
          'normal';
        const style =
          config.fontStyle ||
          textStyle.fontStyle ||
          preset.metadata?.fontStyle ||
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

  const handleApplyFont = async (
    targetFamily: string,
    fontUrl?: string,
    weight?: string,
    style?: string
  ) => {
    // If no text object is selected, do not modify or create anything.
    const activeText = getActiveTextObject();
    if (!activeText || !canvasManager) {
      return;
    }

    const cleanFamily = cleanFontName(targetFamily || 'Inter');

    if (fontUrl && cleanFamily) {
      try {
        await loadCustomFont(
          cleanFamily,
          fontUrl,
          weight || 'normal',
          style || 'normal'
        );
      } catch (err) {
        console.warn('Could not load custom font:', err);
      }
    }

    // Apply font to the currently selected text object in place.
    // Preserves content, position, size, scale, rotation, color, alignment, etc.
    canvasManager.updateSelectedProperty('fontFamily', cleanFamily);
  };

  const handleSelectPreset = (asset: DesignAsset) => {
    // If no text object is selected, do not modify or create anything.
    if (!isTextSelected || !getActiveTextObject()) {
      return;
    }

    const config = asset.fabric_json || {};
    const textStyle = asset.metadata?.textStyle || asset.metadata?.textEffectConfig || {};
    const rawFontUrl =
      asset.file_url ||
      asset.file_path ||
      asset.metadata?.fontUrl ||
      textStyle.fontUrl ||
      config.fontUrl;
    const fontUrl = rawFontUrl
      ? (getProxiedImageUrl(rawFontUrl) || formatImageUrl(rawFontUrl))
      : undefined;

    const rawFamily =
      config.fontFamily ||
      textStyle.fontFamily ||
      asset.metadata?.fontFamily ||
      asset.name ||
      'Inter';

    void handleApplyFont(
      rawFamily,
      fontUrl,
      config.fontWeight || textStyle.fontWeight || 'normal',
      config.fontStyle || textStyle.fontStyle || 'normal'
    );
  };

  const handleSelectDefaultFont = (
    family: string = 'Inter',
    textKind: 'heading' | 'subheading' | 'body' = 'heading'
  ) => {
    if (!canvasManager) {
      return;
    }

    const activeText = getActiveTextObject();
    if (isTextSelected && activeText) {
      void handleApplyFont(family);
      return;
    }

    // Text panel styles should also work as insert actions when nothing is selected.
    const styles = {
      heading: { text: 'Add a heading', fontSizePt: 32, fontWeight: 'bold', name: 'Heading' },
      subheading: { text: 'Add a subheading', fontSizePt: 24, fontWeight: 'semibold', name: 'Subheading' },
      body: { text: 'Add body text', fontSizePt: 16, fontWeight: 'normal', name: 'Body Text' },
    };
    const style = styles[textKind];

    void canvasManager.addText({
      ...style,
      fontFamily: family,
      fill: '#111827',
      textAlign: 'center',
    });
  };

  const filteredPresets =
    selectedCategoryId === 'all'
      ? presets
      : presets.filter(
        (preset) =>
          preset.category_id === selectedCategoryId ||
          preset.category?.id === selectedCategoryId
      );

  return (
    <div className="p-4 space-y-5 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
            <Type className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Text & Font Library
          </h3>
        </div>
      </div>

      {/* Selection Status Banner */}
      {isTextSelected ? (
        <div className="bg-purple-50/90 border border-purple-200/80 rounded-xl px-3 py-2 text-xs flex items-center justify-between text-purple-900 shadow-2xs">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">
              Selected Font: <span className="font-bold text-purple-950">{cleanFontName(selected?.fontFamily)}</span>
            </span>
          </div>
          <span className="text-[10px] text-purple-600 font-bold shrink-0 uppercase tracking-wide">
            Click font to apply
          </span>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
          <span>Click a style or font below to add new text to the canvas.</span>
        </div>
      )}

      {/* Default Text Styles */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Default Text Styles
          </span>
          {isTextSelected && (
            <span className="text-[10px] text-purple-600 font-semibold">
              Click to apply
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleSelectDefaultFont('Inter', 'heading')}
          className={`w-full text-left p-3.5 rounded-xl border transition group ${isCurrentFont('Inter') && isTextSelected
            ? 'border-purple-500 bg-purple-50/70 shadow-2xs ring-1 ring-purple-400'
            : isTextSelected
              ? 'border-gray-200 bg-white hover:bg-purple-50/50 hover:border-purple-200 cursor-pointer'
              : 'border-gray-200/60 bg-gray-50/50 text-gray-400 cursor-not-allowed opacity-60'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xl font-extrabold text-gray-900 group-hover:text-purple-700">Heading Style</span>
            <span className="text-[10px] font-bold text-gray-400">Inter</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => handleSelectDefaultFont('Inter', 'subheading')}
          className={`w-full text-left p-3 rounded-xl border transition group ${isCurrentFont('Inter') && isTextSelected
            ? 'border-purple-500 bg-purple-50/70 shadow-2xs ring-1 ring-purple-400'
            : isTextSelected
              ? 'border-gray-200 bg-white hover:bg-purple-50/50 hover:border-purple-200 cursor-pointer'
              : 'border-gray-200/60 bg-gray-50/50 text-gray-400 cursor-not-allowed opacity-60'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 group-hover:text-purple-700">Subheading Style</span>
            <span className="text-[10px] font-bold text-gray-400">Inter</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => handleSelectDefaultFont('Inter', 'body')}
          className={`w-full text-left p-2.5 rounded-xl border transition group ${isCurrentFont('Inter') && isTextSelected
            ? 'border-purple-500 bg-purple-50/70 shadow-2xs ring-1 ring-purple-400'
            : isTextSelected
              ? 'border-gray-200 bg-white hover:bg-purple-50/50 hover:border-purple-200 cursor-pointer'
              : 'border-gray-200/60 bg-gray-50/50 text-gray-400 cursor-not-allowed opacity-60'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 group-hover:text-purple-700">Body Text Style</span>
            <span className="text-[10px] font-bold text-gray-400">Inter</span>
          </div>
        </button>
      </div>

      {/* Library Presets */}
      <div className="space-y-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Library Presets</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition whitespace-nowrap ${selectedCategoryId === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
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
              const isSelectedFont = isCurrentFont(fontName);

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    if (isTextSelected && getActiveTextObject()) {
                      handleSelectPreset(preset);
                      return;
                    }

                    if (!canvasManager) return;
                    const config = preset.fabric_json || {};
                    const textStyle = preset.metadata?.textStyle || preset.metadata?.textEffectConfig || {};
                    const rawFamily =
                      config.fontFamily ||
                      textStyle.fontFamily ||
                      preset.metadata?.fontFamily ||
                      preset.name ||
                      'Inter';
                    const previewText =
                      config.text ||
                      textStyle.defaultText ||
                      preset.name ||
                      'Add your text';

                    void canvasManager.addText({
                      text: previewText,
                      fontFamily: rawFamily,
                      fontSize: Number(config.fontSize || textStyle.fontSize) || 36,
                      fontWeight: config.fontWeight || textStyle.fontWeight || 'normal',
                      fontStyle: config.fontStyle || textStyle.fontStyle || 'normal',
                      fill: typeof config.fill === 'string'
                        ? config.fill
                        : textStyle.fill?.color || '#111827',
                      textAlign: config.textAlign || 'center',
                      name: preset.name || 'Text',
                    });
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition shadow-2xs flex flex-col gap-1 relative overflow-hidden group ${isSelectedFont && isTextSelected
                    ? 'border-purple-500 bg-purple-50/80 shadow-xs ring-2 ring-purple-400/30'
                    : isTextSelected
                      ? 'border-gray-200 bg-white hover:bg-purple-50/70 hover:border-purple-300 cursor-pointer'
                      : 'border-gray-200/60 bg-gray-50/50 text-gray-400 cursor-not-allowed opacity-60'
                    }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-600 bg-purple-100/80 px-2 py-0.5 rounded-md w-fit">
                      {preset.category?.name || 'Standard Text Presets'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isSelectedFont && isTextSelected && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500 font-semibold truncate max-w-[120px]">
                        {fontName}
                      </span>
                    </div>
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
