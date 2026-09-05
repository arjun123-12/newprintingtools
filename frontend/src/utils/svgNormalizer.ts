/**
 * Utility to normalize SVGs so they always render at their full, true dimensions
 * without getting clipped, squished to 300x150, or cut in half due to viewBox offsets.
 */

export function parseUnit(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) return null;
  const match = trimmed.match(/^([0-9.]+)\s*(px|pt|mm|cm|in|pc)?$/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (isNaN(num) || num <= 0) return null;
  const unit = (match[2] || 'px').toLowerCase();
  switch (unit) {
    case 'pt':
      return num * (96 / 72);
    case 'in':
      return num * 96;
    case 'mm':
      return num * (96 / 25.4);
    case 'cm':
      return num * (96 / 2.54);
    case 'pc':
      return num * 16;
    case 'px':
    default:
      return num;
  }
}

export function parseViewBox(viewBoxStr: string | null | undefined): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} | null {
  if (!viewBoxStr) return null;
  const parts = viewBoxStr.trim().split(/[\s,]+/).map(Number);
  if (
    parts.length === 4 &&
    parts.every((n) => !isNaN(n)) &&
    parts[2] > 0 &&
    parts[3] > 0
  ) {
    return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
  }
  return null;
}

export function normalizeSvgString(rawSvg: string): {
  normalizedSvg: string;
  width: number;
  height: number;
  dataUrl: string;
} {
  if (typeof window === 'undefined') {
    return {
      normalizedSvg: rawSvg,
      width: 800,
      height: 800,
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(rawSvg)}`,
    };
  }

  const parser = new DOMParser();
  let doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  let svg = doc.querySelector('svg');

  // Fallback for HTML-escaped or loose SVG strings
  if (!svg || doc.querySelector('parsererror')) {
    const htmlDoc = parser.parseFromString(rawSvg, 'text/html');
    svg = htmlDoc.querySelector('svg');
    if (svg) {
      doc = parser.parseFromString(svg.outerHTML, 'image/svg+xml');
      svg = doc.querySelector('svg');
    }
  }

  if (!svg) {
    return {
      normalizedSvg: rawSvg,
      width: 800,
      height: 800,
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(rawSvg)}`,
    };
  }

  // 1. Ensure XMLNS
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  // 2. Parse viewBox and attributes
  const vb = parseViewBox(svg.getAttribute('viewBox'));
  const attrW = parseUnit(svg.getAttribute('width'));
  const attrH = parseUnit(svg.getAttribute('height'));

  let finalW = 800;
  let finalH = 800;

  if (vb) {
    finalW = vb.width;
    finalH = vb.height;

    // If minX or minY are non-zero (especially negative), wrap children in a translation group
    // so nothing is clipped by browser <img> rasterizers
    if (vb.minX !== 0 || vb.minY !== 0) {
      const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${-vb.minX}, ${-vb.minY})`);

      while (svg.firstChild) {
        g.appendChild(svg.firstChild);
      }
      svg.appendChild(g);
    }

    svg.setAttribute('viewBox', `0 0 ${vb.width} ${vb.height}`);
  } else if (attrW && attrH) {
    finalW = attrW;
    finalH = attrH;
    svg.setAttribute('viewBox', `0 0 ${attrW} ${attrH}`);
  } else {
    svg.setAttribute('viewBox', '0 0 800 800');
  }

  // 3. For crisp high-DPI rendering in print editor:
  // If dimensions are smaller than 1200px, upscale pixel attributes while keeping viewBox
  const maxDim = Math.max(finalW, finalH);
  let pixelW = Math.round(finalW);
  let pixelH = Math.round(finalH);

  if (maxDim > 0 && maxDim < 1200) {
    const scaleFactor = Math.min(Math.ceil(1200 / maxDim), 4);
    pixelW = Math.round(finalW * scaleFactor);
    pixelH = Math.round(finalH * scaleFactor);
  }

  svg.setAttribute('width', String(pixelW));
  svg.setAttribute('height', String(pixelH));
  svg.setAttribute('overflow', 'visible');

  // Preserve aspect ratio default
  if (!svg.getAttribute('preserveAspectRatio')) {
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  const serializer = new XMLSerializer();
  const normalizedSvg = serializer.serializeToString(doc);

  // Convert to base64 Data URL for universal compatibility with Fabric and browser Image
  let dataUrl: string;
  try {
    const base64 = btoa(
      encodeURIComponent(normalizedSvg).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
    dataUrl = `data:image/svg+xml;base64,${base64}`;
  } catch {
    dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalizedSvg)}`;
  }

  return {
    normalizedSvg,
    width: pixelW,
    height: pixelH,
    dataUrl,
  };
}

export function normalizeSvgDataUrl(dataUrl: string): {
  normalizedSvg: string;
  width: number;
  height: number;
  dataUrl: string;
} {
  try {
    let svgText = '';
    if (dataUrl.includes('base64,')) {
      const base64Part = dataUrl.split('base64,')[1];
      svgText = decodeURIComponent(
        Array.prototype.map
          .call(atob(base64Part), (c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
    } else {
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx !== -1) {
        svgText = decodeURIComponent(dataUrl.slice(commaIdx + 1));
      } else {
        svgText = dataUrl;
      }
    }
    return normalizeSvgString(svgText);
  } catch (err) {
    console.warn('Failed to parse SVG data URL, returning original:', err);
    return {
      normalizedSvg: '',
      width: 800,
      height: 800,
      dataUrl,
    };
  }
}

export async function normalizeSvgFile(file: File): Promise<{
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}> {
  const text = await file.text();
  const { normalizedSvg, width, height, dataUrl } = normalizeSvgString(text);
  const blob = new Blob([normalizedSvg], { type: 'image/svg+xml' });
  const normalizedFile = new File([blob], file.name, {
    type: 'image/svg+xml',
    lastModified: Date.now(),
  });
  return {
    file: normalizedFile,
    dataUrl,
    width,
    height,
  };
}

export async function normalizeSvgUrl(
  url: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (url.startsWith('data:image/svg+xml')) {
    const res = normalizeSvgDataUrl(url);
    return { dataUrl: res.dataUrl, width: res.width, height: res.height };
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const res = normalizeSvgString(text);
    return { dataUrl: res.dataUrl, width: res.width, height: res.height };
  } catch (err) {
    console.warn('Failed to fetch and normalize SVG URL:', err);
    return { dataUrl: url, width: 800, height: 800 };
  }
}

export function isSvg(input?: string | null): boolean {
  if (!input) return false;
  const s = input.trim().toLowerCase();
  return (
    s.startsWith('data:image/svg+xml') ||
    s.endsWith('.svg') ||
    s.includes('.svg?') ||
    s.includes('image/svg+xml') ||
    s.startsWith('<svg')
  );
}
