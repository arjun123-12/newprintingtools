import { DesignerGradientValue, DesignerGradientStop } from '@/types/designer';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

/**
 * Converts a hex string (#RGB, #RRGGBB, or #RRGGBBAA) to an RGB object.
 */
export function hexToRgb(hex: string): RgbColor | null {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (clean.length === 6) {
    const num = parseInt(clean, 16);
    if (isNaN(num)) return null;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      a: 1,
    };
  }
  if (clean.length === 8) {
    const num = parseInt(clean, 16);
    if (isNaN(num)) return null;
    return {
      r: (num >> 24) & 255,
      g: (num >> 16) & 255,
      b: (num >> 8) & 255,
      a: Math.round(((num & 255) / 255) * 100) / 100,
    };
  }
  return null;
}

/**
 * Converts RGB numbers to #RRGGBB.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts HSV to #RRGGBB.
 * h in [0, 360), s in [0, 100], v in [0, 100]
 */
export function hsvToHex(h: number, s: number, v: number): string {
  s = s / 100;
  v = v / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  );
}

/**
 * Converts hex to HSV.
 */
export function hexToHsv(hex: string): HsvColor {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, v: 100 };

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  if (d === 0) {
    h = 0;
  } else if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  } else if (max === g) {
    h = ((b - r) / d + 2) * 60;
  } else {
    h = ((r - g) / d + 4) * 60;
  }

  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
}

/**
 * Validates a color hex string.
 */
export function isValidHex(hex: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(hex.trim());
}

/**
 * Converts DesignerGradientValue or solid color string into a CSS background rule.
 */
export function colorOrGradientToCss(
  val: string | DesignerGradientValue | undefined | null,
  fallback: string = '#000000'
): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'stops' in val && Array.isArray(val.stops)) {
    const stopsStr = val.stops
      .map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`)
      .join(', ');
    if (val.type === 'radial') {
      return `radial-gradient(circle, ${stopsStr})`;
    }
    return `linear-gradient(${val.angle ?? 90}deg, ${stopsStr})`;
  }
  return fallback;
}

/**
 * Converts a Fabric.js Gradient object into DesignerGradientValue.
 */
export function fabricGradientToDesignerGradient(
  gradient: any
): DesignerGradientValue | null {
  if (!gradient || typeof gradient !== 'object') return null;
  const type: 'linear' | 'radial' =
    gradient.type === 'radial' ? 'radial' : 'linear';

  let angle = 90;
  if (type === 'linear' && gradient.coords) {
    const dx = (gradient.coords.x2 ?? 0) - (gradient.coords.x1 ?? 0);
    const dy = (gradient.coords.y2 ?? 0) - (gradient.coords.y1 ?? 0);
    const rad = Math.atan2(dy, dx);
    angle = Math.round((((rad * 180) / Math.PI + 90) % 360 + 360) % 360);
  }

  const rawStops = Array.isArray(gradient.colorStops)
    ? gradient.colorStops
    : [];

  const stops: DesignerGradientStop[] = rawStops
    .map((s: any) => ({
      offset:
        typeof s.offset === 'number'
          ? Math.max(0, Math.min(1, s.offset))
          : parseFloat(s.offset) || 0,
      color: typeof s.color === 'string' ? s.color : '#000000',
    }))
    .sort((a: DesignerGradientStop, b: DesignerGradientStop) => a.offset - b.offset);

  if (stops.length < 2) return null;

  return {
    type,
    angle,
    stops,
  };
}

const RECENT_COLORS_KEY = 'designer_recent_colors';
const MAX_RECENT_COLORS = 12;

/**
 * Loads recent solid colors from localStorage.
 */
export function getRecentColors(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_COLORS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((c) => typeof c === 'string' && isValidHex(c));
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return [];
}

/**
 * Adds a valid solid color to localStorage recents.
 */
export function addRecentColor(color: string): string[] {
  if (!color || typeof color !== 'string') return getRecentColors();
  let clean = color.trim();
  if (!clean.startsWith('#')) clean = '#' + clean;
  if (!isValidHex(clean)) return getRecentColors();

  if (typeof window === 'undefined') return [];
  try {
    const existing = getRecentColors();
    const normalized = clean.toLowerCase();
    const filtered = existing.filter((c) => c.toLowerCase() !== normalized);
    const updated = [clean, ...filtered].slice(0, MAX_RECENT_COLORS);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Normalizes any visible CSS / SVG color string into standard #rrggbb hex.
 * Returns null for transparent, none, empty, rgba(..., 0), and invalid colors.
 */
export function normalizeHexColor(input: unknown): string | null {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  if (!str) return null;
  const lower = str.toLowerCase();

  if (
    lower === 'transparent' ||
    lower === 'none' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'inherit' ||
    lower === 'initial'
  ) {
    return null;
  }

  // Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (lower.startsWith('#')) {
    const hex = lower.slice(1);
    if (hex.length === 3) {
      if (/^[0-9a-f]{3}$/.test(hex)) {
        return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
      }
    }
    if (hex.length === 4) {
      if (/^[0-9a-f]{4}$/.test(hex)) {
        const alphaHex = hex[3];
        if (alphaHex === '0') return null;
        return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
      }
    }
    if (hex.length === 6) {
      if (/^[0-9a-f]{6}$/.test(hex)) {
        return `#${hex}`;
      }
    }
    if (hex.length === 8) {
      if (/^[0-9a-f]{8}$/.test(hex)) {
        const alphaVal = parseInt(hex.slice(6, 8), 16);
        if (isNaN(alphaVal) || alphaVal <= 0) return null;
        return `#${hex.slice(0, 6)}`;
      }
    }
  }

  // rgb / rgba
  const rgbaMatch = lower.match(
    /^rgba?\s*\(\s*(\d+(?:\.\d+)?%?)\s*,\s*(\d+(?:\.\d+)?%?)\s*,\s*(\d+(?:\.\d+)?%?)(?:\s*,\s*([\d.]+))?\s*\)$/
  );
  if (rgbaMatch) {
    const parseVal = (c: string) =>
      c.endsWith('%') ? Math.round((parseFloat(c) / 100) * 255) : Math.round(parseFloat(c));
    const r = Math.min(255, Math.max(0, parseVal(rgbaMatch[1])));
    const g = Math.min(255, Math.max(0, parseVal(rgbaMatch[2])));
    const b = Math.min(255, Math.max(0, parseVal(rgbaMatch[3])));
    const alphaStr = rgbaMatch[4];
    if (alphaStr !== undefined) {
      const alpha = parseFloat(alphaStr);
      if (isNaN(alpha) || alpha <= 0.001) return null;
    }
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // Common SVG & CSS named colors
  const NAMED_COLORS: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    silver: '#c0c0c0',
    gray: '#808080',
    grey: '#808080',
    maroon: '#800000',
    olive: '#808000',
    purple: '#800080',
    teal: '#008080',
    navy: '#000080',
    orange: '#ffa500',
    pink: '#ffc0cb',
    gold: '#ffd700',
    brown: '#a52a2a',
    coral: '#ff7f50',
    indigo: '#4b0082',
    violet: '#ee82ee',
    turquoise: '#40e0d0',
    lime: '#00ff00',
  };

  if (NAMED_COLORS[lower]) {
    return NAMED_COLORS[lower];
  }

  // Browser canvas fallback for less common CSS color names
  if (typeof document !== 'undefined') {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillStyle = str;
        const computed = ctx.fillStyle;
        if (computed && computed !== str) {
          return normalizeHexColor(computed);
        }
      }
    } catch {
      // fallback
    }
  }

  return null;
}
