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

        img.onerror = () => {
          reject(new Error('Failed to decode uploaded image data'));
        };

        img.src = dataUrl;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
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
