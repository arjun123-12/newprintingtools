import { formatImageUrl, getProxiedImageUrl } from '@/utils/imageUrl';

export interface FontFamilyItem {
  id: string;
  name: string;
  family: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace' | 'custom';
  googleFont?: string; // Query string for Google Fonts API fallback
  popular?: boolean;
  source?: 'system' | 'fontsource' | 'custom';
}

const ALL_DEFINED_FONTS: FontFamilyItem[] = [
  // =========================================================
  // 50 FONTSOURCE LIBRARY FONTS
  // =========================================================

  // --- SANS SERIF ---
  { id: 'inter', name: 'Inter', family: 'Inter, sans-serif', category: 'sans-serif', source: 'fontsource', popular: true },
  { id: 'roboto', name: 'Roboto', family: 'Roboto, sans-serif', category: 'sans-serif', source: 'fontsource', popular: true },
  { id: 'montserrat', name: 'Montserrat', family: 'Montserrat, sans-serif', category: 'sans-serif', source: 'fontsource', popular: true },
  { id: 'poppins', name: 'Poppins', family: 'Poppins, sans-serif', category: 'sans-serif', source: 'fontsource', popular: true },
  { id: 'open-sans', name: 'Open Sans', family: '"Open Sans", sans-serif', category: 'sans-serif', source: 'fontsource' },
  { id: 'lato', name: 'Lato', family: 'Lato, sans-serif', category: 'sans-serif', source: 'fontsource' },
  { id: 'raleway', name: 'Raleway', family: 'Raleway, sans-serif', category: 'sans-serif', source: 'fontsource' },
  { id: 'nunito-sans', name: 'Nunito Sans', family: '"Nunito Sans", sans-serif', category: 'sans-serif', source: 'fontsource' },
  { id: 'dm-sans', name: 'DM Sans', family: '"DM Sans", sans-serif', category: 'sans-serif', source: 'fontsource' },
  { id: 'manrope', name: 'Manrope', family: 'Manrope, sans-serif', category: 'sans-serif', source: 'fontsource' },
  { id: 'josefin-sans', name: 'Josefin Sans', family: '"Josefin Sans", sans-serif', category: 'sans-serif', source: 'fontsource' },
  { id: 'quicksand', name: 'Quicksand', family: 'Quicksand, sans-serif', category: 'sans-serif', source: 'fontsource' },
  { id: 'space-grotesk', name: 'Space Grotesk', family: '"Space Grotesk", sans-serif', category: 'sans-serif', source: 'fontsource' },

  // --- SERIF ---
  { id: 'playfair', name: 'Playfair Display', family: '"Playfair Display", serif', category: 'serif', source: 'fontsource', popular: true },
  { id: 'cormorant-garamond', name: 'Cormorant Garamond', family: '"Cormorant Garamond", serif', category: 'serif', source: 'fontsource' },
  { id: 'libre-baskerville', name: 'Libre Baskerville', family: '"Libre Baskerville", serif', category: 'serif', source: 'fontsource' },
  { id: 'lora', name: 'Lora', family: 'Lora, serif', category: 'serif', source: 'fontsource' },
  { id: 'merriweather', name: 'Merriweather', family: 'Merriweather, serif', category: 'serif', source: 'fontsource' },
  { id: 'cinzel', name: 'Cinzel', family: 'Cinzel, serif', category: 'serif', source: 'fontsource' },
  { id: 'abril-fatface', name: 'Abril Fatface', family: '"Abril Fatface", serif', category: 'serif', source: 'fontsource' },
  { id: 'cormorant', name: 'Cormorant', family: 'Cormorant, serif', category: 'serif', source: 'fontsource' },
  { id: 'bodoni-moda', name: 'Bodoni Moda', family: '"Bodoni Moda", serif', category: 'serif', source: 'fontsource' },

  // --- DISPLAY ---
  { id: 'anton', name: 'Anton', family: 'Anton, sans-serif', category: 'display', source: 'fontsource', popular: true },
  { id: 'bebas-neue', name: 'Bebas Neue', family: '"Bebas Neue", sans-serif', category: 'display', source: 'fontsource', popular: true },
  { id: 'oswald', name: 'Oswald', family: 'Oswald, sans-serif', category: 'display', source: 'fontsource', popular: true },
  { id: 'barlow-condensed', name: 'Barlow Condensed', family: '"Barlow Condensed", sans-serif', category: 'display', source: 'fontsource' },
  { id: 'archivo-black', name: 'Archivo Black', family: '"Archivo Black", sans-serif', category: 'display', source: 'fontsource' },
  { id: 'league-spartan', name: 'League Spartan', family: '"League Spartan", sans-serif', category: 'display', source: 'fontsource' },
  { id: 'teko', name: 'Teko', family: 'Teko, sans-serif', category: 'display', source: 'fontsource' },
  { id: 'staatliches', name: 'Staatliches', family: 'Staatliches, sans-serif', category: 'display', source: 'fontsource' },
  { id: 'russo-one', name: 'Russo One', family: '"Russo One", sans-serif', category: 'display', source: 'fontsource' },
  { id: 'roboto-condensed', name: 'Roboto Condensed', family: '"Roboto Condensed", sans-serif', category: 'display', source: 'fontsource' },
  { id: 'righteous', name: 'Righteous', family: 'Righteous, cursive', category: 'display', source: 'fontsource' },
  { id: 'fredoka', name: 'Fredoka', family: 'Fredoka, sans-serif', category: 'display', source: 'fontsource' },
  { id: 'baloo-2', name: 'Baloo 2', family: '"Baloo 2", cursive', category: 'display', source: 'fontsource' },
  { id: 'comfortaa', name: 'Comfortaa', family: 'Comfortaa, cursive', category: 'display', source: 'fontsource' },
  { id: 'orbitron', name: 'Orbitron', family: 'Orbitron, sans-serif', category: 'display', source: 'fontsource' },
  { id: 'exo-2', name: 'Exo 2', family: '"Exo 2", sans-serif', category: 'display', source: 'fontsource' },
  { id: 'press-start-2p', name: 'Press Start 2P', family: '"Press Start 2P", cursive', category: 'display', source: 'fontsource' },

  // --- HANDWRITING ---
  { id: 'pacifico', name: 'Pacifico', family: 'Pacifico, cursive', category: 'handwriting', source: 'fontsource', popular: true },
  { id: 'lobster', name: 'Lobster', family: 'Lobster, cursive', category: 'handwriting', source: 'fontsource', popular: true },
  { id: 'dancing-script', name: 'Dancing Script', family: '"Dancing Script", cursive', category: 'handwriting', source: 'fontsource' },
  { id: 'caveat', name: 'Caveat', family: 'Caveat, cursive', category: 'handwriting', source: 'fontsource' },
  { id: 'satisfy', name: 'Satisfy', family: 'Satisfy, cursive', category: 'handwriting', source: 'fontsource' },
  { id: 'great-vibes', name: 'Great Vibes', family: '"Great Vibes", cursive', category: 'handwriting', source: 'fontsource' },
  { id: 'kaushan-script', name: 'Kaushan Script', family: '"Kaushan Script", cursive', category: 'handwriting', source: 'fontsource' },
  { id: 'permanent-marker', name: 'Permanent Marker', family: '"Permanent Marker", cursive', category: 'handwriting', source: 'fontsource' },
  { id: 'kalam', name: 'Kalam', family: 'Kalam, cursive', category: 'handwriting', source: 'fontsource' },
  { id: 'patrick-hand', name: 'Patrick Hand', family: '"Patrick Hand", cursive', category: 'handwriting', source: 'fontsource' },
  { id: 'bangers', name: 'Bangers', family: 'Bangers, cursive', category: 'handwriting', source: 'fontsource', popular: true },

  // =========================================================
  // EXISTING SYSTEM & STANDARD FONTS
  // =========================================================
  { id: 'plus-jakarta', name: 'Plus Jakarta Sans', family: '"Plus Jakarta Sans", sans-serif', googleFont: 'Plus+Jakarta+Sans:wght@400;600;700;800', category: 'sans-serif', source: 'system', popular: true },
  { id: 'fira-code', name: 'Fira Code', family: '"Fira Code", monospace', googleFont: 'Fira+Code:wght@400;600', category: 'monospace', source: 'system' },
  { id: 'arial', name: 'Arial', family: 'Arial, Helvetica, sans-serif', category: 'sans-serif', source: 'system' },
  { id: 'georgia', name: 'Georgia', family: 'Georgia, serif', category: 'serif', source: 'system' },
  { id: 'times', name: 'Times New Roman', family: '"Times New Roman", Times, serif', category: 'serif', source: 'system' },
  { id: 'courier', name: 'Courier New', family: '"Courier New", Courier, monospace', category: 'monospace', source: 'system' },
];

// Automatic deduplication by font name
const seenFontNames = new Set<string>();
export const POPULAR_FONTS: FontFamilyItem[] = ALL_DEFINED_FONTS.filter((font) => {
  const key = font.name.toLowerCase().trim();
  if (seenFontNames.has(key)) return false;
  seenFontNames.add(key);
  return true;
});

const loadedFonts = new Set<string>();

// The designer already ships these Fontsource packages. Load their CSS on
// demand so choosing a font does not depend on Google Fonts being reachable.
const bundledFontLoaders: Record<string, () => Promise<unknown>> = {
  'abril-fatface': () => import('@fontsource/abril-fatface/400.css'),
  anton: () => import('@fontsource/anton/400.css'),
  'archivo-black': () => import('@fontsource/archivo-black/400.css'),
  'baloo-2': () => import('@fontsource/baloo-2/400.css'),
  bangers: () => import('@fontsource/bangers/400.css'),
  'barlow-condensed': () => import('@fontsource/barlow-condensed/400.css'),
  'bebas-neue': () => import('@fontsource/bebas-neue/400.css'),
  'bodoni-moda': () => import('@fontsource/bodoni-moda/400.css'),
  caveat: () => import('@fontsource/caveat/400.css'),
  cinzel: () => import('@fontsource/cinzel/400.css'),
  comfortaa: () => import('@fontsource/comfortaa/400.css'),
  cormorant: () => import('@fontsource/cormorant/400.css'),
  'cormorant-garamond': () => import('@fontsource/cormorant-garamond/400.css'),
  'dancing-script': () => import('@fontsource/dancing-script/400.css'),
  'dm-sans': () => import('@fontsource/dm-sans/400.css'),
  'exo-2': () => import('@fontsource/exo-2/400.css'),
  fredoka: () => import('@fontsource/fredoka/400.css'),
  'great-vibes': () => import('@fontsource/great-vibes/400.css'),
  inter: () => import('@fontsource/inter/400.css'),
  'josefin-sans': () => import('@fontsource/josefin-sans/400.css'),
  kalam: () => import('@fontsource/kalam/400.css'),
  'kaushan-script': () => import('@fontsource/kaushan-script/400.css'),
  lato: () => import('@fontsource/lato/400.css'),
  'league-spartan': () => import('@fontsource/league-spartan/400.css'),
  'libre-baskerville': () => import('@fontsource/libre-baskerville/400.css'),
  lobster: () => import('@fontsource/lobster/400.css'),
  lora: () => import('@fontsource/lora/400.css'),
  manrope: () => import('@fontsource/manrope/400.css'),
  merriweather: () => import('@fontsource/merriweather/400.css'),
  montserrat: () => import('@fontsource/montserrat/400.css'),
  'nunito-sans': () => import('@fontsource/nunito-sans/400.css'),
  'open-sans': () => import('@fontsource/open-sans/400.css'),
  orbitron: () => import('@fontsource/orbitron/400.css'),
  oswald: () => import('@fontsource/oswald/400.css'),
  pacifico: () => import('@fontsource/pacifico/400.css'),
  'patrick-hand': () => import('@fontsource/patrick-hand/400.css'),
  'permanent-marker': () => import('@fontsource/permanent-marker/400.css'),
  playfair: () => import('@fontsource/playfair-display/400.css'),
  poppins: () => import('@fontsource/poppins/400.css'),
  'press-start-2p': () => import('@fontsource/press-start-2p/400.css'),
  quicksand: () => import('@fontsource/quicksand/400.css'),
  raleway: () => import('@fontsource/raleway/400.css'),
  righteous: () => import('@fontsource/righteous/400.css'),
  roboto: () => import('@fontsource/roboto/400.css'),
  'roboto-condensed': () => import('@fontsource/roboto-condensed/400.css'),
  'russo-one': () => import('@fontsource/russo-one/400.css'),
  satisfy: () => import('@fontsource/satisfy/400.css'),
  'space-grotesk': () => import('@fontsource/space-grotesk/400.css'),
  staatliches: () => import('@fontsource/staatliches/400.css'),
  teko: () => import('@fontsource/teko/400.css'),
};

/**
 * Dynamically ensures a font is loaded into the browser font registry.
 * Supports Fontsource (@fontsource), Google Fonts, and standard system fonts.
 */
export async function loadFont(font: FontFamilyItem): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (loadedFonts.has(font.id)) {
    return true;
  }

  const bundledLoader = bundledFontLoaders[font.id];
  if (bundledLoader) {
    try {
      await bundledLoader();
      const family = font.family.replace(/[\"']/g, '').split(',')[0].trim();
      if (document.fonts) {
        await document.fonts.load(`400 16px "${family}"`);
        await document.fonts.ready;
      }
      loadedFonts.add(font.id);
      return true;
    } catch (error) {
      console.warn(`Failed to load bundled font: ${font.name}`, error);
      // Keep the existing Google Fonts fallback for a missing local asset.
    }
  }

  // Standard system fonts do not require network loading
  if (font.source === 'system' && !font.googleFont) {
    loadedFonts.add(font.id);
    return true;
  }

  // Load font on-demand via Google Fonts API
  const googleFamily = font.googleFont || `${encodeURIComponent(font.name.replace(/ /g, '+'))}:wght@400;700`;
  return new Promise((resolve) => {
    const linkId = `google-font-${font.id}`;
    if (document.getElementById(linkId)) {
      loadedFonts.add(font.id);
      resolve(true);
      return;
    }

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${googleFamily}&display=swap`;

    link.onload = () => {
      loadedFonts.add(font.id);
      if (document.fonts) {
        document.fonts.ready.then(() => resolve(true));
      } else {
        resolve(true);
      }
    };

    link.onerror = () => {
      console.warn(`Failed to load web font: ${font.name}`);
      resolve(false);
    };

    document.head.appendChild(link);
  });
}

/**
 * Ensures a font of specific weight/style is loaded before Fabric.js renders or measures text.
 */
export async function ensureFontLoaded(
  family: string,
  weight: string | number = 400,
  style: string = 'normal'
): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  try {
    const cleanFamily = family.replace(/["']/g, '').split(',')[0].trim();
    if (document.fonts) {
      void document.fonts.load(`${style} ${weight} 16px "${cleanFamily}"`);
      await document.fonts.ready;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Preloads popular fonts in background
 */
export function preloadPopularFonts(): void {
  if (typeof window === 'undefined') return;
  POPULAR_FONTS.filter((f) => f.popular).forEach((font) => {
    void loadFont(font);
  });
}

const customFontCache = new Map<string, FontFace>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function injectCustomFontFaceCss(family: string, dataUrl: string): void {
  if (typeof document === 'undefined') return;
  const safeId = `custom-font-face-${family.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  if (document.getElementById(safeId)) return;
  const styleEl = document.createElement('style');
  styleEl.id = safeId;
  styleEl.textContent = `
    @font-face {
      font-family: "${family}";
      src: url("${dataUrl}") format("opentype"), url("${dataUrl}") format("truetype");
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(styleEl);
}

/**
 * Dynamically loads an uploaded or custom font (.ttf, .otf, .woff, .woff2) using the browser FontFace API.
 * Uses CORS proxy for backend storage assets, converts to memory buffer + CSS @font-face data URL for
 * 100% reliable canvas and HTML preview painting without CORS or network stalls.
 */
export async function loadCustomFont(
  family: string,
  urlOrBuffer: string | ArrayBuffer,
  weight: string | number = 'normal',
  style: string = 'normal'
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const cleanFamily = family.replace(/^["']|["']$/g, '').trim();
    if (!cleanFamily) return false;

    const key = `${cleanFamily}-${weight}-${style}`;
    if (customFontCache.has(key)) {
      return true;
    }

    let buffer: ArrayBuffer | null = null;
    let fallbackUrl = '';

    if (urlOrBuffer instanceof ArrayBuffer) {
      buffer = urlOrBuffer;
    } else if (typeof urlOrBuffer === 'string') {
      const rawUrl = urlOrBuffer.trim();
      fallbackUrl = formatImageUrl(rawUrl);

      // Prioritize CORS-safe proxied URL, then direct URL
      const candidates: string[] = [];
      if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
        candidates.push(rawUrl);
      } else {
        const proxied = getProxiedImageUrl(rawUrl);
        const direct = formatImageUrl(rawUrl);
        if (proxied) candidates.push(proxied);
        if (direct && direct !== proxied) candidates.push(direct);
      }

      for (const candidate of candidates) {
        try {
          const res = await fetch(candidate, { mode: 'cors' });
          if (res.ok) {
            const data = await res.arrayBuffer();
            if (data && data.byteLength > 0) {
              buffer = data;
              break;
            }
          }
        } catch {
          // try next candidate
        }
      }
    }

    // When binary buffer is available, inject global @font-face CSS rule with data URL
    // so both HTML elements and Canvas 2D contexts instantly resolve the font family
    if (buffer) {
      try {
        const b64 = arrayBufferToBase64(buffer);
        const dataUrl = `data:font/opentype;base64,${b64}`;
        injectCustomFontFaceCss(cleanFamily, dataUrl);
      } catch (b64Err) {
        console.warn(`Could not convert font ${cleanFamily} to data URL:`, b64Err);
      }
    }

    const source = buffer || (fallbackUrl ? `url("${fallbackUrl}")` : urlOrBuffer);

    const fontFace = new FontFace(cleanFamily, source as any, {
      weight: String(weight || 'normal'),
      style: style || 'normal',
    });

    const loaded = await fontFace.load();
    document.fonts.add(loaded);
    customFontCache.set(key, loaded);

    // Also register standard weights so any CSS weight applied matches this font face
    const extraWeights = ['normal', 'bold', '700', '800'];
    for (const extraWeight of extraWeights) {
      const extraKey = `${cleanFamily}-${extraWeight}-${style}`;
      if (!customFontCache.has(extraKey)) {
        try {
          const extraFace = new FontFace(cleanFamily, source as any, {
            weight: extraWeight,
            style: style || 'normal',
          });
          const extraLoaded = await extraFace.load();
          document.fonts.add(extraLoaded);
          customFontCache.set(extraKey, extraLoaded);
        } catch {
          // ignore duplicate registration
        }
      }
    }

    await document.fonts.ready;
    return true;
  } catch (err) {
    console.warn(`Failed to load custom font: ${family}`, err);
    return false;
  }
}
