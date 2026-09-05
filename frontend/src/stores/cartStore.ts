import { create } from 'zustand';
import { cartService, CartData, CartItemData } from '@/services/cartService';

interface CartState {
  cart: CartData | null;
  items: CartItemData[];
  itemsCount: number;
  isLoading: boolean;
  fetchCart: () => Promise<void>;
  setCart: (cart: CartData) => void;
}

export const useCartStore = create<CartState>((set) => ({
  cart: null,
  items: [],
  itemsCount: 0,
  isLoading: false,

  setCart: (cart: CartData) => {
    set({
      cart,
      items: cart?.items || [],
      itemsCount: cart?.items_count || 0,
    });
  },

  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const cart = await cartService.getCart();
      set({
        cart,
        items: cart?.items || [],
        itemsCount: cart?.items_count || 0,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));

// Auto-sync with window events
if (typeof window !== 'undefined') {
  window.addEventListener('cart-updated', () => {
    void useCartStore.getState().fetchCart();
  });

  // Initial load
  setTimeout(() => {
    void useCartStore.getState().fetchCart();
  }, 100);
}
