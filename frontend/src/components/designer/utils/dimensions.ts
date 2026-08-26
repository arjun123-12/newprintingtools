import { DocumentSettings, CanvasDimensions, ProductPrintPreset } from '@/types/designer';

export const MM_TO_INCH = 1 / 25.4;
export const INCH_TO_MM = 25.4;

/**
 * Converts mm to pixels at a specified DPI (default 300 for commercial print)
 */
export function mmToPx(mm: number, dpi: number = 300): number {
  return Math.round(mm * MM_TO_INCH * dpi);
}

/**
 * Converts inches to pixels at a specified DPI
 */
export function inToPx(inches: number, dpi: number = 300): number {
  return Math.round(inches * dpi);
}

/**
 * Converts pixels to mm at a specified DPI
 */
export function pxToMm(px: number, dpi: number = 300): number {
  return Number(((px / dpi) * INCH_TO_MM).toFixed(2));
}

/**
 * Converts pixels to inches at a specified DPI
 */
export function pxToIn(px: number, dpi: number = 300): number {
  return Number((px / dpi).toFixed(2));
}

/**
 * Resolves document settings to exact canvas pixel dimensions, mm values, and bleed/safe margins
 */
export function calculateCanvasDimensions(doc: DocumentSettings): CanvasDimensions {
  const dpi = doc.dpi || 300;
  let widthPx = 0;
  let heightPx = 0;
  let widthMm = 0;
  let heightMm = 0;

  if (doc.unit === 'mm') {
    widthMm = doc.width;
    heightMm = doc.height;
    widthPx = mmToPx(doc.width, dpi);
    heightPx = mmToPx(doc.height, dpi);
  } else if (doc.unit === 'in') {
    widthMm = Number((doc.width * INCH_TO_MM).toFixed(2));
    heightMm = Number((doc.height * INCH_TO_MM).toFixed(2));
    widthPx = inToPx(doc.width, dpi);
    heightPx = inToPx(doc.height, dpi);
  } else {
    // px unit
    widthPx = doc.width;
    heightPx = doc.height;
    widthMm = pxToMm(doc.width, dpi);
    heightMm = pxToMm(doc.height, dpi);
  }

  const bleedMm = doc.bleed || 0;
  const safeZoneMm = doc.safeArea || 0;
  const bleedPx = mmToPx(bleedMm, dpi);
  const safeZonePx = mmToPx(safeZoneMm, dpi);

  return {
    widthPx,
    heightPx,
    widthMm,
    heightMm,
    bleedMm,
    safeZoneMm,
    bleedPx,
    safeZonePx,
    totalWidthPx: widthPx + bleedPx * 2,
    totalHeightPx: heightPx + bleedPx * 2,
    dpi,
  };
}

/**
 * Calculates optimal zoom to fit canvas nicely inside container viewport with padding
 */
export function calculateFitZoom(
  canvasWidth: number,
  canvasHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 32,
  rulerOffset: number = 48
): number {
  if (!viewportWidth || !viewportHeight || !canvasWidth || !canvasHeight) return 1;

  const availableWidth = Math.max(viewportWidth - padding * 2 - rulerOffset, 80);
  const availableHeight = Math.max(viewportHeight - padding * 2 - rulerOffset, 80);

  const scaleX = availableWidth / canvasWidth;
  const scaleY = availableHeight / canvasHeight;

  // Choose smaller scale so whole canvas is visible preserving exact aspect ratio
  const fitScale = Math.min(scaleX, scaleY);

  // Clamp between 0.05 (5%) and 5.0 (500%) for fit
  return Number(Math.max(fitScale, 0.05).toFixed(3));
}

/**
 * Formats dimension label for display in UI
 */
export function formatDimensionsLabel(doc: DocumentSettings): string {
  if (doc.unit === 'mm') {
    return `${doc.width} × ${doc.height} mm (${doc.dpi} DPI)`;
  }
  if (doc.unit === 'in') {
    return `${doc.width} × ${doc.height} in (${doc.dpi} DPI)`;
  }
  return `${doc.width} × ${doc.height} px`;
}

/**
 * Standard Commercial Print Product Presets
 */
export const PRINT_PRODUCT_PRESETS: ProductPrintPreset[] = [
  {
    id: 'business-card-standard',
    name: 'Standard Business Card',
    category: 'Business Cards',
    width: 90,
    height: 50,
    unit: 'mm',
    dpi: 300,
    bleed: 3,
    safeArea: 3,
    description: '90 × 50 mm (Standard AUS/NZ commercial trim)',
  },
  {
    id: 'flyer-a5',
    name: 'A5 Flyer / Handout',
    category: 'Flyers',
    width: 148,
    height: 210,
    unit: 'mm',
    dpi: 300,
    bleed: 3,
    safeArea: 4,
    description: '148 × 210 mm (Half A4 format)',
  },
  {
    id: 'flyer-a4',
    name: 'A4 Document / Poster',
    category: 'Posters',
    width: 210,
    height: 297,
    unit: 'mm',
    dpi: 300,
    bleed: 3,
    safeArea: 5,
    description: '210 × 297 mm (Full page commercial print)',
  },
  {
    id: 'postcard-dl',
    name: 'DL Postcard / Rack Card',
    category: 'Postcards',
    width: 99,
    height: 210,
    unit: 'mm',
    dpi: 300,
    bleed: 3,
    safeArea: 4,
    description: '99 × 210 mm (Envelope & brochure stand format)',
  },
  {
    id: 'sticker-square',
    name: 'Square Product Label',
    category: 'Labels & Stickers',
    width: 75,
    height: 75,
    unit: 'mm',
    dpi: 300,
    bleed: 2,
    safeArea: 3,
    description: '75 × 75 mm (Square custom packaging label)',
  },
];
