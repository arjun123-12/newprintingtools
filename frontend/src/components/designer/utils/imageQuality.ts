import { ArtworkQuality, ArtworkQualityInfo } from '@/types/designer';
import { INCH_TO_MM } from './dimensions';

/**
 * Calculates effective print DPI and quality rating for a raster image object on canvas.
 *
 * @param naturalWidth Original pixel width of source file
 * @param naturalHeight Original pixel height of source file
 * @param renderedWidthPx On-canvas width in 300 DPI canvas coordinates
 * @param renderedHeightPx On-canvas height in 300 DPI canvas coordinates
 * @param documentDpi Target document resolution (default 300)
 */
export function calculateImageQuality(
  naturalWidth: number,
  naturalHeight: number,
  renderedWidthPx: number,
  renderedHeightPx: number,
  fileSizeBytes: number = 0,
  documentDpi: number = 300
): ArtworkQualityInfo {
  // Physical print dimensions in mm
  const printWidthInches = (renderedWidthPx || 1) / documentDpi;
  const printHeightInches = (renderedHeightPx || 1) / documentDpi;
  const printWidthMm = Number((printWidthInches * INCH_TO_MM).toFixed(1));
  const printHeightMm = Number((printHeightInches * INCH_TO_MM).toFixed(1));

  // Effective DPI = Original image pixels / Physical print inches
  const effectiveDpiX = (naturalWidth || renderedWidthPx) / Math.max(printWidthInches, 0.01);
  const effectiveDpiY = (naturalHeight || renderedHeightPx) / Math.max(printHeightInches, 0.01);
  const estimatedDpi = Math.round(Math.min(effectiveDpiX, effectiveDpiY));

  // Quality evaluation
  let status: ArtworkQuality = 'excellent';
  if (estimatedDpi >= 300) {
    status = 'excellent';
  } else if (estimatedDpi >= 200) {
    status = 'good';
  } else if (estimatedDpi >= 150) {
    status = 'low';
  } else {
    status = 'critical';
  }

  return {
    originalWidth: naturalWidth || renderedWidthPx,
    originalHeight: naturalHeight || renderedHeightPx,
    fileSizeBytes,
    estimatedDpi,
    status,
    printWidthMm,
    printHeightMm,
  };
}

/**
 * Formats bytes into human readable KB / MB string
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns badge styling and advice text for DPI status
 */
export function getQualityBadgeDetails(status: ArtworkQuality): {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
} {
  switch (status) {
    case 'excellent':
      return {
        label: 'Excellent (300+ DPI)',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        description: 'Crystal clear commercial print quality.',
      };
    case 'good':
      return {
        label: 'Good (200-299 DPI)',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-200',
        description: 'Acceptable sharpness for most print products.',
      };
    case 'low':
      return {
        label: 'Low Resolution (150-199 DPI)',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-700',
        badgeBorder: 'border-amber-200',
        description: 'May appear slightly soft or pixelated up close.',
      };
    case 'critical':
    default:
      return {
        label: 'Critical (< 150 DPI)',
        badgeBg: 'bg-red-50',
        badgeText: 'text-red-700',
        badgeBorder: 'border-red-200',
        description: 'Noticeable pixelation will occur on final print. Use a larger image.',
      };
  }
}
