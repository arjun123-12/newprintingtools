export interface TemplateFormData {
  name: string;
  category: string;
  product_id: string;
  thumbnail_url: string;
  is_active: boolean;
  canvas_json?: any;
  attributes?: any[];
}


export interface TemplateListItem {
  id: string;
  product_id: string;
  name: string;
  category: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface ProductOption {
  id: string;
  name: string;
  slug?: string;
}

export type TemplateFormErrors = Record<string, string>;
