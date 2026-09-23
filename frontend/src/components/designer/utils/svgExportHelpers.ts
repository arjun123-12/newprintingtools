import { CanvasManager } from '../canvas/CanvasManager';
import {
  getObjectVisualSilhouette,
  requiresSilhouetteShadow,
  getEffectiveCornerRadius,
} from '../canvas/visualGeometry';

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
 * Fetches Google Font CSS and downloads the font binary, converting to base64 @font-face rule.
 */
async function fetchAndCreateFontFace(
  family: string,
  weight: number,
  italic: boolean
): Promise<string | null> {
  const cacheKey = `${family.toLowerCase()}|${weight}|${italic ? 1 : 0}`;
  if (fontDataUrlCache.has(cacheKey)) {
    const cached = fontDataUrlCache.get(cacheKey)!;
    return `@font-face {\n  font-family: '${family}';\n  font-style: ${italic ? 'italic' : 'normal'
      };\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('${cached}') format('woff2');\n}`;
  }

  if (typeof fetch === 'undefined') return null;

  const escapedFamily = encodeURIComponent(family).replace(/%20/g, '+');
  const cssUrl = `https://fonts.googleapis.com/css2?family=${escapedFamily}:ital,wght@${italic ? 1 : 0
    },${weight}&display=swap`;

  const cssResp = await fetch(cssUrl, {
    mode: 'cors',
    cache: 'force-cache',
  });
  if (!cssResp.ok) return null;

  const cssText = await cssResp.text();
  const urlMatch = cssText.match(/src\s*:\s*[^;]*url\((['"]?)(https?:\/\/[^)'"]+)\1\)(?:\s*format\((['"]?)([^)'"]+)\3\))?/i);
  if (!urlMatch || !urlMatch[2]) return null;

  const fontBinaryUrl = urlMatch[2];
  const format = urlMatch[4] || 'woff2';

  const fontResp = await fetch(fontBinaryUrl, {
    mode: 'cors',
    cache: 'force-cache',
  });
  if (!fontResp.ok) return null;

  const buffer = new Uint8Array(await fontResp.arrayBuffer());
  if (buffer.length < 10) return null;

  const base64 = uint8ArrayToBase64(buffer);
  const dataUrl = `data:font/${format};charset=utf-8;base64,${base64}`;
  fontDataUrlCache.set(cacheKey, dataUrl);

  return `@font-face {\n  font-family: '${family}';\n  font-style: ${italic ? 'italic' : 'normal'
    };\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('${dataUrl}') format('${format}');\n}`;
}

/**
 * Ensures all fonts used in text objects (including nested groups and composite elements)
 * are embedded as real base64 @font-face rules directly in the SVG <defs><style>.
 * Text elements remain 100% genuine vector elements.
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
  return { color: cssColor, opacity: 1 };
}


/**
 * Finds the SVG element corresponding to a Fabric object.
 * Fabric does not always serialize custom object IDs as SVG id attributes,
 * so this first tries explicit IDs and then safely falls back to top-level order.
 */
function findSvgElementForFabricObject(
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

  // Only use top-level visual objects for order fallback. Nested children have
  // their own group-relative SVG structure and must not shift this index.
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
  const candidates = Array.from(root.children).filter((element) => {
    const tag = element.tagName.toLowerCase();
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
    if (!requiresSilhouetteShadow(obj)) continue;

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

    const isImg =
      obj.type === 'image' ||
      obj.type === 'fabricImage' ||
      obj.type === 'FabricImage';

    const isFrame =
      Boolean((obj as any).isFrame) ||
      Boolean((obj as any).isPhotoShapeGroup) ||
      Boolean((obj as any).isCustomFrame);

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

        // Insert as first child of frame group so it's behind photo and outline
        targetEl.insertBefore(shadowShape, targetEl.firstChild);
      } else {
        // Fallback: apply filter to target frame group
        targetEl.setAttribute('filter', `url(#${filterId})`);
      }
    }
  }
}


/**
 * PDF-only compatibility fallback for complex photo frames.
 *
 * svg2pdf.js does not reliably preserve every SVG alpha-mask / image clip-path
 * combination. The Fabric canvas itself already renders the frame correctly,
 * so for PDF only we rasterize EACH FRAME OBJECT (not the whole artwork) to a
 * transparent PNG and replace only that frame's SVG group.
 *
 * Result:
 * - photo stays inside heart/circle/custom frame exactly as seen on canvas
 * - frame overlay/border is preserved
 * - all text and non-frame shapes elsewhere stay true vectors in PDF
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

  const topLevelFrames = canvas.getObjects().filter((obj: any) => {
    if (!obj) return false;

    return Boolean(
      obj.get?.('isFrame' as any) ||
      obj.isFrame ||
      obj.isPhotoShapeGroup ||
      obj.isCustomFrame
    );
  });

  if (topLevelFrames.length === 0) {
    return 0;
  }

  const preferredMultiplier = Math.max(
    1,
    Math.min(4, options?.preferredMultiplier ?? 2)
  );

  const maxLongEdgePx = Math.max(
    1024,
    options?.maxLongEdgePx ?? 4096
  );

  let replacedCount = 0;

  for (const frame of topLevelFrames as any[]) {
    const targetEl = findSvgElementForFabricObject(
      svgDoc,
      frame,
      allObjects
    );

    if (!targetEl) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[PDF Export] Could not locate SVG node for frame:',
          frame.id || frame._svgExportId || frame.type
        );
      }
      continue;
    }

    const localWidth = Math.max(
      1,
      Number(frame.width) || 1
    );

    const localHeight = Math.max(
      1,
      Number(frame.height) || 1
    );

    // The SVG group's transform already contains scale/rotation/position.
    // We therefore rasterize in the frame's LOCAL coordinate system.
    const sourceLongEdge = Math.max(
      localWidth,
      localHeight
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

      if (typeof frame.toCanvasElement === 'function') {
        rasterCanvas = frame.toCanvasElement({
          multiplier: safeMultiplier,
          withoutTransform: true,
          // Keep visual frame/photo result but avoid double-applying object
          // shadow after the SVG node is replaced.
          withoutShadow: true,
          enableRetinaScaling: false,
        } as any);
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

      const imageEl = svgDoc.createElementNS(
        'http://www.w3.org/2000/svg',
        'image'
      );

      imageEl.setAttribute(
        'x',
        `${-localWidth / 2}`
      );
      imageEl.setAttribute(
        'y',
        `${-localHeight / 2}`
      );
      imageEl.setAttribute(
        'width',
        `${localWidth}`
      );
      imageEl.setAttribute(
        'height',
        `${localHeight}`
      );
      imageEl.setAttribute(
        'preserveAspectRatio',
        'none'
      );
      imageEl.setAttribute(
        'href',
        frameDataUrl
      );

      // Most Fabric frame objects export as a <g>. Keeping the existing group
      // is ideal because its transform already positions/scales/rotates the
      // frame correctly. Replace only its visual children.
      if (
        targetEl.tagName.toLowerCase() === 'g'
      ) {
        while (targetEl.firstChild) {
          targetEl.removeChild(targetEl.firstChild);
        }

        // The raster already contains the clipping silhouette.
        targetEl.removeAttribute('clip-path');
        targetEl.removeAttribute('mask');

        targetEl.appendChild(imageEl);
      } else {
        // Defensive fallback for non-group frame serialization.
        const replacementGroup =
          svgDoc.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
          );

        const transform =
          targetEl.getAttribute('transform');

        if (transform) {
          replacementGroup.setAttribute(
            'transform',
            transform
          );
        }

        const opacity =
          targetEl.getAttribute('opacity');

        if (opacity) {
          replacementGroup.setAttribute(
            'opacity',
            opacity
          );
        }

        replacementGroup.appendChild(imageEl);

        targetEl.parentNode?.replaceChild(
          replacementGroup,
          targetEl
        );
      }

      replacedCount++;
    } catch (error) {
      console.warn(
        '[PDF Export] Failed to rasterize framed photo:',
        error
      );
    }
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    replacedCount > 0
  ) {
    console.info(
      `[PDF Export] Rasterized ${replacedCount} frame object(s) ` +
      `for mask-safe vector PDF output.`
    );
  }

  return replacedCount;
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
