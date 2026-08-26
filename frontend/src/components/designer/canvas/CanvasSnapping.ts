import { Canvas, FabricObject } from 'fabric';
import { CanvasDimensions } from '@/types/designer';

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  pos: number; // X for vertical, Y for horizontal
  start: number; // Y1 for vertical, X1 for horizontal
  end: number; // Y2 for vertical, X2 for horizontal
  category: 'canvas-center' | 'object-edge' | 'object-center' | 'spacing';
  label?: string;
  spacingDist?: number;
}

export interface SpacingBadge {
  x: number;
  y: number;
  width: number;
  height: number;
  dist: number;
  orientation: 'horizontal' | 'vertical';
}

export class CanvasSnapping {
  private canvas: Canvas | null = null;
  private dimensions: CanvasDimensions;
  private activeGuides: AlignmentGuide[] = [];
  private spacingBadges: SpacingBadge[] = [];
  private isEnabled: boolean = true;
  private snapThreshold: number = 6; // px in document space

  constructor(dimensions: CanvasDimensions) {
    this.dimensions = dimensions;
  }

  public attach(canvas: Canvas): void {
    this.canvas = canvas;
  }

  public detach(): void {
    this.canvas = null;
    this.activeGuides = [];
    this.spacingBadges = [];
  }

  public updateDimensions(dims: CanvasDimensions): void {
    this.dimensions = dims;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearGuides();
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public clearGuides(): void {
    if (this.activeGuides.length > 0 || this.spacingBadges.length > 0) {
      this.activeGuides = [];
      this.spacingBadges = [];
      this.canvas?.requestRenderAll();
    }
  }

  /**
   * Snapping calculation called on object:moving and object:scaling
   */
  public handleObjectMove(target: FabricObject): void {
    if (!this.isEnabled || !this.canvas) return;

    this.activeGuides = [];
    this.spacingBadges = [];

    const canvasW = this.dimensions.widthPx || 1063;
    const canvasH = this.dimensions.heightPx || 591;
    const canvasCenterX = canvasW / 2;
    const canvasCenterY = canvasH / 2;

    const bound = target.getBoundingRect();
    const targetW = bound.width;
    const targetH = bound.height;
    let targetLeft = bound.left;
    let targetTop = bound.top;
    let targetRight = targetLeft + targetW;
    let targetBottom = targetTop + targetH;
    let targetCenterX = targetLeft + targetW / 2;
    let targetCenterY = targetTop + targetH / 2;

    let snappedX = false;
    let snappedY = false;

    // 1. Check Canvas Center Snapping
    // Horizontal center (Vertical Guide line)
    if (Math.abs(targetCenterX - canvasCenterX) <= this.snapThreshold) {
      const deltaX = canvasCenterX - targetCenterX;
      target.set('left', (target.left || 0) + deltaX);
      targetLeft += deltaX;
      targetRight += deltaX;
      targetCenterX = canvasCenterX;
      snappedX = true;

      this.activeGuides.push({
        type: 'vertical',
        pos: canvasCenterX,
        start: 0,
        end: canvasH,
        category: 'canvas-center',
        label: 'Center',
      });
    }

    // Vertical center (Horizontal Guide line)
    if (Math.abs(targetCenterY - canvasCenterY) <= this.snapThreshold) {
      const deltaY = canvasCenterY - targetCenterY;
      target.set('top', (target.top || 0) + deltaY);
      targetTop += deltaY;
      targetBottom += deltaY;
      targetCenterY = canvasCenterY;
      snappedY = true;

      this.activeGuides.push({
        type: 'horizontal',
        pos: canvasCenterY,
        start: 0,
        end: canvasW,
        category: 'canvas-center',
        label: 'Middle',
      });
    }

    // 2. Check Object-to-Object Snapping
    const otherObjects = this.canvas
      .getObjects()
      .filter((obj) => obj !== target && obj.visible && !obj.get('isGuide' as any));

    const otherBounds = otherObjects.map((obj) => {
      const b = obj.getBoundingRect();
      return {
        obj,
        left: b.left,
        right: b.left + b.width,
        centerX: b.left + b.width / 2,
        top: b.top,
        bottom: b.top + b.height,
        centerY: b.top + b.height / 2,
        width: b.width,
        height: b.height,
      };
    });

    // Object X Alignments (Vertical Guides)
    if (!snappedX) {
      for (const other of otherBounds) {
        // Center-to-Center
        if (Math.abs(targetCenterX - other.centerX) <= this.snapThreshold) {
          const deltaX = other.centerX - targetCenterX;
          target.set('left', (target.left || 0) + deltaX);
          targetLeft += deltaX;
          targetRight += deltaX;
          targetCenterX = other.centerX;
          snappedX = true;

          this.activeGuides.push({
            type: 'vertical',
            pos: other.centerX,
            start: Math.min(targetTop, other.top) - 10,
            end: Math.max(targetBottom, other.bottom) + 10,
            category: 'object-center',
          });
          break;
        }

        // Left-to-Left
        if (Math.abs(targetLeft - other.left) <= this.snapThreshold) {
          const deltaX = other.left - targetLeft;
          target.set('left', (target.left || 0) + deltaX);
          targetLeft = other.left;
          targetRight = targetLeft + targetW;
          snappedX = true;

          this.activeGuides.push({
            type: 'vertical',
            pos: other.left,
            start: Math.min(targetTop, other.top) - 10,
            end: Math.max(targetBottom, other.bottom) + 10,
            category: 'object-edge',
          });
          break;
        }

        // Right-to-Right
        if (Math.abs(targetRight - other.right) <= this.snapThreshold) {
          const deltaX = other.right - targetRight;
          target.set('left', (target.left || 0) + deltaX);
          targetRight = other.right;
          targetLeft = targetRight - targetW;
          snappedX = true;

          this.activeGuides.push({
            type: 'vertical',
            pos: other.right,
            start: Math.min(targetTop, other.top) - 10,
            end: Math.max(targetBottom, other.bottom) + 10,
            category: 'object-edge',
          });
          break;
        }

        // Left-to-Right
        if (Math.abs(targetLeft - other.right) <= this.snapThreshold) {
          const deltaX = other.right - targetLeft;
          target.set('left', (target.left || 0) + deltaX);
          targetLeft = other.right;
          targetRight = targetLeft + targetW;
          snappedX = true;

          this.activeGuides.push({
            type: 'vertical',
            pos: other.right,
            start: Math.min(targetTop, other.top) - 10,
            end: Math.max(targetBottom, other.bottom) + 10,
            category: 'object-edge',
          });
          break;
        }

        // Right-to-Left
        if (Math.abs(targetRight - other.left) <= this.snapThreshold) {
          const deltaX = other.left - targetRight;
          target.set('left', (target.left || 0) + deltaX);
          targetRight = other.left;
          targetLeft = targetRight - targetW;
          snappedX = true;

          this.activeGuides.push({
            type: 'vertical',
            pos: other.left,
            start: Math.min(targetTop, other.top) - 10,
            end: Math.max(targetBottom, other.bottom) + 10,
            category: 'object-edge',
          });
          break;
        }
      }
    }

    // Object Y Alignments (Horizontal Guides)
    if (!snappedY) {
      for (const other of otherBounds) {
        // Middle-to-Middle
        if (Math.abs(targetCenterY - other.centerY) <= this.snapThreshold) {
          const deltaY = other.centerY - targetCenterY;
          target.set('top', (target.top || 0) + deltaY);
          targetTop += deltaY;
          targetBottom += deltaY;
          targetCenterY = other.centerY;
          snappedY = true;

          this.activeGuides.push({
            type: 'horizontal',
            pos: other.centerY,
            start: Math.min(targetLeft, other.left) - 10,
            end: Math.max(targetRight, other.right) + 10,
            category: 'object-center',
          });
          break;
        }

        // Top-to-Top
        if (Math.abs(targetTop - other.top) <= this.snapThreshold) {
          const deltaY = other.top - targetTop;
          target.set('top', (target.top || 0) + deltaY);
          targetTop = other.top;
          targetBottom = targetTop + targetH;
          snappedY = true;

          this.activeGuides.push({
            type: 'horizontal',
            pos: other.top,
            start: Math.min(targetLeft, other.left) - 10,
            end: Math.max(targetRight, other.right) + 10,
            category: 'object-edge',
          });
          break;
        }

        // Bottom-to-Bottom
        if (Math.abs(targetBottom - other.bottom) <= this.snapThreshold) {
          const deltaY = other.bottom - targetBottom;
          target.set('top', (target.top || 0) + deltaY);
          targetBottom = other.bottom;
          targetTop = targetBottom - targetH;
          snappedY = true;

          this.activeGuides.push({
            type: 'horizontal',
            pos: other.bottom,
            start: Math.min(targetLeft, other.left) - 10,
            end: Math.max(targetRight, other.right) + 10,
            category: 'object-edge',
          });
          break;
        }

        // Top-to-Bottom
        if (Math.abs(targetTop - other.bottom) <= this.snapThreshold) {
          const deltaY = other.bottom - targetTop;
          target.set('top', (target.top || 0) + deltaY);
          targetTop = other.bottom;
          targetBottom = targetTop + targetH;
          snappedY = true;

          this.activeGuides.push({
            type: 'horizontal',
            pos: other.bottom,
            start: Math.min(targetLeft, other.left) - 10,
            end: Math.max(targetRight, other.right) + 10,
            category: 'object-edge',
          });
          break;
        }

        // Bottom-to-Top
        if (Math.abs(targetBottom - other.top) <= this.snapThreshold) {
          const deltaY = other.top - targetBottom;
          target.set('top', (target.top || 0) + deltaY);
          targetBottom = other.top;
          targetTop = targetBottom - targetH;
          snappedY = true;

          this.activeGuides.push({
            type: 'horizontal',
            pos: other.top,
            start: Math.min(targetLeft, other.left) - 10,
            end: Math.max(targetRight, other.right) + 10,
            category: 'object-edge',
          });
          break;
        }
      }
    }

    // 3. Smart Equal Spacing Detection
    if (otherBounds.length >= 2) {
      // Check horizontal spacing between elements
      const sortedX = [...otherBounds, { left: targetLeft, right: targetRight, width: targetW, height: targetH, top: targetTop, bottom: targetBottom, centerX: targetCenterX, centerY: targetCenterY }].sort(
        (a, b) => a.left - b.left
      );

      for (let i = 0; i < sortedX.length - 2; i++) {
        const o1 = sortedX[i];
        const o2 = sortedX[i + 1];
        const o3 = sortedX[i + 2];

        const gap1 = o2.left - o1.right;
        const gap2 = o3.left - o2.right;

        if (gap1 > 10 && gap2 > 10 && Math.abs(gap1 - gap2) <= this.snapThreshold) {
          this.spacingBadges.push({
            x: o1.right,
            y: (o1.centerY + o2.centerY) / 2,
            width: gap1,
            height: 20,
            dist: Math.round(gap1),
            orientation: 'horizontal',
          });
          this.spacingBadges.push({
            x: o2.right,
            y: (o2.centerY + o3.centerY) / 2,
            width: gap2,
            height: 20,
            dist: Math.round(gap2),
            orientation: 'horizontal',
          });
        }
      }
    }

    target.setCoords();
  }

  /**
   * Renders active smart guide lines and spacing badges during after:render.
   * Completely non-destructive and independent of Fabric layers.
   */
  public renderGuides(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (!this.isEnabled || (this.activeGuides.length === 0 && this.spacingBadges.length === 0)) {
      return;
    }

    ctx.save();
    ctx.scale(zoom, zoom);

    // 1. Draw Alignment Guide Lines
    for (const guide of this.activeGuides) {
      ctx.beginPath();
      ctx.lineWidth = Math.max(1.2 / zoom, 1);

      if (guide.category === 'canvas-center') {
        // Canvas Center: Vibrant Cyan (#06b6d4) with subtle dash
        ctx.strokeStyle = '#06b6d4';
        ctx.setLineDash([4 / zoom, 3 / zoom]);
      } else {
        // Object Alignment: Vibrant Magenta (#d946ef) solid
        ctx.strokeStyle = '#d946ef';
        ctx.setLineDash([]);
      }

      if (guide.type === 'vertical') {
        ctx.moveTo(guide.pos, guide.start);
        ctx.lineTo(guide.pos, guide.end);
      } else {
        ctx.moveTo(guide.start, guide.pos);
        ctx.lineTo(guide.end, guide.pos);
      }
      ctx.stroke();

      // Draw Diamond / Dot indicator at center or endpoints
      ctx.fillStyle = guide.category === 'canvas-center' ? '#06b6d4' : '#d946ef';
      const dotSize = Math.max(3.5 / zoom, 2.5);

      if (guide.type === 'vertical') {
        ctx.beginPath();
        ctx.arc(guide.pos, guide.start, dotSize, 0, Math.PI * 2);
        ctx.arc(guide.pos, guide.end, dotSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(guide.start, guide.pos, dotSize, 0, Math.PI * 2);
        ctx.arc(guide.end, guide.pos, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Draw Equal Spacing Badges
    for (const badge of this.spacingBadges) {
      if (badge.orientation === 'horizontal') {
        // Draw gap measurement line
        ctx.beginPath();
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = Math.max(1.5 / zoom, 1);
        ctx.setLineDash([]);
        ctx.moveTo(badge.x, badge.y);
        ctx.lineTo(badge.x + badge.width, badge.y);
        ctx.stroke();

        // Draw measurement pill
        const pillW = Math.max(36 / zoom, 26);
        const pillH = Math.max(16 / zoom, 12);
        const pillX = badge.x + badge.width / 2 - pillW / 2;
        const pillY = badge.y - pillH / 2;

        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 4 / zoom);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(9 / zoom, 8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${badge.dist}px`, badge.x + badge.width / 2, badge.y);
      }
    }

    ctx.restore();
  }
}
