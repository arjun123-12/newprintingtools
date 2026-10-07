import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';

export interface ArtworkDetail {
  id: string;
  user_id: number | null;
  session_id: string | null;
  name: string;
  product_id: number | null;
  product_name: string;
  product_slug?: string | null;
  source_type: string;
  design_status?: string | null;
  status: string;
  thumbnail_url?: string | null;
  public_url?: string | null;
  proof_pdf_url?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  dpi?: number | null;
  unit?: string | null;
  bleed?: number | null;
  safe_area?: number | null;
  background_color?: string | null;
  document_settings?: any;
  pages_count: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: number;
  type: string;
  name: string;
  company?: string | null;
  address_line_1: string;
  address_line_2?: string | null;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  phone?: string | null;
  is_default: boolean;
}

export interface CustomerOrderSummary {
  id: number | string;
  order_number: string;
  total_amount: number | string;
  status: string;
  created_at: string;
}

export interface CustomerItem {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  company_name?: string | null;
  abn?: string | null;
  role: string;
  email_verified_at?: string | null;
  created_at: string;
  updated_at: string;
  artworks_count: number;
  orders_count: number;
  addresses?: CustomerAddress[];
  orders?: CustomerOrderSummary[];
  artworks: ArtworkDetail[];
}

export interface CustomerStats {
  total_customers: number;
  total_all_users: number;
  customers_with_artworks: number;
  total_saved_artworks: number;
  total_customer_artworks: number;
  total_guest_artworks: number;
  new_customers_30d: number;
}

export interface FetchCustomersResponse {
  success: boolean;
  data: CustomerItem[];
  stats: CustomerStats;
}

export interface FetchGuestArtworksResponse {
  success: boolean;
  data: ArtworkDetail[];
  total: number;
}

export const customerService = {
  async getCustomers(params?: {
    search?: string;
    role?: string;
    has_artworks?: string | boolean;
  }): Promise<FetchCustomersResponse> {
    const response = await apiClient.get<FetchCustomersResponse>(API_ENDPOINTS.ADMIN_CUSTOMERS, {
      params,
    });
    return response.data;
  },

  async getCustomerById(id: string | number): Promise<CustomerItem> {
    const response = await apiClient.get<{ success: boolean; data: CustomerItem }>(
      API_ENDPOINTS.ADMIN_CUSTOMER_DETAIL(id)
    );
    return response.data.data;
  },

  async getGuestArtworks(search?: string): Promise<FetchGuestArtworksResponse> {
    const response = await apiClient.get<FetchGuestArtworksResponse>(
      API_ENDPOINTS.ADMIN_CUSTOMER_GUEST_ARTWORKS,
      {
        params: search ? { search } : undefined,
      }
    );
    return response.data;
  },
};
