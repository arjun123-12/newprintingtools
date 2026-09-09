import { writePsd, type Layer, type Psd } from 'ag-psd';
import { type FabricObject } from 'fabric';
import { CanvasDimensions, DocumentSettings } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { downloadFile } from './exportService';

function getObjectValue(obj: FabricObject, key: string): unknown {
  return typeof (obj as any).get === 'function'
    ? (obj as any).get(key)
    : (obj as any)[key];
}

function isEditorOnlyObject(obj: FabricObject): boolean {
  return Boolean(
    getObjectValue(obj, 'isGuide') ||
    getObjectValue(obj, 'isPrintGuide') ||
    getObjectValue(obj, 'isRulerGuide') ||
    getObjectValue(obj, 'excludeFromSelection')
  );
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load rendered artwork for PSD export'));
    image.src = source;
  });
}

/**
 * Renders through Fabric's supported object exporter. This preserves groups,
 * clip paths, filters, crop state, rotations, shadows and image transforms.
 */
function renderFabricObjectLayer(
  obj: FabricObject,
  documentWidth: number,
  documentHeight: number
): { canvas: HTMLCanvasElement; left: number; top: number } | null {
  obj.setCoords();
  const bounds = obj.getBoundingRect();

  if (
    !Number.isFinite(bounds.left) ||
    !Number.isFinite(bounds.top) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return null;
  }

  const rawLeft = Math.floor(bounds.left);
  const rawTop = Math.floor(bounds.top);
  const rawRight = Math.ceil(bounds.left + bounds.width);
  const rawBottom = Math.ceil(bounds.top + bounds.height);

  // PSD layer rectangles are clipped to the actual document bounds.
  const left = Math.max(0, rawLeft);
  const top = Math.max(0, rawTop);
  const right = Math.min(documentWidth, rawRight);
  const bottom = Math.min(documentHeight, rawBottom);

  if (right <= left || bottom <= top) return null;

  const sourceCanvas = obj.toCanvasElement({
    multiplier: 1,
    enableRetinaScaling: false,
  });

  const outputCanvas = createCanvas(right - left, bottom - top);
  const context = outputCanvas.getContext('2d');
  if (!context) return null;

  const scaleX = sourceCanvas.width / Math.max(bounds.width, 1);
  const scaleY = sourceCanvas.height / Math.max(bounds.height, 1);
  const sourceX = Math.max(0, (left - bounds.left) * scaleX);
  const sourceY = Math.max(0, (top - bounds.top) * scaleY);
  const sourceWidth = Math.min(sourceCanvas.width - sourceX, (right - left) * scaleX);
  const sourceHeight = Math.min(sourceCanvas.height - sourceY, (bottom - top) * scaleY);

  context.drawImage(
    sourceCanvas,
    sourceX,
    sourceY,
    Math.max(sourceWidth, 1),
    Math.max(sourceHeight, 1),
    0,
    0,
    outputCanvas.width,
    outputCanvas.height
  );

  return { canvas: outputCanvas, left, top };
}

/** Generates a layered, Photoshop-compatible PSD from the Fabric canvas. */
export async function exportLayeredPsd(
  canvasManager: CanvasManager,
  documentSettings: DocumentSettings,
  dimensions: CanvasDimensions,
  filename?: string
): Promise<void> {
  const fabricCanvas = canvasManager.getCanvas();
  if (!fabricCanvas) throw new Error('Canvas is not initialized');

  const width = Math.max(1, Math.round(dimensions.widthPx || 1063));
  const height = Math.max(1, Math.round(dimensions.heightPx || 591));

  if (width > 30000 || height > 30000) {
    throw new Error(
      `PSD dimensions (${width}x${height}px) exceed Photoshop's 30,000px limit.`
    );
  }

  await canvasManager.waitForAllImagesToLoad(15000);
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const layers: Layer[] = [];
  const backgroundCanvas = createCanvas(width, height);
  const backgroundContext = backgroundCanvas.getContext('2d');

  if (!backgroundContext) {
    throw new Error('Unable to create the PSD background layer');
  }

  const backgroundColor =
    typeof fabricCanvas.backgroundColor === 'string' && fabricCanvas.backgroundColor !== 'transparent'
      ? fabricCanvas.backgroundColor
      : documentSettings.backgroundColor || '#ffffff';

  backgroundContext.fillStyle = backgroundColor;
  backgroundContext.fillRect(0, 0, width, height);

  if (fabricCanvas.backgroundImage) {
    const renderedBackground = renderFabricObjectLayer(
      fabricCanvas.backgroundImage,
      width,
      height
    );
    if (renderedBackground) {
      backgroundContext.drawImage(
        renderedBackground.canvas,
        renderedBackground.left,
        renderedBackground.top
      );
    }
  }

  layers.push({
    name: 'Background',
    canvas: backgroundCanvas,
    left: 0,
    top: 0,
    opacity: 1,
  });

  const objects = fabricCanvas.getObjects();
  for (let index = 0; index < objects.length; index++) {
    const obj = objects[index];
    if (isEditorOnlyObject(obj)) continue;

    try {
      const rendered = renderFabricObjectLayer(obj, width, height);
      if (!rendered) continue;

      const fallbackType = obj.type || 'object';
      const objectName =
        String(getObjectValue(obj, 'name') || '').trim() ||
        `${fallbackType.charAt(0).toUpperCase()}${fallbackType.slice(1)} ${index + 1}`;

      layers.push({
        name: objectName,
        canvas: rendered.canvas,
        left: rendered.left,
        top: rendered.top,
        // Fabric has already rendered opacity into the layer pixels.
        // Applying it again here would make the PSD layer too transparent.
        opacity: 1,
        hidden: obj.visible === false,
      });
    } catch (error) {
      console.warn('Skipping unsupported PSD layer:', obj.type, error);
    }
  }

  /*
   * Store a guaranteed merged preview in the PSD document. Photoshop and other
   * PSD readers use this composite while loading and when a layer is unsupported.
   */
  const compositeDataUrl = await canvasManager.getCleanPreviewDataUrl(1);
  if (!compositeDataUrl || !compositeDataUrl.startsWith('data:image/')) {
    throw new Error('Fabric canvas did not produce a PSD composite preview');
  }

  const compositeImage = await loadImage(compositeDataUrl);
  const compositeCanvas = createCanvas(width, height);
  const compositeContext = compositeCanvas.getContext('2d');
  if (!compositeContext) {
    throw new Error('Unable to create the PSD composite preview');
  }
  compositeContext.drawImage(compositeImage, 0, 0, width, height);

  const targetDpi = Math.max(1, documentSettings.dpi || dimensions.dpi || 300);
  const psd: Psd = {
    width,
    height,
    channels: 4,
    bitsPerChannel: 8,
    colorMode: 3,
    imageResources: {
      resolutionInfo: {
        horizontalResolution: targetDpi,
        horizontalResolutionUnit: 'PPI',
        widthUnit: 'Inches',
        verticalResolution: targetDpi,
        verticalResolutionUnit: 'PPI',
        heightUnit: 'Inches',
      },
    },
    canvas: compositeCanvas,
    children: layers,
  };

  const buffer = writePsd(psd, { generateThumbnail: true });
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('PSD generation produced an empty file');
  }

  const blob = new Blob([buffer], { type: 'image/vnd.adobe.photoshop' });
  const objectUrl = URL.createObjectURL(blob);
  const safeName = (documentSettings.name || 'print_artwork')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  const finalFilename = filename || `${safeName}_${targetDpi}dpi.psd`;

  try {
    downloadFile(objectUrl, finalFilename);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }
}
