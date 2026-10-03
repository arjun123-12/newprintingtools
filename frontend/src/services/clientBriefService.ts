import api from '@/services/api/client';
import briefApiClient from '@/services/api/briefClient';

export interface ClientBrief {
    id: number;
    uuid: string;

    client_name: string | null;
    company_name: string | null;
    email: string | null;
    phone?: string | null;

    status: string;
    is_active?: boolean;

    expires_at: string | null;
    submitted_at?: string | null;

    files_count?: number;

    created_at?: string;
    updated_at?: string;
}

export interface CreateClientBriefPayload {
    client_name?: string;
    company_name?: string;
    email?: string;
    expires_in_days?: number;
}

export interface CreatedClientBrief {
    id: number;
    uuid: string;

    client_name: string | null;
    email: string | null;

    status: string;
    expires_at: string | null;

    client_url: string;
}

export interface ClientBriefListResponse {
    current_page: number;
    data: ClientBrief[];
    last_page: number;
    per_page: number;
    total: number;
}

export const clientBriefService = {
    // ==========================================
    // CLIENT BRIEF ADMIN
    // Uses brief_auth_token
    // ==========================================

    async getAdminBriefs(): Promise<ClientBriefListResponse> {
        const response =
            await briefApiClient.get(
                '/admin/client-briefs'
            );

        return response.data.data;
    },

    async createBrief(
        payload: CreateClientBriefPayload
    ): Promise<CreatedClientBrief> {
        const response =
            await briefApiClient.post(
                '/admin/client-briefs',
                payload
            );

        return response.data.data;
    },

    async getAdminBrief(id: number) {
        const response =
            await briefApiClient.get(
                `/admin/client-briefs/${id}`
            );

        return response.data.data;
    },

    async updateBrief(
        id: number,
        payload: {
            status?: string;
            is_active?: boolean;
            expires_at?: string | null;
        }
    ) {
        const response =
            await briefApiClient.patch(
                `/admin/client-briefs/${id}`,
                payload
            );

        return response.data.data;
    },

    // ==========================================
    // PUBLIC CLIENT FORM
    // No Client Brief admin token required
    // ==========================================

    async getPublicBrief(token: string) {
        const response =
            await api.get(
                `/client-brief/${encodeURIComponent(
                    token
                )}`
            );

        return response.data.data;
    },
};