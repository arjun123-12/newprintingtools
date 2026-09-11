'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Image as ImageIcon, Loader2, Search } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import {
  DesignAsset,
  DesignAssetCategory,
  designAssetService,
} from '@/services/designAssetService';
import { formatImageUrl } from '@/utils/imageUrl';

interface StockPhotosPanelProps {
  canvasManager: CanvasManager | null;
}

const getAssetUrl = (asset: DesignAsset): string | undefined => {
  const rawUrl = asset.file_url || asset.thumbnail_url;
  return rawUrl ? formatImageUrl(rawUrl) : undefined;
};

const getPreviewUrl = (asset: DesignAsset): string | undefined => {
  const rawUrl = asset.thumbnail_url || asset.file_url;
  return rawUrl ? formatImageUrl(rawUrl) : undefined;
};

export const StockPhotosPanel: React.FC<StockPhotosPanelProps> = ({
  canvasManager,
}) => {
  const [photos, setPhotos] = useState<DesignAsset[]>([]);
  const [categories, setCategories] = useState<DesignAssetCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addingPhotoId, setAddingPhotoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadAdminPhotos = async () => {
      try {
        setLoading(true);
        setError('');

        const [assetsResponse, categoryResponse] = await Promise.all([
          designAssetService.getPublicAssets({
            asset_type: 'photo',
            per_page: 100,
            sort: 'newest',
          }),
          designAssetService.getPublicCategories('photo'),
        ]);

        if (!mounted) return;

        setPhotos(
          (assetsResponse.data || []).filter(
            (asset) => asset.asset_type === 'photo' && Boolean(getAssetUrl(asset))
          )
        );
        setCategories(categoryResponse || []);
      } catch (loadError) {
        console.error('Failed to load admin photo assets:', loadError);
        if (mounted) {
          setPhotos([]);
          setCategories([]);
          setError('Could not load photos from the admin library.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadAdminPhotos();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredPhotos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return photos.filter((photo) => {
      const matchesCategory =
        selectedCategory === 'all' || photo.category_id === selectedCategory;
      const matchesSearch =
        !query ||
        photo.name.toLowerCase().includes(query) ||
        Boolean(photo.category?.name?.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [photos, searchQuery, selectedCategory]);

  const handleAddPhoto = async (asset: DesignAsset) => {
    if (!canvasManager || addingPhotoId) return;

    const photoUrl = getAssetUrl(asset);
    if (!photoUrl) return;

    try {
      setError('');
      setAddingPhotoId(asset.id);

      await canvasManager.addImageFromUrl(photoUrl, {
        name: asset.name,
        originalSrc: photoUrl,
        naturalWidth: Number(asset.metadata?.width || asset.metadata?.naturalWidth) || undefined,
        naturalHeight: Number(asset.metadata?.height || asset.metadata?.naturalHeight) || undefined,
        fileSizeBytes: Number(asset.metadata?.fileSizeBytes) || undefined,
      });
    } catch (addError) {
      console.error('Failed to add admin photo to canvas:', addError);
      setError('Could not add this photo to the artwork.');
    } finally {
      setAddingPhotoId(null);
    }
  };

  return (
    <div className="custom-scrollbar h-full space-y-4 overflow-y-auto bg-white p-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
              Photos
            </h3>
            <p className="text-[10px] text-gray-400">Admin photo library</p>
          </div>
        </div>
        {!loading && (
          <span className="text-[10px] font-medium text-gray-400">
            {filteredPhotos.length} items
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search admin photos..."
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-xs outline-none transition focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10"
        />
      </div>

      {categories.length > 0 && (
        <div className="custom-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold transition ${selectedCategory === 'all'
              ? 'bg-purple-600 text-white'
              : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold transition ${selectedCategory === category.id
                ? 'bg-purple-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      ) : filteredPhotos.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
          <ImageIcon className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-xs font-semibold text-gray-500">No admin photos found</p>
          <p className="mt-1 text-[10px] text-gray-400">
            Upload an active Photo asset from the admin panel.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filteredPhotos.map((photo) => {
            const previewUrl = getPreviewUrl(photo);
            const isAdding = addingPhotoId === photo.id;

            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => void handleAddPhoto(photo)}
                disabled={Boolean(addingPhotoId)}
                title={`Add ${photo.name} to artwork`}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-2xs transition hover:border-purple-400 hover:shadow-md disabled:cursor-wait disabled:opacity-70"
              >
                <div className="relative aspect-square overflow-hidden bg-gray-100">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt={photo.name}
                      fill
                      unoptimized
                      sizes="160px"
                      className="object-cover transition duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <ImageIcon className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-gray-300" />
                  )}

                  {isAdding && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-[11px] font-semibold text-gray-700">
                    {photo.name}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] text-gray-400">
                    {photo.category?.name || 'Uncategorized'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
