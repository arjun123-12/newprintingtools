'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FolderUp,
  Files,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Check,
} from 'lucide-react';
import {
  AssetType,
  DesignAssetCategory,
  designAssetService,
} from '@/services/designAssetService';

interface BulkAssetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeType: AssetType;
  categories: DesignAssetCategory[];
  onSaved: () => void;
}

interface QueuedItem {
  id: string;
  name: string;
  slug: string;
  mainFile: File;
  maskFile?: File;
  thumbnailFile?: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

const SUPPORTED_EXTENSIONS: Record<AssetType, string[]> = {
  frame: ['svg', 'png', 'jpg', 'jpeg', 'webp'],
  photo: ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'avif', 'gif', 'tif', 'tiff'],
  element: [
    'svg',
    'png',
    'jpg',
    'jpeg',
    'jfif',
    'webp',
    'avif',
    'gif',
    'pdf',
    'tif',
    'tiff',
  ],
  background: ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'avif', 'gif', 'svg'],
  text: [],
  shape: ['svg', 'png', 'jpg', 'jpeg', 'webp'],
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  frame: 'Frames & Grids',
  shape: 'Shapes & Vector Cutouts',
  photo: 'Stock / Customer Photos',
  element: 'Elements & Graphics',
  background: 'Backgrounds',
  text: 'Text Presets',
};

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function cleanTitle(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export const BulkAssetUploadModal: React.FC<BulkAssetUploadModalProps> = ({
  isOpen,
  onClose,
  activeType,
  categories,
  onSaved,
}) => {
  // Always use the section from the parent form. The modal remains mounted
  // while closed, so a separate state value could retain the old "element"
  // selection when the admin later opens it from the Photos form.
  const assetType = activeType;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  // Frame specific batch defaults
  const [frameMaskType, setFrameMaskType] = useState<string>('rounded_rectangle');
  const [framePhotoFit, setFramePhotoFit] = useState<'cover' | 'contain'>('cover');

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Do not carry a queue or category from another asset form.
    setSelectedCategoryId('');
    setQueue([]);
    setOverallProgress(0);
  }, [activeType, isOpen]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.asset_type === assetType);
  const allowedExts = SUPPORTED_EXTENSIONS[assetType] || [];

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);

    const validFiles = filesArray.filter((f) => {
      // Folder selection can include hidden OS files such as .DS_Store or Thumbs.db.
      if (
        f.size === 0 ||
        f.name.startsWith('.') ||
        f.name.toLowerCase() === 'thumbs.db'
      ) {
        return false;
      }

      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return allowedExts.includes(ext);
    });

    if (validFiles.length === 0) {
      const detectedFormats = Array.from(
        new Set(
          filesArray
            .map((file) => file.name.split('.').pop()?.trim().toLowerCase())
            .filter((extension): extension is string => Boolean(extension))
        )
      );

      alert(
        `No supported files found for "${assetType}".\n\n` +
        `Detected formats: ${detectedFormats.join(', ') || 'unknown'}\n` +
        `Allowed formats: ${allowedExts.join(', ')}`
      );
      return;
    }

    const ignoredFiles = filesArray.filter((file) => !validFiles.includes(file));
    if (ignoredFiles.length > 0) {
      console.warn(
        `${ignoredFiles.length} unsupported or empty files were ignored:`,
        ignoredFiles.map((file) => file.webkitRelativePath || file.name)
      );
    }

    // If assetType is frame, intelligently detect pairs (e.g. frame.png and frame_mask.svg)
    if (assetType === 'frame') {
      const mainFiles: File[] = [];
      const maskMap = new Map<string, File>();
      const thumbMap = new Map<string, File>();

      validFiles.forEach((file) => {
        const lower = file.name.toLowerCase();
        const baseName = lower.replace(/\.[^/.]+$/, '');

        if (lower.includes('mask')) {
          const key = baseName.replace(/[-_]?mask[-_]?/g, '').trim();
          maskMap.set(key, file);
        } else if (lower.includes('thumb')) {
          const key = baseName.replace(/[-_]?thumb(nail)?[-_]?/g, '').trim();
          thumbMap.set(key, file);
        } else {
          mainFiles.push(file);
        }
      });

      // If all files were somehow identified as masks/thumbs, fallback to treating all as mains
      const actualMains = mainFiles.length > 0 ? mainFiles : validFiles;

      const newItems: QueuedItem[] = actualMains.map((file, idx) => {
        const title = cleanTitle(file.name);
        const baseKey = file.name
          .toLowerCase()
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]?frame[-_]?/g, '')
          .trim();

        const pairedMask = maskMap.get(baseKey);
        const pairedThumb = thumbMap.get(baseKey);

        return {
          id: `item-${Date.now()}-${idx}`,
          name: title,
          slug: `${generateSlug(title)}-${Date.now().toString().slice(-4)}${idx}`,
          mainFile: file,
          maskFile: pairedMask,
          thumbnailFile: pairedThumb,
          status: 'pending',
        };
      });

      setQueue((prev) => [...prev, ...newItems]);
    } else {
      const newItems: QueuedItem[] = validFiles.map((file, idx) => {
        const title = cleanTitle(file.name);
        return {
          id: `item-${Date.now()}-${idx}`,
          name: title,
          slug: `${generateSlug(title)}-${Date.now().toString().slice(-4)}${idx}`,
          mainFile: file,
          status: 'pending',
        };
      });

      setQueue((prev) => [...prev, ...newItems]);
    }
  };

  const handleRemoveItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleStartBulkUpload = async () => {
    if (queue.length === 0 || isUploading) return;

    setIsUploading(true);
    let completedCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === 'success') {
        completedCount++;
        continue;
      }

      // Mark currently uploading
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading' } : q))
      );

      try {
        const payload: any = {
          name: item.name,
          slug: item.slug,
          asset_type: assetType,
          is_active: true,
          sort_order: i,
          file: item.mainFile,
        };

        if (selectedCategoryId) {
          payload.category_id = selectedCategoryId;
        }

        if (item.thumbnailFile) {
          payload.thumbnail = item.thumbnailFile;
        }

        if (assetType === 'frame' || assetType === 'shape') {
          if (item.maskFile) {
            payload.mask_file = item.maskFile;
          }

          payload.metadata = {
            shape: frameMaskType === 'circle' ? 'circle' : 'rect',
            frame: {
              version: 1,
              type: 'photo-frame',
              maskType: item.maskFile ? 'svg_mask' : frameMaskType,
              width: 500,
              height: 500,
              unit: 'px',
              cornerRadius: 24,
              circleRadius: 250,
              photoFit: framePhotoFit,
              allowPhotoMove: true,
              allowPhotoZoom: true,
              allowPhotoRotate: true,
              allowPhotoReplace: true,
              preserveAspectRatio: true,
            },
          };

          payload.fabric_json = {
            type: 'photo-frame',
            maskType: item.maskFile ? 'svg_mask' : frameMaskType,
            width: 500,
            height: 500,
            unit: 'px',
            photoFit: framePhotoFit,
          };
        } else if (assetType === 'element') {
          payload.metadata = {
            recolourable: item.mainFile.name.toLowerCase().endsWith('.svg'),
          };
        } else if (assetType === 'background') {
          payload.metadata = {
            bgType: 'image',
          };
        }

        await designAssetService.createAsset(payload);

        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'success' } : q))
        );
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Failed to upload';
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'error', errorMessage: msg } : q
          )
        );
      }

      completedCount++;
      setOverallProgress(Math.round((completedCount / queue.length) * 100));
    }

    setIsUploading(false);
    onSaved();
  };

  const successCount = queue.filter((q) => q.status === 'success').length;
  const errorCount = queue.filter((q) => q.status === 'error').length;
  const isDone = queue.length > 0 && successCount + errorCount === queue.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
              <FolderUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Bulk / Folder Asset Upload
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Upload entire folders of frames, photos, elements, or backgrounds at once
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form / Options Bar */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-gray-50/80 border border-gray-200/70">
            {/* Target Asset Section */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Asset Section <span className="text-red-500">*</span>
              </label>
              <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                {ASSET_TYPE_LABELS[assetType]}
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                Fixed from the current {assetType} form.
              </p>
            </div>

            {/* Target Category */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Target Category
              </label>
              <select
                disabled={isUploading}
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- No Category (Unassigned) --</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Frame & Shape specific options */}
            {(assetType === 'frame' || assetType === 'shape') && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Default Photo Fit
                </label>
                <select
                  disabled={isUploading}
                  value={framePhotoFit}
                  onChange={(e) => setFramePhotoFit(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="cover">Cover (Fill & Crop)</option>
                  <option value="contain">Contain (Fit Whole Image)</option>
                </select>
              </div>
            )}
          </div>

          {/* Hidden inputs for folder and multi-file selection */}
          <input
            ref={folderInputRef}
            type="file"
            multiple
            {...({ webkitdirectory: '', directory: '' } as any)}
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              // Allow choosing the same folder again after an error or queue clear.
              e.currentTarget.value = '';
            }}
          />
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept={allowedExts.map((e) => `.${e}`).join(',')}
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.currentTarget.value = '';
            }}
          />

          {/* Drag & Drop or Selection Box */}
          {queue.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesSelected(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/30 hover:bg-blue-50/60 rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-white shadow-md shadow-blue-100 flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>

              <h3 className="text-sm font-bold text-gray-800">
                Choose a Folder or Drop Files Here
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Select an entire folder of files. We automatically read, name, pair masks, and format them for the <strong>{assetType}</strong> section.
              </p>

              <div className="flex items-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <FolderUp className="w-4 h-4" />
                  <span>Select Entire Folder</span>
                </button>

                <button
                  type="button"
                  onClick={() => filesInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition flex items-center gap-1.5"
                >
                  <Files className="w-4 h-4 text-gray-500" />
                  <span>Select Multiple Files</span>
                </button>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                <span>Supported:</span>
                <span>{allowedExts.join(', ')}</span>
              </div>
            </div>
          ) : (
            /* Queue Table */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {queue.length} files selected
                  </span>
                  {successCount > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {successCount} uploaded
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {errorCount} failed
                    </span>
                  )}
                </div>

                {!isUploading && !isDone && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="text-xs text-blue-600 hover:underline font-semibold"
                    >
                      + Add more from folder
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setQueue([])}
                      className="text-xs text-red-500 hover:underline font-semibold"
                    >
                      Clear queue
                    </button>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-1.5 p-3 bg-blue-50/80 border border-blue-100 rounded-xl">
                  <div className="flex justify-between text-xs font-bold text-blue-900">
                    <span>Uploading assets...</span>
                    <span>{overallProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-blue-200/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-200"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="max-h-[360px] overflow-y-auto border border-gray-200 rounded-2xl divide-y divide-gray-100 bg-white custom-scrollbar">
                {queue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between hover:bg-gray-50/80 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-900 truncate">
                            {item.name}
                          </span>
                          {item.maskFile && (
                            <span className="text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                              + Mask Paired
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 block truncate">
                          {item.mainFile.name} • {formatBytes(item.mainFile.size)}
                        </span>
                      </div>
                    </div>

                    {/* Status / Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'pending' && (
                        <span className="text-[10px] font-semibold text-gray-400 px-2 py-0.5 rounded bg-gray-100">
                          Ready
                        </span>
                      )}
                      {item.status === 'uploading' && (
                        <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Uploading...
                        </span>
                      )}
                      {item.status === 'success' && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Saved
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span
                          title={item.errorMessage}
                          className="text-[10px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200"
                        >
                          <AlertCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}

                      {!isUploading && item.status !== 'success' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div className="text-xs text-gray-500 font-medium">
            {queue.length > 0 && (
              <span>
                {queue.length} items queued for <strong>{assetType}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            >
              {isDone ? 'Close' : 'Cancel'}
            </button>

            {queue.length > 0 && !isDone && (
              <button
                type="button"
                disabled={isUploading}
                onClick={handleStartBulkUpload}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <FolderUp className="w-4 h-4" />
                    <span>Upload All {queue.length} Files</span>
                  </>
                )}
              </button>
            )}

            {isDone && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Finished & Close</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
