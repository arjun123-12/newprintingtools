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
  DesignerGradientValue,
} from '@/types/designer';
import { fabricGradientToDesignerGradient } from '@/utils/colorUtils';
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
import {
  ImportedPsdDocument,
  ImportedPsdLayer,
  PsdImportOptions,
} from '../services/psdImportService';

// Apply Canva-style selection frame and handles globally
applyCanvaControlsGlobal();

// Ensure all Fabric text objects render directly from vector glyphs (no blurry bitmap caching)
(Textbox as any).ownDefaults = {
  ...((Textbox as any).ownDefaults || {}),
  objectCaching: false,
};
(IText as any).ownDefaults = {
  ...((IText as any).ownDefaults || {}),
  objectCaching: false,
};

export const ZOOM_PRESETS = [
  0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0,
];

const CANVAS_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '');

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
  provider?: string;
  providerAssetId?: string | number;
  sourceType?: string;
  maskUrl?: string;
  isIcon?: boolean;
  /** Internal frame-resize state: keep the photo size while changing the mask. */
  framePhotoScale?: number;
  frameCropCenterX?: number;
  frameCropCenterY?: number;
}

interface FrameResizeSnapshot {
  photoScale: number;
  cropCenterX: number;
  cropCenterY: number;
  naturalWidth: number;
  naturalHeight: number;
  anchorX?: number;
  anchorY?: number;
  anchorOriginX?: 'left' | 'center' | 'right';
  anchorOriginY?: 'top' | 'center' | 'bottom';
}

export type ImagePlacementOptions = Partial<FabricObject> & {
  skipFrameSlotting?: boolean;
  /**
   * Place the loaded source at its original 1:1 pixel scale and bypass all
   * provider/artwork auto-fit rules.
   */
  preserveOriginalSize?: boolean;
  /**
   * Fit the complete image inside the artwork while leaving at least this
   * much space on every edge. For example, 20 means 20 mm on the left,
   * right, top and bottom. Aspect ratio is always preserved.
   * The value is converted using the artwork DPI and is not affected by zoom.
   */
  fitToArtworkInsetMm?: number;
};

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
  left?: number;
  top?: number;
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
  'strokePosition',
  'baseStrokeWidth',
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
  'psdLayerId',
  'psdLayerName',
  'psdLayerType',
  'psdParentId',
  'psdBlendMode',
  'psdDocumentId',
  'psdRasterized',
  'psdRasterizeReason',
];

/** Properties that must be painted on Group children, not only on the Group wrapper. */
const GROUP_RECURSIVE_PROPERTIES = new Set<keyof SelectedObjectState>([
  'fill',
  'stroke',
  'strokeWidth',
  'strokePosition',
  'baseStrokeWidth',
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

const PSD_TO_CANVAS_BLEND_MODES: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  'pass through': 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color dodge': 'color-dodge',
  'color-dodge': 'color-dodge',
  'color burn': 'color-burn',
  'color-burn': 'color-burn',
  'hard light': 'hard-light',
  'hard-light': 'hard-light',
  'soft light': 'soft-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

export class CanvasManager {
  private canvas: Canvas | null = null;
  private dimensions: CanvasDimensions;
  private guides: CanvasGuides;
  private snapping: CanvasSnapping;
  private zoom: number = 1.0;
  private pendingZoom: number | null = null;
  private pendingZoomPivot: { clientX?: number; clientY?: number } | null = null;
  private zoomAnimationFrame: number | null = null;
  private viewportElement: HTMLElement | null = null;
  private shapeCacheRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private zoomNotifyTrailingTimer: ReturnType<typeof setTimeout> | null = null;
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
  private preflightDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private textSelectionThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  // History / Undo & Redo Stack
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private isProcessingHistory: boolean = false;
  private maxHistoryLength: number = 25;
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
  private isNormalizingFrameTransform: boolean = false;
  private frameResizeSnapshots = new WeakMap<FabricObject, FrameResizeSnapshot>();

  constructor(dimensions: CanvasDimensions, initialGuidesSettings?: Partial<PrintGuidesSettings>) {
    this.dimensions = dimensions;
    this.guides = new CanvasGuides(dimensions, initialGuidesSettings);
    this.snapping = new CanvasSnapping(dimensions);
  }

  /**
   * CanvasGuides paints the black artwork edge and inner safe margin. This
   * method paints only the red bleed boundary outside the Fabric canvas.
   * Using an outline instead of a border keeps the canvas hit area stable and
   * prevents pointer glitches when crossing safe/trim/bleed boundaries.
   */
  private syncArtworkBoundaryLines(): void {
    if (!this.canvas) return;

    const wrapper = (this.canvas as any).wrapperEl as HTMLElement | undefined;
    if (!wrapper) return;

    const visible = this.guides.getVisible();

    // Clean up guide elements created by older CanvasManager versions. A DOM
    // element above Fabric's upper canvas can steal hover transitions and make
    // switching between the safe and trim lines flicker.
    wrapper
      .querySelector<HTMLElement>('[data-print-safe-margin="true"]')
      ?.remove();

    if (!visible) {
      wrapper.style.border = 'none';
      wrapper.style.boxShadow = 'none';
      wrapper.style.outline = 'none';
      wrapper.style.outlineOffset = '0px';
      return;
    }

    const bleedMm = Math.max(0, Number(this.dimensions.bleedMm) || 0);
    const dpi = Math.max(1, Number(this.dimensions.dpi) || 300);
    const bleedScreenPx = bleedMm * (dpi / 25.4) * this.zoom;

    // Trim and safe-margin lines are canvas overlays. Never use a CSS border:
    // borders change the wrapper box and cause hit-testing jumps.
    wrapper.style.boxSizing = 'content-box';
    wrapper.style.border = 'none';
    wrapper.style.boxShadow = 'none';

    // Red dashed bleed line: outside the artwork by the configured bleed.
    const showBleed = this.guides.getSettings().showBleed !== false;
    wrapper.style.outline = showBleed && bleedMm > 0
      ? '1px dashed #ef4444'
      : 'none';
    wrapper.style.outlineOffset = `${Math.max(0, bleedScreenPx - 1)}px`;
    wrapper.style.overflow = 'visible';
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
    this.syncArtworkBoundaryLines();

    // Initialize history baseline
    this.undoStack = [];
    this.redoStack = [];
    this.saveHistoryState();

    if (!this.viewportElement && canvasEl) {
      this.viewportElement = canvasEl.closest('.overflow-auto') as HTMLElement | null;
    }

    return canvas;
  }

  public setViewportElement(el: HTMLElement | null): void {
    this.viewportElement = el;
  }

  public getViewportElement(): HTMLElement | null {
    return this.viewportElement;
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
      this.syncArtworkBoundaryLines();
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

    // Show only the supported artwork, safe-margin and outside-bleed lines.
    this.guides.updateSettings({
      ...(config.guides || {}),
      showTrim: true,
      showSafeZone: true,
      showBleed: true,
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
      this.syncArtworkBoundaryLines();
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

  public setBackgroundGradient(
    gradientConfig: {
      type: 'linear' | 'radial';
      angle: number;
      stops: Array<{ offset: number; color: string }>;
    },
    isLivePreview: boolean = false
  ): void {
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
    if (!isLivePreview) {
      this.notifyChange();
    }
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
    this.saveHistoryState();
  }

  public clearBackground(): void {
    this.resetBackground();
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
    this.syncArtworkBoundaryLines();
    this.notifyGuides(isVisible);
    return isVisible;
  }

  public setGuidesVisible(visible: boolean): void {
    this.guides.setVisible(visible);
    this.syncArtworkBoundaryLines();
    this.notifyGuides(visible);
  }

  public getGuidesVisible(): boolean {
    return this.guides.getVisible();
  }

  public updateGuidesSettings(settings: Partial<PrintGuidesSettings>): void {
    this.guides.updateSettings(settings);
    this.syncArtworkBoundaryLines();
  }

  // --- Zoom & Viewport Sizing (10% to 800%) ---

  public getZoom(): number {
    return this.zoom;
  }

  /**
   * Returns the newest requested zoom, including a value waiting for the next
   * animation frame. Wheel events must use this value so rapid input builds on
   * the previous request instead of repeatedly starting from the last frame.
   */
  public getTargetZoom(): number {
    return this.pendingZoom ?? this.zoom;
  }

  /**
   * Fabric keeps separate bitmap caches for groups and clipPaths. Custom SVG
   * photo shapes use both, so a viewport-only zoom can otherwise leave their
   * old cache visible while every normal canvas object zooms correctly.
   *
   * Mark only shape/frame trees dirty. This preserves the lightweight zoom
   * path: objects are not recreated/resized and React state is not involved.
   */
  private refreshShapeCachesForZoom(): void {
    if (!this.canvas) return;

    const markTreeDirty = (node: any): void => {
      if (!node) return;

      node.dirty = true;

      if (node.clipPath) {
        markTreeDirty(node.clipPath);
      }

      if (typeof node.getObjects === 'function') {
        node.getObjects().forEach((child: FabricObject) => {
          markTreeDirty(child);
        });
      }
    };

    this.canvas.getObjects().forEach((object) => {
      if (this.isTextObject(object)) {
        object.set({
          objectCaching: false,
          noScaleCache: false,
          dirty: true,
        });
        object.setCoords();
      } else if (
        this.isShapeObject(object) ||
        Boolean(object.get('isFrame' as any)) ||
        Boolean(object.get('isPhotoShapeGroup' as any))
      ) {
        markTreeDirty(object);
        object.setCoords();
      }
    });
  }

  private scheduleShapeCacheRefresh(): void {
    if (this.shapeCacheRefreshTimer !== null) {
      clearTimeout(this.shapeCacheRefreshTimer);
    }
    this.shapeCacheRefreshTimer = setTimeout(() => {
      this.shapeCacheRefreshTimer = null;
      this.refreshShapeCachesForZoom();
      this.canvas?.requestRenderAll();
    }, 150);
  }

  public setZoom(newZoom: number, pivotPoint?: { clientX?: number; clientY?: number }): void {
    if (!this.canvas) return;
    // Zoom is stored as a ratio: 1% = 0.01, 55% = 0.55, 100% = 1.00.
    // Quantizing here keeps every input path (wheel, buttons, keyboard and
    // direct percentage entry) on the same Canva-style one-percent scale.
    const clampedZoom = Math.min(
      Math.max(Math.round(newZoom * 100) / 100, 0.01),
      8.0
    );

    if (
      Math.abs(clampedZoom - this.zoom) < 0.001 &&
      this.pendingZoom === null &&
      this.zoomAnimationFrame === null
    ) {
      return;
    }

    this.pendingZoom = clampedZoom;
    if (pivotPoint && typeof pivotPoint.clientX === 'number' && typeof pivotPoint.clientY === 'number') {
      this.pendingZoomPivot = pivotPoint;
    }

    if (this.zoomAnimationFrame !== null) return;

    const applyZoom = () => {
      this.zoomAnimationFrame = null;

      if (!this.canvas || this.pendingZoom === null) return;

      const zoomToApply = this.pendingZoom;
      const pivot = this.pendingZoomPivot;
      this.pendingZoom = null;
      this.pendingZoomPivot = null;

      const oldZoom = this.zoom;
      const baseWidth = this.dimensions.widthPx || 1063;
      const baseHeight = this.dimensions.heightPx || 591;

      const targetWidth = Math.round(baseWidth * zoomToApply);
      const targetHeight = Math.round(baseHeight * zoomToApply);

      const viewport =
        this.viewportElement ||
        (this.canvas.wrapperEl
          ? (this.canvas.wrapperEl.closest('.overflow-auto') as HTMLElement | null)
          : null);
      const wrapperEl = (this.canvas as any).wrapperEl as HTMLElement | undefined;

      if (viewport && wrapperEl) {
        const viewportRect = viewport.getBoundingClientRect();
        const wrapperRect = wrapperEl.getBoundingClientRect();

        const clientX =
          pivot && typeof pivot.clientX === 'number'
            ? pivot.clientX
            : viewportRect.left + viewportRect.width / 2;
        const clientY =
          pivot && typeof pivot.clientY === 'number'
            ? pivot.clientY
            : viewportRect.top + viewportRect.height / 2;

        const mouseViewportX = clientX - viewportRect.left;
        const mouseViewportY = clientY - viewportRect.top;

        const safeOldZoom = Math.max(oldZoom, 0.01);
        const designX = (clientX - wrapperRect.left) / safeOldZoom;
        const designY = (clientY - wrapperRect.top) / safeOldZoom;

        this.canvas.setDimensions({
          width: targetWidth,
          height: targetHeight,
        });

        this.canvas.setZoom(zoomToApply);
        this.zoom = zoomToApply;

        const paddingX = 16;
        const paddingY = 16;
        const totalContentW = targetWidth + paddingX * 2;
        const totalContentH = targetHeight + paddingY * 2;

        if (totalContentW > viewport.clientWidth) {
          const targetScrollLeft = paddingX + designX * zoomToApply - mouseViewportX;
          viewport.scrollLeft = Math.max(0, targetScrollLeft);
        } else {
          viewport.scrollLeft = 0;
        }

        if (totalContentH > viewport.clientHeight) {
          const targetScrollTop = paddingY + designY * zoomToApply - mouseViewportY;
          viewport.scrollTop = Math.max(0, targetScrollTop);
        } else {
          viewport.scrollTop = 0;
        }
      } else {
        this.canvas.setDimensions({
          width: targetWidth,
          height: targetHeight,
        });

        this.canvas.setZoom(zoomToApply);
        this.zoom = zoomToApply;
      }

      this.scheduleShapeCacheRefresh();
      this.syncArtworkBoundaryLines();
      this.canvas.calcOffset();
      // setDimensions clears both Fabric canvas layers immediately. Deferring
      // the redraw with requestRenderAll() leaves one browser paint where the
      // white paper is visible, producing a white flash at every zoom step.
      // We are already inside requestAnimationFrame, so render synchronously
      // and commit the resized bitmap in this same frame.
      this.canvas.cancelRequestedRender();
      this.canvas.renderAll();
      this.notifyZoomThrottled();

      if (this.pendingZoom !== null && this.zoomAnimationFrame === null) {
        this.zoomAnimationFrame = requestAnimationFrame(applyZoom);
      }
    };

    this.zoomAnimationFrame = requestAnimationFrame(applyZoom);
  }

  public zoomIn(): void {
    const current = this.pendingZoom !== null ? this.pendingZoom : this.zoom;
    this.setZoom(Math.min(current + 0.01, 8.0));
  }

  public zoomOut(): void {
    const current = this.pendingZoom !== null ? this.pendingZoom : this.zoom;
    this.setZoom(Math.max(current - 0.01, 0.01));
  }

  public resetZoom(): void {
    if (this.zoomNotifyTrailingTimer !== null) {
      clearTimeout(this.zoomNotifyTrailingTimer);
      this.zoomNotifyTrailingTimer = null;
    }
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

    this.setZoom(Math.max(fitZoom, 0.01));
  }

  /**
   * Fabric objects can cross serialization, cloning and optimized bundle
   * boundaries where instanceof is not reliable. Always retain a type-name
   * fallback so reselected text continues to expose typography properties.
   */
  public isTextObject(
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

    const isLocked = getValue('isLocked') === true;
    const isText = this.isTextObject(fabricObject);

    if (isText) {
      fabricObject.set({
        objectCaching: false,
        noScaleCache: false,
        strokeUniform: true,
      });
    }

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
        ...(isText ? { editable: false } : {}),
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
        centeredScaling: false,
        hoverCursor:
          isText && (fabricObject as any).isEditing
            ? 'text'
            : 'move',
        moveCursor: 'move',
        ...(isText ? { editable: true } : {}),
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

  public updateUserGuide(id: string, posPx: number) {
    return this.guides.updateUserGuide(id, posPx);
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
    const maximumMarginMm = Math.max(
      0,
      Math.min(
        Number(this.dimensions.widthMm) || 0,
        Number(this.dimensions.heightMm) || 0
      ) / 2 - 0.1
    );

    const normalizedMarginMm = Number(
      Math.min(
        maximumMarginMm,
        Math.max(0, Number(marginMm) || 0)
      ).toFixed(1)
    );

    const dpi = this.dimensions.dpi || 300;
    const marginPx = Math.round(
      normalizedMarginMm * (dpi / 25.4)
    );

    this.dimensions = {
      ...this.dimensions,
      marginMm: normalizedMarginMm,
      marginPx,
      safeZoneMm: normalizedMarginMm,
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
          hoverCursor: 'move',
          moveCursor: 'move',
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
                preserveOriginalSize: true,
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
        }, { preserveOriginalSize: true });
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
        if (object.get('sourceType' as any) !== 'psd-layer') {
          object.set('sourceType' as any, 'vector-text');
        }
      }

      // Uploaded frame overlays already contain their complete visible
      // design. Remove any legacy/generated rectangular Fabric stroke without
      // changing the artwork inside the overlay.
      if (object instanceof Group && object.get('isCustomFrame' as any)) {
        object.set({
          stroke: 'transparent',
          strokeWidth: 0,
          strokeDashArray: null,
          dirty: true,
        });
        object.getObjects().forEach((child) => {
          child.set({
            stroke: 'transparent',
            strokeWidth: 0,
            strokeDashArray: null,
            dirty: true,
          });
        });
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
    const minimumCoverScale = Math.max(
      frameWidth / naturalWidth,
      frameHeight / naturalHeight
    );
    const preservedPhotoScale = Math.max(
      Number(metadata.framePhotoScale) || 0,
      0
    );
    const photoScale = photoFit === 'contain'
      ? Math.min(frameWidth / naturalWidth, frameHeight / naturalHeight)
      : Math.max(minimumCoverScale, preservedPhotoScale);

    let visibleSourceWidth = naturalWidth;
    let visibleSourceHeight = naturalHeight;
    let cropX = 0;
    let cropY = 0;

    if (photoFit === 'cover') {
      visibleSourceWidth = Math.min(naturalWidth, frameWidth / photoScale);
      visibleSourceHeight = Math.min(naturalHeight, frameHeight / photoScale);
      const cropCenterX =
        typeof metadata.frameCropCenterX === 'number' &&
          Number.isFinite(metadata.frameCropCenterX)
          ? metadata.frameCropCenterX
          : naturalWidth / 2;
      const cropCenterY =
        typeof metadata.frameCropCenterY === 'number' &&
          Number.isFinite(metadata.frameCropCenterY)
          ? metadata.frameCropCenterY
          : naturalHeight / 2;
      cropX = Math.min(
        Math.max(0, cropCenterX - visibleSourceWidth / 2),
        Math.max(0, naturalWidth - visibleSourceWidth)
      );
      cropY = Math.min(
        Math.max(0, cropCenterY - visibleSourceHeight / 2),
        Math.max(0, naturalHeight - visibleSourceHeight)
      );
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
      objectCaching: false,
      stroke: 'transparent',
      strokeWidth: 0,
      strokeDashArray: null,
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
      objectCaching: false,
      stroke: 'transparent',
      strokeWidth: 0,
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
      objectCaching: false,
      stroke: 'transparent',
      strokeWidth: 0,
      strokeDashArray: null,
    });
    overlay.set('frameRole' as any, 'overlay');

    const group = new Group([photo, overlay], {
      originX: 'center',
      originY: 'center',
      centeredScaling: false,
      cornerColor: '#ffffff',
      cornerStrokeColor: '#8b3dff',
      borderColor: '#8b3dff',
      cornerStyle: 'circle',
      cornerSize: 12,
      transparentCorners: false,
      objectCaching: false,
      // The uploaded overlay is the exact frame. Do not generate another
      // rectangular stroke around the custom frame Group.
      stroke: 'transparent',
      strokeWidth: 0,
      strokeDashArray: null,
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

        // Canva-style "cover": use one scale on both axes, then crop the
        // overflow. Independent X/Y scales distort the photo.
        const photoScale = Math.max(frameW / natW, frameH / natH);
        const visibleSourceWidth = Math.min(natW, frameW / photoScale);
        const visibleSourceHeight = Math.min(natH, frameH / photoScale);
        const cropX = Math.max(0, (natW - visibleSourceWidth) / 2);
        const cropY = Math.max(0, (natH - visibleSourceHeight) / 2);

        img.set({
          originX: 'center',
          originY: 'center',
          width: visibleSourceWidth,
          height: visibleSourceHeight,
          cropX,
          cropY,
          scaleX: photoScale,
          scaleY: photoScale,
          objectCaching: false,
        });

        // The mask changes the visible area; it never changes photo geometry.
        const clipPath = createFrameClipPath(
          shapeType,
          frameW / photoScale,
          frameH / photoScale
        );
        clipPath.set({
          originX: 'center',
          originY: 'center',
          absolutePositioned: false,
          objectCaching: false,
        });

        img.set({
          clipPath,
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
          objectCaching: false,
        });

        img.set('isFrame' as any, true);
        img.set('frameShape' as any, shapeType);
        img.set('isCanvaPlaceholder' as any, isPlaceholder);
        img.set('originalSrc' as any, defaultImg);
        img.set('naturalWidth' as any, natW);
        img.set('naturalHeight' as any, natH);
        img.set('photoFit' as any, 'cover');
        img.set('frameRole' as any, 'photo');

        // Built-in frames must use the same Group structure as filled/admin
        // frames. Otherwise Fabric scales the photo object itself and the live
        // crop-only resize handler cannot cancel X/Y stretching.
        const shapeOutline = createFrameClipPath(shapeType, frameW, frameH);
        shapeOutline.set({
          originX: 'center',
          originY: 'center',
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
          objectCaching: false,
        });
        shapeOutline.set('frameRole' as any, 'shape-outline');
        this.applyShapeOutlineProperty(shapeOutline, 'stroke', 'transparent');
        this.applyShapeOutlineProperty(shapeOutline, 'strokeWidth', 0);

        const frameName = `${preset.name} Frame`;
        const frameGroup = new Group([img, shapeOutline], {
          originX: 'center',
          originY: 'center',
          centeredScaling: false,
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
          objectCaching: false,
        });
        this.ensureObjectId(frameGroup, frameName);
        frameGroup.set('isFrame' as any, true);
        frameGroup.set('isShape' as any, true);
        frameGroup.set('isPhotoShapeGroup' as any, true);
        frameGroup.set('frameShape' as any, shapeType);
        frameGroup.set('shapeType' as any, shapeType);
        frameGroup.set('sourceType' as any, 'shape');
        frameGroup.set('photoFit' as any, 'cover');
        frameGroup.set('isCanvaPlaceholder' as any, isPlaceholder);
        frameGroup.set('originalSrc' as any, defaultImg);
        frameGroup.set('naturalWidth' as any, natW);
        frameGroup.set('naturalHeight' as any, natH);

        this.canvas.add(frameGroup);

        if (options?.left !== undefined && options?.top !== undefined) {
          frameGroup.set({ left: options.left, top: options.top });
          frameGroup.setCoords();
        } else {
          this.centerObjectOnCanvas(frameGroup);
        }

        this.canvas.setActiveObject(frameGroup);
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

        /*
         * CUSTOM SVG PHOTO SHAPE
         *
         * Do NOT physically crop the FabricImage by changing width/height/cropX/cropY.
         * That was causing Freepik/admin photos to lose half of their pixels before
         * the SVG clipPath was applied.
         *
         * Keep the complete source image, scale it proportionally with cover/contain,
         * centre it, and let ONLY the SVG clipPath decide what is visible.
         */
        const actualImageW = Math.max(Number(newImg.width) || 1, 1);
        const actualImageH = Math.max(Number(newImg.height) || 1, 1);

        // Prefer the dimensions Fabric actually decoded. Provider metadata can be
        // stale/different from the stored/proxied file and must not control clipping.
        const natW = actualImageW;
        const natH = actualImageH;

        const photoFit =
          metadata?.photoFit ||
          (frameObj.get('photoFit' as any) as 'cover' | 'contain') ||
          'cover';

        /*
         * The PHOTO must adopt the TARGET SHAPE'S visible box.
         * Fabric Group bounds include the whole image even when an image clipPath
         * hides most of it. If we keep the full Freepik bitmap behind the mask,
         * the selection/resize box follows the PHOTO dimensions instead of the
         * shape dimensions.
         *
         * For COVER, crop the SOURCE bitmap mathematically to the target shape's
         * aspect ratio first, then scale that cropped window exactly to the shape.
         * We use Fabric's actually decoded image width/height, not provider metadata.
         */
        let visibleSourceWidth = natW;
        let visibleSourceHeight = natH;
        let cropX = 0;
        let cropY = 0;
        let scaleFit = 1;

        if (photoFit === 'contain') {
          scaleFit = Math.min(
            targetScaledW / natW,
            targetScaledH / natH
          );
        } else {
          const targetAspect = targetScaledW / Math.max(targetScaledH, 0.000001);
          const imageAspect = natW / Math.max(natH, 0.000001);

          if (imageAspect > targetAspect) {
            // Source is wider than the shape: crop equal amounts from left/right.
            visibleSourceHeight = natH;
            visibleSourceWidth = natH * targetAspect;
            cropX = Math.max(0, (natW - visibleSourceWidth) / 2);
            cropY = 0;
          } else {
            // Source is taller than the shape: crop equal amounts from top/bottom.
            visibleSourceWidth = natW;
            visibleSourceHeight = natW / Math.max(targetAspect, 0.000001);
            cropX = 0;
            cropY = Math.max(0, (natH - visibleSourceHeight) / 2);
          }

          // Cropped photo window becomes EXACTLY the target shape dimensions.
          scaleFit = Math.max(
            targetScaledW / Math.max(visibleSourceWidth, 0.000001),
            targetScaledH / Math.max(visibleSourceHeight, 0.000001)
          );
        }

        /*
         * The SVG clip lives in the image's local coordinate system.
         * Its local dimensions therefore match the visible/cropped source window.
         */
        const clipW = targetScaledW / Math.max(scaleFit, 0.000001);
        const clipH = targetScaledH / Math.max(scaleFit, 0.000001);

        /*
         * getBoundingRect() already includes the SVG object's existing scale /
         * transform. Do NOT replace scaleX/scaleY with target/bounds directly:
         * doing that applies the SVG transform twice and produces the tiny
         * clipped photo seen inside a much larger selection box.
         *
         * Scale RELATIVE to the current rendered SVG bounds instead.
         */
        clipPath.setCoords();
        const clipBounds = clipPath.getBoundingRect();
        const clipRenderedW = Math.max(Number(clipBounds.width) || 1, 1);
        const clipRenderedH = Math.max(Number(clipBounds.height) || 1, 1);
        const clipBaseScaleX = Number(clipPath.scaleX) || 1;
        const clipBaseScaleY = Number(clipPath.scaleY) || 1;

        clipPath.set({
          originX: 'center',
          originY: 'center',
          angle: 0,
          fill: 'black',
          scaleX: clipBaseScaleX * (clipW / clipRenderedW),
          scaleY: clipBaseScaleY * (clipH / clipRenderedH),
          absolutePositioned: false,
          selectable: false,
          evented: false,
          objectCaching: false,
        } as any);
        clipPath.setPositionByOrigin(new Point(0, 0), 'center', 'center');
        clipPath.setCoords();

        newImg.set({
          originX: 'center',
          originY: 'center',
          left: 0,
          top: 0,
          angle: 0,

          // Critical: Fabric's object/group bounds now follow the SHAPE window,
          // not the original Freepik photo dimensions.
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
          objectCaching: false,
          noScaleCache: false,
        } as any);

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

        // Scale the outline RELATIVE to its current rendered SVG bounds.
        // SVG paths may already carry transforms; replacing scaleX/scaleY from
        // raw width/height makes the visible outline tiny inside the group.
        shapeOutline.setCoords();
        const outlineBoundsBeforeFit = shapeOutline.getBoundingRect();
        const outlineRenderedW = Math.max(Number(outlineBoundsBeforeFit.width) || 1, 1);
        const outlineRenderedH = Math.max(Number(outlineBoundsBeforeFit.height) || 1, 1);
        const outlineBaseScaleX = Number(shapeOutline.scaleX) || 1;
        const outlineBaseScaleY = Number(shapeOutline.scaleY) || 1;

        shapeOutline.set({
          angle: 0,
          scaleX: outlineBaseScaleX * (targetScaledW / outlineRenderedW),
          scaleY: outlineBaseScaleY * (targetScaledH / outlineRenderedH),
          selectable: false,
          evented: false,
          objectCaching: false,
        });
        shapeOutline.set({ originX: 'center', originY: 'center' });
        shapeOutline.setPositionByOrigin(new Point(0, 0), 'center', 'center');
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
          centeredScaling: false,
          left: centerPoint.x,
          top: centerPoint.y,
          angle,
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
          objectCaching: false,
          flipX: frameObj.flipX,
          flipY: frameObj.flipY,
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
        // Bake the rendered dimensions into the replacement. Keeping the old
        // scaleX/scaleY on the Group would stretch every child, including the
        // photo, and is the main cause of distorted frame images.
        const frameWidth = Math.max(frameObj.getScaledWidth(), 1);
        const frameHeight = Math.max(frameObj.getScaledHeight(), 1);
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
          scaleX: 1,
          scaleY: 1,
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

      const minimumCoverScale = Math.max(
        targetScaledW / natW,
        targetScaledH / natH
      );
      const preservedPhotoScale = Math.max(
        Number(metadata?.framePhotoScale) || 0,
        0
      );
      const scaleFit = photoFit === 'contain'
        ? Math.min(targetScaledW / natW, targetScaledH / natH)
        : Math.max(minimumCoverScale, preservedPhotoScale);
      let visibleSourceWidth = natW;
      let visibleSourceHeight = natH;
      let cropX = 0;
      let cropY = 0;

      if (photoFit === 'cover') {
        visibleSourceWidth = Math.min(natW, targetScaledW / scaleFit);
        visibleSourceHeight = Math.min(natH, targetScaledH / scaleFit);
        const cropCenterX =
          typeof metadata?.frameCropCenterX === 'number' &&
            Number.isFinite(metadata.frameCropCenterX)
            ? metadata.frameCropCenterX
            : natW / 2;
        const cropCenterY =
          typeof metadata?.frameCropCenterY === 'number' &&
            Number.isFinite(metadata.frameCropCenterY)
            ? metadata.frameCropCenterY
            : natH / 2;
        cropX = Math.min(
          Math.max(0, cropCenterX - visibleSourceWidth / 2),
          Math.max(0, natW - visibleSourceWidth)
        );
        cropY = Math.min(
          Math.max(0, cropCenterY - visibleSourceHeight / 2),
          Math.max(0, natH - visibleSourceHeight)
        );
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
        objectCaching: false,
      });

      // Generate matching centered clipPath matching exact frame dimensions
      const clipPath = createFrameClipPath(shapeType, clipW, clipH);
      clipPath.set({
        originX: 'center',
        originY: 'center',
        absolutePositioned: false,
        objectCaching: false,
      });
      // Guarantee the clip shape is centred at (0,0) in the image's local space
      // regardless of how the shape was constructed.
      clipPath.setPositionByOrigin(new Point(0, 0), 'center', 'center');
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
        objectCaching: false,
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
        centeredScaling: false,
        left: centerPoint.x,
        top: centerPoint.y,
        angle,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,
        objectCaching: false,
        flipX: frameObj.flipX,
        flipY: frameObj.flipY,
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
      photoShapeGroup.set(
        'isCanvaPlaceholder' as any,
        newImageUrl === CANVA_FRAME_PLACEHOLDER_SVG
      );
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

  private getFramePhotoObject(frameObj: FabricObject): FabricImage | null {
    if (frameObj instanceof FabricImage) return frameObj;

    if (frameObj instanceof Group) {
      const photo = frameObj.getObjects().find(
        (child) =>
          child instanceof FabricImage &&
          child.get('frameRole' as any) === 'photo'
      );
      return (photo as FabricImage | undefined) || null;
    }

    return null;
  }

  /**
   * Resolve the edge/corner opposite the control being dragged. Keeping this
   * point fixed gives Canva-style one-sided resizing, even for rotated frames.
   */
  private getFrameResizeAnchor(
    frameObj: FabricObject,
    corner?: string
  ): Pick<
    FrameResizeSnapshot,
    'anchorX' | 'anchorY' | 'anchorOriginX' | 'anchorOriginY'
  > | null {
    const anchors: Record<
      string,
      {
        x: 'left' | 'center' | 'right';
        y: 'top' | 'center' | 'bottom';
      }
    > = {
      ml: { x: 'right', y: 'center' },
      mr: { x: 'left', y: 'center' },
      mt: { x: 'center', y: 'bottom' },
      mb: { x: 'center', y: 'top' },
      tl: { x: 'right', y: 'bottom' },
      tr: { x: 'left', y: 'bottom' },
      bl: { x: 'right', y: 'top' },
      br: { x: 'left', y: 'top' },
    };

    const origin = corner ? anchors[corner] : undefined;
    if (!origin) return null;

    const point = frameObj.getPositionByOrigin(origin.x, origin.y);
    return {
      anchorX: point.x,
      anchorY: point.y,
      anchorOriginX: origin.x,
      anchorOriginY: origin.y,
    };
  }

  /** Restore the untouched edge after any custom Fabric control calculation. */
  private keepFrameResizeAnchor(frameObj: FabricObject): void {
    const snapshot = this.frameResizeSnapshots.get(frameObj);
    const anchorX = snapshot?.anchorX;
    const anchorY = snapshot?.anchorY;
    if (
      !snapshot ||
      typeof anchorX !== 'number' ||
      !Number.isFinite(anchorX) ||
      typeof anchorY !== 'number' ||
      !Number.isFinite(anchorY) ||
      !snapshot.anchorOriginX ||
      !snapshot.anchorOriginY
    ) {
      return;
    }

    frameObj.setPositionByOrigin(
      new Point(anchorX, anchorY),
      snapshot.anchorOriginX,
      snapshot.anchorOriginY
    );
  }

  /** Capture the photo geometry before Fabric starts scaling the frame Group. */
  private rememberFrameResizeState(
    frameObj: FabricObject,
    corner?: string
  ): void {
    if (!frameObj) return;

    const existing = this.frameResizeSnapshots.get(frameObj);
    if (existing) {
      // mouse:down can occur before Fabric exposes the active control. Fill
      // the fixed anchor on the first scaling event when necessary.
      if (
        (typeof existing.anchorX !== 'number' ||
          !Number.isFinite(existing.anchorX)) &&
        corner
      ) {
        const anchor = this.getFrameResizeAnchor(frameObj, corner);
        if (anchor) Object.assign(existing, anchor);
      }
      return;
    }

    const photo = this.getFramePhotoObject(frameObj);
    const naturalWidth =
      Number(frameObj.get('naturalWidth' as any)) || photo?.width || frameObj.width || 1;
    const naturalHeight =
      Number(frameObj.get('naturalHeight' as any)) || photo?.height || frameObj.height || 1;
    const groupScale =
      photo === frameObj
        ? 1
        : Math.min(
          Math.abs(Number(frameObj.scaleX) || 1),
          Math.abs(Number(frameObj.scaleY) || 1)
        );
    const photoScale = photo
      ? Math.max(Math.abs(Number(photo.scaleX) || 1) * groupScale, 0.0001)
      : Math.max(Math.abs(Number(frameObj.scaleX) || 1), 0.0001);
    const visibleWidth = photo
      ? Math.min(Number(photo.width) || naturalWidth, naturalWidth)
      : naturalWidth;
    const visibleHeight = photo
      ? Math.min(Number(photo.height) || naturalHeight, naturalHeight)
      : naturalHeight;
    const cropX = photo ? Math.max(0, Number(photo.cropX) || 0) : 0;
    const cropY = photo ? Math.max(0, Number(photo.cropY) || 0) : 0;
    const anchor = this.getFrameResizeAnchor(frameObj, corner);

    this.frameResizeSnapshots.set(frameObj, {
      photoScale,
      cropCenterX: cropX + visibleWidth / 2,
      cropCenterY: cropY + visibleHeight / 2,
      naturalWidth,
      naturalHeight,
      ...(anchor || {}),
    });
  }

  /**
   * Keep the photo visually undistorted while a Group side handle is moving.
   * The Group may have different X/Y scales during Fabric's transform, so the
   * photo receives the inverse scale and its clipPath follows the new viewport.
   */
  private previewFrameCropDuringScale(frameObj: FabricObject): void {
    if (!(frameObj instanceof Group)) return;

    if (!this.frameResizeSnapshots.has(frameObj)) {
      this.rememberFrameResizeState(frameObj);
    }

    const snapshot = this.frameResizeSnapshots.get(frameObj);
    const photo = this.getFramePhotoObject(frameObj);
    if (!snapshot || !photo) return;

    const groupScaleX = Math.max(Math.abs(Number(frameObj.scaleX) || 1), 0.0001);
    const groupScaleY = Math.max(Math.abs(Number(frameObj.scaleY) || 1), 0.0001);
    const desiredWidth = Math.max(frameObj.getScaledWidth(), 1);
    const desiredHeight = Math.max(frameObj.getScaledHeight(), 1);

    // Cancel the Group's non-uniform scale only for the photo content.
    photo.set({
      scaleX: snapshot.photoScale / groupScaleX,
      scaleY: snapshot.photoScale / groupScaleY,
      objectCaching: false,
    });

    const clipPath = photo.clipPath as FabricObject | undefined;
    if (clipPath) {
      clipPath.set({
        scaleX:
          desiredWidth /
          snapshot.photoScale /
          Math.max(Number(clipPath.width) || 1, 1),
        scaleY:
          desiredHeight /
          snapshot.photoScale /
          Math.max(Number(clipPath.height) || 1, 1),
        objectCaching: false,
      });
      clipPath.setCoords();
    }

    photo.setCoords();
    frameObj.set('dirty' as any, true);
  }

  /**
   * Fabric resizes Groups by changing scaleX/scaleY, which also stretches a
   * clipped photo. Rebuild the mask at its rendered dimensions while retaining
   * the photo's previous scale and crop focus. Shrinking the frame therefore
   * hides more of the photo instead of shrinking or stretching it.
   */
  private async normalizeFrameTransform(
    frameObj: FabricObject
  ): Promise<boolean> {
    if (
      !this.canvas ||
      this.isNormalizingFrameTransform ||
      !Boolean(frameObj.get('isFrame' as any))
    ) {
      return false;
    }

    const scaleX = Math.abs(Number(frameObj.scaleX) || 1);
    const scaleY = Math.abs(Number(frameObj.scaleY) || 1);

    if (Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001) {
      this.frameResizeSnapshots.delete(frameObj);
      return false;
    }

    const sourceUrl = frameObj.get('originalSrc' as any) as string;
    if (!sourceUrl) {
      this.frameResizeSnapshots.delete(frameObj);
      return false;
    }

    const snapshot = this.frameResizeSnapshots.get(frameObj);

    this.isNormalizingFrameTransform = true;

    try {
      const replacement = await this.slotImageIntoFrame(frameObj, sourceUrl, {
        naturalWidth:
          snapshot?.naturalWidth ||
          Number(frameObj.get('naturalWidth' as any)) ||
          undefined,
        naturalHeight:
          snapshot?.naturalHeight ||
          Number(frameObj.get('naturalHeight' as any)) ||
          undefined,
        fileSizeBytes:
          Number(frameObj.get('fileSizeBytes' as any)) || undefined,
        originalSrc: sourceUrl,
        name: (frameObj.get('name' as any) as string) || 'Photo Frame',
        photoFit: 'cover',
        provider: frameObj.get('provider' as any) as string,
        providerAssetId: frameObj.get('providerAssetId' as any) as string,
        framePhotoScale: snapshot?.photoScale,
        frameCropCenterX: snapshot?.cropCenterX,
        frameCropCenterY: snapshot?.cropCenterY,
      });

      return Boolean(replacement);
    } finally {
      this.isNormalizingFrameTransform = false;
      this.frameResizeSnapshots.delete(frameObj);
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
      // Map generic 'rect' / 'rectangle' to our 'rect' type (sharp rectangle)
      // rather than 'rounded-rect' so the correct clip shape is generated.
      if (clean === 'rect' || clean === 'rectangle') return 'rect';
      return clean as FrameShapeType;
    }

    const type = (obj.type || '').toLowerCase();
    if (type === 'circle') return 'circle';
    if (type === 'triangle') return 'triangle';
    if (type === 'rect') {
      const rect = obj as Rect;
      // Only use 'rounded-rect' when the shape explicitly has large rounded corners.
      // A plain Rect (rx === 0 or very small) should be treated as 'rect'.
      if (rect.rx && rect.rx > 8) return 'rounded-rect';
      const w = obj.getScaledWidth();
      const h = obj.getScaledHeight();
      return Math.abs(w - h) < 10 ? 'square' : 'rect';
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
    options?: ImagePlacementOptions
  ): Promise<FabricImage | null> {
    if (!this.canvas) return null;

    // Canva Frame & Shape automatic slotting:
    // If a shape or frame is currently selected, or if an empty placeholder frame exists on the canvas,
    // slot this image directly into the shape/frame so it catches its size and shape mask!
    // IMPORTANT:
    // skipFrameSlotting must disable ALL automatic shape/frame slotting,
    // including the currently selected shape. Previously a selected shape
    // bypassed this flag, so clicking a Freepik image unexpectedly replaced
    // the shape and made the inserted image appear much smaller.
    //
    // Explicit drag-hover/drop still calls fitImageIntoShape() directly and
    // therefore continues to fill the hovered shape/frame.
    if (!(options as any)?.isFrame && !options?.skipFrameSlotting) {
      const activeObj = this.canvas.getActiveObject();
      let targetFrame: FabricObject | null | undefined = null;

      if (activeObj && (activeObj.get('isFrame' as any) || this.isShapeObject(activeObj))) {
        targetFrame = activeObj;
      } else {
        const objects = this.canvas.getObjects();
        targetFrame = objects.find(
          (obj) =>
            obj.get('isFrame' as any) &&
            Boolean(obj.get('isCanvaPlaceholder' as any))
        );
      }

      if (
        targetFrame &&
        (targetFrame.get('isFrame' as any) || this.isShapeObject(targetFrame))
      ) {
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

      const naturalW = metadata?.naturalWidth || svgNormWidth || img.width || 400;
      const naturalH = metadata?.naturalHeight || svgNormHeight || img.height || 300;

      // Library drag/drop commonly transfers only the CDN URL. Detect the
      // supported providers so click insertion and drag/drop size identically.
      const provider = String(metadata?.provider || '').toLowerCase();
      const isSupportedLibraryProvider = [
        'pexels',
        'pixabay',
        'freepik',
      ].includes(provider);
      const isSupportedLibraryUrl =
        /^https?:\/\/(?:[^/]+\.)?(?:pexels|pixabay|freepik|flaticon)\.com\//i.test(
          url.trim()
        );

      const isSvgImage = isSvg(url) || isSvg(safeUrl);
      const isExcludedAsset =
        isSvgImage ||
        metadata?.sourceType === 'frame-overlay' ||
        metadata?.sourceType === 'icon' ||
        (metadata as any)?.isIcon === true ||
        (options as any)?.isFrame === true ||
        Boolean(metadata?.maskUrl);

      // Centralized image-placement rule:
      // Fit new raster images inside artwork with minimum 20 mm inset on every side.
      // Default to 20 mm for ordinary raster images so any caller without options
      // also receives the same 20 mm placement rule.
      const requestedInsetMm = Number(
        options?.fitToArtworkInsetMm ??
        (isSupportedLibraryProvider || isSupportedLibraryUrl || (!isExcludedAsset && !options?.preserveOriginalSize)
          ? 20
          : Number.NaN)
      );
      const shouldFitToArtwork =
        Number.isFinite(requestedInsetMm) && requestedInsetMm >= 0;

      let scale: number;

      if (shouldFitToArtwork) {
        const dpi = Math.max(Number(this.dimensions.dpi) || 300, 1);
        const pxPerMm = dpi / 25.4;

        // Never allow the inset to collapse a small artwork to zero or a
        // negative size. Keep at least a 1 mm target area on each axis.
        // Example: a 52 x 30 mm artwork cannot physically have a full 20 mm
        // inset on every side, so the inset is reduced safely for that size.
        const minimumTargetPx = pxPerMm;
        const maximumInsetPx = Math.max(
          0,
          (Math.min(canvasW, canvasH) - minimumTargetPx) / 2
        );
        const requestedInsetPx = requestedInsetMm * pxPerMm;
        const insetPx = Math.min(requestedInsetPx, maximumInsetPx);
        const availableWidth = Math.max(1, canvasW - insetPx * 2);
        const availableHeight = Math.max(1, canvasH - insetPx * 2);

        // Preserve aspect ratio and scale using contain behavior:
        // Large images scale down, small images scale up.
        scale = Math.min(
          availableWidth / Math.max(naturalW, 1),
          availableHeight / Math.max(naturalH, 1)
        );
      } else if (options?.preserveOriginalSize === true) {
        scale = 1;
      } else {
        const maxDisplayWidth = canvasW * 0.6;
        const maxDisplayHeight = canvasH * 0.6;

        scale = Math.min(
          maxDisplayWidth / Math.max(naturalW, 1),
          maxDisplayHeight / Math.max(naturalH, 1),
          1.0
        );
      }

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
      if (metadata?.provider) {
        img.set('provider' as any, metadata.provider);
      }
      if (metadata?.providerAssetId !== undefined) {
        img.set('providerAssetId' as any, String(metadata.providerAssetId));
      }
      this.ensureObjectId(img, metadata?.name || 'Image Layer');

      this.canvas.add(img);

      if (shouldFitToArtwork || (options?.left === undefined && options?.top === undefined)) {
        this.centerObjectOnCanvas(img);
      } else {
        if (options?.left !== undefined) img.set('left', options.left);
        if (options?.top !== undefined) img.set('top', options.top);
        img.setCoords();
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

  /**
   * Imports a fully parsed PSD document into the Fabric canvas.
   *
   * Preserves layer hierarchy, ordering, visibility, opacity, blend modes,
   * typography for editable text, and Canva controls for all imported objects.
   * Scales proportionally to fit the artwork and centers the result.
   * Executes in a single history transaction and issues single batch notifications.
   */
  public async importPsdDocument(
    document: ImportedPsdDocument,
    options?: PsdImportOptions
  ): Promise<void> {
    if (!this.canvas) return;

    this.enableSelectionMode();
    this.canvas.discardActiveObject();

    if (options?.clearCanvas) {
      const existing = [...this.canvas.getObjects()];
      existing.forEach((obj) => {
        if (!obj.get('isGuide' as any) && !obj.get('isPrintGuide' as any) && !obj.get('isRulerGuide' as any)) {
          this.canvas?.remove(obj);
        }
      });
    }

    const canvasW = this.dimensions.widthPx || 1000;
    const canvasH = this.dimensions.heightPx || 1000;
    const psdW = Math.max(1, document.width || 1000);
    const psdH = Math.max(1, document.height || 1000);

    let scale = 1;
    if (options?.fitToArtwork !== false) {
      scale = Math.min(canvasW / psdW, canvasH / psdH);
    }

    const scaledPsdW = psdW * scale;
    const scaledPsdH = psdH * scale;
    const offsetX = (canvasW - scaledPsdW) / 2;
    const offsetY = (canvasH - scaledPsdH) / 2;

    const addedObjects: FabricObject[] = [];

    const convertLayerToObject = async (
      layer: ImportedPsdLayer,
      parentId?: string
    ): Promise<FabricObject | null> => {
      const layerLeft = offsetX + layer.left * scale;
      const layerTop = offsetY + layer.top * scale;
      const layerWidth = Math.max(1, layer.width * scale);

      const rawBlend = String(layer.blendMode || 'normal').toLowerCase();
      const compositeOp: GlobalCompositeOperation =
        PSD_TO_CANVAS_BLEND_MODES[rawBlend] || 'source-over';

      // 1. Group Layer
      if (layer.type === 'group' && Array.isArray(layer.children) && layer.children.length > 0) {
        const childFabricObjects: FabricObject[] = [];
        for (const childLayer of layer.children) {
          const childObj = await convertLayerToObject(childLayer, layer.id);
          if (childObj) {
            childFabricObjects.push(childObj);
          }
        }

        if (childFabricObjects.length === 0) return null;

        try {
          const group = new Group(childFabricObjects, {
            subTargetCheck: true,
            opacity: layer.opacity,
            visible: layer.visible,
          });

          group.set('sourceType' as any, 'psd-layer');
          group.set('psdLayerId' as any, layer.id);
          group.set('psdLayerName' as any, layer.name);
          group.set('psdLayerType' as any, 'group');
          group.set('psdParentId' as any, parentId || null);
          group.set('psdBlendMode' as any, layer.blendMode || 'normal');
          group.set('psdDocumentId' as any, document.name);
          group.set('globalCompositeOperation', compositeOp);

          this.ensureObjectId(group, layer.name);
          return group;
        } catch (groupErr) {
          console.warn('Could not construct Fabric group, adding children individually:', groupErr);
          for (const c of childFabricObjects) {
            this.canvas?.add(c);
            addedObjects.push(c);
          }
          return null;
        }
      }

      // 2. Editable Text Layer
      if (layer.type === 'text' && layer.text) {
        const textData = layer.text;
        const fontSize = Math.max(6, Math.round(textData.fontSize * scale));
        const fontItem = POPULAR_FONTS.find(
          (f) => f.family === textData.fontFamily || f.name === textData.fontFamily
        );
        if (fontItem) {
          try {
            await loadFont(fontItem);
          } catch {
            // Fallback font
          }
        }

        const artworkDpi = Math.max(72, Number(this.dimensions.dpi) || 96);
        const fontSizePt = (fontSize * 72) / artworkDpi;

        const textbox = new Textbox(textData.text || '', {
          left: layerLeft,
          top: layerTop,
          width: layerWidth,
          fontSize,
          fontFamily: textData.fontFamily || 'Inter, sans-serif',
          fontWeight: textData.fontWeight || 'normal',
          fontStyle: (textData.fontStyle as any) || 'normal',
          fill: textData.fill || '#0f172a',
          textAlign: textData.textAlign || 'left',
          opacity: layer.opacity,
          visible: layer.visible,
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
          padding: 6,
          hoverCursor: 'move',
          moveCursor: 'move',
          objectCaching: false,
          noScaleCache: false,
          strokeUniform: true,
        });

        textbox.set('fontSizePt' as any, fontSizePt);
        textbox.set('sourceType' as any, 'psd-layer');
        textbox.set('psdLayerId' as any, layer.id);
        textbox.set('psdLayerName' as any, layer.name);
        textbox.set('psdLayerType' as any, 'text');
        textbox.set('psdParentId' as any, parentId || null);
        textbox.set('psdBlendMode' as any, layer.blendMode || 'normal');
        textbox.set('psdDocumentId' as any, document.name);
        textbox.set('psdRasterized' as any, false);
        textbox.set('globalCompositeOperation', compositeOp);

        this.ensureObjectId(textbox, layer.name);
        textbox.setCoords();
        return textbox;
      }

      // 3. Raster Image Layer (including rasterized text, Smart Objects, adjustment layers)
      const imageSrc = layer.imageUrl || (layer.imageBlob ? URL.createObjectURL(layer.imageBlob) : null);
      if (!imageSrc) return null;

      try {
        let safeSrc = await urlToSafeDataUrl(imageSrc);
        let img: FabricImage;
        try {
          img = await FabricImage.fromURL(safeSrc, { crossOrigin: 'anonymous' });
        } catch {
          img = await new Promise<FabricImage>((resolve, reject) => {
            const el = new Image();
            el.crossOrigin = 'anonymous';
            el.onload = () => resolve(new FabricImage(el));
            el.onerror = () => reject(new Error(`Failed to load PSD layer image: ${layer.name}`));
            el.src = safeSrc;
          });
        }

        img.set({
          left: layerLeft,
          top: layerTop,
          scaleX: scale,
          scaleY: scale,
          opacity: layer.opacity,
          visible: layer.visible,
          cornerColor: '#ffffff',
          cornerStrokeColor: '#8b3dff',
          borderColor: '#8b3dff',
          cornerStyle: 'circle',
          cornerSize: 12,
          transparentCorners: false,
          lockUniScaling: false,
        });

        img.set('sourceType' as any, 'psd-layer');
        img.set('psdLayerId' as any, layer.id);
        img.set('psdLayerName' as any, layer.name);
        img.set('psdLayerType' as any, 'image');
        img.set('psdParentId' as any, parentId || null);
        img.set('psdBlendMode' as any, layer.blendMode || 'normal');
        img.set('psdDocumentId' as any, document.name);
        img.set('originalSrc' as any, layer.imageUrl || '');
        img.set('psdRasterized' as any, Boolean(layer.psdRasterized));
        img.set('psdRasterizeReason' as any, layer.psdRasterizeReason || '');
        img.set('globalCompositeOperation', compositeOp);

        this.ensureObjectId(img, layer.name);
        img.setCoords();
        return img;
      } catch (imgError) {
        console.warn(`Could not render PSD layer "${layer.name}":`, imgError);
        return null;
      }
    };

    // Sequential preparation preserving exact PSD bottom-to-top layer order
    for (const layer of document.layers) {
      const obj = await convertLayerToObject(layer);
      if (obj) {
        this.canvas.add(obj);
        addedObjects.push(obj);
      }
    }

    // Refresh coordinates and interactivity across any zoom level
    this.refreshCanvasInteractivity();

    // Select the uppermost visible imported object if available
    const selectableObjs = addedObjects.filter((o) => o.visible && !o.get('isGuide' as any));
    if (selectableObjs.length > 0) {
      this.canvas.setActiveObject(selectableObjs[selectableObjs.length - 1]);
    }

    // Perform single final render
    this.canvas.requestRenderAll();

    // Save history once for the complete import (enables 1-click Undo)
    this.saveHistoryState();

    // Single final event notifications
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
    this.notifyPreflight();
  }

  public async replaceActiveImage(newUrl: string, metadata?: ImageMetadata): Promise<void> {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active || !(active instanceof FabricImage)) return;

    if (active.get('isFrame' as any)) {
      await this.slotImageIntoFrame(active, newUrl, metadata);
      return;
    }

    try {
      const prevName = active.get('name' as any);
      this.canvas.remove(active);

      await this.addImageFromUrl(
        newUrl,
        {
          name: metadata?.name || prevName || 'Image Layer',
          ...metadata,
        },
        {
          fitToArtworkInsetMm: 20,
          skipFrameSlotting: true,
        }
      );
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
      'strokePosition',
      'baseStrokeWidth',
      'strokeDashArray',
      'strokeLineCap',
      'strokeLineJoin',
    ]);

    // Generic group styling applies strokes to image children and creates an
    // unwanted rectangular border. Uploaded custom frames are intentionally
    // stroke-free because their overlay asset is already the complete frame.
    if (
      root instanceof Group &&
      root.get('isCustomFrame' as any) &&
      shapeBorderProperties.has(prop)
    ) {
      root.set({
        stroke: 'transparent',
        strokeWidth: 0,
        strokeDashArray: null,
        dirty: true,
      });
      root.getObjects().forEach((child) => {
        child.set({
          stroke: 'transparent',
          strokeWidth: 0,
          strokeDashArray: null,
          dirty: true,
        });
        child.setCoords();
      });
      return;
    }

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
        if (!isImage) {
          if (typeof value === 'object' && value !== null && 'stops' in value) {
            const config = value as DesignerGradientValue;
            const safeStops = config.stops
              .filter((s) => typeof s.color === 'string')
              .map((s) => ({
                offset: Math.max(0, Math.min(1, Number(s.offset) || 0)),
                color: s.color,
              }))
              .sort((a, b) => a.offset - b.offset);

            if (safeStops.length >= 2) {
              const width = Math.max(obj.width || 1, 1);
              const height = Math.max(obj.height || 1, 1);
              const centerX = width / 2;
              const centerY = height / 2;
              const angleRadians = ((Number(config.angle) || 0) - 90) * Math.PI / 180;
              const radius = Math.sqrt(width * width + height * height) / 2;

              const gradient = config.type === 'radial'
                ? new Gradient({
                  type: 'radial',
                  gradientUnits: 'pixels',
                  coords: {
                    x1: centerX,
                    y1: centerY,
                    r1: 0,
                    x2: centerX,
                    y2: centerY,
                    r2: radius,
                  },
                  colorStops: safeStops,
                })
                : new Gradient({
                  type: 'linear',
                  gradientUnits: 'pixels',
                  coords: {
                    x1: centerX - Math.cos(angleRadians) * radius,
                    y1: centerY - Math.sin(angleRadians) * radius,
                    x2: centerX + Math.cos(angleRadians) * radius,
                    y2: centerY + Math.sin(angleRadians) * radius,
                  },
                  colorStops: safeStops,
                });

              obj.set({ fill: gradient, dirty: true });
              obj.setCoords();
            }
          } else {
            obj.set({ fill: value as string, dirty: true });
          }
        }
      } else if (prop === 'stroke') {
        const pos = (obj.get('strokePosition' as any) as 'inside' | 'outside') || 'inside';
        obj.set({
          stroke: value as string,
          strokeUniform: true,
          paintFirst: pos === 'outside' ? 'stroke' : 'fill',
          dirty: true,
        });
      } else if (prop === 'strokeWidth') {
        const baseW = Math.max(0, Number(value) || 0);
        const pos = (obj.get('strokePosition' as any) as 'inside' | 'outside') || 'inside';
        obj.set('baseStrokeWidth' as any, baseW);
        obj.set({
          strokeWidth: pos === 'outside' && baseW > 0 ? baseW * 2 : baseW,
          strokeUniform: true,
          paintFirst: pos === 'outside' ? 'stroke' : 'fill',
          dirty: true,
        });
      } else if (prop === 'strokePosition') {
        const pos = value === 'outside' ? 'outside' : 'inside';
        obj.set('strokePosition' as any, pos);
        const baseW = typeof obj.get('baseStrokeWidth' as any) === 'number'
          ? (obj.get('baseStrokeWidth' as any) as number)
          : (obj.paintFirst === 'stroke' && obj.strokeWidth ? Math.round(obj.strokeWidth / 2) : (obj.strokeWidth || 0));
        obj.set('baseStrokeWidth' as any, baseW);
        obj.set({
          strokeWidth: pos === 'outside' && baseW > 0 ? baseW * 2 : baseW,
          strokeUniform: true,
          paintFirst: pos === 'outside' ? 'stroke' : 'fill',
          dirty: true,
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
        textObject.set({ fontSize: nextFontSize, dirty: true });
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

      if (isText) {
        const textObj = obj as Textbox | IText;
        const prevWidth = textObj.width;
        textObj.set('dirty', true);
        textObj.initDimensions?.();
        if (textObj instanceof Textbox && prevWidth) {
          textObj.set('width', prevWidth);
          textObj.initDimensions?.();
        }
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
        const baseW = Math.max(0, Number(value) || 0);
        const pos = (object.get('strokePosition' as any) as 'inside' | 'outside') || 'inside';
        object.set('baseStrokeWidth' as any, baseW);
        object.set('strokeWidth', pos === 'outside' && baseW > 0 ? baseW * 2 : baseW);
        object.set('paintFirst', pos === 'outside' ? 'stroke' : 'fill');
      } else if (prop === 'strokePosition') {
        const pos = value === 'outside' ? 'outside' : 'inside';
        object.set('strokePosition' as any, pos);
        const baseW = typeof object.get('baseStrokeWidth' as any) === 'number'
          ? (object.get('baseStrokeWidth' as any) as number)
          : (object.strokeWidth || 0);
        object.set('baseStrokeWidth' as any, baseW);
        object.set('strokeWidth', pos === 'outside' && baseW > 0 ? baseW * 2 : baseW);
        object.set('paintFirst', pos === 'outside' ? 'stroke' : 'fill');
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

  /**
   * Applies a real Fabric gradient to the selected vector shape. Each SVG leaf
   * gets coordinates based on its own local bounds, so grouped/multi-path SVGs
   * render sharply and the gradient survives Fabric JSON and vector export.
   */
  public setSelectedGradient(
    config: {
      type: 'linear' | 'radial';
      angle: number;
      stops: Array<{ offset: number; color: string }>;
    },
    isLivePreview: boolean = false
  ): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;
    // Do not apply gradients to normal raster image pixels or frames filled with photos
    if (active instanceof FabricImage || active.type === 'image') return;
    const isPhotoFrame = Boolean(active.get('isPhotoShapeGroup' as any)) && !Boolean(active.get('isCanvaPlaceholder' as any));
    if (isPhotoFrame) return;

    const safeStops = config.stops
      .filter((stop) => typeof stop.color === 'string')
      .map((stop) => ({
        offset: Math.max(0, Math.min(1, Number(stop.offset) || 0)),
        color: stop.color,
      }))
      .sort((a, b) => a.offset - b.offset);

    if (safeStops.length < 2) return;

    const applyGradient = (object: FabricObject): void => {
      if (object instanceof Group || object instanceof ActiveSelection) {
        object.getObjects().forEach(applyGradient);
        object.set('dirty', true);
        return;
      }

      // Raster photos inside photo-shape groups must remain unchanged.
      if (object instanceof FabricImage || object.type === 'image') return;
      if (object.get('frameRole' as any) === 'shape-outline') return;

      const width = Math.max(object.width || 1, 1);
      const height = Math.max(object.height || 1, 1);
      const centerX = width / 2;
      const centerY = height / 2;
      const angleRadians = ((Number(config.angle) || 0) - 90) * Math.PI / 180;
      const radius = Math.sqrt(width * width + height * height) / 2;

      const gradient = config.type === 'radial'
        ? new Gradient({
          type: 'radial',
          gradientUnits: 'pixels',
          coords: {
            x1: centerX,
            y1: centerY,
            r1: 0,
            x2: centerX,
            y2: centerY,
            r2: radius,
          },
          colorStops: safeStops,
        })
        : new Gradient({
          type: 'linear',
          gradientUnits: 'pixels',
          coords: {
            x1: centerX - Math.cos(angleRadians) * radius,
            y1: centerY - Math.sin(angleRadians) * radius,
            x2: centerX + Math.cos(angleRadians) * radius,
            y2: centerY + Math.sin(angleRadians) * radius,
          },
          colorStops: safeStops,
        });

      object.set({ fill: gradient, dirty: true });
      object.setCoords();
    };

    applyGradient(active);
    active.set('dirty', true);
    active.setCoords();
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    if (!isLivePreview) {
      this.notifyLayers();
      this.saveHistoryState();
    }
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
    else if (prop === 'fill') {
      if (typeof value === 'object' && value !== null && 'stops' in value) {
        this.setSelectedGradient(value as any, false);
        return;
      }
      active.set('fill', value as string);
    }
    else if (prop === 'stroke') {
      active.set('stroke', value as string);
      active.set('strokeUniform', true);
      const pos = (active.get('strokePosition' as any) as 'inside' | 'outside') || 'inside';
      active.set('paintFirst', pos === 'outside' ? 'stroke' : 'fill');
    } else if (prop === 'strokeWidth') {
      const baseW = Math.max(0, Number(value) || 0);
      const pos = (active.get('strokePosition' as any) as 'inside' | 'outside') || 'inside';
      active.set('baseStrokeWidth' as any, baseW);
      active.set('strokeWidth', pos === 'outside' && baseW > 0 ? baseW * 2 : baseW);
      active.set('strokeUniform', true);
      active.set('paintFirst', pos === 'outside' ? 'stroke' : 'fill');
    } else if (prop === 'strokePosition') {
      const pos = value === 'outside' ? 'outside' : 'inside';
      active.set('strokePosition' as any, pos);
      const baseW = typeof active.get('baseStrokeWidth' as any) === 'number'
        ? (active.get('baseStrokeWidth' as any) as number)
        : (active.paintFirst === 'stroke' && active.strokeWidth ? Math.round(active.strokeWidth / 2) : (active.strokeWidth || 0));
      active.set('baseStrokeWidth' as any, baseW);
      active.set('strokeWidth', pos === 'outside' && baseW > 0 ? baseW * 2 : baseW);
      active.set('strokeUniform', true);
      active.set('paintFirst', pos === 'outside' ? 'stroke' : 'fill');
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
          const roundedClipPath = new Rect({
            width: w,
            height: h,
            rx: unscaledRx,
            ry: unscaledRy,
            originX: 'center',
            originY: 'center',
            objectCaching: false,
          });
          roundedClipPath.set('dirty', true);
          roundedClipPath.setCoords();
          active.clipPath = roundedClipPath;
        } else {
          active.clipPath = undefined;
        }
      } else {
        active.set({ rx: radius, ry: radius } as any);
      }

      // Fabric caches images and their clip paths. Replacing the clip path is
      // not always enough to invalidate the cached bitmap, especially while
      // reducing the radius. Mark both the object and its parent group dirty
      // so every slider input is visible immediately instead of after Save.
      active.set('dirty', true);
      active.group?.set('dirty', true);
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
      textObject.set({ fontSize: nextFontSize, dirty: true });
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
          if (!this.canvas || !this.canvas.getObjects().includes(active)) return;
          const textObj = active as Textbox | IText;
          const prevWidth = textObj.width;
          textObj.set({ fontFamily: fontName, dirty: true });
          textObj.initDimensions?.();
          if (textObj instanceof Textbox && prevWidth) {
            textObj.set('width', prevWidth);
            textObj.initDimensions?.();
          }
          active.setCoords();
          this.canvas?.requestRenderAll();
          this.notifyChange();
          this.notifySelection();
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

    if (isText) {
      const textObj = active as Textbox | IText;
      const prevWidth = textObj.width;
      textObj.set('dirty', true);
      textObj.initDimensions?.();
      if (textObj instanceof Textbox && prevWidth) {
        textObj.set('width', prevWidth);
        textObj.initDimensions?.();
      }
    }

    active.setCoords();
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
  }

  public getActiveObjectBoundingRect(): { left: number; top: number; width: number; height: number } | null {
    if (!this.canvas) return null;
    const active = this.canvas.getActiveObject();
    if (!active) return null;
    return active.getBoundingRect();
  }

  private hexToRgba(hex: string, alpha: number): string {
    let c = (hex || '#000000').replace('#', '').trim();
    if (c.length === 3) {
      c = c.split('').map((x) => x + x).join('');
    }
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(0, 0, 0, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private parseShadowColor(colorStr: string): { color: string; transparency: number } {
    if (!colorStr) return { color: '#000000', transparency: 30 };
    const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(rgbaMatch[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(rgbaMatch[3], 10).toString(16).padStart(2, '0');
      const alpha = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
      return {
        color: `#${r}${g}${b}`,
        transparency: Math.round(alpha * 100),
      };
    }
    if (colorStr.startsWith('#')) {
      return { color: colorStr.slice(0, 7), transparency: 100 };
    }
    return { color: '#000000', transparency: 30 };
  }

  private ensureOriginalStylesSaved(obj: FabricObject): void {
    if ((obj as any)._originalFill === undefined && obj.fill && obj.fill !== 'transparent') {
      (obj as any)._originalFill = obj.fill;
    }
    if ((obj as any)._originalStroke === undefined) {
      (obj as any)._originalStroke = obj.stroke ?? null;
      (obj as any)._originalStrokeWidth = obj.strokeWidth ?? 0;
    }
  }

  private resetObjectEffectStyles(obj: FabricObject): void {
    if ((obj as any)._originalFill !== undefined) {
      obj.set('fill', (obj as any)._originalFill);
    }
    obj.set('shadow', null);
    if ((obj as any)._originalStroke !== undefined) {
      obj.set('stroke', (obj as any)._originalStroke);
      obj.set('strokeWidth', (obj as any)._originalStrokeWidth ?? 0);
    } else {
      obj.set('strokeWidth', 0);
    }
  }

  public applyEffect(
    effectType: 'none' | 'shadow' | 'lift' | 'glow' | 'outline' | 'hollow' | 'neon',
    customSettings?: any
  ): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    const targets = active instanceof ActiveSelection ? active.getObjects() : [active];

    if (effectType === 'shadow') {
      const settings = {
        direction: customSettings?.direction ?? -45,
        offset: customSettings?.offset ?? 20,
        blur: customSettings?.blur ?? 10,
        transparency: customSettings?.transparency ?? 30,
        color: customSettings?.color ?? '#000000',
      };
      const rad = (settings.direction * Math.PI) / 180;
      const offsetX = Math.round(settings.offset * Math.cos(rad));
      const offsetY = Math.round(settings.offset * Math.sin(rad));
      const alpha = Math.max(0, Math.min(1, settings.transparency / 100));
      const shadowColor = this.hexToRgba(settings.color, alpha);

      for (const obj of targets) {
        this.ensureOriginalStylesSaved(obj);
        this.resetObjectEffectStyles(obj);
        obj.set('shadow', new Shadow({
          color: shadowColor,
          blur: settings.blur,
          offsetX,
          offsetY,
        }));
        (obj as any)._shadowSettings = { ...settings };
        (obj as any)._activeEffect = 'shadow';
        if (!(obj as any)._effectSettings) (obj as any)._effectSettings = {};
        (obj as any)._effectSettings.shadow = { ...settings };
        (obj as any).dirty = true;
      }
      (active as any)._shadowSettings = { ...settings };
      (active as any)._activeEffect = 'shadow';
      if (!(active as any)._effectSettings) (active as any)._effectSettings = {};
      (active as any)._effectSettings.shadow = { ...settings };
    } else if (effectType === 'lift') {
      const settings = {
        intensity: customSettings?.intensity ?? 50,
        blur: customSettings?.blur ?? 24,
        transparency: customSettings?.transparency ?? 30,
        color: customSettings?.color ?? '#000000',
      };
      const alpha = Math.max(0, Math.min(1, settings.transparency / 100));
      const shadowColor = this.hexToRgba(settings.color, alpha);
      const offsetY = Math.round((settings.intensity / 100) * 20);
      const blur = settings.blur ?? Math.round((settings.intensity / 100) * 48);

      for (const obj of targets) {
        this.ensureOriginalStylesSaved(obj);
        this.resetObjectEffectStyles(obj);
        obj.set('shadow', new Shadow({
          color: shadowColor,
          blur,
          offsetX: 0,
          offsetY,
        }));
        (obj as any)._activeEffect = 'lift';
        if (!(obj as any)._effectSettings) (obj as any)._effectSettings = {};
        (obj as any)._effectSettings.lift = { ...settings };
        (obj as any).dirty = true;
      }
      (active as any)._activeEffect = 'lift';
      if (!(active as any)._effectSettings) (active as any)._effectSettings = {};
      (active as any)._effectSettings.lift = { ...settings };
    } else if (effectType === 'glow') {
      const settings = {
        blur: customSettings?.blur ?? 20,
        transparency: customSettings?.transparency ?? 80,
        color: customSettings?.color ?? '#2563eb',
      };
      const alpha = Math.max(0, Math.min(1, settings.transparency / 100));
      const glowColor = this.hexToRgba(settings.color, alpha);

      for (const obj of targets) {
        this.ensureOriginalStylesSaved(obj);
        this.resetObjectEffectStyles(obj);
        obj.set('shadow', new Shadow({
          color: glowColor,
          blur: settings.blur,
          offsetX: 0,
          offsetY: 0,
        }));
        (obj as any)._activeEffect = 'glow';
        if (!(obj as any)._effectSettings) (obj as any)._effectSettings = {};
        (obj as any)._effectSettings.glow = { ...settings };
        (obj as any).dirty = true;
      }
      (active as any)._activeEffect = 'glow';
      if (!(active as any)._effectSettings) (active as any)._effectSettings = {};
      (active as any)._effectSettings.glow = { ...settings };
    } else if (effectType === 'outline') {
      const settings = {
        thickness: customSettings?.thickness ?? 2,
        color: customSettings?.color ?? '#000000',
      };

      for (const obj of targets) {
        this.ensureOriginalStylesSaved(obj);
        this.resetObjectEffectStyles(obj);
        obj.set({
          stroke: settings.color,
          strokeWidth: settings.thickness,
          shadow: null,
        });
        (obj as any)._activeEffect = 'outline';
        if (!(obj as any)._effectSettings) (obj as any)._effectSettings = {};
        (obj as any)._effectSettings.outline = { ...settings };
        (obj as any).dirty = true;
      }
      (active as any)._activeEffect = 'outline';
      if (!(active as any)._effectSettings) (active as any)._effectSettings = {};
      (active as any)._effectSettings.outline = { ...settings };
    } else if (effectType === 'hollow') {
      const fallbackColor = typeof active.stroke === 'string' && active.stroke !== 'transparent'
        ? active.stroke
        : (typeof active.fill === 'string' && active.fill !== 'transparent' ? active.fill : '#000000');
      const settings = {
        thickness: customSettings?.thickness ?? 2,
        color: customSettings?.color ?? fallbackColor,
      };

      for (const obj of targets) {
        this.ensureOriginalStylesSaved(obj);
        this.resetObjectEffectStyles(obj);
        obj.set({
          fill: 'transparent',
          stroke: settings.color,
          strokeWidth: settings.thickness,
          shadow: null,
        });
        (obj as any)._activeEffect = 'hollow';
        if (!(obj as any)._effectSettings) (obj as any)._effectSettings = {};
        (obj as any)._effectSettings.hollow = { ...settings };
        (obj as any).dirty = true;
      }
      (active as any)._activeEffect = 'hollow';
      if (!(active as any)._effectSettings) (active as any)._effectSettings = {};
      (active as any)._effectSettings.hollow = { ...settings };
    } else if (effectType === 'neon') {
      const settings = {
        intensity: customSettings?.intensity ?? 50,
        color: customSettings?.color ?? '#ec4899',
      };
      const blur = Math.max(5, Math.round(10 + (settings.intensity / 100) * 40));

      for (const obj of targets) {
        this.ensureOriginalStylesSaved(obj);
        this.resetObjectEffectStyles(obj);
        obj.set({
          stroke: settings.color,
          strokeWidth: 1,
          shadow: new Shadow({ color: settings.color, blur, offsetX: 0, offsetY: 0 }),
        });
        (obj as any)._activeEffect = 'neon';
        if (!(obj as any)._effectSettings) (obj as any)._effectSettings = {};
        (obj as any)._effectSettings.neon = { ...settings };
        (obj as any).dirty = true;
      }
      (active as any)._activeEffect = 'neon';
      if (!(active as any)._effectSettings) (active as any)._effectSettings = {};
      (active as any)._effectSettings.neon = { ...settings };
    } else {
      // none
      for (const obj of targets) {
        this.resetObjectEffectStyles(obj);
        (obj as any)._activeEffect = 'none';
        delete (obj as any)._shadowSettings;
        delete (obj as any)._originalFill;
        delete (obj as any)._originalStroke;
        delete (obj as any)._originalStrokeWidth;
        (obj as any).dirty = true;
      }
      (active as any)._activeEffect = 'none';
      delete (active as any)._shadowSettings;
    }

    (active as any).dirty = true;
    active.setCoords();
    this.canvas.requestRenderAll();
    this.notifyChange();
    this.notifySelection();
    this.notifyLayers();
  }

  public applyShadow(settings: Partial<{
    direction: number;
    offset: number;
    blur: number;
    transparency: number;
    color: string;
  }>): void {
    this.applyEffect('shadow', settings);
  }

  public applyTextEffect(
    effectType: 'none' | 'shadow' | 'lift' | 'glow' | 'outline' | 'hollow' | 'neon',
    settings?: any
  ): void {
    this.applyEffect(effectType, settings);
  }

  public getTextEffectState(): {
    effect: string;
    settings: any;
    allSettings?: Record<string, any>;
  } {
    return this.getObjectEffectState();
  }

  public getObjectEffectState(): {
    effect: string;
    settings: any;
    allSettings?: Record<string, any>;
  } {
    const defaultSettings: Record<string, any> = {
      shadow: { direction: -45, offset: 20, blur: 10, transparency: 30, color: '#000000' },
      lift: { intensity: 50, blur: 24, transparency: 30, color: '#000000' },
      glow: { blur: 20, transparency: 80, color: '#2563eb' },
      outline: { thickness: 2, color: '#000000' },
      hollow: { thickness: 2, color: '#000000' },
      neon: { intensity: 50, color: '#ec4899' },
    };

    if (!this.canvas) return { effect: 'none', settings: defaultSettings.shadow, allSettings: defaultSettings };
    const active = this.canvas.getActiveObject();
    if (!active) return { effect: 'none', settings: defaultSettings.shadow, allSettings: defaultSettings };

    const storedEffect = (active as any)._activeEffect;
    const allSettings = (active as any)._effectSettings || {};

    if (storedEffect && storedEffect !== 'none') {
      const effectDefault = defaultSettings[storedEffect] || defaultSettings.shadow;
      const stored = allSettings[storedEffect] || (storedEffect === 'shadow' ? (active as any)._shadowSettings : null);
      return {
        effect: storedEffect,
        settings: stored ? { ...effectDefault, ...stored } : effectDefault,
        allSettings: { ...defaultSettings, ...allSettings },
      };
    }

    const shadow = active.shadow as Shadow | undefined;
    if (shadow && shadow.color) {
      const blur = shadow.blur ?? 10;
      const offsetX = shadow.offsetX ?? 6;
      const offsetY = shadow.offsetY ?? 6;
      const offset = Math.round(Math.sqrt(offsetX * offsetX + offsetY * offsetY));
      const direction = Math.round((Math.atan2(offsetY, offsetX) * 180) / Math.PI);
      const { color, transparency } = this.parseShadowColor(String(shadow.color));
      const shadowSettings = {
        direction,
        offset,
        blur,
        transparency,
        color,
      };
      return {
        effect: 'shadow',
        settings: shadowSettings,
        allSettings: {
          ...defaultSettings,
          shadow: shadowSettings,
        },
      };
    }

    return { effect: 'none', settings: defaultSettings.shadow, allSettings: defaultSettings };
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
          case 'custom':
            // 'custom' preset utilizes the fine-tune adjustment filter stack
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

      (active as any)._activeFilterPreset = presetId;
      (active as any)._filterIntensity = intensity;
      (active as any).dirty = true;
      active.setCoords();
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
    } else {
      if ((active as any)._originalFill === undefined && typeof active.fill === 'string') {
        (active as any)._originalFill = active.fill;
      }
      if ((active as any)._originalOpacity === undefined && active.opacity !== undefined) {
        (active as any)._originalOpacity = active.opacity;
      }

      (active as any)._activeFilterPreset = presetId;
      (active as any)._filterIntensity = intensity;

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
      } else if (presetId === 'soft') {
        active.set('fill', '#F472B6');
        active.set('opacity', 0.85);
      } else if (presetId === 'vintage') {
        active.set('fill', '#92400E');
      } else if (presetId === 'noir') {
        active.set('fill', '#18181B');
      } else if (presetId === 'drama') {
        active.set('fill', '#4338CA');
      } else if (presetId === 'invert') {
        const currentFill = typeof active.fill === 'string' ? active.fill : '#000000';
        if (currentFill.startsWith('#') && currentFill.length === 7) {
          const num = parseInt(currentFill.slice(1), 16);
          const inv = 0xffffff ^ num;
          active.set('fill', '#' + inv.toString(16).padStart(6, '0'));
        }
      } else if (presetId === 'none') {
        if ((active as any)._originalFill !== undefined) {
          active.set('fill', (active as any)._originalFill);
        }
        if ((active as any)._originalOpacity !== undefined) {
          active.set('opacity', (active as any)._originalOpacity);
        }
      }
      (active as any).dirty = true;
      active.setCoords();
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
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

      (active as any)._adjustments = { ...((active as any)._adjustments || {}), ...adjustments };
      (active as any).dirty = true;
      active.setCoords();
      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
    } else {
      const stored = (active as any)._adjustments || {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        vibrance: 0,
        blur: 0,
        hue: 0,
        warmth: 0,
      };
      const updated = { ...stored, ...adjustments };
      (active as any)._adjustments = updated;

      if ((active as any)._originalOpacity === undefined && active.opacity !== undefined) {
        (active as any)._originalOpacity = active.opacity;
      }
      const baseOpacity = (active as any)._originalOpacity ?? 1;
      const opacityDelta = (updated.brightness || 0) / 200;
      active.set('opacity', Math.max(0.05, Math.min(1, baseOpacity + opacityDelta)));

      if (updated.blur > 0) {
        active.set('shadow', new Shadow({
          color: typeof active.fill === 'string' ? active.fill : '#000000',
          blur: updated.blur,
          offsetX: 0,
          offsetY: 0,
        }));
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

    const adj = (active as any)._adjustments || {};
    return {
      brightness: adj.brightness ?? 0,
      contrast: adj.contrast ?? 0,
      saturation: adj.saturation ?? 0,
      vibrance: adj.vibrance ?? 0,
      blur: adj.blur ?? 0,
      hue: adj.hue ?? 0,
      warmth: adj.warmth ?? 0,
      activeFilter: (active as any)._activeFilterPreset || 'none',
      intensity: Math.round(((active as any)._filterIntensity ?? 1) * 100),
    };
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

    const requestedFontFamily = options?.fontFamily || 'Inter, sans-serif';
    const requestedFontName = requestedFontFamily
      .split(',')[0]
      .trim()
      .replace(/^['"]|['"]$/g, '');
    const fontItem = POPULAR_FONTS.find(
      (f) =>
        f.family === requestedFontFamily ||
        f.name === requestedFontFamily ||
        f.family === requestedFontName ||
        f.name === requestedFontName
    );

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
      fontFamily: requestedFontFamily,
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
      hoverCursor: 'move',
      moveCursor: 'move',
      // Render directly from vector glyphs so text stays sharp across zooms and retina displays
      objectCaching: false,
      noScaleCache: false,
      strokeUniform: true,
      lockScalingFlip: true,
      lockUniScaling: false,
      centeredScaling: false,
    });

    text.set(
      'fontSizePt' as any,
      options?.fontSizePt || (fontSize * 72) / artworkDpi
    );
    text.set('sourceType' as any, 'vector-text');

    this.ensureObjectId(text, options?.name || 'Text Layer');
    applyCanvaControlsToObject(text);
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

    // Do not block insertion while a web font downloads. Fabric displays the
    // text immediately with the browser fallback, then remeasures it once the
    // requested font is ready. This removes the intermittent first-click lag.
    if (fontItem) {
      void loadFont(fontItem)
        .then(() => {
          if (!this.canvas || !this.canvas.getObjects().includes(text)) return;

          text.set({
            fontFamily: requestedFontFamily,
            dirty: true,
          });
          text.initDimensions();
          text.setCoords();
          this.canvas.requestRenderAll();

          if (this.canvas.getActiveObject() === text) {
            this.notifySelection();
          }
        })
        .catch((error) => {
          console.warn(`Could not load font ${fontItem.family}:`, error);
        });
    }
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
      shapeObj.set('frameShape' as any, 'rect');
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

  private notifyZoomThrottled(): void {
    // Keep zooming inside Fabric's animation-frame path. Updating React state
    // for every wheel event re-renders the complete editor/sidebar and makes
    // zoom look like the artwork is repeatedly refreshing. Notify React once
    // after the gesture settles instead.
    if (this.zoomNotifyTrailingTimer !== null) {
      clearTimeout(this.zoomNotifyTrailingTimer);
    }
    this.zoomNotifyTrailingTimer = setTimeout(() => {
      this.zoomNotifyTrailingTimer = null;
      this.notifyZoom();
    }, 120);
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
    if (this.preflightListeners.size === 0) return;
    if (this.preflightDebounceTimer !== null) {
      clearTimeout(this.preflightDebounceTimer);
    }
    this.preflightDebounceTimer = setTimeout(() => {
      this.preflightDebounceTimer = null;
      if (!this.canvas || this.preflightListeners.size === 0) return;
      const report = this.getPreflightReport();
      this.preflightListeners.forEach((cb) => cb(report));
    }, 250);
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
    const sourceType = active.get('sourceType' as any) as string | undefined;
    // Classify vector shapes and empty/placeholder frames as colourable shapes.
    const isShapeObject =
      sourceType === 'shape' ||
      (this.isShapeObject(active) && (!imageObj || Boolean(active.get('isCanvaPlaceholder' as any))));
    const isCanvaPlaceholder = Boolean(active.get('isCanvaPlaceholder' as any)) ||
      Boolean(imageObj?.get('isCanvaPlaceholder' as any));

    return {
      id: active.get('id' as any) as string,
      name: active.get('name' as any) as string,
      type: isMultiple
        ? 'activeSelection'
        : isText
          ? 'textbox'
          : isShapeObject
            ? 'shape'
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
      fill: (() => {
        const rawFill = usesChildStyles ? styleSource.fill : active.fill;
        const designerGrad = fabricGradientToDesignerGradient(rawFill);
        if (designerGrad) return designerGrad;
        return typeof rawFill === 'string' ? rawFill : '#2563eb';
      })(),
      fillGradient: (() => {
        const rawFill = usesChildStyles ? styleSource.fill : active.fill;
        return fabricGradientToDesignerGradient(rawFill) || undefined;
      })(),
      stroke: usesChildStyles && typeof styleSource.stroke === 'string'
        ? styleSource.stroke
        : typeof active.stroke === 'string'
          ? active.stroke
          : '#000000',
      strokeWidth: (() => {
        const rawW = usesChildStyles
          ? styleSource.strokeWidth || active.strokeWidth || 0
          : active.strokeWidth || 0;
        const storedBaseW = (active.get('baseStrokeWidth' as any) ||
          styleSource.get('baseStrokeWidth' as any)) as number | undefined;
        const storedPos = (active.get('strokePosition' as any) ||
          styleSource.get('strokePosition' as any)) as 'inside' | 'outside' | undefined;
        if (typeof storedBaseW === 'number') return storedBaseW;
        if (storedPos === 'outside' && rawW > 0) return Math.round(rawW / 2);
        return rawW;
      })(),
      strokePosition: (() => {
        const storedPos = (active.get('strokePosition' as any) ||
          styleSource.get('strokePosition' as any)) as 'inside' | 'outside' | undefined;
        if (storedPos) return storedPos;
        return (active.paintFirst === 'stroke' || styleSource.paintFirst === 'stroke') ? 'outside' : 'inside';
      })(),
      baseStrokeWidth: (() => {
        const storedBaseW = (active.get('baseStrokeWidth' as any) ||
          styleSource.get('baseStrokeWidth' as any)) as number | undefined;
        if (typeof storedBaseW === 'number') return storedBaseW;
        const rawW = usesChildStyles
          ? styleSource.strokeWidth || active.strokeWidth || 0
          : active.strokeWidth || 0;
        const isOut = active.paintFirst === 'stroke' || styleSource.paintFirst === 'stroke';
        return isOut && rawW > 0 ? Math.round(rawW / 2) : rawW;
      })(),
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
      isShape: isShapeObject,
      shapeType: isShapeObject ? this.getShapeTypeFromObject(active) : undefined,
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

      // Canva-like interaction: Auto-exit text editing when clicking on controls
      // or near the bounding border perimeter so the user can immediately drag & move the text box.
      const activeObj = this.canvas.getActiveObject();
      if (activeObj && this.isTextObject(activeObj) && (activeObj as any).isEditing) {
        const corner = opt?.transform?.corner || (activeObj as any).__corner;
        if (corner) {
          (activeObj as any).exitEditing?.();
          (activeObj as any).set?.('hoverCursor', 'move');
          this.canvas.setCursor('move');
          this.canvas.requestRenderAll();
        } else if (opt.e) {
          const pointer = opt.scenePoint || (this.canvas && opt.e ? (this.canvas as any).getScenePoint?.(opt.e) : null);
          const localPoint = pointer && (activeObj as any).toLocalPoint?.(pointer, 'center', 'center');
          if (localPoint) {
            const halfW = (activeObj.width || 0) / 2;
            const halfH = (activeObj.height || 0) / 2;
            const scaleX = Math.abs(activeObj.scaleX || 1);
            const scaleY = Math.abs(activeObj.scaleY || 1);
            const thresholdX = 14 / Math.max(scaleX, 0.01);
            const thresholdY = 14 / Math.max(scaleY, 0.01);

            const isNearBorder =
              Math.abs(localPoint.x) >= halfW - thresholdX ||
              Math.abs(localPoint.y) >= halfH - thresholdY;

            if (isNearBorder) {
              (activeObj as any).exitEditing?.();
              (activeObj as any).set?.('hoverCursor', 'move');
              this.canvas.setCursor('move');
              this.canvas.requestRenderAll();
            }
          }
        }
      }

      if (target && typeof target.get === 'function') {
        const activeCorner =
          opt?.transform?.corner ||
          (target as any).__corner;
        this.rememberFrameResizeState(target, activeCorner);
      }

      if (
        target &&
        typeof target.set === 'function' &&
        typeof target.setCoords === 'function' &&
        !this.isNonInteractiveObject(target)
      ) {
        this.restoreObjectInteractivity(target);
      }
    });

    this.canvas.on('before:transform', (opt: any) => {
      const transform = opt?.transform;
      const target = transform?.target;
      if (!target || this.isNonInteractiveObject(target)) return;

      const corner = transform?.corner;
      if (corner) {
        this.rememberFrameResizeState(target, corner);
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
      // Canva-style dynamic cursor: when editing text, hovering near the border shows 'move' cursor
      const activeText = this.canvas?.getActiveObject();
      if (activeText && this.isTextObject(activeText) && (activeText as any).isEditing && opt.e) {
        const pointer = opt.scenePoint || (this.canvas && opt.e ? (this.canvas as any).getScenePoint?.(opt.e) : null);
        const localPoint = pointer && (activeText as any).toLocalPoint?.(pointer, 'center', 'center');
        if (localPoint) {
          const halfW = (activeText.width || 0) / 2;
          const halfH = (activeText.height || 0) / 2;
          const scaleX = Math.abs(activeText.scaleX || 1);
          const scaleY = Math.abs(activeText.scaleY || 1);
          const thresholdX = 14 / Math.max(scaleX, 0.01);
          const thresholdY = 14 / Math.max(scaleY, 0.01);

          const isNearBorder =
            Math.abs(localPoint.x) >= halfW - thresholdX ||
            Math.abs(localPoint.y) >= halfH - thresholdY;

          this.canvas?.setCursor(isNearBorder ? 'move' : 'text');
        }
      }

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

    this.canvas.on('mouse:dblclick', (opt: any) => {
      const target = opt?.target;
      if (
        target &&
        this.isTextObject(target) &&
        !(target as any).isEditing &&
        (target as any).editable !== false
      ) {
        (target as any).enterEditing?.(opt?.e);
        (target as any).setCursorByClick?.(opt?.e);
        (target as any).set?.('hoverCursor', 'text');
        this.canvas?.setCursor('text');
        this.canvas?.requestRenderAll();
        this.notifySelection();
      }
    });

    this.canvas.on('selection:created', () => {
      const active = this.canvas?.getActiveObject();
      if (active) {
        applyCanvaControlsToObject(active);
      }
      this.canvas?.forEachObject((obj) => {
        if (obj !== active && this.isTextObject(obj) && (obj as any).isEditing) {
          (obj as any).exitEditing?.();
          (obj as any).set?.('hoverCursor', 'move');
        }
      });
      this.notifySelection();
    });
    this.canvas.on('selection:updated', () => {
      const active = this.canvas?.getActiveObject();
      if (active) {
        applyCanvaControlsToObject(active);
      }
      this.canvas?.forEachObject((obj) => {
        if (obj !== active && this.isTextObject(obj) && (obj as any).isEditing) {
          (obj as any).exitEditing?.();
          (obj as any).set?.('hoverCursor', 'move');
        }
      });
      this.notifySelection();
    });
    this.canvas.on('selection:cleared', () => {
      this.clearHoverFitHighlight();
      this.snapping.clearGuides();
      this.canvas?.forEachObject((obj) => {
        if (this.isTextObject(obj) && (obj as any).isEditing) {
          (obj as any).exitEditing?.();
          (obj as any).set?.('hoverCursor', 'move');
        }
      });
      this.canvas?.setCursor('default');
      this.notifySelection();
    });

    /* Keep the typography toolbar synchronized while entering, editing and
     * leaving a Fabric text object. */
    this.canvas.on('text:editing:entered' as any, (opt: any) => {
      if (opt?.target) {
        opt.target.set?.('hoverCursor', 'text');
      }
      this.canvas?.setCursor('text');
      this.notifySelection();
    });
    this.canvas.on('text:selection:changed' as any, () => {
      if (this.textSelectionThrottleTimer !== null) return;
      this.textSelectionThrottleTimer = setTimeout(() => {
        this.textSelectionThrottleTimer = null;
        this.notifySelection();
      }, 150);
    });
    this.canvas.on('text:changed' as any, (opt: any) => {
      opt?.target?.set?.('dirty', true);
      opt?.target?.setCoords?.();
      this.canvas?.requestRenderAll();
      this.notifySelection();
      this.notifyChange();
    });
    this.canvas.on('text:editing:exited' as any, (opt: any) => {
      if (opt?.target) {
        opt.target.set?.('hoverCursor', 'move');
        applyCanvaControlsToObject(opt.target);
        opt.target.setCoords?.();
      }
      this.canvas?.setCursor('move');
      this.canvas?.requestRenderAll();
      this.notifySelection();
      this.notifyChange();
      this.saveHistoryState();
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
        this.frameResizeSnapshots.delete(opt.target);

        if (this.isTextObject(opt.target)) {
          const textObj = opt.target as Textbox | IText;
          const sX = Math.abs(textObj.scaleX || 1);
          const sY = Math.abs(textObj.scaleY || 1);
          if (Math.abs(sX - 1) > 0.001 || Math.abs(sY - 1) > 0.001) {
            const scale = (sX + sY) / 2;
            const currentFontSize = textObj.fontSize || 16;
            const nextFontSize = Math.max(1, Math.round(currentFontSize * scale));
            const currentWidth = Math.max(24, textObj.width || 100);
            const nextWidth = Math.max(24, Math.round(currentWidth * sX));
            const artworkDpi = Math.max(72, Number(this.dimensions.dpi) || 96);

            textObj.set({
              fontSize: nextFontSize,
              width: nextWidth,
              scaleX: 1,
              scaleY: 1,
              objectCaching: false,
              noScaleCache: false,
              strokeUniform: true,
              dirty: true,
            });
            textObj.set('fontSizePt' as any, (nextFontSize * 72) / artworkDpi);
            textObj.initDimensions();
            textObj.setCoords();
          }
        }

        const handled = await this.handleShapeImageDrop(opt.target);
        const normalized = handled
          ? false
          : await this.normalizeFrameTransform(opt.target);
        if (!handled && !normalized) {
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
    this.canvas.on('object:scaling', (opt: any) => {
      const target = opt.target;
      if (!target || this.isNonInteractiveObject(target)) return;

      if (this.isTextObject(target)) {
        target.set({
          objectCaching: false,
          noScaleCache: false,
          dirty: true,
        });
      }

      const activeCorner =
        opt?.transform?.corner ||
        (target as any).__corner;
      this.rememberFrameResizeState(target, activeCorner);
      this.previewFrameCropDuringScale(target);
      this.keepFrameResizeAnchor(target);

      /*
       * IMPORTANT:
       * Do not call snapping.handleObjectMove() while scaling. That method is
       * intended for object:moving and may update left/top on every pointer
       * event. Repeated position updates cause the visible slow resize drift.
       * Fabric's scale control already keeps the opposite corner anchored.
       */
      target.set({
        lockScalingFlip: true,
        centeredScaling: false,
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
    // Load the exact SVG saved by admin. We deliberately do NOT replace
    // triangles/rectangles/etc. with generic Fabric primitives.
    const directUrl = formatImageUrl(url);
    const forcedProxyUrl =
      directUrl.startsWith('data:') ||
        directUrl.startsWith('blob:') ||
        directUrl.includes('/api/v1/designer/proxy-image')
        ? directUrl
        : `${CANVAS_API_URL}/designer/proxy-image?url=${encodeURIComponent(directUrl)}`;

    const safeUrl = await urlToSafeDataUrl(forcedProxyUrl);
    const response = await fetch(safeUrl, {
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
    const parsed = (result?.objects || []).filter(
      (object): object is FabricObject => Boolean(object)
    );

    if (!parsed.length) {
      throw new Error(
        'The admin SVG contains no Fabric-supported drawable vector objects.'
      );
    }

    /*
     * IMPORTANT:
     * util.groupSVGElements(objects, result.options) can preserve the SVG
     * viewBox width/height. If the artwork occupies only a small part of that
     * viewBox, Fabric then gives us a huge selection rectangle with a tiny
     * visible shape inside it.
     *
     * Build a fresh Group from the parsed drawable objects instead. Fabric
     * recalculates the group from the actual children, producing tight bounds
     * while preserving every vector/path exactly.
     */
    let shape: FabricObject;

    if (parsed.length === 1) {
      shape = parsed[0];
    } else {
      parsed.forEach((child) => {
        child.set({
          selectable: false,
          evented: false,
          objectCaching: false,
        } as any);
        child.setCoords();
      });

      shape = new Group(parsed, {
        originX: 'center',
        originY: 'center',
        subTargetCheck: false,
        interactive: false,
        objectCaching: false,
      } as any);
    }

    /*
     * Tighten a single object's own geometry too. For Paths Fabric's width and
     * height are already based on path geometry; for Groups the fresh Group
     * above recalculates from child bounds. Do not copy root SVG viewBox
     * dimensions back onto the object.
     */
    shape.set({
      originX: 'center',
      originY: 'center',
      visible: true,
      opacity: 1,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      perPixelTargetFind: false,
      objectCaching: false,
      noScaleCache: false,
      centeredScaling: false,
      lockScalingFlip: true,
    } as any);

    shape.setCoords();

    const tightBounds = shape.getBoundingRect();
    if (
      !Number.isFinite(tightBounds.width) ||
      !Number.isFinite(tightBounds.height) ||
      tightBounds.width <= 0 ||
      tightBounds.height <= 0
    ) {
      throw new Error('The admin SVG has invalid visible bounds.');
    }

    return shape;
  }

  /**
   * Adds the exact admin-created SVG from the Shapes panel.
   *
   * The selection rectangle is calculated from actual drawable SVG content,
   * not unused root viewBox whitespace. This prevents the "tiny shape inside
   * a huge purple box" glitch.
   */
  public async addCustomPhotoShape(
    url: string,
    metadata: ShapeAssetMetadata = {}
  ): Promise<FabricObject | null> {
    if (!this.canvas || !url) return null;

    this.enableSelectionMode();

    try {
      const shape = await this.loadCustomShapeObject(url);

      const canvasW = Math.max(this.dimensions.widthPx || 1063, 1);
      const canvasH = Math.max(this.dimensions.heightPx || 591, 1);

      shape.set({
        scaleX: 1,
        scaleY: 1,
        angle: 0,
      } as any);
      shape.setCoords();

      // Use the ACTUAL visible Fabric bounds after rebuilding the SVG group.
      const visibleBounds = shape.getBoundingRect();
      const naturalW = Math.max(visibleBounds.width || Number(shape.width) || 1, 1);
      const naturalH = Math.max(visibleBounds.height || Number(shape.height) || 1, 1);

      const maxW = Math.min(canvasW * 0.32, 300);
      const maxH = Math.min(canvasH * 0.45, 300);

      const uniformScale = Math.min(
        maxW / naturalW,
        maxH / naturalH
      );

      shape.set({
        originX: 'center',
        originY: 'center',
        scaleX: uniformScale,
        scaleY: uniformScale,
        angle: 0,

        visible: true,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,

        lockUniScaling: false,
        lockScalingFlip: true,
        centeredScaling: false,

        cornerColor: '#ffffff',
        cornerStrokeColor: '#8b3dff',
        borderColor: '#8b3dff',
        cornerStyle: 'circle',
        cornerSize: 12,
        transparentCorners: false,

        objectCaching: false,
        noScaleCache: false,
        perPixelTargetFind: false,
      } as any);

      // Shapes-panel assets remain normal editable vectors.
      shape.set('isShape' as any, true);
      shape.set('isFrame' as any, false);
      shape.set('isCanvaPlaceholder' as any, false);
      shape.set('shapeType' as any, 'custom-svg');
      shape.set('frameShape' as any, undefined);
      shape.set('sourceType' as any, 'shape');

      shape.set('customShapeUrl' as any, url);
      shape.set('assetId' as any, metadata.assetId);
      shape.set('provider' as any, metadata.provider || 'admin');
      shape.set('originalSrc' as any, metadata.originalSrc || url);
      shape.set('recolourable' as any, metadata.recolourable !== false);
      shape.set('allowPhotoDrop' as any, false);

      shape.set('sourceWidth' as any, naturalW);
      shape.set('sourceHeight' as any, naturalH);

      this.ensureObjectId(shape, metadata.name || 'Custom Shape');
      applyCanvaControlsToObject(shape);

      this.canvas.add(shape);

      if (
        typeof metadata.left === 'number' &&
        typeof metadata.top === 'number'
      ) {
        shape.set({
          left: metadata.left,
          top: metadata.top,
        });
      } else {
        // Center only after the tight-bounds object is attached to the canvas.
        this.centerObjectOnCanvas(shape);
      }

      shape.setCoords();
      this.canvas.setActiveObject(shape);

      this.canvas.requestRenderAll();
      this.notifyChange();
      this.notifySelection();
      this.notifyLayers();
      this.saveHistoryState();

      return shape;
    } catch (error) {
      console.error('Failed to add exact admin SVG shape:', error);
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
      this.pendingZoomPivot = null;
    }

    if (this.shapeCacheRefreshTimer !== null) {
      clearTimeout(this.shapeCacheRefreshTimer);
      this.shapeCacheRefreshTimer = null;
    }

    if (this.zoomNotifyTrailingTimer !== null) {
      clearTimeout(this.zoomNotifyTrailingTimer);
      this.zoomNotifyTrailingTimer = null;
    }

    if (this.historyDebounceTimer !== null) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
    }

    if (this.preflightDebounceTimer !== null) {
      clearTimeout(this.preflightDebounceTimer);
      this.preflightDebounceTimer = null;
    }

    if (this.textSelectionThrottleTimer !== null) {
      clearTimeout(this.textSelectionThrottleTimer);
      this.textSelectionThrottleTimer = null;
    }

    this.undoStack = [];
    this.redoStack = [];

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
