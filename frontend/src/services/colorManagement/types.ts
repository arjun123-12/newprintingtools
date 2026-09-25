/**
 * Color Management System Types
 * Professional print ICC color space, soft proofing and CMYK metadata.
 */

export interface RGBColor {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
  a?: number; // 0 - 1
}

export interface CMYKColor {
  c: number; // 0 - 100 percentage
  m: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  k: number; // 0 - 100 percentage
}

export interface PrintColorMetadata extends CMYKColor {
  profileId: string;
  sourceHex?: string;
  isCustomCmyk?: boolean;
}

export interface PrintColorProfile {
  id: string;
  name: string;
  url: string;
  colorSpace: 'CMYK';
  description?: string;
  standard?: string;
  totalAreaCoverage?: number; // TAC % (e.g. 300, 330, 340)
}

export interface GamutWarningState {
  isOutOfGamut: boolean;
  deltaE: number;
  closestHex: string;
  closestCmyk: CMYKColor;
  warningMessage?: string;
}

export interface RichBlackSettings {
  c: number;
  m: number;
  y: number;
  k: number;
  description: string;
}

export const DEFAULT_PURE_BLACK: CMYKColor = {
  c: 0,
  m: 0,
  y: 0,
  k: 100,
};

export const DEFAULT_RICH_BLACK: CMYKColor = {
  c: 60,
  m: 40,
  y: 40,
  k: 100,
};

export interface SoftProofOptions {
  profileId: string;
  simulatePaperWhite?: boolean;
  simulateBlackInk?: boolean;
}

export interface PrintExportOptions {
  format: 'pdf' | 'tiff' | 'jpeg';
  colorMode: 'cmyk' | 'rgb';
  profileId: string;
  dpi: number;
  includeBleed: boolean;
  includeTrimMarks: boolean;
  bleedMm: number;
  quality?: number;
  backgroundColor?: string;
}
