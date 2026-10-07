import {
  FoldingType,
  FoldingConfig,
  PanelConfig,
  FoldConfig,
  FoldMarginEdges,
  FoldBleedEdges,
  SideFoldingLayout,
  PrintLayoutConfig,
} from '@/types/folding';

export interface FoldingTypeOption {
  value: FoldingType;
  label: string;
  defaultPanels: number;
  description: string;
}

export const FOLDING_TYPES: FoldingTypeOption[] = [
  {
    value: 'bi-fold',
    label: 'Bi-Fold',
    defaultPanels: 2,
    description: 'Single center fold dividing the document into 2 panels',
  },
  {
    value: 'tri-fold',
    label: 'Tri-Fold (C-Fold / Letter)',
    defaultPanels: 3,
    description: 'Two parallel folds with one tuck-in panel (e.g. 100 + 97 + 100 mm for A4)',
  },
  {
    value: 'z-fold',
    label: 'Z-Fold (Accordion)',
    defaultPanels: 3,
    description: 'Two parallel folds opening like an accordion into equal panels',
  },
  {
    value: 'gate-fold',
    label: 'Gate Fold',
    defaultPanels: 3,
    description: 'Two outer flap panels folding inward to meet in the center',
  },
  {
    value: 'half-fold',
    label: 'Half Fold',
    defaultPanels: 2,
    description: 'Folded exactly once in half',
  },
  {
    value: 'custom',
    label: 'Custom Fold',
    defaultPanels: 3,
    description: 'Configurable number of panels, custom widths, and fold positions',
  },
];

export function round(val: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Normalizes fold margin ensuring top, right, bottom, left are always defined numeric values >= 0.
 * Supports backward compatibility for scalar numbers or legacy marginLeft/marginRight/etc.
 */
export function normalizeFoldMargin(
  foldOrMargin: any,
  defaultMargin: number = 3
): FoldMarginEdges {
  if (foldOrMargin === undefined || foldOrMargin === null) {
    return { top: defaultMargin, right: defaultMargin, bottom: defaultMargin, left: defaultMargin };
  }

  if (typeof foldOrMargin === 'number') {
    const val = Math.max(0, isNaN(foldOrMargin) ? defaultMargin : foldOrMargin);
    return { top: val, right: val, bottom: val, left: val };
  }

  const rawMargin = typeof foldOrMargin.margin === 'object' && foldOrMargin.margin !== null
    ? foldOrMargin.margin
    : (typeof foldOrMargin.margin === 'number'
      ? { top: foldOrMargin.margin, right: foldOrMargin.margin, bottom: foldOrMargin.margin, left: foldOrMargin.margin }
      : foldOrMargin);

  const left = Number(
    rawMargin.left ??
    foldOrMargin.marginLeft ??
    rawMargin.margin ??
    defaultMargin
  );
  const right = Number(
    rawMargin.right ??
    foldOrMargin.marginRight ??
    rawMargin.margin ??
    defaultMargin
  );
  const top = Number(
    rawMargin.top ??
    foldOrMargin.marginTop ??
    rawMargin.margin ??
    defaultMargin
  );
  const bottom = Number(
    rawMargin.bottom ??
    foldOrMargin.marginBottom ??
    rawMargin.margin ??
    defaultMargin
  );

  return {
    top: Math.max(0, isNaN(top) ? defaultMargin : round(top)),
    right: Math.max(0, isNaN(right) ? defaultMargin : round(right)),
    bottom: Math.max(0, isNaN(bottom) ? defaultMargin : round(bottom)),
    left: Math.max(0, isNaN(left) ? defaultMargin : round(left)),
  };
}

/**
 * Normalizes fold bleed ensuring top, right, bottom, left are always defined numeric values >= 0.
 * Supports backward compatibility for scalar numbers or legacy bleedLeft/bleedRight/etc.
 */
export function normalizeFoldBleed(
  foldOrBleed: any,
  defaultBleed: number = 2
): FoldBleedEdges {
  if (foldOrBleed === undefined || foldOrBleed === null) {
    return { top: defaultBleed, right: defaultBleed, bottom: defaultBleed, left: defaultBleed };
  }

  if (typeof foldOrBleed === 'number') {
    const val = Math.max(0, isNaN(foldOrBleed) ? defaultBleed : foldOrBleed);
    return { top: val, right: val, bottom: val, left: val };
  }

  const rawBleed = typeof foldOrBleed.bleed === 'object' && foldOrBleed.bleed !== null
    ? foldOrBleed.bleed
    : (typeof foldOrBleed.bleed === 'number'
      ? { top: foldOrBleed.bleed, right: foldOrBleed.bleed, bottom: foldOrBleed.bleed, left: foldOrBleed.bleed }
      : foldOrBleed);

  const left = Number(
    rawBleed.left ??
    foldOrBleed.bleedLeft ??
    rawBleed.bleed ??
    defaultBleed
  );
  const right = Number(
    rawBleed.right ??
    foldOrBleed.bleedRight ??
    rawBleed.bleed ??
    defaultBleed
  );
  const top = Number(
    rawBleed.top ??
    foldOrBleed.bleedTop ??
    rawBleed.bleed ??
    defaultBleed
  );
  const bottom = Number(
    rawBleed.bottom ??
    foldOrBleed.bleedBottom ??
    rawBleed.bleed ??
    defaultBleed
  );

  return {
    top: Math.max(0, isNaN(top) ? defaultBleed : round(top)),
    right: Math.max(0, isNaN(right) ? defaultBleed : round(right)),
    bottom: Math.max(0, isNaN(bottom) ? defaultBleed : round(bottom)),
    left: Math.max(0, isNaN(left) ? defaultBleed : round(left)),
  };
}

/**
 * Normalizes a full FoldConfig with margin, bleed, position, and legacy backward-compatible fields.
 */
export function normalizeFold(
  rawFold: any,
  index: number,
  defaultMargin: number = 3,
  defaultBleed: number = 2
): FoldConfig {
  const margin = normalizeFoldMargin(rawFold, defaultMargin);
  const bleed = normalizeFoldBleed(rawFold, defaultBleed);

  return {
    id: rawFold?.id || `fold-${index + 1}`,
    index,
    position: Number(rawFold?.position ?? 0),
    margin,
    bleed,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    marginBottom: margin.bottom,
    bleedLeft: bleed.left,
    bleedRight: bleed.right,
    bleedTop: bleed.top,
    bleedBottom: bleed.bottom,
    allowance: Number(rawFold?.allowance ?? 0),
  };
}

/**
 * Generate default panel widths based on fold type and total sheet width in mm.
 */
export function calculateDefaultPanels(
  type: FoldingType,
  panelCount: number,
  totalWidth: number
): PanelConfig[] {
  const count = Math.max(2, panelCount || 2);
  const safeTotal = Math.max(10, totalWidth || 210);

  if (type === 'bi-fold' || type === 'half-fold' || count === 2) {
    const half = round(safeTotal / 2);
    const p2 = round(safeTotal - half);
    return [
      { id: 'panel-1', index: 0, label: 'Panel 1', width: half },
      { id: 'panel-2', index: 1, label: 'Panel 2', width: p2 },
    ];
  }

  if (type === 'tri-fold' && count === 3) {
    // For standard A4 landscape (297mm): 100mm, 97mm (tuck-in), 100mm
    if (Math.abs(safeTotal - 297) < 2) {
      return [
        { id: 'panel-1', index: 0, label: 'Panel 1 (Outer)', width: 100 },
        { id: 'panel-2', index: 1, label: 'Panel 2 (Center)', width: 97 },
        { id: 'panel-3', index: 2, label: 'Logo Panel', width: 100 },
      ];
    }
    // For other sizes, tuck-in inner panel is 2-3mm shorter
    const innerTuck = Math.max(10, round((safeTotal - 3) / 3));
    const outer1 = round((safeTotal - innerTuck) / 2);
    const outer2 = round(safeTotal - innerTuck - outer1);
    return [
      { id: 'panel-1', index: 0, label: 'Panel 1', width: outer1 },
      { id: 'panel-2', index: 1, label: 'Panel 2', width: innerTuck },
      { id: 'panel-3', index: 2, label: 'Logo Panel', width: outer2 },
    ];
  }

  if (type === 'gate-fold' && count === 3) {
    // 25% left gate, 50% center, 25% right gate
    const leftGate = round(safeTotal * 0.25);
    const rightGate = round(safeTotal * 0.25);
    const center = round(safeTotal - leftGate - rightGate);
    return [
      { id: 'panel-1', index: 0, label: 'Panel 1 (Left Gate)', width: leftGate },
      { id: 'panel-2', index: 1, label: 'Panel 2 (Center)', width: center },
      { id: 'panel-3', index: 2, label: 'Panel 3 (Right Gate)', width: rightGate },
    ];
  }

  // Z-fold, Equal partitions, or Custom
  const baseWidth = round(safeTotal / count);
  let accumulated = 0;
  const panels: PanelConfig[] = [];

  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      const lastWidth = round(safeTotal - accumulated);
      panels.push({
        id: `panel-${i + 1}`,
        index: i,
        label: `Panel ${i + 1}`,
        width: Math.max(1, lastWidth),
      });
    } else {
      panels.push({
        id: `panel-${i + 1}`,
        index: i,
        label: `Panel ${i + 1}`,
        width: baseWidth,
      });
      accumulated += baseWidth;
    }
  }

  return panels;
}

/**
 * Re-calculate fold positions based on panel widths.
 * Fold 1 is at Panel 1 width. Fold 2 is at Panel 1 + Panel 2 width, etc.
 */
export function recalculateFoldsFromPanels(
  panels: PanelConfig[],
  existingFolds?: FoldConfig[],
  defaultMargin: number | FoldMarginEdges = 3,
  defaultBleed: number | FoldBleedEdges = 2,
  allowance: number = 0
): FoldConfig[] {
  const foldCount = Math.max(0, panels.length - 1);
  const folds: FoldConfig[] = [];
  let runningPosition = 0;

  for (let i = 0; i < foldCount; i++) {
    runningPosition = round(runningPosition + panels[i].width);
    const existing = existingFolds?.[i];
    const margin = existing ? normalizeFoldMargin(existing) : normalizeFoldMargin(defaultMargin);
    const bleed = existing ? normalizeFoldBleed(existing) : normalizeFoldBleed(defaultBleed);

    folds.push({
      id: existing?.id || `fold-${i + 1}`,
      index: i,
      position: runningPosition,
      margin,
      bleed,
      marginLeft: margin.left,
      marginRight: margin.right,
      marginTop: margin.top,
      marginBottom: margin.bottom,
      bleedLeft: bleed.left,
      bleedRight: bleed.right,
      bleedTop: bleed.top,
      bleedBottom: bleed.bottom,
      allowance: existing?.allowance !== undefined ? existing.allowance : allowance,
    });
  }

  return folds;
}

/**
 * Generates a full default FoldingConfig for a given type, panel count, and sheet dimensions.
 */
export function createDefaultFoldingConfig(
  type: FoldingType = 'tri-fold',
  totalWidth: number = 297,
  panelCount?: number
): FoldingConfig {
  const typeOption = FOLDING_TYPES.find((opt) => opt.value === type);
  const count = panelCount || typeOption?.defaultPanels || 3;
  const panels = calculateDefaultPanels(type, count, totalWidth);
  const folds = recalculateFoldsFromPanels(panels, undefined, 3, 2, 0);

  return {
    enabled: true,
    type,
    panelOrientation: 'vertical',
    panelCount: count,
    panels,
    folds,
    sameMarginForAllFolds: true,
    sameBleedForAllFolds: true,
    uniformFoldMargin: { top: 3, right: 3, bottom: 3, left: 3 },
    uniformFoldBleed: { top: 2, right: 2, bottom: 2, left: 2 },
    sides: {
      front: {
        panels: panels.map((p) => ({ ...p })),
        folds: folds.map((f) => ({ ...f })),
      },
      back: generateBackSideLayout(panels, folds),
    },
  };
}

/**
 * Creates the mirrored reverse layout for the Back side of a folded sheet.
 * For example: Front [Panel 1 (100), Panel 2 (97), Panel 3 (100)]
 * becomes Back [Panel 3 (100), Panel 2 (97), Panel 1 (100)].
 */
export function generateBackSideLayout(
  frontPanels: PanelConfig[],
  frontFolds: FoldConfig[]
): SideFoldingLayout {
  const reversedPanels: PanelConfig[] = [...frontPanels].reverse().map((p, idx) => ({
    id: `back-panel-${idx + 1}`,
    index: idx,
    label: `Back ${p.label || `Panel ${frontPanels.length - idx}`}`,
    width: p.width,
  }));

  const reversedFrontFolds = [...frontFolds].reverse();
  const foldCount = Math.max(0, reversedPanels.length - 1);
  const backFolds: FoldConfig[] = [];
  let runningPosition = 0;

  for (let i = 0; i < foldCount; i++) {
    runningPosition = round(runningPosition + reversedPanels[i].width);
    const matchingFrontFold = reversedFrontFolds[i];
    const frontMargin = normalizeFoldMargin(matchingFrontFold, 3);
    const frontBleed = normalizeFoldBleed(matchingFrontFold, 2);

    // On mirrored reverse side, left becomes right and right becomes left; top and bottom stay unchanged
    const backMargin: FoldMarginEdges = {
      top: frontMargin.top,
      right: frontMargin.left,
      bottom: frontMargin.bottom,
      left: frontMargin.right,
    };
    const backBleed: FoldBleedEdges = {
      top: frontBleed.top,
      right: frontBleed.left,
      bottom: frontBleed.bottom,
      left: frontBleed.right,
    };

    backFolds.push({
      id: `back-fold-${i + 1}`,
      index: i,
      position: runningPosition,
      margin: backMargin,
      bleed: backBleed,
      marginLeft: backMargin.left,
      marginRight: backMargin.right,
      marginTop: backMargin.top,
      marginBottom: backMargin.bottom,
      bleedLeft: backBleed.left,
      bleedRight: backBleed.right,
      bleedTop: backBleed.top,
      bleedBottom: backBleed.bottom,
      allowance: matchingFrontFold?.allowance ?? 0,
    });
  }

  return {
    panels: reversedPanels,
    folds: backFolds,
  };
}

/**
 * Resolves the active SideFoldingLayout for a specific side (front or back).
 */
export function resolveSideFoldingLayout(
  folding: FoldingConfig,
  side: 'front' | 'back'
): SideFoldingLayout {
  let layout: SideFoldingLayout;
  if (side === 'back' && folding.sides?.back?.panels?.length) {
    layout = folding.sides.back;
  } else if (side === 'front' && folding.sides?.front?.panels?.length) {
    layout = folding.sides.front;
  } else {
    layout = {
      panels: folding.panels || [],
      folds: folding.folds || [],
    };
  }

  return {
    panels: layout.panels,
    folds: (layout.folds || []).map((f, idx) => normalizeFold(f, idx)),
  };
}

/**
 * Validates a PrintLayoutConfig.
 */
export function validatePrintLayout(layout: PrintLayoutConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (layout.width <= 0) errors.push('Width must be greater than 0 mm.');
  if (layout.height <= 0) errors.push('Height must be greater than 0 mm.');

  if (layout.folding.enabled) {
    const { panels, folds } = layout.folding;

    if (panels.length < 2) {
      errors.push('Folding requires at least 2 panels.');
    }

    const totalPanelWidth = round(
      panels.reduce((sum, p) => sum + (Number(p.width) || 0), 0)
    );

    if (Math.abs(totalPanelWidth - layout.width) > 0.5) {
      errors.push(
        `Total panel widths (${totalPanelWidth} mm) must equal sheet width (${layout.width} mm).`
      );
    }

    folds.forEach((f, idx) => {
      const margin = normalizeFoldMargin(f);
      const bleed = normalizeFoldBleed(f);

      if (f.position <= 0 || f.position >= layout.width) {
        errors.push(
          `Fold ${idx + 1} position (${f.position} mm) must be within 0 and ${layout.width} mm.`
        );
      }
      if (margin.left < 0 || margin.right < 0 || margin.top < 0 || margin.bottom < 0) {
        errors.push(`Fold ${idx + 1} margin values cannot be negative.`);
      }
      if (bleed.left < 0 || bleed.right < 0 || bleed.top < 0 || bleed.bottom < 0) {
        errors.push(`Fold ${idx + 1} bleed values cannot be negative.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
