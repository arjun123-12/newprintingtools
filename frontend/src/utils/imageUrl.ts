/**
 * Image URL normalization, CORS proxy routing, and canvas export-safe data URL conversion.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000/api/v1';

const BACKEND_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, '');

/**
 * Clean and normalize Laravel relative storage paths.
 */
export function normalizeLaravelStoragePath(path: string): string {
  if (!path) return '';
  let normalizedPath = path.trim().replace(/\\/g, '/');

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  normalizedPath = normalizedPath
    .replace(/^\/storage\/app\/public\//, '/storage/')
    .replace(/^\/public\/storage\//, '/storage/');

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

  if (value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.includes('printecommerce.com.au')
      ) {
        const normalizedPath = normalizeLaravelStoragePath(parsed.pathname);
        return `${BACKEND_BASE_URL}${normalizedPath}`;
      }
      return value;
    } catch {
      return value;
    }
  }

  return `${BACKEND_BASE_URL}${normalizeLaravelStoragePath(value)}`;
}

/**
 * Get a CORS-safe proxy URL for any backend storage or remote artwork image.
 */
export function getProxiedImageUrl(url?: string | null): string {
  const value = url?.trim();
  if (!value) return '';

  if (value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  // If it's already calling our API proxy or storage route, keep as is
  if (value.includes('/api/v1/designer/proxy-image') || value.includes('/api/v1/storage/')) {
    return value;
  }

  const formattedUrl = formatImageUrl(value);

  // If it's a backend storage path or local/remote storage domain, route via proxy endpoint
  return `${API_URL}/designer/proxy-image?url=${encodeURIComponent(formattedUrl)}`;
}

/**
 * Convert any image URL (local storage, remote artwork, blob) into an export-safe
 * Data URL to guarantee that Fabric canvas drawing NEVER taints the HTML5 Canvas.
 */
export async function urlToSafeDataUrl(url: string, timeoutMs: number = 10000): Promise<string> {
  if (!url) return '';
  const trimmed = url.trim();

  // Data URLs are already 100% safe and self-contained
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  const candidateUrls: string[] = [];

  // If blob URL, try direct fetch
  if (trimmed.startsWith('blob:')) {
    candidateUrls.push(trimmed);
  } else {
    // 1. First try the dedicated CORS-enabled API proxy
    candidateUrls.push(getProxiedImageUrl(trimmed));
    // 2. Direct formatted URL
    const formatted = formatImageUrl(trimmed);
    if (formatted && !candidateUrls.includes(formatted)) {
      candidateUrls.push(formatted);
    }
    // 3. Raw URL
    if (!candidateUrls.includes(trimmed)) {
      candidateUrls.push(trimmed);
    }
  }

  for (const fetchUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(fetchUrl, {
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
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

          if (dataUrl && dataUrl.startsWith('data:')) {
            return dataUrl;
          }
        }
      }
    } catch {
      // Continue to next candidate URL or fallback
    }
  }

  // Fallback: Use offscreen HTMLImageElement with crossOrigin='anonymous'
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
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const result = canvas.toDataURL('image/png');
              resolve(result);
            } else {
              reject(new Error('Could not get canvas 2D context'));
            }
          } catch (canvasErr) {
            reject(canvasErr);
          }
        };

        img.onerror = (e) => {
          clearTimeout(timer);
          reject(e);
        };

        img.src = imgUrl;
      });

      if (dataUrl && dataUrl.startsWith('data:')) {
        return dataUrl;
      }
    } catch {
      // Continue
    }
  }

  // If all else fails, return the CORS-proxied URL
  return candidateUrls[0] || trimmed;
}
