'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  DesignAsset,
  AssetType,
  DesignAssetCategory,
  designAssetService,
} from '@/services/designAssetService';
import {
  X,
  Loader2,
  Check,
  Info,
  FolderUp,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sun,
  Moon,
  Grid,
  Sparkles,
  Palette,
  Sliders,
  Type,
  ChevronDown,
} from 'lucide-react';
import { ArtworkFileUpload } from '@/components/admin/shared';
import { BulkAssetUploadModal } from './BulkAssetUploadModal';
import { POPULAR_FONTS, loadFont, loadCustomFont } from '@/components/designer/utils/fonts';
import { FontPickerPopover } from '@/components/designer/toolbar/FontPickerPopover';

export type TextEffectType =
  | 'none'
  | 'shadow'
  | 'outline'
  | 'glow'
  | 'lift'
  | 'splice'
  | 'echo'
  | 'offset'
  | 'neon';

export interface TextPresetConfig {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  charSpacing: number;
  lineHeight: number;
  fill: string;
  gradientEnabled: boolean;
  gradientAngle: number;
  gradientColor1: string;
  gradientColor2: string;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowOpacity: number;
  textEffect: TextEffectType;
  fontUrl?: string;
  fontFileName?: string;
}

const DEFAULT_TEXT_CONFIG: TextPresetConfig = {
  text: 'Bold Moves',
  fontFamily: 'Inter',
  fontSize: 36,
  fontWeight: '700',
  fontStyle: 'normal',
  textAlign: 'center',
  charSpacing: 0,
  lineHeight: 1.2,
  fill: '#F4510B',
  gradientEnabled: false,
  gradientAngle: 135,
  gradientColor1: '#F97316',
  gradientColor2: '#9333EA',
  strokeEnabled: false,
  strokeColor: '#172554',
  strokeWidth: 3,
  shadowEnabled: false,
  shadowColor: '#000000',
  shadowOffsetX: 4,
  shadowOffsetY: 4,
  shadowBlur: 6,
  shadowOpacity: 0.5,
  textEffect: 'none',
  fontUrl: '',
  fontFileName: '',
};

const TEXT_EFFECT_OPTIONS: { id: TextEffectType; label: string; desc: string }[] = [
  { id: 'none', label: 'None', desc: 'Standard clean text' },
  { id: 'shadow', label: 'Shadow', desc: 'Soft drop shadow' },
  { id: 'outline', label: 'Outline', desc: 'Hollow / stroked outline' },
  { id: 'glow', label: 'Glow', desc: 'Soft colorful glow' },
  { id: 'lift', label: 'Lift', desc: 'Elevated blur for depth' },
  { id: 'splice', label: 'Splice', desc: 'Outline + offset color' },
  { id: 'echo', label: 'Echo', desc: 'Repeated offset trail' },
  { id: 'offset', label: 'Offset', desc: 'Solid pop-art shadow' },
  { id: 'neon', label: 'Neon', desc: 'Vibrant electric aura' },
];

const QUICK_COLORS = [
  '#0f172a',
  '#ffffff',
  '#F4510B',
  '#dc2626',
  '#e11d48',
  '#9333ea',
  '#2563eb',
  '#0284c7',
  '#059669',
  '#d97706',
];

function calculateGradientCoords(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x1: Math.round(50 - Math.cos(rad) * 50) / 100,
    y1: Math.round(50 - Math.sin(rad) * 50) / 100,
    x2: Math.round(50 + Math.cos(rad) * 50) / 100,
    y2: Math.round(50 + Math.sin(rad) * 50) / 100,
  };
}

function hexToRgba(hex: string, opacity: number = 1): string {
  if (!hex) return `rgba(0,0,0,${opacity})`;
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
}


const MAIN_ASSET_EXTENSIONS = [
  'svg',
  'pdf',
  'tif',
  'tiff',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'avif',
  'gif',
  'bmp',
];

const THUMBNAIL_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'svg',
];

/**
 * SVG mask should normally be an SVG.
 * Alpha masks should normally be transparent PNG/WebP.
 */
const FRAME_MASK_EXTENSIONS = [
  'svg',
  'png',
  'webp',
];

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function getFormatBadgeInfo(
  ext: string
): {
  label: string;
  badgeClass: string;
  note: string;
} | null {
  switch (ext) {
    case 'svg':
      return {
        label: 'SVG Vector',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-200',
        note:
          'Vector artwork: Infinite scaling, sharp curves, and editable in canvas.',
      };

    case 'pdf':
      return {
        label: 'PDF Document / Vector',
        badgeClass:
          'bg-rose-50 text-rose-700 border-rose-200',
        note:
          'High-res PDF artwork: Stored in original print quality with automatic web preview thumbnail.',
      };

    case 'tif':
    case 'tiff':
      return {
        label: 'TIFF Print Master',
        badgeClass:
          'bg-purple-50 text-purple-700 border-purple-200',
        note:
          'Print production raster: High-DPI uncompressed format with automatic web preview thumbnail.',
      };

    case 'png':
    case 'webp':
      return {
        label: `${ext.toUpperCase()} Graphic`,
        badgeClass:
          'bg-blue-50 text-blue-700 border-blue-200',
        note:
          'Crisp raster graphic with full alpha transparency support.',
      };

    case 'jpg':
    case 'jpeg':
      return {
        label: 'JPEG Photo',
        badgeClass:
          'bg-sky-50 text-sky-700 border-sky-200',
        note:
          'Standard raster photography / background format.',
      };

    default:
      return null;
  }
}

interface DesignAssetFormProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: DesignAsset | null;
  activeType: AssetType;
  categories: DesignAssetCategory[];
  onSaved: () => void;
}

type FrameMaskType =
  | 'rectangle'
  | 'rounded_rectangle'
  | 'circle'
  | 'ellipse'
  | 'polygon'
  | 'svg_path'
  | 'svg_mask'
  | 'alpha_mask';

type FramePhotoFit = 'cover' | 'contain';

interface FrameConfig {
  maskType: FrameMaskType;

  width: number;
  height: number;
  unit: 'px' | 'mm';

  cornerRadius: number;
  circleRadius: number;

  polygonPoints: string;

  svgPath: string;

  photoFit: FramePhotoFit;

  allowPhotoMove: boolean;
  allowPhotoZoom: boolean;
  allowPhotoRotate: boolean;
  allowPhotoReplace: boolean;

  preserveAspectRatio: boolean;
}

type ShapePhotoFit = 'cover' | 'contain';

interface ShapeConfig {
  photoFit: ShapePhotoFit;
  fill: string;
  stroke: string;
  strokeWidth: number;
  recolourable: boolean;
  allowPhotoDrop: boolean;
  preserveAspectRatio: boolean;
}

const DEFAULT_FRAME_CONFIG: FrameConfig = {
  maskType: 'svg_mask',

  width: 500,
  height: 500,
  unit: 'px',

  cornerRadius: 30,
  circleRadius: 250,

  polygonPoints:
    '0,0 500,0 500,500 0,500',

  svgPath: '',

  photoFit: 'cover',

  allowPhotoMove: true,
  allowPhotoZoom: true,
  allowPhotoRotate: true,
  allowPhotoReplace: true,

  preserveAspectRatio: true,
};

const DEFAULT_SHAPE_CONFIG: ShapeConfig = {
  photoFit: 'cover',
  fill: '#8b3dff',
  stroke: 'transparent',
  strokeWidth: 0,
  recolourable: true,
  allowPhotoDrop: false,
  preserveAspectRatio: true,
};

const DEFAULT_FORM_DATA = {
  name: '',
  slug: '',
  category_id: '',
  asset_type: 'frame' as AssetType,
  is_active: true,
  sort_order: 0,
  provider: 'admin',
  attribution: '',
  license_name: '',
  fabric_json: {},
  metadata: {},
};

export function DesignAssetForm({
  isOpen,
  onClose,
  asset,
  activeType,
  categories,
  onSaved,
}: DesignAssetFormProps) {
  const [formData, setFormData] = useState<any>({
    ...DEFAULT_FORM_DATA,
    asset_type: activeType,
  });

  // =========================================================
  // TEXT PRESET CONFIG
  // =========================================================

  const [textConfig, setTextConfig] = useState<TextPresetConfig>(DEFAULT_TEXT_CONFIG);
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [uploadedFonts, setUploadedFonts] = useState<
    Array<{ name: string; family: string; url?: string }>
  >([]);
  const [fontUploading, setFontUploading] = useState(false);
  const [previewBg, setPreviewBg] = useState<'light' | 'dark' | 'grid'>('light');
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // Discover and load custom fonts previously uploaded to text presets
  useEffect(() => {
    if (!isOpen || activeType !== 'text') return;

    let isMounted = true;
    const fetchExistingFonts = async () => {
      try {
        const res = await designAssetService.getAdminAssets({
          asset_type: 'text',
          per_page: 100,
        });
        const assets = res?.data || (Array.isArray(res) ? res : []);
        const discovered: Array<{ name: string; family: string; url?: string }> = [];
        const seen = new Set<string>();

        assets.forEach((a: DesignAsset) => {
          const fontName =
            a.fabric_json?.fontFamily ||
            a.metadata?.textStyle?.fontFamily ||
            a.metadata?.fontFamily;
          const fontUrl =
            a.file_url ||
            a.metadata?.fontUrl ||
            a.metadata?.textStyle?.fontUrl;

          if (fontName && fontUrl && !seen.has(fontName.toLowerCase())) {
            seen.add(fontName.toLowerCase());
            discovered.push({
              name: fontName,
              family: fontName,
              url: fontUrl,
            });
            void loadCustomFont(fontName, fontUrl);
          }
        });

        if (isMounted && discovered.length > 0) {
          setUploadedFonts((prev) => {
            const merged = [...prev];
            discovered.forEach((f) => {
              if (!merged.some((m) => m.name.toLowerCase() === f.name.toLowerCase())) {
                merged.push(f);
              }
            });
            return merged;
          });
        }
      } catch {
        // Non-blocking background font discovery
      }
    };

    void fetchExistingFonts();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeType]);

  // Load selected font (Google or uploaded) dynamically
  useEffect(() => {
    if (formData.asset_type !== 'text') return;
    const family = textConfig.fontFamily;
    if (!family) return;

    const googleItem = POPULAR_FONTS.find(
      (f) =>
        f.name.toLowerCase() === family.toLowerCase() ||
        f.family.toLowerCase().includes(family.toLowerCase())
    );

    if (googleItem) {
      void loadFont(googleItem);
      return;
    }

    const uploadedItem = uploadedFonts.find(
      (f) => f.name.toLowerCase() === family.toLowerCase()
    );

    if (uploadedItem?.url) {
      void loadCustomFont(
        family,
        uploadedItem.url,
        textConfig.fontWeight,
        textConfig.fontStyle
      );
    }
  }, [
    textConfig.fontFamily,
    textConfig.fontWeight,
    textConfig.fontStyle,
    formData.asset_type,
    uploadedFonts,
  ]);

  // Upload custom font (.ttf, .otf, .woff, .woff2)
  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    const ext = uploaded.name.split('.').pop()?.toLowerCase();
    if (!ext || !['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
      setError('Supported font formats: .ttf, .otf, .woff, .woff2');
      return;
    }

    try {
      setFontUploading(true);
      setError(null);

      // Clean file name to human-friendly font family name
      const baseName = uploaded.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();
      const cleanFamily = baseName || 'Custom Font';

      const blobUrl = URL.createObjectURL(uploaded);
      await loadCustomFont(
        cleanFamily,
        blobUrl,
        textConfig.fontWeight,
        textConfig.fontStyle
      );

      setUploadedFonts((prev) => [
        { name: cleanFamily, family: cleanFamily, url: blobUrl },
        ...prev.filter(
          (f) => f.name.toLowerCase() !== cleanFamily.toLowerCase()
        ),
      ]);

      setTextConfig((prev) => ({
        ...prev,
        fontFamily: cleanFamily,
        fontFileName: uploaded.name,
      }));

      setFontFile(uploaded);
    } catch (err: any) {
      console.error('Failed to load font file:', err);
      setError('Failed to load font into preview. Please verify file format.');
    } finally {
      setFontUploading(false);
      if (fontInputRef.current) {
        fontInputRef.current.value = '';
      }
    }
  };

  // Apply Canva-style text effects with preset configurations
  const applyTextEffect = (effect: TextEffectType) => {
    setTextConfig((prev) => {
      const updated = { ...prev, textEffect: effect };
      switch (effect) {
        case 'none':
          return {
            ...updated,
            shadowEnabled: false,
            strokeEnabled: false,
          };
        case 'shadow':
          return {
            ...updated,
            shadowEnabled: true,
            shadowColor: '#000000',
            shadowOffsetX: 4,
            shadowOffsetY: 4,
            shadowBlur: 6,
            shadowOpacity: 0.5,
          };
        case 'outline':
          return {
            ...updated,
            strokeEnabled: true,
            strokeColor: '#172554',
            strokeWidth: 3,
          };
        case 'glow':
          return {
            ...updated,
            shadowEnabled: true,
            shadowColor: '#38bdf8',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowBlur: 16,
            shadowOpacity: 0.85,
          };
        case 'lift':
          return {
            ...updated,
            shadowEnabled: true,
            shadowColor: '#000000',
            shadowOffsetX: 0,
            shadowOffsetY: 8,
            shadowBlur: 12,
            shadowOpacity: 0.35,
          };
        case 'splice':
          return {
            ...updated,
            strokeEnabled: true,
            strokeColor: '#0f172a',
            strokeWidth: 2,
            shadowEnabled: true,
            shadowColor: '#f43f5e',
            shadowOffsetX: 4,
            shadowOffsetY: 4,
            shadowBlur: 0,
            shadowOpacity: 0.9,
          };
        case 'echo':
          return {
            ...updated,
            shadowEnabled: true,
            shadowColor: '#6366f1',
            shadowOffsetX: 6,
            shadowOffsetY: 6,
            shadowBlur: 2,
            shadowOpacity: 0.55,
          };
        case 'offset':
          return {
            ...updated,
            shadowEnabled: true,
            shadowColor: '#000000',
            shadowOffsetX: 5,
            shadowOffsetY: 5,
            shadowBlur: 0,
            shadowOpacity: 1.0,
          };
        case 'neon':
          return {
            ...updated,
            fill: '#f0fdf4',
            strokeEnabled: true,
            strokeColor: '#22c55e',
            strokeWidth: 1,
            shadowEnabled: true,
            shadowColor: '#22c55e',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowBlur: 20,
            shadowOpacity: 0.9,
          };
        default:
          return updated;
      }
    });
  };

  // =========================================================
  // BACKGROUND CONFIG
  // =========================================================

  const [bgConfig, setBgConfig] = useState({
    bgType: 'color',
    color: '#ffffff',
    gradientAngle: 135,
    gradientColor1: '#3b82f6',
    gradientColor2: '#9333ea',
  });

  // =========================================================
  // ELEMENT CONFIG
  // =========================================================

  const [recolourable, setRecolourable] = useState(false);

  // =========================================================
  // SHAPE CONFIG
  // =========================================================

  const [shapeConfig, setShapeConfig] =
    useState<ShapeConfig>(DEFAULT_SHAPE_CONFIG);

  // =========================================================
  // FRAME CONFIG
  // =========================================================

  const [frameConfig, setFrameConfig] =
    useState<FrameConfig>(DEFAULT_FRAME_CONFIG);

  /**
   * Main frame visual.
   *
   * Example:
   * floral-frame.svg
   *
   * This should normally be the decorative overlay.
   */
  const [file, setFile] = useState<File | null>(null);

  /**
   * Optional thumbnail displayed in admin/frontend frame picker.
   */
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  /**
   * Separate SVG mask.
   *
   * This is important:
   *
   * overlay.svg = visual/decorative frame
   * mask.svg    = actual photo clipping area
   */
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [removeMask, setRemoveMask] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // =========================================================
  // INITIALIZE / EDIT
  // =========================================================

  useEffect(() => {
    if (!isOpen) return;

    if (asset) {
      const rawMetadata: Record<string, any> = toPlainObject(
        asset.metadata
      );
      const rawFabricJson: Record<string, any> = toPlainObject(
        asset.fabric_json
      );
      const rootMaskUrl =
        (asset as any).mask_url ||
        (asset as any).maskUrl ||
        (asset as any).mask_file_url ||
        (asset as any).maskFileUrl ||
        null;
      const storedMaskUrl =
        existingFrameMaskUrl(rawMetadata) || rootMaskUrl;
      // Keep dynamic JSON columns wide. Without this annotation TypeScript
      // infers a narrow union from the conditional frame property.
      const existingMetadata: Record<string, any> = {
        ...rawMetadata,
        ...(asset.asset_type === 'frame'
          ? {
            frame: {
              ...toPlainObject(rawMetadata.frame),
              ...(storedMaskUrl
                ? {
                  maskUrl: storedMaskUrl,
                  mask_url: storedMaskUrl,
                }
                : {}),
            },
          }
          : {}),
      };

      setFormData({
        ...asset,
        category_id: asset.category_id || '',
        fabric_json: rawFabricJson,
        metadata: existingMetadata,
        attribution: asset.attribution || '',
        license_name: asset.license_name || '',
      });

      // -----------------------------------------------------
      // TEXT
      // -----------------------------------------------------

      if (
        asset.asset_type === 'text' &&
        rawFabricJson
      ) {
        const textStyle = existingMetadata?.textStyle || {};
        const fontUrl =
          asset.file_url ||
          existingMetadata?.fontUrl ||
          textStyle?.fontUrl ||
          rawFabricJson.fontUrl;

        const fontFamily =
          textStyle.fontFamily ||
          rawFabricJson.fontFamily ||
          'Inter';

        if (fontUrl) {
          void loadCustomFont(
            fontFamily,
            fontUrl,
            textStyle.fontWeight || rawFabricJson.fontWeight,
            textStyle.fontStyle || rawFabricJson.fontStyle
          );
          setUploadedFonts((prev) => {
            if (!prev.some((f) => f.name.toLowerCase() === fontFamily.toLowerCase())) {
              return [
                { name: fontFamily, family: fontFamily, url: fontUrl },
                ...prev,
              ];
            }
            return prev;
          });
        }

        const rawFill = rawFabricJson.fill;
        const isGradient =
          textStyle.fill?.type === 'gradient' ||
          (rawFill && typeof rawFill === 'object' && rawFill.type === 'linear');
        const gradAngle =
          textStyle.fill?.gradient?.angle ?? 135;
        const gradColor1 =
          textStyle.fill?.gradient?.color1 ??
          (rawFill?.colorStops?.[0]?.color || '#F97316');
        const gradColor2 =
          textStyle.fill?.gradient?.color2 ??
          (rawFill?.colorStops?.[1]?.color || '#9333EA');

        const isStroke =
          textStyle.stroke?.enabled ??
          (Number(rawFabricJson.strokeWidth || 0) > 0);
        const strokeColor =
          textStyle.stroke?.color || rawFabricJson.stroke || '#172554';
        const strokeWidth =
          textStyle.stroke?.width ??
          Number(rawFabricJson.strokeWidth || 3);

        const shadowRaw = rawFabricJson.shadow;
        const isShadow =
          textStyle.shadow?.enabled ?? Boolean(shadowRaw);
        const shadowColor =
          textStyle.shadow?.color || shadowRaw?.color || '#000000';
        const shadowOffsetX =
          textStyle.shadow?.offsetX ?? shadowRaw?.offsetX ?? 4;
        const shadowOffsetY =
          textStyle.shadow?.offsetY ?? shadowRaw?.offsetY ?? 4;
        const shadowBlur =
          textStyle.shadow?.blur ?? shadowRaw?.blur ?? 6;
        const shadowOpacity =
          textStyle.shadow?.opacity ?? 0.5;

        setTextConfig({
          text:
            rawFabricJson.text ||
            textStyle.defaultText ||
            asset.name ||
            'Bold Moves',
          fontFamily,
          fontSize:
            textStyle.fontSize ||
            rawFabricJson.fontSize ||
            36,
          fontWeight:
            textStyle.fontWeight ||
            rawFabricJson.fontWeight ||
            '700',
          fontStyle:
            (textStyle.fontStyle ||
              rawFabricJson.fontStyle ||
              'normal') as 'normal' | 'italic',
          textAlign:
            (textStyle.textAlign ||
              rawFabricJson.textAlign ||
              'center') as 'left' | 'center' | 'right',
          charSpacing:
            textStyle.letterSpacing ??
            rawFabricJson.charSpacing ??
            0,
          lineHeight:
            textStyle.lineHeight ??
            rawFabricJson.lineHeight ??
            1.2,
          fill:
            typeof rawFill === 'string'
              ? rawFill
              : textStyle.fill?.color || '#F4510B',
          gradientEnabled: isGradient,
          gradientAngle: gradAngle,
          gradientColor1: gradColor1,
          gradientColor2: gradColor2,
          strokeEnabled: isStroke,
          strokeColor,
          strokeWidth,
          shadowEnabled: isShadow,
          shadowColor,
          shadowOffsetX,
          shadowOffsetY,
          shadowBlur,
          shadowOpacity,
          textEffect:
            (textStyle.effect ||
              existingMetadata.textEffect ||
              'none') as TextEffectType,
          fontUrl: fontUrl || '',
          fontFileName: textStyle.fontFileName || '',
        });
      }

      // -----------------------------------------------------
      // ELEMENT
      // -----------------------------------------------------

      if (
        asset.asset_type === 'element' &&
        existingMetadata
      ) {
        setRecolourable(
          Boolean(existingMetadata.recolourable)
        );
      }

      // -----------------------------------------------------
      // SHAPE
      // -----------------------------------------------------

      if (asset.asset_type === 'shape') {
        const savedShape = {
          ...toPlainObject(rawFabricJson),
          ...toPlainObject(existingMetadata.shape),
        };

        setShapeConfig({
          photoFit:
            savedShape.photoFit === 'contain' ? 'contain' : 'cover',
          fill:
            typeof savedShape.fill === 'string'
              ? savedShape.fill
              : '#8b3dff',
          stroke:
            typeof savedShape.stroke === 'string'
              ? savedShape.stroke
              : 'transparent',
          strokeWidth:
            Number(savedShape.strokeWidth) || 0,
          recolourable:
            savedShape.recolourable !== false,
          // Photo drop belongs only to Frames.
          allowPhotoDrop: false,
          preserveAspectRatio:
            savedShape.preserveAspectRatio !== false,
        });
      }

      // -----------------------------------------------------
      // FRAME
      // -----------------------------------------------------

      if (
        asset.asset_type === 'frame' &&
        existingMetadata
      ) {
        const nestedFrame: Record<string, any> = toPlainObject(
          existingMetadata.frame
        );
        const savedFrame: Record<string, any> = Object.keys(nestedFrame).length
          ? nestedFrame
          : existingMetadata;
        const requestedMaskType =
          savedFrame.maskType ||
          savedFrame.mask_type ||
          (storedMaskUrl
            ? inferUploadedMaskType(storedMaskUrl)
            : savedFrame.shape || 'rectangle');

        setFrameConfig({
          ...DEFAULT_FRAME_CONFIG,

          maskType: isFrameMaskType(requestedMaskType)
            ? requestedMaskType
            : 'rectangle',

          width:
            Number(savedFrame.width) ||
            500,

          height:
            Number(savedFrame.height) ||
            500,

          unit:
            savedFrame.unit === 'mm'
              ? 'mm'
              : 'px',

          cornerRadius:
            Number(savedFrame.cornerRadius) ||
            30,

          circleRadius:
            Number(savedFrame.circleRadius) ||
            250,

          polygonPoints:
            savedFrame.polygonPoints ||
            '0,0 500,0 500,500 0,500',

          svgPath:
            savedFrame.svgPath ||
            '',

          photoFit:
            savedFrame.photoFit === 'contain'
              ? 'contain'
              : 'cover',

          allowPhotoMove:
            savedFrame.allowPhotoMove !== false,

          allowPhotoZoom:
            savedFrame.allowPhotoZoom !== false,

          allowPhotoRotate:
            savedFrame.allowPhotoRotate !== false,

          allowPhotoReplace:
            savedFrame.allowPhotoReplace !== false,

          preserveAspectRatio:
            savedFrame.preserveAspectRatio !== false,
        });
      }

      // -----------------------------------------------------
      // BACKGROUND
      // -----------------------------------------------------

      if (
        asset.asset_type === 'background' &&
        existingMetadata
      ) {
        setBgConfig({
          bgType:
            existingMetadata.bgType ||
            'color',

          color:
            existingMetadata.color ||
            '#ffffff',

          gradientAngle:
            existingMetadata.gradientAngle ||
            135,

          gradientColor1:
            existingMetadata.gradientColor1 ||
            '#3b82f6',

          gradientColor2:
            existingMetadata.gradientColor2 ||
            '#9333ea',
        });
      }
    } else {
      // =====================================================
      // NEW ASSET
      // =====================================================

      setFormData({
        ...DEFAULT_FORM_DATA,
        asset_type: activeType,
      });

      setTextConfig(DEFAULT_TEXT_CONFIG);
      setFontFile(null);

      setBgConfig({
        bgType: 'color',
        color: '#ffffff',
        gradientAngle: 135,
        gradientColor1: '#3b82f6',
        gradientColor2: '#9333ea',
      });

      setRecolourable(false);

      setShapeConfig(DEFAULT_SHAPE_CONFIG);

      setFrameConfig(DEFAULT_FRAME_CONFIG);
    }

    setFile(null);
    setThumbnail(null);
    setMaskFile(null);
    setRemoveMask(false);
    setError(null);
  }, [asset, activeType, isOpen]);

  if (!isOpen) {
    return null;
  }

  // =========================================================
  // COMMON HELPERS
  // =========================================================

  const handleNameChange = (val: string) => {
    setFormData((prev: any) => {
      const next = {
        ...prev,
        name: val,
      };

      if (!asset) {
        next.slug = val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
      }

      return next;
    });
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.asset_type === formData.asset_type &&
      (c.is_active || c.id === formData.category_id)
  );

  const fileExt = file
    ? getFileExtension(file.name)
    : asset?.file_url
      ? getFileExtension(asset.file_url)
      : '';

  const fileInfo = fileExt
    ? getFormatBadgeInfo(fileExt)
    : null;

  const currentMaskUrl = removeMask
    ? null
    : existingFrameMaskUrl(formData.metadata);

  const handleMainFileChange = (
    newFile: File | null
  ) => {
    setFile(newFile);

    if (
      newFile &&
      (!formData.name ||
        formData.name.trim() === '')
    ) {
      const cleanName = newFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();

      if (cleanName) {
        handleNameChange(cleanName);
      }
    }
  };

  const handleMaskFileChange = (newFile: File | null) => {
    setMaskFile(newFile);
    if (newFile) {
      setRemoveMask(false);
    }
  };

  const updateFrameConfig = <
    K extends keyof FrameConfig
  >(
    key: K,
    value: FrameConfig[K]
  ) => {
    setFrameConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateShapeConfig = <K extends keyof ShapeConfig>(
    key: K,
    value: ShapeConfig[K]
  ) => {
    setShapeConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // =========================================================
  // FRAME MASK DESCRIPTION
  // =========================================================

  const getMaskDescription = () => {
    switch (frameConfig.maskType) {
      case 'rectangle':
        return 'Creates a simple rectangular photo area.';

      case 'rounded_rectangle':
        return 'Creates a rectangular photo area with rounded corners.';

      case 'circle':
        return 'Creates a circular photo area.';

      case 'ellipse':
        return 'Creates an oval / elliptical photo area.';

      case 'polygon':
        return 'Use custom polygon points to create an irregular photo area.';

      case 'svg_path':
        return 'Uses SVG path data as the photo clipping path.';

      case 'svg_mask':
        return 'Uses a separate uploaded SVG as the photo mask.';

      case 'alpha_mask':
        return 'Uses transparent PNG/WebP alpha information as the photo mask.';

      default:
        return '';
    }
  };

  // =========================================================
  // SUBMIT
  // =========================================================

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError(null);

    if (!formData.category_id) {
      setError(
        `Please select a category for this ${formData.asset_type} before saving.`
      );
      return;
    }


    setLoading(true);

    try {
      let finalFabricJson: any =
        toPlainObject(formData.fabric_json);

      let finalMetadata: any =
        toPlainObject(formData.metadata);

      // =====================================================
      // TEXT
      // =====================================================

      if (
        formData.asset_type === 'text'
      ) {
        let fabricFill: any = textConfig.fill;
        if (textConfig.gradientEnabled) {
          fabricFill = {
            type: 'linear',
            gradientUnits: 'percentage',
            coords: calculateGradientCoords(textConfig.gradientAngle),
            colorStops: [
              { offset: 0, color: textConfig.gradientColor1 },
              { offset: 1, color: textConfig.gradientColor2 },
            ],
          };
        }

        const shadowObj = textConfig.shadowEnabled
          ? {
              color: hexToRgba(textConfig.shadowColor, textConfig.shadowOpacity),
              blur: Number(textConfig.shadowBlur),
              offsetX: Number(textConfig.shadowOffsetX),
              offsetY: Number(textConfig.shadowOffsetY),
            }
          : undefined;

        finalFabricJson = {
          type: 'Textbox',
          text: textConfig.text || formData.name,
          fontFamily: textConfig.fontFamily,
          fontSize: Number(textConfig.fontSize),
          fontWeight: String(textConfig.fontWeight),
          fontStyle: textConfig.fontStyle,
          fill: fabricFill,
          textAlign: textConfig.textAlign,
          charSpacing: Number(textConfig.charSpacing),
          lineHeight: Number(textConfig.lineHeight),
          stroke:
            textConfig.strokeEnabled && Number(textConfig.strokeWidth) > 0
              ? textConfig.strokeColor
              : undefined,
          strokeWidth: textConfig.strokeEnabled ? Number(textConfig.strokeWidth) : 0,
          strokeUniform: true,
          shadow: shadowObj,
          editable: true,
          selectable: true,
          fontUrl: fontFile ? undefined : (textConfig.fontUrl || undefined),
        };

        const textStyleMetadata = {
          defaultText: textConfig.text || formData.name,
          fontFamily: textConfig.fontFamily,
          fontWeight: textConfig.fontWeight,
          fontStyle: textConfig.fontStyle,
          fontSize: Number(textConfig.fontSize),
          textAlign: textConfig.textAlign,
          letterSpacing: Number(textConfig.charSpacing),
          lineHeight: Number(textConfig.lineHeight),
          fill: {
            type: textConfig.gradientEnabled ? 'gradient' : 'solid',
            color: textConfig.fill,
            gradient: textConfig.gradientEnabled
              ? {
                  type: 'linear',
                  angle: Number(textConfig.gradientAngle),
                  color1: textConfig.gradientColor1,
                  color2: textConfig.gradientColor2,
                }
              : undefined,
          },
          stroke: {
            enabled: textConfig.strokeEnabled,
            color: textConfig.strokeColor,
            width: Number(textConfig.strokeWidth),
          },
          shadow: {
            enabled: textConfig.shadowEnabled,
            color: textConfig.shadowColor,
            offsetX: Number(textConfig.shadowOffsetX),
            offsetY: Number(textConfig.shadowOffsetY),
            blur: Number(textConfig.shadowBlur),
            opacity: Number(textConfig.shadowOpacity),
          },
          effect: textConfig.textEffect,
          fontUrl: fontFile ? undefined : (textConfig.fontUrl || undefined),
          fontFileName:
            textConfig.fontFileName || (fontFile ? fontFile.name : undefined),
        };

        finalMetadata = {
          ...finalMetadata,
          textStyle: textStyleMetadata,
          textEffect: textConfig.textEffect,
          fontUrl: fontFile ? undefined : (textConfig.fontUrl || undefined),
        };
      }

      // =====================================================
      // ELEMENT
      // =====================================================

      else if (
        formData.asset_type === 'element'
      ) {
        finalMetadata = {
          ...finalMetadata,
          recolourable,
        };
      }

      // =====================================================
      // SHAPE / PHOTO CLIPPING SHAPE
      // =====================================================

      else if (formData.asset_type === 'shape') {
        const shapeDefinition = {
          version: 1,
          type: 'photo-shape',
          shapeType: 'custom-svg',
          clipType: 'svg',
          sourceUrl: asset?.file_url || null,
          maskUrl: asset?.file_url || null,
          photoFit: shapeConfig.photoFit,
          fill: shapeConfig.fill,
          stroke: shapeConfig.stroke,
          strokeWidth: Number(shapeConfig.strokeWidth),
          recolourable: shapeConfig.recolourable,
          allowPhotoDrop: false,
          preserveAspectRatio: shapeConfig.preserveAspectRatio,
        };

        finalMetadata = {
          ...finalMetadata,
          isPhotoShape: false,
          isShape: true,
          isFrame: false,
          shapeType: 'custom-svg',
          clipType: 'svg',
          photoFit: shapeConfig.photoFit,
          recolourable: shapeConfig.recolourable,
          allowPhotoDrop: false,
          shape: shapeDefinition,
        };

        finalFabricJson = {
          ...shapeDefinition,
          isShape: true,
          isFrame: false,
          isCanvaPlaceholder: false,
          allowPhotoDrop: false,
          sourceType: 'shape',
          assetId: asset?.id || null,
        };
      }

      // =====================================================
      // FRAME
      // =====================================================

      else if (
        formData.asset_type === 'frame'
      ) {
        /*
         * Frames now use the same simple asset model as Shapes:
         * ONE uploaded SVG is both the visible frame geometry and the
         * clipping geometry. The only behavioural difference is that Frames
         * accept photo hover/drop while Shapes do not.
         */
        const frameDefinition = {
          version: 1,
          type: 'photo-frame',
          frameShape: 'custom-svg',
          shapeType: 'custom-svg',
          clipType: 'svg',
          sourceUrl: asset?.file_url || null,
          overlayUrl: asset?.file_url || null,
          maskUrl: asset?.file_url || null,
          mask_url: asset?.file_url || null,
          maskType: 'svg_mask',
          photoFit: frameConfig.photoFit,
          allowPhotoDrop: true,
          allowPhotoMove: frameConfig.allowPhotoMove,
          allowPhotoZoom: frameConfig.allowPhotoZoom,
          allowPhotoRotate: frameConfig.allowPhotoRotate,
          allowPhotoReplace: frameConfig.allowPhotoReplace,
          preserveAspectRatio: frameConfig.preserveAspectRatio,
        };

        finalMetadata = {
          ...finalMetadata,
          isFrame: true,
          isShape: true,
          isPhotoShape: true,
          isCanvaPlaceholder: true,
          allowPhotoDrop: true,
          frameShape: 'custom-svg',
          shapeType: 'custom-svg',
          clipType: 'svg',
          maskType: 'svg_mask',
          photoFit: frameConfig.photoFit,
          frame: frameDefinition,
        };

        finalFabricJson = {
          ...frameDefinition,
          isFrame: true,
          isShape: true,
          isCanvaPlaceholder: true,
          allowPhotoDrop: true,
          sourceType: 'frame',
          assetId: asset?.id || null,
          frameId: asset?.id || null,
        };
      }

      // =====================================================
      // BACKGROUND
      // =====================================================

      else if (
        formData.asset_type === 'background'
      ) {
        finalMetadata = {
          ...finalMetadata,
          ...bgConfig,
        };
      }

      // =====================================================
      // PAYLOAD
      // =====================================================

      const payload: any = {
        ...formData,

        category_id: String(
          formData.category_id
        ).trim(),

        fabric_json:
          finalFabricJson,

        metadata:
          finalMetadata,
      };

      // -----------------------------------------------------
      // Main file
      // -----------------------------------------------------

      if (file) {
        payload.file = file;
      } else if (formData.asset_type === 'text' && fontFile) {
        payload.file = fontFile;
      }

      // -----------------------------------------------------
      // Thumbnail
      // -----------------------------------------------------

      if (thumbnail) {
        payload.thumbnail = thumbnail;
      }

      // -----------------------------------------------------
      // Frame mask
      // -----------------------------------------------------

      if (
        formData.asset_type === 'frame' &&
        maskFile
      ) {
        payload.mask_file = maskFile;
      }

      if (formData.asset_type === 'frame') {
        payload.remove_mask = removeMask;
        payload.mask_type = frameConfig.maskType;
      }

      // =====================================================
      // CREATE / UPDATE
      // =====================================================

      if (asset) {
        await designAssetService.updateAsset(
          asset.id,
          payload
        );
      } else {
        await designAssetService.createAsset(
          payload
        );
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error(
        'Failed to save asset:',
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save design asset.'
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {asset
                ? 'Edit Design Asset'
                : 'Add Design Asset'}
            </h2>

            <p className="text-xs text-gray-500 mt-0.5">
              Configure properties for artwork
              editor elements
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!asset && (
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                title="Upload multiple files or entire folder"
              >
                <FolderUp className="w-3.5 h-3.5 text-blue-600" />
                <span>Folder / Bulk Upload</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================================================= */}
        {/* FORM */}
        {/* ================================================= */}

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar"
        >
          {/* ================================================= */}
          {/* ERROR */}
          {/* ================================================= */}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          {/* ================================================= */}
          {/* COMMON FIELDS */}
          {/* ================================================= */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Asset Name{' '}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  handleNameChange(
                    e.target.value
                  )
                }
                placeholder="e.g. Floral Circle Frame"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Slug{' '}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Asset Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Asset Type{' '}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <select
                value={formData.asset_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    asset_type:
                      e.target.value as AssetType,
                    category_id: '',
                  })
                }
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="text">
                  Text Preset
                </option>

                <option value="photo">
                  Photo
                </option>

                <option value="frame">
                  Frame
                </option>

                <option value="shape">
                  Photo Shape / Custom SVG
                </option>

                <option value="element">
                  Element / Graphic
                </option>

                <option value="background">
                  Background
                </option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Category{' '}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <select
                required
                value={
                  formData.category_id
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category_id:
                      e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="" disabled>
                  -- Select Category --
                </option>

                {filteredCategories.map(
                  (cat) => (
                    <option
                      key={cat.id}
                      value={cat.id}
                    >
                      {cat.name}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* ================================================= */}
          {/* TEXT CONFIG */}
          {/* ================================================= */}

          {formData.asset_type === 'text' && (
            <div className="space-y-6">
              {/* HIDDEN FONT FILE INPUT */}
              <input
                ref={fontInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleFontUpload}
                className="hidden"
              />

              {/* ------------------------------------------------- */}
              {/* 1. TYPOGRAPHY & FONT SELECTION                    */}
              {/* ------------------------------------------------- */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Typography & Font Family
                    </h3>
                  </div>
                  <span className="text-[11px] font-medium text-gray-500">
                    Canva-Style Text Style Preset
                  </span>
                </div>

                {/* Preview / Default Text */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Preview / Default Text <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={textConfig.text}
                    onChange={(e) =>
                      setTextConfig({
                        ...textConfig,
                        text: e.target.value,
                      })
                    }
                    placeholder="e.g. BOLD MOVES"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    This default text will appear when the preset is added to the canvas and remains 100% editable.
                  </p>
                </div>

                {/* Font Family Selector & Font Upload Button */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2 relative">
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Font Family
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsFontPickerOpen((prev) => !prev)}
                      className="w-full h-[38px] px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white hover:bg-gray-50 flex items-center justify-between text-left transition shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <span
                        className="truncate font-semibold text-gray-800"
                        style={{ fontFamily: `"${textConfig.fontFamily}", sans-serif` }}
                      >
                        {textConfig.fontFamily}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1.5" />
                    </button>

                    {isFontPickerOpen && (
                      <FontPickerPopover
                        currentFamily={textConfig.fontFamily}
                        customFonts={uploadedFonts}
                        onSelectFamily={(family) => {
                          setTextConfig((prev) => ({
                            ...prev,
                            fontFamily: family,
                          }));
                          setIsFontPickerOpen(false);
                        }}
                        onClose={() => setIsFontPickerOpen(false)}
                      />
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => fontInputRef.current?.click()}
                      disabled={fontUploading}
                      className="w-full h-[38px] px-3 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                    >
                      {fontUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                          <span>Upload Font</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {textConfig.fontFileName && (
                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[11px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                        Custom Font File
                      </span>
                      <span className="truncate max-w-[280px]">
                        {textConfig.fontFileName}
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-600 font-medium">
                      .ttf / .otf / .woff / .woff2
                    </span>
                  </div>
                )}

                {/* Font Weight, Style, Size, Align */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Font Weight
                    </label>
                    <select
                      value={String(textConfig.fontWeight)}
                      onChange={(e) =>
                        setTextConfig({
                          ...textConfig,
                          fontWeight: Number(e.target.value) || 400,
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="100">100 - Thin</option>
                      <option value="200">200 - Extra Light</option>
                      <option value="300">300 - Light</option>
                      <option value="400">400 - Regular</option>
                      <option value="500">500 - Medium</option>
                      <option value="600">600 - Semi Bold</option>
                      <option value="700">700 - Bold</option>
                      <option value="800">800 - Extra Bold</option>
                      <option value="900">900 - Black</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Font Style
                    </label>
                    <select
                      value={textConfig.fontStyle}
                      onChange={(e) =>
                        setTextConfig({
                          ...textConfig,
                          fontStyle: e.target.value as 'normal' | 'italic',
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="italic">Italic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Font Size (px)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="200"
                      value={textConfig.fontSize}
                      onChange={(e) =>
                        setTextConfig({
                          ...textConfig,
                          fontSize: Number(e.target.value) || 36,
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Text Align
                    </label>
                    <div className="flex border border-gray-300 rounded-lg bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setTextConfig({ ...textConfig, textAlign: 'left' })
                        }
                        className={`flex-1 py-1.5 flex items-center justify-center transition ${
                          textConfig.textAlign === 'left'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="Align Left"
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTextConfig({ ...textConfig, textAlign: 'center' })
                        }
                        className={`flex-1 py-1.5 flex items-center justify-center transition border-x border-gray-200 ${
                          textConfig.textAlign === 'center'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="Align Center"
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTextConfig({ ...textConfig, textAlign: 'right' })
                        }
                        className={`flex-1 py-1.5 flex items-center justify-center transition ${
                          textConfig.textAlign === 'right'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="Align Right"
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Letter Spacing & Line Height */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Letter Spacing ({textConfig.charSpacing})
                    </label>
                    <input
                      type="range"
                      min="-50"
                      max="200"
                      value={textConfig.charSpacing}
                      onChange={(e) =>
                        setTextConfig({
                          ...textConfig,
                          charSpacing: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Line Height ({textConfig.lineHeight})
                    </label>
                    <input
                      type="range"
                      min="0.8"
                      max="2.5"
                      step="0.05"
                      value={textConfig.lineHeight}
                      onChange={(e) =>
                        setTextConfig({
                          ...textConfig,
                          lineHeight: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------- */}
              {/* 2. TEXT COLOR & GRADIENT                          */}
              {/* ------------------------------------------------- */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Color & Fill
                    </h3>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] font-medium text-gray-600">
                      Gradient Fill
                    </span>
                    <input
                      type="checkbox"
                      checked={textConfig.gradientEnabled}
                      onChange={(e) =>
                        setTextConfig({
                          ...textConfig,
                          gradientEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-purple-600 rounded-sm focus:ring-purple-500"
                    />
                  </label>
                </div>

                {!textConfig.gradientEnabled ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={textConfig.fill}
                        onChange={(e) =>
                          setTextConfig({
                            ...textConfig,
                            fill: e.target.value,
                          })
                        }
                        className="w-10 h-10 p-1 border border-gray-300 rounded-xl bg-white cursor-pointer shadow-2xs"
                      />
                      <input
                        type="text"
                        value={textConfig.fill}
                        onChange={(e) =>
                          setTextConfig({
                            ...textConfig,
                            fill: e.target.value,
                          })
                        }
                        className="w-28 px-2.5 py-1.5 text-xs font-mono uppercase border border-gray-300 rounded-lg bg-white"
                      />
                      <span className="text-xs text-gray-500">Solid Fill</span>
                    </div>

                    {/* Quick Swatches */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] text-gray-400 mr-1">Quick:</span>
                      {QUICK_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTextConfig({ ...textConfig, fill: c })}
                          className="w-5 h-5 rounded-md border border-gray-300 transition hover:scale-110 shadow-2xs"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Color 1
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={textConfig.gradientColor1}
                            onChange={(e) =>
                              setTextConfig({
                                ...textConfig,
                                gradientColor1: e.target.value,
                              })
                            }
                            className="w-8 h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                          />
                          <input
                            type="text"
                            value={textConfig.gradientColor1}
                            onChange={(e) =>
                              setTextConfig({
                                ...textConfig,
                                gradientColor1: e.target.value,
                              })
                            }
                            className="w-20 px-2 py-1 text-xs font-mono uppercase border border-gray-300 rounded bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Color 2
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={textConfig.gradientColor2}
                            onChange={(e) =>
                              setTextConfig({
                                ...textConfig,
                                gradientColor2: e.target.value,
                              })
                            }
                            className="w-8 h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                          />
                          <input
                            type="text"
                            value={textConfig.gradientColor2}
                            onChange={(e) =>
                              setTextConfig({
                                ...textConfig,
                                gradientColor2: e.target.value,
                              })
                            }
                            className="w-20 px-2 py-1 text-xs font-mono uppercase border border-gray-300 rounded bg-white"
                          />
                        </div>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Angle ({textConfig.gradientAngle}°)
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={textConfig.gradientAngle}
                          onChange={(e) =>
                            setTextConfig({
                              ...textConfig,
                              gradientAngle: Number(e.target.value),
                            })
                          }
                          className="w-full accent-purple-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ------------------------------------------------- */}
              {/* 3. STROKE / OUTLINE & SHADOW                      */}
              {/* ------------------------------------------------- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* STROKE / OUTLINE */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Outline / Stroke
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="text-[11px] font-medium text-gray-600">
                        {textConfig.strokeEnabled ? 'ON' : 'OFF'}
                      </span>
                      <input
                        type="checkbox"
                        checked={textConfig.strokeEnabled}
                        onChange={(e) =>
                          setTextConfig({
                            ...textConfig,
                            strokeEnabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500"
                      />
                    </label>
                  </div>

                  {textConfig.strokeEnabled && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={textConfig.strokeColor}
                          onChange={(e) =>
                            setTextConfig({
                              ...textConfig,
                              strokeColor: e.target.value,
                            })
                          }
                          className="w-8 h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                        />
                        <input
                          type="text"
                          value={textConfig.strokeColor}
                          onChange={(e) =>
                            setTextConfig({
                              ...textConfig,
                              strokeColor: e.target.value,
                            })
                          }
                          className="w-24 px-2 py-1 text-xs font-mono uppercase border border-gray-300 rounded bg-white"
                        />
                        <span className="text-[11px] text-gray-500">Color</span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-gray-700 mb-1">
                          <span>Stroke Width</span>
                          <span className="font-semibold">{textConfig.strokeWidth}px</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={textConfig.strokeWidth}
                          onChange={(e) =>
                            setTextConfig({
                              ...textConfig,
                              strokeWidth: Number(e.target.value),
                            })
                          }
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* SHADOW */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Shadow
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="text-[11px] font-medium text-gray-600">
                        {textConfig.shadowEnabled ? 'ON' : 'OFF'}
                      </span>
                      <input
                        type="checkbox"
                        checked={textConfig.shadowEnabled}
                        onChange={(e) =>
                          setTextConfig({
                            ...textConfig,
                            shadowEnabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500"
                      />
                    </label>
                  </div>

                  {textConfig.shadowEnabled && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={textConfig.shadowColor}
                          onChange={(e) =>
                            setTextConfig({
                              ...textConfig,
                              shadowColor: e.target.value,
                            })
                          }
                          className="w-8 h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                        />
                        <input
                          type="text"
                          value={textConfig.shadowColor}
                          onChange={(e) =>
                            setTextConfig({
                              ...textConfig,
                              shadowColor: e.target.value,
                            })
                          }
                          className="w-24 px-2 py-1 text-xs font-mono uppercase border border-gray-300 rounded bg-white"
                        />
                        <span className="text-[11px] text-gray-500">Color</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <label className="block text-gray-600 mb-0.5">
                            Offset X ({textConfig.shadowOffsetX}px)
                          </label>
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            value={textConfig.shadowOffsetX}
                            onChange={(e) =>
                              setTextConfig({
                                ...textConfig,
                                shadowOffsetX: Number(e.target.value),
                              })
                            }
                            className="w-full accent-blue-600 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-0.5">
                            Offset Y ({textConfig.shadowOffsetY}px)
                          </label>
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            value={textConfig.shadowOffsetY}
                            onChange={(e) =>
                              setTextConfig({
                                ...textConfig,
                                shadowOffsetY: Number(e.target.value),
                              })
                            }
                            className="w-full accent-blue-600 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <label className="block text-gray-600 mb-0.5">
                            Blur ({textConfig.shadowBlur}px)
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="30"
                            value={textConfig.shadowBlur}
                            onChange={(e) =>
                              setTextConfig({
                                ...textConfig,
                                shadowBlur: Number(e.target.value),
                              })
                            }
                            className="w-full accent-blue-600 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-0.5">
                            Opacity ({Math.round(textConfig.shadowOpacity * 100)}%)
                          </label>
                          <input
                            type="range"
                            min="0.05"
                            max="1"
                            step="0.05"
                            value={textConfig.shadowOpacity}
                            onChange={(e) =>
                              setTextConfig({
                                ...textConfig,
                                shadowOpacity: Number(e.target.value),
                              })
                            }
                            className="w-full accent-blue-600 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------- */}
              {/* 4. CANVA-STYLE TEXT EFFECTS                       */}
              {/* ------------------------------------------------- */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Text Effects (Canva Presets)
                  </h3>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {TEXT_EFFECT_OPTIONS.map((eff) => {
                    const isActive = textConfig.textEffect === eff.id;
                    return (
                      <button
                        key={eff.id}
                        type="button"
                        onClick={() => applyTextEffect(eff.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'
                        }`}
                      >
                        <span className="text-xs font-bold block">{eff.label}</span>
                        <span
                          className={`text-[10px] mt-1 leading-tight line-clamp-1 ${
                            isActive ? 'text-blue-100' : 'text-gray-400'
                          }`}
                        >
                          {eff.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ------------------------------------------------- */}
              {/* 5. LIVE PREVIEW CARD                              */}
              {/* ------------------------------------------------- */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Live Preview
                    </h3>
                  </div>

                  {/* Background mode switcher */}
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewBg('light')}
                      className={`p-1 rounded-md transition ${
                        previewBg === 'light'
                          ? 'bg-gray-100 text-gray-900 shadow-2xs'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Light Background"
                    >
                      <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewBg('dark')}
                      className={`p-1 rounded-md transition ${
                        previewBg === 'dark'
                          ? 'bg-gray-800 text-white shadow-2xs'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Dark Background"
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewBg('grid')}
                      className={`p-1 rounded-md transition ${
                        previewBg === 'grid'
                          ? 'bg-gray-100 text-gray-900 shadow-2xs'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Grid Background"
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Preview viewport */}
                <div
                  className={`min-h-[140px] rounded-xl border flex items-center justify-center p-6 overflow-hidden transition-colors ${
                    previewBg === 'dark'
                      ? 'bg-gray-900 border-gray-800'
                      : previewBg === 'grid'
                        ? 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50 border-gray-200'
                        : 'bg-white border-gray-200 shadow-inner'
                  }`}
                >
                  <div
                    style={{
                      fontFamily: `"${textConfig.fontFamily}", sans-serif`,
                      fontSize: `${Math.min(Math.max(textConfig.fontSize, 18), 52)}px`,
                      fontWeight: textConfig.fontWeight,
                      fontStyle: textConfig.fontStyle,
                      textAlign: textConfig.textAlign,
                      letterSpacing: `${textConfig.charSpacing / 10}px`,
                      lineHeight: textConfig.lineHeight,
                      ...(textConfig.gradientEnabled
                        ? {
                            backgroundImage: `linear-gradient(${textConfig.gradientAngle}deg, ${textConfig.gradientColor1}, ${textConfig.gradientColor2})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }
                        : {
                            color: textConfig.fill,
                          }),
                      ...(textConfig.strokeEnabled
                        ? {
                            WebkitTextStroke: `${textConfig.strokeWidth}px ${textConfig.strokeColor}`,
                          }
                        : {}),
                      ...(textConfig.shadowEnabled
                        ? {
                            textShadow: `${textConfig.shadowOffsetX}px ${textConfig.shadowOffsetY}px ${textConfig.shadowBlur}px ${hexToRgba(
                              textConfig.shadowColor,
                              textConfig.shadowOpacity
                            )}`,
                          }
                        : {}),
                    }}
                    className="select-none break-words max-w-full"
                  >
                    {textConfig.text || 'BOLD MOVES'}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                  <span>Font: <strong className="text-gray-700">{textConfig.fontFamily}</strong> ({textConfig.fontWeight})</span>
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> 100% Editable Canvas Text
                  </span>
                </div>
              </div>

              {/* ------------------------------------------------- */}
              {/* 6. THUMBNAIL / PREVIEW IMAGE (OPTIONAL)           */}
              {/* ------------------------------------------------- */}
              <div>
                <ArtworkFileUpload
                  label="Preset Thumbnail / Preview Image (Optional)"
                  description="Optional visual thumbnail card shown in the designer's Text Preset catalog. If not uploaded, the live rendered style is displayed."
                  accept={['png', 'jpg', 'jpeg', 'webp', 'svg']}
                  returnType="file"
                  value={thumbnail || asset?.thumbnail_url || null}
                  onFileChange={(f) => setThumbnail(f as File)}
                  onRemove={() => setThumbnail(null)}
                />
              </div>
            </div>
          )}

          {/* ================================================= */}
          {/* PHOTO / ELEMENT / BACKGROUND / FRAME UPLOAD */}
          {/* ================================================= */}

          {(formData.asset_type ===
            'photo' ||
            formData.asset_type ===
            'frame' ||
            formData.asset_type ===
            'element' ||
            formData.asset_type ===
            'shape' ||
            (formData.asset_type ===
              'background' &&
              bgConfig.bgType ===
              'image')) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <FolderUp className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-900">
                      Need to upload multiple assets or an entire folder of {formData.asset_type}s?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(true)}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-2xs flex items-center gap-1.5"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    <span>Upload Entire Folder</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Main Asset */}
                  <div>
                    <ArtworkFileUpload
                      label={
                        formData.asset_type ===
                          'frame'
                          ? 'Frame SVG / Clipping Shape'
                          : formData.asset_type === 'shape'
                            ? 'Shape SVG / Clipping Path'
                            : 'Main Asset File'
                      }
                      description={
                        formData.asset_type ===
                          'frame'
                          ? 'Upload one closed, solid SVG silhouette. This same SVG is used as the visible frame and the customer-photo clipping area.'
                          : formData.asset_type === 'shape'
                            ? 'Upload one closed, solid SVG silhouette. It becomes the clipping shape for customer photos.'
                            : 'Supported: SVG, PDF, TIFF, PNG, JPG, WebP'
                      }
                      accept={
                        formData.asset_type === 'shape' || formData.asset_type === 'frame'
                          ? ['svg']
                          : MAIN_ASSET_EXTENSIONS
                      }
                      returnType="file"
                      value={
                        file ||
                        asset?.file_url ||
                        null
                      }
                      onFileChange={
                        handleMainFileChange
                      }
                      onRemove={() =>
                        setFile(null)
                      }
                      required={
                        !asset?.file_url
                      }
                    />

                    {fileInfo && (
                      <div
                        className={`mt-2 p-2.5 rounded-xl border text-[11px] leading-4 flex items-start gap-2 ${fileInfo.badgeClass}`}
                      >
                        <span className="font-bold px-1.5 py-0.5 rounded-md bg-white/70 shadow-2xs shrink-0">
                          {fileInfo.label}
                        </span>

                        <span className="opacity-90">
                          {fileInfo.note}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div>
                    <ArtworkFileUpload
                      label="Thumbnail (Optional)"
                      description="Optional. Used for asset previews in the designer."
                      accept={
                        THUMBNAIL_EXTENSIONS
                      }
                      returnType="file"
                      value={
                        thumbnail ||
                        asset?.thumbnail_url ||
                        null
                      }
                      onFileChange={
                        setThumbnail
                      }
                      onRemove={() =>
                        setThumbnail(null)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

          {/* ================================================= */}
          {/* CUSTOM PHOTO SHAPE CONFIG */}
          {/* ================================================= */}

          {formData.asset_type === 'shape' && (
            <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-violet-900">
                    Customer Photo Shape
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 text-violet-700">
                    Upload a closed SVG shape. It is saved in the asset library and appears in the frontend Shapes panel.
                    Customers can click it to add the exact uploaded SVG. Photo drop/fill is available only for Frames.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Photo Fit
                  </label>
                  <select
                    value={shapeConfig.photoFit}
                    onChange={(e) =>
                      updateShapeConfig(
                        'photoFit',
                        e.target.value as ShapePhotoFit
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="cover">Cover shape</option>
                    <option value="contain">Contain photo</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Default Shape Color
                  </label>
                  <input
                    type="color"
                    value={shapeConfig.fill}
                    onChange={(e) => updateShapeConfig('fill', e.target.value)}
                    className="h-8 w-full cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Stroke Width
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={shapeConfig.strokeWidth}
                    onChange={(e) =>
                      updateShapeConfig('strokeWidth', Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={shapeConfig.recolourable}
                    onChange={(e) =>
                      updateShapeConfig('recolourable', e.target.checked)
                    }
                    className="rounded text-violet-600 focus:ring-violet-500"
                  />
                  Recolourable SVG
                </label>



                <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={shapeConfig.preserveAspectRatio}
                    onChange={(e) =>
                      updateShapeConfig('preserveAspectRatio', e.target.checked)
                    }
                    className="rounded text-violet-600 focus:ring-violet-500"
                  />
                  Preserve aspect ratio
                </label>
              </div>
            </div>
          )}

          {/* ================================================= */}
          {/* ELEMENT CONFIG */}
          {/* ================================================= */}

          {formData.asset_type ===
            'element' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recolourable"
                  checked={recolourable}
                  onChange={(e) =>
                    setRecolourable(
                      e.target.checked
                    )
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />

                <label
                  htmlFor="recolourable"
                  className="text-xs font-medium text-gray-700 select-none"
                >
                  Recolourable Element
                  (SVG vector support)
                </label>
              </div>
            )}

          {/* ================================================= */}
          {/* FRAME CONFIGURATION */}
          {/* ================================================= */}

          {formData.asset_type === 'frame' && (
            <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Customer Photo Frame
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 text-indigo-700">
                    Same workflow as Shapes: upload one closed SVG. The exact SVG is used as
                    the frame geometry and clipping area. Unlike Shapes, Frames accept photo
                    hover/drop and fill the dropped image inside the SVG.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  Photo Fit
                </label>
                <select
                  value={frameConfig.photoFit}
                  onChange={(e) =>
                    updateFrameConfig('photoFit', e.target.value as FramePhotoFit)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="cover">Cover frame</option>
                  <option value="contain">Contain photo</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={frameConfig.allowPhotoMove}
                    onChange={(e) => updateFrameConfig('allowPhotoMove', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  Move photo
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={frameConfig.allowPhotoZoom}
                    onChange={(e) => updateFrameConfig('allowPhotoZoom', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  Zoom photo
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={frameConfig.preserveAspectRatio}
                    onChange={(e) =>
                      updateFrameConfig('preserveAspectRatio', e.target.checked)
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  Preserve aspect ratio
                </label>
              </div>
            </div>
          )}

          {/* BACKGROUND CONFIG */}
          {/* ================================================= */}

          {formData.asset_type ===
            'background' && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">

                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Background Type
                </label>

                <div className="flex gap-4 flex-wrap">

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="bgType"
                      value="color"
                      checked={
                        bgConfig.bgType ===
                        'color'
                      }
                      onChange={() =>
                        setBgConfig({
                          ...bgConfig,
                          bgType: 'color',
                        })
                      }
                    />

                    <span>
                      Solid Color
                    </span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="bgType"
                      value="gradient"
                      checked={
                        bgConfig.bgType ===
                        'gradient'
                      }
                      onChange={() =>
                        setBgConfig({
                          ...bgConfig,
                          bgType: 'gradient',
                        })
                      }
                    />

                    <span>
                      Gradient
                    </span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="bgType"
                      value="image"
                      checked={
                        bgConfig.bgType ===
                        'image'
                      }
                      onChange={() =>
                        setBgConfig({
                          ...bgConfig,
                          bgType: 'image',
                        })
                      }
                    />

                    <span>
                      Image / Pattern
                    </span>
                  </label>
                </div>

                {bgConfig.bgType ===
                  'color' && (
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Color
                      </label>

                      <input
                        type="color"
                        value={
                          bgConfig.color
                        }
                        onChange={(e) =>
                          setBgConfig({
                            ...bgConfig,
                            color:
                              e.target.value,
                          })
                        }
                        className="w-full h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                      />
                    </div>
                  )}

                {bgConfig.bgType ===
                  'gradient' && (
                    <div className="grid grid-cols-2 gap-3">

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Color 1
                        </label>

                        <input
                          type="color"
                          value={
                            bgConfig.gradientColor1
                          }
                          onChange={(e) =>
                            setBgConfig({
                              ...bgConfig,
                              gradientColor1:
                                e.target.value,
                            })
                          }
                          className="w-full h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Color 2
                        </label>

                        <input
                          type="color"
                          value={
                            bgConfig.gradientColor2
                          }
                          onChange={(e) =>
                            setBgConfig({
                              ...bgConfig,
                              gradientColor2:
                                e.target.value,
                            })
                          }
                          className="w-full h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
              </div>
            )}

          {/* ================================================= */}
          {/* LICENSING */}
          {/* ================================================= */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                License Name
              </label>

              <input
                type="text"
                value={
                  formData.license_name
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    license_name:
                      e.target.value,
                  })
                }
                placeholder="e.g. Free commercial"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Attribution
              </label>

              <input
                type="text"
                value={
                  formData.attribution
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    attribution:
                      e.target.value,
                  })
                }
                placeholder="e.g. Designed by Admin"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Sort Order
              </label>

              <input
                type="number"
                value={
                  formData.sort_order
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sort_order:
                      Number(
                        e.target.value
                      ),
                  })
                }
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
              />
            </div>
          </div>

          {/* ================================================= */}
          {/* STATUS */}
          {/* ================================================= */}

          <div className="flex items-center gap-2">

            <input
              type="checkbox"
              id="is_active"
              checked={
                formData.is_active
              }
              onChange={(e) =>
                setFormData({
                  ...formData,
                  is_active:
                    e.target.checked,
                })
              }
              className="rounded text-blue-600 focus:ring-blue-500"
            />

            <label
              htmlFor="is_active"
              className="text-xs font-medium text-gray-700 select-none"
            >
              Active (Visible in Designer
              Sidebar)
            </label>
          </div>

          {/* ================================================= */}
          {/* ACTIONS */}
          {/* ================================================= */}

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}

              <span>
                {asset
                  ? `Update ${assetTypeLabel(formData.asset_type)}`
                  : `Save ${assetTypeLabel(formData.asset_type)}`}
              </span>
            </button>
          </div>
        </form>
      </div>

      <BulkAssetUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        activeType={formData.asset_type}
        categories={categories}
        onSaved={() => {
          setIsBulkModalOpen(false);
          onSaved();
          onClose();
        }}
      />
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Get existing mask URL from previously saved metadata.
 *
 * Supports both:
 *
 * metadata.maskUrl
 *
 * and:
 *
 * metadata.frame.maskUrl
 */
function existingFrameMaskUrl(
  metadata: any
): string | null {
  const parsedMetadata = toPlainObject(metadata);
  const frame = toPlainObject(parsedMetadata.frame);

  if (!Object.keys(parsedMetadata).length) {
    return null;
  }

  return (
    frame.maskUrl ||
    frame.mask_url ||
    frame.maskFileUrl ||
    frame.mask_file_url ||
    parsedMetadata.maskUrl ||
    parsedMetadata.mask_url ||
    parsedMetadata.maskFileUrl ||
    parsedMetadata.mask_file_url ||
    null
  );
}

/**
 * Laravel may return JSON columns as objects or encoded JSON strings,
 * depending on model casts and endpoints. This normalizes both forms.
 */
function toPlainObject(value: unknown): Record<string, any> {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  return {};
}

function isFrameMaskType(value: unknown): value is FrameMaskType {
  return [
    'rectangle',
    'rounded_rectangle',
    'circle',
    'ellipse',
    'polygon',
    'svg_path',
    'svg_mask',
    'alpha_mask',
  ].includes(String(value));
}

function inferUploadedMaskType(url: string): FrameMaskType {
  const cleanUrl = url.split('?')[0].split('#')[0];
  return getFileExtension(cleanUrl) === 'svg'
    ? 'svg_mask'
    : 'alpha_mask';
}

/**
 * Backward compatibility with your old frame metadata.
 */
function getLegacyShape(
  maskType: FrameMaskType
): string {
  switch (maskType) {
    case 'circle':
    case 'ellipse':
      return 'circle';

    case 'polygon':
      return 'polygon';

    default:
      return 'rect';
  }
}

/**
 * Backward compatibility with old clipType.
 */
function getLegacyClipType(
  maskType: FrameMaskType
): string {
  switch (maskType) {
    case 'svg_path':
      return 'path';

    case 'svg_mask':
    case 'alpha_mask':
      return 'mask';

    default:
      return 'path';
  }
}

function assetTypeLabel(assetType: AssetType): string {
  const labels: Record<AssetType, string> = {
    text: 'Text Preset',
    photo: 'Photo',
    frame: 'Frame',
    element: 'Element',
    background: 'Background',
    shape: 'Shape',
  };

  return labels[assetType];
}
