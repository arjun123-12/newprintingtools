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
      ctx.strokeStyle = this.settings.bleedColor || 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = Math.max(1.5 / zoom, 1);
      ctx.setLineDash([6 / zoom, 4 / zoom]);

      // Draw visible red dashed bleed rectangle along the outer canvas boundary
      ctx.strokeRect(1 / zoom, 1 / zoom, width - 2 / zoom, height - 2 / zoom);

      // Corner crop / bleed tick marks at all 4 outer corners
      const tickLen = Math.min(14 / zoom, width * 0.05, height * 0.05);
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
      const bleedText = '';
      ctx.font = `bold ${Math.max(9.5 / zoom, 8)}px sans-serif`;
      const textWidth = ctx.measureText(bleedText).width;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.fillText(bleedText, width - textWidth - 8 / zoom, 14 / zoom);
      ctx.restore();
    }

    // =========================================================================
    // 2. TRIM LINE IN DARK BLACK (Exact Machine / Guillotine Cut Line)
    // =========================================================================
    if (this.settings.showTrim) {
      ctx.save();
      // Solid crisp dark black stroke
      ctx.strokeStyle = this.settings.trimColor || '#000000';
      ctx.lineWidth = Math.max(1.5 / zoom, 1.2);
      ctx.setLineDash([]);

      // Draw dark black cut boundary
      ctx.strokeRect(trimX, trimY, trimW, trimH);

      // Corner Trim / Crop marks in Dark Black at trim line corners
      const cropLen = Math.min(18 / zoom, trimW * 0.08, trimH * 0.08);
      ctx.beginPath();
      // Top-Left Trim Corner
      ctx.moveTo(trimX, trimY - cropLen);
      ctx.lineTo(trimX, trimY);
      ctx.lineTo(trimX - cropLen, trimY);

      // Top-Right Trim Corner
      ctx.moveTo(trimX + trimW, trimY - cropLen);
      ctx.lineTo(trimX + trimW, trimY);
      ctx.lineTo(trimX + trimW + cropLen, trimY);

      // Bottom-Left Trim Corner
      ctx.moveTo(trimX, trimY + trimH + cropLen);
      ctx.lineTo(trimX, trimY + trimH);
      ctx.lineTo(trimX - cropLen, trimY + trimH);

      // Bottom-Right Trim Corner
      ctx.moveTo(trimX + trimW, trimY + trimH + cropLen);
      ctx.lineTo(trimX + trimW, trimY + trimH);
      ctx.lineTo(trimX + trimW + cropLen, trimY + trimH);

      ctx.stroke();

      // Trim Line Badge / Label
      const trimText = '';
      ctx.font = `bold ${Math.max(9 / zoom, 7.5)}px sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.fillText(trimText, trimX + 6 / zoom, trimY + 12 / zoom);
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
