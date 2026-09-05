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

export const freepikService = {
  search: async (q: string, page = 1, limit = 20, type?: string): Promise<FreepikSearchResponse> => {
    const params: any = { q, page, limit };
    if (type && type !== 'all') {
      params.type = type;
    }
    const response = await apiClient.get('/freepik/search', { params });
    return response.data;
  },

  searchIcons: async (q: string, page = 1, limit = 20): Promise<FreepikSearchResponse> => {
    const params = { q, page, limit };
    const response = await apiClient.get('/freepik/icons/search', { params });
    return response.data;
  },

  useAsset: async (id: string): Promise<FreepikUseResponse> => {
    const response = await apiClient.post(`/freepik/resources/${id}/use`);
    return response.data;
  },

  useIcon: async (id: string): Promise<FreepikUseResponse> => {
    const response = await apiClient.post(`/freepik/icons/${id}/use`);
    return response.data;
  },

  removeBackground: async (imageUrl: string): Promise<RemoveBackgroundResponse> => {
    const response = await apiClient.post('/freepik/remove-background', {
      image_url: imageUrl,
    });
    return response.data;
  },
};
