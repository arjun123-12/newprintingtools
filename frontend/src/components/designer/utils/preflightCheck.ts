import { Canvas, Textbox, IText, FabricImage, FabricObject } from 'fabric';
import { CanvasDimensions, ArtworkQualityInfo } from '@/types/designer';
import { calculateImageQuality } from './imageQuality';

export type CheckStatus = 'pass' | 'warning' | 'error';

export interface PreflightCheckItem {
  id:
  | 'safe-margin'
  | 'trim-line'
  | 'bleed-area'
  | 'low-resolution'
  | 'missing-images'
  | 'missing-logo'
  | 'missing-qr'
  | 'empty-text';
  label: string;
  status: CheckStatus;
  message?: string;
  offendingObjectIds?: string[];
}

export interface PreflightReport {
  overallStatus: 'ready' | 'warning' | 'error';
  isReadyForPrint: boolean;
  issuesCount: number;
  checks: PreflightCheckItem[];
  hasSafeZoneViolation: boolean;
  violatingObjectIds: string[];
}

export function runPreflightCheck(
  canvas: Canvas | null,
  dimensions: CanvasDimensions
): PreflightReport {
  const checks: PreflightCheckItem[] = [
    { id: 'safe-margin', label: 'Safe Margin', status: 'pass' },
    { id: 'trim-line', label: 'Trim Line', status: 'pass' },
    { id: 'bleed-area', label: 'Bleed Area', status: 'pass' },
  ];

  if (!canvas) {
    return {
      overallStatus: 'ready',
      isReadyForPrint: true,
      issuesCount: 0,
      checks,
      hasSafeZoneViolation: false,
      violatingObjectIds: [],
    };
  }

  const objects = canvas.getObjects().filter((obj) => !obj.get('isGuide' as any));
  const canvasW = dimensions.widthPx || 1063;
  const canvasH = dimensions.heightPx || 591;
  const safeZonePx = dimensions.safeZonePx || 35;

  const safeMinX = safeZonePx;
  const safeMinY = safeZonePx;
  const safeMaxX = canvasW - safeZonePx;
  const safeMaxY = canvasH - safeZonePx;

  const safeMarginViolations: string[] = [];
  const lowResViolations: string[] = [];
  const emptyTextViolations: string[] = [];
  const missingImageViolations: string[] = [];

  objects.forEach((obj) => {
    const id = (obj.get('id' as any) as string) || '';
    const isText = obj instanceof Textbox || obj instanceof IText;
    const isImage = obj instanceof FabricImage || obj.type === 'image';

    // 1. Safe Margin Check (for text and foreground objects)
    if (obj.visible !== false) {
      const bound = obj.getBoundingRect();
      // Only flag if object is not a full-canvas background rect
      const isBackground =
        obj.type === 'rect' &&
        bound.width >= canvasW * 0.95 &&
        bound.height >= canvasH * 0.95;

      if (!isBackground) {
        const objMinX = bound.left;
        const objMinY = bound.top;
        const objMaxX = bound.left + bound.width;
        const objMaxY = bound.top + bound.height;

        if (
          objMinX < safeMinX ||
          objMinY < safeMinY ||
          objMaxX > safeMaxX ||
          objMaxY > safeMaxY
        ) {
          safeMarginViolations.push(id);
        }
      }
    }

    // 2. Empty / Unedited Placeholder Text Check


    // 3. Low Resolution & Missing Image Check

  });

  // Evaluate Safe Margin check
  const safeMarginCheck = checks.find((c) => c.id === 'safe-margin')!;
  if (safeMarginViolations.length > 0) {
    safeMarginCheck.status = 'warning';
    safeMarginCheck.message = `${safeMarginViolations.length} element(s) extend outside the 3mm safe margin and may be cut off during printing.`;
    safeMarginCheck.offendingObjectIds = safeMarginViolations;
  }

  // Evaluate Empty Text check


  // Evaluate Low Resolution check

  // Evaluate Missing Images check


  const warnings = checks.filter((c) => c.status === 'warning').length;
  const errors = checks.filter((c) => c.status === 'error').length;
  const totalIssues = warnings + errors;

  let overallStatus: 'ready' | 'warning' | 'error' = 'ready';
  if (errors > 0) {
    overallStatus = 'error';
  } else if (warnings > 0) {
    overallStatus = 'warning';
  }

  return {
    overallStatus,
    isReadyForPrint: totalIssues === 0,
    issuesCount: totalIssues,
    checks,
    hasSafeZoneViolation: safeMarginViolations.length > 0,
    violatingObjectIds: safeMarginViolations,
  };
}
