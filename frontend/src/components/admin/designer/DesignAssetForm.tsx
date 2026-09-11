'use client';

import React, { useState, useEffect } from 'react';
import {
  DesignAsset,
  AssetType,
  DesignAssetCategory,
  designAssetService,
} from '@/services/designAssetService';
import { X, Loader2, Check, Info, FolderUp } from 'lucide-react';
import { ArtworkFileUpload } from '@/components/admin/shared';
import { BulkAssetUploadModal } from './BulkAssetUploadModal';

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
  maskType: 'rectangle',

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
  allowPhotoDrop: true,
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
  // TEXT CONFIG
  // =========================================================

  const [textConfig, setTextConfig] = useState({
    text: 'Add text',
    fontFamily: 'Inter',
    fontSize: 36,
    fontWeight: 'normal',
    fontStyle: 'normal',
    fill: '#111111',
    backgroundColor: '',
    textAlign: 'center',
    charSpacing: 0,
    lineHeight: 1.16,
    stroke: '#000000',
    strokeWidth: 0,
    textEffect: 'none',
  });

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
        setTextConfig({
          text:
            rawFabricJson.text ||
            asset.name ||
            'Add text',

          fontFamily:
            rawFabricJson.fontFamily ||
            'Inter',

          fontSize:
            rawFabricJson.fontSize ||
            36,

          fontWeight:
            rawFabricJson.fontWeight ||
            'normal',

          fontStyle:
            rawFabricJson.fontStyle ||
            'normal',

          fill:
            rawFabricJson.fill ||
            '#111111',

          backgroundColor:
            rawFabricJson.backgroundColor ||
            '',

          textAlign:
            rawFabricJson.textAlign ||
            'center',

          charSpacing:
            rawFabricJson.charSpacing ||
            0,

          lineHeight:
            rawFabricJson.lineHeight ||
            1.16,

          stroke:
            rawFabricJson.stroke ||
            '#000000',

          strokeWidth:
            rawFabricJson.strokeWidth ||
            0,

          textEffect:
            existingMetadata.textEffect ||
            'none',
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
          allowPhotoDrop:
            savedShape.allowPhotoDrop !== false,
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

      setTextConfig({
        text: 'Add text',
        fontFamily: 'Inter',
        fontSize: 36,
        fontWeight: 'normal',
        fontStyle: 'normal',
        fill: '#111111',
        backgroundColor: '',
        textAlign: 'center',
        charSpacing: 0,
        lineHeight: 1.16,
        stroke: '#000000',
        strokeWidth: 0,
        textEffect: 'none',
      });

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
      c.asset_type === formData.asset_type
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

    const usesUploadedMask =
      formData.asset_type === 'frame' &&
      (frameConfig.maskType === 'svg_mask' ||
        frameConfig.maskType === 'alpha_mask');
    const hasSavedOrSelectedMask = Boolean(
      maskFile || currentMaskUrl
    );

    if (usesUploadedMask && !hasSavedOrSelectedMask) {
      setError(
        frameConfig.maskType === 'svg_mask'
          ? 'Please upload an SVG mask file before saving this frame.'
          : 'Please upload a transparent PNG or WebP alpha mask before saving this frame.'
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
        finalFabricJson = {
          type: 'Textbox',

          text:
            textConfig.text ||
            formData.name,

          fontFamily:
            textConfig.fontFamily,

          fontSize:
            Number(textConfig.fontSize),

          fontWeight:
            textConfig.fontWeight,

          fontStyle:
            textConfig.fontStyle,

          fill:
            textConfig.fill,

          backgroundColor:
            textConfig.backgroundColor ||
            undefined,

          textAlign:
            textConfig.textAlign,

          charSpacing:
            Number(textConfig.charSpacing),

          lineHeight:
            Number(textConfig.lineHeight),

          stroke:
            textConfig.strokeWidth > 0
              ? textConfig.stroke
              : undefined,

          strokeWidth:
            Number(textConfig.strokeWidth),

          editable: true,
          selectable: true,
        };

        finalMetadata = {
          ...finalMetadata,
          textEffect:
            textConfig.textEffect,
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
          allowPhotoDrop: shapeConfig.allowPhotoDrop,
          preserveAspectRatio: shapeConfig.preserveAspectRatio,
        };

        finalMetadata = {
          ...finalMetadata,
          isPhotoShape: true,
          shapeType: 'custom-svg',
          clipType: 'svg',
          photoFit: shapeConfig.photoFit,
          recolourable: shapeConfig.recolourable,
          allowPhotoDrop: shapeConfig.allowPhotoDrop,
          shape: shapeDefinition,
        };

        finalFabricJson = {
          ...shapeDefinition,
          isShape: true,
          isFrame: true,
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
        const preservedMaskUrl = removeMask
          ? null
          : existingFrameMaskUrl(finalMetadata);

        /**
         * IMPORTANT:
         *
         * Do not only save:
         *
         * shape: rect
         *
         * The Fabric editor needs complete frame
         * information to create the photo mask.
         */

        const frameMetadata = {
          version: 1,

          type: 'photo-frame',

          // -------------------------------------------------
          // Visual frame
          // -------------------------------------------------

          overlayUrl:
            asset?.file_url || null,

          thumbnailUrl:
            asset?.thumbnail_url || null,

          // -------------------------------------------------
          // Mask
          // -------------------------------------------------

          maskType:
            frameConfig.maskType,

          width:
            Number(frameConfig.width),

          height:
            Number(frameConfig.height),

          unit:
            frameConfig.unit,

          cornerRadius:
            Number(
              frameConfig.cornerRadius
            ),

          circleRadius:
            Number(
              frameConfig.circleRadius
            ),

          polygonPoints:
            frameConfig.polygonPoints,

          svgPath:
            frameConfig.svgPath,

          /**
           * Uploaded mask URL will be populated
           * by backend if maskFile is uploaded.
           *
           * For a new frame we send maskFile separately.
           */
          maskUrl:
            preservedMaskUrl,

          // Keep snake_case for older API/frontend consumers.
          mask_url:
            preservedMaskUrl,

          maskFileName:
            maskFile?.name ||
            toPlainObject(finalMetadata.frame).maskFileName ||
            toPlainObject(finalMetadata.frame).mask_file_name ||
            null,

          hasCustomMask:
            frameConfig.maskType === 'svg_mask' ||
            frameConfig.maskType === 'alpha_mask',

          // -------------------------------------------------
          // Photo behaviour
          // -------------------------------------------------

          photoFit:
            frameConfig.photoFit,

          allowPhotoMove:
            frameConfig.allowPhotoMove,

          allowPhotoZoom:
            frameConfig.allowPhotoZoom,

          allowPhotoRotate:
            frameConfig.allowPhotoRotate,

          allowPhotoReplace:
            frameConfig.allowPhotoReplace,

          preserveAspectRatio:
            frameConfig.preserveAspectRatio,
        };

        /**
         * Keep a few legacy fields too so your existing
         * frontend code does not immediately break if it
         * still reads metadata.shape / metadata.clipType.
         */
        finalMetadata = {
          ...finalMetadata,

          shape:
            getLegacyShape(
              frameConfig.maskType
            ),

          clipType:
            getLegacyClipType(
              frameConfig.maskType
            ),

          maskUrl:
            preservedMaskUrl,

          mask_url:
            preservedMaskUrl,

          frame: frameMetadata,
        };

        /**
         * Store the frame definition in fabric_json too.
         *
         * This makes the asset self-describing and gives
         * the frontend another safe place to retrieve it.
         */
        finalFabricJson = {
          type: 'photo-frame',

          frameId:
            asset?.id || null,

          maskType:
            frameConfig.maskType,

          width:
            Number(frameConfig.width),

          height:
            Number(frameConfig.height),

          unit:
            frameConfig.unit,

          cornerRadius:
            Number(
              frameConfig.cornerRadius
            ),

          circleRadius:
            Number(
              frameConfig.circleRadius
            ),

          polygonPoints:
            frameConfig.polygonPoints,

          svgPath:
            frameConfig.svgPath,

          maskUrl:
            preservedMaskUrl,

          mask_url:
            preservedMaskUrl,

          photoFit:
            frameConfig.photoFit,

          allowPhotoMove:
            frameConfig.allowPhotoMove,

          allowPhotoZoom:
            frameConfig.allowPhotoZoom,

          allowPhotoRotate:
            frameConfig.allowPhotoRotate,

          allowPhotoReplace:
            frameConfig.allowPhotoReplace,

          preserveAspectRatio:
            frameConfig.preserveAspectRatio,
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

        fabric_json:
          finalFabricJson,

        metadata:
          finalMetadata,
      };

      if (
        !payload.category_id ||
        payload.category_id === ''
      ) {
        delete payload.category_id;
      }

      // -----------------------------------------------------
      // Main file
      // -----------------------------------------------------

      if (file) {
        payload.file = file;
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
                Category
              </label>

              <select
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
                <option value="">
                  -- No Category --
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
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">

              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Typography Controls
              </h3>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Default Text Content
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
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Font Family
                  </label>

                  <select
                    value={
                      textConfig.fontFamily
                    }
                    onChange={(e) =>
                      setTextConfig({
                        ...textConfig,
                        fontFamily:
                          e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="Inter">
                      Inter
                    </option>

                    <option value="Roboto">
                      Roboto
                    </option>

                    <option value="Playfair Display">
                      Playfair Display
                    </option>

                    <option value="Montserrat">
                      Montserrat
                    </option>

                    <option value="Oswald">
                      Oswald
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Font Size (px)
                  </label>

                  <input
                    type="number"
                    value={
                      textConfig.fontSize
                    }
                    onChange={(e) =>
                      setTextConfig({
                        ...textConfig,
                        fontSize:
                          Number(
                            e.target.value
                          ),
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Font Weight
                  </label>

                  <select
                    value={
                      textConfig.fontWeight
                    }
                    onChange={(e) =>
                      setTextConfig({
                        ...textConfig,
                        fontWeight:
                          e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="normal">
                      Normal
                    </option>

                    <option value="bold">
                      Bold
                    </option>

                    <option value="600">
                      Semi-Bold
                    </option>

                    <option value="300">
                      Light
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Text Align
                  </label>

                  <select
                    value={
                      textConfig.textAlign
                    }
                    onChange={(e) =>
                      setTextConfig({
                        ...textConfig,
                        textAlign:
                          e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="left">
                      Left
                    </option>

                    <option value="center">
                      Center
                    </option>

                    <option value="right">
                      Right
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Text Color
                  </label>

                  <input
                    type="color"
                    value={
                      textConfig.fill
                    }
                    onChange={(e) =>
                      setTextConfig({
                        ...textConfig,
                        fill:
                          e.target.value,
                      })
                    }
                    className="w-full h-8 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Stroke Width
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={
                      textConfig.strokeWidth
                    }
                    onChange={(e) =>
                      setTextConfig({
                        ...textConfig,
                        strokeWidth:
                          Number(
                            e.target.value
                          ),
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  />
                </div>
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
                          ? 'Frame Overlay / Visual'
                          : formData.asset_type === 'shape'
                            ? 'Shape SVG / Clipping Path'
                            : 'Main Asset File'
                      }
                      description={
                        formData.asset_type ===
                          'frame'
                          ? 'Upload SVG or transparent PNG containing the decorative frame.'
                          : formData.asset_type === 'shape'
                            ? 'Upload one closed, solid SVG silhouette. It becomes the clipping shape for customer photos.'
                            : 'Supported: SVG, PDF, TIFF, PNG, JPG, WebP'
                      }
                      accept={
                        formData.asset_type === 'shape'
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
                    Upload a closed, solid SVG silhouette. It appears in the frontend Shapes panel.
                    When a customer drops or adds a photo onto it, the photo is clipped to this SVG shape.
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
                    checked={shapeConfig.allowPhotoDrop}
                    onChange={(e) =>
                      updateShapeConfig('allowPhotoDrop', e.target.checked)
                    }
                    className="rounded text-violet-600 focus:ring-violet-500"
                  />
                  Allow photo drop
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

          {formData.asset_type ===
            'frame' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <FolderUp className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-semibold text-indigo-900">
                      Have a folder of frame overlays and masks?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(true)}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-2xs flex items-center gap-1.5"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    <span>Folder Upload Frames</span>
                  </button>
                </div>

                {/* --------------------------------------------- */}
                {/* FRAME ARCHITECTURE INFO */}
                {/* --------------------------------------------- */}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />

                    <div>
                      <h3 className="text-xs font-bold text-blue-900">
                        How Frame Assets Work
                      </h3>

                      <p className="text-[11px] text-blue-700 leading-5 mt-1">
                        The frame visual is stored as
                        an overlay. The customer photo
                        is placed underneath it and
                        clipped using the selected mask.
                        This keeps the photo editable
                        instead of flattening it into
                        the frame.
                      </p>
                    </div>
                  </div>
                </div>

                {/* --------------------------------------------- */}
                {/* VISUAL / OVERLAY */}
                {/* --------------------------------------------- */}

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">

                  <div>
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      1. Frame Visual
                    </h3>

                    <p className="text-[11px] text-gray-500 mt-1">
                      Upload the decorative SVG/PNG
                      that appears above the customer's
                      photo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="text-[11px] font-semibold text-gray-700">
                        Overlay
                      </div>

                      <div className="text-[10px] text-gray-500 mt-1">
                        Example:
                        floral-frame.svg
                      </div>

                      {asset?.file_url && (
                        <div className="mt-2 text-[10px] text-emerald-600">
                          Existing overlay saved
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="text-[11px] font-semibold text-gray-700">
                        Layer order
                      </div>

                      <div className="text-[10px] text-gray-500 mt-1 leading-4">
                        Frame Overlay
                        <br />
                        ↓
                        <br />
                        Customer Photo
                        <br />
                        ↓
                        <br />
                        Canvas Background
                      </div>
                    </div>
                  </div>
                </div>

                {/* --------------------------------------------- */}
                {/* MASK TYPE */}
                {/* --------------------------------------------- */}

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">

                  <div>
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      2. Photo Mask
                    </h3>

                    <p className="text-[11px] text-gray-500 mt-1">
                      Select the area where the
                      customer's image will appear.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Mask Type
                    </label>

                    <select
                      value={
                        frameConfig.maskType
                      }
                      onChange={(e) =>
                        updateFrameConfig(
                          'maskType',
                          e.target
                            .value as FrameMaskType
                        )
                      }
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="rectangle">
                        Rectangle
                      </option>

                      <option value="rounded_rectangle">
                        Rounded Rectangle
                      </option>

                      <option value="circle">
                        Circle
                      </option>

                      <option value="ellipse">
                        Ellipse
                      </option>

                      <option value="polygon">
                        Custom Polygon
                      </option>

                      <option value="svg_path">
                        SVG Path
                      </option>

                      <option value="svg_mask">
                        Custom SVG Mask
                      </option>

                      <option value="alpha_mask">
                        Alpha Mask PNG/WebP
                      </option>
                    </select>

                    <p className="text-[10px] text-gray-500 mt-1.5">
                      {getMaskDescription()}
                    </p>
                  </div>

                  {/* ------------------------------------------- */}
                  {/* BASIC DIMENSIONS */}
                  {/* ------------------------------------------- */}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Width
                      </label>

                      <input
                        type="number"
                        min="1"
                        value={
                          frameConfig.width
                        }
                        onChange={(e) =>
                          updateFrameConfig(
                            'width',
                            Number(
                              e.target.value
                            )
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Height
                      </label>

                      <input
                        type="number"
                        min="1"
                        value={
                          frameConfig.height
                        }
                        onChange={(e) =>
                          updateFrameConfig(
                            'height',
                            Number(
                              e.target.value
                            )
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Unit
                      </label>

                      <select
                        value={
                          frameConfig.unit
                        }
                        onChange={(e) =>
                          updateFrameConfig(
                            'unit',
                            e.target.value as
                            | 'px'
                            | 'mm'
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                      >
                        <option value="px">
                          Pixels
                        </option>

                        <option value="mm">
                          Millimeters
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* ------------------------------------------- */}
                  {/* ROUNDED RECTANGLE */}
                  {/* ------------------------------------------- */}

                  {frameConfig.maskType ===
                    'rounded_rectangle' && (
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Corner Radius
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={
                            frameConfig.cornerRadius
                          }
                          onChange={(e) =>
                            updateFrameConfig(
                              'cornerRadius',
                              Number(
                                e.target.value
                              )
                            )
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                        />
                      </div>
                    )}

                  {/* ------------------------------------------- */}
                  {/* CIRCLE */}
                  {/* ------------------------------------------- */}

                  {frameConfig.maskType ===
                    'circle' && (
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Radius
                        </label>

                        <input
                          type="number"
                          min="1"
                          value={
                            frameConfig.circleRadius
                          }
                          onChange={(e) =>
                            updateFrameConfig(
                              'circleRadius',
                              Number(
                                e.target.value
                              )
                            )
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                        />
                      </div>
                    )}

                  {/* ------------------------------------------- */}
                  {/* POLYGON */}
                  {/* ------------------------------------------- */}

                  {frameConfig.maskType ===
                    'polygon' && (
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Polygon Points
                        </label>

                        <textarea
                          rows={3}
                          value={
                            frameConfig.polygonPoints
                          }
                          onChange={(e) =>
                            updateFrameConfig(
                              'polygonPoints',
                              e.target.value
                            )
                          }
                          placeholder="0,0 500,0 500,500 0,500"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />

                        <p className="text-[10px] text-gray-500 mt-1">
                          Example:
                          0,0 500,0 500,500 0,500
                        </p>
                      </div>
                    )}

                  {/* ------------------------------------------- */}
                  {/* SVG PATH */}
                  {/* ------------------------------------------- */}

                  {frameConfig.maskType ===
                    'svg_path' && (
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          SVG Path Data
                        </label>

                        <textarea
                          rows={5}
                          value={
                            frameConfig.svgPath
                          }
                          onChange={(e) =>
                            updateFrameConfig(
                              'svgPath',
                              e.target.value
                            )
                          }
                          placeholder="M 0 0 L 500 0 L 500 500 L 0 500 Z"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />

                        <p className="text-[10px] text-gray-500 mt-1">
                          Paste only the SVG path
                          `d` attribute value.
                        </p>
                      </div>
                    )}

                  {/* ------------------------------------------- */}
                  {/* SVG MASK UPLOAD */}
                  {/* ------------------------------------------- */}

                  {frameConfig.maskType ===
                    'svg_mask' && (
                      <div className="p-3 bg-white border border-gray-200 rounded-xl">

                        <div className="mb-2">
                          <label className="block text-[11px] font-semibold text-gray-700">
                            SVG Mask File
                          </label>

                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Upload an SVG containing
                            the actual photo clipping
                            shape.
                          </p>
                        </div>

                        <ArtworkFileUpload
                          label="Upload SVG Mask"
                          description="SVG only. The mask defines the photo area."
                          accept={['svg']}
                          returnType="file"
                          value={
                            maskFile ||
                            currentMaskUrl ||
                            null
                          }
                          onFileChange={handleMaskFileChange}
                          onRemove={() => {
                            setMaskFile(null);
                            setRemoveMask(true);
                          }}
                        />

                        {currentMaskUrl && !maskFile && (
                          <p className="mt-2 text-[10px] font-medium text-emerald-600">
                            Existing SVG mask is saved. Upload another file only to replace it.
                          </p>
                        )}
                      </div>
                    )}

                  {/* ------------------------------------------- */}
                  {/* ALPHA MASK */}
                  {/* ------------------------------------------- */}

                  {frameConfig.maskType ===
                    'alpha_mask' && (
                      <div className="p-3 bg-white border border-gray-200 rounded-xl">

                        <div className="mb-2">
                          <label className="block text-[11px] font-semibold text-gray-700">
                            Alpha Mask File
                          </label>

                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Transparent PNG/WebP. Transparent
                            pixels become outside the photo
                            area.
                          </p>
                        </div>

                        <ArtworkFileUpload
                          label="Upload Alpha Mask"
                          description="PNG/WebP with transparency."
                          accept={[
                            'png',
                            'webp',
                          ]}
                          returnType="file"
                          value={
                            maskFile ||
                            currentMaskUrl ||
                            null
                          }
                          onFileChange={handleMaskFileChange}
                          onRemove={() => {
                            setMaskFile(null);
                            setRemoveMask(true);
                          }}
                        />

                        {currentMaskUrl && !maskFile && (
                          <p className="mt-2 text-[10px] font-medium text-emerald-600">
                            Existing alpha mask is saved. Upload another file only to replace it.
                          </p>
                        )}
                      </div>
                    )}
                </div>

                {/* --------------------------------------------- */}
                {/* PHOTO BEHAVIOUR */}
                {/* --------------------------------------------- */}

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">

                  <div>
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      3. Customer Photo Behaviour
                    </h3>

                    <p className="text-[11px] text-gray-500 mt-1">
                      Control what customers can do
                      with their uploaded photo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    {/* Fit */}
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Photo Fit
                      </label>

                      <select
                        value={
                          frameConfig.photoFit
                        }
                        onChange={(e) =>
                          updateFrameConfig(
                            'photoFit',
                            e.target.value as
                            FramePhotoFit
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                      >
                        <option value="cover">
                          Cover
                        </option>

                        <option value="contain">
                          Contain
                        </option>
                      </select>
                    </div>

                    {/* Aspect */}
                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          frameConfig.preserveAspectRatio
                        }
                        onChange={(e) =>
                          updateFrameConfig(
                            'preserveAspectRatio',
                            e.target.checked
                          )
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />

                      <span className="text-[11px] font-medium text-gray-700">
                        Preserve photo aspect ratio
                      </span>
                    </label>
                  </div>

                  {/* Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          frameConfig.allowPhotoMove
                        }
                        onChange={(e) =>
                          updateFrameConfig(
                            'allowPhotoMove',
                            e.target.checked
                          )
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />

                      <span className="text-[11px] font-medium text-gray-700">
                        Allow customer to move photo
                      </span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          frameConfig.allowPhotoZoom
                        }
                        onChange={(e) =>
                          updateFrameConfig(
                            'allowPhotoZoom',
                            e.target.checked
                          )
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />

                      <span className="text-[11px] font-medium text-gray-700">
                        Allow customer to zoom photo
                      </span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          frameConfig.allowPhotoRotate
                        }
                        onChange={(e) =>
                          updateFrameConfig(
                            'allowPhotoRotate',
                            e.target.checked
                          )
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />

                      <span className="text-[11px] font-medium text-gray-700">
                        Allow customer to rotate photo
                      </span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          frameConfig.allowPhotoReplace
                        }
                        onChange={(e) =>
                          updateFrameConfig(
                            'allowPhotoReplace',
                            e.target.checked
                          )
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />

                      <span className="text-[11px] font-medium text-gray-700">
                        Allow customer to replace photo
                      </span>
                    </label>
                  </div>
                </div>

                {/* --------------------------------------------- */}
                {/* FRAME DATA PREVIEW */}
                {/* --------------------------------------------- */}

                <div className="p-4 bg-gray-900 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
                      Frame Configuration Preview
                    </h3>

                    <span className="text-[9px] px-2 py-1 rounded bg-white/10 text-gray-300">
                      Saved to metadata.frame
                    </span>
                  </div>

                  <pre className="text-[9px] leading-4 text-gray-300 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(
                      {
                        type: 'photo-frame',
                        maskType:
                          frameConfig.maskType,
                        width:
                          frameConfig.width,
                        height:
                          frameConfig.height,
                        unit:
                          frameConfig.unit,
                        photoFit:
                          frameConfig.photoFit,
                        allowPhotoMove:
                          frameConfig.allowPhotoMove,
                        allowPhotoZoom:
                          frameConfig.allowPhotoZoom,
                        allowPhotoRotate:
                          frameConfig.allowPhotoRotate,
                        allowPhotoReplace:
                          frameConfig.allowPhotoReplace,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            )}

          {/* ================================================= */}
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
