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
import { downloadFile, exportVectorPdf, ensureSafePngOrJpegDataUrl } from '../services/exportService';
import { POPULAR_FONTS } from '../utils/fonts';
import { urlToSafeDataUrl } from '@/utils/imageUrl';

type DownloadFormat = ExportFormat | 'svg';

const downloadSvgFile = (svgMarkup: string, filename: string): void => {
  const blob = new Blob([svgMarkup], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

/**
 * Fabric keeps text, paths and shapes as SVG vectors. Raster photos are kept
 * at their original pixel resolution and embedded as data URLs so the SVG and PDF
 * are completely self-contained with images intact.
 */
const inlineSvgRasterImages = async (
  svgMarkup: string,
  canvasManager?: CanvasManager | null
): Promise<string> => {
  const parser = new DOMParser();
  const svgDocument = parser.parseFromString(svgMarkup, 'image/svg+xml');

  if (svgDocument.querySelector('parsererror')) {
    throw new Error('Fabric generated invalid SVG markup.');
  }

  // Ensure root SVG declares both SVG and XLINK namespaces cleanly
  const root = svgDocument.documentElement;
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  root.setAttribute('version', '1.1');

  // 1. Build an in-memory dictionary and indexed list of all images present on the Fabric canvas
  const canvasImageMap = new Map<string, string>();
  const canvasImagesList: Array<{ dataUrl: string; originalSrc?: string }> = [];

  if (canvasManager) {
    const canvas = canvasManager.getCanvas();
    if (canvas) {
      const collectImage = (imgObj: any) => {
        if (!imgObj) return;
        const el = imgObj._element || (typeof imgObj.getElement === 'function' ? imgObj.getElement() : null);
        let extractedDataUrl: string | null = null;

        // Try extracting from memory HTMLImageElement / HTMLCanvasElement directly
        if (el) {
          if (el instanceof HTMLCanvasElement) {
            try {
              extractedDataUrl = el.toDataURL('image/png');
            } catch {}
          } else if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) {
            try {
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = el.naturalWidth;
              tempCanvas.height = el.naturalHeight;
              const ctx = tempCanvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(el, 0, 0);
                extractedDataUrl = tempCanvas.toDataURL('image/png');
              }
            } catch {}
          }
        }

        // Try Fabric object toDataURL fallback
        if (!extractedDataUrl && typeof imgObj.toDataURL === 'function') {
          try {
            const d = imgObj.toDataURL({ format: 'png' });
            if (d && d.startsWith('data:image/')) extractedDataUrl = d;
          } catch {}
        }

        // Associate all known identifiers of this image with the extracted data URL
        const keys = [
          imgObj.src,
          imgObj.originalSrc,
          typeof imgObj.getSrc === 'function' ? imgObj.getSrc() : null,
          typeof imgObj.getSrc === 'function' ? imgObj.getSrc(true) : null,
          typeof imgObj.getSvgSrc === 'function' ? imgObj.getSvgSrc() : null,
          el?.src,
          el?.getAttribute?.('src'),
          imgObj.get?.('originalSrc'),
          imgObj.get?.('src'),
          imgObj.get?.('assetId'),
          imgObj.get?.('customShapeUrl'),
        ].filter((k): k is string => typeof k === 'string' && k.length > 0);

        if (extractedDataUrl && extractedDataUrl.startsWith('data:image/')) {
          canvasImagesList.push({
            dataUrl: extractedDataUrl,
            originalSrc: imgObj.originalSrc || imgObj.src,
          });

          for (const key of keys) {
            canvasImageMap.set(key, extractedDataUrl);
            try {
              canvasImageMap.set(decodeURIComponent(key), extractedDataUrl);
              canvasImageMap.set(encodeURIComponent(key), extractedDataUrl);
            } catch {}
          }
        }
      };

      const inspectCanvasObject = (obj: any) => {
        if (!obj) return;
        if (obj.type === 'image' || obj.type === 'fabricImage') {
          collectImage(obj);
        }

        // Handle Canva Frames and Photo Shapes
        const frameImage = (obj as any)._frameImage || (obj as any).frameImage;
        if (frameImage) {
          collectImage(frameImage);
        }

        // Handle pattern fills
        if (obj.fill && typeof obj.fill === 'object' && (obj.fill as any).source) {
          collectImage({ _element: (obj.fill as any).source, src: (obj.fill as any).source?.src });
        }

        // Handle clipPath image
        if (obj.clipPath && (obj.clipPath.type === 'image' || obj.clipPath.type === 'fabricImage')) {
          collectImage(obj.clipPath);
        }

        // Handle Group children
        if (Array.isArray(obj._objects)) {
          obj._objects.forEach(inspectCanvasObject);
        } else if (typeof obj.getObjects === 'function') {
          try {
            obj.getObjects().forEach(inspectCanvasObject);
          } catch {}
        }
      };

      canvas.getObjects().forEach(inspectCanvasObject);
      if (canvas.backgroundImage) {
        inspectCanvasObject(canvas.backgroundImage);
        collectImage(canvas.backgroundImage);
      }
    }
  }

  // 2. Iterate through all <image> tags in the SVG document
  const imageNodes = [
    ...Array.from(svgDocument.getElementsByTagName('image')),
    ...Array.from(svgDocument.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'image')),
    ...Array.from(svgDocument.querySelectorAll('image')),
  ];
  const uniqueImages = Array.from(new Set(imageNodes));

  await Promise.all(
    uniqueImages.map(async (image, idx) => {
      const rawHref =
        image.getAttribute('href') ||
        image.getAttribute('xlink:href') ||
        image.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
        image.getAttributeNS(null, 'href') ||
        '';

      if (!rawHref) return;

      let safeDataUrl: string | null = null;

      // 1. If already a PNG or JPEG data URL, reuse directly
      if (
        rawHref.startsWith('data:image/png;') ||
        rawHref.startsWith('data:image/jpeg;') ||
        rawHref.startsWith('data:image/jpg;')
      ) {
        safeDataUrl = rawHref;
      }

      // 2. Exact match from in-memory canvasImageMap
      if (!safeDataUrl) {
        safeDataUrl = canvasImageMap.get(rawHref) || null;
        if (!safeDataUrl) {
          try {
            safeDataUrl = canvasImageMap.get(decodeURIComponent(rawHref)) || null;
          } catch {}
        }
        if (!safeDataUrl) {
          try {
            safeDataUrl = canvasImageMap.get(encodeURIComponent(rawHref)) || null;
          } catch {}
        }
      }

      // 3. Substring / decoded component search in canvasImageMap
      if (!safeDataUrl) {
        let decodedRaw = rawHref;
        try {
          decodedRaw = decodeURIComponent(rawHref);
        } catch {}

        for (const [key, val] of canvasImageMap.entries()) {
          let decodedKey = key;
          try {
            decodedKey = decodeURIComponent(key);
          } catch {}

          if (
            decodedRaw === decodedKey ||
            decodedRaw.includes(decodedKey) ||
            decodedKey.includes(decodedRaw)
          ) {
            safeDataUrl = val;
            break;
          }
        }
      }

      // 4. If still not matched, check order-matched canvasImagesList
      if (!safeDataUrl && canvasImagesList[idx]) {
        safeDataUrl = canvasImagesList[idx].dataUrl;
      }

      // 5. Fallback: Convert URL or non-PNG data URL to safe PNG data URL
      if (!safeDataUrl || !safeDataUrl.startsWith('data:image/')) {
        try {
          safeDataUrl = await ensureSafePngOrJpegDataUrl(rawHref);
        } catch (err) {
          console.warn('Failed to convert SVG image href to safe PNG data URL:', rawHref, err);
        }
      } else if (
        safeDataUrl.startsWith('data:') &&
        !safeDataUrl.startsWith('data:image/png;') &&
        !safeDataUrl.startsWith('data:image/jpeg;') &&
        !safeDataUrl.startsWith('data:image/jpg;')
      ) {
        // Transcode WebP / SVG data URLs to PNG so PDFKit and legacy viewers render properly
        try {
          safeDataUrl = await ensureSafePngOrJpegDataUrl(safeDataUrl);
        } catch (err) {
          console.warn('Failed to transcode data URL to PNG:', err);
        }
      }

      // 6. Apply clean attributes (strictly preventing duplicate attribute definitions)
      if (safeDataUrl && safeDataUrl.startsWith('data:image/')) {
        image.removeAttribute('xlink:href');
        image.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
        image.removeAttribute('href');

        image.setAttribute('href', safeDataUrl);
        image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', safeDataUrl);
      } else {
        console.warn('Could not convert SVG image to data URL, leaving original:', rawHref);
      }
    })
  );

  return new XMLSerializer().serializeToString(svgDocument);
};

/**
 * Resolves effective background settings from the canvas / manager / document.
 */
function getEffectiveBackground(
  canvasManager: CanvasManager | null,
  documentSettings: DocumentSettings
): {
  type: 'color' | 'gradient' | 'image' | 'none';
  color?: string;
  gradient?: any;
  image?: any;
} {
  if (!canvasManager) {
    return { type: 'color', color: documentSettings.backgroundColor || '#ffffff' };
  }
  const canvas = canvasManager.getCanvas();
  const bgSettings = canvasManager.getBackgroundSettings?.();

  if (canvas?.backgroundImage) {
    return { type: 'image', image: canvas.backgroundImage };
  }
  if (bgSettings?.type === 'gradient' && bgSettings.gradient) {
    return { type: 'gradient', gradient: bgSettings.gradient };
  }
  if (canvas?.backgroundColor) {
    if (typeof canvas.backgroundColor === 'string' && canvas.backgroundColor !== 'transparent' && canvas.backgroundColor !== '') {
      return { type: 'color', color: canvas.backgroundColor };
    }
    if ((canvas.backgroundColor as any)?.type === 'linear' || (canvas.backgroundColor as any)?.type === 'radial') {
      return { type: 'gradient', gradient: canvas.backgroundColor };
    }
  }
  if (bgSettings?.type === 'color' && bgSettings.color && bgSettings.color !== 'transparent' && bgSettings.color !== '') {
    return { type: 'color', color: bgSettings.color };
  }
  return { type: 'color', color: documentSettings.backgroundColor || '#ffffff' };
}

/**
 * Adds professional prepress crop / trim marks and bleed around a rendered artwork canvas.
 */
function renderCanvasWithTrimMarks(
  sourceCanvas: HTMLCanvasElement,
  dimensions: CanvasDimensions,
  dpi: number,
  marginMm: number = 6,
  backgroundColor: string = '#ffffff'
): HTMLCanvasElement {
  const pxPerMm = dpi / 25.4;
  const marginPx = Math.round(marginMm * pxPerMm);
  const markLengthPx = Math.round(4 * pxPerMm); // 4mm mark length
  const markGapPx = Math.round(1.5 * pxPerMm);   // 1.5mm offset from cut line
  const lineWidth = Math.max(1, Math.round(0.75 * (dpi / 72)));

  const artW = sourceCanvas.width;
  const artH = sourceCanvas.height;

  const totalW = artW + marginPx * 2;
  const totalH = artH + marginPx * 2;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = totalW;
  exportCanvas.height = totalH;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  // Background for outer slug area
  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, totalW, totalH);
  }

  // Draw artwork centered inside the trim marks
  ctx.drawImage(sourceCanvas, marginPx, marginPx);

  // Setup stroke for registration black crop marks
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'square';

  const x1 = marginPx;
  const y1 = marginPx;
  const x2 = marginPx + artW;
  const y2 = marginPx + artH;

  ctx.beginPath();

  // Top-Left Corner
  ctx.moveTo(x1, y1 - markGapPx);
  ctx.lineTo(x1, Math.max(0, y1 - markGapPx - markLengthPx));
  ctx.moveTo(x1 - markGapPx, y1);
  ctx.lineTo(Math.max(0, x1 - markGapPx - markLengthPx), y1);

  // Top-Right Corner
  ctx.moveTo(x2, y1 - markGapPx);
  ctx.lineTo(x2, Math.max(0, y1 - markGapPx - markLengthPx));
  ctx.moveTo(x2 + markGapPx, y1);
  ctx.lineTo(Math.min(totalW, x2 + markGapPx + markLengthPx), y1);

  // Bottom-Left Corner
  ctx.moveTo(x1, y2 + markGapPx);
  ctx.lineTo(x1, Math.min(totalH, y2 + markGapPx + markLengthPx));
  ctx.moveTo(x1 - markGapPx, y2);
  ctx.lineTo(Math.max(0, x1 - markGapPx - markLengthPx), y2);

  // Bottom-Right Corner
  ctx.moveTo(x2, y2 + markGapPx);
  ctx.lineTo(x2, Math.min(totalH, y2 + markGapPx + markLengthPx));
  ctx.moveTo(x2 + markGapPx, y2);
  ctx.lineTo(Math.min(totalW, x2 + markGapPx + markLengthPx), y2);

  ctx.stroke();

  return exportCanvas;
}

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
  const [format, setFormat] = useState<DownloadFormat>('png');
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('print');
  const [customDpi, setCustomDpi] = useState<number>(300);
  const [jpegQuality, setJpegQuality] = useState<number>(95);
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
  const [transparentBackground, setTransparentBackground] = useState<boolean>(false);
  const [includeTrimMarks, setIncludeTrimMarks] = useState<boolean>(true);
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
    const trimMarginMm = includeTrimMarks ? 6 : 0;
    const mmW = (dimensions.widthMm || 90) + trimMarginMm * 2;
    const mmH = (dimensions.heightMm || 50) + trimMarginMm * 2;

    const inchesW = mmW / 25.4;
    const inchesH = mmH / 25.4;

    const pxW = Math.round(inchesW * targetDpi);
    const pxH = Math.round(inchesH * targetDpi);

    const totalPixels = pxW * pxH;
    let estimatedMb = (totalPixels * 4) / (1024 * 1024);

    if (format === 'svg') {
      estimatedMb = 0;
    } else if (format === 'jpeg' || format === 'webp') {
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
      estimatedSizeStr:
        format === 'svg'
          ? (includeTrimMarks ? 'Vector with trim marks' : 'Vector + original images')
          : estimatedMb < 1
            ? `${Math.round(estimatedMb * 1024)} KB`
            : `${estimatedMb.toFixed(1)} MB`,
      isUltraLarge:
        format !== 'svg' && (targetDpi >= 600 || totalPixels > 30000000),
    };
  }, [dimensions, targetDpi, format, jpegQuality, includeTrimMarks]);

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

      // SVG and True Vector PDF are resolution-independent and generated directly
      // from vector artwork before rasterization or AI replacement.
      if (format === 'svg' || format === 'pdf') {
        setProgressMessage(
          format === 'svg'
            ? 'Building self-contained vector SVG...'
            : 'Generating true vector PDF with sharp typography...'
        );
        setExportProgress(30);

        await canvasManager.waitForAllImagesToLoad(15000);
        if (typeof document !== 'undefined' && document.fonts) {
          await document.fonts.ready;
        }

        const guidesWereVisible = canvasManager.getGuidesVisible();
        const previousZoom = canvasManager.getZoom();

        try {
          canvasManager.setGuidesVisible(false);
          canvas.discardActiveObject();
          canvasManager.setZoom(1);
          canvas.requestRenderAll();

          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });

          const canvasWidth = Math.max(dimensions.widthPx || 1063, 1);
          const canvasHeight = Math.max(dimensions.heightPx || 591, 1);
          const physicalWidthMm = Math.max(dimensions.widthMm || 90, 1);
          const physicalHeightMm = Math.max(dimensions.heightMm || 50, 1);

          let fabricSvg = canvas.toSVG({
            suppressPreamble: true,
            width: `${physicalWidthMm}mm`,
            height: `${physicalHeightMm}mm`,
            viewBox: {
              x: 0,
              y: 0,
              width: canvasWidth,
              height: canvasHeight,
            },
          });

          // Ensure Google Fonts are embedded in SVG <defs><style> so fonts stay vector and exact everywhere
          const googleFontQueries = new Set<string>();
          canvas.getObjects().forEach((obj) => {
            if (canvasManager.isTextObject(obj) || (obj as any).type === 'textbox' || (obj as any).type === 'text') {
              const fam = ((obj as any).fontFamily || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
              const matched = POPULAR_FONTS.find(
                (f) => f.name.toLowerCase() === fam.toLowerCase() || f.family.toLowerCase().includes(fam.toLowerCase())
              );
              if (matched?.googleFont) {
                googleFontQueries.add(`family=${matched.googleFont}`);
              }
            }
          });

          let fontDefs = '';
          if (googleFontQueries.size > 0) {
            const fontUrl = `https://fonts.googleapis.com/css2?${Array.from(googleFontQueries).join('&')}&display=swap`;
            fontDefs = `<defs><style type="text/css">@import url('${fontUrl}');</style></defs>\n`;
          }

          // FIX: Ensure Background is NEVER missing in SVG!
          // 1. If backgroundImage exists, Fabric toSVG omits it. We serialize and prepend it!
          // 2. If background color or gradient exists and not transparent, ensure a background rect exists!
          const effBg = getEffectiveBackground(canvasManager, documentSettings);
          let bgSvgElements = '';

          if (!transparentBackground) {
            if (effBg.type === 'color' && effBg.color) {
              if (!fabricSvg.includes('<rect ') || fabricSvg.indexOf('<rect') > fabricSvg.indexOf('<g')) {
                bgSvgElements += `<rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="${effBg.color}" />\n`;
              }
            } else if (effBg.type === 'gradient' && effBg.gradient) {
              const grad = effBg.gradient;
              const angleRad = (((grad.angle || 0) - 90) * Math.PI) / 180;
              const cx = canvasWidth / 2;
              const cy = canvasHeight / 2;
              const len = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight) / 2;
              const x1 = cx - Math.cos(angleRad) * len;
              const y1 = cy - Math.sin(angleRad) * len;
              const x2 = cx + Math.cos(angleRad) * len;
              const y2 = cy + Math.sin(angleRad) * len;
              const stops = (grad.stops || []).map(
                (s: any) => `<stop offset="${s.offset * 100}%" stop-color="${s.color}" />`
              ).join('');
              bgSvgElements += `<defs><linearGradient id="export-bg-grad" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs><rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="url(#export-bg-grad)" />\n`;
            }

            if (canvas.backgroundImage && typeof canvas.backgroundImage.toSVG === 'function') {
              bgSvgElements += canvas.backgroundImage.toSVG() + '\n';
            }
          }

          if (bgSvgElements || fontDefs) {
            const svgOpenTagEnd = fabricSvg.indexOf('>') + 1;
            fabricSvg = fabricSvg.slice(0, svgOpenTagEnd) + '\n' + fontDefs + bgSvgElements + fabricSvg.slice(svgOpenTagEnd);
          }

          let totalW = canvasWidth;
          let totalH = canvasHeight;

          // FIX: If includeTrimMarks is enabled for SVG/PDF, expand viewBox and draw 8 precision corner crop marks!
          if (includeTrimMarks) {
            const marginMm = 6;
            const pxPerMm = canvasWidth / physicalWidthMm;
            const marginPx = Math.round(marginMm * pxPerMm);
            totalW = canvasWidth + marginPx * 2;
            totalH = canvasHeight + marginPx * 2;
            const totalMmW = physicalWidthMm + marginMm * 2;
            const totalMmH = physicalHeightMm + marginMm * 2;

            const x1 = marginPx;
            const y1 = marginPx;
            const x2 = marginPx + canvasWidth;
            const y2 = marginPx + canvasHeight;
            const markLen = Math.round(4 * pxPerMm);
            const markGap = Math.round(1.5 * pxPerMm);

            const trimMarksSvg = `
  <!-- Trim Marks -->
  <g stroke="#000000" stroke-width="0.75" stroke-linecap="square">
    <!-- Top-Left -->
    <line x1="${x1}" y1="${y1 - markGap}" x2="${x1}" y2="${y1 - markGap - markLen}" />
    <line x1="${x1 - markGap}" y1="${y1}" x2="${x1 - markGap - markLen}" y2="${y1}" />
    <!-- Top-Right -->
    <line x1="${x2}" y1="${y1 - markGap}" x2="${x2}" y2="${y1 - markGap - markLen}" />
    <line x1="${x2 + markGap}" y1="${y1}" x2="${x2 + markGap + markLen}" y2="${y1}" />
    <!-- Bottom-Left -->
    <line x1="${x1}" y1="${y2 + markGap}" x2="${x1}" y2="${y2 + markGap + markLen}" />
    <line x1="${x1 - markGap}" y1="${y2}" x2="${x1 - markGap - markLen}" y2="${y2}" />
    <!-- Bottom-Right -->
    <line x1="${x2}" y1="${y2 + markGap}" x2="${x2}" y2="${y2 + markGap + markLen}" />
    <line x1="${x2 + markGap}" y1="${y2}" x2="${x2 + markGap + markLen}" y2="${y2}" />
  </g>
`;

            const svgOpenMatch = fabricSvg.match(/<svg[^>]*>/);
            if (svgOpenMatch) {
              const openTag = svgOpenMatch[0];
              const innerContent = fabricSvg.slice(openTag.length, fabricSvg.lastIndexOf('</svg>'));
              const newOpenTag = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${totalMmW}mm" height="${totalMmH}mm" viewBox="0 0 ${totalW} ${totalH}">`;
              fabricSvg = `${newOpenTag}
  <!-- Slug background -->
  <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff" />
  <g transform="translate(${marginPx}, ${marginPx})">
    ${innerContent}
  </g>
  ${trimMarksSvg}
</svg>`;
            }
          }

          setExportProgress(70);
          setProgressMessage('Embedding original-resolution images...');

          const selfContainedSvg = await inlineSvgRasterImages(fabricSvg, canvasManager);

          if (format === 'svg') {
            downloadSvgFile(selfContainedSvg, `${sanitizedDocName}-vector${includeTrimMarks ? '-with-trim-marks' : ''}.svg`);
            setExportProgress(100);
            setProgressMessage('True Vector SVG download ready.');
            setIsExporting(false);
            return;
          }

          if (format === 'pdf') {
            setProgressMessage('Compiling true vector PDF...');
            setExportProgress(85);
            const pdfFilename = `${sanitizedDocName}-vector${includeTrimMarks ? '-with-trim-marks' : ''}.pdf`;

            try {
              await exportVectorPdf(
                [selfContainedSvg],
                documentSettings,
                totalW,
                totalH,
                { filename: pdfFilename }
              );
              setExportProgress(100);
              setProgressMessage('True Vector PDF ready.');
              setIsExporting(false);
              return;
            } catch (vectorPdfError) {
              console.warn('Vector PDF export failed, falling back to high-res raster PDF:', vectorPdfError);
              // Fall through to raster PDF fallback below
            }
          }
        } finally {
          canvasManager.setZoom(previousZoom);
          canvasManager.setGuidesVisible(guidesWereVisible);
          canvas.requestRenderAll();
        }
      }

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

      const effBg = getEffectiveBackground(canvasManager, documentSettings);
      const effBgColor = effBg.type === 'color' && effBg.color ? effBg.color : documentSettings.backgroundColor || '#ffffff';

      // DO NOT overwrite existing custom background color or gradient with plain white!
      if (transparentBackground && (format === 'png' || format === 'webp')) {
        canvas.backgroundColor = '';
      } else if (!canvas.backgroundColor || canvas.backgroundColor === 'transparent') {
        canvas.backgroundColor = effBgColor;
      }

      canvas.requestRenderAll();

      // Let Fabric complete the pending render before reading canvas pixels.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      const multiplier = Math.max(1, targetDpi / 72);
      const mimeFormat = format === 'jpeg' ? 'jpeg' : format === 'webp' ? 'webp' : 'png';
      let renderedDataUrl = canvas.toDataURL({
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

      // ADD TRIM MARKS & BLEED TO RASTER CANVAS IF REQUESTED
      if (includeTrimMarks) {
        setProgressMessage('Adding precision trim marks and bleed...');
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = () => reject(new Error('Failed to load rendered artwork for trim marks'));
          i.src = renderedDataUrl;
        });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.naturalWidth || img.width;
        tempCanvas.height = img.naturalHeight || img.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(img, 0, 0);
          const withMarksCanvas = renderCanvasWithTrimMarks(
            tempCanvas,
            dimensions,
            targetDpi,
            6,
            transparentBackground ? 'transparent' : '#ffffff'
          );
          renderedDataUrl = withMarksCanvas.toDataURL(
            mimeFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
            jpegQuality / 100
          );
        }
      }

      // 3. Client-side direct downloads (when not requesting both normal + enhanced ZIP package)
      if (!includeNormal || !includeEnhanced) {
        if (format === 'psd') {
          setProgressMessage('Creating layered PSD...');
          const psdFilename = `${sanitizedDocName}-${targetDpi}dpi${includeTrimMarks ? '-with-trim-marks' : ''}.psd`;
          await exportLayeredPsd(canvasManager, documentSettings, dimensions, psdFilename, includeTrimMarks);
          setExportProgress(100);
          setProgressMessage('Download ready.');
          setIsExporting(false);
          return;
        }

        if (format === 'pdf') {
          setProgressMessage('Generating PDF...');
          const pdfFilename = `${sanitizedDocName}-${targetDpi}dpi${includeTrimMarks ? '-with-trim-marks' : ''}.pdf`;

          /*
           * Use the rendered PNG that already contains every Fabric object.
           */
          if (!renderedDataUrl.startsWith('data:image/')) {
            throw new Error('Artwork could not be rendered for PDF export.');
          }

          const marginMm = includeTrimMarks ? 6 : 0;
          const pdfWidthMm = Math.max((dimensions.widthMm || 90) + marginMm * 2, 1);
          const pdfHeightMm = Math.max((dimensions.heightMm || 50) + marginMm * 2, 1);
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
          const imgFilename = `${sanitizedDocName}-${targetDpi}dpi${includeTrimMarks ? '-with-trim-marks' : ''}.${ext}`;
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
        background_color: effBgColor,
        dimensions: {
          width_mm: (dimensions.widthMm || 90) + (includeTrimMarks ? 12 : 0),
          height_mm: (dimensions.heightMm || 50) + (includeTrimMarks ? 12 : 0),
          width_px: calculatedSpecs.pxW,
          height_px: calculatedSpecs.pxH,
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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[
                { id: 'svg', label: 'SVG', badge: 'True Vector' },
                { id: 'png', label: 'PNG', badge: 'Lossless' },
                { id: 'pdf', label: 'PDF', badge: 'Vector PDF' },
                { id: 'psd', label: 'PSD', badge: 'Layered' },
                { id: 'jpeg', label: 'JPEG', badge: 'Compact' },
                { id: 'tiff', label: 'TIFF', badge: 'LZW Print' },
                { id: 'webp', label: 'WebP', badge: 'Web' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormat(fmt.id as DownloadFormat)}
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

          {format === 'svg' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Resolution-Independent Vector SVG</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
                Text typography, paths and shapes stay 100% vector objects. Google Fonts and typography styles are embedded directly in the SVG so fonts stay sharp, crisp, and identical everywhere.
              </p>
            </div>
          )}

          {format === 'pdf' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>True Vector PDF (Sharp Typography & Commercial Print)</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
                Text and vector shapes are compiled directly as resolution-independent PDF vectors. Text never blurs or pixelates at any zoom level or physical print scale. Photos are embedded at full resolution.
              </p>
            </div>
          )}

          {/* Quality Presets */}
          <div className={format === 'svg' ? 'hidden' : undefined}>
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
          <div className={`${format === 'svg' ? 'hidden' : ''} p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3`}>
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

          {/* Print Trim Marks & Bleed Option (Available for all formats) */}
          <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTrimMarks}
                onChange={(e) => setIncludeTrimMarks(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">Crop marks and bleed (Trim marks)</span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                    Print Ready
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                  Adds standard 3mm bleed and precision corner trim marks for professional printing & cutting across {format.toUpperCase()} and all formats.
                </p>
              </div>
            </label>
          </div>

          {/* Artwork Background Options */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800">Background Handling</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Preserves Design Background
              </span>
            </div>

            {(format === 'png' || format === 'svg' || format === 'webp') && (
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={transparentBackground}
                  onChange={(e) => setTransparentBackground(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                />
                <span className="text-xs font-semibold text-gray-700">Transparent Background (Cutout)</span>
              </label>
            )}

            {(format === 'jpeg' || format === 'webp') && (
              <div className="space-y-2 pt-2 border-t border-gray-200">
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
              </div>
            )}
          </div>

          {/* Technical Export Summary */}
          <div className="flex items-center justify-between text-xs text-gray-500 px-1 font-mono">
            <div>
              Output:{' '}
              <span className="text-gray-800 font-bold">
                {format === 'svg'
                  ? (includeTrimMarks ? 'Vector SVG with trim marks' : 'Resolution-independent vector SVG')
                  : format === 'pdf'
                  ? (includeTrimMarks ? 'Vector PDF with trim marks' : 'Resolution-independent vector PDF')
                  : `${calculatedSpecs.pxW} × ${calculatedSpecs.pxH} px`}
              </span>{' '}
              ({calculatedSpecs.mmW} × {calculatedSpecs.mmH} mm)
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
            disabled={
              isExporting ||
              (format !== 'svg' && !includeNormal && !includeEnhanced)
            }
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
                <span>
                  {format === 'svg'
                    ? `Download True Vector SVG${includeTrimMarks ? ' (With Trim Marks)' : ''}`
                    : format === 'pdf'
                    ? `Download True Vector PDF${includeTrimMarks ? ' (With Trim Marks)' : ''}`
                    : `Download ${format.toUpperCase()} (${targetDpi} DPI)${includeTrimMarks ? ' + Trim Marks' : ''}`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
