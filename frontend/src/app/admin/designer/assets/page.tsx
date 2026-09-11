'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { AssetType, DesignAsset, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { Package, Plus, Search, Trash2, Edit, RefreshCw, FolderPlus, FolderUp, CheckCircle, XCircle, FileText, ImageIcon } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@/components/admin/shared';
import { DesignAssetForm } from '@/components/admin/designer/DesignAssetForm';
import { AssetCategoryForm } from '@/components/admin/designer/AssetCategoryForm';
import { BulkAssetUploadModal } from '@/components/admin/designer/BulkAssetUploadModal';
import { formatImageUrl } from '@/utils/imageUrl';
import { useDebounce } from '@/hooks/useDebounce';

type TabType = 'all' | AssetType | 'category';

const isUnrenderableFormat = (url?: string | null) => {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.tif') || clean.endsWith('.tiff') || clean.endsWith('.pdf');
};

const getFormatBadge = (url?: string | null) => {
  if (!url) return null;
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.pdf')) return { label: 'PDF', bg: 'bg-rose-50 text-rose-600 border-rose-200' };
  if (clean.endsWith('.tif') || clean.endsWith('.tiff')) return { label: 'TIFF', bg: 'bg-sky-50 text-sky-600 border-sky-200' };
  return null;
};

const AssetCardMedia: React.FC<{ asset: DesignAsset }> = ({ asset }) => {
  const [imgError, setImgError] = useState(false);

  if (asset.asset_type === 'text') {
    return (
      <div
        style={{
          fontFamily: asset.fabric_json?.fontFamily || 'Inter',
          fontSize: Math.min(asset.fabric_json?.fontSize || 24, 28),
          fontWeight: asset.fabric_json?.fontWeight || 'normal',
          color: asset.fabric_json?.fill || '#111',
          textAlign: asset.fabric_json?.textAlign || 'center',
        }}
        className="truncate max-w-full px-2"
      >
        {asset.fabric_json?.text || asset.name}
      </div>
    );
  }

  // Use thumbnail_url if available; otherwise use file_url if browser-renderable
  const targetUrl = asset.thumbnail_url || (!isUnrenderableFormat(asset.file_url) ? asset.file_url : null);
  const isUnrenderable = !asset.thumbnail_url && isUnrenderableFormat(asset.file_url);

  if (isUnrenderable) {
    const badge = getFormatBadge(asset.file_url);
    return (
      <div className="flex flex-col items-center justify-center p-3 text-center">
        <div className={`px-3 py-1.5 rounded-lg border font-bold text-xs ${badge?.bg || 'bg-gray-100 text-gray-700'}`}>
          {badge?.label || 'FILE'}
        </div>
        <span className="text-[10px] text-gray-500 mt-2 font-medium truncate max-w-[120px]">
          {asset.name}
        </span>
      </div>
    );
  }

  if (targetUrl && !imgError) {
    return (
      <div className="relative w-full h-full">
        <Image
          src={formatImageUrl(targetUrl)}
          alt={asset.name}
          fill
          unoptimized
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
          onError={() => setImgError(true)}
          className="object-contain p-2 group-hover:scale-105 transition duration-200"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center p-2">
      <FileText className="w-8 h-8 text-gray-300 mb-1" />
      <span className="text-[10px] text-gray-400 font-semibold uppercase">{asset.asset_type}</span>
    </div>
  );
};

export default function AdminAssetsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Categories State
  const [categories, setCategories] = useState<DesignAssetCategory[]>([]);
  
  // Assets State
  const [assets, setAssets] = useState<DesignAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DesignAssetCategory | null>(null);

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<DesignAsset | null>(null);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const cats = await designAssetService.getAdminCategories();
      setCategories(cats);

      if (activeTab === 'category') {
        setAssets([]);
      } else {
        const queryParams: any = { per_page: 100 };
        if (activeTab !== 'all') {
          queryParams.asset_type = activeTab;
        }
        if (debouncedSearch.trim()) {
          queryParams.search = debouncedSearch.trim();
        }
        const data = await designAssetService.getAdminAssets(queryParams);
        setAssets(data.data);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load design assets');
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddAssetClick = () => {
    setEditingAsset(null);
    setIsAssetModalOpen(true);
  };

  const handleAddCategoryClick = () => {
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await designAssetService.deleteCategory(id);
        loadData();
      } catch (err: any) {
        alert('Failed to delete category: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      try {
        await designAssetService.deleteAsset(id);
        loadData();
      } catch (err: any) {
        alert('Failed to delete asset: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleToggleAssetActive = async (asset: DesignAsset) => {
    try {
      await designAssetService.updateAsset(asset.id, { is_active: !asset.is_active });
      loadData();
    } catch (err: any) {
      alert('Failed to toggle status: ' + err.message);
    }
  };

  const filteredCategories = searchQuery.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : categories;

  const currentAssetType: AssetType = activeTab === 'all' || activeTab === 'category' ? 'element' : activeTab;

  return (
    <div className="max-w-7xl mx-auto space-y-6 select-none font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-blue-600" />
            <span>Design Asset Library</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage text presets, photos, frames, elements, and backgrounds for the editor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2 text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition"
            title="Refresh assets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleAddCategoryClick}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition shadow-2xs"
          >
            <FolderPlus className="w-4 h-4 text-gray-500" />
            <span>Add Category</span>
          </button>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition shadow-2xs"
            title="Upload entire folder of assets (frames, photos, elements, backgrounds)"
          >
            <FolderUp className="w-4 h-4 text-blue-600" />
            <span>Folder Upload</span>
          </button>

          <button
            onClick={handleAddAssetClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-1">
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
          {(
            [
              { id: 'all', label: 'All Assets' },
              { id: 'text', label: 'Text' },
              { id: 'photo', label: 'Photos' },
              { id: 'frame', label: 'Frames' },
              { id: 'shape', label: 'Shapes' },
              { id: 'element', label: 'Elements' },
              { id: 'background', label: 'Backgrounds' },
              { id: 'category', label: 'Categories' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <LoadingState message="Loading design assets..." className="py-16" />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : activeTab === 'category' ? (
        /* CATEGORIES TABLE VIEW */
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
          {filteredCategories.length === 0 ? (
            <EmptyState title="No categories found" description="Create your first asset category." />
          ) : (
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Asset Type</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 font-bold text-gray-900">{cat.name}</td>
                    <td className="px-4 py-3 capitalize">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold text-[10px]">
                        {cat.asset_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-400">{cat.slug}</td>
                    <td className="px-4 py-3">
                      {cat.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-semibold">
                          <XCircle className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setIsCategoryModalOpen(true);
                        }}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* ASSETS GRID VIEW */
        <div>
          {assets.length === 0 ? (
            <EmptyState
              title="No assets found"
              description="No assets found for the selected type. Click 'Add Asset' to create one."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs hover:border-blue-500 transition group flex flex-col justify-between"
                >
                  {/* Thumbnail / Visual Preview */}
                  <div className="aspect-square bg-gray-50 flex items-center justify-center p-3 relative border-b border-gray-100 overflow-hidden">
                    <AssetCardMedia asset={asset} />

                    {/* Status Badge */}
                    <button
                      onClick={() => handleToggleAssetActive(asset)}
                      className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold shadow-2xs ${
                        asset.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {asset.is_active ? 'Active' : 'Hidden'}
                    </button>
                  </div>

                  {/* Info & Actions */}
                  <div className="p-3 bg-white flex flex-col gap-1.5">
                    <p className="text-xs font-bold text-gray-800 truncate" title={asset.name}>
                      {asset.name}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
                      <span className="capitalize">{asset.asset_type}</span>
                      <span>{asset.category?.name || 'Uncategorized'}</span>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingAsset(asset);
                          setIsAssetModalOpen(true);
                        }}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit asset"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Forms Modals */}
      <DesignAssetForm
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        asset={editingAsset}
        activeType={currentAssetType}
        categories={categories}
        onSaved={loadData}
      />

      <AssetCategoryForm
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        category={editingCategory}
        activeType={currentAssetType}
        onSaved={loadData}
      />

      <BulkAssetUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        activeType={currentAssetType}
        categories={categories}
        onSaved={loadData}
      />
    </div>
  );
}
