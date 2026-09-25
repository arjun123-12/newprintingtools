import { CanvasManager } from '@/components/designer/canvas/CanvasManager';
import { CanvasDimensions, DocumentSettings } from '@/types/designer';
import { colorConversionService } from './colorConversionService';
import { iccProfileService } from './iccProfileService';
import { getArtworkExportGeometry } from '@/components/designer/utils/exportGeometry';
import { exportPreparedVectorPdf } from '@/components/designer/services/exportService';

/**
 * Creates an authentic 4-channel CMYK TIFF binary conforming to TIFF 6.0 specification.
 * Embeds PhotometricInterpretation=5 (Separated/CMYK), 4 samples per pixel, 300 DPI tags,
 * and the actual target ICC profile bytes (Tag 34675).
 */
export function encodeCmykTiff(
  cmykPixels: Uint8Array,
  width: number,
  height: number,
  dpi: number = 300,
  iccProfileBytes?: Uint8Array
): Uint8Array {
  // Little-Endian binary writer
  const numTags = 15;
  const headerSize = 8;
  const ifdSize = 2 + numTags * 12 + 4; // 186 bytes

  // Extra data blocks placed after IFD:
  // 1. BitsPerSample: 4 x SHORT (8 bytes) = [8, 8, 8, 8]
  // 2. XResolution: 2 x LONG (8 bytes) = [dpi, 1]
  // 3. YResolution: 2 x LONG (8 bytes) = [dpi, 1]
  // 4. ICC Profile bytes (if present)
  let extraOffset = headerSize + ifdSize;
  const bitsPerSampleOffset = extraOffset;
  extraOffset += 8;

  const xResOffset = extraOffset;
  extraOffset += 8;

  const yResOffset = extraOffset;
  extraOffset += 8;

  let iccOffset = 0;
  let iccLength = 0;
  if (iccProfileBytes && iccProfileBytes.length > 0) {
    iccOffset = extraOffset;
    iccLength = iccProfileBytes.length;
    extraOffset += iccLength;
  }

  // Align to 4 bytes
  if (extraOffset % 4 !== 0) {
    extraOffset += 4 - (extraOffset % 4);
  }

  const stripOffset = extraOffset;
  const stripByteCount = width * height * 4;
  const totalFileSize = stripOffset + stripByteCount;

  const buffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // 1. Header: 'II' (Little Endian), 42, IFD offset = 8
  view.setUint16(0, 0x4949, true); // 'II'
  view.setUint16(2, 42, true); // TIFF version 42
  view.setUint32(4, 8, true); // Offset to IFD

  // 2. IFD: number of directory entries
  let pos = 8;
  view.setUint16(pos, numTags, true);
  pos += 2;

  const writeTag = (tag: number, type: number, count: number, valOrOffset: number) => {
    view.setUint16(pos, tag, true);
    view.setUint16(pos + 2, type, true);
    view.setUint32(pos + 4, count, true);
    view.setUint32(pos + 8, valOrOffset, true);
    pos += 12;
  };

  // Types: 3 = SHORT, 4 = LONG, 5 = RATIONAL, 7 = UNDEFINED
  writeTag(256, 4, 1, width); // ImageWidth
  writeTag(257, 4, 1, height); // ImageLength
  writeTag(258, 3, 4, bitsPerSampleOffset); // BitsPerSample [8, 8, 8, 8]
  writeTag(259, 3, 1, 1); // Compression: 1 = None
  writeTag(262, 3, 1, 5); // PhotometricInterpretation: 5 = Separated (CMYK)
  writeTag(273, 4, 1, stripOffset); // StripOffsets
  writeTag(277, 3, 1, 4); // SamplesPerPixel: 4 (C, M, Y, K)
  writeTag(278, 4, 1, height); // RowsPerStrip
  writeTag(279, 4, 1, stripByteCount); // StripByteCounts
  writeTag(282, 5, 1, xResOffset); // XResolution
  writeTag(283, 5, 1, yResOffset); // YResolution
  writeTag(296, 3, 1, 2); // ResolutionUnit: 2 = Inch
  writeTag(332, 3, 1, 1); // InkSet: 1 = CMYK
  writeTag(334, 3, 1, 4); // NumberOfInks: 4
  writeTag(34675, 7, iccLength, iccOffset); // ICC Profile Tag

  // Next IFD offset = 0 (no more IFDs)
  view.setUint32(pos, 0, true);

  // 3. Write Extra Data
  // BitsPerSample: 8, 8, 8, 8
  view.setUint16(bitsPerSampleOffset, 8, true);
  view.setUint16(bitsPerSampleOffset + 2, 8, true);
  view.setUint16(bitsPerSampleOffset + 4, 8, true);
  view.setUint16(bitsPerSampleOffset + 6, 8, true);

  // XResolution: [dpi, 1]
  view.setUint32(xResOffset, dpi, true);
  view.setUint32(xResOffset + 4, 1, true);

  // YResolution: [dpi, 1]
  view.setUint32(yResOffset, dpi, true);
  view.setUint32(yResOffset + 4, 1, true);

  // ICC Profile bytes
  if (iccProfileBytes && iccProfileBytes.length > 0) {
    bytes.set(iccProfileBytes, iccOffset);
  }

  // 4. Pixel Data
  bytes.set(cmykPixels, stripOffset);

  return bytes;
}

/**
 * Downloads a byte buffer as a file in the browser.
 */
export function downloadBinaryFile(bytes: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([new Uint8Array(bytes) as unknown as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

class PrintExportService {
  /**
   * Export genuine CMYK Print Ready PDF using vector PDFKit engine with CMYK color spaces,
   * embedded fonts, retained vector geometry, bleed and trim marks.
   */
  public async exportPrintReadyCmykPdf(params: {
    canvasManager: CanvasManager;
    dimensions: CanvasDimensions;
    documentSettings: DocumentSettings;
    profileId?: string;
    includeBleed?: boolean;
    includeTrimMarks?: boolean;
    bleedMm?: number;
    designName?: string;
    onProgress?: (progress: number, message: string) => void;
  }): Promise<void> {
    const {
      canvasManager,
      dimensions,
      profileId = 'fogra39',
      includeBleed = true,
      includeTrimMarks = true,
      bleedMm = dimensions.bleedMm ?? 3,
      designName = 'artwork',
      onProgress,
    } = params;

    onProgress?.(10, 'Initializing CMYK Color Management...');
    await colorConversionService.init();

    const targetProfile = iccProfileService.getProfile(profileId);
    onProgress?.(25, `Preparing CMYK Vector PDF with ${targetProfile.name}...`);

    const canvas = canvasManager.getCanvas();
    if (!canvas) throw new Error('Canvas not available');

    const geom = getArtworkExportGeometry({ ...dimensions, bleedMm: includeBleed ? bleedMm : 0 }, 300, 6);
    const ptPerMm = 72 / 25.4;
    const widthMm = includeTrimMarks ? geom.totalTrimMarksWidthMm : geom.artworkWidthMm;
    const heightMm = includeTrimMarks ? geom.totalTrimMarksHeightMm : geom.artworkHeightMm;

    const svgMarkup = canvas.toSVG({
      suppressPreamble: true,
      width: `${widthMm}mm`,
      height: `${heightMm}mm`,
      viewBox: {
        x: 0,
        y: 0,
        width: includeTrimMarks ? geom.totalTrimMarksWidthPx : geom.artworkWidthPx,
        height: includeTrimMarks ? geom.totalTrimMarksHeightPx : geom.artworkHeightPx,
      },
    });

    onProgress?.(50, 'Converting vector colors and assigning CMYK profile...');
    const proofRes = await this.exportPrintPreviewSvg({
      svgMarkup,
      profileId,
      designName,
    });

    onProgress?.(75, 'Embedding fonts and generating PDF vectors...');
    await exportPreparedVectorPdf(proofRes.svg, {
      widthPt: widthMm * ptPerMm,
      heightPt: heightMm * ptPerMm,
      filename: `${designName}_CMYK_Print_Ready.pdf`,
      canvasManager,
      geometry: geom,
      includeTrimMarks,
    });

    onProgress?.(100, 'Print Ready CMYK PDF generation complete.');
  }

  /**
   * Export genuine 4-channel CMYK TIFF at 300 DPI with embedded ICC Profile.
   */
  public async exportCmykTiff(params: {
    canvasManager: CanvasManager;
    dimensions: CanvasDimensions;
    profileId?: string;
    includeBleed?: boolean;
    includeTrimMarks?: boolean;
    bleedMm?: number;
    designName?: string;
    onProgress?: (progress: number, message: string) => void;
  }): Promise<{ bytes: Uint8Array; filename: string }> {
    const {
      canvasManager,
      dimensions,
      profileId = 'fogra39',
      includeBleed = true,
      includeTrimMarks = true,
      bleedMm = dimensions.bleedMm ?? 3,
      designName = 'artwork',
      onProgress,
    } = params;

    onProgress?.(10, 'Initializing ICC engine & reading profile...');
    await colorConversionService.init();
    const iccBytes = await iccProfileService.getProfileBytes(profileId);

    onProgress?.(25, 'Rendering high-resolution 300 DPI artwork...');
    const targetDpi = 300;
    const geom = getArtworkExportGeometry({ ...dimensions, bleedMm: includeBleed ? bleedMm : 0 }, targetDpi, 6);

    const widthPx = includeTrimMarks ? geom.totalTrimMarksWidthPx : geom.targetArtworkWidthPx;
    const heightPx = includeTrimMarks ? geom.totalTrimMarksHeightPx : geom.targetArtworkHeightPx;

    const canvas = canvasManager.getCanvas();
    if (!canvas) {
      throw new Error('Canvas not available for export');
    }

    // Render offscreen canvas at exact print pixel dimensions
    const offscreen = document.createElement('canvas');
    offscreen.width = widthPx;
    offscreen.height = heightPx;
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Could not create offscreen context');

    // Draw background and artwork
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);

    const dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier: widthPx / canvas.getWidth(),
    });

    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    const imageData = ctx.getImageData(0, 0, widthPx, heightPx);

    onProgress?.(55, `Converting pixels to 4-channel CMYK through ${iccProfileService.getProfile(profileId).name}...`);
    const cmykBuffer = await colorConversionService.transformPixelsRgbToCmyk(
      imageData.data,
      widthPx * heightPx,
      profileId
    );

    onProgress?.(85, 'Encoding TIFF with 300 DPI tags and embedded ICC profile...');
    const tiffBytes = encodeCmykTiff(cmykBuffer, widthPx, heightPx, targetDpi, iccBytes);

    const filename = `${designName}_CMYK_${targetDpi}dpi.tiff`;
    onProgress?.(100, 'CMYK TIFF ready.');

    return { bytes: tiffBytes, filename };
  }

  /**
   * Export soft-proof simulated RGB PNG.
   */
  public async exportPrintPreviewPng(params: {
    canvasManager: CanvasManager;
    dimensions: CanvasDimensions;
    profileId?: string;
    designName?: string;
    onProgress?: (progress: number, message: string) => void;
  }): Promise<{ dataUrl: string; filename: string }> {
    const { canvasManager, profileId = 'fogra39', designName = 'artwork', onProgress } = params;

    onProgress?.(20, 'Simulating print output colors (Soft Proof)...');
    const canvas = canvasManager.getCanvas();
    if (!canvas) throw new Error('Canvas not found');

    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => (img.onload = r));

    const temp = document.createElement('canvas');
    temp.width = img.width;
    temp.height = img.height;
    const ctx = temp.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
    const transformed = await colorConversionService.transformPixelsRgbaToSoftProof(
      imgData.data,
      temp.width,
      temp.height,
      profileId
    );
    imgData.data.set(transformed);
    ctx.putImageData(imgData, 0, 0);

    const outDataUrl = temp.toDataURL('image/png');
    return { dataUrl: outDataUrl, filename: `${designName}_Print_Preview.png` };
  }

  /**
   * Export soft-proof simulated RGB WebP.
   */
  public async exportPrintPreviewWebp(params: {
    canvasManager: CanvasManager;
    dimensions: CanvasDimensions;
    profileId?: string;
    designName?: string;
    quality?: number;
    onProgress?: (progress: number, message: string) => void;
  }): Promise<{ dataUrl: string; filename: string }> {
    const { canvasManager, profileId = 'fogra39', designName = 'artwork', quality = 95, onProgress } = params;

    const preview = await this.exportPrintPreviewPng({
      canvasManager,
      dimensions: params.dimensions,
      profileId,
      designName,
      onProgress,
    });

    const img = new Image();
    img.src = preview.dataUrl;
    await new Promise((r) => (img.onload = r));

    const temp = document.createElement('canvas');
    temp.width = img.width;
    temp.height = img.height;
    const ctx = temp.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const webpUrl = temp.toDataURL('image/webp', quality / 100);
    return { dataUrl: webpUrl, filename: `${designName}_Print_Preview.webp` };
  }

  /**
   * Export soft-proof simulated RGB SVG while keeping vector geometry 100% vector!
   */
  public async exportPrintPreviewSvg(params: {
    svgMarkup: string;
    profileId?: string;
    designName?: string;
  }): Promise<{ svg: string; filename: string }> {
    const { svgMarkup, profileId = 'fogra39', designName = 'artwork' } = params;

    // Collect all unique HEX colors in SVG
    const hexRegex = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b/g;
    const matches = Array.from(new Set(svgMarkup.match(hexRegex) || []));

    let updatedSvg = svgMarkup;
    for (const hex of matches) {
      const proofHex = await colorConversionService.softProofHex(hex, profileId);
      // Replace instances of this color
      const pattern = new RegExp(hex, 'gi');
      updatedSvg = updatedSvg.replace(pattern, proofHex);
    }

    return { svg: updatedSvg, filename: `${designName}_Print_Preview.svg` };
  }
}

export const printExportService = new PrintExportService();
