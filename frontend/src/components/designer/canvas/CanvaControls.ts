import {
  Control,
  controlsUtils,
  FabricObject,
  ActiveSelection,
} from 'fabric';

/**
 * Renders a clean Canva-style circular corner handle.
 * Small white circle with subtle drop shadow and crisp border.
 */
export function renderCanvaCornerHandle(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  styleOverride: any,
  fabricObject: FabricObject
): void {
  const size = 12;
  const radius = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(left, top, radius, 0, Math.PI * 2, false);

  // Soft shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Reset shadow for crisp border stroke
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#2563eb';
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
    const w = isVertical ? 6 : 14;
    const h = isVertical ? 14 : 6;
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
    ctx.strokeStyle = '#2563eb';
    ctx.stroke();

    ctx.restore();
  };
}

/**
 * Renders a Canva-style circular rotation handle with rotation icon and connecting stalk line.
 */
export function renderCanvaRotationHandle(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  styleOverride: any,
  fabricObject: FabricObject
): void {
  const size = 18;
  const radius = size / 2;

  ctx.save();

  // Draw white circular handle with shadow
  ctx.beginPath();
  ctx.arc(left, top, radius, 0, Math.PI * 2, false);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1.5;

  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#2563eb';
  ctx.stroke();

  // Draw curved rotation arrows icon inside the circle
  ctx.save();
  ctx.translate(left, top);
  const angle = fabricObject.angle || 0;
  ctx.rotate((angle * Math.PI) / 180);

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  // Arc 1 (top-right)
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, -0.2 * Math.PI, 0.7 * Math.PI, false);
  ctx.stroke();

  // Arrowhead 1
  ctx.beginPath();
  ctx.moveTo(3, -4);
  ctx.lineTo(4.5, -1.5);
  ctx.lineTo(1.5, -1.5);
  ctx.stroke();

  // Arc 2 (bottom-left)
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0.8 * Math.PI, 1.7 * Math.PI, false);
  ctx.stroke();

  // Arrowhead 2
  ctx.beginPath();
  ctx.moveTo(-3, 4);
  ctx.lineTo(-4.5, 1.5);
  ctx.lineTo(-1.5, 1.5);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}

/**
 * Creates the complete set of Canva-style controls.
 */
export function createCanvaControls(): Record<string, Control> {
  const controls: Record<string, Control> = {
    // Corner Resize Handles
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

    // Side Resize Handles
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

    // Canva Rotation Handle positioned with stalk line above top edge
    mtr: new Control({
      x: 0,
      y: -0.5,
      offsetY: -32,
      cursorStyleHandler: controlsUtils.rotationStyleHandler,
      actionHandler: controlsUtils.rotationWithSnapping,
      actionName: 'rotate',
      withConnection: true,
      render: renderCanvaRotationHandle,
    }),
  };

  return controls;
}

/**
 * Apply Canva style frame and handles globally to FabricObject and ActiveSelection prototypes.
 */
export function applyCanvaControlsGlobal(): void {
  const canvaControls = createCanvaControls();

  // Apply default object styling
  FabricObject.prototype.controls = canvaControls;
  FabricObject.prototype.borderColor = '#2563eb';
  FabricObject.prototype.borderScaleFactor = 1.5;
  FabricObject.prototype.borderOpacityWhenMoving = 0.9;
  FabricObject.prototype.transparentCorners = false;
  FabricObject.prototype.cornerColor = '#ffffff';
  FabricObject.prototype.cornerStrokeColor = '#2563eb';
  FabricObject.prototype.cornerSize = 12;
  FabricObject.prototype.cornerStyle = 'circle';

  // Apply to ActiveSelection
  ActiveSelection.prototype.controls = createCanvaControls();
  ActiveSelection.prototype.borderColor = '#2563eb';
  ActiveSelection.prototype.borderScaleFactor = 1.5;
}
