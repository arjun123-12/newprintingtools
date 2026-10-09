import { Canvas } from 'fabric';
import { CanvasDimensions, PrintGuidesSettings } from '@/types/designer';
import { PrintLayoutConfig, SideFoldingLayout } from '@/types/folding';
import { resolveSideFoldingLayout, normalizeFoldMargin, normalizeFoldBleed, normalizeFold } from '@/utils/foldingLayout';

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
  showFolds: true,
  bleedColor: 'rgba(239, 68, 68, 0.85)',
  safeZoneColor: 'rgba(16, 185, 129, 0.85)',
  trimColor: '#000000',
  foldColor: 'rgba(59, 130, 246, 0.9)',
};

function mmToPx(mm: number, dpi: number = 300): number {
  return Math.round((mm / 25.4) * dpi);
}

export class CanvasGuides {
  private canvas: Canvas | null = null;
  private dimensions: CanvasDimensions;
  private settings: PrintGuidesSettings = { ...DEFAULT_GUIDES_SETTINGS };
  private isVisible = true;
  private userGuides: UserRulerGuide[] = [];
  private printLayout: PrintLayoutConfig | null = null;
  private activeSide: 'front' | 'back' = 'front';
  private cachedSideLayout: SideFoldingLayout | null = null;

  constructor(
    dimensions: CanvasDimensions,
    initialSettings?: Partial<PrintGuidesSettings>
  ) {
    this.dimensions = dimensions;
    if (initialSettings) {
      this.settings = { ...this.settings, ...initialSettings };
    }
    if (dimensions.printLayout) {
      this.setPrintLayout(dimensions.printLayout);
    }
  }

  public attach(canvas: Canvas): void {
    this.canvas = canvas;
  }

  public detach(): void {
    this.canvas = null;
  }

  public setPrintLayout(layout: PrintLayoutConfig | null): void {
    if (layout?.folding?.folds) {
      this.printLayout = {
        ...layout,
        folding: {
          ...layout.folding,
          folds: layout.folding.folds.map((f, idx) => normalizeFold(f, idx)),
        },
      };
    } else {
      this.printLayout = layout;
    }
    this.recomputeSideFoldingLayout();
    this.canvas?.requestRenderAll();
  }

  public getPrintLayout(): PrintLayoutConfig | null {
    return this.printLayout;
  }

  public setActiveSide(side: 'front' | 'back'): void {
    if (this.activeSide !== side) {
      this.activeSide = side;
      this.recomputeSideFoldingLayout();
      this.canvas?.requestRenderAll();
    }
  }

  public getActiveSide(): 'front' | 'back' {
    return this.activeSide;
  }

  public updateDimensions(dims: CanvasDimensions): void {
    this.dimensions = dims;
    if (dims.printLayout !== undefined) {
      this.printLayout = dims.printLayout;
    }
    this.recomputeSideFoldingLayout();

    const dpi = dims.dpi || 300;
    const bleedPx = Math.max(0, Number(dims.bleedPx) || 0);

    this.userGuides = this.userGuides.map((guide) => ({
      ...guide,
      posMm: Number((((guide.posPx - bleedPx) / dpi) * 25.4).toFixed(1)),
    }));

    this.canvas?.requestRenderAll();
  }

  private recomputeSideFoldingLayout(): void {
    if (this.printLayout?.folding?.enabled) {
      try {
        this.cachedSideLayout = resolveSideFoldingLayout(
          this.printLayout.folding,
          this.activeSide
        );
      } catch {
        this.cachedSideLayout = null;
      }
    } else {
      this.cachedSideLayout = null;
    }
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
    const { artworkWidth, artworkHeight, bleedPx } = this.getArtworkBounds();

    const maximum =
      orientation === 'horizontal' ? artworkHeight : artworkWidth;

    const normalizedPosPx = Math.max(0, Math.min(maximum, posPx));

    const guide: UserRulerGuide = {
      id: `guide_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 7)}`,
      orientation,
      posPx: normalizedPosPx,
      posMm: Number((((normalizedPosPx - bleedPx) / dpi) * 25.4).toFixed(1)),
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
    const { artworkWidth, artworkHeight, bleedPx } = this.getArtworkBounds();

    const maximum =
      current.orientation === 'horizontal'
        ? artworkHeight
        : artworkWidth;

    const normalizedPosPx = Math.max(0, Math.min(maximum, posPx));
    const dpi = this.dimensions.dpi || 300;

    const updated: UserRulerGuide = {
      ...current,
      posPx: normalizedPosPx,
      posMm: Number((((normalizedPosPx - bleedPx) / dpi) * 25.4).toFixed(1)),
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
    const { bleedPx } = this.getArtworkBounds();
    const dpi = this.dimensions.dpi || 300;
    this.userGuides = guides.map((guide) => ({
      ...guide,
      posMm: Number((((guide.posPx - bleedPx) / dpi) * 25.4).toFixed(1)),
    }));
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

    const dpi = this.dimensions.dpi || 300;

    ctx.save();
    ctx.scale(zoom, zoom);

    // 1. RED = outer bleed boundary.
    if (this.settings.showBleed !== false) {
      ctx.save();
      ctx.strokeStyle = this.settings.bleedColor || '#ef4444';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);

      if (this.printLayout?.outerBleed) {
        const topBleedPx = mmToPx(this.printLayout.outerBleed.top, dpi);
        const rightBleedPx = mmToPx(this.printLayout.outerBleed.right, dpi);
        const bottomBleedPx = mmToPx(this.printLayout.outerBleed.bottom, dpi);
        const leftBleedPx = mmToPx(this.printLayout.outerBleed.left, dpi);

        const halfStroke = 0.75 / zoom;
        ctx.strokeRect(
          bleedPx - leftBleedPx + halfStroke,
          bleedPx - topBleedPx + halfStroke,
          Math.max(trimWidth + leftBleedPx + rightBleedPx - 1.5 / zoom, 0),
          Math.max(trimHeight + topBleedPx + bottomBleedPx - 1.5 / zoom, 0)
        );
      } else {
        const halfStroke = 0.75 / zoom;
        ctx.strokeRect(
          halfStroke,
          halfStroke,
          Math.max(artworkWidth - 1.5 / zoom, 0),
          Math.max(artworkHeight - 1.5 / zoom, 0)
        );
      }

      ctx.restore();
    }

    // 2. BLACK = trim/cut boundary.
    if (this.settings.showTrim) {
      ctx.save();
      ctx.setLineDash([]);

      // Subtle casing keeps trim line visible over dark artwork
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 3 / zoom;
      ctx.strokeRect(bleedPx, bleedPx, trimWidth, trimHeight);

      ctx.strokeStyle = this.settings.trimColor || '#000000';
      ctx.lineWidth = 1.5 / zoom;
      ctx.strokeRect(bleedPx, bleedPx, trimWidth, trimHeight);

      ctx.restore();
    }

    // 3. GREEN = outer safe boundary inside trim line.
    if (this.settings.showSafeZone) {
      ctx.save();
      ctx.strokeStyle = this.settings.safeZoneColor || '#10b981';
      ctx.lineWidth = 1.2 / zoom;
      ctx.setLineDash([5 / zoom, 4 / zoom]);

      if (this.printLayout?.safeMargin) {
        const topSafePx = mmToPx(this.printLayout.safeMargin.top, dpi);
        const rightSafePx = mmToPx(this.printLayout.safeMargin.right, dpi);
        const bottomSafePx = mmToPx(this.printLayout.safeMargin.bottom, dpi);
        const leftSafePx = mmToPx(this.printLayout.safeMargin.left, dpi);

        if (
          trimWidth > leftSafePx + rightSafePx &&
          trimHeight > topSafePx + bottomSafePx
        ) {
          ctx.strokeRect(
            bleedPx + leftSafePx,
            bleedPx + topSafePx,
            trimWidth - leftSafePx - rightSafePx,
            trimHeight - topSafePx - bottomSafePx
          );
        }
      } else {
        const marginPx = Math.max(0, Number(this.dimensions.marginPx ?? 0));
        const safeInset = Math.min(
          marginPx,
          Math.max(0, Math.min(trimWidth, trimHeight) / 2 - 1)
        );

        if (safeInset > 0 && safeInset * 2 < trimWidth && safeInset * 2 < trimHeight) {
          ctx.strokeRect(
            bleedPx + safeInset,
            bleedPx + safeInset,
            trimWidth - safeInset * 2,
            trimHeight - safeInset * 2
          );
        }
      }

      ctx.restore();
    }

    // 4. FOLDING SYSTEM: Panels, Fold lines, Fold Margins, and Fold Bleeds
    if (
      this.printLayout?.folding?.enabled &&
      this.settings.showFolds !== false
    ) {
      if (!this.cachedSideLayout) {
        this.recomputeSideFoldingLayout();
      }
      const sideLayout: SideFoldingLayout | null = this.cachedSideLayout;
      if (!sideLayout) return;

      const isVertical =
        this.printLayout.folding.panelOrientation !== 'horizontal';

      const foldStrokeColor =
        this.settings.foldColor || 'rgba(59, 130, 246, 0.9)';

      ctx.save();

      if (isVertical) {
        // --- VERTICAL FOLDS (Dividing Sheet Horizontally into Panels) ---

        // A. Draw Fold Crease Lines, Fold Margins, and Fold Bleeds
        sideLayout.folds.forEach((fold) => {
          const foldPx = bleedPx + mmToPx(fold.position, dpi);
          if (foldPx <= bleedPx || foldPx >= bleedPx + trimWidth) return;

          const margin = normalizeFoldMargin(fold);
          const bleed = normalizeFoldBleed(fold);

          // 1. Fold Safe Margin Zone (Non-printable clearance around fold)
          const marginLeftPx = mmToPx(margin.left, dpi);
          const marginRightPx = mmToPx(margin.right, dpi);
          const marginTopPx = mmToPx(margin.top, dpi);
          const marginBottomPx = mmToPx(margin.bottom, dpi);

          const safeY = bleedPx + marginTopPx;
          const safeH = Math.max(0, trimHeight - marginTopPx - marginBottomPx);
          const safeW = marginLeftPx + marginRightPx;

          if (safeW > 0 || marginTopPx > 0 || marginBottomPx > 0) {
            // Fold margin shading
            ctx.save();
            ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
            ctx.fillRect(
              foldPx - marginLeftPx,
              safeY,
              safeW,
              safeH
            );

            // Fold margin boundary lines
            ctx.strokeStyle = this.settings.safeZoneColor || '#10b981';
            ctx.lineWidth = 1 / zoom;
            ctx.setLineDash([4 / zoom, 4 / zoom]);

            if (marginLeftPx > 0) {
              ctx.beginPath();
              ctx.moveTo(foldPx - marginLeftPx, safeY);
              ctx.lineTo(foldPx - marginLeftPx, safeY + safeH);
              ctx.stroke();
            }

            if (marginRightPx > 0) {
              ctx.beginPath();
              ctx.moveTo(foldPx + marginRightPx, safeY);
              ctx.lineTo(foldPx + marginRightPx, safeY + safeH);
              ctx.stroke();
            }

            if (marginTopPx > 0 && safeW > 0) {
              ctx.beginPath();
              ctx.moveTo(foldPx - marginLeftPx, safeY);
              ctx.lineTo(foldPx + marginRightPx, safeY);
              ctx.stroke();
            }

            if (marginBottomPx > 0 && safeW > 0) {
              ctx.beginPath();
              ctx.moveTo(foldPx - marginLeftPx, safeY + safeH);
              ctx.lineTo(foldPx + marginRightPx, safeY + safeH);
              ctx.stroke();
            }
            ctx.restore();
          }

          // 2. Fold Bleed Area (Crossover tolerance around fold)
          const bleedLeftPx = mmToPx(bleed.left, dpi);
          const bleedRightPx = mmToPx(bleed.right, dpi);
          const bleedTopPx = mmToPx(bleed.top, dpi);
          const bleedBottomPx = mmToPx(bleed.bottom, dpi);

          const bleedY = bleedPx - bleedTopPx;
          const bleedH = trimHeight + bleedTopPx + bleedBottomPx;
          const bleedW = bleedLeftPx + bleedRightPx;

          if (bleedW > 0 || bleedTopPx > 0 || bleedBottomPx > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.lineWidth = 0.8 / zoom;
            ctx.setLineDash([2 / zoom, 4 / zoom]);

            if (bleedLeftPx > 0) {
              ctx.beginPath();
              ctx.moveTo(foldPx - bleedLeftPx, bleedY);
              ctx.lineTo(foldPx - bleedLeftPx, bleedY + bleedH);
              ctx.stroke();
            }

            if (bleedRightPx > 0) {
              ctx.beginPath();
              ctx.moveTo(foldPx + bleedRightPx, bleedY);
              ctx.lineTo(foldPx + bleedRightPx, bleedY + bleedH);
              ctx.stroke();
            }

            if (bleedTopPx > 0 && bleedW > 0) {
              ctx.beginPath();
              ctx.moveTo(foldPx - bleedLeftPx, bleedY);
              ctx.lineTo(foldPx + bleedRightPx, bleedY);
              ctx.stroke();
            }

            if (bleedBottomPx > 0 && bleedW > 0) {
              ctx.beginPath();
              ctx.moveTo(foldPx - bleedLeftPx, bleedY + bleedH);
              ctx.lineTo(foldPx + bleedRightPx, bleedY + bleedH);
              ctx.stroke();
            }
            ctx.restore();
          }

          // 3. Fold Crease Line
          ctx.save();
          ctx.strokeStyle = foldStrokeColor;
          ctx.lineWidth = 1.6 / zoom;
          ctx.setLineDash([8 / zoom, 5 / zoom]);

          ctx.beginPath();
          ctx.moveTo(foldPx, bleedPx);
          ctx.lineTo(foldPx, bleedPx + trimHeight);
          ctx.stroke();

          // Tick marks extending into bleed at cut edge
          ctx.setLineDash([]);
          ctx.lineWidth = 1.5 / zoom;
          ctx.beginPath();
          ctx.moveTo(foldPx, Math.max(0, bleedPx - 8 / zoom));
          ctx.lineTo(foldPx, bleedPx);
          ctx.moveTo(foldPx, bleedPx + trimHeight);
          ctx.lineTo(foldPx, Math.min(artworkHeight, bleedPx + trimHeight + 8 / zoom));
          ctx.stroke();

          // Fold label badge at top tick
          const foldLabel = `FOLD ${fold.index + 1}`;
          ctx.font = `bold ${Math.max(9 / zoom, 8)}px sans-serif`;
          const textWidth = ctx.measureText(foldLabel).width;
          const badgeW = textWidth + 8 / zoom;
          const badgeH = 14 / zoom;
          const badgeX = foldPx - badgeW / 2;
          const badgeY = Math.max(2 / zoom, bleedPx - 18 / zoom);

          ctx.fillStyle = foldStrokeColor;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3 / zoom);
          } else {
            ctx.rect(badgeX, badgeY, badgeW, badgeH);
          }
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(foldLabel, foldPx, badgeY + badgeH / 2);

          ctx.restore();
        });

        // B. Draw Panel Boundary Badges / Tags
        let currentPanelStartMm = 0;
        sideLayout.panels.forEach((panel, pIdx) => {
          const panelStartPx = bleedPx + mmToPx(currentPanelStartMm, dpi);
          const panelWidthPx = mmToPx(panel.width, dpi);
          const panelCenterPx = panelStartPx + panelWidthPx / 2;
          currentPanelStartMm += panel.width;

          // Subtle panel top badge
          ctx.save();
          const panelName = (pIdx === 2 || panel.index === 2)
            ? 'Logo Panel'
            : (panel.label || `Panel ${panel.index + 1}`);
          const labelText = `${panelName} (${panel.width}mm)`;
          ctx.font = `600 ${Math.max(10 / zoom, 9)}px sans-serif`;
          const labelW = ctx.measureText(labelText).width;
          const padX = 8 / zoom;
          const pillW = labelW + padX * 2;
          const pillH = 18 / zoom;
          const pillX = panelCenterPx - pillW / 2;
          const pillY = bleedPx + 6 / zoom;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1 / zoom;

          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(pillX, pillY, pillW, pillH, 4 / zoom);
          } else {
            ctx.rect(pillX, pillY, pillW, pillH);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, panelCenterPx, pillY + pillH / 2);
          ctx.restore();
        });
      } else {
        // --- HORIZONTAL FOLDS (Dividing Sheet Vertically into Panels) ---
        sideLayout.folds.forEach((fold) => {
          const foldPx = bleedPx + mmToPx(fold.position, dpi);
          if (foldPx <= bleedPx || foldPx >= bleedPx + trimHeight) return;

          const margin = normalizeFoldMargin(fold);
          const bleed = normalizeFoldBleed(fold);

          const marginTopPx = mmToPx(margin.top, dpi);
          const marginBottomPx = mmToPx(margin.bottom, dpi);
          const marginLeftPx = mmToPx(margin.left, dpi);
          const marginRightPx = mmToPx(margin.right, dpi);

          const bleedTopPx = mmToPx(bleed.top, dpi);
          const bleedBottomPx = mmToPx(bleed.bottom, dpi);
          const bleedLeftPx = mmToPx(bleed.left, dpi);
          const bleedRightPx = mmToPx(bleed.right, dpi);

          const safeX = bleedPx + marginLeftPx;
          const safeW = Math.max(0, trimWidth - marginLeftPx - marginRightPx);
          const safeH = marginTopPx + marginBottomPx;

          if (safeH > 0 || marginLeftPx > 0 || marginRightPx > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
            ctx.fillRect(
              safeX,
              foldPx - marginTopPx,
              safeW,
              safeH
            );

            ctx.strokeStyle = this.settings.safeZoneColor || '#10b981';
            ctx.lineWidth = 1 / zoom;
            ctx.setLineDash([4 / zoom, 4 / zoom]);

            if (marginTopPx > 0) {
              ctx.beginPath();
              ctx.moveTo(safeX, foldPx - marginTopPx);
              ctx.lineTo(safeX + safeW, foldPx - marginTopPx);
              ctx.stroke();
            }

            if (marginBottomPx > 0) {
              ctx.beginPath();
              ctx.moveTo(safeX, foldPx + marginBottomPx);
              ctx.lineTo(safeX + safeW, foldPx + marginBottomPx);
              ctx.stroke();
            }

            if (marginLeftPx > 0 && safeH > 0) {
              ctx.beginPath();
              ctx.moveTo(safeX, foldPx - marginTopPx);
              ctx.lineTo(safeX, foldPx + marginBottomPx);
              ctx.stroke();
            }

            if (marginRightPx > 0 && safeH > 0) {
              ctx.beginPath();
              ctx.moveTo(safeX + safeW, foldPx - marginTopPx);
              ctx.lineTo(safeX + safeW, foldPx + marginBottomPx);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Bleed Area
          const bleedX = bleedPx - bleedLeftPx;
          const bleedW = trimWidth + bleedLeftPx + bleedRightPx;
          const bleedH = bleedTopPx + bleedBottomPx;

          if (bleedH > 0 || bleedLeftPx > 0 || bleedRightPx > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.lineWidth = 0.8 / zoom;
            ctx.setLineDash([2 / zoom, 4 / zoom]);

            if (bleedTopPx > 0) {
              ctx.beginPath();
              ctx.moveTo(bleedX, foldPx - bleedTopPx);
              ctx.lineTo(bleedX + bleedW, foldPx - bleedTopPx);
              ctx.stroke();
            }

            if (bleedBottomPx > 0) {
              ctx.beginPath();
              ctx.moveTo(bleedX, foldPx + bleedBottomPx);
              ctx.lineTo(bleedX + bleedW, foldPx + bleedBottomPx);
              ctx.stroke();
            }

            if (bleedLeftPx > 0 && bleedH > 0) {
              ctx.beginPath();
              ctx.moveTo(bleedX, foldPx - bleedTopPx);
              ctx.lineTo(bleedX, foldPx + bleedBottomPx);
              ctx.stroke();
            }

            if (bleedRightPx > 0 && bleedH > 0) {
              ctx.beginPath();
              ctx.moveTo(bleedX + bleedW, foldPx - bleedTopPx);
              ctx.lineTo(bleedX + bleedW, foldPx + bleedBottomPx);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Crease line
          ctx.save();
          ctx.strokeStyle = foldStrokeColor;
          ctx.lineWidth = 1.6 / zoom;
          ctx.setLineDash([8 / zoom, 5 / zoom]);
          ctx.beginPath();
          ctx.moveTo(bleedPx, foldPx);
          ctx.lineTo(bleedPx + trimWidth, foldPx);
          ctx.stroke();
          ctx.restore();
        });
      }

      ctx.restore();
    }

    // 5. User ruler guides
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
