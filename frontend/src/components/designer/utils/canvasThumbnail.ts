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
