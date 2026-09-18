import { DocumentSettings, CanvasDimensions } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { urlToSafeDataUrl } from '@/utils/imageUrl';

import PDFDocument from 'pdfkit';
import * as PDFKitModule from 'pdfkit';

import Courier from 'pdfkit/standard-fonts/Courier';
import CourierBold from 'pdfkit/standard-fonts/CourierBold';
import CourierBoldOblique from 'pdfkit/standard-fonts/CourierBoldOblique';
import CourierOblique from 'pdfkit/standard-fonts/CourierOblique';
import Helvetica from 'pdfkit/standard-fonts/Helvetica';
import HelveticaBold from 'pdfkit/standard-fonts/HelveticaBold';
import HelveticaBoldOblique from 'pdfkit/standard-fonts/HelveticaBoldOblique';
import HelveticaOblique from 'pdfkit/standard-fonts/HelveticaOblique';
import Symbol from 'pdfkit/standard-fonts/Symbol';
import TimesBold from 'pdfkit/standard-fonts/TimesBold';
import TimesBoldItalic from 'pdfkit/standard-fonts/TimesBoldItalic';
import TimesItalic from 'pdfkit/standard-fonts/TimesItalic';
import TimesRoman from 'pdfkit/standard-fonts/TimesRoman';
import ZapfDingbats from 'pdfkit/standard-fonts/ZapfDingbats';

import SVGtoPDF from 'svg-to-pdfkit';

type StandardFontData = Record<string, unknown>;
type RegisterStdFontsFn = (...fonts: unknown[]) => void;

function resolveFontData(
  fontModule: unknown
): StandardFontData | unknown {
  let current: unknown = fontModule;

  while (
    current !== null &&
    typeof current === 'object' &&
    'default' in current
  ) {
    const defaultValue = (
      current as { default?: unknown }
    ).default;

    if (!defaultValue || defaultValue === current) {
      break;
    }

    current = defaultValue;
  }

  return current;
}

function getRegisterStdFonts(): RegisterStdFontsFn | null {
  const moduleObject = PDFKitModule as unknown as object;

  const directRegister = Reflect.get(
    moduleObject,
    'registerStdFonts'
  ) as unknown;

  if (typeof directRegister === 'function') {
    return directRegister as RegisterStdFontsFn;
  }

  const defaultExport = Reflect.get(
    moduleObject,
    'default'
  ) as unknown;

  if (
    defaultExport !== null &&
    (
      typeof defaultExport === 'object' ||
      typeof defaultExport === 'function'
    )
  ) {
    const defaultRegister = Reflect.get(
      defaultExport as object,
      'registerStdFonts'
    ) as unknown;

    if (typeof defaultRegister === 'function') {
      return defaultRegister as RegisterStdFontsFn;
    }
  }

  return null;
}

let isStdFontsRegistered = false;

export function ensurePdfKitStandardFontsRegistered(): void {
  if (isStdFontsRegistered) {
    return;
  }

  try {
    const registerFunction = getRegisterStdFonts();

    /*
     * Some PDFKit builds include standard fonts internally.
     * New browser builds expose registerStdFonts dynamically.
     */
    if (registerFunction) {
      const fonts = [
        Courier,
        CourierBold,
        CourierBoldOblique,
        CourierOblique,
        Helvetica,
        HelveticaBold,
        HelveticaBoldOblique,
        HelveticaOblique,
        Symbol,
        TimesBold,
        TimesBoldItalic,
        TimesItalic,
        TimesRoman,
        ZapfDingbats,
      ].map(resolveFontData);

      registerFunction(...fonts);
    } else {
      console.info(
        'PDFKit registerStdFonts is unavailable; using bundled standard fonts.'
      );
    }

    isStdFontsRegistered = true;
  } catch (error) {
    console.error(
      'Failed to register PDFKit standard fonts:',
      error
    );

    throw new Error(
      `Failed to initialize PDFKit standard fonts: ${error instanceof Error
        ? error.message
        : String(error)
      }`
    );
  }
}

export interface ExportPdfOptions {
  filename?: string;
}

export interface ExportImageOptions {
  format?: 'png' | 'jpeg' | 'webp';
  dpi?: number;
  quality?: number;
  backgroundColor?: string;
  filename?: string;
}

/**
 * Creates a safe download filename.
 */
function createSafeFilename(name?: string): string {
  const safeName = (name || 'print_artwork')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return safeName || 'print_artwork';
}

/**
 * Ensures that quality stays between 0 and 1.
 */
function normalizeQuality(quality: number): number {
  if (!Number.isFinite(quality)) {
    return 0.95;
  }

  return Math.min(1, Math.max(0, quality));
}

/** Converts an image Blob to a data URL that PDFKit can embed safely. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image data'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Ensures any image URL, blob URL, or data URL is converted into a PDFKit/SVG-safe
 * PNG or JPEG base64 data URL.
 * WebP, AVIF, SVG data URLs are decoded through an offscreen HTMLCanvasElement
 * into a lossless PNG data URL so PDFKit and external SVG viewers never fail.
 */
export async function ensureSafePngOrJpegDataUrl(
  urlOrDataUrl: string,
  timeoutMs: number = 15000
): Promise<string> {
  if (!urlOrDataUrl) return '';
  const trimmed = urlOrDataUrl.trim();

  // If already PNG or JPEG data URL, return directly!
  if (
    trimmed.startsWith('data:image/png;') ||
    trimmed.startsWith('data:image/jpeg;') ||
    trimmed.startsWith('data:image/jpg;')
  ) {
    return trimmed;
  }

  // Helper to draw an image element or loaded image onto a 2D canvas and get PNG data URL
  const rasterizeToPngDataUrl = async (source: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(new Error('Image rasterization timed out'));
      }, timeoutMs);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 1;
          canvas.height = img.naturalHeight || img.height || 1;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const pngUrl = canvas.toDataURL('image/png');
          if (pngUrl && pngUrl.startsWith('data:image/png;')) {
            resolve(pngUrl);
          } else {
            reject(new Error('Failed to create PNG data URL'));
          }
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };

      img.src = source;
    });
  };

  // If it's a data URL of any other format (like data:image/webp, data:image/svg+xml, etc.)
  if (trimmed.startsWith('data:')) {
    try {
      return await rasterizeToPngDataUrl(trimmed);
    } catch (e) {
      console.warn('Failed to rasterize data URL to PNG:', e);
      return trimmed;
    }
  }

  // If it's a blob: URL
  if (trimmed.startsWith('blob:')) {
    try {
      return await rasterizeToPngDataUrl(trimmed);
    } catch {
      try {
        const res = await fetch(trimmed);
        const blob = await res.blob();
        const readerDataUrl = await blobToDataUrl(blob);
        if (readerDataUrl.startsWith('data:image/png;') || readerDataUrl.startsWith('data:image/jpeg;')) {
          return readerDataUrl;
        }
        return await rasterizeToPngDataUrl(readerDataUrl);
      } catch (blobErr) {
        console.warn('Failed to read blob URL to PNG data URL:', blobErr);
      }
    }
  }

  // If it's an HTTP/HTTPS or relative URL:
  // First attempt urlToSafeDataUrl (which proxies through Laravel with CORS headers)
  try {
    const safeDataUrl = await urlToSafeDataUrl(trimmed, timeoutMs);
    if (safeDataUrl) {
      if (safeDataUrl.startsWith('data:image/png;') || safeDataUrl.startsWith('data:image/jpeg;')) {
        return safeDataUrl;
      }
      if (safeDataUrl.startsWith('data:')) {
        return await rasterizeToPngDataUrl(safeDataUrl);
      }
    }
  } catch (safeErr) {
    console.warn('urlToSafeDataUrl failed:', safeErr);
  }

  // Fallback: try rasterizeToPngDataUrl directly
  try {
    return await rasterizeToPngDataUrl(trimmed);
  } catch (directErr) {
    console.warn('Direct image loading failed:', directErr);
  }

  return trimmed;
}

/**
 * Fabric SVG keeps raster artwork in <image href="https://..."> elements.
 * svg-to-pdfkit cannot reliably fetch those browser URLs, so convert them to
 * embedded PNG or JPEG data URLs before handing the SVG to PDFKit.
 */
async function inlineExternalSvgImages(svg: string): Promise<string> {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return svg;
  }

  const parser = new DOMParser();
  let documentNode = parser.parseFromString(svg, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) {
    const repairedSvg = svg.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi, '&amp;');
    const retryDoc = parser.parseFromString(repairedSvg, 'image/svg+xml');
    if (!retryDoc.querySelector('parsererror')) {
      documentNode = retryDoc;
    } else {
      console.warn('XML parse warning in SVG for PDF export:', documentNode.querySelector('parsererror')?.textContent);
    }
  }

  const root = documentNode.documentElement;
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const imageNodes = [
    ...Array.from(documentNode.getElementsByTagName('image')),
    ...Array.from(documentNode.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'image')),
    ...Array.from(documentNode.querySelectorAll('image')),
  ];
  const uniqueImages = Array.from(new Set(imageNodes));

  await Promise.all(
    uniqueImages.map(async (imageNode) => {
      const href =
        imageNode.getAttribute('href') ||
        imageNode.getAttribute('xlink:href') ||
        imageNode.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
        imageNode.getAttributeNS(null, 'href');

      if (!href) return;

      const safeDataUrl = await ensureSafePngOrJpegDataUrl(href);

      if (safeDataUrl && safeDataUrl.startsWith('data:image/')) {
        imageNode.removeAttribute('xlink:href');
        imageNode.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
        imageNode.removeAttribute('href');

        imageNode.setAttribute('href', safeDataUrl);
        imageNode.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', safeDataUrl);
      }
    })
  );

  return new XMLSerializer().serializeToString(documentNode.documentElement);
}

/**
 * Exports the Fabric artwork as a high-resolution PNG, JPEG or WebP image.
 */
export async function exportHighResolutionImage(
  canvasManager: CanvasManager,
  documentSettings: DocumentSettings,
  dimensions: CanvasDimensions,
  options: ExportImageOptions = {}
): Promise<void> {
  const canvas = canvasManager.getCanvas();

  if (!canvas) {
    throw new Error('Canvas is not initialized');
  }

  const {
    format = 'png',
    quality = 0.95,
    backgroundColor,
  } = options;

  const normalizedQuality = normalizeQuality(quality);
  const activeObject = canvas.getActiveObject();
  const wereGuidesVisible = canvasManager.getGuidesVisible();
  const previousZoom = canvasManager.getZoom();
  const previousBackground = canvas.backgroundColor;

  canvasManager.setGuidesVisible(false);
  canvas.discardActiveObject();
  canvasManager.setZoom(1);

  if (backgroundColor) {
    canvas.backgroundColor = backgroundColor;
  } else if (
    format === 'jpeg' &&
    (
      !canvas.backgroundColor ||
      canvas.backgroundColor === 'transparent'
    )
  ) {
    canvas.backgroundColor =
      documentSettings.backgroundColor || '#ffffff';
  }

  canvas.requestRenderAll();

  try {
    const selectedDpi =
      options.dpi ||
      documentSettings.dpi ||
      300;

    const dpi =
      Number.isFinite(selectedDpi) && selectedDpi > 0
        ? selectedDpi
        : 300;

    /*
     * Fabric canvas uses CSS/browser pixels.
     * The multiplier increases the exported pixel dimensions.
     *
     * Note: this increases export dimensions but does not reconstruct
     * missing image detail. Real AI enhancement must happen separately.
     */
    const multiplier = Math.max(1, dpi / 72);

    const mimeFormat: 'png' | 'jpeg' | 'webp' =
      format === 'jpeg'
        ? 'jpeg'
        : format === 'webp'
          ? 'webp'
          : 'png';

    const dataUrl = canvas.toDataURL({
      format: mimeFormat,
      quality: normalizedQuality,
      multiplier,
    });

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('Fabric canvas did not produce a valid image');
    }

    const safeName = createSafeFilename(documentSettings.name);

    const extension =
      format === 'jpeg'
        ? 'jpg'
        : format === 'webp'
          ? 'webp'
          : 'png';

    const filename =
      options.filename ||
      `${safeName}_${dpi}dpi.${extension}`;

    downloadFile(dataUrl, filename);
  } finally {
    canvas.backgroundColor = previousBackground;

    canvasManager.setZoom(previousZoom);
    canvasManager.setGuidesVisible(wereGuidesVisible);

    if (activeObject) {
      canvas.setActiveObject(activeObject);
    }

    canvas.requestRenderAll();
  }

  // Keep parameter available for future physical-size calculations.
  void dimensions;
}

/**
 * Exports one or more SVG pages as a vector PDF.
 *
 * Text, paths, shapes and vector elements remain vector-based where
 * supported by SVG-to-PDFKit.
 */
export async function exportVectorPdf(
  svgs: string[],
  documentSettings: DocumentSettings,
  width: number,
  height: number,
  options: ExportPdfOptions = {}
): Promise<void> {
  if (!Array.isArray(svgs) || svgs.length === 0) {
    throw new Error('No SVG pages provided for PDF export');
  }

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('Invalid PDF page dimensions');
  }

  ensurePdfKitStandardFontsRegistered();

  try {
    const pdf = new PDFDocument({
      size: [width, height],
      margin: 0,
      autoFirstPage: false,
    });

    const chunks: Uint8Array[] = [];

    pdf.on('data', (chunk: Uint8Array) => {
      chunks.push(chunk);
    });

    const endPromise = new Promise<void>((resolve, reject) => {
      pdf.on('end', resolve);

      pdf.on('error', (error: unknown) => {
        reject(
          error instanceof Error
            ? error
            : new Error(String(error))
        );
      });
    });

    for (const svg of svgs) {
      if (typeof svg !== 'string' || svg.trim() === '') {
        throw new Error('An empty or invalid SVG page was provided');
      }

      const embeddedSvg = await inlineExternalSvgImages(svg);

      pdf.addPage({
        size: [width, height],
        margin: 0,
      });

      SVGtoPDF(pdf, embeddedSvg, 0, 0, {
        width,
        height,
        assumePt: true,
        imageCallback: (link: string) => (link ? link.trim() : ''),

        fontCallback: (
          family: string,
          bold: boolean,
          italic: boolean
        ): string => {
          const normalizedFamily = (family || '').toLowerCase();

          if (
            normalizedFamily.includes('courier') ||
            normalizedFamily.includes('mono') ||
            normalizedFamily.includes('code')
          ) {
            if (bold && italic) {
              return 'Courier-BoldOblique';
            }

            if (bold) {
              return 'Courier-Bold';
            }

            if (italic) {
              return 'Courier-Oblique';
            }

            return 'Courier';
          }

          if (
            normalizedFamily.includes('times') ||
            normalizedFamily.includes('serif') ||
            normalizedFamily.includes('georgia') ||
            normalizedFamily.includes('garamond') ||
            normalizedFamily.includes('playfair') ||
            normalizedFamily.includes('merriweather')
          ) {
            if (bold && italic) {
              return 'Times-BoldItalic';
            }

            if (bold) {
              return 'Times-Bold';
            }

            if (italic) {
              return 'Times-Italic';
            }

            return 'Times-Roman';
          }

          if (normalizedFamily.includes('symbol')) {
            return 'Symbol';
          }

          if (normalizedFamily.includes('dingbat')) {
            return 'ZapfDingbats';
          }

          if (bold && italic) {
            return 'Helvetica-BoldOblique';
          }

          if (bold) {
            return 'Helvetica-Bold';
          }

          if (italic) {
            return 'Helvetica-Oblique';
          }

          return 'Helvetica';
        },

        warningCallback: (warning: string) => {
          console.warn('SVG-to-PDFKit warning:', warning);
        },
      });
    }

    pdf.end();
    await endPromise;

    if (chunks.length === 0) {
      throw new Error('PDF export produced zero bytes');
    }

    const blobParts = chunks.map((chunk) => {
      return chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength
      ) as ArrayBuffer;
    });

    const blob = new Blob(blobParts, {
      type: 'application/pdf',
    });

    if (blob.size === 0) {
      throw new Error('Generated PDF file is empty');
    }

    const safeName = createSafeFilename(documentSettings.name);
    const filename =
      options.filename ||
      `${safeName}_vector.pdf`;

    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Vector PDF export failed:', error);
    throw error;
  }
}

/**
 * Downloads a URL or data URL.
 */
export function downloadFile(
  url: string,
  filename: string
): void {
  if (typeof document === 'undefined') {
    throw new Error('File download is only available in the browser');
  }

  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Downloads an in-memory Blob.
 */
export function downloadBlob(
  blob: Blob,
  filename: string
): void {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('Cannot download an empty file');
  }

  const url = URL.createObjectURL(blob);

  try {
    downloadFile(url, filename);
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 2000);
  }
}
