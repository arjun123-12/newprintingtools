import React, { useState, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import {
  X,
  Download,
  Sparkles,
  AlertTriangle,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { CanvasDimensions, DocumentSettings } from '@/types/designer';
import { QualityPreset, ExportFormat } from '@/types/imageUpscaler';
import { imageQualityService } from '@/services/imageQualityService';
import { exportLayeredPsd } from '../services/psdExportService';
import { downloadFile } from '../services/exportService';

export interface DownloadExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasManager: CanvasManager | null;
  dimensions: CanvasDimensions;
  documentSettings: DocumentSettings;
  pages?: Array<{
    id?: string;
    side?: string;
    name?: string;
    canvasJson?: Record<string, any>;
    thumbnail?: string | null;
  }>;
  activePageIndex?: number;
  designName?: string;
}

export const DownloadExportModal: React.FC<DownloadExportModalProps> = ({
  isOpen,
  onClose,
  canvasManager,
  dimensions,
  documentSettings,
  pages = [],
  activePageIndex = 0,
  designName = 'artwork',
}) => {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('print');
  const [customDpi, setCustomDpi] = useState<number>(300);
  const [jpegQuality, setJpegQuality] = useState<number>(95);
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
  const [includeNormal, setIncludeNormal] = useState<boolean>(false);
  const [includeEnhanced, setIncludeEnhanced] = useState<boolean>(true);

  // Status & Progress Tracking
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadReadyUrl, setDownloadReadyUrl] = useState<string | null>(null);
  const [downloadReadyFilename, setDownloadReadyFilename] = useState<string | null>(null);

  // Resolved Target DPI
  const targetDpi = useMemo(() => {
    switch (qualityPreset) {
      case 'web':
        return 72;
      case 'standard':
        return 150;
      case 'print':
        return 300;
      case 'ultra':
        return 600;
      case 'custom':
        return Math.max(50, Math.min(1200, customDpi || 300));
      default:
        return 300;
    }
  }, [qualityPreset, customDpi]);

  // Scan canvas for raster images and analyze effective DPI
  const rasterAnalysis = useMemo(() => {
    if (!isOpen || !canvasManager) return { totalImages: 0, lowResCount: 0, images: [] };

    const canvas = canvasManager.getCanvas();
    if (!canvas) return { totalImages: 0, lowResCount: 0, images: [] };

    const objects = canvas.getObjects();
    const images: Array<{
      id?: string;
      dpi: number;
      qualityLevel: 'excellent' | 'acceptable' | 'low';
      requiresUpscale: boolean;
      recommendedScale: 1 | 2 | 4;
    }> = [];

    let lowResCount = 0;

    for (const obj of objects) {
      if (obj.type === 'image' || obj.type === 'fabricImage') {
        const dpiInfo = canvasManager.calculateImageDpi(obj);
        if (dpiInfo) {
          images.push({
            id: (obj as any).imageId,
            dpi: dpiInfo.effectiveDpi,
            qualityLevel: dpiInfo.qualityLevel,
            requiresUpscale: dpiInfo.effectiveDpi < targetDpi,
            recommendedScale: dpiInfo.recommendedScale,
          });

          if (dpiInfo.effectiveDpi < targetDpi) {
            lowResCount++;
          }
        }
      }
    }

    return {
      totalImages: images.length,
      lowResCount,
      images,
    };
  }, [canvasManager, targetDpi, isOpen]);

  // Calculate estimated output dimensions and file size
  const calculatedSpecs = useMemo(() => {
    const mmW = dimensions.widthMm || 90;
    const mmH = dimensions.heightMm || 50;

    const inchesW = mmW / 25.4;
    const inchesH = mmH / 25.4;

    const pxW = Math.round(inchesW * targetDpi);
    const pxH = Math.round(inchesH * targetDpi);

    const totalPixels = pxW * pxH;
    let estimatedMb = (totalPixels * 4) / (1024 * 1024);

    if (format === 'jpeg' || format === 'webp') {
      estimatedMb = estimatedMb * (jpegQuality / 100) * 0.15;
    } else if (format === 'png') {
      estimatedMb = estimatedMb * 0.45;
    } else if (format === 'psd') {
      estimatedMb = estimatedMb * 1.5;
    }

    return {
      pxW,
      pxH,
      mmW: Math.round(mmW),
      mmH: Math.round(mmH),
      estimatedSizeStr: estimatedMb < 1 ? `${Math.round(estimatedMb * 1024)} KB` : `${estimatedMb.toFixed(1)} MB`,
      isUltraLarge: targetDpi >= 600 || totalPixels > 30000000,
    };
  }, [dimensions, targetDpi, format, jpegQuality]);

  // Handle Export Execution
  const handleStartExport = useCallback(async () => {
    if (!canvasManager) return;
    const canvas = canvasManager.getCanvas();
    if (!canvas) return;

    setIsExporting(true);
    setErrorMessage(null);
    setDownloadReadyUrl(null);
    setExportProgress(10);
    setProgressMessage('Analyzing image quality and preparing canvas...');

    try {
      const sanitizedDocName = (designName || 'artwork').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const objects = canvas.getObjects();

      // 1. If AI enhancement is requested, upscale any low-resolution raster images
      if (includeEnhanced) {
        const lowResImages = objects.filter((o) => {
          if (o.type !== 'image' && o.type !== 'fabricImage') return false;
          const dpiInfo = canvasManager.calculateImageDpi(o);
          return dpiInfo && dpiInfo.effectiveDpi < targetDpi;
        });

        if (lowResImages.length > 0) {
          setProgressMessage(`Enhancing ${lowResImages.length} image(s) with Real-ESRGAN AI...`);
          setExportProgress(20);

          for (let i = 0; i < lowResImages.length; i++) {
            const imgObj = lowResImages[i];
            const dpiInfo = canvasManager.calculateImageDpi(imgObj);
            const scale: 2 | 4 = dpiInfo && dpiInfo.recommendedScale === 4 ? 4 : 2;
            const currentSrc = (imgObj as any).originalSrc || (imgObj as any).src || ((imgObj as any).getSrc ? (imgObj as any).getSrc() : '');
            let imgId = (imgObj as any).imageId;

            setProgressMessage(`Enhancing image ${i + 1} of ${lowResImages.length}...`);
            setExportProgress(20 + Math.round(((i + 1) / lowResImages.length) * 25));

            if (!imgId && currentSrc) {
              try {
                const regRes = await imageQualityService.registerImage(currentSrc);
                if (regRes?.id) {
                  imgId = regRes.id;
                  (imgObj as any).imageId = imgId;
                }
              } catch (regErr) {
                console.warn('Image registration failed:', regErr);
              }
            }

            if (imgId) {
              try {
                const upRes = await imageQualityService.triggerUpscale(imgId, scale, targetDpi);
                if (upRes?.upscaled_url) {
                  await canvasManager.applyUpscaledSourceToObject(imgObj, upRes.upscaled_url, scale);
                }
              } catch (upErr) {
                console.warn('Upscaling image failed:', upErr);
              }
            }
          }
        }
      }

      setExportProgress(50);
      setProgressMessage('Rendering full-resolution artwork...');

      // PDF/PNG/JPEG must not be captured until every image and font is ready.
      // Otherwise remote or recently replaced images can be missing from export.
      await canvasManager.waitForAllImagesToLoad(15000);
      if (typeof document !== 'undefined' && document.fonts) {
        await document.fonts.ready;
      }

      // 2. Prepare canvas for high-resolution render (hide guides, unselect objects, zoom 1.0)
      const wasGuidesVisible = canvasManager.getGuidesVisible();
      const prevZoom = canvasManager.getZoom();
      const prevBg = canvas.backgroundColor;

      canvasManager.setGuidesVisible(false);
      canvas.discardActiveObject();
      canvasManager.setZoom(1.0);

      if (backgroundColor) {
        canvas.backgroundColor = backgroundColor;
      } else if (
        (format === 'jpeg' || format === 'pdf') &&
        (!canvas.backgroundColor || canvas.backgroundColor === 'transparent')
      ) {
        canvas.backgroundColor = documentSettings.backgroundColor || '#ffffff';
      }

      canvas.requestRenderAll();

      // Let Fabric complete the pending render before reading canvas pixels.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      const multiplier = Math.max(1, targetDpi / 72);
      const mimeFormat = format === 'jpeg' ? 'jpeg' : format === 'webp' ? 'webp' : 'png';
      const renderedDataUrl = canvas.toDataURL({
        format: mimeFormat,
        quality: jpegQuality / 100,
        multiplier,
      });

      // Restore interactive canvas state
      canvas.backgroundColor = prevBg;
      canvasManager.setZoom(prevZoom);
      canvasManager.setGuidesVisible(wasGuidesVisible);
      canvas.requestRenderAll();

      setExportProgress(75);

      // 3. Client-side direct downloads (when not requesting both normal + enhanced ZIP package)
      if (!includeNormal || !includeEnhanced) {
        if (format === 'psd') {
          setProgressMessage('Creating layered PSD...');
          const psdFilename = `${sanitizedDocName}-${targetDpi}dpi.psd`;
          await exportLayeredPsd(canvasManager, documentSettings, dimensions, psdFilename);
          setExportProgress(100);
          setProgressMessage('Download ready.');
          setIsExporting(false);
          return;
        }

        if (format === 'pdf') {
          setProgressMessage('Generating PDF...');
          const pdfFilename = `${sanitizedDocName}-${targetDpi}dpi.pdf`;

          /*
           * Use the rendered PNG that already contains every Fabric object.
           * The old SVG PDF path kept external images as URL references, so
           * those images could be missing when jsPDF created the document.
           */
          if (!renderedDataUrl.startsWith('data:image/')) {
            throw new Error('Artwork could not be rendered for PDF export.');
          }

          const pdfWidthMm = Math.max(dimensions.widthMm || 90, 1);
          const pdfHeightMm = Math.max(dimensions.heightMm || 50, 1);
          const orientation: 'portrait' | 'landscape' =
            pdfWidthMm > pdfHeightMm ? 'landscape' : 'portrait';

          const pdf = new jsPDF({
            orientation,
            unit: 'mm',
            format: [pdfWidthMm, pdfHeightMm],
            compress: true,
            precision: 10,
          });

          pdf.addImage(
            renderedDataUrl,
            'PNG',
            0,
            0,
            pdfWidthMm,
            pdfHeightMm,
            undefined,
            'FAST'
          );

          pdf.save(pdfFilename);
          setExportProgress(100);
          setProgressMessage('Download ready.');
          setIsExporting(false);
          return;
        }

        if (format === 'png' || format === 'jpeg' || format === 'webp') {
          setProgressMessage('Generating image file...');
          const ext = format === 'jpeg' ? 'jpg' : format;
          const imgFilename = `${sanitizedDocName}-${targetDpi}dpi.${ext}`;
          downloadFile(renderedDataUrl, imgFilename);
          setExportProgress(100);
          setProgressMessage('Download ready.');
          setIsExporting(false);
          return;
        }
      }

      // 4. Multi-Format Backend Export Dispatch (TIFF or Dual Normal+Enhanced ZIP)
      setProgressMessage('Packaging download...');
      setExportProgress(80);

      const currentCanvasJson = canvasManager.getSerializableJson();
      const serializablePages = pages.length > 0
        ? pages.map((p, idx) => ({
          side: p.side || (idx === 0 ? 'front' : 'back'),
          name: p.name || `Page ${idx + 1}`,
          canvas_json: idx === activePageIndex ? currentCanvasJson : (p.canvasJson || currentCanvasJson),
          rendered_data_url: idx === activePageIndex ? renderedDataUrl : (p.thumbnail || renderedDataUrl),
        }))
        : [{
          side: 'front',
          name: 'Front',
          canvas_json: currentCanvasJson,
          rendered_data_url: renderedDataUrl,
        }];

      const exportResponse = await imageQualityService.startExport({
        name: sanitizedDocName,
        format,
        quality_preset: qualityPreset,
        custom_dpi: qualityPreset === 'custom' ? targetDpi : undefined,
        target_dpi: targetDpi,
        include_normal: includeNormal,
        include_enhanced: includeEnhanced,
        quality: jpegQuality,
        background_color: backgroundColor,
        dimensions: {
          width_mm: dimensions.widthMm || 90,
          height_mm: dimensions.heightMm || 50,
          width_px: dimensions.widthPx || 1063,
          height_px: dimensions.heightPx || 591,
        },
        pages: serializablePages,
      });

      if (exportResponse.status === 'completed' && exportResponse.download_url) {
        setExportProgress(100);
        setProgressMessage('Download ready.');
        setDownloadReadyUrl(exportResponse.download_url);
        setDownloadReadyFilename(exportResponse.file_name);
        setIsExporting(false);

        downloadFile(exportResponse.download_url, exportResponse.file_name || `${sanitizedDocName}.${format}`);
        return;
      }

      // Poll background status
      const exportId = exportResponse.id;
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const statusData = await imageQualityService.getExportStatus(exportId);
          setExportProgress(Math.max(80, statusData.progress || 80));

          if (statusData.status === 'completed' && statusData.download_url) {
            clearInterval(pollTimer);
            setExportProgress(100);
            setProgressMessage('Download ready.');
            setDownloadReadyUrl(statusData.download_url);
            setDownloadReadyFilename(statusData.file_name);
            setIsExporting(false);

            downloadFile(statusData.download_url, statusData.file_name || `${sanitizedDocName}.${format}`);
          } else if (statusData.status === 'failed') {
            clearInterval(pollTimer);
            setIsExporting(false);
            setErrorMessage(statusData.error_message || 'Export processing failed.');
          } else if (attempts > 120) {
            clearInterval(pollTimer);
            setIsExporting(false);
            setErrorMessage('Export timed out. Please try again with lower resolution.');
          }
        } catch (pollErr) {
          console.warn('Poll error:', pollErr);
        }
      }, 1500);
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred during export.');
    }
  }, [
    canvasManager,
    dimensions,
    documentSettings,
    pages,
    activePageIndex,
    designName,
    format,
    qualityPreset,
    targetDpi,
    includeNormal,
    includeEnhanced,
    jpegQuality,
    backgroundColor,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-none">Download Print Artwork</h2>
              <p className="text-xs text-gray-500 mt-1">Export high-resolution files with local Real-ESRGAN AI enhancement</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Format Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              1. File Format
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { id: 'png', label: 'PNG', badge: 'Lossless' },
                { id: 'pdf', label: 'PDF', badge: 'Print Ready' },
                { id: 'psd', label: 'PSD', badge: 'Layered' },
                { id: 'jpeg', label: 'JPEG', badge: 'Compact' },
                { id: 'tiff', label: 'TIFF', badge: 'LZW Print' },
                { id: 'webp', label: 'WebP', badge: 'Web' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormat(fmt.id as ExportFormat)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${format === fmt.id
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 text-blue-900 font-bold shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-medium'
                    }`}
                >
                  <span className="text-sm font-bold">{fmt.label}</span>
                  <span className="text-[10px] text-gray-500 mt-0.5">{fmt.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quality Presets */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              2. Download Quality Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'web', label: 'Web', dpi: '72 DPI', desc: 'Screen & Social' },
                { id: 'standard', label: 'Standard', dpi: '150 DPI', desc: 'Proofing' },
                { id: 'print', label: 'Print', dpi: '300 DPI', desc: 'Commercial' },
                { id: 'ultra', label: 'Ultra', dpi: '600 DPI', desc: 'Fine Art' },
                { id: 'custom', label: 'Custom', dpi: `${customDpi} DPI`, desc: 'Custom' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setQualityPreset(p.id as QualityPreset)}
                  className={`p-3 rounded-xl border text-left transition-all ${qualityPreset === p.id
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 text-blue-900 shadow-xs font-bold'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-medium'
                    }`}
                >
                  <div className="text-xs font-bold">{p.label}</div>
                  <div className="text-xs font-mono text-blue-600 mt-0.5">{p.dpi}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>

            {/* Custom DPI Slider */}
            {qualityPreset === 'custom' && (
              <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>Custom Target Resolution</span>
                  <span className="font-mono text-blue-600">{customDpi} DPI</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1200"
                  step="25"
                  value={customDpi}
                  onChange={(e) => setCustomDpi(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>50 DPI (Draft)</span>
                  <span>300 DPI (Standard Print)</span>
                  <span>1200 DPI (Max)</span>
                </div>
              </div>
            )}

            {/* Ultra Quality Warning */}
            {calculatedSpecs.isUltraLarge && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">High Resolution Notice:</span> 600+ DPI generates extremely large pixel dimensions ({calculatedSpecs.pxW}x{calculatedSpecs.pxH}px) and may require additional processing time.
                </div>
              </div>
            )}
          </div>

          {/* Normal vs Enhanced Versions */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-gray-900">Local Real-ESRGAN AI Upscaling</span>
              </div>
              {rasterAnalysis.lowResCount > 0 ? (
                <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  {rasterAnalysis.lowResCount} image{rasterAnalysis.lowResCount > 1 ? 's' : ''} below {targetDpi} DPI
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  All images commercial print ready
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-gray-200 cursor-pointer hover:border-gray-300 transition">
                <input
                  type="checkbox"
                  checked={includeEnhanced}
                  onChange={(e) => setIncludeEnhanced(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-bold text-gray-800">Include AI-Enhanced Version</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Replaces low-res images with sharp 4x Real-ESRGAN upscaled pixels
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-gray-200 cursor-pointer hover:border-gray-300 transition">
                <input
                  type="checkbox"
                  checked={includeNormal}
                  onChange={(e) => setIncludeNormal(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-bold text-gray-800">Include Normal Version</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Original unenhanced source raster images for side-by-side comparison
                  </div>
                </div>
              </label>
            </div>

            {includeNormal && includeEnhanced && (
              <div className="text-[11px] text-indigo-700 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-200 flex items-center gap-2">
                <Archive className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Both versions will be packaged together into a single ZIP file with an audit report.</span>
              </div>
            )}
          </div>

          {/* Format Specific Options */}
          {(format === 'jpeg' || format === 'webp') && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>Compression Quality</span>
                <span className="font-mono text-blue-600">{jpegQuality}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="100"
                step="1"
                value={jpegQuality}
                onChange={(e) => setJpegQuality(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs text-gray-600 font-medium">Background:</span>
                <button
                  type="button"
                  onClick={() => setBackgroundColor('#ffffff')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${backgroundColor === '#ffffff' ? 'bg-white border-blue-600 text-blue-600 ring-1 ring-blue-600' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                >
                  White
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundColor('#000000')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${backgroundColor === '#000000' ? 'bg-black border-blue-600 text-white ring-1 ring-blue-600' : 'bg-black text-white border-gray-800'
                    }`}
                >
                  Black
                </button>
              </div>
            </div>
          )}

          {/* Technical Export Summary */}
          <div className="flex items-center justify-between text-xs text-gray-500 px-1 font-mono">
            <div>
              Output: <span className="text-gray-800 font-bold">{calculatedSpecs.pxW} × {calculatedSpecs.pxH} px</span> ({calculatedSpecs.mmW} × {calculatedSpecs.mmH} mm)
            </div>
            <div>
              Approx. Size: <span className="text-gray-800 font-bold">{calculatedSpecs.estimatedSizeStr}</span>
            </div>
          </div>

          {/* Progress & Error Displays */}
          {isExporting && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-blue-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>{progressMessage}</span>
                </span>
                <span>{exportProgress}%</span>
              </div>
              <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <div>
                <span className="font-bold">Export Failed:</span> {errorMessage}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-200 transition disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleStartExport}
            disabled={isExporting || (!includeNormal && !includeEnhanced)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Export...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download {format.toUpperCase()} ({targetDpi} DPI)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
