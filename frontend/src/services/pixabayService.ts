/**
 * Pixabay API Client Service
 * Official API Documentation: https://pixabay.com/api/docs/
 */

const PIXABAY_API_KEY =
  process.env.NEXT_PUBLIC_PIXABAY_API_KEY ||
  '32693163-44f7d279fc70d5f8ec50bd3a4';

const PIXABAY_BASE_URL = 'https://pixabay.com/api/';

export type PixabayImageType = 'all' | 'photo' | 'illustration' | 'vector';
export type PixabayOrientation = 'all' | 'horizontal' | 'vertical';
export type PixabayOrder = 'popular' | 'latest';

export interface PixabayImage {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  views: number;
  downloads: number;
  likes: number;
  user: string;
  user_id: number;
  userImageURL: string;
}

export interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayImage[];
}

export interface PixabaySearchParams {
  query?: string;
  imageType?: PixabayImageType;
  orientation?: PixabayOrientation;
  category?: string;
  colors?: string;
  editorsChoice?: boolean;
  order?: PixabayOrder;
  page?: number;
  perPage?: number;
  safeSearch?: boolean;
}

export const PIXABAY_CATEGORIES = [
  'all',
  'backgrounds',
  'fashion',
  'nature',
  'science',
  'education',
  'feelings',
  'health',
  'people',
  'religion',
  'places',
  'animals',
  'industry',
  'computer',
  'food',
  'sports',
  'transportation',
  'travel',
  'buildings',
  'business',
  'music',
] as const;

export const PIXABAY_COLORS = [
  { name: 'All', value: '', hex: 'transparent' },
  { name: 'Transparent', value: 'transparent', hex: 'transparent' },
  { name: 'Black & White', value: 'grayscale', hex: '#64748b' },
  { name: 'Red', value: 'red', hex: '#ef4444' },
  { name: 'Orange', value: 'orange', hex: '#f97316' },
  { name: 'Yellow', value: 'yellow', hex: '#eab308' },
  { name: 'Green', value: 'green', hex: '#22c55e' },
  { name: 'Turquoise', value: 'turquoise', hex: '#06b6d4' },
  { name: 'Blue', value: 'blue', hex: '#3b82f6' },
  { name: 'Purple', value: 'lilac', hex: '#a855f7' },
  { name: 'Pink', value: 'pink', hex: '#ec4899' },
  { name: 'White', value: 'white', hex: '#ffffff' },
  { name: 'Gray', value: 'gray', hex: '#94a3b8' },
  { name: 'Black', value: 'black', hex: '#0f172a' },
  { name: 'Brown', value: 'brown', hex: '#78350f' },
] as const;

class PixabayService {
  private key = PIXABAY_API_KEY;

  public async search(params: PixabaySearchParams = {}): Promise<PixabayResponse> {
    const {
      query = '',
      imageType = 'all',
      orientation = 'all',
      category = '',
      colors = '',
      editorsChoice = false,
      order = 'popular',
      page = 1,
      perPage = 28,
      safeSearch = true,
    } = params;

    const url = new URL(PIXABAY_BASE_URL);
    url.searchParams.set('key', this.key);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(Math.min(perPage, 200)));
    url.searchParams.set('safesearch', safeSearch ? 'true' : 'false');
    url.searchParams.set('order', order);

    if (query.trim()) {
      url.searchParams.set('q', query.trim());
    }

    if (imageType && imageType !== 'all') {
      url.searchParams.set('image_type', imageType);
    }

    if (orientation && orientation !== 'all') {
      url.searchParams.set('orientation', orientation);
    }

    if (category && category !== 'all') {
      url.searchParams.set('category', category.toLowerCase());
    }

    if (colors && colors !== 'all') {
      url.searchParams.set('colors', colors.toLowerCase());
    }

    if (editorsChoice) {
      url.searchParams.set('editors_choice', 'true');
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Pixabay API error (${response.status}): ${errorText || response.statusText}`
      );
    }

    const data: PixabayResponse = await response.json();
    return data;
  }
}

export const pixabayService = new PixabayService();
