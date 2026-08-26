export type UnitType = 'mm' | 'px' | 'in';

export interface CanvasDimensions {
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeZoneMm: number;
  bleedPx: number;
  safeZonePx: number;
  totalWidthPx: number;
  totalHeightPx: number;
  dpi: number;
}

export interface DocumentSettings {
  width: number;
  height: number;
  unit: UnitType;
  dpi: number;
  bleed: number;
  safeArea: number;
  name?: string;
  backgroundColor?: string;
  showGuides?: boolean;
}

export interface PrintGuidesSettings {
  showBleed: boolean;
  showSafeZone: boolean;
  showTrim: boolean;
  bleedColor: string;
  safeZoneColor: string;
  trimColor: string;
}

export type DesignerLayerType =
  | 'text'
  | 'image'
  | 'shape'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'arrow'
  | 'polygon'
  | 'frame'
  | 'group'
  | 'activeSelection';

export interface DesignerObjectTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  zIndex: number;
}

export interface LayerItem {
  id: string;
  name: string;
  type: string;
  isLocked: boolean;
  isVisible: boolean;
  zIndex: number;
  textPreview?: string;
  thumbnail?: string;
}

export type ArtworkQuality = 'excellent' | 'good' | 'low' | 'critical';

export interface ArtworkQualityInfo {
  originalWidth: number;
  originalHeight: number;
  fileSizeBytes: number;
  estimatedDpi: number;
  status: ArtworkQuality;
  printWidthMm: number;
  printHeightMm: number;
}

export interface SelectedObjectState {
  id?: string;
  name?: string;
  type: string;
  isMultiple: boolean;
  count: number;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  flipX: boolean;
  flipY: boolean;
  isLocked: boolean;
  isVisible: boolean;
  zIndex?: number;
  // Text specific properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontWeight?: string | number;
  fontStyle?: string;
  underline?: boolean;
  linethrough?: boolean;
  charSpacing?: number;
  lineHeight?: number;
  // Image specific properties
  src?: string;
  originalSrc?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  fileSizeBytes?: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  qualityInfo?: ArtworkQualityInfo;
  // Frame specific properties
  isFrame?: boolean;
  frameShape?: string;
  // Brush / Path specific properties
  isBrushPath?: boolean;
  brushType?: BrushType;
  strokeLineCap?: 'round' | 'square' | 'butt';
  strokeLineJoin?: 'round' | 'bevel' | 'miter';
  // Border & Corner Radius properties
  rx?: number;
  ry?: number;
  strokeDashArray?: number[];
  strokeUniform?: boolean;
}

export interface UploadedAsset {
  id: string;
  name: string;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  fileSizeBytes: number;
  mimeType: string;
  createdAt: string;
}

export interface StockImage {
  id: string;
  title: string;
  category: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  author?: string;
}

export type FrameShapeType =
  | 'circle'
  | 'rounded-rect'
  | 'heart'
  | 'star'
  | 'hexagon'
  | 'diamond'
  | 'triangle'
  | 'shield';

export interface FramePreset {
  id: string;
  name: string;
  shape: FrameShapeType;
  iconName: string;
  description?: string;
}

export interface DesignerTemplate {
  id: string;
  title: string;
  category: string;
  description?: string;
  thumbnailBg: string;
  widthMm: number;
  heightMm: number;
  backgroundColor: string;
  objects: Array<{
    type: 'textbox' | 'rect' | 'circle' | 'image' | 'line' | 'triangle' | 'polygon';
    [key: string]: unknown;
  }>;
}

export type BrushType =
  | 'pencil'
  | 'brush'
  | 'marker'
  | 'calligraphy'
  | 'spray'
  | 'eraser';

export interface BrushSettings {
  tool: BrushType;
  size: number;
  color: string;
  opacity: number;
  smoothness: number;
  strokeLineCap: 'round' | 'square' | 'butt';
  strokeLineJoin: 'round' | 'bevel' | 'miter';
  sprayDensity?: number;
  sprayDotWidth?: number;
  calligraphyAngle?: number;
}

export interface BackgroundSettings {
  type: 'color' | 'gradient' | 'image';
  color?: string;
  gradient?: {
    type: 'linear' | 'radial';
    angle: number; // in degrees
    stops: Array<{ offset: number; color: string }>;
  };
  image?: {
    url: string;
    fit: 'cover' | 'contain' | 'stretch';
    scale: number; // 0.5 to 3.0
    offsetX: number; // in px
    offsetY: number; // in px
    opacity: number; // 0 to 1
    blur: number; // in px
    name?: string;
  };
}

export type ActiveSidebarTab =
  | 'templates'
  | 'elements'
  | 'photos'
  | 'text'
  | 'uploads'
  | 'draw'
  | 'shapes'
  | 'layers'
  | 'background'
  | 'settings'
  | null;

export type AlignmentType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'center-h'
  | 'center-v'
  | 'center-both';

export interface DesignerCanvasState {
  version: string;
  product_id?: string;
  design_id?: string;
  name: string;
  dimensions: CanvasDimensions;
  document: DocumentSettings;
  background_color: string;
  canvas_json: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ProductPrintPreset {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  unit: UnitType;
  dpi: number;
  bleed: number;
  safeArea: number;
  description?: string;
}
