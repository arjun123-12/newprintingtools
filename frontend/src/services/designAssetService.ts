import { apiClient as api } from './api/client';

export type AssetType =
  | 'text'
  | 'frame'
  | 'photo'
  | 'element'
  | 'background'
  | 'shape';

export interface DesignAssetCategory {
  id: string;
  name: string;
  slug: string;
  asset_type: AssetType;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface DesignAsset {
  id: string;
  category_id?: string | null;
  name: string;
  slug: string;
  asset_type: AssetType;
  file_path?: string | null;
  file_url?: string | null;
  thumbnail_path?: string | null;
  thumbnail_url?: string | null;
  fabric_json?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  provider: string;
  provider_asset_id?: string | null;
  license_name?: string | null;
  attribution?: string | null;
  is_active: boolean;
  sort_order: number;
  category?: DesignAssetCategory | null;
  created_at: string;
  updated_at?: string;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url?: string | null;
  from?: number | null;
  last_page: number;
  last_page_url?: string | null;
  next_page_url?: string | null;
  path?: string;
  per_page: number;
  prev_page_url?: string | null;
  to?: number | null;
  total: number;
}

export interface AssetQueryParams {
  asset_type?: AssetType | string;
  category_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort?: 'sort_order' | 'newest' | 'oldest';
}

export interface DesignAssetPayload {
  category_id?: string | null;
  name?: string;
  slug?: string;
  asset_type?: AssetType;
  fabric_json?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  provider?: string;
  provider_asset_id?: string | null;
  license_name?: string | null;
  attribution?: string | null;
  is_active?: boolean;
  sort_order?: number;
  file?: File | null;
  thumbnail?: File | null;
  mask_file?: File | null;
  mask_type?:
  | 'rectangle'
  | 'rounded_rectangle'
  | 'circle'
  | 'ellipse'
  | 'polygon'
  | 'svg_path'
  | 'svg_mask'
  | 'alpha_mask';
  remove_mask?: boolean;
  [key: string]: unknown;
}

const CLIENT_ONLY_FIELDS = new Set([
  'id',
  'category',
  'created_at',
  'updated_at',
  'file_path',
  'file_url',
  'thumbnail_path',
  'thumbnail_url',
]);

class DesignAssetService {
  /** Fetch public active assets for the customer designer. */
  async getPublicAssets(
    params?: AssetQueryParams
  ): Promise<PaginatedResponse<DesignAsset>> {
    const response = await api.get('/designer/assets', { params });
    return response.data.data;
  }

  /** Fetch public active categories, optionally for one asset type. */
  async getPublicCategories(
    assetType?: AssetType
  ): Promise<DesignAssetCategory[]> {
    const response = await api.get('/designer/asset-categories', {
      params: assetType ? { asset_type: assetType } : undefined,
    });

    return response.data.data;
  }

  /** Admin: fetch all assets, including inactive assets. */
  async getAdminAssets(
    params?: AssetQueryParams
  ): Promise<PaginatedResponse<DesignAsset>> {
    const response = await api.get('/admin/designer/assets', { params });
    return response.data.data;
  }

  /** Admin: fetch all categories, including inactive categories. */
  async getAdminCategories(
    assetType?: AssetType
  ): Promise<DesignAssetCategory[]> {
    const response = await api.get('/admin/designer/asset-categories', {
      params: assetType ? { asset_type: assetType } : undefined,
    });

    return response.data.data;
  }

  /** Admin: create a category. */
  async createCategory(
    data: Partial<DesignAssetCategory>
  ): Promise<DesignAssetCategory> {
    const response = await api.post('/admin/designer/asset-categories', data);
    return response.data.data;
  }

  /** Admin: update a category. Category updates contain no files. */
  async updateCategory(
    id: string,
    data: Partial<DesignAssetCategory>
  ): Promise<DesignAssetCategory> {
    const response = await api.put(
      `/admin/designer/asset-categories/${id}`,
      data
    );

    return response.data.data;
  }

  /** Admin: delete a category. */
  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/admin/designer/asset-categories/${id}`);
  }

  /**
   * Admin: create an asset using multipart/form-data.
   *
   * Do not manually set Content-Type. Axios/browser adds the required
   * multipart boundary automatically.
   */
  async createAsset(data: DesignAssetPayload): Promise<DesignAsset> {
    const formData = this.buildFormData(data);

    const response = await api.post('/admin/designer/assets', formData, {
      headers: {
        Accept: 'application/json',
      },
    });

    return response.data.data;
  }

  /**
   * Admin: update an asset with files.
   *
   * PHP does not reliably populate uploaded files for a native multipart PUT,
   * so send POST and let Laravel method spoofing route it to update().
   */
  async updateAsset(
    id: string,
    data: DesignAssetPayload
  ): Promise<DesignAsset> {
    const formData = this.buildFormData(data);
    formData.set('_method', 'PUT');

    const response = await api.post(
      `/admin/designer/assets/${id}`,
      formData,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    return response.data.data;
  }

  /** Admin: delete an asset. */
  async deleteAsset(id: string): Promise<void> {
    await api.delete(`/admin/designer/assets/${id}`);
  }

  /**
   * Convert the form payload into multipart data:
   * - File/Blob: append without conversion.
   * - boolean: send 1 or 0 for Laravel boolean validation.
   * - object/array: encode as JSON; the controller decodes before validation.
   * - null/undefined and server-generated fields: skip.
   */
  private buildFormData(data: DesignAssetPayload): FormData {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        CLIENT_ONLY_FIELDS.has(key)
      ) {
        return;
      }

      if (typeof File !== 'undefined' && value instanceof File) {
        formData.append(key, value, value.name);
        return;
      }

      if (typeof Blob !== 'undefined' && value instanceof Blob) {
        formData.append(key, value);
        return;
      }

      if (typeof value === 'boolean') {
        formData.append(key, value ? '1' : '0');
        return;
      }

      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
        return;
      }

      formData.append(key, String(value));
    });

    return formData;
  }
}

export const designAssetService = new DesignAssetService();
