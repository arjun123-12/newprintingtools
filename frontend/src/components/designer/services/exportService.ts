import { DocumentSettings, CanvasDimensions } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import PDFDocument, * as PDFKitModule from 'pdfkit';
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

let isStdFontsRegistered = false;

/**
 * Idempotently registers all 14 standard PDFKit fonts (Helvetica, Times, Courier, Symbol, ZapfDingbats).
 * Safe to call multiple times, across multiple exports, and during Next.js hot module reloading.
 */
export function ensurePdfKitStandardFontsRegistered(): void {
  if (isStdFontsRegistered) return;
  try {
    const registerFn =
      (PDFKitModule as any).registerStdFonts ||
      (PDFDocument as any).registerStdFonts;

    if (typeof registerFn === 'function') {
      registerFn(
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
        ZapfDingbats
      );
    }
    isStdFontsRegistered = true;
  } catch (err) {
    console.error('Failed to register PDFKit standard fonts:', err);
    throw new Error(
      `Failed to initialize PDFKit standard fonts: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export interface ExportPdfOptions {
  filename?: string;
}

export interface ExportImageOptions {
  format?: 'png' | 'jpeg';
  dpi?: number;
  quality?: number;
  filename?: string;
}

/**
 * Exports the Fabric artwork as a high-resolution PNG or JPEG raster image.
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

  const { format = 'png', quality = 0.95 } = options;

  const activeObj = canvas.getActiveObject();
  const wasGuidesVisible = canvasManager.getGuidesVisible();
  const prevZoom = canvasManager.getZoom();

  canvasManager.setGuidesVisible(false);
  canvas.discardActiveObject();
  canvasManager.setZoom(1.0);
  canvas.requestRenderAll();

  try {
    const multiplier = Math.max(1, (documentSettings.dpi || 300) / 72);
    const dataUrl = canvas.toDataURL({
      format: format === 'jpeg' ? 'jpeg' : 'png',
      quality,
      multiplier,
    });

    const safeName = (documentSettings.name || 'print_artwork')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filename =
      options.filename || `${safeName}_${documentSettings.dpi || 300}dpi.${ext}`;

    downloadFile(dataUrl, filename);
  } finally {
    canvasManager.setZoom(prevZoom);
    canvasManager.setGuidesVisible(wasGuidesVisible);
    if (activeObj) {
      canvas.setActiveObject(activeObj);
    }
    canvas.requestRenderAll();
  }
}

/**
 * Exports the Fabric artwork as a VECTOR PDF.
 *
 * Text, paths, shapes and vector elements remain vector-based.
 * Canvas guides, selection boxes and other UI overlays are not exported.
 */
export async function exportVectorPdf(
  canvasManager: CanvasManager,
  documentSettings: DocumentSettings,
  options: ExportPdfOptions = {}
): Promise<void> {
  const canvas = canvasManager.getCanvas();
  if (!canvas) {
    throw new Error('Canvas is not initialized');
  }

  // 1. Ensure PDFKit standard fonts are registered before instantiating any document
  ensurePdfKitStandardFontsRegistered();

  // 2. Temporarily deselect, normalize zoom to 1.0, and hide editor guides
  const activeObj = canvas.getActiveObject();
  const wasGuidesVisible = canvasManager.getGuidesVisible();
  const prevZoom = canvasManager.getZoom();

  canvasManager.setGuidesVisible(false);
  canvas.discardActiveObject();
  canvasManager.setZoom(1.0);
  canvas.requestRenderAll();

  try {
    const svg = canvas.toSVG();
    const width = canvas.getWidth();
    const height = canvas.getHeight();

    const pdf = new PDFDocument({
      size: [width, height],
      margin: 0,
      autoFirstPage: false,
    });

    pdf.addPage({
      size: [width, height],
      margin: 0,
    });

    const chunks: Uint8Array[] = [];
    pdf.on('data', (chunk: Uint8Array) => {
      chunks.push(chunk);
    });

    const endPromise = new Promise<void>((resolve, reject) => {
      pdf.on('end', () => resolve());
      pdf.on('error', (err: any) => reject(err));
    });

    // Convert SVG -> PDF vectors with font mapping to registered PDF standard fonts
    SVGtoPDF(pdf, svg, 0, 0, {
      width,
      height,
      assumePt: true,
      fontCallback: (family: string, bold: boolean, italic: boolean) => {
        const f = (family || '').toLowerCase();
        if (f.includes('courier') || f.includes('mono') || f.includes('code')) {
          if (bold && italic) return 'Courier-BoldOblique';
          if (bold) return 'Courier-Bold';
          if (italic) return 'Courier-Oblique';
          return 'Courier';
        }
        if (
          f.includes('times') ||
          f.includes('serif') ||
          f.includes('georgia') ||
          f.includes('garamond') ||
          f.includes('playfair') ||
          f.includes('merriweather')
        ) {
          if (bold && italic) return 'Times-BoldItalic';
          if (bold) return 'Times-Bold';
          if (italic) return 'Times-Italic';
          return 'Times-Roman';
        }
        if (f.includes('symbol')) {
          return 'Symbol';
        }
        if (f.includes('dingbat')) {
          return 'ZapfDingbats';
        }
        if (bold && italic) return 'Helvetica-BoldOblique';
        if (bold) return 'Helvetica-Bold';
        if (italic) return 'Helvetica-Oblique';
        return 'Helvetica';
      },
      warningCallback: (warning: string) => {
        console.warn('SVGtoPDF warning:', warning);
      },
    });

    pdf.end();
    await endPromise;

    if (chunks.length === 0) {
      throw new Error('PDF export produced zero bytes.');
    }

    const blob = new Blob(chunks as BlobPart[], {
      type: 'application/pdf',
    });

    const url = URL.createObjectURL(blob);
    const safeName = (documentSettings.name || 'print_artwork')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const filename = options.filename || `${safeName}_vector.pdf`;

    downloadFile(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (error) {
    console.error('Vector PDF Export failed:', error);
    throw error;
  } finally {
    // 3. Restore guides & active selection
    canvasManager.setZoom(prevZoom);
    canvasManager.setGuidesVisible(wasGuidesVisible);
    if (activeObj) {
      canvas.setActiveObject(activeObj);
    }
    canvas.requestRenderAll();
  }
}

/**
 * Downloads a Blob/data URL.
 */
export function downloadFile(
  url: string,
  filename: string
): void {
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}