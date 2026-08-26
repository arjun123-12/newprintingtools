import { DocumentSettings, DesignerCanvasState, ProductPrintPreset } from '@/types/designer';
import { PRINT_PRODUCT_PRESETS, calculateCanvasDimensions } from '../utils/dimensions';

const LOCAL_STORAGE_KEY_PREFIX = 'print_artwork_draft_';

export class DesignerService {
  /**
   * Retrieves product print document configuration (from presets or future Laravel API)
   */
  public async getProductPrintSettings(productId?: string): Promise<DocumentSettings> {
    // Check if matching preset exists
    const preset = PRINT_PRODUCT_PRESETS.find((p) => p.id === productId);

    if (preset) {
      return {
        name: preset.name,
        width: preset.width,
        height: preset.height,
        unit: preset.unit,
        dpi: preset.dpi,
        bleed: preset.bleed,
        safeArea: preset.safeArea,
        backgroundColor: '#ffffff',
        showGuides: true,
      };
    }

    // Default commercial business card format
    return {
      name: 'Custom Print Artwork',
      width: 90,
      height: 50,
      unit: 'mm',
      dpi: 300,
      bleed: 3,
      safeArea: 3,
      backgroundColor: '#ffffff',
      showGuides: true,
    };
  }

  /**
   * Loads available product print presets
   */
  public getPrintPresets(): ProductPrintPreset[] {
    return PRINT_PRODUCT_PRESETS;
  }

  /**
   * Saves artwork draft locally
   */
  public saveDraftLocally(productId: string, state: DesignerCanvasState): void {
    if (typeof window === 'undefined') return;
    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${productId || 'default'}`;
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save artwork draft to local storage:', err);
    }
  }

  /**
   * Loads artwork draft locally if available
   */
  public loadDraftLocally(productId: string): DesignerCanvasState | null {
    if (typeof window === 'undefined') return null;
    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${productId || 'default'}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as DesignerCanvasState;
    } catch (err) {
      console.warn('Failed to load artwork draft from local storage:', err);
      return null;
    }
  }

  /**
   * Clears saved local draft
   */
  public clearLocalDraft(productId: string): void {
    if (typeof window === 'undefined') return;
    const key = `${LOCAL_STORAGE_KEY_PREFIX}${productId || 'default'}`;
    localStorage.removeItem(key);
  }
}

export const designerService = new DesignerService();
