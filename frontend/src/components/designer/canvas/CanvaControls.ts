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
} from 'fabric';

export const CANVA_PURPLE = '#8b3dff';

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
  const corner = state.corner;

  if (axis === 'x') {
    const requestedDisplayWidth = Math.max(
      (Number(image.width) || 1) * Math.abs(Number(image.scaleX) || 1),
      10
    );

    if (corner === 'mr') {
      const initialCropX = state.initialCropX;
      const availableSourceWidth = Math.max(1, state.sourceWidth - initialCropX);
      const maxUncroppedDisplayWidth = availableSourceWidth * state.renderedPhotoScaleX;

      if (requestedDisplayWidth <= maxUncroppedDisplayWidth) {
        const visibleSourceWidth = Math.max(1, requestedDisplayWidth / state.renderedPhotoScaleX);
        image.set({
          width: visibleSourceWidth,
          cropX: initialCropX,
          scaleX: state.renderedPhotoScaleX,
          objectCaching: false,
        });
      } else {
        // Dragging outward beyond uncropped right edge: increase scaleX so width expands
        const visibleSourceWidth = availableSourceWidth;
        const scaleX = requestedDisplayWidth / visibleSourceWidth;
        image.set({
          width: visibleSourceWidth,
          cropX: initialCropX,
          scaleX,
          objectCaching: false,
        });
      }
      image.setPositionByOrigin(state.anchorPoint as any, 'left', 'center');
    } else if (corner === 'ml') {
      const sourceRight = Math.min(state.sourceWidth, state.initialCropX + state.initialWidth);
      const maxUncroppedDisplayWidth = sourceRight * state.renderedPhotoScaleX;

      if (requestedDisplayWidth <= maxUncroppedDisplayWidth) {
        const visibleSourceWidth = Math.max(1, requestedDisplayWidth / state.renderedPhotoScaleX);
        const cropX = Math.max(0, sourceRight - visibleSourceWidth);
        image.set({
          width: visibleSourceWidth,
          cropX,
          scaleX: state.renderedPhotoScaleX,
          objectCaching: false,
        });
      } else {
        // Dragging outward beyond uncropped left edge: increase scaleX so width expands
        const visibleSourceWidth = Math.max(1, sourceRight);
        const scaleX = requestedDisplayWidth / visibleSourceWidth;
        image.set({
          width: visibleSourceWidth,
          cropX: 0,
          scaleX,
          objectCaching: false,
        });
      }
      image.setPositionByOrigin(state.anchorPoint as any, 'right', 'center');
    } else {
      const scaleX = requestedDisplayWidth / Math.max(Number(image.width) || 1, 1);
      image.set({ scaleX, objectCaching: false });
      image.setPositionByOrigin(state.anchorPoint as any, state.anchorOriginX, state.anchorOriginY);
    }
  } else {
    const requestedDisplayHeight = Math.max(
      (Number(image.height) || 1) * Math.abs(Number(image.scaleY) || 1),
      10
    );

    if (corner === 'mb') {
      const initialCropY = state.initialCropY;
      const availableSourceHeight = Math.max(1, state.sourceHeight - initialCropY);
      const maxUncroppedDisplayHeight = availableSourceHeight * state.renderedPhotoScaleY;

      if (requestedDisplayHeight <= maxUncroppedDisplayHeight) {
        const visibleSourceHeight = Math.max(1, requestedDisplayHeight / state.renderedPhotoScaleY);
        image.set({
          height: visibleSourceHeight,
          cropY: initialCropY,
          scaleY: state.renderedPhotoScaleY,
          objectCaching: false,
        });
      } else {
        // Dragging outward beyond uncropped bottom edge: increase scaleY so height expands
        const visibleSourceHeight = availableSourceHeight;
        const scaleY = requestedDisplayHeight / visibleSourceHeight;
        image.set({
          height: visibleSourceHeight,
          cropY: initialCropY,
          scaleY,
          objectCaching: false,
        });
      }
      image.setPositionByOrigin(state.anchorPoint as any, 'center', 'top');
    } else if (corner === 'mt') {
      const sourceBottom = Math.min(state.sourceHeight, state.initialCropY + state.initialHeight);
      const maxUncroppedDisplayHeight = sourceBottom * state.renderedPhotoScaleY;

      if (requestedDisplayHeight <= maxUncroppedDisplayHeight) {
        const visibleSourceHeight = Math.max(1, requestedDisplayHeight / state.renderedPhotoScaleY);
        const cropY = Math.max(0, sourceBottom - visibleSourceHeight);
        image.set({
          height: visibleSourceHeight,
          cropY,
          scaleY: state.renderedPhotoScaleY,
          objectCaching: false,
        });
      } else {
        // Dragging outward beyond uncropped top edge: increase scaleY so height expands
        const visibleSourceHeight = Math.max(1, sourceBottom);
        const scaleY = requestedDisplayHeight / visibleSourceHeight;
        image.set({
          height: visibleSourceHeight,
          cropY: 0,
          scaleY,
          objectCaching: false,
        });
      }
      image.setPositionByOrigin(state.anchorPoint as any, 'center', 'bottom');
    } else {
      const scaleY = requestedDisplayHeight / Math.max(Number(image.height) || 1, 1);
      image.set({ scaleY, objectCaching: false });
      image.setPositionByOrigin(state.anchorPoint as any, state.anchorOriginX, state.anchorOriginY);
    }
  }

  image.set('dirty' as any, true);
  image.setCoords();
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

  photo.set({
    scaleX: state.renderedPhotoScaleX / groupScaleX,
    scaleY: state.renderedPhotoScaleY / groupScaleY,
    objectCaching: false,
  });

  const clipPath = photo.clipPath as FabricObject | undefined;
  if (clipPath) {
    clipPath.set({
      scaleX:
        viewportWidth /
        state.renderedPhotoScaleX /
        Math.max(Number(clipPath.width) || 1, 1),
      scaleY:
        viewportHeight /
        state.renderedPhotoScaleY /
        Math.max(Number(clipPath.height) || 1, 1),
      objectCaching: false,
    });
    clipPath.setCoords();
  }

  photo.setCoords();
  target.setPositionByOrigin(
    state.anchorPoint as any,
    state.anchorOriginX,
    state.anchorOriginY
  );
  target.setCoords();
  target.set('dirty' as any, true);
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

function createRotationControl(): Control {
  return new Control({
    x: 0,
    y: 0.5,
    offsetY: 34,
    cursorStyleHandler:
      controlsUtils.rotationStyleHandler,
    actionHandler:
      controlsUtils.rotationWithSnapping,
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
    ...createCornerControls(),

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
    }),

    mbr: createRotationControl(),
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
  });
}

/**
 * Apply Canva controls globally.
 */
export function applyCanvaControlsGlobal(): void {
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

    prototype.splitByGrapheme = true;

    prototype.dynamicMinWidth = function () {
      return 10;
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

    // Double-click enters text editing mode.
    const origDoubleClickHandler = prototype.doubleClickHandler;
    prototype.doubleClickHandler = function (options: any) {
      if (!this.isEditing && this.editable !== false) {
        this.enterEditing(options?.e);
        this.setCursorByClick?.(options?.e);
        this.hoverCursor = 'text';
        if (this.canvas) {
          this.canvas.setCursor('text');
          this.canvas.requestRenderAll();
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
      if (this.canvas) {
        this.canvas.setCursor('move');
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
}
