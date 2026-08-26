export type ArtworkStatus =
  | 'uploaded'
  | 'preflight_passed'
  | 'preflight_warning'
  | 'preflight_failed'
  | 'customer_approved'
  | 'ready_for_production'
  | 'rejected';

export interface PreflightCheckResult {
  passed: boolean;
  dpi: number;
  is_cmyk: boolean;
  has_bleed: boolean;
  bleed_detected_mm: number;
  width_mm: number;
  height_mm: number;
  warnings: string[];
  errors: string[];
}

export interface ArtworkFile {
  id: string;
  user_id: string;
  order_item_id?: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  storage_disk: 'r2' | 's3' | 'local';
  public_url?: string;
  thumbnail_url?: string;
  proof_pdf_url?: string;
  status: ArtworkStatus;
  preflight_data?: PreflightCheckResult;
  customer_notes?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}
