import {
  Control,
  controlsUtils,
  FabricObject,
  ActiveSelection,
  Textbox,
  IText,
  FabricImage,
  Rect,
  Circle,
  Polygon,
  Path,
  Group,
  Point,
  util,
} from 'fabric';
import {
  installShadowSilhouetteHook,
  drawRoundedRectPath,
  getEffectiveCornerRadius,
  renderSilhouetteShadowPass,
  requiresSilhouetteShadow,
} from './visualGeometry';

export const CANVA_PURPLE = '#8b3dff';

/** Sleek precision black arrow cursor for artwork canvas */
export const BLACK_ARTWORK_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23000000' stroke='%23ffffff' stroke-width='1.2' stroke-linejoin='round' d='M3 2l12 12-5 1 3 6-2.5 1.2-3-6-4.5 4.8z'/%3E%3C/svg%3E") 3 2, default`;

interface LiveFrameResizeState {
  transform: object;
  renderedPhotoScaleX: number;
  renderedPhotoScaleY: number;
  sourceWidth: number;
  sourceHeight: number;
  initialWidth: number;
  initialHeight: number;
  initialCropX: number;
  initialCropY: number;
  initialScaleX: number;
  initialScaleY: number;
  anchorPoint: { x: number; y: number };
  anchorOriginX: 'left' | 'center' | 'right';
  anchorOriginY: 'top' | 'center' | 'bottom';
  corner: string;
}

const liveFrameResizeStates = new WeakMap<FabricObject, LiveFrameResizeState>();

const CORNER_ANCHORS: Record<
  string,
  { x: 'left' | 'center' | 'right'; y: 'top' | 'center' | 'bottom' }
> = {
  ml: { x: 'right', y: 'center' },
  mr: { x: 'left', y: 'center' },
  mt: { x: 'center', y: 'bottom' },
  mb: { x: 'center', y: 'top' },
  tl: { x: 'right', y: 'bottom' },
  tr: { x: 'left', y: 'bottom' },
  bl: { x: 'right', y: 'top' },
  br: { x: 'left', y: 'top' },
};

function isFrameGroup(target: FabricObject): target is Group {
  return (
    target instanceof Group &&
    (Boolean(target.get('isFrame' as any)) ||
      Boolean(target.get('isPhotoShapeGroup' as any)) ||
      Boolean(target.get('isCustomFrame' as any)))
  );
}

function getFramePhoto(target: Group): FabricImage | null {
  const photo = target.getObjects().find(
    (child) =>
      child instanceof FabricImage &&
      child.get('frameRole' as any) === 'photo'
  );
  return (photo as FabricImage | undefined) || null;
}

/**
 * Fabric side controls normally apply the Group's non-uniform scale to every
 * child. Counter-scale only the photo and resize its clip viewport so the
 * frame crops live without stretching the image.
 */
function createLiveResizeState(
  target: FabricObject,
  photo: FabricImage | null,
  transform: any
): LiveFrameResizeState {
  const isDirectImage = Boolean(photo && target === photo);
  const originalScaleX = Math.max(
    Math.abs(Number(transform?.original?.scaleX) || Number(target.scaleX) || 1),
    0.0001
  );
  const originalScaleY = Math.max(
    Math.abs(Number(transform?.original?.scaleY) || Number(target.scaleY) || 1),
    0.0001
  );
  const groupScaleX = isDirectImage ? 1 : originalScaleX;
  const groupScaleY = isDirectImage ? 1 : originalScaleY;
  const visibleWidth = Math.max(Number(photo?.width || target.width) || 1, 1);
  const visibleHeight = Math.max(Number(photo?.height || target.height) || 1, 1);
  const cropX = Math.max(Number(photo?.cropX) || 0, 0);
  const cropY = Math.max(Number(photo?.cropY) || 0, 0);

  const corner = String(transform?.corner || '');
  const anchorOrigin = CORNER_ANCHORS[corner] || {
    x: (transform?.originX || 'center') as 'left' | 'center' | 'right',
    y: (transform?.originY || 'center') as 'top' | 'center' | 'bottom',
  };
  const anchorPoint = target.getPositionByOrigin(anchorOrigin.x, anchorOrigin.y);

  return {
    transform,
    renderedPhotoScaleX:
      Math.abs(Number(photo?.scaleX || target.scaleX) || 1) * groupScaleX,
    renderedPhotoScaleY:
      Math.abs(Number(photo?.scaleY || target.scaleY) || 1) * groupScaleY,
    sourceWidth: Math.max(
      Number(target.get('naturalWidth' as any)) ||
      Number(photo?.get('naturalWidth' as any)) ||
      Number((photo as any)?._element?.naturalWidth) ||
      cropX + visibleWidth,
      cropX + visibleWidth
    ),
    sourceHeight: Math.max(
      Number(target.get('naturalHeight' as any)) ||
      Number(photo?.get('naturalHeight' as any)) ||
      Number((photo as any)?._element?.naturalHeight) ||
      cropY + visibleHeight,
      cropY + visibleHeight
    ),
    initialWidth: visibleWidth,
    initialHeight: visibleHeight,
    initialCropX: cropX,
    initialCropY: cropY,
    initialScaleX: originalScaleX,
    initialScaleY: originalScaleY,
    anchorPoint,
    anchorOriginX: anchorOrigin.x,
    anchorOriginY: anchorOrigin.y,
    corner,
  };
}

function initLiveResizeState(transform: any): LiveFrameResizeState | null {
  const target = transform?.target as FabricObject | undefined;
  if (!target) return null;

  const directImage = target instanceof FabricImage ? target : null;
  const photo = directImage || (isFrameGroup(target) ? getFramePhoto(target) : null);

  let state = liveFrameResizeStates.get(target);
  if (!state || state.transform !== transform) {
    state = createLiveResizeState(target, photo, transform);
    liveFrameResizeStates.set(target, state);
  }
  return state;
}

function cropDirectImageDuringSideResize(
  image: FabricImage,
  state: LiveFrameResizeState,
  axis: 'x' | 'y'
): void {
  const sourceWidth = Math.max(state.sourceWidth, 1);
  const sourceHeight = Math.max(state.sourceHeight, 1);
  const requestedWidth = Math.max((Number(image.width) || 1) * Math.abs(Number(image.scaleX) || 1), 10);
  const requestedHeight = Math.max((Number(image.height) || 1) * Math.abs(Number(image.scaleY) || 1), 10);
  const initialDisplayWidth = state.initialWidth * Math.max(state.renderedPhotoScaleX, 0.0001);
  const initialDisplayHeight = state.initialHeight * Math.max(state.renderedPhotoScaleY, 0.0001);
  const viewportWidth = axis === 'x' ? requestedWidth : initialDisplayWidth;
  const viewportHeight = axis === 'y' ? requestedHeight : initialDisplayHeight;
  const coverScale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight, 0.0001);
  const visibleSourceWidth = Math.min(sourceWidth, viewportWidth / coverScale);
  const visibleSourceHeight = Math.min(sourceHeight, viewportHeight / coverScale);
  const oldCenterX = state.initialCropX + state.initialWidth / 2;
  const oldCenterY = state.initialCropY + state.initialHeight / 2;
  const cropX = Math.max(0, Math.min(oldCenterX - visibleSourceWidth / 2, sourceWidth - visibleSourceWidth));
  const cropY = Math.max(0, Math.min(oldCenterY - visibleSourceHeight / 2, sourceHeight - visibleSourceHeight));

  image.set({
    width: visibleSourceWidth,
    height: visibleSourceHeight,
    cropX,
    cropY,
    scaleX: coverScale,
    scaleY: coverScale,
    objectCaching: false,
  });

  image.setPositionByOrigin(
    state.anchorPoint as any,
    state.anchorOriginX,
    state.anchorOriginY
  );
  image.set('dirty' as any, true);
  image.setCoords();
  image.canvas?.requestRenderAll();
}

function preserveFramePhotoDuringSideResize(
  transform: any,
  axis: 'x' | 'y'
): void {
  const target = transform?.target as FabricObject | undefined;
  if (!target) return;

  const directImage = target instanceof FabricImage ? target : null;
  const photo = directImage || (isFrameGroup(target) ? getFramePhoto(target) : null);
  if (!photo) return;

  let state = liveFrameResizeStates.get(target);
  if (!state || state.transform !== transform) {
    state = createLiveResizeState(target, photo, transform);
    liveFrameResizeStates.set(target, state);
  }

  if (directImage) {
    cropDirectImageDuringSideResize(directImage, state, axis);
    return;
  }
  if (!isFrameGroup(target)) return;

  const groupScaleX = Math.max(Math.abs(Number(target.scaleX) || 1), 0.0001);
  const groupScaleY = Math.max(Math.abs(Number(target.scaleY) || 1), 0.0001);
  const viewportWidth = Math.max(target.getScaledWidth(), 1);
  const viewportHeight = Math.max(target.getScaledHeight(), 1);
  const sourceWidth = Math.max(
    state.sourceWidth,
    Number(photo.get('naturalWidth' as any)) || 0,
    Number((photo as any)?._element?.naturalWidth) || 0,
    1
  );
  const sourceHeight = Math.max(
    state.sourceHeight,
    Number(photo.get('naturalHeight' as any)) || 0,
    Number((photo as any)?._element?.naturalHeight) || 0,
    1
  );

  const requiredRenderedScale = Math.max(
    viewportWidth / sourceWidth,
    viewportHeight / sourceHeight,
    0.0001
  );
  const initialUniformRenderedScale = Math.max(
    state.renderedPhotoScaleX,
    state.renderedPhotoScaleY,
    0.0001
  );
  const renderedScale = Math.max(requiredRenderedScale, initialUniformRenderedScale);
  const visibleSourceWidth = Math.min(sourceWidth, viewportWidth / renderedScale);
  const visibleSourceHeight = Math.min(sourceHeight, viewportHeight / renderedScale);
  const initialCenterX = state.initialCropX + state.initialWidth / 2;
  const initialCenterY = state.initialCropY + state.initialHeight / 2;
  const cropX = Math.max(0, Math.min(initialCenterX - visibleSourceWidth / 2, sourceWidth - visibleSourceWidth));
  const cropY = Math.max(0, Math.min(initialCenterY - visibleSourceHeight / 2, sourceHeight - visibleSourceHeight));

  photo.set({
    width: visibleSourceWidth,
    height: visibleSourceHeight,
    cropX,
    cropY,
    scaleX: renderedScale / groupScaleX,
    scaleY: renderedScale / groupScaleY,
    objectCaching: false,
  });

  const clipPath = photo.clipPath as FabricObject | undefined;
  if (clipPath) {
    clipPath.set({
      scaleX: (viewportWidth / renderedScale) / Math.max(Number(clipPath.width) || 1, 1),
      scaleY: (viewportHeight / renderedScale) / Math.max(Number(clipPath.height) || 1, 1),
      objectCaching: false,
    });
    clipPath.setCoords();
    clipPath.set('dirty' as any, true);
  }

  photo.set('dirty' as any, true);
  photo.setCoords();
  target.setPositionByOrigin(state.anchorPoint as any, state.anchorOriginX, state.anchorOriginY);
  target.setCoords();
  target.set('dirty' as any, true);
  target.canvas?.requestRenderAll();
}

function frameAwareScalingX(
  eventData: any,
  transform: any,
  x: number,
  y: number
): boolean {
  const state = initLiveResizeState(transform);
  const changed = controlsUtils.scalingX(eventData, transform, x, y);
  if (changed) {
    preserveFramePhotoDuringSideResize(transform, 'x');
    const target = transform?.target as FabricObject | undefined;
    if (target && state?.anchorPoint) {
      target.setPositionByOrigin(state.anchorPoint as any, state.anchorOriginX, state.anchorOriginY);
      target.setCoords();
      target.set('dirty' as any, true);
      target.canvas?.requestRenderAll();
    }
  }
  return changed;
}

function frameAwareScalingY(
  eventData: any,
  transform: any,
  x: number,
  y: number
): boolean {
  const state = initLiveResizeState(transform);
  const changed = controlsUtils.scalingY(eventData, transform, x, y);
  if (changed) {
    preserveFramePhotoDuringSideResize(transform, 'y');
    const target = transform?.target as FabricObject | undefined;
    if (target && state?.anchorPoint) {
      target.setPositionByOrigin(state.anchorPoint as any, state.anchorOriginX, state.anchorOriginY);
      target.setCoords();
      target.set('dirty' as any, true);
      target.canvas?.requestRenderAll();
    }
  }
  return changed;
}

function frameAwareScalingEqually(
  eventData: any,
  transform: any,
  x: number,
  y: number
): boolean {
  const state = initLiveResizeState(transform);
  const changed = controlsUtils.scalingEqually(eventData, transform, x, y);
  if (changed && state?.anchorPoint) {
    const target = transform?.target as FabricObject | undefined;
    if (target) {
      target.setPositionByOrigin(
        state.anchorPoint as any,
        state.anchorOriginX,
        state.anchorOriginY
      );
      target.setCoords();
    }
  }
  return changed;
}

/**
 * Canva-style circular corner handle.
 */
export function renderCanvaCornerHandle(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  _styleOverride: any,
  _fabricObject: FabricObject
): void {
  const size = 13;
  const radius = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(left, top, radius, 0, Math.PI * 2);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CANVA_PURPLE;
  ctx.stroke();

  ctx.restore();
}

/**
 * Canva-style side handle.
 *
 * isVertical=true:
 * Left/right handle used for width resizing.
 *
 * isVertical=false:
 * Top/bottom handle used for height resizing.
 */
export function renderCanvaSideHandle(isVertical: boolean) {
  return function (
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    _styleOverride: any,
    fabricObject: FabricObject
  ): void {
    const width = isVertical ? 6 : 16;
    const height = isVertical ? 16 : 6;
    const radius = 3;
    const angle = fabricObject.angle || 0;

    ctx.save();
    ctx.translate(left, top);
    ctx.rotate((angle * Math.PI) / 180);

    ctx.beginPath();

    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(
        -width / 2,
        -height / 2,
        width,
        height,
        radius
      );
    } else {
      ctx.rect(
        -width / 2,
        -height / 2,
        width,
        height
      );
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = CANVA_PURPLE;
    ctx.stroke();

    ctx.restore();
  };
}

/**
 * Canva-style rotation handle.
 */
export function renderCanvaRotationHandle(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  _styleOverride: any,
  fabricObject: FabricObject
): void {
  const size = 26;
  const radius = size / 2;
  const angle = fabricObject.angle || 0;
  const radians = (angle * Math.PI) / 180;
  const stemLength = 21;

  ctx.save();

  // Connecting line
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(radians);

  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, -radius - stemLength);
  ctx.strokeStyle = CANVA_PURPLE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  // Circular button
  ctx.beginPath();
  ctx.arc(left, top, radius, 0, Math.PI * 2);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.20)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1.5;

  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#cbd5e1';
  ctx.stroke();

  // Rotation icon
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(radians);

  ctx.strokeStyle = '#1e293b';
  ctx.fillStyle = '#1e293b';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const arcRadius = 5.4;

  ctx.beginPath();
  ctx.arc(
    0,
    0,
    arcRadius,
    -0.22 * Math.PI,
    0.72 * Math.PI,
    false
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(3.2, -4.8);
  ctx.lineTo(5.8, -2.2);
  ctx.lineTo(2.4, -2.2);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(
    0,
    0,
    arcRadius,
    0.78 * Math.PI,
    1.72 * Math.PI,
    false
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-3.2, 4.8);
  ctx.lineTo(-5.8, 2.2);
  ctx.lineTo(-2.4, 2.2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

/**
 * Corner controls shared by objects.
 */
function createCornerControls(): Record<string, Control> {
  return {
    tl: new Control({
      x: -0.5,
      y: -0.5,
      cursorStyleHandler:
        controlsUtils.scaleCursorStyleHandler,
      actionHandler: frameAwareScalingEqually,
      actionName: 'scale',
      render: renderCanvaCornerHandle,
    }),

    tr: new Control({
      x: 0.5,
      y: -0.5,
      cursorStyleHandler:
        controlsUtils.scaleCursorStyleHandler,
      actionHandler: frameAwareScalingEqually,
      actionName: 'scale',
      render: renderCanvaCornerHandle,
    }),

    bl: new Control({
      x: -0.5,
      y: 0.5,
      cursorStyleHandler:
        controlsUtils.scaleCursorStyleHandler,
      actionHandler: frameAwareScalingEqually,
      actionName: 'scale',
      render: renderCanvaCornerHandle,
    }),

    br: new Control({
      x: 0.5,
      y: 0.5,
      cursorStyleHandler:
        controlsUtils.scaleCursorStyleHandler,
      actionHandler: frameAwareScalingEqually,
      actionName: 'scale',
      render: renderCanvaCornerHandle,
    }),
  };
}

/**
 * Independent width and height controls.
 */
function createSideScaleControls(): Record<string, Control> {
  return {
    // Width-only resize
    ml: new Control({
      x: -0.5,
      y: 0,
      sizeX: 18,
      sizeY: 26,
      touchSizeX: 28,
      touchSizeY: 36,
      cursorStyleHandler:
        controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: frameAwareScalingX,
      actionName: 'scaleX',
      render: renderCanvaSideHandle(true),
    }),

    mr: new Control({
      x: 0.5,
      y: 0,
      sizeX: 18,
      sizeY: 26,
      touchSizeX: 28,
      touchSizeY: 36,
      cursorStyleHandler:
        controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: frameAwareScalingX,
      actionName: 'scaleX',
      render: renderCanvaSideHandle(true),
    }),

    // Height-only resize
    mt: new Control({
      x: 0,
      y: -0.5,
      sizeX: 26,
      sizeY: 18,
      touchSizeX: 36,
      touchSizeY: 28,
      cursorStyleHandler:
        controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: frameAwareScalingY,
      actionName: 'scaleY',
      render: renderCanvaSideHandle(false),
    }),

    mb: new Control({
      x: 0,
      y: 0.5,
      sizeX: 26,
      sizeY: 18,
      touchSizeX: 36,
      touchSizeY: 28,
      cursorStyleHandler:
        controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: frameAwareScalingY,
      actionName: 'scaleY',
      render: renderCanvaSideHandle(false),
    }),
  };
}

/**
 * Canva-style move handle with 4-way arrow icon.
 */
export function renderCanvaMoveHandle(): void {
  // Move handle icon removed everywhere per user request
}

function createMoveControl(): Control {
  return new Control({
    x: 0,
    y: 0.5,
    offsetX: 0,
    offsetY: 34,
    cursorStyleHandler: () => 'move',
    actionHandler: (eventData, transform, x, y) => {
      const target = transform.target;
      if (target && (target as any).isEditing) {
        (target as any).exitEditing?.();
        (target as any).set?.('hoverCursor', 'move');
      }
      return controlsUtils.dragHandler(eventData, transform, x, y);
    },
    actionName: 'drag',
    withConnection: false,
    render: renderCanvaMoveHandle,
  });
}

function createRotationControl(): Control {
  return new Control({
    x: 0,
    y: 0.5,
    offsetX: 0,
    offsetY: 34,
    cursorStyleHandler: controlsUtils.rotationStyleHandler,
    actionHandler: (eventData, transform, x, y) => {
      const target = transform.target;
      if (target && (target as any).isEditing) {
        (target as any).exitEditing?.();
        (target as any).set?.('hoverCursor', 'move');
      }
      return controlsUtils.rotationWithSnapping(eventData, transform, x, y);
    },
    actionName: 'rotate',
    withConnection: false,
    render: renderCanvaRotationHandle,
  });
}

/**
 * Controls for shapes, SVG elements, groups and selections.
 */
export function createCanvaControls(): Record<
  string,
  Control
> {
  return {
    ...createCornerControls(),
    ...createSideScaleControls(),
    mbr: createRotationControl(),
  };
}


export type CurvedTextSelectionBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Canonical curve slider mapping (-100..100).
 * Values 1..99 map to progressive Canva-style arcs (~3° to ~180°).
 * Only exactly 100 / -100 creates a full 360° circle.
 */
export function getCurveArcAngle(amount: number): number {
  const magnitude = Math.max(
    0,
    Math.min(100, Math.abs(Number(amount) || 0))
  );

  if (magnitude <= 0) {
    return 0;
  }

  // Exactly 100 / -100 is full circle mode
  if (magnitude >= 99.5) {
    return Math.PI * 2;
  }

  // Values 1..99 map smoothly without making 75 or 90 circular
  const minAngle = (3 * Math.PI) / 180;
  const maxArcAngle = (180 * Math.PI) / 180;
  const t = magnitude / 99;
  return minAngle + (maxArcAngle - minAngle) * t;
}

export function getCurvedTextSelectionBox(
  text: FabricObject
): CurvedTextSelectionBox | null {
  const rawType = String((text as any).type || '')
    .toLowerCase()
    .replace(/[-_\s]/g, '');

  const isText =
    text instanceof Textbox ||
    text instanceof IText ||
    rawType === 'textbox' ||
    rawType === 'itext' ||
    rawType === 'text';

  if (!isText) return null;

  const curve = Number((text as any).curve ?? 0);
  const curveMode = String((text as any).curveMode ?? '');
  const radius = Math.max(0, Number((text as any).curveRadius ?? 0));
  const textPath = (text as any).path as Path | undefined;

  if (
    !textPath ||
    radius <= 0 ||
    Math.abs(curve) <= 0.001 ||
    curveMode === 'none'
  ) {
    return null;
  }

  const fontSize = Math.max(
    1,
    Number((text as any).fontSize) || 16
  );
  const lineHeight = Math.max(
    1,
    Number((text as any).lineHeight) || 1.16
  );
  const textHeight = fontSize * lineHeight;
  const isCircle = Math.abs(curve) >= 99.5;

  // Ensure path.segmentsInfo is available so _measureLine computes renderLeft/renderTop
  if (
    textPath &&
    !(textPath as any).segmentsInfo &&
    typeof (util as any).getPathSegmentsInfo === 'function'
  ) {
    try {
      (textPath as any).segmentsInfo = (util as any).getPathSegmentsInfo(
        textPath.path
      );
    } catch {
      // Ignore
    }
  }

  // Ensure char bounds are measured if not already present
  if (
    !(text as any).__charBounds?.[0]?.length &&
    typeof (text as any)._measureLine === 'function'
  ) {
    try {
      (text as any)._measureLine(0);
    } catch {
      // Fallback below
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hasValidChar = false;

  const allLines = (text as any).__charBounds;
  if (Array.isArray(allLines) && allLines.length > 0) {
    for (let l = 0; l < allLines.length; l++) {
      const line = allLines[l];
      if (!Array.isArray(line)) continue;
      for (let i = 0; i < line.length; i++) {
        const cb = line[i];
        if (
          !cb ||
          typeof cb.renderLeft !== 'number' ||
          typeof cb.renderTop !== 'number'
        ) {
          continue;
        }
        const w = Math.max(cb.width || 0, cb.kernedWidth || 0);
        const hw = (w > 0 ? w : fontSize * 0.3) / 2;
        const topExtent = -fontSize * 0.85;
        const bottomExtent = fontSize * 0.25;
        const angle = Number(cb.angle) || 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const corners = [
          { dx: -hw, dy: topExtent },
          { dx: hw, dy: topExtent },
          { dx: hw, dy: bottomExtent },
          { dx: -hw, dy: bottomExtent },
        ];

        for (const corner of corners) {
          const px = cb.renderLeft + corner.dx * cos - corner.dy * sin;
          const py = cb.renderTop + corner.dx * sin + corner.dy * cos;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
        hasValidChar = true;
      }
    }
  }

  if (hasValidChar && Number.isFinite(minX) && Number.isFinite(maxX) && Number.isFinite(minY) && Number.isFinite(maxY)) {
    const padX = Math.max(8, fontSize * 0.2);
    const padY = Math.max(8, fontSize * 0.15);
    const width = maxX - minX + padX * 2;
    const height = maxY - minY + padY * 2;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    return {
      left: cx - width / 2,
      top: cy - height / 2,
      width,
      height,
    };
  }

  // Mathematical fallback if charBounds is not ready:
  // Measure only the arc the text actually occupies, NOT the entire 360 circle.
  const rawText = String((text as any).text ?? '');
  const measuredTextWidth = Math.max(
    1,
    Number((text as any).width) || rawText.length * fontSize * 0.55
  );

  const arcAngle = getCurveArcAngle(curve);
  const direction = curve >= 0 ? 1 : -1;
  const centerAngle = direction > 0 ? -Math.PI / 2 : Math.PI / 2;

  // Actual angular coverage of the text sentence along the curve
  const textArcAngle = Math.min(
    arcAngle,
    Math.max(0.15, (measuredTextWidth * 1.05) / Math.max(radius, 1))
  );

  const startAngle = centerAngle - textArcAngle / 2;
  const endAngle = centerAngle + textArcAngle / 2;

  let fMinX = Infinity;
  let fMaxX = -Infinity;
  let fMinY = Infinity;
  let fMaxY = -Infinity;

  const samples = 16;
  for (let s = 0; s <= samples; s++) {
    const a = startAngle + (s / samples) * (endAngle - startAngle);
    const px = Math.cos(a) * radius;
    const py = Math.sin(a) * radius;
    if (px < fMinX) fMinX = px;
    if (px > fMaxX) fMaxX = px;
    if (py < fMinY) fMinY = py;
    if (py > fMaxY) fMaxY = py;
  }

  const padX = Math.max(10, fontSize * 0.2);
  const padY = Math.max(8, fontSize * 0.15) + textHeight * 0.4;
  const width = fMaxX - fMinX + padX * 2;
  const height = fMaxY - fMinY + padY * 2;
  const cx = (fMinX + fMaxX) / 2;
  const cy = (fMinY + fMaxY) / 2;

  return {
    left: cx - width / 2,
    top: cy - height / 2,
    width,
    height,
  };
}

/**
 * When text is curved, locate controls on the curved-text visual box.
 * Straight text falls back to Fabric's normal control position calculation.
 */
function curvedTextboxControlPositionHandler(
  dim: Point,
  finalMatrix: any,
  fabricObject: FabricObject,
  currentControl: Control
): Point {
  const box = getCurvedTextSelectionBox(fabricObject);

  if (!box) {
    // Exact Fabric default control positioning for normal/straight text.
    return new Point(
      Number(currentControl.x || 0) * Number(dim.x || 0) +
      Number(currentControl.offsetX || 0),
      Number(currentControl.y || 0) * Number(dim.y || 0) +
      Number(currentControl.offsetY || 0)
    ).transform(finalMatrix);
  }

  /**
   * Fabric 6/7 calcOCoords() deliberately removes viewport scaling from
   * `finalMatrix`; the normal control path receives `dim` already multiplied
   * by object scale + canvas zoom.
   *
   * Our curved selection box is in the Textbox's LOCAL coordinates, so it
   * MUST be converted to the same screen-sized coordinates before applying
   * finalMatrix. The previous version skipped this conversion, which is why
   * the purple frame was correct but the handles stayed far outside it.
   */
  const objectScaling =
    typeof (fabricObject as any).getObjectScaling === 'function'
      ? (fabricObject as any).getObjectScaling()
      : new Point(
        Math.abs(Number(fabricObject.scaleX) || 1),
        Math.abs(Number(fabricObject.scaleY) || 1)
      );

  const vpt =
    typeof (fabricObject as any).getViewportTransform === 'function'
      ? (fabricObject as any).getViewportTransform()
      : [1, 0, 0, 1, 0, 0];

  // Support normal zoom and also non-trivial viewport matrices safely.
  const viewportScaleX = Math.max(
    0.0001,
    Math.hypot(Number(vpt?.[0]) || 1, Number(vpt?.[1]) || 0)
  );
  const viewportScaleY = Math.max(
    0.0001,
    Math.hypot(Number(vpt?.[2]) || 0, Number(vpt?.[3]) || 1)
  );

  const screenScaleX =
    Math.max(0.0001, Math.abs(Number(objectScaling?.x) || 1)) *
    viewportScaleX;
  const screenScaleY =
    Math.max(0.0001, Math.abs(Number(objectScaling?.y) || 1)) *
    viewportScaleY;

  const localX =
    box.left +
    (Number(currentControl.x || 0) + 0.5) * box.width;
  const localY =
    box.top +
    (Number(currentControl.y || 0) + 0.5) * box.height;

  // Match Fabric's normal oCoords coordinate space.
  const scaledX = localX * screenScaleX;
  const scaledY = localY * screenScaleY;

  const offsetX = Number(currentControl.offsetX || 0);
  const offsetY = Number(currentControl.offsetY || 0);

  return new Point(
    scaledX + offsetX,
    scaledY + offsetY
  ).transform(finalMatrix);
}

function createCurvedAwareTextboxCornerControls(): Record<string, Control> {
  const makeCorner = (x: number, y: number) =>
    new Control({
      x,
      y,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: frameAwareScalingEqually,
      actionName: 'scale',
      render: renderCanvaCornerHandle,
      positionHandler: curvedTextboxControlPositionHandler as any,
    });

  return {
    tl: makeCorner(-0.5, -0.5),
    tr: makeCorner(0.5, -0.5),
    bl: makeCorner(-0.5, 0.5),
    br: makeCorner(0.5, 0.5),
  };
}

function createCurvedAwareTextboxRotationControl(): Control {
  return new Control({
    x: 0,
    y: 0.5,
    offsetX: 0,
    offsetY: 34,
    cursorStyleHandler: controlsUtils.rotationStyleHandler,
    actionHandler: (eventData, transform, x, y) => {
      const target = transform.target;
      if (target && (target as any).isEditing) {
        (target as any).exitEditing?.();
        (target as any).set?.('hoverCursor', 'move');
      }

      return controlsUtils.rotationWithSnapping(
        eventData,
        transform,
        x,
        y
      );
    },
    actionName: 'rotate',
    withConnection: false,
    render: renderCanvaRotationHandle,
    positionHandler: curvedTextboxControlPositionHandler as any,
  });
}

/**
 * Canva-style Textbox controls.
 *
 * Left/right handles change wrapping width without
 * stretching the text.
 */
export function createTextboxCanvaControls(): Record<
  string,
  Control
> {
  return {
    ...createCurvedAwareTextboxCornerControls(),

    ml: new Control({
      x: -0.5,
      y: 0,
      sizeX: 18,
      sizeY: 26,
      touchSizeX: 28,
      touchSizeY: 36,
      cursorStyleHandler:
        controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.changeWidth,
      actionName: 'resizing',
      render: renderCanvaSideHandle(true),
      positionHandler: curvedTextboxControlPositionHandler as any,
    }),

    mr: new Control({
      x: 0.5,
      y: 0,
      sizeX: 18,
      sizeY: 26,
      touchSizeX: 28,
      touchSizeY: 36,
      cursorStyleHandler:
        controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.changeWidth,
      actionName: 'resizing',
      render: renderCanvaSideHandle(true),
      positionHandler: curvedTextboxControlPositionHandler as any,
    }),

    mbr: createCurvedAwareTextboxRotationControl(),
  };
}

/**
 * Controls for normal images, photo frames and image masks.
 *
 * Corner handles preserve proportions.
 * Side handles independently change width or height.
 */
export function createImageCanvaControls(): Record<
  string,
  Control
> {
  return {
    ...createCornerControls(),
    ...createSideScaleControls(),
    mbr: createRotationControl(),
  };
}

/**
 * Apply Canva controls to one Fabric object.
 */
export function applyCanvaControlsToObject(
  obj: FabricObject
): void {
  if (!obj) return;

  const rawType = String((obj as any).type || '')
    .toLowerCase()
    .replace(/[-_\s]/g, '');

  const isText =
    obj instanceof Textbox ||
    obj instanceof IText ||
    rawType === 'textbox' ||
    rawType === 'itext' ||
    rawType === 'text';

  const isImageOrFrame =
    obj instanceof FabricImage ||
    rawType === 'image' ||
    rawType === 'fabricimage' ||
    Boolean(obj.get?.('isFrame' as any)) ||
    Boolean((obj as any).isFrame) ||
    Boolean(obj.get?.('isPhotoShapeGroup' as any)) ||
    Boolean((obj as any).isPhotoShapeGroup) ||
    Boolean(obj.get?.('isCustomFrame' as any)) ||
    Boolean((obj as any).isCustomFrame);

  if (isText) {
    obj.controls = createTextboxCanvaControls();
    obj.hoverCursor = (obj as any).isEditing ? 'text' : 'move';
    obj.moveCursor = 'move';
    obj.set({
      lockScalingFlip: true,
      lockUniScaling: false,
      centeredScaling: false,
    });
  } else if (isImageOrFrame) {
    obj.controls = createImageCanvaControls();

    // Side handles must be allowed to resize one axis.
    (obj as any).lockUniScaling = false;

    obj.set({
      lockScalingX: false,
      lockScalingY: false,
      lockScalingFlip: true,
    });
  } else {
    obj.controls = createCanvaControls();

    (obj as any).lockUniScaling = false;

    obj.set({
      lockScalingX: false,
      lockScalingY: false,
      lockScalingFlip: true,
    });
  }

  const hasActiveTextCurve =
    isText &&
    Boolean((obj as any).path) &&
    Math.abs(Number(obj.get?.('curve' as any) ?? (obj as any).curve ?? 0)) > 0.001 &&
    String(obj.get?.('curveMode' as any) ?? (obj as any).curveMode ?? '') !== 'none';

  obj.set({
    borderColor: CANVA_PURPLE,
    borderScaleFactor: 1.5,
    borderOpacityWhenMoving: 0.95,
    transparentCorners: false,
    cornerColor: '#ffffff',
    cornerStrokeColor: CANVA_PURPLE,
    cornerSize: 13,
    cornerStyle: 'circle',
    selectionBackgroundColor: 'transparent',
    padding: 0,
    hasBorders: true,
  });
}

/**
 * Sets up a rounded rectangle path on ctx for an image that has corner rounding or a Rect clipPath.
 * Returns true if a rounded path was configured, false if it should fall back to a default rectangular stroke.
 */
export function setupImageStrokePath(
  img: FabricImage,
  ctx: CanvasRenderingContext2D
): boolean {
  if (!img) return false;
  const w = img.width || 1;
  const h = img.height || 1;

  let rx = 0;
  let ry = 0;
  if (
    img.clipPath &&
    img.clipPath instanceof Rect &&
    typeof (img.clipPath as any).rx === 'number'
  ) {
    rx = (img.clipPath as any).rx || 0;
    ry = (img.clipPath as any).ry || 0;
  } else if (
    typeof (img as any).cornerRadius === 'number' ||
    typeof (img as any)._requestedRadius === 'number'
  ) {
    const rawR =
      (img as any).cornerRadius ?? (img as any)._requestedRadius ?? 0;
    const geom = getEffectiveCornerRadius(img, rawR);
    rx = geom.rx;
    ry = geom.ry;
  } else if (typeof (img as any).rx === 'number' && (img as any).rx > 0) {
    rx = (img as any).rx;
    ry = typeof (img as any).ry === 'number' ? (img as any).ry : rx;
  }

  if (rx > 0 || ry > 0) {
    drawRoundedRectPath(ctx, -w / 2, -h / 2, w, h, rx, ry);
    return true;
  }
  return false;
}

/**
 * Ensures that ctx has the proper path established before stroke/clip
 * for images, rects, circles, ellipses, triangles, polygons, and paths so inside strokes clip cleanly.
 */
export function ensureObjectStrokePath(
  obj: FabricObject,
  ctx: CanvasRenderingContext2D
): boolean {
  if (!obj) return false;

  const isImg =
    obj instanceof FabricImage ||
    (obj as any).type === 'image' ||
    (obj as any).type === 'FabricImage';

  if (isImg) {
    if (setupImageStrokePath(obj as FabricImage, ctx)) {
      return true;
    }
    const w = obj.width || 1;
    const h = obj.height || 1;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.closePath();
    return true;
  }

  const isRect = obj instanceof Rect || (obj as any).type === 'rect';
  if (isRect) {
    const w = obj.width || 1;
    const h = obj.height || 1;
    const rx = Math.min(Number((obj as any).rx) || 0, w / 2);
    const ry = Math.min(Number((obj as any).ry) || 0, h / 2);
    if (rx > 0 || ry > 0) {
      drawRoundedRectPath(ctx, -w / 2, -h / 2, w, h, rx, ry);
    } else {
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.closePath();
    }
    return true;
  }

  const isCircle = obj instanceof Circle || (obj as any).type === 'circle';
  if (isCircle) {
    const r = Number((obj as any).radius) || ((obj.width || 1) / 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2, false);
    ctx.closePath();
    return true;
  }

  const isEllipse = (obj as any).type === 'ellipse';
  if (isEllipse) {
    const rx = Number((obj as any).rx) || ((obj.width || 1) / 2);
    const ry = Number((obj as any).ry) || ((obj.height || 1) / 2);
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(0, 0, rx, 0, Math.PI * 2, false);
    }
    ctx.closePath();
    return true;
  }

  const isTriangle = (obj as any).type === 'triangle';
  if (isTriangle) {
    const w2 = (obj.width || 1) / 2;
    const h2 = (obj.height || 1) / 2;
    ctx.beginPath();
    ctx.moveTo(-w2, h2);
    ctx.lineTo(0, -h2);
    ctx.lineTo(w2, h2);
    ctx.closePath();
    return true;
  }

  const isPolygon =
    obj instanceof Polygon ||
    (obj as any).type === 'polygon' ||
    (obj as any).type === 'polyline';
  if (isPolygon && Array.isArray((obj as any).points) && (obj as any).points.length > 0) {
    const pts = (obj as any).points;
    const diffX = (obj as any).pathOffset?.x ?? 0;
    const diffY = (obj as any).pathOffset?.y ?? 0;
    ctx.beginPath();
    ctx.moveTo(pts[0].x - diffX, pts[0].y - diffY);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x - diffX, pts[i].y - diffY);
    }
    ctx.closePath();
    return true;
  }

  const isPath = obj instanceof Path || (obj as any).type === 'path';
  if (isPath && (obj as any).path) {
    if (typeof (obj as any)._renderPathCommands === 'function') {
      ctx.beginPath();
      (obj as any)._renderPathCommands(ctx);
      ctx.closePath();
      return true;
    }
  }

  return false;
}

let isGlobalCanvaControlsApplied = false;

/**
 * Apply Canva controls globally.
 */
export function applyCanvaControlsGlobal(): void {
  if (isGlobalCanvaControlsApplied) return;
  isGlobalCanvaControlsApplied = true;

  (FabricObject as any).createControls = () => ({
    controls: createCanvaControls(),
  });

  (Textbox as any).createControls = () => ({
    controls: createTextboxCanvaControls(),
  });

  (IText as any).createControls = () => ({
    controls: createTextboxCanvaControls(),
  });

  (FabricImage as any).createControls = () => ({
    controls: createImageCanvaControls(),
  });

  (ActiveSelection as any).createControls = () => ({
    controls: createCanvaControls(),
  });

  (Rect as any).createControls = () => ({
    controls: createCanvaControls(),
  });

  (Circle as any).createControls = () => ({
    controls: createCanvaControls(),
  });

  (Polygon as any).createControls = () => ({
    controls: createCanvaControls(),
  });

  (Path as any).createControls = () => ({
    controls: createCanvaControls(),
  });

  (Group as any).createControls = () => ({
    controls: createCanvaControls(),
  });

  const applyDefaults = (
    prototype: any,
    controlsFactory: () => Record<string, Control> =
      createCanvaControls
  ) => {
    prototype.controls = controlsFactory();
    prototype.borderColor = CANVA_PURPLE;
    prototype.borderScaleFactor = 1.5;
    prototype.borderOpacityWhenMoving = 0.95;
    prototype.transparentCorners = false;
    prototype.cornerColor = '#ffffff';
    prototype.cornerStrokeColor = CANVA_PURPLE;
    prototype.cornerSize = 13;
    prototype.cornerStyle = 'circle';
    prototype.selectionBackgroundColor = 'transparent';
    prototype.padding = 0;
    prototype.lockScalingFlip = true;
    prototype.lockUniScaling = false;
  };

  const applyTextboxDefaults = (prototype: any) => {
    applyDefaults(
      prototype,
      createTextboxCanvaControls
    );

    prototype.splitByGrapheme = false;
    prototype.cursorColor = '#000000';
    prototype.cursorWidth = 2;

    prototype.dynamicMinWidth = function () {
      return Math.max(24, Number((this as any).fontSize || 16) * 0.8);
    };

    // Text objects show the move / draggable cursor by default when hovering,
    // so users can click and drag them across the canvas immediately like in Canva.
    prototype.hoverCursor = 'move';
    prototype.moveCursor = 'move';

    // In unedited state, mousedown should not register text editing or reset caret,
    // allowing Fabric's canvas to perform normal drag/move transforms like any other object.
    const origMouseDownHandler = prototype._mouseDownHandler;
    prototype._mouseDownHandler = function (options: any) {
      if (!this.isEditing) {
        return;
      }
      return origMouseDownHandler?.call(this, options);
    };

    // Single-click on text selects or drags the text box.
    // Prevent Fabric's default single-click from entering editing mode.
    const origMouseUpHandler = prototype.mouseUpHandler;
    prototype.mouseUpHandler = function (options: any) {
      if (!this.isEditing) {
        if (this.draggableTextDelegate?.end) {
          this.draggableTextDelegate.end(options?.e);
        }
        if (this.canvas) {
          (this.canvas as any).textEditingManager?.unregister?.(this);
        }
        return;
      }
      return origMouseUpHandler?.call(this, options);
    };

    // Draw custom selection frame for curved text, or default for straight text.
    const origDrawBorders = prototype.drawBorders;
    prototype.drawBorders = function (
      ctx: CanvasRenderingContext2D,
      options?: any,
      styleOverride?: any
    ) {
      const box = getCurvedTextSelectionBox(this);
      if (!box) {
        return origDrawBorders?.call(this, ctx, options, styleOverride);
      }

      const objectScaling =
        typeof (this as any).getObjectScaling === 'function'
          ? (this as any).getObjectScaling()
          : new Point(
              Math.abs(Number(this.scaleX) || 1),
              Math.abs(Number(this.scaleY) || 1)
            );

      const vpt =
        typeof (this as any).getViewportTransform === 'function'
          ? (this as any).getViewportTransform()
          : [1, 0, 0, 1, 0, 0];

      const viewportScaleX = Math.max(
        0.0001,
        Math.hypot(Number(vpt?.[0]) || 1, Number(vpt?.[1]) || 0)
      );
      const viewportScaleY = Math.max(
        0.0001,
        Math.hypot(Number(vpt?.[2]) || 0, Number(vpt?.[3]) || 1)
      );

      const screenScaleX =
        Math.max(0.0001, Math.abs(Number(objectScaling?.x) || 1)) *
        viewportScaleX;
      const screenScaleY =
        Math.max(0.0001, Math.abs(Number(objectScaling?.y) || 1)) *
        viewportScaleY;

      ctx.save();
      ctx.strokeStyle = CANVA_PURPLE;
      ctx.lineWidth = Number((this as any).borderScaleFactor || 1.5);
      ctx.strokeRect(
        box.left * screenScaleX,
        box.top * screenScaleY,
        box.width * screenScaleX,
        box.height * screenScaleY
      );
      ctx.restore();
    };

    // Calculate aCoords from curved selection box so Fabric's native hit-testing,
    // bounding box calculations, and selection area enclose the curved text accurately.
    const origCalcACoords = prototype.calcACoords;
    prototype.calcACoords = function () {
      const box = getCurvedTextSelectionBox(this);
      if (!box) {
        return origCalcACoords?.call(this);
      }
      const matrix =
        typeof this.calcTransformMatrix === 'function'
          ? this.calcTransformMatrix()
          : null;
      if (!matrix) {
        return origCalcACoords?.call(this);
      }
      return {
        tl: new Point(box.left, box.top).transform(matrix),
        tr: new Point(box.left + box.width, box.top).transform(matrix),
        br: new Point(box.left + box.width, box.top + box.height).transform(matrix),
        bl: new Point(box.left, box.top + box.height).transform(matrix),
      };
    };

    // Hit-testing includes curved text bounds so clicks on curved glyphs always work.
    const origContainsPoint = prototype.containsPoint;
    prototype.containsPoint = function (point: Point, lines?: any) {
      const box = getCurvedTextSelectionBox(this);
      if (box && typeof (this as any).toLocalPoint === 'function') {
        const localPoint = (this as any).toLocalPoint(point, 'center', 'center');
        if (
          localPoint &&
          localPoint.x >= box.left &&
          localPoint.x <= box.left + box.width &&
          localPoint.y >= box.top &&
          localPoint.y <= box.top + box.height
        ) {
          return true;
        }
      }
      return origContainsPoint?.call(this, point, lines);
    };

    // Double-click enters text editing mode reliably for both straight and curved text.
    const origDoubleClickHandler = prototype.doubleClickHandler;
    prototype.doubleClickHandler = function (options: any) {
      const isLocked =
        typeof this.get === 'function'
          ? this.get('isLocked') === true
          : (this as any).isLocked === true;

      if (!this.isEditing && this.editable !== false && !isLocked) {
        if (this.canvas && this.canvas.getActiveObject() !== this) {
          this.canvas.setActiveObject(this);
        }
        this.enterEditing(options?.e);

        try {
          this.setCursorByClick?.(options?.e);
        } catch {
          // Leave current caret position if pointer mapping fails.
        }

        this.hoverCursor = 'text';

        const focusTextarea = () => {
          const textarea = this.hiddenTextarea as
            | HTMLTextAreaElement
            | undefined;

          if (textarea) {
            try {
              textarea.focus({ preventScroll: true });
            } catch {
              textarea.focus();
            }
          }

          if (this.canvas) {
            this.canvas.setCursor('text');
            this.canvas.requestRenderAll();
          }
        };

        focusTextarea();

        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(focusTextarea);
        }

        return;
      }

      return origDoubleClickHandler?.call(this, options);
    };

    // Synchronize hoverCursor with active text editing state.
    const origEnterEditing = prototype.enterEditing;
    prototype.enterEditing = function (e?: any) {
      const res = origEnterEditing.call(this, e);
      this.hoverCursor = 'text';
      if (this.canvas) {
        this.canvas.setCursor('text');
      }
      return res;
    };

    const origExitEditing = prototype.exitEditing;
    prototype.exitEditing = function () {
      const res = origExitEditing.call(this);
      this.hoverCursor = 'move';
      this.selectable = true;
      this.evented = true;
      const isLocked =
        typeof this.get === 'function'
          ? this.get('isLocked') === true
          : (this as any).isLocked === true;
      if (!isLocked) {
        this.lockMovementX = false;
        this.lockMovementY = false;
        this.hasControls = true;
        this.hasBorders = true;
      }
      this.setCoords?.();
      if (this.canvas) {
        this.canvas.setCursor('move');
        this.canvas.requestRenderAll();
      }
      return res;
    };
  };

  applyDefaults(FabricObject.prototype);
  applyDefaults(ActiveSelection.prototype);

  applyTextboxDefaults(Textbox.prototype);
  applyTextboxDefaults(IText.prototype);

  applyDefaults(
    FabricImage.prototype,
    createImageCanvaControls
  );

  // Important: side handles need independent scaling.
  (FabricImage.prototype as any).lockUniScaling = false;

  applyDefaults(Rect.prototype);
  applyDefaults(Circle.prototype);
  applyDefaults(Polygon.prototype);
  applyDefaults(Path.prototype);
  applyDefaults(Group.prototype);

  if ((FabricObject as any).ownDefaults) {
    applyDefaults((FabricObject as any).ownDefaults);
  }

  // Canva behavior: object bounding box width & height are fixed and do NOT expand when strokeWidth increases
  const origGetNonTransformedDimensions =
    FabricObject.prototype._getNonTransformedDimensions;

  FabricObject.prototype._getNonTransformedDimensions = function () {
    const rawType = String((this as any).type || '')
      .toLowerCase()
      .replace(/[-_\\s]/g, '');
    const isTextObject =
      this instanceof Textbox ||
      this instanceof IText ||
      rawType === 'textbox' ||
      rawType === 'itext' ||
      rawType === 'text';

    // Keep Fabric's native text metrics so text stroke remains a proper
    // vector glyph outline and selection bounds are calculated correctly.
    if (isTextObject) {
      return origGetNonTransformedDimensions.call(this);
    }

    return new Point(this.width, this.height);
  };

  const origGetTransformedDimensions = FabricObject.prototype._getTransformedDimensions;
  FabricObject.prototype._getTransformedDimensions = function (options: any = {}) {
    const rawType = String((this as any).type || '')
      .toLowerCase()
      .replace(/[-_\\s]/g, '');
    const isTextObject =
      this instanceof Textbox ||
      this instanceof IText ||
      rawType === 'textbox' ||
      rawType === 'itext' ||
      rawType === 'text';

    if (isTextObject) {
      return origGetTransformedDimensions.call(this, options);
    }

    const isInside =
      ((this as any).strokePosition ||
        (typeof this.get === 'function'
          ? this.get('strokePosition' as any)
          : null)) !== 'outside';

    if (isInside) {
      return origGetTransformedDimensions.call(this, {
        ...options,
        strokeWidth: 0,
      });
    }

    return origGetTransformedDimensions.call(this, options);
  };

  (FabricObject.prototype as any).isStrokeAccountedForInDimensions = function () {
    const rawType = String((this as any).type || '')
      .toLowerCase()
      .replace(/[-_\\s]/g, '');
    const isTextObject =
      this instanceof Textbox ||
      this instanceof IText ||
      rawType === 'textbox' ||
      rawType === 'itext' ||
      rawType === 'text';

    if (isTextObject) {
      return false;
    }

    const isInside =
      ((this as any).strokePosition ||
        (typeof this.get === 'function'
          ? this.get('strokePosition' as any)
          : null)) !== 'outside';

    return isInside;
  };

  // Canva behavior: FabricImage stroke must respect corner rounding and clipPath
  const origImageStroke = FabricImage.prototype._stroke;
  FabricImage.prototype._stroke = function (ctx: CanvasRenderingContext2D) {
    if (!this.stroke || this.strokeWidth === 0) return;
    const isInside =
      ((this as any).strokePosition ||
        (typeof this.get === 'function'
          ? this.get('strokePosition' as any)
          : null)) !== 'outside';

    const hasExplicitStrokePath = ensureObjectStrokePath(this, ctx);

    if (isInside && hasExplicitStrokePath && typeof ctx.clip === 'function') {
      ctx.save();
      ctx.clip();

      const origWidth = this.strokeWidth;
      this.strokeWidth = origWidth * 2;

      ensureObjectStrokePath(this, ctx);
      origImageStroke.call(this, ctx);

      this.strokeWidth = origWidth;
      ctx.restore();
    } else {
      const hasCustom = setupImageStrokePath(this, ctx);
      if (!hasCustom) {
        origImageStroke.call(this, ctx);
      }
    }
  };

  // Canva behavior: render inside stroke strictly within supported object paths.
  //
  // IMPORTANT:
  // Never run the generic ctx.clip() inside-stroke hack for Textbox/IText.
  // Text glyphs do not expose their letter outlines through ensureObjectStrokePath().
  // Reusing the current canvas path can therefore paint stale rectangular/control
  // geometry inside letters (for example inside A/e). Text must use Fabric's
  // native vector glyph stroke renderer.
  const origRenderStroke = FabricObject.prototype._renderStroke;
  FabricObject.prototype._renderStroke = function (ctx: CanvasRenderingContext2D) {
    if (!this.stroke || this.strokeWidth === 0) return;

    const rawType = String((this as any).type || '')
      .toLowerCase()
      .replace(/[-_\\s]/g, '');

    const isTextObject =
      this instanceof Textbox ||
      this instanceof IText ||
      rawType === 'textbox' ||
      rawType === 'itext' ||
      rawType === 'text';

    if (isTextObject) {
      origRenderStroke.call(this, ctx);
      return;
    }

    const isInside =
      ((this as any).strokePosition ||
        (typeof this.get === 'function'
          ? this.get('strokePosition' as any)
          : null)) !== 'outside';

    // Only clip when we can explicitly build a valid object path.
    // This prevents stale canvas paths from being used for Groups/Polygons/etc.
    const hasExplicitStrokePath = ensureObjectStrokePath(this, ctx);

    if (isInside && hasExplicitStrokePath && typeof ctx.clip === 'function') {
      ctx.save();
      ctx.clip();

      const origWidth = this.strokeWidth;
      this.strokeWidth = origWidth * 2;

      ensureObjectStrokePath(this, ctx);
      origRenderStroke.call(this, ctx);

      this.strokeWidth = origWidth;
      ctx.restore();
    } else {
      origRenderStroke.call(this, ctx);
    }
  };

  // Support additive multi-shadow rendering (e.g. Drop Shadow + Glow aura + Lift simultaneously)
  // and native vector blur filter across all cached and non-cached objects
  const origRender = FabricObject.prototype.render;
  FabricObject.prototype.render = function (ctx: CanvasRenderingContext2D) {
    if (this.isNotVisible()) return;
    if (this.canvas && this.canvas.skipOffscreen && !this.group && !this.isOnScreen()) return;

    const secondaryShadows: Array<{ color: string; blur: number; offsetX?: number; offsetY?: number }> =
      (this as any)._secondaryShadows ||
      ((this as any)._secondaryShadow ? [(this as any)._secondaryShadow] : []);

    // 1. Multi-pass rendering for secondary/compound lighting (Glow aura, Neon aura, Lift, etc.)
    if (secondaryShadows.length > 0) {
      const canvasZoom = this.canvas?.getZoom?.() || 1;
      const retina = typeof (this as any).getCanvasRetinaScaling === 'function' ? (this as any).getCanvasRetinaScaling() : 1;
      const r = canvasZoom * retina;
      const scaling = typeof (this as any).getObjectScaling === 'function' ? (this as any).getObjectScaling() : { x: 1, y: 1 };
      const avgScale = (Math.abs(scaling.x) + Math.abs(scaling.y)) / 2;

      for (const sec of secondaryShadows) {
        if (!sec || !sec.color || sec.color === 'transparent') continue;

        if (requiresSilhouetteShadow(this)) {
          renderSilhouetteShadowPass(this, ctx, sec);
        } else {
          ctx.save();
          (this as any)._setupCompositeOperation?.(ctx);
          this.transform(ctx);
          (this as any)._setOpacity?.(ctx);

          ctx.shadowColor = sec.color;
          ctx.shadowBlur = (sec.blur || 0) * r * avgScale;
          ctx.shadowOffsetX = (sec.offsetX || 0) * r * Math.abs(scaling.x);
          ctx.shadowOffsetY = (sec.offsetY || 0) * r * Math.abs(scaling.y);

          this.drawObject(ctx, false, {});
          ctx.restore();
        }
      }
    }

    // 2. Vector blur filter (for text, paths, shapes)
    const blurVal = Number((this as any)._blurAmount) || 0;
    let didFilter = false;
    if (blurVal > 0 && typeof ctx.filter === 'string') {
      const px = Math.round((blurVal / 100) * 20);
      if (px > 0) {
        ctx.save();
        ctx.filter = `blur(${px}px)`;
        didFilter = true;
      }
    }

    // 3. Render primary object and primary shadow
    origRender.call(this, ctx);

    if (didFilter) {
      ctx.restore();
    }
  };

  installShadowSilhouetteHook();
}
