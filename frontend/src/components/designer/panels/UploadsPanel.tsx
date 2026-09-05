/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { UploadedAsset } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { assetService } from '../services/assetService';
import { formatFileSize } from '../utils/imageQuality';

interface UploadsPanelProps {
  canvasManager: CanvasManager | null;
}

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1'
).replace(/\/+$/, '');

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Standard formats directly decoded by modern browsers / Fabric.js
const DIRECT_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'svg',
  'gif',
]);

// Additional print artwork formats
const ARTWORK_EXTENSIONS = new Set([
  'pdf',
  'tif',
  'tiff',
]);

const FILE_INPUT_ACCEPT =
  'image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,application/pdf,.pdf,image/tiff,.tif,.tiff';

function getFileExtension(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() ?? '';
}

function isSupportedFile(file: File): boolean {
  const ext = getFileExtension(file);
  return DIRECT_IMAGE_EXTENSIONS.has(ext) || ARTWORK_EXTENSIONS.has(ext);
}

/**
 * Upload original uncompressed artwork file (PDF, TIF, TIFF) to Laravel storage
 * so the original high-resolution file remains permanently available for export.
 */
async function uploadOriginalArtworkFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('source_provider', 'designer-upload');
  formData.append('source_provider_asset_id', file.name.slice(0, 255));

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token')
      : null;

  const response = await fetch(`${API_URL}/designer/uploads/canvas-image`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const responseText = await response.text();
  let result: any = null;

  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    result = null;
  }

  if (!response.ok) {
    const validationMessage = result?.errors
      ? Object.values(result.errors).flat().join(' ')
      : null;

    throw new Error(
      validationMessage ||
        result?.message ||
        `Could not store the original file (${response.status}).`
    );
  }

  const storedUrl = result?.data?.file_url || result?.data?.url;

  if (!storedUrl || typeof storedUrl !== 'string') {
    throw new Error(
      'The file was uploaded, but the server returned no permanent URL.'
    );
  }

  return storedUrl;
}

/**
 * Render PDF page 1 at 300 DPI to an off-screen canvas using pdf.js.
 * This preserves vector crispness for the canvas preview.
 */
async function renderPdfPreview(file: File): Promise<File> {
  if (typeof window === 'undefined') {
    throw new Error('PDF preview is only available in browser.');
  }

  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () =>
        reject(new Error('Failed to load PDF rendering engine.'));
      document.head.appendChild(script);
    });
  }

  const pdfjsLib = (window as any).pdfjsLib;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  // PDF default is 72 points per inch. Scale to 300 DPI: 300 / 72 = 4.166667
  const defaultViewport = page.getViewport({ scale: 1.0 });
  const rawW = defaultViewport.width;
  const rawH = defaultViewport.height;

  let scale = 300 / 72;
  // Cap at 6000px to maintain high resolution while staying safe in browser memory
  if (Math.max(rawW, rawH) * scale > 6000) {
    scale = 6000 / Math.max(rawW, rawH);
  }

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize canvas context for PDF preview.');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('PDF preview export failed.'));
    }, 'image/png');
  });

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'pdf-preview';
  return new File([blob], `${baseName}.png`, {
    type: 'image/png',
    lastModified: Date.now(),
  });
}

/**
 * Convert TIFF to transparent PNG at 300 DPI using server Imagick,
 * with UTIF client-side fallback.
 */
async function convertTiffToPng(file: File): Promise<File> {
  const formData = new FormData();
  formData.append('image', file);

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token')
      : null;

  try {
    const response = await fetch(
      `${API_URL}/designer/uploads/convert-image`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'image/png, application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      }
    );

    if (response.ok) {
      const blob = await response.blob();
      if (blob.type.startsWith('image/png')) {
        const baseName =
          file.name.replace(/\.[^.]+$/, '') || 'tiff-preview';
        return new File([blob], `${baseName}.png`, {
          type: 'image/png',
          lastModified: Date.now(),
        });
      }
    }
  } catch (err) {
    console.warn('Server TIFF conversion failed, falling back to local decoder:', err);
  }

  // Fallback to client-side UTIF decoder
  return convertTiffWithUtif(file);
}

async function convertTiffWithUtif(file: File): Promise<File> {
  if (typeof window === 'undefined') {
    throw new Error('TIFF preview is only available in browser.');
  }

  if (!(window as any).UTIF) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js';
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('Failed to load TIFF decoder.'));
      document.head.appendChild(script);
    });
  }

  const UTIF = (window as any).UTIF;
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);

  if (!ifds || ifds.length === 0) {
    throw new Error(`Could not decode TIFF: ${file.name}`);
  }

  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width;
  const height = ifds[0].height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas context for TIFF preview.');
  }

  const imgData = ctx.createImageData(width, height);
  imgData.data.set(rgba);
  ctx.putImageData(imgData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('TIFF preview generation failed.'));
    }, 'image/png');
  });

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'tiff-preview';
  return new File([blob], `${baseName}.png`, {
    type: 'image/png',
    lastModified: Date.now(),
  });
}

export const UploadsPanel: React.FC<UploadsPanelProps> = ({
  canvasManager,
}) => {
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const permanentUrlByAssetIdRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const unsubscribe = assetService.subscribe((list) => {
      setAssets(list);
    });

    return () => unsubscribe();
  }, []);

  const handleFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0 || isUploading) return;

    setIsUploading(true);
    setUploadError(null);

    const errors: string[] = [];
    let firstAddedToCanvas = false;

    try {
      for (const file of Array.from(files)) {
        try {
          const ext = getFileExtension(file);

          // 1. File type validation
          if (!isSupportedFile(file)) {
            throw new Error(
              `"${file.name}" is not a supported file format. Supported formats: JPG, PNG, SVG, WebP, PDF, TIF, TIFF.`
            );
          }

          // 2. File size validation
          if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new Error(`"${file.name}" exceeds the 25 MB upload limit.`);
          }

          let previewFile: File;
          let originalFileUrl: string | undefined;

          if (ext === 'pdf') {
            // Upload original PDF file to preserve 100% quality for print/export
            originalFileUrl = await uploadOriginalArtworkFile(file);
            // Generate 300 DPI preview for editor canvas
            previewFile = await renderPdfPreview(file);
          } else if (ext === 'tif' || ext === 'tiff') {
            // Upload original TIFF file to preserve 100% quality
            originalFileUrl = await uploadOriginalArtworkFile(file);
            // Generate 300 DPI transparent preview for editor canvas
            previewFile = await convertTiffToPng(file);
          } else if (ext === 'svg') {
            // Normalize SVG to ensure full dimensions, viewBox offset fixes, and no clipping
            try {
              const { normalizeSvgFile } = await import('@/utils/svgNormalizer');
              const norm = await normalizeSvgFile(file);
              previewFile = norm.file;
            } catch {
              previewFile = file;
            }
          } else {
            // Standard image (JPG, PNG, WebP, GIF)
            previewFile = file;
          }

          // Register in local asset library
          const asset = await assetService.uploadFile(previewFile);

          if (originalFileUrl) {
            asset.originalFileUrl = originalFileUrl;
            asset.originalFileName = file.name;
            asset.fileFormat = ext;
            permanentUrlByAssetIdRef.current.set(asset.id, originalFileUrl);
          }

          // Auto add first uploaded asset to canvas if canvasManager is available
          if (!firstAddedToCanvas && canvasManager) {
            firstAddedToCanvas = true;

            await canvasManager.addImageFromUrl(asset.url, {
              name: file.name,
              originalSrc: originalFileUrl || asset.url,
              naturalWidth: asset.naturalWidth,
              naturalHeight: asset.naturalHeight,
              fileSizeBytes: file.size,
            });
          }
        } catch (error) {
          errors.push(
            error instanceof Error
              ? error.message
              : `Could not upload ${file.name}.`
          );
        }
      }

      if (errors.length > 0) {
        setUploadError(errors.join(' '));
      }
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  };

  const handleSelectAsset = async (asset: UploadedAsset): Promise<void> => {
    if (!canvasManager) return;

    setUploadError(null);

    try {
      const lowerName = asset.name.toLowerCase();
      const isTiff =
        asset.fileFormat === 'tiff' ||
        asset.fileFormat === 'tif' ||
        lowerName.endsWith('.tif') ||
        lowerName.endsWith('.tiff');

      const originalUrl =
        asset.originalFileUrl ||
        permanentUrlByAssetIdRef.current.get(asset.id) ||
        asset.url;

      const isTiffUrl =
        originalUrl?.toLowerCase().includes('.tif') ||
        asset.url?.toLowerCase().includes('.tif');

      const canvasSrc =
        isTiff && isTiffUrl
          ? `${API_URL}/designer/uploads/convert-image?url=${encodeURIComponent(originalUrl || asset.url)}`
          : asset.url;

      await canvasManager.addImageFromUrl(canvasSrc, {
        name: asset.name,
        originalSrc: originalUrl,
        naturalWidth: asset.naturalWidth,
        naturalHeight: asset.naturalHeight,
        fileSizeBytes: asset.fileSizeBytes,
      });
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Could not add the image to the canvas.'
      );
    }
  };

  const handleDeleteAsset = (
    event: React.MouseEvent<HTMLButtonElement>,
    id: string
  ): void => {
    event.stopPropagation();
    permanentUrlByAssetIdRef.current.delete(id);
    assetService.deleteAsset(id);
  };

  return (
    <div className="custom-scrollbar select-none space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
            Uploads
          </h3>
        </div>

        <span className="text-[10px] text-gray-400">
          JPG, PNG, SVG, WebP, PDF, TIFF
        </span>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition ${
          isDragging
            ? 'border-blue-500 bg-blue-50/60'
            : 'border-blue-500/70 bg-blue-50/20 hover:border-blue-500 hover:bg-blue-50/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.svg,.gif,.pdf,.tif,.tiff"
          onChange={(event) => void handleFiles(event.target.files)}
          className="hidden"
        />

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-xs">
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-gray-800">
            {isUploading ? 'Converting & Processing...' : 'Upload Media'}
          </p>
          <p className="mt-0.5 text-[10px] text-gray-400">
            Drag files here or browse • Up to 25 MB each
          </p>
        </div>

        <button
          type="button"
          disabled={isUploading}
          onClick={(event) => {
            event.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Select Files
        </button>
      </div>

      {/* Validation / Error Banner */}
      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-4 text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Uploaded Library Grid */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
          <span>Uploaded Files</span>
          <span className="font-mono text-[10px] text-gray-400">
            ({assets.length})
          </span>
        </div>

        {assets.length > 0 ? (
          <div className="custom-scrollbar grid max-h-[380px] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
            {assets.map((asset) => {
              const lowerName = asset.name.toLowerCase();
              const isPdf =
                asset.fileFormat === 'pdf' || lowerName.endsWith('.pdf');
              const isTiff =
                asset.fileFormat === 'tiff' ||
                asset.fileFormat === 'tif' ||
                lowerName.endsWith('.tif') ||
                lowerName.endsWith('.tiff');

              const isTiffUrl =
                asset.url?.toLowerCase().includes('.tif') ||
                asset.originalFileUrl?.toLowerCase().includes('.tif');

              const previewSrc =
                isTiff && (asset.originalFileUrl || isTiffUrl)
                  ? `${API_URL}/designer/uploads/convert-image?url=${encodeURIComponent(asset.originalFileUrl || asset.url)}`
                  : asset.url;

              return (
                <div
                  key={asset.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleSelectAsset(asset)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      void handleSelectAsset(asset);
                    }
                  }}
                  className="group relative flex aspect-square cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xs transition hover:border-blue-500"
                >
                  <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#f8fafc] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[length:8px_8px] p-2">
                    <img
                      src={previewSrc}
                      alt={asset.name}
                      onError={(e) => {
                        if (
                          asset.originalFileUrl &&
                          e.currentTarget.src !==
                            `${API_URL}/designer/uploads/convert-image?url=${encodeURIComponent(asset.originalFileUrl)}`
                        ) {
                          e.currentTarget.src = `${API_URL}/designer/uploads/convert-image?url=${encodeURIComponent(asset.originalFileUrl)}`;
                        }
                      }}
                      className="max-h-full max-w-full rounded object-contain transition group-hover:scale-105"
                    />

                    {isPdf && (
                      <span className="absolute top-1.5 left-1.5 rounded bg-red-600/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-xs">
                        PDF
                      </span>
                    )}

                    {isTiff && (
                      <span className="absolute top-1.5 left-1.5 rounded bg-blue-600/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-xs">
                        TIFF
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 bg-white px-2 py-1 font-mono text-[9px] text-gray-500">
                    <span className="max-w-[70px] truncate" title={asset.name}>
                      {asset.naturalWidth}×{asset.naturalHeight}
                    </span>
                    <span>{formatFileSize(asset.fileSizeBytes)}</span>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Add to Canvas"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSelectAsset(asset);
                      }}
                      className="rounded-full bg-white p-1.5 text-blue-600 shadow-md transition hover:scale-110"
                    >
                      <Plus className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      title="Delete from Library"
                      onClick={(event) => handleDeleteAsset(event, asset.id)}
                      className="rounded-full bg-white p-1.5 text-red-600 shadow-md transition hover:scale-110"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center text-xs text-gray-400">
            No uploaded images yet
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadsPanel;
