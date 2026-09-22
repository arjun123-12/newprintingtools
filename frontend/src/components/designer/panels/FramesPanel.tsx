'use client';

import React, { useState, useEffect, useMemo } from 'react';
import NextImage from 'next/image';
import { Search, Shapes, X, Unlink } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { DesignAsset, designAssetService } from '@/services/designAssetService';
import { LoadingState, EmptyState } from '@/components/admin/shared';
import { FrameShapeType } from '@/types/designer';

interface FramesPanelProps {
  canvasManager: CanvasManager | null;
}

type JsonObject = Record<string, any>;

const asObject = (value: unknown): JsonObject => {
  if (!value) return {};
  if (typeof value === 'object') return value as JsonObject;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const firstString = (...values: unknown[]): string | undefined =>
  values.find(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0
  )?.trim();

const positiveNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue > 0) return numberValue;
  }
  return undefined;
};

const getFrameAssetConfig = (asset: DesignAsset) => {
  const metadata = asObject(asset.metadata);
  const frame = asObject(metadata.frame);
  const fabric = asObject(asset.fabric_json);

  return {
    overlayUrl: firstString(
      asset.file_url,
      frame.overlayUrl,
      frame.overlay_url,
      metadata.overlayUrl,
      metadata.overlay_url,
      asset.thumbnail_url
    ),
    maskUrl: firstString(
      frame.maskUrl,
      frame.mask_url,
      metadata.maskUrl,
      metadata.mask_url,
      fabric.maskUrl,
      fabric.mask_url
    ),
    maskType:
      firstString(frame.maskType, metadata.maskType, fabric.maskType) ||
      'svg_mask',
    photoFit: (firstString(
      frame.photoFit,
      metadata.photoFit,
      fabric.photoFit
    ) === 'contain'
      ? 'contain'
      : 'cover') as 'cover' | 'contain',
    shape:
      firstString(
        frame.shape,
        metadata.shape,
        fabric.shape,
        fabric.frameShape
      ) || 'custom-svg',
    width: positiveNumber(frame.width, metadata.width, fabric.width),
    height: positiveNumber(frame.height, metadata.height, fabric.height),
  };
};

export const FramesPanel: React.FC<FramesPanelProps> = ({
  canvasManager,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [adminFrames, setAdminFrames] = useState<DesignAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [canDetach, setCanDetach] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const assetsRes = await designAssetService.getPublicAssets({
          asset_type: 'frame',
          per_page: 50,
        });

        if (!isMounted) return;
        setAdminFrames(assetsRes.data || []);
      } catch (err) {
        console.error('Failed to load frames', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  /*
   * Keep the Detach Image action in sync with Fabric selection.
   * No frame internals are changed here; CanvasManager owns the operation.
   */
  useEffect(() => {
    if (!canvasManager) {
      setCanDetach(false);
      return;
    }

    const updateDetachState = () => {
      const active = canvasManager.getCanvas()?.getActiveObject();
      const isFrame = Boolean(active?.get?.('isFrame' as any));
      const isPlaceholder = Boolean(
        active?.get?.('isCanvaPlaceholder' as any)
      );
      setCanDetach(isFrame && !isPlaceholder);
    };

    updateDetachState();
    const unsubscribe = canvasManager.onSelectionChange(() => {
      updateDetachState();
    });

    return () => {
      unsubscribe();
    };
  }, [canvasManager]);

  const handleDetachImage = () => {
    if (!canvasManager || !canDetach) return;

    const active = canvasManager.getCanvas()?.getActiveObject();
    if (!active?.get?.('isFrame' as any)) return;

    void canvasManager.detachImageFromFrame(active);
  };

  const handleAddAdminFrame = (asset: DesignAsset) => {
    if (!canvasManager) return;

    const config = getFrameAssetConfig(asset);

    if (config.overlayUrl) {
      void canvasManager.addFrameAsset(config.overlayUrl, {
        assetId: asset.id,
        name: asset.name,
        provider: asset.provider || 'admin',
        overlayUrl: config.overlayUrl,
        maskUrl: config.maskUrl,
        maskType: config.maskType,
        photoFit: 'cover',
        shape: config.shape,
        width: config.width,
        height: config.height,
      });
    } else {
      canvasManager.addFrame('rounded-rect' as FrameShapeType);
    }
  };

  const filteredAdminFrames = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return adminFrames.filter((frame) => {
      return (
        !q ||
        frame.name.toLowerCase().includes(q) ||
        Boolean(
          frame.category?.name &&
          frame.category.name.toLowerCase().includes(q)
        )
      );
    });
  }, [adminFrames, searchQuery]);

  const totalResults = filteredAdminFrames.length;

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto custom-scrollbar bg-slate-50/50 select-none">
      <div className="flex flex-col gap-2.5 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Shapes className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Frames
              </h3>
              <p className="text-[10px] text-gray-500 font-medium">
                Uploaded photo frames
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDetachImage}
            disabled={!canDetach}
            title={
              canDetach
                ? 'Detach image from selected frame (Ctrl/Cmd + Shift + D)'
                : 'Select a filled frame to detach its image'
            }
            className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition ${canDetach
                ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
              }`}
          >
            <Unlink className="w-3.5 h-3.5" />
            Detach
          </button>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-3.5 h-3.5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search uploaded frames..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:font-normal shadow-2xs"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <p className="text-[10px] text-gray-400">
          Filled frame shortcut: Ctrl/Cmd + Shift + D
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <LoadingState message="Loading frames..." />
        ) : totalResults === 0 ? (
          <EmptyState title="No frames found matching your search" />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Uploaded Frames
              </span>
              <span className="text-[10px] font-semibold text-gray-400">
                {filteredAdminFrames.length} items
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {filteredAdminFrames.map((frame) => {
                const config = getFrameAssetConfig(frame);
                const frameUrl =
                  frame.thumbnail_url || config.overlayUrl;

                return (
                  <button
                    key={frame.id}
                    type="button"
                    onClick={() => handleAddAdminFrame(frame)}
                    className="group relative flex flex-col items-center justify-between p-2 rounded-2xl border border-gray-200 bg-white hover:border-purple-400 hover:shadow-md transition-all overflow-hidden"
                  >
                    <div className="relative w-full aspect-square flex items-center justify-center p-1">
                      {frameUrl ? (
                        <NextImage
                          src={frameUrl}
                          alt={frame.name}
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 33vw, 150px"
                          className="p-1 object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Shapes className="w-8 h-8 text-purple-300 group-hover:scale-110 transition-transform" />
                      )}
                    </div>

                    <div className="w-full mt-1.5 text-center">
                      <span className="text-[11px] font-semibold text-gray-700 block truncate px-1 group-hover:text-purple-700 transition-colors">
                        {frame.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
