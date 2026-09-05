import { CanvasManager } from '../canvas/CanvasManager';
import { ArtworkDraftPayload } from '../services/designerService';
import { DocumentSettings, CanvasDimensions, DesignerTemplate } from '@/types/designer';

/**
 * Artwork document metadata that wraps around the Fabric.js canvas JSON.
 * This is the shape stored in MySQL artworks.canvas_json + surrounding columns.
 */
export interface ArtworkDocument {
  version: string;
  width: number;
  height: number;
  unit: string;
  dpi: number;
  bleed: number;
  safeArea: number;
  backgroundColor: string;
  objects: any[];
}

/**
 * Create an ArtworkDraftPayload from the current state of the CanvasManager.
 * This captures the full editable Fabric.js JSON + document settings.
 *
 * Reuses the existing CanvasManager — does NOT create a second Fabric canvas.
 */
export function createArtworkPayloadFromCanvas(
  canvasManager: CanvasManager,
  options: {
    productId?: string;
    designTemplateId?: string | null;
    name?: string;
    documentSettings?: DocumentSettings;
    dimensions?: CanvasDimensions;
  }
): ArtworkDraftPayload {
  const canvasJson = canvasManager.getSerializableJson();

  const dims = options.dimensions || canvasManager.getDimensions();
  const doc = options.documentSettings || {
    width: dims.widthMm || 90,
    height: dims.heightMm || 50,
    unit: 'mm' as const,
    dpi: dims.dpi || 300,
    bleed: dims.bleedMm ?? 3,
    safeArea: dims.safeZoneMm ?? 3,
    backgroundColor: '#ffffff',
    showGuides: true,
  };

  return {
    product_id: (options.productId && options.productId !== 'default') ? options.productId : null,
    design_template_id: options.designTemplateId || null,
    name: options.name || 'Untitled Design',
    canvas_json: canvasJson,
    document_settings: doc,
    width_px: dims.widthPx,
    height_px: dims.heightPx,
    dpi: doc.dpi || dims.dpi || 300,
  };
}

/**
 * Create an ArtworkDraftPayload from an image URL.
 *
 * This adds the image to the canvas as a fully editable Fabric.js Image object
 * (with id, name, elementType, assetUrl custom properties),
 * then serializes the canvas to JSON.
 *
 * The image is stored as a URL reference, NOT as base64.
 */
export async function createArtworkFromImage(
  imageUrl: string,
  canvasManager: CanvasManager,
  options?: {
    assetId?: string;
    name?: string;
    provider?: string;
    productId?: string;
    documentSettings?: DocumentSettings;
    dimensions?: CanvasDimensions;
  }
): Promise<ArtworkDraftPayload> {
  // Add image to canvas using existing CanvasManager method
  const img = await canvasManager.addImageFromUrl(imageUrl, {
    name: options?.name || 'Image',
    originalSrc: imageUrl,
  });

  if (img) {
    // Set custom properties for round-trip serialization
    img.set('elementType' as any, 'image');
    img.set('assetUrl' as any, imageUrl);
    if (options?.assetId) {
      img.set('assetId' as any, options.assetId);
    }
    if (options?.provider) {
      img.set('provider' as any, options.provider);
    }
  }

  return createArtworkPayloadFromCanvas(canvasManager, {
    productId: options?.productId,
    name: options?.name || 'Image Artwork',
    documentSettings: options?.documentSettings,
    dimensions: options?.dimensions,
  });
}

/**
 * Create an ArtworkDraftPayload from a template.
 *
 * This loads the template into the canvas using existing CanvasManager method,
 * then serializes the canvas to JSON.
 */
export async function createArtworkFromTemplate(
  template: DesignerTemplate,
  canvasManager: CanvasManager,
  options?: {
    productId?: string;
    documentSettings?: DocumentSettings;
    dimensions?: CanvasDimensions;
  }
): Promise<ArtworkDraftPayload> {
  // If template has artwork configuration, dynamically initialize canvas to match
  let doc = options?.documentSettings;
  if ((template as any).artwork_config) {
    doc = canvasManager.initializeArtwork((template as any).artwork_config);
  }

  // Load template into canvas using existing CanvasManager method
  await canvasManager.loadTemplate(template);

  const dims = canvasManager.getDimensions();

  return createArtworkPayloadFromCanvas(canvasManager, {
    productId: options?.productId,
    designTemplateId: template.id,
    name: template.title || (template as any).name || 'Template Artwork',
    documentSettings: doc || options?.documentSettings,
    dimensions: dims || options?.dimensions,
  });
}
