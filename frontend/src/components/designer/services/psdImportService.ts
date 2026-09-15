/**
 * PSD Import Service
 *
 * Provides client-side PSD parsing via dynamically imported ag-psd,
 * recursive layer tree normalization, unsupported feature detection/rasterization,
 * typography extraction, and batch asset uploading to Laravel storage.
 *
 * The PSD parser is strictly loaded in the browser and never runs during SSR.
 */

import { formatImageUrl } from '@/utils/imageUrl';

export interface ImportedPsdTextData {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic' | 'oblique';
  fill?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  charSpacing?: number;
}

export interface ImportedPsdLayer {
  id: string;
  name: string;
  type: 'image' | 'text' | 'group';
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  blendMode?: string;
  children?: ImportedPsdLayer[];
  imageBlob?: Blob;
  imageUrl?: string;
  text?: ImportedPsdTextData;
  psdRasterized?: boolean;
  psdRasterizeReason?: string;
  isUnsupported?: boolean;
  rawPsdLayerId?: number;
}

export interface ImportedPsdDocument {
  name: string;
  width: number;
  height: number;
  layers: ImportedPsdLayer[];
  totalLayers: number;
  editableTextCount: number;
  rasterCount: number;
  rasterizedCount: number;
  dpi?: number;
}

export interface PsdImportOptions {
  fitToArtwork?: boolean;
  clearCanvas?: boolean;
  maxSizeBytes?: number;
}

const SUPPORTED_CANVAS_BLEND_MODES: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  'pass through': 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color dodge': 'color-dodge',
  'color-dodge': 'color-dodge',
  'color burn': 'color-burn',
  'color-burn': 'color-burn',
  'hard light': 'hard-light',
  'hard-light': 'hard-light',
  'soft light': 'soft-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000/api/v1'
).replace(/\/+$/, '');

/** Converts an ag-psd color object to a standard hex or rgba string. */
function parsePsdColor(color: any): string {
  if (!color) return '#000000';
  if (typeof color === 'string') return color;

  if ('r' in color && 'g' in color && 'b' in color) {
    const r = Math.min(255, Math.max(0, Math.round(color.r)));
    const g = Math.min(255, Math.max(0, Math.round(color.g)));
    const b = Math.min(255, Math.max(0, Math.round(color.b)));
    if ('a' in color && typeof color.a === 'number' && color.a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${Number(color.a.toFixed(2))})`;
    }
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  if ('c' in color && 'm' in color && 'y' in color && 'k' in color) {
    // Approximate CMYK to RGB for canvas display
    const c = color.c / 100;
    const m = color.m / 100;
    const y = color.y / 100;
    const k = color.k / 100;
    const r = Math.round(255 * (1 - c) * (1 - k));
    const g = Math.round(255 * (1 - m) * (1 - k));
    const b = Math.round(255 * (1 - y) * (1 - k));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  if ('k' in color) {
    const v = Math.round(255 * (1 - color.k / 100));
    return `#${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}`;
  }

  return '#000000';
}

/** Converts an HTMLCanvasElement to a PNG Blob. */
async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  if (canvas.width <= 0 || canvas.height <= 0) return null;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

/** Returns a browser canvas for either ag-psd's canvas or imageData output. */
function getBitmapCanvas(source: any): HTMLCanvasElement | null {
  if (source?.canvas && typeof source.canvas.toBlob === 'function') {
    return source.canvas as HTMLCanvasElement;
  }

  const imageData = source?.imageData;
  if (!imageData?.data || !imageData.width || !imageData.height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const pixels = new Uint8ClampedArray(imageData.data);
  if (pixels.length !== imageData.width * imageData.height * 4) return null;
  ctx.putImageData(new ImageData(pixels, imageData.width, imageData.height), 0, 0);
  return canvas;
}

async function bitmapToBlob(source: any): Promise<Blob | undefined> {
  const canvas = getBitmapCanvas(source);
  return canvas ? (await canvasToBlob(canvas)) || undefined : undefined;
}

async function readApiError(response: Response): Promise<string> {
  const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  try {
    const body = await response.clone().json();
    const message = body?.message || body?.error || body?.errors?.image?.[0];
    return message ? `${status}: ${message}` : status;
  } catch {
    try {
      const text = (await response.text()).trim();
      return text ? `${status}: ${text.slice(0, 180)}` : status;
    } catch {
      return status;
    }
  }
}

/** Strips Photoshop internal font suffixes (e.g., Arial-BoldMT -> Arial). */
function cleanFontFamily(psdFontName?: string): string {
  if (!psdFontName) return 'Inter, sans-serif';
  const base = psdFontName
    .replace(/-(Regular|Roman|Bold|Italic|BoldItalic|Light|Medium|Black|SemiBold|MT|PSMT)$/i, '')
    .trim();
  return base || psdFontName;
}

/**
 * Checks if a layer possesses Photoshop features that cannot be represented natively
 * in Fabric vectors and therefore must be rasterized with high fidelity.
 */
function detectUnsupportedReasons(layer: any): string[] {
  const reasons: string[] = [];

  if (layer.placedLayer) {
    reasons.push('Smart Object');
  }
  if (layer.adjustment) {
    reasons.push('Adjustment layer');
  }
  if (layer.effects && Object.keys(layer.effects).length > 0) {
    reasons.push('Layer effects (shadows/glows/overlays)');
  }
  if (layer.mask || layer.realMask || layer.vectorMask) {
    reasons.push('Layer mask');
  }
  if (layer.clipping) {
    reasons.push('Clipping mask');
  }
  if (layer.filterMask || layer.filterEffectsMasks) {
    reasons.push('Photoshop filters');
  }
  if (layer.vectorStroke || layer.vectorFill) {
    reasons.push('Vector layer effects');
  }
  if (layer.blendMode && !(layer.blendMode in SUPPORTED_CANVAS_BLEND_MODES)) {
    reasons.push(`Unsupported blend mode (${layer.blendMode})`);
  }

  if (layer.text) {
    if (layer.text.warp && layer.text.warp.style && layer.text.warp.style !== 'warpNone') {
      reasons.push('Warped text');
    }
    if (layer.text.orientation === 'vertical') {
      reasons.push('Vertical text');
    }
    if (Array.isArray(layer.text.styleRuns) && layer.text.styleRuns.length > 1) {
      // Multiple disparate character styles across one text layer
      reasons.push('Multi-styled rich text');
    }
    if (layer.text.style?.outlineWidth && layer.text.style.outlineWidth > 0) {
      reasons.push('Text outline/stroke');
    }
  }

  return reasons;
}

/**
 * Dynamically imports ag-psd and parses a PSD file into an ImportedPsdDocument.
 */
export async function parsePsdFile(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string = 'Artwork.psd',
  options?: { maxSizeBytes?: number }
): Promise<ImportedPsdDocument> {
  if (typeof window === 'undefined') {
    throw new Error('PSD import can only be executed in a client browser environment.');
  }

  const maxSizeBytes = options?.maxSizeBytes ?? 50 * 1024 * 1024; // 50 MB default

  let arrayBuffer: ArrayBuffer;
  let name = fileName;

  if (fileOrBuffer instanceof File) {
    name = fileOrBuffer.name;
    if (fileOrBuffer.size > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
      throw new Error(`The PSD file exceeds the maximum allowed size of ${maxMb} MB.`);
    }

    const lowerName = fileOrBuffer.name.toLowerCase();
    if (lowerName.endsWith('.psb')) {
      throw new Error('PSB (Large Document Format) is not supported. Save the file as a standard .psd and try again.');
    }
    const isPsdExtension = lowerName.endsWith('.psd');
    const isPsdMime =
      fileOrBuffer.type === 'image/vnd.adobe.photoshop' ||
      fileOrBuffer.type === 'application/x-photoshop' ||
      fileOrBuffer.type === 'application/photoshop';

    if (!isPsdExtension && !isPsdMime && fileOrBuffer.type !== '') {
      throw new Error('Please select a valid Adobe Photoshop (.psd) file.');
    }

    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
    if (arrayBuffer.byteLength > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
      throw new Error(`The PSD file exceeds the maximum allowed size of ${maxMb} MB.`);
    }
  }

  // Verify PSD magic bytes ('8BPS')
  if (arrayBuffer.byteLength < 4) {
    throw new Error('The selected file is too small to be a valid PSD.');
  }
  const headerView = new DataView(arrayBuffer, 0, 4);
  const magic = String.fromCharCode(
    headerView.getUint8(0),
    headerView.getUint8(1),
    headerView.getUint8(2),
    headerView.getUint8(3)
  );
  if (magic !== '8BPS') {
    throw new Error('The file signature does not match Adobe Photoshop PSD format.');
  }

  // Header version 1 = PSD, version 2 = PSB. ag-psd does not support PSB.
  if (arrayBuffer.byteLength >= 6 && new DataView(arrayBuffer, 4, 2).getUint16(0) !== 1) {
    throw new Error('This is a PSB/unsupported Photoshop document. Save it as a standard .psd and try again.');
  }

  // Dynamically load ag-psd
  let readPsd: typeof import('ag-psd')['readPsd'];
  try {
    const imported: any = await import('ag-psd');
    // Handles both native ESM and CommonJS bundler output.
    readPsd = imported.readPsd || imported.default?.readPsd;
    if (typeof readPsd !== 'function') {
      throw new Error('readPsd export was not found');
    }
  } catch (err) {
    throw new Error('Failed to load the PSD parser engine. Make sure "ag-psd" is installed in the web application.');
  }

  let psdDoc: import('ag-psd').Psd;
  try {
    psdDoc = readPsd(arrayBuffer, {
      skipThumbnail: true,
      skipLinkedFilesData: true,
      totalMemoryLimit: 512 * 1024 * 1024,
    } as any);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('password') || errorMsg.includes('encrypt')) {
      throw new Error('Encrypted or password-protected PSD files are not supported.');
    }
    if (errorMsg.includes('ColorMode') || errorMsg.includes('color mode')) {
      throw new Error(`Unsupported PSD color mode: ${errorMsg}`);
    }
    throw new Error(`Could not read PSD file: ${errorMsg}`);
  }

  const docWidth = Math.max(1, Math.round(psdDoc.width || 100));
  const docHeight = Math.max(1, Math.round(psdDoc.height || 100));
  if (docWidth > 12000 || docHeight > 12000 || docWidth * docHeight > 80_000_000) {
    throw new Error(`PSD canvas is too large (${docWidth} × ${docHeight}px). Maximum supported size is 12,000px per side and 80 megapixels.`);
  }

  let totalLayers = 0;
  let editableTextCount = 0;
  let rasterCount = 0;
  let rasterizedCount = 0;

  let layerCounter = 0;

  async function processLayerTree(layers: import('ag-psd').Layer[]): Promise<ImportedPsdLayer[]> {
    const result: ImportedPsdLayer[] = [];

    for (let i = 0; i < layers.length; i++) {
      const raw = layers[i];
      layerCounter++;
      totalLayers++;
      if (totalLayers > 500) {
        throw new Error('This PSD contains more than 500 layers. Merge some layers in Photoshop and try again.');
      }

      const layerId = `psd_layer_${layerCounter}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const layerName = String(raw.name || `Layer ${layerCounter}`).trim() || `Layer ${layerCounter}`;
      const isVisible = raw.hidden !== true;
      const opacity = typeof raw.opacity === 'number' ? Math.max(0, Math.min(1, raw.opacity)) : 1;
      const blendMode = raw.blendMode || 'normal';

      const left = typeof raw.left === 'number' ? raw.left : 0;
      const top = typeof raw.top === 'number' ? raw.top : 0;
      const right = typeof raw.right === 'number' ? raw.right : left;
      const bottom = typeof raw.bottom === 'number' ? raw.bottom : top;
      const width = Math.max(1, right - left);
      const height = Math.max(1, bottom - top);

      const unsupportedReasons = detectUnsupportedReasons(raw);
      const isUnsupported = unsupportedReasons.length > 0;

      // Group Layer
      if (Array.isArray(raw.children) && raw.children.length > 0) {
        const processedChildren = await processLayerTree(raw.children);
        result.push({
          id: layerId,
          name: layerName,
          type: 'group',
          left,
          top,
          width,
          height,
          opacity,
          visible: isVisible,
          blendMode,
          children: processedChildren,
          isUnsupported,
          psdRasterized: false,
        });
        continue;
      }

      // Text Layer
      if (raw.text && raw.text.text) {
        if (isUnsupported) {
          // Rasterize text due to unsupported warp, vertical, effects, etc.
          const bitmapCanvas = getBitmapCanvas(raw);
          const imageBlob = await bitmapToBlob(raw);

          rasterizedCount++;
          result.push({
            id: layerId,
            name: layerName,
            type: 'image',
            left,
            top,
            width: bitmapCanvas?.width || width,
            height: bitmapCanvas?.height || height,
            opacity,
            visible: isVisible,
            blendMode,
            imageBlob,
            psdRasterized: true,
            psdRasterizeReason: `Text rasterized: ${unsupportedReasons.join(', ')}`,
            isUnsupported: true,
          });
        } else {
          // Supported Editable Text
          const style = raw.text.style || {};
          const paragraph = raw.text.paragraphStyle || {};

          let transformScale = 1;
          if (Array.isArray(raw.text.transform) && raw.text.transform.length >= 4) {
            const [xx, xy] = raw.text.transform;
            transformScale = Math.hypot(xx, xy) || 1;
          }

          const rawFontSize = style.fontSize || 16;
          const effectiveFontSize = Math.max(6, Math.round(rawFontSize * transformScale));

          const textData: ImportedPsdTextData = {
            text: raw.text.text,
            fontSize: effectiveFontSize,
            fontFamily: cleanFontFamily(style.font?.name),
            fontWeight: style.fauxBold ? 'bold' : 'normal',
            fontStyle: style.fauxItalic ? 'italic' : 'normal',
            fill: parsePsdColor(style.fillColor),
            textAlign: (paragraph.justification as any) || 'left',
          };

          editableTextCount++;
          result.push({
            id: layerId,
            name: layerName,
            type: 'text',
            left,
            top,
            width,
            height,
            opacity,
            visible: isVisible,
            blendMode,
            text: textData,
            psdRasterized: false,
          });
        }
        continue;
      }

      // Raster / Image Layer (or Smart Object / Adjustment raster)
      const bitmapCanvas = getBitmapCanvas(raw);
      const imageBlob = await bitmapToBlob(raw);

      const isRasterizedFeature = isUnsupported;
      if (isRasterizedFeature) {
        rasterizedCount++;
      } else {
        rasterCount++;
      }

      result.push({
        id: layerId,
        name: layerName,
        type: 'image',
        left,
        top,
        width: bitmapCanvas?.width || width,
        height: bitmapCanvas?.height || height,
        opacity,
        visible: isVisible,
        blendMode,
        imageBlob,
        psdRasterized: isRasterizedFeature,
        psdRasterizeReason: isRasterizedFeature
          ? `Rasterized: ${unsupportedReasons.join(', ')}`
          : undefined,
        isUnsupported: isRasterizedFeature,
      });
    }

    return result;
  }

  let layers = await processLayerTree(psdDoc.children || []);

  // Flattened PSDs may not expose child layers. Import their composite bitmap
  // instead of opening an empty confirmation dialog.
  if (layers.length === 0) {
    const compositeCanvas = getBitmapCanvas(psdDoc);
    const compositeBlob = await bitmapToBlob(psdDoc);
    if (!compositeCanvas || !compositeBlob) {
      throw new Error('The PSD contains no readable layers or composite artwork. Re-save it in Photoshop with compatibility mode enabled.');
    }

    totalLayers = 1;
    rasterCount = 0;
    rasterizedCount = 1;
    layers = [{
      id: `psd_composite_${Date.now().toString(36)}`,
      name: 'PSD Composite',
      type: 'image',
      left: 0,
      top: 0,
      width: compositeCanvas.width || docWidth,
      height: compositeCanvas.height || docHeight,
      opacity: 1,
      visible: true,
      blendMode: 'normal',
      imageBlob: compositeBlob,
      psdRasterized: true,
      psdRasterizeReason: 'Flattened PSD composite',
    }];
  }

  const resolution = psdDoc.imageResources?.resolutionInfo?.horizontalResolution;
  const dpi = resolution && Number(resolution) > 0 ? Math.round(resolution) : 300;

  return {
    name,
    width: docWidth,
    height: docHeight,
    layers,
    totalLayers,
    editableTextCount,
    rasterCount,
    rasterizedCount,
    dpi,
  };
}

/**
 * Uploads all extracted raster Blobs to Laravel API storage and assigns permanent URLs.
 * Never stores blob: or base64 data URLs in Fabric canvas JSON.
 */
export async function uploadPsdLayerAssets(
  document: ImportedPsdDocument,
  onProgress?: (current: number, total: number) => void
): Promise<ImportedPsdDocument> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token')
      : null;

  // Flatten layers to find all blobs needing upload
  const blobLayers: ImportedPsdLayer[] = [];
  function collectBlobLayers(layers: ImportedPsdLayer[]) {
    for (const l of layers) {
      if (l.type === 'image' && l.imageBlob && !l.imageUrl) {
        blobLayers.push(l);
      }
      if (l.children) {
        collectBlobLayers(l.children);
      }
    }
  }
  collectBlobLayers(document.layers);

  const firstImageLayer = (() => {
    let imageLayer: ImportedPsdLayer | undefined;
    const visit = (layers: ImportedPsdLayer[]) => {
      for (const layer of layers) {
        if (layer.type === 'image') {
          imageLayer = layer;
          return;
        }
        if (layer.children) visit(layer.children);
        if (imageLayer) return;
      }
    };
    visit(document.layers);
    return imageLayer;
  })();
  if (firstImageLayer && blobLayers.length === 0) {
    throw new Error(`PSD layer "${firstImageLayer.name}" has no readable pixels. Re-save the PSD with "Maximize Compatibility" enabled.`);
  }

  const total = blobLayers.length;
  let current = 0;

  for (const layer of blobLayers) {
    if (!layer.imageBlob) continue;

    const file = new File(
      [layer.imageBlob],
      `${layer.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'layer'}.png`,
      { type: 'image/png' }
    );

    const formData = new FormData();
    formData.append('image', file);
    formData.append('psd_document_name', document.name);
    formData.append('layer_name', layer.name);
    formData.append('layer_id', layer.id);

    let permanentUrl: string | null = null;
    const uploadErrors: string[] = [];

    // Try authenticated psd-assets endpoint first
    try {
      const response = await fetch(`${API_URL}/designer/psd-assets`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (response.ok) {
        const json = await response.json();
        permanentUrl = json?.data?.file_url || json?.data?.url || null;
        if (!permanentUrl) uploadErrors.push('PSD asset endpoint returned no file URL');
      } else {
        uploadErrors.push(`PSD asset endpoint ${await readApiError(response)}`);
      }
    } catch (error: any) {
      uploadErrors.push(`PSD asset endpoint: ${error?.message || 'network error'}`);
    }

    // Fallback to canvas-image endpoint (supports guest sessions)
    if (!permanentUrl) {
      const fallbackFormData = new FormData();
      fallbackFormData.append('image', file);
      fallbackFormData.append('source_provider', 'psd-import');
      fallbackFormData.append('source_provider_asset_id', layer.id);

      try {
        const fallbackRes = await fetch(`${API_URL}/designer/uploads/canvas-image`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: fallbackFormData,
        });

        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json();
          permanentUrl = fallbackJson?.data?.file_url || fallbackJson?.data?.url || null;
          if (!permanentUrl) uploadErrors.push('Fallback endpoint returned no file URL');
        } else {
          uploadErrors.push(`Fallback endpoint ${await readApiError(fallbackRes)}`);
        }
      } catch (error: any) {
        uploadErrors.push(`Fallback endpoint: ${error?.message || 'network error'}`);
      }
    }

    if (!permanentUrl) {
      throw new Error(`Failed to upload PSD layer "${layer.name}". ${uploadErrors.join(' | ')}`);
    }

    layer.imageUrl = formatImageUrl(permanentUrl);
    // Release memory
    layer.imageBlob = undefined;

    current++;
    if (onProgress) {
      onProgress(current, total);
    }
  }

  return document;
}
