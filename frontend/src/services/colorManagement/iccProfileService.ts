import { PrintColorProfile } from './types';

export const STANDARD_PRINT_PROFILES: PrintColorProfile[] = [
  {
    id: 'fogra39',
    name: 'Coated FOGRA39',
    url: '/icc/CoatedFOGRA39.icc',
    colorSpace: 'CMYK',
    description: 'ISO 12647-2:2004 Coated offset printing (Europe standard)',
    standard: 'ISO 12647-2',
    totalAreaCoverage: 330,
  },
  {
    id: 'swop',
    name: 'U.S. Web Coated (SWOP) v2',
    url: '/icc/SWOP.icc',
    colorSpace: 'CMYK',
    description: 'Standard publication web offset printing (North America)',
    standard: 'SWOP 2006',
    totalAreaCoverage: 300,
  },
  {
    id: 'gracol',
    name: 'GRACoL 2006 Coated 1v2',
    url: '/icc/GRACoL.icc',
    colorSpace: 'CMYK',
    description: 'Commercial sheetfed offset printing on premium coated paper (North America)',
    standard: 'ISO 12647-2 / GRACoL',
    totalAreaCoverage: 340,
  },
  {
    id: 'psocoated_v3',
    name: 'PSO Coated v3 (FOGRA51)',
    url: '/icc/PSOcoated_v3.icc',
    colorSpace: 'CMYK',
    description: 'ISO 12647-2:2013 Premium coated paper with optical brighteners (Europe)',
    standard: 'ISO 12647-2:2013',
    totalAreaCoverage: 300,
  },
];

export const SOURCE_SRGB_PROFILE = {
  id: 'srgb',
  name: 'sRGB IEC61966-2.1',
  url: '/icc/sRGB.icc',
  colorSpace: 'RGB',
  description: 'Standard monitor RGB display color space',
};

class IccProfileService {
  private profiles: Map<string, PrintColorProfile> = new Map();
  private profileBytesCache: Map<string, Uint8Array> = new Map();
  private defaultProfileId: string = 'fogra39';

  constructor() {
    STANDARD_PRINT_PROFILES.forEach((p) => this.profiles.set(p.id, p));

    // Resolve environment default profile if defined
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DEFAULT_PRINT_PROFILE) {
      const envUrl = process.env.NEXT_PUBLIC_DEFAULT_PRINT_PROFILE.trim();
      const matched = STANDARD_PRINT_PROFILES.find(
        (p) => p.url === envUrl || p.id === envUrl || p.url.endsWith(envUrl)
      );
      if (matched) {
        this.defaultProfileId = matched.id;
      }
    }
  }

  public getAllProfiles(): PrintColorProfile[] {
    return Array.from(this.profiles.values());
  }

  public getProfile(idOrUrl?: string): PrintColorProfile {
    if (!idOrUrl) {
      return this.profiles.get(this.defaultProfileId) || STANDARD_PRINT_PROFILES[0];
    }
    const normalized = idOrUrl.toLowerCase().trim();
    const found =
      this.profiles.get(normalized) ||
      Array.from(this.profiles.values()).find(
        (p) =>
          p.id.toLowerCase() === normalized ||
          p.url.toLowerCase() === normalized ||
          p.name.toLowerCase() === normalized ||
          p.url.toLowerCase().endsWith(normalized)
      );
    return found || this.profiles.get(this.defaultProfileId) || STANDARD_PRINT_PROFILES[0];
  }

  public registerProfile(profile: PrintColorProfile): void {
    this.profiles.set(profile.id, profile);
  }

  public setDefaultProfileId(id: string): void {
    if (this.profiles.has(id)) {
      this.defaultProfileId = id;
    }
  }

  public getDefaultProfileId(): string {
    return this.defaultProfileId;
  }

  /**
   * Fetch profile bytes by URL or ID, caching results in memory so profiles are downloaded only once.
   */
  public async getProfileBytes(idOrUrl: string): Promise<Uint8Array> {
    const profile = this.getProfile(idOrUrl);
    const url = profile ? profile.url : idOrUrl;

    if (this.profileBytesCache.has(url)) {
      return this.profileBytesCache.get(url)!;
    }

    try {
      let arrayBuffer: ArrayBuffer;
      if (typeof window !== 'undefined') {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) {
          throw new Error(`Failed to load ICC profile from ${url}: ${res.statusText}`);
        }
        arrayBuffer = await res.arrayBuffer();
      } else {
        // Node.js environment
        const fs = await import('fs');
        const path = await import('path');
        const localPath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
        const buf = fs.readFileSync(localPath);
        arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      }

      const bytes = new Uint8Array(arrayBuffer);
      this.profileBytesCache.set(url, bytes);
      return bytes;
    } catch (err) {
      console.warn(`[IccProfileService] Could not load ICC profile from ${url}:`, err);
      throw err;
    }
  }

  public async getSourceSrgbBytes(): Promise<Uint8Array> {
    const url = SOURCE_SRGB_PROFILE.url;
    if (this.profileBytesCache.has(url)) {
      return this.profileBytesCache.get(url)!;
    }
    return this.getProfileBytes(url);
  }
}

export const iccProfileService = new IccProfileService();
