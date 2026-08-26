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
  bleedColor: 'rgba(239, 68, 68, 0.75)', // Coral / Red dashed
  safeZoneColor: 'rgba(16, 185, 129, 0.75)', // Emerald / Green dashed
  trimColor: 'rgba(59, 130, 246, 0.4)', // Subtle Blue boundary
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
    const bleedPx = this.dimensions.bleedPx || 0;
    const safeZonePx = this.dimensions.safeZonePx || 0;

    ctx.save();
    // Scale context to match canvas viewport zoom
    ctx.scale(zoom, zoom);

    // 1. Bleed Area Margin (Red dashed line - outer print bleed boundary)
    if (this.settings.showBleed && (bleedPx > 0 || this.dimensions.bleedMm > 0)) {
      ctx.save();
      ctx.strokeStyle = this.settings.bleedColor || 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = Math.max(1.5 / zoom, 1);
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      
      // Draw visible red dashed bleed rectangle along the canvas boundary
      ctx.strokeRect(1 / zoom, 1 / zoom, width - 2 / zoom, height - 2 / zoom);

      // Corner crop / bleed tick marks at all 4 corners
      const tickLen = Math.min(16 / zoom, width * 0.06, height * 0.06);
      ctx.setLineDash([]);
      ctx.beginPath();
      // Top-Left
      ctx.moveTo(1 / zoom, tickLen);
      ctx.lineTo(1 / zoom, 1 / zoom);
      ctx.lineTo(tickLen, 1 / zoom);

      // Top-Right
      ctx.moveTo(width - 1 / zoom - tickLen, 1 / zoom);
      ctx.lineTo(width - 1 / zoom, 1 / zoom);
      ctx.lineTo(width - 1 / zoom, tickLen);

      // Bottom-Left
      ctx.moveTo(1 / zoom, height - 1 / zoom - tickLen);
      ctx.lineTo(1 / zoom, height - 1 / zoom);
      ctx.lineTo(tickLen, height - 1 / zoom);

      // Bottom-Right
      ctx.moveTo(width - 1 / zoom - tickLen, height - 1 / zoom);
      ctx.lineTo(width - 1 / zoom, height - 1 / zoom);
      ctx.lineTo(width - 1 / zoom, height - 1 / zoom - tickLen);

      ctx.stroke();

      // Bleed Area Tag in Top-Right
      const bleedMm = this.dimensions.bleedMm || 3;
      const bleedText = `Bleed (${bleedMm}mm)`;
      ctx.font = `600 ${Math.max(10 / zoom, 8.5)}px sans-serif`;
      const textWidth = ctx.measureText(bleedText).width;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.fillText(bleedText, width - textWidth - 8 / zoom, 14 / zoom);
      ctx.restore();
    }

    // 2. Safe Area Margin (Green dashed line - inner margin to protect text/logos)
    if (this.settings.showSafeZone && (safeZonePx > 0 || this.dimensions.safeZoneMm > 0)) {
      const safeOffset = safeZonePx > 0 ? safeZonePx : 35;
      const safeLeft = safeOffset;
      const safeTop = safeOffset;
      const safeWidth = Math.max(width - safeOffset * 2, 10);
      const safeHeight = Math.max(height - safeOffset * 2, 10);

      ctx.save();
      ctx.strokeStyle = this.settings.safeZoneColor || 'rgba(16, 185, 129, 0.85)';
      ctx.lineWidth = Math.max(1.5 / zoom, 1);
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      ctx.strokeRect(safeLeft, safeTop, safeWidth, safeHeight);

      // Safe Zone Tag in Top-Left
      const safeMm = this.dimensions.safeZoneMm || 3;
      const safeText = `Safe Area (${safeMm}mm)`;
      ctx.font = `600 ${Math.max(10 / zoom, 8.5)}px sans-serif`;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.fillText(safeText, safeLeft + 6 / zoom, safeTop + 14 / zoom);
      ctx.restore();
    }

    // 3. Trim Line (Exact Cut Boundary)
    if (this.settings.showTrim) {
      ctx.save();
      ctx.strokeStyle = this.settings.trimColor || 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = Math.max(1 / zoom, 0.75);
      ctx.setLineDash([]);
      ctx.strokeRect(0, 0, width, height);
      ctx.restore();
    }

    // 4. User-created Interactive Ruler Guidelines (Cyan/Blue)
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
