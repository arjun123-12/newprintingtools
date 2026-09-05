import React, { useState, useEffect } from 'react';
import { DesignAsset, AssetType, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { X } from 'lucide-react';
import { ArtworkFileUpload } from '@/components/admin/shared';

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: DesignAsset | null;
  activeType: AssetType;
  categories: DesignAssetCategory[];
  onSaved: () => void;
}

export function AssetFormModal({ isOpen, onClose, asset, activeType, categories, onSaved }: AssetFormModalProps) {
  const [formData, setFormData] = useState<any>({
    name: '',
    slug: '',
    category_id: '',
    asset_type: activeType,
    is_active: true,
    sort_order: 0,
    provider: 'admin',
    fabric_json: {},
  });
  
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setFormData({
        ...asset,
        category_id: asset.category_id || '',
        fabric_json: asset.fabric_json || {},
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        category_id: '',
        asset_type: activeType,
        is_active: true,
        sort_order: 0,
        provider: 'admin',
        fabric_json: activeType === 'text' ? {
          type: 'Textbox',
          text: 'Add text',
          fontFamily: 'Inter',
          fontSize: 36,
          fontWeight: 'normal',
          fill: '#111111',
          textAlign: 'center'
        } : {},
      });
    }
    setFile(null);
    setThumbnail(null);
    setError(null);
  }, [asset, activeType, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    
    if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      finalValue = parseInt(value, 10);
    }

    setFormData((prev: any) => ({
      ...prev,
      [name]: finalValue
    }));

    if (name === 'name' && !asset) {
      setFormData((prev: any) => ({
        ...prev,
        slug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      }));
    }
  };

  const handleFabricChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') finalValue = parseInt(value, 10);
    
    setFormData((prev: any) => ({
      ...prev,
      fabric_json: {
        ...prev.fabric_json,
        [name]: finalValue
      }
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFileState: React.Dispatch<React.SetStateAction<File | null>>) => {
    if (e.target.files && e.target.files[0]) {
      setFileState(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const submitData = { ...formData };
      if (!submitData.category_id) delete submitData.category_id;
      if (file) submitData.file = file;
      if (thumbnail) submitData.thumbnail = thumbnail;

      if (asset?.id) {
        await designAssetService.updateAsset(asset.id, submitData);
      } else {
        await designAssetService.createAsset(submitData);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save asset');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{asset ? 'Edit Asset' : 'Create Asset'} ({activeType})</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}

          <form id="asset-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category (Optional)</label>
                <select
                  name="category_id"
                  value={formData.category_id || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="">No Category</option>
                  {categories.filter(c => c.asset_type === activeType).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    name="sort_order"
                    value={formData.sort_order ?? 0}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="flex-1 flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active ?? true}
                      onChange={handleChange}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>
            </div>

            {/* TYPE SPECIFIC FIELDS */}
            {activeType === 'text' ? (
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">
                <h3 className="font-bold text-sm text-gray-900 border-b pb-2">Text Preset Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Default Text</label>
                    <input type="text" name="text" value={formData.fabric_json?.text || ''} onChange={handleFabricChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Font Family</label>
                    <input type="text" name="fontFamily" value={formData.fabric_json?.fontFamily || ''} onChange={handleFabricChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
                    <input type="number" name="fontSize" value={formData.fabric_json?.fontSize || 36} onChange={handleFabricChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Font Weight</label>
                    <select name="fontWeight" value={formData.fabric_json?.fontWeight || 'normal'} onChange={handleFabricChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                      <option value="900">Black</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Color (Fill)</label>
                    <input type="color" name="fill" value={formData.fabric_json?.fill || '#000000'} onChange={handleFabricChange} className="w-full h-9 p-1 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ArtworkFileUpload
                  label="Main Asset File"
                  description="Vector graphic or image asset."
                  returnType="file"
                  value={file || asset?.file_url || null}
                  onFileChange={setFile}
                  onChange={(newFile) =>
                    setFile(newFile instanceof File ? newFile : null)
                  }
                  onRemove={() => setFile(null)}
                  required={!asset?.file_url}
                />
                <ArtworkFileUpload
                  label="Thumbnail (Optional)"
                  description="Preview thumbnail image."
                  returnType="file"
                  value={thumbnail || asset?.thumbnail_url || null}
                  onFileChange={setThumbnail}
                  onChange={(newThumb) =>
                    setThumbnail(newThumb instanceof File ? newThumb : null)
                  }
                  onRemove={() => setThumbnail(null)}
                />
              </div>
            )}
          </form>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="asset-form"
            disabled={loading || (!asset && activeType !== 'text' && !file)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
