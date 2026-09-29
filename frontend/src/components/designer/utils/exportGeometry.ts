import { CanvasDimensions } from '@/types/designer';

export interface ArtworkExportGeometry {
  // =========================================================
  // SOURCE / FABRIC CANVAS GEOMETRY
  // =========================================================

  /** Trim width in Fabric canvas pixels */
  trimWidthPx: number;

  /** Trim height in Fabric canvas pixels */
  trimHeightPx: number;

  /** Bleed on EACH side in Fabric canvas pixels */
  bleedPx: number;

  /** Full artwork width = trim + left bleed + right bleed */
  artworkWidthPx: number;

  /** Full artwork height = trim + top bleed + bottom bleed */
  artworkHeightPx: number;

  // =========================================================
  // PHYSICAL SIZE
  // =========================================================

  /** Physical trim width in millimeters */
  trimWidthMm: number;

  /** Physical trim height in millimeters */
  trimHeightMm: number;

  /** Bleed on EACH side in millimeters */
  bleedMm: number;

  /** Full physical artwork width including bleed */
  artworkWidthMm: number;

  /** Full physical artwork height including bleed */
  artworkHeightMm: number;

  // =========================================================
  // SOURCE DPI
  // =========================================================

  /** DPI used by Fabric/document dimensions */
  documentDpi: number;

  // =========================================================
  // TARGET EXPORT SIZE
  // =========================================================

  /** Requested output DPI */
  targetDpi: number;

  /** Trim width at target DPI */
  targetTrimWidthPx: number;

  /** Trim height at target DPI */
  targetTrimHeightPx: number;

  /** Bleed on EACH side at target DPI */
  targetBleedPx: number;

  /** Full artwork width at target DPI */
  targetArtworkWidthPx: number;

  /** Full artwork height at target DPI */
  targetArtworkHeightPx: number;

  // =========================================================
  // TRIM BOUNDS — SOURCE CANVAS
  // =========================================================

  /**
   * IMPORTANT:
   * Canvas origin 0,0 is the OUTER BLEED boundary.
   *
   * Therefore trim starts bleedPx inside the canvas.
   */
  trimLeftPx: number;
  trimTopPx: number;
  trimRightPx: number;
  trimBottomPx: number;

  // =========================================================
  // TRIM BOUNDS — TARGET DPI
  // =========================================================

  targetTrimLeftPx: number;
  targetTrimTopPx: number;
  targetTrimRightPx: number;
  targetTrimBottomPx: number;

  // =========================================================
  // SLUG / CROP MARK AREA
  // =========================================================

  /** Outside margin reserved for crop marks */
  slugMarginMm: number;

  /** Outside margin at target DPI */
  slugMarginPx: number;

  /** Full export size when crop marks are included */
  totalTrimMarksWidthPx: number;
  totalTrimMarksHeightPx: number;

  /** Physical page size with crop-mark margin */
  totalTrimMarksWidthMm: number;
  totalTrimMarksHeightMm: number;

  // =========================================================
  // TRIM POSITION INSIDE SLUG EXPORT
  // =========================================================

  /**
   * These are the actual BLACK CUT LINE coordinates when
   * trim marks are enabled.
   */
  slugTrimLeftPx: number;
  slugTrimTopPx: number;
  slugTrimRightPx: number;
  slugTrimBottomPx: number;

  // =========================================================
  // EXPORT SCALE
  // =========================================================

  /** Fabric canvas -> requested output DPI multiplier */
  exportMultiplier: number;
}

/**
 * Unified geometry for:
 *
 * PNG
 * JPEG
 * WebP
 * SVG
 * PDF
 * PSD
 * TIFF/backend export
 *
 * ---------------------------------------------------------
 *
 * IMPORTANT DOCUMENT MODEL
 *
 * dimensions.widthPx / heightPx
 *     = TRIM SIZE
 *
 * dimensions.bleedPx
 *     = bleed on ONE SIDE
 *
 * therefore:
 *
 * artworkWidthPx
 *     = trimWidthPx + bleedPx * 2
 *
 * artworkHeightPx
 *     = trimHeightPx + bleedPx * 2
 *
 * Example:
 *
 * Trim:
 * 90 × 50 mm
 *
 * Bleed:
 * 3 mm each side
 *
 * Full artwork:
 * 96 × 56 mm
 *
 * ---------------------------------------------------------
 *
 * Canvas:
 *
 * RED OUTER EDGE
 * 0,0
 * ↓
 *
 * +--------------------------------+
 * |           BLEED                |
 * |   +------------------------+   |
 * |   |                        |   |
 * |   |       TRIM AREA        |   |
 * |   |                        |   |
 * |   +------------------------+   |
 * |           BLEED                |
 * +--------------------------------+
 *
 * BLACK trim line starts at:
 *
 * x = bleedPx
 * y = bleedPx
 *
 * NOT x = 0 / y = 0.
 */
export function getArtworkExportGeometry(
  dimensions: CanvasDimensions,
  targetDpi: number = 300,
  slugMarginMm: number = 6
): ArtworkExportGeometry {
  // =========================================================
  // 1. DOCUMENT DPI
  // =========================================================

  const documentDpi = Math.max(
    1,
    Number(dimensions.dpi) || 300
  );

  // =========================================================
  // 2. TRIM SIZE
  // =========================================================

  const trimWidthPx = Math.max(
    1,
    Math.round(Number(dimensions.widthPx) || 1063)
  );

  const trimHeightPx = Math.max(
    1,
    Math.round(Number(dimensions.heightPx) || 591)
  );

  // =========================================================
  // 3. PHYSICAL TRIM SIZE
  // =========================================================

  const widthMmFromPx =
    (trimWidthPx / documentDpi) * 25.4;

  const heightMmFromPx =
    (trimHeightPx / documentDpi) * 25.4;

  const trimWidthMm = roundMm(
    getFinitePositiveNumber(
      dimensions.widthMm,
      widthMmFromPx
    )
  );

  const trimHeightMm = roundMm(
    getFinitePositiveNumber(
      dimensions.heightMm,
      heightMmFromPx
    )
  );

  // =========================================================
  // 4. BLEED
  // =========================================================
  //
  // Prefer bleedMm because it represents the physical
  // print setting selected by the user.
  //
  // If bleedMm does not exist, derive it from bleedPx.
  //
  // Then regenerate bleedPx from the physical value so
  // bleedMm and bleedPx cannot drift apart.
  // =========================================================

  const providedBleedMm = Number(dimensions.bleedMm);

  const fallbackBleedPx = Math.max(
    0,
    Number(dimensions.bleedPx) || 0
  );

  const fallbackBleedMm =
    (fallbackBleedPx / documentDpi) * 25.4;

  const bleedMm = roundMm(
    Number.isFinite(providedBleedMm) && providedBleedMm >= 0
      ? providedBleedMm
      : fallbackBleedMm
  );

  /**
   * IMPORTANT:
   * Use the physical bleed value as the source of truth.
   *
   * Example:
   *
   * 3mm @ 300 DPI
   * = 35.433...
   * ≈ 35 px
   */
  const bleedPx = Math.max(
    0,
    Math.round((bleedMm / 25.4) * documentDpi)
  );

  // =========================================================
  // 5. FULL BLEED-INCLUSIVE ARTWORK
  // =========================================================

  const artworkWidthPx =
    trimWidthPx + bleedPx * 2;

  const artworkHeightPx =
    trimHeightPx + bleedPx * 2;

  const artworkWidthMm = roundMm(
    trimWidthMm + bleedMm * 2
  );

  const artworkHeightMm = roundMm(
    trimHeightMm + bleedMm * 2
  );

  // =========================================================
  // 6. SOURCE TRIM BOUNDS
  // =========================================================

  const trimLeftPx = bleedPx;
  const trimTopPx = bleedPx;

  const trimRightPx =
    trimLeftPx + trimWidthPx;

  const trimBottomPx =
    trimTopPx + trimHeightPx;

  // =========================================================
  // 7. TARGET DPI
  // =========================================================

  const safeTargetDpi = Math.max(
    50,
    Math.min(
      1200,
      Number(targetDpi) || 300
    )
  );

  const targetTrimWidthPx = Math.max(
    1,
    Math.round(
      (trimWidthMm / 25.4) *
      safeTargetDpi
    )
  );

  const targetTrimHeightPx = Math.max(
    1,
    Math.round(
      (trimHeightMm / 25.4) *
      safeTargetDpi
    )
  );

  const targetBleedPx = Math.max(
    0,
    Math.round(
      (bleedMm / 25.4) *
      safeTargetDpi
    )
  );

  const targetArtworkWidthPx =
    targetTrimWidthPx +
    targetBleedPx * 2;

  const targetArtworkHeightPx =
    targetTrimHeightPx +
    targetBleedPx * 2;

  // =========================================================
  // 8. TARGET TRIM BOUNDS
  // =========================================================

  const targetTrimLeftPx =
    targetBleedPx;

  const targetTrimTopPx =
    targetBleedPx;

  const targetTrimRightPx =
    targetTrimLeftPx +
    targetTrimWidthPx;

  const targetTrimBottomPx =
    targetTrimTopPx +
    targetTrimHeightPx;

  // =========================================================
  // 9. SLUG / CROP MARK MARGIN
  // =========================================================

  const safeSlugMarginMm = Math.max(
    0,
    Number(slugMarginMm) || 0
  );

  const slugMarginPx = Math.max(
    0,
    Math.round(
      (safeSlugMarginMm / 25.4) *
      safeTargetDpi
    )
  );

  // =========================================================
  // 10. COMPLETE EXPORT SIZE WITH TRIM MARKS
  // =========================================================

  const totalTrimMarksWidthPx =
    targetArtworkWidthPx +
    slugMarginPx * 2;

  const totalTrimMarksHeightPx =
    targetArtworkHeightPx +
    slugMarginPx * 2;

  const totalTrimMarksWidthMm =
    roundMm(
      artworkWidthMm +
      safeSlugMarginMm * 2
    );

  const totalTrimMarksHeightMm =
    roundMm(
      artworkHeightMm +
      safeSlugMarginMm * 2
    );

  // =========================================================
  // 11. BLACK TRIM LINE INSIDE SLUG EXPORT
  // =========================================================
  //
  // DO NOT point crop marks to:
  //
  // slugMarginPx
  //
  // because that is the RED OUTER BLEED edge.
  //
  // Correct position:
  //
  // slug margin
  // +
  // bleed
  // =========================================================

  const slugTrimLeftPx =
    slugMarginPx +
    targetBleedPx;

  const slugTrimTopPx =
    slugMarginPx +
    targetBleedPx;

  const slugTrimRightPx =
    slugTrimLeftPx +
    targetTrimWidthPx;

  const slugTrimBottomPx =
    slugTrimTopPx +
    targetTrimHeightPx;

  // =========================================================
  // 12. FABRIC EXPORT MULTIPLIER
  // =========================================================

  const exportMultiplier =
    safeTargetDpi / documentDpi;

  // =========================================================
  // 13. RETURN
  // =========================================================

  return {
    trimWidthPx,
    trimHeightPx,
    bleedPx,

    artworkWidthPx,
    artworkHeightPx,

    trimWidthMm,
    trimHeightMm,
    bleedMm,

    artworkWidthMm,
    artworkHeightMm,

    documentDpi,

    targetDpi: safeTargetDpi,

    targetTrimWidthPx,
    targetTrimHeightPx,

    targetBleedPx,

    targetArtworkWidthPx,
    targetArtworkHeightPx,

    trimLeftPx,
    trimTopPx,
    trimRightPx,
    trimBottomPx,

    targetTrimLeftPx,
    targetTrimTopPx,
    targetTrimRightPx,
    targetTrimBottomPx,

    slugMarginMm:
      safeSlugMarginMm,

    slugMarginPx,

    totalTrimMarksWidthPx,
    totalTrimMarksHeightPx,

    totalTrimMarksWidthMm,
    totalTrimMarksHeightMm,

    slugTrimLeftPx,
    slugTrimTopPx,
    slugTrimRightPx,
    slugTrimBottomPx,

    exportMultiplier,
  };
}

// =========================================================
// HELPERS
// =========================================================

function roundMm(value: number): number {
  return Number(
    Math.max(0, value).toFixed(3)
  );
}

function getFinitePositiveNumber(
  value: unknown,
  fallback: number
): number {
  const numeric = Number(value);

  if (
    Number.isFinite(numeric) &&
    numeric > 0
  ) {
    return numeric;
  }

  return fallback;
}

// =========================================================
// CANONICAL ARTWORK EXPORT BOUNDS & VISIBLE TRIM LINE
// =========================================================

export interface ArtworkExportBounds {
  /** Outer RED boundary width in document px (at document DPI, e.g. 300) */
  widthPx: number;
  /** Outer RED boundary height in document px */
  heightPx: number;
  /** Outer RED boundary width in physical mm */
  widthMm: number;
  /** Outer RED boundary height in physical mm */
  heightMm: number;
  /** Outer RED boundary width in PDF points (72 points / inch) */
  widthPt: number;
  /** Outer RED boundary height in PDF points */
  heightPt: number;
  /** Document coordinate of BLACK trim line left (bleedPx) */
  trimLeftPx: number;
  /** Document coordinate of BLACK trim line top (bleedPx) */
  trimTopPx: number;
  /** Width of the BLACK trim line in document px */
  trimWidthPx: number;
  /** Height of the BLACK trim line in document px */
  trimHeightPx: number;
  /** Physical trim width in mm */
  trimWidthMm: number;
  /** Physical trim height in mm */
  trimHeightMm: number;
  /** Bleed in px */
  bleedPx: number;
  /** Bleed in mm */
  bleedMm: number;
  /** Multiplier from document base DPI to target export DPI */
  exportMultiplier: number;
  /** Target resolution in px at targetDpi */
  targetWidthPx: number;
  targetHeightPx: number;
  /** Base document DPI */
  documentDpi: number;
  /** Target export DPI */
  targetDpi: number;
}

/**
 * Calculates the canonical RED outer export boundary and inner BLACK trim/cut line
 * coordinates from existing document dimensions.
 *
 * Rules:
 * - RED = outer export boundary (viewBox / page size / image bounds).
 * - BLACK = visible trim/cut line positioned at (trimLeftPx, trimTopPx, trimWidthPx, trimHeightPx).
 * - Never depends on browser size, viewport dimensions, DOM scaling, or current zoom.
 */
export function getArtworkExportBounds(
  dimensions: CanvasDimensions,
  targetDpi: number = 300
): ArtworkExportBounds {
  const geom = getArtworkExportGeometry(dimensions, targetDpi, 0);
  const ptPerMm = 72 / 25.4;
  return {
    widthPx: geom.artworkWidthPx,
    heightPx: geom.artworkHeightPx,
    widthMm: geom.artworkWidthMm,
    heightMm: geom.artworkHeightMm,
    widthPt: geom.artworkWidthMm * ptPerMm,
    heightPt: geom.artworkHeightMm * ptPerMm,
    trimLeftPx: geom.trimLeftPx,
    trimTopPx: geom.trimTopPx,
    trimWidthPx: geom.trimWidthPx,
    trimHeightPx: geom.trimHeightPx,
    trimWidthMm: geom.trimWidthMm,
    trimHeightMm: geom.trimHeightMm,
    bleedPx: geom.bleedPx,
    bleedMm: geom.bleedMm,
    exportMultiplier: geom.exportMultiplier,
    targetWidthPx: geom.targetArtworkWidthPx,
    targetHeightPx: geom.targetArtworkHeightPx,
    documentDpi: geom.documentDpi,
    targetDpi: geom.targetDpi,
  };
}

/**
 * Draws visible TRIM MARKS (corner cut marks) onto a 2D canvas context.
 * Replaces the full black rectangle line with corner trim marks at the trim boundary.
 * Uses a subtle white casing so the trim marks are clearly visible over any artwork.
 */
export function renderVisibleTrimLineOnCanvas(
  ctx: CanvasRenderingContext2D,
  bounds: ArtworkExportBounds,
  scale: number = 1
): void {
  const xLeft = bounds.trimLeftPx * scale;
  const yTop = bounds.trimTopPx * scale;
  const xRight = (bounds.trimLeftPx + bounds.trimWidthPx) * scale;
  const yBottom = (bounds.trimTopPx + bounds.trimHeightPx) * scale;
  const totalW = bounds.widthPx * scale;
  const totalH = bounds.heightPx * scale;

  const markLen = bounds.bleedPx > 0
    ? bounds.bleedPx * scale
    : Math.round(18 * scale * (bounds.documentDpi / 300));

  // 8 trim mark segments: 2 at each of the 4 corners
  const lines: Array<[number, number, number, number]> = bounds.bleedPx > 0
    ? [
        // Top-Left corner
        [xLeft, 0, xLeft, yTop],
        [0, yTop, xLeft, yTop],
        // Top-Right corner
        [xRight, 0, xRight, yTop],
        [totalW, yTop, xRight, yTop],
        // Bottom-Left corner
        [xLeft, totalH, xLeft, yBottom],
        [0, yBottom, xLeft, yBottom],
        // Bottom-Right corner
        [xRight, totalH, xRight, yBottom],
        [totalW, yBottom, xRight, yBottom],
      ]
    : [
        // Top-Left corner (no bleed)
        [0, 0, 0, markLen],
        [0, 0, markLen, 0],
        // Top-Right corner (no bleed)
        [totalW, 0, totalW, markLen],
        [totalW, 0, totalW - markLen, 0],
        // Bottom-Left corner (no bleed)
        [0, totalH, 0, totalH - markLen],
        [0, totalH, markLen, totalH],
        // Bottom-Right corner (no bleed)
        [totalW, totalH, totalW, totalH - markLen],
        [totalW, totalH, totalW - markLen, totalH],
      ];

  ctx.save();
  ctx.lineCap = 'square';

  // White casing for maximum contrast against any background
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1.5, 3 * scale);
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of lines) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  // Crisp black trim mark lines
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(0.75, 1.25 * scale);
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of lines) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  ctx.restore();
}

/**
 * Injects visible TRIM MARKS (corner cut marks) into an SVG document.
 * Replaces the full black rectangle line with corner trim marks at the trim boundary.
 */
export function injectVisibleTrimLineInSvg(
  svgDoc: Document,
  bounds: ArtworkExportBounds
): void {
  if (svgDoc.querySelector('[data-print-trim-line="true"]')) {
    return;
  }
  const xLeft = bounds.trimLeftPx;
  const yTop = bounds.trimTopPx;
  const xRight = bounds.trimLeftPx + bounds.trimWidthPx;
  const yBottom = bounds.trimTopPx + bounds.trimHeightPx;
  const totalW = bounds.widthPx;
  const totalH = bounds.heightPx;

  const markLen = bounds.bleedPx > 0
    ? bounds.bleedPx
    : Math.round(18 * (bounds.documentDpi / 300));

  const lines: Array<[number, number, number, number]> = bounds.bleedPx > 0
    ? [
        // Top-Left corner
        [xLeft, 0, xLeft, yTop],
        [0, yTop, xLeft, yTop],
        // Top-Right corner
        [xRight, 0, xRight, yTop],
        [totalW, yTop, xRight, yTop],
        // Bottom-Left corner
        [xLeft, totalH, xLeft, yBottom],
        [0, yBottom, xLeft, yBottom],
        // Bottom-Right corner
        [xRight, totalH, xRight, yBottom],
        [totalW, yBottom, xRight, yBottom],
      ]
    : [
        // Top-Left corner (no bleed)
        [0, 0, 0, markLen],
        [0, 0, markLen, 0],
        // Top-Right corner (no bleed)
        [totalW, 0, totalW, markLen],
        [totalW, 0, totalW - markLen, 0],
        // Bottom-Left corner (no bleed)
        [0, totalH, 0, totalH - markLen],
        [0, totalH, markLen, totalH],
        // Bottom-Right corner (no bleed)
        [totalW, totalH, totalW, totalH - markLen],
        [totalW, totalH, totalW - markLen, totalH],
      ];

  const g = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('id', 'export-visible-trim-marks');
  g.setAttribute('data-print-trim-line', 'true');

  const casingGroup = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
  casingGroup.setAttribute('stroke', 'rgba(255, 255, 255, 0.85)');
  casingGroup.setAttribute('stroke-width', '3');
  casingGroup.setAttribute('stroke-linecap', 'square');

  const blackGroup = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
  blackGroup.setAttribute('stroke', '#000000');
  blackGroup.setAttribute('stroke-width', '1.25');
  blackGroup.setAttribute('stroke-linecap', 'square');

  for (const [x1, y1, x2, y2] of lines) {
    const casingLine = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'line');
    casingLine.setAttribute('x1', String(x1));
    casingLine.setAttribute('y1', String(y1));
    casingLine.setAttribute('x2', String(x2));
    casingLine.setAttribute('y2', String(y2));
    casingGroup.appendChild(casingLine);

    const blackLine = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'line');
    blackLine.setAttribute('x1', String(x1));
    blackLine.setAttribute('y1', String(y1));
    blackLine.setAttribute('x2', String(x2));
    blackLine.setAttribute('y2', String(y2));
    blackGroup.appendChild(blackLine);
  }

  g.appendChild(casingGroup);
  g.appendChild(blackGroup);
  svgDoc.documentElement.appendChild(g);
}