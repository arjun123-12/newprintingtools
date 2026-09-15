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
      actionHandler: controlsUtils.scalingEqually,
      actionName: 'scale',
      render: renderCanvaCornerHandle,
    }),

    tr: new Control({
      x: 0.5,
      y: -0.5,
      cursorStyleHandler:
        controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      actionName: 'scale',
      render: renderCanvaCornerHandle,
    }),

    bl: new Control({
      x: -0.5,
      y: 0.5,
      cursorStyleHandler:
        controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      actionName: 'scale',
      render: renderCanvaCornerHandle,
    }),

    br: new Control({
      x: 0.5,
      y: 0.5,
      cursorStyleHandler:
        controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
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
      actionHandler: controlsUtils.scalingX,
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
      actionHandler: controlsUtils.scalingX,
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
      actionHandler: controlsUtils.scalingY,
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
      actionHandler: controlsUtils.scalingY,
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