/**
 * Commercial Print CMYK Color Management Engine
 * Accurate mathematical conversion between CMYK (0-100%) and RGB/HEX for screens & print.
 */

export interface CMYKColor {
  c: number; // 0 to 100 (%)
  m: number; // 0 to 100 (%)
  y: number; // 0 to 100 (%)
  k: number; // 0 to 100 (%)
}

export interface RGBColor {
  r: number; // 0 to 255
  g: number; // 0 to 255
  b: number; // 0 to 255
}

export interface CMYKPreset {
  name: string;
  cmyk: CMYKColor;
  hex: string;
  category: string;
}

/**
 * Converts CMYK (0-100) values to RGB (0-255)
 */
export function cmykToRgb(c: number, m: number, y: number, k: number): RGBColor {
  const cNorm = Math.min(Math.max(c, 0), 100) / 100;
  const mNorm = Math.min(Math.max(m, 0), 100) / 100;
  const yNorm = Math.min(Math.max(y, 0), 100) / 100;
  const kNorm = Math.min(Math.max(k, 0), 100) / 100;

  const r = Math.round(255 * (1 - cNorm) * (1 - kNorm));
  const g = Math.round(255 * (1 - mNorm) * (1 - kNorm));
  const b = Math.round(255 * (1 - yNorm) * (1 - kNorm));

  return { r, g, b };
}

/**
 * Converts RGB (0-255) to CMYK (0-100)
 */
export function rgbToCmyk(r: number, g: number, b: number): CMYKColor {
  const rNorm = Math.min(Math.max(r, 0), 255) / 255;
  const gNorm = Math.min(Math.max(g, 0), 255) / 255;
  const bNorm = Math.min(Math.max(b, 0), 255) / 255;

  const kNorm = 1 - Math.max(rNorm, gNorm, bNorm);

  if (kNorm >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = Math.round(((1 - rNorm - kNorm) / (1 - kNorm)) * 100);
  const m = Math.round(((1 - gNorm - kNorm) / (1 - kNorm)) * 100);
  const y = Math.round(((1 - bNorm - kNorm) / (1 - kNorm)) * 100);
  const k = Math.round(kNorm * 100);

  return {
    c: Math.min(Math.max(c, 0), 100),
    m: Math.min(Math.max(m, 0), 100),
    y: Math.min(Math.max(y, 0), 100),
    k: Math.min(Math.max(k, 0), 100),
  };
}

/**
 * Converts CMYK (0-100) to Hex code (#RRGGBB)
 */
export function cmykToHex(c: number, m: number, y: number, k: number): string {
  const { r, g, b } = cmykToRgb(c, m, y, k);
  const toHex = (val: number) => val.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts Hex code (#RGB or #RRGGBB) to CMYK (0-100)
 */
export function hexToCmyk(hex: string): CMYKColor {
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }

  if (cleaned.length !== 6) {
    return { c: 0, m: 0, y: 0, k: 100 }; // fallback black
  }

  const r = parseInt(cleaned.substring(0, 2), 16) || 0;
  const g = parseInt(cleaned.substring(2, 4), 16) || 0;
  const b = parseInt(cleaned.substring(4, 6), 16) || 0;

  return rgbToCmyk(r, g, b);
}

/**
 * Calculates Total Ink Coverage (TIC / TAC) - Commercial press standard maximum is 300%
 */
export function calculateTotalInkCoverage(c: number, m: number, y: number, k: number): {
  total: number;
  isOverLimit: boolean;
  status: 'safe' | 'warning' | 'critical';
} {
  const total = Math.round(c + m + y + k);
  if (total > 320) {
    return { total, isOverLimit: true, status: 'critical' };
  }
  if (total > 300) {
    return { total, isOverLimit: true, status: 'warning' };
  }
  return { total, isOverLimit: false, status: 'safe' };
}

/**
 * Standard Commercial Print Process CMYK Swatches
 */
export const COMMERCIAL_CMYK_SWATCHES: CMYKPreset[] = [
  {
    name: 'Rich Black',
    cmyk: { c: 60, m: 40, y: 40, k: 100 },
    hex: cmykToHex(60, 40, 40, 100),
    category: 'Blacks',
  },
  {
    name: 'Standard K100 Black',
    cmyk: { c: 0, m: 0, y: 0, k: 100 },
    hex: cmykToHex(0, 0, 0, 100),
    category: 'Blacks',
  },
  {
    name: 'Process Cyan',
    cmyk: { c: 100, m: 0, y: 0, k: 0 },
    hex: cmykToHex(100, 0, 0, 0),
    category: 'Primary Inks',
  },
  {
    name: 'Process Magenta',
    cmyk: { c: 0, m: 100, y: 0, k: 0 },
    hex: cmykToHex(0, 100, 0, 0),
    category: 'Primary Inks',
  },
  {
    name: 'Process Yellow',
    cmyk: { c: 0, m: 0, y: 100, k: 0 },
    hex: cmykToHex(0, 0, 100, 0),
    category: 'Primary Inks',
  },
  {
    name: 'Commercial Navy Blue',
    cmyk: { c: 100, m: 80, y: 10, k: 30 },
    hex: cmykToHex(100, 80, 10, 30),
    category: 'Standard Inks',
  },
  {
    name: 'Forest Green',
    cmyk: { c: 85, m: 10, y: 100, k: 25 },
    hex: cmykToHex(85, 10, 100, 25),
    category: 'Standard Inks',
  },
  {
    name: 'Crimson Red',
    cmyk: { c: 10, m: 100, y: 90, k: 10 },
    hex: cmykToHex(10, 100, 90, 10),
    category: 'Standard Inks',
  },
  {
    name: 'Warm Gold',
    cmyk: { c: 5, m: 30, y: 95, k: 0 },
    hex: cmykToHex(5, 30, 95, 0),
    category: 'Standard Inks',
  },
  {
    name: 'Royal Purple',
    cmyk: { c: 75, m: 90, y: 0, k: 10 },
    hex: cmykToHex(75, 90, 0, 10),
    category: 'Standard Inks',
  },
  {
    name: 'Burnt Orange',
    cmyk: { c: 0, m: 70, y: 100, k: 0 },
    hex: cmykToHex(0, 70, 100, 0),
    category: 'Standard Inks',
  },
  {
    name: 'Pure Paper White',
    cmyk: { c: 0, m: 0, y: 0, k: 0 },
    hex: '#ffffff',
    category: 'Paper',
  },
];
