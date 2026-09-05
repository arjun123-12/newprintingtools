import { apiClient as api } from './api/client';

export type AssetType = 'text' | 'frame' | 'photo' | 'element' | 'background';

export interface DesignAssetCategory {
  id: string;
  name: string;
  slug: string;
  asset_type: AssetType;
  description?: string;
  is_active: boolean;
  sort_order: number;
}

export interface DesignAsset {
  id: string;
  category_id?: string;
  name: string;
  slug: string;
  asset_type: AssetType;
  file_path?: string;
  file_url?: string;
  thumbnail_path?: string;
  thumbnail_url?: string;
  fabric_json?: any;
  metadata?: any;
  provider: string;
  provider_asset_id?: string;
  license_name?: string;
  attribution?: string;
  is_active: boolean;
  sort_order: number;
  category?: DesignAssetCategory;
  created_at: string;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  last_page: number;
  per_page: number;
  total: number;
}

export interface AssetQueryParams {
  asset_type?: AssetType;
  category_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort?: 'sort_order' | 'newest' | 'oldest';
}

class DesignAssetService {
  /**
   * Fetch public active assets for the designer
   */
  async getPublicAssets(params?: AssetQueryParams): Promise<PaginatedResponse<DesignAsset>> {
    const res = await api.get('/designer/assets', { params });
    return res.data.data;
  }

  /**
   * Fetch public active categories for a specific asset type
   */
  async getPublicCategories(assetType?: AssetType): Promise<DesignAssetCategory[]> {
    const res = await api.get('/designer/asset-categories', { params: { asset_type: assetType } });
    return res.data.data;
  }

  /**
   * Admin: Get all assets (including inactive)
   */
  async getAdminAssets(params?: AssetQueryParams): Promise<PaginatedResponse<DesignAsset>> {
    const res = await api.get('/admin/designer/assets', { params });
    return res.data.data;
  }

  /**
   * Admin: Get all categories (including inactive)
   */
  async getAdminCategories(assetType?: AssetType): Promise<DesignAssetCategory[]> {
    const res = await api.get('/admin/designer/asset-categories', { params: { asset_type: assetType } });
    return res.data.data;
  }

  /**
   * Admin: Create category
   */
  async createCategory(data: Partial<DesignAssetCategory>): Promise<DesignAssetCategory> {
    const res = await api.post('/admin/designer/asset-categories', data);
    return res.data.data;
  }

  /**
   * Admin: Update category
   */
  async updateCategory(id: string, data: Partial<DesignAssetCategory>): Promise<DesignAssetCategory> {
    const res = await api.put(`/admin/designer/asset-categories/${id}`, data);
    return res.data.data;
  }

  /**
   * Admin: Delete category
   */
  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/admin/designer/asset-categories/${id}`);
  }

  /**
   * Admin: Create asset (handles multipart/form-data)
   */
  async createAsset(data: any): Promise<DesignAsset> {
    const formData = this.buildFormData(data);
    const res = await api.post('/admin/designer/assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  }

  /**
   * Admin: Update asset (handles multipart/form-data)
   */
  async updateAsset(id: string, data: any): Promise<DesignAsset> {
    const formData = this.buildFormData(data);
    formData.append('_method', 'PUT');
    const res = await api.post(`/admin/designer/assets/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  }

  /**
   * Build FormData from a plain object, serializing values correctly:
   *  - File → raw File
   *  - boolean → "1" or "0"  (Laravel boolean rule always accepts these)
   *  - object/array → JSON string (decoded on backend before validation)
   *  - everything else → coerced to string
   */
  private buildFormData(data: Record<string, any>): FormData {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (value instanceof File) {
        formData.append(key, value);
      } else if (typeof value === 'boolean') {
        formData.append(key, value ? '1' : '0');
      } else if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    });
    return formData;
  }

  /**
   * Admin: Delete asset
   */
  async deleteAsset(id: string): Promise<void> {
    await api.delete(`/admin/designer/assets/${id}`);
  }
}

export const designAssetService = new DesignAssetService();
