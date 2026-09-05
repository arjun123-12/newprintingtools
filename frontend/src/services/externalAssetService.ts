import { apiClient } from './api/client';
import { ExternalAssetSearchResponse, ExternalAssetUseResponse, ExternalAssetCategory } from '@/types/externalAsset';

export const externalAssetService = {
  getCategories: async (): Promise<{ success: boolean; data: ExternalAssetCategory[] }> => {
    const response = await apiClient.get('/designer/external-assets/categories');
    return response.data;
  },

  search: async (params: {
    provider?: string;
    query?: string;
    category?: string;
    asset_type?: string;
    format?: string;
    page?: number;
    per_page?: number;
    sort?: string;
  }): Promise<ExternalAssetSearchResponse> => {
    const response = await apiClient.get('/designer/external-assets/search', { params });
    return response.data;
  },

  useAsset: async (provider: string, id: string): Promise<ExternalAssetUseResponse> => {
    const response = await apiClient.post(`/designer/external-assets/${provider}/${id}/use`);
    return response.data;
  },
};
