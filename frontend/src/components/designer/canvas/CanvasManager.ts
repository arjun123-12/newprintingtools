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
  Group,
  TPointerEventInfo,
  Point,
  PencilBrush,
  SprayBrush,
  CircleBrush,
  Shadow,
  Path,
  Gradient,
  filters,
  loadSVGFromURL,
  loadSVGFromString,
  util,
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
  ArtworkConfig,
  DocumentSettings,
  UnitType,
} from '@/types/designer';
import { calculateCanvasDimensions } from '../utils/dimensions';
import { CanvasGuides } from './CanvasGuides';
import { CanvasSnapping } from './CanvasSnapping';
import { applyCanvaControlsGlobal, applyCanvaControlsToObject } from './CanvaControls';
import { createFrameClipPath } from './frameHelpers';
import { CANVA_FRAME_PLACEHOLDER_SVG, FRAME_PRESETS } from '../data/framesData';
import { POPULAR_FONTS, loadFont } from '../utils/fonts';
import { calculateImageQuality, calculateFabricImageEffectiveDpi } from '../utils/imageQuality';
import { runPreflightCheck, PreflightReport } from '../utils/preflightCheck';
import { urlToSafeDataUrl, formatImageUrl, getProxiedImageUrl } from '@/utils/imageUrl';
import { isSvg, normalizeSvgUrl } from '@/utils/svgNormalizer';

// Apply Canva-style selection frame and handles globally
applyCanvaControlsGlobal();

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
export type PanModeEventCallback = (enabled: boolean) => void;
export type BrushSettingsEventCallback = (settings: BrushSettings) => void;
export type BackgroundEventCallback = (settings: BackgroundSettings) => void;

export interface AddTextOptions {
  text?: string;
  fontSize?: number;
  /** Canva-style typographic size, converted using the artwork DPI. */
  fontSizePt?: number;
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
  photoFit?: 'cover' | 'contain';
}

export interface FrameAssetMetadata extends ImageMetadata {
  assetId?: string;
  provider?: string;
  overlayUrl?: string;
  maskUrl?: string;
  maskType?: string;
  shape?: string;
  width?: number;
  height?: number;
}

export interface ShapeAssetMetadata extends ImageMetadata {
  assetId?: string;
  provider?: string;
  photoFit?: 'cover' | 'contain';
  fill?: string;
  recolourable?: boolean;
  allowPhotoDrop?: boolean;
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

export { urlToSafeDataUrl, formatImageUrl, getProxiedImageUrl };

export const CUSTOM_CANVAS_PROPERTIES = [
  'id',
  'name',
  'isGuide',
  'isPrintGuide',
  'isRulerGuide',
  'isBackground',
  'excludeFromSelection',
  'isBrushPath',
  'isPencilStroke',
  'brushType',
  'imageId',
  'previewSrc',
  'originalSrc',
  'upscaledSrc',
  'sourceWidth',
  'sourceHeight',
  'effectiveDpi',
  'upscaleFactor',
  'upscaleStatus',
  'sourceUrl',
  'sourceType',
  'provider',
  'providerAssetId',
  'assetId',
  'isFrame',
  'isShape',
  'frameId',
  'slotId',
  'isCanvaPlaceholder',
  'frameShape',
  'shapeType',
  'photoFit',
  'isCustomFrame',
  'frameOverlayUrl',
  'frameMaskUrl',
  'frameMaskType',
  'frameWidth',
  'frameHeight',
  'frameRole',
  'customShapeUrl',
  'allowPhotoDrop',
  'isPhotoShapeGroup',
  'cropX',
  'cropY',
  'cropWidth',
  'cropHeight',
  'rx',
  'ry',
  'strokeDashArray',
  'strokeUniform',
  'lockMovementX',
  'lockMovementY',
  'isLocked',
  'lockRotation',
  'lockScalingX',
  'lockScalingY',
  'hasControls',
  'selectable',
  'evented',
  'fontSizePt',
  'naturalWidth',
  'naturalHeight',
  'fileSizeBytes',
];

/** Properties that must be painted on Group children, not only on the Group wrapper. */
const GROUP_RECURSIVE_PROPERTIES = new Set<keyof SelectedObjectState>([
  'fill',
  'stroke',
  'strokeWidth',
  'strokeDashArray',
  'strokeLineCap',
  'strokeLineJoin',
  'rx',
  'ry',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'underline',
  'linethrough',
  'textAlign',
  'charSpacing',
  'lineHeight',
]);

export class CanvasManager {
  private canvas: Canvas | null = null;
  private dimensions: CanvasDimensions;
  private guides: CanvasGuides;
  private snapping: CanvasSnapping;
  private zoom: number = 1.0;
  private pendingZoom: number | null = null;
  private zoomAnimationFrame: number | null = null;
  private isPanMode: boolean = false;
  private isDrawing: boolean = false;
  private isErasing: boolean = false;
  private lastErasePoint: { x: number; y: number } | null = null;
  private hasErasedInCurrentStroke: boolean = false;
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
    calligraphyAngle: 30,
  };
  private backgroundSettings: BackgroundSettings = {
    type: 'color',
    color: '#ffffff',
  };

  // Event Listeners
  private selectionListeners: Set<SelectionEventCallback> = new Set();
  private zoomListeners: Set<ZoomEventCallback> = new Set();
  private changeListeners: Set<CanvasEventCallback> = new Set();
  private guidesListeners: Set<GuidesEventCallback> = new Set();
  private layersListeners: Set<LayersEventCallback> = new Set();
  private preflightListeners: Set<PreflightEventCallback> = new Set();
  private drawingModeListeners: Set<DrawingModeEventCallback> = new Set();
  private panModeListeners: Set<PanModeEventCallback> = new Set();
  private brushSettingsListeners: Set<BrushSettingsEventCallback> = new Set();
  private backgroundListeners: Set<BackgroundEventCallback> = new Set();
  private historyListeners: Set<(canUndo: boolean, canRedo: boolean) => void> = new Set();
  private isPreflightScheduled: boolean = false;

  // History / Undo & Redo Stack
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private isProcessingHistory: boolean = false;
  private maxHistoryLength: number = 50;
  private historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private preventNativeDragHandler: ((e: DragEvent) => void) | null = null;

  // Shape-to-Image / Image-to-Shape Hover & Fit State
  private currentHoverFitTarget: FabricObject | null = null;
  private origHoverTargetProps: {
    stroke?: any;
    strokeWidth?: number;
    strokeDashArray?: any;
  } | null = null;
  private isProcessingShapeFit: boolean = false;

  constructor(dimensions: CanvasDimensions, initialGuidesSettings?: Partial<PrintGuidesSettings>) {
    this.dimensions = dimensions;
    this.guides = new CanvasGuides(dimensions, initialGuidesSettings);
    this.snapping = new CanvasSnapping(dimensions);
  }

  /**
   * Disables HTML5 native drag-and-drop on Fabric's upper canvas.
   * In modern browsers, upperCanvasEl having draggable="true" intercepts mousedown/mousemove
   * and fires HTML5 'dragstart', completely killing Fabric's mouse/drag transform loop.
   */
  public ensureUpperCanvasNonDraggable(): void {
    if (!this.canvas?.upperCanvasEl) return;
    const upperEl = this.canvas.upperCanvasEl;

    upperEl.draggable = false;
    upperEl.removeAttribute('draggable');

    if (!(upperEl as any)._hasDragPreventer) {
      (upperEl as any)._hasDragPreventer = true;
      const preventNativeDrag = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      };
      upperEl.addEventListener('dragstart', preventNativeDrag, { capture: true });
      this.preventNativeDragHandler = preventNativeDrag;

      // Prevent Fabric 7 or any extensions from resetting draggable="true"
      const origSetAttribute = upperEl.setAttribute.bind(upperEl);
      upperEl.setAttribute = function (name: string, value: string) {
        if (name.toLowerCase() === 'draggable') {
          origSetAttribute('draggable', 'false');
          this.draggable = false;
          return;
        }
        return origSetAttribute(name, value);
      };
    }
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
      selectionColor: 'rgba(139, 61, 255, 0.12)',
      selectionBorderColor: '#8b3dff',
      selectionLineWidth: 1.5,
      stopContextMenu: true,
      fireRightClick: true,
      enableRetinaScaling: true,
      imageSmoothingEnabled: true,
      uniformScaling: true,
      // Resize from the dragged control and keep the opposite corner fixed.
      // Centered scaling makes left/top appear to drift while resizing.
      centeredScaling: false,
    });
    (canvas as any).uniformScaling = true;
    (canvas as any).centeredScaling = false;

    applyCanvaControlsGlobal();
    canvas.setZoom(this.zoom);

    this.canvas = canvas;
    if (typeof window !== 'undefined') {
      (window as any).__fabricCanvas = canvas;
      (window as any).__canvasManager = this;
    }
    this.ensureUpperCanvasNonDraggable();
    this.guides.attach(canvas);
    this.snapping.attach(canvas);
    this.bindEvents();
    canvas.calcOffset();

    // Initialize history baseline
    this.undoStack = [];
    this.redoStack = [];
    this.saveHistoryState();

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
      this.canvas.calcOffset();
      this.canvas.forEachObject((obj) => {
        obj.setCoords();
      });
      this.canvas.requestRenderAll();
      this.notifyChange();

      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          if (!this.canvas) return;
          this.canvas.calcOffset();
          this.canvas.forEachObject((obj) => {
            obj.setCoords();
          });
        });
      }
    }
  }

  public getGuidesSettings(): PrintGuidesSettings {
    return this.guides.getSettings();
  }

  /**
   * Dynamically initializes the artwork canvas and guidelines based on a template's
   * specific artwork configuration (width, height, unit, bleed, safe area, margin, trim, DPI, etc.).
   * Eliminates any hardcoded dimensions.
   */
  public initializeArtwork(config: ArtworkConfig | any): DocumentSettings {
    if (!config) {
      return {
        width: this.dimensions.widthMm || 90,
        height: this.dimensions.heightMm || 50,
        unit: 'mm',
        dpi: this.dimensions.dpi || 300,
        bleed: this.dimensions.bleedMm ?? 3,
        safeArea: this.dimensions.safeZoneMm ?? 3,
        backgroundColor: '#ffffff',
        showGuides: true,
      };
    }

    const width = Number(config.width ?? config.widthMm ?? 90);
    const height = Number(config.height ?? config.heightMm ?? 50);
    const unit: UnitType = (config.unit as UnitType) || 'mm';
    const dpi = Number(config.dpi) || 300;
    const bleed = Number(config.bleed !== undefined ? config.bleed : (config.bleedMm !== undefined ? config.bleedMm : 3));
    const safeArea = Number(
      config.safeArea !== undefined
        ? config.safeArea
        : (config.safe_area !== undefined
          ? config.safe_area
          : (config.margin !== undefined ? config.margin : 3))
    );
    const margin = Number(
      config.margin !== undefined
        ? config.margin
        : (config.safeArea !== undefined
          ? config.safeArea
          : (config.safe_area !== undefined ? config.safe_area : 2))
    );

    const backgroundColor = config.backgroundColor || config.background || '#ffffff';
    const orientation = config.orientation || (width >= height ? 'landscape' : 'portrait');
    const showGuides = config.showGuides !== false;

    const docSettings: DocumentSettings = {
      width,
      height,
      unit,
      dpi,
      bleed,
      safeArea,
      margin,
      backgroundColor,
      showGuides,
      orientation,
      name: config.name,
    };

    const newDims = calculateCanvasDimensions(docSettings);
    this.dimensions = newDims;
    this.guides.updateDimensions(newDims);
    this.snapping.updateDimensions(newDims);

    // Apply guides / trim configuration if specified
    const trimActive = config.trim !== undefined ? Boolean(config.trim) : true;
    this.guides.updateSettings({
      showTrim: trimActive,
      ...(config.guides || {}),
    });

    if (backgroundColor && this.canvas) {
      this.setBackgroundColor(backgroundColor);
    }

    if (this.canvas) {
      const targetWidth = Math.round(newDims.widthPx * this.zoom);
      const targetHeight = Math.round(newDims.heightPx * this.zoom);

      this.canvas.setDimensions({
        width: targetWidth,
        height: targetHeight,
      });

      this.canvas.setZoom(this.zoom);
      this.canvas.requestRenderAll();
      this.notifyChange();
    }

    return docSettings;
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

  public getColorsInDesign(): string[] {
    if (!this.canvas) return ['#000000', '#ffffff', '#2563eb', '#10b981', '#ef4444'];
    const colors = new Set<string>();

    if (this.canvas.backgroundColor && typeof this.canvas.backgroundColor === 'string') {
      colors.add(this.canvas.backgroundColor);
    }

    this.canvas.getObjects().forEach((obj) => {
      if (obj.get('isGuide' as any)) return;

      const fill = obj.fill;
      if (typeof fill === 'string' && fill !== 'transparent' && fill !== '' && !fill.startsWith('blob:')) {
        colors.add(fill);
      }

      const stroke = obj.stroke;
      if (typeof stroke === 'string' && stroke !== 'transparent' && stroke !== '') {
        colors.add(stroke);
      }
    });

    const result = Array.from(colors).filter((c) => c && c !== 'transparent');
    return result.length > 0 ? result : ['#000000', '#ffffff', '#2563eb', '#10b981', '#ef4444'];
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
      // A browser <img> preview can display a cross-origin storage URL even
      // when Fabric cannot safely read it. Convert/proxy the source first so
      // the same admin image can be used by the canvas and later exported.
      const safeUrl = await urlToSafeDataUrl(url);
      const img = await FabricImage.fromURL(safeUrl, {
        crossOrigin: 'anonymous',
      });
      if (!this.canvas) return;

      if (!img.width || !img.height) {
        throw new Error('The background image has invalid dimensions.');
      }

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
      // Let the panel keep the Photos tab open and show a useful error instead
      // of incorrectly marking a failed background as selected.
      throw err instanceof Error
        ? err
        : new Error('Failed to load background image.');
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

    if (
      clampedZoom === this.zoom &&
      this.pendingZoom === null &&
      this.zoomAnimationFrame === null
    ) {
      return;
    }

    this.zoom = clampedZoom;

    /*
     * Wheel and trackpad gestures can emit dozens of events per frame.
     * Keep only the newest requested zoom and render once per animation frame.
     */
    this.pendingZoom = clampedZoom;

    if (this.zoomAnimationFrame !== null) return;

    const applyZoom = () => {
      this.zoomAnimationFrame = null;

      if (!this.canvas || this.pendingZoom === null) return;

      const zoomToApply = this.pendingZoom;
      this.pendingZoom = null;

      const baseWidth = this.dimensions.widthPx || 1063;
      const baseHeight = this.dimensions.heightPx || 591;

      const targetWidth = Math.round(baseWidth * zoomToApply);
      const targetHeight = Math.round(baseHeight * zoomToApply);

      this.canvas.setDimensions({
        width: targetWidth,
        height: targetHeight,
      });

      this.canvas.setZoom(zoomToApply);
      this.canvas.calcOffset();
      this.canvas.requestRenderAll();
      this.notifyZoom();

      if (this.pendingZoom !== null && this.zoomAnimationFrame === null) {
        this.zoomAnimationFrame = requestAnimationFrame(applyZoom);
      }
    };

    this.zoomAnimationFrame = requestAnimationFrame(applyZoom);
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

  /**
   * Fabric objects can cross serialization, cloning and optimized bundle
   * boundaries where instanceof is not reliable. Always retain a type-name
   * fallback so reselected text continues to expose typography properties.
   */
  private isTextObject(
    obj: FabricObject | null | undefined
  ): obj is Textbox | IText {
    if (!obj) return false;

    const normalizedType = String(obj.type || '')
      .toLowerCase()
      .replace(/[-_\s]/g, '');

    return (
      obj instanceof Textbox ||
      obj instanceof IText ||
      normalizedType === 'textbox' ||
      normalizedType === 'itext' ||
      normalizedType === 'text'
    );
  }

  /** Returns true for editor-only objects that must never capture clicks. */
  private isNonInteractiveObject(obj: FabricObject | null | undefined): boolean {
    if (!obj) return false;

    const getValue = (key: string): unknown => {
      if (typeof (obj as any).get === 'function') {
        return (obj as any).get(key);
      }

      return (obj as any)[key];
    };

    return Boolean(
      getValue('isGuide') ||
      getValue('isPrintGuide') ||
      getValue('excludeFromSelection') ||
      getValue('isBackground')
    );
  }

  /** Restores selection without unlocking objects explicitly locked by the user. */
  /** Restores selection without unlocking objects explicitly locked by the user. */
  private restoreObjectInteractivity(obj: unknown): void {
    // Sometimes mouse events can return a wrapper/plain object.
    // Only process a real Fabric-like object.
    if (
      !obj ||
      typeof obj !== 'object' ||
      typeof (obj as any).set !== 'function' ||
      typeof (obj as any).setCoords !== 'function'
    ) {
      return;
    }

    const fabricObject = obj as FabricObject;

    const getValue = (key: string): any => {
      if (typeof (fabricObject as any).get === 'function') {
        return (fabricObject as any).get(key);
      }

      return (fabricObject as any)[key];
    };

    if (this.isNonInteractiveObject(fabricObject)) {
      fabricObject.set({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'default',
        moveCursor: 'default',
      });

      fabricObject.setCoords();
      return;
    }

    const isLocked =
      getValue('isLocked') === true ||
      (
        fabricObject.lockMovementX === true &&
        fabricObject.lockMovementY === true &&
        getValue('isLocked') !== false
      );

    if (isLocked) {
      fabricObject.set({
        selectable: true,
        evented: true,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hasControls: false,
        hasBorders: true,
        hoverCursor: 'default',
        moveCursor: 'default',
      });
    } else {
      fabricObject.set({
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockMovementX: false,
        lockMovementY: false,
        lockRotation: false,
        lockScalingX: false,
        lockScalingY: false,
        lockScalingFlip: true,
        hoverCursor: 'move',
        moveCursor: 'move',
      });
    }

    applyCanvaControlsToObject(fabricObject);
    fabricObject.setCoords();
  }

  /** Activates the normal pointer/select tool. */
  public enableSelectionMode(): void {
    this.isPanMode = false;
    this.isDrawing = false;
    this.isErasing = false;
    this.lastErasePoint = null;

    if (!this.canvas) return;

    (this.canvas as any).isDragging = false;
    this.canvas.selection = true;
    this.canvas.skipTargetFind = false;
    this.canvas.isDrawingMode = false;
    this.canvas.freeDrawingBrush = undefined;
    this.canvas.defaultCursor = 'default';
    this.canvas.hoverCursor = 'move';
    this.canvas.moveCursor = 'move';
    this.canvas.setCursor('default');

    this.ensureUpperCanvasNonDraggable();

    this.canvas.forEachObject((obj) => {
      this.restoreObjectInteractivity(obj);
    });

    this.canvas.calcOffset();
    this.canvas.requestRenderAll();
    this.drawingModeListeners.forEach((cb) => cb(false));
    this.notifyPanMode(false);
  }

  public setPanMode(enabled: boolean): void {
    this.isPanMode = enabled;
    if (!this.canvas) return;

    if (enabled) {
      this.canvas.isDrawingMode = false;
      this.isDrawing = false;
      this.canvas.skipTargetFind = true;
      (this.canvas as any).isDragging = false;
      this.canvas.defaultCursor = 'grab';
      this.canvas.hoverCursor = 'grab';
      this.canvas.moveCursor = 'grabbing';
      this.canvas.setCursor('grab');
      this.canvas.selection = false;
      this.canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      this.notifyPanMode(true);
    } else {
      this.enableSelectionMode();
      return;
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

    if (enabled) {
      this.isPanMode = false;
      this.notifyPanMode(false);
      this.canvas.discardActiveObject();
      this.applyBrushSettings();
    } else {
      this.enableSelectionMode();
      return;
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

    if (this.canvas) {
      if (this.isDrawing) {
        this.applyBrushSettings();
      }
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

    // ================================================================
    // ERASER: Custom interactive eraser for pencil/brush strokes ONLY
    // ================================================================
    if (tool === 'eraser') {
      // Disable Fabric's free drawing brush & normal object selection
      this.canvas.isDrawingMode = false;
      this.canvas.freeDrawingBrush = undefined;
      this.canvas.selection = false;
      this.canvas.discardActiveObject();
      this.canvas.defaultCursor = 'crosshair';
      this.canvas.hoverCursor = 'crosshair';
      return;
    }

    // Normal drawing brushes: enable freeDrawingMode
    this.canvas.isDrawingMode = true;
    this.canvas.selection = false;
    this.canvas.defaultCursor = 'default';
    this.canvas.hoverCursor = 'move';

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

  /**
   * Selective Pencil Eraser: erases ONLY pencil and brush strokes on the canvas.
   * Text, images, shapes, and frames are protected and never touched.
   */
  public erasePencilStrokesAt(pointerX: number, pointerY: number, eraserRadius: number): boolean {
    if (!this.canvas) return false;

    // Filter for ONLY freehand/pencil/brush strokes
    const objects = this.canvas.getObjects().filter((obj) => {
      if (obj.get('isGuide' as any)) return false;
      return Boolean(
        obj.get('isBrushPath' as any) ||
        obj.get('isPencilStroke' as any) ||
        (obj instanceof Path && obj.get('brushType' as any))
      );
    });

    if (objects.length === 0) return false;

    let canvasModified = false;

    for (const obj of objects) {
      if (!(obj instanceof Path) || !obj.path) continue;

      const pathObj = obj as Path;
      const matrix = pathObj.calcTransformMatrix();
      const pathOffset = pathObj.pathOffset || new Point(0, 0);

      // Check bounding box intersection
      pathObj.setCoords();
      const bounds = pathObj.getBoundingRect();
      const strokeW = pathObj.strokeWidth || 4;
      const hitRadius = eraserRadius + strokeW / 2;

      if (
        pointerX + hitRadius < bounds.left ||
        pointerX - hitRadius > bounds.left + bounds.width ||
        pointerY + hitRadius < bounds.top ||
        pointerY - hitRadius > bounds.top + bounds.height
      ) {
        continue;
      }

      // Inspect commands in path
      const commands = pathObj.path as Array<any[]>;
      if (!commands || commands.length === 0) continue;

      const erasedIndices = new Set<number>();

      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const cx = cmd[cmd.length - 2];
        const cy = cmd[cmd.length - 1];
        if (typeof cx !== 'number' || typeof cy !== 'number') continue;

        // Transform local path coordinate to canvas space
        const localPt = new Point(cx - pathOffset.x, cy - pathOffset.y);
        const canvasPt = localPt.transform(matrix);

        const dist = Math.hypot(canvasPt.x - pointerX, canvasPt.y - pointerY);
        if (dist <= hitRadius) {
          erasedIndices.add(i);
        }
      }

      if (erasedIndices.size === 0) continue;

      canvasModified = true;
      const originalIndex = this.canvas.getObjects().indexOf(pathObj);

      // If entire stroke erased -> remove from canvas
      if (erasedIndices.size >= commands.length) {
        this.canvas.remove(pathObj);
        continue;
      }

      // Partition into remaining continuous sub-paths
      const segments: Array<any[][]> = [];
      let currentSeg: any[][] = [];

      for (let i = 0; i < commands.length; i++) {
        if (!erasedIndices.has(i)) {
          const cmd = [...commands[i]];
          if (currentSeg.length === 0 && cmd[0] !== 'M') {
            const cx = cmd[cmd.length - 2];
            const cy = cmd[cmd.length - 1];
            currentSeg.push(['M', cx, cy]);
          } else {
            currentSeg.push(cmd);
          }
        } else {
          if (currentSeg.length >= 2) {
            segments.push(currentSeg);
          }
          currentSeg = [];
        }
      }
      if (currentSeg.length >= 2) {
        segments.push(currentSeg);
      }

      this.canvas.remove(pathObj);

      if (segments.length === 0) {
        continue;
      }

      const commonProps = {
        stroke: pathObj.stroke,
        strokeWidth: pathObj.strokeWidth,
        fill: pathObj.fill || null,
        strokeLineCap: pathObj.strokeLineCap || 'round',
        strokeLineJoin: pathObj.strokeLineJoin || 'round',
        opacity: pathObj.opacity,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
      };

      let insertIdx = originalIndex;
      for (const seg of segments) {
        try {
          const newPath = new Path(seg as any, commonProps);
          this.ensureObjectId(newPath, pathObj.get('name' as any) || 'Pencil Stroke');
          newPath.set('isBrushPath' as any, true);
          newPath.set('isPencilStroke' as any, true);
          newPath.set('brushType' as any, pathObj.get('brushType' as any) || 'pencil');
          this.canvas.insertAt(insertIdx, newPath);
          insertIdx++;
        } catch {
          // ignore parsing edge cases
        }
      }
    }

    return canvasModified;
  }

  /**
   * Waits for all images currently on the canvas (including within groups,
   * clip paths, background and overlay images) to fully finish loading and decoding.
   */
  public async waitForAllImagesToLoad(timeoutMs: number = 8000): Promise<void> {
    if (!this.canvas) return;

    const imagePromises: Promise<void>[] = [];

    const checkElement = (imgEl: any, parentObj?: any) => {
      if (!imgEl || typeof imgEl !== 'object') return;
      if (!(imgEl instanceof HTMLImageElement || imgEl.tagName === 'IMG' || typeof imgEl.src === 'string')) return;

      if (!imgEl.complete || imgEl.naturalWidth === 0) {
        imagePromises.push(
          new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              if (parentObj && typeof parentObj.setCoords === 'function') {
                parentObj.setCoords();
              }
              resolve();
            }, timeoutMs);
            const onComplete = () => {
              clearTimeout(timer);
              if (typeof imgEl.decode === 'function') {
                imgEl.decode().catch(() => { }).finally(() => {
                  if (parentObj && typeof parentObj.setCoords === 'function') {
                    parentObj.setCoords();
                  }
                  resolve();
                });
              } else {
                if (parentObj && typeof parentObj.setCoords === 'function') {
                  parentObj.setCoords();
                }
                resolve();
              }
            };
            imgEl.addEventListener('load', onComplete, { once: true });
            imgEl.addEventListener(
              'error',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true }
            );
          })
        );
      } else if (typeof imgEl.decode === 'function') {
        imagePromises.push(
          imgEl.decode().catch(() => { }).finally(() => {
            if (parentObj && typeof parentObj.setCoords === 'function') {
              parentObj.setCoords();
            }
          })
        );
      }
    };

    const inspectObject = (obj: any) => {
      if (!obj) return;

      const el =
        (typeof obj.getElement === 'function' ? obj.getElement() : null) ||
        obj._element ||
        obj.image ||
        obj._originalElement;

      if (el) {
        checkElement(el, obj);
      }

      if (obj.clipPath) {
        inspectObject(obj.clipPath);
      }

      if (Array.isArray(obj._objects)) {
        obj._objects.forEach(inspectObject);
      } else if (Array.isArray(obj.objects)) {
        obj.objects.forEach(inspectObject);
      }
    };

    this.canvas.getObjects().forEach(inspectObject);

    if (this.canvas.backgroundImage) {
      inspectObject(this.canvas.backgroundImage);
    }
    if (this.canvas.overlayImage) {
      inspectObject(this.canvas.overlayImage);
    }
    if (this.canvas.clipPath) {
      inspectObject(this.canvas.clipPath);
    }

    if (imagePromises.length > 0) {
      await Promise.allSettled(imagePromises);
    }

    this.canvas.requestRenderAll();
  }

  /**
   * Generates a clean Canva-style presentation snapshot without selection borders,
   * handles, or editor guides.
   */
  /**
   * Generates a clean Canva-style presentation snapshot without selection borders,
   * handles, or editor guides.
   */
  public async getCleanPreviewDataUrl(multiplier: number = 1.0): Promise<string | null> {
    if (!this.canvas) return null;

    // Do NOT generate previews if user is actively dragging or transforming an object
    if ((this.canvas as any)._currentTransform) {
      return null;
    }

    // Ensure all canvas textures are fully loaded and decoded
    await this.waitForAllImagesToLoad();

    const wasGuidesVisible = this.guides.getVisible();

    try {
      if (wasGuidesVisible) {
        this.guides.setVisible(false);
      }

      const currentZoom = this.zoom || 1.0;
      const effectiveMultiplier = (1 / currentZoom) * multiplier;

      let dataUrl: string | null = null;

      try {
        // In Fabric.js, toDataURL() exports only lowerCanvas objects.
        // UpperCanvas selection outlines and control handles are never exported.
        dataUrl = this.canvas.toDataURL({
          format: 'png',
          multiplier: effectiveMultiplier,
          enableRetinaScaling: true,
        });
      } catch (toDataUrlErr) {
        console.warn('Standard toDataURL failed, attempting lower element fallback:', toDataUrlErr);
        try {
          const lowerCanvas = this.canvas.lowerCanvasEl;
          if (lowerCanvas) {
            dataUrl = lowerCanvas.toDataURL('image/png');
          }
        } catch (lowerErr) {
          console.error('All toDataURL attempts failed (canvas tainted):', lowerErr);
        }
      }

      return dataUrl;
    } catch (err) {
      console.error('Failed to generate clean preview data URL:', err);
      return null;
    } finally {
      if (wasGuidesVisible) {
        this.guides.setVisible(true);
      }
    }
  }

  public onDrawingModeChange(cb: DrawingModeEventCallback): () => void {
    this.drawingModeListeners.add(cb);
    return () => this.drawingModeListeners.delete(cb);
  }

  public onPanModeChange(cb: PanModeEventCallback): () => void {
    this.panModeListeners.add(cb);
    return () => this.panModeListeners.delete(cb);
  }

  private notifyPanMode(enabled: boolean): void {
    this.panModeListeners.forEach((cb) => cb(enabled));
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
    applyCanvaControlsToObject(obj);
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
    this.enableSelectionMode();
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

  // --- Canva Grouping & Ungrouping Engine ---

  public canGroup(): boolean {
    if (!this.canvas) return false;
    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof ActiveSelection)) return false;
    const valid = active.getObjects().filter(
      (obj) => !obj.get('isGuide' as any) && !(obj.lockMovementX && obj.lockMovementY)
    );
    return valid.length >= 2;
  }

  public canUngroup(): boolean {
    if (!this.canvas) return false;
    const active = this.canvas.getActiveObject();
    if (!active) return false;
    return (
      (active.type === 'Group' || active.type === 'group' || active instanceof Group) &&
      !(active instanceof ActiveSelection)
    );
  }

  public groupSelected(): void {
    if (!this.canvas || !this.canGroup()) return;
    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof ActiveSelection)) return;

    const objects = active.getObjects().filter(
      (obj) => !obj.get('isGuide' as any) && !(obj.lockMovementX && obj.lockMovementY)
    );
    if (objects.length < 2) return;

    // Preserve lowest canvas stacking index
    const allCanvasObjs = this.canvas.getObjects();
    const indices = objects.map((o) => allCanvasObjs.indexOf(o)).filter((i) => i >= 0);
    const insertIndex = Math.min(...indices);

    // Discard active selection to restore objects to canvas coordinate space
    this.canvas.discardActiveObject();

    // Remove objects from canvas
    objects.forEach((obj) => this.canvas?.remove(obj));

    // Create new Group with objects
    const group = new Group(objects, {
      subTargetCheck: true,
    });
    this.ensureObjectId(group, 'Group');

    // Store representative visual values on the wrapper for toolbar display.
    const styleSource = objects.find((obj) => !this.isNonInteractiveObject(obj));
    if (styleSource) {
      group.set({
        fill: typeof styleSource.fill === 'string' ? styleSource.fill : undefined,
        stroke: typeof styleSource.stroke === 'string' ? styleSource.stroke : undefined,
        strokeWidth: styleSource.strokeWidth || 0,
        strokeDashArray: styleSource.strokeDashArray || undefined,
        strokeLineCap: styleSource.strokeLineCap,
        strokeLineJoin: styleSource.strokeLineJoin,
      } as any);
      group.set('rx' as any, Number((styleSource as any).rx) || 0);
      group.set('ry' as any, Number((styleSource as any).ry) || 0);
    }

    this.canvas.insertAt(insertIndex, group);
    group.setCoords();
    this.canvas.setActiveObject(group);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
  }

  public ungroupSelected(): void {
    if (!this.canvas || !this.canUngroup()) return;
    const active = this.canvas.getActiveObject();
    if (
      !active ||
      !(active.type === 'Group' || active.type === 'group' || active instanceof Group) ||
      active instanceof ActiveSelection
    ) {
      return;
    }

    const group = active as Group;
    const children = group.getObjects();
    if (children.length === 0) return;

    const groupIndex = this.canvas.getObjects().indexOf(group);
    this.canvas.discardActiveObject();
    this.canvas.remove(group);

    // In Fabric 7, group.remove(child) triggers exitGroup(child, false), which
    // applies the group transformation matrix to child and resets coordinates to canvas space!
    const restoredChildren: FabricObject[] = [];
    let currentIdx = groupIndex >= 0 ? groupIndex : this.canvas.getObjects().length;

    // Shallow copy of children because group.remove mutates internal objects array
    const childrenCopy = [...children];
    for (const child of childrenCopy) {
      group.remove(child);
      this.canvas.insertAt(currentIdx++, child);
      child.setCoords();
      restoredChildren.push(child);
    }

    if (restoredChildren.length > 0) {
      const sel = new ActiveSelection(restoredChildren, { canvas: this.canvas });
      this.canvas.setActiveObject(sel);
    }

    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
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

  public updateMargin(marginMm: number): void {
    const dpi = this.dimensions.dpi || 300;
    const marginPx = Math.round(marginMm * (1 / 25.4) * dpi);
    this.dimensions = {
      ...this.dimensions,
      marginMm,
      marginPx,
      safeZoneMm: marginMm,
      safeZonePx: marginPx,
    };
    this.guides.updateDimensions(this.dimensions);
    this.snapping.updateDimensions(this.dimensions);
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
    this.notifyChange();
  }

  // --- Templates Engine ---

  private async prepareBackendTemplateJson(rawJson: any): Promise<any> {
    let baseJson = rawJson;
    if (Array.isArray(rawJson) && rawJson.length > 0) {
      const firstItem = rawJson[0];
      if (firstItem && typeof firstItem === 'object' && ('objects' in firstItem || 'version' in firstItem)) {
        baseJson = firstItem;
      }
    }

    const json = JSON.parse(
      JSON.stringify(
        Array.isArray(baseJson)
          ? {
            version: '6.0.0',
            objects: baseJson,
          }
          : baseJson
      )
    );

    const prepareNode = async (node: any): Promise<void> => {
      if (!node || typeof node !== 'object') return;

      const rawType = String(node.type || '').toLowerCase();
      const isImageObj =
        rawType === 'image' ||
        rawType === 'fabricimage' ||
        typeof node.src === 'string' ||
        typeof node.url === 'string';

      if (isImageObj) {
        const rawSrc = node.src || node.url || node.originalSrc;
        if (typeof rawSrc === 'string' && rawSrc.trim()) {
          node.originalSrc = rawSrc;
          node.src = await urlToSafeDataUrl(rawSrc);
          node.crossOrigin = 'anonymous';
        }
      }

      // Check pattern fills or strokes with image sources
      if (node.fill && typeof node.fill === 'object' && typeof node.fill.source === 'string') {
        node.fill.source = await urlToSafeDataUrl(node.fill.source);
      }
      if (node.stroke && typeof node.stroke === 'object' && typeof node.stroke.source === 'string') {
        node.stroke.source = await urlToSafeDataUrl(node.stroke.source);
      }

      if (Array.isArray(node.objects)) {
        await Promise.all(node.objects.map(prepareNode));
      }

      if (Array.isArray(node._objects)) {
        await Promise.all(node._objects.map(prepareNode));
      }

      if (node.clipPath) {
        await prepareNode(node.clipPath);
      }

      if (node.backgroundImage) {
        if (typeof node.backgroundImage === 'string') {
          node.backgroundImage = await urlToSafeDataUrl(node.backgroundImage);
        } else {
          await prepareNode(node.backgroundImage);
        }
      }

      if (node.overlayImage) {
        if (typeof node.overlayImage === 'string') {
          node.overlayImage = await urlToSafeDataUrl(node.overlayImage);
        } else {
          await prepareNode(node.overlayImage);
        }
      }
    };

    await prepareNode(json);

    return json;
  }

  public async loadTemplate(template: DesignerTemplate | any): Promise<void> {
    if (!this.canvas) return;

    // If template includes an artwork configuration, dynamically initialize canvas to match
    if (template && (template.artwork_config || template.widthMm || template.heightMm)) {
      const config = template.artwork_config || {
        width: template.widthMm,
        height: template.heightMm,
        unit: 'mm',
        backgroundColor: template.backgroundColor,
      };
      this.initializeArtwork(config);
    }

    this.canvas.discardActiveObject();
    const existing = [...this.canvas.getObjects()];
    existing.forEach((obj) => {
      if (!obj.get('isGuide' as any)) {
        this.canvas?.remove(obj);
      }
    });

    const canvasW = this.dimensions.widthPx;
    const canvasH = this.dimensions.heightPx;

    if (template.backgroundColor) {
      this.setBackgroundColor(template.backgroundColor);
    }

    const rawCanvasJson =
      (template as any).template_json ??
      (template as any).canvas_json ??
      (template as any).design_json ??
      (template as any).template_data ??
      ((template as any).objects ? template : null);

    if (rawCanvasJson) {
      try {
        const json =
          typeof rawCanvasJson === 'string'
            ? JSON.parse(rawCanvasJson)
            : rawCanvasJson;

        if (json && (json.objects || Array.isArray(json))) {
          const exportSafeJson =
            await this.prepareBackendTemplateJson(json);

          await this.canvas.loadFromJSON(exportSafeJson);

          // Guarantee that the canvas dimensions strictly respect this template's dimensions
          const targetWidth = Math.round(this.dimensions.widthPx * this.zoom);
          const targetHeight = Math.round(this.dimensions.heightPx * this.zoom);
          this.canvas.setDimensions({
            width: targetWidth,
            height: targetHeight,
          });
          this.canvas.setZoom(this.zoom);
          this.guides.updateDimensions(this.dimensions);
          this.canvas.calcOffset();
          this.canvas.forEachObject((obj) => {
            obj.setCoords();
          });
          this.canvas.requestRenderAll();
          await this.waitForAllImagesToLoad();

          this.finishTemplateLoading();
          return;
        }
      } catch (jsonErr) {
        console.warn('Failed to load raw canvas_json, proceeding with objects parsing:', jsonErr);
      }
    }

    const objects = Array.isArray(template.objects) ? template.objects : [];

    for (const objDef of objects) {
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
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
          padding: 6,
          selectable: true,
          evented: true,
          objectCaching: false,
          noScaleCache: false,
          strokeUniform: true,
        });

        tb.set('sourceType' as any, 'vector-text');
        tb.set(
          'fontSizePt' as any,
          (fontSize * 72) / Math.max(72, Number(this.dimensions.dpi) || 96)
        );

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
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
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
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
          selectable: true,
          evented: true,
        });
        this.ensureObjectId(circle, (objDef.name as string) || 'Circle');
        this.canvas.add(circle);
      } else if (objDef.type === 'image' || (objDef.type as string) === 'FabricImage') {
        const imgSrc = (objDef.src as string) || (objDef.url as string) || (template as any).thumbnailUrl;
        if (imgSrc) {
          try {
            await this.addImageFromUrl(
              imgSrc,
              {
                name: (objDef.name as string) || template.title || 'Template Image',
                originalSrc: imgSrc,
              },
              {
                left: pxLeft,
                top: pxTop,
              }
            );
          } catch (imgErr) {
            console.warn('Could not load template image object:', imgErr);
          }
        }
      }
    }

    if (objects.length === 0 && (template as any).thumbnailUrl) {
      try {
        await this.addImageFromUrl((template as any).thumbnailUrl, {
          name: template.title || 'Template Image',
          originalSrc: (template as any).thumbnailUrl,
        });
      } catch (imgErr) {
        console.warn('Could not load fallback template image:', imgErr);
      }
    }

    await this.waitForAllImagesToLoad();
    this.finishTemplateLoading();
  }

  /**
   * Refreshes interactive flags, coordinate geometry, and Canva controls for all canvas objects.
   * Ensures that deserialized or dynamically loaded elements can immediately be clicked,
   * selected, and moved without glitches across any zoom level.
   */
  public refreshCanvasInteractivity(): void {
    if (!this.canvas) return;

    this.enableSelectionMode();

    this.canvas.forEachObject((obj) => {
      if (this.isNonInteractiveObject(obj)) return;

      // Border frames or transparent shapes should allow clicks to pass through to underlying objects
      const fill = obj.fill;
      const isTransparentFill =
        !fill ||
        fill === 'transparent' ||
        fill === '' ||
        fill === 'rgba(0,0,0,0)' ||
        fill === 'rgba(0, 0, 0, 0)';
      if (isTransparentFill) {
        obj.set({
          perPixelTargetFind: true,
          strokeUniform: true,
        });
      }

      this.restoreObjectInteractivity(obj);
    });

    this.canvas.requestRenderAll();

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        if (!this.canvas) return;
        this.canvas.calcOffset();
        this.canvas.forEachObject((obj) => {
          obj.setCoords();
        });
      });
    }
  }

  /**
   * Finalize every template-loading path in one place.
   *
   * Manual canvas edits emit Fabric object events automatically, but an
   * asynchronous loadFromJSON() operation does not provide the preview modal
   * with one reliable "finished loading" event. This method renders the final
   * template state, updates all CanvasManager subscribers, and then emits a
   * dedicated event that live previews can listen for.
   */
  private finishTemplateLoading(): void {
    if (!this.canvas) return;

    // Imported Fabric JSON may contain the default bitmap cache setting.
    // Force every editable text object to render from glyph/vector data.
    this.canvas.getObjects().forEach((object) => {
      if (this.isTextObject(object)) {
        object.set({
          objectCaching: false,
          noScaleCache: false,
          strokeUniform: true,
          dirty: true,
        });
        object.set('sourceType' as any, 'vector-text');
      }
    });

    this.refreshCanvasInteractivity();

    this.canvas.discardActiveObject();
    this.canvas.renderAll();

    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
    this.notifyPreflight();

    (this.canvas as any).fire('template:loaded', {
      source: 'backend-template',
    });
  }

  // --- Canva Photo Frames Engine (with ClipPaths & Image Slotting) ---

  private async loadFrameOverlayObject(url: string): Promise<FabricObject> {
    let safeUrl = await urlToSafeDataUrl(url);

    if (isSvg(url) || isSvg(safeUrl)) {
      try {
        const normalized = await normalizeSvgUrl(safeUrl);
        safeUrl = normalized.dataUrl;
      } catch (error) {
        console.warn('Frame SVG normalization failed; using the original SVG source:', error);
      }
    }

    return FabricImage.fromURL(safeUrl, { crossOrigin: 'anonymous' });
  }

  private async loadFrameMaskObject(url: string): Promise<FabricImage> {
    let safeUrl = await urlToSafeDataUrl(url);

    try {
      const normalized = await normalizeSvgUrl(safeUrl);
      safeUrl = normalized.dataUrl;
    } catch (error) {
      console.warn('Frame mask normalization failed; using the original SVG source:', error);
    }

    return FabricImage.fromURL(safeUrl, { crossOrigin: 'anonymous' });
  }

  private async createCustomFrameGroup(
    overlayUrl: string,
    maskUrl: string,
    photoUrl: string,
    metadata: FrameAssetMetadata,
    frameWidth: number,
    frameHeight: number,
    isPlaceholder: boolean
  ): Promise<Group> {
    const [overlay, mask, safePhotoUrl] = await Promise.all([
      this.loadFrameOverlayObject(overlayUrl),
      this.loadFrameMaskObject(maskUrl),
      urlToSafeDataUrl(photoUrl),
    ]);
    const photo = await FabricImage.fromURL(safePhotoUrl, { crossOrigin: 'anonymous' });

    const naturalWidth = metadata.naturalWidth || photo.width || frameWidth;
    const naturalHeight = metadata.naturalHeight || photo.height || frameHeight;
    const photoFit = metadata.photoFit === 'contain' ? 'contain' : 'cover';
    const photoScale = photoFit === 'contain'
      ? Math.min(frameWidth / naturalWidth, frameHeight / naturalHeight)
      : Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight);

    let visibleSourceWidth = naturalWidth;
    let visibleSourceHeight = naturalHeight;
    let cropX = 0;
    let cropY = 0;

    if (photoFit === 'cover') {
      visibleSourceWidth = Math.min(naturalWidth, frameWidth / photoScale);
      visibleSourceHeight = Math.min(naturalHeight, frameHeight / photoScale);
      cropX = Math.max(0, (naturalWidth - visibleSourceWidth) / 2);
      cropY = Math.max(0, (naturalHeight - visibleSourceHeight) / 2);
    }

    photo.set({
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      width: visibleSourceWidth,
      height: visibleSourceHeight,
      cropX,
      cropY,
      scaleX: photoScale,
      scaleY: photoScale,
      selectable: false,
      evented: false,
    });

    const clipWidth = frameWidth / photoScale;
    const clipHeight = frameHeight / photoScale;
    mask.set({
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      scaleX: clipWidth / Math.max(mask.width || 1, 1),
      scaleY: clipHeight / Math.max(mask.height || 1, 1),
      absolutePositioned: false,
    });
    photo.set('clipPath', mask);
    photo.set('frameRole' as any, 'photo');

    overlay.set({
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      scaleX: frameWidth / Math.max(overlay.width || 1, 1),
      scaleY: frameHeight / Math.max(overlay.height || 1, 1),
      selectable: false,
      evented: false,
    });
    overlay.set('frameRole' as any, 'overlay');

    const group = new Group([photo, overlay], {
      originX: 'center',
      originY: 'center',
      cornerColor: '#ffffff',
      cornerStrokeColor: '#8b3dff',
      borderColor: '#8b3dff',
      cornerStyle: 'circle',
      cornerSize: 12,
      transparentCorners: false,
    });

    const frameName = metadata.name || 'Custom Photo Frame';
    this.ensureObjectId(group, frameName);
    group.set('isFrame' as any, true);
    group.set('isShape' as any, true);
    group.set('isCustomFrame' as any, true);
    group.set('frameShape' as any, metadata.shape || 'custom-svg');
    group.set('shapeType' as any, metadata.shape || 'custom-svg');
    group.set('sourceType' as any, 'frame');
    group.set('assetId' as any, metadata.assetId);
    group.set('provider' as any, metadata.provider || 'admin');
    group.set('photoFit' as any, photoFit);
    group.set('isCanvaPlaceholder' as any, isPlaceholder);
    group.set('originalSrc' as any, metadata.originalSrc || photoUrl);
    group.set('naturalWidth' as any, naturalWidth);
    group.set('naturalHeight' as any, naturalHeight);
    group.set('fileSizeBytes' as any, metadata.fileSizeBytes || 0);
    group.set('frameOverlayUrl' as any, overlayUrl);
    group.set('frameMaskUrl' as any, maskUrl);
    group.set('frameMaskType' as any, metadata.maskType || 'svg_mask');
    group.set('frameWidth' as any, frameWidth);
    group.set('frameHeight' as any, frameHeight);

    return group;
  }

  public addFrame(
    shapeType: FrameShapeType,
    customImageUrl?: string,
    options?: { left?: number; top?: number; width?: number; height?: number }
  ): void {
    if (!this.canvas) return;

    this.enableSelectionMode();

    const preset = FRAME_PRESETS.find((p) => p.shape === shapeType) || FRAME_PRESETS[0];
    const aspectRatio = preset.aspectRatio || 1.0;

    const canvasW = this.dimensions.widthPx || 1063;
    const canvasH = this.dimensions.heightPx || 591;

    const baseDim = Math.min(canvasW * 0.32, 280);
    const frameW = options?.width || (aspectRatio >= 1.0 ? baseDim * aspectRatio : baseDim);
    const frameH = options?.height || (aspectRatio < 1.0 ? baseDim / aspectRatio : baseDim);

    const defaultImg = customImageUrl || CANVA_FRAME_PLACEHOLDER_SVG;
    const isPlaceholder = !customImageUrl;

    FabricImage.fromURL(defaultImg, { crossOrigin: 'anonymous' })
      .then((img) => {
        if (!this.canvas) return;

        const natW = img.width || 400;
        const natH = img.height || 400;

        // Scale image to match calculated frame dimensions
        const scaleX = frameW / natW;
        const scaleY = frameH / natH;
        img.set({
          scaleX,
          scaleY,
        });

        // Generate normalized clip path for this shape matching image's unscaled natural dimensions
        const clipPath = createFrameClipPath(shapeType, natW, natH);

        img.set({
          clipPath,
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
        });

        img.set('isFrame' as any, true);
        img.set('frameShape' as any, shapeType);
        img.set('isCanvaPlaceholder' as any, isPlaceholder);
        img.set('originalSrc' as any, defaultImg);

        const frameName = `${preset.name} Frame`;
        this.ensureObjectId(img, frameName);

        this.canvas.add(img);

        if (options?.left !== undefined && options?.top !== undefined) {
          img.set({ left: options.left, top: options.top });
          img.setCoords();
        } else {
          this.centerObjectOnCanvas(img);
        }

        this.canvas.setActiveObject(img);
        this.canvas.requestRenderAll();
        this.notifyChange();
        this.notifySelection();
        this.notifyLayers();
      })
      .catch((err) => {
        console.error('Failed to create Canva Frame:', err);
      });
  }

  /**
   * Slots an image into an existing Frame object, preserving its shape mask, position, scale, and angle.
   * Accurately constrains the image to the frame bounds with cover or contain fit.
   */
  public async slotImageIntoFrame(
    frameObj: FabricObject,
    newImageUrl: string,
    metadata?: ImageMetadata
  ): Promise<FabricImage | null> {
    if (!this.canvas || !frameObj) return null;

    try {
      const customShapeUrl = frameObj.get('customShapeUrl' as any) as string;

      if (customShapeUrl) {
        const angle = frameObj.angle || 0;
        const targetScaledW = frameObj.getScaledWidth();
        const targetScaledH = frameObj.getScaledHeight();
        const centerPoint = frameObj.getCenterPoint();
        const objects = this.canvas.getObjects();
        const zIndex = objects.indexOf(frameObj);
        const safeImageUrl = await urlToSafeDataUrl(newImageUrl);
        const newImg = await FabricImage.fromURL(safeImageUrl, {
          crossOrigin: 'anonymous',
        });
        const [clipPath, shapeOutline] = await Promise.all([
          this.loadCustomShapeObject(customShapeUrl),
          this.loadCustomShapeObject(customShapeUrl),
        ]);

        const natW = metadata?.naturalWidth || newImg.width || 400;
        const natH = metadata?.naturalHeight || newImg.height || 400;
        const photoFit =
          metadata?.photoFit ||
          (frameObj.get('photoFit' as any) as 'cover' | 'contain') ||
          'cover';
        const scaleFit =
          photoFit === 'contain'
            ? Math.min(targetScaledW / natW, targetScaledH / natH)
            : Math.max(targetScaledW / natW, targetScaledH / natH);
        let visibleSourceWidth = natW;
        let visibleSourceHeight = natH;
        let cropX = 0;
        let cropY = 0;

        if (photoFit === 'cover') {
          visibleSourceWidth = Math.min(natW, targetScaledW / scaleFit);
          visibleSourceHeight = Math.min(natH, targetScaledH / scaleFit);
          cropX = Math.max(0, (natW - visibleSourceWidth) / 2);
          cropY = Math.max(0, (natH - visibleSourceHeight) / 2);
        }

        const clipW = targetScaledW / scaleFit;
        const clipH = targetScaledH / scaleFit;

        clipPath.set({
          originX: 'center',
          originY: 'center',
          left: 0,
          top: 0,
          angle: 0,
          scaleX: clipW / Math.max(clipPath.width || 1, 1),
          scaleY: clipH / Math.max(clipPath.height || 1, 1),
          absolutePositioned: false,
        });

        newImg.set({
          originX: 'center',
          originY: 'center',
          left: 0,
          top: 0,
          angle: 0,
          width: visibleSourceWidth,
          height: visibleSourceHeight,
          cropX,
          cropY,
          scaleX: scaleFit,
          scaleY: scaleFit,
          clipPath,
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
        });

        newImg.set('isFrame' as any, true);
        newImg.set('isShape' as any, true);
        newImg.set('frameShape' as any, 'custom-svg');
        newImg.set('shapeType' as any, 'custom-svg');
        newImg.set('sourceType' as any, 'shape');
        newImg.set('customShapeUrl' as any, customShapeUrl);
        newImg.set('assetId' as any, frameObj.get('assetId' as any));
        newImg.set('provider' as any, frameObj.get('provider' as any));
        newImg.set('photoFit' as any, photoFit);
        newImg.set('allowPhotoDrop' as any, true);
        newImg.set('isCanvaPlaceholder' as any, false);
        newImg.set('originalSrc' as any, metadata?.originalSrc || newImageUrl);
        newImg.set('naturalWidth' as any, natW);
        newImg.set('naturalHeight' as any, natH);
        newImg.set('fileSizeBytes' as any, metadata?.fileSizeBytes || 0);
        newImg.set('frameRole' as any, 'photo');

        shapeOutline.set({
          originX: 'center',
          originY: 'center',
          left: 0,
          top: 0,
          scaleX: targetScaledW / Math.max(shapeOutline.width || 1, 1),
          scaleY: targetScaledH / Math.max(shapeOutline.height || 1, 1),
          selectable: false,
          evented: false,
        });
        shapeOutline.set('frameRole' as any, 'shape-outline');
        this.applyShapeOutlineProperty(
          shapeOutline,
          'stroke',
          (frameObj.get('stroke' as any) as string) || 'transparent'
        );
        this.applyShapeOutlineProperty(
          shapeOutline,
          'strokeWidth',
          Number(frameObj.get('strokeWidth' as any)) || 0
        );
        const existingDash = frameObj.get('strokeDashArray' as any) as number[] | null;
        if (existingDash) {
          this.applyShapeOutlineProperty(shapeOutline, 'strokeDashArray', existingDash);
        }

        // Both children use the same rendered bounds. This keeps Fabric's
        // controls around the real shape instead of around the uncropped photo.
        if (photoFit === 'contain') {
          newImg.set({
            left: 0,
            top: 0,
          });
        } else {
          newImg.set({
            scaleX: targetScaledW / Math.max(visibleSourceWidth, 1),
            scaleY: targetScaledH / Math.max(visibleSourceHeight, 1),
          });
        }

        const photoShapeGroup = new Group([newImg, shapeOutline], {
          originX: 'center',
          originY: 'center',
          left: centerPoint.x,
          top: centerPoint.y,
          angle,
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
        });

        const objectName =
          (frameObj.get('name' as any) as string) || 'Custom Photo Shape';
        this.ensureObjectId(photoShapeGroup, objectName);
        photoShapeGroup.set('isFrame' as any, true);
        photoShapeGroup.set('isShape' as any, true);
        photoShapeGroup.set('isPhotoShapeGroup' as any, true);
        photoShapeGroup.set('frameShape' as any, 'custom-svg');
        photoShapeGroup.set('shapeType' as any, 'custom-svg');
        photoShapeGroup.set('sourceType' as any, 'shape');
        photoShapeGroup.set('customShapeUrl' as any, customShapeUrl);
        photoShapeGroup.set('assetId' as any, frameObj.get('assetId' as any));
        photoShapeGroup.set('provider' as any, frameObj.get('provider' as any));
        photoShapeGroup.set('photoFit' as any, photoFit);
        photoShapeGroup.set('allowPhotoDrop' as any, true);
        photoShapeGroup.set('isCanvaPlaceholder' as any, false);
        photoShapeGroup.set('originalSrc' as any, metadata?.originalSrc || newImageUrl);
        photoShapeGroup.set('naturalWidth' as any, natW);
        photoShapeGroup.set('naturalHeight' as any, natH);
        photoShapeGroup.set('fileSizeBytes' as any, metadata?.fileSizeBytes || 0);
        photoShapeGroup.set('stroke' as any, frameObj.get('stroke' as any) || 'transparent');
        photoShapeGroup.set('strokeWidth' as any, Number(frameObj.get('strokeWidth' as any)) || 0);
        photoShapeGroup.set('strokeDashArray' as any, existingDash || null);

        this.canvas.remove(frameObj);
        this.canvas.insertAt(
          zIndex >= 0 ? zIndex : this.canvas.getObjects().length,
          photoShapeGroup
        );
        photoShapeGroup.setCoords();
        this.canvas.setActiveObject(photoShapeGroup);
        this.canvas.requestRenderAll();
        this.notifyChange();
        this.notifySelection();
        this.notifyLayers();
        this.saveHistoryState();
        return photoShapeGroup as unknown as FabricImage;
      }

      if (Boolean(frameObj.get('isCustomFrame' as any))) {
        const overlayUrl = frameObj.get('frameOverlayUrl' as any) as string;
        const maskUrl = frameObj.get('frameMaskUrl' as any) as string;
        if (!overlayUrl || !maskUrl) {
          throw new Error('Custom frame is missing its overlay or mask URL.');
        }

        const objects = this.canvas.getObjects();
        const zIndex = objects.indexOf(frameObj);
        const frameWidth = Number(frameObj.get('frameWidth' as any)) || frameObj.width || 500;
        const frameHeight = Number(frameObj.get('frameHeight' as any)) || frameObj.height || 500;
        const photoFit = metadata?.photoFit ||
          (frameObj.get('photoFit' as any) as 'cover' | 'contain') ||
          'cover';
        const isPlaceholder = newImageUrl === CANVA_FRAME_PLACEHOLDER_SVG;

        const replacement = await this.createCustomFrameGroup(
          overlayUrl,
          maskUrl,
          newImageUrl,
          {
            ...metadata,
            name: (frameObj.get('name' as any) as string) || metadata?.name,
            assetId: frameObj.get('assetId' as any) as string,
            provider: frameObj.get('provider' as any) as string,
            maskType: frameObj.get('frameMaskType' as any) as string,
            shape: frameObj.get('frameShape' as any) as string,
            photoFit,
            originalSrc: metadata?.originalSrc || newImageUrl,
          },
          frameWidth,
          frameHeight,
          isPlaceholder
        );

        replacement.set({
          left: frameObj.left,
          top: frameObj.top,
          angle: frameObj.angle || 0,
          scaleX: frameObj.scaleX || 1,
          scaleY: frameObj.scaleY || 1,
          flipX: frameObj.flipX,
          flipY: frameObj.flipY,
          opacity: frameObj.opacity,
          visible: frameObj.visible,
        });
        replacement.set('id' as any, frameObj.get('id' as any));
        replacement.setCoords();

        this.canvas.remove(frameObj);
        this.canvas.insertAt(zIndex >= 0 ? zIndex : this.canvas.getObjects().length, replacement);
        this.canvas.setActiveObject(replacement);
        this.canvas.requestRenderAll();
        this.notifyChange();
        this.notifySelection();
        this.notifyLayers();
        this.saveHistoryState();

        return replacement as unknown as FabricImage;
      }

      const shapeType =
        (frameObj.get('frameShape' as any) as FrameShapeType) ||
        this.getShapeTypeFromObject(frameObj);
      const angle = frameObj.angle || 0;
      const targetScaledW = frameObj.getScaledWidth();
      const targetScaledH = frameObj.getScaledHeight();
      const centerPoint = frameObj.getCenterPoint();

      // Find z-index in canvas objects
      const objects = this.canvas.getObjects();
      const zIndex = objects.indexOf(frameObj);

      const safeUrl = await urlToSafeDataUrl(newImageUrl);
      const newImg = await FabricImage.fromURL(safeUrl, { crossOrigin: 'anonymous' });

      const natW = metadata?.naturalWidth || newImg.width || 400;
      const natH = metadata?.naturalHeight || newImg.height || 400;

      const photoFit = metadata?.photoFit || (frameObj.get('photoFit' as any) as 'cover' | 'contain') || 'cover';

      const scaleFit = photoFit === 'contain'
        ? Math.min(targetScaledW / natW, targetScaledH / natH)
        : Math.max(targetScaledW / natW, targetScaledH / natH);
      let visibleSourceWidth = natW;
      let visibleSourceHeight = natH;
      let cropX = 0;
      let cropY = 0;

      if (photoFit === 'cover') {
        visibleSourceWidth = Math.min(natW, targetScaledW / scaleFit);
        visibleSourceHeight = Math.min(natH, targetScaledH / scaleFit);
        cropX = Math.max(0, (natW - visibleSourceWidth) / 2);
        cropY = Math.max(0, (natH - visibleSourceHeight) / 2);
      }

      const clipW = targetScaledW / scaleFit;
      const clipH = targetScaledH / scaleFit;

      newImg.set({
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        angle: 0,
        width: visibleSourceWidth,
        height: visibleSourceHeight,
        cropX,
        cropY,
        scaleX: scaleFit,
        scaleY: scaleFit,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
      });

      // Generate matching centered clipPath matching exact frame dimensions
      const clipPath = createFrameClipPath(shapeType, clipW, clipH);
      newImg.set('clipPath', clipPath);
      newImg.set('isFrame' as any, true);
      newImg.set('frameShape' as any, shapeType);
      newImg.set('photoFit' as any, photoFit);
      newImg.set('isCanvaPlaceholder' as any, false);
      newImg.set('originalSrc' as any, metadata?.originalSrc || newImageUrl);
      newImg.set('naturalWidth' as any, natW);
      newImg.set('naturalHeight' as any, natH);
      newImg.set('fileSizeBytes' as any, metadata?.fileSizeBytes || 0);
      newImg.set('frameRole' as any, 'photo');

      const shapeOutline = createFrameClipPath(shapeType, targetScaledW, targetScaledH);
      shapeOutline.set({
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });
      shapeOutline.set('frameRole' as any, 'shape-outline');
      this.applyShapeOutlineProperty(
        shapeOutline,
        'stroke',
        (frameObj.get('stroke' as any) as string) || 'transparent'
      );
      this.applyShapeOutlineProperty(
        shapeOutline,
        'strokeWidth',
        Number(frameObj.get('strokeWidth' as any)) || 0
      );
      const existingDash = frameObj.get('strokeDashArray' as any) as number[] | null;
      if (existingDash) {
        this.applyShapeOutlineProperty(shapeOutline, 'strokeDashArray', existingDash);
      }

      const photoShapeGroup = new Group([newImg, shapeOutline], {
        originX: 'center',
        originY: 'center',
        left: centerPoint.x,
        top: centerPoint.y,
        angle,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
      });

      const shapeName = `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} Photo Shape`;
      this.ensureObjectId(photoShapeGroup, shapeName);
      photoShapeGroup.set('isFrame' as any, true);
      photoShapeGroup.set('isShape' as any, true);
      photoShapeGroup.set('isPhotoShapeGroup' as any, true);
      photoShapeGroup.set('frameShape' as any, shapeType);
      photoShapeGroup.set('shapeType' as any, shapeType);
      photoShapeGroup.set('sourceType' as any, 'shape');
      photoShapeGroup.set('photoFit' as any, photoFit);
      photoShapeGroup.set('isCanvaPlaceholder' as any, false);
      photoShapeGroup.set('originalSrc' as any, metadata?.originalSrc || newImageUrl);
      photoShapeGroup.set('naturalWidth' as any, natW);
      photoShapeGroup.set('naturalHeight' as any, natH);
      photoShapeGroup.set('fileSizeBytes' as any, metadata?.fileSizeBytes || 0);
      photoShapeGroup.set('stroke' as any, frameObj.get('stroke' as any) || 'transparent');
      photoShapeGroup.set('strokeWidth' as any, Number(frameObj.get('strokeWidth' as any)) || 0);
      photoShapeGroup.set('strokeDashArray' as any, existingDash || null);

      // Replace old frame object in canvas
      this.canvas.remove(frameObj);
      this.canvas.insertAt(
        zIndex >= 0 ? zIndex : this.canvas.getObjects().length,
        photoShapeGroup
      );
      photoShapeGroup.setCoords();

      this.canvas.setActiveObject(photoShapeGroup);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
      this.saveHistoryState();

      return photoShapeGroup as unknown as FabricImage;
    } catch (err) {
      console.error('Failed to slot image into Canva Frame:', err);
      return null;
    }
  }

  /**
   * Toggles the photo fit ('cover' vs 'contain') of the active frame or target frame.
   */
  public async toggleActiveFrameFit(targetFrame?: FabricObject): Promise<void> {
    if (!this.canvas) return;

    const frame = targetFrame || this.canvas.getActiveObject();
    if (!frame || !frame.get('isFrame' as any)) return;

    const currentFit = (frame.get('photoFit' as any) as 'cover' | 'contain') || 'cover';
    const nextFit = currentFit === 'cover' ? 'contain' : 'cover';
    const currentSrc = (frame.get('originalSrc' as any) as string) || (frame as any).getSrc?.();
    if (!currentSrc) return;

    await this.slotImageIntoFrame(frame, currentSrc, {
      photoFit: nextFit,
      naturalWidth: Number(frame.get('naturalWidth' as any)) || undefined,
      naturalHeight: Number(frame.get('naturalHeight' as any)) || undefined,
    });
  }

  /**
   * Detaches the photo from a Frame, extracting it as a standalone image and resetting the frame to the Canva landscape placeholder.
   */
  public async detachImageFromFrame(targetFrame?: FabricObject): Promise<void> {
    if (!this.canvas) return;

    const frame = targetFrame || this.canvas.getActiveObject();
    if (!frame || !frame.get('isFrame' as any)) return;

    const isPlaceholder = Boolean(frame.get('isCanvaPlaceholder' as any));
    const currentSrc = (frame.get('originalSrc' as any) as string) || (frame as any).getSrc?.();

    // If there is an actual user image in the frame, extract it as an independent image layer
    if (!isPlaceholder && currentSrc && currentSrc !== CANVA_FRAME_PLACEHOLDER_SVG) {
      const left = (frame.left || 100) + 30;
      const top = (frame.top || 100) + 30;
      await this.addImageFromUrl(currentSrc, undefined, { left, top });
    }

    // Reset frame back to Canva landscape placeholder
    await this.slotImageIntoFrame(frame, CANVA_FRAME_PLACEHOLDER_SVG);
    const active = this.canvas.getActiveObject();
    if (active) {
      active.set('isCanvaPlaceholder' as any, true);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
    }
  }

  /**
   * Clears the image in a Frame, restoring the Canva landscape placeholder artwork.
   */
  public async clearFrameImage(targetFrame?: FabricObject): Promise<void> {
    if (!this.canvas) return;

    const frame = targetFrame || this.canvas.getActiveObject();
    if (!frame || !frame.get('isFrame' as any)) return;

    await this.slotImageIntoFrame(frame, CANVA_FRAME_PLACEHOLDER_SVG);
    const active = this.canvas.getActiveObject();
    if (active) {
      active.set('isCanvaPlaceholder' as any, true);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
    }
  }

  /**
   * Identifies whether a canvas object is a shape or frame capable of masking/fitting an image.
   */
  public isShapeObject(obj?: FabricObject | null): boolean {
    if (!obj) return false;
    if (obj.get('isGuide' as any) || (obj as any).excludeFromExport) return false;
    if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') return false;

    // Canva frames
    if (obj.get('isFrame' as any)) return true;
    // Explicit shape flag
    if (obj.get('isShape' as any)) return true;

    // Admin shapes & frames
    const sourceType = obj.get('sourceType' as any) || (obj as any).metadata?.sourceType;
    if (sourceType === 'shape' || sourceType === 'frame') return true;

    const type = (obj.type || '').toLowerCase();
    if (type === 'circle' || type === 'triangle' || type === 'polygon' || type === 'rect' || type === 'path') {
      // Must not be a raster image
      if (!obj.get('isImage' as any) && !(obj as any).getSrc) {
        return true;
      }
    }

    return false;
  }

  /**
   * Identifies whether a canvas object is an image (and not an empty placeholder frame).
   */
  public isImageObject(obj?: FabricObject | null): boolean {
    if (!obj) return false;
    if (obj.get('isGuide' as any) || (obj as any).excludeFromExport) return false;
    if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') return false;

    // Placeholder frames are shape containers waiting for photos
    if (obj.get('isCanvaPlaceholder' as any)) return false;

    const type = (obj.type || '').toLowerCase();
    if (type === 'image' || obj instanceof FabricImage || obj.get('isImage' as any)) {
      return true;
    }

    const src = obj.get('originalSrc' as any) || (obj as any).getSrc?.() || (obj as any)._element?.src;
    if (src && typeof src === 'string' && src.length > 0 && !obj.get('isFrame' as any)) {
      return true;
    }

    return false;
  }

  /**
   * Derives a FrameShapeType from any shape object (basic shape, polygon, or frame).
   */
  public getShapeTypeFromObject(obj: FabricObject): FrameShapeType {
    const metaShape =
      (obj as any).metadata?.shape ||
      (obj as any).metadata?.frame?.shape ||
      obj.get('metadata' as any)?.shape ||
      obj.get('metadata' as any)?.frame?.shape;

    const explicit =
      obj.get('frameShape' as any) ||
      obj.get('shapeType' as any) ||
      metaShape;

    if (explicit && typeof explicit === 'string') {
      const clean = explicit.toLowerCase().trim();
      if (clean === 'rect' || clean === 'rectangle') return 'rounded-rect';
      return clean as FrameShapeType;
    }

    const type = (obj.type || '').toLowerCase();
    if (type === 'circle') return 'circle';
    if (type === 'triangle') return 'triangle';
    if (type === 'rect') {
      const rect = obj as Rect;
      if (rect.rx && rect.rx > 0) return 'rounded-rect';
      const w = obj.getScaledWidth();
      const h = obj.getScaledHeight();
      return Math.abs(w - h) < 10 ? 'square' : 'rounded-rect';
    }
    if (type === 'polygon') {
      const points = (obj as Polygon).points || [];
      if (points.length === 10) return 'star';
      if (points.length === 6) return 'hexagon';
      if (points.length === 3) return 'triangle';
      return 'star';
    }

    return 'circle';
  }

  /**
   * Finds an overlapping candidate target (Image for a moving Shape, or Shape for a moving Image).
   */
  public findOverlappingTarget(movingObj: FabricObject): FabricObject | null {
    if (!this.canvas || !movingObj) return null;

    const isMovingShape = this.isShapeObject(movingObj);
    const isMovingImage = this.isImageObject(movingObj);

    if (!isMovingShape && !isMovingImage) return null;

    const objects = this.canvas.getObjects().slice().reverse();
    const movingCenter = movingObj.getCenterPoint();
    const movingBounds = movingObj.getBoundingRect();

    for (const other of objects) {
      if (other === movingObj) continue;
      if (other.visible === false || (other as any).excludeFromExport || other.get('isGuide' as any)) continue;

      // Moving Shape searches for Images, Moving Image searches for Shapes
      const otherIsTarget = isMovingShape ? this.isImageObject(other) : this.isShapeObject(other);
      if (!otherIsTarget) continue;

      const otherCenter = other.getCenterPoint();
      const otherBounds = other.getBoundingRect();

      // Check center inside bounds
      const movingInOther =
        movingCenter.x >= otherBounds.left &&
        movingCenter.x <= otherBounds.left + otherBounds.width &&
        movingCenter.y >= otherBounds.top &&
        movingCenter.y <= otherBounds.top + otherBounds.height;

      const otherInMoving =
        otherCenter.x >= movingBounds.left &&
        otherCenter.x <= movingBounds.left + movingBounds.width &&
        otherCenter.y >= movingBounds.top &&
        otherCenter.y <= movingBounds.top + movingBounds.height;

      if (movingInOther || otherInMoving) {
        return other;
      }

      // Check polygon containsPoint
      if (
        other.containsPoint(new Point(movingCenter.x, movingCenter.y)) ||
        movingObj.containsPoint(new Point(otherCenter.x, otherCenter.y))
      ) {
        return other;
      }

      // Check bounding box intersection area >= 25% of smaller object
      const overlapX = Math.max(
        0,
        Math.min(movingBounds.left + movingBounds.width, otherBounds.left + otherBounds.width) -
        Math.max(movingBounds.left, otherBounds.left)
      );
      const overlapY = Math.max(
        0,
        Math.min(movingBounds.top + movingBounds.height, otherBounds.top + otherBounds.height) -
        Math.max(movingBounds.top, otherBounds.top)
      );
      const overlapArea = overlapX * overlapY;
      const minArea = Math.min(movingBounds.width * movingBounds.height, otherBounds.width * otherBounds.height);

      if (minArea > 0 && overlapArea / minArea >= 0.25) {
        return other;
      }
    }

    return null;
  }

  /**
   * Handles visual hover feedback when a shape is dragged over an image, or vice versa.
   */
  public handleShapeImageHover(movingObj: FabricObject): void {
    if (!this.canvas || this.isProcessingShapeFit) return;

    const target = this.findOverlappingTarget(movingObj);

    if (target) {
      if (target !== this.currentHoverFitTarget) {
        this.clearHoverFitHighlight();
        this.currentHoverFitTarget = target;
        this.origHoverTargetProps = {
          stroke: target.stroke,
          strokeWidth: target.strokeWidth,
          strokeDashArray: target.strokeDashArray,
        };

        // Canva-style purple dashed glowing border to signify "Drop here to fit image into shape"
        target.set({
          stroke: '#8b3dff',
          strokeWidth: 3,
          strokeDashArray: [6, 4],
        });
        this.canvas.requestRenderAll();
      }
    } else {
      if (this.currentHoverFitTarget) {
        this.clearHoverFitHighlight();
      }
    }
  }

  /**
   * Clears any active hover fitting visual feedback.
   */
  public clearHoverFitHighlight(): void {
    if (!this.canvas || !this.currentHoverFitTarget) return;

    if (this.origHoverTargetProps) {
      this.currentHoverFitTarget.set({
        stroke: this.origHoverTargetProps.stroke,
        strokeWidth: this.origHoverTargetProps.strokeWidth,
        strokeDashArray: this.origHoverTargetProps.strokeDashArray,
      });
    }

    this.currentHoverFitTarget = null;
    this.origHoverTargetProps = null;
    this.canvas.requestRenderAll();
  }

  /**
   * Automatically fits an image into a shape when released on drop.
   */
  public async handleShapeImageDrop(movingObj: FabricObject): Promise<boolean> {
    if (this.isProcessingShapeFit || !this.canvas || !movingObj) {
      this.clearHoverFitHighlight();
      return false;
    }

    const target = this.currentHoverFitTarget;
    this.clearHoverFitHighlight();

    if (!target) return false;

    this.isProcessingShapeFit = true;
    try {
      const isMovingShape = this.isShapeObject(movingObj);
      const isMovingImage = this.isImageObject(movingObj);
      const isTargetShape = this.isShapeObject(target);
      const isTargetImage = this.isImageObject(target);

      if (isMovingShape && isTargetImage) {
        // User dragged the shape over the image!
        await this.fitImageIntoShape(movingObj, target);
        return true;
      } else if (isMovingImage && isTargetShape) {
        // User dragged the image over the shape!
        await this.fitImageIntoShape(target, movingObj);
        return true;
      }
    } catch (err) {
      console.error('Failed to fit image into shape on drop:', err);
    } finally {
      this.isProcessingShapeFit = false;
    }

    return false;
  }

  /**
   * Fits an image into a shape (or frame), positioning and sizing the image to fit
   * the shape's bounds with clipping/masking, and removing the loose image from canvas.
   */
  public async fitImageIntoShape(
    shapeObj: FabricObject,
    imageObjOrUrl: FabricObject | string,
    metadata?: ImageMetadata
  ): Promise<FabricImage | null> {
    if (!this.canvas || !shapeObj) return null;

    let imageUrl: string = '';
    let imageMetadata: ImageMetadata | undefined = metadata;
    let imageObjToRemove: FabricObject | null = null;

    if (typeof imageObjOrUrl === 'string') {
      imageUrl = imageObjOrUrl;
    } else if (imageObjOrUrl && typeof imageObjOrUrl === 'object') {
      imageObjToRemove = imageObjOrUrl;
      imageUrl =
        imageObjOrUrl.get('originalSrc' as any) ||
        (imageObjOrUrl as any).getSrc?.() ||
        (imageObjOrUrl as any)._element?.currentSrc ||
        (imageObjOrUrl as any)._element?.src ||
        '';
      imageMetadata = {
        naturalWidth: Number(imageObjOrUrl.get('naturalWidth' as any)) || (imageObjOrUrl as any).width || undefined,
        naturalHeight: Number(imageObjOrUrl.get('naturalHeight' as any)) || (imageObjOrUrl as any).height || undefined,
        originalSrc: imageUrl,
        name: imageObjOrUrl.get('name' as any) || `${shapeObj.get('name') || 'Shape'} Image`,
        ...(metadata || {}),
      };
    }

    if (!imageUrl) return null;

    const shapeType = this.getShapeTypeFromObject(shapeObj);
    shapeObj.set('frameShape' as any, shapeType);
    shapeObj.set('isFrame' as any, true);

    const slotted = await this.slotImageIntoFrame(shapeObj, imageUrl, imageMetadata);

    if (slotted && imageObjToRemove && imageObjToRemove !== shapeObj) {
      this.canvas.remove(imageObjToRemove);
      this.canvas.requestRenderAll();
      this.notifyLayers();
      this.saveHistoryState();
    }

    return slotted;
  }

  /**
   * Checks if a point on canvas (pointer { x, y }) lies within any Frame or Shape object.
   */
  public getFrameUnderPoint(point: { x: number; y: number }): FabricObject | null {
    if (!this.canvas) return null;

    const objects = this.canvas.getObjects().slice().reverse();
    for (const obj of objects) {
      if ((obj.get('isFrame' as any) || this.isShapeObject(obj)) && obj.visible !== false) {
        if (obj.containsPoint(new Point(point.x, point.y))) {
          return obj;
        }
      }
    }
    return null;
  }

  // --- Image Handling & Non-Destructive Crop ---

  public async addImageFromUrl(
    url: string,
    metadata?: ImageMetadata,
    options?: Partial<FabricObject> & { skipFrameSlotting?: boolean }
  ): Promise<FabricImage | null> {
    if (!this.canvas) return null;

    // Canva Frame & Shape automatic slotting:
    // If a shape or frame is currently selected, or if an empty placeholder frame exists on the canvas,
    // slot this image directly into the shape/frame so it catches its size and shape mask!
    if (!options?.skipFrameSlotting && !(options as any)?.isFrame) {
      let targetFrame: FabricObject | null | undefined = this.canvas.getActiveObject();
      if (!targetFrame || (!targetFrame.get('isFrame' as any) && !this.isShapeObject(targetFrame))) {
        const objects = this.canvas.getObjects();
        targetFrame = objects.find(
          (obj) => (obj.get('isFrame' as any) && Boolean(obj.get('isCanvaPlaceholder' as any)))
        );
      }

      if (targetFrame && (targetFrame.get('isFrame' as any) || this.isShapeObject(targetFrame))) {
        return this.fitImageIntoShape(targetFrame, url, metadata);
      }
    }

    // Adding an asset always returns the editor to the pointer/select tool.
    this.enableSelectionMode();

    try {
      let safeUrl = await urlToSafeDataUrl(url);

      // Normalize SVG data/URL to prevent 300x150 default fallback or viewBox clipping
      let svgNormWidth: number | undefined;
      let svgNormHeight: number | undefined;

      if (isSvg(url) || isSvg(safeUrl)) {
        try {
          const norm = await normalizeSvgUrl(safeUrl);
          safeUrl = norm.dataUrl;
          svgNormWidth = norm.width;
          svgNormHeight = norm.height;
        } catch (normErr) {
          console.warn('SVG normalization in addImageFromUrl failed:', normErr);
        }
      }

      let img: FabricImage;
      try {
        img = await FabricImage.fromURL(safeUrl, { crossOrigin: 'anonymous' });
      } catch {
        img = await new Promise<FabricImage>((resolve, reject) => {
          const el = new Image();
          el.crossOrigin = 'anonymous';
          el.onload = () => resolve(new FabricImage(el));
          el.onerror = () => {
            reject(
              new Error(
                `Image cannot be loaded safely for export: ${safeUrl}`
              )
            );
          };
          el.src = safeUrl;
        });
      }

      // If SVG normalization provided dimensions, ensure FabricImage bounds match
      if (svgNormWidth && svgNormHeight) {
        img.set({
          width: svgNormWidth,
          height: svgNormHeight,
        });
      }

      const canvasW = this.dimensions.widthPx || 1063;
      const canvasH = this.dimensions.heightPx || 591;

      const maxDisplayWidth = canvasW * 0.6;
      const maxDisplayHeight = canvasH * 0.6;

      const naturalW = metadata?.naturalWidth || svgNormWidth || img.width || 400;
      const naturalH = metadata?.naturalHeight || svgNormHeight || img.height || 300;

      const scale = Math.min(
        maxDisplayWidth / naturalW,
        maxDisplayHeight / naturalH,
        1.0
      );

      img.set({
        scaleX: scale,
        scaleY: scale,
        lockUniScaling: true,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockMovementX: false,
        lockMovementY: false,
        lockRotation: false,
        lockScalingX: false,
        lockScalingY: false,
        hoverCursor: 'move',
        moveCursor: 'move',
        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
      });

      img.set('originalSrc' as any, metadata?.originalSrc || url);
      img.set('naturalWidth' as any, naturalW);
      img.set('naturalHeight' as any, naturalH);
      img.set('fileSizeBytes' as any, metadata?.fileSizeBytes || 0);
      this.ensureObjectId(img, metadata?.name || 'Image Layer');

      this.canvas.add(img);

      if (options?.left !== undefined || options?.top !== undefined) {
        if (options?.left !== undefined) img.set('left', options.left);
        if (options?.top !== undefined) img.set('top', options.top);
        img.setCoords();
      } else {
        this.centerObjectOnCanvas(img);
      }

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
      let safeUrl = await urlToSafeDataUrl(newUrl);
      if (isSvg(newUrl) || isSvg(safeUrl)) {
        try {
          const norm = await normalizeSvgUrl(safeUrl);
          safeUrl = norm.dataUrl;
        } catch {
          // ignore
        }
      }
      const newImg = await FabricImage.fromURL(safeUrl, { crossOrigin: 'anonymous' });

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
        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
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

  public async restoreOriginalImage(): Promise<void> {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof FabricImage)) return;

    const originalUrl = active.get('originalUrl' as any);
    if (!originalUrl) return;

    try {
      const newImg = await FabricImage.fromURL(originalUrl, { crossOrigin: 'anonymous' });

      const displayedWidth = active.getScaledWidth();
      const displayedHeight = active.getScaledHeight();

      const newScaleX = displayedWidth / newImg.width!;
      const newScaleY = displayedHeight / newImg.height!;

      const prevIndex = this.canvas.getObjects().indexOf(active);

      this.canvas.remove(active);

      newImg.set({
        left: active.left,
        top: active.top,
        angle: active.angle,
        flipX: active.flipX,
        flipY: active.flipY,
        opacity: active.opacity,
        originX: active.originX,
        originY: active.originY,
        scaleX: newScaleX,
        scaleY: newScaleY,
        cropX: active.cropX,
        cropY: active.cropY,
        selectable: active.selectable,
        evented: active.evented,
        visible: active.visible,
        skewX: active.skewX,
        skewY: active.skewY,
        clipPath: active.clipPath,
      });

      // Copy custom properties
      newImg.set('id' as any, active.get('id' as any));
      newImg.set('name' as any, active.get('name' as any));
      newImg.set('assetId' as any, active.get('assetId' as any));
      newImg.set('provider' as any, active.get('provider' as any));
      newImg.set('providerAssetId' as any, active.get('providerAssetId' as any));
      newImg.set('sourceType' as any, active.get('sourceType' as any));

      // Restore original metadata
      newImg.set('originalUrl' as any, originalUrl);
      newImg.set('originalFileId' as any, active.get('originalFileId' as any));

      // Clear processed flags
      newImg.set('backgroundRemoved' as any, false);
      newImg.set('processedFileId' as any, null);
      newImg.set('processedUrl' as any, null);
      newImg.set('processingType' as any, null);

      this.canvas.insertAt(prevIndex, newImg);
      newImg.setCoords();

      this.canvas.setActiveObject(newImg);
      this.canvas.requestRenderAll();

      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
      this.scheduleHistorySave();
    } catch (e) {
      console.error('Failed to restore original image', e);
    }
  }

  public async removeBackgroundFromSelectedImage(
    onProgress?: (progress: { stage: string; message: string; progress?: number }) => void
  ): Promise<void> {
    if (!this.canvas) return;

    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof FabricImage)) {
      throw new Error('Please select an image first.');
    }

    // Reject SVGs
    const src = active.getSrc();
    if (src && src.toLowerCase().includes('.svg')) {
      throw new Error('Background removal is not supported for SVGs.');
    }

    // Preserve original URL if this is the first processing
    const existingOriginalUrl = active.get('originalUrl' as any);
    if (!existingOriginalUrl) {
      active.set('originalUrl' as any, src);
    }

    const activeId = active.get('id' as any);

    // Dynamically import the background removal service
    const { removeImageBackground } = await import('@/services/backgroundRemoval');

    let bgResult: any;
    try {
      bgResult = await removeImageBackground(src, onProgress as any);
    } catch (err: any) {
      throw err;
    }

    // Verify object still exists and is selected
    const currentActive = this.canvas.getActiveObject();
    if (!currentActive || currentActive.get('id' as any) !== activeId) {
      return;
    }

    onProgress?.({ stage: 'complete', message: 'Updating canvas...' });

    const resultUrl = bgResult.fileUrl || bgResult.url;
    const newImg = await FabricImage.fromURL(resultUrl, { crossOrigin: 'anonymous' });

    const displayedWidth = active.getScaledWidth();
    const displayedHeight = active.getScaledHeight();

    const newScaleX = displayedWidth / newImg.width!;
    const newScaleY = displayedHeight / newImg.height!;

    const prevIndex = this.canvas.getObjects().indexOf(active);
    this.canvas.remove(active);

    newImg.set({
      left: active.left,
      top: active.top,
      angle: active.angle,
      flipX: active.flipX,
      flipY: active.flipY,
      opacity: active.opacity,
      originX: active.originX,
      originY: active.originY,
      scaleX: newScaleX,
      scaleY: newScaleY,
      cropX: active.cropX,
      cropY: active.cropY,
      selectable: active.selectable,
      evented: active.evented,
      visible: active.visible,
      skewX: active.skewX,
      skewY: active.skewY,
      clipPath: active.clipPath,
    });

    // Preserve all custom properties
    newImg.set('id' as any, active.get('id' as any));
    newImg.set('name' as any, active.get('name' as any));
    newImg.set('assetId' as any, active.get('assetId' as any));
    newImg.set('provider' as any, active.get('provider' as any));
    newImg.set('providerAssetId' as any, active.get('providerAssetId' as any));
    newImg.set('sourceType' as any, active.get('sourceType' as any));

    // Save metadata
    newImg.set('originalUrl' as any, active.get('originalUrl' as any) || src);
    newImg.set('originalFileId' as any, active.get('originalFileId' as any));

    newImg.set('backgroundRemoved' as any, true);
    newImg.set('processedFileId' as any, bgResult.filePath || bgResult.url);
    newImg.set('processedUrl' as any, resultUrl);
    newImg.set('processingType' as any, 'remove_background');

    this.canvas.insertAt(prevIndex, newImg);
    newImg.setCoords();

    this.canvas.setActiveObject(newImg);
    this.canvas.requestRenderAll();

    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
    this.scheduleHistorySave();

    onProgress?.({ stage: 'complete', message: 'Background removed' });
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
        const isText = this.isTextObject(obj);
        const textPreview = isText ? (obj as Textbox).text?.substring(0, 24) : undefined;

        return {
          id: obj.get('id' as any) as string,
          name:
            (obj.get('name' as any) as string) ||
            `${type.charAt(0).toUpperCase() + type.slice(1)}`,
          type,
          isLocked: obj.get('isLocked' as any) === true,
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
      this.restoreObjectInteractivity(obj);
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
      obj.set('isLocked' as any, isLocked);
      obj.set({
        lockMovementX: isLocked,
        lockMovementY: isLocked,
        lockRotation: isLocked,
        lockScalingX: isLocked,
        lockScalingY: isLocked,
        hasControls: !isLocked,
        hoverCursor: isLocked ? 'default' : 'move',
        moveCursor: isLocked ? 'default' : 'move',
        selectable: true,
        evented: true,
      });
      obj.setCoords();
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

  /** Returns the first real leaf object for displaying a group's current style. */
  private getFirstGroupLeaf(root: FabricObject): FabricObject | null {
    if (root.get('isPhotoShapeGroup' as any) && root instanceof Group) {
      const outline = root
        .getObjects()
        .find((object) => object.get('frameRole' as any) === 'shape-outline');
      if (outline) {
        return this.getFirstGroupLeaf(outline);
      }
    }

    const stack: FabricObject[] = [root];

    while (stack.length > 0) {
      const current = stack.shift();
      if (!current) continue;

      if (current instanceof Group || current instanceof ActiveSelection) {
        stack.unshift(...current.getObjects());
        continue;
      }

      if (!this.isNonInteractiveObject(current)) return current;
    }

    return null;
  }

  /**
   * Applies visual properties to the leaf objects of nested Groups and active
   * multi-selections. Fabric Group wrappers do not repaint child fill/stroke.
   * This method deliberately performs only one final canvas render.
   */
  private applyPropertyToGroupChildren(
    root: FabricObject,
    prop: keyof SelectedObjectState,
    value: SelectedObjectState[keyof SelectedObjectState]
  ): void {
    const shapeBorderProperties = new Set<keyof SelectedObjectState>([
      'stroke',
      'strokeWidth',
      'strokeDashArray',
      'strokeLineCap',
      'strokeLineJoin',
    ]);

    // A filled photo shape contains two children: the clipped photo and a
    // transparent SVG outline. Border controls must style only that outline;
    // applying a stroke to the photo itself always produces a rectangle.
    if (
      root instanceof Group &&
      root.get('isPhotoShapeGroup' as any) &&
      shapeBorderProperties.has(prop)
    ) {
      const outline = root
        .getObjects()
        .find((object) => object.get('frameRole' as any) === 'shape-outline');

      if (outline) {
        this.applyShapeOutlineProperty(outline, prop, value);
      }
      root.set(prop as any, value as any);
      root.set('dirty', true);
      return;
    }

    const stack: FabricObject[] =
      root instanceof Group || root instanceof ActiveSelection
        ? [...root.getObjects()]
        : [root];

    while (stack.length > 0) {
      const obj = stack.pop();
      if (!obj || this.isNonInteractiveObject(obj)) continue;

      if (obj instanceof Group || obj instanceof ActiveSelection) {
        stack.push(...obj.getObjects());
        obj.set('dirty', true);
        continue;
      }

      const isImage = obj instanceof FabricImage || obj.type === 'image';
      const isText = this.isTextObject(obj);

      if (prop === 'fill') {
        if (!isImage) obj.set('fill', value as string);
      } else if (prop === 'stroke') {
        obj.set({ stroke: value as string, strokeUniform: true, paintFirst: 'fill' });
      } else if (prop === 'strokeWidth') {
        obj.set({
          strokeWidth: Math.max(0, Number(value) || 0),
          strokeUniform: true,
          paintFirst: 'fill',
        });
      } else if (prop === 'strokeDashArray') {
        obj.set('strokeDashArray', value ? (value as number[]) : null);
      } else if (prop === 'strokeLineCap') {
        obj.set('strokeLineCap', value as 'round' | 'square' | 'butt');
      } else if (prop === 'strokeLineJoin') {
        obj.set('strokeLineJoin', value as 'round' | 'bevel' | 'miter');
      } else if (prop === 'rx' || prop === 'ry') {
        const requestedRadius = Math.max(0, Number(value) || 0);

        if (isImage) {
          const width = Math.max(obj.width || 1, 1);
          const height = Math.max(obj.height || 1, 1);
          const objectScale = typeof (obj as any).getObjectScaling === 'function'
            ? (obj as any).getObjectScaling()
            : { x: obj.scaleX || 1, y: obj.scaleY || 1 };
          const scaleX = Math.max(Math.abs(objectScale.x || 1), 0.001);
          const scaleY = Math.max(Math.abs(objectScale.y || 1), 0.001);
          const maxRenderedRadius = Math.min(width * scaleX, height * scaleY) / 2;
          const renderedRadius = Math.min(requestedRadius, maxRenderedRadius);

          (obj as any).rx = renderedRadius;
          (obj as any).ry = renderedRadius;
          obj.clipPath = renderedRadius > 0
            ? new Rect({
              width,
              height,
              rx: renderedRadius / scaleX,
              ry: renderedRadius / scaleY,
              originX: 'center',
              originY: 'center',
            })
            : undefined;
        } else if (obj instanceof Rect || obj.type === 'rect') {
          const maxRadius = Math.min(obj.width || 1, obj.height || 1) / 2;
          const radius = Math.min(requestedRadius, maxRadius);
          obj.set({ rx: radius, ry: radius } as any);
        }
      } else if (isText && prop === 'fontFamily') {
        (obj as Textbox | IText).set('fontFamily', String(value));
      } else if (isText && prop === 'fontSize') {
        const textObject = obj as Textbox | IText;
        const nextFontSize = Math.max(1, Number(value) || 1);
        textObject.set({ fontSize: nextFontSize, objectCaching: false, dirty: true });
        textObject.set(
          'fontSizePt' as any,
          (nextFontSize * 72) /
          Math.max(72, Number(this.dimensions.dpi) || 96)
        );
      } else if (isText && prop === 'fontWeight') {
        (obj as Textbox | IText).set('fontWeight', value as string | number);
      } else if (isText && prop === 'fontStyle') {
        (obj as Textbox | IText).set('fontStyle', String(value));
      } else if (isText && prop === 'underline') {
        (obj as Textbox | IText).set('underline', Boolean(value));
      } else if (isText && prop === 'linethrough') {
        (obj as Textbox | IText).set('linethrough', Boolean(value));
      } else if (isText && prop === 'textAlign') {
        (obj as Textbox | IText).set(
          'textAlign',
          value as 'left' | 'center' | 'right' | 'justify'
        );
      } else if (isText && prop === 'charSpacing') {
        (obj as Textbox | IText).set('charSpacing', Number(value));
      } else if (isText && prop === 'lineHeight') {
        (obj as Textbox | IText).set('lineHeight', Number(value));
      }

      obj.set('dirty', true);
      obj.setCoords();
    }
  }

  private applyShapeOutlineProperty(
    root: FabricObject,
    prop: keyof SelectedObjectState,
    value: SelectedObjectState[keyof SelectedObjectState]
  ): void {
    const stack: FabricObject[] =
      root instanceof Group ? [...root.getObjects()] : [root];

    while (stack.length > 0) {
      const object = stack.pop();
      if (!object) continue;

      if (object instanceof Group) {
        stack.push(...object.getObjects());
        object.set('dirty', true);
        continue;
      }

      object.set({ fill: 'transparent', paintFirst: 'stroke', strokeUniform: true });

      if (prop === 'stroke') {
        object.set('stroke', String(value || 'transparent'));
      } else if (prop === 'strokeWidth') {
        object.set('strokeWidth', Math.max(0, Number(value) || 0));
      } else if (prop === 'strokeDashArray') {
        object.set('strokeDashArray', value ? (value as number[]) : null);
      } else if (prop === 'strokeLineCap') {
        object.set('strokeLineCap', value as 'round' | 'square' | 'butt');
      } else if (prop === 'strokeLineJoin') {
        object.set('strokeLineJoin', value as 'round' | 'bevel' | 'miter');
      }

      object.set('dirty', true);
      object.setCoords();
    }

    root.set('dirty', true);
  }

  public updateSelectedProperty<K extends keyof SelectedObjectState>(
    prop: K,
    value: SelectedObjectState[K]
  ): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    const isText = this.isTextObject(active);
    const isImage = active instanceof FabricImage || active.type === 'image';

    const isGroupedSelection = active instanceof Group || active instanceof ActiveSelection;

    if (isGroupedSelection && GROUP_RECURSIVE_PROPERTIES.has(prop)) {
      this.applyPropertyToGroupChildren(
        active,
        prop,
        value as SelectedObjectState[keyof SelectedObjectState]
      );

      // Summary properties keep toolbar controls synchronized with the group.
      active.set(prop as any, value as any);
      if (prop === 'rx' || prop === 'ry') {
        active.set({ rx: Number(value) || 0, ry: Number(value) || 0 } as any);
      }

      active.set('dirty', true);
      active.setCoords();
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
      return;
    }

    if (prop === 'left') active.set('left', value as number);
    else if (prop === 'top') active.set('top', value as number);
    else if (prop === 'width') {
      const w = Math.max(Number(value), 1);
      if (this.isTextObject(active) && active.type === 'textbox') {
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
    else if (prop === 'stroke') {
      active.set('stroke', value as string);
      active.set('strokeUniform', true);
      active.set('paintFirst', 'fill');
    } else if (prop === 'strokeWidth') {
      active.set('strokeWidth', value as number);
      active.set('strokeUniform', true);
      active.set('paintFirst', 'fill');
    } else if (prop === 'strokeLineCap') active.set('strokeLineCap', value as 'round' | 'square' | 'butt');
    else if (prop === 'strokeLineJoin') active.set('strokeLineJoin', value as 'round' | 'bevel' | 'miter');
    else if (prop === 'flipX') active.set('flipX', value as boolean);
    else if (prop === 'flipY') active.set('flipY', value as boolean);
    else if (prop === 'rx' || prop === 'ry') {
      const radius = Number(value);
      (active as any).rx = radius;
      (active as any).ry = radius;
      if (isImage) {
        if (radius > 0) {
          const w = active.width || 400;
          const h = active.height || 300;
          const scaleX = active.scaleX || 1;
          const scaleY = active.scaleY || 1;
          const unscaledRx = radius / Math.max(scaleX, 0.001);
          const unscaledRy = radius / Math.max(scaleY, 0.001);
          active.clipPath = new Rect({
            width: w,
            height: h,
            rx: unscaledRx,
            ry: unscaledRy,
            originX: 'center',
            originY: 'center',
          });
        } else {
          active.clipPath = undefined;
        }
      } else {
        active.set({ rx: radius, ry: radius } as any);
      }
    } else if (prop === 'curve') {
      const curveVal = Number(value) || 0;
      (active as any).curve = curveVal;
      if (isText) {
        const textObj = active as Textbox | IText;
        if (Math.abs(curveVal) < 1) {
          textObj.set('path', null as any);
        } else {
          const w = Math.max(textObj.width || 200, 100);
          const absC = Math.abs(curveVal);
          const radius = Math.max(40, (100 / absC) * (w * 0.7));
          const sweepFlag = curveVal > 0 ? 1 : 0;
          const arcPath = new Path(`M 0 ${radius} A ${radius} ${radius} 0 0 ${sweepFlag} ${w} ${radius}`, {
            visible: false,
            fill: '',
            stroke: '',
          });
          textObj.set('path', arcPath);
        }
      }
    } else if (prop === 'strokeDashArray') {
      active.set('strokeDashArray', value ? (value as number[]) : null);
    } else if (prop === 'strokeUniform') {
      active.set('strokeUniform', Boolean(value));
    } else if (prop === 'paintFirst') {
      active.set('paintFirst', value as 'fill' | 'stroke');
    } else if (prop === 'isLocked') {
      const locked = value as boolean;
      active.set('isLocked' as any, locked);
      active.set({
        lockMovementX: locked,
        lockMovementY: locked,
        lockRotation: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        hasControls: !locked,
        hoverCursor: locked ? 'default' : 'move',
        moveCursor: locked ? 'default' : 'move',
        selectable: true,
        evented: true,
      });
      active.setCoords();
    }
    // Typography properties
    else if (isText && prop === 'text') {
      (active as Textbox | IText).set('text', String(value));
    } else if (isText && prop === 'fontSize') {
      const textObject = active as Textbox | IText;
      const nextFontSize = Math.max(1, Number(value) || 1);
      textObject.set({ fontSize: nextFontSize, objectCaching: false, dirty: true });
      textObject.set(
        'fontSizePt' as any,
        (nextFontSize * 72) /
        Math.max(72, Number(this.dimensions.dpi) || 96)
      );
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

  public getActiveObjectBoundingRect(): { left: number; top: number; width: number; height: number } | null {
    if (!this.canvas) return null;
    const active = this.canvas.getActiveObject();
    if (!active) return null;
    return active.getBoundingRect();
  }

  public applyEffect(effectType: 'none' | 'shadow' | 'lift' | 'glow' | 'outline' | 'hollow' | 'neon'): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    if (effectType === 'shadow') {
      active.set('shadow', new Shadow({ color: 'rgba(0, 0, 0, 0.4)', blur: 12, offsetX: 6, offsetY: 6 }));
    } else if (effectType === 'lift') {
      active.set('shadow', new Shadow({ color: 'rgba(0, 0, 0, 0.3)', blur: 24, offsetX: 0, offsetY: 10 }));
    } else if (effectType === 'glow') {
      active.set('shadow', new Shadow({ color: 'rgba(37, 99, 235, 0.8)', blur: 20, offsetX: 0, offsetY: 0 }));
    } else if (effectType === 'outline') {
      active.set({
        stroke: '#000000',
        strokeWidth: 2,
        shadow: null,
      });
    } else if (effectType === 'hollow') {
      active.set({
        fill: 'transparent',
        stroke: typeof active.fill === 'string' && active.fill !== 'transparent' ? active.fill : '#000000',
        strokeWidth: 2,
        shadow: null,
      });
    } else if (effectType === 'neon') {
      active.set({
        stroke: '#ec4899',
        strokeWidth: 1,
        shadow: new Shadow({ color: '#ec4899', blur: 30, offsetX: 0, offsetY: 0 }),
      });
    } else {
      // none
      active.set({
        shadow: null,
        strokeWidth: 0,
      });
    }

    active.setCoords();
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
  }

  /**
   * Returns every image owned by the selected object, including images inside
   * nested groups and frame images. A group can cache its rendered bitmap, so
   * callers must also mark the selected root object as dirty after filtering.
   */
  private getImagesFromObject(root: FabricObject | null): FabricImage[] {
    if (!root) return [];

    const images: FabricImage[] = [];
    const visitedObjects = new Set<FabricObject>();
    const visitedImages = new Set<FabricImage>();
    const pending: FabricObject[] = [root];

    const addImage = (image: FabricImage): void => {
      if (visitedImages.has(image)) return;
      visitedImages.add(image);
      images.push(image);
    };

    while (pending.length > 0) {
      const current = pending.pop();
      if (!current || visitedObjects.has(current)) continue;
      visitedObjects.add(current);

      if (current instanceof FabricImage || current.type === 'image') {
        addImage(current as FabricImage);
        continue;
      }

      const frameImage = (current as any)._frameImage;
      if (frameImage instanceof FabricImage || frameImage?.type === 'image') {
        addImage(frameImage as FabricImage);
      }

      const getObjects = (current as any).getObjects;
      if (typeof getObjects === 'function') {
        const children = getObjects.call(current) as FabricObject[];
        pending.push(...children);
      }
    }

    return images;
  }

  public applyImageFilter(presetId: string, intensity: number = 1): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    const targetImages = this.getImagesFromObject(active);

    if (targetImages.length > 0) {
      for (const targetImage of targetImages) {
        targetImage.filters = [];

        switch (presetId) {
          case 'grayscale':
          case 'mono':
            targetImage.filters.push(new filters.Grayscale());
            break;
          case 'sepia':
            targetImage.filters.push(new filters.Sepia());
            break;
          case 'blackwhite':
          case 'noir':
            targetImage.filters.push(new filters.BlackWhite());
            targetImage.filters.push(new filters.Contrast({ contrast: 0.3 * intensity }));
            break;
          case 'vintage':
            targetImage.filters.push(new filters.Vintage());
            break;
          case 'kodachrome':
          case 'vivid':
            targetImage.filters.push(new filters.Kodachrome());
            targetImage.filters.push(new filters.Saturation({ saturation: 0.4 * intensity }));
            break;
          case 'polaroid':
          case 'warm':
            targetImage.filters.push(new filters.Polaroid());
            targetImage.filters.push(new filters.Gamma({ gamma: [1.1, 1.0, 0.9] }));
            break;
          case 'technicolor':
          case 'solar':
            targetImage.filters.push(new filters.Technicolor());
            targetImage.filters.push(new filters.Brightness({ brightness: 0.1 * intensity }));
            break;
          case 'brownie':
            targetImage.filters.push(new filters.Brownie());
            break;
          case 'invert':
            targetImage.filters.push(new filters.Invert());
            break;
          case 'cool':
            targetImage.filters.push(new filters.Gamma({ gamma: [0.9, 1.0, 1.15] }));
            targetImage.filters.push(new filters.Saturation({ saturation: 0.15 * intensity }));
            break;
          case 'soft':
            targetImage.filters.push(new filters.Brightness({ brightness: 0.12 * intensity }));
            targetImage.filters.push(new filters.Contrast({ contrast: -0.15 * intensity }));
            break;
          case 'drama':
            targetImage.filters.push(new filters.Contrast({ contrast: 0.4 * intensity }));
            targetImage.filters.push(new filters.Saturation({ saturation: 0.25 * intensity }));
            break;
          case 'pixelate':
            targetImage.filters.push(new filters.Pixelate({ blocksize: 6 }));
            break;
          case 'none':
          default:
            break;
        }

        (targetImage as any)._activeFilterPreset = presetId;
        (targetImage as any)._filterIntensity = intensity;

        targetImage.applyFilters();
        let cachedObject: FabricObject | null = targetImage;
        while (cachedObject) {
          (cachedObject as any).dirty = true;
          if (cachedObject === active) break;
          cachedObject = ((cachedObject as any).group as FabricObject | undefined) || null;
        }
      }

      (active as any).dirty = true;
      active.setCoords();
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
    } else {
      if (presetId === 'mono' || presetId === 'grayscale' || presetId === 'blackwhite') {
        active.set('fill', '#333333');
      } else if (presetId === 'sepia' || presetId === 'warm') {
        active.set('fill', '#8B5A2B');
      } else if (presetId === 'cool') {
        active.set('fill', '#2563EB');
      } else if (presetId === 'solar') {
        active.set('fill', '#D97706');
      } else if (presetId === 'vivid') {
        active.set('fill', '#DC2626');
      }
      active.setCoords();
      this.canvas.requestRenderAll();
      this.notifyChange();
    }
  }

  public applyImageAdjustment(adjustments: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    vibrance?: number;
    blur?: number;
    hue?: number;
    warmth?: number;
  }): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    const targetImages = this.getImagesFromObject(active);

    if (targetImages.length > 0) {
      for (const targetImage of targetImages) {
        const stored = (targetImage as any)._adjustments || {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          vibrance: 0,
          blur: 0,
          hue: 0,
          warmth: 0,
        };

        const updated = { ...stored, ...adjustments };
        (targetImage as any)._adjustments = updated;

        targetImage.filters = [];

        if (updated.brightness !== 0) {
          targetImage.filters.push(new filters.Brightness({ brightness: updated.brightness / 100 }));
        }
        if (updated.contrast !== 0) {
          targetImage.filters.push(new filters.Contrast({ contrast: updated.contrast / 100 }));
        }
        if (updated.saturation !== 0) {
          targetImage.filters.push(new filters.Saturation({ saturation: updated.saturation / 100 }));
        }
        if (updated.vibrance !== 0) {
          targetImage.filters.push(new filters.Vibrance({ vibrance: updated.vibrance / 100 }));
        }
        if (updated.blur > 0) {
          targetImage.filters.push(new filters.Blur({ blur: updated.blur / 100 }));
        }
        if (updated.hue !== 0) {
          targetImage.filters.push(new filters.HueRotation({ rotation: (updated.hue / 180) * Math.PI }));
        }
        if (updated.warmth !== 0) {
          const factor = updated.warmth / 100;
          targetImage.filters.push(new filters.Gamma({ gamma: [1 + factor * 0.2, 1, 1 - factor * 0.2] }));
        }

        targetImage.applyFilters();
        let cachedObject: FabricObject | null = targetImage;
        while (cachedObject) {
          (cachedObject as any).dirty = true;
          if (cachedObject === active) break;
          cachedObject = ((cachedObject as any).group as FabricObject | undefined) || null;
        }
      }

      (active as any).dirty = true;
      active.setCoords();
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
    }
  }

  public getImageAdjustments(): {
    brightness: number;
    contrast: number;
    saturation: number;
    vibrance: number;
    blur: number;
    hue: number;
    warmth: number;
    activeFilter: string;
    intensity: number;
  } {
    if (!this.canvas) return { brightness: 0, contrast: 0, saturation: 0, vibrance: 0, blur: 0, hue: 0, warmth: 0, activeFilter: 'none', intensity: 100 };
    const active = this.canvas.getActiveObject();
    if (!active) return { brightness: 0, contrast: 0, saturation: 0, vibrance: 0, blur: 0, hue: 0, warmth: 0, activeFilter: 'none', intensity: 100 };

    // For a group, the first image represents the shared toolbar state. Any
    // change made from the toolbar is still applied to every image in it.
    const targetImage = this.getImagesFromObject(active)[0] || null;

    if (targetImage) {
      const adj = (targetImage as any)._adjustments || {};
      return {
        brightness: adj.brightness ?? 0,
        contrast: adj.contrast ?? 0,
        saturation: adj.saturation ?? 0,
        vibrance: adj.vibrance ?? 0,
        blur: adj.blur ?? 0,
        hue: adj.hue ?? 0,
        warmth: adj.warmth ?? 0,
        activeFilter: (targetImage as any)._activeFilterPreset || 'none',
        intensity: Math.round(((targetImage as any)._filterIntensity ?? 1) * 100),
      };
    }

    return { brightness: 0, contrast: 0, saturation: 0, vibrance: 0, blur: 0, hue: 0, warmth: 0, activeFilter: 'none', intensity: 100 };
  }

  public toggleBulletList(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active || !this.isTextObject(active)) return;

    const currentText = active.text || '';
    const lines = currentText.split('\n');
    const hasBullets = lines.every((l) => l.trim().startsWith('• ') || l.trim() === '');

    const newLines = lines.map((line) => {
      if (hasBullets) {
        return line.replace(/^•\s*/, '');
      } else {
        return line.trim() ? `• ${line}` : line;
      }
    });

    active.set('text', newLines.join('\n'));
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

  // --- Alignment & Distribution Engine ---

  public alignSelected(type: AlignmentType, relativeTo: 'page' | 'selection' = 'page'): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    const canvasWidth = this.dimensions.widthPx || 1063;
    const canvasHeight = this.dimensions.heightPx || 591;

    if (active instanceof ActiveSelection && relativeTo === 'selection') {
      // Multi-object alignment relative to the selection's own outer bounds
      const objects = active.getObjects().filter((o) => !o.get('isGuide' as any));
      if (objects.length < 2) return;

      // Temporarily discard active selection so objects are in canvas space
      this.canvas.discardActiveObject();

      const bounds = objects.map((o) => {
        o.setCoords();
        const b = o.getBoundingRect();
        return {
          obj: o,
          bound: b,
          deltaX: (o.left ?? 0) - b.left,
          deltaY: (o.top ?? 0) - b.top,
        };
      });

      const selMinLeft = Math.min(...bounds.map((b) => b.bound.left));
      const selMaxRight = Math.max(...bounds.map((b) => b.bound.left + b.bound.width));
      const selMinTop = Math.min(...bounds.map((b) => b.bound.top));
      const selMaxBottom = Math.max(...bounds.map((b) => b.bound.top + b.bound.height));
      const selCenterX = selMinLeft + (selMaxRight - selMinLeft) / 2;
      const selCenterY = selMinTop + (selMaxBottom - selMinTop) / 2;

      bounds.forEach(({ obj, bound, deltaX, deltaY }) => {
        switch (type) {
          case 'left':
            obj.set('left', selMinLeft + deltaX);
            break;
          case 'center':
          case 'center-h':
            obj.set('left', selCenterX - bound.width / 2 + deltaX);
            break;
          case 'right':
            obj.set('left', selMaxRight - bound.width + deltaX);
            break;
          case 'top':
            obj.set('top', selMinTop + deltaY);
            break;
          case 'middle':
          case 'center-v':
            obj.set('top', selCenterY - bound.height / 2 + deltaY);
            break;
          case 'bottom':
            obj.set('top', selMaxBottom - bound.height + deltaY);
            break;
          case 'center-both':
            obj.set({
              left: selCenterX - bound.width / 2 + deltaX,
              top: selCenterY - bound.height / 2 + deltaY,
            });
            break;
        }
        obj.setCoords();
      });

      const newSel = new ActiveSelection(objects, { canvas: this.canvas });
      this.canvas.setActiveObject(newSel);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      return;
    }

    // Align active selection or single object to page / canvas boundaries
    active.setCoords();
    const bound = active.getBoundingRect();
    const currentLeft = active.left ?? 0;
    const currentTop = active.top ?? 0;
    const deltaX = currentLeft - bound.left;
    const deltaY = currentTop - bound.top;

    let targetBoundLeft = bound.left;
    let targetBoundTop = bound.top;

    switch (type) {
      case 'left':
        targetBoundLeft = 0;
        active.set('left', targetBoundLeft + deltaX);
        break;
      case 'center':
      case 'center-h':
        targetBoundLeft = (canvasWidth - bound.width) / 2;
        active.set('left', targetBoundLeft + deltaX);
        break;
      case 'right':
        targetBoundLeft = canvasWidth - bound.width;
        active.set('left', targetBoundLeft + deltaX);
        break;
      case 'top':
        targetBoundTop = 0;
        active.set('top', targetBoundTop + deltaY);
        break;
      case 'middle':
      case 'center-v':
        targetBoundTop = (canvasHeight - bound.height) / 2;
        active.set('top', targetBoundTop + deltaY);
        break;
      case 'bottom':
        targetBoundTop = canvasHeight - bound.height;
        active.set('top', targetBoundTop + deltaY);
        break;
      case 'center-both':
        targetBoundLeft = (canvasWidth - bound.width) / 2;
        targetBoundTop = (canvasHeight - bound.height) / 2;
        active.set({
          left: targetBoundLeft + deltaX,
          top: targetBoundTop + deltaY,
        });
        break;
    }

    active.setCoords();
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
  }

  public distributeSelected(direction: 'horizontal' | 'vertical'): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof ActiveSelection)) return;

    const objects = active.getObjects().filter((o) => !o.get('isGuide' as any));
    if (objects.length < 3) return;

    this.canvas.discardActiveObject();

    const items = objects.map((obj) => {
      obj.setCoords();
      const b = obj.getBoundingRect();
      return {
        obj,
        bound: b,
        centerX: b.left + b.width / 2,
        centerY: b.top + b.height / 2,
        deltaX: (obj.left ?? 0) - b.left,
        deltaY: (obj.top ?? 0) - b.top,
      };
    });

    if (direction === 'horizontal') {
      items.sort((a, b) => a.centerX - b.centerX);
      const firstCenter = items[0].centerX;
      const lastCenter = items[items.length - 1].centerX;
      const step = (lastCenter - firstCenter) / (items.length - 1);

      for (let i = 1; i < items.length - 1; i++) {
        const targetCenterX = firstCenter + step * i;
        const targetLeft = targetCenterX - items[i].bound.width / 2;
        items[i].obj.set('left', targetLeft + items[i].deltaX);
        items[i].obj.setCoords();
      }
    } else {
      items.sort((a, b) => a.centerY - b.centerY);
      const firstCenter = items[0].centerY;
      const lastCenter = items[items.length - 1].centerY;
      const step = (lastCenter - firstCenter) / (items.length - 1);

      for (let i = 1; i < items.length - 1; i++) {
        const targetCenterY = firstCenter + step * i;
        const targetTop = targetCenterY - items[i].bound.height / 2;
        items[i].obj.set('top', targetTop + items[i].deltaY);
        items[i].obj.setCoords();
      }
    }

    const newSel = new ActiveSelection(objects, { canvas: this.canvas });
    this.canvas.setActiveObject(newSel);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
  }

  public spaceEvenlySelected(direction: 'horizontal' | 'vertical'): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof ActiveSelection)) return;

    const objects = active.getObjects().filter((o) => !o.get('isGuide' as any));
    if (objects.length < 3) return;

    this.canvas.discardActiveObject();

    const items = objects.map((obj) => {
      obj.setCoords();
      const b = obj.getBoundingRect();
      return {
        obj,
        bound: b,
        deltaX: (obj.left ?? 0) - b.left,
        deltaY: (obj.top ?? 0) - b.top,
      };
    });

    if (direction === 'horizontal') {
      items.sort((a, b) => a.bound.left - b.bound.left);
      const minLeft = items[0].bound.left;
      const maxRight = items[items.length - 1].bound.left + items[items.length - 1].bound.width;
      const totalWidths = items.reduce((sum, item) => sum + item.bound.width, 0);
      const totalGap = maxRight - minLeft - totalWidths;
      const gap = totalGap / (items.length - 1);

      let currentLeft = minLeft;
      for (let i = 0; i < items.length; i++) {
        items[i].obj.set('left', currentLeft + items[i].deltaX);
        items[i].obj.setCoords();
        currentLeft += items[i].bound.width + gap;
      }
    } else {
      items.sort((a, b) => a.bound.top - b.bound.top);
      const minTop = items[0].bound.top;
      const maxBottom = items[items.length - 1].bound.top + items[items.length - 1].bound.height;
      const totalHeights = items.reduce((sum, item) => sum + item.bound.height, 0);
      const totalGap = maxBottom - minTop - totalHeights;
      const gap = totalGap / (items.length - 1);

      let currentTop = minTop;
      for (let i = 0; i < items.length; i++) {
        items[i].obj.set('top', currentTop + items[i].deltaY);
        items[i].obj.setCoords();
        currentTop += items[i].bound.height + gap;
      }
    }

    const newSel = new ActiveSelection(objects, { canvas: this.canvas });
    this.canvas.setActiveObject(newSel);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
  }

  public centerObjectOnCanvas(obj: FabricObject): void {
    const canvasW = this.dimensions.widthPx || 1063;
    const canvasH = this.dimensions.heightPx || 591;

    obj.setCoords();
    const bound = obj.getBoundingRect();
    const currentLeft = obj.left ?? 0;
    const currentTop = obj.top ?? 0;
    const deltaX = currentLeft - bound.left;
    const deltaY = currentTop - bound.top;

    const targetLeft = (canvasW - bound.width) / 2 + deltaX;
    const targetTop = (canvasH - bound.height) / 2 + deltaY;

    obj.set({
      left: Math.round(targetLeft),
      top: Math.round(targetTop),
    });
    obj.setCoords();
  }

  // --- Rich Textbox Inserter ---

  public async addText(options?: AddTextOptions): Promise<void> {
    if (!this.canvas) return;

    this.enableSelectionMode();

    const fontItem = POPULAR_FONTS.find(
      (f) => f.family === options?.fontFamily || f.name === options?.fontFamily
    );
    if (fontItem) {
      // Wait for the real web font before Fabric measures and draws the text.
      try {
        await loadFont(fontItem);
      } catch (error) {
        console.warn(`Could not preload font ${fontItem.family}:`, error);
      }
      if (!this.canvas) return;
    }

    const textWidth = options?.width || 420;
    const artworkDpi = Math.max(72, Number(this.dimensions.dpi) || 96);
    const fontSize = options?.fontSizePt
      ? (options.fontSizePt * artworkDpi) / 72
      : options?.fontSize || 36;

    const text = new Textbox(options?.text || 'Add text here', {
      left: 0,
      top: 0,
      width: textWidth,
      fontSize,
      fontFamily: options?.fontFamily || 'Inter, sans-serif',
      fontWeight: options?.fontWeight || 'normal',
      fontStyle: (options?.fontStyle as '' | 'normal' | 'italic' | 'oblique') || 'normal',
      fill: options?.fill || '#0f172a',
      textAlign: options?.textAlign || 'left',
      cornerColor: '#ffffff',
      cornerStrokeColor: '#8b3dff',
      borderColor: '#8b3dff',
      cornerStyle: 'circle',
      cornerSize: 12,
      transparentCorners: false,
      padding: 6,
      splitByGrapheme: false,
      // Keep editable text sharp while zooming/resizing by redrawing glyphs
      // instead of enlarging Fabric's cached bitmap representation.
      objectCaching: false,
      noScaleCache: false,
      strokeUniform: true,
    });

    text.set(
      'fontSizePt' as any,
      options?.fontSizePt || (fontSize * 72) / artworkDpi
    );
    text.set('sourceType' as any, 'vector-text');

    this.ensureObjectId(text, options?.name || 'Text Layer');
    this.canvas.add(text);

    if (options?.left !== undefined || options?.top !== undefined) {
      if (options?.left !== undefined) text.set('left', options.left);
      if (options?.top !== undefined) text.set('top', options.top);
      text.setCoords();
    } else {
      this.centerObjectOnCanvas(text);
    }

    this.canvas.setActiveObject(text);
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
  }

  // --- Basic Shapes Inserter ---

  public addShape(shapeType: string, color = '#2563eb'): void {
    if (!this.canvas) return;

    this.enableSelectionMode();

    let shapeObj: FabricObject;

    if (shapeType === 'circle') {
      shapeObj = new Circle({
        radius: 90,
        fill: color,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
      });
      shapeObj.set('isShape' as any, true);
      shapeObj.set('shapeType' as any, 'circle');
      shapeObj.set('frameShape' as any, 'circle');
      this.ensureObjectId(shapeObj, 'Circle Shape');
    } else if (shapeType === 'triangle') {
      shapeObj = new Triangle({
        width: 180,
        height: 160,
        fill: color,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
      });
      shapeObj.set('isShape' as any, true);
      shapeObj.set('shapeType' as any, 'triangle');
      shapeObj.set('frameShape' as any, 'triangle');
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
          fill: color,
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
        }
      );
      shapeObj.set('isShape' as any, true);
      shapeObj.set('shapeType' as any, 'star');
      shapeObj.set('frameShape' as any, 'star');
      this.ensureObjectId(shapeObj, 'Star Shape');
    } else {
      // Rectangle / Square
      shapeObj = new Rect({
        width: 240,
        height: 160,
        fill: color,
        rx: 6,
        ry: 6,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
      });
      shapeObj.set('isShape' as any, true);
      shapeObj.set('shapeType' as any, 'rect');
      shapeObj.set('frameShape' as any, 'rounded-rect');
      this.ensureObjectId(shapeObj, 'Rectangle Shape');
    }

    this.canvas.add(shapeObj);
    this.centerObjectOnCanvas(shapeObj);
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
    // Many actions notify change + layers in the same tick. Coalesce their
    // expensive full-canvas preflight scans into one calculation per frame.
    if (this.isPreflightScheduled) return;
    this.isPreflightScheduled = true;

    const run = () => {
      this.isPreflightScheduled = false;
      if (!this.canvas || this.preflightListeners.size === 0) return;
      const report = this.getPreflightReport();
      this.preflightListeners.forEach((cb) => cb(report));
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run);
    } else {
      Promise.resolve().then(run);
    }
  }

  private notifyChange(): void {
    this.changeListeners.forEach((cb) => cb());
    this.notifyPreflight();
    this.scheduleHistorySave();
  }
  public getSerializableJson(): Record<string, any> {
    if (!this.canvas) return {};
    return this.canvas.toObject(CUSTOM_CANVAS_PROPERTIES);
  }

  // --- History Engine (Undo / Redo) ---

  public saveHistoryState(): void {
    if (!this.canvas || this.isProcessingHistory) return;
    try {
      const stateJson = JSON.stringify(
        this.canvas.toObject(CUSTOM_CANVAS_PROPERTIES)
      );

      // Prevent duplicate identical states
      if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === stateJson) {
        return;
      }

      this.undoStack.push(stateJson);
      if (this.undoStack.length > this.maxHistoryLength) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.notifyHistory();
    } catch (e) {
      console.warn('Failed to save history state:', e);
    }
  }

  public scheduleHistorySave(): void {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
    }
    this.historyDebounceTimer = setTimeout(() => {
      this.saveHistoryState();
    }, 250);
  }

  public async undo(): Promise<void> {
    if (!this.canvas || this.undoStack.length <= 1 || this.isProcessingHistory) return;
    try {
      this.isProcessingHistory = true;
      const currentState = this.undoStack.pop();
      if (currentState) {
        this.redoStack.push(currentState);
      }

      const previousState = this.undoStack[this.undoStack.length - 1];
      if (previousState) {
        await this.canvas.loadFromJSON(JSON.parse(previousState));
        this.refreshCanvasInteractivity();
        this.canvas.requestRenderAll();
        this.notifySelection();
        this.notifyLayers();
        this.notifyPreflight();
        this.changeListeners.forEach((cb) => cb());
      }
    } catch (e) {
      console.warn('Failed to undo:', e);
    } finally {
      this.isProcessingHistory = false;
      this.notifyHistory();
    }
  }

  public async redo(): Promise<void> {
    if (!this.canvas || this.redoStack.length === 0 || this.isProcessingHistory) return;
    try {
      this.isProcessingHistory = true;
      const nextState = this.redoStack.pop();
      if (nextState) {
        this.undoStack.push(nextState);
        await this.canvas.loadFromJSON(JSON.parse(nextState));
        this.refreshCanvasInteractivity();
        this.canvas.requestRenderAll();
        this.notifySelection();
        this.notifyLayers();
        this.notifyPreflight();
        this.changeListeners.forEach((cb) => cb());
      }
    } catch (e) {
      console.warn('Failed to redo:', e);
    } finally {
      this.isProcessingHistory = false;
      this.notifyHistory();
    }
  }

  public canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public onHistoryChange(cb: (canUndo: boolean, canRedo: boolean) => void): () => void {
    this.historyListeners.add(cb);
    cb(this.canUndo(), this.canRedo());
    return () => this.historyListeners.delete(cb);
  }

  private notifyHistory(): void {
    const canU = this.canUndo();
    const canR = this.canRedo();
    this.historyListeners.forEach((cb) => cb(canU, canR));
  }

  public extractSelectedState(): SelectedObjectState | null {
    if (!this.canvas) return null;
    const active = this.canvas.getActiveObject();
    if (!active) return null;

    const usesChildStyles = active instanceof Group || active instanceof ActiveSelection;
    const styleSource =
      usesChildStyles
        ? this.getFirstGroupLeaf(active) || active
        : active;

    const isMultiple = active instanceof ActiveSelection;
    const count = usesChildStyles
      ? (active as Group | ActiveSelection).getObjects().length
      : 1;

    const isText = this.isTextObject(active);
    const textObj = isText ? (active as Textbox | IText) : null;

    const isImage = active instanceof FabricImage || active.type === 'image';
    const isFrameObject = Boolean(active.get('isFrame' as any));
    const customFramePhoto = active instanceof Group && isFrameObject
      ? active.getObjects().find((object) => object.get('frameRole' as any) === 'photo')
      : null;
    const imageObj = isImage
      ? (active as FabricImage)
      : customFramePhoto instanceof FabricImage || customFramePhoto?.type === 'image'
        ? (customFramePhoto as FabricImage)
        : null;

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
    let isFrame = isFrameObject;
    let frameShape = (active.get('frameShape' as any) as string) || undefined;

    if (imageObj) {
      naturalWidth = (imageObj.get('naturalWidth' as any) as number) || imageObj.width || 400;
      naturalHeight = (imageObj.get('naturalHeight' as any) as number) || imageObj.height || 300;
      fileSizeBytes = (imageObj.get('fileSizeBytes' as any) as number) || 0;
      originalSrc = (imageObj.get('originalSrc' as any) as string) || (imageObj.getSrc ? imageObj.getSrc() : '');
      cropX = (imageObj.get('cropX' as any) as number) || imageObj.cropX || 0;
      cropY = (imageObj.get('cropY' as any) as number) || imageObj.cropY || 0;
      cropWidth = (imageObj.get('cropWidth' as any) as number) || imageObj.width;
      cropHeight = (imageObj.get('cropHeight' as any) as number) || imageObj.height;
      isFrame = isFrameObject || Boolean(imageObj.get('isFrame' as any));
      frameShape = frameShape || (imageObj.get('frameShape' as any) as string) || undefined;

      qualityInfo = calculateImageQuality(
        naturalWidth,
        naturalHeight,
        renderedWidth,
        renderedHeight,
        fileSizeBytes,
        this.dimensions.dpi || 300
      );
    }

    const imageDpiCalc = imageObj ? this.calculateImageDpi(imageObj) : null;

    const isPath = active instanceof Path || Boolean(active.get('isBrushPath' as any));
    const brushType = (active.get('brushType' as any) as BrushType) || undefined;
    const isBrushPath = isPath || Boolean(active.get('isBrushPath' as any));
    const isCanvaPlaceholder = Boolean(active.get('isCanvaPlaceholder' as any)) ||
      Boolean(imageObj?.get('isCanvaPlaceholder' as any));

    return {
      id: active.get('id' as any) as string,
      name: active.get('name' as any) as string,
      type: isMultiple
        ? 'activeSelection'
        : isText
          ? 'textbox'
          : isImage || isFrameObject
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
      fill: usesChildStyles && typeof styleSource.fill === 'string'
        ? styleSource.fill
        : typeof active.fill === 'string'
          ? active.fill
          : '#2563eb',
      stroke: usesChildStyles && typeof styleSource.stroke === 'string'
        ? styleSource.stroke
        : typeof active.stroke === 'string'
          ? active.stroke
          : '#000000',
      strokeWidth: usesChildStyles
        ? styleSource.strokeWidth || active.strokeWidth || 0
        : active.strokeWidth || 0,
      strokeLineCap:
        (active.strokeLineCap as 'round' | 'square' | 'butt') ||
        (styleSource.strokeLineCap as 'round' | 'square' | 'butt') ||
        undefined,
      strokeLineJoin:
        (active.strokeLineJoin as 'round' | 'bevel' | 'miter') ||
        (styleSource.strokeLineJoin as 'round' | 'bevel' | 'miter') ||
        undefined,
      flipX: Boolean(active.flipX),
      flipY: Boolean(active.flipY),
      isLocked: active.get('isLocked' as any) === true,
      isVisible: active.visible !== false,
      isFrame,
      frameShape,
      isShape: this.isShapeObject(active),
      shapeType: this.isShapeObject(active) ? this.getShapeTypeFromObject(active) : undefined,
      photoFit: isFrame ? ((active.get('photoFit' as any) as 'cover' | 'contain') || 'cover') : undefined,
      isCanvaPlaceholder,
      isBrushPath,
      brushType,
      rx: (active as any).rx || (styleSource as any).rx || 0,
      ry: (active as any).ry || (styleSource as any).ry || 0,
      curve: (active as any).curve || 0,
      strokeDashArray: active.strokeDashArray || styleSource.strokeDashArray || undefined,
      paintFirst: (active.paintFirst as 'fill' | 'stroke') || 'fill',
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
      backgroundRemoved: imageObj ? Boolean(imageObj.get('backgroundRemoved' as any)) : undefined,
      originalUrl: imageObj ? (imageObj.get('originalUrl' as any) as string) : undefined,
      processedUrl: imageObj ? (imageObj.get('processedUrl' as any) as string) : undefined,
      processedFileId: imageObj ? (imageObj.get('processedFileId' as any) as string) : undefined,
      processingType: imageObj ? (imageObj.get('processingType' as any) as string) : undefined,
      effectiveDpi: imageDpiCalc ? imageDpiCalc.effectiveDpi : undefined,
      qualityLevel: imageDpiCalc ? imageDpiCalc.qualityLevel : undefined,
      upscaleStatus: imageObj ? ((imageObj.get('upscaleStatus' as any) as any) || 'not_required') : undefined,
      upscaleFactor: imageObj ? ((imageObj.get('upscaleFactor' as any) as any) || 1) : undefined,
      upscaledSrc: imageObj ? ((imageObj.get('upscaledSrc' as any) as string) || undefined) : undefined,
      imageId: imageObj ? ((imageObj.get('imageId' as any) as string) || undefined) : undefined,
    };
  }

  // --- Internal Event Handlers ---

  private bindEvents(): void {
    if (!this.canvas) return;

    this.canvas.on('mouse:down:before', (opt: any) => {
      if (!this.canvas) return;
      this.canvas.calcOffset();

      // Clear stale movement flags before Fabric creates its drag transform.
      // Explicitly locked objects remain locked.
      const rawTarget =
        opt?.target ||
        (opt?.e && typeof (this.canvas as any).findTarget === 'function'
          ? (this.canvas as any).findTarget(opt.e)
          : null) ||
        this.canvas.getActiveObject();
      const target = rawTarget;

      if (
        target &&
        typeof target.set === 'function' &&
        typeof target.setCoords === 'function' &&
        !this.isNonInteractiveObject(target)
      ) {
        this.restoreObjectInteractivity(target);
      }
    });

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
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
        });
        path.set('isBrushPath' as any, true);
        path.set('isPencilStroke' as any, true);
        path.set('brushType' as any, this.brushSettings.tool);
        this.canvas?.requestRenderAll();
        this.notifyChange();
        this.notifyLayers();
        this.notifyPreflight();
      }
    });

    this.canvas.on('mouse:down', (opt: any) => {
      if (this.isDrawing && this.brushSettings.tool === 'eraser') {
        const pointer = opt.scenePoint || (this.canvas && opt.e ? (this.canvas as any).getScenePoint?.(opt.e) : null);
        if (pointer) {
          this.isErasing = true;
          this.lastErasePoint = { x: pointer.x, y: pointer.y };
          const radius = Math.max((this.brushSettings.size || 20) / 2, 2);
          const modified = this.erasePencilStrokesAt(pointer.x, pointer.y, radius);
          if (modified) {
            this.canvas?.requestRenderAll();
            this.hasErasedInCurrentStroke = true;
          }
        }
      }
    });

    this.canvas.on('mouse:move', (opt: any) => {
      if (this.isErasing && this.isDrawing && this.brushSettings.tool === 'eraser') {
        const pointer = opt.scenePoint || (this.canvas && opt.e ? (this.canvas as any).getScenePoint?.(opt.e) : null);
        if (pointer && this.lastErasePoint) {
          const radius = Math.max((this.brushSettings.size || 20) / 2, 2);
          const dx = pointer.x - this.lastErasePoint.x;
          const dy = pointer.y - this.lastErasePoint.y;
          const dist = Math.hypot(dx, dy);
          const steps = Math.max(1, Math.ceil(dist / Math.max(radius * 0.4, 2)));
          let anyModified = false;

          for (let i = 1; i <= steps; i++) {
            const ix = this.lastErasePoint.x + (dx * i) / steps;
            const iy = this.lastErasePoint.y + (dy * i) / steps;
            if (this.erasePencilStrokesAt(ix, iy, radius)) {
              anyModified = true;
              this.hasErasedInCurrentStroke = true;
            }
          }

          this.lastErasePoint = { x: pointer.x, y: pointer.y };
          if (anyModified) {
            this.canvas?.requestRenderAll();
          }
        }
      }
    });

    this.canvas.on('mouse:up', (opt: any) => {
      if (this.isErasing) {
        this.isErasing = false;
        this.lastErasePoint = null;
        if (this.hasErasedInCurrentStroke) {
          this.hasErasedInCurrentStroke = false;
          this.saveHistoryState();
          this.notifyChange();
          this.notifyLayers();
          this.notifyPreflight();
        }
      }
      this.snapping.clearGuides();

      if (this.currentHoverFitTarget) {
        const active = this.canvas?.getActiveObject() || opt?.target;
        if (active) {
          this.handleShapeImageDrop(active);
        } else {
          this.clearHoverFitHighlight();
        }
      }
    });

    this.canvas.on('selection:created', () => {
      const active = this.canvas?.getActiveObject();
      if (active) {
        applyCanvaControlsToObject(active);
      }
      this.notifySelection();
      this.notifyLayers();
    });
    this.canvas.on('selection:updated', () => {
      const active = this.canvas?.getActiveObject();
      if (active) {
        applyCanvaControlsToObject(active);
      }
      this.notifySelection();
      this.notifyLayers();
    });
    this.canvas.on('selection:cleared', () => {
      this.clearHoverFitHighlight();
      this.snapping.clearGuides();
      this.notifySelection();
      this.notifyLayers();
    });

    /* Keep the typography toolbar synchronized while entering, editing and
     * leaving a Fabric text object. */
    this.canvas.on('text:editing:entered' as any, () => {
      this.notifySelection();
    });
    this.canvas.on('text:selection:changed' as any, () => {
      this.notifySelection();
    });
    this.canvas.on('text:changed' as any, (opt: any) => {
      opt?.target?.set?.('dirty', true);
      opt?.target?.setCoords?.();
      this.canvas?.requestRenderAll();
      this.notifySelection();
      this.notifyChange();
    });
    this.canvas.on('text:editing:exited' as any, () => {
      this.notifySelection();
      this.notifyChange();
      this.notifyLayers();
    });

    this.canvas.on('object:added', (opt: any) => {
      if (opt.target) {
        if (this.isPanMode) {
          opt.target.set({ selectable: false, evented: false });
        } else if (!this.isDrawing) {
          this.restoreObjectInteractivity(opt.target);
        } else {
          applyCanvaControlsToObject(opt.target);
        }
      }
      this.notifyLayers();
    });
    this.canvas.on('object:removed', () => this.notifyLayers());

    this.canvas.on('object:modified', async (opt: any) => {
      this.snapping.clearGuides();
      if (opt?.target) {
        const handled = await this.handleShapeImageDrop(opt.target);
        if (!handled) {
          opt.target.setCoords();
        }
      }
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
    });

    this.canvas.on('object:moving', (opt) => {
      if (opt.target) {
        this.snapping.handleObjectMove(opt.target);
        this.handleShapeImageHover(opt.target);
      }
    });
    this.canvas.on('object:scaling', (opt) => {
      const target = opt.target;
      if (!target || this.isNonInteractiveObject(target)) return;

      /*
       * IMPORTANT:
       * Do not call snapping.handleObjectMove() while scaling. That method is
       * intended for object:moving and may update left/top on every pointer
       * event. Repeated position updates cause the visible slow resize drift.
       * Fabric's scale control already keeps the opposite corner anchored.
       */
      target.set({
        lockScalingFlip: true,
      });
      target.setCoords();
      this.canvas?.requestRenderAll();
    });
    this.canvas.on('object:rotating', () => {
    });

    if (process.env.NODE_ENV !== 'production') {
      const logDiag = (eventName: string, target?: any) => {
        const t = target || this.canvas?.getActiveObject();
        console.debug(`[CanvasDiag] ${eventName}:`, {
          id: t?.get?.('id') || (t as any)?.id,
          selectable: t?.selectable,
          evented: t?.evented,
          isLocked: t?.get?.('isLocked') === true,
          lockMovementX: t?.lockMovementX,
          lockMovementY: t?.lockMovementY,
          isPanMode: this.isPanMode,
          isDrawing: this.isDrawing,
        });
      };

      this.canvas.on('mouse:down', (opt: any) => logDiag('mouse:down', opt.target));
      this.canvas.on('selection:created', (opt: any) => logDiag('selection:created', opt.selected?.[0] || opt.target));
      this.canvas.on('object:moving', (opt: any) => logDiag('object:moving', opt.target));
      this.canvas.on('object:modified', (opt: any) => logDiag('object:modified', opt.target));
    }

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

  public async addSvgFromUrl(
    url: string,
    options?: Partial<FabricObject> & { name?: string }
  ): Promise<void> {
    if (!this.canvas) return;
    this.enableSelectionMode();
    try {
      const safeUrl = await urlToSafeDataUrl(url);
      const res = await loadSVGFromURL(safeUrl);
      const objects = (res?.objects || []).filter(
        (o): o is FabricObject => !!o
      );
      const optionsInfo = res?.options || {};

      if (objects.length > 0) {
        const obj = util.groupSVGElements(objects, optionsInfo);
        this.ensureObjectId(obj, options?.name || 'SVG Shape');

        const canvasW = this.dimensions.widthPx || 1063;
        const canvasH = this.dimensions.heightPx || 591;
        const maxW = Math.min(canvasW * 0.6, 500);
        const maxH = Math.min(canvasH * 0.6, 400);

        const natW = obj.width || 100;
        const natH = obj.height || 100;
        const scale = Math.min(maxW / natW, maxH / natH, 1.0);

        obj.set({
          scaleX: scale,
          scaleY: scale,
        });

        if (options?.left !== undefined) obj.set('left', options.left);
        if (options?.top !== undefined) obj.set('top', options.top);

        this.canvas.add(obj);
        if (options?.left === undefined && options?.top === undefined) {
          this.centerObjectOnCanvas(obj);
        }

        this.canvas.setActiveObject(obj);
        this.canvas.requestRenderAll();
        this.notifyChange();
        this.notifySelection();
        this.notifyLayers();
        return;
      }

      // If loadSVGFromURL didn't yield vector objects, fall back to high-DPI normalized image loader
      await this.addImageFromUrl(safeUrl, { name: options?.name }, options);
    } catch (err) {
      console.error('Failed to load SVG into canvas:', err);
      try {
        await this.addImageFromUrl(url, { name: options?.name }, options);
      } catch {
        // ignore
      }
    }
  }

  private async loadCustomShapeObject(url: string): Promise<FabricObject> {
    // Custom shapes are SVG vector documents. Fetch the original Laravel
    // storage URL as text instead of converting it through the image/Data URL
    // pipeline, which can produce a response Fabric cannot parse in production.
    const directUrl = formatImageUrl(url);

    const response = await fetch(directUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(
        `Unable to load custom shape SVG (${response.status} ${response.statusText}).`
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const svgText = await response.text();

    if (!/<svg[\s>]/i.test(svgText)) {
      throw new Error(
        `Shape response is not SVG. Content-Type: ${contentType || 'unknown'}`
      );
    }

    const result = await loadSVGFromString(svgText);
    let objects = (result?.objects || []).filter(
      (object): object is FabricObject => Boolean(object)
    );

    let groupOptions = result?.options || {};

    /*
     * Some optimized production bundles can return null entries from Fabric's
     * generic SVG loader even for a valid, simple <path>. Custom photo shapes
     * are path-driven, so recover those paths directly instead of rejecting a
     * valid uploaded mask.
     */
    if (objects.length === 0) {
      const svgDocument = new DOMParser().parseFromString(
        svgText,
        'image/svg+xml'
      );

      if (svgDocument.querySelector('parsererror')) {
        throw new Error('The custom shape file contains invalid SVG XML.');
      }

      const svgElement = svgDocument.documentElement;
      const fallbackPaths = Array.from(
        svgDocument.querySelectorAll('path[d]')
      ).map((pathElement) => {
        const pathData = pathElement.getAttribute('d')?.trim() || '';
        const opacityAttribute = pathElement.getAttribute('opacity');
        const strokeWidthAttribute = pathElement.getAttribute('stroke-width');
        const parsedOpacity = opacityAttribute === null
          ? Number.NaN
          : Number(opacityAttribute);
        const parsedStrokeWidth = strokeWidthAttribute === null
          ? Number.NaN
          : Number(strokeWidthAttribute);
        const fill = pathElement.getAttribute('fill');
        const stroke = pathElement.getAttribute('stroke');

        return new Path(pathData, {
          fill: !fill || fill === 'none' ? '#000000' : fill,
          fillRule:
            pathElement.getAttribute('fill-rule') === 'evenodd'
              ? 'evenodd'
              : 'nonzero',
          stroke: !stroke || stroke === 'none' ? undefined : stroke,
          strokeWidth: Number.isFinite(parsedStrokeWidth)
            ? parsedStrokeWidth
            : 0,
          opacity: Number.isFinite(parsedOpacity) ? parsedOpacity : 1,
        } as any);
      });

      objects = fallbackPaths;

      const viewBox = (svgElement.getAttribute('viewBox') || '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);

      if (
        viewBox.length === 4 &&
        viewBox.every(Number.isFinite) &&
        viewBox[2] > 0 &&
        viewBox[3] > 0
      ) {
        groupOptions = {
          ...groupOptions,
          width: viewBox[2],
          height: viewBox[3],
        };
      }
    }

    if (objects.length === 0) {
      throw new Error(
        'The custom shape SVG contains no supported drawable paths.'
      );
    }

    const shape = util.groupSVGElements(objects, groupOptions);

    shape.set({
      visible: true,
      opacity: 1,
      selectable: true,
      evented: true,
    });

    return shape;
  }

  /**
   * Adds an admin-created SVG as a reusable photo shape.
   * If an image is already selected, one click immediately clips that image.
   * Otherwise the SVG is added as a placeholder which can be dragged over an image.
   */
  public async addCustomPhotoShape(
    url: string,
    metadata: ShapeAssetMetadata = {}
  ): Promise<FabricObject | null> {
    if (!this.canvas || !url) return null;

    this.enableSelectionMode();

    try {
      const selected = this.canvas.getActiveObject();
      const selectedImage = this.isImageObject(selected) ? selected : null;
      const shape = await this.loadCustomShapeObject(url);
      const canvasW = this.dimensions.widthPx || 1063;
      const canvasH = this.dimensions.heightPx || 591;
      const defaultSize = Math.min(canvasW * 0.3, canvasH * 0.45, 280);
      const naturalW = Math.max(shape.width || 1, 1);
      const naturalH = Math.max(shape.height || 1, 1);
      const targetW = selectedImage?.getScaledWidth() || defaultSize;
      const targetH = selectedImage?.getScaledHeight() ||
        defaultSize * (naturalH / naturalW);

      shape.set({
        originX: 'center',
        originY: 'center',
        scaleX: targetW / naturalW,
        scaleY: targetH / naturalH,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
      });
      shape.set('isShape' as any, true);
      shape.set('isFrame' as any, true);
      shape.set('isCanvaPlaceholder' as any, true);
      shape.set('shapeType' as any, 'custom-svg');
      shape.set('frameShape' as any, 'custom-svg');
      shape.set('sourceType' as any, 'shape');
      shape.set('customShapeUrl' as any, url);
      shape.set('assetId' as any, metadata.assetId);
      shape.set('provider' as any, metadata.provider || 'admin');
      shape.set('photoFit' as any, metadata.photoFit || 'cover');
      shape.set('allowPhotoDrop' as any, metadata.allowPhotoDrop !== false);
      this.ensureObjectId(shape, metadata.name || 'Custom Photo Shape');

      if (selectedImage) {
        const center = selectedImage.getCenterPoint();
        shape.set({ left: center.x, top: center.y, angle: selectedImage.angle || 0 });
      } else {
        this.centerObjectOnCanvas(shape);
      }

      this.canvas.add(shape);
      shape.setCoords();

      if (selectedImage) {
        return await this.fitImageIntoShape(shape, selectedImage, {
          ...metadata,
          photoFit: metadata.photoFit || 'cover',
        });
      }

      this.canvas.setActiveObject(shape);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
      this.saveHistoryState();
      return shape;
    } catch (error) {
      console.error('Failed to add custom photo shape:', error);
      return null;
    }
  }

  public async addFrameAsset(url: string, metadata: FrameAssetMetadata = {}): Promise<void> {
    if (!this.canvas) return;

    const overlayUrl = metadata.overlayUrl || url;
    const maskUrl = metadata.maskUrl;

    if (!maskUrl || (metadata.maskType && metadata.maskType !== 'svg_mask')) {
      console.warn('This frame has no usable custom SVG mask. Adding its overlay as artwork only.');
      const overlay = await this.addImageFromUrl(
        overlayUrl,
        { ...metadata, name: metadata.name || 'Frame Overlay' },
        { skipFrameSlotting: true } as any
      );
      overlay?.set('sourceType' as any, 'frame-overlay');
      this.canvas.requestRenderAll();
      return;
    }

    this.enableSelectionMode();

    try {
      const sourceWidth = Math.max(Number(metadata.width) || 500, 1);
      const sourceHeight = Math.max(Number(metadata.height) || 500, 1);
      const aspectRatio = sourceWidth / sourceHeight;
      const canvasWidth = this.dimensions.widthPx || 1063;
      const canvasHeight = this.dimensions.heightPx || 591;
      const baseDimension = Math.min(canvasWidth * 0.32, canvasHeight * 0.48, 280);
      const frameWidth = aspectRatio >= 1 ? baseDimension : baseDimension * aspectRatio;
      const frameHeight = aspectRatio >= 1 ? baseDimension / aspectRatio : baseDimension;

      const frame = await this.createCustomFrameGroup(
        overlayUrl,
        maskUrl,
        CANVA_FRAME_PLACEHOLDER_SVG,
        {
          ...metadata,
          overlayUrl,
          maskUrl,
          maskType: metadata.maskType || 'svg_mask',
          photoFit: metadata.photoFit || 'cover',
          originalSrc: CANVA_FRAME_PLACEHOLDER_SVG,
        },
        frameWidth,
        frameHeight,
        true
      );

      this.canvas.add(frame);
      this.centerObjectOnCanvas(frame);
      frame.setCoords();
      this.canvas.setActiveObject(frame);
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
      this.saveHistoryState();
    } catch (error) {
      console.error('Failed to create custom frame asset:', error);
    }
  }

  /**
   * Calculate effective print DPI for an image object on the canvas.
   */
  public calculateImageDpi(obj: FabricObject): {
    effectiveDpi: number;
    qualityLevel: 'excellent' | 'acceptable' | 'low';
    targetDpi: number;
    printedWidthInches: number;
    printedHeightInches: number;
    recommendedScale: 1 | 2 | 4;
    requiresUpscale: boolean;
  } | null {
    if (!obj || (obj.type !== 'image' && obj.type !== 'fabricImage')) {
      return null;
    }

    const dims = this.dimensions;
    const sourceWidth = Number((obj as any).sourceWidth || (obj as any).width || 100);
    const sourceHeight = Number((obj as any).sourceHeight || (obj as any).height || 100);
    const objW = Number(obj.width || 100);
    const objH = Number(obj.height || 100);
    const scaleX = Number(obj.scaleX || 1.0);
    const scaleY = Number(obj.scaleY || 1.0);

    const crop = {
      cropX: (obj as any).cropX,
      cropY: (obj as any).cropY,
      cropWidth: (obj as any).cropWidth,
      cropHeight: (obj as any).cropHeight,
    };

    return calculateFabricImageEffectiveDpi(
      sourceWidth,
      sourceHeight,
      objW,
      objH,
      scaleX,
      scaleY,
      dims.widthPx || 1063,
      dims.heightPx || 591,
      dims.widthMm || 90,
      dims.heightMm || 50,
      crop,
      dims.dpi || 300
    );
  }

  /**
   * Replace low-res image element with an AI-upscaled version without changing coordinates, scale, or position.
   */
  public async applyUpscaledSourceToObject(
    obj: FabricObject,
    upscaledSrc: string,
    upscaleFactor: 1 | 2 | 4
  ): Promise<boolean> {
    if (!obj || (obj.type !== 'image' && obj.type !== 'fabricImage')) {
      return false;
    }

    try {
      (obj as any).upscaledSrc = upscaledSrc;
      (obj as any).upscaleFactor = upscaleFactor;
      (obj as any).upscaleStatus = 'completed';

      // Load upscaled image HTML element
      const imgEl = new Image();
      imgEl.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        imgEl.onload = () => resolve();
        imgEl.onerror = () => reject(new Error('Failed to load upscaled image'));
        imgEl.src = upscaledSrc;
      });

      const fabricImg = obj as FabricImage;
      if (typeof fabricImg.setElement === 'function') {
        fabricImg.setElement(imgEl);
      }

      // Preserve on-screen displayed dimensions by dividing scale by upscaleFactor
      if (upscaleFactor > 1) {
        fabricImg.set({
          scaleX: (fabricImg.scaleX || 1) / upscaleFactor,
          scaleY: (fabricImg.scaleY || 1) / upscaleFactor,
        });
      }

      fabricImg.setCoords();
      this.canvas?.requestRenderAll();
      this.notifyChange();
      return true;
    } catch (err) {
      console.error('Failed to apply upscaled image to object:', err);
      return false;
    }
  }

  public dispose(): void {
    if (this.zoomAnimationFrame !== null) {
      cancelAnimationFrame(this.zoomAnimationFrame);
      this.zoomAnimationFrame = null;
      this.pendingZoom = null;
    }

    if (this.canvas) {
      if (this.canvas.upperCanvasEl && this.preventNativeDragHandler) {
        try {
          this.canvas.upperCanvasEl.removeEventListener('dragstart', this.preventNativeDragHandler, { capture: true } as any);
        } catch {
          // ignore
        }
        this.preventNativeDragHandler = null;
      }
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
    this.panModeListeners.clear();
    this.brushSettingsListeners.clear();
  }
}
