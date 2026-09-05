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

export async function removeImageBackground(
  source: string | HTMLImageElement,
  onProgress?: (
    progress: BackgroundRemovalProgress
  ) => void
): Promise<BackgroundRemovalResult> {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    throw new Error('Please log in again.');
  }

  const sourceUrl =
    typeof source === 'string'
      ? source
      : source.currentSrc || source.src;

  if (!sourceUrl) {
    throw new Error('The selected image has no source URL.');
  }

  if (
    sourceUrl.startsWith('data:') ||
    sourceUrl.startsWith('blob:') ||
    sourceUrl.includes('localhost') ||
    sourceUrl.includes('127.0.0.1')
  ) {
    throw new Error(
      'Upload this image to public storage before removing its background.'
    );
  }

  onProgress?.({
    stage: 'processing',
    message: 'Removing image background...',
  });

  const response = await fetch(
    `${API_URL}/freepik/remove-background`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        image_url: sourceUrl,
      }),
    }
  );

  const result =
    (await response.json()) as RemoveBackgroundResponse;

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ??
      `Background removal failed with status ${response.status}.`
    );
  }

  const processedUrl =
    result.data?.file_url ?? result.data?.url;

  if (!processedUrl) {
    throw new Error(
      'The backend did not return the processed image URL.'
    );
  }

  onProgress?.({
    stage: 'complete',
    message: 'Background removed successfully.',
  });

  return {
    url: processedUrl,
    fileUrl: processedUrl,
    filePath: result.data?.file_path,
    original: result.data?.original,
  };
}