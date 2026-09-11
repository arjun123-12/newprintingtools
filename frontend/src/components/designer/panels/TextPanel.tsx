'use client';

import React, { useState, useEffect } from 'react';
import { Type, Plus, Minus, Sparkles, Sliders } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';
import { ColorPicker } from '../controls/ColorPicker';
import { DesignAsset, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { LoadingState, EmptyState } from '@/components/admin/shared';

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

export const TextPanel: React.FC<TextPanelProps> = ({ canvasManager, selected }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const isTextSelected = selected?.type === 'i-text' || selected?.type === 'textbox';

  const [presets, setPresets] = useState<DesignAsset[]>([]);
  const [categories, setCategories] = useState<DesignAssetCategory[]>([]);
  const [loading, setLoading] = useState(true);

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
        setPresets(assetsRes.data);
        setCategories(catsRes);
      } catch (err) {
        console.error('Failed to load text presets', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddHeading = () => {
    if (!canvasManager) return;
    void canvasManager.addText({
      text: 'Add a heading',
      fontSizePt: DEFAULT_TEXT_SIZES_PT.heading,
      fontWeight: 'bold',
      fontFamily: 'Inter, sans-serif',
      fill: '#0f172a',
      width: Math.max(180, artworkWidth * 0.72),
    });
  };

  const handleAddSubheading = () => {
    if (!canvasManager) return;
    void canvasManager.addText({
      text: 'Add a subheading',
      fontSizePt: DEFAULT_TEXT_SIZES_PT.subheading,
      fontWeight: '600',
      fontFamily: 'Inter, sans-serif',
      fill: '#334155',
      width: Math.max(160, artworkWidth * 0.62),
    });
  };

  const handleAddBody = () => {
    if (!canvasManager) return;
    void canvasManager.addText({
      text: 'Add body text. Double-click to edit content directly on canvas.',
      fontSizePt: DEFAULT_TEXT_SIZES_PT.body,
      fontWeight: 'normal',
      fontFamily: 'Inter, sans-serif',
      fill: '#475569',
      width: Math.max(150, artworkWidth * 0.55),
    });
  };

  const handleAddPreset = (asset: DesignAsset) => {
    if (!canvasManager) return;
    const config = asset.fabric_json || {};
    const configuredPoints = Number(
      config.fontSizePt || asset.metadata?.fontSizePt || 0
    );
    const configuredWidth = Number(config.width) || Math.max(180, artworkWidth * 0.65);

    void canvasManager.addText({
      ...config,
      text: config.text || asset.name,
      width: configuredWidth,
      fontSizePt: configuredPoints > 0 ? configuredPoints : undefined,
      textAlign: config.textAlign || 'center',
      assetId: asset.id,
      provider: asset.provider || 'admin',
      sourceType: 'asset',
      editable: true,
      locked: false,
    } as any);
  };

  const filteredPresets =
    selectedCategory === 'All'
      ? presets
      : presets.filter((p) => p.category?.name === selectedCategory);

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
      {isTextSelected && (
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
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStrokePicker(!showStrokePicker)}
                      className="w-7 h-7 rounded-lg border border-gray-300 shadow-2xs flex items-center justify-center transition hover:scale-105"
                      style={{ backgroundColor: currentStrokeColor }}
                    />
                    {showStrokePicker && (
                      <div className="absolute right-0 top-full mt-2 z-50 p-2 bg-white rounded-xl shadow-2xl border border-gray-200">
                        <ColorPicker value={currentStrokeColor} onChange={(hex) => handleUpdateProperty('stroke', hex)} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
            onClick={() => setSelectedCategory('All')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition whitespace-nowrap ${selectedCategory === 'All' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition whitespace-nowrap ${selectedCategory === cat.name ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
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
            filteredPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleAddPreset(preset)}
                className="w-full text-left p-3.5 rounded-2xl border border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-300 transition shadow-2xs flex flex-col gap-1 relative overflow-hidden"
              >
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-600 bg-purple-100/80 px-2 py-0.5 rounded-md w-fit">
                  {preset.category?.name || 'Text'}
                </span>
                <span
                  className="text-lg font-extrabold transition-colors truncate mt-0.5"
                  style={{
                    fontFamily: preset.fabric_json?.fontFamily,
                    color: preset.fabric_json?.fill,
                  }}
                >
                  {preset.fabric_json?.text || preset.name}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
