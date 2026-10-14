import { FabricImage } from 'fabric';
import { CanvasManager } from '../canvas/CanvasManager';
import {
  getObjectVisualSilhouette,
  requiresSilhouetteShadow,
  getEffectiveCornerRadius,
} from '../canvas/visualGeometry';
import { isHollowTextObject } from '../canvas/hollowTextRenderer';
import {
  LOCAL_PDF_FONT_FAMILIES,
  pdfWeightStyleName,
  isPdfSafeSfntFont,
  isSafePdfFontFamily,
} from '../services/exportService';

/** Cache for in-memory embedded base64 fonts to avoid duplicate network fetches during session */
const fontDataUrlCache = new Map<string, string>();

/**
 * Recursively collects all Fabric objects including children inside Groups,
 * ActiveSelections, frames, and composite objects.
 */
export function collectFabricObjectsRecursively(
  root: any,
  predicate?: (obj: any) => boolean
): any[] {
  const results: any[] = [];
  const visited = new Set<any>();

  const traverse = (node: any) => {
    if (!node || visited.has(node)) return;
    visited.add(node);

    // Exclude editor guides from visual artwork collection
    if (
      node.get?.('isGuide' as any) ||
      node.get?.('isPrintGuide' as any) ||
      node.get?.('isRulerGuide' as any) ||
      node.isGuide
    ) {
      return;
    }

    // Exclude editor-only crop adjustment overlays, but DO NOT exclude visible effect helpers
    if (node.isCropOverlayPhoto) {
      return;
    }

    if (!predicate || predicate(node)) {
      results.push(node);
    }

    if (Array.isArray(node._objects)) {
      node._objects.forEach(traverse);
    } else if (typeof node.getObjects === 'function') {
      try {
        node.getObjects().forEach(traverse);
      } catch { }
    }
  };

  if (Array.isArray(root)) {
    root.forEach(traverse);
  } else if (root) {
    if (typeof root.getObjects === 'function') {
      root.getObjects().forEach(traverse);
    } else {
      traverse(root);
    }
  }

  return results;
}

/**
 * Detects whether a Fabric object is any form of text.
 */
export function isFabricText(obj: any): boolean {
  if (!obj) return false;
  const type = String(obj.type || '').toLowerCase();
  return (
    type === 'text' ||
    type === 'i-text' ||
    type === 'textbox' ||
    Boolean(obj.isText) ||
    typeof obj.text === 'string'
  );
}

/**
 * Normalizes font weight to 100-900 numeric standard.
 */
export function normalizeFontWeight(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(100, Math.min(900, Math.round(value / 100) * 100));
  }
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'bold' || raw === 'bolder') return 700;
  if (raw === 'lighter') return 300;
  const parsed = parseInt(raw, 10);
  if (Number.isFinite(parsed)) {
    return Math.max(100, Math.min(900, Math.round(parsed / 100) * 100));
  }
  return 400;
}

export function isStandardSystemFont(family: string): boolean {
  const f = family.toLowerCase().trim();
  return (
    f === 'arial' ||
    f === 'helvetica' ||
    f === 'times' ||
    f === 'times new roman' ||
    f === 'georgia' ||
    f === 'courier' ||
    f === 'courier new' ||
    f === 'sans-serif' ||
    f === 'serif' ||
    f === 'monospace' ||
    f === 'cursive' ||
    f === 'fantasy' ||
    f === 'system-ui'
  );
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let index = 0;
  const length = bytes.length;
  let result = '';
  while (index < length) {
    const slice = bytes.subarray(index, Math.min(index + CHUNK_SIZE, length));
    result += String.fromCharCode.apply(null, slice as unknown as number[]);
    index += CHUNK_SIZE;
  }
  return window.btoa(result);
}

/**
 * Fetches Google Font CSS and embeds the browser webfont as a base64
 * @font-face rule for self-contained SVG/browser rendering.
 *
 * NOTE: this may be WOFF2, which is correct for SVG. The PDF exporter does
 * NOT register these WOFF2 bytes directly; exportService separately resolves
 * an Acrobat-safe TTF/OTF font before PDFKit renders vector text.
 */
async function fetchAndCreateFontFace(
  family: string,
  weight: number,
  italic: boolean
): Promise<string | null> {
  const cacheKey = `${family.toLowerCase()}|${weight}|${italic ? 1 : 0}`;
  if (fontDataUrlCache.has(cacheKey)) {
    const cached = fontDataUrlCache.get(cacheKey)!;
    const format = cached.includes('truetype') ? 'truetype' : 'woff2';
    return `@font-face {\n  font-family: '${family}';\n  font-style: ${
      italic ? 'italic' : 'normal'
    };\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('${cached}') format('${format}');\n}`;
  }

  if (typeof fetch === 'undefined') return null;

  // Priority 1: Check local Acrobat-safe TTF/OTF first
  const normalizedFamily = family.toLowerCase().trim();
  const localConfig = LOCAL_PDF_FONT_FAMILIES[normalizedFamily];
  if (localConfig) {
    const style = pdfWeightStyleName(weight, italic);
    const localUrl = `/fonts/pdf/${localConfig.folder}/${localConfig.prefix}-${style}.ttf`;
    try {
      const localResp = await fetch(localUrl, { cache: 'force-cache' });
      if (localResp.ok) {
        const localBuf = new Uint8Array(await localResp.arrayBuffer());
        if (isPdfSafeSfntFont(localBuf)) {
          const base64 = uint8ArrayToBase64(localBuf);
          const dataUrl = `data:font/truetype;charset=utf-8;base64,${base64}`;
          fontDataUrlCache.set(cacheKey, dataUrl);
          return `@font-face {\n  font-family: '${family}';\n  font-style: ${
            italic ? 'italic' : 'normal'
          };\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('${dataUrl}') format('truetype');\n}`;
        }
      }
    } catch { }
  }

  const escapedFamily = encodeURIComponent(family).replace(/%20/g, '+');
  const cssUrl = `https://fonts.googleapis.com/css2?family=${escapedFamily}:ital,wght@${
    italic ? 1 : 0
  },${weight}&display=swap`;

  try {
    const cssResp = await fetch(cssUrl, {
      mode: 'cors',
      cache: 'force-cache',
    });
    if (cssResp.ok) {
      const cssText = await cssResp.text();
      const urlMatch = cssText.match(
        /src\s*:\s*[^;]*url\((['"]?)(https?:\/\/[^)'"]+)\1\)(?:\s*format\((['"]?)([^)'"]+)\3\))?/i
      );
      if (urlMatch && urlMatch[2]) {
        const fontBinaryUrl = urlMatch[2];
        const format = urlMatch[4] || 'woff2';

        const fontResp = await fetch(fontBinaryUrl, {
          mode: 'cors',
          cache: 'force-cache',
        });
        if (fontResp.ok) {
          const buffer = new Uint8Array(await fontResp.arrayBuffer());
          if (buffer.length >= 10) {
            const base64 = uint8ArrayToBase64(buffer);
            const dataUrl = `data:font/${format};charset=utf-8;base64,${base64}`;
            fontDataUrlCache.set(cacheKey, dataUrl);

            return `@font-face {\n  font-family: '${family}';\n  font-style: ${
              italic ? 'italic' : 'normal'
            };\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('${dataUrl}') format('${format}');\n}`;
          }
        }
      }
    }
  } catch { }

  return null;
}

/**
 * Ensures all fonts used in text objects (including nested groups and composite elements)
 * are embedded as base64 @font-face rules directly in the SVG <defs><style>.
 * Text elements remain genuine vector elements. For PDF, exportService maps
 * these families to Acrobat-safe TTF/OTF binaries before PDFKit rendering.
 */
export async function embedFontsInSvgDefs(
  svgDoc: Document,
  canvasManager: CanvasManager | null
): Promise<void> {
  if (!canvasManager) return;
  const canvas = canvasManager.getCanvas();
  if (!canvas) return;

  const allObjects = collectFabricObjectsRecursively(canvas);
  const textObjects = allObjects.filter(isFabricText);

  if (textObjects.length === 0) return;

  const fontRequests = new Map<string, { family: string; weight: number; italic: boolean }>();

  for (const obj of textObjects) {
    const rawFamily = ((obj as any).fontFamily || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    if (!rawFamily) continue;
    const weight = normalizeFontWeight((obj as any).fontWeight);
    const fontStyle = String((obj as any).fontStyle || 'normal').toLowerCase();
    const italic = fontStyle === 'italic' || fontStyle === 'oblique';
    const key = `${rawFamily.toLowerCase()}|${weight}|${italic ? 1 : 0}`;
    if (!fontRequests.has(key)) {
      fontRequests.set(key, { family: rawFamily, weight, italic });
    }
  }

  let defs = svgDoc.querySelector('defs');
  if (!defs) {
    defs = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgDoc.documentElement.insertBefore(defs, svgDoc.documentElement.firstChild);
  }

  const existingStyleEl = defs.querySelector('style');
  const styleEl: Element = existingStyleEl ?? (() => {
    const createdStyleEl = svgDoc.createElementNS(
      'http://www.w3.org/2000/svg',
      'style'
    );
    createdStyleEl.setAttribute('type', 'text/css');
    defs.appendChild(createdStyleEl);
    return createdStyleEl;
  })();

  const fontFaceRules: string[] = [];
  const importUrls: string[] = [];

  for (const { family, weight, italic } of fontRequests.values()) {
    if (isStandardSystemFont(family)) continue;

    // Check if there is an in-document custom font-face rule (e.g. from user/admin font upload)
    let customRuleFound = false;
    if (typeof document !== 'undefined') {
      const styles = Array.from(document.querySelectorAll('style'));
      for (const s of styles) {
        const text = s.textContent || '';
        if (
          text.includes('@font-face') &&
          text.includes('data:') &&
          (text.toLowerCase().includes(`"${family.toLowerCase()}"`) ||
            text.toLowerCase().includes(`'${family.toLowerCase()}'`) ||
            text.toLowerCase().includes(`font-family: ${family.toLowerCase()}`))
        ) {
          fontFaceRules.push(text);
          customRuleFound = true;
          break;
        }
      }
    }

    if (!customRuleFound) {
      const escapedFamily = encodeURIComponent(family).replace(/%20/g, '+');
      const importUrl = `https://fonts.googleapis.com/css2?family=${escapedFamily}:ital,wght@${italic ? 1 : 0
        },${weight}&display=swap`;
      importUrls.push(`@import url('${importUrl}');`);

      try {
        const fontFaceCss = await fetchAndCreateFontFace(family, weight, italic);
        if (fontFaceCss) {
          fontFaceRules.push(fontFaceCss);
        }
      } catch (err) {
        console.warn(`Could not embed binary font-face for ${family}:`, err);
      }
    }
  }

  const combinedCss = [
    importUrls.join('\n'),
    fontFaceRules.join('\n\n'),
  ]
    .filter(Boolean)
    .join('\n\n');

  if (combinedCss) {
    const currentCss = styleEl.textContent || '';
    styleEl.textContent = currentCss
      ? `${currentCss}\n\n${combinedCss}`
      : combinedCss;
  }
}

/**
 * Expands all SVG filter regions so that drop-shadow blur and offset are never clipped
 * at object boundaries.
 */
export function expandSvgFilterRegions(svgDoc: Document): void {
  const filters = svgDoc.querySelectorAll('filter');
  filters.forEach((filter) => {
    filter.setAttribute('x', '-100%');
    filter.setAttribute('y', '-100%');
    filter.setAttribute('width', '300%');
    filter.setAttribute('height', '300%');
  });
}

function parseColorAndOpacity(cssColor: string): { color: string; opacity: number } {
  if (!cssColor || cssColor === 'transparent') {
    return { color: '#000000', opacity: 0 };
  }
  const rgbaMatch = cssColor.match(
    /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i
  );
  if (rgbaMatch) {
    const r = rgbaMatch[1];
    const g = rgbaMatch[2];
    const b = rgbaMatch[3];
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    return { color: `rgb(${r}, ${g}, ${b})`, opacity: Number.isFinite(a) ? a : 1 };
  }
  // 8-digit hex #rrggbbaa
  const hex8Match = cssColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex8Match) {
    const r = parseInt(hex8Match[1], 16);
    const g = parseInt(hex8Match[2], 16);
    const b = parseInt(hex8Match[3], 16);
    const a = parseInt(hex8Match[4], 16) / 255;
    return { color: `rgb(${r}, ${g}, ${b})`, opacity: Math.round(a * 100) / 100 };
  }
  // 4-digit hex #rgba
  const hex4Match = cssColor.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (hex4Match) {
    const r = parseInt(hex4Match[1] + hex4Match[1], 16);
    const g = parseInt(hex4Match[2] + hex4Match[2], 16);
    const b = parseInt(hex4Match[3] + hex4Match[3], 16);
    const a = parseInt(hex4Match[4] + hex4Match[4], 16) / 255;
    return { color: `rgb(${r}, ${g}, ${b})`, opacity: Math.round(a * 100) / 100 };
  }
  return { color: cssColor, opacity: 1 };
}


/**
 * Finds the SVG element corresponding to a Fabric object.
 * Fabric does not always serialize custom object IDs as SVG id attributes,
 * so this first tries explicit IDs and then safely falls back to top-level order.
 */
export function findSvgElementForFabricObject(
  svgDoc: Document,
  obj: any,
  allObjects: any[]
): Element | null {
  if (!obj) return null;

  const objectId = obj.id || obj._svgExportId;

  if (objectId) {
    const direct = svgDoc.getElementById(String(objectId));
    if (direct) return direct;

    const escapedAttributeValue = String(objectId)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

    const selectors = [
      `[id="${escapedAttributeValue}"]`,
      `[data-fabric-id="${escapedAttributeValue}"]`,
      `[data-object-id="${escapedAttributeValue}"]`,
    ];

    for (const selector of selectors) {
      try {
        const found = svgDoc.querySelector(selector);
        if (found) return found;
      } catch {
        // Ignore invalid selector and continue with fallback matching.
      }
    }
  }

  // Fallback 1: If object belongs to a group, look inside the parent group element
  if (obj.group) {
    const parentEl = findSvgElementForFabricObject(svgDoc, obj.group, allObjects);
    if (parentEl) {
      const groupObjects = (obj.group._objects || (typeof obj.group.getObjects === 'function' ? obj.group.getObjects() : [])) as any[];
      const idxInGroup = groupObjects.indexOf(obj);
      if (idxInGroup >= 0) {
        // Direct child elements of group
        const groupChildren = Array.from(parentEl.children).filter((el) => {
          const t = el.tagName.toLowerCase();
          return t === 'g' || t === 'rect' || t === 'path' || t === 'image' || t === 'text' || t === 'polygon' || t === 'circle' || t === 'ellipse';
        });
        if (groupChildren[idxInGroup]) {
          return groupChildren[idxInGroup];
        }
      }
    }
  }

  // Fallback 2: Top-level visual objects order fallback
  const topLevelObjects = allObjects.filter((item) => {
    if (!item) return false;
    if (item.isGuide || item.isPrintGuide || item.isRulerGuide || item.isCropOverlayPhoto) {
      return false;
    }
    return !item.group;
  });

  const objectIndex = topLevelObjects.indexOf(obj);
  if (objectIndex < 0) return null;

  const root = svgDoc.documentElement;
  // If wrapped in clip-path group or artwork redline group, search inside the container group
  let container: Element = root;
  const clipWrapper =
    root.querySelector('g[clip-path*="artwork-redline-clip"]') ||
    (root.children.length >= 2 &&
      root.children[0].tagName.toLowerCase() === 'defs' &&
      root.children[1].tagName.toLowerCase() === 'g'
      ? root.children[1]
      : null);
  if (clipWrapper) {
    container = clipWrapper;
  }

  const candidates = Array.from(container.children).filter((element) => {
    const tag = element.tagName.toLowerCase();
    if (
      element.getAttribute('data-pdf-background') === 'true' ||
      element.getAttribute('id') === 'export-canvas-background' ||
      element.getAttribute('id') === 'canvas-background-rect'
    ) {
      return false;
    }
    return (
      tag === 'g' ||
      tag === 'image' ||
      tag === 'rect' ||
      tag === 'path' ||
      tag === 'polygon' ||
      tag === 'circle' ||
      tag === 'ellipse' ||
      tag === 'text'
    );
  });

  return candidates[objectIndex] || null;
}



/**
 * Fabric may serialize an alpha/PNG custom frame mask inside <clipPath>.
 * SVG clipPath only uses geometry, so an <image> inside it clips by the image's
 * rectangular bounds and loses transparent pixels. Convert those image-based
 * clipPaths to real alpha masks so custom frames retain their exact silhouette.
 */
export function convertImageClipPathsToAlphaMasks(svgDoc: Document): void {
  const clipPaths = Array.from(svgDoc.querySelectorAll('clipPath'));

  let counter = 0;

  for (const clipPath of clipPaths) {
    const maskImages = Array.from(clipPath.querySelectorAll('image'));
    if (maskImages.length === 0) continue;

    const clipId = clipPath.getAttribute('id');
    if (!clipId) continue;

    // Only convert clipPaths that are actually referenced.
    const referencing = Array.from(svgDoc.querySelectorAll('[clip-path]')).filter(
      (el) => el.getAttribute('clip-path') === `url(#${clipId})`
    );
    if (referencing.length === 0) continue;

    counter++;
    const maskId = `export_alpha_mask_${counter}`;

    const mask = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', maskId);
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
    mask.setAttribute('x', '-200%');
    mask.setAttribute('y', '-200%');
    mask.setAttribute('width', '500%');
    mask.setAttribute('height', '500%');
    mask.setAttribute('style', 'mask-type: alpha;');

    // IMPORTANT: for an alpha mask we want the transparent PNG/SVG raster itself.
    // Fabric sometimes also adds a transparent rect to the clipPath; that rect
    // must not become an opaque rectangular mask.
    for (const child of Array.from(clipPath.childNodes)) {
      if (child.nodeType !== 1) continue;
      const element = child as Element;
      const tag = element.tagName.toLowerCase();

      if (tag === 'rect') {
        const fill = (element.getAttribute('fill') || '').toLowerCase();
        const style = (element.getAttribute('style') || '').toLowerCase();
        if (
          fill === 'none' ||
          fill === 'transparent' ||
          style.includes('fill: none') ||
          style.includes('fill:none') ||
          style.includes('fill-opacity: 0') ||
          style.includes('fill-opacity:0')
        ) {
          continue;
        }
      }

      const imported = element.cloneNode(true) as Element;
      imported.removeAttribute('id');
      imported.removeAttribute('filter');
      mask.appendChild(imported);
    }

    const defs = clipPath.parentElement;
    if (!defs) continue;
    defs.appendChild(mask);

    for (const el of referencing) {
      el.removeAttribute('clip-path');
      el.setAttribute('mask', `url(#${maskId})`);
    }
  }
}

/**
 * Re-applies the exact Fabric frame silhouette to the raster photo inside every
 * exported SVG frame. Fabric can serialize a grouped frame photo as a normal
 * rectangular <image> in some cases, especially for custom/compound frames.
 *
 * The mask source is the same source of truth used by canvas rendering:
 * getObjectVisualSilhouette(frame) -> shape-outline -> photo.clipPath -> overlay.
 *
 * This keeps the photo raster, while the frame mask itself remains vector.
 */
export function preserveFrameMasksInSvg(
  svgDoc: Document,
  canvasManager: CanvasManager | null
): void {
  if (!canvasManager) return;
  const canvas = canvasManager.getCanvas();
  if (!canvas) return;

  const allObjects = collectFabricObjectsRecursively(canvas);

  let defs = svgDoc.querySelector('defs');
  if (!defs) {
    defs = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgDoc.documentElement.insertBefore(defs, svgDoc.documentElement.firstChild);
  }

  const topLevelFrames = canvas.getObjects().filter((obj: any) => {
    if (!obj) return false;
    return Boolean(
      obj.get?.('isFrame' as any) ||
      obj.isFrame ||
      obj.isPhotoShapeGroup ||
      obj.isCustomFrame
    );
  });

  let maskCounter = 0;

  for (const frame of topLevelFrames as any[]) {
    const targetEl = findSvgElementForFabricObject(svgDoc, frame, allObjects);
    if (!targetEl) continue;

    const silhouette = getObjectVisualSilhouette(frame);
    if (!silhouette || silhouette === frame) continue;

    // The exported frame group contains the photo as an <image>. We only clip
    // the actual frame photo; overlays/outlines remain untouched.
    const imageElements = Array.from(targetEl.querySelectorAll('image'));
    if (imageElements.length === 0) continue;

    const children: any[] =
      typeof frame.getObjects === 'function' ? frame.getObjects() : [];

    const photo = children.find((child: any) => child?.frameRole === 'photo');
    const photoIndex = photo ? children.indexOf(photo) : -1;

    // In our frame architecture the photo is normally the first raster image.
    // Prefer its child-order index when it maps cleanly; otherwise use first image.
    const photoEl =
      photoIndex >= 0 && photoIndex < imageElements.length
        ? imageElements[photoIndex]
        : imageElements[0];

    maskCounter++;
    const clipId = `export_frame_clip_${maskCounter}`;

    const clipPathEl = svgDoc.createElementNS(
      'http://www.w3.org/2000/svg',
      'clipPath'
    );
    clipPathEl.setAttribute('id', clipId);
    clipPathEl.setAttribute('clipPathUnits', 'userSpaceOnUse');

    try {
      // Serialize the ACTUAL Fabric silhouette instead of manufacturing a rect.
      // This preserves heart/star/circle/path/custom SVG frame geometry.
      const silhouetteMarkup =
        typeof silhouette.toSVG === 'function' ? silhouette.toSVG() : '';

      if (!silhouetteMarkup) continue;

      const parser = new DOMParser();

      const wrapSilhouette = (markup: string) =>
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${markup}</svg>`;

      let parsed = parser.parseFromString(
        wrapSilhouette(silhouetteMarkup),
        'image/svg+xml'
      );

      // Some uploaded/custom frame SVGs contain raw ampersands in URLs or
      // metadata. Repair only invalid XML ampersands and retry before giving up.
      if (parsed.querySelector('parsererror')) {
        const repairedMarkup = silhouetteMarkup.replace(
          /&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi,
          '&amp;'
        );

        parsed = parser.parseFromString(
          wrapSilhouette(repairedMarkup),
          'image/svg+xml'
        );
      }

      if (parsed.querySelector('parsererror')) {
        console.warn(
          '[SVG Export] Could not parse frame silhouette SVG after XML repair.'
        );
        continue;
      }

      const parsedRoot = parsed.documentElement;
      const visualNodes = Array.from(parsedRoot.childNodes).filter(
        (node): node is Element => node.nodeType === 1
      );

      if (visualNodes.length === 0) continue;

      for (const visualNode of visualNodes) {
        const imported = svgDoc.importNode(visualNode, true) as Element;

        // A clipPath uses geometry/alpha, not the editor's visible paint.
        // Remove effects that could distort the clipping silhouette.
        imported.removeAttribute('filter');
        imported.querySelectorAll('[filter]').forEach((el) =>
          el.removeAttribute('filter')
        );

        clipPathEl.appendChild(imported);
      }

      defs.appendChild(clipPathEl);

      // Override any incorrect rectangular/group clipping Fabric emitted.
      photoEl.setAttribute('clip-path', `url(#${clipId})`);

      // Do not let a nested rectangular clip override the exact frame mask.
      // The explicit clip-path above is now the authoritative frame geometry.
      photoEl.removeAttribute('mask');
    } catch (error) {
      console.warn('[SVG Export] Failed to preserve exact frame mask:', error);
    }
  }

  // IMPORTANT:
  // A custom frame silhouette may itself be a transparent PNG/image. SVG
  // <clipPath><image/></clipPath> clips only by the image rectangle, not its
  // transparent alpha. Convert every newly-created image clipPath into a real
  // alpha <mask> AFTER all frame clip paths have been created.
  convertImageClipPathsToAlphaMasks(svgDoc);
}

/**
 * Fixes shadows for objects that require visual silhouette projection (clipped images with corner rounding,
 * heart/circle/custom SVG frames).
 * Injects a non-clipped silhouette shape with a dedicated shadow filter behind the object in the SVG DOM.
 */
export function injectSilhouetteShadowsInSvg(
  svgDoc: Document,
  canvasManager: CanvasManager | null
): void {
  if (!canvasManager) return;
  const canvas = canvasManager.getCanvas();
  if (!canvas) return;

  const allObjects = collectFabricObjectsRecursively(canvas);

  // Repair frame clipping first. preserveFrameMasksInSvg() now converts any
  // image-based frame clipPath it creates into a real alpha mask afterwards.
  // This ordering is critical for transparent PNG/custom-SVG frame masks.
  preserveFrameMasksInSvg(svgDoc, canvasManager);

  let defs = svgDoc.querySelector('defs');
  if (!defs) {
    defs = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgDoc.documentElement.insertBefore(defs, svgDoc.documentElement.firstChild);
  }

  let shadowCounter = 0;

  for (const obj of allObjects) {
    const shadow = obj.shadow;
    if (!shadow || !shadow.color || shadow.color === 'transparent') continue;

    const targetEl = findSvgElementForFabricObject(svgDoc, obj, allObjects);
    if (!targetEl) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[SVG Export] Could not find SVG element for shadow object:',
          obj.id || (obj as any)._svgExportId || obj.type
        );
      }
      continue;
    }

    const isImg =
      obj.type === 'image' ||
      obj.type === 'fabricImage' ||
      obj.type === 'FabricImage';

    const isFrame =
      Boolean((obj as any).isFrame) ||
      Boolean((obj as any).isPhotoShapeGroup) ||
      Boolean((obj as any).isCustomFrame);

    const requiresSpecialSilhouetteInjection =
      (isImg && (obj.clipPath || Number((obj as any).cornerRadius) > 0)) ||
      (isFrame && typeof (obj as any).getObjects === 'function');

    if (requiresSpecialSilhouetteInjection) {
      shadowCounter++;
      const filterId = `export_sil_shadow_${shadowCounter}`;
      const { color, opacity } = parseColorAndOpacity(String(shadow.color));
      const blur = Math.max(0, Number(shadow.blur) || 0);
      const offsetX = Number(shadow.offsetX) || 0;
      const offsetY = Number(shadow.offsetY) || 0;

      // Create a filter that outputs ONLY the blurred, offset shadow (no SourceGraphic)
      const filter = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', filterId);
      filter.setAttribute('x', '-100%');
      filter.setAttribute('y', '-100%');
      filter.setAttribute('width', '300%');
      filter.setAttribute('height', '300%');

      filter.innerHTML = `
        <feGaussianBlur in="SourceAlpha" stdDeviation="${(blur / 2).toFixed(2)}" />
        <feOffset dx="${offsetX}" dy="${offsetY}" result="offsetblur" />
        <feFlood flood-color="${color}" flood-opacity="${opacity}" />
        <feComposite in2="offsetblur" operator="in" />
        <feMerge>
          <feMergeNode />
        </feMerge>
      `;
      defs.appendChild(filter);

      if (isImg && (obj.clipPath || Number((obj as any).cornerRadius) > 0)) {
        // Rounded image: emit silhouette rect matching effective corner radius
        const w = obj.width || 1;
        const h = obj.height || 1;
        const { rx: localRx, ry: localRy } = getEffectiveCornerRadius(obj);

        const shadowRect = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shadowRect.setAttribute('x', `${-w / 2}`);
        shadowRect.setAttribute('y', `${-h / 2}`);
        shadowRect.setAttribute('width', `${w}`);
        shadowRect.setAttribute('height', `${h}`);
        if (localRx > 0) shadowRect.setAttribute('rx', `${localRx}`);
        if (localRy > 0) shadowRect.setAttribute('ry', `${localRy}`);
        shadowRect.setAttribute('fill', '#000000');
        shadowRect.setAttribute('filter', `url(#${filterId})`);

        const shadowGroup = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
        shadowGroup.setAttribute('data-shadow-element', 'true');
        const transform = targetEl.getAttribute('transform');
        if (transform) {
          shadowGroup.setAttribute('transform', transform);
        }
        shadowGroup.appendChild(shadowRect);

        // Insert immediately before target element in SVG DOM
        targetEl.parentNode?.insertBefore(shadowGroup, targetEl);

        // Remove any inner filter from image inside clip-path
        targetEl.removeAttribute('filter');
        targetEl.querySelectorAll('[filter]').forEach((el) => el.removeAttribute('filter'));
      } else if (isFrame && typeof (obj as any).getObjects === 'function') {
        // Frame (heart, circle, custom SVG): locate outline/mask path and place shadow behind photo
        const children: any[] = (obj as any).getObjects();
        const shapeOutline = children.find((o) => o.frameRole === 'shape-outline');
        const outlineEl = shapeOutline
          ? findSvgElementForFabricObject(svgDoc, shapeOutline, allObjects)
          : null;

        if (outlineEl) {
          const shadowShape = outlineEl.cloneNode(true) as Element;
          shadowShape.removeAttribute('id');
          shadowShape.removeAttribute('stroke');
          shadowShape.removeAttribute('stroke-width');
          shadowShape.setAttribute('fill', '#000000');
          shadowShape.setAttribute('filter', `url(#${filterId})`);
          shadowShape.setAttribute('data-shadow-element', 'true');

          // Insert as first child of frame group so it's behind photo and outline
          targetEl.insertBefore(shadowShape, targetEl.firstChild);
        } else {
          // Fallback: apply filter to target frame group
          targetEl.setAttribute('filter', `url(#${filterId})`);
        }
      }
    } else {
      // Normal Fabric text, shape, or path:
      // Ensure it has a valid SVG drop-shadow filter if Fabric omitted one.
      const existingFiltered =
        targetEl.matches?.('[filter], [style*="filter"]')
          ? targetEl
          : targetEl.querySelector?.('[filter], [style*="filter"]') || null;

      let hasResolvedFilter = false;

      if (existingFiltered) {
        const filterAttr = existingFiltered.getAttribute('filter') || '';
        const styleAttr = existingFiltered.getAttribute('style') || '';
        const match = filterAttr.match(/url\(#([^)]+)\)/) || styleAttr.match(/filter\s*:\s*url\(#([^)]+)\)/);
        if (match && svgDoc.getElementById(match[1])) {
          hasResolvedFilter = true;
        }
      }

      if (!hasResolvedFilter) {
        shadowCounter++;
        const filterId = `export_obj_shadow_${shadowCounter}`;
        const { color, opacity } = parseColorAndOpacity(String(shadow.color));
        const blur = Math.max(0, Number(shadow.blur) || 0);
        const offsetX = Number(shadow.offsetX) || 0;
        const offsetY = Number(shadow.offsetY) || 0;

        const filter = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', filterId);
        filter.setAttribute('x', '-100%');
        filter.setAttribute('y', '-100%');
        filter.setAttribute('width', '300%');
        filter.setAttribute('height', '300%');

        filter.innerHTML = `
          <feGaussianBlur in="SourceAlpha" stdDeviation="${(blur / 2).toFixed(2)}" />
          <feOffset dx="${offsetX}" dy="${offsetY}" result="offsetblur" />
          <feFlood flood-color="${color}" flood-opacity="${opacity}" />
          <feComposite in2="offsetblur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        `;
        defs.appendChild(filter);

        targetEl.setAttribute('filter', `url(#${filterId})`);
      }
    }
  }
}


/**
 * Detects whether a non-text Fabric object requires rasterization for vector PDF export.
 *
 * Why this is needed:
 * Native PDF renderers (such as SVG-to-PDFKit / pdfkit) suffer from severe mathematical
 * scaling bugs when converting SVG `<rect rx="..." ry="...">` and non-scaling strokes under
 * matrix transforms. As a result, rounded corners and bordered shapes balloon into enormous
 * distorted circles, arcs, or elliptical blobs across the document.
 *
 * In addition, complex photo frames with alpha masks and clipped images with corner rounding
 * can lose their masks in SVG-to-PDFKit.
 *
 * By rasterizing these specific elements at ultra-high resolution (4x / 300+ DPI) and embedding
 * them as lossless transparent PNG <image> elements in place of the SVG shape:
 * 1. The downloaded PDF matches the on-screen canvas 100% identically with exact corner radii and clean borders.
 * 2. Giant arc ballooning and stroke distortions are completely eliminated.
 * 3. All plain vector shapes and clean vector fonts elsewhere remain true resolution-independent vectors.
 */
export function requiresRasterizationForVectorPdf(obj: any): boolean {
  if (!obj) return false;

  // Never treat editor guide lines or crop overlays as exportable artwork
  if (
    obj.isGuide ||
    obj.isPrintGuide ||
    obj.isRulerGuide ||
    obj.isCropOverlayPhoto ||
    obj.isFoldGuideLine ||
    (obj as any).excludeFromVisualExport
  ) {
    return false;
  }

  // Text objects have their own specialized rasterization pipeline (rasterizeHollowTextForExport)
  if (isFabricText(obj)) {
    return false;
  }

  // 1. Frame objects (photoShapeGroup, customFrame, heart/circle/star frame)
  const isFrame = Boolean(
    obj.get?.('isFrame' as any) ||
    obj.isFrame ||
    obj.isPhotoShapeGroup ||
    obj.isCustomFrame
  );
  if (isFrame) return true;

  // 2. Corner radius on ANY non-text object (Rect, Image, Shape, Polygon, Triangle, Star, Hexagon, Path, etc.)
  const cornerRadius =
    Number((obj as any).cornerRadius) ||
    Number((obj as any)._requestedRadius) ||
    Number((obj as any).rx) ||
    Number((obj as any).ry) ||
    0;
  if (cornerRadius > 0) return true;

  // 3. Cropped image or cropped element (Fabric native cropX/cropY, isElementCropped)
  const isImg =
    obj instanceof FabricImage ||
    (obj as any).type === 'image' ||
    (obj as any).type === 'FabricImage';

  if (isObjectCropped(obj)) {
    return true;
  }

  // 4. Image with corner rounding clip or clipPath
  if (isImg && (Boolean(obj.clipPath) || cornerRadius > 0)) {
    return true;
  }

  // 5. Active visual stroke effects (outline, neon)
  if (
    obj._activeEffects?.outline ||
    obj._activeEffects?.neon
  ) {
    return true;
  }

  // 6. Any object with a clipPath
  if (obj.clipPath) {
    return true;
  }

  return false;
}

/**
 * Detects whether a Fabric object is cropped (image with cropX/cropY or shape/element with isElementCropped).
 */
export function isObjectCropped(obj: any): boolean {
  if (!obj) return false;

  if (
    obj.isGuide ||
    obj.isPrintGuide ||
    obj.isRulerGuide ||
    obj.isCropOverlayPhoto ||
    obj.isFoldGuideLine ||
    (obj as any).excludeFromVisualExport
  ) {
    return false;
  }

  if (
    (obj as any).isElementCropped === true ||
    (typeof obj.get === 'function' && obj.get('isElementCropped' as any) === true)
  ) {
    return true;
  }

  const isImg =
    obj instanceof FabricImage ||
    (obj as any).type === 'image' ||
    (obj as any).type === 'FabricImage';

  if (isImg) {
    if (typeof obj.hasCrop === 'function' && obj.hasCrop()) {
      return true;
    }
    const cropX = Number(obj.cropX ?? (typeof obj.get === 'function' ? obj.get('cropX' as any) : 0)) || 0;
    const cropY = Number(obj.cropY ?? (typeof obj.get === 'function' ? obj.get('cropY' as any) : 0)) || 0;
    if (cropX > 0 || cropY > 0) {
      return true;
    }
  }

  return false;
}

/**
 * PDF compatibility rasterizer for frames, rounded elements, and bordered shapes.
 *
 * SVG-to-PDFKit cannot reliably preserve SVG alpha-masks, clipped image paths, or
 * matrix-scaled `<rect rx="..." ry="..." stroke="...">` without deforming arcs or
 * losing corner radii.
 *
 * The Fabric canvas renders frames, rounded rects, and borders with 100% precision.
 * For PDF export, this function rasterizes ONLY those objects that require it to a
 * transparent high-resolution PNG (4x / 300+ DPI) and embeds them as SVG `<image>` nodes.
 *
 * Result:
 * - Rounded rects, shapes, and borders match on-screen canvas exactly without distortion
 * - Photos stay inside frames without bleeding or missing clips
 * - All plain vector shapes and clean vector fonts stay true vectors in PDF
 */
export async function rasterizeFramesForVectorPdf(
  svgDoc: Document,
  canvasManager: CanvasManager | null,
  options?: {
    preferredMultiplier?: number;
    maxLongEdgePx?: number;
  }
): Promise<number> {
  if (!canvasManager) return 0;

  const canvas = canvasManager.getCanvas();
  if (!canvas) return 0;

  const allObjects = collectFabricObjectsRecursively(canvas);

  const targetObjects = allObjects.filter((obj: any) => {
    return requiresRasterizationForVectorPdf(obj);
  });

  if (targetObjects.length === 0) {
    return 0;
  }

  // If a parent composite group (such as a frame) is already in targetObjects,
  // do not duplicate rasterization for its child parts.
  const filteredTargets = targetObjects.filter((obj: any) => {
    let p = obj.group;
    while (p) {
      if (targetObjects.includes(p)) {
        return false;
      }
      p = p.group;
    }
    return true;
  });

  const preferredMultiplier = Math.max(
    2,
    Math.min(6, options?.preferredMultiplier ?? 4)
  );

  const maxLongEdgePx = Math.max(
    1024,
    options?.maxLongEdgePx ?? 8192
  );

  let replacedCount = 0;

  for (const obj of filteredTargets as any[]) {
    const targetEl = findSvgElementForFabricObject(
      svgDoc,
      obj,
      allObjects
    );

    if (!targetEl) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[PDF Export] Could not locate SVG node for object:',
          obj.id || obj._svgExportId || obj.type
        );
      }
      continue;
    }

    // Skip if targetEl is already a rasterized image from a previous pass
    if (
      targetEl.getAttribute('data-pdf-rasterized') === 'true' ||
      targetEl.getAttribute('data-svg-cropped') === 'true' ||
      targetEl.querySelector?.('[data-pdf-rasterized="true"]') ||
      targetEl.querySelector?.('[data-svg-cropped="true"]')
    ) {
      continue;
    }

    const localWidth = Math.max(
      1,
      Number(obj.width) || 1
    );

    const localHeight = Math.max(
      1,
      Number(obj.height) || 1
    );

    const strokeWidth = Number(obj.strokeWidth) || 0;
    const sourceLongEdge = Math.max(
      localWidth + strokeWidth,
      localHeight + strokeWidth
    );

    const safeMultiplier = Math.max(
      1,
      Math.min(
        preferredMultiplier,
        maxLongEdgePx / sourceLongEdge
      )
    );

    try {
      let rasterCanvas: HTMLCanvasElement | null = null;

      const origGroup = obj.group;
      const origStrokeWidth = Number(obj.strokeWidth) || 0;
      const origBaseStrokeWidth = (obj as any).baseStrokeWidth;
      const objScaleX = Math.abs(Number(obj.scaleX) || 1);
      const objScaleY = Math.abs(Number(obj.scaleY) || 1);
      const avgScale = (objScaleX + objScaleY) / 2;

      try {
        obj.group = undefined;
        // In Fabric canvas, strokeUniform renders strokes at unscaled visual width on screen.
        // When rendered into an unscaled raster image and placed inside <g transform="matrix(scaleX...)">,
        // the group transform scales the image by avgScale. We divide strokeWidth by avgScale
        // so that (strokeWidth / avgScale) * avgScale equals the exact canvas stroke width in the PDF.
        if (origStrokeWidth > 0 && avgScale > 0.0001 && Math.abs(avgScale - 1) > 0.001) {
          obj.strokeWidth = origStrokeWidth / avgScale;
          if (typeof origBaseStrokeWidth === 'number') {
            (obj as any).baseStrokeWidth = origBaseStrokeWidth / avgScale;
          }
        }
        if (typeof obj.toCanvasElement === 'function') {
          rasterCanvas = obj.toCanvasElement({
            multiplier: safeMultiplier,
            withoutTransform: true,
            // Keep visual fill, stroke, and corner radius but avoid double-applying
            // shadow because shadow is handled by the dedicated high-res shadow layer.
            withoutShadow: true,
            enableRetinaScaling: false,
          } as any);
        }
      } finally {
        obj.strokeWidth = origStrokeWidth;
        if (typeof origBaseStrokeWidth === 'number') {
          (obj as any).baseStrokeWidth = origBaseStrokeWidth;
        }
        obj.group = origGroup;
      }

      if (!rasterCanvas) {
        continue;
      }

      const frameDataUrl = rasterCanvas.toDataURL(
        'image/png'
      );

      if (
        !frameDataUrl ||
        !frameDataUrl.startsWith('data:image/png')
      ) {
        continue;
      }

      // Calculate actual render dimensions from the raster canvas to ensure strokes and
      // padding are perfectly sized and centered without distortion or clipping.
      const renderWidth = rasterCanvas.width / safeMultiplier;
      const renderHeight = rasterCanvas.height / safeMultiplier;
      const x = -renderWidth / 2;
      const y = -renderHeight / 2;

      const imageEl = svgDoc.createElementNS(
        'http://www.w3.org/2000/svg',
        'image'
      );

      imageEl.setAttribute('x', `${x}`);
      imageEl.setAttribute('y', `${y}`);
      imageEl.setAttribute('width', `${renderWidth}`);
      imageEl.setAttribute('height', `${renderHeight}`);
      imageEl.setAttribute('preserveAspectRatio', 'none');
      imageEl.setAttribute('href', frameDataUrl);
      imageEl.setAttribute('xlink:href', frameDataUrl);
      imageEl.setAttribute('data-pdf-rasterized', 'true');

      // Remove any previously applied SVG stroke, clip-path, or mask from target
      targetEl.removeAttribute('clip-path');
      targetEl.removeAttribute('mask');
      targetEl.removeAttribute('stroke');
      targetEl.removeAttribute('stroke-width');
      targetEl.removeAttribute('paint-order');

      const existingStyle = targetEl.getAttribute('style');
      if (existingStyle) {
        const cleanedStyle = existingStyle
          .replace(/stroke\s*:[^;]+(;|\s*$)/gi, '')
          .replace(/stroke-width\s*:[^;]+(;|\s*$)/gi, '')
          .replace(/paint-order\s*:[^;]+(;|\s*$)/gi, '')
          .trim();
        if (cleanedStyle) {
          targetEl.setAttribute('style', cleanedStyle);
        } else {
          targetEl.removeAttribute('style');
        }
      }

      // Most Fabric objects export inside a <g transform="...">.
      // Replacing its visual children keeps the existing transform, rotation,
      // and position perfectly aligned.
      if (targetEl.tagName.toLowerCase() === 'g') {
        while (targetEl.firstChild) {
          targetEl.removeChild(targetEl.firstChild);
        }
        targetEl.appendChild(imageEl);
        replacedCount++;
      } else if (targetEl.parentNode) {
        // Defensive fallback for single non-group SVG elements (<rect>, <path>, <polygon>, etc.)
        const replacementGroup = svgDoc.createElementNS(
          'http://www.w3.org/2000/svg',
          'g'
        );

        const transform = targetEl.getAttribute('transform');
        if (transform) {
          replacementGroup.setAttribute('transform', transform);
        }

        const opacity = targetEl.getAttribute('opacity');
        if (opacity) {
          replacementGroup.setAttribute('opacity', opacity);
        }

        const filter = targetEl.getAttribute('filter');
        if (filter) {
          replacementGroup.setAttribute('filter', filter);
        }

        const id = targetEl.getAttribute('id');
        if (id) {
          replacementGroup.setAttribute('id', id);
        }

        const targetX = targetEl.getAttribute('x');
        const targetY = targetEl.getAttribute('y');
        if (targetX !== null && !transform) {
          imageEl.setAttribute('x', targetX);
        }
        if (targetY !== null && !transform) {
          imageEl.setAttribute('y', targetY);
        }

        replacementGroup.appendChild(imageEl);

        targetEl.parentNode.replaceChild(
          replacementGroup,
          targetEl
        );
        replacedCount++;
      }
    } catch (error) {
      console.warn(
        '[PDF Export] Failed to rasterize object for vector PDF:',
        error
      );
    }
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    replacedCount > 0
  ) {
    console.info(
      `[PDF Export] Rasterized ${replacedCount} object(s) ` +
      `with corner radius/borders for distortion-free vector PDF output.`
    );
  }

  return replacedCount;
}

// Alias for convenience
export const rasterizeElementsForVectorPdf = rasterizeFramesForVectorPdf;

/**
 * Ensures cropped images and cropped elements download properly in SVG and PDF formats.
 *
 * Fabric's native SVG export places cropped images inside a <g> with a local <clipPath>,
 * embedding the full uncropped source photo with negative offsets (x = -width/2 - cropX).
 * Many SVG viewers, graphic tools (Illustrator, Inkscape, Corel, Cricut), and laser cutters
 * fail to parse or preserve local <clipPath> inside <g>, causing the full uncropped photo
 * to appear or clip paths to get lost.
 *
 * This function:
 * 1. For cropped FabricImage objects: replaces the oversized photo and fragile <clipPath>
 *    with a high-resolution, self-contained cropped PNG image node with exact dimensions
 *    (x = -width/2, y = -height/2, width, height) and no clip-path dependency.
 * 2. For cropped vector elements / shapes: moves any <clipPath> defined inside <g> elements
 *    into <defs> with standardized IDs and proper scoping so all SVG renderers can locate
 *    and evaluate the clipping geometry correctly.
 */
export async function processCroppedElementsForSvgExport(
  svgDoc: Document,
  canvasManager: CanvasManager | null,
  options?: {
    preferredMultiplier?: number;
    maxLongEdgePx?: number;
  }
): Promise<number> {
  if (!canvasManager) return 0;
  const canvas = canvasManager.getCanvas();
  if (!canvas) return 0;

  const allObjects = collectFabricObjectsRecursively(canvas);
  let processedCount = 0;

  for (const obj of allObjects) {
    if (!obj || !isObjectCropped(obj)) continue;

    const targetEl = findSvgElementForFabricObject(svgDoc, obj, allObjects);
    if (!targetEl) continue;

    if (
      targetEl.getAttribute('data-svg-cropped') === 'true' ||
      targetEl.getAttribute('data-pdf-rasterized') === 'true' ||
      targetEl.querySelector?.('[data-svg-cropped="true"]') ||
      targetEl.querySelector?.('[data-pdf-rasterized="true"]')
    ) {
      continue;
    }

    const isImg =
      obj instanceof FabricImage ||
      (obj as any).type === 'image' ||
      (obj as any).type === 'FabricImage';

    if (typeof obj.toCanvasElement === 'function') {
      const localWidth = Math.max(1, Number(obj.width) || 1);
      const localHeight = Math.max(1, Number(obj.height) || 1);
      const strokeWidth = Number(obj.strokeWidth) || 0;
      const sourceLongEdge = Math.max(localWidth + strokeWidth, localHeight + strokeWidth);

      const natW = Number(obj._element?.naturalWidth || obj._element?.width || 0);
      const sourceDensity = natW > 0 && localWidth > 0 ? natW / localWidth : 4;
      const preferredMultiplier = Math.max(
        2,
        Math.min(6, options?.preferredMultiplier ?? Math.max(4, sourceDensity))
      );
      const maxLongEdgePx = Math.max(1024, options?.maxLongEdgePx ?? 8192);
      const safeMultiplier = Math.max(
        1,
        Math.min(preferredMultiplier, maxLongEdgePx / sourceLongEdge)
      );

      let rasterCanvas: HTMLCanvasElement | null = null;
      const origGroup = obj.group;
      const origStrokeWidth = Number(obj.strokeWidth) || 0;
      const origBaseStrokeWidth = (obj as any).baseStrokeWidth;
      const objScaleX = Math.abs(Number(obj.scaleX) || 1);
      const objScaleY = Math.abs(Number(obj.scaleY) || 1);
      const avgScale = (objScaleX + objScaleY) / 2;

      try {
        obj.group = undefined;
        if (origStrokeWidth > 0 && avgScale > 0.0001 && Math.abs(avgScale - 1) > 0.001) {
          obj.strokeWidth = origStrokeWidth / avgScale;
          if (typeof origBaseStrokeWidth === 'number') {
            (obj as any).baseStrokeWidth = origBaseStrokeWidth / avgScale;
          }
        }
        rasterCanvas = obj.toCanvasElement({
          multiplier: safeMultiplier,
          withoutTransform: true,
          withoutShadow: true,
          enableRetinaScaling: false,
        } as any);
      } catch (err) {
        console.warn('[SVG Export] Failed to render cropped canvas element:', err);
      } finally {
        obj.strokeWidth = origStrokeWidth;
        if (typeof origBaseStrokeWidth === 'number') {
          (obj as any).baseStrokeWidth = origBaseStrokeWidth;
        }
        obj.group = origGroup;
      }

      if (rasterCanvas) {
        const croppedDataUrl = rasterCanvas.toDataURL('image/png');
        if (croppedDataUrl && croppedDataUrl.startsWith('data:image/png')) {
          const renderWidth = rasterCanvas.width / safeMultiplier;
          const renderHeight = rasterCanvas.height / safeMultiplier;
          const x = -renderWidth / 2;
          const y = -renderHeight / 2;

          const imageEl = svgDoc.createElementNS(
            'http://www.w3.org/2000/svg',
            'image'
          );
          imageEl.setAttribute('x', `${x}`);
          imageEl.setAttribute('y', `${y}`);
          imageEl.setAttribute('width', `${renderWidth}`);
          imageEl.setAttribute('height', `${renderHeight}`);
          imageEl.setAttribute('preserveAspectRatio', 'none');
          imageEl.setAttribute('href', croppedDataUrl);
          imageEl.setAttribute('xlink:href', croppedDataUrl);
          imageEl.setAttribute('data-svg-cropped', 'true');
          imageEl.setAttribute('data-pdf-rasterized', 'true');

          targetEl.removeAttribute('clip-path');
          targetEl.removeAttribute('mask');
          targetEl.removeAttribute('stroke');
          targetEl.removeAttribute('stroke-width');
          targetEl.removeAttribute('paint-order');

          const existingStyle = targetEl.getAttribute('style');
          if (existingStyle) {
            const cleanedStyle = existingStyle
              .replace(/stroke\s*:[^;]+(;|\s*$)/gi, '')
              .replace(/stroke-width\s*:[^;]+(;|\s*$)/gi, '')
              .replace(/paint-order\s*:[^;]+(;|\s*$)/gi, '')
              .trim();
            if (cleanedStyle) {
              targetEl.setAttribute('style', cleanedStyle);
            } else {
              targetEl.removeAttribute('style');
            }
          }

          if (targetEl.tagName.toLowerCase() === 'g') {
            while (targetEl.firstChild) {
              targetEl.removeChild(targetEl.firstChild);
            }
            targetEl.appendChild(imageEl);
            processedCount++;
          } else if (targetEl.parentNode) {
            const replacementGroup = svgDoc.createElementNS(
              'http://www.w3.org/2000/svg',
              'g'
            );
            const transform = targetEl.getAttribute('transform');
            if (transform) replacementGroup.setAttribute('transform', transform);
            const id = targetEl.getAttribute('id');
            if (id) replacementGroup.setAttribute('id', id);
            const opacity = targetEl.getAttribute('opacity');
            if (opacity) replacementGroup.setAttribute('opacity', opacity);

            replacementGroup.appendChild(imageEl);
            targetEl.parentNode.replaceChild(replacementGroup, targetEl);
            processedCount++;
          }
        }
      }
    }
  }

  // Clean up any unreferenced imageCrop clipPaths
  const imageCropClipPaths = Array.from(svgDoc.querySelectorAll('clipPath[id^="imageCrop_"]'));
  for (const cp of imageCropClipPaths) {
    const id = cp.getAttribute('id');
    if (id && !svgDoc.querySelector(`[clip-path*="${id}"]`)) {
      cp.remove();
    }
  }

  return processedCount;
}

/**
 * Validates SVG export against active Fabric canvas objects.
 */
export function validateSvgExport(
  svgDoc: Document,
  canvasManager: CanvasManager | null
): { textOk: boolean; shadowOk: boolean; fabricTexts: number; svgTexts: number; fabricShadows: number; svgFilters: number } {
  if (!canvasManager) {
    return { textOk: true, shadowOk: true, fabricTexts: 0, svgTexts: 0, fabricShadows: 0, svgFilters: 0 };
  }
  const canvas = canvasManager.getCanvas();
  if (!canvas) {
    return { textOk: true, shadowOk: true, fabricTexts: 0, svgTexts: 0, fabricShadows: 0, svgFilters: 0 };
  }

  const allObjects = collectFabricObjectsRecursively(canvas);
  const canvasTexts = allObjects.filter(isFabricText);
  const svgTexts = svgDoc.querySelectorAll('text');

  const canvasShadows = allObjects.filter((o) => o.shadow && o.shadow.color && o.shadow.color !== 'transparent');
  const svgFilters = svgDoc.querySelectorAll('filter');

  const canvasFrames = allObjects.filter((o: any) =>
    Boolean(
      o?.get?.('isFrame' as any) ||
      o?.isFrame ||
      o?.isPhotoShapeGroup ||
      o?.isCustomFrame
    )
  );
  const svgFrameMasks = svgDoc.querySelectorAll(
    'mask[id^="export_alpha_mask_"], clipPath[id^="export_frame_clip_"]'
  );

  const textOk = canvasTexts.length === 0 || svgTexts.length > 0;
  const shadowOk = canvasShadows.length === 0 || svgFilters.length > 0;

  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[SVG Export Validation] Fabric texts: ${canvasTexts.length}, SVG text: ${svgTexts.length}; ` +
      `Fabric shadows: ${canvasShadows.length}, SVG filters: ${svgFilters.length}; ` +
      `Fabric frames: ${canvasFrames.length}, SVG frame masks: ${svgFrameMasks.length}`
    );
    if (!textOk) {
      console.warn('[SVG Export Validation] Notice: Fabric canvas contains text, but SVG output contains 0 text elements.');
    }
    if (!shadowOk) {
      console.warn('[SVG Export Validation] Notice: Fabric canvas contains shadows, but SVG output contains 0 filter definitions.');
    }
  }

  return {
    textOk,
    shadowOk,
    fabricTexts: canvasTexts.length,
    svgTexts: svgTexts.length,
    fabricShadows: canvasShadows.length,
    svgFilters: svgFilters.length,
  };
}

/**
 * Detects whether a Fabric text object has hollow fill, border, or stroke outline.
 * Any stroked or bordered text must be rasterized cleanly for PDF export to avoid
 * PDF text rendering Mode 2 contour overlap lines and inner lap glitches.
 */
export function isStrokedOrHollowText(obj: any): boolean {
  if (!isFabricText(obj)) return false;
  if (isHollowTextObject(obj)) return true;

  const stroke = obj.stroke;
  const strokeWidth = Number(obj.strokeWidth) || 0;
  const hasVisibleStroke =
    Boolean(stroke) &&
    stroke !== 'transparent' &&
    stroke !== 'none' &&
    stroke !== 'rgba(0,0,0,0)' &&
    strokeWidth > 0;

  return Boolean(
    hasVisibleStroke ||
    obj._activeEffects?.outline ||
    obj._activeEffects?.neon ||
    obj._isHollow ||
    obj.isHollow ||
    (Number(obj.baseStrokeWidth) || 0) > 0 ||
    (Number((obj as any).cornerRadius) || 0) > 0 ||
    (Number((obj as any)._requestedRadius) || 0) > 0 ||
    (Number((obj as any).rx) || 0) > 0
  );
}

/**
 * Rasterizes hollow or stroked/bordered text objects in exported SVG documents into high-resolution transparent PNG images.
 *
 * Why this is needed:
 * Native PDF renderers (such as SVG-to-PDFKit, PDFKit, and Adobe Acrobat) draw stroked text using PDF
 * text rendering Mode 2 (Fill, then Stroke), which draws the stroke centered on glyph contours.
 * This inevitable traces every internal contour of font glyphs (cutting through crossbars in 'A',
 * bowls in 'd' and 'b', arches in 'h', loops in 'g', and loops in 'e'), leaving ugly inner overlap lines,
 * holes, and dark blobs.
 *
 * By rasterizing stroked/bordered text using the canvas's clean destination-out and paintFirst renderer at
 * ultra-high resolution (4x / 300+ DPI) and embedding it as a lossless transparent PNG <image> element:
 * 1. The downloaded PDF matches the on-screen canvas 100% identically with crisp borders and clean centers.
 * 2. Inner contour overlap lines and crossbar intersections are completely eliminated.
 * 3. All other normal text objects remain genuine vector fonts.
 */
/**
 * Determines whether a Fabric text object requires faithful high-resolution rasterization
 * for PDF export.
 *
 * Text MUST be rendered faithfully when:
 * 1. It has hollow fill, border, stroke outline, or active stroke effects (to prevent PDF Mode 2 inner contour lines).
 * 2. It has non-zero charSpacing / letter-spacing (SVG-to-PDFKit completely drops CSS letter-spacing!).
 * 3. It has curved text on a path (SVG-to-PDFKit does not support <textPath>).
 * 4. It has gradient or pattern fills.
 * 5. It has non-zero corner radius.
 * 6. Its selected font cannot be guaranteed as an Acrobat-safe TTF/OTF vector in PDFKit
 *    (preventing Helvetica/Times fallback which alters font metrics, changes text width, and causes text clipping).
 */
export async function requiresFaithfulTextRasterization(
  obj: any,
  safeFamiliesCache?: Map<string, boolean>
): Promise<boolean> {
  if (!isFabricText(obj)) return false;

  // 1. Hollow or stroked text (PDF Mode 2 overlap prevention)
  if (isStrokedOrHollowText(obj)) return true;

  // 2. Letter spacing / charSpacing (SVGtoPDF drops letter-spacing!)
  if ((Number(obj.charSpacing) || 0) !== 0) return true;

  // 3. Text on a path / curved text (SVGtoPDF doesn't support textPath)
  if (Boolean(obj.path)) return true;

  // 4. Complex gradient / pattern fill
  if (typeof obj.fill === 'object' && obj.fill !== null) return true;

  // 5. Active outline or neon effects
  if (
    obj._activeEffects?.outline ||
    obj._activeEffects?.neon ||
    (Number(obj.baseStrokeWidth) || 0) > 0
  ) {
    return true;
  }

  // 6. Corner radius on text
  const cornerRadius =
    Number((obj as any).cornerRadius) ||
    Number((obj as any)._requestedRadius) ||
    Number((obj as any).rx) ||
    0;
  if (cornerRadius > 0) return true;

  // 7. Font availability: check if font can be safely embedded in PDFKit as genuine vector font
  const rawFamily = ((obj.fontFamily || '').split(',')[0] || '').trim().replace(/^['"]|['"]$/g, '');
  if (!rawFamily) return false;

  const weight = normalizeFontWeight(obj.fontWeight);
  const italic = String(obj.fontStyle || '').toLowerCase() === 'italic';
  const cacheKey = `${rawFamily.toLowerCase()}|${weight}|${italic ? 1 : 0}`;

  if (safeFamiliesCache?.has(cacheKey)) {
    return !safeFamiliesCache.get(cacheKey);
  }

  const isSafe = await isSafePdfFontFamily(rawFamily, weight, italic);
  safeFamiliesCache?.set(cacheKey, isSafe);

  // If NOT safe, text MUST be rendered faithfully so it doesn't fall back to Helvetica
  return !isSafe;
}

/**
 * Rasterizes hollow, stroked/bordered, or custom-font text objects in exported SVG documents
 * into high-resolution transparent PNG images (4x / 300+ DPI).
 *
 * Ensures:
 * 1. Stroked text never draws ugly PDF Mode 2 inner contour overlap lines.
 * 2. Unregistered or custom webfonts never silently fall back to Helvetica with distorted widths and clipping.
 * 3. Text letter-spacing, line breaks, colors, and exact bounds match the editor 100%.
 * 4. Text using standard or registered TTF vector fonts remains true crisp vectors.
 */
export async function rasterizeHollowTextForExport(
  svgDoc: Document,
  canvasManager: CanvasManager | null,
  options?: {
    preferredMultiplier?: number;
    maxLongEdgePx?: number;
  }
): Promise<number> {
  if (!canvasManager) return 0;
  const canvas = canvasManager.getCanvas();
  if (!canvas) return 0;

  // Ensure all fonts in document are ready before rendering text to canvas
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch { }
  }

  const allObjects = collectFabricObjectsRecursively(canvas);
  const safeFamiliesCache = new Map<string, boolean>();

  const targetTexts: any[] = [];
  for (const obj of allObjects) {
    if (await requiresFaithfulTextRasterization(obj, safeFamiliesCache)) {
      targetTexts.push(obj);
    }
  }

  if (targetTexts.length === 0) return 0;

  const preferredMultiplier = Math.max(2, Math.min(6, options?.preferredMultiplier ?? 4));
  const maxLongEdgePx = Math.max(1024, options?.maxLongEdgePx ?? 8192);

  let replacedCount = 0;

  for (const textObj of targetTexts) {
    const targetEl = findSvgElementForFabricObject(svgDoc, textObj, allObjects);
    if (!targetEl) continue;

    // Skip if targetEl is already a rasterized image from a previous pass
    if (
      targetEl.getAttribute('data-pdf-rasterized') === 'true' ||
      (targetEl.tagName.toLowerCase() === 'image' &&
        targetEl.getAttribute('href')?.startsWith('data:image/png'))
    ) {
      continue;
    }

    const localWidth = Math.max(1, Number(textObj.width) || 1);
    const localHeight = Math.max(1, Number(textObj.height) || 1);
    const strokeWidth = Number(textObj.strokeWidth) || 0;
    const sourceLongEdge = Math.max(localWidth + strokeWidth, localHeight + strokeWidth);

    const safeMultiplier = Math.max(
      1,
      Math.min(preferredMultiplier, maxLongEdgePx / sourceLongEdge)
    );

    let rasterCanvas: HTMLCanvasElement | null = null;
    const origGroup = textObj.group;
    const origStrokeWidth = Number(textObj.strokeWidth) || 0;
    const origBaseStrokeWidth = (textObj as any).baseStrokeWidth;
    const textScaleX = Math.abs(Number(textObj.scaleX) || 1);
    const textScaleY = Math.abs(Number(textObj.scaleY) || 1);
    const textAvgScale = (textScaleX + textScaleY) / 2;

    try {
      textObj.group = undefined;
      // Compensate text stroke width so scaling inside SVG group reproduces exact visual border weight
      if (origStrokeWidth > 0 && textAvgScale > 0.0001 && Math.abs(textAvgScale - 1) > 0.001) {
        textObj.strokeWidth = origStrokeWidth / textAvgScale;
        if (typeof origBaseStrokeWidth === 'number') {
          (textObj as any).baseStrokeWidth = origBaseStrokeWidth / textAvgScale;
        }
      }
      if (typeof textObj.toCanvasElement === 'function') {
        rasterCanvas = textObj.toCanvasElement({
          multiplier: safeMultiplier,
          withoutTransform: true,
          withoutShadow: true,
          enableRetinaScaling: false,
        } as any);
      }
    } finally {
      textObj.strokeWidth = origStrokeWidth;
      if (typeof origBaseStrokeWidth === 'number') {
        (textObj as any).baseStrokeWidth = origBaseStrokeWidth;
      }
      textObj.group = origGroup;
    }

    if (!rasterCanvas) continue;

    const dataUrl = rasterCanvas.toDataURL('image/png');
    if (!dataUrl || !dataUrl.startsWith('data:image/png')) continue;

    const renderWidth = rasterCanvas.width / safeMultiplier;
    const renderHeight = rasterCanvas.height / safeMultiplier;
    const x = -renderWidth / 2;
    const y = -renderHeight / 2;

    const imageEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
    imageEl.setAttribute('x', `${x}`);
    imageEl.setAttribute('y', `${y}`);
    imageEl.setAttribute('width', `${renderWidth}`);
    imageEl.setAttribute('height', `${renderHeight}`);
    imageEl.setAttribute('preserveAspectRatio', 'none');
    imageEl.setAttribute('href', dataUrl);
    imageEl.setAttribute('xlink:href', dataUrl);
    imageEl.setAttribute('data-pdf-rasterized', 'true');

    // Remove any previously applied SVG mask, clip-path, or stroke from parent/target
    targetEl.removeAttribute('mask');
    targetEl.removeAttribute('clip-path');
    targetEl.removeAttribute('stroke');
    targetEl.removeAttribute('stroke-width');
    targetEl.removeAttribute('paint-order');

    const existingStyle = targetEl.getAttribute('style');
    if (existingStyle) {
      const cleanedStyle = existingStyle
        .replace(/stroke\s*:[^;]+(;|\s*$)/gi, '')
        .replace(/stroke-width\s*:[^;]+(;|\s*$)/gi, '')
        .replace(/paint-order\s*:[^;]+(;|\s*$)/gi, '')
        .trim();
      if (cleanedStyle) {
        targetEl.setAttribute('style', cleanedStyle);
      } else {
        targetEl.removeAttribute('style');
      }
    }

    if (targetEl.tagName.toLowerCase() === 'g') {
      const textChildren = Array.from(targetEl.querySelectorAll('text'));
      textChildren.forEach((child) => child.remove());
      targetEl.appendChild(imageEl);
      replacedCount++;
    } else if (targetEl.parentNode) {
      const groupEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
      const transform = targetEl.getAttribute('transform');
      if (transform) groupEl.setAttribute('transform', transform);
      const filter = targetEl.getAttribute('filter');
      if (filter) groupEl.setAttribute('filter', filter);
      const style = targetEl.getAttribute('style');
      if (style) groupEl.setAttribute('style', style);
      const id = targetEl.getAttribute('id');
      if (id) groupEl.setAttribute('id', id);

      groupEl.appendChild(imageEl);
      targetEl.parentNode.replaceChild(groupEl, targetEl);
      replacedCount++;
    }
  }

  return replacedCount;
}

export const rasterizeFaithfulTextForExport = rasterizeHollowTextForExport;

/**
 * Ensures hollow text objects in exported SVG do not render internal contour overlap lines (inner laps).
 * Applies an SVG vector knockout mask that erases the glyph interior with solid black fill while passing
 * through the outer stroke in pure white.
 */
export function preserveHollowTextInSvg(
  svgDoc: Document,
  canvasManager: CanvasManager | null
): void {
  if (!canvasManager) return;
  const canvas = canvasManager.getCanvas();
  if (!canvas) return;

  const allObjects = collectFabricObjectsRecursively(canvas);
  const hollowTexts = allObjects.filter((obj: any) =>
    isFabricText(obj) && isHollowTextObject(obj)
  );

  if (hollowTexts.length === 0) return;

  let defs = svgDoc.querySelector('defs');
  if (!defs) {
    defs = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgDoc.documentElement.insertBefore(defs, svgDoc.documentElement.firstChild);
  }

  let counter = 0;
  for (const textObj of hollowTexts) {
    const targetEl = findSvgElementForFabricObject(svgDoc, textObj, allObjects);
    if (!targetEl) continue;

    // If targetEl already has an image replacement (from rasterizeHollowTextForExport), skip
    if (targetEl.querySelector('image[href^="data:image/png"]')) continue;

    const textEl =
      targetEl.tagName.toLowerCase() === 'text'
        ? targetEl
        : targetEl.querySelector('text');
    if (!textEl) continue;

    counter++;
    const maskId = `export_hollow_mask_${counter}`;
    const maskEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'mask');
    maskEl.setAttribute('id', maskId);
    maskEl.setAttribute('maskUnits', 'userSpaceOnUse');

    // White rect passes through all outer strokes
    const rect = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '-50000');
    rect.setAttribute('y', '-50000');
    rect.setAttribute('width', '100000');
    rect.setAttribute('height', '100000');
    rect.setAttribute('fill', 'white');
    maskEl.appendChild(rect);

    // Clone the text element to serve as the solid black knockout mask
    const cloneText = textEl.cloneNode(true) as Element;
    cloneText.removeAttribute('id');
    cloneText.removeAttribute('filter');
    cloneText.removeAttribute('mask');
    cloneText.setAttribute('fill', 'black');
    cloneText.setAttribute('stroke', 'none');
    cloneText.setAttribute('fill-opacity', '1');
    cloneText.setAttribute(
      'style',
      `${cloneText.getAttribute('style') || ''}; fill: black !important; fill-opacity: 1 !important; stroke: none !important;`
    );

    const tspans = Array.from(cloneText.querySelectorAll('tspan'));
    for (const tspan of tspans) {
      tspan.setAttribute('fill', 'black');
      tspan.setAttribute('stroke', 'none');
      tspan.setAttribute('fill-opacity', '1');
      tspan.setAttribute(
        'style',
        `${tspan.getAttribute('style') || ''}; fill: black !important; fill-opacity: 1 !important; stroke: none !important;`
      );
    }

    maskEl.appendChild(cloneText);
    defs.appendChild(maskEl);

    // Apply knockout mask to the stroked text element
    textEl.setAttribute('mask', `url(#${maskId})`);
  }
}

export type Matrix2D = [number, number, number, number, number, number];

export function identityMatrix(): Matrix2D {
  return [1, 0, 0, 1, 0, 0];
}

export function multiplyMatrix2D(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function parseSvgTransform(transformStr: string | null): Matrix2D {
  if (!transformStr || !transformStr.trim()) {
    return identityMatrix();
  }

  let result = identityMatrix();
  const fnRegex = /([a-zA-Z]+)\s*\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = fnRegex.exec(transformStr)) !== null) {
    const fn = match[1].toLowerCase();
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));

    let m: Matrix2D = identityMatrix();

    if (fn === 'matrix' && args.length >= 6) {
      m = [args[0], args[1], args[2], args[3], args[4], args[5]];
    } else if (fn === 'scale' && args.length >= 1) {
      const sx = args[0];
      const sy = args.length >= 2 ? args[1] : sx;
      m = [sx, 0, 0, sy, 0, 0];
    } else if (fn === 'translate' && args.length >= 1) {
      const tx = args[0];
      const ty = args.length >= 2 ? args[1] : 0;
      m = [1, 0, 0, 1, tx, ty];
    } else if (fn === 'rotate' && args.length >= 1) {
      const rad = (args[0] * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      if (args.length >= 3) {
        const cx = args[1];
        const cy = args[2];
        const t1: Matrix2D = [1, 0, 0, 1, cx, cy];
        const r: Matrix2D = [cos, sin, -sin, cos, 0, 0];
        const t2: Matrix2D = [1, 0, 0, 1, -cx, -cy];
        m = multiplyMatrix2D(multiplyMatrix2D(t1, r), t2);
      } else {
        m = [cos, sin, -sin, cos, 0, 0];
      }
    } else if (fn === 'skewx' && args.length >= 1) {
      const rad = (args[0] * Math.PI) / 180;
      m = [1, 0, Math.tan(rad), 1, 0, 0];
    } else if (fn === 'skewy' && args.length >= 1) {
      const rad = (args[0] * Math.PI) / 180;
      m = [1, Math.tan(rad), 0, 1, 0, 0];
    }

    result = multiplyMatrix2D(result, m);
  }

  return result;
}

export function getMatrixScale(m: Matrix2D): number {
  const scaleX = Math.hypot(m[0], m[1]);
  const scaleY = Math.hypot(m[2], m[3]);
  const avg = (scaleX + scaleY) / 2;
  return Number.isFinite(avg) && avg > 0.0001 ? avg : 1;
}

/**
 * Normalizes vector SVG stroke weights for PDF export.
 *
 * In Fabric canvas, objects render with `strokeUniform: true`, meaning their visual stroke
 * thickness on screen strictly equals `strokeWidth` canvas pixels regardless of object scaling.
 * When exported to SVG, Fabric emits `<g transform="matrix(...)">` around elements with
 * `vector-effect="non-scaling-stroke"`.
 *
 * SVGtoPDF (svg-to-pdfkit) does NOT support `vector-effect="non-scaling-stroke"`. It applies
 * the group transform directly to PDFKit's CTM, multiplying `lineWidth` by object scale.
 *
 * This function traverses the SVG DOM and divides stroke-width and stroke-dasharray
 * on transformed elements by their cumulative transform scale `s`. When SVGtoPDF applies
 * the group transform, `(strokeWidth / s) * s` yields exactly `strokeWidth` canvas pixels,
 * which scales with root viewBox `widthPt / canvasWidth` to PDF points, matching the editor
 * at every zoom level and document size.
 */
export function normalizeSvgStrokeWeightsForPdf(
  svgDoc: Document,
  _canvasManager?: CanvasManager | null
): void {
  const root = svgDoc.documentElement;
  if (!root) return;

  function traverse(element: Element, parentMatrix: Matrix2D): void {
    // Skip print marks, crop lines, guide overlays, background layers, shadow layers
    if (
      element.getAttribute('data-print-trim-line') === 'true' ||
      element.getAttribute('id') === 'export-visible-trim-marks' ||
      element.getAttribute('data-folding-guide-overlay') === 'true' ||
      element.getAttribute('data-pdf-background') === 'true' ||
      element.getAttribute('data-fabric-shadow-layer') === 'true'
    ) {
      return;
    }

    const tag = element.tagName.toLowerCase();
    if (tag === 'defs' || tag === 'clippath' || tag === 'mask') {
      return;
    }

    const localTransform = parseSvgTransform(element.getAttribute('transform'));
    const currentMatrix = multiplyMatrix2D(parentMatrix, localTransform);
    const currentScale = getMatrixScale(currentMatrix);

    const isAlreadyNormalized = element.getAttribute('data-pdf-stroke-normalized') === 'true';

    if (!isAlreadyNormalized) {
      const strokeAttr = element.getAttribute('stroke');
      const styleAttr = element.getAttribute('style') || '';
      const strokeInStyle = styleAttr.match(/stroke\s*:\s*([^;]+)/i);
      const effectiveStroke = (strokeAttr || (strokeInStyle ? strokeInStyle[1] : '')).trim();

      const isVisibleStroke =
        effectiveStroke &&
        effectiveStroke !== 'none' &&
        effectiveStroke !== 'transparent' &&
        effectiveStroke !== 'rgba(0,0,0,0)';

      if (isVisibleStroke && Math.abs(currentScale - 1) > 0.001) {
        // 1. Compensate stroke-width
        let rawWidth: number | null = null;
        const strokeWidthAttr = element.getAttribute('stroke-width');
        if (strokeWidthAttr && Number.isFinite(parseFloat(strokeWidthAttr))) {
          rawWidth = parseFloat(strokeWidthAttr);
        } else {
          const match = styleAttr.match(/stroke-width\s*:\s*([0-9.]+)/i);
          if (match) {
            rawWidth = parseFloat(match[1]);
          }
        }

        if (rawWidth !== null && rawWidth > 0) {
          const compensatedWidth = rawWidth / currentScale;

          if (element.hasAttribute('stroke-width')) {
            element.setAttribute('stroke-width', compensatedWidth.toFixed(4));
          }

          if (styleAttr && /stroke-width\s*:/i.test(styleAttr)) {
            const newStyle = styleAttr.replace(
              /stroke-width\s*:\s*[^;]+(;|\s*$)/gi,
              `stroke-width: ${compensatedWidth.toFixed(4)}$1`
            );
            element.setAttribute('style', newStyle);
          }

          element.setAttribute('data-pdf-stroke-normalized', 'true');
        }

        // 2. Compensate stroke-dasharray
        const dashAttr = element.getAttribute('stroke-dasharray');
        const dashInStyle = styleAttr.match(/stroke-dasharray\s*:\s*([^;]+)/i);
        const rawDash = dashAttr || (dashInStyle ? dashInStyle[1] : null);

        if (rawDash && rawDash !== 'none') {
          const numbers = rawDash
            .trim()
            .split(/[\s,]+/)
            .map(parseFloat)
            .filter((n) => Number.isFinite(n) && n > 0);

          if (numbers.length > 0) {
            const compensatedDashes = numbers.map((n) => (n / currentScale).toFixed(4)).join(' ');
            if (element.hasAttribute('stroke-dasharray')) {
              element.setAttribute('stroke-dasharray', compensatedDashes);
            }
            if (styleAttr && /stroke-dasharray\s*:/i.test(styleAttr)) {
              const currentStyle = element.getAttribute('style') || '';
              const newStyle = currentStyle.replace(
                /stroke-dasharray\s*:\s*[^;]+(;|\s*$)/gi,
                `stroke-dasharray: ${compensatedDashes}$1`
              );
              element.setAttribute('style', newStyle);
            }
          }
        }
      }
    }

    for (let i = 0; i < element.children.length; i++) {
      traverse(element.children[i], currentMatrix);
    }
  }

  traverse(root, identityMatrix());
}


