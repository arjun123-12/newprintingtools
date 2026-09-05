'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, X, Image as ImageIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { formatImageUrl } from '@/utils/imageUrl';

export interface ImageUploaderProps {
  label?: string;
  helperText?: string;
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  aspectRatio?: 'square' | 'video' | 'banner' | 'auto';
  disabled?: boolean;
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label = 'Featured Image',
  helperText = 'PNG, JPG, WebP up to 10MB (recommended 1200×1200px)',
  value,
  onChange,
  onRemove,
  aspectRatio = 'square',
  disabled = false,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const aspectClasses = {
    square: 'aspect-square max-w-[200px]',
    video: 'aspect-video max-w-sm',
    banner: 'aspect-[3/1] max-w-md',
    auto: 'h-44 w-full',
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(psd|ai|eps|pdf|avif)$/i)) {
      alert('Please select a valid image file.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onChange(dataUrl);
      setIsUploading(false);
    };
    reader.onerror = () => {
      setIsUploading(false);
      alert('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <span className="block text-xs font-semibold text-gray-700 select-none">
          {label}
        </span>
      )}

      {value ? (
        <div className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shadow-2xs max-w-sm">
          <div className="flex items-center justify-center bg-gray-100 p-2 min-h-[160px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={formatImageUrl(value)}
              alt="Uploaded Preview"
              className="max-h-48 w-auto object-contain rounded-lg shadow-xs"
            />
          </div>

          <div className="p-2.5 bg-white border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Image Set</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Change
              </button>
              {onRemove && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onRemove}
                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer
            transition-all duration-150 select-none
            ${isDragging ? 'border-blue-500 bg-blue-50/50 scale-[0.99]' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/60 hover:border-gray-300'}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
            ${aspectClasses[aspectRatio]}
          `}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
              <span className="text-xs font-medium text-gray-600">Uploading image…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-blue-600">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">
                  <span className="text-blue-600 hover:underline">Click to upload</span> or drag & drop
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{helperText}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.psd,.ai,.eps,.pdf,.avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};

export default ImageUploader;
