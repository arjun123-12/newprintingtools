import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';

export interface CartItemProduct {
  id: string;
  name: string;
  slug: string;
  thumbnail_url?: string | null;
}

export interface CartItemArtwork {
  id: string;
  name: string;
  thumbnail_url?: string | null;
  width_px?: number;
  height_px?: number;
  dpi?: number;
  unit?: string;
  document_settings?: any;
  design_template_id?: string | null;
}

export interface CartItemData {
  id: string;
  cart_id: string;
  product_id: string;
  product?: CartItemProduct;
  quantity: number;
  selected_options: Record<string, any>;
  artwork_id?: string | null;
  artwork?: CartItemArtwork | null;
  unit_price_ex_gst: number;
  subtotal_ex_gst: number;
  gst_amount: number;
  total_inc_gst: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartData {
  id: string;
  user_id?: number | string | null;
  session_id?: string | null;
  currency: string;
  items_count: number;
  subtotal_ex_gst: number;
  gst_amount: number;
  total_inc_gst: number;
  items: CartItemData[];
}

export interface AddToCartPayload {
  product_id: string;
  quantity: number;
  selected_options?: Record<string, any>;
  artwork_id?: string | null;
  design_canvas_json?: any;
}

function getSessionHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  let sessionId = localStorage.getItem('designer_session_id');
  if (!sessionId) {
    sessionId = 'guest_' + Math.random().toString(36).substring(2) + Date.now();
    localStorage.setItem('designer_session_id', sessionId);
  }
  return { 'X-Session-ID': sessionId };
}

class CartService {
  public async getCart(): Promise<CartData> {
    const response = await apiClient.get(API_ENDPOINTS.CART, {
      headers: getSessionHeader(),
    });
    return response.data?.data;
  }

  public async addItem(payload: AddToCartPayload): Promise<{ item: CartItemData; cart: CartData }> {
    const response = await apiClient.post(API_ENDPOINTS.CART_ITEMS, payload, {
      headers: getSessionHeader(),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
    return response.data?.data;
  }

  public async updateItem(itemId: string, quantity: number, selectedOptions?: Record<string, any>): Promise<{ item: CartItemData; cart: CartData }> {
    const response = await apiClient.put(
      `${API_ENDPOINTS.CART_ITEMS}/${itemId}`,
      { quantity, selected_options: selectedOptions },
      { headers: getSessionHeader() }
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
    return response.data?.data;
  }

  public async removeItem(itemId: string): Promise<{ cart: CartData }> {
    const response = await apiClient.delete(`${API_ENDPOINTS.CART_ITEMS}/${itemId}`, {
      headers: getSessionHeader(),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
    return response.data?.data;
  }

  public async clearCart(): Promise<{ cart: CartData }> {
    const response = await apiClient.delete(API_ENDPOINTS.CART, {
      headers: getSessionHeader(),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
    return response.data?.data;
  }
}

export const cartService = new CartService();
