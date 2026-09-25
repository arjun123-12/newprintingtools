'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  Shapes, Search, Loader2, Plus, AlertTriangle, RefreshCw, ChevronDown, ChevronLeft, X, FileText, Image as ImageIcon,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { DesignAsset, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { externalAssetService } from '@/services/externalAssetService';
import { formatImageUrl } from '@/utils/imageUrl';

import { ActiveSidebarTab } from '@/types/designer';

// ─────────────────────────── Constants ───────────────────────────

const RECENT_SHAPES_KEY = 'print_designer_recent_shape_ids';

interface ShapeSection {
  id: string;
  name: string;
  sortOrder: number;
  assets: DesignAsset[];
}

const FORMAT_OPTIONS = ['All', 'SVG', 'PNG', 'JPG', 'Photo'] as const;

type UnifiedAsset = {
  id: string;
  title: string;
  thumbnail_url: string;
  preview_url: string;
  provider: string;
  provider_asset_id: string;
  asset_type: string;
  format: string;
  is_vector: boolean;
  attribution: string | null;
  license: any;
  width: number;
  height: number;
  // from admin library:
  _adminAsset?: DesignAsset;
};

export function isUnrenderableFormat(format?: string, url?: string): boolean {
  const f = (format || '').toLowerCase();
  if (f === 'tif' || f === 'tiff' || f === 'pdf') return true;
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.tif') || clean.endsWith('.tiff') || clean.endsWith('.pdf');
}

function getShapeAssetUrl(asset: DesignAsset): string | null {
  const raw = asset.file_url || (asset as any).asset_url;
  return raw ? formatImageUrl(raw) : null;
}

function getShapeThumbnailUrl(asset: DesignAsset): string | null {
  const raw =
    asset.thumbnail_url ||
    (asset as any).asset_thumbnail_url ||
    asset.file_url ||
    (asset as any).asset_url;
  return raw ? formatImageUrl(raw) : null;
}

function adminToUnified(a: DesignAsset): UnifiedAsset {
  const fileUrl = a.file_url || (a as any).asset_url || '';
  const rawPath = a.file_path || fileUrl;
  const ext = (rawPath.split('?')[0] || '').split('.').pop()?.toLowerCase() || 'png';
  const isVector = ext === 'svg' || Boolean(a.metadata?.is_vector);
  const rawThumb = a.thumbnail_url || (a as any).asset_thumbnail_url || '';
  const isThumbUnrenderable = isUnrenderableFormat('', rawThumb);
  const isFileUnrenderable = isUnrenderableFormat(ext, fileUrl);
  const thumbUrl = !isThumbUnrenderable && rawThumb ? rawThumb : (!isFileUnrenderable ? fileUrl : '');

  return {
    id: `admin:${a.id}`,
    title: a.name,
    thumbnail_url: thumbUrl,
    preview_url: fileUrl,
    provider: 'admin',
    provider_asset_id: a.id,
    asset_type: a.asset_type || 'element',
    format: ext,
    is_vector: isVector,
    attribution: a.attribution || null,
    license: a.license_name || null,
    width: a.metadata?.width || 400,
    height: a.metadata?.height || 400,
    _adminAsset: a,
  };
}

/**
 * Return the real remote URL when a URL has previously been wrapped by the
 * Laravel image proxy. The public source is preserved on the Fabric object so
 * server-side tools such as Magnific can access it later.
 */
function unwrapProxyImageUrl(rawUrl: string): string {
  let currentUrl = rawUrl.trim();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsedUrl = new URL(currentUrl, 'http://local.invalid');

      if (!parsedUrl.pathname.includes('/proxy-image')) {
        return currentUrl;
      }

      const nestedUrl = parsedUrl.searchParams.get('url');

      if (!nestedUrl || nestedUrl === currentUrl) {
        return currentUrl;
      }

      currentUrl = nestedUrl;
    } catch {
      return currentUrl;
    }
  }

  return currentUrl;
}

function preserveActiveObjectSource(
  canvasManager: CanvasManager,
  sourceUrl: string,
  metadata: Record<string, unknown>
): void {
  const fabricCanvas = canvasManager.getCanvas();
  const activeObject = fabricCanvas?.getActiveObject() as any;

  if (!fabricCanvas || !activeObject) {
    return;
  }

  activeObject.set({
    ...metadata,
    originalSrc: sourceUrl,
    sourceUrl,
  });
  activeObject.setCoords?.();
  fabricCanvas.requestRenderAll();

  // Refresh the SelectedObjectState used by ContextualToolbar.
  (fabricCanvas as any).fire?.('object:modified', {
    target: activeObject,
  });
}

// ─────────────────────────── Component ───────────────────────────

interface ElementsPanelProps {
  canvasManager: CanvasManager | null;
  onSelectTab?: (tab: ActiveSidebarTab) => void;
}

export const ElementsPanel: React.FC<ElementsPanelProps> = ({ canvasManager, onSelectTab }) => {
  // ─── State ─────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedFormat, setSelectedFormat] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const [assets, setAssets] = useState<UnifiedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isInserting, setIsInserting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  // ─── Shape-Specific State (Canva Sections) ─────────────────────
  const [shapeAssets, setShapeAssets] = useState<DesignAsset[]>([]);
  const [shapeCategories, setShapeCategories] = useState<DesignAssetCategory[]>([]);
  const [recentShapeIds, setRecentShapeIds] = useState<string[]>([]);
  const [expandedShapeSectionId, setExpandedShapeSectionId] = useState<string | null>(null);
  const [loadingShapes, setLoadingShapes] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_SHAPES_KEY) || '[]');
      if (Array.isArray(parsed)) {
        setRecentShapeIds(parsed.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      setRecentShapeIds([]);
    }
  }, []);

  const rememberShape = useCallback((id: string) => {
    setRecentShapeIds((prev) => {
      const next = [id, ...prev.filter((item) => item !== id)].slice(0, 12);
      try {
        localStorage.setItem(RECENT_SHAPES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Fetch shapes library when selectedCategory is 'Shapes' or 'All'
  useEffect(() => {
    let active = true;
    async function loadShapes() {
      if (shapeAssets.length > 0) return;
      try {
        setLoadingShapes(true);
        const [cats, shapesRes] = await Promise.all([
          designAssetService.getPublicCategories('shape'),
          designAssetService.getPublicAssets({
            asset_type: 'shape',
            per_page: 100,
            sort: 'sort_order',
          }),
        ]);
        if (!active) return;
        setShapeCategories(
          (cats || [])
            .filter((c) => c.asset_type === 'shape' && c.is_active !== false)
            .sort(
              (a, b) =>
                Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
                a.name.localeCompare(b.name)
            )
        );
        const items = (shapesRes.data || []).filter(
          (s) => s.asset_type === 'shape' && s.is_active !== false && getShapeAssetUrl(s)
        );
        setShapeAssets(items);
      } catch (err) {
        console.error('Failed to load shapes in ElementsPanel:', err);
      } finally {
        if (active) setLoadingShapes(false);
      }
    }

    if (selectedCategory === 'Shapes' || selectedCategory === 'All') {
      void loadShapes();
    }
    return () => {
      active = false;
    };
  }, [selectedCategory, shapeAssets.length]);

  const shapeSections = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const filtered = q
      ? shapeAssets.filter((a) =>
        [a.name, a.slug, a.category?.name].some((v) =>
          String(v || '').toLowerCase().includes(q)
        )
      )
      : shapeAssets;

    const sections = shapeCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      sortOrder: Number(cat.sort_order || 0),
      assets: filtered.filter(
        (a) => String(a.category_id || a.category?.id || '') === cat.id
      ),
    }));

    const knownIds = new Set(shapeCategories.map((c) => c.id));
    const uncategorized = filtered.filter((a) => {
      const id = String(a.category_id || a.category?.id || '');
      return !id || !knownIds.has(id);
    });

    if (uncategorized.length > 0) {
      sections.push({
        id: '__uncategorized__',
        name: 'Other shapes',
        sortOrder: 9999,
        assets: uncategorized,
      });
    }

    return sections.filter((s) => s.assets.length > 0);
  }, [debouncedQuery, shapeAssets, shapeCategories]);

  const recentShapeAssets = useMemo(() => {
    if (debouncedQuery.trim()) return [];
    const byId = new Map(shapeAssets.map((a) => [a.id, a]));
    return recentShapeIds
      .map((id) => byId.get(id))
      .filter((a): a is DesignAsset => Boolean(a));
  }, [debouncedQuery, recentShapeIds, shapeAssets]);

  const activeExpandedShapeSection = useMemo<ShapeSection | null>(() => {
    return shapeSections.find((s: ShapeSection) => s.id === expandedShapeSectionId) || null;
  }, [expandedShapeSectionId, shapeSections]);

  const frameAssets = useMemo(
    () => assets.filter((a) => a.asset_type === 'frame' || a._adminAsset?.asset_type === 'frame'),
    [assets]
  );
  const graphicsAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.asset_type !== 'frame' &&
          a.asset_type !== 'shape' &&
          a.asset_type !== 'photo' &&
          (a.is_vector || a.format === 'svg')
      ),
    [assets]
  );
  const photoAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.asset_type === 'photo' ||
          (!a.is_vector && (a.format === 'jpg' || a.format === 'jpeg' || a.format === 'png'))
      ),
    [assets]
  );

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);
  // ─── Debounce ──────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 420);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ─── Fetch on param change ────────────────────────────────────
  useEffect(() => {
    setPage(1);
    setAssets([]);
    fetchAssets(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, selectedCategory, selectedFormat]);

  // ─── Core fetch ───────────────────────────────────────────────
  const fetchAssets = useCallback(async (targetPage: number, isReset: boolean) => {
    const rid = ++requestIdRef.current;

    if (isReset) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const adminResults: UnifiedAsset[] = [];
      let combinedHasNext = false;

      // Search only the application's database-backed public asset library.
      const adminRes = await designAssetService.getPublicAssets({
        asset_type: 'all',
        page: targetPage,
        per_page: 30,
        search: debouncedQuery.trim() || undefined,
        sort: 'sort_order',
      });
      if (rid !== requestIdRef.current) return;

      const adminItems = (adminRes.data || []).map(adminToUnified);
      const filtered = adminItems.filter((a) => {
        // Exclude text presets or empty items without media
        if (a.asset_type === 'text') return false;
        if (!a.thumbnail_url && !a.preview_url) return false;

        if (selectedCategory !== 'All') {
          const catLower = selectedCategory.toLowerCase();
          const typeLower = (a.asset_type || '').toLowerCase();
          const customCat = a._adminAsset?.category?.name?.toLowerCase() || '';

          if (catLower === 'photos') {
            if (typeLower === 'photo') return true;
            if (!a.is_vector && (a.format === 'jpg' || a.format === 'jpeg' || a.format === 'png' || a.format === 'webp' || a.format === 'avif')) return true;
            return false;
          } else if (catLower === 'frames') {
            if (typeLower !== 'frame') return false;
          } else if (catLower === 'backgrounds') {
            if (typeLower !== 'background') return false;
          } else if (
            catLower === 'graphics' ||
            catLower === 'illustrations' ||
            catLower === 'icons' ||
            catLower === 'shapes' ||
            catLower === 'stickers'
          ) {
            // Keep vector SVG graphics and design elements; exclude photos, frames, backgrounds
            if (typeLower === 'photo' && !a.is_vector) return false;
            if (typeLower === 'frame' || typeLower === 'background') return false;
          } else if (customCat && customCat !== catLower && !a.title.toLowerCase().includes(catLower)) {
            return false;
          }
        }

        if (selectedFormat !== 'All') {
          const fmt = selectedFormat.toLowerCase();
          if (fmt === 'svg') {
            if (!a.is_vector && a.format !== 'svg') return false;
          } else if (fmt === 'photo') {
            if (a.is_vector) return false;
          } else if (fmt === 'jpg' || fmt === 'jpeg') {
            if (a.format !== 'jpg' && a.format !== 'jpeg') return false;
          } else if (fmt === 'png') {
            if (a.format !== 'png') return false;
          } else {
            if (a.format !== fmt) return false;
          }
        }

        return true;
      });
      adminResults.push(...filtered);
      combinedHasNext = targetPage < Math.max(1, Number(adminRes.last_page) || 1);

      const results = adminResults;

      if (rid !== requestIdRef.current) return; // stale

      // Deduplicate by composite ID
      const seen = new Set<string>();
      const deduped: UnifiedAsset[] = [];
      const base = isReset ? [] : assets;
      for (const item of [...base, ...results]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          deduped.push(item);
        }
      }

      setAssets(deduped);
      setHasNext(combinedHasNext);
    } catch (err: any) {
      if (rid !== requestIdRef.current) return;
      setError(err?.message || 'Failed to load assets');
    } finally {
      if (rid === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedQuery, selectedCategory, selectedFormat, assets]);

  // ─── Load More ────────────────────────────────────────────────
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchAssets(nextPage, false);
  };

  // ─── Insert asset into canvas ─────────────────────────────────
  const handleUseAsset = async (asset: UnifiedAsset) => {
    if (!canvasManager) return;
    setIsInserting(asset.id);
    setError(null);

    try {
      if (asset.provider === 'admin') {
        // 1. Admin shape asset
        if (
          asset.asset_type === 'shape' ||
          asset._adminAsset?.asset_type === 'shape'
        ) {
          const rawUrl = asset._adminAsset?.file_url || (asset._adminAsset as any)?.asset_url || asset.preview_url;
          if (!rawUrl) return;
          const adminAsset = asset._adminAsset;
          const settings = {
            ...(typeof adminAsset?.fabric_json === 'object' ? adminAsset.fabric_json : {}),
            ...(typeof adminAsset?.metadata === 'object' ? adminAsset.metadata : {}),
            ...(typeof adminAsset?.metadata?.shape === 'object' ? adminAsset.metadata.shape : {}),
          };
          const added = await canvasManager.addCustomPhotoShape(formatImageUrl(rawUrl), {
            assetId: asset.provider_asset_id,
            name: asset.title,
            provider: 'admin',
            originalSrc: formatImageUrl(rawUrl),
            photoFit: settings.photoFit === 'contain' ? 'contain' : 'cover',
            fill: typeof settings.fill === 'string' ? settings.fill : '#111111',
            recolourable: settings.recolourable !== false,
            allowPhotoDrop: settings.allowPhotoDrop !== false,
          });
          if (added) {
            rememberShape(asset.provider_asset_id || asset.id.replace('admin:', ''));
          }
          return;
        }

        // 2. Admin frame asset
        if (
          asset.asset_type === 'frame' ||
          asset._adminAsset?.asset_type === 'frame'
        ) {
          const rawUrl = asset._adminAsset?.file_url || (asset._adminAsset as any)?.asset_url || asset.preview_url;
          const maskUrl = asset._adminAsset?.metadata?.maskUrl || asset._adminAsset?.metadata?.frame?.maskUrl || null;
          const photoFit = asset._adminAsset?.metadata?.frame?.photoFit || asset._adminAsset?.metadata?.photoFit || 'cover';
          const shape = asset._adminAsset?.metadata?.shape || asset._adminAsset?.metadata?.frame?.shape || 'rounded-rect';
          if (rawUrl) {
            await canvasManager.addFrameAsset(formatImageUrl(rawUrl), {
              assetId: asset.provider_asset_id,
              name: asset.title,
              provider: 'admin',
              maskUrl: maskUrl ? formatImageUrl(maskUrl) : undefined,
              photoFit: photoFit as any,
              shape,
            });
          } else {
            canvasManager.addFrame(shape as any);
          }
          return;
        }

        // 2. Admin typography / text asset
        if (asset.asset_type === 'text' || asset._adminAsset?.asset_type === 'text') {
          if (asset._adminAsset?.fabric_json) {
            canvasManager.addText({
              text: asset._adminAsset.fabric_json.text || asset.title,
              fontFamily: asset._adminAsset.fabric_json.fontFamily || 'Inter',
              fontSize: asset._adminAsset.fabric_json.fontSize || 24,
              fontWeight: asset._adminAsset.fabric_json.fontWeight || 'normal',
              fill: asset._adminAsset.fabric_json.fill || '#111111',
              textAlign: asset._adminAsset.fabric_json.textAlign || 'center',
            });
          }
          return;
        }

        // 3. Admin photo / element / background / vector graphic
        const rawUrl = asset._adminAsset?.file_url || (asset._adminAsset as any)?.asset_url || asset.preview_url;
        if (!rawUrl) return;

        const isUnrenderable = (u?: string | null) => {
          if (!u) return false;
          const clean = u.split('?')[0].toLowerCase();
          return clean.endsWith('.tif') || clean.endsWith('.tiff') || clean.endsWith('.pdf');
        };

        const renderUrl = isUnrenderable(rawUrl)
          ? (asset._adminAsset?.thumbnail_url || (asset._adminAsset as any)?.asset_thumbnail_url || asset.thumbnail_url || rawUrl)
          : rawUrl;

        const originalSourceUrl = unwrapProxyImageUrl(rawUrl);
        const metadata: Record<string, unknown> = {
          name: asset.title,
          assetId: asset.id,
          provider: 'admin',
          providerAssetId: asset.provider_asset_id,
          sourceType: asset.asset_type,
          originalSrc: originalSourceUrl,
          sourceUrl: originalSourceUrl,
          editable: true,
        };

        const isSvg =
          asset.is_vector ||
          rawUrl.toLowerCase().split('?')[0].endsWith('.svg') ||
          renderUrl.toLowerCase().split('?')[0].endsWith('.svg');

        if (isSvg) {
          await canvasManager.addSvgFromUrl(formatImageUrl(renderUrl), {
            ...metadata,
          } as any);
        } else {
          await canvasManager.addImageFromUrl(
            formatImageUrl(renderUrl),
            { ...metadata } as any,
            { skipFrameSlotting: true, fitToArtworkInsetMm: 20 }
          );
        }

        preserveActiveObjectSource(
          canvasManager,
          originalSourceUrl,
          metadata
        );
      } else {
        // External asset — hit the /use endpoint
        const res = await externalAssetService.useAsset(asset.provider, asset.provider_asset_id);
        const useData = res?.data as any;
        const returnedUrl =
          useData?.file_url ||
          useData?.image_url ||
          useData?.storage_url ||
          useData?.url;

        if (!res?.success || !returnedUrl) {
          throw new Error('The asset provider did not return a usable image URL.');
        }

        const stableUrl = unwrapProxyImageUrl(returnedUrl);
        const publicOriginalUrl = unwrapProxyImageUrl(
          useData?.original_url ||
          useData?.source_url ||
          stableUrl
        );

        const metadata: any = {
          name: asset.title,
          assetId: asset.id,
          provider: asset.provider,
          providerAssetId: asset.provider_asset_id,
          sourceType: asset.asset_type,
          attribution: asset.attribution,
          license: asset.license,
          editable: true,
          originalSrc: publicOriginalUrl,
          sourceUrl: publicOriginalUrl,
        };

        const isRasterUrl = /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(stableUrl);

        if (!isRasterUrl && asset.is_vector && (asset.format === 'svg' || stableUrl.toLowerCase().includes('.svg'))) {
          await canvasManager.addSvgFromUrl(stableUrl, metadata);
        } else {
          await canvasManager.addImageFromUrl(
            stableUrl,
            metadata,
            { skipFrameSlotting: true, fitToArtworkInsetMm: 20 }
          );
        }

        preserveActiveObjectSource(
          canvasManager,
          publicOriginalUrl,
          metadata
        );
      }
    } catch (err: unknown) {
      console.error('Failed to add element:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to add this element to the canvas.'
      );
    } finally {
      setIsInserting(null);
    }
  };

  // ─── Drag and Drop directly onto canvas ──────────────────────────
  const handleDragStart = (e: React.DragEvent, asset: UnifiedAsset) => {
    let rawUrl =
      asset._adminAsset?.file_url ||
      (asset._adminAsset as any)?.asset_url ||
      asset.preview_url ||
      asset.thumbnail_url;

    if (!rawUrl) {
      e.preventDefault();
      return;
    }

    const clean = rawUrl.split('?')[0].toLowerCase();
    const isUnrenderable =
      clean.endsWith('.tif') || clean.endsWith('.tiff') || clean.endsWith('.pdf');
    if (isUnrenderable && asset.thumbnail_url) {
      rawUrl = asset.thumbnail_url;
    }

    const targetUrl =
      asset.provider === 'admin' ? formatImageUrl(rawUrl) : rawUrl;

    e.dataTransfer.setData('text/plain', targetUrl);
    e.dataTransfer.setData(
      'application/x-element-json',
      JSON.stringify({
        id: asset.id,
        title: asset.title,
        url: targetUrl,
        thumbnail_url: asset.thumbnail_url,
        provider: asset.provider,
        providerAssetId: asset.provider_asset_id,
        asset_type: asset.asset_type,
        format: asset.format,
        is_vector: asset.is_vector,
        adminAsset: asset._adminAsset,
      })
    );
    e.dataTransfer.setData('application/x-element-id', asset.id);
    e.dataTransfer.setData('application/x-element-type', asset.asset_type);
    e.dataTransfer.effectAllowed = 'copy';

    // Ghost drag preview
    try {
      const ghost = document.createElement('div');
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      ghost.style.width = '70px';
      ghost.style.height = '70px';
      ghost.style.borderRadius = '12px';
      ghost.style.backgroundColor = '#ffffff';
      ghost.style.boxShadow = '0 10px 25px rgba(0,0,0,0.18)';
      ghost.style.border = '1px solid rgba(139, 61, 255, 0.4)';
      ghost.style.display = 'flex';
      ghost.style.alignItems = 'center';
      ghost.style.justifyContent = 'center';
      ghost.style.overflow = 'hidden';

      if (asset.thumbnail_url && !isUnrenderableFormat(asset.format, asset.thumbnail_url)) {
        const img = document.createElement('img');
        img.src =
          asset.provider === 'admin'
            ? formatImageUrl(asset.thumbnail_url)
            : asset.thumbnail_url;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        ghost.appendChild(img);
      } else {
        const label = document.createElement('span');
        label.textContent = (asset.format || 'ITEM').toUpperCase();
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        label.style.color = '#7c3aed';
        ghost.appendChild(label);
      }

      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 35, 35);
      setTimeout(() => {
        if (document.body.contains(ghost)) {
          document.body.removeChild(ghost);
        }
      }, 500);
    } catch {
      // ignore
    }
  };

  // ─── Shape-specific click & drag handlers ───────────────────────
  const handleUseShapeAsset = async (shape: DesignAsset) => {
    if (!canvasManager) return;
    const rawUrl = shape.file_url || (shape as any).asset_url;
    if (!rawUrl) return;

    setIsInserting(shape.id);
    try {
      const metadata = (typeof shape.metadata === 'object' ? shape.metadata : {}) || {};
      const settings = {
        ...(typeof shape.fabric_json === 'object' ? shape.fabric_json : {}),
        ...metadata,
        ...(typeof metadata.shape === 'object' ? metadata.shape : {}),
      };

      const added = await canvasManager.addCustomPhotoShape(formatImageUrl(rawUrl), {
        assetId: shape.id,
        provider: shape.provider || 'admin',
        name: shape.name,
        originalSrc: formatImageUrl(rawUrl),
        photoFit: settings.photoFit === 'contain' ? 'contain' : 'cover',
        fill: typeof settings.fill === 'string' ? settings.fill : '#111111',
        recolourable: settings.recolourable !== false,
        allowPhotoDrop: settings.allowPhotoDrop !== false,
      });

      if (added) {
        rememberShape(shape.id);
      }
    } catch (err) {
      console.error('Failed to add shape in ElementsPanel:', err);
    } finally {
      setIsInserting(null);
    }
  };

  const handleShapeDragStart = (e: React.DragEvent, shape: DesignAsset) => {
    const rawUrl = shape.file_url || (shape as any).asset_url;
    if (!rawUrl) return;
    const formattedUrl = formatImageUrl(rawUrl);

    e.dataTransfer.setData('text/plain', formattedUrl);
    e.dataTransfer.setData(
      'application/x-element-json',
      JSON.stringify({
        id: `admin:${shape.id}`,
        title: shape.name,
        url: formattedUrl,
        provider: shape.provider || 'admin',
        providerAssetId: shape.id,
        asset_type: 'shape',
        is_vector: true,
        format: 'svg',
        adminAsset: shape,
      })
    );
    e.dataTransfer.effectAllowed = 'copy';

    try {
      const ghost = document.createElement('div');
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      ghost.style.left = '-9999px';
      ghost.style.width = '64px';
      ghost.style.height = '64px';
      ghost.style.borderRadius = '12px';
      ghost.style.background = '#ffffff';
      ghost.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
      ghost.style.display = 'flex';
      ghost.style.alignItems = 'center';
      ghost.style.justifyContent = 'center';
      ghost.style.padding = '8px';
      ghost.style.zIndex = '999999';

      const thumb = shape.thumbnail_url || (shape as any).asset_thumbnail_url || rawUrl;
      const img = document.createElement('img');
      img.src = formatImageUrl(thumb);
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      ghost.appendChild(img);

      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 32, 32);
      setTimeout(() => {
        if (document.body.contains(ghost)) {
          document.body.removeChild(ghost);
        }
      }, 500);
    } catch {
      // ignore
    }
  };

  const renderShapeCard = (shape: DesignAsset, compact = true) => {
    const rawThumb =
      shape.thumbnail_url ||
      (shape as any).asset_thumbnail_url ||
      shape.file_url ||
      (shape as any).asset_url ||
      '';
    const thumbSrc = rawThumb ? formatImageUrl(rawThumb) : '';
    const isInsertingCurrent = isInserting === shape.id;

    return (
      <button
        key={shape.id}
        type="button"
        draggable
        onDragStart={(e) => handleShapeDragStart(e, shape)}
        onClick={() => void handleUseShapeAsset(shape)}
        disabled={Boolean(isInserting)}
        title={`Click to add or drag onto canvas (${shape.name})`}
        className={`${compact ? 'w-[64px] shrink-0' : 'w-full'} group text-left cursor-grab active:cursor-grabbing select-none disabled:cursor-wait disabled:opacity-60`}
      >
        <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50/80 p-2 transition-all duration-200 group-hover:scale-105 group-hover:border-purple-300 group-hover:bg-purple-50 group-hover:shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-purple-500">
          {thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt={shape.name}
              loading="lazy"
              draggable={false}
              className="h-full w-full object-contain pointer-events-none"
            />
          ) : (
            <Shapes className="h-7 w-7 text-[#f4b400]" />
          )}
          {isInsertingCurrent && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/75 rounded-xl">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
            </span>
          )}
        </span>

      </button>
    );
  };

  const renderUnifiedHorizontalCard = (asset: UnifiedAsset) => {
    const isThumbBroken =
      brokenThumbs[asset.id] ||
      isUnrenderableFormat(asset.format, asset.thumbnail_url);
    const thumbSrc =
      asset.provider === 'admin' && asset.thumbnail_url
        ? formatImageUrl(asset.thumbnail_url)
        : asset.thumbnail_url;
    const isInsertingCurrent = isInserting === asset.id;

    return (
      <button
        key={asset.id}
        type="button"
        draggable
        onDragStart={(e) => handleDragStart(e, asset)}
        onClick={() => void handleUseAsset(asset)}
        disabled={Boolean(isInserting)}
        title={`Click to add or drag onto canvas (${asset.title})`}
        className="w-[64px] shrink-0 group text-left cursor-grab active:cursor-grabbing select-none disabled:cursor-wait disabled:opacity-60"
      >
        <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50/80 p-1.5 transition-all duration-200 group-hover:scale-105 group-hover:border-purple-300 group-hover:bg-purple-50 group-hover:shadow-sm">
          {!isThumbBroken && thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt={asset.title}
              loading="lazy"
              draggable={false}
              className={`h-full w-full pointer-events-none ${asset.is_vector || asset.asset_type === 'icon' || asset.asset_type === 'frame'
                ? 'object-contain'
                : 'object-cover rounded-lg'
                }`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center w-full h-full">
              <ImageIcon className="w-5 h-5 text-purple-400" />
            </div>
          )}
          {isInsertingCurrent && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/75 rounded-xl">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
            </span>
          )}
        </span>

      </button>
    );
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* ──────── Header ──────── */}
      <div className="flex-none px-4 pt-4 pb-1">
        <h2 className="text-[14px] font-bold text-gray-900 mb-3 tracking-wide flex items-center gap-2">
          <Shapes className="w-4 h-4 text-purple-600" />
          Elements
        </h2>

        {/* Search */}
        <div className="relative w-full mb-2.5">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400 transition-all"
            placeholder="Search elements..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 transition"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Filters Toggle (hide when browsing Shapes or All overview without search) */}
        {selectedCategory !== 'Shapes' && (Boolean(debouncedQuery) || selectedCategory !== 'All') && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-purple-600 font-medium mb-1 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            {showFilters ? 'Hide' : 'Show'} filters
          </button>
        )}

        {/* Expanded Filters */}
        {showFilters && selectedCategory !== 'Shapes' && (
          <div className="mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-400 transition"
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && assets.length > 0 && selectedCategory !== 'Shapes' && (
        <div className="mx-4 mb-2 flex-none rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[11px] font-medium leading-4 text-red-700">
            {error}
          </p>
        </div>
      )}

      {/* ──────── Shapes View (Canva style matching screenshot) ──────── */}
      {selectedCategory === 'Shapes' ? (
        activeExpandedShapeSection ? (
          /* Expanded shape category drill-down */
          <div className="flex flex-col flex-1 min-h-0 bg-white">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-gray-100 px-4 mb-2">
              <button
                type="button"
                onClick={() => setExpandedShapeSectionId(null)}
                title="Back to all shapes"
                className="rounded-lg p-1 text-gray-600 hover:bg-gray-100 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="truncate text-xs font-bold text-[#f4b400]">
                {activeExpandedShapeSection.name}
              </h3>
              <span className="ml-auto text-[10px] text-gray-400 font-medium">
                {activeExpandedShapeSection.assets.length}
              </span>
            </div>
            <div className="grid grid-cols-4 content-start gap-x-2 gap-y-3 overflow-y-auto px-4 pb-20 custom-scrollbar">
              {activeExpandedShapeSection.assets.map((shape: DesignAsset) =>
                renderShapeCard(shape, false)
              )}
            </div>
          </div>
        ) : debouncedQuery ? (
          /* Search results within shapes */
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-20 custom-scrollbar">
            <div className="mb-2 flex items-center justify-between pt-1">
              <h4 className="text-[11px] font-bold text-gray-700">Search results</h4>
              <span className="text-[10px] text-gray-400">
                {shapeSections.reduce((acc: number, s: ShapeSection) => acc + s.assets.length, 0)}
              </span>
            </div>
            <div className="grid grid-cols-4 content-start gap-x-2 gap-y-3">
              {shapeSections.flatMap((s: ShapeSection) => s.assets).map((shape: DesignAsset) =>
                renderShapeCard(shape, false)
              )}
            </div>
          </div>
        ) : (
          /* Canva categorized Shapes view: Recently used, Basic shapes, Polygons... */
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-20 custom-scrollbar space-y-4 pt-1">
            {recentShapeAssets.length > 0 && (
              <section>
                <div className="mb-2">
                  <h4 className="text-[11px] font-bold text-[#f4b400] tracking-tight">
                    Recently used
                  </h4>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                  {recentShapeAssets.slice(0, 10).map((shape: DesignAsset) => renderShapeCard(shape))}
                </div>
              </section>
            )}

            {shapeSections.map((section: ShapeSection) => (
              <section key={section.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="truncate pr-2 text-[11px] font-bold text-[#f4b400] tracking-tight">
                    {section.name}
                  </h4>
                  {section.assets.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setExpandedShapeSectionId(section.id)}
                      className="shrink-0 text-[10px] font-semibold text-amber-500 hover:text-amber-600 transition"
                    >
                      See all
                    </button>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                  {section.assets.slice(0, 8).map((shape: DesignAsset) => renderShapeCard(shape))}
                </div>
              </section>
            ))}

            {loadingShapes && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                Loading shapes...
              </div>
            )}

            {!loadingShapes && shapeSections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <Shapes className="w-10 h-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">No shapes found</p>
              </div>
            )}
          </div>
        )
      ) : selectedCategory === 'All' && !debouncedQuery ? (
        /* ──────── Canva Overview: Shapes, Frames, Graphics, Photos ──────── */
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-20 custom-scrollbar space-y-4 pt-1">
          {recentShapeAssets.length > 0 && (
            <section>
              <div className="mb-2">
                <h4 className="text-[11px] font-bold text-[#f4b400] tracking-tight">
                  Recently used
                </h4>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                {recentShapeAssets.slice(0, 8).map((shape: DesignAsset) => renderShapeCard(shape))}
              </div>
            </section>
          )}

          {/* Shapes section */}
          {shapeAssets.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-[#f4b400] tracking-tight">
                  Shapes
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('Shapes')}
                  className="text-[10px] font-semibold text-gray-500 hover:text-purple-600 transition"
                >
                  See all
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                {shapeAssets.slice(0, 8).map((shape: DesignAsset) => renderShapeCard(shape))}
              </div>
            </section>
          )}

          {/* Frames section */}
          {frameAssets.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-[#f4b400] tracking-tight">
                  Frames
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectTab) onSelectTab('frames');
                    else setSelectedCategory('Frames');
                  }}
                  className="text-[10px] font-semibold text-gray-500 hover:text-purple-600 transition"
                >
                  See all
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                {frameAssets.slice(0, 8).map((frame: UnifiedAsset) => renderUnifiedHorizontalCard(frame))}
              </div>
            </section>
          )}

          {/* Graphics section */}
          {graphicsAssets.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-[#f4b400] tracking-tight">
                  Graphics
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('Graphics')}
                  className="text-[10px] font-semibold text-gray-500 hover:text-purple-600 transition"
                >
                  See all
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                {graphicsAssets.slice(0, 8).map((item: UnifiedAsset) => renderUnifiedHorizontalCard(item))}
              </div>
            </section>
          )}

          {/* Photos section */}
          {photoAssets.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-[#f4b400] tracking-tight">
                  Photos
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('Photos')}
                  className="text-[10px] font-semibold text-gray-500 hover:text-purple-600 transition"
                >
                  See all
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                {photoAssets.slice(0, 8).map((item: UnifiedAsset) => renderUnifiedHorizontalCard(item))}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* ──────── Grid Content for Specific Categories / Search ──────── */
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-20 content-start">
          {loading ? (
            /* Loading Skeletons */
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-gray-100 animate-pulse"
                  style={{ aspectRatio: i % 3 === 0 ? '1 / 1.2' : '1 / 1' }}
                />
              ))}
            </div>
          ) : error && assets.length === 0 ? (
            /* Full Error State */
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">Failed to load elements</p>
              <p className="text-xs text-gray-500 max-w-[200px]">{error}</p>
              <button
                onClick={() => { setPage(1); setAssets([]); fetchAssets(1, true); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-50 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : assets.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <Shapes className="w-10 h-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No elements found</p>
              <p className="text-xs text-gray-400">Try a different search or filter</p>
            </div>
          ) : (
            <>
              {/* Masonry-style 2-column grid */}
              <div className="columns-2 gap-2.5 pt-1">
                {assets.map((asset) => {
                  const isThumbBroken =
                    brokenThumbs[asset.id] ||
                    isUnrenderableFormat(asset.format, asset.thumbnail_url);
                  const thumbSrc =
                    asset.provider === 'admin' && asset.thumbnail_url
                      ? formatImageUrl(asset.thumbnail_url)
                      : asset.thumbnail_url;

                  return (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, asset)}
                      onClick={() => handleUseAsset(asset)}
                      className="group relative mb-2.5 break-inside-avoid rounded-xl border border-gray-100 bg-white hover:border-purple-400 overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md hover:shadow-purple-100/50 select-none"
                      title={`Click to add or drag onto canvas (${asset.title})`}
                    >
                      {/* Thumbnail */}
                      <div
                        className="relative w-full flex items-center justify-center p-2"
                        style={{
                          minHeight: 80,
                          aspectRatio:
                            asset.is_vector || asset.asset_type === 'icon'
                              ? '1 / 1'
                              : `${asset.width} / ${asset.height}`,
                        }}
                      >
                        {!isThumbBroken && thumbSrc ? (
                          <Image
                            src={thumbSrc}
                            alt={asset.title}
                            fill
                            unoptimized
                            sizes="(max-width: 768px) 50vw, 200px"
                            className={`p-2 transition-transform duration-200 group-hover:scale-105 ${asset.is_vector ||
                              asset.asset_type === 'icon' ||
                              asset.asset_type === 'element'
                              ? 'object-contain'
                              : 'object-cover rounded-lg'
                              }`}
                            draggable={false}
                            onError={() =>
                              setBrokenThumbs((prev) => ({
                                ...prev,
                                [asset.id]: true,
                              }))
                            }
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center h-full w-full min-h-[80px] bg-gradient-to-br from-purple-50/70 to-slate-50 rounded-lg">
                            {asset.format.toLowerCase() === 'pdf' ? (
                              <FileText className="w-8 h-8 text-rose-500 mb-1" />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-purple-400 mb-1" />
                            )}
                            <span className="text-[10px] font-semibold text-gray-700 truncate max-w-[110px]">
                              {asset.title}
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-purple-600 bg-purple-100/80 px-1.5 py-0.5 rounded mt-0.5">
                              {asset.format.toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Inserting Spinner Overlay */}
                        {isInserting === asset.id && (
                          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-xl z-20">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                          </div>
                        )}
                        {/* Badge for Admin uploaded assets */}
                        {asset.provider === 'admin' && (
                          <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-purple-600/90 text-white text-[9px] font-bold tracking-wider uppercase shadow-xs backdrop-blur-xs flex items-center gap-0.5">
                            {asset.is_vector || asset.format === 'svg'
                              ? 'SVG'
                              : asset.asset_type === 'photo'
                                ? 'PHOTO'
                                : asset.asset_type && asset.asset_type !== 'element'
                                  ? asset.asset_type.toUpperCase()
                                  : (asset.format || 'ADMIN').toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-end pb-3 gap-1 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUseAsset(asset);
                          }}
                          disabled={isInserting === asset.id}
                          className="flex items-center gap-1 text-white text-[11px] font-semibold bg-purple-600/90 hover:bg-purple-700 px-3 py-1.5 rounded-lg backdrop-blur-sm shadow-lg transition disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More */}
              {hasNext && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 px-4 py-2 rounded-xl border border-purple-200 hover:bg-purple-50 transition disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
