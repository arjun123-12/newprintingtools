import { Canvas, FabricObject, Group, ActiveSelection } from 'fabric';
import { CanvasDimensions, UnitType } from '@/types/designer';

export interface BoundingRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  object?: FabricObject;
}

export interface DistanceMeasurement {
  id: string;
  type: 'horizontal' | 'vertical';
  startPx: number;
  endPx: number;
  orthoPosPx: number;
  distancePx: number;
  formattedText: string;
  isEqualSpacing?: boolean;
  sourceBox: BoundingRect;
  targetBox: BoundingRect;
}

export class SmartSpacingManager {
  private canvas: Canvas | null = null;
  private dimensions: CanvasDimensions;
  private isEnabled: boolean = true;
  private activeMeasurements: DistanceMeasurement[] = [];

  constructor(dimensions: CanvasDimensions) {
    this.dimensions = dimensions;
  }

  public attach(canvas: Canvas): void {
    this.canvas = canvas;
  }

  public detach(): void {
    this.canvas = null;
    this.activeMeasurements = [];
  }

  public updateDimensions(dims: CanvasDimensions): void {
    this.dimensions = dims;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public clear(): void {
    if (this.activeMeasurements.length > 0) {
      this.activeMeasurements = [];
      this.canvas?.requestRenderAll();
    }
  }

  /**
   * Main calculation handler triggered during object:moving or selection transforms.
   */
  public handleObjectMove(target: FabricObject): void {
    if (!this.isEnabled || !this.canvas || !target) return;

    const collected = this.collectCandidates(target);
    if (!collected || collected.candidates.length === 0) {
      this.clear();
      return;
    }

    const { targetBox, candidates } = collected;
    const measurements: DistanceMeasurement[] = [];

    let nearestLeft: { box: BoundingRect; gap: number } | null = null;
    let nearestRight: { box: BoundingRect; gap: number } | null = null;
    let nearestTop: { box: BoundingRect; gap: number } | null = null;
    let nearestBottom: { box: BoundingRect; gap: number } | null = null;

    for (const c of candidates) {
      // 1. Horizontal Spacing Candidate Evaluation (Left / Right)
      const verticalOverlap =
        Math.max(c.top, targetBox.top) < Math.min(c.bottom, targetBox.bottom);
      const verticalNearAlign =
        Math.abs(c.centerY - targetBox.centerY) <=
        Math.max(c.height, targetBox.height) / 2 + 60;

      if (verticalOverlap || verticalNearAlign) {
        // Candidate is to the left of the moving target
        if (c.right <= targetBox.left) {
          const gap = targetBox.left - c.right;
          if (gap >= 0.5 && (!nearestLeft || gap < nearestLeft.gap)) {
            nearestLeft = { box: c, gap };
          }
        }
        // Candidate is to the right of the moving target
        else if (c.left >= targetBox.right) {
          const gap = c.left - targetBox.right;
          if (gap >= 0.5 && (!nearestRight || gap < nearestRight.gap)) {
            nearestRight = { box: c, gap };
          }
        }
      }

      // 2. Vertical Spacing Candidate Evaluation (Top / Bottom)
      const horizontalOverlap =
        Math.max(c.left, targetBox.left) < Math.min(c.right, targetBox.right);
      const horizontalNearAlign =
        Math.abs(c.centerX - targetBox.centerX) <=
        Math.max(c.width, targetBox.width) / 2 + 60;

      if (horizontalOverlap || horizontalNearAlign) {
        // Candidate is above the moving target
        if (c.bottom <= targetBox.top) {
          const gap = targetBox.top - c.bottom;
          if (gap >= 0.5 && (!nearestTop || gap < nearestTop.gap)) {
            nearestTop = { box: c, gap };
          }
        }
        // Candidate is below the moving target
        else if (c.top >= targetBox.bottom) {
          const gap = c.top - targetBox.bottom;
          if (gap >= 0.5 && (!nearestBottom || gap < nearestBottom.gap)) {
            nearestBottom = { box: c, gap };
          }
        }
      }
    }

    const zoom = Math.max(this.canvas.getZoom() || 1, 0.01);
    const equalTolerance = 4 / zoom;

    // Detect equal spacing between 3 elements (Canva Smart Spacing)
    const horizEqual =
      Boolean(nearestLeft && nearestRight) &&
      Math.abs((nearestLeft?.gap || 0) - (nearestRight?.gap || 0)) <= equalTolerance;

    const vertEqual =
      Boolean(nearestTop && nearestBottom) &&
      Math.abs((nearestTop?.gap || 0) - (nearestBottom?.gap || 0)) <= equalTolerance;

    // Build Nearest Left Measurement
    if (nearestLeft) {
      const c = nearestLeft.box;
      const overlapTop = Math.max(c.top, targetBox.top);
      const overlapBottom = Math.min(c.bottom, targetBox.bottom);
      const orthoY =
        overlapTop < overlapBottom
          ? (overlapTop + overlapBottom) / 2
          : (c.centerY + targetBox.centerY) / 2;

      measurements.push({
        id: `meas_h_left_${Date.now()}`,
        type: 'horizontal',
        startPx: c.right,
        endPx: targetBox.left,
        orthoPosPx: orthoY,
        distancePx: nearestLeft.gap,
        formattedText: this.convertDistance(nearestLeft.gap),
        isEqualSpacing: horizEqual,
        sourceBox: c,
        targetBox,
      });
    }

    // Build Nearest Right Measurement
    if (nearestRight) {
      const c = nearestRight.box;
      const overlapTop = Math.max(c.top, targetBox.top);
      const overlapBottom = Math.min(c.bottom, targetBox.bottom);
      const orthoY =
        overlapTop < overlapBottom
          ? (overlapTop + overlapBottom) / 2
          : (c.centerY + targetBox.centerY) / 2;

      measurements.push({
        id: `meas_h_right_${Date.now()}`,
        type: 'horizontal',
        startPx: targetBox.right,
        endPx: c.left,
        orthoPosPx: orthoY,
        distancePx: nearestRight.gap,
        formattedText: this.convertDistance(nearestRight.gap),
        isEqualSpacing: horizEqual,
        sourceBox: targetBox,
        targetBox: c,
      });
    }

    // Build Nearest Top Measurement
    if (nearestTop) {
      const c = nearestTop.box;
      const overlapLeft = Math.max(c.left, targetBox.left);
      const overlapRight = Math.min(c.right, targetBox.right);
      const orthoX =
        overlapLeft < overlapRight
          ? (overlapLeft + overlapRight) / 2
          : (c.centerX + targetBox.centerX) / 2;

      measurements.push({
        id: `meas_v_top_${Date.now()}`,
        type: 'vertical',
        startPx: c.bottom,
        endPx: targetBox.top,
        orthoPosPx: orthoX,
        distancePx: nearestTop.gap,
        formattedText: this.convertDistance(nearestTop.gap),
        isEqualSpacing: vertEqual,
        sourceBox: c,
        targetBox,
      });
    }

    // Build Nearest Bottom Measurement
    if (nearestBottom) {
      const c = nearestBottom.box;
      const overlapLeft = Math.max(c.left, targetBox.left);
      const overlapRight = Math.min(c.right, targetBox.right);
      const orthoX =
        overlapLeft < overlapRight
          ? (overlapLeft + overlapRight) / 2
          : (c.centerX + targetBox.centerX) / 2;

      measurements.push({
        id: `meas_v_bottom_${Date.now()}`,
        type: 'vertical',
        startPx: targetBox.bottom,
        endPx: c.top,
        orthoPosPx: orthoX,
        distancePx: nearestBottom.gap,
        formattedText: this.convertDistance(nearestBottom.gap),
        isEqualSpacing: vertEqual,
        sourceBox: targetBox,
        targetBox: c,
      });
    }

    this.activeMeasurements = measurements;
    if (measurements.length > 0) {
      this.canvas.requestRenderAll();
    }
  }

  /**
   * Converts a canvas distance in pixels to the user's active document unit (mm, in, px).
   */
  public convertDistance(distancePx: number): string {
    if (distancePx <= 0) return '0';

    const unit: UnitType = (this.dimensions as any).unit || 'mm';
    const widthPx = this.dimensions.widthPx || 1063;
    const widthMm = this.dimensions.widthMm || 90;
    const dpi = this.dimensions.dpi || 300;

    let pxPerMm = widthPx / widthMm;
    if (!Number.isFinite(pxPerMm) || pxPerMm <= 0) {
      pxPerMm = dpi / 25.4;
    }

    if (unit === 'px') {
      const roundPx = Math.round(distancePx);
      return `${roundPx} px`;
    } else if (unit === 'in') {
      const inches = distancePx / pxPerMm / 25.4;
      const formatted = inches
        .toFixed(2)
        .replace(/\.00$/, '')
        .replace(/(\.\d)0$/, '$1');
      return `${formatted} in`;
    } else {
      // Default unit: mm
      const mm = distancePx / pxPerMm;
      const formatted = mm.toFixed(1).replace(/\.0$/, '');
      return `${formatted} mm`;
    }
  }

  /**
   * Renders Canva-style measurement lines, end ticks, and compact distance badges
   * onto the overlay canvas during after:render.
   */
  public renderMeasurements(
    ctx: CanvasRenderingContext2D,
    fallbackZoom = 1
  ): void {
    if (!this.canvas || this.activeMeasurements.length === 0) return;

    if (!(this.canvas as any)._currentTransform) {
      this.activeMeasurements = [];
      return;
    }

    const viewportZoom = Math.max(this.canvas.getZoom() || 1, 0.01);
    const displayZoom = this.getDisplayZoom(fallbackZoom);

    ctx.save();
    ctx.scale(viewportZoom, viewportZoom);

    for (const m of this.activeMeasurements) {
      const isHoriz = m.type === 'horizontal';
      const isEqual = Boolean(m.isEqualSpacing);

      // Color Palette:
      // Normal Spacing: Canva Purple (#8b3dff)
      // Equal Spacing: Vibrant Canva Pink/Magenta (#ec4899)
      const lineColor = isEqual ? '#ec4899' : '#8b3dff';
      const badgeBgColor = isEqual ? '#ec4899' : '#8b3dff';

      const lineWidth = (isEqual ? 1.75 : 1.25) / displayZoom;
      const tickLen = 4.5 / displayZoom;
      const fontSize = 10 / displayZoom;

      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([]);

      if (isHoriz) {
        // Horizontal main line
        ctx.moveTo(m.startPx, m.orthoPosPx);
        ctx.lineTo(m.endPx, m.orthoPosPx);
        ctx.stroke();

        // End ticks (vertical lines)
        ctx.beginPath();
        ctx.moveTo(m.startPx, m.orthoPosPx - tickLen);
        ctx.lineTo(m.startPx, m.orthoPosPx + tickLen);
        ctx.moveTo(m.endPx, m.orthoPosPx - tickLen);
        ctx.lineTo(m.endPx, m.orthoPosPx + tickLen);
        ctx.stroke();

        // Centered badge
        const midX = (m.startPx + m.endPx) / 2;
        const midY = m.orthoPosPx;
        this.drawBadge(
          ctx,
          m.formattedText,
          midX,
          midY,
          badgeBgColor,
          fontSize,
          displayZoom
        );
      } else {
        // Vertical main line
        ctx.moveTo(m.orthoPosPx, m.startPx);
        ctx.lineTo(m.orthoPosPx, m.endPx);
        ctx.stroke();

        // End ticks (horizontal lines)
        ctx.beginPath();
        ctx.moveTo(m.orthoPosPx - tickLen, m.startPx);
        ctx.lineTo(m.orthoPosPx + tickLen, m.startPx);
        ctx.moveTo(m.orthoPosPx - tickLen, m.endPx);
        ctx.lineTo(m.orthoPosPx + tickLen, m.endPx);
        ctx.stroke();

        // Centered badge
        const midX = m.orthoPosPx;
        const midY = (m.startPx + m.endPx) / 2;
        this.drawBadge(
          ctx,
          m.formattedText,
          midX,
          midY,
          badgeBgColor,
          fontSize,
          displayZoom
        );
      }
    }

    ctx.restore();
  }

  /**
   * Filters all valid top-level objects on the canvas and returns transformed bounding boxes.
   */
  private collectCandidates(
    target: FabricObject
  ): { targetBox: BoundingRect; candidates: BoundingRect[] } | null {
    if (!this.canvas) return null;

    const targetBound = target.getBoundingRect();
    const targetBox: BoundingRect = {
      left: targetBound.left,
      top: targetBound.top,
      right: targetBound.left + targetBound.width,
      bottom: targetBound.top + targetBound.height,
      width: targetBound.width,
      height: targetBound.height,
      centerX: targetBound.left + targetBound.width / 2,
      centerY: targetBound.top + targetBound.height / 2,
      object: target,
    };

    const activeSelectionObjects = new Set<FabricObject>();
    if (target instanceof ActiveSelection || target instanceof Group) {
      target.getObjects().forEach((o) => activeSelectionObjects.add(o));
    }

    const candidates: BoundingRect[] = [];
    const allObjects = this.canvas.getObjects();

    for (const obj of allObjects) {
      if (!obj) continue;
      if (obj === target) continue;
      if (activeSelectionObjects.has(obj)) continue;
      if (!obj.visible || obj.opacity === 0) continue;

      const isNonCandidate = Boolean(
        (obj as any).isGuide ||
        (obj as any).isPrintGuide ||
        (obj as any).isBackground ||
        (obj as any).excludeFromExport ||
        (obj as any).isHelper ||
        (obj as any).isCropMark ||
        (obj as any).name === 'grid' ||
        (obj as any).get?.('name') === 'grid' ||
        (obj as any).get?.('isGuide') ||
        (obj as any).get?.('isPrintGuide') ||
        (obj as any).get?.('isBackground')
      );
      if (isNonCandidate) continue;

      const bound = obj.getBoundingRect();
      if (bound.width <= 0 || bound.height <= 0) continue;

      candidates.push({
        left: bound.left,
        top: bound.top,
        right: bound.left + bound.width,
        bottom: bound.top + bound.height,
        width: bound.width,
        height: bound.height,
        centerX: bound.left + bound.width / 2,
        centerY: bound.top + bound.height / 2,
        object: obj,
      });
    }

    return { targetBox, candidates };
  }

  /**
   * Helper to draw a compact, high-contrast distance badge with rounded corners.
   */
  private drawBadge(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    centerY: number,
    bgColor: string,
    fontSize: number,
    displayZoom: number
  ): void {
    ctx.save();
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const paddingX = 6 / displayZoom;
    const paddingY = 3 / displayZoom;
    const badgeWidth = textWidth + paddingX * 2;
    const badgeHeight = fontSize + paddingY * 2;
    const borderRadius = 4 / displayZoom;

    const left = centerX - badgeWidth / 2;
    const top = centerY - badgeHeight / 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 4 / displayZoom;
    ctx.shadowOffsetY = 1 / displayZoom;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(left, top, badgeWidth, badgeHeight, borderRadius);
    } else {
      ctx.rect(left, top, badgeWidth, badgeHeight);
    }
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, centerX, centerY);

    ctx.restore();
  }

  /**
   * Effective display zoom accounting for Fabric viewport zoom and CSS canvas scaling.
   */
  private getDisplayZoom(fallbackZoom = 1): number {
    if (!this.canvas) return Math.max(fallbackZoom || 1, 0.01);

    const viewportZoom = Math.max(this.canvas.getZoom() || 1, 0.01);
    const backingWidth = Math.max(this.canvas.getWidth() || 1, 1);
    const displayedWidth =
      this.canvas.upperCanvasEl?.getBoundingClientRect().width || 0;
    const cssScale = displayedWidth > 0 ? displayedWidth / backingWidth : 1;
    const effectiveZoom = viewportZoom * cssScale;

    return Math.max(
      Number.isFinite(effectiveZoom) && effectiveZoom > 0
        ? effectiveZoom
        : fallbackZoom || 1,
      0.01
    );
  }
}
