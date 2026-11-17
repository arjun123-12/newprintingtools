'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Type, Sparkles, Loader2, Search, SlidersHorizontal, ChevronRight, Check, Crown } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';
import { DesignAsset, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { LoadingState, EmptyState } from '@/components/admin/shared';
import { POPULAR_FONTS, loadCustomFont, loadFont } from '../utils/fonts';
import type { FontFamilyItem } from '../utils/fonts';
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

const TEXT_PRESETS_PAGE_SIZE = 30;

export const TextPanel: React.FC<TextPanelProps> = ({ canvasManager, selected }) => {
  const [activeTab, setActiveTab] = useState<'font' | 'styles'>('font');
  const [fontSearch, setFontSearch] = useState('');
  const [showFontFilters, setShowFontFilters] = useState(false);
  const [fontCategory, setFontCategory] = useState<string>('all');
  const [visibleFontCount, setVisibleFontCount] = useState(30);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [newTextColor, setNewTextColor] = useState('#111827');
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
  const [presetPage, setPresetPage] = useState(1);
  const [hasMorePresets, setHasMorePresets] = useState(false);
  const [loadingMorePresets, setLoadingMorePresets] = useState(false);
  const [, setFontsLoadedTick] = useState(0);

  const cleanFontName = (family: string = '') => {
    return family.split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
  };

  const uploadedFontRows = useMemo(() => presets.flatMap((asset) => {
    const config = asset.fabric_json || {};
    const textStyle = asset.metadata?.textStyle || asset.metadata?.textEffectConfig || {};
    const rawFamily = config.fontFamily || textStyle.fontFamily || asset.metadata?.fontFamily || '';
    const rawUrl = asset.file_url || asset.file_path || asset.metadata?.fontUrl || textStyle.fontUrl || config.fontUrl || '';
    if (!rawFamily || !rawUrl) return [];
    return [{
      id: `uploaded-${asset.id}`,
      name: cleanFontName(String(rawFamily)),
      family: String(rawFamily),
      category: 'custom' as const,
      fontUrl: getProxiedImageUrl(String(rawUrl)) || formatImageUrl(String(rawUrl)),
    }];
  }), [presets]);

  const filteredBrowseFonts = useMemo(() => {
    const query = fontSearch.trim().toLowerCase();
    const builtIn = POPULAR_FONTS.filter((font) => fontCategory === 'all' || font.category === fontCategory)
      .filter((font) => !query || font.name.toLowerCase().includes(query) || font.category.includes(query));
    const uploaded = uploadedFontRows.filter((font) =>
      (!query || font.name.toLowerCase().includes(query)) &&
      (fontCategory === 'all' || fontCategory === 'custom')
    );
    return { uploaded, builtIn };
  }, [fontSearch, fontCategory, uploadedFontRows]);

  useEffect(() => setVisibleFontCount(30), [fontSearch, fontCategory]);

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
        const [firstAssetsPage, catsRes] = await Promise.all([
          designAssetService.getPublicAssets({ asset_type: 'text', per_page: TEXT_PRESETS_PAGE_SIZE, page: 1 }),
          designAssetService.getPublicCategories('text'),
        ]);
        const nextPresets = extractResponseArray<DesignAsset>(firstAssetsPage);
        const lastPage = Math.max(1, Number((firstAssetsPage as any)?.last_page) || 1);
        const nextCategories = extractResponseArray<DesignAssetCategory>(catsRes)
          .filter(
            (category) =>
              category.asset_type === 'text' && category.is_active
          )
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        setPresets(nextPresets);
        setPresetPage(1);
        setHasMorePresets(lastPage > 1);
        setCategories(nextCategories);
      } catch (err) {
        console.error('Failed to load text presets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLoadMorePresets = async () => {
    if (loadingMorePresets || !hasMorePresets) return;
    const nextPage = presetPage + 1;
    try {
      setLoadingMorePresets(true);
      const response = await designAssetService.getPublicAssets({
        asset_type: 'text',
        per_page: TEXT_PRESETS_PAGE_SIZE,
        page: nextPage,
      });
      const nextPresets = extractResponseArray<DesignAsset>(response);
      setPresets((current) => {
        const existingIds = new Set(current.map((preset) => preset.id));
        return [...current, ...nextPresets.filter((preset) => !existingIds.has(preset.id))];
      });
      setPresetPage(nextPage);
      setHasMorePresets(nextPage < Math.max(1, Number((response as any)?.last_page) || 1));
    } catch (err) {
      console.error('Failed to load more text presets:', err);
    } finally {
      setLoadingMorePresets(false);
    }
  };

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

  const handleBrowseFont = async (font: FontFamilyItem, fontUrl?: string) => {
    if (fontUrl) {
      await loadCustomFont(font.name, fontUrl);
    } else {
      await loadFont(font);
    }

    const activeText = getActiveTextObject();
    if (isTextSelected && activeText && canvasManager) {
      canvasManager.updateSelectedProperty('fontFamily', font.name);
      return;
    }

    if (canvasManager) {
      void canvasManager.addText({
        text: 'Add a heading',
        fontFamily: font.name,
        fontSizePt: 32,
        fontWeight: 'bold',
        fill: newTextColor,
        textAlign: 'center',
        name: 'Heading',
      });
    }
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
    const styles = {
      heading: { text: 'Add a heading', fontSizePt: 32, fontWeight: 'bold', name: 'Heading' },
      subheading: { text: 'Add a subheading', fontSizePt: 24, fontWeight: 600, name: 'Subheading' },
      body: { text: 'Add body text', fontSizePt: 16, fontWeight: 'normal', name: 'Body Text' },
    };
    const style = styles[textKind];
    if (isTextSelected && activeText) {
      const dpi = Math.max(72, Number(canvasManager.getDimensions().dpi) || 96);
      canvasManager.updateSelectedProperty('fontFamily', family);
      canvasManager.updateSelectedProperty('fontSize', Math.round((style.fontSizePt * dpi) / 72));
      canvasManager.updateSelectedProperty('fontWeight', style.fontWeight);
      return;
    }

    void canvasManager.addText({
      ...style,
      fontFamily: family,
      fill: newTextColor,
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
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex border-b border-gray-200 bg-white px-4">
        <button type="button" onClick={() => setActiveTab('font')} className={`flex-1 border-b-2 py-3 text-sm font-semibold transition ${activeTab === 'font' ? 'border-purple-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Font</button>
        <button type="button" onClick={() => setActiveTab('styles')} className={`flex-1 border-b-2 py-3 text-sm font-semibold transition ${activeTab === 'styles' ? 'border-purple-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Text styles</button>
      </div>

      {activeTab === 'font' ? (
        <div className="space-y-4">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-500" />
            <input value={fontSearch} onChange={(event) => setFontSearch(event.target.value)} placeholder="Try ‘Calligraphy’ or ‘Open Sans’" className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-11 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
            <button type="button" onClick={() => setShowFontFilters((current) => !current)} title="Filter fonts" aria-label="Filter fonts" className={`absolute right-2 rounded-lg p-2 ${showFontFilters ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}><SlidersHorizontal className="h-4 w-4" /></button>
          </div>

          {showFontFilters && <div className="flex flex-wrap gap-1.5">
            {[
              ['all', 'All'], ['sans-serif', 'Sans'], ['serif', 'Serif'],
              ['display', 'Display'], ['handwriting', 'Handwriting'], ['custom', 'Uploaded'],
            ].map(([key, label]) => <button key={key} type="button" onClick={() => setFontCategory(key)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${fontCategory === key ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>)}
          </div>}

          {isTextSelected && <div className="truncate rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">Selected font: <strong className="text-gray-900">{cleanFontName(selected?.fontFamily)}</strong></div>}

          {fontCategory === 'all' || fontCategory === 'custom' ? <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-700"><Type className="h-4 w-4" /></span>
              <span className="flex-1 text-sm font-bold text-gray-800">Brand Kit</span>
              <Crown className="h-4 w-4 text-gray-400" />
            </div>
            {filteredBrowseFonts.uploaded.length ? <div className="p-1.5">
              {filteredBrowseFonts.uploaded.map((font) => {
                const current = cleanFontName(selected?.fontFamily).toLowerCase() === font.name.toLowerCase();
                return <button key={font.id} type="button" onClick={() => void handleBrowseFont({ id: font.id, name: font.name, family: font.family, category: 'custom', source: 'custom' }, font.fontUrl)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition ${current ? 'bg-purple-100 text-gray-900' : 'text-gray-800 hover:bg-gray-50'}`}><ChevronRight className="h-3.5 w-3.5 text-gray-500" /><span className="flex-1 truncate text-sm" style={{ fontFamily: font.family }}>{font.name}</span>{current && <Check className="h-4 w-4 text-purple-700" />}</button>;
              })}
            </div> : <p className="px-4 py-5 text-center text-xs text-gray-500">No brand fonts set for this Brand Kit.</p>}
          </section> : null}

          {fontCategory !== 'custom' && <section className="space-y-1.5">
            <p className="flex items-center gap-2 px-1 py-1 text-xs font-bold text-gray-800"><Sparkles className="h-4 w-4" />Popular fonts</p>
            {filteredBrowseFonts.builtIn.slice(0, visibleFontCount).map((font) => {
              const current = cleanFontName(selected?.fontFamily).toLowerCase() === cleanFontName(font.family).toLowerCase();
              return <button key={font.id} type="button" onClick={() => void handleBrowseFont(font)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition ${current ? 'bg-purple-100 text-gray-900' : 'text-gray-800 hover:bg-gray-100'}`}><ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-500" /><span className="flex-1 truncate text-sm" style={{ fontFamily: font.family }}>{font.name}</span>{font.popular && <Crown className="h-3.5 w-3.5 text-gray-400" />}{current && <Check className="h-4 w-4 shrink-0 text-gray-900" />}</button>;
            })}
            {filteredBrowseFonts.builtIn.length > visibleFontCount && <button type="button" onClick={() => setVisibleFontCount((count) => count + 30)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">Load more fonts</button>}
            {!filteredBrowseFonts.builtIn.length && fontCategory !== 'custom' && <p className="px-2 py-8 text-center text-sm text-gray-500">No fonts found.</p>}
          </section>}

          {fontCategory === 'all' && hasMorePresets && <button type="button" onClick={() => void handleLoadMorePresets()} disabled={loadingMorePresets} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60">{loadingMorePresets ? 'Loading uploaded fonts…' : 'Load more uploaded fonts'}</button>}
        </div>
      ) : (
      <>

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

      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
        <div>
          <p className="text-xs font-semibold text-gray-800">Text Color</p>
          <p className="text-[10px] text-gray-500">{isTextSelected ? 'Apply to selected text' : 'Default for new text'}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 hover:bg-gray-50">
          <span className="text-[10px] font-mono font-semibold uppercase text-gray-700">
            {isTextSelected && typeof selected?.fill === 'string' ? selected.fill : newTextColor}
          </span>
          <input
            aria-label="Choose text color"
            type="color"
            value={isTextSelected && typeof selected?.fill === 'string' && /^#[0-9a-f]{6}$/i.test(selected.fill) ? selected.fill : newTextColor}
            onChange={(event) => {
              const color = event.target.value;
              setNewTextColor(color);
              if (isTextSelected && canvasManager) {
                canvasManager.updateSelectedProperty('fill', color);
              }
            }}
            className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
      </div>

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
          className="w-full text-left p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-purple-50/50 hover:border-purple-200 cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl font-extrabold text-gray-900 group-hover:text-purple-700">Heading Style</span>
            <span className="text-[10px] font-bold text-gray-400">Inter</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => handleSelectDefaultFont('Inter', 'subheading')}
          className="w-full text-left p-3 rounded-xl border border-gray-200 bg-white hover:bg-purple-50/50 hover:border-purple-200 cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 group-hover:text-purple-700">Subheading Style</span>
            <span className="text-[10px] font-bold text-gray-400">Inter</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => handleSelectDefaultFont('Inter', 'body')}
          className="w-full text-left p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-purple-50/50 hover:border-purple-200 cursor-pointer transition group"
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
                  onMouseEnter={() => {
                    if (isTextSelected) handleSelectPreset(preset);
                  }}
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
                    : 'border-gray-200 bg-white hover:bg-purple-50/70 hover:border-purple-300 cursor-pointer'
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
        {!loading && hasMorePresets && (
          <button
            type="button"
            onClick={() => void handleLoadMorePresets()}
            disabled={loadingMorePresets}
            className="w-full rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 transition hover:bg-purple-100 disabled:cursor-wait disabled:opacity-60"
          >
            {loadingMorePresets ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading more…</span>
            ) : 'Load more presets'}
          </button>
        )}
      </div>
      </>
      )}
    </div>
  );
};
