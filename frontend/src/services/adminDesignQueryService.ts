import apiClient from '@/services/api/client';

export interface DesignQueryFile {
  id: number;
  name: string;
  mime_type?: string | null;
  size_bytes?: number;
  file_type?: string;
  url?: string | null;
}

export interface DesignQueryMessage {
  id: number;
  author: 'customer' | 'employee' | string;
  message: string;
  created_at: string;
}

export interface DesignQuery {
  id: number;
  uuid: string;
  request_type?: string | null;
  product?: string | null;
  quantity?: number | null;
  width?: number | string | null;
  height?: number | string | null;
  unit?: string | null;
  print_sides?: string | null;
  colours?: string | null;
  description?: string | null;
  additional_notes?: string | null;
  requested_date?: string | null;
  status: string;
  is_active?: boolean;
  expires_at?: string | null;
  submitted_at?: string | null;
  created_at?: string;
  files_count?: number;
  files?: DesignQueryFile[];
  messages?: DesignQueryMessage[];
  linked_order?: { id: string; order_number: string; status: string; payment_status: string } | null;
}

const BASE = '/admin/design-queries';

export const adminDesignQueryService = {
  async list(): Promise<DesignQuery[]> {
    const response = await apiClient.get(BASE);
    return response.data?.data?.data ?? [];
  },
  async create(expires_in_days: number) {
    const response = await apiClient.post(BASE, { expires_in_days });
    return response.data.data as { id: number; client_url: string; status: string };
  },
  async get(id: number): Promise<DesignQuery> {
    const response = await apiClient.get(`${BASE}/${id}`);
    return response.data.data;
  },
  async update(id: number, payload: { status?: string; is_active?: boolean }) {
    return apiClient.patch(`${BASE}/${id}`, payload);
  },
  async upload(id: number, file: File, message?: string) {
    const data = new FormData(); data.append('file', file);
    if (message?.trim()) data.append('message', message.trim());
    return apiClient.post(`${BASE}/${id}/design`, data);
  },
  async sendMessage(id: number, message: string) {
    return apiClient.post(`${BASE}/${id}/messages`, { message });
  },
};
