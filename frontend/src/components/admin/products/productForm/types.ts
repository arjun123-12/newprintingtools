import { ProductType } from '@/types/product';

export interface CategoryOption {
  id: string;
  name: string;
  slug?: string;
}

export interface PricingTierItem {
  id: string;
  minQuantity: number;
  maxQuantity: number | '';
  price: number;
}

export interface AttributeValueItem {
  id: string;
  label: string;
  value: string;
  price_modifier_amount?: number;
  price_modifier_type?: 'fixed' | 'percentage' | 'multiplier';
}

export interface AttributeItem {
  id: string;
  name: string;
  code: string;
  type: 'select' | 'radio' | 'color' | 'custom_dimensions';
  is_required: boolean;
  values: AttributeValueItem[];
}

export interface VariantItem {
  id: string;
  name: string;
  sku: string;
  size?: string;
  material?: string;
  finish?: string;
  base_price: number;
  sale_price?: number | '';
  stock?: number;
  is_active: boolean;
}

export interface PrintAreaItem {
  id: string;
  name: string;
  side: 'front' | 'back' | 'custom';
  width_mm: number;
  height_mm: number;
  bleed_mm: number;
  safe_zone_mm: number;
  dpi: number;
}

export interface ProductFormData {
  // 1. Basic Info
  name: string;
  slug: string;
  sku: string;
  category_id: string;
  product_type: ProductType;

  // 2. Content
  short_description: string;
  description: string;

  // 3. Media
  featured_image_url: string;
  gallery_images: string[];

  // 4. Configuration
  min_quantity: number;
  turnaround_days: number;
  allow_custom_design: boolean;
  allow_customer_upload: boolean;
  is_active: boolean;
  is_featured: boolean;
  status: 'draft' | 'published' | 'archived';

  // 5. Attributes & Variants
  attributes: AttributeItem[];
  variants: VariantItem[];

  // 6. Pricing
  base_price: number;
  sale_price: number | '';
  cost_price: number | '';
  pricing_tiers: PricingTierItem[];

  // 7. Print Areas
  print_areas: PrintAreaItem[];

  // 8. Design Templates
  design_template_ids: string[];

  // 9. Inventory
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;

  // 10. Shipping
  weight_kg: number | '';
  length_cm: number | '';
  width_cm: number | '';
  height_cm: number | '';
  free_shipping: boolean;

  // 11. SEO
  meta_title: string;
  meta_description: string;
}

export type FormErrors = Record<string, string>;
