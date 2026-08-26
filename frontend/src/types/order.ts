import { Address } from './common';
import { ArtworkFile } from './artwork';
import { DesignerCanvasState } from './designer';

export type OrderStatus =
  | 'pending_payment'
  | 'processing'
  | 'artwork_required'
  | 'artwork_review'
  | 'in_production'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'unpaid' | 'paid' | 'authorized' | 'failed' | 'refunded';

export interface OrderItemOption {
  attribute_id: string;
  attribute_name: string;
  value_id: string;
  value_label: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price_ex_gst: number;
  unit_price_inc_gst: number;
  total_price_inc_gst: number;
  options: OrderItemOption[];
  artwork_id?: string;
  artwork?: ArtworkFile;
  designer_canvas_state?: DesignerCanvasState;
  production_status: 'queued' | 'prepress' | 'printing' | 'finishing' | 'packaging' | 'completed';
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  items: OrderItem[];
  subtotal_ex_gst: number;
  gst_amount: number;
  shipping_fee_inc_gst: number;
  total_inc_gst: number;
  currency: 'AUD';
  shipping_address: Address;
  billing_address: Address;
  shipping_carrier?: string;
  tracking_number?: string;
  created_at: string;
  updated_at: string;
}
