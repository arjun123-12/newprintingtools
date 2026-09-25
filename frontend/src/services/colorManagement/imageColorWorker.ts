import { colorConversionService } from './colorConversionService';
import { iccProfileService } from './iccProfileService';

/**
 * Service for caching and generating non-blocking raster image soft-proofing.
 */
class ImageColorWorker {
  // Cache of soft proof data URLs keyed by `${imgKey}_${profileId}`
  private cache: Map<string, string> = new Map();
  private inFlightPromises: Map<string, Promise<string>> = new Map();

  /**
   * Get or generate a soft-proof simulated data URL for an image.
   * Runs in non-blocking chunks so the main UI thread stays 60fps responsive.
   */
  public async getSoftProofImageUrl(
    imgElement: HTMLImageElement | HTMLCanvasElement,
    originalSrcKey: string,
    profileId?: string
  ): Promise<string> {
    const targetProfile = profileId || iccProfileService.getDefaultProfileId();
    const cacheKey = `${originalSrcKey}_${targetProfile}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (this.inFlightPromises.has(cacheKey)) {
      return this.inFlightPromises.get(cacheKey)!;
    }

    const task = this.processImage(imgElement, targetProfile);
    this.inFlightPromises.set(cacheKey, task);

    try {
      const resultDataUrl = await task;
      this.cache.set(cacheKey, resultDataUrl);
      return resultDataUrl;
    } finally {
      this.inFlightPromises.delete(cacheKey);
    }
  }

  private async processImage(
    img: HTMLImageElement | HTMLCanvasElement,
    profileId: string
  ): Promise<string> {
    const naturalW = 'naturalWidth' in img ? img.naturalWidth : img.width;
    const naturalH = 'naturalHeight' in img ? img.naturalHeight : img.height;

    const width = Math.max(1, naturalW || 100);
    const height = Math.max(1, naturalH || 100);

    // Limit proof preview resolution to max 1600px edge for ultra-fast rendering
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';

    ctx.drawImage(img, 0, 0, targetW, targetH);
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const pixels = imageData.data;

    // Process soft proof pixels using ColorConversionService
    const transformed = await colorConversionService.transformPixelsRgbaToSoftProof(
      pixels,
      targetW,
      targetH,
      profileId
    );

    // Put transformed pixels back
    imageData.data.set(transformed);
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/png');
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const imageColorWorker = new ImageColorWorker();
