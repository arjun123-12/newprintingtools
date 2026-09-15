'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Loader2, RefreshCw, Search, Shapes, X } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';
import {
  DesignAsset,
  DesignAssetCategory,
  designAssetService,
} from '@/services/designAssetService';
import { formatImageUrl } from '@/utils/imageUrl';

interface ShapesPanelProps {
  canvasManager: CanvasManager | null;
  selected?: SelectedObjectState | null;
}

interface ShapeSection {
  id: string;
  name: string;
  sortOrder: number;
  assets: DesignAsset[];
}

const RECENT_SHAPES_KEY = 'print_designer_recent_shape_ids';
const ROW_PREVIEW_LIMIT = 6;
const PAGE_SIZE = 100;

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

function getAssetUrl(asset: DesignAsset): string | null {
  const raw = asset.file_url || (asset as any).asset_url;
  return raw ? formatImageUrl(raw) : null;
}

function getThumbnailUrl(asset: DesignAsset): string | null {
  const raw =
    asset.thumbnail_url ||
    (asset as any).asset_thumbnail_url ||
    asset.file_url ||
    (asset as any).asset_url;
  return raw ? formatImageUrl(raw) : null;
}

/**
 * Keep a newly inserted photo-frame/shape above existing artwork.
 *
 * addCustomPhotoShape implementations commonly return either the new Fabric
 * object or a boolean. When it returns a boolean, the inserted object is the
 * canvas' active object, so use that as the fallback.
 */
function bringAddedShapeToFront(
  canvasManager: CanvasManager,
  addedResult: unknown
): void {
  const manager = canvasManager as any;
  const canvas = manager.getCanvas?.() || manager.canvas;
  if (!canvas) return;

  const returnedObject =
    addedResult && typeof addedResult === 'object' ? addedResult : null;
  const target = returnedObject || canvas.getActiveObject?.();
  if (!target) return;

  const promote = () => {
    // Fabric 6/7 keeps z-order methods on Canvas. The object method is kept as
    // a fallback for projects still using an older Fabric-compatible build.
    if (typeof canvas.bringObjectToFront === 'function') {
      canvas.bringObjectToFront(target);
    } else if (typeof target.bringToFront === 'function') {
      target.bringToFront();
    }

    target.setCoords?.();
    canvas.requestRenderAll?.();
  };

  promote();

  // Some frame builders finish grouping/clipping on the next animation frame.
  // Promote once more after that work so the frame cannot fall under a shape.
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(promote);
  }
}

function sortAssets(items: DesignAsset[]): DesignAsset[] {
  return [...items].sort((a, b) => {
    const order = Number(a.sort_order || 0) - Number(b.sort_order || 0);
    return order || a.name.localeCompare(b.name);
  });
}

async function fetchAllPublicShapes(): Promise<DesignAsset[]> {
  const first = await designAssetService.getPublicAssets({
    asset_type: 'shape',
    page: 1,
    per_page: PAGE_SIZE,
    sort: 'sort_order',
  });
  const pages = [first];
  const lastPage = Math.max(1, Number(first.last_page) || 1);

  if (lastPage > 1) {
    pages.push(
      ...(await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, index) =>
          designAssetService.getPublicAssets({
            asset_type: 'shape',
            page: index + 2,
            per_page: PAGE_SIZE,
            sort: 'sort_order',
          })
        )
      ))
    );
  }

  const unique = new Map<string, DesignAsset>();
  pages.flatMap((page) => page.data || []).forEach((asset) => {
    if (
      asset.asset_type === 'shape' &&
      asset.is_active !== false &&
      getAssetUrl(asset)
    ) {
      unique.set(asset.id, asset);
    }
  });
  return sortAssets([...unique.values()]);
}

export const ShapesPanel: React.FC<ShapesPanelProps> = ({ canvasManager }) => {
  const [assets, setAssets] = useState<DesignAsset[]>([]);
  const [categories, setCategories] = useState<DesignAssetCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_SHAPES_KEY) || '[]');
      if (Array.isArray(parsed)) {
        setRecentIds(parsed.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      setRecentIds([]);
    }
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2200);
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [categoryRows, shapeRows] = await Promise.all([
        designAssetService.getPublicCategories('shape'),
        fetchAllPublicShapes(),
      ]);
      setCategories(
        (categoryRows || [])
          .filter((item) => item.asset_type === 'shape' && item.is_active !== false)
          .sort((a, b) =>
            Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
            a.name.localeCompare(b.name)
          )
      );
      setAssets(shapeRows);
    } catch (err: any) {
      console.error('Failed to load DB shape library:', err);
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Could not load shapes from the database.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const query = searchQuery.trim().toLowerCase();
  const filteredAssets = useMemo(() => {
    if (!query) return assets;
    return assets.filter((asset) => {
      const categoryName =
        categoryById.get(String(asset.category_id || ''))?.name ||
        asset.category?.name ||
        '';
      return [asset.name, asset.slug, categoryName].some((value) =>
        String(value || '').toLowerCase().includes(query)
      );
    });
  }, [assets, categoryById, query]);

  const sections = useMemo<ShapeSection[]>(() => {
    const result = categories.map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: Number(category.sort_order || 0),
      assets: filteredAssets.filter(
        (asset) =>
          String(asset.category_id || asset.category?.id || '') === category.id
      ),
    }));
    const knownIds = new Set(categories.map((category) => category.id));
    const other = filteredAssets.filter((asset) => {
      const id = String(asset.category_id || asset.category?.id || '');
      return !id || !knownIds.has(id);
    });
    if (other.length) {
      result.push({
        id: '__uncategorized__',
        name: 'Other shapes',
        sortOrder: Number.MAX_SAFE_INTEGER,
        assets: other,
      });
    }
    return result
      .filter((section) => section.assets.length)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [categories, filteredAssets]);

  const recentAssets = useMemo(() => {
    if (query) return [];
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((asset): asset is DesignAsset => Boolean(asset));
  }, [assets, query, recentIds]);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === expandedSectionId) || null,
    [expandedSectionId, sections]
  );

  useEffect(() => {
    if (expandedSectionId && !activeSection) setExpandedSectionId(null);
  }, [activeSection, expandedSectionId]);

  const rememberShape = useCallback((id: string) => {
    setRecentIds((previous) => {
      const next = [id, ...previous.filter((item) => item !== id)].slice(0, 12);
      try {
        localStorage.setItem(RECENT_SHAPES_KEY, JSON.stringify(next));
      } catch {
        // Recent history is optional.
      }
      return next;
    });
  }, []);

  const applyShape = useCallback(async (asset: DesignAsset) => {
    if (!canvasManager || applyingId) return;
    const url = getAssetUrl(asset);
    if (!url) return showNotice(`${asset.name} has no shape file.`);

    try {
      setApplyingId(asset.id);
      const metadata = toPlainObject(asset.metadata);
      const settings = {
        ...toPlainObject(asset.fabric_json),
        ...metadata,
        ...toPlainObject(metadata.shape),
      };
      const added = await canvasManager.addCustomPhotoShape(url, {
        assetId: asset.id,
        provider: asset.provider || 'admin',
        name: asset.name,
        originalSrc: url,
        photoFit: settings.photoFit === 'contain' ? 'contain' : 'cover',
        fill: typeof settings.fill === 'string' ? settings.fill : '#111111',
        recolourable: settings.recolourable !== false,
        allowPhotoDrop: settings.allowPhotoDrop !== false,
      });
      if (!added) {
        showNotice(`${asset.name} needs a valid closed SVG path.`);
        return;
      }

      bringAddedShapeToFront(canvasManager, added);
      rememberShape(asset.id);
      showNotice(`${asset.name} added to artwork.`);
    } catch (err) {
      console.error('Failed to add DB shape:', err);
      showNotice(`Failed to add ${asset.name}.`);
    } finally {
      setApplyingId(null);
    }
  }, [applyingId, canvasManager, rememberShape, showNotice]);

  const shapeButton = (asset: DesignAsset, compact = true) => {
    const thumbnail = getThumbnailUrl(asset);
    const applying = applyingId === asset.id;
    return (
      <button
        key={asset.id}
        type="button"
        disabled={Boolean(applyingId)}
        onClick={() => void applyShape(asset)}
        title={asset.name}
        className={`${compact ? 'w-[62px] shrink-0' : 'w-full'} group text-left disabled:cursor-wait disabled:opacity-60`}
      >
        <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-transparent bg-gray-50 p-1.5 transition group-hover:border-purple-300 group-hover:bg-purple-50 group-focus-visible:ring-2 group-focus-visible:ring-purple-500">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
          ) : (
            <Shapes className="h-7 w-7 text-gray-800" />
          )}
          {applying && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/75">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
            </span>
          )}
        </span>
        <span className="mt-1 block truncate px-0.5 text-[10px] font-medium text-gray-600">
          {asset.name}
        </span>
      </button>
    );
  };

  if (activeSection) {
    return (
      <div className="flex h-full flex-col bg-white text-gray-900">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-100 px-3">
          <button type="button" onClick={() => setExpandedSectionId(null)} title="Back" className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="truncate text-sm font-bold">{activeSection.name}</h3>
          <span className="ml-auto text-[10px] text-gray-400">{activeSection.assets.length}</span>
        </div>
        <div className="grid flex-1 grid-cols-4 content-start gap-x-2 gap-y-4 overflow-y-auto p-3 custom-scrollbar">
          {activeSection.assets.map((asset) => shapeButton(asset, false))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-gray-900">
      <div className="shrink-0 border-b border-gray-100 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search shapes" className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-9 text-xs outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100" />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} title="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-200">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {notice && <div className="mx-3 mt-2 rounded-lg bg-gray-900 px-3 py-2 text-[11px] font-medium text-white shadow-lg">{notice}</div>}

      <div className="flex-1 overflow-y-auto pb-5 custom-scrollbar">
        {loading && <div className="flex items-center justify-center gap-2 py-14 text-xs text-gray-500"><Loader2 className="h-4 w-4 animate-spin text-purple-600" />Loading shapes…</div>}

        {!loading && error && (
          <div className="m-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <p>{error}</p>
            <button type="button" onClick={() => void loadLibrary()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 font-semibold hover:bg-red-100"><RefreshCw className="h-3.5 w-3.5" />Try again</button>
          </div>
        )}

        {!loading && !error && query && (
          <section className="py-3">
            <div className="mb-2 flex items-center justify-between px-3"><h4 className="text-[11px] font-bold text-gray-700">Search results</h4><span className="text-[10px] text-gray-400">{filteredAssets.length}</span></div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-4 px-3">{filteredAssets.map((asset) => shapeButton(asset, false))}</div>
          </section>
        )}

        {!loading && !error && !query && recentAssets.length > 0 && (
          <section className="border-b border-gray-100 py-3">
            <div className="mb-2 px-3"><h4 className="text-[11px] font-bold text-gray-700">Recently used</h4></div>
            <div className="flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide">{recentAssets.slice(0, ROW_PREVIEW_LIMIT).map((asset) => shapeButton(asset))}</div>
          </section>
        )}

        {!loading && !error && !query && sections.map((section) => (
          <section key={section.id} className="border-b border-gray-100 py-3 last:border-b-0">
            <div className="mb-2 flex items-center justify-between px-3">
              <h4 className="truncate pr-2 text-[11px] font-bold text-gray-700">{section.name}</h4>
              {section.assets.length > ROW_PREVIEW_LIMIT && <button type="button" onClick={() => setExpandedSectionId(section.id)} className="shrink-0 text-[10px] font-semibold text-gray-600 hover:text-purple-700">See all</button>}
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide">{section.assets.slice(0, ROW_PREVIEW_LIMIT).map((asset) => shapeButton(asset))}</div>
          </section>
        ))}

        {!loading && !error && filteredAssets.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Shapes className="mb-3 h-9 w-9 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">No shapes found</p>
            <p className="mt-1 text-xs leading-5 text-gray-400">{query ? 'Try a different search term.' : 'Add active shape assets and categories in the admin panel.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShapesPanel;
