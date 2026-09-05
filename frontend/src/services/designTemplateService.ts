const API_URL = (
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8000/api/v1'
).replace(/\/+$/, '');

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

import { ArtworkConfig, PrintSides, PrintSettings } from '@/types/designer';

export interface CreateTemplateDraftPayload {
    product_id: string;
    name: string;
    category?: string | null;
    print_sides?: PrintSides;
    width_mm?: number | null;
    height_mm?: number | null;
    margin_mm?: number | null;
    bleed_mm?: number | null;
    safe_area_mm?: number | null;
    canvas_json: Record<string, any> | Record<string, any>[];
    back_canvas_json?: Record<string, any> | Record<string, any>[] | null;
    template_json?: Record<string, any> | Record<string, any>[];
    artwork_config?: ArtworkConfig | null;
    thumbnail_url?: string | null;
    is_active: boolean;
}

export interface DesignTemplateResponse {
    id: string;
    product_id: string;
    name: string;
    category: string | null;
    print_sides?: PrintSides;
    width_mm?: number | null;
    height_mm?: number | null;
    margin_mm?: number | null;
    bleed_mm?: number | null;
    safe_area_mm?: number | null;
    canvas_json: Record<string, any> | Record<string, any>[];
    back_canvas_json?: Record<string, any> | Record<string, any>[] | null;
    template_json?: Record<string, any> | Record<string, any>[];
    artwork_config?: ArtworkConfig | null;
    thumbnail_url: string | null;
    is_active: boolean;
    resolved_print_settings?: PrintSettings;
    product?: any;
}

interface ApiResponse<T> {
    success?: boolean;
    message?: string;
    data?: T;
    errors?: Record<string, string | string[]>;
}

type JsonRecord = Record<string, unknown>;

function getAuthHeaders(): HeadersInit {
    if (typeof window === 'undefined') {
        return {};
    }

    const token =
        localStorage.getItem('auth_token') ||
        localStorage.getItem('token');

    return token
        ? {
            Authorization: `Bearer ${token}`,
        }
        : {};
}

/**
 * Keep local API URLs consistent so cookies and
 * Sanctum authentication do not mix localhost
 * with 127.0.0.1.
 */
function normalizeAssetUrl(url: string): string {
    return url.replace(
        'http://127.0.0.1:8000',
        'http://localhost:8000'
    );
}

function isEmbeddedImage(
    value: unknown
): value is string {
    return (
        typeof value === 'string' &&
        value.startsWith('data:image/')
    );
}

/**
 * Recursively sanitize Fabric.js JSON.
 *
 * If Fabric changes an image src into Base64,
 * restore its original uploaded URL.
 */
function sanitizeCanvasValue(
    value: unknown
): unknown {
    if (Array.isArray(value)) {
        return value.map(sanitizeCanvasValue);
    }

    if (
        value === null ||
        typeof value !== 'object'
    ) {
        return value;
    }

    const source = value as JsonRecord;
    const result: JsonRecord = {};

    Object.entries(source).forEach(
        ([key, item]) => {
            result[key] = sanitizeCanvasValue(item);
        }
    );

    const src =
        typeof result.src === 'string'
            ? result.src
            : null;

    const originalSrc =
        typeof result.originalSrc === 'string'
            ? result.originalSrc
            : null;

    const url =
        typeof result.url === 'string'
            ? result.url
            : null;

    if (isEmbeddedImage(src)) {
        const replacement = [
            originalSrc,
            url,
        ].find(
            (candidate) =>
                typeof candidate === 'string' &&
                candidate.length > 0 &&
                !isEmbeddedImage(candidate)
        );

        if (!replacement) {
            throw new Error(
                'An image has not been uploaded. Upload it to local storage, R2 or S3 before saving the template.'
            );
        }

        result.src = normalizeAssetUrl(
            replacement
        );
    }

    /*
     * Avoid retaining Base64 inside originalSrc
     * or url after replacing src.
     */
    if (
        isEmbeddedImage(result.originalSrc) &&
        typeof result.src === 'string' &&
        !isEmbeddedImage(result.src)
    ) {
        result.originalSrc = result.src;
    }

    if (
        isEmbeddedImage(result.url) &&
        typeof result.src === 'string' &&
        !isEmbeddedImage(result.src)
    ) {
        result.url = result.src;
    }

    return result;
}

export function sanitizeCanvasJson(
    canvasJson: Record<string, any> | Record<string, any>[]
): Record<string, any> | Record<string, any>[] {
    const sanitized = sanitizeCanvasValue(
        canvasJson
    ) as Record<string, any> | Record<string, any>[];

    const serialized = JSON.stringify(sanitized);

    // The sanitizeCanvasValue recursive function already checks and removes base64 images properly.

    return sanitized;
}

function getApiErrorMessage(
    result: ApiResponse<unknown>,
    fallback: string
): string {
    if (result.errors) {
        const firstError = Object.values(
            result.errors
        )[0];

        if (Array.isArray(firstError)) {
            return firstError[0] || fallback;
        }

        if (typeof firstError === 'string') {
            return firstError;
        }
    }

    return result.message || fallback;
}

async function parseResponse<T>(
    response: Response,
    fallbackMessage: string
): Promise<T> {
    const responseText = await response.text();

    let result: ApiResponse<T>;

    try {
        result = JSON.parse(responseText);
    } catch {
        throw new Error(
            responseText || fallbackMessage
        );
    }

    if (
        !response.ok ||
        result.success === false
    ) {
        throw new Error(
            getApiErrorMessage(
                result,
                fallbackMessage
            )
        );
    }

    if (!result.data) {
        throw new Error(
            'The server did not return template data.'
        );
    }

    return result.data;
}

/**
 * Create one inactive admin template draft.
 */
export async function createTemplateDraft(
    payload: CreateTemplateDraftPayload
): Promise<DesignTemplateResponse> {
    const productId =
        String(payload.product_id).trim();

    if (!UUID_PATTERN.test(productId)) {
        throw new Error(
            `Invalid product UUID: ${productId}`
        );
    }

    const cleanCanvasJson =
        sanitizeCanvasJson(
            payload.template_json || payload.canvas_json
        );

    const cleanBackCanvasJson = payload.back_canvas_json
        ? sanitizeCanvasJson(payload.back_canvas_json)
        : null;

    const requestBody = JSON.stringify({
        ...payload,
        product_id: productId,
        print_sides: payload.print_sides || 'front',
        width_mm: typeof payload.width_mm === 'number' && !isNaN(payload.width_mm) ? payload.width_mm : null,
        height_mm: typeof payload.height_mm === 'number' && !isNaN(payload.height_mm) ? payload.height_mm : null,
        margin_mm: typeof payload.margin_mm === 'number' && !isNaN(payload.margin_mm) ? payload.margin_mm : 0,
        bleed_mm: typeof payload.bleed_mm === 'number' && !isNaN(payload.bleed_mm) ? payload.bleed_mm : 0,
        safe_area_mm: typeof payload.safe_area_mm === 'number' && !isNaN(payload.safe_area_mm) ? payload.safe_area_mm : 0,
        canvas_json: cleanCanvasJson,
        template_json: cleanCanvasJson,
        back_canvas_json: cleanBackCanvasJson,
        artwork_config: payload.artwork_config || null,
        is_active: false,
    });

    /*
     * The sanitizeCanvasJson function has already replaced embedded image 
     * sources with proper URLs. We proceed to send the request.
     */

    const response = await fetch(
        `${API_URL}/admin/design-templates`,
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
            credentials: 'include',
            body: requestBody,
        }
    );

    return parseResponse<DesignTemplateResponse>(
        response,
        'Could not create template draft.'
    );
}

/**
 * Save or publish an existing admin template.
 */
export async function updateTemplateDesign(
    templateId: string,
    canvasJson: any,
    publish = false,
    thumbnailUrl?: string,
    artworkConfig?: ArtworkConfig | null,
    backCanvasJson?: any,
    printSettings?: Partial<PrintSettings>
): Promise<DesignTemplateResponse> {
    const normalizedTemplateId =
        String(templateId).trim();

    if (
        !UUID_PATTERN.test(normalizedTemplateId)
    ) {
        throw new Error(
            `Invalid template UUID: ${normalizedTemplateId}`
        );
    }

    const cleanCanvasJson =
        canvasJson !== undefined ? sanitizeCanvasJson(canvasJson) : undefined;

    const cleanBackCanvasJson =
        backCanvasJson !== undefined && backCanvasJson !== null
            ? sanitizeCanvasJson(backCanvasJson)
            : backCanvasJson;

    const requestBody = JSON.stringify({
        ...(cleanCanvasJson !== undefined ? { canvas_json: cleanCanvasJson, template_json: cleanCanvasJson } : {}),
        ...(cleanBackCanvasJson !== undefined ? { back_canvas_json: cleanBackCanvasJson } : {}),
        ...(artworkConfig !== undefined ? { artwork_config: artworkConfig } : {}),
        ...(printSettings?.print_sides ? { print_sides: printSettings.print_sides } : {}),
        ...(printSettings?.width_mm !== undefined ? { width_mm: printSettings.width_mm } : {}),
        ...(printSettings?.height_mm !== undefined ? { height_mm: printSettings.height_mm } : {}),
        ...(printSettings?.margin_mm !== undefined ? { margin_mm: printSettings.margin_mm } : {}),
        ...(printSettings?.bleed_mm !== undefined ? { bleed_mm: printSettings.bleed_mm } : {}),
        ...(printSettings?.safe_area_mm !== undefined ? { safe_area_mm: printSettings.safe_area_mm } : {}),
        is_active: publish,
        ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
    });

    /*
     * The sanitizeCanvasJson function has already replaced embedded image 
     * sources with proper URLs. We proceed to send the request.
     */

    const response = await fetch(
        `${API_URL}/admin/design-templates/${normalizedTemplateId}`,
        {
            method: 'PUT',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
            credentials: 'include',
            body: requestBody,
        }
    );

    return parseResponse<DesignTemplateResponse>(
        response,
        publish
            ? 'Could not publish template.'
            : 'Could not save template design.'
    );
}

/**
 * Load one admin template for editing.
 */
export async function getDesignTemplate(
    templateId: string
): Promise<DesignTemplateResponse> {
    const normalizedTemplateId =
        String(templateId).trim();

    if (
        !UUID_PATTERN.test(normalizedTemplateId)
    ) {
        throw new Error(
            `Invalid template UUID: ${normalizedTemplateId}`
        );
    }

    const response = await fetch(
        `${API_URL}/admin/design-templates/${normalizedTemplateId}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                ...getAuthHeaders(),
            },
            credentials: 'include',
        }
    );

    return parseResponse<DesignTemplateResponse>(
        response,
        'Could not load template.'
    );
}