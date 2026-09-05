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

/**
 * Canva's signature brand purple color for active selection borders and handles.
 */
export const CANVA_PURPLE = '#8b3dff';

/**
 * Renders a clean Canva-style circular corner handle.
 * Large crisp white circle with subtle drop shadow and Canva purple border.
 */
export function renderCanvaCornerHandle(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  styleOverride: any,
  fabricObject: FabricObject
): void {
  const size = 13;
  const radius = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(left, top, radius, 0, Math.PI * 2, false);

  // Soft subtle shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Crisp border stroke in Canva purple
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CANVA_PURPLE;
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders a clean Canva-style side midpoint handle (pill / capsule).
 */
export function renderCanvaSideHandle(isVertical: boolean) {
  return function (
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    styleOverride: any,
    fabricObject: FabricObject
  ): void {
    const w = isVertical ? 6 : 16;
    const h = isVertical ? 16 : 6;
    const r = 3;

    ctx.save();
    // Rotate along with the object's angle
    const angle = fabricObject.angle || 0;
    ctx.translate(left, top);
    ctx.rotate((angle * Math.PI) / 180);

    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(-w / 2, -h / 2, w, h, r);
    } else {
      ctx.rect(-w / 2, -h / 2, w, h);
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
 * Renders Canva's signature circular rotation button with connecting stem
 * (White circular button with shadow, subtle border, and black double-arrow cycle icon).
 */
export function renderCanvaRotationHandle(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  styleOverride: any,
  fabricObject: FabricObject
): void {
  const size = 26;
  const radius = size / 2;
  const angle = fabricObject.angle || 0;
  const rad = (angle * Math.PI) / 180;

  ctx.save();

  // 1. Draw connecting stem line from object bottom edge to rotation button
  const stemLength = 21;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(rad);
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, -radius - stemLength);
  ctx.strokeStyle = CANVA_PURPLE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 2. Draw floating white circular button with soft shadow
  ctx.beginPath();
  ctx.arc(left, top, radius, 0, Math.PI * 2, false);

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

  // 3. Draw black double cycle rotation arrows inside
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(rad);

  ctx.strokeStyle = '#1e293b'; // Charcoal Black
  ctx.fillStyle = '#1e293b';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const arcRadius = 5.4;

  // Arc 1 (Right / Top side)
  ctx.beginPath();
  ctx.arc(0, 0, arcRadius, -0.22 * Math.PI, 0.72 * Math.PI, false);
  ctx.stroke();

  // Arrowhead 1 (pointing counter-clockwise)
  ctx.beginPath();
  ctx.moveTo(3.2, -4.8);
  ctx.lineTo(5.8, -2.2);
  ctx.lineTo(2.4, -2.2);
  ctx.closePath();
  ctx.fill();

  // Arc 2 (Left / Bottom side)
  ctx.beginPath();
  ctx.arc(0, 0, arcRadius, 0.78 * Math.PI, 1.72 * Math.PI, false);
  ctx.stroke();

  // Arrowhead 2 (pointing clockwise)
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
 * Creates the standard Canva-style controls for Shapes, Images & Rectangles.
 */
export function createCanvaControls(): Record<string, Control> {
  const controls: Record<string, Control> = {
    tl: new Control({
      x: -0.5,
      y: -0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderCanvaCornerHandle,
    }),
    tr: new Control({
      x: 0.5,
      y: -0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderCanvaCornerHandle,
    }),
    bl: new Control({
      x: -0.5,
      y: 0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderCanvaCornerHandle,
    }),
    br: new Control({
      x: 0.5,
      y: 0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderCanvaCornerHandle,
    }),

    ml: new Control({
      x: -0.5,
      y: 0,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.scalingX,
      render: renderCanvaSideHandle(true),
    }),
    mr: new Control({
      x: 0.5,
      y: 0,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.scalingX,
      render: renderCanvaSideHandle(true),
    }),
    mt: new Control({
      x: 0,
      y: -0.5,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.scalingY,
      render: renderCanvaSideHandle(false),
    }),
    mb: new Control({
      x: 0,
      y: 0.5,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.scalingY,
      render: renderCanvaSideHandle(false),
    }),

    mbr: new Control({
      x: 0,
      y: 0.5,
      offsetY: 34,
      cursorStyleHandler: controlsUtils.rotationStyleHandler,
      actionHandler: controlsUtils.rotationWithSnapping,
      actionName: 'rotate',
      withConnection: false,
      render: renderCanvaRotationHandle,
    }),
  };

  return controls;
}

/**
 * Creates specialized Canva-style controls for Textbox elements.
 * Side handles (`ml`, `mr`) use `changeWidth` so stretching/compressing
 * reflows text into 1 line or breaks into multiple lines without distorting font size!
 */
export function createTextboxCanvaControls(): Record<string, Control> {
  const controls: Record<string, Control> = {
    // Corner Resize Handles (White Circles with Purple Border) - scales font size
    tl: new Control({
      x: -0.5,
      y: -0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderCanvaCornerHandle,
    }),
    tr: new Control({
      x: 0.5,
      y: -0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderCanvaCornerHandle,
    }),
    bl: new Control({
      x: -0.5,
      y: 0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderCanvaCornerHandle,
    }),
    br: new Control({
      x: 0.5,
      y: 0.5,
      cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
      actionHandler: controlsUtils.scalingEqually,
      render: renderCanvaCornerHandle,
    }),

    // Side Handles (White Pill/Capsules) - ONLY Left & Right side handles for Textbox using changeWidth!
    ml: new Control({
      x: -0.5,
      y: 0,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.changeWidth,
      render: renderCanvaSideHandle(true),
    }),
    mr: new Control({
      x: 0.5,
      y: 0,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionHandler: controlsUtils.changeWidth,
      render: renderCanvaSideHandle(true),
    }),

    // Canva Rotation Handle
    mbr: new Control({
      x: 0,
      y: 0.5,
      offsetY: 34,
      cursorStyleHandler: controlsUtils.rotationStyleHandler,
      actionHandler: controlsUtils.rotationWithSnapping,
      actionName: 'rotate',
      withConnection: false,
      render: renderCanvaRotationHandle,
    }),
  };

  return controls;
}

/**
 * Explicitly applies Canva styling and controls to a single FabricObject instance.
 */
export function applyCanvaControlsToObject(obj: FabricObject): void {
  if (!obj) return;
  const isText =
    obj instanceof Textbox ||
    obj instanceof IText ||
    (obj as any).type === 'textbox' ||
    (obj as any).type === 'i-text';

  obj.controls = isText ? createTextboxCanvaControls() : createCanvaControls();
  obj.borderColor = CANVA_PURPLE;
  obj.borderScaleFactor = 1.5;
  obj.borderOpacityWhenMoving = 0.95;
  obj.transparentCorners = false;
  obj.cornerColor = '#ffffff';
  obj.cornerStrokeColor = CANVA_PURPLE;
  obj.cornerSize = 13;
  obj.cornerStyle = 'circle';
  obj.selectionBackgroundColor = 'transparent';
  obj.padding = 0;
}

/**
 * Apply Canva style frame and handles globally to FabricObject, ActiveSelection and all element prototypes.
 */
export function applyCanvaControlsGlobal(): void {
  const canvaControls = createCanvaControls();
  const textboxControls = createTextboxCanvaControls();

  const applyDefaults = (proto: any, customControls?: Record<string, Control>) => {
    proto.controls = customControls || canvaControls;
    proto.borderColor = CANVA_PURPLE;
    proto.borderScaleFactor = 1.5;
    proto.borderOpacityWhenMoving = 0.95;
    proto.transparentCorners = false;
    proto.cornerColor = '#ffffff';
    proto.cornerStrokeColor = CANVA_PURPLE;
    proto.cornerSize = 13;
    proto.cornerStyle = 'circle';
    proto.selectionBackgroundColor = 'transparent';
    proto.padding = 0;
  };

  const applyTextboxDefaults = (proto: any) => {
    proto.controls = textboxControls;
    proto.borderColor = CANVA_PURPLE;
    proto.borderScaleFactor = 1.5;
    proto.borderOpacityWhenMoving = 0.95;
    proto.transparentCorners = false;
    proto.cornerColor = '#ffffff';
    proto.cornerStrokeColor = CANVA_PURPLE;
    proto.cornerSize = 13;
    proto.cornerStyle = 'circle';
    proto.selectionBackgroundColor = 'transparent';
    proto.padding = 0;
    proto.splitByGrapheme = true;
    proto.dynamicMinWidth = function () {
      return 10;
    };
  };

  applyDefaults(FabricObject.prototype);
  applyDefaults(ActiveSelection.prototype);
  applyTextboxDefaults(Textbox.prototype);
  applyTextboxDefaults(IText.prototype);
  applyDefaults(FabricImage.prototype);
  applyDefaults(Rect.prototype);
  applyDefaults(Circle.prototype);
  applyDefaults(Polygon.prototype);
  applyDefaults(Path.prototype);
  applyDefaults(Group.prototype);

  if ((FabricObject as any).ownDefaults) {
    applyDefaults((FabricObject as any).ownDefaults);
  }
}
