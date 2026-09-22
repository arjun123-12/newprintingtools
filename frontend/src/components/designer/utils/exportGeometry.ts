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