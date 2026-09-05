import { PrintSides, PrintSettings } from '@/types/designer';

export interface TemplateFormData {
  name: string;
  category: string;
  product_id: string;
  thumbnail_url: string;
  is_active: boolean;
  print_sides: PrintSides;
  width_mm: number | null;
  height_mm: number | null;
  margin_mm: number;
  bleed_mm: number;
  safe_area_mm: number;
  canvas_json?: any;
  back_canvas_json?: any;
  template_json?: any;
  artwork_config?: any;
  attributes?: any[];
}

export interface TemplateListItem {
  id: string;
  product_id: string;
  name: string;
  category: string | null;
  thumbnail_url: string | null;
  print_sides?: PrintSides;
  width_mm?: number | null;
  height_mm?: number | null;
  margin_mm?: number;
  bleed_mm?: number;
  safe_area_mm?: number;
  resolved_print_settings?: PrintSettings;
  artwork_config?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    slug: string;
    print_sides?: PrintSides;
    width_mm?: number | null;
    height_mm?: number | null;
    margin_mm?: number;
    bleed_mm?: number;
    safe_area_mm?: number;
  } | null;
}

export interface ProductOption {
  id: string;
  name: string;
  slug?: string;
  print_sides?: PrintSides;
  width_mm?: number | null;
  height_mm?: number | null;
  margin_mm?: number;
  bleed_mm?: number;
  safe_area_mm?: number;
}

export type TemplateFormErrors = Record<string, string>;

