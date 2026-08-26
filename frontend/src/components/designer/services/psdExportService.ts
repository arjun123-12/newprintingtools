import { writePsd, Psd, Layer } from 'ag-psd';
import { Canvas, FabricObject, Textbox, IText } from 'fabric';
import { CanvasDimensions, DocumentSettings } from '@/types/designer';
import { CanvasManager } from '../canvas/CanvasManager';
import { downloadFile } from './exportService';

/**
 * Generates an authentic layered Adobe Photoshop (.psd) file from the Fabric.js canvas
 * at 300 DPI print resolution, preserving individual text, shape, image, and background layers.
 */
export async function exportLayeredPsd(
  canvasManager: CanvasManager,
  documentSettings: DocumentSettings,
  dimensions: CanvasDimensions,
  filename?: string
): Promise<void> {
  const canvas = canvasManager.getCanvas();
  if (!canvas) {
    throw new Error('Canvas is not initialized');
  }

  const width = dimensions.widthPx || 1063;
  const height = dimensions.heightPx || 591;

  // 1. Create Background Layer
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = width;
  bgCanvas.height = height;
  const bgCtx = bgCanvas.getContext('2d');
  if (bgCtx) {
    if (canvas.backgroundImage) {
      bgCtx.save();
      try {
        canvas.backgroundImage.render(bgCtx);
      } catch {
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, width, height);
      }
      bgCtx.restore();
    } else if (canvas.backgroundColor) {
      if (typeof canvas.backgroundColor === 'string') {
        bgCtx.fillStyle = canvas.backgroundColor;
        bgCtx.fillRect(0, 0, width, height);
      } else {
        const grad = (canvas.backgroundColor as any).toLive ? (canvas.backgroundColor as any).toLive(bgCtx) : null;
        if (grad) {
          bgCtx.fillStyle = grad;
          bgCtx.fillRect(0, 0, width, height);
        } else {
          bgCtx.fillStyle = documentSettings.backgroundColor || '#ffffff';
          bgCtx.fillRect(0, 0, width, height);
        }
      }
    } else {
      bgCtx.fillStyle = documentSettings.backgroundColor || '#ffffff';
      bgCtx.fillRect(0, 0, width, height);
    }
  }

  const layers: Layer[] = [];

  // Add Background Layer
  layers.push({
    name: 'Background',
    canvas: bgCanvas,
    left: 0,
    top: 0,
    opacity: 1,
  });

  // 2. Process all Fabric Canvas Objects into Individual Layers
  const objects = canvas.getObjects();

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    // Skip internal guides or snapping lines
    if (obj.get('isGuide' as any) || (obj as any).isRulerGuide) {
      continue;
    }

    try {
      const objName =
        (obj.get('name' as any) as string) ||
        `${obj.type.charAt(0).toUpperCase() + obj.type.slice(1)} ${i + 1}`;

      const bound = obj.getBoundingRect();
      const layerW = Math.max(Math.ceil(bound.width), 1);
      const layerH = Math.max(Math.ceil(bound.height), 1);

      // Render individual object to isolated offscreen canvas
      const objCanvas = document.createElement('canvas');
      objCanvas.width = layerW;
      objCanvas.height = layerH;
      const objCtx = objCanvas.getContext('2d');

      if (objCtx) {
        objCtx.save();
        // Translate origin to capture object inside its local bounds
        objCtx.translate(-bound.left, -bound.top);
        obj.render(objCtx);
        objCtx.restore();
      }

      const layer: Layer = {
        name: objName,
        canvas: objCanvas,
        left: Math.round(bound.left),
        top: Math.round(bound.top),
        opacity: obj.opacity !== undefined ? obj.opacity : 1,
        hidden: !obj.visible,
      };

      // If text object, add metadata
      if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
        const textObj = obj as Textbox | IText;
        layer.text = {
          text: textObj.text || '',
        };
      }

      layers.push(layer);
    } catch (err) {
      console.warn('Skipping layer during PSD export:', err);
    }
  }

  // 3. Create Merged Composite Canvas for Document Preview / Compatibility
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = width;
  compositeCanvas.height = height;
  const compCtx = compositeCanvas.getContext('2d');
  if (compCtx) {
    // Draw background
    compCtx.drawImage(bgCanvas, 0, 0);
    // Draw each object
    for (const obj of objects) {
      if (!obj.get('isGuide' as any)) {
        obj.render(compCtx);
      }
    }
  }

  // 4. Construct PSD Document Structure with 300 DPI resolution
  const psd: Psd = {
    width,
    height,
    channels: 4,
    bitsPerChannel: 8,
    colorMode: 3, // RGB
    imageResources: {
      resolutionInfo: {
        horizontalResolution: 300,
        horizontalResolutionUnit: 'PPI',
        widthUnit: 'Inches',
        verticalResolution: 300,
        verticalResolutionUnit: 'PPI',
        heightUnit: 'Inches',
      },
    },
    canvas: compositeCanvas,
    children: layers,
  };

  // 5. Generate Binary Buffer & Trigger Download
  const buffer = writePsd(psd, {
    generateThumbnail: true,
  });

  const blob = new Blob([buffer], { type: 'image/vnd.adobe.photoshop' });
  const objectUrl = URL.createObjectURL(blob);

  const safeName = (documentSettings.name || 'print_artwork')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  const finalFilename = filename || `${safeName}_300dpi.psd`;

  downloadFile(objectUrl, finalFilename);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 10000);
}
