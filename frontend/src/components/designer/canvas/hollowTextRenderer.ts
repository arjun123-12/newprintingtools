import { FabricText, IText, Textbox } from 'fabric';

/**
 * Reusable scratch canvas buffer for hollow text knockout rendering.
 */
let scratchCanvas: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function getHollowScratchCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const safeW = Math.max(1, Math.ceil(width));
  const safeH = Math.max(1, Math.ceil(height));

  if (!scratchCanvas) {
    scratchCanvas = document.createElement('canvas');
    scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: false });
  }
  if (!scratchCanvas || !scratchCtx) return null;

  if (scratchCanvas.width !== safeW || scratchCanvas.height !== safeH) {
    scratchCanvas.width = safeW;
    scratchCanvas.height = safeH;
  }
  return { canvas: scratchCanvas, ctx: scratchCtx };
}

let isInstalled = false;

/**
 * Detects whether a Fabric text object has the Hollow effect active.
 */
export function isHollowTextObject(obj: any): boolean {
  if (!obj) return false;
  const isText =
    obj instanceof FabricText ||
    obj instanceof IText ||
    obj instanceof Textbox ||
    obj.type === 'textbox' ||
    obj.type === 'itext' ||
    obj.type === 'text' ||
    typeof obj._renderText === 'function';

  if (!isText) return false;

  const fill = obj.fill;
  const isTransparentFill =
    fill === 'transparent' ||
    !fill ||
    fill === 'rgba(0,0,0,0)' ||
    fill === 'none';

  return Boolean(
    obj._isHollow ||
    obj.isHollow ||
    obj._activeEffects?.hollow ||
    (isTransparentFill && obj.stroke && (obj.strokeWidth || 0) > 0 && obj.paintFirst === 'stroke')
  );
}

/**
 * Installs the clean hollow text renderer on Fabric's Text classes (FabricText, IText, Textbox).
 *
 * Problem:
 * When hollow text is drawn with transparent fill and stroke, native 2D canvas `strokeText()`
 * traces every internal contour of font glyphs (e.g. crossbars cutting through the diagonal legs in 'A',
 * the vertical stem cutting through the round bowl in 'd' and 'b', the arch cutting through the stem in 'h',
 * the loop cutting through the link in 'g'). Additionally, canvas strokes are centered, so half the stroke
 * width bleeds inward into character counters ("inner lap").
 *
 * Solution:
 * We render the stroke onto an isolated scratch buffer matching the exact transform matrix, then apply
 * `globalCompositeOperation = 'destination-out'` with an opaque `fillText` knockout pass.
 * Because `fillText` fills the entire union of the glyph interior using the non-zero winding rule,
 * `destination-out` completely erases all internal overlapping contour lines, crossbars, and inner stroke
 * bleed. This leaves only the clean, crisp outer perimeter with a 100% transparent interior.
 */
export function installHollowTextRenderer(): void {
  if (isInstalled) return;
  isInstalled = true;

  const origRenderText = FabricText.prototype._renderText;

  const hollowRenderText = function (
    this: any,
    ctx: CanvasRenderingContext2D
  ): void {
    const isHollow = isHollowTextObject(this);

    if (!isHollow) {
      origRenderText.call(this, ctx);
      return;
    }

    const targetCanvas = ctx.canvas;
    if (!targetCanvas || targetCanvas.width === 0 || targetCanvas.height === 0) {
      origRenderText.call(this, ctx);
      return;
    }

    const scratch = getHollowScratchCanvas(targetCanvas.width, targetCanvas.height);
    if (!scratch) {
      origRenderText.call(this, ctx);
      return;
    }

    const { canvas: sCanvas, ctx: sCtx } = scratch;

    // Reset and clear scratch buffer
    sCtx.save();
    sCtx.setTransform(1, 0, 0, 1, 0, 0);
    sCtx.clearRect(0, 0, sCanvas.width, sCanvas.height);
    sCtx.restore();

    // Replicate exact matrix transform from target context (retina scaling, pan, zoom, rotation, translation)
    const currentTransform = ctx.getTransform();
    sCtx.setTransform(currentTransform);

    // Synchronize font baseline and styles on scratch context
    if (typeof this._setTextStyles === 'function') {
      this._setTextStyles(sCtx);
    }

    // Isolate shadow so it's not baked directly into the scratch buffer outline.
    // The target context or object cache handles the cast shadow when sCanvas is composited.
    const origShadow = this.shadow;
    this.shadow = null;

    // Step 1: Render outer stroke onto scratch canvas
    sCtx.save();
    if (typeof this._renderTextStroke === 'function') {
      this._renderTextStroke(sCtx);
    }
    sCtx.restore();

    // Step 2: Knock out the glyph interior with destination-out + solid fill.
    // Destination-out clears all pixels where fillText is drawn with 100% alpha.
    sCtx.save();
    sCtx.globalCompositeOperation = 'destination-out';

    const origFill = this.fill;
    this.fill = '#000000';

    // Intercept style declaration during knockout pass so character-level overrides
    // do not output 'transparent' fill during destination-out.
    const origGetCompleteStyleDeclaration = this.getCompleteStyleDeclaration;
    if (typeof origGetCompleteStyleDeclaration === 'function') {
      this.getCompleteStyleDeclaration = function (lineIndex: number, charIndex: number) {
        const decl = origGetCompleteStyleDeclaration.call(this, lineIndex, charIndex);
        return { ...decl, fill: '#000000' };
      };
    }

    const origGetStyleDeclaration = this._getStyleDeclaration;
    if (typeof origGetStyleDeclaration === 'function') {
      this._getStyleDeclaration = function (lineIndex: number, charIndex: number) {
        const decl = origGetStyleDeclaration.call(this, lineIndex, charIndex);
        return { ...decl, fill: '#000000' };
      };
    }

    if (typeof this._setTextStyles === 'function') {
      this._setTextStyles(sCtx);
    }

    if (typeof this._renderTextFill === 'function') {
      this._renderTextFill(sCtx);
    }

    // Restore original object state
    this.fill = origFill;
    if (typeof origGetCompleteStyleDeclaration === 'function') {
      this.getCompleteStyleDeclaration = origGetCompleteStyleDeclaration;
    }
    if (typeof origGetStyleDeclaration === 'function') {
      this._getStyleDeclaration = origGetStyleDeclaration;
    }
    sCtx.restore();

    // Restore shadow on object
    this.shadow = origShadow;

    // Step 3: Draw knocked-out hollow outline onto target context.
    // If target context has a shadow configured, ctx.drawImage naturally casts
    // the shadow strictly from the hollow perimeter outline.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sCanvas, 0, 0);
    ctx.restore();
  };

  FabricText.prototype._renderText = hollowRenderText;
  Textbox.prototype._renderText = hollowRenderText;
  IText.prototype._renderText = hollowRenderText;
}
