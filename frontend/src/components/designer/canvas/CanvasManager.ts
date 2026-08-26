import {
  Canvas,
  Rect,
  Circle,
  Triangle,
  Polygon,
  IText,
  Textbox,
  FabricImage,
  FabricObject,
  ActiveSelection,
  TPointerEventInfo,
  Point,
  PencilBrush,
  SprayBrush,
  CircleBrush,
  Shadow,
  Path,
  Gradient,
} from 'fabric';
import {
  SelectedObjectState,
  AlignmentType,
  CanvasDimensions,
  PrintGuidesSettings,
  LayerItem,
  DesignerTemplate,
  FrameShapeType,
  BrushSettings,
  BrushType,
  BackgroundSettings,
} from '@/types/designer';
import { CanvasGuides } from './CanvasGuides';
import { CanvasSnapping } from './CanvasSnapping';
import { POPULAR_FONTS, loadFont } from '../utils/fonts';
import { calculateImageQuality } from '../utils/imageQuality';
import { runPreflightCheck, PreflightReport } from '../utils/preflightCheck';

export const ZOOM_PRESETS = [
  0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0,
];

export type CanvasEventCallback = () => void;
export type SelectionEventCallback = (state: SelectedObjectState | null) => void;
export type ZoomEventCallback = (zoom: number) => void;
export type GuidesEventCallback = (visible: boolean) => void;
export type LayersEventCallback = (layers: LayerItem[]) => void;
export type PreflightEventCallback = (report: PreflightReport) => void;
export type DrawingModeEventCallback = (enabled: boolean) => void;
export type BrushSettingsEventCallback = (settings: BrushSettings) => void;
export type BackgroundEventCallback = (settings: BackgroundSettings) => void;

export interface AddTextOptions {
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  fill?: string;
  left?: number;
  top?: number;
  width?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  name?: string;
}

export interface ImageMetadata {
  naturalWidth?: number;
  naturalHeight?: number;
  fileSizeBytes?: number;
  originalSrc?: string;
  name?: string;
}

export function hexWithAlpha(hex: string, alpha: number): string {
  let clean = (hex || '#000000').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) clean = '000000';
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const a = Number(Math.min(Math.max(alpha !== undefined ? alpha : 1, 0), 1).toFixed(2));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export class CanvasManager {
  private canvas: Canvas | null = null;
  private dimensions: CanvasDimensions;
  private guides: CanvasGuides;
  private snapping: CanvasSnapping;
  private zoom: number = 1.0;
  private isPanMode: boolean = false;
  private isDrawing: boolean = false;
  private brushSettings: BrushSettings = {
    tool: 'brush',
    size: 12,
    color: '#2563eb',
    opacity: 1.0,
    smoothness: 1.0,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    sprayDensity: 25,
    sprayDotWidth: 2,
    calligraphyAngle: 45,
  };
  private backgroundSettings: BackgroundSettings = {
    type: 'color',
    color: '#ffffff',
  };

  // Listeners
  private selectionListeners: Set<SelectionEventCallback> = new Set();
  private zoomListeners: Set<ZoomEventCallback> = new Set();
  private changeListeners: Set<CanvasEventCallback> = new Set();
  private guidesListeners: Set<GuidesEventCallback> = new Set();
  private layersListeners: Set<LayersEventCallback> = new Set();
  private preflightListeners: Set<PreflightEventCallback> = new Set();
  private drawingModeListeners: Set<DrawingModeEventCallback> = new Set();
  private brushSettingsListeners: Set<BrushSettingsEventCallback> = new Set();
  private backgroundListeners: Set<BackgroundEventCallback> = new Set();

  constructor(dimensions: CanvasDimensions, initialGuidesSettings?: Partial<PrintGuidesSettings>) {
    this.dimensions = dimensions;
    this.guides = new CanvasGuides(dimensions, initialGuidesSettings);
    this.snapping = new CanvasSnapping(dimensions);
  }

  public initialize(
    canvasEl: HTMLCanvasElement,
    containerWidth: number,
    containerHeight: number
  ): Canvas {
    if (this.canvas) {
      try {
        this.canvas.dispose();
      } catch {
        // ignore
      }
      this.canvas = null;
    }

    const baseWidth = this.dimensions.widthPx || 1063;
    const baseHeight = this.dimensions.heightPx || 591;

    this.zoom = this.zoom || 1.0;
    const targetWidth = Math.round(baseWidth * this.zoom);
    const targetHeight = Math.round(baseHeight * this.zoom);

    const canvas = new Canvas(canvasEl, {
      width: targetWidth,
      height: targetHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true,
      fireRightClick: true,
      enableRetinaScaling: true,
      imageSmoothingEnabled: true,
    });

    canvas.setZoom(this.zoom);

    this.canvas = canvas;
    this.guides.attach(canvas);
    this.snapping.attach(canvas);
    this.bindEvents();

    return canvas;
  }

  public getCanvas(): Canvas | null {
    return this.canvas;
  }

  public getDimensions(): CanvasDimensions {
    return this.dimensions;
  }

  public setDimensions(dims: CanvasDimensions): void {
    this.dimensions = dims;
    this.guides.updateDimensions(dims);
    this.snapping.updateDimensions(dims);

    if (this.canvas) {
      const targetWidth = Math.round(dims.widthPx * this.zoom);
      const targetHeight = Math.round(dims.heightPx * this.zoom);

      this.canvas.setDimensions({
        width: targetWidth,
        height: targetHeight,
      });

      this.canvas.setZoom(this.zoom);
      this.canvas.requestRenderAll();
      this.notifyChange();
    }
  }

  // --- Background Management ---

  public getBackgroundSettings(): BackgroundSettings {
    return { ...this.backgroundSettings };
  }

  public onBackgroundChange(callback: BackgroundEventCallback): () => void {
    this.backgroundListeners.add(callback);
    return () => this.backgroundListeners.delete(callback);
  }

  private notifyBackground(): void {
    this.backgroundListeners.forEach((cb) => cb({ ...this.backgroundSettings }));
  }

  public setBackgroundColor(color: string): void {
    if (!this.canvas) return;
    this.canvas.backgroundImage = undefined;
    this.canvas.backgroundColor = color;
    this.backgroundSettings = {
      type: 'color',
      color,
    };
    this.canvas.requestRenderAll();
    this.notifyBackground();
    this.notifyChange();
  }

  public setBackgroundGradient(gradientConfig: {
    type: 'linear' | 'radial';
    angle: number;
    stops: Array<{ offset: number; color: string }>;
  }): void {
    if (!this.canvas) return;
    this.canvas.backgroundImage = undefined;

    const baseW = this.dimensions.widthPx || 1063;
    const baseH = this.dimensions.heightPx || 591;

    let coords: any;
    if (gradientConfig.type === 'radial') {
      const cx = baseW / 2;
      const cy = baseH / 2;
      const r = Math.max(baseW, baseH) / 2;
      coords = { r1: 0, r2: r, x1: cx, y1: cy, x2: cx, y2: cy };
    } else {
      // Linear gradient with angle in degrees
      const angleRad = ((gradientConfig.angle - 90) * Math.PI) / 180;
      const cx = baseW / 2;
      const cy = baseH / 2;
      const length = Math.sqrt(baseW * baseW + baseH * baseH) / 2;
      coords = {
        x1: cx - Math.cos(angleRad) * length,
        y1: cy - Math.sin(angleRad) * length,
        x2: cx + Math.cos(angleRad) * length,
        y2: cy + Math.sin(angleRad) * length,
      };
    }

    const fabricGradient = new Gradient({
      type: gradientConfig.type,
      gradientUnits: 'pixels',
      coords,
      colorStops: gradientConfig.stops.map((s) => ({
        offset: s.offset,
        color: s.color,
      })),
    });

    this.canvas.backgroundColor = fabricGradient as any;
    this.backgroundSettings = {
      type: 'gradient',
      gradient: gradientConfig,
    };
    this.canvas.requestRenderAll();
    this.notifyBackground();
    this.notifyChange();
  }

  public async setBackgroundImage(
    url: string,
    options?: Partial<NonNullable<BackgroundSettings['image']>>
  ): Promise<void> {
    if (!this.canvas) return;

    const fit = options?.fit || 'cover';
    const scaleFactor = options?.scale !== undefined ? options?.scale : 1.0;
    const offsetX = options?.offsetX || 0;
    const offsetY = options?.offsetY || 0;
    const opacity = options?.opacity !== undefined ? options?.opacity : 1.0;
    const blur = options?.blur || 0;
    const name = options?.name || 'Background Image';

    try {
      const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
      if (!this.canvas) return;

      const baseW = this.dimensions.widthPx || 1063;
      const baseH = this.dimensions.heightPx || 591;

      const imgW = img.width || baseW;
      const imgH = img.height || baseH;

      let finalScaleX = scaleFactor;
      let finalScaleY = scaleFactor;

      if (fit === 'cover') {
        const baseScale = Math.max(baseW / imgW, baseH / imgH);
        finalScaleX = baseScale * scaleFactor;
        finalScaleY = baseScale * scaleFactor;
      } else if (fit === 'contain') {
        const baseScale = Math.min(baseW / imgW, baseH / imgH);
        finalScaleX = baseScale * scaleFactor;
        finalScaleY = baseScale * scaleFactor;
      } else if (fit === 'stretch') {
        finalScaleX = (baseW / imgW) * scaleFactor;
        finalScaleY = (baseH / imgH) * scaleFactor;
      }

      img.set({
        originX: 'center',
        originY: 'center',
        left: baseW / 2 + offsetX,
        top: baseH / 2 + offsetY,
        scaleX: finalScaleX,
        scaleY: finalScaleY,
        opacity,
        selectable: false,
        evented: false,
      });

      this.canvas.backgroundColor = '#000000';
      this.canvas.backgroundImage = img;

      this.backgroundSettings = {
        type: 'image',
        image: {
          url,
          fit,
          scale: scaleFactor,
          offsetX,
          offsetY,
          opacity,
          blur,
          name,
        },
      };

      this.canvas.requestRenderAll();
      this.notifyBackground();
      this.notifyChange();
    } catch (err) {
      console.error('Failed to load background image:', err);
    }
  }

  public async updateBackground(settings: Partial<BackgroundSettings>): Promise<void> {
    if (settings.type === 'color' && settings.color) {
      this.setBackgroundColor(settings.color);
    } else if (settings.type === 'gradient' && settings.gradient) {
      this.setBackgroundGradient(settings.gradient);
    } else if (settings.type === 'image' || (this.backgroundSettings.type === 'image' && settings.image)) {
      const mergedImage = {
        ...this.backgroundSettings.image,
        ...settings.image,
      };
      if (mergedImage.url) {
        await this.setBackgroundImage(mergedImage.url, mergedImage);
      }
    }
  }

  public resetBackground(): void {
    if (!this.canvas) return;
    this.canvas.backgroundImage = undefined;
    this.canvas.backgroundColor = '#ffffff';
    this.backgroundSettings = {
      type: 'color',
      color: '#ffffff',
    };
    this.canvas.requestRenderAll();
    this.notifyBackground();
    this.notifyChange();
  }

  public convertBackgroundToLayer(): void {
    if (!this.canvas || !this.canvas.backgroundImage) return;
    const bgImg = this.canvas.backgroundImage as FabricImage;
    if (!bgImg) return;

    const baseW = this.dimensions.widthPx || 1063;
    const baseH = this.dimensions.heightPx || 591;

    // Clone as selectable regular object
    const el = bgImg.getElement() as HTMLImageElement;
    if (!el) return;

    const newImg = new FabricImage(el, {
      left: bgImg.left !== undefined ? bgImg.left : baseW / 2,
      top: bgImg.top !== undefined ? bgImg.top : baseH / 2,
      originX: 'center',
      originY: 'center',
      scaleX: bgImg.scaleX || 1,
      scaleY: bgImg.scaleY || 1,
      opacity: bgImg.opacity !== undefined ? bgImg.opacity : 1,
      selectable: true,
      evented: true,
    });
    newImg.set('name' as any, this.backgroundSettings.image?.name || 'Background Layer');

    this.canvas.backgroundImage = undefined;
    this.canvas.backgroundColor = '#ffffff';
    this.canvas.insertAt(0, newImg);
    this.canvas.setActiveObject(newImg);

    this.backgroundSettings = {
      type: 'color',
      color: '#ffffff',
    };

    this.canvas.requestRenderAll();
    this.notifyBackground();
    this.notifyLayers();
    this.notifyChange();
  }

  // --- Print Guides Management ---

  public toggleGuides(): boolean {
    const isVisible = this.guides.toggleVisible();
    this.notifyGuides(isVisible);
    return isVisible;
  }

  public setGuidesVisible(visible: boolean): void {
    this.guides.setVisible(visible);
    this.notifyGuides(visible);
  }

  public getGuidesVisible(): boolean {
    return this.guides.getVisible();
  }

  public updateGuidesSettings(settings: Partial<PrintGuidesSettings>): void {
    this.guides.updateSettings(settings);
  }

  // --- Zoom & Viewport Sizing (10% to 800%) ---

  public getZoom(): number {
    return this.zoom;
  }

  public setZoom(newZoom: number): void {
    if (!this.canvas) return;
    const clampedZoom = Math.min(Math.max(Number(newZoom.toFixed(2)), 0.1), 8.0);
    this.zoom = clampedZoom;

    const baseWidth = this.dimensions.widthPx || 1063;
    const baseHeight = this.dimensions.heightPx || 591;

    const targetWidth = Math.round(baseWidth * this.zoom);
    const targetHeight = Math.round(baseHeight * this.zoom);

    this.canvas.setDimensions({
      width: targetWidth,
      height: targetHeight,
    });

    this.canvas.setZoom(this.zoom);
    this.canvas.requestRenderAll();
    this.notifyZoom();
  }

  public zoomIn(): void {
    const nextPreset = ZOOM_PRESETS.find((z) => z > this.zoom + 0.05);
    const targetZoom = nextPreset !== undefined ? nextPreset : Math.min(this.zoom + 0.25, 8.0);
    this.setZoom(targetZoom);
  }

  public zoomOut(): void {
    const prevPreset = [...ZOOM_PRESETS].reverse().find((z) => z < this.zoom - 0.05);
    const targetZoom = prevPreset !== undefined ? prevPreset : Math.max(this.zoom - 0.25, 0.1);
    this.setZoom(targetZoom);
  }

  public resetZoom(): void {
    this.setZoom(1.0);
  }

  public fitToViewport(containerWidth: number, containerHeight: number, padding = 32, rulerOffset = 48): void {
    if (!this.canvas || !containerWidth || !containerHeight) return;

    const availableW = Math.max(containerWidth - padding * 2 - rulerOffset, 80);
    const availableH = Math.max(containerHeight - padding * 2 - rulerOffset, 80);

    const baseWidth = this.dimensions.widthPx || 1063;
    const baseHeight = this.dimensions.heightPx || 591;

    const scaleX = availableW / baseWidth;
    const scaleY = availableH / baseHeight;
    const fitZoom = Math.min(scaleX, scaleY);

    this.setZoom(Number(Math.max(fitZoom, 0.05).toFixed(3)));
  }

  public setPanMode(enabled: boolean): void {
    this.isPanMode = enabled;
    if (!this.canvas) return;

    if (enabled) {
      this.canvas.defaultCursor = 'grab';
      this.canvas.selection = false;
      this.canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
    } else {
      this.canvas.defaultCursor = 'default';
      this.canvas.selection = true;
      this.canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
      });
    }
    this.canvas.requestRenderAll();
  }

  public getIsPanMode(): boolean {
    return this.isPanMode;
  }

  // --- Drawing / Brush Engine (Illustrator-Grade) ---

  public isDrawingMode(): boolean {
    return this.isDrawing;
  }

  public setDrawingMode(enabled: boolean): void {
    this.isDrawing = enabled;
    if (!this.canvas) return;

    this.canvas.isDrawingMode = enabled;

    if (enabled) {
      this.canvas.discardActiveObject();
      this.applyBrushSettings();
    }

    this.canvas.requestRenderAll();
    this.drawingModeListeners.forEach((cb) => cb(enabled));
  }

  public getBrushSettings(): BrushSettings {
    return { ...this.brushSettings };
  }

  public setBrushSettings(settings: Partial<BrushSettings>): void {
    const previousTool = this.brushSettings.tool;

    this.brushSettings = {
      ...this.brushSettings,
      ...settings,
    };

    // Tool changed
    if (settings.tool && settings.tool !== previousTool) {

      // Selecting another tool automatically exits eraser
      if (previousTool === 'eraser' && settings.tool !== 'eraser') {
        this.isDrawing = false;

        if (this.canvas) {
          this.canvas.isDrawingMode = false;
          this.canvas.freeDrawingBrush = undefined;
        }

        this.drawingModeListeners.forEach((cb) => cb(false));
      }

      // Enable drawing for drawing tools
      if (this.canvas && settings.tool !== 'eraser') {
        this.isDrawing = true;
        this.canvas.isDrawingMode = true;
        this.applyBrushSettings();

        this.drawingModeListeners.forEach((cb) => cb(true));
      }
    }

    // Update brush properties
    if (this.canvas && this.isDrawing) {
      this.applyBrushSettings();
    }

    this.brushSettingsListeners.forEach((cb) =>
      cb({ ...this.brushSettings })
    );
  }

  private applyBrushSettings(): void {
    if (!this.canvas) return;

    const {
      tool,
      size,
      color,
      opacity,
      strokeLineCap,
      strokeLineJoin,
      sprayDensity,
      sprayDotWidth,
    } = this.brushSettings;

    const rgbaColor = hexWithAlpha(color, opacity);

    // =========================
    // ERASER
    // =========================
    if (tool === 'eraser') {
      // Fabric 7.4.0 does not have EraserBrush.
      // Use drawing mode but handle erasing separately.
      this.canvas.isDrawingMode = true;

      const pencil = new PencilBrush(this.canvas);

      pencil.width = Math.max(size * 2, 10);

      // Temporary visual eraser color.
      // Actual erasing should be handled by your eraser logic.
      pencil.color = '#ffffff';

      pencil.strokeLineCap = 'round';
      pencil.strokeLineJoin = 'round';

      this.canvas.freeDrawingBrush = pencil;
      return;
    }

    // =========================
    // SPRAY
    // =========================
    if (tool === 'spray') {
      const spray = new SprayBrush(this.canvas);

      spray.width = Math.max(size * 2.5, 6);
      spray.color = rgbaColor;
      spray.density = sprayDensity || 25;
      spray.dotWidth = sprayDotWidth || 2;

      this.canvas.freeDrawingBrush = spray;
      return;
    }

    // =========================
    // NORMAL BRUSHES
    // =========================
    const pencil = new PencilBrush(this.canvas);

    if (tool === 'pencil') {
      pencil.width = Math.max(size * 0.5, 1);
      pencil.color = rgbaColor;
      pencil.strokeLineCap = 'round';
      pencil.strokeLineJoin = 'round';

    } else if (tool === 'marker') {
      pencil.width = Math.max(size * 2.5, 16);
      pencil.color = hexWithAlpha(
        color,
        Math.min(opacity, 0.4)
      );
      pencil.strokeLineCap = 'square';
      pencil.strokeLineJoin = 'miter';

    } else if (tool === 'calligraphy') {
      pencil.width = Math.max(size * 1.8, 8);
      pencil.color = rgbaColor;
      pencil.strokeLineCap = 'square';
      pencil.strokeLineJoin = 'bevel';

      pencil.shadow = new Shadow({
        blur: 1,
        offsetX: 1,
        offsetY: 1,
        color: hexWithAlpha(color, 0.25),
      });

    } else {
      // brush / freehand
      pencil.width = size;
      pencil.color = rgbaColor;
      pencil.strokeLineCap = strokeLineCap || 'round';
      pencil.strokeLineJoin = strokeLineJoin || 'round';
    }

    this.canvas.freeDrawingBrush = pencil;
  }

  public onDrawingModeChange(cb: DrawingModeEventCallback): () => void {
    this.drawingModeListeners.add(cb);
    return () => this.drawingModeListeners.delete(cb);
  }

  public onBrushSettingsChange(cb: BrushSettingsEventCallback): () => void {
    this.brushSettingsListeners.add(cb);
    return () => this.brushSettingsListeners.delete(cb);
  }

  // --- Helper: Ensure Object has Unique ID & Name ---

  private ensureObjectId(obj: FabricObject, defaultName?: string): void {
    if (!obj.get('id' as any)) {
      obj.set(
        'id' as any,
        `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      );
    }
    if (!obj.get('name' as any)) {
      const type = obj.type || 'Object';
      const formatted = type === 'textbox' || type === 'i-text' ? 'Text Layer' : type === 'image' ? 'Image Layer' : `${type.charAt(0).toUpperCase() + type.slice(1)}`;
      obj.set('name' as any, defaultName || formatted);
    }
  }

  // --- Selection Management ---

  public getActiveObject(): FabricObject | null {
    return this.canvas?.getActiveObject() ?? null;
  }

  public getActiveObjects(): FabricObject[] {
    return this.canvas?.getActiveObjects() ?? [];
  }

  public selectAll(): void {
    if (!this.canvas) return;
    this.canvas.discardActiveObject();
    const allObjects = this.canvas.getObjects().filter((obj) => obj.visible && !obj.get('isGuide' as any));
    if (allObjects.length === 0) return;

    const sel = new ActiveSelection(allObjects, {
      canvas: this.canvas,
    });
    this.canvas.setActiveObject(sel);
    this.canvas.requestRenderAll();
    this.notifySelection();
  }

  public deselectAll(): void {
    if (!this.canvas) return;
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.notifySelection();
  }

  public deleteSelected(): void {
    if (!this.canvas) return;
    const activeObjects = this.canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    this.canvas.discardActiveObject();
    activeObjects.forEach((obj) => {
      this.canvas?.remove(obj);
    });
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
  }

  public disableDrawingMode(): void {
    this.isDrawing = false;

    if (!this.canvas) return;

    this.canvas.isDrawingMode = false;
    this.canvas.freeDrawingBrush = undefined;

    this.drawingModeListeners.forEach((cb) => cb(false));

    this.canvas.requestRenderAll();
  }

  public duplicateSelected(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    active.clone().then((cloned: FabricObject) => {
      if (!this.canvas) return;
      this.canvas.discardActiveObject();
      this.ensureObjectId(cloned, `${active.get('name' as any) || 'Object'} (Copy)`);

      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
        evented: true,
      });

      if (cloned instanceof ActiveSelection) {
        cloned.canvas = this.canvas;
        cloned.forEachObject((obj) => {
          this.canvas?.add(obj);
        });
        cloned.setCoords();
      } else {
        this.canvas.add(cloned);
      }

      this.canvas.setActiveObject(cloned);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
    });
  }

  // --- Templates Engine ---

  // --- Ruler Guides Management ---

  public addUserGuide(orientation: 'horizontal' | 'vertical', posPx: number) {
    return this.guides.addUserGuide(orientation, posPx);
  }

  public removeUserGuide(id: string): void {
    this.guides.removeUserGuide(id);
  }

  public clearUserGuides(): void {
    this.guides.clearUserGuides();
  }

  public getUserGuides() {
    return this.guides.getUserGuides();
  }

  // --- Templates Engine ---

  public async loadTemplate(template: DesignerTemplate): Promise<void> {
    if (!this.canvas) return;

    this.canvas.discardActiveObject();
    const existing = [...this.canvas.getObjects()];
    existing.forEach((obj) => {
      if (!obj.get('isGuide' as any)) {
        this.canvas?.remove(obj);
      }
    });

    const canvasW = this.dimensions.widthPx || 1063;
    const canvasH = this.dimensions.heightPx || 591;

    if (template.backgroundColor) {
      this.setBackgroundColor(template.backgroundColor);
    }

    for (const objDef of template.objects) {
      // All coordinates in templatesData are normalized 0.0–1.0 fractions
      // Multiply by canvasW / canvasH to get pixel positions for any canvas size
      const normLeft = (objDef.left as number) ?? 0;
      const normTop = (objDef.top as number) ?? 0;
      const normWidth = (objDef.width as number) || 0.6;
      const normHeight = (objDef.height as number) || 0.1;

      // Detect normalized coords: values <= 1.0 are treated as fractions (0.0–1.0)
      // Values > 1.0 are legacy pixel coords → divide by ref dimensions
      const isNormalized = normWidth <= 1.0 && normLeft <= 1.0 && normTop <= 1.0;
      const REF_W = 1063;
      const REF_H = 591;

      const pxLeft = Math.round(isNormalized ? normLeft * canvasW : (normLeft / REF_W) * canvasW);
      const pxTop = Math.round(isNormalized ? normTop * canvasH : (normTop / REF_H) * canvasH);
      const pxWidth = Math.round(isNormalized ? normWidth * canvasW : (normWidth / REF_W) * canvasW);
      const pxHeight = Math.round(isNormalized ? normHeight * canvasH : (normHeight / REF_H) * canvasH);

      if (objDef.type === 'textbox') {
        const fontName = (objDef.fontFamily as string) || 'Inter, sans-serif';
        const fontItem = POPULAR_FONTS.find((f) => f.family === fontName || f.name === fontName);
        if (fontItem) {
          await loadFont(fontItem);
        }

        const rawFontSize = (objDef.fontSize as number) || 0.04;
        const fontSize = rawFontSize <= 1.0
          ? Math.max(8, Math.round(rawFontSize * canvasH))
          : Math.max(8, Math.round((rawFontSize / REF_H) * canvasH));

        const textAlign = (objDef.textAlign as 'left' | 'center' | 'right' | 'justify') || 'left';

        const tb = new Textbox((objDef.text as string) || 'Text', {
          left: pxLeft,
          top: pxTop,
          width: Math.max(pxWidth, 40),
          fontSize,
          fontFamily: fontName,
          fontWeight: (objDef.fontWeight as string | number) || 'normal',
          fontStyle: ((objDef.fontStyle as string) || 'normal') as 'normal' | 'italic' | 'oblique',
          fill: (objDef.fill as string) || '#0f172a',
          textAlign,
          charSpacing: (objDef.charSpacing as number) || 0,
          lineHeight: (objDef.lineHeight as number) || 1.2,
          originX: 'left',
          originY: 'top',
          cornerColor: '#2563eb',
          cornerStyle: 'circle',
          cornerSize: 10,
          transparentCorners: false,
          padding: 6,
          selectable: true,
          evented: true,
        });

        this.ensureObjectId(tb, (objDef.name as string) || 'Template Text');
        this.canvas.add(tb);
      } else if (objDef.type === 'rect') {
        const rawStroke = (objDef.strokeWidth as number) || 0;
        const strokeWidth = rawStroke < 0.1 && rawStroke > 0 ? Math.max(1, Math.round(rawStroke * canvasH)) : rawStroke;
        const rawRx = (objDef.rx as number) || 0;
        const rx = rawRx < 0.1 && rawRx > 0 ? Math.round(rawRx * Math.min(canvasW, canvasH)) : rawRx;

        const rect = new Rect({
          left: pxLeft,
          top: pxTop,
          width: Math.max(pxWidth, 1),
          height: Math.max(pxHeight, 1),
          fill: (objDef.fill as string) || '#2563eb',
          stroke: (objDef.stroke as string) || undefined,
          strokeWidth,
          rx,
          ry: rx,
          originX: 'left',
          originY: 'top',
          cornerColor: '#2563eb',
          cornerStyle: 'circle',
          cornerSize: 10,
          transparentCorners: false,
          selectable: true,
          evented: true,
        });
        this.ensureObjectId(rect, (objDef.name as string) || 'Template Shape');
        this.canvas.add(rect);
      } else if (objDef.type === 'circle') {
        const rawRadius = (objDef.radius as number) || 0.1;
        const radius = rawRadius <= 1.0
          ? Math.round(rawRadius * Math.min(canvasW, canvasH))
          : Math.round((rawRadius / Math.min(REF_W, REF_H)) * Math.min(canvasW, canvasH));

        const circle = new Circle({
          left: pxLeft,
          top: pxTop,
          radius: Math.max(radius, 2),
          fill: (objDef.fill as string) || '#2563eb',
          originX: 'left',
          originY: 'top',
          cornerColor: '#2563eb',
          cornerStyle: 'circle',
          cornerSize: 10,
          transparentCorners: false,
          selectable: true,
          evented: true,
        });
        this.ensureObjectId(circle, (objDef.name as string) || 'Circle');
        this.canvas.add(circle);
      }
    }

    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
    this.notifyPreflight();
  }

  // --- Photo Frames Engine (with ClipPaths) ---

  public addFrame(shapeType: FrameShapeType, customImageUrl?: string): void {
    if (!this.canvas) return;

    const canvasW = this.dimensions.widthPx || 1063;
    const canvasH = this.dimensions.heightPx || 591;
    const frameSize = Math.min(canvasW * 0.35, 320);
    const left = (canvasW - frameSize) / 2;
    const top = (canvasH - frameSize) / 2;

    const defaultImg =
      customImageUrl ||
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80';

    FabricImage.fromURL(defaultImg, { crossOrigin: 'anonymous' }).then((img) => {
      if (!this.canvas) return;

      const scale = frameSize / Math.max(img.width || 400, img.height || 400);
      img.scale(scale);

      let clipPath: FabricObject;

      if (shapeType === 'circle') {
        clipPath = new Circle({
          radius: (img.width || 400) / 2,
          originX: 'center',
          originY: 'center',
        });
      } else if (shapeType === 'heart') {
        // Heart path normalized to center
        clipPath = new Polygon(
          [
            new Point(0, -100),
            new Point(60, -150),
            new Point(120, -90),
            new Point(120, 0),
            new Point(0, 140),
            new Point(-120, 0),
            new Point(-120, -90),
            new Point(-60, -150),
          ],
          {
            originX: 'center',
            originY: 'center',
            scaleX: (img.width || 400) / 260,
            scaleY: (img.height || 400) / 260,
          }
        );
      } else if (shapeType === 'star') {
        clipPath = new Polygon(
          [
            new Point(0, -120),
            new Point(35, -35),
            new Point(125, -35),
            new Point(50, 20),
            new Point(80, 110),
            new Point(0, 55),
            new Point(-80, 110),
            new Point(-50, 20),
            new Point(-125, -35),
            new Point(-35, -35),
          ],
          {
            originX: 'center',
            originY: 'center',
            scaleX: (img.width || 400) / 260,
            scaleY: (img.height || 400) / 260,
          }
        );
      } else if (shapeType === 'hexagon') {
        clipPath = new Polygon(
          [
            new Point(0, -120),
            new Point(100, -60),
            new Point(100, 60),
            new Point(0, 120),
            new Point(-100, 60),
            new Point(-100, -60),
          ],
          {
            originX: 'center',
            originY: 'center',
            scaleX: (img.width || 400) / 220,
            scaleY: (img.height || 400) / 220,
          }
        );
      } else {
        // rounded rectangle
        clipPath = new Rect({
          width: img.width || 400,
          height: img.height || 400,
          rx: 40,
          ry: 40,
          originX: 'center',
          originY: 'center',
        });
      }

      img.set({
        left,
        top,
        clipPath,
        cornerColor: '#2563eb',
        cornerStyle: 'circle',
        cornerSize: 10,
        transparentCorners: false,
      });

      img.set('isFrame' as any, true);
      img.set('frameShape' as any, shapeType);
      this.ensureObjectId(img, `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} Frame`);

      this.canvas.add(img);
      this.canvas.setActiveObject(img);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
    });
  }

  // --- Image Handling & Non-Destructive Crop ---

  public async addImageFromUrl(
    url: string,
    metadata?: ImageMetadata,
    options?: Partial<FabricObject>
  ): Promise<FabricImage | null> {
    if (!this.canvas) return null;

    try {
      const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
      const canvasW = this.dimensions.widthPx || 1063;
      const canvasH = this.dimensions.heightPx || 591;

      const maxW = Math.min(canvasW * 0.5, 450);
      const maxH = Math.min(canvasH * 0.5, 350);

      const naturalW = metadata?.naturalWidth || img.width || 400;
      const naturalH = metadata?.naturalHeight || img.height || 300;

      const scale = Math.min(maxW / naturalW, maxH / naturalH, 1.0);

      img.set({
        left: options?.left ?? (canvasW - naturalW * scale) / 2,
        top: options?.top ?? (canvasH - naturalH * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        cornerColor: '#2563eb',
        cornerStyle: 'circle',
        cornerSize: 10,
        transparentCorners: false,
      });

      img.set('originalSrc' as any, metadata?.originalSrc || url);
      img.set('naturalWidth' as any, naturalW);
      img.set('naturalHeight' as any, naturalH);
      img.set('fileSizeBytes' as any, metadata?.fileSizeBytes || 0);
      this.ensureObjectId(img, metadata?.name || 'Image Layer');

      this.canvas.add(img);
      this.canvas.setActiveObject(img);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();

      return img;
    } catch (err) {
      console.error('Failed to load image into canvas:', err);
      return null;
    }
  }

  public async replaceActiveImage(newUrl: string, metadata?: ImageMetadata): Promise<void> {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof FabricImage)) return;

    try {
      const newImg = await FabricImage.fromURL(newUrl, { crossOrigin: 'anonymous' });

      const prevLeft = active.left || 0;
      const prevTop = active.top || 0;
      const prevAngle = active.angle || 0;
      const prevScaleX = active.scaleX || 1;
      const prevScaleY = active.scaleY || 1;
      const prevClip = active.clipPath;
      const prevId = active.get('id' as any);
      const prevName = active.get('name' as any);
      const prevIndex = this.canvas.getObjects().indexOf(active);

      this.canvas.remove(active);

      newImg.set({
        left: prevLeft,
        top: prevTop,
        angle: prevAngle,
        scaleX: prevScaleX,
        scaleY: prevScaleY,
        clipPath: prevClip,
        cornerColor: '#2563eb',
        cornerStyle: 'circle',
        cornerSize: 10,
        transparentCorners: false,
      });

      newImg.set('id' as any, prevId);
      newImg.set('name' as any, prevName);
      newImg.set('originalSrc' as any, newUrl);
      newImg.set('naturalWidth' as any, metadata?.naturalWidth || newImg.width);
      newImg.set('naturalHeight' as any, metadata?.naturalHeight || newImg.height);
      newImg.set('fileSizeBytes' as any, metadata?.fileSizeBytes || 0);

      this.canvas.insertAt(prevIndex, newImg);
      this.canvas.setActiveObject(newImg);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
    } catch (err) {
      console.error('Failed to replace image:', err);
    }
  }

  public applyCropToActiveImage(cropData: {
    cropX: number;
    cropY: number;
    cropWidth: number;
    cropHeight: number;
  }): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof FabricImage)) return;

    active.set({
      cropX: cropData.cropX,
      cropY: cropData.cropY,
      width: cropData.cropWidth,
      height: cropData.cropHeight,
    });

    active.set('cropX' as any, cropData.cropX);
    active.set('cropY' as any, cropData.cropY);
    active.set('cropWidth' as any, cropData.cropWidth);
    active.set('cropHeight' as any, cropData.cropHeight);

    active.setCoords();
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
  }

  public resetCropOnActiveImage(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof FabricImage)) return;

    const naturalW = (active.get('naturalWidth' as any) as number) || (active.getOriginalSize().width as number) || 400;
    const naturalH = (active.get('naturalHeight' as any) as number) || (active.getOriginalSize().height as number) || 300;

    active.set({
      cropX: 0,
      cropY: 0,
      width: naturalW,
      height: naturalH,
    });

    active.set('cropX' as any, 0);
    active.set('cropY' as any, 0);
    active.set('cropWidth' as any, naturalW);
    active.set('cropHeight' as any, naturalH);

    active.setCoords();
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
  }

  // --- Bi-Directional Synchronized Layers Engine ---

  public getLayersList(): LayerItem[] {
    if (!this.canvas) return [];
    const objects = this.canvas.getObjects().filter((obj) => !obj.get('isGuide' as any));

    // Return reversed so top visual object is index 0 in the UI
    return objects
      .map((obj, index) => {
        this.ensureObjectId(obj);
        const isPath = obj instanceof Path || Boolean(obj.get('isBrushPath' as any));
        const type = isPath ? 'brush' : obj.type || 'object';
        const isText = obj instanceof Textbox || obj instanceof IText;
        const textPreview = isText ? (obj as Textbox).text?.substring(0, 24) : undefined;

        return {
          id: obj.get('id' as any) as string,
          name:
            (obj.get('name' as any) as string) ||
            `${type.charAt(0).toUpperCase() + type.slice(1)}`,
          type,
          isLocked: Boolean(obj.lockMovementX),
          isVisible: obj.visible !== false,
          zIndex: index,
          textPreview,
        };
      })
      .reverse();
  }

  public selectObjectById(id: string): void {
    if (!this.canvas) return;
    const obj = this.canvas.getObjects().find((o) => o.get('id' as any) === id);
    if (obj && obj.visible && !obj.get('isGuide' as any)) {
      this.canvas.setActiveObject(obj);
      this.canvas.requestRenderAll();
      this.notifySelection();
      this.notifyLayers();
    }
  }

  public setObjectVisibility(id: string, isVisible: boolean): void {
    if (!this.canvas) return;
    const obj = this.canvas.getObjects().find((o) => o.get('id' as any) === id);
    if (obj) {
      obj.set('visible', isVisible);
      if (!isVisible && this.canvas.getActiveObject() === obj) {
        this.canvas.discardActiveObject();
      }
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
    }
  }

  public setObjectLocked(id: string, isLocked: boolean): void {
    if (!this.canvas) return;
    const obj = this.canvas.getObjects().find((o) => o.get('id' as any) === id);
    if (obj) {
      obj.set({
        lockMovementX: isLocked,
        lockMovementY: isLocked,
        lockRotation: isLocked,
        lockScalingX: isLocked,
        lockScalingY: isLocked,
        hasControls: !isLocked,
      });
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
    }
  }

  public renameObject(id: string, newName: string): void {
    if (!this.canvas) return;
    const obj = this.canvas.getObjects().find((o) => o.get('id' as any) === id);
    if (obj) {
      obj.set('name' as any, newName.trim() || 'Layer');
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
    }
  }

  public deleteObjectById(id: string): void {
    if (!this.canvas) return;
    const obj = this.canvas.getObjects().find((o) => o.get('id' as any) === id);
    if (obj) {
      if (this.canvas.getActiveObject() === obj) {
        this.canvas.discardActiveObject();
      }
      this.canvas.remove(obj);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
    }
  }

  public duplicateObjectById(id: string): void {
    if (!this.canvas) return;
    const obj = this.canvas.getObjects().find((o) => o.get('id' as any) === id);
    if (obj) {
      obj.clone().then((cloned: FabricObject) => {
        if (!this.canvas) return;
        this.ensureObjectId(cloned, `${obj.get('name' as any) || 'Object'} (Copy)`);
        cloned.set({
          left: (cloned.left || 0) + 20,
          top: (cloned.top || 0) + 20,
          evented: true,
        });
        this.canvas.add(cloned);
        this.canvas.setActiveObject(cloned);
        this.canvas.requestRenderAll();
        this.notifyChange();
        this.notifySelection();
        this.notifyLayers();
      });
    }
  }

  public reorderLayer(id: string, direction: 'up' | 'down' | 'top' | 'bottom'): void {
    if (!this.canvas) return;
    const obj = this.canvas.getObjects().find((o) => o.get('id' as any) === id);
    if (!obj) return;

    if (direction === 'up') {
      this.canvas.bringObjectForward(obj);
    } else if (direction === 'down') {
      this.canvas.sendObjectBackwards(obj);
    } else if (direction === 'top') {
      this.canvas.bringObjectToFront(obj);
    } else if (direction === 'bottom') {
      this.canvas.sendObjectToBack(obj);
    }

    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifyLayers();
  }

  // --- Object & Typography Modification ---

  public updateSelectedProperty<K extends keyof SelectedObjectState>(
    prop: K,
    value: SelectedObjectState[K]
  ): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    const isText = active instanceof Textbox || active instanceof IText;

    if (prop === 'left') active.set('left', value as number);
    else if (prop === 'top') active.set('top', value as number);
    else if (prop === 'width') {
      const w = Math.max(Number(value), 1);
      if (active instanceof Textbox) {
        active.set('width', w);
      } else if (active.type === 'rect' || active.type === 'image') {
        active.set('width', w);
      } else {
        active.scaleToWidth(w);
      }
    } else if (prop === 'height') {
      const h = Math.max(Number(value), 1);
      if (active.type === 'rect' || active.type === 'image') {
        active.set('height', h);
      } else {
        active.scaleToHeight(h);
      }
    } else if (prop === 'angle') active.set('angle', value as number);
    else if (prop === 'opacity') active.set('opacity', value as number);
    else if (prop === 'fill') active.set('fill', value as string);
    else if (prop === 'stroke') active.set('stroke', value as string);
    else if (prop === 'strokeWidth') active.set('strokeWidth', value as number);
    else if (prop === 'strokeLineCap') active.set('strokeLineCap', value as 'round' | 'square' | 'butt');
    else if (prop === 'strokeLineJoin') active.set('strokeLineJoin', value as 'round' | 'bevel' | 'miter');
    else if (prop === 'flipX') active.set('flipX', value as boolean);
    else if (prop === 'flipY') active.set('flipY', value as boolean);
    else if (prop === 'isLocked') {
      const locked = value as boolean;
      active.set({
        lockMovementX: locked,
        lockMovementY: locked,
        lockRotation: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        hasControls: !locked,
      });
    }
    // Typography properties
    else if (isText && prop === 'text') {
      (active as Textbox | IText).set('text', String(value));
    } else if (isText && prop === 'fontSize') {
      (active as Textbox | IText).set('fontSize', Number(value));
    } else if (isText && prop === 'fontFamily') {
      const fontName = String(value);
      const fontItem = POPULAR_FONTS.find((f) => f.family === fontName || f.name === fontName);
      if (fontItem) {
        loadFont(fontItem).then(() => {
          (active as Textbox | IText).set('fontFamily', fontName);
          active.setCoords();
          this.canvas?.requestRenderAll();
          this.notifyChange();
          this.notifySelection();
          this.notifyLayers();
        });
        return;
      }
      (active as Textbox | IText).set('fontFamily', fontName);
    } else if (isText && prop === 'fontWeight') {
      (active as Textbox | IText).set('fontWeight', value as string | number);
    } else if (isText && prop === 'fontStyle') {
      (active as Textbox | IText).set('fontStyle', value as string);
    } else if (isText && prop === 'underline') {
      (active as Textbox | IText).set('underline', Boolean(value));
    } else if (isText && prop === 'linethrough') {
      (active as Textbox | IText).set('linethrough', Boolean(value));
    } else if (isText && prop === 'textAlign') {
      (active as Textbox | IText).set('textAlign', value as 'left' | 'center' | 'right' | 'justify');
    } else if (isText && prop === 'charSpacing') {
      (active as Textbox | IText).set('charSpacing', Number(value));
    } else if (isText && prop === 'lineHeight') {
      (active as Textbox | IText).set('lineHeight', Number(value));
    }

    active.setCoords();
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
  }

  // --- Layer Order ---

  public bringForward(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;
    this.canvas.bringObjectForward(active);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifyLayers();
  }

  public sendBackward(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;
    this.canvas.sendObjectBackwards(active);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifyLayers();
  }

  public bringToFront(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;
    this.canvas.bringObjectToFront(active);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifyLayers();
  }

  public sendToBack(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;
    this.canvas.sendObjectToBack(active);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifyLayers();
  }

  // --- Alignment ---

  public alignSelected(type: AlignmentType): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    const canvasWidth = this.dimensions.widthPx || 1063;
    const canvasHeight = this.dimensions.heightPx || 591;

    const objWidth = (active.width || 0) * (active.scaleX || 1);
    const objHeight = (active.height || 0) * (active.scaleY || 1);

    switch (type) {
      case 'left':
        active.set('left', 0);
        break;
      case 'center':
      case 'center-h':
        active.set('left', (canvasWidth - objWidth) / 2);
        break;
      case 'right':
        active.set('left', canvasWidth - objWidth);
        break;
      case 'top':
        active.set('top', 0);
        break;
      case 'middle':
      case 'center-v':
        active.set('top', (canvasHeight - objHeight) / 2);
        break;
      case 'bottom':
        active.set('top', canvasHeight - objHeight);
        break;
    }

    active.setCoords();
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
  }

  // --- Rich Textbox Inserter ---

  public addText(options?: AddTextOptions): void {
    if (!this.canvas) return;

    const fontItem = POPULAR_FONTS.find(
      (f) => f.family === options?.fontFamily || f.name === options?.fontFamily
    );
    if (fontItem) {
      loadFont(fontItem);
    }

    const canvasW = this.dimensions.widthPx || 1063;
    const canvasH = this.dimensions.heightPx || 591;
    const textWidth = options?.width || 420;
    const textLeft = options?.left !== undefined ? options.left : Math.max((canvasW - textWidth) / 2, 40);
    const textTop = options?.top !== undefined ? options.top : Math.max((canvasH - 60) / 2, 40);

    const text = new Textbox(options?.text || 'Add text here', {
      left: textLeft,
      top: textTop,
      width: textWidth,
      fontSize: options?.fontSize || 36,
      fontFamily: options?.fontFamily || 'Inter, sans-serif',
      fontWeight: options?.fontWeight || 'normal',
      fontStyle: (options?.fontStyle as '' | 'normal' | 'italic' | 'oblique') || 'normal',
      fill: options?.fill || '#0f172a',
      textAlign: options?.textAlign || 'left',
      cornerColor: '#2563eb',
      cornerStyle: 'circle',
      cornerSize: 10,
      transparentCorners: false,
      padding: 6,
      splitByGrapheme: false,
    });

    this.ensureObjectId(text, options?.name || 'Text Layer');
    this.canvas.add(text);
    this.canvas.setActiveObject(text);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
  }

  // --- Basic Shapes Inserter ---

  public addShape(shapeType: string, color = '#2563eb'): void {
    if (!this.canvas) return;

    const canvasW = this.dimensions.widthPx || 1063;
    const canvasH = this.dimensions.heightPx || 591;

    let shapeObj: FabricObject;

    if (shapeType === 'circle') {
      shapeObj = new Circle({
        left: (canvasW - 180) / 2,
        top: (canvasH - 180) / 2,
        radius: 90,
        fill: color,
        cornerColor: '#2563eb',
        cornerStyle: 'circle',
        cornerSize: 10,
        transparentCorners: false,
      });
      this.ensureObjectId(shapeObj, 'Circle Shape');
    } else if (shapeType === 'triangle') {
      shapeObj = new Triangle({
        left: (canvasW - 180) / 2,
        top: (canvasH - 160) / 2,
        width: 180,
        height: 160,
        fill: color,
        cornerColor: '#2563eb',
        cornerStyle: 'circle',
        cornerSize: 10,
        transparentCorners: false,
      });
      this.ensureObjectId(shapeObj, 'Triangle Shape');
    } else if (shapeType === 'star') {
      shapeObj = new Polygon(
        [
          new Point(0, -90),
          new Point(26, -26),
          new Point(95, -26),
          new Point(38, 15),
          new Point(60, 83),
          new Point(0, 41),
          new Point(-60, 83),
          new Point(-38, 15),
          new Point(-95, -26),
          new Point(-26, -26),
        ],
        {
          left: (canvasW - 190) / 2,
          top: (canvasH - 180) / 2,
          fill: color,
          cornerColor: '#2563eb',
          cornerStyle: 'circle',
          cornerSize: 10,
          transparentCorners: false,
        }
      );
      this.ensureObjectId(shapeObj, 'Star Shape');
    } else {
      // Rectangle / Square
      shapeObj = new Rect({
        left: (canvasW - 240) / 2,
        top: (canvasH - 160) / 2,
        width: 240,
        height: 160,
        fill: color,
        rx: 6,
        ry: 6,
        cornerColor: '#2563eb',
        cornerStyle: 'circle',
        cornerSize: 10,
        transparentCorners: false,
      });
      this.ensureObjectId(shapeObj, 'Rectangle Shape');
    }

    this.canvas.add(shapeObj);
    this.canvas.setActiveObject(shapeObj);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
  }

  // --- Subscriptions ---

  public onSelectionChange(cb: SelectionEventCallback): () => void {
    this.selectionListeners.add(cb);
    return () => this.selectionListeners.delete(cb);
  }

  public onZoomChange(cb: ZoomEventCallback): () => void {
    this.zoomListeners.add(cb);
    return () => this.zoomListeners.delete(cb);
  }

  public onGuidesChange(cb: GuidesEventCallback): () => void {
    this.guidesListeners.add(cb);
    return () => this.guidesListeners.delete(cb);
  }

  public onLayersChange(cb: LayersEventCallback): () => void {
    this.layersListeners.add(cb);
    return () => this.layersListeners.delete(cb);
  }

  public onPreflightChange(cb: PreflightEventCallback): () => void {
    this.preflightListeners.add(cb);
    cb(this.getPreflightReport());
    return () => this.preflightListeners.delete(cb);
  }

  public onChange(cb: CanvasEventCallback): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  public getPreflightReport(): PreflightReport {
    return runPreflightCheck(this.canvas, this.dimensions);
  }

  private notifySelection(): void {
    const state = this.extractSelectedState();
    this.selectionListeners.forEach((cb) => cb(state));
  }

  private notifyZoom(): void {
    this.zoomListeners.forEach((cb) => cb(this.zoom));
  }

  private notifyGuides(visible: boolean): void {
    this.guidesListeners.forEach((cb) => cb(visible));
  }

  private notifyLayers(): void {
    const layers = this.getLayersList();
    this.layersListeners.forEach((cb) => cb(layers));
    this.notifyPreflight();
  }

  private notifyPreflight(): void {
    const report = this.getPreflightReport();
    this.preflightListeners.forEach((cb) => cb(report));
  }

  private notifyChange(): void {
    this.changeListeners.forEach((cb) => cb());
    this.notifyPreflight();
  }

  public extractSelectedState(): SelectedObjectState | null {
    if (!this.canvas) return null;
    const active = this.canvas.getActiveObject();
    if (!active) return null;

    const isMultiple = active instanceof ActiveSelection;
    const count = isMultiple ? (active as ActiveSelection).getObjects().length : 1;

    const isText = active instanceof Textbox || active instanceof IText;
    const textObj = isText ? (active as Textbox | IText) : null;

    const isImage = active instanceof FabricImage || active.type === 'image';
    const imageObj = isImage ? (active as FabricImage) : null;

    const renderedWidth = Math.round((active.width || 0) * (active.scaleX || 1));
    const renderedHeight = Math.round((active.height || 0) * (active.scaleY || 1));

    let qualityInfo;
    let naturalWidth;
    let naturalHeight;
    let fileSizeBytes;
    let originalSrc;
    let cropX;
    let cropY;
    let cropWidth;
    let cropHeight;
    let isFrame = false;
    let frameShape;

    if (imageObj) {
      naturalWidth = (imageObj.get('naturalWidth' as any) as number) || imageObj.width || 400;
      naturalHeight = (imageObj.get('naturalHeight' as any) as number) || imageObj.height || 300;
      fileSizeBytes = (imageObj.get('fileSizeBytes' as any) as number) || 0;
      originalSrc = (imageObj.get('originalSrc' as any) as string) || (imageObj.getSrc ? imageObj.getSrc() : '');
      cropX = (imageObj.get('cropX' as any) as number) || imageObj.cropX || 0;
      cropY = (imageObj.get('cropY' as any) as number) || imageObj.cropY || 0;
      cropWidth = (imageObj.get('cropWidth' as any) as number) || imageObj.width;
      cropHeight = (imageObj.get('cropHeight' as any) as number) || imageObj.height;
      isFrame = Boolean(imageObj.get('isFrame' as any));
      frameShape = (imageObj.get('frameShape' as any) as string) || undefined;

      qualityInfo = calculateImageQuality(
        naturalWidth,
        naturalHeight,
        renderedWidth,
        renderedHeight,
        fileSizeBytes,
        this.dimensions.dpi || 300
      );
    }

    const isPath = active instanceof Path || Boolean(active.get('isBrushPath' as any));
    const brushType = (active.get('brushType' as any) as BrushType) || undefined;
    const isBrushPath = isPath || Boolean(active.get('isBrushPath' as any));

    return {
      id: active.get('id' as any) as string,
      name: active.get('name' as any) as string,
      type: isMultiple
        ? 'activeSelection'
        : isText
          ? 'textbox'
          : isImage
            ? 'image'
            : isPath
              ? 'path'
              : (active.type || 'object').toLowerCase(),
      isMultiple,
      count,
      left: Math.round(active.left || 0),
      top: Math.round(active.top || 0),
      width: renderedWidth,
      height: renderedHeight,
      scaleX: Number((active.scaleX || 1).toFixed(2)),
      scaleY: Number((active.scaleY || 1).toFixed(2)),
      angle: Math.round(active.angle || 0),
      opacity: Number((active.opacity !== undefined ? active.opacity : 1).toFixed(2)),
      fill: typeof active.fill === 'string' ? active.fill : '#2563eb',
      stroke: typeof active.stroke === 'string' ? active.stroke : '#000000',
      strokeWidth: active.strokeWidth || 0,
      strokeLineCap: (active.strokeLineCap as 'round' | 'square' | 'butt') || undefined,
      strokeLineJoin: (active.strokeLineJoin as 'round' | 'bevel' | 'miter') || undefined,
      flipX: Boolean(active.flipX),
      flipY: Boolean(active.flipY),
      isLocked: Boolean(active.lockMovementX),
      isVisible: active.visible !== false,
      isFrame,
      frameShape,
      isBrushPath,
      brushType,
      // Text
      text: textObj ? textObj.text : undefined,
      fontSize: textObj ? textObj.fontSize : undefined,
      fontFamily: textObj ? textObj.fontFamily : undefined,
      textAlign: textObj ? (textObj.textAlign as 'left' | 'center' | 'right' | 'justify') : undefined,
      fontWeight: textObj ? textObj.fontWeight : undefined,
      fontStyle: textObj ? textObj.fontStyle : undefined,
      underline: textObj ? textObj.underline : undefined,
      linethrough: textObj ? textObj.linethrough : undefined,
      charSpacing: textObj ? textObj.charSpacing : undefined,
      lineHeight: textObj ? textObj.lineHeight : undefined,
      // Image
      src: imageObj && imageObj.getSrc ? imageObj.getSrc() : undefined,
      originalSrc,
      naturalWidth,
      naturalHeight,
      fileSizeBytes,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      qualityInfo,
    };
  }

  // --- Internal Event Handlers ---

  private bindEvents(): void {
    if (!this.canvas) return;

    this.canvas.on('after:render', (opt) => {
      if (opt.ctx) {
        this.guides.renderGuides(opt.ctx, this.zoom);
        this.snapping.renderGuides(opt.ctx, this.zoom);
      }
    });

    this.canvas.on('path:created', (opt: any) => {
      const path = opt.path as Path;
      if (path) {
        const toolName =
          this.brushSettings.tool.charAt(0).toUpperCase() + this.brushSettings.tool.slice(1);
        this.ensureObjectId(path, `${toolName} Stroke`);
        path.set({
          cornerColor: '#2563eb',
          cornerStyle: 'circle',
          cornerSize: 10,
          transparentCorners: false,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
        });
        path.set('isBrushPath' as any, true);
        path.set('brushType' as any, this.brushSettings.tool);
        this.canvas?.requestRenderAll();
        this.notifyChange();
        this.notifyLayers();
        this.notifyPreflight();
      }
    });

    this.canvas.on('selection:created', () => {
      this.notifySelection();
      this.notifyLayers();
    });
    this.canvas.on('selection:updated', () => {
      this.notifySelection();
      this.notifyLayers();
    });
    this.canvas.on('selection:cleared', () => {
      this.snapping.clearGuides();
      this.notifySelection();
      this.notifyLayers();
    });

    this.canvas.on('object:added', () => this.notifyLayers());
    this.canvas.on('object:removed', () => this.notifyLayers());

    this.canvas.on('object:modified', () => {
      this.snapping.clearGuides();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
    });

    this.canvas.on('object:moving', (opt) => {
      if (opt.target) {
        this.snapping.handleObjectMove(opt.target);
      }
      this.notifySelection();
      this.notifyPreflight();
    });
    this.canvas.on('object:scaling', (opt) => {
      if (opt.target) {
        this.snapping.handleObjectMove(opt.target);
      }
      this.notifySelection();
      this.notifyPreflight();
    });
    this.canvas.on('object:rotating', () => this.notifySelection());

    this.canvas.on('mouse:up', () => {
      this.snapping.clearGuides();
    });

    // Wheel zoom on Ctrl/Cmd + wheel
    this.canvas.on('mouse:wheel', (opt: TPointerEventInfo<WheelEvent>) => {
      const e = opt.e;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY;
        let targetZoom = this.zoom - delta * 0.002;
        targetZoom = Math.min(Math.max(targetZoom, 0.1), 8.0);
        this.setZoom(targetZoom);
      }
    });
  }

  public setSmartGuidesEnabled(enabled: boolean): void {
    this.snapping.setEnabled(enabled);
  }

  public getSmartGuidesEnabled(): boolean {
    return this.snapping.getEnabled();
  }

  public dispose(): void {
    if (this.canvas) {
      try {
        this.canvas.dispose();
      } catch {
        // ignore
      }
      this.canvas = null;
    }
    this.guides.detach();
    this.snapping.detach();
    this.selectionListeners.clear();
    this.zoomListeners.clear();
    this.changeListeners.clear();
    this.guidesListeners.clear();
    this.layersListeners.clear();
    this.preflightListeners.clear();
    this.drawingModeListeners.clear();
    this.brushSettingsListeners.clear();
  }
}
