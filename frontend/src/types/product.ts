export type ProductType = 'standard_print' | 'custom_dimension' | 'apparel' | 'signage' | 'stationery';

export interface Category {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
  children?: Category[];
}

export interface ProductAttributeValue {
  id: string;
  label: string;
  value: string;
  description?: string;
  price_modifier_type?: 'fixed' | 'percentage' | 'multiplier';
  price_modifier_amount?: number;
  sort_order: number;
}

export interface ProductAttribute {
  id: string;
  name: string;
  code: string;
  type: 'select' | 'radio' | 'color' | 'custom_dimensions';
  is_required: boolean;
  values: ProductAttributeValue[];
  sort_order: number;
}

export interface PrintAreaSpecification {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  bleed_mm: number;
  safe_zone_mm: number;
  cut_line_color?: string;
}

export interface Product {
  id: string;
  category_id: string;
  category?: Category;
  name: string;
  slug: string;
  sku: string;
  description: string;
  short_description?: string;
  product_type: ProductType;
  min_quantity: number;
  turnaround_days: number;
  is_active: boolean;
  featured_image_url: string;
  gallery_images: string[];
  attributes: ProductAttribute[];
  print_areas: PrintAreaSpecification[];
}
