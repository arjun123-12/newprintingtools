import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';

export interface CheckoutAddress {
  name: string;
  email?: string;
  phone: string;
  company?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  suburb?: string;
  state: string;
  postcode: string;
  country: string;
}

export interface CheckoutShippingMethod {
  id: string;
  name: string;
  price_inc_gst: number;
  original_price?: number;
  is_free?: boolean;
  estimated_days: string;
}

export interface CheckoutItem {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_sku: string;
  thumbnail_url: string | null;
  quantity: number;
  selected_options: Record<string, any>;
  artwork_id?: string | null;
  artwork?: {
    id: string;
    name: string;
    thumbnail_url?: string | null;
    width_px?: number;
    height_px?: number;
    dpi?: number;
    unit?: string;
  } | null;
  unit_price_ex_gst: number;
  unit_price_inc_gst: number;
  subtotal_ex_gst: number;
  gst_amount: number;
  total_inc_gst: number;
}

export interface CheckoutDataResponse {
  user: {
    id: string | number;
    name: string;
    email: string;
    phone?: string | null;
    company_name?: string | null;
  };
  is_empty: boolean;
  cart_id?: string;
  items: CheckoutItem[];
  items_count: number;
  subtotal_ex_gst: number;
  gst_amount: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  saved_addresses: any[];
  default_shipping_address: any | null;
  default_billing_address: any | null;
  available_shipping_methods: CheckoutShippingMethod[];
  selected_shipping_method?: CheckoutShippingMethod;
}

export interface CheckoutValidationPayload {
  shipping_address: CheckoutAddress;
  billing_address_same_as_shipping: boolean;
  billing_address?: CheckoutAddress;
  shipping_method_id: string;
  customer_notes?: string;
  save_address?: boolean;
}

export interface CheckoutValidationResponse {
  success: boolean;
  message?: string;
  data: {
    user: CheckoutDataResponse['user'];
    cart_id: string;
    items: CheckoutItem[];
    items_count: number;
    subtotal_ex_gst: number;
    gst_amount: number;
    shipping: number;
    shipping_method: CheckoutShippingMethod;
    discount: number;
    total: number;
    currency: string;
    shipping_address: CheckoutAddress;
    billing_address: CheckoutAddress;
    billing_address_same_as_shipping: boolean;
    customer_notes?: string | null;
    validated_at: string;
  };
}

export interface CreatedOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal_ex_gst: number;
  gst_amount: number;
  shipping_fee_inc_gst: number;
  discount_amount: number;
  total_inc_gst: number;
  total: number;
  currency: string;
  customer?: {
    id: number | string;
    name: string;
    email: string;
    phone?: string;
  };
  shipping_address: CheckoutAddress;
  billing_address: CheckoutAddress;
  shipping_carrier?: string;
  customer_notes?: string;
  items_count: number;
  items: any[];
  created_at: string;
}

class CheckoutService {
  /**
   * Loads initial checkout data (user details, cart contents, saved addresses, shipping options)
   */
  public async getCheckoutData(): Promise<CheckoutDataResponse> {
    const response = await apiClient.get(API_ENDPOINTS.CHECKOUT_DATA);
    return response.data?.data;
  }

  /**
   * Validates checkout information with authoritative backend verification.
   * Recalculates prices, verifies availability, and returns verified order totals.
   */
  public async validateCheckout(
    payload: CheckoutValidationPayload
  ): Promise<CheckoutValidationResponse> {
    const response = await apiClient.post(API_ENDPOINTS.CHECKOUT_VALIDATE, payload);
    return response.data;
  }

  /**
   * Creates a pending order atomically inside a backend database transaction.
   * Preserves frozen product and address snapshots, artwork references, and pending status.
   */
  public async createOrder(payload: any): Promise<{
    success: boolean;
    message: string;
    data: CreatedOrder;
  }> {
    const response = await apiClient.post(API_ENDPOINTS.ORDERS, payload);
    return response.data;
  }

  /**
   * Fetches order details by order_number or UUID.
   */
  public async getOrder(identifier: string): Promise<CreatedOrder> {
    const response = await apiClient.get(API_ENDPOINTS.ORDER_DETAIL(identifier));
    return response.data?.data;
  }

  /**
   * Retrieves saved addresses for the authenticated customer.
   */
  public async getSavedAddresses(): Promise<any[]> {
    const response = await apiClient.get(API_ENDPOINTS.ADDRESSES);
    return response.data?.data || [];
  }

  public async createPaymentSession(orderNumber: string) {
    const response = await apiClient.post(
      API_ENDPOINTS.ORDER_PAYMENT_SESSION(orderNumber)
    );

    return response.data;
  }

  /**
   * Submits payment authorization key to backend to verify and process the transaction with BPOINT.
   */
  public async processPayment(orderNumber: string, authkey: string) {
    const response = await apiClient.post(
      API_ENDPOINTS.ORDER_PROCESS_PAYMENT(orderNumber),
      { authkey }
    );

    return response.data;
  }
}

export const checkoutService = new CheckoutService();

