/**
 * Centralized, safe browser storage utility.
 *
 * Enforces storage policies:
 * - Authentication token: strictly in sessionStorage (never localStorage, only raw string).
 * - Temporary UI/Session keys: safe sessionStorage/localStorage with quota protection.
 * - Artwork and Canvas JSON: NEVER in browser storage; persistent in backend/database.
 * - Image binaries / base64: NEVER in browser storage; persistent in backend/object storage.
 */

const AUTH_TOKEN_KEY = 'auth_token';
const LEGACY_TOKEN_KEY = 'token';
const MAX_ALLOWED_ITEM_BYTES = 64 * 1024; // 64 KB safety limit for any single browser storage key

/**
 * Retrieves the authentication token strictly from sessionStorage.
 * Transparently migrates any legacy localStorage token into sessionStorage and deletes the old key.
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    let token = window.sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      token = window.sessionStorage.getItem(LEGACY_TOKEN_KEY);
      if (token) {
        window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
        window.sessionStorage.removeItem(LEGACY_TOKEN_KEY);
      }
    }

    // Backward compatibility: If a token exists in legacy localStorage, migrate it once
    if (!token) {
      const legacyToken =
        window.localStorage.getItem(AUTH_TOKEN_KEY) ||
        window.localStorage.getItem(LEGACY_TOKEN_KEY);

      if (legacyToken) {
        // Ensure it's a raw string, not a serialized JSON response
        const cleanToken = extractRawTokenString(legacyToken);
        if (cleanToken) {
          window.sessionStorage.setItem(AUTH_TOKEN_KEY, cleanToken);
          token = cleanToken;
        }
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        window.localStorage.removeItem(LEGACY_TOKEN_KEY);
      }
    }

    return token ? extractRawTokenString(token) : null;
  } catch (err) {
    console.warn('Error reading auth token from sessionStorage:', err);
    return null;
  }
}

/**
 * Stores the authentication token strictly in sessionStorage.
 * Guaranteed to store only the raw token string (never entire response objects).
 */
export function setAuthToken(tokenOrResponse: unknown): void {
  if (typeof window === 'undefined') return;

  const rawToken = extractRawTokenString(tokenOrResponse);
  if (!rawToken) {
    console.warn('Attempted to set an invalid or empty auth token.');
    return;
  }

  try {
    window.sessionStorage.setItem(AUTH_TOKEN_KEY, rawToken);
    // Cleanup any lingering tokens elsewhere
    window.sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch (err) {
    console.error('Failed to set auth token in sessionStorage:', err);
  }
}

/**
 * Clears authentication tokens from session and removes any obsolete local tokens.
 */
export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    window.sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch (err) {
    console.warn('Error clearing auth token:', err);
  }
}

/**
 * Normalizes input so we only ever store the raw Bearer token string.
 */
function extractRawTokenString(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Check if it's accidentally a JSON string
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return (
          parsed.token ||
          parsed.access_token ||
          parsed.data?.token ||
          null
        );
      } catch {
        return null;
      }
    }
    return trimmed;
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, any>;
    return (
      record.token ||
      record.access_token ||
      record.data?.token ||
      null
    );
  }

  return null;
}

/**
 * Safe sessionStorage wrapper with SSR check, size limit, and error handling.
 */
export const safeSessionStorage = {
  getItem<T = string>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (err) {
      console.warn(`safeSessionStorage.getItem failed for key "${key}":`, err);
      return null;
    }
  },

  setItem(key: string, value: unknown, maxBytes: number = MAX_ALLOWED_ITEM_BYTES): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (serialized.length > maxBytes) {
        console.warn(
          `safeSessionStorage rejected storing key "${key}": Payload size (${serialized.length} chars) exceeds maximum allowed size (${maxBytes} bytes).`
        );
        return false;
      }

      window.sessionStorage.setItem(key, serialized);
      return true;
    } catch (err) {
      console.warn(`safeSessionStorage.setItem failed for key "${key}":`, err);
      return false;
    }
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(key);
    } catch (err) {
      console.warn(`safeSessionStorage.removeItem failed for key "${key}":`, err);
    }
  },
};

/**
 * Safe localStorage wrapper with SSR check, size limit, and QuotaExceededError protection.
 */
export const safeLocalStorage = {
  getItem<T = string>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (err) {
      console.warn(`safeLocalStorage.getItem failed for key "${key}":`, err);
      return null;
    }
  },

  setItem(key: string, value: unknown, maxBytes: number = MAX_ALLOWED_ITEM_BYTES): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (serialized.length > maxBytes) {
        console.warn(
          `safeLocalStorage rejected storing key "${key}": Payload size (${serialized.length} chars) exceeds maximum allowed size (${maxBytes} bytes).`
        );
        return false;
      }

      window.localStorage.setItem(key, serialized);
      return true;
    } catch (err) {
      console.warn(`safeLocalStorage.setItem failed for key "${key}":`, err);
      return false;
    }
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      console.warn(`safeLocalStorage.removeItem failed for key "${key}":`, err);
    }
  },
};

/**
 * Safely removes legacy bloated artwork items from localStorage without clearing unrelated items.
 *
 * Specific targets:
 * - print_artwork_draft_* (contained multi-megabyte canvas JSON dumps)
 * - print_designer_uploaded_assets (contained multi-megabyte base64 image strings)
 * - print_artwork_remote_id_* (migrates valid IDs to sessionStorage, then deletes from localStorage)
 */
export function cleanupLegacyArtworkStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];
    const remoteIdMigration: { key: string; remoteId: string }[] = [];

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('print_artwork_draft_')) {
        keysToRemove.push(key);
      } else if (key === 'print_designer_uploaded_assets') {
        keysToRemove.push(key);
      } else if (key.startsWith('print_artwork_remote_id_')) {
        const val = window.localStorage.getItem(key);
        if (val && typeof val === 'string' && val.length < 256 && !val.trim().startsWith('{')) {
          remoteIdMigration.push({ key, remoteId: val.trim() });
        }
        keysToRemove.push(key);
      }
    }

    // Migrate small remote IDs to sessionStorage
    for (const { key, remoteId } of remoteIdMigration) {
      safeSessionStorage.setItem(key, remoteId);
    }

    // Remove obsolete bloated keys from localStorage
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }

    if (keysToRemove.length > 0) {
      console.info(
        `[Storage Migration] Successfully freed browser storage by removing ${keysToRemove.length} obsolete artwork/asset keys.`
      );
    }
  } catch (err) {
    console.warn('Failed to clean up legacy artwork storage:', err);
  }
}
