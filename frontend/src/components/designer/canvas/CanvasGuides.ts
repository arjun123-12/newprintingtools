import { Canvas } from 'fabric';
import { CanvasDimensions, PrintGuidesSettings } from '@/types/designer';

export interface UserRulerGuide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  posPx: number; // in unzoomed canvas pixels
  posMm: number; // in mm
}

export const DEFAULT_GUIDES_SETTINGS: PrintGuidesSettings = {
  showBleed: true,
  showSafeZone: true,
  showTrim: true,
  bleedColor: 'rgba(239, 68, 68, 0.85)', // Coral / Red dashed
  safeZoneColor: 'rgba(16, 185, 129, 0.85)', // Emerald / Green dashed
  trimColor: '#000000', // Dark Black Trim Line
};

export class CanvasGuides {
  private canvas: Canvas | null = null;
  private dimensions: CanvasDimensions;
  private settings: PrintGuidesSettings = { ...DEFAULT_GUIDES_SETTINGS };
  private isVisible: boolean = true;
  private userGuides: UserRulerGuide[] = [];

  constructor(dimensions: CanvasDimensions, initialSettings?: Partial<PrintGuidesSettings>) {
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
    // Recalculate user guide mm values based on new dimensions/dpi
    const dpi = dims.dpi || 300;
    this.userGuides = this.userGuides.map((g) => ({
      ...g,
      posMm: Number(((g.posPx / dpi) * 25.4).toFixed(1)),
    }));
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }

  public toggleVisible(): boolean {
    this.isVisible = !this.isVisible;
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
    return this.isVisible;
  }

  public getVisible(): boolean {
    return this.isVisible;
  }

  public updateSettings(newSettings: Partial<PrintGuidesSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }

  public getSettings(): PrintGuidesSettings {
    return { ...this.settings };
  }

  // --- User-created Ruler Guidelines ---

  public addUserGuide(orientation: 'horizontal' | 'vertical', posPx: number): UserRulerGuide {
    const dpi = this.dimensions.dpi || 300;
    const posMm = Number(((posPx / dpi) * 25.4).toFixed(1));
    const guide: UserRulerGuide = {
      id: `guide_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orientation,
      posPx,
      posMm,
    };
    this.userGuides.push(guide);
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
    return guide;
  }

  public removeUserGuide(id: string): void {
    this.userGuides = this.userGuides.filter((g) => g.id !== id);
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }

  public clearUserGuides(): void {
    this.userGuides = [];
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }

  public getUserGuides(): UserRulerGuide[] {
    return [...this.userGuides];
  }

  public setUserGuides(guides: UserRulerGuide[]): void {
    this.userGuides = [...guides];
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }

  /**
   * Renders the print guide overlays directly onto the canvas 2D rendering context
   * during after:render. These guides are non-destructive and never exported.
   */
  public renderGuides(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (!this.isVisible || !this.canvas) return;

    const width = this.dimensions.widthPx || 1063;
    const height = this.dimensions.heightPx || 591;
    const bleedMm = this.dimensions.bleedMm !== undefined ? this.dimensions.bleedMm : 5;
    const bleedPx = this.dimensions.bleedPx || 0;
    const safeZonePx = this.dimensions.safeZonePx || 0;

    // Calculate trim box boundaries based on bleed
    const trimX = bleedPx > 0 ? bleedPx : 0;
    const trimY = bleedPx > 0 ? bleedPx : 0;
    const trimW = bleedPx > 0 ? Math.max(width - bleedPx * 2, 10) : width;
    const trimH = bleedPx > 0 ? Math.max(height - bleedPx * 2, 10) : height;

    ctx.save();
    // Scale context to match canvas viewport zoom
    ctx.scale(zoom, zoom);

    // =========================================================================
    // 1. BLEED AREA (Red dashed line - outer print bleed boundary)
    // =========================================================================
    if (this.settings.showBleed && (bleedPx > 0 || bleedMm > 0)) {
      ctx.save();
      ctx.strokeStyle = this.settings.bleedColor || 'rgba(239, 68, 68, 0.75)';
      ctx.lineWidth = Math.max(1.2 / zoom, 1);
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      // Draw clean simple bleed rectangle along the outer canvas boundary
      ctx.strokeRect(0.5 / zoom, 0.5 / zoom, width - 1 / zoom, height - 1 / zoom);
      ctx.restore();
    }

    // =========================================================================
    // 2. TRIM LINE (Clean, Simple Cut Line - Uniform with Safe Margin)
    // =========================================================================
    if (this.settings.showTrim) {
      ctx.save();
      // Clean subtle trim boundary line (solid, uniform)
      ctx.strokeStyle = this.settings.trimColor || 'rgba(15, 23, 42, 0.75)';
      ctx.lineWidth = Math.max(1.2 / zoom, 1);
      ctx.setLineDash([]);
      ctx.strokeRect(trimX, trimY, trimW, trimH);
      ctx.restore();
    }

    // =========================================================================
    // 3. SAFE AREA MARGIN (Green dashed line - inner margin to protect text/logos)
    // =========================================================================
    if (this.settings.showSafeZone && (safeZonePx > 0 || this.dimensions.safeZoneMm > 0)) {
      const safeOffset = safeZonePx > 0 ? safeZonePx : 35;
      const safeLeft = trimX + safeOffset;
      const safeTop = trimY + safeOffset;
      const safeWidth = Math.max(trimW - safeOffset * 2, 10);
      const safeHeight = Math.max(trimH - safeOffset * 2, 10);

      ctx.save();
      ctx.strokeStyle = this.settings.safeZoneColor || 'rgba(16, 185, 129, 0.85)';
      ctx.lineWidth = Math.max(1.5 / zoom, 1);
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      ctx.strokeRect(safeLeft, safeTop, safeWidth, safeHeight);

      // Safe Zone Tag
      const safeMm = this.dimensions.safeZoneMm || 3;
      const safeText = '';
      ctx.font = `bold ${Math.max(9 / zoom, 7.5)}px sans-serif`;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.fillText(safeText, safeLeft + 6 / zoom, safeTop + 12 / zoom);
      ctx.restore();
    }

    // =========================================================================
    // 4. USER-CREATED INTERACTIVE RULER GUIDELINES (Cyan/Blue)
    // =========================================================================
    if (this.userGuides.length > 0) {
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.9)'; // Cyan 500
      ctx.lineWidth = Math.max(1 / zoom, 1);
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

        // Label on the guide
        ctx.fillStyle = 'rgba(6, 182, 212, 0.95)';
        ctx.font = `${Math.max(10 / zoom, 9)}px sans-serif`;
        if (guide.orientation === 'horizontal') {
          ctx.fillText(`${guide.posMm} mm`, 8 / zoom, guide.posPx - 3 / zoom);
        } else {
          ctx.fillText(`${guide.posMm} mm`, guide.posPx + 4 / zoom, 16 / zoom);
        }
      }
    }

    ctx.restore();
  }
}
