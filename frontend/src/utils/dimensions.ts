export const STANDARD_PRINT_DPI = 300;
export const MM_PER_INCH = 25.4;

export function mmToPixels(mm: number, dpi: number = STANDARD_PRINT_DPI): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

export function pixelsToMm(pixels: number, dpi: number = STANDARD_PRINT_DPI): number {
  return Number(((pixels / dpi) * MM_PER_INCH).toFixed(2));
}

export function calculateCanvasTotalDimensions(
  trimWidthMm: number,
  trimHeightMm: number,
  bleedMm: number = 5
) {
  const totalWidthMm = trimWidthMm + bleedMm * 2;
  const totalHeightMm = trimHeightMm + bleedMm * 2;

  return {
    totalWidthMm,
    totalHeightMm,
    totalWidthPx: mmToPixels(totalWidthMm),
    totalHeightPx: mmToPixels(totalHeightMm),
  };
}
