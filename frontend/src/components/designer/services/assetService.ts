import { UploadedAsset } from '@/types/designer';

const ASSETS_STORAGE_KEY = 'print_designer_uploaded_assets';

export type AssetListener = (assets: UploadedAsset[]) => void;

class AssetService {
  private assets: UploadedAsset[] = [];
  private listeners: Set<AssetListener> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(ASSETS_STORAGE_KEY);
      if (raw) {
        this.assets = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Failed to load assets from storage:', err);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(this.assets));
    } catch (err) {
      console.warn('Failed to save assets to storage:', err);
    }
  }

  public getAssets(): UploadedAsset[] {
    return [...this.assets];
  }

  public subscribe(listener: AssetListener): () => void {
    this.listeners.add(listener);
    listener(this.getAssets());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const list = this.getAssets();
    this.listeners.forEach((cb) => cb(list));
  }

  /**
   * Reads a File object, measures its natural dimensions, and adds it to the asset library
   */
  public async uploadFile(file: File): Promise<UploadedAsset> {
    if (
      file.type === 'image/svg+xml' ||
      file.name.toLowerCase().endsWith('.svg')
    ) {
      try {
        const { normalizeSvgFile } = await import('@/utils/svgNormalizer');
        const normalized = await normalizeSvgFile(file);
        const asset: UploadedAsset = {
          id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url: normalized.dataUrl,
          naturalWidth: normalized.width,
          naturalHeight: normalized.height,
          fileSizeBytes: file.size,
          mimeType: 'image/svg+xml',
          createdAt: new Date().toISOString(),
        };

        this.assets = [asset, ...this.assets];
        this.saveToStorage();
        this.notify();
        return asset;
      } catch (err) {
        console.warn('SVG normalization in assetService failed, falling back to image loader:', err);
      }
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();

        img.onload = () => {
          const asset: UploadedAsset = {
            id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            url: dataUrl,
            naturalWidth: img.naturalWidth || img.width,
            naturalHeight: img.naturalHeight || img.height,
            fileSizeBytes: file.size,
            mimeType: file.type,
            createdAt: new Date().toISOString(),
          };

          this.assets = [asset, ...this.assets];
          this.saveToStorage();
          this.notify();
          resolve(asset);
        };

        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = dataUrl;
      };

      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  public async uploadProcessedImage(
    blob: Blob,
    metadata: {
      source_upload_id?: string;
      source_provider?: string;
      source_provider_asset_id?: string;
    }
  ): Promise<{ id: string; url: string; width: number; height: number; size: number }> {
    const formData = new FormData();
    formData.append('image', blob, 'background-removed.png');
    formData.append('processing_type', 'remove_background');
    if (metadata.source_upload_id) formData.append('source_upload_id', metadata.source_upload_id);
    if (metadata.source_provider) formData.append('source_provider', metadata.source_provider);
    if (metadata.source_provider_asset_id) formData.append('source_provider_asset_id', metadata.source_provider_asset_id);

    try {
      const { apiClient } = await import('@/services/api/client');
      const response = await apiClient.post('/designer/uploads/processed-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data?.message || 'Upload failed.');
      }
    } catch (err: any) {
      console.error('Failed to upload processed image:', err);
      throw new Error(err.response?.data?.message || 'Failed to upload processed image.');
    }
  }

  /**
   * Removes an asset from the local library
   */
  public deleteAsset(id: string): void {
    this.assets = this.assets.filter((a) => a.id !== id);
    this.saveToStorage();
    this.notify();
  }
}

export const assetService = new AssetService();
