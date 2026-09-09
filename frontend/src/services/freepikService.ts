import { apiClient } from './api/client';

export interface FreepikAsset {
  id: string;
  title: string;
  type: string;
  preview_url: string;
  thumbnail_url: string;
  source_url: string;
  author: {
    name: string;
    url: string;
  };
  license: {
    type: string;
    requires_attribution: boolean;
  };
  provider: string;
}

export interface FreepikSearchResponse {
  success: boolean;
  data: {
    items: FreepikAsset[];
    pagination: {
      page: number;
      limit: number;
      has_next: boolean;
      total_items?: number;
      total_pages?: number;
    };
  };
}

export interface FreepikUseResponse {
  success: boolean;
  data: {
    id: string;
    url: string;
    title: string;
    type: string;
    provider: string;
  };
}

export interface RemoveBackgroundResponse {
  success: boolean;
  data: {
    url: string;
    high_resolution: string;
    preview: string;
    original: string;
  };
}

const FREEPIK_API_KEY =
  process.env.NEXT_PUBLIC_FREEPIK_API_KEY ||
  'MS298ef362fc4148869212e3ba881f6bf2';
const FREEPIK_BASE_URL =
  process.env.NEXT_PUBLIC_FREEPIK_API_URL || 'https://api.magnific.com/v1';

export const freepikService = {
  search: async (
    q: string,
    page = 1,
    limit = 24,
    type?: string
  ): Promise<FreepikSearchResponse> => {
    // 1. Try via Laravel backend
    try {
      const params: any = { q: q || '', page, limit };
      if (type && type !== 'all') {
        params.type = type;
      }
      const response = await apiClient.get('/freepik/search', { params });
      if (response.data?.success && response.data?.data) {
        return response.data;
      }
    } catch (backendErr) {
      console.warn('Backend Freepik search failed, falling back to direct API:', backendErr);
    }

    // 2. Fallback to direct Magnific / Freepik API
    try {
      const url = new URL(`${FREEPIK_BASE_URL}/resources`);
      url.searchParams.set('term', q || '');
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(Math.min(limit * 2, 100)));
      url.searchParams.set('locale', 'en-US');

      const res = await fetch(url.toString(), {
        headers: {
          'x-freepik-api-key': FREEPIK_API_KEY,
          'x-magnific-api-key': FREEPIK_API_KEY,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Freepik direct API error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const rawItems = json.data || [];
      const requestedType = type || 'all';

      const filteredItems: FreepikAsset[] = rawItems
        .filter((item: any) => {
          if (requestedType === 'all') return true;
          const itemType = item?.image?.type || 'photo';
          if (requestedType === 'photo') return itemType === 'photo' || itemType === 'psd';
          if (requestedType === 'vector') return itemType === 'vector';
          if (requestedType === 'icon') return itemType === 'icon';
          return true;
        })
        .slice(0, limit)
        .map((item: any) => {
          const itemType = item?.image?.type || 'photo';
          const imgUrl = item?.image?.source?.url || '';
          return {
            id: String(item.id),
            title: item.title || 'Freepik Asset',
            type: itemType,
            preview_url: imgUrl,
            thumbnail_url: imgUrl,
            source_url: item.url || '',
            author: {
              name: item.author?.name || 'Freepik',
              url: item.author?.avatar || '',
            },
            license: {
              type: 'freepik',
              requires_attribution: true,
            },
            provider: 'freepik',
          };
        });

      return {
        success: true,
        data: {
          items: filteredItems,
          pagination: {
            page: json.meta?.current_page || page,
            limit,
            has_next: (json.meta?.current_page || page) < (json.meta?.last_page || 1),
          },
        },
      };
    } catch (directErr: any) {
      console.error('Freepik search completely failed:', directErr);
      throw directErr;
    }
  },

  searchIcons: async (
    q: string,
    page = 1,
    limit = 20
  ): Promise<FreepikSearchResponse> => {
    const params = { q, page, limit };
    const response = await apiClient.get('/freepik/icons/search', { params });
    return response.data;
  },

  useAsset: async (
    id: string,
    fallbackUrl?: string
  ): Promise<FreepikUseResponse> => {
    try {
      const response = await apiClient.post(`/freepik/resources/${id}/use`);
      if (response.data?.success && response.data?.data) {
        return response.data;
      }
    } catch (err) {
      console.warn('Backend useAsset failed, using fallback preview URL:', err);
    }

    if (fallbackUrl) {
      return {
        success: true,
        data: {
          id,
          url: fallbackUrl,
          title: 'Freepik Image',
          type: 'photo',
          provider: 'freepik',
        },
      };
    }

    throw new Error('Could not download or use Freepik image.');
  },

  useIcon: async (id: string): Promise<FreepikUseResponse> => {
    const response = await apiClient.post(`/freepik/icons/${id}/use`);
    return response.data;
  },

  removeBackground: async (
    imageUrl: string
  ): Promise<RemoveBackgroundResponse> => {
    const response = await apiClient.post('/freepik/remove-background', {
      image_url: imageUrl,
    });
    return response.data;
  },
};

