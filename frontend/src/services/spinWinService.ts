import { apiClient } from './api/client';

export interface WheelSegment {
  index: number;
  id: number;
  code: string;
  title: string;
  badge_text?: string | null;
  reward_type: 'print_credit' | 'free_product' | 'premium_upgrade' | 'shipping_upgrade';
  value: number;
  terms_text: string;
  how_to_use: string;
  color_bg: string;
  color_text: string;
  icon?: string;
}

export interface WonPrize {
  id: string;
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
  prize?: WonPrize | null;
  wheel_segments?: WheelSegment[];
  min_order_spend?: number;
  order_total?: number;
}

export interface CustomerRewardItem {
  id: string;
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
  rewards: CustomerRewardItem[];
}

export const spinWinService = {
  /**
   * Check eligibility for a paid order and fetch the active wheel layout.
   */
  async checkEligibility(orderNumber: string): Promise<SpinEligibilityResponse> {
    const res = await apiClient.get('/spin-win/eligibility', {
      params: { order_number: orderNumber },
    });
    return res.data?.data;
  },

  /**
   * Execute server-side prize selection before the wheel animation starts.
   */
  async spin(orderNumber: string, spinToken: string): Promise<{ prize: WonPrize; already_spun?: boolean }> {
    const res = await apiClient.post('/spin-win/spin', {
      order_number: orderNumber,
      spin_token: spinToken,
    });
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
   * Get authenticated customer's reward ledger and Print Bank balance.
   */
  async getCustomerRewards(): Promise<CustomerRewardsResponse> {
    const res = await apiClient.get('/rewards/my-rewards');
    return res.data?.data;
  },

  /**
   * Admin: Get all segments, stats, and platform settings.
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
   * Admin: View durable spin & redemption ledger.
   */
  async getAdminLedger(params?: { page?: number; search?: string; status?: string }) {
    const res = await apiClient.get('/admin/spin-win/ledger', { params });
    return res.data?.data;
  },
};
