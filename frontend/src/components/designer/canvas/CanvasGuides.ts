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

  private getArtworkBounds() {
    const trimWidth = this.dimensions.widthPx || 1063;
    const trimHeight = this.dimensions.heightPx || 591;
    const bleedPx = Math.max(0, Number(this.dimensions.bleedPx) || 0);

    return {
      trimWidth,
      trimHeight,
      bleedPx,
      artworkWidth: trimWidth + bleedPx * 2,
      artworkHeight: trimHeight + bleedPx * 2,
    };
  }

  /**
   * Update the editable margin directly in pixels.
   *
   * IMPORTANT:
   * marginPx is allowed to be 0. We intentionally do NOT fall back to
   * safeZonePx when marginPx === 0, otherwise the margin cannot be
   * properly adjusted/disabled.
   */
  public setMarginPx(marginPx: number): void {
    const { trimWidth, trimHeight } = this.getArtworkBounds();

    const maxMargin = Math.max(
      0,
      Math.min(trimWidth / 2, trimHeight / 2) - 1
    );

    const normalizedMargin = Math.max(
      0,
      Math.min(Number(marginPx) || 0, maxMargin)
    );

    this.dimensions = {
      ...this.dimensions,
      marginPx: normalizedMargin,
    };

    this.canvas?.requestRenderAll();
  }

  /**
   * Update the editable margin using millimeters.
   */
  public setMarginMm(marginMm: number): void {
    const dpi = this.dimensions.dpi || 300;
    const px = Math.max(0, ((Number(marginMm) || 0) / 25.4) * dpi);
    this.setMarginPx(px);
  }

  public getMarginPx(): number {
    return Math.max(0, Number(this.dimensions.marginPx ?? 0));
  }

  public getMarginMm(): number {
    const dpi = this.dimensions.dpi || 300;
    return Number(((this.getMarginPx() / dpi) * 25.4).toFixed(2));
  }

  public addUserGuide(
    orientation: 'horizontal' | 'vertical',
    posPx: number
  ): UserRulerGuide {
    const dpi = this.dimensions.dpi || 300;
    const { artworkWidth, artworkHeight } = this.getArtworkBounds();

    const maximum =
      orientation === 'horizontal' ? artworkHeight : artworkWidth;

    const normalizedPosPx = Math.max(0, Math.min(maximum, posPx));

    const guide: UserRulerGuide = {
      id: `guide_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 7)}`,
      orientation,
      posPx: normalizedPosPx,
      posMm: Number(((normalizedPosPx / dpi) * 25.4).toFixed(1)),
    };

    this.userGuides.push(guide);
    this.canvas?.requestRenderAll();

    return { ...guide };
  }

  public updateUserGuide(
    id: string,
    posPx: number
  ): UserRulerGuide | null {
    const index = this.userGuides.findIndex((guide) => guide.id === id);

    if (index < 0) return null;

    const current = this.userGuides[index];
    const { artworkWidth, artworkHeight } = this.getArtworkBounds();

    const maximum =
      current.orientation === 'horizontal'
        ? artworkHeight
        : artworkWidth;

    const normalizedPosPx = Math.max(0, Math.min(maximum, posPx));
    const dpi = this.dimensions.dpi || 300;

    const updated: UserRulerGuide = {
      ...current,
      posPx: normalizedPosPx,
      posMm: Number(((normalizedPosPx / dpi) * 25.4).toFixed(1)),
    };

    this.userGuides[index] = updated;
    this.canvas?.requestRenderAll();

    return { ...updated };
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
    return this.userGuides.map((guide) => ({ ...guide }));
  }

  public setUserGuides(guides: UserRulerGuide[]): void {
    this.userGuides = guides.map((guide) => ({ ...guide }));
    this.canvas?.requestRenderAll();
  }

  public renderGuides(
    ctx: CanvasRenderingContext2D,
    zoom: number
  ): void {
    if (!this.isVisible || !this.canvas) return;

    const {
      trimWidth,
      trimHeight,
      bleedPx,
      artworkWidth,
      artworkHeight,
    } = this.getArtworkBounds();

    // Editable margin. `0` is a valid value and must stay 0.
    const marginPx = Math.max(
      0,
      Number(this.dimensions.marginPx ?? 0)
    );

    // Prevent invalid safe rectangles if a very large value arrives from
    // persisted/legacy document settings.
    const safeInset = Math.min(
      marginPx,
      Math.max(0, Math.min(trimWidth, trimHeight) / 2 - 1)
    );

    ctx.save();
    ctx.scale(zoom, zoom);

    // RED = actual outer bleed/artwork boundary.
    if (this.settings.showBleed !== false) {
      const halfPixel = 0.5 / zoom;

      ctx.save();
      ctx.strokeStyle = this.settings.bleedColor || '#ef4444';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);

      ctx.strokeRect(
        halfPixel,
        halfPixel,
        Math.max(artworkWidth - 1 / zoom, 0),
        Math.max(artworkHeight - 1 / zoom, 0)
      );

      ctx.restore();
    }

    // BLACK = trim/cut boundary inset from red by bleedPx.
    if (this.settings.showTrim) {
      ctx.save();
      ctx.setLineDash([]);

      // Small white casing keeps the black trim line visible over artwork.
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 3 / zoom;
      ctx.strokeRect(bleedPx, bleedPx, trimWidth, trimHeight);

      ctx.strokeStyle = this.settings.trimColor || '#000000';
      ctx.lineWidth = 1.5 / zoom;
      ctx.strokeRect(bleedPx, bleedPx, trimWidth, trimHeight);

      ctx.restore();
    }

    // GREEN = editable margin/safe boundary inside the BLACK trim line.
    if (
      this.settings.showSafeZone &&
      safeInset > 0 &&
      safeInset * 2 < trimWidth &&
      safeInset * 2 < trimHeight
    ) {
      ctx.save();

      ctx.strokeStyle =
        this.settings.safeZoneColor || '#10b981';

      ctx.lineWidth = 1.2 / zoom;
      ctx.setLineDash([5 / zoom, 4 / zoom]);

      ctx.strokeRect(
        bleedPx + safeInset,
        bleedPx + safeInset,
        trimWidth - safeInset * 2,
        trimHeight - safeInset * 2
      );

      ctx.restore();
    }

    // User ruler guides remain solid and span the full bleed-inclusive artwork.
    if (this.userGuides.length > 0) {
      ctx.save();

      ctx.strokeStyle = 'rgba(125, 42, 232, 0.9)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([]);

      for (const guide of this.userGuides) {
        ctx.beginPath();

        if (guide.orientation === 'horizontal') {
          ctx.moveTo(0, guide.posPx);
          ctx.lineTo(artworkWidth, guide.posPx);
        } else {
          ctx.moveTo(guide.posPx, 0);
          ctx.lineTo(guide.posPx, artworkHeight);
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
