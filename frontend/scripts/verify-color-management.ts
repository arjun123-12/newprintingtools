import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  colorConversionService,
  hexToRgb,
  rgbToHex,
} from '../src/services/colorManagement/colorConversionService';
import { iccProfileService } from '../src/services/colorManagement/iccProfileService';
import { gamutService } from '../src/services/colorManagement/gamutService';
import { encodeCmykTiff, printExportService } from '../src/services/colorManagement/printExportService';

async function runTests() {
  console.log('=== STARTING PRINT COLOR MANAGEMENT VERIFICATION ===\n');

  // 1. Initialize LittleCMS WASM engine
  console.log('[Step 1] Initializing LittleCMS WASM engine...');
  const initSuccess = await colorConversionService.init();
  console.log('LittleCMS Initialized:', initSuccess);
  console.log('Fallback Mode:', colorConversionService.isFallbackMode());
  if (!initSuccess) {
    throw new Error('ColorConversionService failed to initialize');
  }

  // 2. Check ICC Profiles registry and byte loading
  console.log('\n[Step 2] Checking registered ICC profiles...');
  const profiles = iccProfileService.getAllProfiles();
  console.log('Registered Profiles:', profiles.map(p => p.id));

  const fograBytes = await iccProfileService.getProfileBytes('fogra39');
  console.log('Loaded CoatedFOGRA39 bytes:', fograBytes.length);
  const swopBytes = await iccProfileService.getProfileBytes('swop');
  console.log('Loaded SWOP bytes:', swopBytes.length);
  const gracolBytes = await iccProfileService.getProfileBytes('gracol');
  console.log('Loaded GRACoL bytes:', gracolBytes.length);
  const psoBytes = await iccProfileService.getProfileBytes('psocoated_v3');
  console.log('Loaded PSO Coated v3 bytes:', psoBytes.length);

  // TEST 1: Bright Green RGB -> CMYK -> Soft Proof & Gamut
  console.log('\n[TEST 1] Bright RGB Green (#00FF00) Gamut & Soft Proof:');
  const brightGreenRgb = { r: 0, g: 255, b: 0 };
  const greenCmyk = await colorConversionService.rgbToCmykWithIcc(brightGreenRgb, 'fogra39');
  console.log('Bright Green CMYK (%):', greenCmyk);

  const greenSoftProofRgb = await colorConversionService.cmykToRgbWithIcc(greenCmyk, 'fogra39');
  const greenSoftProofHex = rgbToHex(greenSoftProofRgb.r, greenSoftProofRgb.g, greenSoftProofRgb.b);
  console.log('Bright Green Soft Proof Display RGB:', greenSoftProofRgb);
  console.log('Bright Green Soft Proof Display HEX:', greenSoftProofHex);

  const gamutCheck = await gamutService.checkGamut(brightGreenRgb, 'fogra39');
  console.log('Gamut Check isOutOfGamut:', gamutCheck.isOutOfGamut);
  console.log('Gamut Check Delta E:', gamutCheck.deltaE);
  console.log('Gamut Check Warning:', gamutCheck.warningMessage);
  console.log('Closest In-Gamut Color:', gamutCheck.closestHex);

  if (!gamutCheck.isOutOfGamut) {
    throw new Error('Bright Green should be flagged as out-of-gamut for offset print!');
  }

  // TEST 2: Multi-color SVG Swatch Conversion & Independence
  console.log('\n[TEST 2] Multi-color SVG Unique Swatches (Red, Green, Blue, Yellow):');
  const svgColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  for (const hex of svgColors) {
    const cmyk = await colorConversionService.hexToCmykWithIcc(hex, 'fogra39');
    const proofHex = await colorConversionService.softProofHex(hex, 'fogra39');
    console.log(`Color: ${hex} -> CMYK: C${cmyk.c}% M${cmyk.m}% Y${cmyk.y}% K${cmyk.k}% -> SoftProof: ${proofHex}`);
  }

  // TEST 3: Black handling: Pure K Black vs Rich Black
  console.log('\n[TEST 3] Black Handling:');
  const pureBlackCmyk = { c: 0, m: 0, y: 0, k: 100 };
  const pureBlackRgb = await colorConversionService.cmykToRgbWithIcc(pureBlackCmyk, 'fogra39');
  console.log('Pure K Black Display RGB:', pureBlackRgb);

  const richBlackCmyk = { c: 60, m: 40, y: 40, k: 100 };
  const richBlackRgb = await colorConversionService.cmykToRgbWithIcc(richBlackCmyk, 'fogra39');
  console.log('Rich Black Display RGB:', richBlackRgb);

  // TEST 4: Performance Caching (repeat conversions should be immediate)
  console.log('\n[TEST 4] Unique Color Cache Verification:');
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) {
    await colorConversionService.softProofHex('#FF0000', 'fogra39');
  }
  const t1 = performance.now();
  console.log(`1,000 cached conversions took: ${(t1 - t0).toFixed(2)}ms (< 15ms expected)`);
  if (t1 - t0 > 100) {
    throw new Error('Cache lookup took too long!');
  }

  // TEST 5: CMYK TIFF 6.0 Encoding
  console.log('\n[TEST 5] CMYK TIFF 6.0 Binary Generation:');
  const width = 100;
  const height = 100;
  // 100x100 4-channel pixels: Cyan=255, Magenta=128, Yellow=64, Black=32
  const dummyCmyk = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    dummyCmyk[i * 4] = 255;
    dummyCmyk[i * 4 + 1] = 128;
    dummyCmyk[i * 4 + 2] = 64;
    dummyCmyk[i * 4 + 3] = 32;
  }

  const tiffBinary = encodeCmykTiff(dummyCmyk, width, height, 300, fograBytes);
  console.log('TIFF Binary size (bytes):', tiffBinary.length);

  // Validate TIFF Header
  const view = new DataView(tiffBinary.buffer, tiffBinary.byteOffset, tiffBinary.byteLength);
  const endian = view.getUint16(0, true);
  const magic = view.getUint16(2, true);
  console.log('TIFF Endian:', endian === 0x4949 ? 'II (Little-Endian) OK' : 'FAIL');
  console.log('TIFF Magic:', magic === 42 ? '42 OK' : 'FAIL');

  // Verify TIFF tags (PhotometricInterpretation = 5 / CMYK Separated, SamplesPerPixel = 4)
  const ifdOffset = view.getUint32(4, true);
  const numTags = view.getUint16(ifdOffset, true);
  console.log('IFD Number of Tags:', numTags);

  let photometric: number | null = null;
  let samplesPerPixel: number | null = null;
  let iccTagFound = false;

  let pos = ifdOffset + 2;
  for (let i = 0; i < numTags; i++) {
    const tag = view.getUint16(pos, true);
    const type = view.getUint16(pos + 2, true);
    const count = view.getUint32(pos + 4, true);
    const valOrOffset = view.getUint32(pos + 8, true);

    if (tag === 262) photometric = valOrOffset;
    if (tag === 277) samplesPerPixel = valOrOffset;
    if (tag === 34675) iccTagFound = count === fograBytes.length;

    pos += 12;
  }

  console.log('PhotometricInterpretation Tag (262):', photometric, photometric === 5 ? 'CMYK Separated OK' : 'FAIL');
  console.log('SamplesPerPixel Tag (277):', samplesPerPixel, samplesPerPixel === 4 ? '4-Channel OK' : 'FAIL');
  console.log('ICC Profile Tag (34675):', iccTagFound ? `Embedded ${fograBytes.length} bytes OK` : 'FAIL');

  if (photometric !== 5 || samplesPerPixel !== 4 || !iccTagFound) {
    throw new Error('TIFF binary failed CMYK verification!');
  }

  // TEST 6: SVG Print Preview Vector Color Transformation
  console.log('\n[TEST 6] Vector SVG Soft-Proof Transformation:');
  const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <rect x="0" y="0" width="50" height="50" fill="#FF0000" stroke="#00FF00" />
    <text x="10" y="80" fill="#0000FF">Print Test</text>
  </svg>`;

  const proofSvg = await printExportService.exportPrintPreviewSvg({
    svgMarkup: sampleSvg,
    profileId: 'fogra39',
  });
  console.log('Transformed SVG result:');
  console.log(proofSvg.svg);
  if (!proofSvg.svg.includes('<rect') || !proofSvg.svg.includes('<text')) {
    throw new Error('Vector geometry was lost in SVG soft proof!');
  }

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
