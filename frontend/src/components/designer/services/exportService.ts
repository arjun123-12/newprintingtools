import { Canvas } from 'fabric';
import { DocumentSettings, CanvasDimensions } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';

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

  // 1. Temporarily deselect, normalize zoom to 1.0, and hide editor guides
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

    // Dynamically load PDFKit and SVGtoPDF in browser
    const [PDFDocModule, SVGtoPDFModule] = await Promise.all([
      import('pdfkit'),
      import('svg-to-pdfkit'),
    ]);

    const PDFDocument = (PDFDocModule as any).default || PDFDocModule;
    const SVGtoPDF = (SVGtoPDFModule as any).default || SVGtoPDFModule;

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

    // Convert SVG -> PDF vectors
    SVGtoPDF(pdf, svg, 0, 0, {
      width,
      height,
      assumePt: true,
    });

    pdf.end();
    await endPromise;

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
  } finally {
    // 2. Restore guides & active selection
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