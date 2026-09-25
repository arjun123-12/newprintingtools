import { StaticCanvas } from 'fabric';

/**
 * Renders a Fabric.js canvas JSON object offscreen to a PNG data URL.
 * Used to immediately generate thumbnails for non-active pages (like Back side of a template)
 * without needing to switch active canvas views.
 */
export async function renderCanvasJsonToThumbnail(
  json: Record<string, any> | string | undefined | null,
  width: number = 400,
  height: number = 250,
  fallbackBg: string = '#ffffff'
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!json) return null;

  try {
    const parsedJson = typeof json === 'string' ? JSON.parse(json) : json;
    const canvasEl = document.createElement('canvas');
    canvasEl.width = Math.max(10, width);
    canvasEl.height = Math.max(10, height);

    const staticCanvas = new StaticCanvas(canvasEl, {
      width: canvasEl.width,
      height: canvasEl.height,
      backgroundColor: parsedJson?.background || fallbackBg,
    });

    if (parsedJson && (parsedJson.objects?.length > 0 || parsedJson.background)) {
      await staticCanvas.loadFromJSON(parsedJson);
      staticCanvas.renderAll();
    }

    const dataUrl = staticCanvas.toDataURL({
      format: 'png',
      multiplier: 1,
    });

    staticCanvas.dispose();
    return dataUrl;
  } catch (err) {
    console.warn('renderCanvasJsonToThumbnail error:', err);
    return null;
  }
}

/**
 * Renders a Fabric.js canvas JSON object offscreen at full print-quality resolution (300 DPI level)
 * with disabled object raster caching to ensure ultra-sharp vectors, text serifs, and lines.
 */
export async function renderCanvasJsonToPrintPreview(
  json: Record<string, any> | string | undefined | null,
  width: number,
  height: number,
  multiplier: number = 2.0,
  fallbackBg: string = '#ffffff'
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!json) return null;

  try {
    const parsedJson = typeof json === 'string' ? JSON.parse(json) : json;
    const canvasEl = document.createElement('canvas');
    canvasEl.width = Math.max(10, Math.round(width));
    canvasEl.height = Math.max(10, Math.round(height));

    const staticCanvas = new StaticCanvas(canvasEl, {
      width: canvasEl.width,
      height: canvasEl.height,
      backgroundColor: parsedJson?.background || fallbackBg,
      enableRetinaScaling: false,
    });

    if (parsedJson && (parsedJson.objects?.length > 0 || parsedJson.background)) {
      await staticCanvas.loadFromJSON(parsedJson);

      // Disable objectCaching to ensure Fabric rasterizes crisp vector glyphs & shapes
      // at full export resolution rather than scaling an internal low-res bitmap cache
      staticCanvas.forEachObject((obj) => {
        obj.set({
          objectCaching: false,
          noScaleCache: false,
          dirty: true,
        });
      });

      staticCanvas.renderAll();
    }

    const dataUrl = staticCanvas.toDataURL({
      format: 'png',
      multiplier: Math.max(1.0, multiplier),
      quality: 1.0,
      enableRetinaScaling: false,
    });

    staticCanvas.dispose();
    return dataUrl;
  } catch (err) {
    console.warn('renderCanvasJsonToPrintPreview error:', err);
    return null;
  }
}

