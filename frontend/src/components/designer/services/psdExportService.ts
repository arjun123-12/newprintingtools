import { type FabricObject } from 'fabric';
import { CanvasDimensions, DocumentSettings } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { downloadFile } from './exportService';

type AgPsdLayer = import('ag-psd').Layer;
type AgPsdPsd = import('ag-psd').Psd;

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

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = (hex || '#000000').replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return { r, g, b, a: 1 };
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return { r, g, b, a: 1 };
}

/** Map Canvas globalCompositeOperation to Photoshop BlendMode */
function mapCompositeToPsdBlendMode(op?: string): any {
  switch (op) {
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    case 'overlay':
      return 'overlay';
    case 'darken':
      return 'darken';
    case 'lighten':
      return 'lighten';
    case 'color-dodge':
      return 'color dodge';
    case 'color-burn':
      return 'color burn';
    case 'hard-light':
      return 'hard light';
    case 'soft-light':
      return 'soft light';
    case 'difference':
      return 'difference';
    case 'exclusion':
      return 'exclusion';
    case 'hue':
      return 'hue';
    case 'saturation':
      return 'saturation';
    case 'color':
      return 'color';
    case 'luminosity':
      return 'luminosity';
    default:
      return 'normal';
  }
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

/**
 * Builds an AgPsdLayer from a FabricObject, preserving text metadata, groups,
 * opacity, visibility, and blend modes where supported.
 */
function convertFabricObjectToPsdLayer(
  obj: FabricObject,
  index: number,
  width: number,
  height: number
): AgPsdLayer | null {
  if (isEditorOnlyObject(obj)) return null;

  const fallbackType = obj.type || 'object';
  const objectName =
    String(getObjectValue(obj, 'name') || getObjectValue(obj, 'psdLayerName') || '').trim() ||
    `${fallbackType.charAt(0).toUpperCase()}${fallbackType.slice(1)} ${index + 1}`;

  const isVisible = obj.visible !== false;
  const opacity = typeof obj.opacity === 'number' ? obj.opacity : 1;
  const rawBlendMode = (getObjectValue(obj, 'psdBlendMode') as string) || (obj as any).globalCompositeOperation;
  const blendMode = mapCompositeToPsdBlendMode(rawBlendMode);

  // Group handling
  const isGroup = obj.type === 'group' && Array.isArray((obj as any)._objects);
  if (isGroup) {
    const childObjects: FabricObject[] = (obj as any)._objects || [];
    const children: AgPsdLayer[] = [];

    for (let cIdx = 0; cIdx < childObjects.length; cIdx++) {
      const child = childObjects[cIdx];
      const childLayer = convertFabricObjectToPsdLayer(child, cIdx, width, height);
      if (childLayer) {
        children.push(childLayer);
      }
    }

    return {
      name: objectName,
      opened: true,
      children,
      opacity,
      hidden: !isVisible,
      blendMode,
    };
  }

  // Render raster canvas representation
  const rendered = renderFabricObjectLayer(obj, width, height);
  if (!rendered) return null;

  const layer: AgPsdLayer = {
    name: objectName,
    canvas: rendered.canvas,
    left: rendered.left,
    top: rendered.top,
    opacity,
    hidden: !isVisible,
    blendMode,
  };

  // Text layer enhancement: provide Photoshop-editable text data alongside pixel fallback
  const isText = obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
  if (isText) {
    const textObj = obj as any;
    const textStr = String(textObj.text || '');
    const fontSize = Math.max(6, Math.round(textObj.fontSize || 16));
    const fontFamily = String(textObj.fontFamily || 'Arial').split(',')[0].trim().replace(/['"]/g, '');
    const fillStr = typeof textObj.fill === 'string' ? textObj.fill : '#000000';

    layer.text = {
      text: textStr,
      style: {
        fontSize,
        font: { name: fontFamily },
        fillColor: hexToRgba(fillStr),
        fauxBold: textObj.fontWeight === 'bold' || Number(textObj.fontWeight) >= 700,
        fauxItalic: textObj.fontStyle === 'italic',
      },
      paragraphStyle: {
        justification: (textObj.textAlign as any) || 'left',
      },
    };
  }

  return layer;
}

/** Generates a layered, Photoshop-compatible PSD from the Fabric canvas. */
export async function exportLayeredPsd(
  canvasManager: CanvasManager,
  documentSettings: DocumentSettings,
  dimensions: CanvasDimensions,
  filename?: string,
  includeTrimMarks: boolean = false
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

  // Dynamic import of ag-psd to prevent SSR bundling/execution
  const agPsd = await import('ag-psd');

  await canvasManager.waitForAllImagesToLoad(15000);
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const layers: AgPsdLayer[] = [];
  const backgroundCanvas = createCanvas(width, height);
  const backgroundContext = backgroundCanvas.getContext('2d');

  if (!backgroundContext) {
    throw new Error('Unable to create the PSD background layer');
  }

  const bgSettings = canvasManager.getBackgroundSettings?.();
  if (bgSettings?.type === 'gradient' && bgSettings.gradient) {
    const grad = bgSettings.gradient;
    const angleRad = (((grad.angle || 0) - 90) * Math.PI) / 180;
    const len = Math.sqrt(width * width + height * height) / 2;
    const canvasGrad = backgroundContext.createLinearGradient(
      width / 2 - Math.cos(angleRad) * len,
      height / 2 - Math.sin(angleRad) * len,
      width / 2 + Math.cos(angleRad) * len,
      height / 2 + Math.sin(angleRad) * len
    );
    (grad.stops || []).forEach((s) => canvasGrad.addColorStop(s.offset, s.color));
    backgroundContext.fillStyle = canvasGrad;
    backgroundContext.fillRect(0, 0, width, height);
  } else {
    const backgroundColor =
      typeof fabricCanvas.backgroundColor === 'string' && fabricCanvas.backgroundColor !== 'transparent'
        ? fabricCanvas.backgroundColor
        : (bgSettings?.type === 'color' && bgSettings.color && bgSettings.color !== 'transparent'
            ? bgSettings.color
            : documentSettings.backgroundColor || '#ffffff');

    backgroundContext.fillStyle = backgroundColor;
    backgroundContext.fillRect(0, 0, width, height);
  }

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
    try {
      const layer = convertFabricObjectToPsdLayer(obj, index, width, height);
      if (layer) {
        layers.push(layer);
      }
    } catch (error) {
      console.warn('Skipping unsupported PSD layer:', obj.type, error);
    }
  }

  if (includeTrimMarks) {
    const marksCanvas = createCanvas(width, height);
    const marksCtx = marksCanvas.getContext('2d');
    if (marksCtx) {
      const pxPerMm = (dimensions.dpi || 300) / 25.4;
      const marginPx = Math.round(6 * pxPerMm);
      const markLen = Math.round(4 * pxPerMm);
      const markGap = Math.round(1.5 * pxPerMm);

      const x1 = marginPx;
      const y1 = marginPx;
      const x2 = Math.max(x1, width - marginPx);
      const y2 = Math.max(y1, height - marginPx);

      marksCtx.strokeStyle = '#000000';
      marksCtx.lineWidth = Math.max(1, Math.round(pxPerMm * 0.25));
      marksCtx.lineCap = 'square';
      marksCtx.beginPath();

      // Top-Left
      marksCtx.moveTo(x1, y1 - markGap);
      marksCtx.lineTo(x1, Math.max(0, y1 - markGap - markLen));
      marksCtx.moveTo(x1 - markGap, y1);
      marksCtx.lineTo(Math.max(0, x1 - markGap - markLen), y1);

      // Top-Right
      marksCtx.moveTo(x2, y1 - markGap);
      marksCtx.lineTo(x2, Math.max(0, y1 - markGap - markLen));
      marksCtx.moveTo(x2 + markGap, y1);
      marksCtx.lineTo(Math.min(width, x2 + markGap + markLen), y1);

      // Bottom-Left
      marksCtx.moveTo(x1, y2 + markGap);
      marksCtx.lineTo(x1, Math.min(height, y2 + markGap + markLen));
      marksCtx.moveTo(x1 - markGap, y2);
      marksCtx.lineTo(Math.max(0, x1 - markGap - markLen), y2);

      // Bottom-Right
      marksCtx.moveTo(x2, y2 + markGap);
      marksCtx.lineTo(x2, Math.min(height, y2 + markGap + markLen));
      marksCtx.moveTo(x2 + markGap, y2);
      marksCtx.lineTo(Math.min(width, x2 + markGap + markLen), y2);

      marksCtx.stroke();

      layers.push({
        name: 'Trim Marks',
        canvas: marksCanvas,
        left: 0,
        top: 0,
        opacity: 1,
      });
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
  const psd: AgPsdPsd = {
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

  const buffer = agPsd.writePsd(psd, { generateThumbnail: true });
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
