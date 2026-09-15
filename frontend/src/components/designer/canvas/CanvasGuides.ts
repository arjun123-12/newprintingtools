import { Canvas } from 'fabric';
import { CanvasDimensions, PrintGuidesSettings } from '@/types/designer';

export interface UserRulerGuide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  posPx: number;
  posMm: number;
}

export const DEFAULT_GUIDES_SETTINGS: PrintGuidesSettings = {
  showBleed: true,
  showSafeZone: true,
  showTrim: true,
  bleedColor: 'rgba(239, 68, 68, 0.85)',
  safeZoneColor: 'rgba(16, 185, 129, 0.85)',
  trimColor: '#000000',
};

export class CanvasGuides {
  private canvas: Canvas | null = null;
  private dimensions: CanvasDimensions;
  private settings: PrintGuidesSettings = { ...DEFAULT_GUIDES_SETTINGS };
  private isVisible = true;
  private userGuides: UserRulerGuide[] = [];

  constructor(
    dimensions: CanvasDimensions,
    initialSettings?: Partial<PrintGuidesSettings>
  ) {
    this.dimensions = dimensions;
    if (initialSettings) {
      this.settings = { ...this.settings, ...initialSettings };
    }
  }

  public attach(canvas: Canvas): void {
    this.canvas = canvas;
  }

  public detach(): void {
    this.canvas = null;
  }

  public updateDimensions(dims: CanvasDimensions): void {
    this.dimensions = dims;
    const dpi = dims.dpi || 300;
    this.userGuides = this.userGuides.map((guide) => ({
      ...guide,
      posMm: Number(((guide.posPx / dpi) * 25.4).toFixed(1)),
    }));
    this.canvas?.requestRenderAll();
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.canvas?.requestRenderAll();
  }

  public toggleVisible(): boolean {
    this.isVisible = !this.isVisible;
    this.canvas?.requestRenderAll();
    return this.isVisible;
  }

  public getVisible(): boolean {
    return this.isVisible;
  }

  public updateSettings(newSettings: Partial<PrintGuidesSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.canvas?.requestRenderAll();
  }

  public getSettings(): PrintGuidesSettings {
    return { ...this.settings };
  }

  public addUserGuide(
    orientation: 'horizontal' | 'vertical',
    posPx: number
  ): UserRulerGuide {
    const dpi = this.dimensions.dpi || 300;
    const guide: UserRulerGuide = {
      id: `guide_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orientation,
      posPx,
      posMm: Number(((posPx / dpi) * 25.4).toFixed(1)),
    };
    this.userGuides.push(guide);
    this.canvas?.requestRenderAll();
    return guide;
  }

  public removeUserGuide(id: string): void {
    this.userGuides = this.userGuides.filter((guide) => guide.id !== id);
    this.canvas?.requestRenderAll();
  }

  public clearUserGuides(): void {
    this.userGuides = [];
    this.canvas?.requestRenderAll();
  }

  public getUserGuides(): UserRulerGuide[] {
    return [...this.userGuides];
  }

  public setUserGuides(guides: UserRulerGuide[]): void {
    this.userGuides = [...guides];
    this.canvas?.requestRenderAll();
  }

  /**
   * Paints only the two boundaries that belong inside/on the artwork:
   * 1. black full-artwork boundary
   * 2. green safe-margin boundary
   *
   * The red bleed boundary is intentionally rendered outside the canvas by
   * CanvasManager because the 2D canvas context clips outside pixels.
   */
  public renderGuides(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (!this.isVisible || !this.canvas) return;

    const width = this.dimensions.widthPx || 1063;
    const height = this.dimensions.heightPx || 591;
    const marginPx =
      this.dimensions.marginPx !== undefined && this.dimensions.marginPx > 0
        ? this.dimensions.marginPx
        : this.dimensions.safeZonePx || 0;
    const safeInset = Math.max(0, marginPx);

    ctx.save();
    ctx.scale(zoom, zoom);

    // Black line exactly on the complete artwork boundary.
    if (this.settings.showTrim) {
      const halfPixel = 0.5 / zoom;
      ctx.save();
      ctx.strokeStyle = this.settings.trimColor || '#000000';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([]);
      ctx.strokeRect(
        halfPixel,
        halfPixel,
        Math.max(width - 1 / zoom, 0),
        Math.max(height - 1 / zoom, 0)
      );
      ctx.restore();
    }

    // One green dashed safe-margin line inside the artwork.
    if (
      this.settings.showSafeZone &&
      safeInset > 0 &&
      safeInset * 2 < width &&
      safeInset * 2 < height
    ) {
      ctx.save();
      ctx.strokeStyle =
        this.settings.safeZoneColor || 'rgba(16, 185, 129, 0.85)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.strokeRect(
        safeInset,
        safeInset,
        width - safeInset * 2,
        height - safeInset * 2
      );
      ctx.restore();
    }

    // Preserve user-created ruler guidelines; these are not print boundaries.
    if (this.userGuides.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(125, 42, 232, 0.9)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);

      for (const guide of this.userGuides) {
        ctx.beginPath();
        if (guide.orientation === 'horizontal') {
          ctx.moveTo(-10000, guide.posPx);
          ctx.lineTo(10000, guide.posPx);
        } else {
          ctx.moveTo(guide.posPx, -10000);
          ctx.lineTo(guide.posPx, 10000);
        }
        ctx.stroke();

        ctx.fillStyle = 'rgba(125, 42, 232, 0.95)';
        ctx.font = `${Math.max(10 / zoom, 9)}px sans-serif`;
        if (guide.orientation === 'horizontal') {
          ctx.fillText(
            `${guide.posMm} mm`,
            8 / zoom,
            guide.posPx - 3 / zoom
          );
        } else {
          ctx.fillText(
            `${guide.posMm} mm`,
            guide.posPx + 4 / zoom,
            16 / zoom
          );
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }
}
