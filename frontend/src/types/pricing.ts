export interface PricingCalculationRequest {
  product_id: string;
  quantity: number;
  selected_options: Record<string, string>;
  custom_dimensions?: {
    width_mm: number;
    height_mm: number;
  };
  rush_turnaround?: boolean;
}

export interface PricingCalculationResult {
  product_id: string;
  quantity: number;
  unit_price_ex_gst: number;
  unit_price_inc_gst: number;
  subtotal_ex_gst: number;
  gst_amount: number;
  total_inc_gst: number;
  setup_fee: number;
  finishing_fees: Array<{
    name: string;
    amount: number;
  }>;
  currency: 'AUD';
  estimated_dispatch_date: string;
}
