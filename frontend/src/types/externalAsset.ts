export interface ExternalAssetCategory {
  id: string;
  name: string;
  slug: string;
}

export interface ExternalAsset {
  id: string;
  provider: string;
  provider_asset_id: string;
  title: string;
  asset_type: string;
  category?: ExternalAssetCategory;
  format: string;
  mime_type: string;
  thumbnail_url: string;
  preview_url: string;
  download_url: string | null;
  width: number;
  height: number;
  is_vector: boolean;
  is_recolourable: boolean;
  attribution: string | null;
  license: any | null;
  metadata?: any;
}

export interface ExternalAssetSearchPagination {
  current_page: number;
  has_next: boolean;
  next_page: number | null;
}

export interface ExternalAssetSearchResponse {
  success: boolean;
  data: {
    items: ExternalAsset[];
    pagination: ExternalAssetSearchPagination;
    providers: Record<string, { success: boolean; has_next: boolean; error?: string }>;
  };
}

export interface ExternalAssetUseResponse {
  success: boolean;
  data: {
    url: string;
    metadata?: any;
  };
}
