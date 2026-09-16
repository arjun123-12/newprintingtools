export interface BackgroundRemovalProgress {
  stage: 'processing' | 'downloading' | 'complete';
  progress?: number;
  message: string;
}

export interface BackgroundRemovalResult {
  url: string;
  fileUrl: string;
  filePath?: string;
  original?: string;
}

interface RemoveBackgroundResponse {
  success: boolean;
  message?: string;
  data?: {
    url?: string;
    file_url?: string;
    file_path?: string;
    original?: string;
  };
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

export const MAGNIFIC_API_KEY =
  process.env.NEXT_PUBLIC_MAGNIFIC_API_KEY ||
  process.env.NEXT_PUBLIC_FREEPIK_API_KEY ||
  'MS298ef362fc4148869212e3ba881f6bf2';

export const MAGNIFIC_API_URL =
  process.env.NEXT_PUBLIC_MAGNIFIC_API_URL ||
  process.env.NEXT_PUBLIC_FREEPIK_API_URL ||
  'https://api.magnific.com/v1';

/**
 * Standard Magnific API options for background removal:
 * method: 'POST',
 * headers: {
 *   'x-magnific-api-key': 'MS298ef362fc4148869212e3ba881f6bf2',
 *   'Content-Type': 'application/x-www-form-urlencoded'
 * }
 */
export const magnificBackgroundOptions = {
  method: 'POST',
  headers: {
    'x-magnific-api-key': MAGNIFIC_API_KEY,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
};

/**
 * Unwrap proxy image URL if nested
 */
export function unwrapProxyImageUrl(rawUrl: string): string {
  let currentUrl = rawUrl.trim();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsedUrl = new URL(currentUrl, 'http://local.invalid');
      if (!parsedUrl.pathname.includes('/proxy-image')) {
        return currentUrl;
      }
      const nestedUrl = parsedUrl.searchParams.get('url');
      if (!nestedUrl || nestedUrl === currentUrl) {
        return currentUrl;
      }
      currentUrl = nestedUrl;
    } catch {
      return currentUrl;
    }
  }
  return currentUrl;
}

/**
 * Ensure image has a public HTTP URL accessible by external APIs like Magnific.
 * Converts local blob/data URLs to public uploads when needed.
 */
async function ensurePublicImageUrl(sourceUrl: string): Promise<string> {
  const unwrapped = unwrapProxyImageUrl(sourceUrl);

  const isLocal =
    unwrapped.startsWith('data:') ||
    unwrapped.startsWith('blob:') ||
    unwrapped.includes('localhost') ||
    unwrapped.includes('127.0.0.1') ||
    unwrapped.includes('0.0.0.0');

  if (!isLocal && (unwrapped.startsWith('http://') || unwrapped.startsWith('https://'))) {
    return unwrapped;
  }

  // Upload local/blob/data image to backend public disk
  try {
    const res = await fetch(unwrapped);
    const blob = await res.blob();
    const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    const file = new File([blob], `canvas-bg-remove-${Date.now()}.${extension}`, {
      type: blob.type || 'image/png',
    });

    const formData = new FormData();
    formData.append('image', file);
    formData.append('source_provider', 'designer');

    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const uploadRes = await fetch(`${API_URL}/designer/uploads/canvas-image`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      const publicUrl = uploadData?.data?.url || uploadData?.url;
      if (publicUrl) {
        return publicUrl;
      }
    }
  } catch (uploadErr) {
    console.warn('Could not upload image to public storage for Magnific:', uploadErr);
  }

  return unwrapped;
}

export async function removeImageBackground(
  source: string | HTMLImageElement | any,
  onProgress?: (
    progress: BackgroundRemovalProgress
  ) => void
): Promise<BackgroundRemovalResult> {
  const sourceUrl =
    typeof source === 'string'
      ? source
      : source?.originalSrc || source?.sourceUrl || source?.currentSrc || source?.src || source?.getSrc?.();

  if (!sourceUrl) {
    throw new Error('The selected image has no source URL.');
  }

  onProgress?.({
    stage: 'processing',
    message: 'Preparing image for Magnific AI background removal...',
  });

  const publicUrl = await ensurePublicImageUrl(sourceUrl);

  onProgress?.({
    stage: 'processing',
    message: 'Removing background with Magnific AI...',
  });

  // 1. Direct Magnific API call with specified options
  try {
    const body = new URLSearchParams({
      image_url: publicUrl,
    });

    const options = {
      method: 'POST',
      headers: {
        'x-magnific-api-key': MAGNIFIC_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    };

    const directResponse = await fetch(
      `${MAGNIFIC_API_URL}/ai/beta/remove-background`,
      options
    );

    if (directResponse.ok) {
      const result = await directResponse.json();
      const processedUrl =
        result.high_resolution ||
        result.url ||
        result.preview;

      if (processedUrl) {
        onProgress?.({
          stage: 'complete',
          message: 'Background removed successfully.',
        });

        return {
          url: processedUrl,
          fileUrl: processedUrl,
          original: result.original || publicUrl,
        };
      }
    } else {
      console.warn(
        `Direct Magnific background removal returned status ${directResponse.status}:`,
        await directResponse.text().catch(() => '')
      );
    }
  } catch (directErr) {
    console.warn('Direct Magnific AI remove-background failed, trying backend fallback:', directErr);
  }

  // 2. Fallback to Laravel backend API
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const backendResponse = await fetch(
    `${API_URL}/freepik/remove-background`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        image_url: publicUrl,
      }),
    }
  );

  const backendResult =
    (await backendResponse.json().catch(() => null)) as RemoveBackgroundResponse | null;

  if (!backendResponse.ok || !backendResult?.success) {
    throw new Error(
      backendResult?.message ??
      `Background removal failed with status ${backendResponse.status}.`
    );
  }

  const processedUrl =
    backendResult.data?.file_url ?? backendResult.data?.url;

  if (!processedUrl) {
    throw new Error(
      'The background removal service did not return a processed image URL.'
    );
  }

  onProgress?.({
    stage: 'complete',
    message: 'Background removed successfully.',
  });

  return {
    url: processedUrl,
    fileUrl: processedUrl,
    filePath: backendResult.data?.file_path,
    original: backendResult.data?.original || publicUrl,
  };
}