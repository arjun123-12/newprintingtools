'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Shapes,
  Sparkles,
  Upload,
  Search,
  Check,
  Plus,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  X,
  RefreshCw,
  Loader2,
  Layers,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState, FrameShapeType } from '@/types/designer';
import {
  FRAME_PRESETS,
  FRAME_SVG_PATHS,
  CANVA_FRAME_PLACEHOLDER_SVG,
} from '../data/framesData';
import { DesignAsset, designAssetService } from '@/services/designAssetService';
import { formatImageUrl } from '@/utils/imageUrl';

interface ShapesPanelProps {
  canvasManager: CanvasManager | null;
  selected?: SelectedObjectState | null;
}

const CATEGORIES = [
  { id: 'all', label: 'All Shapes' },
  { id: 'admin', label: 'Admin Shapes' },
  { id: 'basic', label: 'Basic' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'decorative', label: 'Decorative' },
  { id: 'device', label: 'Mockups' },
] as const;

export const ShapesPanel: React.FC<ShapesPanelProps> = ({
  canvasManager,
  selected,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stagedPhotoUrl, setStagedPhotoUrl] = useState<string | null>(null);
  const [stagedPhotoName, setStagedPhotoName] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [specificShapeUpload, setSpecificShapeUpload] = useState<
    | { kind: 'preset'; shape: FrameShapeType; name: string }
    | { kind: 'admin'; asset: DesignAsset }
    | null
  >(null);

  // Admin Shapes State
  const [adminShapes, setAdminShapes] = useState<DesignAsset[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [adminLoadError, setAdminLoadError] = useState<string | null>(null);
  const [applyingAdminId, setApplyingAdminId] = useState<string | null>(null);

  const globalFileInputRef = useRef<HTMLInputElement>(null);
  const specificShapeInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch Admin Shapes from Backend ───────────────────────────────────────
  const loadAdminShapes = useCallback(async () => {
    try {
      setIsLoadingAdmin(true);
      setAdminLoadError(null);
      const res = await designAssetService.getPublicAssets({
        asset_type: 'shape',
        per_page: 60,
        search: searchQuery.trim() || undefined,
      });
      setAdminShapes(
        (res.data || []).filter(
          (asset) => asset.asset_type === 'shape' && asset.is_active !== false
        )
      );
    } catch (err: any) {
      console.error('Failed to load admin shapes:', err);
      setAdminLoadError(
        err?.response?.data?.message || err?.message || 'Failed to load admin shapes.'
      );
    } finally {
      setIsLoadingAdmin(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadAdminShapes();
  }, [loadAdminShapes]);

  // Check if an image is currently active/selected on the canvas
  const isCanvasImageSelected = useMemo(() => {
    if (!selected) return false;
    if (selected.isMultiple) return false;
    return (
      selected.type === 'image' ||
      selected.type === 'fabricImage' ||
      Boolean(selected.src) ||
      Boolean(selected.originalSrc)
    );
  }, [selected]);

  const selectedImageSource = useMemo(() => {
    if (!isCanvasImageSelected || !selected) return null;
    return selected.src || selected.originalSrc || null;
  }, [isCanvasImageSelected, selected]);

  // Filter presets based on category and search query
  const filteredPresets = useMemo(() => {
    if (selectedCategory === 'admin') return [];
    return FRAME_PRESETS.filter((preset) => {
      if (selectedCategory !== 'all' && preset.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          preset.name.toLowerCase().includes(q) ||
          preset.shape.toLowerCase().includes(q) ||
          preset.description?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  // Filter admin shapes
  const filteredAdminShapes = useMemo(() => {
    if (selectedCategory !== 'all' && selectedCategory !== 'admin') return [];
    if (!searchQuery.trim()) return adminShapes;
    const q = searchQuery.toLowerCase();
    return adminShapes.filter((asset) => {
      const metadata = toPlainObject(asset.metadata);
      const shape = toPlainObject(metadata.shape);
      const shapeType = String(shape.shapeType || metadata.shapeType || 'custom-svg');
      return (
        asset.name.toLowerCase().includes(q) ||
        asset.slug.toLowerCase().includes(q) ||
        shapeType.toLowerCase().includes(q)
      );
    });
  }, [adminShapes, selectedCategory, searchQuery]);

  // Show temporary toast feedback
  const triggerToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 2800);
  };

  // ─── Apply Preset Shape (Fit Selected Photo OR Add Shape with Staged Photo OR Add Empty Frame) ───
  const handleApplyShape = async (shape: FrameShapeType, presetName: string) => {
    if (!canvasManager) return;

    try {
      const activeObj = canvasManager.getCanvas()?.getActiveObject();

      // Case 1: An image is currently selected on the canvas -> FIT IT DIRECTLY!
      if (activeObj && canvasManager.isImageObject(activeObj)) {
        const originalSrc =
          activeObj.get('originalSrc' as any) ||
          (activeObj as any).getSrc?.() ||
          selectedImageSource;

        if (originalSrc) {
          activeObj.set('frameShape' as any, shape);
          activeObj.set('shapeType' as any, shape);
          activeObj.set('isFrame' as any, true);
          activeObj.set('isShape' as any, true);
          await canvasManager.slotImageIntoFrame(activeObj, originalSrc);
          triggerToast(`Fitted photo into ${presetName}!`);
          return;
        }
      }

      // Case 2: A custom photo was staged in this panel
      if (stagedPhotoUrl) {
        canvasManager.addFrame(shape, stagedPhotoUrl);
        triggerToast(`Created ${presetName} filled with your photo!`);
        return;
      }

      // Case 3: No photo selected -> Add shape frame ready to receive images
      canvasManager.addFrame(shape);
      triggerToast(`Added ${presetName} to canvas!`);
    } catch (err) {
      console.error('Failed to apply shape:', err);
    }
  };

  // ─── Apply Admin Uploaded Shape ─────────────────────────────────────────────
  const handleApplyAdminShape = async (asset: DesignAsset) => {
    if (!canvasManager || applyingAdminId) return;

    try {
      const fileUrl =
        asset.file_url ||
        (asset as any).asset_url ||
        null;

      if (!fileUrl) {
        triggerToast(`${asset.name} has no SVG file.`);
        return;
      }

      setApplyingAdminId(asset.id);

      const metadata = toPlainObject(asset.metadata);
      const fabricJson = toPlainObject(asset.fabric_json);
      const shapeMetadata = {
        ...fabricJson,
        ...metadata,
        ...toPlainObject(metadata.shape),
      };
      const photoFit = shapeMetadata.photoFit === 'contain' ? 'contain' : 'cover';
      const safeShapeUrl = formatImageUrl(fileUrl);

      const activeObj = canvasManager.getCanvas()?.getActiveObject();

      // addCustomPhotoShape uses the real uploaded SVG as the clipPath. If a
      // canvas photo is selected it is converted immediately; otherwise a
      // draggable photo-shape placeholder is created.
      const addedShape = await canvasManager.addCustomPhotoShape(safeShapeUrl, {
        assetId: asset.id,
        provider: asset.provider || 'admin',
        name: asset.name,
        originalSrc: safeShapeUrl,
        photoFit,
        fill: typeof shapeMetadata.fill === 'string' ? shapeMetadata.fill : '#8b3dff',
        recolourable: shapeMetadata.recolourable !== false,
        allowPhotoDrop: shapeMetadata.allowPhotoDrop !== false,
      });

      if (!addedShape) {
        triggerToast(`Could not use ${asset.name}. Check that the SVG has a closed path.`);
        return;
      }

      if (activeObj && canvasManager.isImageObject(activeObj)) {
        triggerToast(`Fitted photo into ${asset.name}!`);
      } else if (stagedPhotoUrl) {
        await canvasManager.fitImageIntoShape(addedShape, stagedPhotoUrl, {
          originalSrc: stagedPhotoUrl,
          name: stagedPhotoName || `${asset.name} Photo`,
          photoFit,
        });
        triggerToast(`Created ${asset.name} filled with your photo!`);
      } else {
        triggerToast(`Added ${asset.name}! Drag it over a photo to fill.`);
      }
    } catch (err) {
      console.error('Failed to apply admin shape:', err);
      triggerToast(`Failed to add ${asset.name}.`);
    } finally {
      setApplyingAdminId(null);
    }
  };

  // ─── Upload Custom Photo to Fill Any Shape ───
  const handleGlobalPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setStagedPhotoUrl(dataUrl);
      setStagedPhotoName(file.name);
      triggerToast(`Photo loaded! Click any shape below to fill it.`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Upload Photo Directly into a Specific Shape ───
  const handleSpecificShapeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !specificShapeUpload || !canvasManager) return;

    const target = specificShapeUpload;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;

      try {
        if (target.kind === 'preset') {
          canvasManager.addFrame(target.shape, dataUrl);
          triggerToast(`Created ${target.name} filled with ${file.name}!`);
        } else {
          const shapeUrl =
            target.asset.file_url || (target.asset as any).asset_url || null;
          if (!shapeUrl) {
            triggerToast(`${target.asset.name} has no SVG file.`);
            return;
          }

          const metadata = toPlainObject(target.asset.metadata);
          const shapeMetadata = {
            ...toPlainObject(target.asset.fabric_json),
            ...metadata,
            ...toPlainObject(metadata.shape),
          };
          const photoFit = shapeMetadata.photoFit === 'contain' ? 'contain' : 'cover';
          const addedShape = await canvasManager.addCustomPhotoShape(
            formatImageUrl(shapeUrl),
            {
              assetId: target.asset.id,
              provider: target.asset.provider || 'admin',
              name: target.asset.name,
              photoFit,
              allowPhotoDrop: true,
            }
          );

          if (addedShape) {
            await canvasManager.fitImageIntoShape(addedShape, dataUrl, {
              originalSrc: dataUrl,
              name: file.name,
              photoFit,
            });
            triggerToast(`Created ${target.asset.name} filled with ${file.name}!`);
          }
        }
      } finally {
        setSpecificShapeUpload(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Hidden File Inputs */}
      <input
        ref={globalFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleGlobalPhotoUpload}
      />
      <input
        ref={specificShapeInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSpecificShapeUpload}
      />

      {/* ──────── Header Section ──────── */}
      <div className="p-4 border-b border-gray-100 space-y-3 flex-none bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <Shapes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Shapes & Photo Fill
              </h3>
              <p className="text-[10px] text-gray-400">
                Fit any photo into any shape
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => loadAdminShapes()}
              disabled={isLoadingAdmin}
              title="Refresh admin shapes"
              className="p-1 text-gray-400 hover:text-purple-600 rounded-md hover:bg-purple-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdmin ? 'animate-spin text-purple-600' : ''}`} />
            </button>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {filteredPresets.length + filteredAdminShapes.length} shapes
            </span>
          </div>
        </div>

        {/* ──────── Live Active Photo Banner ──────── */}
        {isCanvasImageSelected ? (
          <div className="p-2.5 rounded-xl bg-purple-50/90 border border-purple-200 flex items-center justify-between gap-2.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              {selectedImageSource ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedImageSource}
                  alt="Selected Canvas Photo"
                  className="w-10 h-10 rounded-lg object-cover border border-purple-300 shadow-2xs shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                  <ImageIcon className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                  <span className="text-[11px] font-bold text-purple-900 truncate">
                    Photo Selected on Canvas!
                  </span>
                </div>
                <p className="text-[10px] text-purple-700 leading-tight truncate">
                  Click any shape below to fit this photo into it.
                </p>
              </div>
            </div>
            <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-purple-600 text-white shadow-2xs shrink-0 animate-pulse">
              Ready to Fit
            </span>
          </div>
        ) : stagedPhotoUrl ? (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={stagedPhotoUrl}
                alt="Staged Custom Photo"
                className="w-9 h-9 rounded-lg object-cover border border-emerald-300 shadow-2xs shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-bold text-emerald-900 truncate">
                    Custom Photo Loaded
                  </span>
                </div>
                <p className="text-[10px] text-emerald-700 truncate">
                  {stagedPhotoName || 'Photo ready'} — click any shape below!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setStagedPhotoUrl(null);
                setStagedPhotoName(null);
              }}
              className="p-1 text-emerald-600 hover:text-emerald-800 rounded-md hover:bg-emerald-100"
              title="Clear photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Upload Photo to Fill Button */
          <button
            type="button"
            onClick={() => globalFileInputRef.current?.click()}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-50 text-purple-700 font-semibold text-xs flex items-center justify-center gap-2 transition hover:border-purple-400 group"
          >
            <Upload className="w-3.5 h-3.5 text-purple-600 group-hover:scale-110 transition-transform" />
            <span>Upload Photo to Fill Any Shape</span>
          </button>
        )}

        {/* ──────── Search Bar ──────── */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shapes (circle, star, heart, badge...)"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* ──────── Category Chips ──────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap transition-all ${selectedCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-2xs shadow-purple-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80'
                }`}
            >
              {cat.label}
              {cat.id === 'admin' && adminShapes.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-purple-200 text-purple-900 font-bold">
                  {adminShapes.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ──────── Toast Feedback ──────── */}
      {feedbackToast && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-white" />
            <span>{feedbackToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="text-white/80 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ──────── Shapes Grid Content ──────── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 pb-20 space-y-5">
        {/* 1. ADMIN UPLOADED SHAPES SECTION */}
        {adminLoadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] text-red-600">
            {adminLoadError}
          </div>
        )}

        {isLoadingAdmin && adminShapes.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading admin shapes...
          </div>
        )}

        {filteredAdminShapes.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-950">
                  Admin Library Shapes
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                {filteredAdminShapes.length} Custom
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {filteredAdminShapes.map((asset) => {
                const thumbUrl =
                  asset.thumbnail_url ||
                  (asset as any).asset_thumbnail_url ||
                  asset.file_url ||
                  (asset as any).asset_url;
                const isApplying = applyingAdminId === asset.id;

                return (
                  <div
                    key={asset.id}
                    onClick={() => handleApplyAdminShape(asset)}
                    className={`group relative flex flex-col rounded-2xl border-2 border-purple-200 bg-white hover:border-purple-500 overflow-hidden transition-all duration-200 hover:shadow-md hover:shadow-purple-100/60 ${applyingAdminId ? 'cursor-wait opacity-70' : 'cursor-pointer'
                      }`}
                  >
                    {/* Silhouette preview */}
                    <div className="relative w-full aspect-square bg-purple-50/40 flex items-center justify-center p-3">
                      {thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={formatImageUrl(thumbUrl)}
                          alt={asset.name}
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Shapes className="w-8 h-8 text-purple-400" />
                      )}

                      {isApplying && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75">
                          <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                        </div>
                      )}

                      {/* Admin Badge */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-purple-700 text-white text-[9px] font-extrabold uppercase tracking-wider shadow-xs">
                        Admin
                      </div>

                      {/* Corner Upload Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSpecificShapeUpload({ kind: 'admin', asset });
                          specificShapeInputRef.current?.click();
                        }}
                        title={`Upload photo to fill ${asset.name}`}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-white/90 hover:bg-white text-gray-600 hover:text-purple-600 flex items-center justify-center shadow-xs border border-gray-200 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      >
                        <Camera className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Card Footer */}
                    <div className="px-2.5 py-2 border-t border-purple-100 flex items-center justify-between bg-white">
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {asset.name}
                      </span>
                      <div className="w-5 h-5 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Plus className="w-3 h-3" />
                      </div>
                    </div>

                    {/* Hover Action Overlay */}
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2 backdrop-blur-[1px]">
                      <span className="text-white text-[11px] font-bold tracking-wide drop-shadow-xs text-center">
                        {isCanvasImageSelected
                          ? `Fit Photo into ${asset.name}`
                          : stagedPhotoUrl
                            ? `Add with Photo`
                            : `Add ${asset.name}`}
                      </span>
                      <span className="text-[9px] text-white/95 bg-purple-600 px-2.5 py-1 rounded-lg font-semibold shadow-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Click to Fill
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. STANDARD PRESETS SECTION */}
        {filteredPresets.length > 0 && (
          <div className="space-y-2.5">
            {filteredAdminShapes.length > 0 && (
              <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                <Shapes className="w-3.5 h-3.5 text-gray-500" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                  Standard Shapes & Presets
                </h4>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {filteredPresets.map((preset) => {
                const svgPath = FRAME_SVG_PATHS[preset.shape];
                const clipId = `shape_clip_${preset.shape}`;

                return (
                  <div
                    key={preset.id}
                    onClick={() => handleApplyShape(preset.shape, preset.name)}
                    className="group relative flex flex-col rounded-2xl border border-gray-100 bg-white hover:border-purple-400 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:shadow-purple-100/50"
                  >
                    {/* Visual Shape Silhouette Preview with Canva Landscape Photo Fill */}
                    <div className="relative w-full aspect-square bg-gray-50 flex items-center justify-center p-3">
                      <svg
                        viewBox="0 0 100 100"
                        className="w-full h-full drop-shadow-xs transition-transform duration-200 group-hover:scale-105"
                      >
                        <defs>
                          <clipPath id={clipId}>
                            <path d={svgPath} />
                          </clipPath>
                        </defs>

                        {/* Shape Silhouette Background */}
                        <path
                          d={svgPath}
                          fill="#e9ecef"
                          stroke="#ced4da"
                          strokeWidth="1.5"
                        />

                        {/* Realistic Photo Fill Mask (Canva landscape sky & hills) */}
                        <g clipPath={`url(#${clipId})`}>
                          <image
                            href={
                              stagedPhotoUrl ||
                              selectedImageSource ||
                              CANVA_FRAME_PLACEHOLDER_SVG
                            }
                            x="0"
                            y="0"
                            width="100"
                            height="100"
                            preserveAspectRatio="xMidYMid slice"
                          />
                        </g>
                      </svg>

                      {/* Corner Upload Button to pick photo specifically for this shape */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSpecificShapeUpload({
                            kind: 'preset',
                            shape: preset.shape,
                            name: preset.name,
                          });
                          specificShapeInputRef.current?.click();
                        }}
                        title={`Upload photo to fill ${preset.name}`}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-white/90 hover:bg-white text-gray-600 hover:text-purple-600 flex items-center justify-center shadow-xs border border-gray-200 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      >
                        <Camera className="w-3 h-3" />
                      </button>

                      {/* Active Indicator if Photo is Ready */}
                      {(isCanvasImageSelected || stagedPhotoUrl) && (
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-purple-600/90 text-white text-[9px] font-bold uppercase tracking-wider shadow-xs backdrop-blur-xs">
                          Fit
                        </div>
                      )}
                    </div>

                    {/* Card Footer / Title */}
                    <div className="px-2.5 py-2 border-t border-gray-100 flex items-center justify-between bg-white">
                      <span className="text-xs font-semibold text-gray-800 truncate">
                        {preset.name}
                      </span>
                      <div className="w-5 h-5 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Plus className="w-3 h-3" />
                      </div>
                    </div>

                    {/* Hover Action Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2 backdrop-blur-[1px]">
                      <span className="text-white text-[11px] font-bold tracking-wide drop-shadow-xs text-center">
                        {isCanvasImageSelected
                          ? `Fit Photo into ${preset.name}`
                          : stagedPhotoUrl
                            ? `Add with Photo`
                            : `Add ${preset.name}`}
                      </span>
                      <span className="text-[9px] text-white/90 bg-purple-600 px-2.5 py-1 rounded-lg font-semibold shadow-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Click to Apply
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredPresets.length === 0 && filteredAdminShapes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <Shapes className="w-10 h-10 text-gray-300" />
            <p className="text-sm font-semibold text-gray-600">No shapes found</p>
            <p className="text-xs text-gray-400">Try a different search term or category</p>
          </div>
        )}
      </div>
    </div>
  );
};

/** Laravel JSON columns can arrive as an object or as an encoded string. */
function toPlainObject(value: unknown): Record<string, any> {
  if (!value) return {};

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
