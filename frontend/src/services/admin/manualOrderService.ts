import apiClient from '@/services/api/client';

export interface ManualOrderItemPayload {
  id?: string;
  client_key?: string;
  artwork_id?: string | null;
  product_id?: string | null;
  product_name?: string;
  quantity: number;
  unit_price_ex_gst?: number;
  price?: number;
  line_total_ex_gst?: number;
  specifications?: string;
  options?: Record<string, any>;
}

export interface ManualOrderPayload {
  customer_id?: number;
  customer_name?: string;
  customer_email: string;
  customer_phone?: string;
  company_name?: string;
  delivery_method?: string;
  delivery_address: string;
  customer_notes?: string;
  internal_notes?: string;
  order_cutoff_time?: string;
  order_cutoff_timezone?: string;
  proof_watermark_opacity?: number;
  items: ManualOrderItemPayload[];
  shipping_fee?: number;
}

export interface CalculatedTotals {
  items: Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price_ex_gst: number;
    line_total_ex_gst: number;
    line_total_inc_gst: number;
    options: Record<string, any>;
  }>;
  subtotal_ex_gst: number;
  shipping_fee_inc_gst: number;
  gst_amount: number;
  discount_amount: number;
  total_inc_gst: number;
  currency: string;
}

export interface ManualOrderListItem {
  id: string;
  order_number: string;
  customer: {
    id?: number;
    name: string;
    email: string;
    company_name?: string;
  };
  product_summary: string;
  status: string;
  payment_status: string;
  total: number;
  total_formatted: string;
  date: string;
  created_at: string;
  proof_version: string;
  review_link?: {
    status: string;
    open_count: number;
    last_opened_at?: string;
    expires_at?: string;
  } | null;
}

export interface ManualOrderDetail {
  id: string;
  order_number: string;
  status: string;
  status_label?: string;
  shipping_carrier?: string | null;
  tracking_number?: string | null;
  carrier_tracking_url?: string | null;
  payment_status: string;
  customer: {
    id?: number;
    name: string;
    email: string;
    phone?: string;
    company_name?: string;
  };
  delivery_method: string;
  delivery_address: string;
  shipping_address: Record<string, any>;
  billing_address: Record<string, any>;
  customer_notes?: string;
  internal_notes?: string;
  order_cutoff_time?: string | null;
  order_cutoff_timezone?: string | null;
  proof_watermark_opacity?: number | null;
  subtotal_ex_gst: number;
  gst_amount: number;
  shipping_fee_inc_gst: number;
  discount_amount: number;
  total_inc_gst: number;
  currency: string;
  current_proof_version: number;
  approved_proof_version?: number | null;
  proof_approved_at?: string | null;
  proof_approved_by?: string | null;
  reminder_sent_at?: string | null;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price_ex_gst: number;
    total_price_inc_gst: number;
    specifications: string;
    options: Record<string, any>;
    production_status: string;
  }>;
  proof: {
    current_version: number;
    status: string;
    files: Array<{
      label: string;
      file_name: string;
      url: string;
      storage_path?: string;
      file_size_bytes?: number;
      mime_type?: string;
    }>;
    versions: Array<{
      id: string;
      version_number: number;
      label: string;
      files: Array<any>;
      pdf_url?: string;
      thumbnail_url?: string;
      is_approved: boolean;
      uploaded_at: string;
      uploaded_at_formatted: string;
      change_summary?: string;
    }>;
  };
  review_link?: {
    id: string;
    token: string;
    url: string;
    status: string;
    open_count: number;
    last_opened_at?: string;
    last_opened_at_exact?: string;
    expires_at?: string;
    is_valid: boolean;
  } | null;
  activities: Array<{
    id: string;
    event_type: string;
    description: string;
    actor_type: string;
    actor_name?: string;
    metadata?: any;
    created_at: string;
    time_ago: string;
  }>;
  created_at: string;
  updated_at: string;
}

export const manualOrderService = {
  /**
   * List all manual orders with filters
   */
  async getOrders(params?: {
    status?: string;
    search?: string;
    customer_id?: number;
    pending_approval?: boolean;
    pending_payment?: boolean;
    page?: number;
    per_page?: number;
  }) {
    const response = await apiClient.get('/admin/manual-orders', { params });
    return response.data;
  },

  /**
   * Get manual order details
   */
  async getOrder(id: string): Promise<{ success: boolean; data: ManualOrderDetail }> {
    const response = await apiClient.get(`/admin/manual-orders/${id}`);
    return response.data;
  },

  /**
   * Calculate live server-side totals
   */
  async calculateTotals(data: {
    items: ManualOrderItemPayload[];
    delivery_method?: string;
    shipping_fee?: number;
  }): Promise<{ success: boolean; data: CalculatedTotals }> {
    const response = await apiClient.post('/admin/manual-orders/calculate', data);
    return response.data;
  },

  /**
   * Create new manual order as draft
   */
  async createOrder(payload: ManualOrderPayload) {
    const response = await apiClient.post('/admin/manual-orders', payload);
    return response.data;
  },

  /**
   * Update manual order
   */
  async updateOrder(id: string, payload: Partial<ManualOrderPayload>) {
    const response = await apiClient.put(`/admin/manual-orders/${id}`, payload);
    return response.data;
  },

  /**
   * Upload proof files for an order
   */
  async uploadProof(id: string, files: File[], version?: number, orderItemId?: string, labels?: string[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files[]', file));
    if (labels && labels.length > 0) {
      labels.forEach((label) => formData.append('labels[]', label));
    }
    if (version) {
      formData.append('version', String(version));
    }
    if (orderItemId) {
      formData.append('order_item_id', orderItemId);
    }
    const response = await apiClient.post(`/admin/manual-orders/${id}/proofs`, formData);
    return response.data;
  },

  async attachArtwork(orderId: string, itemId: string, artworkId: string) {
    const response = await apiClient.post(
      `/admin/manual-orders/${orderId}/items/${itemId}/artwork`,
      { artwork_id: artworkId }
    );
    return response.data;
  },

  /**
   * Send order to customer for review and approval
   */
  async sendForApproval(id: string) {
    const response = await apiClient.post(`/admin/manual-orders/${id}/send-for-approval`);
    return response.data;
  },

  /**
   * Regenerate review link
   */
  async regenerateLink(id: string) {
    const response = await apiClient.post(`/admin/manual-orders/${id}/regenerate-link`);
    return response.data;
  },

  /**
   * Revoke review link
   */
  async revokeLink(id: string) {
    const response = await apiClient.post(`/admin/manual-orders/${id}/revoke-link`);
    return response.data;
  },

  /**
   * Send reminder to customer
   */
  async sendReminder(id: string) {
    const response = await apiClient.post(`/admin/manual-orders/${id}/send-reminder`);
    return response.data;
  },

  /**
   * Move order to production
   */
  async moveToProduction(id: string) {
    const response = await apiClient.post(`/admin/manual-orders/${id}/move-to-production`);
    return response.data;
  },

  /**
   * Update order production & shipping status with audit history
   */
  async updateProductionStatus(
    id: string,
    payload: {
      status: string;
      carrier?: string;
      tracking_number?: string;
      shipping_carrier?: string;
    }
  ): Promise<{ success: boolean; message: string; data: any }> {
    const response = await apiClient.post(`/admin/manual-orders/${id}/production-status`, payload);
    return response.data;
  },

  /**
   * Delete order directly from database
   */
  async deleteOrder(id: string) {
    const response = await apiClient.delete(`/admin/manual-orders/${id}`);
    return response.data;
  },

  /**
   * Delete order item directly from database
   */
  async deleteOrderItem(orderId: string, itemId: string) {
    const response = await apiClient.delete(`/admin/manual-orders/${orderId}/items/${itemId}`);
    return response.data;
  },
};
