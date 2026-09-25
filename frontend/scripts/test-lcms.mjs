import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initWasm,
  cmsCreate_sRGBProfile,
  cmsOpenProfileFromMem,
  cmsCreateTransform,
  cmsDoTransform,
  cmsCloseProfile,
  cmsDeleteTransform,
  CmsIntent
} from '@kittl/little-cms';
import { TYPE_RGB_8, TYPE_CMYK_8 } from '@kittl/little-cms/formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const wasmPath = path.join(__dirname, '..', 'node_modules', '@kittl', 'little-cms', 'dist', 'lcms.wasm');
  console.log('Initializing WASM...');
  const initRes = await initWasm(wasmPath);
  console.log('Init result:', initRes);

  const srgbProfileRes = cmsCreate_sRGBProfile();
  console.log('sRGB profile result:', srgbProfileRes);

  const fograPath = path.join(__dirname, '..', 'public', 'icc', 'CoatedFOGRA39.icc');
  const fograBytes = new Uint8Array(fs.readFileSync(fograPath));
  const cmykProfileRes = cmsOpenProfileFromMem(fograBytes);
  console.log('CMYK profile result:', cmykProfileRes);

  if (!srgbProfileRes.error && !cmykProfileRes.error) {
    const srgbProfile = srgbProfileRes.value;
    const cmykProfile = cmykProfileRes.value;

    const transformRes = cmsCreateTransform(
      srgbProfile,
      TYPE_RGB_8,
      cmykProfile,
      TYPE_CMYK_8,
      CmsIntent.Percepttual,
      0
    );
    console.log('Transform result:', transformRes);

    if (!transformRes.error) {
      const transform = transformRes.value;
      // Test bright red: R=255, G=0, B=0
      const inputRgb = new Uint8Array([255, 0, 0]);
      const outputCmykRes = cmsDoTransform(transform, inputRgb, 1);
      console.log('Output CMYK result:', outputCmykRes);
      if (!outputCmykRes.error) {
        const cmyk = outputCmykRes.value;
        console.log('CMYK raw bytes:', Array.from(cmyk));
        console.log('CMYK %:', {
          c: Math.round((cmyk[0] / 255) * 100),
          m: Math.round((cmyk[1] / 255) * 100),
          y: Math.round((cmyk[2] / 255) * 100),
          k: Math.round((cmyk[3] / 255) * 100),
        });
      }
      cmsDeleteTransform(transform);
    }
    cmsCloseProfile(srgbProfile);
    cmsCloseProfile(cmykProfile);
  }
}

main().catch(console.error);
