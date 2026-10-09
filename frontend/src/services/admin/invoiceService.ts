import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';

export interface InvoiceUser {
  id: number | string;
  name: string;
  email: string;
  phone?: string | null;
  company_name?: string | null;
  abn?: string | null;
  role?: string;
}

export interface InvoicePaymentPayload {
  txn_number?: string;
  receipt_number?: string;
  authorise_id?: string;
  response_code?: string;
  response_text?: string;
  bank_response_code?: string;
  settlement_date?: string;
  card_scheme?: string;
  card_type?: string;
  card_masked?: string;
  processed_at?: string;
  [key: string]: any;
}

export interface InvoicePayment {
  id: string;
  order_id: string;
  gateway: string;
  transaction_id?: string | null;
  amount: string | number;
  currency: string;
  status: 'pending' | 'succeeded' | 'paid' | 'failed' | 'refunded' | string;
  payload?: InvoicePaymentPayload | null;
  created_at: string;
  updated_at?: string;
}

export interface InvoiceOrderItem {
  id: string;
  product_id?: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price_ex_gst: string | number;
  unit_price_inc_gst?: string | number;
  total_price_inc_gst: string | number;
  options_snapshot?: Record<string, any> | null;
  production_status?: string;
  artwork_id?: string | null;
}

export interface LinkedInvoice {
  id: string;
  order_id: string;
  invoice_number: string;
  pdf_path?: string | null;
  status: 'draft' | 'issued' | 'paid' | 'void' | string;
  issued_at: string;
  due_at?: string | null;
  created_at?: string;
}

export interface TaxInvoiceOrder {
  id: string;
  order_number: string;
  user_id?: number | string;
  status: string;
  payment_status: 'unpaid' | 'authorized' | 'paid' | 'failed' | 'refunded' | string;
  subtotal_ex_gst: string | number;
  gst_amount: string | number;
  shipping_fee_inc_gst: string | number;
  discount_amount: string | number;
  total_inc_gst: string | number;
  currency: string;
  shipping_address: {
    name: string;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    postcode: string;
    country?: string | null;
  };
  billing_address?: {
    name: string;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    postcode: string;
    country?: string | null;
  } | null;
  shipping_carrier?: string | null;
  tracking_number?: string | null;
  customer_notes?: string | null;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
  user?: InvoiceUser | null;
  payments: InvoicePayment[];
  items: InvoiceOrderItem[];
  invoice?: LinkedInvoice | null;
}

export interface InvoiceStats {
  total_revenue_inc_gst: number;
  total_subtotal_ex_gst: number;
  total_gst_collected: number;
  successful_payments_count: number;
  total_orders_count: number;
  gateways: Record<string, { count: number; amount: number }>;
}

export interface StoreTaxInfo {
  name: string;
  trading_name?: string;
  abn: string;
  email: string;
  phone: string;
  address_line_1: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  gst_rate: number;
}

export interface FetchInvoicesResponse {
  success: boolean;
  data: TaxInvoiceOrder[];
  stats: InvoiceStats;
  store_info: StoreTaxInfo;
}

export interface FetchInvoiceDetailResponse {
  success: boolean;
  data: TaxInvoiceOrder;
  store_info: StoreTaxInfo;
}

export const invoiceService = {
  async getInvoices(params?: {
    search?: string;
    payment_status?: string;
    gateway?: string;
    sort_by?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<FetchInvoicesResponse> {
    const response = await apiClient.get<FetchInvoicesResponse>(API_ENDPOINTS.ADMIN_INVOICES, {
      params,
    });
    return response.data;
  },

  async getInvoiceDetail(id: string): Promise<FetchInvoiceDetailResponse> {
    const response = await apiClient.get<FetchInvoiceDetailResponse>(
      API_ENDPOINTS.ADMIN_INVOICE_DETAIL(id)
    );
    return response.data;
  },
};
