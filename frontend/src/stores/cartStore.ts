import { create } from 'zustand';
import { OrderItem } from '@/types';

interface CartState {
  items: OrderItem[];
  addItem: (item: OrderItem) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (itemId) => set((state) => ({ items: state.items.filter((i) => i.id !== itemId) })),
  clearCart: () => set({ items: [] }),
}));
