/**
 * Image Quality and Real-ESRGAN Upscaling Types
 */

export interface DesignImageMetadata {
  imageId: string;
  previewSrc: string;
  originalSrc: string;
  upscaledSrc?: string;
  sourceWidth: number;
  sourceHeight: number;
  effectiveDpi?: number;
  upscaleFactor?: 1 | 2 | 4;
  upscaleStatus:
    | 'not_required'
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed';
}

export type QualityPreset = 'web' | 'standard' | 'print' | 'ultra' | 'custom';
export type ExportFormat = 'jpeg' | 'png' | 'webp' | 'pdf' | 'tiff' | 'psd';

export interface QualityAnalysisParams {
  source_width: number;
  source_height: number;
  object_width: number;
  object_height: number;
  scale_x?: number;
  scale_y?: number;
  canvas_width_px: number;
  canvas_height_px: number;
  document_width_mm: number;
  document_height_mm: number;
  target_dpi?: number;
  quality_preset?: QualityPreset;
  custom_dpi?: number;
  crop?: {
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;
  };
}

export interface QualityAnalysisResult {
  quality_level: 'excellent' | 'acceptable' | 'low';
  effective_dpi: number;
  target_dpi: number;
  required_width_px: number;
  required_height_px: number;
  recommended_scale: 1 | 2 | 4;
  requires_upscale: boolean;
  can_reach_target: boolean;
  warning: string | null;
  message: string;
  printed_width_in?: number;
  printed_height_in?: number;
}

export interface ImageTrackingPayload {
  id: string;
  original_url: string;
  preview_url: string;
  upscaled_url: string | null;
  original_width: number;
  original_height: number;
  upscaled_width: number;
  upscaled_height: number;
  effective_dpi: number;
  target_dpi: number;
  upscale_factor: number;
  upscale_status: 'not_required' | 'pending' | 'processing' | 'completed' | 'failed';
  upscale_error: string | null;
}

export interface ExportRequestPayload {
  name?: string;
  format: ExportFormat;
  quality_preset?: QualityPreset;
  custom_dpi?: number;
  target_dpi?: number;
  include_normal?: boolean;
  include_enhanced?: boolean;
  quality?: number;
  background_color?: string;
  artwork_id?: string;
  session_id?: string;
  dimensions: {
    width_mm: number;
    height_mm: number;
    width_px: number;
    height_px: number;
  };
  pages: Array<{
    side?: string;
    name?: string;
    canvas_json: Record<string, unknown>;
    preview_data_url?: string | null;
    rendered_data_url?: string | null;
  }>;
}

export interface ExportStatusPayload {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  format: ExportFormat;
  quality_preset: QualityPreset;
  target_dpi: number;
  include_normal: boolean;
  include_enhanced: boolean;
  file_name: string | null;
  file_size: number | null;
  download_url: string | null;
  report: Record<string, unknown> | null;
  error_message: string | null;
  created_at?: string;
  updated_at?: string;
}
