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
  process.env.NEXT_PUBLIC_MAGNIFIC_API_KEY ||
  'MS298ef362fc4148869212e3ba881f6bf2';
const FREEPIK_BASE_URL =
  process.env.NEXT_PUBLIC_FREEPIK_API_URL ||
  process.env.NEXT_PUBLIC_MAGNIFIC_API_URL ||
  'https://api.magnific.com/v1';

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
          const itemType = item?.image?.type || item?.type || 'photo';
          if (requestedType === 'photo') return itemType === 'photo' || itemType === 'psd';
          if (requestedType === 'vector') return itemType === 'vector';
          if (requestedType === 'icon') return itemType === 'icon';
          return true;
        })
        .slice(0, limit)
        .map((item: any) => {
          const itemType = item?.image?.type || item?.type || 'photo';
          let imgUrl =
            item?.image?.source?.url ||
            item?.preview?.url ||
            item?.thumbnail?.url ||
            (Array.isArray(item?.thumbnails) ? item.thumbnails[item.thumbnails.length - 1]?.url : '') ||
            item?.image?.url ||
            '';

          if (typeof imgUrl === 'string' && imgUrl.startsWith('http://')) {
            imgUrl = imgUrl.replace('http://', 'https://');
          }

          return {
            id: String(item.id),
            title: item.title || item.name || 'Freepik Asset',
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

  /**
   * Get detailed resource metadata from Magnific / Freepik API.
   * Endpoint: GET /resources/{resource-id}
   * Header: x-magnific-api-key: <key>
   */
  getResource: async (id: string): Promise<any> => {
    // 1. Try Laravel backend first
    try {
      const response = await apiClient.get(`/freepik/resources/${id}`);
      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
    } catch (backendErr) {
      console.warn('Backend getResource failed, trying direct Magnific API:', backendErr);
    }

    // 2. Direct Magnific API call
    try {
      const res = await fetch(`${FREEPIK_BASE_URL}/resources/${id}`, {
        headers: {
          'x-magnific-api-key': FREEPIK_API_KEY,
          'x-freepik-api-key': FREEPIK_API_KEY,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Magnific get resource error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      return json.data || json;
    } catch (directErr) {
      console.error('Direct getResource failed:', directErr);
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
    // 1. Try backend
    try {
      const response = await apiClient.post(`/freepik/resources/${id}/use`);
      if (response.data?.success && response.data?.data) {
        return response.data;
      }
    } catch (err) {
      console.warn('Backend useAsset failed, falling back to direct API / resource details:', err);
    }

    // 2. Try direct download endpoint from Magnific API
    try {
      const dlRes = await fetch(`${FREEPIK_BASE_URL}/resources/${id}/download`, {
        headers: {
          'x-magnific-api-key': FREEPIK_API_KEY,
          'x-freepik-api-key': FREEPIK_API_KEY,
          Accept: 'application/json',
        },
      });
      if (dlRes.ok) {
        const dlJson = await dlRes.json();
        const dlUrl = dlJson.data?.url || dlJson.url;
        if (dlUrl && typeof dlUrl === 'string' && !dlUrl.match(/\.(zip|eps|ai|rar)(\?.*)?$/i)) {
          return {
            success: true,
            data: {
              id,
              url: dlUrl,
              title: 'Freepik Asset',
              type: 'photo',
              provider: 'freepik',
            },
          };
        }
      }
    } catch (dlErr) {
      console.warn('Direct download URL fetch failed:', dlErr);
    }

    // 3. Try direct resource details to resolve preview URL
    try {
      const details = await freepikService.getResource(id);
      let previewUrl =
        details?.preview?.url ||
        details?.image?.source?.url ||
        details?.image?.url ||
        fallbackUrl;

      if (previewUrl && typeof previewUrl === 'string') {
        if (previewUrl.startsWith('http://')) {
          previewUrl = previewUrl.replace('http://', 'https://');
        }
        return {
          success: true,
          data: {
            id,
            url: previewUrl,
            title: details?.name || details?.title || 'Freepik Asset',
            type: details?.type || 'photo',
            provider: 'freepik',
          },
        };
      }
    } catch (detailErr) {
      console.warn('Direct getResource in useAsset failed:', detailErr);
    }

    if (fallbackUrl) {
      const secureFallback = fallbackUrl.startsWith('http://')
        ? fallbackUrl.replace('http://', 'https://')
        : fallbackUrl;
      return {
        success: true,
        data: {
          id,
          url: secureFallback,
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
    // 1. Direct Magnific API call using specified options
    try {
      const options = {
        method: 'POST',
        headers: {
          'x-magnific-api-key': FREEPIK_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          image_url: imageUrl,
        }).toString(),
      };

      const res = await fetch(`${FREEPIK_BASE_URL}/ai/beta/remove-background`, options);
      if (res.ok) {
        const data = await res.json();
        const url = data.high_resolution || data.url || data.preview;
        return {
          success: true,
          data: {
            url,
            high_resolution: data.high_resolution || url,
            preview: data.preview || url,
            original: data.original || imageUrl,
          },
        };
      }
    } catch (directErr) {
      console.warn('Direct Magnific removeBackground failed, falling back to backend:', directErr);
    }

    // 2. Fallback to Laravel backend
    const response = await apiClient.post('/freepik/remove-background', {
      image_url: imageUrl,
    });
    return response.data;
  },
};

