import { apiClient } from './api/client';
import {
  QualityAnalysisParams,
  QualityAnalysisResult,
  ImageTrackingPayload,
  ExportRequestPayload,
  ExportStatusPayload,
} from '@/types/imageUpscaler';

export const imageQualityService = {
  /**
   * Analyze the quality and effective DPI of a canvas image.
   */
  async analyzeQuality(params: QualityAnalysisParams): Promise<QualityAnalysisResult> {
    const response = await apiClient.post<{ success: boolean; data: QualityAnalysisResult }>(
      '/images/analyze-quality',
      params
    );
    return response.data.data;
  },

  /**
   * Register a canvas image for Real-ESRGAN upscaling.
   */
  async registerImage(
    fileOrUrl: File | string,
    sessionId?: string,
    sourceProvider?: string,
    sourceAssetId?: string
  ): Promise<ImageTrackingPayload> {
    if (typeof fileOrUrl === 'string') {
      const response = await apiClient.post<{ success: boolean; data: ImageTrackingPayload }>(
        '/images/register',
        {
          image_url: fileOrUrl,
          session_id: sessionId,
          source_provider: sourceProvider,
          source_asset_id: sourceAssetId,
        }
      );
      return response.data.data;
    }

    const formData = new FormData();
    formData.append('image', fileOrUrl);
    if (sessionId) formData.append('session_id', sessionId);
    if (sourceProvider) formData.append('source_provider', sourceProvider);
    if (sourceAssetId) formData.append('source_asset_id', sourceAssetId);

    const response = await apiClient.post<{ success: boolean; data: ImageTrackingPayload }>(
      '/images/register',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data.data;
  },

  /**
   * Trigger local Real-ESRGAN upscaling on a registered image.
   */
  async triggerUpscale(
    imageId: string,
    scale: 2 | 4 = 4,
    targetDpi: number = 300
  ): Promise<ImageTrackingPayload> {
    const response = await apiClient.post<{ success: boolean; data: ImageTrackingPayload }>(
      `/images/${imageId}/upscale`,
      { scale, target_dpi: targetDpi }
    );
    return response.data.data;
  },

  /**
   * Get the current upscale processing status of an image.
   */
  async getUpscaleStatus(imageId: string): Promise<ImageTrackingPayload> {
    const response = await apiClient.get<{ success: boolean; data: ImageTrackingPayload }>(
      `/images/${imageId}/upscale-status`
    );
    return response.data.data;
  },

  /**
   * Submit a multi-format design export task.
   */
  async startExport(payload: ExportRequestPayload): Promise<ExportStatusPayload> {
    const response = await apiClient.post<{ success: boolean; data: ExportStatusPayload }>(
      '/designer/export',
      payload
    );
    return response.data.data;
  },

  /**
   * Poll status of an active export task.
   */
  async getExportStatus(exportId: string): Promise<ExportStatusPayload> {
    const response = await apiClient.get<{ success: boolean; data: ExportStatusPayload }>(
      `/designer/exports/${exportId}/status`
    );
    return response.data.data;
  },

  /**
   * Get absolute download URL for a completed export.
   */
  getExportDownloadUrl(exportId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
    return `${baseUrl}/designer/exports/${exportId}/download`;
  },
};
