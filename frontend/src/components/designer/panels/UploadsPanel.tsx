/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Trash2, Plus, CheckCircle2 } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { assetService } from '../services/assetService';
import { UploadedAsset } from '@/types/designer';
import { formatFileSize } from '../utils/imageQuality';

interface UploadsPanelProps {
  canvasManager: CanvasManager | null;
}

export const UploadsPanel: React.FC<UploadsPanelProps> = ({ canvasManager }) => {
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = assetService.subscribe((list) => {
      setAssets(list);
    });
    return () => unsubscribe();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const asset = await assetService.uploadFile(file);
          // Auto add first uploaded asset to canvas if canvasManager available
          if (i === 0 && canvasManager) {
            canvasManager.addImageFromUrl(asset.url, {
              naturalWidth: asset.naturalWidth,
              naturalHeight: asset.naturalHeight,
              fileSizeBytes: asset.fileSizeBytes,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to process uploaded file:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSelectAsset = (asset: UploadedAsset) => {
    if (!canvasManager) return;
    canvasManager.addImageFromUrl(asset.url, {
      naturalWidth: asset.naturalWidth,
      naturalHeight: asset.naturalHeight,
      fileSizeBytes: asset.fileSizeBytes,
    });
  };

  const handleDeleteAsset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    assetService.deleteAsset(id);
  };

  return (
    <div className="p-4 space-y-4 select-none custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Uploads
          </h3>
        </div>
        <span className="text-[10px] text-gray-400">JPG, PNG, SVG, WebP</span>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Dropzone Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer shadow-2xs ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50'
            : 'border-gray-300 hover:border-blue-500 bg-white hover:bg-gray-50/60'
        }`}
      >
        <UploadCloud className="w-8 h-8 text-blue-600 mx-auto mb-1.5" />
        <p className="text-xs font-bold text-gray-900 mb-0.5">
          {isUploading ? 'Uploading & Decoding...' : 'Upload Media'}
        </p>
        <p className="text-[11px] text-gray-500 mb-3">
          Drag & drop images here or browse
        </p>
        <button
          type="button"
          disabled={isUploading}
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
        >
          Select Files
        </button>
      </div>

      {/* Uploaded Library Grid */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
          <span>Uploaded Files</span>
          <span className="text-[10px] text-gray-400 font-mono">({assets.length})</span>
        </div>

        {assets.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-0.5">
            {assets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => handleSelectAsset(asset)}
                className="group relative rounded-xl border border-gray-200 bg-white hover:border-blue-500 overflow-hidden cursor-pointer transition shadow-2xs aspect-square flex flex-col"
              >
                {/* Image Preview */}
                <div className="flex-1 flex items-center justify-center p-2 bg-gray-50 overflow-hidden">
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="max-h-full max-w-full object-contain rounded transition group-hover:scale-105"
                  />
                </div>

                {/* Metadata Footnote */}
                <div className="px-2 py-1 bg-white border-t border-gray-100 flex items-center justify-between text-[9px] text-gray-500 font-mono">
                  <span className="truncate max-w-[70px]">{asset.naturalWidth}×{asset.naturalHeight}</span>
                  <span>{formatFileSize(asset.fileSizeBytes)}</span>
                </div>

                {/* Hover Quick-Add Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    title="Add to Canvas"
                    className="p-1.5 rounded-full bg-white text-blue-600 hover:scale-110 transition shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete from Library"
                    onClick={(e) => handleDeleteAsset(e, asset.id)}
                    className="p-1.5 rounded-full bg-white text-red-600 hover:scale-110 transition shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No uploaded images yet
          </div>
        )}
      </div>
    </div>
  );
};
