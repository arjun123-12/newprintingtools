import { RGBColor, CMYKColor, DEFAULT_PURE_BLACK, DEFAULT_RICH_BLACK } from './types';
import { iccProfileService } from './iccProfileService';

// Fallback mathematical RGB <-> CMYK formulas for explicitly marked fallback preview only
function fallbackRgbToCmyk(r: number, g: number, b: number): CMYKColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 0.999) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = Math.round(((1 - rn - k) / (1 - k)) * 100);
  const m = Math.round(((1 - gn - k) / (1 - k)) * 100);
  const y = Math.round(((1 - bn - k) / (1 - k)) * 100);
  const kPct = Math.round(k * 100);

  return {
    c: Math.max(0, Math.min(100, c)),
    m: Math.max(0, Math.min(100, m)),
    y: Math.max(0, Math.min(100, y)),
    k: Math.max(0, Math.min(100, kPct)),
  };
}

function fallbackCmykToRgb(cmyk: CMYKColor): RGBColor {
  const c = cmyk.c / 100;
  const m = cmyk.m / 100;
  const y = cmyk.y / 100;
  const k = cmyk.k / 100;

  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));

  return {
    r: Math.max(0, Math.min(255, r)),
    g: Math.max(0, Math.min(255, g)),
    b: Math.max(0, Math.min(255, b)),
  };
}

export function hexToRgb(hex: string): RGBColor {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((char) => char + char).join('');
  }
  const int = parseInt(clean, 16);
  if (isNaN(int)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (c: number) => clamp(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

interface LcmsTransformPair {
  rgbToCmyk: any;
  cmykToRgb: any;
  softProof: any;
}

class ColorConversionService {
  private isInitialized = false;
  private isInitializing = false;
  private fallbackMode = false;
  private lcmsModule: any = null;
  private formats: any = null;

  private srgbProfileHandle: any = null;
  private profileHandles: Map<string, any> = new Map();
  private transforms: Map<string, LcmsTransformPair> = new Map();

  // Cache: unique colors converted once
  private rgbToCmykCache: Map<string, CMYKColor> = new Map();
  private cmykToRgbCache: Map<string, RGBColor> = new Map();
  private softProofCache: Map<string, string> = new Map();

  /**
   * Initialize LittleCMS WASM engine once.
   */
  public async init(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return this.isInitialized;
    }

    this.isInitializing = true;
    try {
      // Dynamic import of @kittl/little-cms
      const lcms = await import('@kittl/little-cms');
      const formats = await import('@kittl/little-cms/formats');
      this.lcmsModule = lcms;
      this.formats = formats;

      // Locate WASM file
      let wasmPath = '/lcms.wasm';
      if (typeof window === 'undefined') {
        const path = await import('path');
        wasmPath = path.join(process.cwd(), 'public', 'lcms.wasm');
      }

      const initResult = await lcms.initWasm(wasmPath);
      if (initResult && initResult.error) {
        console.warn('[ColorConversionService] LittleCMS init error, using fallback:', initResult.error);
        this.fallbackMode = true;
      } else {
        const srgbRes = lcms.cmsCreate_sRGBProfile();
        if (srgbRes && !srgbRes.error && srgbRes.value) {
          this.srgbProfileHandle = srgbRes.value;
        } else {
          // Fallback to loading sRGB.icc from disk
          const srgbBytes = await iccProfileService.getSourceSrgbBytes();
          const loadedRes = lcms.cmsOpenProfileFromMem(srgbBytes);
          if (loadedRes && !loadedRes.error) {
            this.srgbProfileHandle = loadedRes.value;
          }
        }
        this.fallbackMode = false;
        this.isInitialized = true;
      }
    } catch (err) {
      console.warn('[ColorConversionService] Failed to load LittleCMS WASM, using fallback mode:', err);
      this.fallbackMode = true;
    } finally {
      this.isInitializing = false;
    }

    return !this.fallbackMode;
  }

  public isReady(): boolean {
    return this.isInitialized && !this.fallbackMode;
  }

  public isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  /**
   * Get or instantiate LittleCMS transform pair for the specified profile.
   */
  private async getTransformsForProfile(profileId?: string): Promise<LcmsTransformPair | null> {
    const targetId = profileId || iccProfileService.getDefaultProfileId();
    if (this.transforms.has(targetId)) {
      return this.transforms.get(targetId)!;
    }

    await this.init();
    if (this.fallbackMode || !this.lcmsModule || !this.formats) {
      return null;
    }

    try {
      let cmykProfile = this.profileHandles.get(targetId);
      if (!cmykProfile) {
        const profileBytes = await iccProfileService.getProfileBytes(targetId);
        const openRes = this.lcmsModule.cmsOpenProfileFromMem(profileBytes);
        if (openRes && !openRes.error && openRes.value) {
          cmykProfile = openRes.value;
          this.profileHandles.set(targetId, cmykProfile);
        } else {
          console.warn(`[ColorConversionService] Failed to open profile ${targetId}:`, openRes?.error);
          return null;
        }
      }

      const { cmsCreateTransform, CmsIntent } = this.lcmsModule;
      const { TYPE_RGB_8, TYPE_CMYK_8, TYPE_RGBA_8 } = this.formats;

      // 1. RGB -> CMYK transform (Perceptual intent)
      const rgbToCmykRes = cmsCreateTransform(
        this.srgbProfileHandle,
        TYPE_RGB_8,
        cmykProfile,
        TYPE_CMYK_8,
        CmsIntent.Percepttual,
        0
      );

      // 2. CMYK -> RGB transform (Perceptual intent)
      const cmykToRgbRes = cmsCreateTransform(
        cmykProfile,
        TYPE_CMYK_8,
        this.srgbProfileHandle,
        TYPE_RGB_8,
        CmsIntent.Percepttual,
        0
      );

      // 3. Soft-Proof direct transform: sRGB -> CMYK ICC -> simulated display sRGB
      // We create a proofing transform or chain rgb->cmyk->rgb
      const pair: LcmsTransformPair = {
        rgbToCmyk: rgbToCmykRes?.value,
        cmykToRgb: cmykToRgbRes?.value,
        softProof: null,
      };

      this.transforms.set(targetId, pair);
      return pair;
    } catch (err) {
      console.warn(`[ColorConversionService] Error building transforms for ${targetId}:`, err);
      return null;
    }
  }

  /**
   * Convert RGB to CMYK with ICC profile (with unique color caching).
   */
  public async rgbToCmykWithIcc(rgb: RGBColor, profileId?: string): Promise<CMYKColor> {
    const targetId = profileId || iccProfileService.getDefaultProfileId();
    const cacheKey = `${targetId}_${rgb.r}_${rgb.g}_${rgb.b}`;

    if (this.rgbToCmykCache.has(cacheKey)) {
      return this.rgbToCmykCache.get(cacheKey)!;
    }

    // Pure black exception: pure black text or RGB 0,0,0
    if (rgb.r === 0 && rgb.g === 0 && rgb.b === 0) {
      const pureK = { ...DEFAULT_PURE_BLACK };
      this.rgbToCmykCache.set(cacheKey, pureK);
      return pureK;
    }

    const transforms = await this.getTransformsForProfile(targetId);
    if (!transforms || !transforms.rgbToCmyk || !this.lcmsModule) {
      const fb = fallbackRgbToCmyk(rgb.r, rgb.g, rgb.b);
      this.rgbToCmykCache.set(cacheKey, fb);
      return fb;
    }

    try {
      const input = new Uint8Array([rgb.r, rgb.g, rgb.b]);
      const res = this.lcmsModule.cmsDoTransform(transforms.rgbToCmyk, input, 1);
      if (res && !res.error && res.value) {
        const out = res.value;
        const cmyk: CMYKColor = {
          c: Math.round((out[0] / 255) * 100),
          m: Math.round((out[1] / 255) * 100),
          y: Math.round((out[2] / 255) * 100),
          k: Math.round((out[3] / 255) * 100),
        };
        this.rgbToCmykCache.set(cacheKey, cmyk);
        return cmyk;
      }
    } catch (e) {
      console.warn('[ColorConversionService] Transform execution error:', e);
    }

    const fallback = fallbackRgbToCmyk(rgb.r, rgb.g, rgb.b);
    this.rgbToCmykCache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * Convert CMYK to display RGB through ICC profile (with unique color caching).
   */
  public async cmykToRgbWithIcc(cmyk: CMYKColor, profileId?: string): Promise<RGBColor> {
    const targetId = profileId || iccProfileService.getDefaultProfileId();
    const c = Math.max(0, Math.min(100, Math.round(cmyk.c)));
    const m = Math.max(0, Math.min(100, Math.round(cmyk.m)));
    const y = Math.max(0, Math.min(100, Math.round(cmyk.y)));
    const k = Math.max(0, Math.min(100, Math.round(cmyk.k)));
    const cacheKey = `${targetId}_${c}_${m}_${y}_${k}`;

    if (this.cmykToRgbCache.has(cacheKey)) {
      return this.cmykToRgbCache.get(cacheKey)!;
    }

    const transforms = await this.getTransformsForProfile(targetId);
    if (!transforms || !transforms.cmykToRgb || !this.lcmsModule) {
      const fb = fallbackCmykToRgb({ c, m, y, k });
      this.cmykToRgbCache.set(cacheKey, fb);
      return fb;
    }

    try {
      const input = new Uint8Array([
        Math.round((c / 100) * 255),
        Math.round((m / 100) * 255),
        Math.round((y / 100) * 255),
        Math.round((k / 100) * 255),
      ]);
      const res = this.lcmsModule.cmsDoTransform(transforms.cmykToRgb, input, 1);
      if (res && !res.error && res.value) {
        const out = res.value;
        const rgb: RGBColor = {
          r: out[0],
          g: out[1],
          b: out[2],
        };
        this.cmykToRgbCache.set(cacheKey, rgb);
        return rgb;
      }
    } catch (e) {
      console.warn('[ColorConversionService] CMYK->RGB transform error:', e);
    }

    const fallback = fallbackCmykToRgb({ c, m, y, k });
    this.cmykToRgbCache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * Convert HEX to CMYK using ICC profile.
   */
  public async hexToCmykWithIcc(hex: string, profileId?: string): Promise<CMYKColor> {
    const rgb = hexToRgb(hex);
    return this.rgbToCmykWithIcc(rgb, profileId);
  }

  /**
   * Convert CMYK to preview display HEX string.
   */
  public async cmykToHexPreview(cmyk: CMYKColor, profileId?: string): Promise<string> {
    const rgb = await this.cmykToRgbWithIcc(cmyk, profileId);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Soft Proof RGB color: Source RGB -> CMYK ICC -> Proof display RGB.
   */
  public async softProofRgb(rgb: RGBColor, profileId?: string): Promise<RGBColor> {
    const cmyk = await this.rgbToCmykWithIcc(rgb, profileId);
    return this.cmykToRgbWithIcc(cmyk, profileId);
  }

  /**
   * Soft Proof HEX color string (Cached per profile + source color).
   */
  public async softProofHex(hex: string, profileId?: string): Promise<string> {
    const targetId = profileId || iccProfileService.getDefaultProfileId();
    const clean = hex.toUpperCase().trim();
    const cacheKey = `${targetId}_${clean}`;

    if (this.softProofCache.has(cacheKey)) {
      return this.softProofCache.get(cacheKey)!;
    }

    const rgb = hexToRgb(clean);
    const proofRgb = await this.softProofRgb(rgb, targetId);
    const proofHex = rgbToHex(proofRgb.r, proofRgb.g, proofRgb.b);

    this.softProofCache.set(cacheKey, proofHex);
    return proofHex;
  }

  /**
   * Batch transform image pixel data (RGBA) for non-destructive soft proof simulation.
   */
  public async transformPixelsRgbaToSoftProof(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    profileId?: string
  ): Promise<Uint8ClampedArray> {
    const totalPixels = width * height;
    const outPixels = new Uint8ClampedArray(pixels.length);
    const targetId = profileId || iccProfileService.getDefaultProfileId();

    // Cache lookup for repeat pixels
    const pixelCache = new Map<number, [number, number, number]>();

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];

      if (a === 0) {
        outPixels[idx] = r;
        outPixels[idx + 1] = g;
        outPixels[idx + 2] = b;
        outPixels[idx + 3] = 0;
        continue;
      }

      const key = (r << 16) | (g << 8) | b;
      let proof: [number, number, number];

      if (pixelCache.has(key)) {
        proof = pixelCache.get(key)!;
      } else {
        const rgb: RGBColor = { r, g, b };
        // Use synchronous or cached lookup
        const cKey = `${targetId}_${r}_${g}_${b}`;
        let cmyk = this.rgbToCmykCache.get(cKey);
        if (!cmyk) {
          cmyk = await this.rgbToCmykWithIcc(rgb, targetId);
        }
        const proofRgb = await this.cmykToRgbWithIcc(cmyk, targetId);
        proof = [proofRgb.r, proofRgb.g, proofRgb.b];
        pixelCache.set(key, proof);
      }

      outPixels[idx] = proof[0];
      outPixels[idx + 1] = proof[1];
      outPixels[idx + 2] = proof[2];
      outPixels[idx + 3] = a;
    }

    return outPixels;
  }

  /**
   * Transform an RGBA buffer to true 4-channel CMYK pixel bytes (for CMYK TIFF / CMYK JPEG export).
   * Returns Uint8Array of length (count * 4) with bytes: [C, M, Y, K, C, M, Y, K, ...] (0-255).
   */
  public async transformPixelsRgbToCmyk(
    pixels: Uint8ClampedArray | Uint8Array,
    count: number,
    profileId?: string
  ): Promise<Uint8Array> {
    const targetId = profileId || iccProfileService.getDefaultProfileId();
    const cmykBuffer = new Uint8Array(count * 4);
    const pixelCache = new Map<number, [number, number, number, number]>();

    for (let i = 0; i < count; i++) {
      const idx = i * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const key = (r << 16) | (g << 8) | b;
      let cmykBytes: [number, number, number, number];

      if (pixelCache.has(key)) {
        cmykBytes = pixelCache.get(key)!;
      } else {
        const cmyk = await this.rgbToCmykWithIcc({ r, g, b }, targetId);
        cmykBytes = [
          Math.max(0, Math.min(255, Math.round((cmyk.c / 100) * 255))),
          Math.max(0, Math.min(255, Math.round((cmyk.m / 100) * 255))),
          Math.max(0, Math.min(255, Math.round((cmyk.y / 100) * 255))),
          Math.max(0, Math.min(255, Math.round((cmyk.k / 100) * 255))),
        ];
        pixelCache.set(key, cmykBytes);
      }

      const outIdx = i * 4;
      cmykBuffer[outIdx] = cmykBytes[0];
      cmykBuffer[outIdx + 1] = cmykBytes[1];
      cmykBuffer[outIdx + 2] = cmykBytes[2];
      cmykBuffer[outIdx + 3] = cmykBytes[3];
    }

    return cmykBuffer;
  }
}

export const colorConversionService = new ColorConversionService();
