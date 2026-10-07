export type FoldingType =
  | 'bi-fold'
  | 'tri-fold'
  | 'z-fold'
  | 'gate-fold'
  | 'half-fold'
  | 'custom'
  | string;

export interface BleedEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SafeMarginEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FoldMarginEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FoldBleedEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PanelConfig {
  id: string;
  index: number;
  label: string;
  width: number; // width in mm
}

export interface FoldConfig {
  id: string;
  index: number;
  position: number; // fold position in mm from starting edge
  margin: FoldMarginEdges;
  bleed: FoldBleedEdges;
  marginLeft?: number; // legacy flattened field (mm)
  marginRight?: number; // legacy flattened field (mm)
  marginTop?: number; // legacy flattened field (mm)
  marginBottom?: number; // legacy flattened field (mm)
  bleedLeft?: number; // legacy flattened field (mm)
  bleedRight?: number; // legacy flattened field (mm)
  bleedTop?: number; // legacy flattened field (mm)
  bleedBottom?: number; // legacy flattened field (mm)
  allowance?: number; // optional fold/score clearance allowance in mm
}

export interface SideFoldingLayout {
  panels: PanelConfig[];
  folds: FoldConfig[];
}

export interface FoldingConfig {
  enabled: boolean;
  type: FoldingType;
  panelOrientation: 'vertical' | 'horizontal'; // default 'vertical'
  panelCount: number;
  panels: PanelConfig[];
  folds: FoldConfig[];
  sameMarginForAllFolds: boolean;
  sameBleedForAllFolds: boolean;
  uniformFoldMargin?: number | FoldMarginEdges;
  uniformFoldBleed?: number | FoldBleedEdges;
  sides?: {
    front?: SideFoldingLayout;
    back?: SideFoldingLayout;
  };
}

export interface PrintLayoutConfig {
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait';
  outerBleed: BleedEdges;
  safeMargin: SafeMarginEdges;
  folding: FoldingConfig;
}
