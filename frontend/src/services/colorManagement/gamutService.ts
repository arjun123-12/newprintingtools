import { RGBColor, CMYKColor, GamutWarningState } from './types';
import { colorConversionService, hexToRgb, rgbToHex } from './colorConversionService';

/**
 * Standard CIE76 Delta-E perceptual color difference calculation in Lab space.
 */
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;

  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;

  rn *= 100;
  gn *= 100;
  bn *= 100;

  const x = rn * 0.4124 + gn * 0.3576 + bn * 0.1805;
  const y = rn * 0.2126 + gn * 0.7152 + bn * 0.0722;
  const z = rn * 0.0193 + gn * 0.1192 + bn * 0.9505;

  return [x, y, z];
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  // D50 standard illuminant for print
  const refX = 96.422;
  const refY = 100.0;
  const refZ = 82.521;

  let xn = x / refX;
  let yn = y / refY;
  let zn = z / refZ;

  const fx = xn > 0.008856 ? Math.pow(xn, 1 / 3) : 7.787 * xn + 16 / 116;
  const fy = yn > 0.008856 ? Math.pow(yn, 1 / 3) : 7.787 * yn + 16 / 116;
  const fz = zn > 0.008856 ? Math.pow(zn, 1 / 3) : 7.787 * zn + 16 / 116;

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return [l, a, b];
}

function calculateDeltaE(rgb1: RGBColor, rgb2: RGBColor): number {
  const [x1, y1, z1] = rgbToXyz(rgb1.r, rgb1.g, rgb1.b);
  const [l1, a1, b1] = xyzToLab(x1, y1, z1);

  const [x2, y2, z2] = rgbToXyz(rgb2.r, rgb2.g, rgb2.b);
  const [l2, a2, b2] = xyzToLab(x2, y2, z2);

  const dL = l1 - l2;
  const da = a1 - a2;
  const db = b1 - b2;

  return Math.sqrt(dL * dL + da * da + db * db);
}

class GamutService {
  // Delta E threshold above which color shift is noticeable to human eyes (standard is 3.5 - 5.0)
  private readonly GAMUT_DELTA_E_THRESHOLD = 4.0;

  /**
   * Check if an RGB color is outside the printable CMYK gamut of the chosen ICC profile.
   */
  public async checkGamut(rgb: RGBColor, profileId?: string): Promise<GamutWarningState> {
    const cmyk = await colorConversionService.rgbToCmykWithIcc(rgb, profileId);
    const softProofRgb = await colorConversionService.cmykToRgbWithIcc(cmyk, profileId);

    const deltaE = calculateDeltaE(rgb, softProofRgb);
    const isOutOfGamut = deltaE >= this.GAMUT_DELTA_E_THRESHOLD;
    const closestHex = rgbToHex(softProofRgb.r, softProofRgb.g, softProofRgb.b);

    return {
      isOutOfGamut,
      deltaE: Math.round(deltaE * 10) / 10,
      closestHex,
      closestCmyk: cmyk,
      warningMessage: isOutOfGamut
        ? '⚠ This colour may print differently.'
        : undefined,
    };
  }

  /**
   * Check gamut by HEX code.
   */
  public async checkHexGamut(hex: string, profileId?: string): Promise<GamutWarningState> {
    const rgb = hexToRgb(hex);
    return this.checkGamut(rgb, profileId);
  }
}

export const gamutService = new GamutService();
