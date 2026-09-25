import { DocumentSettings, CanvasDimensions } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { urlToSafeDataUrl } from '@/utils/imageUrl';
import { getArtworkExportGeometry } from '../utils/exportGeometry';
import { collectFabricObjectsRecursively } from '../utils/svgExportHelpers';

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
  canvasManager?: CanvasManager | null;
  geometry?: any;
  includeTrimMarks?: boolean;
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

    const geometry = getArtworkExportGeometry(dimensions, dpi);

    const mimeFormat: 'png' | 'jpeg' | 'webp' =
      format === 'jpeg'
        ? 'jpeg'
        : format === 'webp'
          ? 'webp'
          : 'png';

    const dataUrl = canvas.toDataURL({
      format: mimeFormat,
      quality: normalizedQuality,
      multiplier: geometry.exportMultiplier,
      left: 0,
      top: 0,
      width: geometry.artworkWidthPx,
      height: geometry.artworkHeightPx,
      enableRetinaScaling: false,
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
 * Generates a transparent high-resolution PNG shadow layer directly from Fabric
 * canvas objects and their Fabric shadow properties (color, blur, offsetX, offsetY).
 *
 * Excludes all source fill/stroke/image pixels so the layer contains ONLY the
 * pure soft drop shadow. Vector text, shapes, and photos remain resolution-independent
 * vectors drawn above this layer in the PDF.
 */
export async function createPdfShadowLayerFromFabric(
  canvasManager: CanvasManager | null | undefined,
  geometry?: any,
  options?: {
    includeTrimMarks?: boolean;
    scale?: number;
  }
): Promise<string | null> {
  if (!canvasManager || typeof document === 'undefined') {
    return null;
  }

  const canvas = canvasManager.getCanvas();
  if (!canvas) {
    return null;
  }

  const allObjects = collectFabricObjectsRecursively(canvas);
  const shadowObjects = allObjects.filter((o) => {
    if (!o || o.isGuide || o.isPrintGuide || o.isRulerGuide || o.isCropOverlayPhoto) {
      return false;
    }
    const s = o.shadow;
    if (!s || !s.color || s.color === 'transparent') {
      return false;
    }
    const blur = Number(s.blur) || 0;
    const offsetX = Number(s.offsetX) || 0;
    const offsetY = Number(s.offsetY) || 0;
    return blur > 0 || offsetX !== 0 || offsetY !== 0;
  });

  console.info(`[PDF Shadow] Fabric shadow objects: ${shadowObjects.length}`);

  if (shadowObjects.length === 0) {
    console.info('[PDF Shadow] Shadow layer generated: no');
    return null;
  }

  const artworkWidthPx = geometry?.artworkWidthPx || canvas.width || 800;
  const artworkHeightPx = geometry?.artworkHeightPx || canvas.height || 600;

  let slugMarginPx = 0;
  let totalW = artworkWidthPx;
  let totalH = artworkHeightPx;

  if (
    options?.includeTrimMarks &&
    geometry?.slugMarginMm &&
    geometry?.artworkWidthMm
  ) {
    const pxPerMm = geometry.artworkWidthPx / geometry.artworkWidthMm;
    slugMarginPx = Math.round(geometry.slugMarginMm * pxPerMm);
    totalW = artworkWidthPx + slugMarginPx * 2;
    totalH = artworkHeightPx + slugMarginPx * 2;
  }

  const maxDim = 4096;
  const longestEdge = Math.max(totalW, totalH);
  const preferredScale = options?.scale || 4;
  const scale = Math.max(
    1,
    Math.min(preferredScale, Math.floor(maxDim / Math.max(1, longestEdge)))
  );
  const pixelWidth = Math.max(1, Math.round(totalW * scale));
  const pixelHeight = Math.max(1, Math.round(totalH * scale));

  const finalShadowCanvas = document.createElement('canvas');
  finalShadowCanvas.width = pixelWidth;
  finalShadowCanvas.height = pixelHeight;
  const finalShadowCtx = finalShadowCanvas.getContext('2d');
  if (!finalShadowCtx) {
    console.warn('[PDF Shadow] Canvas 2D context unavailable');
    return null;
  }

  // Preserve live canvas states
  const prevBg = canvas.backgroundColor;
  const prevBgImg = canvas.backgroundImage;
  const prevZoom = canvas.getZoom();
  const prevVpt = canvas.viewportTransform
    ? [...canvas.viewportTransform]
    : undefined;

  // Save states of all objects
  const originalStates = new Map<
    any,
    { opacity: number; shadow: any; visible: boolean }
  >();
  allObjects.forEach((o) => {
    originalStates.set(o, {
      opacity: o.opacity ?? 1,
      shadow: o.shadow,
      visible: o.visible ?? true,
    });
  });

  try {
    canvas.backgroundColor = 'transparent';
    canvas.backgroundImage = undefined;
    canvas.setZoom(1);
    if (canvas.viewportTransform) {
      canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    }

    for (const obj of shadowObjects) {
      // Isolate this object (and its ancestors if inside groups)
      allObjects.forEach((o) => {
        const isSelfOrAncestor =
          o === obj ||
          (Array.isArray((o as any)._objects) &&
            (o as any)._objects.some(
              (c: any) =>
                c === obj || (Array.isArray(c._objects) && c._objects.includes(obj))
            ));
        if (isSelfOrAncestor) {
          const st = originalStates.get(o);
          o.opacity = st?.opacity ?? 1;
          o.visible = true;
        } else {
          o.opacity = 0;
        }
      });

      // 1. Render object WITH shadow at high resolution
      const withShadowCanvas = canvas.toCanvasElement(scale);

      // 2. Render silhouette WITHOUT shadow (with opacity 1 so destination-out cleanly erases the body)
      const s = obj.shadow;
      const prevOpacity = obj.opacity;
      obj.shadow = null;
      obj.opacity = 1;
      const noShadowCanvas = canvas.toCanvasElement(scale);
      obj.shadow = s;
      obj.opacity = prevOpacity;

      if (withShadowCanvas && noShadowCanvas) {
        const itemCanvas = document.createElement('canvas');
        itemCanvas.width = pixelWidth;
        itemCanvas.height = pixelHeight;
        const itemCtx = itemCanvas.getContext('2d');
        if (itemCtx) {
          const drawX = slugMarginPx * scale;
          const drawY = slugMarginPx * scale;

          // A. Draw with shadow intact
          itemCtx.drawImage(withShadowCanvas, drawX, drawY);

          // B. Erase object body using destination-out ONLY for semi-transparent objects.
          // For opaque objects, keeping the body prevents any white hole or subpixel fringe,
          // because Layer 3 vector artwork will sit directly on top at identical 1:1 scale.
          const objAlpha = Number(originalStates.get(obj)?.opacity ?? 1);
          if (objAlpha < 0.98) {
            itemCtx.save();
            itemCtx.globalCompositeOperation = 'destination-out';
            itemCtx.drawImage(noShadowCanvas, drawX, drawY);
            itemCtx.restore();
          }

          // C. Blend onto final shadow canvas
          finalShadowCtx.drawImage(itemCanvas, 0, 0);
        }
      }
    }
  } catch (error) {
    console.warn('[PDF Shadow] Failed to generate Fabric shadow layer:', error);
    return null;
  } finally {
    // Restore all original canvas and object states in finally block
    allObjects.forEach((o) => {
      const st = originalStates.get(o);
      if (st) {
        o.opacity = st.opacity;
        o.shadow = st.shadow;
        o.visible = st.visible;
      }
    });
    canvas.backgroundColor = prevBg;
    canvas.backgroundImage = prevBgImg;
    canvas.setZoom(prevZoom);
    if (prevVpt && canvas.viewportTransform) {
      canvas.viewportTransform = prevVpt as any;
    }
    canvas.requestRenderAll();
  }

  const shadowDataUrl = finalShadowCanvas.toDataURL('image/png');
  console.info('[PDF Shadow] Shadow layer generated: yes');
  console.info(`[PDF Shadow] Layer size: ${pixelWidth} x ${pixelHeight}`);
  return shadowDataUrl;
}

/**
 * Builds a PDF-safe hybrid representation for SVG filter shadows.
 *
 * SVG-to-PDFKit does not render every SVG filter primitive (notably Fabric
 * drop-shadows / Gaussian blur) consistently. To keep the artwork vector,
 * filtered Fabric objects are rasterized on a transparent high-resolution
 * effect layer so their blur/drop-shadow survives PDF conversion.
 *
 * Crucially, canvas background elements are separated and drawn BEFORE the
 * shadow layer, ensuring the shadow layer is NOT covered by an opaque white
 * or colored background rectangle. The original text/path/shape is then drawn
 * as crisp PDF vector artwork above the shadow.
 */
async function prepareSvgFiltersForVectorPdf(
  svg: string,
  rasterScale: number = 2,
  skipShadowRasterization: boolean = false
): Promise<{
  backgroundSvg: string | null;
  vectorSvg: string;
  shadowDataUrl: string | null;
}> {
  if (
    typeof window === 'undefined' ||
    typeof DOMParser === 'undefined' ||
    typeof XMLSerializer === 'undefined'
  ) {
    return { backgroundSvg: null, vectorSvg: svg, shadowDataUrl: null };
  }

  const parser = new DOMParser();
  const sourceDoc = parser.parseFromString(svg, 'image/svg+xml');
  if (sourceDoc.querySelector('parsererror')) {
    return { backgroundSvg: null, vectorSvg: svg, shadowDataUrl: null };
  }

  const filtered = Array.from(
    sourceDoc.querySelectorAll('[filter], [style*="filter"]')
  );

  const removeFilterFromNode = (node: Element) => {
    node.removeAttribute('filter');
    const styleAttr = node.getAttribute('style');
    if (styleAttr && styleAttr.includes('filter')) {
      const newStyle = styleAttr
        .replace(/filter\s*:[^;]+(;|\s*$)/gi, '')
        .trim();
      if (newStyle) {
        node.setAttribute('style', newStyle);
      } else {
        node.removeAttribute('style');
      }
    }
  };

  // If no filters exist and no external shadow layer was provided, return clean vector SVG directly
  if (filtered.length === 0 && !skipShadowRasterization) {
    const vectorDoc = sourceDoc.cloneNode(true) as Document;
    vectorDoc.querySelectorAll('[data-shadow-element="true"]').forEach((node) => {
      node.remove();
    });
    return {
      backgroundSvg: null,
      vectorSvg: new XMLSerializer().serializeToString(vectorDoc.documentElement),
      shadowDataUrl: null,
    };
  }

  // Calculate safe, optimal canvas resolution (up to 4096 px max)
  const root = sourceDoc.documentElement;
  const viewBox = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/\s+/)
    .map(Number);

  let logicalWidth = viewBox && viewBox.length === 4 ? viewBox[2] : 0;
  let logicalHeight = viewBox && viewBox.length === 4 ? viewBox[3] : 0;

  if (!logicalWidth || !logicalHeight) {
    logicalWidth = parseFloat(root.getAttribute('width') || '0') || 1;
    logicalHeight = parseFloat(root.getAttribute('height') || '0') || 1;
  }

  const isBackgroundElement = (el: Element): boolean => {
    if (el.getAttribute('data-pdf-background') === 'true') {
      return true;
    }
    if (el.closest?.('[data-pdf-background="true"]')) {
      return true;
    }
    if (el.tagName.toLowerCase() === 'rect') {
      const hasFilter =
        el.hasAttribute('filter') ||
        (el.getAttribute('style') || '').includes('filter') ||
        el.getAttribute('data-shadow-element') === 'true';
      if (hasFilter) return false;

      const parentTag = el.parentElement?.tagName.toLowerCase();
      const isTopLevelOrUnderG = parentTag === 'svg' || parentTag === 'g';

      if (isTopLevelOrUnderG) {
        const xAttr = el.getAttribute('x') || '0';
        const yAttr = el.getAttribute('y') || '0';
        const wAttr = el.getAttribute('width') || '0';
        const hAttr = el.getAttribute('height') || '0';

        const x = parseFloat(xAttr);
        const y = parseFloat(yAttr);
        const w = parseFloat(wAttr);
        const h = parseFloat(hAttr);

        if ((x === 0 || xAttr === '0%') && (y === 0 || yAttr === '0%')) {
          if (wAttr.includes('%') && parseFloat(wAttr) >= 95) return true;
          // Matches total width OR canvas artwork width
          if (w >= logicalWidth * 0.45 && h >= logicalHeight * 0.45) return true;
        }
      }
    }
    return false;
  };

  // 1. Build Background document (contains ONLY background elements and defs/gradients)
  let backgroundSvg: string | null = null;
  const bgElements = Array.from(
    sourceDoc.querySelectorAll('rect, image, g')
  ).filter(isBackgroundElement);

  if (bgElements.length > 0) {
    const bgDoc = sourceDoc.cloneNode(true) as Document;
    bgDoc.querySelectorAll('rect, path, circle, ellipse, line, polyline, polygon, text, image, g').forEach((el) => {
      if (el.closest('defs, clipPath, mask, filter, pattern, linearGradient, radialGradient')) {
        return;
      }
      if (el === bgDoc.documentElement) {
        return;
      }
      if (isBackgroundElement(el) || el.closest('[data-pdf-background="true"]')) {
        return;
      }
      if (Array.from(el.children).some((c) => isBackgroundElement(c) || c.closest('[data-pdf-background="true"]'))) {
        return;
      }
      el.remove();
    });

    backgroundSvg = new XMLSerializer().serializeToString(bgDoc.documentElement);
  }

  // 2. Build Vector document (background removed so it doesn't paint over shadows, filters removed)
  const vectorDoc = sourceDoc.cloneNode(true) as Document;
  vectorDoc.querySelectorAll('*').forEach((el) => {
    if (isBackgroundElement(el) || el.getAttribute('data-pdf-background') === 'true') {
      el.remove();
    }
  });
  vectorDoc.querySelectorAll('[data-shadow-element="true"]').forEach((node) => {
    node.remove();
  });
  vectorDoc.querySelectorAll('[filter], [style*="filter"]').forEach((node) => {
    removeFilterFromNode(node as Element);
  });

  const vectorSvgString = new XMLSerializer().serializeToString(
    vectorDoc.documentElement
  );

  if (skipShadowRasterization) {
    return {
      backgroundSvg,
      vectorSvg: vectorSvgString,
      shadowDataUrl: null,
    };
  }

  // 3. Build Effect document (renders ONLY the pure transparent shadow layer)
  const effectDoc = sourceDoc.cloneNode(true) as Document;

  // Remove background elements from shadow layer
  effectDoc.querySelectorAll('*').forEach((el) => {
    if (isBackgroundElement(el) || el.getAttribute('data-pdf-background') === 'true') {
      el.remove();
    }
  });

  // Expand filter bounds and remove SourceGraphic from feMerge so the filter outputs ONLY the shadow!
  effectDoc.querySelectorAll('filter').forEach((filter) => {
    filter.setAttribute('x', '-100%');
    filter.setAttribute('y', '-100%');
    filter.setAttribute('width', '300%');
    filter.setAttribute('height', '300%');

    filter.querySelectorAll('feMergeNode').forEach((node) => {
      if (node.getAttribute('in') === 'SourceGraphic') {
        node.remove();
      }
    });
  });

  // Remove non-filtered visual elements so they do not leak pixels into the transparent shadow layer
  effectDoc.querySelectorAll('rect, path, circle, ellipse, line, polyline, polygon, text, image').forEach((el) => {
    if (el.closest('defs, clipPath, mask, filter, pattern, linearGradient, radialGradient')) {
      return;
    }
    if (el.closest('[filter], [style*="filter"]') || el.closest('[data-shadow-element="true"]')) {
      return;
    }
    el.remove();
  });

  const maxDimension = 4096;
  const longestEdge = Math.max(logicalWidth, logicalHeight);
  const scale = Math.max(0.5, Math.min(2, maxDimension / Math.max(1, longestEdge)));
  const pixelWidth = Math.max(1, Math.round(logicalWidth * scale));
  const pixelHeight = Math.max(1, Math.round(logicalHeight * scale));

  // Set explicit pixel dimensions and standard XML namespaces on root SVG
  effectDoc.documentElement.setAttribute('width', String(pixelWidth));
  effectDoc.documentElement.setAttribute('height', String(pixelHeight));
  if (!effectDoc.documentElement.getAttribute('viewBox')) {
    effectDoc.documentElement.setAttribute('viewBox', `0 0 ${logicalWidth} ${logicalHeight}`);
  }
  if (!effectDoc.documentElement.getAttribute('xmlns')) {
    effectDoc.documentElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!effectDoc.documentElement.getAttribute('xmlns:xlink')) {
    effectDoc.documentElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }

  // Strip external network @import lines to prevent browser security blocking
  effectDoc.querySelectorAll('style').forEach((styleEl) => {
    if (styleEl.textContent && styleEl.textContent.includes('@import')) {
      styleEl.textContent = styleEl.textContent.replace(
        /@import\s+url\([^)]+\);?/gi,
        ''
      );
    }
  });

  const effectMarkup = new XMLSerializer().serializeToString(
    effectDoc.documentElement
  );

  try {
    const base64Svg = btoa(unescape(encodeURIComponent(effectMarkup)));
    const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) =>
        reject(new Error('Failed to load shadow SVG: ' + String(e)));
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable for PDF shadow');
    }

    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    ctx.drawImage(image, 0, 0, pixelWidth, pixelHeight);

    const shadowDataUrl = canvas.toDataURL('image/png');

    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[PDF Export] Generated shadow layer: ${pixelWidth}x${pixelHeight} px for ${filtered.length} filtered element(s)`
      );
    }

    return {
      backgroundSvg,
      vectorSvg: vectorSvgString,
      shadowDataUrl,
    };
  } catch (error) {
    console.warn(
      '[PDF Export] Failed to rasterize shadow layer; vectors will be drawn without shadow:',
      error
    );

    return {
      backgroundSvg: null,
      vectorSvg: new XMLSerializer().serializeToString(sourceDoc.documentElement),
      shadowDataUrl: null,
    };
  }
}



type PdfFontFace = {
  family: string;
  weight: number;
  italic: boolean;
  pdfName: string;
  data: Uint8Array;
};

const normalizePdfFontFamily = (family: string): string =>
  (family || '')
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');

const normalizePdfFontWeight = (
  value: string | number | null | undefined
): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(100, Math.min(900, Math.round(value / 100) * 100));
  }

  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'bold' || raw === 'bolder') return 700;
  if (raw === 'lighter') return 300;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed)) {
    return Math.max(100, Math.min(900, Math.round(parsed / 100) * 100));
  }

  return 400;
};

const escapeCssFamilyForGoogle = (family: string): string =>
  encodeURIComponent(family.trim()).replace(/%20/g, '+');

type EmbeddedSvgFontFace = {
  family: string;
  weight: number;
  italic: boolean;
  data: Uint8Array;
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Reads @font-face rules already embedded in the prepared SVG and reuses the
 * exact font bytes for PDFKit. This keeps the PDF font family/weight/style as
 * close as possible to the editor instead of silently falling back to Helvetica.
 */
function collectEmbeddedSvgFontFaces(
  svgs: string[]
): EmbeddedSvgFontFace[] {
  if (
    typeof DOMParser === 'undefined' ||
    typeof window === 'undefined'
  ) {
    return [];
  }

  const faces: EmbeddedSvgFontFace[] = [];
  const seen = new Set<string>();

  for (const svg of svgs) {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (doc.querySelector('parsererror')) continue;

    const css = Array.from(doc.querySelectorAll('style'))
      .map((style) => style.textContent || '')
      .join('\n');

    const blocks = css.match(/@font-face\s*{[\s\S]*?}/gi) || [];

    for (const block of blocks) {
      const familyMatch = block.match(
        /font-family\s*:\s*(['\"]?)([^;'\"}]+)\1\s*;/i
      );
      const weightMatch = block.match(/font-weight\s*:\s*([^;]+);/i);
      const styleMatch = block.match(/font-style\s*:\s*([^;]+);/i);
      const dataMatch = block.match(
        /src\s*:[^;]*url\((['\"]?)(data:font\/[^)'\"]+)\1\)[^;]*;/i
      );

      if (!familyMatch?.[2] || !dataMatch?.[2]) continue;

      const family = normalizePdfFontFamily(familyMatch[2]);
      const weight = normalizePdfFontWeight(weightMatch?.[1] || '400');
      const italic =
        (styleMatch?.[1] || 'normal').trim().toLowerCase() !== 'normal';

      const dataUrl = dataMatch[2];
      const commaIndex = dataUrl.indexOf(',');
      if (commaIndex < 0) continue;

      const header = dataUrl.slice(0, commaIndex);
      const payload = dataUrl.slice(commaIndex + 1);
      if (!/;base64/i.test(header)) continue;

      const key = `${family.toLowerCase()}|${weight}|${italic ? 1 : 0}`;
      if (seen.has(key)) continue;

      try {
        faces.push({
          family,
          weight,
          italic,
          data: base64ToUint8Array(payload),
        });
        seen.add(key);
      } catch (error) {
        console.warn(
          `[PDF Export] Could not decode embedded font "${family}":`,
          error
        );
      }
    }
  }

  return faces;
}

function findEmbeddedSvgFontFace(
  embeddedFaces: EmbeddedSvgFontFace[],
  family: string,
  weight: number,
  italic: boolean
): EmbeddedSvgFontFace | null {
  const normalizedFamily = normalizePdfFontFamily(family).toLowerCase();
  const sameFamily = embeddedFaces.filter(
    (face) => face.family.toLowerCase() === normalizedFamily
  );

  if (sameFamily.length === 0) return null;

  const sameStyle = sameFamily.filter((face) => face.italic === italic);
  const candidates = sameStyle.length > 0 ? sameStyle : sameFamily;

  candidates.sort(
    (a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight)
  );

  return candidates[0] || null;
}

function collectSvgFontRequests(
  svgs: string[]
): Array<{ family: string; weight: number; italic: boolean }> {
  if (typeof DOMParser === 'undefined') return [];

  const requests = new Map<
    string,
    { family: string; weight: number; italic: boolean }
  >();

  for (const svg of svgs) {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (doc.querySelector('parsererror')) continue;

    const textNodes = Array.from(doc.querySelectorAll('text, tspan'));

    for (const node of textNodes) {
      let familyRaw = node.getAttribute('font-family');
      let weightRaw = node.getAttribute('font-weight');
      let styleRaw = node.getAttribute('font-style');

      const styleAttr = node.getAttribute('style') || '';
      if (styleAttr) {
        const parts = styleAttr.split(';').map((p) => p.trim());
        for (const part of parts) {
          const idx = part.indexOf(':');
          if (idx > -1) {
            const k = part.slice(0, idx).trim().toLowerCase();
            const v = part.slice(idx + 1).trim();
            if (k === 'font-family' && !familyRaw) familyRaw = v;
            if (k === 'font-weight' && !weightRaw) weightRaw = v;
            if (k === 'font-style' && !styleRaw) styleRaw = v;
          }
        }
      }

      let parent = node.parentElement;
      while (parent && (!familyRaw || !weightRaw || !styleRaw)) {
        const pStyle = parent.getAttribute('style') || '';
        if (!familyRaw)
          familyRaw = parent.getAttribute('font-family');
        if (!weightRaw)
          weightRaw = parent.getAttribute('font-weight');
        if (!styleRaw)
          styleRaw = parent.getAttribute('font-style');
        if (pStyle) {
          const parts = pStyle.split(';').map((p) => p.trim());
          for (const part of parts) {
            const idx = part.indexOf(':');
            if (idx > -1) {
              const k = part.slice(0, idx).trim().toLowerCase();
              const v = part.slice(idx + 1).trim();
              if (k === 'font-family' && !familyRaw) familyRaw = v;
              if (k === 'font-weight' && !weightRaw) weightRaw = v;
              if (k === 'font-style' && !styleRaw) styleRaw = v;
            }
          }
        }
        parent = parent.parentElement;
      }

      const family = normalizePdfFontFamily(familyRaw || 'Helvetica');
      if (!family) continue;

      const weight = normalizePdfFontWeight(weightRaw || '400');
      const fontStyle = (styleRaw || 'normal').toLowerCase();
      const italic = fontStyle === 'italic' || fontStyle === 'oblique';

      const key = `${family.toLowerCase()}|${weight}|${italic ? 1 : 0}`;
      requests.set(key, { family, weight, italic });
    }
  }

  return Array.from(requests.values());
}

function isPdfStandardFamily(family: string): boolean {
  const normalized = family.toLowerCase().trim();

  return (
    normalized === 'helvetica' ||
    normalized === 'arial' ||
    normalized === 'courier' ||
    normalized === 'monospace' ||
    normalized === 'times' ||
    normalized === 'times new roman' ||
    normalized === 'serif' ||
    normalized === 'sans-serif' ||
    normalized === 'symbol' ||
    normalized === 'zapfdingbats'
  );
}

function getStandardPdfFontName(
  family: string,
  bold: boolean,
  italic: boolean
): string {
  const normalizedFamily = (family || '').toLowerCase();

  if (
    normalizedFamily.includes('courier') ||
    normalizedFamily.includes('mono') ||
    normalizedFamily.includes('code')
  ) {
    if (bold && italic) return 'Courier-BoldOblique';
    if (bold) return 'Courier-Bold';
    if (italic) return 'Courier-Oblique';
    return 'Courier';
  }

  if (
    normalizedFamily.includes('times') ||
    normalizedFamily === 'serif' ||
    normalizedFamily.includes('georgia') ||
    normalizedFamily.includes('garamond')
  ) {
    if (bold && italic) return 'Times-BoldItalic';
    if (bold) return 'Times-Bold';
    if (italic) return 'Times-Italic';
    return 'Times-Roman';
  }

  if (normalizedFamily.includes('symbol')) return 'Symbol';
  if (normalizedFamily.includes('dingbat')) return 'ZapfDingbats';

  if (bold && italic) return 'Helvetica-BoldOblique';
  if (bold) return 'Helvetica-Bold';
  if (italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

/**
 * Acrobat-safe PDF font validation.
 *
 * PDFKit must receive a real SFNT font program (TTF/OTF/TTC). Browser webfont
 * containers such as WOFF/WOFF2 may render in some PDF viewers but can produce
 * Acrobat errors such as "Cannot extract the embedded font".
 */
export function isPdfSafeSfntFont(data: Uint8Array | null | undefined): boolean {
  if (!data || data.byteLength < 4) {
    return false;
  }

  const a = data[0];
  const b = data[1];
  const c = data[2];
  const d = data[3];

  // TrueType sfnt: 00 01 00 00
  if (
    a === 0x00 &&
    b === 0x01 &&
    c === 0x00 &&
    d === 0x00
  ) {
    return true;
  }

  const signature = String.fromCharCode(a, b, c, d);

  // Reject WOFF and WOFF2 explicitly
  if (signature === 'wOFF' || signature === 'wOF2') {
    return false;
  }

  // OpenType/CFF, Apple TrueType, TrueType Collection
  return (
    signature === 'OTTO' ||
    signature === 'ttcf' ||
    signature === 'true'
  );
}

export function describeFontBinary(data: Uint8Array | null | undefined): string {
  if (!data || data.byteLength < 4) {
    return 'empty';
  }

  if (
    data[0] === 0x00 &&
    data[1] === 0x01 &&
    data[2] === 0x00 &&
    data[3] === 0x00
  ) {
    return 'TTF';
  }

  const signature = String.fromCharCode(
    data[0],
    data[1],
    data[2],
    data[3]
  );

  if (signature === 'OTTO') return 'OTF';
  if (signature === 'ttcf') return 'TTC';
  if (signature === 'wOFF') return 'WOFF';
  if (signature === 'wOF2') return 'WOFF2';
  if (signature === 'true') return 'Apple TrueType';

  return signature || 'unknown';
}

export type LocalPdfFontFamilyConfig = {
  folder: string;
  prefix: string;
};

/**
 * Static TTF/OTF fonts used specifically for commercial-print PDF embedding.
 *
 * Put the legally obtained font files under:
 *   frontend/public/fonts/pdf/<folder>/<prefix>-<Style>.ttf
 *
 * Examples:
 *   /fonts/pdf/inter/Inter-Bold.ttf
 *   /fonts/pdf/playfair-display/PlayfairDisplay-Bold.ttf
 *   /fonts/pdf/poppins/Poppins-Bold.ttf
 *   /fonts/pdf/montserrat/Montserrat-Bold.ttf
 *   /fonts/pdf/roboto/Roboto-Bold.ttf
 *   /fonts/pdf/open-sans/OpenSans-Bold.ttf
 *   /fonts/pdf/lato/Lato-Bold.ttf
 *   /fonts/pdf/oswald/Oswald-Bold.ttf
 *   /fonts/pdf/nunito/Nunito-Bold.ttf
 */
export const LOCAL_PDF_FONT_FAMILIES: Record<
  string,
  LocalPdfFontFamilyConfig
> = {
  inter: {
    folder: 'inter',
    prefix: 'Inter',
  },
  'playfair display': {
    folder: 'playfair-display',
    prefix: 'PlayfairDisplay',
  },
  poppins: {
    folder: 'poppins',
    prefix: 'Poppins',
  },
  montserrat: {
    folder: 'montserrat',
    prefix: 'Montserrat',
  },
  roboto: {
    folder: 'roboto',
    prefix: 'Roboto',
  },
  'open sans': {
    folder: 'open-sans',
    prefix: 'OpenSans',
  },
  lato: {
    folder: 'lato',
    prefix: 'Lato',
  },
  oswald: {
    folder: 'oswald',
    prefix: 'Oswald',
  },
  nunito: {
    folder: 'nunito',
    prefix: 'Nunito',
  },
};

const FONTSOURCE_SLUGS: Record<string, string> = {
  inter: 'inter',
  'playfair display': 'playfair-display',
  poppins: 'poppins',
  montserrat: 'montserrat',
  roboto: 'roboto',
  'open sans': 'open-sans',
  lato: 'lato',
  oswald: 'oswald',
  nunito: 'nunito',
};

const ALL_STANDARD_WEIGHTS = [400, 700, 500, 600, 800, 300, 900, 200, 100];

function getClosestWeights(targetWeight: number): number[] {
  return [...ALL_STANDARD_WEIGHTS].sort((a, b) => {
    const diffA = Math.abs(a - targetWeight);
    const diffB = Math.abs(b - targetWeight);
    if (diffA !== diffB) return diffA - diffB;
    return b - a;
  });
}

export function pdfWeightStyleName(
  weight: number,
  italic: boolean
): string {
  const normalized = normalizePdfFontWeight(weight);

  const weightName =
    normalized <= 100
      ? 'Thin'
      : normalized <= 200
        ? 'ExtraLight'
        : normalized <= 300
          ? 'Light'
          : normalized <= 400
            ? 'Regular'
            : normalized <= 500
              ? 'Medium'
              : normalized <= 600
                ? 'SemiBold'
                : normalized <= 700
                  ? 'Bold'
                  : normalized <= 800
                    ? 'ExtraBold'
                    : 'Black';

  if (!italic) {
    return weightName;
  }

  return weightName === 'Regular'
    ? 'Italic'
    : `${weightName}Italic`;
}

function getLocalPdfCandidates(
  family: string,
  weight: number,
  italic: boolean
): { expectedPath: string; candidates: string[] } | null {
  const normalizedFamily =
    normalizePdfFontFamily(family).toLowerCase();

  const config =
    LOCAL_PDF_FONT_FAMILIES[normalizedFamily];

  if (!config) {
    return null;
  }

  const style = pdfWeightStyleName(
    weight,
    italic
  );

  const base =
    `/fonts/pdf/${config.folder}/${config.prefix}-${style}`;
  const expectedPath = `${base}.ttf`;

  return {
    expectedPath,
    candidates: [
      `${base}.ttf`,
      `${base}.otf`,
    ],
  };
}

async function fetchLocalPdfFontFace(
  family: string,
  weight: number,
  italic: boolean
): Promise<{ data: Uint8Array; url: string } | null> {
  if (typeof fetch === 'undefined') {
    return null;
  }

  const localInfo = getLocalPdfCandidates(
    family,
    weight,
    italic
  );

  if (!localInfo) {
    return null;
  }

  for (const url of localInfo.candidates) {
    try {
      const response = await fetch(url, {
        cache: 'force-cache',
      });

      if (!response.ok) {
        continue;
      }

      const data = new Uint8Array(
        await response.arrayBuffer()
      );

      if (!isPdfSafeSfntFont(data)) {
        console.warn(
          `[PDF Export] Local font exists but is not a safe TTF/OTF/TTC: ${url} ` +
          `(${describeFontBinary(data)})`
        );
        continue;
      }

      console.info(
        `[PDF Export] Using self-hosted PDF font: ${family} ${weight}` +
        `${italic ? ' italic' : ''} -> ${url}`
      );

      return { data, url };
    } catch {
      // Try the next local candidate.
    }
  }

  console.warn(
    `[PDF Export] Missing self-hosted PDF font for "${family}" ${weight}` +
    `${italic ? ' italic' : ''}.\nExpected: ${localInfo.expectedPath}`
  );

  return null;
}

async function fetchClosestLocalPdfFontFace(
  family: string,
  targetWeight: number,
  italic: boolean
): Promise<{ data: Uint8Array; url: string; matchedWeight: number } | null> {
  if (typeof fetch === 'undefined') {
    return null;
  }

  const normalizedFamily =
    normalizePdfFontFamily(family).toLowerCase();

  const config =
    LOCAL_PDF_FONT_FAMILIES[normalizedFamily];

  if (!config) {
    return null;
  }

  const weightsToTry = getClosestWeights(targetWeight).filter(
    (w) => w !== targetWeight
  );

  for (const w of weightsToTry) {
    const style = pdfWeightStyleName(w, italic);
    const base = `/fonts/pdf/${config.folder}/${config.prefix}-${style}`;
    const candidates = [`${base}.ttf`, `${base}.otf`];

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          cache: 'force-cache',
        });

        if (!response.ok) continue;

        const data = new Uint8Array(await response.arrayBuffer());

        if (isPdfSafeSfntFont(data)) {
          console.info(
            `[PDF Export] Using self-hosted PDF font: ${family} ${targetWeight}` +
            `${italic ? ' italic' : ''} -> ${url}`
          );

          return { data, url, matchedWeight: w };
        }
      } catch {
        // Try next
      }
    }
  }

  return null;
}

/**
 * Fetches TrueType (.ttf) font binary data for embedding in PDFKit.
 * Prioritizes Fontsource CDN which delivers raw CORS-safe TTF binaries.
 */
async function fetchRemotePdfFontFace(
  family: string,
  weight: number,
  italic: boolean
): Promise<Uint8Array | null> {
  if (typeof fetch === 'undefined') return null;

  const normalizedFamily = normalizePdfFontFamily(family).toLowerCase();
  const slug =
    FONTSOURCE_SLUGS[normalizedFamily] ||
    normalizedFamily.replace(/[^a-z0-9]+/g, '-');
  const style = italic ? 'italic' : 'normal';

  // 1. Try Fontsource CDN on jsDelivr - provides raw, CORS-enabled TTF files
  const cdnUrl = `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-${weight}-${style}.ttf`;

  try {
    const response = await fetch(cdnUrl, {
      mode: 'cors',
      cache: 'force-cache',
    });

    if (response.ok) {
      const data = new Uint8Array(await response.arrayBuffer());
      if (isPdfSafeSfntFont(data)) {
        return data;
      }

      console.warn(
        `[PDF Export] Ignoring ${describeFontBinary(data)} webfont for ` +
        `"${family}" ${weight}${italic ? ' italic' : ''}; ` +
        `Acrobat-safe TTF/OTF is required.`
      );
    }
  } catch {
    // Network / CDN failure, continue to fallback
  }

  // 2. Try legacy Google Fonts endpoint
  const familyQuery = escapeCssFamilyForGoogle(family);
  const spec = italic ? `${weight}italic` : `${weight}`;
  const cssUrls = [
    `https://fonts.googleapis.com/css?family=${familyQuery}:${spec}`,
    italic
      ? `https://fonts.googleapis.com/css2?family=${familyQuery}:ital,wght@1,${weight}&display=swap`
      : `https://fonts.googleapis.com/css2?family=${familyQuery}:wght@${weight}&display=swap`,
  ];

  for (const cssUrl of cssUrls) {
    try {
      const cssResponse = await fetch(cssUrl, {
        mode: 'cors',
        cache: 'force-cache',
      });

      if (!cssResponse.ok) {
        continue;
      }

      const css = await cssResponse.text();

      const fontUrls = Array.from(
        css.matchAll(
          /url\((['"]?)(https?:\/\/[^)'"]+)\1\)/gi
        )
      )
        .map((match) => match[2])
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0
        );

      for (const fontUrl of fontUrls) {
        try {
          const fontResponse = await fetch(fontUrl, {
            mode: 'cors',
            cache: 'force-cache',
          });

          if (!fontResponse.ok) {
            continue;
          }

          const data = new Uint8Array(
            await fontResponse.arrayBuffer()
          );

          if (isPdfSafeSfntFont(data)) {
            return data;
          }

          console.warn(
            `[PDF Export] Ignoring ${describeFontBinary(data)} webfont for ` +
            `"${family}" ${weight}${italic ? ' italic' : ''}; ` +
            `Acrobat-safe TTF/OTF is required.`
          );
        } catch {
          // Continue to next URL
        }
      }
    } catch {
      // Continue to next cssUrl
    }
  }

  return null;
}

async function registerSvgFontsForPdf(
  pdf: InstanceType<typeof PDFDocument>,
  svgs: string[]
): Promise<PdfFontFace[]> {
  const requests = collectSvgFontRequests(svgs);
  const embeddedFaces = collectEmbeddedSvgFontFaces(svgs);
  const registered: PdfFontFace[] = [];

  for (const request of requests) {
    if (isPdfStandardFamily(request.family)) {
      continue;
    }

    const embedded = findEmbeddedSvgFontFace(
      embeddedFaces,
      request.family,
      request.weight,
      request.italic
    );

    let data: Uint8Array | null = null;
    let sourceLabel = '';

    // 1. If an Acrobat-safe TTF/OTF is already embedded in prepared SVG: use it.
    if (embedded?.data && isPdfSafeSfntFont(embedded.data)) {
      data = embedded.data;
      sourceLabel = 'prepared SVG';
    } else if (embedded?.data) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[PDF Export] Prepared SVG contains ${describeFontBinary(embedded.data)} ` +
          `for "${request.family}". Fetching an Acrobat-safe TTF/OTF instead.`
        );
      }
    }

    // 2. Try local self-hosted PDF fonts (exact weight)
    if (!data) {
      const localResult = await fetchLocalPdfFontFace(
        request.family,
        request.weight,
        request.italic
      );

      if (localResult && isPdfSafeSfntFont(localResult.data)) {
        data = localResult.data;
        sourceLabel = 'self-hosted TTF/OTF';
      }
    }

    // 3. If local file is missing, try remote provider to obtain a REAL TTF/OTF binary
    if (!data) {
      const remoteData = await fetchRemotePdfFontFace(
        request.family,
        request.weight,
        request.italic
      );

      if (remoteData && isPdfSafeSfntFont(remoteData)) {
        data = remoteData;
        sourceLabel = 'remote TTF/OTF fallback';
      }
    }

    // If exact weight not available remotely, try closest available weight in the same family locally
    if (!data) {
      const closestLocalResult = await fetchClosestLocalPdfFontFace(
        request.family,
        request.weight,
        request.italic
      );

      if (closestLocalResult && isPdfSafeSfntFont(closestLocalResult.data)) {
        data = closestLocalResult.data;
        sourceLabel = 'self-hosted closest weight';
      }
    }

    // 4 & 5. If no Acrobat-safe font was obtained, fall back to PDF standard fonts
    if (!data || !isPdfSafeSfntFont(data)) {
      console.warn(
        `[PDF Export] No Acrobat-safe TTF/OTF found for "${request.family}" ` +
        `${request.weight}${request.italic ? ' italic' : ''}.`
      );
      console.warn(
        `[PDF Export] "${request.family}" ${request.weight}` +
        `${request.italic ? ' italic' : ''} will use a PDF standard fallback.`
      );
      continue;
    }

    // Validate binary signature before every pdf.registerFont call
    if (!isPdfSafeSfntFont(data)) {
      continue;
    }

    const safeFamily = request.family.replace(
      /[^a-z0-9]+/gi,
      '_'
    );

    const pdfName =
      `Custom_${safeFamily}_${request.weight}_` +
      `${request.italic ? 'Italic' : 'Normal'}`;

    try {
      pdf.registerFont(pdfName, data);

      registered.push({
        ...request,
        pdfName,
        data,
      });

      console.info(
        `[PDF Export] Embedded Acrobat-safe font: ${request.family} ` +
        `${request.weight}${request.italic ? ' italic' : ''} ` +
        `(${describeFontBinary(data)})`
      );
    } catch (error) {
      console.warn(
        `[PDF Export] PDFKit could not register safe font "${request.family}":`,
        error
      );
    }
  }

  return registered;
}

function resolveRegisteredPdfFont(
  registered: PdfFontFace[],
  family: string,
  weightOrBold: number | boolean,
  italic: boolean
): string | null {
  const normalizedFamily = normalizePdfFontFamily(family).toLowerCase();
  const requestedWeight =
    typeof weightOrBold === 'boolean'
      ? weightOrBold
        ? 700
        : 400
      : normalizePdfFontWeight(weightOrBold);

  const familyFaces = registered.filter(
    (face) => face.family.toLowerCase() === normalizedFamily
  );

  if (familyFaces.length === 0) return null;

  const sameStyle = familyFaces.filter((face) => face.italic === italic);
  const candidates = sameStyle.length > 0 ? sameStyle : familyFaces;

  candidates.sort(
    (a, b) =>
      Math.abs(a.weight - requestedWeight) -
      Math.abs(b.weight - requestedWeight)
  );

  return candidates[0]?.pdfName || null;
}

/**
 * Exports one already-prepared SVG page to a vector PDF.
 *
 * Intended for DownloadExportModal after the modal has already handled:
 * - frame-mask repair / frame raster fallback
 * - SVG font-face embedding
 * - artwork image inlining
 *
 * PDFKit then keeps the main text/paths/shapes vector, while only unsupported
 * soft SVG filters (drop shadow, glow, blur) are rasterized on a transparent
 * high-resolution layer underneath.
 */
export async function exportPreparedVectorPdf(
  svg: string,
  options: {
    widthPt: number;
    heightPt: number;
    filename: string;
    canvasManager?: CanvasManager | null;
    geometry?: any;
    includeTrimMarks?: boolean;
    shadowDataUrl?: string | null;
  }
): Promise<void> {
  const {
    widthPt,
    heightPt,
    filename,
    canvasManager,
    geometry,
    includeTrimMarks,
  } = options;

  if (
    !svg ||
    !Number.isFinite(widthPt) ||
    !Number.isFinite(heightPt) ||
    widthPt <= 0 ||
    heightPt <= 0
  ) {
    throw new Error('Invalid prepared vector PDF export input');
  }

  ensurePdfKitStandardFontsRegistered();

  // Normalize root SVG width and height to match PDF points exactly.
  // SVGtoPDF converts "mm" using 96 DPI CSS pixels instead of 72 DPI PDF points (96/72 = 1.333x scale mismatch).
  // Setting width and height in exact PDF points guarantees 1:1 scale alignment with the PDF page and shadow layer.
  let normalizedSvg = svg;
  if (widthPt > 0 && heightPt > 0) {
    normalizedSvg = normalizedSvg.replace(
      /<svg\b([^>]*?)(\/?>)/i,
      (match, attrs, close) => {
        const clean = attrs
          .replace(/\bwidth\s*=\s*["'][^"']*["']/gi, '')
          .replace(/\bheight\s*=\s*["'][^"']*["']/gi, '')
          .trim();
        return `<svg ${clean} width="${widthPt}" height="${heightPt}"${close}`;
      }
    );
  }

  const embeddedSvg = await inlineExternalSvgImages(normalizedSvg);

  const pdf = new PDFDocument({
    size: [widthPt, heightPt],
    margin: 0,
    autoFirstPage: false,
    compress: true,
  });

  const chunks: Uint8Array[] = [];

  const registeredCustomFonts = await registerSvgFontsForPdf(
    pdf,
    [embeddedSvg]
  );

  if (process.env.NODE_ENV !== 'production') {
    const requested = collectSvgFontRequests([embeddedSvg]);

    console.info(
      `[PDF Export] Fonts requested: ${
        requested
          .map(
            (font) =>
              `${font.family} ${font.weight}` +
              `${font.italic ? ' italic' : ''}`
          )
          .join(', ') || 'none'
      }`
    );

    console.info(
      `[PDF Export] Custom fonts embedded: ${
        registeredCustomFonts
          .map(
            (font) =>
              `${font.family} ${font.weight}` +
              `${font.italic ? ' italic' : ''}`
          )
          .join(', ') || 'none'
      }`
    );
  }

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

  // 1. Generate shadow layer directly from Fabric canvas objects if canvasManager is provided
  let directFabricShadowUrl: string | null = options.shadowDataUrl || null;
  if (!directFabricShadowUrl && canvasManager) {
    directFabricShadowUrl = await createPdfShadowLayerFromFabric(
      canvasManager,
      geometry,
      {
        includeTrimMarks,
        scale: 4,
      }
    );
  }

  // 2. Prepare SVG layers (background and vector artwork)
  const preparedPdfSvg = await prepareSvgFiltersForVectorPdf(
    embeddedSvg,
    2,
    Boolean(directFabricShadowUrl)
  );

  // Prefer direct Fabric shadow layer; fallback to SVG filter shadow if needed
  const finalShadowDataUrl = directFabricShadowUrl || preparedPdfSvg.shadowDataUrl;

  pdf.addPage({
    size: [widthPt, heightPt],
    margin: 0,
  });

  const fontCallback = (
    family: string,
    bold: boolean,
    italic: boolean,
    fontOptions?: any
  ): string => {
    const rawWeight = fontOptions?.fontWeight ?? (bold ? 700 : 400);
    const targetWeight = normalizePdfFontWeight(rawWeight);
    const embeddedFont = resolveRegisteredPdfFont(
      registeredCustomFonts,
      family,
      targetWeight,
      italic
    );

    if (embeddedFont) return embeddedFont;

    return getStandardPdfFontName(family, bold, italic);
  };

  // 1. Draw background layer FIRST below everything else
  if (preparedPdfSvg.backgroundSvg) {
    SVGtoPDF(pdf, preparedPdfSvg.backgroundSvg, 0, 0, {
      width: widthPt,
      height: heightPt,
      assumePt: true,
      imageCallback: (link: string) => (link ? link.trim() : ''),
      fontCallback,
      warningCallback: (warning: string) => {
        console.warn('[PDF Export] Background SVG warning:', warning);
      },
    });
  }

  // 2. Draw transparent high-resolution SHADOW LAYER ON TOP of background, but BELOW vector artwork
  if (finalShadowDataUrl) {
    pdf.image(finalShadowDataUrl, 0, 0, {
      width: widthPt,
      height: heightPt,
    });
  }

  // 3. Main artwork remains crisp vectors above the effects layer
  SVGtoPDF(pdf, preparedPdfSvg.vectorSvg, 0, 0, {
    width: widthPt,
    height: heightPt,
    assumePt: true,
    imageCallback: (link: string) => (link ? link.trim() : ''),
    fontCallback,
    warningCallback: (warning: string) => {
      console.warn('[PDF Export] SVG-to-PDFKit warning:', warning);
    },
  });

  console.info('[PDF Shadow] Vector artwork rendered above shadow layer');

  pdf.end();
  await endPromise;

  if (chunks.length === 0) {
    throw new Error('Prepared vector PDF export produced zero bytes');
  }

  const blobParts = chunks.map((chunk) =>
    chunk.buffer.slice(
      chunk.byteOffset,
      chunk.byteOffset + chunk.byteLength
    ) as ArrayBuffer
  );

  const blob = new Blob(blobParts, {
    type: 'application/pdf',
  });

  if (blob.size === 0) {
    throw new Error('Generated prepared vector PDF is empty');
  }

  downloadBlob(blob, filename);
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

    // Register the exact custom fonts used by SVG text before SVG-to-PDFKit renders it.
    // This prevents Poppins/Montserrat/Roboto/etc. from silently becoming Helvetica.
    const registeredCustomFonts = await registerSvgFontsForPdf(pdf, svgs);

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

      let directFabricShadowUrl: string | null = null;
      if (options.canvasManager) {
        directFabricShadowUrl = await createPdfShadowLayerFromFabric(
          options.canvasManager,
          options.geometry,
          {
            includeTrimMarks: options.includeTrimMarks,
            scale: 4,
          }
        );
      }

      const preparedPdfSvg = await prepareSvgFiltersForVectorPdf(
        embeddedSvg,
        2
      );

      const finalShadowDataUrl =
        directFabricShadowUrl || preparedPdfSvg.shadowDataUrl;

      pdf.addPage({
        size: [width, height],
        margin: 0,
      });

      const fontCallback = (
        family: string,
        bold: boolean,
        italic: boolean,
        fontOptions?: any
      ): string => {
        const rawWeight = fontOptions?.fontWeight ?? (bold ? 700 : 400);
        const targetWeight = normalizePdfFontWeight(rawWeight);
        const embeddedFont = resolveRegisteredPdfFont(
          registeredCustomFonts,
          family,
          targetWeight,
          italic
        );

        if (embeddedFont) {
          return embeddedFont;
        }

        return getStandardPdfFontName(family, bold, italic);
      };

      // 1. Draw background layer below everything else
      if (preparedPdfSvg.backgroundSvg) {
        SVGtoPDF(pdf, preparedPdfSvg.backgroundSvg, 0, 0, {
          width,
          height,
          assumePt: true,
          imageCallback: (link: string) => (link ? link.trim() : ''),
          fontCallback,
          warningCallback: (warning: string) => {
            console.warn('[PDF Export] Background SVG warning:', warning);
          },
        });
      }

      // 2. Draw Fabric shadow/glow/effect pixels ON TOP of background, but BELOW vector artwork
      if (finalShadowDataUrl) {
        pdf.image(finalShadowDataUrl, 0, 0, {
          width,
          height,
        });
      }

      // 3. Draw the main artwork as crisp vectors above the soft effect layer
      SVGtoPDF(pdf, preparedPdfSvg.vectorSvg, 0, 0, {
        width,
        height,
        assumePt: true,
        imageCallback: (link: string) => (link ? link.trim() : ''),
        fontCallback,
        warningCallback: (warning: string) => {
          console.warn('SVG-to-PDFKit warning:', warning);
        },
      });

      console.info('[PDF Shadow] Vector artwork rendered above shadow layer');
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
