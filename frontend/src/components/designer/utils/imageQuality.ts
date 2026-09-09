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
 * Exact print DPI formula accounting for canvas coordinates, document mm, and crop.
 */
export function calculateFabricImageEffectiveDpi(
  sourceWidth: number,
  sourceHeight: number,
  objectWidth: number,
  objectHeight: number,
  scaleX: number = 1.0,
  scaleY: number = 1.0,
  canvasWidthPx: number = 1063,
  canvasHeightPx: number = 591,
  documentWidthMm: number = 90,
  documentHeightMm: number = 50,
  crop?: { cropX?: number; cropY?: number; cropWidth?: number; cropHeight?: number },
  targetDpi: number = 300
): {
  effectiveDpi: number;
  qualityLevel: 'excellent' | 'acceptable' | 'low';
  targetDpi: number;
  printedWidthInches: number;
  printedHeightInches: number;
  recommendedScale: 1 | 2 | 4;
  requiresUpscale: boolean;
} {
  let effectiveSourceW = sourceWidth || objectWidth || 100;
  let effectiveSourceH = sourceHeight || objectHeight || 100;

  if (crop && crop.cropWidth && crop.cropWidth > 0 && crop.cropHeight && crop.cropHeight > 0) {
    effectiveSourceW = crop.cropWidth;
    effectiveSourceH = crop.cropHeight;
  }

  const cvW = Math.max(canvasWidthPx, 1);
  const cvH = Math.max(canvasHeightPx, 1);
  const docW = Math.max(documentWidthMm, 1);
  const docH = Math.max(documentHeightMm, 1);

  const displayedWidthPx = Math.max(1, Math.abs(objectWidth * scaleX));
  const displayedHeightPx = Math.max(1, Math.abs(objectHeight * scaleY));

  const displayedWidthMm = (displayedWidthPx / cvW) * docW;
  const displayedHeightMm = (displayedHeightPx / cvH) * docH;

  const printedWidthInches = Math.max(0.01, displayedWidthMm / 25.4);
  const printedHeightInches = Math.max(0.01, displayedHeightMm / 25.4);

  const dpiX = effectiveSourceW / printedWidthInches;
  const dpiY = effectiveSourceH / printedHeightInches;
  const effectiveDpi = Math.round(Math.min(dpiX, dpiY));

  let qualityLevel: 'excellent' | 'acceptable' | 'low' = 'excellent';
  if (effectiveDpi < 150) {
    qualityLevel = 'low';
  } else if (effectiveDpi < targetDpi) {
    qualityLevel = 'acceptable';
  }

  const requiresUpscale = effectiveDpi < targetDpi;
  let recommendedScale: 1 | 2 | 4 = 1;
  if (requiresUpscale) {
    recommendedScale = (effectiveDpi * 2 >= targetDpi) ? 2 : 4;
  }

  return {
    effectiveDpi,
    qualityLevel,
    targetDpi,
    printedWidthInches: Number(printedWidthInches.toFixed(2)),
    printedHeightInches: Number(printedHeightInches.toFixed(2)),
    recommendedScale,
    requiresUpscale,
  };
}

/**
 * Returns badge styling and advice text for DPI status
 */
export function getQualityBadgeDetails(
  status: 'excellent' | 'acceptable' | 'good' | 'low' | 'critical' | 'enhancing' | 'unavailable' | string
): {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  description: string;
} {
  switch (status) {
    case 'excellent':
      return {
        label: 'Excellent',
        badgeBg: 'bg-emerald-50 text-emerald-700',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        dotColor: 'bg-emerald-500',
        description: 'Crystal clear commercial print quality (300+ DPI).',
      };
    case 'acceptable':
    case 'good':
      return {
        label: 'Acceptable',
        badgeBg: 'bg-amber-50 text-amber-700',
        badgeText: 'text-amber-700',
        badgeBorder: 'border-amber-200',
        dotColor: 'bg-amber-500',
        description: 'Acceptable sharpness (150-299 DPI). Enhancing will sharpen.',
      };
    case 'low':
    case 'critical':
      return {
        label: 'Low Quality',
        badgeBg: 'bg-rose-50 text-rose-700',
        badgeText: 'text-rose-700',
        badgeBorder: 'border-rose-200',
        dotColor: 'bg-rose-500',
        description: 'Low resolution (<150 DPI). AI Enhancement strongly recommended.',
      };
    case 'enhancing':
      return {
        label: 'Enhancing...',
        badgeBg: 'bg-blue-50 text-blue-700',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-200',
        dotColor: 'bg-blue-500',
        description: 'Real-ESRGAN AI upscaling in progress...',
      };
    case 'unavailable':
    default:
      return {
        label: 'Enhance Unavailable',
        badgeBg: 'bg-gray-100 text-gray-700',
        badgeText: 'text-gray-700',
        badgeBorder: 'border-gray-300',
        dotColor: 'bg-gray-400',
        description: 'AI upscaling is not required or unavailable for this item.',
      };
  }
}

