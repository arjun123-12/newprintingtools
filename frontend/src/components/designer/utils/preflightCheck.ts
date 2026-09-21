import { Canvas, Textbox, IText, FabricImage, FabricObject } from 'fabric';
import { CanvasDimensions, ArtworkQualityInfo } from '@/types/designer';

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
  details?: ZoneViolationDetail[];
}

/** Per-object description of which zone line it touches/crosses */
export interface ZoneViolationDetail {
  objectId: string;
  objectName: string;
  objectType: string;
  violations: ZoneViolationType[];
}

export type ZoneViolationType =
  | 'inside-safe-zone'           // fully inside safe area — good
  | 'touches-safe-zone'          // edge touches the safe zone line
  | 'crosses-safe-zone'          // partially outside safe zone
  | 'outside-safe-zone'          // fully outside safe zone
  | 'touches-trim-line'          // edge sits exactly on the trim/cut line
  | 'crosses-trim-line'          // element crosses the trim line (will be partially cut)
  | 'outside-trim-line'          // fully outside trim (in bleed area only)
  | 'touches-bleed-edge'         // edge touches the bleed outer boundary
  | 'crosses-bleed-edge'         // extends beyond bleed (will be lost)
  | 'outside-canvas';            // fully outside canvas

export interface PreflightReport {
  overallStatus: 'ready' | 'warning' | 'error';
  isReadyForPrint: boolean;
  issuesCount: number;
  checks: PreflightCheckItem[];
  hasSafeZoneViolation: boolean;
  hasTrimLineViolation: boolean;
  hasBleedViolation: boolean;
  violatingObjectIds: string[];
  alertMessages: AlertMessage[];
}

/** Customer-facing alert messages */
export interface AlertMessage {
  severity: 'info' | 'warning' | 'danger';
  icon: 'safe' | 'trim' | 'bleed' | 'overflow';
  title: string;
  description: string;
  objectIds: string[];
}

function getObjectName(obj: FabricObject): string {
  const customName = obj.get('id' as any) as string;
  const type = obj.type || 'object';
  if (customName) return customName;
  if (obj instanceof Textbox || obj instanceof IText) {
    const text = ((obj as any).text || '').substring(0, 20);
    return text ? `Text "${text}${text.length >= 20 ? '…' : ''}"` : 'Text Box';
  }
  if (obj instanceof FabricImage || type === 'image') return 'Image';
  if (type === 'rect') return 'Rectangle';
  if (type === 'circle') return 'Circle';
  if (type === 'triangle') return 'Triangle';
  if (type === 'path') return (obj.get('isBrushPath' as any) ? 'Brush Stroke' : 'Shape');
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getObjectType(obj: FabricObject): string {
  if (obj instanceof Textbox || obj instanceof IText) return 'text';
  if (obj instanceof FabricImage || obj.type === 'image') return 'image';
  if (obj.get('isBrushPath' as any)) return 'brush';
  return obj.type || 'shape';
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

  const emptyReport: PreflightReport = {
    overallStatus: 'ready',
    isReadyForPrint: true,
    issuesCount: 0,
    checks,
    hasSafeZoneViolation: false,
    hasTrimLineViolation: false,
    hasBleedViolation: false,
    violatingObjectIds: [],
    alertMessages: [],
  };

  if (!canvas) return emptyReport;

  // Editor-only objects must never take part in print validation.
  const objects = canvas.getObjects().filter((obj) => {
    return !(
      obj.get('isGuide' as any) ||
      obj.get('isPrintGuide' as any) ||
      obj.get('isRulerGuide' as any) ||
      obj.get('excludeFromExport' as any) ||
      (obj as any).excludeFromExport
    );
  });
  // widthPx / heightPx are the TRIM size.
  // The real Fabric canvas now includes bleed on all four sides.
  const trimWidth = dimensions.widthPx || 1063;
  const trimHeight = dimensions.heightPx || 591;
  const bleedPx = Math.max(0, Number(dimensions.bleedPx) || 0);
  const canvasW = trimWidth + bleedPx * 2;
  const canvasH = trimHeight + bleedPx * 2;
  // Keep validation on the exact same inset used by CanvasGuides. Without
  // this, the visible margin can be in one position while preflight checks a
  // different invisible line and reports an apparently false warning.
  const safeZonePx =
    dimensions.marginPx !== undefined && dimensions.marginPx > 0
      ? dimensions.marginPx
      : dimensions.safeZonePx !== undefined && dimensions.safeZonePx > 0
        ? dimensions.safeZonePx
        : 0;

  // =========================================================================
  // ZONE BOUNDARIES (same coordinate model as CanvasGuides / CanvasManager)
  // =========================================================================
  // RED bleed/artwork edge: 0 .. canvasW / canvasH
  // BLACK trim edge:       bleedPx .. bleedPx + trimWidth/trimHeight
  // GREEN safe edge:       trim edge + safeZonePx
  // =========================================================================

  const bleedMinX = 0;
  const bleedMinY = 0;
  const bleedMaxX = canvasW;
  const bleedMaxY = canvasH;

  const trimMinX = bleedPx;
  const trimMinY = bleedPx;
  const trimMaxX = bleedPx + trimWidth;
  const trimMaxY = bleedPx + trimHeight;

  const safeMinX = trimMinX + safeZonePx;
  const safeMinY = trimMinY + safeZonePx;
  const safeMaxX = trimMaxX - safeZonePx;
  const safeMaxY = trimMaxY - safeZonePx;

  const safeMarginViolations: string[] = [];
  const safeMarginDetails: ZoneViolationDetail[] = [];
  const trimLineViolations: string[] = [];
  const trimLineDetails: ZoneViolationDetail[] = [];
  const bleedViolations: string[] = [];
  const bleedDetails: ZoneViolationDetail[] = [];
  const alertMessages: AlertMessage[] = [];

  // Roughly 0.25 mm of scene-space tolerance prevents stroke width and
  // floating-point rounding from flagging an object that visually touches
  // (but does not cross) a printed boundary. This value does not depend on
  // editor zoom.
  const dpi = dimensions.dpi || 300;
  const TOUCH_TOLERANCE = Math.max(1, (dpi / 25.4) * 0.25);

  objects.forEach((obj, objectIndex) => {
    const id =
      (obj.get('id' as any) as string) ||
      `preflight-${obj.type || 'object'}-${objectIndex}`;
    if (obj.visible === false) return;

    const bound = obj.getBoundingRect();
    const objName = getObjectName(obj);
    const objType = getObjectType(obj);

    const sourceType = String(
      obj.get('sourceType' as any) ||
      (obj as any).metadata?.sourceType ||
      ''
    ).toLowerCase();

    const isTextObject = obj instanceof Textbox || obj instanceof IText;

    // Backgrounds and photo frames are intentionally allowed to extend past
    // the safe and trim lines. They should only fail when they overflow the
    // outer bleed/canvas boundary.
    const isBackground =
      Boolean(obj.get('isBackground' as any)) ||
      sourceType === 'background' ||
      (!isTextObject &&
        bound.width >= canvasW * 0.9 &&
        bound.height >= canvasH * 0.9);

    const isFrameArtwork =
      Boolean(obj.get('isFrame' as any)) ||
      Boolean(obj.get('isPhotoShapeGroup' as any)) ||
      Boolean(obj.get('isCustomFrame' as any)) ||
      Boolean(obj.get('isCanvaPlaceholder' as any)) ||
      sourceType === 'frame' ||
      sourceType === 'frame-overlay';

    const isIntentionalEdgeArtwork = isBackground || isFrameArtwork;

    const objLeft = bound.left;
    const objTop = bound.top;
    const objRight = bound.left + bound.width;
    const objBottom = bound.top + bound.height;

    // -----------------------------------------------------------------------
    // CHECK 1: Safe Zone
    // -----------------------------------------------------------------------
    const outsideSafeLeft = safeMinX - objLeft;
    const outsideSafeTop = safeMinY - objTop;
    const outsideSafeRight = objRight - safeMaxX;
    const outsideSafeBottom = objBottom - safeMaxY;

    const isSafeViolation =
      safeZonePx > 0 &&
      (outsideSafeLeft > TOUCH_TOLERANCE ||
        outsideSafeTop > TOUCH_TOLERANCE ||
        outsideSafeRight > TOUCH_TOLERANCE ||
        outsideSafeBottom > TOUCH_TOLERANCE);

    // Touching the safe line is valid. Warn only after an actual crossing,
    // and never warn for backgrounds/frames that are supposed to reach edges.
    if (!isIntentionalEdgeArtwork && isSafeViolation) {
      safeMarginViolations.push(id);
      safeMarginDetails.push({
        objectId: id,
        objectName: objName,
        objectType: objType,
        violations: ['crosses-safe-zone'],
      });
    }

    // -----------------------------------------------------------------------
    // CHECK 2: Trim Line (Cut Line)
    // -----------------------------------------------------------------------
    if (bleedPx > 0) {
      const outsideTrimLeft = trimMinX - objLeft;
      const outsideTrimTop = trimMinY - objTop;
      const outsideTrimRight = objRight - trimMaxX;
      const outsideTrimBottom = objBottom - trimMaxY;

      const isTrimCross =
        outsideTrimLeft > TOUCH_TOLERANCE ||
        outsideTrimTop > TOUCH_TOLERANCE ||
        outsideTrimRight > TOUCH_TOLERANCE ||
        outsideTrimBottom > TOUCH_TOLERANCE;

      const isTrimTouch =
        !isTrimCross && (
          Math.abs(objLeft - trimMinX) <= TOUCH_TOLERANCE ||
          Math.abs(objTop - trimMinY) <= TOUCH_TOLERANCE ||
          Math.abs(objRight - trimMaxX) <= TOUCH_TOLERANCE ||
          Math.abs(objBottom - trimMaxY) <= TOUCH_TOLERANCE
        );

      if (!isIntentionalEdgeArtwork && isTrimCross) {
        trimLineViolations.push(id);
        trimLineDetails.push({
          objectId: id,
          objectName: objName,
          objectType: objType,
          violations: ['crosses-trim-line'],
        });
      } else if (!isIntentionalEdgeArtwork && isTrimTouch) {
        trimLineViolations.push(id);
        trimLineDetails.push({
          objectId: id,
          objectName: objName,
          objectType: objType,
          violations: ['touches-trim-line'],
        });
      }
    }

    // -----------------------------------------------------------------------
    // CHECK 3: Bleed Boundary (Canvas Edge)
    // -----------------------------------------------------------------------
    const outsideBleedLeft = bleedMinX - objLeft;
    const outsideBleedTop = bleedMinY - objTop;
    const outsideBleedRight = objRight - bleedMaxX;
    const outsideBleedBottom = objBottom - bleedMaxY;

    const isBleedOverflow =
      outsideBleedLeft > TOUCH_TOLERANCE ||
      outsideBleedTop > TOUCH_TOLERANCE ||
      outsideBleedRight > TOUCH_TOLERANCE ||
      outsideBleedBottom > TOUCH_TOLERANCE;

    if (isBleedOverflow) {
      bleedViolations.push(id);
      bleedDetails.push({
        objectId: id,
        objectName: objName,
        objectType: objType,
        violations: ['crosses-bleed-edge'],
      });
    }
  });

  // =========================================================================
  // BUILD CHECK RESULTS WITH DESCRIPTIVE MESSAGES
  // =========================================================================

  const safeCheck = checks.find((c) => c.id === 'safe-margin')!;
  if (safeMarginViolations.length > 0) {
    const crossCount = safeMarginDetails.filter(d => d.violations.includes('crosses-safe-zone')).length;
    safeCheck.status = 'warning';
    const parts: string[] = [];
    if (crossCount > 0) parts.push(`${crossCount} element(s) cross outside the safe margin`);
    safeCheck.message = `${parts.join('; ')}. Text and logos here may be cut off during trimming.`;
    safeCheck.offendingObjectIds = safeMarginViolations;
    safeCheck.details = safeMarginDetails;
  }

  const trimCheck = checks.find((c) => c.id === 'trim-line')!;
  if (trimLineViolations.length > 0) {
    const crossCount = trimLineDetails.filter(d => d.violations.includes('crosses-trim-line')).length;
    const touchCount = trimLineDetails.filter(d => d.violations.includes('touches-trim-line')).length;
    trimCheck.status = crossCount > 0 ? 'warning' : 'warning';
    const parts: string[] = [];
    if (crossCount > 0) parts.push(`${crossCount} element(s) cross the trim/cut line`);
    if (touchCount > 0) parts.push(`${touchCount} element(s) touch the trim/cut line`);
    trimCheck.message = `${parts.join('; ')}. These parts will be partially cut by the guillotine.`;
    trimCheck.offendingObjectIds = trimLineViolations;
    trimCheck.details = trimLineDetails;
  }

  const bleedCheck = checks.find((c) => c.id === 'bleed-area')!;
  if (bleedViolations.length > 0) {
    const overflowCount = bleedDetails.filter(d => d.violations.includes('crosses-bleed-edge')).length;
    bleedCheck.status = 'error';
    const parts: string[] = [];
    if (overflowCount > 0) parts.push(`${overflowCount} element(s) extend beyond the bleed area`);
    bleedCheck.message = `${parts.join('; ')}. Content outside the bleed will be completely lost.`;
    bleedCheck.offendingObjectIds = bleedViolations;
    bleedCheck.details = bleedDetails;
  }

  // =========================================================================
  // BUILD CUSTOMER-FACING ALERT MESSAGES
  // =========================================================================

  // Safe Zone alerts
  safeMarginDetails.forEach((detail) => {
    if (detail.violations.includes('crosses-safe-zone')) {
      alertMessages.push({
        severity: 'warning',
        icon: 'safe',
        title: `"${detail.objectName}" crosses the Safe Zone`,
        description: `This ${detail.objectType} extends beyond the safe margin. It may be cut off when the paper is trimmed. Move it inward to protect it.`,
        objectIds: [detail.objectId],
      });
    } else if (detail.violations.includes('touches-safe-zone')) {
      alertMessages.push({
        severity: 'info',
        icon: 'safe',
        title: `"${detail.objectName}" touches the Safe Zone line`,
        description: `This ${detail.objectType} is right on the safe zone edge. Move it slightly inward for safety.`,
        objectIds: [detail.objectId],
      });
    }
  });

  // Trim Line alerts
  trimLineDetails.forEach((detail) => {
    if (detail.violations.includes('crosses-trim-line')) {
      alertMessages.push({
        severity: 'danger',
        icon: 'trim',
        title: `"${detail.objectName}" crosses the Trim Line (Cut)`,
        description: `This ${detail.objectType} extends past the dark cut line. The printer's guillotine will slice through it. Part of this element will be cut off in the final print.`,
        objectIds: [detail.objectId],
      });
    } else if (detail.violations.includes('touches-trim-line')) {
      alertMessages.push({
        severity: 'warning',
        icon: 'trim',
        title: `"${detail.objectName}" touches the Trim Line (Cut)`,
        description: `This ${detail.objectType} sits right on the cut line. Even 1mm of cutting variance could clip it. Move it inward or extend it fully into the bleed.`,
        objectIds: [detail.objectId],
      });
    }
  });

  // Bleed alerts
  bleedDetails.forEach((detail) => {
    if (detail.violations.includes('crosses-bleed-edge')) {
      alertMessages.push({
        severity: 'danger',
        icon: 'bleed',
        title: `"${detail.objectName}" overflows the Bleed area`,
        description: `This ${detail.objectType} extends beyond the printable bleed boundary. Everything past the red bleed line will be completely lost and not printed.`,
        objectIds: [detail.objectId],
      });
    } else if (detail.violations.includes('touches-bleed-edge')) {
      alertMessages.push({
        severity: 'info',
        icon: 'bleed',
        title: `"${detail.objectName}" touches the Bleed edge`,
        description: `This ${detail.objectType} reaches the outer bleed boundary. This is fine for background fills that should extend to the edge.`,
        objectIds: [detail.objectId],
      });
    }
  });

  // =========================================================================
  // OVERALL STATUS
  // =========================================================================

  const warnings = checks.filter((c) => c.status === 'warning').length;
  const errors = checks.filter((c) => c.status === 'error').length;
  const totalIssues = warnings + errors;

  let overallStatus: 'ready' | 'warning' | 'error' = 'ready';
  if (errors > 0) {
    overallStatus = 'error';
  } else if (warnings > 0) {
    overallStatus = 'warning';
  }

  const allViolatingIds = [
    ...new Set([...safeMarginViolations, ...trimLineViolations, ...bleedViolations]),
  ];

  return {
    overallStatus,
    isReadyForPrint: totalIssues === 0,
    issuesCount: totalIssues,
    checks,
    hasSafeZoneViolation: safeMarginViolations.length > 0,
    hasTrimLineViolation: trimLineViolations.length > 0,
    hasBleedViolation: bleedViolations.length > 0,
    violatingObjectIds: allViolatingIds,
    alertMessages,
  };
}
