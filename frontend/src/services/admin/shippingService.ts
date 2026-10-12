import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';

export interface CarrierConfigStatus {
  carrier: string;
  environment: 'sandbox' | 'production' | string;
  is_sandbox: boolean;
  has_credentials: boolean;
  account_number_masked: string | null;
  dispatch_origin_configured: boolean;
  dispatch_suburb: string | null;
  dispatch_postcode: string | null;
  dispatch_state: string | null;
  dispatch_name: string | null;
  dispatch_company: string | null;
  enable_delivery_choices: boolean;
  enable_pickups: boolean;
  default_rate_card: string;
}

export interface ShipmentRecord {
  id: string;
  order_id: string;
  carrier: string;
  consignment_code: string;
  reference_number?: string | null;
  job_number?: string | null;
  rate_card_id?: string | null;
  rate_card_description?: string | null;
  freight_charge?: string | number;
  fuel_charge?: string | number;
  gst_charge?: string | number;
  total_charge?: string | number;
  label_url?: string | null;
  status: string;
  tracking_data?: any;
  created_at: string;
  shipped_at?: string | null;
}

export interface ShippingOrderAddress {
  name?: string;
  company?: string;
  address_line_1?: string;
  address_line_2?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  phone?: string;
  country?: string;
}

export interface ShippingOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  shipping_carrier?: string | null;
  tracking_number?: string | null;
  shipping_address: ShippingOrderAddress;
  billing_address?: ShippingOrderAddress;
  shipping_fee_inc_gst: string | number;
  total_inc_gst: string | number;
  customer_notes?: string | null;
  created_at: string;
  user?: {
    id: string | number;
    name: string;
    email: string;
    phone?: string;
  };
  items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    total_price_inc_gst: string | number;
  }>;
  shipments?: ShipmentRecord[];
}

export interface TrackingMilestone {
  date: string;
  time: string;
  action: string;
  contractor?: string;
  location?: string;
}

export interface TrackingResponse {
  tracking_code: string;
  status: string;
  eta?: string | null;
  pod?: string | null;
  delivered_at?: string | null;
  dead_weight?: string | null;
  events: TrackingMilestone[];
  order_number?: string;
  carrier?: string;
}

export interface FetchShippingOrdersResponse {
  status: string;
  data: ShippingOrder[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  carrier_config: CarrierConfigStatus;
}

export const shippingService = {
  async getStatus(): Promise<CarrierConfigStatus> {
    const res = await apiClient.get<{ status: string; data: CarrierConfigStatus }>(
      API_ENDPOINTS.ADMIN_SHIPPING_STATUS
    );
    return res.data.data;
  },

  async updateOrigin(data: {
    suburb: string;
    postcode: string;
    state?: string;
    name?: string;
    company_name?: string;
    phone?: string;
    email?: string;
    address1?: string;
  }): Promise<{ status: string; message: string }> {
    const res = await apiClient.post(API_ENDPOINTS.ADMIN_SHIPPING_ORIGIN, data);
    return res.data;
  },

  async getOrders(params?: {
    status?: 'all' | 'ready_to_ship' | 'shipped';
    search?: string;
    page?: number;
  }): Promise<FetchShippingOrdersResponse> {
    const res = await apiClient.get<FetchShippingOrdersResponse>(
      API_ENDPOINTS.ADMIN_SHIPPING_ORDERS,
      { params }
    );
    return res.data;
  },

  async createShipment(
    orderId: string,
    options?: {
      rate_card_id?: string;
      is_signature_required?: boolean;
      is_atl?: boolean;
    }
  ): Promise<{ status: string; message: string; data: { shipment: ShipmentRecord; order: ShippingOrder } }> {
    const res = await apiClient.post(API_ENDPOINTS.ADMIN_SHIPPING_CREATE(orderId), options ?? {});
    return res.data;
  },

  async trackParcel(consignmentNumber: string): Promise<TrackingResponse> {
    const res = await apiClient.get<{ status: string; data: TrackingResponse }>(
      API_ENDPOINTS.ADMIN_SHIPPING_TRACK(consignmentNumber)
    );
    return res.data.data;
  },

  async getCustomerTracking(orderId: string): Promise<TrackingResponse> {
    const res = await apiClient.get<{ status: string; data: TrackingResponse }>(
      API_ENDPOINTS.CUSTOMER_ORDER_TRACKING(orderId)
    );
    return res.data.data;
  },

  getLabelDownloadUrl(consignmentNumber: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
    return `${baseUrl}/admin/shipping/shipments/${encodeURIComponent(consignmentNumber)}/label`;
  },
};
