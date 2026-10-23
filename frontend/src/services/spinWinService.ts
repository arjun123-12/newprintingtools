import { apiClient } from './api/client';

export interface RewardCategory {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  rewards_count?: number;
  active_rewards_count?: number;
}

export interface WheelSegment {
  index: number;
  id: number;
  category_id?: number;
  category_code?: string;
  category_name?: string;
  code: string;
  title: string;
  badge_text?: string | null;
  reward_type: 'print_credit' | 'free_product' | 'premium_upgrade' | 'shipping_upgrade';
  value: number;
  inventory?: number | null;
  terms_text: string;
  how_to_use: string;
  color_bg: string;
  color_text: string;
  icon?: string;
}

export interface WonPrize {
  id: string;
  category_id?: number;
  category_name?: string;
  reward_code: string;
  title: string;
  badge_text?: string | null;
  reward_type: 'print_credit' | 'free_product' | 'premium_upgrade' | 'shipping_upgrade';
  value: number;
  segment_index: number;
  terms_text: string;
  how_to_use: string;
  expires_at: string;
  status?: string;
  claim_token?: string | null;
}

export interface SpinEligibilityResponse {
  eligible: boolean;
  reason?: string;
  has_spun?: boolean;
  order_number?: string;
  spin_token?: string;
  category?: {
    id: number;
    code: string;
    name: string;
    description?: string;
    is_default: boolean;
  } | null;
  prize?: WonPrize | null;
  wheel_segments?: WheelSegment[];
  min_order_spend?: number;
  order_total?: number;
}

export interface CustomerRewardItem {
  id: string;
  category_id?: number;
  category_name?: string;
  reward_code: string;
  reward_type: 'print_credit' | 'free_product' | 'premium_upgrade' | 'shipping_upgrade';
  title: string;
  badge_text?: string | null;
  value: number;
  terms: string;
  how_to_use: string;
  expires_at: string;
  status: 'active' | 'redeemed' | 'expired';
  order_number?: string;
  created_at: string;
}

export interface CustomerRewardsResponse {
  print_bank_balance: number;
  rewards_count: number;
  active_rewards_count: number;
  customer_business_category?: string | null;
  rewards: CustomerRewardItem[];
}

export const spinWinService = {
  /**
   * Check eligibility for a paid order and fetch the active category wheel layout.
   * Supports both cart orders (orderNumber) and manual-order review links (reviewToken).
   */
  async checkEligibility(orderNumber?: string, reviewToken?: string): Promise<SpinEligibilityResponse> {
    const params: Record<string, string> = {};
    if (orderNumber) params.order_number = orderNumber;
    if (reviewToken) params.review_token = reviewToken;
    const res = await apiClient.get('/spin-win/eligibility', { params });
    return res.data?.data;
  },

  /**
   * Execute server-side prize selection before the wheel animation starts.
   * Supports both cart orders (orderNumber) and manual-order review links (reviewToken).
   */
  async spin(
    orderNumber: string | undefined,
    spinToken: string,
    reviewToken?: string
  ): Promise<{ prize: WonPrize; category?: any; already_spun?: boolean }> {
    const payload: Record<string, any> = { spin_token: spinToken };
    if (orderNumber) payload.order_number = orderNumber;
    if (reviewToken) payload.review_token = reviewToken;
    const res = await apiClient.post('/spin-win/spin', payload);
    return res.data?.data;
  },

  /**
   * Validate a reward voucher code for application on future checkout.
   */
  async validateVoucher(code: string, subtotal?: number) {
    const res = await apiClient.post('/spin-win/validate-voucher', {
      code,
      subtotal,
    });
    return res.data?.data;
  },

  /**
   * Get active reward categories for customer profile selection.
   */
  async getRewardCategories(): Promise<RewardCategory[]> {
    const res = await apiClient.get('/spin-win/categories');
    return res.data?.data || [];
  },

  /**
   * Update customer profile including business category.
   */
  async updateCustomerProfile(payload: {
    name?: string;
    phone?: string;
    company_name?: string;
    business_category?: string;
    abn?: string;
  }) {
    const res = await apiClient.put('/customers/profile', payload);
    return res.data;
  },

  /**
   * Get authenticated customer's reward ledger and Print Bank balance.
   */
  async getCustomerRewards(): Promise<CustomerRewardsResponse> {
    const res = await apiClient.get('/rewards/my-rewards');
    return res.data?.data;
  },

  /**
   * Admin: Get all segments, categories, stats, and platform settings.
   */
  async getAdminSettings() {
    const res = await apiClient.get('/admin/spin-win/settings');
    return res.data?.data;
  },

  /**
   * Admin: Update platform settings and segments.
   */
  async updateAdminSettings(payload: any) {
    const res = await apiClient.put('/admin/spin-win/settings', payload);
    return res.data;
  },

  /**
   * Admin: List all reward categories.
   */
  async getAdminCategories(): Promise<RewardCategory[]> {
    const res = await apiClient.get('/admin/spin-win/categories');
    return res.data?.data || [];
  },

  /**
   * Admin: Create a new reward category.
   */
  async createAdminCategory(payload: Partial<RewardCategory>): Promise<RewardCategory> {
    const res = await apiClient.post('/admin/spin-win/categories', payload);
    return res.data?.data;
  },

  /**
   * Admin: Update a reward category.
   */
  async updateAdminCategory(id: number, payload: Partial<RewardCategory>): Promise<RewardCategory> {
    const res = await apiClient.put(`/admin/spin-win/categories/${id}`, payload);
    return res.data?.data;
  },

  /**
   * Admin: Safely delete a category with automatic fallback migration for its rewards.
   */
  async deleteAdminCategory(id: number): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete(`/admin/spin-win/categories/${id}`);
    return res.data;
  },

  /**
   * Admin: Delete an individual reward segment.
   */
  async deleteAdminReward(id: number): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete(`/admin/spin-win/rewards/${id}`);
    return res.data;
  },

  /**
   * Admin: View durable spin & redemption ledger.
   */
  async getAdminLedger(params?: { page?: number; search?: string; status?: string; category_id?: number }) {
    const res = await apiClient.get('/admin/spin-win/ledger', { params });
    return res.data?.data;
  },
};
