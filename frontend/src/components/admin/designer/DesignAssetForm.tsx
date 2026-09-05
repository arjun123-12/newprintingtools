'use client';

import React, { useState, useEffect } from 'react';
import { DesignAsset, AssetType, DesignAssetCategory, designAssetService } from '@/services/designAssetService';
import { X, Loader2, Check } from 'lucide-react';
import { ArtworkFileUpload } from '@/components/admin/shared';

const MAIN_ASSET_EXTENSIONS = [
  'svg',
  'pdf',
  'tif',
  'tiff',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'avif',
  'gif',
  'bmp',
];

const THUMBNAIL_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'svg',
];

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function getFormatBadgeInfo(ext: string): { label: string; badgeClass: string; note: string } | null {
  switch (ext) {
    case 'svg':
      return {
        label: 'SVG Vector',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        note: 'Vector artwork: Infinite scaling, sharp curves, and editable in canvas.',
      };
    case 'pdf':
      return {
        label: 'PDF Document / Vector',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        note: 'High-res PDF artwork: Stored in original print quality with automatic web preview thumbnail.',
      };
    case 'tif':
    case 'tiff':
      return {
        label: 'TIFF Print Master',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        note: 'Print production raster: High-DPI uncompressed format with automatic web preview thumbnail.',
      };
    case 'png':
    case 'webp':
      return {
        label: `${ext.toUpperCase()} Graphic`,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        note: 'Crisp raster graphic with full alpha transparency support.',
      };
    case 'jpg':
    case 'jpeg':
      return {
        label: 'JPEG Photo',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
        note: 'Standard raster photography / background format.',
      };
    default:
      return null;
  }
}

interface DesignAssetFormProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: DesignAsset | null;
  activeType: AssetType;
  categories: DesignAssetCategory[];
  onSaved: () => void;
}

export function DesignAssetForm({
  isOpen,
  onClose,
  asset,
  activeType,
  categories,
  onSaved,
}: DesignAssetFormProps) {
  const [formData, setFormData] = useState<any>({
    name: '',
    slug: '',
    category_id: '',
    asset_type: activeType,
    is_active: true,
    sort_order: 0,
    provider: 'admin',
    attribution: '',
    license_name: '',
    fabric_json: {},
    metadata: {},
  });

  // Text specific state
  const [textConfig, setTextConfig] = useState({
    text: 'Add text',
    fontFamily: 'Inter',
    fontSize: 36,
    fontWeight: 'normal',
    fontStyle: 'normal',
    fill: '#111111',
    backgroundColor: '',
    textAlign: 'center',
    charSpacing: 0,
    lineHeight: 1.16,
    stroke: '#000000',
    strokeWidth: 0,
    textEffect: 'none',
  });

  // Background specific state
  const [bgConfig, setBgConfig] = useState({
    bgType: 'color', // color, gradient, image
    color: '#ffffff',
    gradientAngle: 135,
    gradientColor1: '#3b82f6',
    gradientColor2: '#9333ea',
  });

  // Element specific state
  const [recolourable, setRecolourable] = useState(false);

  // Frame specific state
  const [frameShape, setFrameShape] = useState('rect');
  const [clipType, setClipType] = useState('path');

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
        metadata: asset.metadata || {},
        attribution: asset.attribution || '',
        license_name: asset.license_name || '',
      });

      if (asset.asset_type === 'text' && asset.fabric_json) {
        setTextConfig({
          text: asset.fabric_json.text || asset.name || 'Add text',
          fontFamily: asset.fabric_json.fontFamily || 'Inter',
          fontSize: asset.fabric_json.fontSize || 36,
          fontWeight: asset.fabric_json.fontWeight || 'normal',
          fontStyle: asset.fabric_json.fontStyle || 'normal',
          fill: asset.fabric_json.fill || '#111111',
          backgroundColor: asset.fabric_json.backgroundColor || '',
          textAlign: asset.fabric_json.textAlign || 'center',
          charSpacing: asset.fabric_json.charSpacing || 0,
          lineHeight: asset.fabric_json.lineHeight || 1.16,
          stroke: asset.fabric_json.stroke || '#000000',
          strokeWidth: asset.fabric_json.strokeWidth || 0,
          textEffect: asset.metadata?.textEffect || 'none',
        });
      }

      if (asset.asset_type === 'element' && asset.metadata) {
        setRecolourable(Boolean(asset.metadata.recolourable));
      }

      if (asset.asset_type === 'frame' && asset.metadata) {
        setFrameShape(asset.metadata.shape || 'rect');
        setClipType(asset.metadata.clipType || 'path');
      }

      if (asset.asset_type === 'background' && asset.metadata) {
        setBgConfig({
          bgType: asset.metadata.bgType || 'color',
          color: asset.metadata.color || '#ffffff',
          gradientAngle: asset.metadata.gradientAngle || 135,
          gradientColor1: asset.metadata.gradientColor1 || '#3b82f6',
          gradientColor2: asset.metadata.gradientColor2 || '#9333ea',
        });
      }
    } else {
      setFormData({
        name: '',
        slug: '',
        category_id: '',
        asset_type: activeType,
        is_active: true,
        sort_order: 0,
        provider: 'admin',
        attribution: '',
        license_name: '',
        fabric_json: {},
        metadata: {},
      });
      setTextConfig({
        text: 'Add text',
        fontFamily: 'Inter',
        fontSize: 36,
        fontWeight: 'normal',
        fontStyle: 'normal',
        fill: '#111111',
        backgroundColor: '',
        textAlign: 'center',
        charSpacing: 0,
        lineHeight: 1.16,
        stroke: '#000000',
        strokeWidth: 0,
        textEffect: 'none',
      });
    }

    setFile(null);
    setThumbnail(null);
    setError(null);
  }, [asset, activeType, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setFormData((prev: any) => {
      const next = { ...prev, name: val };
      if (!asset) {
        next.slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      }
      return next;
    });
  };

  const filteredCategories = categories.filter((c) => c.asset_type === formData.asset_type);

  const fileExt = file ? getFileExtension(file.name) : (asset?.file_url ? getFileExtension(asset.file_url) : '');
  const fileInfo = fileExt ? getFormatBadgeInfo(fileExt) : null;

  const handleMainFileChange = (newFile: File | null) => {
    setFile(newFile);
    if (newFile && (!formData.name || formData.name.trim() === '')) {
      const cleanName = newFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
      if (cleanName) {
        handleNameChange(cleanName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let finalFabricJson: any = formData.fabric_json || {};
      let finalMetadata: any = formData.metadata || {};

      if (formData.asset_type === 'text') {
        finalFabricJson = {
          type: 'Textbox',
          text: textConfig.text || formData.name,
          fontFamily: textConfig.fontFamily,
          fontSize: Number(textConfig.fontSize),
          fontWeight: textConfig.fontWeight,
          fontStyle: textConfig.fontStyle,
          fill: textConfig.fill,
          backgroundColor: textConfig.backgroundColor || undefined,
          textAlign: textConfig.textAlign,
          charSpacing: Number(textConfig.charSpacing),
          lineHeight: Number(textConfig.lineHeight),
          stroke: textConfig.strokeWidth > 0 ? textConfig.stroke : undefined,
          strokeWidth: Number(textConfig.strokeWidth),
          editable: true,
          selectable: true,
        };
        finalMetadata = { ...finalMetadata, textEffect: textConfig.textEffect };
      } else if (formData.asset_type === 'element') {
        finalMetadata = { ...finalMetadata, recolourable };
      } else if (formData.asset_type === 'frame') {
        finalMetadata = { ...finalMetadata, shape: frameShape, clipType };
      } else if (formData.asset_type === 'background') {
        finalMetadata = { ...finalMetadata, ...bgConfig };
      }

      const payload: any = {
        ...formData,
        fabric_json: finalFabricJson,
        metadata: finalMetadata,
      };

      if (!payload.category_id || payload.category_id === '') {
        delete payload.category_id;
      }

      if (file) payload.file = file;
      if (thumbnail) payload.thumbnail = thumbnail;

      if (asset) {
        await designAssetService.updateAsset(asset.id, payload);
      } else {
        await designAssetService.createAsset(payload);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save asset:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save design asset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {asset ? 'Edit Design Asset' : 'Add Design Asset'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure properties for artwork editor elements
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          {/* Common Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Asset Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Modern Bold Heading"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Asset Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.asset_type}
                onChange={(e) => setFormData({ ...formData, asset_type: e.target.value as AssetType, category_id: '' })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="text">Text Preset</option>
                <option value="photo">Photo</option>
                <option value="frame">Frame</option>
                <option value="element">Element / Graphic</option>
                <option value="background">Background</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- No Category --</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditional Asset Type Configuration */}

          {/* 1. TEXT PRESET CONFIGURATION */}
          {formData.asset_type === 'text' && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                Typography Controls
              </h3>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Default Text Content</label>
                <input
                  type="text"
                  value={textConfig.text}
                  onChange={(e) => setTextConfig({ ...textConfig, text: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Font Family</label>
                  <select
                    value={textConfig.fontFamily}
                    onChange={(e) => setTextConfig({ ...textConfig, fontFamily: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Playfair Display">Playfair Display</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Oswald">Oswald</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Font Size (px)</label>
                  <input
                    type="number"
                    value={textConfig.fontSize}
                    onChange={(e) => setTextConfig({ ...textConfig, fontSize: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Font Weight</label>
                  <select
                    value={textConfig.fontWeight}
                    onChange={(e) => setTextConfig({ ...textConfig, fontWeight: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="600">Semi-Bold</option>
                    <option value="300">Light</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Text Align</label>
                  <select
                    value={textConfig.textAlign}
                    onChange={(e) => setTextConfig({ ...textConfig, textAlign: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Text Color</label>
                  <input
                    type="color"
                    value={textConfig.fill}
                    onChange={(e) => setTextConfig({ ...textConfig, fill: e.target.value })}
                    className="w-full h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Stroke Width</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={textConfig.strokeWidth}
                    onChange={(e) => setTextConfig({ ...textConfig, strokeWidth: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. PHOTO & ELEMENT FILE UPLOADS */}
          {(formData.asset_type === 'photo' || formData.asset_type === 'frame' || formData.asset_type === 'element' || (formData.asset_type === 'background' && bgConfig.bgType === 'image')) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <ArtworkFileUpload
                  label="Main Asset File"
                  description="Supported: SVG, PDF, TIFF, PNG, JPG, WebP"
                  accept={MAIN_ASSET_EXTENSIONS}
                  returnType="file"
                  value={file || asset?.file_url || null}
                  onFileChange={handleMainFileChange}
                  onChange={(newFile) =>
                    handleMainFileChange(newFile instanceof File ? newFile : null)
                  }
                  onRemove={() => setFile(null)}
                  required={!asset?.file_url}
                />
                {fileInfo && (
                  <div className={`mt-2 p-2.5 rounded-xl border text-[11px] leading-4 flex items-start gap-2 ${fileInfo.badgeClass}`}>
                    <span className="font-bold px-1.5 py-0.5 rounded-md bg-white/70 shadow-2xs shrink-0">
                      {fileInfo.label}
                    </span>
                    <span className="opacity-90">{fileInfo.note}</span>
                  </div>
                )}
              </div>

              <div>
                <ArtworkFileUpload
                  label="Thumbnail (Optional)"
                  description="Optional. Auto-generated for PDF/TIFF or upload JPG, PNG, WebP."
                  accept={THUMBNAIL_EXTENSIONS}
                  returnType="file"
                  value={thumbnail || asset?.thumbnail_url || null}
                  onFileChange={setThumbnail}
                  onChange={(newThumb) =>
                    setThumbnail(newThumb instanceof File ? newThumb : null)
                  }
                  onRemove={() => setThumbnail(null)}
                />
              </div>
            </div>
          )}

          {/* 3. ELEMENT SPECIFIC CONFIG */}
          {formData.asset_type === 'element' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recolourable"
                checked={recolourable}
                onChange={(e) => setRecolourable(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="recolourable" className="text-xs font-medium text-gray-700 select-none">
                Recolourable Element (SVG vector support)
              </label>
            </div>
          )}

          {/* 4. FRAME SPECIFIC CONFIG */}
          {formData.asset_type === 'frame' && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Frame Shape</label>
                <select
                  value={frameShape}
                  onChange={(e) => setFrameShape(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                >
                  <option value="rect">Rectangle / Square</option>
                  <option value="circle">Circle / Ellipse</option>

                  <option value="polygon">Custom Polygon</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Clip Type</label>
                <select
                  value={clipType}
                  onChange={(e) => setClipType(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                >
                  <option value="path">SVG Path Clip</option>
                  <option value="mask">Alpha Mask</option>
                </select>
              </div>
            </div>
          )}

          {/* 5. BACKGROUND SPECIFIC CONFIG */}
          {formData.asset_type === 'background' && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Background Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="bgType"
                    value="color"
                    checked={bgConfig.bgType === 'color'}
                    onChange={() => setBgConfig({ ...bgConfig, bgType: 'color' })}
                  />
                  <span>Solid Color</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="bgType"
                    value="gradient"
                    checked={bgConfig.bgType === 'gradient'}
                    onChange={() => setBgConfig({ ...bgConfig, bgType: 'gradient' })}
                  />
                  <span>Gradient</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="bgType"
                    value="image"
                    checked={bgConfig.bgType === 'image'}
                    onChange={() => setBgConfig({ ...bgConfig, bgType: 'image' })}
                  />
                  <span>Image / Pattern</span>
                </label>
              </div>

              {bgConfig.bgType === 'color' && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Color</label>
                  <input
                    type="color"
                    value={bgConfig.color}
                    onChange={(e) => setBgConfig({ ...bgConfig, color: e.target.value })}
                    className="w-full h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                  />
                </div>
              )}

              {bgConfig.bgType === 'gradient' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Color 1</label>
                    <input
                      type="color"
                      value={bgConfig.gradientColor1}
                      onChange={(e) => setBgConfig({ ...bgConfig, gradientColor1: e.target.value })}
                      className="w-full h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Color 2</label>
                    <input
                      type="color"
                      value={bgConfig.gradientColor2}
                      onChange={(e) => setBgConfig({ ...bgConfig, gradientColor2: e.target.value })}
                      className="w-full h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Licensing & Sort Order */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">License Name</label>
              <input
                type="text"
                value={formData.license_name}
                onChange={(e) => setFormData({ ...formData, license_name: e.target.value })}
                placeholder="e.g. Free commercial"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Attribution</label>
              <input
                type="text"
                value={formData.attribution}
                onChange={(e) => setFormData({ ...formData, attribution: e.target.value })}
                placeholder="e.g. Designed by Admin"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
              />
            </div>
          </div>

          {/* Status Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-xs font-medium text-gray-700 select-none">
              Active (Visible in Designer Sidebar)
            </label>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{asset ? 'Update Asset' : 'Save Asset'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
