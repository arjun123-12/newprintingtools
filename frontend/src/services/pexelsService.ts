/**
 * Pexels API Client Service
 * Official API Documentation: https://www.pexels.com/api/documentation/
 */

const PEXELS_API_KEY =
  process.env.NEXT_PUBLIC_PEXELS_API_KEY ||
  '563492ad6f91700001000001a46d15eeabb5423a92aec03b7403aeae';

const PEXELS_BASE_URL = 'https://api.pexels.com/v1/';

export type PexelsOrientation = 'all' | 'landscape' | 'portrait' | 'square';
export type PexelsSize = 'all' | 'large' | 'medium' | 'small';

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  liked: boolean;
  alt: string;
}

export interface PexelsResponse {
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  total_results: number;
  next_page?: string;
  prev_page?: string;
}

export interface PexelsSearchParams {
  query?: string;
  orientation?: PexelsOrientation;
  size?: PexelsSize;
  color?: string;
  page?: number;
  perPage?: number;
}

class PexelsService {
  private key = PEXELS_API_KEY;

  /**
   * Search photos from Pexels, or fetch curated photos if query is empty
   */
  public async search(params: PexelsSearchParams = {}): Promise<PexelsResponse> {
    const {
      query = '',
      orientation = 'all',
      size = 'all',
      color = '',
      page = 1,
      perPage = 24,
    } = params;

    const trimmedQuery = query.trim();
    const endpoint = trimmedQuery
      ? `${PEXELS_BASE_URL}search`
      : `${PEXELS_BASE_URL}curated`;

    const url = new URL(endpoint);
    if (trimmedQuery) {
      url.searchParams.set('query', trimmedQuery);
    }
    if (orientation !== 'all') {
      url.searchParams.set('orientation', orientation);
    }
    if (size !== 'all') {
      url.searchParams.set('size', size);
    }
    if (color) {
      url.searchParams.set('color', color);
    }
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: this.key,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Pexels API error (${response.status}): ${errorText || response.statusText}`
      );
    }

    const data: PexelsResponse = await response.json();
    return data;
  }
}

export const pexelsService = new PexelsService();
