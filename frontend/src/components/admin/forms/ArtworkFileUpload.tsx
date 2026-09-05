'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  UploadCloud,
  X,
  FileCheck,
  Star,
  Plus,
  AlertCircle,
  Loader2,
  FileText,
  Eye,
} from 'lucide-react';
import { formatImageUrl } from '@/utils/imageUrl';
import {
  DEFAULT_ACCEPTED_ARTWORK,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  ARTWORK_EXT_LABEL,
  formatArtworkAcceptAttribute,
  isSupportedArtworkFile,
  getArtworkFileType,
  formatFileSize,
  generateArtworkPreview,
} from './artworkConfig';

export interface ArtworkFileItem {
  id?: string;
  url: string;
  name?: string;
  size?: number;
  type?: string;
  file?: File;
  previewUrl?: string;
  is_featured?: boolean;
}

export interface ArtworkFileUploadProps {
  name?: string;
  label?: string;
  description?: string;
  helperText?: string;
  accept?: string[];
  multiple?: boolean;
  required?: boolean;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  value?:
    | string
    | string[]
    | File
    | File[]
    | ArtworkFileItem
    | ArtworkFileItem[]
    | null;
  returnType?: 'url' | 'file';
  onFileChange?: (file: File | null) => void;
  onChange?: (val: any) => void;
  onRemove?: (itemOrIndex?: any) => void;
  onSetFeatured?: (itemOrIndex?: any) => void;
  featuredValue?: string;
  error?: string;
  aspectRatio?: 'square' | 'video' | 'banner' | 'auto';
  className?: string;
}

export const ArtworkFileUpload: React.FC<ArtworkFileUploadProps> = ({
  name,
  label = 'Artwork File',
  description,
  helperText,
  accept = DEFAULT_ACCEPTED_ARTWORK,
  multiple = false,
  required = false,
  maxSize = DEFAULT_MAX_FILE_SIZE_BYTES,
  maxFiles,
  disabled = false,
  returnType = 'url',
  onFileChange,
  value,
  onChange,
  onRemove,
  onSetFeatured,
  featuredValue,
  error: externalError,
  aspectRatio = 'square',
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Local state for items being handled (each has previewUrl, file, name, etc.)
  const [items, setItems] = useState<ArtworkFileItem[]>([]);

  // Synchronize incoming value prop to local item representations
  useEffect(() => {
    let isCancelled = false;

    async function syncItems() {
      if (!value) {
        setItems([]);
        return;
      }

      const rawList = Array.isArray(value) ? value : [value];
      const parsedItems: ArtworkFileItem[] = [];

      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        if (!item) continue;

        if (typeof item === 'string') {
          const cleanName =
            item.split('/').pop()?.split('?')[0] || `Artwork ${i + 1}`;
          parsedItems.push({
            id: `url_${i}_${item.substring(item.length - 8)}`,
            url: item,
            name: cleanName,
            type: getArtworkFileType(item),
            previewUrl: formatImageUrl(item),
          });
        } else if (item instanceof File) {
          try {
            const previewUrl = await generateArtworkPreview(item);
            if (!isCancelled) {
              parsedItems.push({
                id: `file_${i}_${item.name}`,
                url: previewUrl,
                name: item.name,
                size: item.size,
                type: getArtworkFileType(item),
                file: item,
                previewUrl,
              });
            }
          } catch {
            if (!isCancelled) {
              parsedItems.push({
                id: `file_${i}_${item.name}`,
                url: '',
                name: item.name,
                size: item.size,
                type: getArtworkFileType(item),
                file: item,
              });
            }
          }
        } else if (typeof item === 'object') {
          // ArtworkFileItem
          parsedItems.push({
            id: item.id || `item_${i}`,
            url: item.url || '',
            name: item.name || `Artwork ${i + 1}`,
            size: item.size,
            type: item.type || getArtworkFileType(item.url || ''),
            file: item.file,
            previewUrl: item.previewUrl || formatImageUrl(item.url),
            is_featured: item.is_featured,
          });
        }
      }

      if (!isCancelled) {
        setItems(parsedItems);
      }
    }

    void syncItems();

    return () => {
      isCancelled = true;
    };
  }, [value]);

  const acceptAttr = formatArtworkAcceptAttribute(accept);
  const displayError = externalError || internalError;

  const validateFile = (file: File): string | null => {
    if (!isSupportedArtworkFile(file, accept)) {
      return `"${file.name}" is not a supported format. Allowed: ${ARTWORK_EXT_LABEL}`;
    }
    if (file.size > maxSize) {
      return `"${file.name}" exceeds the maximum allowed size of ${formatFileSize(maxSize)}.`;
    }
    return null;
  };

  const processIncomingFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    setInternalError(null);
    setIsProcessing(true);

    try {
      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of rawFiles) {
        const err = validateFile(file);
        if (err) {
          errors.push(err);
        } else {
          validFiles.push(file);
        }
      }

      if (errors.length > 0) {
        setInternalError(errors.join(' '));
      }

      if (validFiles.length === 0) return;

      if (!multiple) {
        // Single file mode
        const singleFile = validFiles[0];
        const previewUrl = await generateArtworkPreview(singleFile);

        const newItem: ArtworkFileItem = {
          id: `file_${Date.now()}`,
          url: previewUrl,
          name: singleFile.name,
          size: singleFile.size,
          type: getArtworkFileType(singleFile),
          file: singleFile,
          previewUrl,
        };

        setItems([newItem]);

        if (onFileChange) {
          onFileChange(singleFile);
        }

        if (onChange) {
          if (returnType === 'file' || value instanceof File) {
            onChange(singleFile);
          } else {
            onChange(previewUrl);
          }
        }
      } else {
        // Multiple files mode
        const newItems: ArtworkFileItem[] = [];
        for (const file of validFiles) {
          if (maxFiles && items.length + newItems.length >= maxFiles) {
            setInternalError(`Maximum of ${maxFiles} files allowed.`);
            break;
          }

          const previewUrl = await generateArtworkPreview(file);
          newItems.push({
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            url: previewUrl,
            name: file.name,
            size: file.size,
            type: getArtworkFileType(file),
            file,
            previewUrl,
          });
        }

        const combined = [...items, ...newItems];
        setItems(combined);

        if (onChange) {
          if (returnType === 'file' || (Array.isArray(value) && value.length > 0 && value[0] instanceof File)) {
            const allFiles = combined.map((it) => it.file).filter(Boolean) as File[];
            onChange(allFiles);
          } else {
            onChange(combined.map((it) => it.url));
          }
        }
      }
    } catch (err) {
      console.error('Failed to process artwork file(s):', err);
      setInternalError('An error occurred while processing the artwork file.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isProcessing) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveSingle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setItems([]);
    setInternalError(null);
    if (onFileChange) {
      onFileChange(null);
    }
    if (onRemove) {
      onRemove();
    } else if (onChange) {
      onChange(multiple ? [] : (returnType === 'file' ? null : ''));
    }
  };

  const handleRemoveMultiple = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    if (onRemove) {
      onRemove(index);
    } else if (onChange) {
      onChange(updated.map((it) => it.url));
    }
  };

  const handleSetFeaturedItem = (item: ArtworkFileItem, index: number) => {
    if (onSetFeatured) {
      onSetFeatured(item.url || index);
    } else if (onChange) {
      // Toggle or prioritize
      const updated = items.map((it, i) => ({
        ...it,
        is_featured: i === index,
      }));
      setItems(updated);
    }
  };

  const aspectClasses = {
    square: 'aspect-square max-w-[220px]',
    video: 'aspect-video max-w-sm',
    banner: 'aspect-[3/1] max-w-md',
    auto: 'h-44 w-full',
  };

  const singleItem = items[0];

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label and Header */}
      {(label || description) && (
        <div className="flex items-center justify-between">
          <div>
            {label && (
              <label className="block text-xs font-semibold text-gray-700 select-none">
                {label}
                {required && <span className="text-rose-500 ml-0.5">*</span>}
              </label>
            )}
            {description && (
              <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>
            )}
          </div>

          {multiple && (
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100/70 transition-colors shadow-2xs disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Artwork</span>
            </button>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        name={name}
        multiple={multiple}
        accept={acceptAttr}
        disabled={disabled || isProcessing}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            void processIncomingFiles(e.target.files);
          }
        }}
      />

      {/* SINGLE MODE */}
      {!multiple && (
        <>
          {singleItem && singleItem.url ? (
            <div className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shadow-2xs max-w-sm transition-all hover:border-gray-300">
              <div className="relative flex items-center justify-center bg-gray-100/70 p-2 min-h-[170px]">
                {/* Format Badge */}
                {singleItem.type && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 uppercase tracking-wider text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-900/80 text-white shadow-xs backdrop-blur-xs">
                    {singleItem.type}
                  </span>
                )}

                {/* Thumbnail / Preview */}
                {singleItem.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={formatImageUrl(singleItem.previewUrl)}
                    alt={singleItem.name || 'Artwork Preview'}
                    className="max-h-48 w-auto object-contain rounded-lg shadow-xs transition-transform duration-150 group-hover:scale-[1.01]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-gray-400">
                    <FileText className="w-10 h-10 text-gray-400 mb-1" />
                    <span className="text-xs font-medium text-gray-600 uppercase">
                      {singleItem.type || 'FILE'}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Card Info & Actions */}
              <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs font-semibold text-gray-800 truncate"
                    title={singleItem.name}
                  >
                    {singleItem.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                    {singleItem.size ? (
                      <span>{formatFileSize(singleItem.size)}</span>
                    ) : null}
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                      <FileCheck className="w-3 h-3" />
                      Ready
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={disabled || isProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    disabled={disabled || isProcessing}
                    onClick={handleRemoveSingle}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title="Remove artwork"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Dropzone Empty State */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() =>
                !disabled && !isProcessing && fileInputRef.current?.click()
              }
              className={`
                border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer
                transition-all duration-150 select-none
                ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/60 scale-[0.99]'
                    : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/60 hover:border-gray-300'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
                ${aspectClasses[aspectRatio]}
              `}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <span className="text-xs font-medium text-gray-600">
                    Processing artwork…
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      <span className="text-blue-600 hover:underline">
                        Click to upload
                      </span>{' '}
                      or drag & drop
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {helperText ||
                        `Supported: ${ARTWORK_EXT_LABEL} (up to ${formatFileSize(maxSize)})`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MULTIPLE GALLERY MODE */}
      {multiple && (
        <div className="space-y-3">
          {items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {items.map((item, idx) => {
                const isItemFeatured =
                  featuredValue === item.url || !!item.is_featured;
                return (
                  <div
                    key={item.id || idx}
                    className={`relative group rounded-xl border overflow-hidden bg-gray-50 aspect-square flex flex-col items-center justify-center transition-all ${
                      isItemFeatured
                        ? 'ring-2 ring-blue-600 border-blue-600'
                        : 'border-gray-200 hover:border-gray-300 shadow-2xs'
                    }`}
                  >
                    {/* Format Badge */}
                    {item.type && (
                      <span className="absolute top-1.5 left-1.5 z-10 uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-900/80 text-white shadow-xs">
                        {item.type}
                      </span>
                    )}

                    {/* Featured Badge */}
                    {isItemFeatured && (
                      <span className="absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-0.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                        <Star className="w-2.5 h-2.5 fill-white" />
                        Featured
                      </span>
                    )}

                    {/* Image Thumbnail */}
                    {item.previewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={formatImageUrl(item.previewUrl)}
                        alt={item.name || `Artwork ${idx + 1}`}
                        className="w-full h-full object-contain p-1 rounded-lg"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <FileText className="w-8 h-8 mb-1" />
                        <span className="text-[10px] font-semibold uppercase">
                          {item.type || 'FILE'}
                        </span>
                      </div>
                    )}

                    {/* Action Overlay */}
                    <div className="absolute inset-0 bg-gray-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2 backdrop-blur-2xs z-20">
                      {!isItemFeatured && (
                        <button
                          type="button"
                          onClick={() => handleSetFeaturedItem(item, idx)}
                          title="Set as featured"
                          className="p-1.5 bg-white text-gray-700 hover:text-blue-600 rounded-lg shadow-sm transition-colors text-[10px] font-semibold"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleRemoveMultiple(idx, e)}
                        title="Delete artwork"
                        className="p-1.5 bg-white text-rose-600 hover:bg-rose-50 rounded-lg shadow-sm transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* File Name Footer */}
                    <div className="absolute bottom-0 inset-x-0 bg-white/95 border-t border-gray-100 px-1.5 py-0.5 text-[9px] text-gray-600 truncate text-center">
                      {item.name}
                    </div>
                  </div>
                );
              })}

              {/* Mini Upload Trigger Card */}
              {(!maxFiles || items.length < maxFiles) && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() =>
                    !disabled && !isProcessing && fileInputRef.current?.click()
                  }
                  className={`
                    border-2 border-dashed rounded-xl aspect-square flex flex-col items-center justify-center text-center cursor-pointer transition-all
                    ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50/60 scale-[0.98]'
                        : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/70 hover:border-gray-300'
                    }
                  `}
                >
                  <Plus className="w-5 h-5 text-gray-400 mb-1" />
                  <span className="text-[11px] font-medium text-gray-600">
                    Add More
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Multi-mode Empty Dropzone */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() =>
                !disabled && !isProcessing && fileInputRef.current?.click()
              }
              className={`
                p-8 border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center text-center cursor-pointer transition-colors
                ${isDragging ? 'border-blue-500 bg-blue-50/60 scale-[0.99]' : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
              `}
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-blue-600 mb-2">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-gray-700">
                <span className="text-blue-600 hover:underline">
                  Click to upload
                </span>{' '}
                or drag & drop multiple artwork files
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {helperText ||
                  `Supported: ${ARTWORK_EXT_LABEL} (up to ${formatFileSize(maxSize)})`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Validation Error Message */}
      {displayError && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
};

export default ArtworkFileUpload;
