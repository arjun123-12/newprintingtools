import {
  FabricObject,
  FabricImage,
  Rect,
  Circle,
  Triangle,
  Polygon,
  Path,
  Group,
} from 'fabric';

export interface Point2D {
  x: number;
  y: number;
}

export interface EffectiveCornerRadius {
  rx: number;
  ry: number;
  effectiveScreenRadius: number;
  maxRadius: number;
}

export const STAR_POINTS: Point2D[] = [
  { x: 0, y: -90 },
  { x: 26, y: -26 },
  { x: 95, y: -26 },
  { x: 38, y: 15 },
  { x: 60, y: 83 },
  { x: 0, y: 41 },
  { x: -60, y: 83 },
  { x: -38, y: 15 },
  { x: -95, y: -26 },
  { x: -26, y: -26 },
];

export function getHexagonPoints(radius: number): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push({
      x: Number((radius * Math.cos(angle)).toFixed(2)),
      y: Number((radius * Math.sin(angle)).toFixed(2)),
    });
  }
  return points;
}

export function getTrianglePoints(width: number, height: number): Point2D[] {
  return [
    { x: 0, y: Number((-height / 2).toFixed(2)) },
    { x: Number((width / 2).toFixed(2)), y: Number((height / 2).toFixed(2)) },
    { x: Number((-width / 2).toFixed(2)), y: Number((height / 2).toFixed(2)) },
  ];
}

/**
 * Cleans polygon vertices by:
 * 1. Removing consecutive duplicate points (dist < 0.1px).
 * 2. Removing closing duplicate point (dist(last, first) < 0.1px) that standard SVGs contain before 'Z'.
 * 3. Removing redundant collinear points along straight lines so all real corners round smoothly.
 */
export function cleanPoints(rawPoints: Point2D[]): Point2D[] {
  if (!rawPoints || rawPoints.length < 3) return [];
  const pts: Point2D[] = [];

  for (let i = 0; i < rawPoints.length; i++) {
    const p = rawPoints[i];
    if (pts.length === 0) {
      pts.push({ x: Number(p.x) || 0, y: Number(p.y) || 0 });
    } else {
      const prev = pts[pts.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) > 0.1) {
        pts.push({ x: Number(p.x) || 0, y: Number(p.y) || 0 });
      }
    }
  }

  // Remove closing duplicate point if same as first
  while (pts.length > 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(last.x - first.x, last.y - first.y) <= 0.1) {
      pts.pop();
    } else {
      break;
    }
  }

  // Remove redundant collinear points
  let changed = true;
  while (changed && pts.length > 2) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];

      const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
      const v2 = { x: next.x - curr.x, y: next.y - curr.y };
      const len1 = Math.hypot(v1.x, v1.y);
      const len2 = Math.hypot(v2.x, v2.y);
      if (len1 < 0.1 || len2 < 0.1) continue;

      const cross = (v1.x * v2.y - v1.y * v2.x) / (len1 * len2);
      const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);

      // Collinear if cross product ~ 0 and dot product ~ -1 (opposite vectors = straight edge)
      if (Math.abs(cross) < 1e-3 && dot < -0.999) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  return pts;
}

/**
 * Draws an exact, cross-browser, PDF-safe rounded rectangle path using cubic Bezier curves
 * or native ctx.roundRect where supported.
 */
export function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  ry: number
): void {
  const effectiveRx = Math.max(0, Math.min(rx, w / 2));
  const effectiveRy = Math.max(0, Math.min(ry, h / 2));

  if (typeof (ctx as any).roundRect === 'function') {
    ctx.beginPath();
    (ctx as any).roundRect(x, y, w, h, [effectiveRx, effectiveRy]);
    ctx.closePath();
    return;
  }

  const isRounded = effectiveRx > 0 || effectiveRy > 0;
  const kRect = 1 - 0.5522847498; // Bezier control point constant (0.44771525)

  ctx.beginPath();
  ctx.moveTo(x + effectiveRx, y);
  ctx.lineTo(x + w - effectiveRx, y);
  if (isRounded) {
    ctx.bezierCurveTo(
      x + w - kRect * effectiveRx,
      y,
      x + w,
      y + kRect * effectiveRy,
      x + w,
      y + effectiveRy
    );
  }
  ctx.lineTo(x + w, y + h - effectiveRy);
  if (isRounded) {
    ctx.bezierCurveTo(
      x + w,
      y + h - kRect * effectiveRy,
      x + w - kRect * effectiveRx,
      y + h,
      x + w - effectiveRx,
      y + h
    );
  }
  ctx.lineTo(x + effectiveRx, y + h);
  if (isRounded) {
    ctx.bezierCurveTo(
      x + kRect * effectiveRx,
      y + h,
      x,
      y + h - kRect * effectiveRy,
      x,
      y + h - effectiveRy
    );
  }
  ctx.lineTo(x, y + effectiveRy);
  if (isRounded) {
    ctx.bezierCurveTo(
      x,
      y + kRect * effectiveRy,
      x + kRect * effectiveRx,
      y,
      x + effectiveRx,
      y
    );
  }
  ctx.closePath();
}

/**
 * Generates an SVG path string from a closed set of 2D polygon vertices
 * with exact quadratic Bezier curves for every rounded corner.
 */
export function createRoundedPolygonPath(rawPoints: Point2D[], radius: number): string {
  const points = cleanPoints(rawPoints);
  const n = points.length;
  if (n < 3) return '';
  if (radius <= 0) {
    return (
      'M ' +
      points[0].x.toFixed(2) +
      ' ' +
      points[0].y.toFixed(2) +
      ' ' +
      points
        .slice(1)
        .map((p) => 'L ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2))
        .join(' ') +
      ' Z'
    );
  }

  const corners: Array<{
    start: Point2D;
    end: Point2D;
    vertex: Point2D;
    isCorner: boolean;
  }> = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };

    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);

    if (len1 < 1e-4 || len2 < 1e-4) {
      corners.push({ start: curr, end: curr, vertex: curr, isCorner: false });
      continue;
    }

    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const u2 = { x: v2.x / len2, y: v2.y / len2 };

    const dot = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
    const angle = Math.acos(dot);

    // Skip collinear points (180 deg) or extreme spikes (0 deg)
    if (angle < 0.01 || Math.PI - angle < 0.01) {
      corners.push({ start: curr, end: curr, vertex: curr, isCorner: false });
      continue;
    }

    const tanHalf = Math.tan(angle / 2);
    // Clamp tangent distance to at most 48% of adjacent edge length
    const maxT = Math.min(len1, len2) * 0.48;
    const t = Math.min(radius / tanHalf, maxT);

    const start = { x: curr.x + u1.x * t, y: curr.y + u1.y * t };
    const end = { x: curr.x + u2.x * t, y: curr.y + u2.y * t };

    corners.push({ start, end, vertex: curr, isCorner: true });
  }

  let d = 'M ' + corners[0].end.x.toFixed(2) + ' ' + corners[0].end.y.toFixed(2);

  for (let i = 1; i < n; i++) {
    const c = corners[i];
    d += ' L ' + c.start.x.toFixed(2) + ' ' + c.start.y.toFixed(2);
    if (c.isCorner) {
      d +=
        ' Q ' +
        c.vertex.x.toFixed(2) +
        ' ' +
        c.vertex.y.toFixed(2) +
        ' ' +
        c.end.x.toFixed(2) +
        ' ' +
        c.end.y.toFixed(2);
    }
  }

  const c0 = corners[0];
  d += ' L ' + c0.start.x.toFixed(2) + ' ' + c0.start.y.toFixed(2);
  if (c0.isCorner) {
    d +=
      ' Q ' +
      c0.vertex.x.toFixed(2) +
      ' ' +
      c0.vertex.y.toFixed(2) +
      ' ' +
      c0.end.x.toFixed(2) +
      ' ' +
      c0.end.y.toFixed(2);
  }
  d += ' Z';

  return d;
}

/**
 * Extracts canonical original points from an object.
 */
export function extractPolygonPoints(object: FabricObject): {
  points: Point2D[];
  shapeType: string;
} | null {
  if (!object) return null;

  if (
    (object as any).originalShapePoints &&
    Array.isArray((object as any).originalShapePoints) &&
    (object as any).originalShapePoints.length >= 3
  ) {
    const cleaned = cleanPoints((object as any).originalShapePoints);
    if (cleaned.length >= 3) {
      return {
        points: cleaned,
        shapeType:
          (object as any).originalShapeType ||
          (object as any).shapeType ||
          object.type ||
          'polygon',
      };
    }
  }

  if (
    object instanceof Triangle ||
    (object as any).type === 'triangle' ||
    (object as any).shapeType === 'triangle'
  ) {
    const w = object.width || 180;
    const h = object.height || 160;
    return {
      points: cleanPoints(getTrianglePoints(w, h)),
      shapeType: 'triangle',
    };
  }

  if ((object as any).shapeType === 'star') {
    return {
      points: cleanPoints(STAR_POINTS.map((p) => ({ ...p }))),
      shapeType: 'star',
    };
  }

  if ((object as any).shapeType === 'hexagon') {
    const r = (object.width || 180) / 2;
    return {
      points: cleanPoints(getHexagonPoints(r)),
      shapeType: 'hexagon',
    };
  }

  if (object instanceof Polygon || (object as any).type === 'polygon') {
    const pts: any[] = (object as any).points || [];
    if (pts.length >= 3) {
      const offset = (object as any).pathOffset || { x: 0, y: 0 };
      const raw = pts.map((p) => ({ x: p.x - offset.x, y: p.y - offset.y }));
      const cleaned = cleanPoints(raw);
      if (cleaned.length >= 3) {
        return {
          points: cleaned,
          shapeType: (object as any).shapeType || 'polygon',
        };
      }
    }
  }

  if (object instanceof Path || (object as any).type === 'path') {
    const pathCommands: any[] = (object as any).path;
    if (Array.isArray(pathCommands) && pathCommands.length >= 3) {
      const isStraight = pathCommands.every(
        (cmd) => cmd[0] === 'M' || cmd[0] === 'L' || cmd[0] === 'Z' || cmd[0] === 'z'
      );
      if (isStraight) {
        const pts: Point2D[] = [];
        const offset = (object as any).pathOffset || { x: 0, y: 0 };
        for (const cmd of pathCommands) {
          if (cmd[0] === 'M' || cmd[0] === 'L') {
            pts.push({ x: cmd[1] - offset.x, y: cmd[2] - offset.y });
          }
        }
        const cleaned = cleanPoints(pts);
        if (cleaned.length >= 3) {
          return {
            points: cleaned,
            shapeType: (object as any).shapeType || 'polygon',
          };
        }
      }
    }
  }

  return null;
}

/**
 * Calculates the mathematically clamped, scale-aware corner radius for an object.
 * Reads from the same single geometry source whether rendering on canvas or casting shadow.
 */
export function getEffectiveCornerRadius(
  object: FabricObject,
  explicitRadius?: number
): EffectiveCornerRadius {
  const width = Math.max(object.width || 0, 1);
  const height = Math.max(object.height || 0, 1);
  const scaleX = Math.max(Math.abs(object.scaleX || 1), 0.0001);
  const scaleY = Math.max(Math.abs(object.scaleY || 1), 0.0001);

  const renderedW = width * scaleX;
  const renderedH = height * scaleY;
  const maxRadius = Math.min(renderedW, renderedH) / 2;

  let requested = 0;
  if (typeof explicitRadius === 'number') {
    requested = explicitRadius;
  } else if (typeof (object as any).cornerRadius === 'number') {
    requested = (object as any).cornerRadius;
  } else if (typeof (object as any)._requestedRadius === 'number') {
    requested = (object as any)._requestedRadius;
  } else {
    requested = Math.max(0, Number((object as any).rx) || Number((object as any).ry) || 0);
  }

  (object as any).cornerRadius = requested;
  (object as any)._requestedRadius = requested;

  const effectiveScreenRadius = Math.max(0, Math.min(requested, maxRadius));

  return {
    rx: effectiveScreenRadius / scaleX,
    ry: effectiveScreenRadius / scaleY,
    effectiveScreenRadius,
    maxRadius,
  };
}

/**
 * Synchronizes object corner geometry (clipping and local rx/ry).
 * Keeps effective rounding clamped during scaling and slider updates in real time.
 */
export function syncObjectCornerGeometry(object: FabricObject): void {
  if (!object) return;

  const isImg =
    object instanceof FabricImage ||
    (object as any).type === 'image' ||
    (object as any).type === 'FabricImage';

  const isRect =
    object instanceof Rect ||
    (object as any).type === 'rect';

  if (isImg) {
    const rawRx =
      typeof (object as any).cornerRadius === 'number'
        ? (object as any).cornerRadius
        : typeof (object as any)._requestedRadius === 'number'
          ? (object as any)._requestedRadius
          : (Number((object as any).rx) || 0);

    (object as any).cornerRadius = rawRx;
    (object as any)._requestedRadius = rawRx;

    if (rawRx > 0) {
      const { rx: localRx, ry: localRy, effectiveScreenRadius } = getEffectiveCornerRadius(object, rawRx);
      (object as any).rx = effectiveScreenRadius;
      (object as any).ry = effectiveScreenRadius;

      const w = Math.max(object.width || 1, 1);
      const h = Math.max(object.height || 1, 1);

      if (!object.clipPath || !(object.clipPath instanceof Rect) || !(object.clipPath as any).isCornerRoundingClip) {
        const clipRect = new Rect({
          width: w,
          height: h,
          rx: localRx,
          ry: localRy,
          originX: 'center',
          originY: 'center',
          objectCaching: false,
          stroke: 'transparent',
          strokeWidth: 0,
        });
        (clipRect as any).isCornerRoundingClip = true;
        object.clipPath = clipRect;
      } else {
        (object.clipPath as Rect).set({
          width: w,
          height: h,
          rx: localRx,
          ry: localRy,
          originX: 'center',
          originY: 'center',
          stroke: 'transparent',
          strokeWidth: 0,
        });
      }
      object.clipPath.set('dirty', true);
      object.clipPath.setCoords();
    } else {
      (object as any).rx = 0;
      (object as any).ry = 0;
      if (object.clipPath && (object.clipPath as any).isCornerRoundingClip) {
        object.clipPath = undefined;
      }
    }
    object.set('dirty', true);
    object.group?.set('dirty', true);
  } else if (isRect) {
    const rawRx =
      typeof (object as any).cornerRadius === 'number'
        ? (object as any).cornerRadius
        : typeof (object as any)._requestedRadius === 'number'
          ? (object as any)._requestedRadius
          : (Number((object as any).rx) || 0);

    (object as any).cornerRadius = rawRx;
    (object as any)._requestedRadius = rawRx;

    const { rx: localRx, ry: localRy, effectiveScreenRadius } = getEffectiveCornerRadius(object, rawRx);
    (object as any).rx = effectiveScreenRadius;
    (object as any).ry = effectiveScreenRadius;
    (object as Rect).set({
      rx: localRx,
      ry: localRy,
    });
    object.set('dirty', true);
  }
}

/**
 * Applies corner radius to an object, handling Rect, FabricImage,
 * Polygon, Triangle, Hexagon, Star, Frames, and Groups.
 */
export function applyCornerRadiusToObject(
  object: FabricObject,
  radius: number,
  canvas?: any
): FabricObject {
  if (!object) return object;
  const clampedRadius = Math.max(0, Number(radius) || 0);

  // A. ActiveSelection
  if (
    (object as any).type === 'activeSelection' &&
    typeof (object as any).getObjects === 'function'
  ) {
    const children: FabricObject[] = (object as any).getObjects();
    for (const child of children) {
      applyCornerRadiusToObject(child, clampedRadius, canvas);
    }
    (object as any).cornerRadius = clampedRadius;
    (object as any)._requestedRadius = clampedRadius;
    object.set('dirty', true);
    return object;
  }

  // B. Frame Group (photoShapeGroup or customFrameGroup)
  const isFrame =
    Boolean(object.get?.('isFrame' as any)) ||
    Boolean((object as any).isFrame) ||
    Boolean((object as any).isPhotoShapeGroup) ||
    Boolean((object as any).isCustomFrame);

  if (isFrame && typeof (object as any).getObjects === 'function') {
    const children: FabricObject[] = (object as any).getObjects();
    const shapeOutline = children.find(
      (o) => (o as any).frameRole === 'shape-outline'
    );
    const photo = children.find(
      (o) => (o as any).frameRole === 'photo'
    ) as FabricImage | undefined;

    // If rectangular frame: round the outline & the photo's clipPath
    if (
      shapeOutline &&
      (shapeOutline instanceof Rect ||
        (shapeOutline as any).type === 'rect' ||
        (object as any).frameShape === 'rect')
    ) {
      const { rx: localRx, ry: localRy } = getEffectiveCornerRadius(
        shapeOutline,
        clampedRadius
      );
      (shapeOutline as any).rx = localRx;
      (shapeOutline as any).ry = localRy;
      (shapeOutline as any).cornerRadius = clampedRadius;
      (shapeOutline as any)._requestedRadius = clampedRadius;
      shapeOutline.set({ rx: localRx, ry: localRy, dirty: true });

      if (photo && photo.clipPath && photo.clipPath instanceof Rect) {
        photo.clipPath.set({ rx: localRx, ry: localRy, dirty: true });
        photo.set('dirty', true);
      }
    } else if (shapeOutline) {
      // Non-rectangular frame (heart, star, circle, custom SVG):
      // Preserve actual shape geometry! Do NOT convert to rounded rectangle!
      (shapeOutline as any).cornerRadius = clampedRadius;
      (shapeOutline as any)._requestedRadius = clampedRadius;
    }

    (object as any).cornerRadius = clampedRadius;
    (object as any)._requestedRadius = clampedRadius;
    syncVisualEffectsGeometry(object);
    return object;
  }

  // C. Normal Multi-Object Group
  if (object instanceof Group && typeof (object as any).getObjects === 'function') {
    const children: FabricObject[] = (object as any).getObjects();
    for (const child of children) {
      applyCornerRadiusToObject(child, clampedRadius, canvas);
    }
    (object as any).cornerRadius = clampedRadius;
    (object as any)._requestedRadius = clampedRadius;
    object.set('dirty', true);
    return object;
  }

  // D. FabricImage / Photo
  const isImg =
    object instanceof FabricImage ||
    (object as any).type === 'image' ||
    (object as any).type === 'FabricImage';

  if (isImg) {
    (object as any).cornerRadius = clampedRadius;
    (object as any)._requestedRadius = clampedRadius;
    syncObjectCornerGeometry(object);
    syncVisualEffectsGeometry(object);
    return object;
  }

  // E. Rect
  if (object instanceof Rect || (object as any).type === 'rect') {
    (object as any).cornerRadius = clampedRadius;
    (object as any)._requestedRadius = clampedRadius;
    syncObjectCornerGeometry(object);
    syncVisualEffectsGeometry(object);
    return object;
  }

  // F. Polygon / Triangle / Star / Hexagon / Vector Shapes
  const polyData = extractPolygonPoints(object);
  if (polyData && polyData.points.length >= 3) {
    const { points: originalPoints, shapeType: originalShapeType } = polyData;
    (object as any).originalShapePoints = originalPoints.map((p) => ({ ...p }));
    (object as any).originalShapeType = originalShapeType;
    (object as any).cornerRadius = clampedRadius;
    (object as any)._requestedRadius = clampedRadius;

    // Scale-aware visual radius
    const scaleX = Math.max(Math.abs(object.scaleX || 1), 0.0001);
    const scaleY = Math.max(Math.abs(object.scaleY || 1), 0.0001);
    const avgScale = (scaleX + scaleY) / 2;
    const localRadius = clampedRadius / avgScale;

    const newPathString = createRoundedPolygonPath(originalPoints, localRadius);

    if (object instanceof Path) {
      const center = object.getCenterPoint();
      (object as any)._setPath(newPathString);
      object.setPositionByOrigin(center, 'center', 'center');
      object.setCoords();
      object.set('dirty', true);
      syncVisualEffectsGeometry(object);
      return object;
    }

    // If Polygon or Triangle, convert to Path to support curves
    const center = object.getCenterPoint();
    const pathObj = new Path(newPathString, {
      left: center.x,
      top: center.y,
      originX: 'center',
      originY: 'center',
      scaleX: object.scaleX,
      scaleY: object.scaleY,
      angle: object.angle,
      flipX: object.flipX,
      flipY: object.flipY,
      fill: object.fill,
      stroke: object.stroke,
      strokeWidth: object.strokeWidth,
      strokeUniform: object.strokeUniform,
      paintFirst: object.paintFirst,
      strokeDashArray: object.strokeDashArray,
      strokeLineCap: object.strokeLineCap,
      strokeLineJoin: object.strokeLineJoin,
      opacity: object.opacity,
      visible: object.visible,
      selectable: object.selectable,
      evented: object.evented,
      shadow: object.shadow,
      cornerColor: '#ffffff',
      cornerStrokeColor: '#8b3dff',
      borderColor: '#8b3dff',
      cornerStyle: 'circle',
      cornerSize: 12,
      transparentCorners: false,
    });

    pathObj.set({
      id: object.get('id' as any) || (object as any).id,
      name: object.get('name' as any) || (object as any).name || 'Shape',
      isShape: true,
      sourceType: 'shape',
      shapeType: originalShapeType,
      frameShape: (object as any).frameShape,
      strokePosition: (object as any).strokePosition,
      baseStrokeWidth: (object as any).baseStrokeWidth,
      originalShapePoints: originalPoints.map((p) => ({ ...p })),
      originalShapeType,
      cornerRadius: clampedRadius,
      _requestedRadius: clampedRadius,
      _shadowSettings: (object as any)._shadowSettings,
      _activeEffect: (object as any)._activeEffect,
      _activeEffects: (object as any)._activeEffects ? { ...(object as any)._activeEffects } : undefined,
      _secondaryShadow: (object as any)._secondaryShadow ? { ...(object as any)._secondaryShadow } : undefined,
      _blurAmount: (object as any)._blurAmount,
      _effectSettings: (object as any)._effectSettings,
    } as any);

    if (canvas && typeof canvas.getObjects === 'function') {
      const idx = canvas.getObjects().indexOf(object);
      if (idx !== -1) {
        canvas.remove(object);
        canvas.insertAt(idx, pathObj);
        canvas.setActiveObject(pathObj);
      }
    }

    syncVisualEffectsGeometry(pathObj);
    return pathObj;
  }

  // G. Arbitrary Path / SVG - preserve silhouette
  (object as any).cornerRadius = clampedRadius;
  (object as any)._requestedRadius = clampedRadius;
  syncVisualEffectsGeometry(object);
  return object;
}

/**
 * Locates the exact visible visual silhouette for any canvas object,
 * including SVG shapes, photo shape groups, and custom frames.
 */
export function getObjectVisualSilhouette(object: FabricObject): any {
  if (!object) return null;

  const isFrame =
    Boolean(object.get?.('isFrame' as any)) ||
    Boolean((object as any).isFrame) ||
    Boolean((object as any).isPhotoShapeGroup) ||
    Boolean((object as any).isCustomFrame);

  if (isFrame && typeof (object as any).getObjects === 'function') {
    const children: FabricObject[] = (object as any).getObjects();
    const shapeOutline = children.find((o) => (o as any).frameRole === 'shape-outline');
    if (shapeOutline) return shapeOutline;

    const photo = children.find((o) => (o as any).frameRole === 'photo');
    if (photo && photo.clipPath) return photo.clipPath;

    const overlay = children.find((o) => (o as any).frameRole === 'overlay');
    if (overlay) return overlay;
  }

  if (object.clipPath) {
    return object.clipPath;
  }

  return object;
}

/**
 * Draws a shape or SVG path for silhouette shadow projection.
 */
export function drawShapeOrPath(
  shape: any,
  ctx: CanvasRenderingContext2D,
  skipTransform: boolean = false
): void {
  if (!shape) return;
  ctx.save();
  if (!skipTransform && typeof shape.transform === 'function') {
    shape.transform(ctx);
  }

  if (shape instanceof Rect || (shape as any).type === 'rect') {
    const w = shape.width || 1;
    const h = shape.height || 1;
    const { rx: localRx, ry: localRy } = getEffectiveCornerRadius(shape);
    drawRoundedRectPath(ctx, -w / 2, -h / 2, w, h, localRx, localRy);
    ctx.fill();
    if (shape.strokeWidth && shape.stroke && shape.stroke !== 'transparent') {
      ctx.lineWidth = shape.strokeWidth;
      ctx.stroke();
    }
  } else if (shape instanceof Circle || (shape as any).type === 'circle') {
    const r = (shape as any).radius || ((shape.width || 1) / 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    if (shape.strokeWidth && shape.stroke && shape.stroke !== 'transparent') {
      ctx.lineWidth = shape.strokeWidth;
      ctx.stroke();
    }
  } else if (typeof (shape as any)._renderPathCommands === 'function') {
    ctx.beginPath();
    (shape as any)._renderPathCommands(ctx);
    ctx.fill();
    if (shape.strokeWidth && shape.stroke && shape.stroke !== 'transparent') {
      ctx.lineWidth = shape.strokeWidth;
      ctx.stroke();
    }
  } else if (typeof (shape as any)._render === 'function') {
    ctx.beginPath();
    (shape as any)._render(ctx);
    ctx.fill();
    if (shape.strokeWidth && shape.stroke && shape.stroke !== 'transparent') {
      ctx.lineWidth = shape.strokeWidth;
      ctx.stroke();
    }
  } else {
    const w = shape.width || 1;
    const h = shape.height || 1;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

/**
 * Draws the complete visual silhouette for an object in local coordinate space.
 * Seamlessly handles raster images, photos, transparent cutouts, SVGs, paths, and frames.
 */
export function drawObjectSilhouette(object: FabricObject, ctx: CanvasRenderingContext2D): void {
  if (!object) return;

  const isFrame =
    Boolean(object.get?.('isFrame' as any)) ||
    Boolean((object as any).isFrame) ||
    Boolean((object as any).isPhotoShapeGroup) ||
    Boolean((object as any).isCustomFrame);

  if (isFrame) {
    const silhouette = getObjectVisualSilhouette(object);
    if (silhouette && silhouette !== object) {
      drawShapeOrPath(silhouette, ctx);
      return;
    }
  }

  const isImg =
    object instanceof FabricImage ||
    (object as any).type === 'image' ||
    (object as any).type === 'FabricImage' ||
    Boolean((object as any)._element) ||
    Boolean(object.get?.('isImage' as any));

  const rx =
    Number((object as any).cornerRadius) ||
    Number((object as any)._requestedRadius) ||
    Number((object as any).rx) ||
    0;

  // Handle all image & photo variations (JPG, PNG, WebP, transparent cutouts, rounded corners, crops)
  if (isImg) {
    const w = object.width || 1;
    const h = object.height || 1;
    const imgEl = (object as any)._filteredEl || (object as any)._element;

    if (rx > 0) {
      const { rx: localRx, ry: localRy } = getEffectiveCornerRadius(object);
      drawRoundedRectPath(ctx, -w / 2, -h / 2, w, h, localRx, localRy);
      ctx.fill();
      if (object.strokeWidth && object.stroke && object.stroke !== 'transparent') {
        ctx.lineWidth = object.strokeWidth;
        ctx.stroke();
      }
      return;
    }

    if (object.clipPath && !(object.clipPath as any).isCornerRoundingClip) {
      drawShapeOrPath(object.clipPath, ctx);
      return;
    }

    // Normal rectangular photo or transparent cutout PNG/sticker
    if (imgEl && (imgEl.naturalWidth || imgEl.width) && (imgEl.naturalHeight || imgEl.height)) {
      const filterScaleX = Number((object as any)._filterScalingX) || 1;
      const filterScaleY = Number((object as any)._filterScalingY) || 1;
      const cropX = Math.max((object as any).cropX || 0, 0);
      const cropY = Math.max((object as any).cropY || 0, 0);
      const elWidth = (imgEl as HTMLImageElement).naturalWidth || imgEl.width;
      const elHeight = (imgEl as HTMLImageElement).naturalHeight || imgEl.height;

      const sX = cropX * filterScaleX;
      const sY = cropY * filterScaleY;
      const sW = Math.min(w * filterScaleX, elWidth - sX);
      const sH = Math.min(h * filterScaleY, elHeight - sY);
      const destW = Math.min(w, elWidth / filterScaleX - cropX);
      const destH = Math.min(h, elHeight / filterScaleY - cropY);

      try {
        ctx.drawImage(imgEl, sX, sY, sW, sH, -w / 2, -h / 2, destW, destH);
      } catch {
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
    } else {
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }

    if (object.strokeWidth && object.stroke && object.stroke !== 'transparent') {
      ctx.lineWidth = object.strokeWidth;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }
    return;
  }

  if (object.clipPath) {
    drawShapeOrPath(object.clipPath, ctx);
    return;
  }

  if (object instanceof Rect || (object as any).type === 'rect') {
    const w = object.width || 1;
    const h = object.height || 1;
    const { rx: localRx, ry: localRy } = getEffectiveCornerRadius(object);
    drawRoundedRectPath(ctx, -w / 2, -h / 2, w, h, localRx, localRy);
    ctx.fill();
    if (object.strokeWidth && object.stroke && object.stroke !== 'transparent') {
      ctx.lineWidth = object.strokeWidth;
      ctx.stroke();
    }
    return;
  }

  drawShapeOrPath(object, ctx, true);
}

/**
 * Checks whether an object requires silhouette-based shadow rendering
 * rather than raw unclipped image/group rendering.
 * All image and photo types, shapes, and frames use silhouette projection.
 */
export function requiresSilhouetteShadow(object: FabricObject): boolean {
  if (!object || !object.shadow || !object.shadow.color || object.shadow.color === 'transparent') {
    return false;
  }

  // Inside a frame, the photo and outline must not render independent shadows
  if (
    (object as any).frameRole === 'photo' ||
    (object as any).frameRole === 'shape-outline' ||
    (object as any).frameRole === 'overlay'
  ) {
    return false;
  }

  // Text objects use native Fabric vector text glyph shadow renderer
  const rawType = String((object as any).type || '')
    .toLowerCase()
    .replace(/[-_\s]/g, '');
  if (['text', 'itext', 'textbox'].includes(rawType)) {
    return false;
  }

  // All other objects (images, photos, cutouts, shapes, paths, SVGs, frames) use silhouette projection
  return true;
}

/**
 * Casts a drop shadow using the exact silhouette path of the object via offscreen projection.
 * Guaranteed zero rectangular artifact, zero black fill beneath translucent images,
 * and exact parity with the visible shape.
 */
export function renderSilhouetteShadow(object: FabricObject, ctx: CanvasRenderingContext2D): boolean {
  const shadow = object.shadow;
  if (!shadow || !shadow.color || shadow.color === 'transparent') {
    return false;
  }

  const shadowColor = ctx.shadowColor;
  const shadowBlur = ctx.shadowBlur;
  const shadowOffsetX = ctx.shadowOffsetX;
  const shadowOffsetY = ctx.shadowOffsetY;

  if (!shadowColor || shadowColor === 'transparent') {
    return false;
  }

  // Offscreen projection distance (far beyond any screen or print canvas bounds)
  const PROJECT_OFFSET = 50000;

  ctx.save();
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetX = shadowOffsetX + PROJECT_OFFSET;
  ctx.shadowOffsetY = shadowOffsetY;
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';

  ctx.translate(-PROJECT_OFFSET, 0);

  drawObjectSilhouette(object, ctx);

  ctx.restore();

  return true;
}

/**
 * Multi-pass silhouette shadow projection for compound lighting effects (Glow, Lift, Neon)
 */
export function renderSilhouetteShadowPass(
  object: FabricObject,
  ctx: CanvasRenderingContext2D,
  sec: { color: string; blur: number; offsetX?: number; offsetY?: number }
): boolean {
  if (!sec || !sec.color || sec.color === 'transparent') {
    return false;
  }

  const canvasZoom = object.canvas?.getZoom?.() || 1;
  const retina =
    typeof (object as any).getCanvasRetinaScaling === 'function'
      ? (object as any).getCanvasRetinaScaling()
      : 1;
  const r = canvasZoom * retina;
  const scaling =
    typeof (object as any).getObjectScaling === 'function'
      ? (object as any).getObjectScaling()
      : { x: 1, y: 1 };
  const avgScale = (Math.abs(scaling.x) + Math.abs(scaling.y)) / 2;

  const PROJECT_OFFSET = 50000;

  ctx.save();
  (object as any)._setupCompositeOperation?.(ctx);
  object.transform(ctx);
  (object as any)._setOpacity?.(ctx);

  ctx.shadowColor = sec.color;
  ctx.shadowBlur = (sec.blur || 0) * r * avgScale;
  ctx.shadowOffsetX = (sec.offsetX || 0) * r * Math.abs(scaling.x) + PROJECT_OFFSET;
  ctx.shadowOffsetY = (sec.offsetY || 0) * r * Math.abs(scaling.y);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';

  ctx.translate(-PROJECT_OFFSET, 0);

  drawObjectSilhouette(object, ctx);

  ctx.restore();

  return true;
}

let isHookInstalled = false;

/**
 * Installs the global silhouette shadow hook on FabricObject.prototype._setShadow.
 * Automatically handles canvas rendering, zoom/pan, rotations, animations, and exports.
 */
export function installShadowSilhouetteHook(): void {
  if (isHookInstalled) return;
  isHookInstalled = true;

  const origSetShadow = FabricObject.prototype._setShadow;

  FabricObject.prototype._setShadow = function (ctx: CanvasRenderingContext2D) {
    if (!this.shadow || !this.shadow.color || this.shadow.color === 'transparent') {
      return;
    }

    // Inside a frame, suppress shadow on photo/outline children
    if (
      (this as any).frameRole === 'photo' ||
      (this as any).frameRole === 'shape-outline' ||
      (this as any).frameRole === 'overlay'
    ) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      return;
    }

    if (requiresSilhouetteShadow(this)) {
      // Let Fabric compute exact shadow metrics on ctx first
      origSetShadow.call(this, ctx);

      // Render the exact silhouette shadow projected offscreen
      const rendered = renderSilhouetteShadow(this, ctx);

      if (rendered) {
        // Clear native shadow on ctx so drawObject does not cast a rectangular drop-shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        return;
      }
    }

    // Fall back to original Fabric shadow
    origSetShadow.call(this, ctx);
  };
}

/**
 * Synchronizes corner geometry and ensures frame children don't carry independent shadows.
 */
export function syncVisualEffectsGeometry(object: FabricObject): void {
  if (!object) return;

  syncObjectCornerGeometry(object);

  // If object is a Path with originalShapePoints and cornerRadius, keep local path synchronized with scale
  if (
    object instanceof Path &&
    (object as any).originalShapePoints &&
    Number((object as any).cornerRadius) > 0
  ) {
    const scaleX = Math.max(Math.abs(object.scaleX || 1), 0.0001);
    const scaleY = Math.max(Math.abs(object.scaleY || 1), 0.0001);
    const avgScale = (scaleX + scaleY) / 2;
    const localRadius = Number((object as any).cornerRadius) / avgScale;
    const newPathString = createRoundedPolygonPath(
      (object as any).originalShapePoints,
      localRadius
    );
    const center = object.getCenterPoint();
    (object as any)._setPath(newPathString);
    object.setPositionByOrigin(center, 'center', 'center');
    object.setCoords();
  }

  const isFrame =
    Boolean(object.get?.('isFrame' as any)) ||
    Boolean((object as any).isFrame) ||
    Boolean((object as any).isPhotoShapeGroup) ||
    Boolean((object as any).isCustomFrame);

  if (isFrame && typeof (object as any).getObjects === 'function') {
    const children: FabricObject[] = (object as any).getObjects();
    for (const child of children) {
      if (child.shadow) {
        child.set('shadow', null);
      }
    }
  }

  object.set('dirty', true);
  object.group?.set('dirty', true);
}
