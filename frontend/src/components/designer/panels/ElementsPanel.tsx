'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  Shapes, Search, Loader2, Plus, AlertTriangle, RefreshCw, ChevronDown, X,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { DesignAsset, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { externalAssetService } from '@/services/externalAssetService';
import { ExternalAsset, ExternalAssetCategory as ExtCat } from '@/types/externalAsset';
import { formatImageUrl } from '@/utils/imageUrl';

import { ActiveSidebarTab } from '@/types/designer';

// ─────────────────────────── Constants ───────────────────────────

const CATEGORY_CHIPS = [
  'All', 'Graphics', 'Photos', 'Icons', 'Illustrations',
  'Shapes', 'Stickers', 'Frames', 'Backgrounds',
] as const;

const FORMAT_OPTIONS = ['All', 'SVG', 'PNG', 'JPG', 'Photo'] as const;

const PROVIDER_OPTIONS = [
  { value: 'all', label: 'All providers' },
  { value: 'magnific', label: 'Magnific' },
  { value: 'freepik', label: 'Freepik' },
  { value: 'admin', label: 'Admin library' },
] as const;

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

function adminToUnified(a: DesignAsset): UnifiedAsset {
  const fileUrl = a.file_url || (a as any).asset_url || '';
  const thumbUrl = a.thumbnail_url || (a as any).asset_thumbnail_url || fileUrl;
  const rawPath = a.file_path || fileUrl;
  const ext = (rawPath.split('?')[0] || '').split('.').pop()?.toLowerCase() || 'png';
  const isVector = ext === 'svg' || Boolean(a.metadata?.is_vector);

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

function externalToUnified(e: ExternalAsset): UnifiedAsset {
  return {
    id: e.id,
    title: e.title,
    thumbnail_url: e.thumbnail_url,
    preview_url: e.preview_url,
    provider: e.provider,
    provider_asset_id: e.provider_asset_id,
    asset_type: e.asset_type,
    format: e.format,
    is_vector: e.is_vector,
    attribution: e.attribution,
    license: e.license,
    width: e.width || 400,
    height: e.height || 400,
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
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const [assets, setAssets] = useState<UnifiedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isInserting, setIsInserting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

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
  }, [debouncedQuery, selectedCategory, selectedProvider, selectedFormat]);

  // ─── Core fetch ───────────────────────────────────────────────
  const fetchAssets = useCallback(async (targetPage: number, isReset: boolean) => {
    const rid = ++requestIdRef.current;

    if (isReset) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    setProviderErrors({});

    try {
      const adminResults: UnifiedAsset[] = [];
      const externalResults: UnifiedAsset[] = [];
      let combinedHasNext = false;
      const pErrors: Record<string, string> = {};

      // 1. Admin library FIRST (when 'all' or 'admin') - loaded on initial/reset page
      if (selectedProvider === 'all' || selectedProvider === 'admin') {
        if (targetPage === 1) {
          try {
            const adminRes = await designAssetService.getPublicAssets({
              asset_type: 'all',
              per_page: 100,
              search: debouncedQuery || undefined,
            });
            if (rid !== requestIdRef.current) return;

            const adminItems = (adminRes.data || []).map(adminToUnified);
            // Filter by category / format client-side for admin assets
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
          } catch (err: any) {
            console.error('Admin assets error', err);
            pErrors['admin'] = err?.message || 'Admin library failed';
          }
        }
      }

      // 2. External APIs (unless user picked admin-only)
      if (selectedProvider !== 'admin') {
        try {
          const params: Record<string, string | number> = {
            provider: selectedProvider === 'admin' ? 'all' : selectedProvider,
            query: debouncedQuery,
            page: targetPage,
            per_page: 30,
          };
          if (selectedCategory !== 'All') params.category = selectedCategory;
          if (selectedFormat !== 'All') params.format = selectedFormat.toLowerCase();

          const res = await externalAssetService.search(params);
          if (rid !== requestIdRef.current) return; // stale

          if (res?.success && res.data) {
            externalResults.push(...(res.data.items || []).map(externalToUnified));
            if (res.data.pagination?.has_next) combinedHasNext = true;

            // Collect partial errors
            if (res.data.providers) {
              for (const [pName, pInfo] of Object.entries(res.data.providers)) {
                if (!pInfo.success && pInfo.error) {
                  pErrors[pName] = pInfo.error;
                }
              }
            }
          }
        } catch (err: any) {
          console.error('External search error', err);
          pErrors['external'] = err?.message || 'External search failed';
        }
      }

      // Priority ordering: Admin Library assets (Photos, SVGs, Graphics) are at the FRONT!
      const results = [...adminResults, ...externalResults];

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
      setProviderErrors(pErrors);

      if (Object.keys(pErrors).length > 0 && deduped.length === 0) {
        setError('All providers failed to load assets.');
      }
    } catch (err: any) {
      if (rid !== requestIdRef.current) return;
      setError(err?.message || 'Failed to load assets');
    } finally {
      if (rid === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedQuery, selectedCategory, selectedProvider, selectedFormat, assets]);

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
        // 1. Admin frame or shape asset
        if (
          asset.asset_type === 'frame' ||
          asset.asset_type === 'shape' ||
          asset._adminAsset?.asset_type === 'frame' ||
          asset._adminAsset?.asset_type === 'shape'
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
          await canvasManager.addImageFromUrl(formatImageUrl(renderUrl), {
            ...metadata,
          } as any);
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
          await canvasManager.addImageFromUrl(stableUrl, metadata);
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

  // ─── Render ───────────────────────────────────────────────────
  const hasProviderWarnings = Object.keys(providerErrors).length > 0 && assets.length > 0;

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

        {/* Category Chips */}
        <div
          ref={categoryScrollRef}
          className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {CATEGORY_CHIPS.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                if (cat === 'Frames' && onSelectTab) {
                  onSelectTab('frames');
                  return;
                }
                setSelectedCategory(cat);
              }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap transition-all ${selectedCategory === cat
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filters Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-purple-600 font-medium mb-1 transition-colors"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          {showFilters ? 'Hide' : 'Show'} filters
        </button>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="flex gap-2 mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="flex-1 text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-400 transition"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="flex-1 text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-400 transition"
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ──────── Partial-Error Banner ──────── */}
      {hasProviderWarnings && (
        <div className="flex-none mx-4 mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-700">
            Some providers couldn&apos;t load:{' '}
            {Object.entries(providerErrors).map(([k]) => k).join(', ')}
          </p>
        </div>
      )}

      {error && assets.length > 0 && (
        <div className="mx-4 mb-2 flex-none rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[11px] font-medium leading-4 text-red-700">
            {error}
          </p>
        </div>
      )}

      {/* ──────── Grid Content ──────── */}
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
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => handleUseAsset(asset)}
                  className="group relative mb-2.5 break-inside-avoid rounded-xl border border-gray-100 bg-white hover:border-purple-400 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:shadow-purple-100/50"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative w-full flex items-center justify-center p-2"
                    style={{
                      minHeight: 80,
                      aspectRatio: asset.is_vector || asset.asset_type === 'icon'
                        ? '1 / 1'
                        : `${asset.width} / ${asset.height}`,
                    }}
                  >
                    <Image
                      src={
                        asset.provider === 'admin'
                          ? formatImageUrl(asset.thumbnail_url)
                          : asset.thumbnail_url
                      }
                      alt={asset.title}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 50vw, 200px"
                      className={`p-2 transition-transform duration-200 group-hover:scale-105 ${asset.is_vector || asset.asset_type === 'icon' || asset.asset_type === 'element'
                        ? 'object-contain'
                        : 'object-cover rounded-lg'
                        }`}
                      draggable={false}
                    />

                    {/* Inserting Spinner Overlay */}
                    {isInserting === asset.id && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-xl">
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
                              : 'ADMIN'}
                      </div>
                    )}
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-end pb-3 gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUseAsset(asset); }}
                      disabled={isInserting === asset.id}
                      className="flex items-center gap-1 text-white text-[11px] font-semibold bg-purple-600/90 hover:bg-purple-700 px-3 py-1.5 rounded-lg backdrop-blur-sm shadow-lg transition disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>

                  </div>
                </div>
              ))}
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
    </div>
  );
};
