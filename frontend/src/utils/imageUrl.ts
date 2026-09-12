/**
 * Image URL normalization, CORS proxy routing, and canvas export-safe data URL conversion.
 */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '');

const BACKEND_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, '');

function isDataOrBlobUrl(value: string): boolean {
  return value.startsWith('data:') || value.startsWith('blob:');
}

function isProxyUrl(value: string): boolean {
  return value.includes('/api/v1/designer/proxy-image');
}

function isBackendStorageUrl(value: string): boolean {
  try {
    const parsed = new URL(value, `${BACKEND_BASE_URL}/`);
    const backend = new URL(`${BACKEND_BASE_URL}/`);

    return (
      parsed.origin === backend.origin &&
      parsed.pathname.startsWith('/storage/')
    );
  } catch {
    return false;
  }
}

function containsSvgMarkup(value: string): boolean {
  return /<svg[\s>]/i.test(value) && !/<(?:html|body)[\s>]/i.test(value);
}

/**
 * Clean and normalize Laravel relative storage paths.
 */
export function normalizeLaravelStoragePath(path: string): string {
  if (!path) return '';

  let normalizedPath = path.trim().replace(/\\/g, '/');

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  /* This operates only on a URL pathname, so collapsing duplicate slashes is safe. */
  normalizedPath = normalizedPath.replace(/\/{2,}/g, '/');

  normalizedPath = normalizedPath
    .replace(/^\/storage\/app\/public\//, '/storage/')
    .replace(/^\/public\/storage\//, '/storage/')
    .replace(/^\/(?:api\/v1\/)?storage\//, '/storage/');

  if (normalizedPath.startsWith('/products/')) {
    normalizedPath = `/storage${normalizedPath}`;
  }

  return normalizedPath;
}

/**
 * Format a template/product image URL into a canonical backend URL.
 */
export function formatImageUrl(url?: string | null): string {
  const value = url?.trim();
  if (!value) return '';

  if (isDataOrBlobUrl(value)) {
    return value;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      const backend = new URL(`${BACKEND_BASE_URL}/`);
      const shouldUseConfiguredBackend =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.includes('printecommerce.com.au') ||
        parsed.origin === backend.origin;

      if (shouldUseConfiguredBackend) {
        const normalizedPath = normalizeLaravelStoragePath(parsed.pathname);
        return `${BACKEND_BASE_URL}${normalizedPath}${parsed.search}${parsed.hash}`;
      }

      return value;
    } catch {
      return value;
    }
  }

  return `${BACKEND_BASE_URL}${normalizeLaravelStoragePath(value)}`;
}

/**
 * Get a CORS-safe URL. Same-backend Laravel storage is already safe and must
 * not be routed through a proxy that can return an HTML/placeholder response.
 */
export function getProxiedImageUrl(url?: string | null): string {
  const value = url?.trim();
  if (!value) return '';

  if (isDataOrBlobUrl(value)) {
    return value;
  }

  if (
    isProxyUrl(value) ||
    value.includes('/api/v1/storage/')
  ) {
    return value;
  }

  const formattedUrl = formatImageUrl(value);

  if (isBackendStorageUrl(formattedUrl)) {
    return formattedUrl;
  }

  return `${API_URL}/designer/proxy-image?url=${encodeURIComponent(formattedUrl)}`;
}

/**
 * Convert any image URL into an export-safe data URL. SVG responses are
 * accepted only when their body contains actual SVG markup.
 */
export async function urlToSafeDataUrl(
  url: string,
  timeoutMs: number = 10000
): Promise<string> {
  if (!url) return '';
  const trimmed = url.trim();

  if (trimmed.startsWith('data:image/svg+xml')) {
    try {
      const { normalizeSvgDataUrl } = await import('./svgNormalizer');
      return normalizeSvgDataUrl(trimmed).dataUrl;
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  const candidateUrls: string[] = [];
  const addCandidate = (candidate: string) => {
    if (candidate && !candidateUrls.includes(candidate)) {
      candidateUrls.push(candidate);
    }
  };

  if (trimmed.startsWith('blob:')) {
    addCandidate(trimmed);
  } else {
    const formatted = formatImageUrl(trimmed);

    /* Own storage first; external resources still use the proxy first. */
    if (isBackendStorageUrl(formatted)) {
      addCandidate(formatted);
      addCandidate(getProxiedImageUrl(formatted));
    } else {
      addCandidate(getProxiedImageUrl(trimmed));
      addCandidate(formatted);
    }

    addCandidate(trimmed);
  }

  const isSvgFile =
    trimmed.toLowerCase().includes('.svg') ||
    candidateUrls.some((candidate) => candidate.toLowerCase().includes('.svg'));

  for (const fetchUrl of candidateUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(fetchUrl, {
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
      });

      if (!res.ok) continue;

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const responseLooksLikeSvg =
        isSvgFile ||
        contentType.includes('image/svg+xml');

      if (responseLooksLikeSvg) {
        const text = await res.text();

        /* A 200 proxy placeholder, JSON response or HTML page is not an SVG. */
        if (!containsSvgMarkup(text)) continue;

        const { normalizeSvgString } = await import('./svgNormalizer');
        return normalizeSvgString(text).dataUrl;
      }

      const blob = await res.blob();
      if (!blob || blob.size === 0) continue;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('FileReader did not return a string'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      if (dataUrl.startsWith('data:')) {
        return dataUrl;
      }
    } catch {
      /* Continue to the next direct/proxy candidate. */
    } finally {
      clearTimeout(timer);
    }
  }

  if (isSvgFile) {
    return (
      candidateUrls.find((candidate) => !isProxyUrl(candidate)) ||
      trimmed
    );
  }

  for (const imgUrl of candidateUrls) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        const timer = setTimeout(() => {
          img.onload = null;
          img.onerror = null;
          reject(new Error('Image load timeout'));
        }, timeoutMs);

        img.onload = () => {
          clearTimeout(timer);

          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 400;
            canvas.height = img.naturalHeight || img.height || 400;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              reject(new Error('Could not get canvas 2D context'));
              return;
            }

            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (canvasError) {
            reject(canvasError);
          }
        };

        img.onerror = (event) => {
          clearTimeout(timer);
          reject(event);
        };

        img.src = imgUrl;
      });

      if (dataUrl.startsWith('data:')) {
        return dataUrl;
      }
    } catch {
      /* Continue to the next candidate. */
    }
  }

  return candidateUrls[0] || trimmed;
}
