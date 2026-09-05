/**
 * Centralized Artwork Configuration & Format Helpers for Admin Panel
 */

export const SUPPORTED_ARTWORK_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'svg',
  'pdf',
  'tif',
  'tiff',
  'webp',
] as const;

export type SupportedArtworkExtension =
  (typeof SUPPORTED_ARTWORK_EXTENSIONS)[number];

export const DEFAULT_ACCEPTED_ARTWORK: SupportedArtworkExtension[] = [
  'jpg',
  'jpeg',
  'png',
  'svg',
  'pdf',
  'tif',
  'tiff',
];

export const ARTWORK_EXT_LABEL = 'JPG, PNG, SVG, PDF, TIF, TIFF';

export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const MIME_MAP: Record<string, string[]> = {
  jpg: ['image/jpeg', 'image/jpg'],
  jpeg: ['image/jpeg', 'image/jpg'],
  png: ['image/png'],
  svg: ['image/svg+xml'],
  pdf: ['application/pdf'],
  tif: ['image/tiff', 'image/x-tiff'],
  tiff: ['image/tiff', 'image/x-tiff'],
  webp: ['image/webp'],
};

/**
 * Format the HTML input `accept` attribute based on accepted extensions
 */
export function formatArtworkAcceptAttribute(
  allowed: readonly string[] = DEFAULT_ACCEPTED_ARTWORK
): string {
  const parts = new Set<string>();

  allowed.forEach((ext) => {
    const clean = ext.toLowerCase().replace(/^\./, '');
    parts.add(`.${clean}`);
    const mimes = MIME_MAP[clean];
    if (mimes) {
      mimes.forEach((m) => parts.add(m));
    }
  });

  return Array.from(parts).join(',');
}

/**
 * Extract clean lowercase file extension from a File or URL string
 */
export function getArtworkFileType(fileOrUrl: string | File): string {
  if (typeof fileOrUrl !== 'string') {
    const name = fileOrUrl.name || '';
    const match = name.match(/\.([a-zA-Z0-9]+)$/);
    if (match) return match[1].toLowerCase();

    if (fileOrUrl.type) {
      if (fileOrUrl.type.includes('pdf')) return 'pdf';
      if (fileOrUrl.type.includes('svg')) return 'svg';
      if (fileOrUrl.type.includes('tiff') || fileOrUrl.type.includes('tif'))
        return 'tif';
      if (fileOrUrl.type.includes('png')) return 'png';
      if (fileOrUrl.type.includes('jpeg') || fileOrUrl.type.includes('jpg'))
        return 'jpg';
      if (fileOrUrl.type.includes('webp')) return 'webp';
    }
    return '';
  }

  // String URL or Data URL
  if (fileOrUrl.startsWith('data:')) {
    if (fileOrUrl.startsWith('data:image/svg+xml')) return 'svg';
    if (fileOrUrl.startsWith('data:application/pdf')) return 'pdf';
    if (fileOrUrl.startsWith('data:image/tiff') || fileOrUrl.startsWith('data:image/x-tiff')) return 'tif';
    if (fileOrUrl.startsWith('data:image/png')) return 'png';
    if (fileOrUrl.startsWith('data:image/jpeg') || fileOrUrl.startsWith('data:image/jpg')) return 'jpg';
    if (fileOrUrl.startsWith('data:image/webp')) return 'webp';
  }

  try {
    const cleanUrl = fileOrUrl.split('?')[0].split('#')[0];
    const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : '';
  } catch {
    return '';
  }
}

/**
 * Validate whether a given File matches the allowed artwork extensions
 */
export function isSupportedArtworkFile(
  file: File,
  allowed: readonly string[] = DEFAULT_ACCEPTED_ARTWORK
): boolean {
  const ext = getArtworkFileType(file);
  const normalizedAllowed = allowed.map((a) => a.toLowerCase().replace(/^\./, ''));
  if (ext && normalizedAllowed.includes(ext)) {
    return true;
  }

  // Also check MIME types
  return normalizedAllowed.some((allowedExt) => {
    const mimes = MIME_MAP[allowedExt];
    return mimes && mimes.includes(file.type);
  });
}

/**
 * Format bytes to readable string (e.g. 2.4 MB)
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generates an image preview Data URL for any artwork File:
 * - JPG / PNG / WebP: instant FileReader Data URL
 * - SVG: normalized via svgNormalizer
 * - PDF: renders page 1 via pdf.js to high-DPI canvas
 * - TIF / TIFF: decodes via server convert API or UTIF
 */
export async function generateArtworkPreview(file: File): Promise<string> {
  const ext = getArtworkFileType(file);

  // 1. SVG: Normalize viewBox & explicit dimensions
  if (ext === 'svg') {
    try {
      const { normalizeSvgFile } = await import('@/utils/svgNormalizer');
      const norm = await normalizeSvgFile(file);
      return norm.dataUrl;
    } catch {
      return readAsDataUrl(file);
    }
  }

  // 2. PDF: First-page rendering via pdf.js
  if (ext === 'pdf') {
    try {
      return await renderPdfPagePreview(file);
    } catch (err) {
      console.warn('PDF preview rendering failed, falling back to icon:', err);
      return createPdfPlaceholder();
    }
  }

  // 3. TIF / TIFF: Server conversion with local UTIF fallback
  if (ext === 'tif' || ext === 'tiff') {
    try {
      return await renderTiffPreview(file);
    } catch (err) {
      console.warn('TIFF preview rendering failed, falling back to icon:', err);
      return createTiffPlaceholder();
    }
  }

  // 4. Standard Raster Image (JPG, PNG, WebP, GIF)
  return readAsDataUrl(file);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

async function renderPdfPagePreview(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    return createPdfPlaceholder();
  }

  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () =>
        reject(new Error('Failed to load PDF preview engine.'));
      document.head.appendChild(script);
    });
  }

  const pdfjsLib = (window as any).pdfjsLib;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const defaultViewport = page.getViewport({ scale: 1.0 });
  const rawW = defaultViewport.width;
  const rawH = defaultViewport.height;

  // Scale so max dimension is around 1200px for a clean, sharp preview
  const maxDim = Math.max(rawW, rawH);
  const scale = maxDim > 0 ? Math.min(1200 / maxDim, 3.0) : 1.5;

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for PDF preview');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  return canvas.toDataURL('image/png');
}

async function renderTiffPreview(file: File): Promise<string> {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

  // 1. Try server-side convert endpoint if available
  try {
    const formData = new FormData();
    formData.append('image', file);
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || localStorage.getItem('auth_token')
        : null;

    const res = await fetch(`${API_URL}/designer/uploads/convert-image`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'image/png, application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.startsWith('image/png')) {
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch {
    // Continue to client-side UTIF fallback
  }

  // 2. Client-side UTIF fallback
  if (typeof window !== 'undefined') {
    if (!(window as any).UTIF) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load TIFF decoder.'));
        document.head.appendChild(script);
      });
    }

    const UTIF = (window as any).UTIF;
    const buffer = await file.arrayBuffer();
    const ifds = UTIF.decode(buffer);
    if (ifds && ifds.length > 0) {
      UTIF.decodeImage(buffer, ifds[0]);
      const rgba = UTIF.toRGBA8(ifds[0]);
      const width = ifds[0].width;
      const height = ifds[0].height;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imgData = ctx.createImageData(width, height);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
      }
    }
  }

  return createTiffPlaceholder();
}

function createPdfPlaceholder(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none">
    <rect width="400" height="400" rx="16" fill="#FEE2E2"/>
    <path d="M140 100H220L280 160V300H140V100Z" fill="white" stroke="#DC2626" stroke-width="8" stroke-linejoin="round"/>
    <path d="M220 100V160H280" fill="#FCA5A5" stroke="#DC2626" stroke-width="8" stroke-linejoin="round"/>
    <rect x="160" y="210" width="80" height="36" rx="6" fill="#DC2626"/>
    <text x="200" y="234" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="white">PDF</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createTiffPlaceholder(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none">
    <rect width="400" height="400" rx="16" fill="#EDE9FE"/>
    <path d="M140 100H220L280 160V300H140V100Z" fill="white" stroke="#7C3AED" stroke-width="8" stroke-linejoin="round"/>
    <path d="M220 100V160H280" fill="#DDD6FE" stroke="#7C3AED" stroke-width="8" stroke-linejoin="round"/>
    <rect x="160" y="210" width="80" height="36" rx="6" fill="#7C3AED"/>
    <text x="200" y="234" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="white">TIFF</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
