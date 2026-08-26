import { Canvas } from 'fabric';
import { CanvasDimensions, DocumentSettings } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';

export interface ExportImageOptions {
  format: 'png' | 'jpeg';
  quality?: number; // 0.1 to 1.0 for jpeg
  dpi?: number; // default 300
  includeBleed?: boolean;
  filename?: string;
}

/**
 * Downloads a data URL or Blob as a file in the user's browser
 */
export function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports high-resolution 300 DPI image (PNG or JPG) from the Fabric canvas
 * using true target print dimensions, ensuring sharp vectors and crisp typography.
 */
export async function exportHighResolutionImage(
  canvasManager: CanvasManager,
  documentSettings: DocumentSettings,
  dimensions: CanvasDimensions,
  options: ExportImageOptions
): Promise<string> {
  const canvas = canvasManager.getCanvas();
  if (!canvas) {
    throw new Error('Canvas is not initialized');
  }

  const targetDpi = options.dpi || 300;
  const currentDpi = dimensions.dpi || 300;
  const multiplier = targetDpi / currentDpi;

  // Temporarily deselect all active objects to avoid selection bounding boxes in export
  const activeObj = canvas.getActiveObject();
  canvas.discardActiveObject();
  canvas.requestRenderAll();

  try {
    const dataUrl = canvas.toDataURL({
      format: options.format === 'jpeg' ? 'jpeg' : 'png',
      quality: options.quality !== undefined ? options.quality : 0.98,
      multiplier: Math.max(multiplier, 1),
      enableRetinaScaling: true,
    });

    const safeName = (documentSettings.name || 'print_artwork')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const ext = options.format === 'jpeg' ? 'jpg' : 'png';
    const finalFilename = options.filename || `${safeName}_300dpi.${ext}`;

    downloadFile(dataUrl, finalFilename);
    return dataUrl;
  } finally {
    // Restore active selection if existed
    if (activeObj) {
      canvas.setActiveObject(activeObj);
      canvas.requestRenderAll();
    }
  }
}
