import { Canvas, FabricObject } from 'fabric';
import { CanvasDimensions } from '@/types/designer';

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  pos: number; // X for vertical, Y for horizontal
  start: number; // Y1 for vertical, X1 for horizontal
  end: number; // Y2 for vertical, X2 for horizontal
  category: 'canvas-center' | 'object-edge' | 'object-center' | 'spacing' | 'canvas-edge' | 'safe-area';
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

interface CachedPrintBoundaries {
  trimW: number;
  trimH: number;
  bleedPx: number;
  artworkW: number;
  artworkH: number;
  trimCenterX: number;
  trimCenterY: number;
  trimLeft: number;
  trimRight: number;
  trimTop: number;
  trimBottom: number;
  safeInset: number;
  safeLeft: number;
  safeRight: number;
  safeTop: number;
  safeBottom: number;
  foldLinesX: number[];
  foldLinesY: number[];
}

interface StationaryObjectBound {
  obj: FabricObject;
  left: number;
  right: number;
  centerX: number;
  top: number;
  bottom: number;
  centerY: number;
}

export class CanvasSnapping {
  private canvas: Canvas | null = null;
  private dimensions: CanvasDimensions;
  private activeGuides: AlignmentGuide[] = [];
  private spacingBadges: SpacingBadge[] = [];
  private isEnabled: boolean = true;
  /** Snap distance in screen pixels, matching Canva-style behaviour. */
  private snapThreshold: number = 6;

  // Hysteresis tracking: remember what we snapped to so dragging across lines doesn't oscillate/jitter
  private lastSnapX: number | null = null;
  private lastSnapY: number | null = null;

  // Cached boundaries and stationary objects for 60 FPS drag performance
  private cachedBoundaries: CachedPrintBoundaries | null = null;
  private cachedOtherBounds: StationaryObjectBound[] = [];
  private isDragging: boolean = false;

  constructor(dimensions: CanvasDimensions) {
    this.dimensions = dimensions;
    this.recomputeBoundaries();
  }

  public attach(canvas: Canvas): void {
    this.canvas = canvas;
  }

  public detach(): void {
    this.canvas = null;
    this.activeGuides = [];
    this.spacingBadges = [];
    this.lastSnapX = null;
    this.lastSnapY = null;
    this.cachedOtherBounds = [];
    this.isDragging = false;
  }

  public updateDimensions(dims: CanvasDimensions): void {
    this.dimensions = dims;
    this.recomputeBoundaries();
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

  public getIsDragging(): boolean {
    return this.isDragging;
  }

  /**
   * Pre-caches stationary object bounds once when drag starts.
   * This completely avoids O(N) getBoundingRect() and canvas traversal on every pointer pixel.
   */
  public beginDrag(target: FabricObject): void {
    if (!this.isEnabled || !this.canvas || !target) return;
    this.isDragging = true;
    this.activeGuides = [];
    this.spacingBadges = [];
    this.lastSnapX = null;
    this.lastSnapY = null;

    try {
      const otherObjects = this.canvas
        .getObjects()
        .filter(
          (obj) =>
            obj !== target &&
            obj.visible &&
            !obj.get('isGuide' as any) &&
            !obj.get('isPrintGuide' as any) &&
            !obj.get('excludeFromSelection' as any) &&
            !obj.get('isBackground' as any)
        );

      this.cachedOtherBounds = otherObjects.map((obj) => {
        const b = obj.getBoundingRect();
        return {
          obj,
          left: b.left,
          right: b.left + b.width,
          centerX: b.left + b.width / 2,
          top: b.top,
          bottom: b.top + b.height,
          centerY: b.top + b.height / 2,
        };
      });
    } catch {
      this.cachedOtherBounds = [];
    }
  }

  /**
   * Cleans up drag caches and resets snap hysteresis when drag ends.
   */
  public endDrag(): void {
    this.isDragging = false;
    this.cachedOtherBounds = [];
    this.lastSnapX = null;
    this.lastSnapY = null;
    this.clearGuides();
  }

  public clearGuides(): void {
    this.lastSnapX = null;
    this.lastSnapY = null;
    if (this.activeGuides.length > 0 || this.spacingBadges.length > 0) {
      this.activeGuides = [];
      this.spacingBadges = [];
      this.canvas?.requestRenderAll();
    }
  }

  private recomputeBoundaries(): void {
    const trimW = this.dimensions.widthPx || 1063;
    const trimH = this.dimensions.heightPx || 591;
    const bleedPx = Math.max(0, Number(this.dimensions.bleedPx) || 0);
    const artworkW = this.dimensions.totalWidthPx || (trimW + bleedPx * 2);
    const artworkH = this.dimensions.totalHeightPx || (trimH + bleedPx * 2);

    const trimLeft = bleedPx;
    const trimRight = bleedPx + trimW;
    const trimTop = bleedPx;
    const trimBottom = bleedPx + trimH;

    const safeMargin = Math.max(
      0,
      Number(this.dimensions.marginPx ?? this.dimensions.safeZonePx ?? 0)
    );
    const safeInset = Math.min(
      safeMargin,
      Math.max(0, Math.min(trimW, trimH) / 2 - 1)
    );
    const safeLeft = trimLeft + safeInset;
    const safeRight = trimRight - safeInset;
    const safeTop = trimTop + safeInset;
    const safeBottom = trimBottom - safeInset;

    const foldLinesX: number[] = [];
    const foldLinesY: number[] = [];
    if (this.dimensions.printLayout?.folding?.enabled && this.dimensions.printLayout?.folding?.folds) {
      const isVertical = this.dimensions.printLayout.folding.panelOrientation !== 'horizontal';
      const dpi = this.dimensions.dpi || 300;
      for (const fold of this.dimensions.printLayout.folding.folds) {
        const foldPx = bleedPx + Math.round(((Number(fold.position) || 0) / 25.4) * dpi);
        if (isVertical) {
          if (foldPx > bleedPx && foldPx < bleedPx + trimW) {
            foldLinesX.push(foldPx);
          }
        } else {
          if (foldPx > bleedPx && foldPx < bleedPx + trimH) {
            foldLinesY.push(foldPx);
          }
        }
      }
    }

    this.cachedBoundaries = {
      trimW,
      trimH,
      bleedPx,
      artworkW,
      artworkH,
      trimCenterX: bleedPx + trimW / 2,
      trimCenterY: bleedPx + trimH / 2,
      trimLeft,
      trimRight,
      trimTop,
      trimBottom,
      safeInset,
      safeLeft,
      safeRight,
      safeTop,
      safeBottom,
      foldLinesX,
      foldLinesY,
    };
  }

  /**
   * Snapping calculation called during live drag.
   * Uses pre-cached stationary bounds, pre-cached print lines, and hysteresis
   * to guarantee buttery smooth 60 FPS movement without jitter or freezing.
   */
  public handleObjectMove(target: FabricObject): void {
    if (!this.isEnabled || !this.canvas || !target) return;

    try {
      this.activeGuides = [];
      this.spacingBadges = [];

      const zoom = this.getDisplayZoom();
      const threshold = this.snapThreshold / zoom;
      // Breakout threshold: once snapped, requires slightly larger distance to release.
      // This eliminates rapid snap-slip oscillations when moving across boundary lines.
      const breakoutThreshold = threshold * 1.4;

      if (!this.cachedBoundaries) {
        this.recomputeBoundaries();
      }
      const b = this.cachedBoundaries!;

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

      // 1A. Check Canvas Center Snapping (X) - Cyan dashed line with dots
      const distCenterX = Math.abs(targetCenterX - b.trimCenterX);
      const limitCenterX = this.lastSnapX === b.trimCenterX ? breakoutThreshold : threshold;
      if (distCenterX <= limitCenterX) {
        const deltaX = b.trimCenterX - targetCenterX;
        target.set('left', (target.left || 0) + deltaX);
        targetLeft += deltaX;
        targetRight += deltaX;
        targetCenterX = b.trimCenterX;
        snappedX = true;
        this.lastSnapX = b.trimCenterX;

        this.activeGuides.push({
          type: 'vertical',
          pos: b.trimCenterX,
          start: 0,
          end: b.artworkH,
          category: 'canvas-center',
          label: 'Center',
        });
      }

      // 1B. Check Canvas Edge, Safe Area, and Fold Snapping (X)
      if (!snappedX) {
        // Left trim cut edge
        const distTrimLeft = Math.abs(targetLeft - b.trimLeft);
        const limitTrimLeft = this.lastSnapX === b.trimLeft ? breakoutThreshold : threshold;

        // Right trim cut edge
        const distTrimRight = Math.abs(targetRight - b.trimRight);
        const limitTrimRight = this.lastSnapX === b.trimRight ? breakoutThreshold : threshold;

        // Safe area left
        const distSafeLeft = Math.abs(targetLeft - b.safeLeft);
        const limitSafeLeft = this.lastSnapX === b.safeLeft ? breakoutThreshold : threshold;

        // Safe area right
        const distSafeRight = Math.abs(targetRight - b.safeRight);
        const limitSafeRight = this.lastSnapX === b.safeRight ? breakoutThreshold : threshold;

        if (distTrimLeft <= limitTrimLeft) {
          const deltaX = b.trimLeft - targetLeft;
          target.set('left', (target.left || 0) + deltaX);
          targetLeft = b.trimLeft;
          targetRight = targetW + b.trimLeft;
          targetCenterX = targetLeft + targetW / 2;
          snappedX = true;
          this.lastSnapX = b.trimLeft;
          this.activeGuides.push({
            type: 'vertical',
            pos: b.trimLeft,
            start: 0,
            end: b.artworkH,
            category: 'canvas-edge',
            label: 'Trim Left',
          });
        } else if (distTrimRight <= limitTrimRight) {
          const deltaX = b.trimRight - targetRight;
          target.set('left', (target.left || 0) + deltaX);
          targetRight = b.trimRight;
          targetLeft = b.trimRight - targetW;
          targetCenterX = targetLeft + targetW / 2;
          snappedX = true;
          this.lastSnapX = b.trimRight;
          this.activeGuides.push({
            type: 'vertical',
            pos: b.trimRight,
            start: 0,
            end: b.artworkH,
            category: 'canvas-edge',
            label: 'Trim Right',
          });
        } else if (b.safeInset > 0 && distSafeLeft <= limitSafeLeft) {
          const deltaX = b.safeLeft - targetLeft;
          target.set('left', (target.left || 0) + deltaX);
          targetLeft = b.safeLeft;
          targetRight = targetLeft + targetW;
          targetCenterX = targetLeft + targetW / 2;
          snappedX = true;
          this.lastSnapX = b.safeLeft;
          this.activeGuides.push({
            type: 'vertical',
            pos: b.safeLeft,
            start: b.trimTop,
            end: b.trimBottom,
            category: 'safe-area',
            label: 'Safe Left',
          });
        } else if (b.safeInset > 0 && distSafeRight <= limitSafeRight) {
          const deltaX = b.safeRight - targetRight;
          target.set('left', (target.left || 0) + deltaX);
          targetRight = b.safeRight;
          targetLeft = targetRight - targetW;
          targetCenterX = targetLeft + targetW / 2;
          snappedX = true;
          this.lastSnapX = b.safeRight;
          this.activeGuides.push({
            type: 'vertical',
            pos: b.safeRight,
            start: b.trimTop,
            end: b.trimBottom,
            category: 'safe-area',
            label: 'Safe Right',
          });
        } else if (b.foldLinesX.length > 0) {
          // Vertical fold lines
          for (const foldX of b.foldLinesX) {
            const distFold = Math.abs(targetCenterX - foldX);
            const limitFold = this.lastSnapX === foldX ? breakoutThreshold : threshold;
            if (distFold <= limitFold) {
              const deltaX = foldX - targetCenterX;
              target.set('left', (target.left || 0) + deltaX);
              targetLeft += deltaX;
              targetRight += deltaX;
              targetCenterX = foldX;
              snappedX = true;
              this.lastSnapX = foldX;
              this.activeGuides.push({
                type: 'vertical',
                pos: foldX,
                start: b.trimTop,
                end: b.trimBottom,
                category: 'canvas-edge',
                label: 'Fold',
              });
              break;
            }
          }
        }
      }

      // If X didn't snap to any boundary, clear X snap lock
      if (!snappedX) {
        this.lastSnapX = null;
      }

      // 1C. Check Canvas Center Snapping (Y) - Cyan dashed line with dots
      const distCenterY = Math.abs(targetCenterY - b.trimCenterY);
      const limitCenterY = this.lastSnapY === b.trimCenterY ? breakoutThreshold : threshold;
      if (distCenterY <= limitCenterY) {
        const deltaY = b.trimCenterY - targetCenterY;
        target.set('top', (target.top || 0) + deltaY);
        targetTop += deltaY;
        targetBottom += deltaY;
        targetCenterY = b.trimCenterY;
        snappedY = true;
        this.lastSnapY = b.trimCenterY;

        this.activeGuides.push({
          type: 'horizontal',
          pos: b.trimCenterY,
          start: 0,
          end: b.artworkW,
          category: 'canvas-center',
          label: 'Middle',
        });
      }

      // 1D. Check Canvas Edge, Safe Area, and Fold Snapping (Y)
      if (!snappedY) {
        // Top trim edge
        const distTrimTop = Math.abs(targetTop - b.trimTop);
        const limitTrimTop = this.lastSnapY === b.trimTop ? breakoutThreshold : threshold;

        // Bottom trim edge
        const distTrimBottom = Math.abs(targetBottom - b.trimBottom);
        const limitTrimBottom = this.lastSnapY === b.trimBottom ? breakoutThreshold : threshold;

        // Safe area top
        const distSafeTop = Math.abs(targetTop - b.safeTop);
        const limitSafeTop = this.lastSnapY === b.safeTop ? breakoutThreshold : threshold;

        // Safe area bottom
        const distSafeBottom = Math.abs(targetBottom - b.safeBottom);
        const limitSafeBottom = this.lastSnapY === b.safeBottom ? breakoutThreshold : threshold;

        if (distTrimTop <= limitTrimTop) {
          const deltaY = b.trimTop - targetTop;
          target.set('top', (target.top || 0) + deltaY);
          targetTop = b.trimTop;
          targetBottom = targetH + b.trimTop;
          targetCenterY = targetTop + targetH / 2;
          snappedY = true;
          this.lastSnapY = b.trimTop;
          this.activeGuides.push({
            type: 'horizontal',
            pos: b.trimTop,
            start: 0,
            end: b.artworkW,
            category: 'canvas-edge',
            label: 'Trim Top',
          });
        } else if (distTrimBottom <= limitTrimBottom) {
          const deltaY = b.trimBottom - targetBottom;
          target.set('top', (target.top || 0) + deltaY);
          targetBottom = b.trimBottom;
          targetTop = b.trimBottom - targetH;
          targetCenterY = targetTop + targetH / 2;
          snappedY = true;
          this.lastSnapY = b.trimBottom;
          this.activeGuides.push({
            type: 'horizontal',
            pos: b.trimBottom,
            start: 0,
            end: b.artworkW,
            category: 'canvas-edge',
            label: 'Trim Bottom',
          });
        } else if (b.safeInset > 0 && distSafeTop <= limitSafeTop) {
          const deltaY = b.safeTop - targetTop;
          target.set('top', (target.top || 0) + deltaY);
          targetTop = b.safeTop;
          targetBottom = targetTop + targetH;
          targetCenterY = targetTop + targetH / 2;
          snappedY = true;
          this.lastSnapY = b.safeTop;
          this.activeGuides.push({
            type: 'horizontal',
            pos: b.safeTop,
            start: b.trimLeft,
            end: b.trimRight,
            category: 'safe-area',
            label: 'Safe Top',
          });
        } else if (b.safeInset > 0 && distSafeBottom <= limitSafeBottom) {
          const deltaY = b.safeBottom - targetBottom;
          target.set('top', (target.top || 0) + deltaY);
          targetBottom = b.safeBottom;
          targetTop = targetBottom - targetH;
          targetCenterY = targetTop + targetH / 2;
          snappedY = true;
          this.lastSnapY = b.safeBottom;
          this.activeGuides.push({
            type: 'horizontal',
            pos: b.safeBottom,
            start: b.trimLeft,
            end: b.trimRight,
            category: 'safe-area',
            label: 'Safe Bottom',
          });
        } else if (b.foldLinesY.length > 0) {
          // Horizontal fold lines
          for (const foldY of b.foldLinesY) {
            const distFold = Math.abs(targetCenterY - foldY);
            const limitFold = this.lastSnapY === foldY ? breakoutThreshold : threshold;
            if (distFold <= limitFold) {
              const deltaY = foldY - targetCenterY;
              target.set('top', (target.top || 0) + deltaY);
              targetTop += deltaY;
              targetBottom += deltaY;
              targetCenterY = foldY;
              snappedY = true;
              this.lastSnapY = foldY;
              this.activeGuides.push({
                type: 'horizontal',
                pos: foldY,
                start: b.trimLeft,
                end: b.trimRight,
                category: 'canvas-edge',
                label: 'Fold',
              });
              break;
            }
          }
        }
      }

      // If Y didn't snap to any boundary, clear Y snap lock
      if (!snappedY) {
        this.lastSnapY = null;
      }

      // 2. Check Object-to-Object Snapping using pre-cached stationary bounds
      let otherBounds = this.cachedOtherBounds;
      if (otherBounds.length === 0 && !this.isDragging) {
        // Fallback if beginDrag was not called (e.g. programmatically or scaling)
        const otherObjects = this.canvas
          .getObjects()
          .filter(
            (obj) =>
              obj !== target &&
              obj.visible &&
              !obj.get('isGuide' as any) &&
              !obj.get('isPrintGuide' as any) &&
              !obj.get('excludeFromSelection' as any) &&
              !obj.get('isBackground' as any)
          );
        otherBounds = otherObjects.map((obj) => {
          const ob = obj.getBoundingRect();
          return {
            obj,
            left: ob.left,
            right: ob.left + ob.width,
            centerX: ob.left + ob.width / 2,
            top: ob.top,
            bottom: ob.top + ob.height,
            centerY: ob.top + ob.height / 2,
          };
        });
      }

      // Object X Alignments (Vertical Guides)
      if (!snappedX && otherBounds.length > 0) {
        for (const other of otherBounds) {
          // Center-to-Center
          if (Math.abs(targetCenterX - other.centerX) <= threshold) {
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
          if (Math.abs(targetLeft - other.left) <= threshold) {
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
          if (Math.abs(targetRight - other.right) <= threshold) {
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
          if (Math.abs(targetLeft - other.right) <= threshold) {
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
          if (Math.abs(targetRight - other.left) <= threshold) {
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
      if (!snappedY && otherBounds.length > 0) {
        for (const other of otherBounds) {
          // Middle-to-Middle
          if (Math.abs(targetCenterY - other.centerY) <= threshold) {
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
          if (Math.abs(targetTop - other.top) <= threshold) {
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
          if (Math.abs(targetBottom - other.bottom) <= threshold) {
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
          if (Math.abs(targetTop - other.bottom) <= threshold) {
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
          if (Math.abs(targetBottom - other.top) <= threshold) {
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

      // 3. Smart Equal Spacing Detection (lightweight, limited to reasonable count)
      if (otherBounds.length >= 2 && otherBounds.length <= 20) {
        const sortedX = [
          ...otherBounds,
          {
            obj: target,
            left: targetLeft,
            right: targetRight,
            width: targetW,
            height: targetH,
            top: targetTop,
            bottom: targetBottom,
            centerX: targetCenterX,
            centerY: targetCenterY,
          },
        ].sort((oa, ob) => oa.left - ob.left);

        for (let i = 0; i < sortedX.length - 2; i++) {
          const o1 = sortedX[i];
          const o2 = sortedX[i + 1];
          const o3 = sortedX[i + 2];

          const gap1 = o2.left - o1.right;
          const gap2 = o3.left - o2.right;

          if (gap1 > 10 && gap2 > 10 && Math.abs(gap1 - gap2) <= threshold) {
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
    } catch (snapErr) {
      console.warn('Snapping computation error:', snapErr);
    }
  }

  /**
   * Renders active smart guide lines and spacing badges during after:render.
   * Completely non-destructive and independent of Fabric layers.
   */
  public renderGuides(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (
      !this.isEnabled ||
      !this.canvas ||
      (this.activeGuides.length === 0 && this.spacingBadges.length === 0)
    ) {
      return;
    }

    // Smart guides belong only to an active Fabric transform. A stale guide
    // must not be repainted by unrelated renders such as zoom in/out.
    if (!(this.canvas as any)._currentTransform) {
      return;
    }

    const viewportZoom = Math.max(this.canvas.getZoom() || 1, 0.01);
    const displayZoom = this.getDisplayZoom(zoom);

    ctx.save();
    // Fabric renders the guide in backing-store coordinates; CSS applies the
    // remaining display-only scale afterwards.
    ctx.scale(viewportZoom, viewportZoom);

    // 1. Draw Alignment Guide Lines
    for (const guide of this.activeGuides) {
      ctx.beginPath();
      ctx.lineWidth = 1.25 / displayZoom;

      if (guide.category === 'canvas-center') {
        // Canvas Center: Vibrant Cyan (#06b6d4) with subtle dash
        ctx.strokeStyle = '#06b6d4';
        ctx.setLineDash([4 / displayZoom, 3 / displayZoom]);
      } else if (guide.category === 'safe-area') {
        // Safe Area Snapping: Emerald Green (#10b981) dashed matching safe boundary
        ctx.strokeStyle = '#10b981';
        ctx.setLineDash([4 / displayZoom, 3 / displayZoom]);
      } else if (guide.category === 'canvas-edge') {
        // Trim Cut Edge or Fold Guide: Slate or Royal Blue
        ctx.strokeStyle = guide.label === 'Fold' ? '#3b82f6' : '#64748b';
        ctx.setLineDash([3 / displayZoom, 3 / displayZoom]);
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
      if (guide.category === 'canvas-center') {
        ctx.fillStyle = '#06b6d4';
      } else if (guide.category === 'safe-area') {
        ctx.fillStyle = '#10b981';
      } else if (guide.category === 'canvas-edge') {
        ctx.fillStyle = guide.label === 'Fold' ? '#3b82f6' : '#64748b';
      } else {
        ctx.fillStyle = '#d946ef';
      }
      const dotSize = 3.5 / displayZoom;

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
        ctx.lineWidth = 1.5 / displayZoom;
        ctx.setLineDash([]);
        ctx.moveTo(badge.x, badge.y);
        ctx.lineTo(badge.x + badge.width, badge.y);
        ctx.stroke();

        // Draw measurement pill
        const pillW = 36 / displayZoom;
        const pillH = 16 / displayZoom;
        const pillX = badge.x + badge.width / 2 - pillW / 2;
        const pillY = badge.y - pillH / 2;

        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 4 / displayZoom);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${9 / displayZoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${badge.dist}px`, badge.x + badge.width / 2, badge.y);
      }
    }

    ctx.restore();
  }

  /**
   * Effective on-screen zoom, including Fabric viewport zoom and CSS-only
   * canvas scaling. This keeps snapping and overlays correct without forcing
   * a Fabric redraw when the user zooms.
   */
  private getDisplayZoom(fallbackZoom = 1): number {
    if (!this.canvas) return Math.max(fallbackZoom || 1, 0.01);

    const viewportZoom = Math.max(this.canvas.getZoom() || 1, 0.01);
    const backingWidth = Math.max(this.canvas.getWidth() || 1, 1);
    const displayedWidth = this.canvas.upperCanvasEl?.getBoundingClientRect().width || 0;
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
