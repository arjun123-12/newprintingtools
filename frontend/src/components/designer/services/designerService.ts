import {
  DocumentSettings,
  DesignerCanvasState,
  ProductPrintPreset,
} from '@/types/designer';
import { PRINT_PRODUCT_PRESETS } from '../utils/dimensions';
import {
  getAuthToken,
  safeSessionStorage,
  safeLocalStorage,
  cleanupLegacyArtworkStorage,
} from '@/utils/storageHelper';

const LOCAL_STORAGE_KEY_PREFIX = 'print_artwork_draft_';
const REMOTE_ARTWORK_ID_KEY_PREFIX = 'print_artwork_remote_id_';

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '');

export interface ArtworkDraftPayload {
  product_id?: string | null;
  template_id?: string | null;
  design_template_id?: string | null;
  session_id?: string | null;
  name: string;
  canvas_json: Record<string, any> | Record<string, any>[];
  document_settings: DocumentSettings;
  width_px: number;
  height_px: number;
  dpi: number;
  thumbnail_url?: string | null;
  customer_notes?: string | null;
}

export interface SavedArtwork {
  id: string;
  product_id: string | null;
  template_id?: string | null;
  design_template_id?: string | null;
  session_id?: string | null;
  name: string;
  source_type: 'designer' | 'upload';
  design_status: 'draft' | 'completed' | null;
  canvas_json: Record<string, any> | Record<string, any>[];
  document_settings: DocumentSettings | null;
  width_px: number | null;
  height_px: number | null;
  dpi: number | null;
  print_sides?: string | null;
  preview_url?: string | null;
  updated_at: string;
}

interface ArtworkApiResponse {
  success: boolean;
  message?: string;
  data: SavedArtwork;
  errors?: Record<string, string[]>;
}

export class DesignerApiError extends Error {
  public readonly status: number;
  public readonly errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'DesignerApiError';
    this.status = status;
    this.errors = errors;
  }
}

export class DesignerService {
  /**
   * Retrieves product print document configuration.
   */
  public async getProductPrintSettings(
    productId?: string
  ): Promise<DocumentSettings> {
    const preset = PRINT_PRODUCT_PRESETS.find((item) => item.id === productId);

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

  public getPrintPresets(): ProductPrintPreset[] {
    return PRINT_PRODUCT_PRESETS;
  }

  /**
   * Creates the first artwork row and updates the same row on later saves.
   */
  public async saveArtworkDraft(
    artworkId: string | null,
    payload: ArtworkDraftPayload
  ): Promise<SavedArtwork> {
    const isUpdate = Boolean(artworkId);
    const requestUrl = isUpdate
      ? `${API_URL}/artworks/${artworkId}`
      : `${API_URL}/artworks`;

    const token = getAuthToken();

    let sessionId = safeLocalStorage.getItem<string>('designer_session_id');

    if (typeof window !== 'undefined' && !sessionId && !token) {
      sessionId = 'guest_' + Math.random().toString(36).substring(2) + Date.now();
      safeLocalStorage.setItem('designer_session_id', sessionId);
    }

    // Product/template identity is immutable after the artwork is created.
    const requestBody = isUpdate
      ? {
        name: payload.name,
        canvas_json: payload.canvas_json,
        document_settings: payload.document_settings,
        width_px: payload.width_px,
        height_px: payload.height_px,
        dpi: payload.dpi,
        thumbnail_url: payload.thumbnail_url ?? null,
        customer_notes: payload.customer_notes ?? null,
      }
      : {
        ...payload,
        template_id: payload.template_id || payload.design_template_id,
        session_id: payload.session_id || sessionId,
      };

    const response = await fetch(requestUrl, {
      method: isUpdate ? 'PUT' : 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let result: ArtworkApiResponse | null = null;

    try {
      result = responseText
        ? (JSON.parse(responseText) as ArtworkApiResponse)
        : null;
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success || !result.data) {
      if (response.status === 403 && isUpdate) {
        // Current user/guest does not own this existing artwork.
        // Fork into a new draft so their edits are preserved and saved!
        return this.saveArtworkDraft(null, payload);
      }

      const validationMessage = result?.errors
        ? Object.values(result.errors).flat().join(' ')
        : null;

      throw new DesignerApiError(
        validationMessage ||
        result?.message ||
        (response.status === 401
          ? 'Please sign in before saving this design.'
          : `Artwork save failed with status ${response.status}.`),
        response.status,
        result?.errors
      );
    }

    return result.data;
  }

  public async completeArtwork(artworkId: string): Promise<SavedArtwork> {
    const token = getAuthToken();

    const response = await fetch(
      `${API_URL}/artworks/${artworkId}/complete`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(token
            ? {
              Authorization: `Bearer ${token}`,
            }
            : {}),
        },
      }
    );

    const result = (await response.json()) as ArtworkApiResponse;

    if (!response.ok || !result.success) {
      throw new DesignerApiError(
        result.message || 'Artwork could not be completed.',
        response.status,
        result.errors
      );
    }

    return result.data;
  }

  /**
   * Temporary lightweight session metadata only.
   * Large canvas JSON and image data are NEVER written to browser storage;
   * they are saved to the backend database via saveArtworkDraft.
   */
  public saveDraftLocally(
    productId: string,
    state: DesignerCanvasState
  ): void {
    if (typeof window === 'undefined') return;

    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${productId || 'default'}`;
      // Clean up any obsolete bulky localStorage copy
      safeLocalStorage.removeItem(key);

      // Only keep small temporary session metadata (never full canvas_json)
      const lightweightMeta = {
        product_id: state.product_id,
        name: state.name,
        dimensions: state.dimensions,
        updated_at: new Date().toISOString(),
      };
      safeSessionStorage.setItem(key, lightweightMeta, 16384);
    } catch (error) {
      console.warn('Failed to save draft metadata in session:', error);
    }
  }

  public loadDraftLocally(
    _productId: string
  ): DesignerCanvasState | null {
    // Authoritative drafts come from backend API/database
    return null;
  }

  public clearLocalDraft(productId: string): void {
    if (typeof window === 'undefined') return;

    const key = `${LOCAL_STORAGE_KEY_PREFIX}${productId || 'default'}`;
    safeSessionStorage.removeItem(key);
    safeLocalStorage.removeItem(key);
  }

  /**
   * Remembers the backend row in sessionStorage so a page refresh updates instead of duplicating.
   * Authoritative artwork ID comes from backend database.
   */
  public rememberArtworkId(productId: string, artworkId: string): void {
    if (typeof window === 'undefined' || !productId || !artworkId) return;

    const key = `${REMOTE_ARTWORK_ID_KEY_PREFIX}${productId}`;
    safeSessionStorage.setItem(key, String(artworkId).trim(), 512);
    // Remove obsolete localStorage key to reclaim quota
    safeLocalStorage.removeItem(key);
  }

  public loadRememberedArtworkId(productId: string): string | null {
    if (typeof window === 'undefined' || !productId) return null;

    const key = `${REMOTE_ARTWORK_ID_KEY_PREFIX}${productId}`;
    const sessionVal = safeSessionStorage.getItem<string>(key);
    if (sessionVal && typeof sessionVal === 'string' && !sessionVal.trim().startsWith('{')) {
      return sessionVal.trim();
    }

    // Backward compatibility: read legacy localStorage, migrate to sessionStorage, remove from localStorage
    const legacyVal = safeLocalStorage.getItem<string>(key);
    if (legacyVal && typeof legacyVal === 'string' && !legacyVal.trim().startsWith('{')) {
      const cleanId = legacyVal.trim();
      safeSessionStorage.setItem(key, cleanId, 512);
      safeLocalStorage.removeItem(key);
      return cleanId;
    }

    return null;
  }

  public async saveAsDesignTemplate(payload: {
    template_id?: string | null;
    product_id: string;
    name: string;
    category?: string;
    canvas_json: Record<string, any> | Record<string, any>[];
    template_json?: Record<string, any> | Record<string, any>[];
    artwork_config?: Record<string, any> | null;
    thumbnail_url?: string | null;
    is_active?: boolean;
  }): Promise<{ id: string; name: string; product_id: string; message?: string }> {
    const token = getAuthToken();

    const isUpdate = Boolean(payload.template_id);
    const url = isUpdate
      ? `${API_URL}/admin/templates/${payload.template_id}`
      : `${API_URL}/admin/templates`;
    const method = isUpdate ? 'PATCH' : 'POST';

    const cleanCanvasJson = payload.template_json || payload.canvas_json;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        product_id: payload.product_id,
        name: payload.name,
        category: payload.category || 'Corporate',
        canvas_json: cleanCanvasJson,
        template_json: cleanCanvasJson,
        artwork_config: payload.artwork_config || null,
        thumbnail_url: payload.thumbnail_url || null,
        is_active: payload.is_active !== false,
      }),
    });

    const responseText = await response.text();
    let result: any = null;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { message: responseText };
    }

    if (!response.ok || !result?.success) {
      throw new DesignerApiError(
        result?.message || `Template could not be saved (HTTP ${response.status}).`,
        response.status,
        result?.errors
      );
    }

    return result.data;
  }

  /**
   * Fetch a saved artwork by ID with fallback.
   */
  public async fetchArtwork(artworkId: string): Promise<SavedArtwork> {
    const token = getAuthToken();

    const sessionId = safeLocalStorage.getItem<string>('designer_session_id');

    let response = await fetch(`${API_URL}/artworks/${artworkId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
      },
    });

    if (!response.ok) {
      response = await fetch(`${API_URL}/artworks/${artworkId}/public`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });
    }

    const result = (await response.json()) as ArtworkApiResponse;

    if (!response.ok || !result.success || !result.data) {
      throw new DesignerApiError(
        result.message || 'Artwork could not be loaded.',
        response.status,
        result.errors
      );
    }

    return result.data;
  }

  /**
   * Create a draft artwork (public endpoint, no auth required).
   * Returns the created artwork including its UUID.
   */
  public async createDraft(
    payload: Partial<ArtworkDraftPayload> & { canvas_json: Record<string, any> | Record<string, any>[] }
  ): Promise<SavedArtwork> {
    const response = await fetch(`${API_URL}/artworks/draft`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let result: ArtworkApiResponse | null = null;

    try {
      result = responseText
        ? (JSON.parse(responseText) as ArtworkApiResponse)
        : null;
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success || !result.data) {
      throw new DesignerApiError(
        result?.message || `Artwork draft creation failed (HTTP ${response.status}).`,
        response.status,
        result?.errors
      );
    }

    return result.data;
  }

  public forgetArtworkId(productId: string): void {
    if (typeof window === 'undefined') return;

    const key = `${REMOTE_ARTWORK_ID_KEY_PREFIX}${productId}`;
    safeSessionStorage.removeItem(key);
    safeLocalStorage.removeItem(key);
  }
}

export const designerService = new DesignerService();
