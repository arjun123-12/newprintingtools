import axios from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1';

export interface CustomerReviewData {
  order_number: string;
  status: string;
  payment_status: string;
  customer: {
    name?: string;
    company_name?: string;
    email?: string;
  };
  delivery_summary: {
    method: string;
    address: string;
    city: string;
    state: string;
    postcode: string;
    full_address: string;
  };
  customer_notes?: string;
  items: Array<{
    id: string;
    product_name: string;
    product_sku: string;
    quantity: number;
    specifications: string;
    unit_price_ex_gst: number;
    total_price_inc_gst: number;
    artwork_preview?: {
      has_artwork?: boolean;
      files: Array<{
        label: string;
        file_name?: string;
        url: string;
        mime_type?: string;
        file_size_bytes?: number;
      }>;
      front_url?: string | null;
      back_url?: string | null;
      thumbnail_url?: string | null;
      canvas_json?: unknown;
      document_settings?: CustomerReviewData['proof']['document_settings'];
      dimensions?: CustomerReviewData['proof']['dimensions'];
    };
  }>;
  totals: {
    subtotal_ex_gst: number;
    gst_amount: number;
    shipping_fee_inc_gst: number;
    discount_amount: number;
    total_inc_gst: number;
    currency: string;
  };
  proof: {
    current_version: number;
    version_label: string;
    document_settings?: {
      width?: number;
      height?: number;
      unit?: string;
      dpi?: number;
      bleed?: number;
      safeArea?: number;
      name?: string;
      [key: string]: unknown;
    };
    dimensions?: {
      width_px?: number | null;
      height_px?: number | null;
      dpi?: number | null;
    };
    files: Array<{
      label: string;
      file_name: string;
      url: string;
      file_size_bytes?: number;
      mime_type?: string;
    }>;
    pdf_url?: string;
    thumbnail_url?: string;
    template_canvas_json?: Record<string, unknown> | null;
    template_back_canvas_json?: Record<string, unknown> | null;
    is_approved: boolean;
    approved_at?: string;
    versions: Array<{
      version_number: number;
      label: string;
      files: Array<any>;
      pdf_url?: string;
      thumbnail_url?: string;
      is_approved: boolean;
      uploaded_at: string;
    }>;
  };
}

export const orderReviewService = {
  /**
   * Fetch customer-safe order review details by token
   */
  async getReviewOrder(token: string): Promise<{ success: boolean; data: CustomerReviewData }> {
    const response = await axios.get(`${API_BASE_URL}/order-review/${token}`);
    return response.data;
  },

  /**
   * Submit change request
   */
  async requestChanges(token: string, comment: string) {
    const response = await axios.post(`${API_BASE_URL}/order-review/${token}/request-changes`, {
      comment,
    });
    return response.data;
  },

  /**
   * Approve exact proof version
   */
  async approveProof(token: string, payload: {
    spelling_confirmed: boolean;
    specs_confirmed: boolean;
    proof_version_confirmed: boolean;
    version_number: number;
  }) {
    const response = await axios.post(`${API_BASE_URL}/order-review/${token}/approve`, payload);
    return response.data;
  },

  /**
   * Create BPOINT payment session
   */
  async createPaymentSession(token: string) {
    const response = await axios.post(`${API_BASE_URL}/order-review/${token}/payment-session`);
    return response.data;
  },

  /**
   * Process and verify payment through BPOINT
   */
  async processPayment(token: string, authkey: string) {
    const response = await axios.post(`${API_BASE_URL}/order-review/${token}/process-payment`, {
      authkey,
    });
    return response.data;
  },
};
