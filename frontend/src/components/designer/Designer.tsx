'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  DocumentSettings,
  SelectedObjectState,
  ActiveSidebarTab,
  CanvasDimensions,
  DesignerTemplate,
  PrintSides,
  PrintSettings,
} from '@/types/designer';
import { calculateCanvasDimensions, calculateFitZoom } from './utils/dimensions';
import { CanvasManager } from './canvas/CanvasManager';
import { DesignerToolbar } from './DesignerToolbar';
import { DesignerSidebar } from './DesignerSidebar';
import { DesignerCanvas } from './DesignerCanvas';
import { DesignerProperties } from './DesignerProperties';
import { DesignerBottomBar } from './DesignerBottomBar';
import { designerService } from './services/designerService';
import { exportHighResolutionImage, exportVectorPdf } from './services/exportService';
import { exportLayeredPsd } from './services/psdExportService';
import { preloadPopularFonts } from './utils/fonts';
import { PreflightReport } from './utils/preflightCheck';
import { FloatingDrawToolbar } from './toolbar/FloatingDrawToolbar';
import { PreflightBadge } from './controls/PreflightBadge';
import { ArtworkPreviewModal } from './controls/ArtworkPreviewModal';
import { CustomBannerSizeModal } from './controls/CustomBannerSizeModal';
import { AddToCartModal } from './controls/AddToCartModal';
import { PageManagerTray, PageData } from './controls/PageManagerTray';
import { renderCanvasJsonToThumbnail } from './utils/canvasThumbnail';
import {
  updateTemplateDesign,
} from '@/services/designTemplateService';
import { AlertTriangle } from 'lucide-react';

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '');

function isEmbeddedImageSource(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith('data:image/') || value.startsWith('blob:'))
  );
}

function extensionForImageMimeType(mimeType: string): string {
  const cleanMime = (mimeType || '').split(';')[0].trim().toLowerCase();
  switch (cleanMime) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
    case 'image/svg':
      return 'svg';
    case 'image/tiff':
    case 'image/tif':
    case 'image/x-tiff':
      return 'tiff';
    case 'image/bmp':
    case 'image/x-ms-bmp':
      return 'bmp';
    case 'image/avif':
      return 'avif';
    default:
      if (cleanMime.includes('svg')) {
        return 'svg';
      }
      throw new Error(
        `Unsupported embedded image type: ${mimeType || 'unknown'}.`
      );
  }
}

interface DesignerProps {
  productId?: string;
  templateId?: string;
  artworkId?: string | null;
  mode?: string;
  initialSettings?: Partial<DocumentSettings>;
}

const DEFAULT_DOCUMENT: DocumentSettings = {
  name: 'Custom Print Artwork',
  width: 100,
  height: 65,
  unit: 'mm',
  dpi: 300,
  bleed: 3,
  safeArea: 3,
  backgroundColor: '#ffffff',
  showGuides: true,
};

type ArtworkSaveStatus =
  | 'idle'
  | 'unsaved'
  | 'saving'
  | 'saved'
  | 'local-only'
  | 'error';

const AUTOSAVE_DELAY_MS = 1500;

function extractTemplatePages(
  template: any,
  defaultBackgroundColor: string = '#ffffff'
): { pages: PageData[]; sideNames: string[]; printSides: PrintSides } {
  const defaultEmptyCanvas = {
    version: '6.0.0',
    objects: [],
    background: defaultBackgroundColor,
  };

  const pages: PageData[] = [];
  const sideNames: string[] = [];

  // 1. Check if template has an array of pages (e.g. from design_template_pages)
  if (Array.isArray(template.pages) && template.pages.length > 0) {
    template.pages.forEach((p: any, idx: number) => {
      const pJson = p.canvas_json ?? p.template_json ?? (p.objects ? p : defaultEmptyCanvas);
      const parsedJson = typeof pJson === 'string' ? JSON.parse(pJson) : pJson;
      const name = p.product_side?.name ?? p.name ?? (template.pages.length === 2 ? (idx === 0 ? 'Front' : 'Back') : `Page ${idx + 1}`);
      pages.push({
        id: String(p.id || `page-${idx}-${Date.now()}`),
        thumbnail: p.preview_image_url || p.thumbnail_url || (idx === 0 ? template.thumbnail_url : null) || null,
        canvasJson: parsedJson || defaultEmptyCanvas,
      });
      sideNames.push(name);
    });
  }
  // 2. Check if canvas_json itself is an array of page objects
  else if (Array.isArray(template.canvas_json) && template.canvas_json.length > 0) {
    template.canvas_json.forEach((cJson: any, idx: number) => {
      const parsedJson = typeof cJson === 'string' ? JSON.parse(cJson) : cJson;
      pages.push({
        id: `page-${idx}-${Date.now()}`,
        thumbnail: idx === 0 ? template.thumbnail_url || null : null,
        canvasJson: parsedJson || defaultEmptyCanvas,
      });
      sideNames.push(template.canvas_json.length === 2 ? (idx === 0 ? 'Front' : 'Back') : `Page ${idx + 1}`);
    });
  }
  // 3. Check if back_canvas_json exists (2 sides: Front & Back)
  else if (template.back_canvas_json && Object.keys(template.back_canvas_json).length > 0) {
    const frontJson = template.canvas_json ?? template.template_json ?? defaultEmptyCanvas;
    const backJson = template.back_canvas_json;
    const parsedFront = typeof frontJson === 'string' ? JSON.parse(frontJson) : frontJson;
    const parsedBack = typeof backJson === 'string' ? JSON.parse(backJson) : backJson;

    pages.push({
      id: `page-front-${Date.now()}`,
      thumbnail: template.thumbnail_url || null,
      canvasJson: parsedFront || defaultEmptyCanvas,
    });
    pages.push({
      id: `page-back-${Date.now() + 1}`,
      thumbnail: null,
      canvasJson: parsedBack || defaultEmptyCanvas,
    });
    sideNames.push('Front', 'Back');
  }
  // 4. Check if print_sides is explicitly 'both' (2 sides: Front & Back)
  else if (template.print_sides === 'both') {
    const frontJson = template.canvas_json ?? template.template_json ?? defaultEmptyCanvas;
    const backJson = template.back_canvas_json || defaultEmptyCanvas;
    const parsedFront = typeof frontJson === 'string' ? JSON.parse(frontJson) : frontJson;
    const parsedBack = typeof backJson === 'string' ? JSON.parse(backJson) : backJson;

    pages.push({
      id: `page-front-${Date.now()}`,
      thumbnail: template.thumbnail_url || null,
      canvasJson: parsedFront || defaultEmptyCanvas,
    });
    pages.push({
      id: `page-back-${Date.now() + 1}`,
      thumbnail: null,
      canvasJson: parsedBack || defaultEmptyCanvas,
    });
    sideNames.push('Front', 'Back');
  }
  // 5. Default single page (1 side: Front)
  else {
    const frontJson = template.canvas_json ?? template.template_json ?? defaultEmptyCanvas;
    const parsedFront = typeof frontJson === 'string' ? JSON.parse(frontJson) : frontJson;
    pages.push({
      id: `page-front-${Date.now()}`,
      thumbnail: template.thumbnail_url || null,
      canvasJson: parsedFront || defaultEmptyCanvas,
    });
    sideNames.push('Front');
  }

  const printSides: PrintSides = pages.length > 1 ? (template.print_sides === 'back' ? 'back' : 'both') : 'front';

  return { pages, sideNames, printSides };
}

export default function Designer({
  productId,
  templateId,
  artworkId: artworkIdProp,
  mode,
  initialSettings,
}: DesignerProps) {
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>({
    ...DEFAULT_DOCUMENT,
    ...initialSettings,
  });

  const [designName, setDesignName] = useState<string>(
    documentSettings.name || 'Custom Print Artwork'
  );

  const [dimensions, setDimensions] = useState<CanvasDimensions>(() =>
    calculateCanvasDimensions({ ...DEFAULT_DOCUMENT, ...initialSettings })
  );

  const [zoom, setZoom] = useState<number>(1.0);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<ActiveSidebarTab>(null);
  const [selected, setSelected] = useState<SelectedObjectState | null>(null);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState<boolean>(true);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isCustomSizeOpen, setIsCustomSizeOpen] = useState<boolean>(false);
  const [isAddToCartOpen, setIsAddToCartOpen] = useState<boolean>(false);
  const [previewThumbnailUrl, setPreviewThumbnailUrl] = useState<string | null>(null);
  const [isAutoFit, setIsAutoFit] = useState<boolean>(true);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [showPreflightAlert, setShowPreflightAlert] = useState<boolean>(false);
  const [canvasManager, setCanvasManager] = useState<CanvasManager | null>(null);
  const [saveStatus, setSaveStatus] = useState<ArtworkSaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [pages, setPages] = useState<PageData[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [printSides, setPrintSides] = useState<PrintSides>('front');
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [sideNames, setSideNames] = useState<string[]>([]);

  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const dimensionsRef = useRef<CanvasDimensions>(dimensions);
  dimensionsRef.current = dimensions;

  const productIdRef = useRef<string | undefined>(productId);

  useEffect(() => {
    if (productId) {
      productIdRef.current = productId;
    }
  }, [productId]);

  const designNameRef = useRef<string>(designName);
  designNameRef.current = designName;

  const documentSettingsRef = useRef<DocumentSettings>(documentSettings);
  documentSettingsRef.current = documentSettings;

  const artworkIdRef = useRef<string | null>(null);
  const designTemplateIdRef = useRef<string | null>(null);
  const loadedTemplateKeyRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef<boolean>(false);
  const saveQueuedRef = useRef<boolean>(false);
  const metadataAutosaveReadyRef = useRef<boolean>(false);
  const canvasImageUploadCacheRef = useRef<Map<string, string>>(new Map());

  const containerDimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const isAutoFitRef = useRef<boolean>(true);
  isAutoFitRef.current = isAutoFit;

  // Initialize or update dimensions when settings change
  const handleUpdateDocumentSettings = useCallback(
    (newSettings: Partial<DocumentSettings>) => {
      setDocumentSettings((prev) => {
        const updated = { ...prev, ...newSettings };
        const newDims = calculateCanvasDimensions(updated);
        setDimensions(newDims);
        if (canvasManagerRef.current) {
          canvasManagerRef.current.setDimensions(newDims);
          const { w, h } = containerDimensionsRef.current;
          if (w > 0 && h > 0) {
            canvasManagerRef.current.fitToViewport(w, h, 32, 48);
            setIsAutoFit(true);
          }
        }
        return updated;
      });
    },
    []
  );

  // Zoom handlers
  const handleZoomChange = useCallback((newZoom: number) => {
    setIsAutoFit(false);
    if (!canvasManagerRef.current) return;
    canvasManagerRef.current.setZoom(newZoom);
  }, []);

  const handleZoomIn = useCallback(() => {
    setIsAutoFit(false);
    if (!canvasManagerRef.current) return;
    canvasManagerRef.current.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    setIsAutoFit(false);
    if (!canvasManagerRef.current) return;
    canvasManagerRef.current.zoomOut();
  }, []);

  const handleResetZoom = useCallback(() => {
    setIsAutoFit(false);
    if (!canvasManagerRef.current) return;
    canvasManagerRef.current.resetZoom();
  }, []);

  const handleFitCanvas = useCallback(() => {
    setIsAutoFit(true);
    if (!canvasManagerRef.current) return;
    const { w, h } = containerDimensionsRef.current;
    if (w > 0 && h > 0) {
      canvasManagerRef.current.fitToViewport(w, h, 32, 48);
    }
  }, []);

  const handleContainerResize = useCallback((width: number, height: number) => {
    containerDimensionsRef.current = { w: width, h: height };
    if (isAutoFitRef.current && canvasManagerRef.current && width > 0 && height > 0) {
      canvasManagerRef.current.fitToViewport(width, height, 32, 48);
    }
  }, []);

  const handleTogglePanMode = useCallback(() => {
    setIsPanMode((prev) => {
      const next = !prev;
      if (canvasManagerRef.current) {
        canvasManagerRef.current.setPanMode(next);
      }
      return next;
    });
  }, []);


  const handleToggleGuides = useCallback(() => {
    if (!canvasManagerRef.current) return;
    const next = canvasManagerRef.current.toggleGuides();
    setShowGuides(next);
  }, []);

  /**
   * Upload one data: or blob: image to Laravel and return its permanent URL.
   * Repeated sources are cached so multipage saves do not upload duplicates.
   */
  const uploadEmbeddedImageSource = useCallback(async (
    source: string
  ): Promise<string> => {
    const cachedUrl = canvasImageUploadCacheRef.current.get(source);
    if (cachedUrl) {
      return cachedUrl;
    }

    let sourceResponse: Response;

    try {
      sourceResponse = await fetch(source);
    } catch {
      throw new Error('Could not read an embedded canvas image.');
    }

    if (!sourceResponse.ok) {
      throw new Error('Could not read an embedded canvas image.');
    }

    const blob = await sourceResponse.blob();
    let detectedType = blob.type;
    if (!detectedType && source.startsWith('data:')) {
      const match = source.match(/^data:([^;,]+)/);
      if (match) {
        detectedType = match[1];
      }
    }
    const extension = extensionForImageMimeType(detectedType || blob.type);
    const file = new File(
      [blob],
      `canvas-image-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`,
      { type: detectedType || blob.type || (extension === 'svg' ? 'image/svg+xml' : 'image/png') }
    );

    const formData = new FormData();
    formData.append('image', file);
    formData.append('source_provider', 'designer');

    const token = localStorage.getItem('auth_token');
    const uploadResponse = await fetch(
      `${API_URL}/designer/uploads/canvas-image`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
        body: formData,
      }
    );

    const responseText = await uploadResponse.text();
    let responseData: any = null;

    try {
      responseData = responseText
        ? JSON.parse(responseText)
        : null;
    } catch {
      responseData = null;
    }

    if (!uploadResponse.ok) {
      const validationMessage = responseData?.errors
        ? Object.values(responseData.errors)
          .flat()
          .join(' ')
        : null;

      throw new Error(
        validationMessage ||
        responseData?.message ||
        `Canvas image upload failed (${uploadResponse.status}).`
      );
    }

    const storedUrl =
      responseData?.data?.file_url ||
      responseData?.data?.url;

    if (!storedUrl || typeof storedUrl !== 'string') {
      throw new Error(
        'Canvas image upload succeeded but no file URL was returned.'
      );
    }

    canvasImageUploadCacheRef.current.set(source, storedUrl);
    return storedUrl;
  }, []);

  /**
   * Replace embedded sources on the active Fabric canvas before serialization.
   */
  const uploadBase64ImagesInCanvas = useCallback(async (fabricCanvas: any) => {
    let hasModifications = false;

    const processObject = async (anyObj: any) => {
      if (!anyObj) return;

      // Recurse into groups, active selections and frame contents.
      if (typeof anyObj.getObjects === 'function') {
        const children = anyObj.getObjects();
        for (const child of children) {
          await processObject(child);
        }
      }

      if (anyObj.clipPath) {
        await processObject(anyObj.clipPath);
      }

      const src =
        anyObj.getSrc?.() ||
        anyObj.get?.('src') ||
        anyObj.src;

      if (anyObj.type === 'image' && isEmbeddedImageSource(src)) {
        const storedUrl = await uploadEmbeddedImageSource(src);

        if (typeof anyObj.setSrc === 'function') {
          await anyObj.setSrc(storedUrl, {
            crossOrigin: 'anonymous',
          });
        } else {
          anyObj.set?.('src', storedUrl);
        }

        const existingOriginal = anyObj.originalSrc || anyObj.get?.('originalSrc');
        const preserveOriginal =
          existingOriginal && !isEmbeddedImageSource(existingOriginal)
            ? existingOriginal
            : storedUrl;

        anyObj.set?.({
          src: storedUrl,
          originalSrc: preserveOriginal,
          sourceUrl: preserveOriginal,
          dirty: true,
        });
        anyObj.setCoords?.();
        hasModifications = true;
      }
    };

    const canvasObjects = fabricCanvas.getObjects();
    for (const obj of canvasObjects) {
      await processObject(obj);
    }

    if (fabricCanvas.backgroundImage) {
      await processObject(fabricCanvas.backgroundImage);
    }
    if (fabricCanvas.overlayImage) {
      await processObject(fabricCanvas.overlayImage);
    }

    if (hasModifications) {
      fabricCanvas.requestRenderAll();
    }

    return hasModifications;
  }, [uploadEmbeddedImageSource]);

  /**
   * Clean inactive page JSON too. Otherwise an earlier page containing a
   * data: image can still make the complete template request fail with 422.
   */
  const replaceEmbeddedImageSourcesInJson = useCallback(async (
    sourceValue: any
  ): Promise<any> => {
    const clonedValue =
      typeof structuredClone === 'function'
        ? structuredClone(sourceValue)
        : JSON.parse(JSON.stringify(sourceValue));

    const walk = async (value: any): Promise<any> => {
      if (isEmbeddedImageSource(value)) {
        return uploadEmbeddedImageSource(value);
      }

      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
          value[index] = await walk(value[index]);
        }
        return value;
      }

      if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
          value[key] = await walk(value[key]);
        }
      }

      return value;
    };

    return walk(clonedValue);
  }, [uploadEmbeddedImageSource]);

  const uploadBase64ImagesInPages = useCallback(async (
    sourcePages: PageData[]
  ): Promise<PageData[]> => {
    const cleanedPages: PageData[] = [];

    for (const page of sourcePages) {
      cleanedPages.push({
        ...page,
        canvasJson: await replaceEmbeddedImageSourcesInJson(
          page.canvasJson
        ),
      });
    }

    setPages(cleanedPages);
    return cleanedPages;
  }, [replaceEmbeddedImageSourcesInJson]);

  // Ensure the current active canvas is saved to the pages array before doing operations
  const getCurrentPagesState = useCallback(async () => {
    const manager = canvasManagerRef.current;
    if (!manager) return pages;

    const fabricCanvas = manager.getCanvas();
    if (!fabricCanvas) return pages;

    const rawCanvasJson = fabricCanvas.toObject([
      'id', 'name', 'originalSrc', 'isFrame', 'frameId',
      'slotId', 'assetId', 'provider', 'providerAssetId', 'sourceType',
    ]);
    let thumbDataUrl = '';

    try {
      thumbDataUrl =
        (await manager.getCleanPreviewDataUrl(0.2)) ?? '';
    } catch (error) {
      // A thumbnail problem must not block saving editable canvas JSON.
      console.warn('Could not create the page thumbnail:', error);
    }

    setPages(prev => {
      const next = [...prev];
      if (next[activePageIndex]) {
        next[activePageIndex] = {
          ...next[activePageIndex],
          canvasJson: rawCanvasJson,
          thumbnail: thumbDataUrl,
        };
      }
      return next;
    });

    // Return the updated array directly so callers don't have to wait for the React re-render
    const updatedPages = [...pages];
    if (updatedPages[activePageIndex]) {
      updatedPages[activePageIndex].canvasJson = rawCanvasJson;
      updatedPages[activePageIndex].thumbnail = thumbDataUrl;
    }
    return updatedPages;
  }, [activePageIndex, pages]);

  const handleSwitchSide = useCallback(async (targetSide: 'front' | 'back') => {
    if (targetSide === activeSide) return;
    if (!canvasManagerRef.current) return;

    // Snapshot current active canvas to pages without losing unsaved changes
    const currentPages = await getCurrentPagesState();

    const targetIndex = targetSide === 'front' ? 0 : 1;

    if (targetIndex === 1 && currentPages.length < 2) {
      const newPage: PageData = {
        id: `page-back-${Date.now()}`,
        thumbnail: null,
        canvasJson: {
          version: '6.0.0',
          objects: [],
          background: documentSettingsRef.current.backgroundColor || '#ffffff',
        },
      };
      const updated = [...currentPages, newPage];
      setPages(updated);
      setSideNames(['Front', 'Back']);
      setActiveSide('back');
      setActivePageIndex(1);
      await canvasManagerRef.current.loadTemplate({
        canvas_json: newPage.canvasJson,
        backgroundColor: documentSettingsRef.current.backgroundColor,
      } as any);
      return;
    }

    if (targetIndex === activePageIndex) return;
    setActiveSide(targetSide);
    setActivePageIndex(targetIndex);

    const targetPage = currentPages[targetIndex];
    if (targetPage) {
      await canvasManagerRef.current.loadTemplate({
        canvas_json: targetPage.canvasJson,
        backgroundColor: documentSettingsRef.current.backgroundColor,
      } as any);
    }
  }, [activeSide, activePageIndex, getCurrentPagesState]);

  const handlePageSelect = useCallback(async (index: number) => {
    if (index === activePageIndex) return;
    if (!canvasManagerRef.current) return;

    // Snapshot current active canvas to pages before switching
    const currentPages = await getCurrentPagesState();

    if (index === 0) {
      setActiveSide('front');
    } else if (index === 1 && currentPages.length === 2) {
      setActiveSide('back');
    }

    setActivePageIndex(index);
    const nextPage = currentPages[index] || currentPages[0];
    if (nextPage) {
      await canvasManagerRef.current.loadTemplate({
        canvas_json: nextPage.canvasJson,
        backgroundColor: documentSettingsRef.current.backgroundColor,
      } as any);
    }
  }, [activePageIndex, getCurrentPagesState]);

  const handleAddPage = useCallback(async () => {
    const updatedPages = await getCurrentPagesState();

    const newPage: PageData = {
      id: `page-${Date.now()}`,
      thumbnail: null,
      canvasJson: {
        version: '6.0.0',
        objects: [],
        background: documentSettingsRef.current.backgroundColor || '#ffffff',
      },
    };

    const newPages = [...updatedPages, newPage];
    setPages(newPages);
    setSideNames((prev) => [...prev, `Page ${newPages.length}`]);
    const newIndex = updatedPages.length;
    setActivePageIndex(newIndex);
    if (newPages.length > 2) {
      setPrintSides('both');
    }

    if (canvasManagerRef.current) {
      await canvasManagerRef.current.loadTemplate({
        canvas_json: newPage.canvasJson,
        backgroundColor: documentSettingsRef.current.backgroundColor || '#ffffff',
      } as any);
    }
  }, [getCurrentPagesState]);

  const handleDuplicatePage = useCallback(async (index: number) => {
    const updatedPages = await getCurrentPagesState();
    const sourcePage = updatedPages[index];
    if (!sourcePage) return;

    const newPage: PageData = {
      id: `page-${Date.now()}`,
      thumbnail: sourcePage.thumbnail,
      // Deep clone to avoid reference issues
      canvasJson: JSON.parse(JSON.stringify(sourcePage.canvasJson)),
    };

    const newPages = [...updatedPages];
    newPages.splice(index + 1, 0, newPage);
    setPages(newPages);
    setSideNames((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, `Page ${newPages.length}`);
      return next;
    });

    const newIndex = index + 1;
    setActivePageIndex(newIndex);
    if (canvasManagerRef.current) {
      await canvasManagerRef.current.loadTemplate({
        canvas_json: newPage.canvasJson,
        backgroundColor: documentSettingsRef.current.backgroundColor || '#ffffff',
      } as any);
    }
  }, [getCurrentPagesState]);

  const handleDeletePage = useCallback(async (index: number) => {
    if (pages.length <= 1) return; // Cannot delete the last page

    const updatedPages = await getCurrentPagesState();
    const newPages = updatedPages.filter((_, i) => i !== index);
    setPages(newPages);
    setSideNames((prev) => prev.filter((_, i) => i !== index));

    if (newPages.length === 1) {
      setPrintSides('front');
    }

    if (activePageIndex === index) {
      // If we deleted the active page, switch to the previous one (or first one)
      const nextIndex = Math.max(0, index - 1);
      setActivePageIndex(nextIndex);
      if (nextIndex === 0) {
        setActiveSide('front');
      } else if (nextIndex === 1 && newPages.length === 2) {
        setActiveSide('back');
      }
      if (canvasManagerRef.current && newPages[nextIndex]) {
        await canvasManagerRef.current.loadTemplate({
          canvas_json: newPages[nextIndex].canvasJson,
          backgroundColor: documentSettingsRef.current.backgroundColor,
        } as any);
      }
    } else if (activePageIndex > index) {
      // Shift active index if we deleted a page before it
      setActivePageIndex(activePageIndex - 1);
    }
  }, [activePageIndex, pages.length, getCurrentPagesState]);
  const handleSaveAdminTemplate = useCallback(async (
    publish = false
  ) => {
    if (!canvasManager) {
      throw new Error('Canvas is not ready.');
    }

    const activeTemplateId =
      templateId ||
      designTemplateIdRef.current ||
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('templateId')
        : null);

    if (!activeTemplateId) {
      throw new Error('Template ID is missing.');
    }

    const productIdFromUrl =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('productId')
        : null;

    const prodId =
      productId ||
      productIdRef.current ||
      productIdFromUrl;

    if (!prodId || prodId === 'default') {
      throw new Error(
        'This template is not connected to a valid product.'
      );
    }

    productIdRef.current = prodId;

    const fabricCanvas = canvasManager.getCanvas();
    if (!fabricCanvas) {
      throw new Error('Fabric canvas is not ready.');
    }

    // Upload data:/blob: images before serializing the active canvas.
    await uploadBase64ImagesInCanvas(fabricCanvas);

    // Ensure the current active canvas is synced into the pages array
    const currentPages = await getCurrentPagesState();

    // Clean inactive page JSON as well. One Base64 image on any page would
    // cause Laravel to reject the complete template request with 422.
    const updatedPages = await uploadBase64ImagesInPages(currentPages);

    // We get the thumbnail from the active page (or page 1) which was updated in getCurrentPagesState
    const activePage = updatedPages[activePageIndex] || updatedPages[0];
    const thumbnailUrl = activePage ? activePage.thumbnail || '' : '';

    let frontCanvasJson = updatedPages[0]?.canvasJson || { version: '6.0.0', objects: [], background: '#ffffff' };
    let backCanvasJson = null;

    if (printSides === 'both') {
      frontCanvasJson = updatedPages[0]?.canvasJson || { version: '6.0.0', objects: [], background: '#ffffff' };
      backCanvasJson = updatedPages[1]?.canvasJson || null;
    } else if (printSides === 'back') {
      backCanvasJson = updatedPages[0]?.canvasJson || null;
    }

    const currentDoc = documentSettingsRef.current;
    const currentDims = dimensionsRef.current;
    const artworkConfig = {
      width: currentDoc.width,
      height: currentDoc.height,
      unit: currentDoc.unit || 'mm',
      dpi: currentDoc.dpi || 300,
      bleed: currentDoc.bleed ?? 0,
      safe_area: currentDoc.safeArea ?? 0,
      safeArea: currentDoc.safeArea ?? 0,
      margin: currentDoc.margin ?? currentDoc.safeArea ?? 0,
      trim: currentDoc.trim ?? true,
      trim_area: {
        width: currentDoc.width,
        height: currentDoc.height,
      },
      trimArea: {
        width: currentDoc.width,
        height: currentDoc.height,
      },
      orientation: currentDoc.orientation || (currentDoc.width >= currentDoc.height ? 'landscape' : 'portrait'),
      print_area: {
        width: currentDims.widthPx,
        height: currentDims.heightPx,
      },
      printArea: {
        width: currentDims.widthPx,
        height: currentDims.heightPx,
      },
      guides: {
        showBleed: canvasManager.getGuidesSettings()?.showBleed ?? true,
        showSafeZone: canvasManager.getGuidesSettings()?.showSafeZone ?? true,
        showTrim: canvasManager.getGuidesSettings()?.showTrim ?? true,
        bleedColor: canvasManager.getGuidesSettings()?.bleedColor,
        safeZoneColor: canvasManager.getGuidesSettings()?.safeZoneColor,
        trimColor: canvasManager.getGuidesSettings()?.trimColor,
      },
      backgroundColor: currentDoc.backgroundColor || '#ffffff',
      name: currentDoc.name || designNameRef.current,
    };

    const printSettings = {
      print_sides: printSides,
      width_mm: currentDoc.width,
      height_mm: currentDoc.height,
      margin_mm: currentDoc.margin ?? 0,
      bleed_mm: currentDoc.bleed ?? 0,
      safe_area_mm: currentDoc.safeArea ?? 0,
    };

    // updateTemplateDesign sanitizes the JSON and stores artwork configuration.
    await updateTemplateDesign(
      activeTemplateId,
      frontCanvasJson,
      publish,
      thumbnailUrl,
      artworkConfig,
      backCanvasJson,
      printSettings
    );
  }, [canvasManager, templateId, productId, uploadBase64ImagesInCanvas, uploadBase64ImagesInPages, getCurrentPagesState, activePageIndex, printSides]);

  const handleSaveDraft = useCallback(async (): Promise<void> => {
    // If we're in admin-template mode, delegate to the admin template save logic
    const isAdminTemplateMode =
      mode === 'admin-template' ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('mode') ===
        'admin-template');

    if (isAdminTemplateMode) {
      if (saveInProgressRef.current) return;
      saveInProgressRef.current = true;
      try {
        setSaveStatus('saving');
        await handleSaveAdminTemplate(false);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      } catch (err: any) {
        console.error('Admin template save failed:', err);
        setSaveStatus('error');
        setSaveError(err.message || 'Could not save admin template.');
      } finally {
        saveInProgressRef.current = false;
      }
      return;
    }

    // Never allow two POST requests to race and create duplicate artwork rows.
    if (saveInProgressRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInProgressRef.current = true;

    try {
      do {
        saveQueuedRef.current = false;

        const manager = canvasManagerRef.current;
        const canvas = manager?.getCanvas();

        if (!manager || !canvas) {
          return;
        }

        const currentProductId = productIdRef.current;
        const currentName = designNameRef.current;
        const currentDocument = documentSettingsRef.current;
        const currentDimensions = dimensionsRef.current;

        await uploadBase64ImagesInCanvas(canvas);

        // Use getCurrentPagesState to ensure the active canvas is synced into the pages array
        const currentPages = await getCurrentPagesState();
        const updatedPages = await uploadBase64ImagesInPages(currentPages);
        const allPagesJson = updatedPages.map(p => p.canvasJson);

        // Always keep a local recovery copy, even if the API is unavailable.
        designerService.saveDraftLocally(currentProductId || 'default', {
          version: '1.0',
          product_id: currentProductId,
          name: currentName,
          dimensions: currentDimensions,
          document: currentDocument,
          background_color: currentDocument.backgroundColor || '#ffffff',
          canvas_json: allPagesJson,
        });

        // Laravel requires a real product UUID. Custom/no-product canvases stay local.
        if (!currentProductId) {
          setSaveStatus('local-only');
          setSaveError(null);
          setLastSavedAt(new Date());
          continue;
        }

        setSaveStatus('saving');
        setSaveError(null);

        try {
          const activePage = updatedPages[activePageIndex] || updatedPages[0];
          const thumbnailUrl = activePage?.thumbnail || null;

          const savedArtwork = await designerService.saveArtworkDraft(
            artworkIdRef.current,
            {
              product_id: currentProductId,
              template_id: designTemplateIdRef.current,
              design_template_id: designTemplateIdRef.current,
              name: currentName,
              canvas_json: allPagesJson,
              document_settings: currentDocument,
              width_px: currentDimensions.widthPx,
              height_px: currentDimensions.heightPx,
              dpi: currentDocument.dpi || 300,
              thumbnail_url: thumbnailUrl,
            }
          );

          artworkIdRef.current = savedArtwork.id;
          designerService.rememberArtworkId(
            currentProductId,
            savedArtwork.id
          );

          // Update URL so reopening/reloading restores this exact artwork
          if (typeof window !== 'undefined' && savedArtwork.id) {
            const currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.get('artworkId') !== savedArtwork.id) {
              currentUrl.searchParams.set('artworkId', savedArtwork.id);
              window.history.replaceState({}, '', currentUrl.toString());
            }
          }

          setSaveStatus('saved');
          setSaveError(null);
          setLastSavedAt(new Date());
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Artwork could not be saved.';

          console.error('Artwork autosave failed:', error);
          setSaveStatus('error');
          setSaveError(message);

          // The current state is already safe in localStorage. Stop retrying
          // until the user makes another change or manually presses Save.
          saveQueuedRef.current = false;
          break;
        }
      } while (saveQueuedRef.current);
    } finally {
      saveInProgressRef.current = false;
    }
  }, [handleSaveAdminTemplate, mode, uploadBase64ImagesInCanvas, uploadBase64ImagesInPages, getCurrentPagesState, activePageIndex]);

  const handleAddToCartClick = useCallback(async () => {
    if (canvasManagerRef.current) {
      try {
        const thumb = await canvasManagerRef.current.getCleanPreviewDataUrl(0.4);
        if (thumb) {
          setPreviewThumbnailUrl(thumb);
        }
      } catch { }
    }
    await handleSaveDraft();
    setIsAddToCartOpen(true);
  }, [handleSaveDraft]);



  const handleSaveVersion = useCallback(async () => {
    const manager = canvasManagerRef.current;
    if (!manager) return;
    const canvas = manager.getCanvas();
    if (!canvas) return;

    await uploadBase64ImagesInCanvas(canvas);
    const currentPages = await getCurrentPagesState();
    const updatedPages = await uploadBase64ImagesInPages(currentPages);
    const allPagesJson = updatedPages.map(p => p.canvasJson);
    const versionTimestamp = new Date().toISOString();
    designerService.saveDraftLocally(`${productId || 'default'}_v_${Date.now()}`, {
      version: versionTimestamp,
      product_id: productId,
      name: `${designName} (Version ${new Date().toLocaleTimeString()})`,
      dimensions: dimensionsRef.current,
      document: documentSettings,
      background_color: documentSettings.backgroundColor || '#ffffff',
      canvas_json: allPagesJson,
    });
  }, [designName, documentSettings, productId, getCurrentPagesState, uploadBase64ImagesInCanvas, uploadBase64ImagesInPages]);

  /**
   * Debounce rapid Fabric events (moving, typing, scaling) into one API save.
   */
  const scheduleAutosave = useCallback(() => {
    setSaveStatus('unsaved');
    setSaveError(null);

    if (autosaveTimerRef.current !== null) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void handleSaveDraft();
    }, AUTOSAVE_DELAY_MS);
  }, [handleSaveDraft]);

  // Reuse the same backend artwork row after page refresh.
  useEffect(() => {
    artworkIdRef.current = productId
      ? designerService.loadRememberedArtworkId(productId)
      : null;
  }, [productId]);

  // Autosave every meaningful CanvasManager mutation, including template loads.
  useEffect(() => {
    if (!canvasManager) return;

    const unsubscribe = canvasManager.onChange(scheduleAutosave);

    return () => {
      unsubscribe();

      if (autosaveTimerRef.current !== null) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [canvasManager, scheduleAutosave]);

  // Canvas events do not cover document-name edits, so save metadata too.
  useEffect(() => {
    if (!canvasManager) return;

    if (!metadataAutosaveReadyRef.current) {
      metadataAutosaveReadyRef.current = true;
      return;
    }

    scheduleAutosave();
  }, [canvasManager, designName, documentSettings, scheduleAutosave]);

  const [templateSavedMsg, setTemplateSavedMsg] = useState<string | null>(null);

  // Load template from DB if templateId is provided
  useEffect(() => {
    const activeTmplId =
      templateId ||
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('templateId')
        : null);

    if (!activeTmplId || !canvasManager) return;

    const prodId = productId || productIdRef.current || 'default';
    const currentMode = mode || '';
    const loadKey = `${activeTmplId}:${prodId}:${currentMode}`;

    if (loadedTemplateKeyRef.current === loadKey) {
      return;
    }

    let isMounted = true;
    const fetchTemplate = async () => {
      try {
        const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const isAdminMode =
          mode === 'admin-template' ||
          (typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('mode') ===
            'admin-template');

        let res: Response;
        if (isAdminMode) {
          res = await fetch(`${API_URL}/admin/templates/${activeTmplId}`, {
            headers: {
              Accept: 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
          });
        } else {
          // Public customer endpoint
          res = await fetch(
            `${API_URL}/designer/templates/${prodId}/${activeTmplId}`,
            {
              headers: {
                Accept: 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              },
            }
          );

          // If product template not found and user has auth token, fallback to admin template route
          if (!res.ok && authToken) {
            res = await fetch(`${API_URL}/admin/templates/${activeTmplId}`, {
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
            });
          }
        }
        if (!res.ok) return;
        const result = await res.json();
        if (result.success && result.data && isMounted) {
          loadedTemplateKeyRef.current = loadKey;
          designTemplateIdRef.current = String(result.data.id);

          const loadedProductId =
            result.data.product_id ??
            result.data.product?.id;

          if (loadedProductId) {
            productIdRef.current = String(loadedProductId);
          }
          if (result.data.name) {
            setDesignName(result.data.name);
          }

          const t = result.data;
          const p = t.product || null;

          // Priority resolution:
          // 1. Template-specific saved value
          // 2. Related product saved value
          // 3. Safe fallback value
          const resolvedSides = (t.print_sides || p?.print_sides || 'front') as PrintSides;
          const resolvedWidth = t.width_mm !== null && t.width_mm !== undefined && t.width_mm !== ''
            ? Number(t.width_mm)
            : (p?.width_mm !== null && p?.width_mm !== undefined && p?.width_mm !== ''
              ? Number(p.width_mm)
              : (t.artwork_config?.width || t.widthMm || 90));
          const resolvedHeight = t.height_mm !== null && t.height_mm !== undefined && t.height_mm !== ''
            ? Number(t.height_mm)
            : (p?.height_mm !== null && p?.height_mm !== undefined && p?.height_mm !== ''
              ? Number(p.height_mm)
              : (t.artwork_config?.height || t.heightMm || 50));
          const resolvedMargin = t.margin_mm !== null && t.margin_mm !== undefined && t.margin_mm !== ''
            ? Number(t.margin_mm)
            : (p?.margin_mm !== null && p?.margin_mm !== undefined && p?.margin_mm !== ''
              ? Number(p.margin_mm)
              : (t.artwork_config?.margin ?? 2));
          const resolvedBleed = t.bleed_mm !== null && t.bleed_mm !== undefined && t.bleed_mm !== ''
            ? Number(t.bleed_mm)
            : (p?.bleed_mm !== null && p?.bleed_mm !== undefined && p?.bleed_mm !== ''
              ? Number(p.bleed_mm)
              : (t.artwork_config?.bleed ?? 3));
          const resolvedSafeArea = t.safe_area_mm !== null && t.safe_area_mm !== undefined && t.safe_area_mm !== ''
            ? Number(t.safe_area_mm)
            : (p?.safe_area_mm !== null && p?.safe_area_mm !== undefined && p?.safe_area_mm !== ''
              ? Number(p.safe_area_mm)
              : (t.artwork_config?.safeArea ?? t.artwork_config?.safe_area ?? 3));

          setPrintSides(resolvedSides);
          if (resolvedSides === 'back') {
            setActiveSide('back');
          } else {
            setActiveSide('front');
          }

          // 1. Dynamically initialize artwork canvas using resolved settings
          const templateArtworkConfig = {
            width: resolvedWidth,
            height: resolvedHeight,
            unit: 'mm' as const,
            bleed: resolvedBleed,
            safeArea: resolvedSafeArea,
            safe_area: resolvedSafeArea,
            margin: resolvedMargin,
            dpi: t.artwork_config?.dpi || 300,
            backgroundColor: t.artwork_config?.backgroundColor || t.backgroundColor || '#ffffff',
            name: t.name || designNameRef.current,
          };

          const newDocSettings = canvasManager.initializeArtwork(templateArtworkConfig);
          setDocumentSettings((prev) => ({ ...prev, ...newDocSettings }));
          const newDims = calculateCanvasDimensions(newDocSettings);
          setDimensions(newDims);
          dimensionsRef.current = newDims;
          documentSettingsRef.current = { ...documentSettingsRef.current, ...newDocSettings };

          const { w, h } = containerDimensionsRef.current;
          if (w > 0 && h > 0) {
            canvasManager.fitToViewport(w, h, 32, 48);
            setIsAutoFit(true);
          }

          // 2. Load template pages dynamically using extractTemplatePages
          const extracted = extractTemplatePages(
            t,
            templateArtworkConfig.backgroundColor
          );
          setPages(extracted.pages);
          setSideNames(extracted.sideNames);
          setActivePageIndex(0);
          setActiveSide('front');
          setPrintSides(extracted.printSides);

          // Render thumbnails for non-active pages (like Back side) asynchronously
          extracted.pages.forEach((p, idx) => {
            if (idx > 0 && !p.thumbnail && p.canvasJson && (p.canvasJson.objects?.length > 0 || p.canvasJson.background)) {
              void renderCanvasJsonToThumbnail(
                p.canvasJson,
                Math.round(dimensionsRef.current?.widthPx ? dimensionsRef.current.widthPx * 0.25 : 320),
                Math.round(dimensionsRef.current?.heightPx ? dimensionsRef.current.heightPx * 0.25 : 200),
                templateArtworkConfig.backgroundColor
              ).then((thumb) => {
                if (thumb) {
                  setPages((prev) => {
                    const next = [...prev];
                    if (next[idx]) {
                      next[idx] = { ...next[idx], thumbnail: thumb };
                    }
                    return next;
                  });
                }
              });
            }
          });

          const firstPage = extracted.pages[0];
          if (firstPage) {
            await canvasManager.loadTemplate({
              id: String(t.id),
              title: t.name,
              category: t.category || 'Corporate',
              template_json: firstPage.canvasJson,
              canvas_json: firstPage.canvasJson,
              backgroundColor: templateArtworkConfig.backgroundColor,
            } as any);

            // Generate first page thumbnail immediately
            const frontThumb = await canvasManager.getCleanPreviewDataUrl(0.35);
            if (frontThumb) {
              setPages((prev) => {
                const next = [...prev];
                if (next[0]) {
                  next[0] = { ...next[0], thumbnail: frontThumb };
                }
                return next;
              });
            }
          }
        }
      } catch (err) {
        console.warn('Could not pre-load template:', err);
      }
    };

    void fetchTemplate();

    return () => {
      isMounted = false;
    };
  }, [templateId, canvasManager, mode, productId]);

  // Load artwork from DB if artworkIdProp is provided
  useEffect(() => {
    if (!artworkIdProp || !canvasManager) return;

    let isMounted = true;
    const loadArtwork = async () => {
      try {
        const artwork = await designerService.fetchArtwork(artworkIdProp);
        if (!isMounted) return;

        // Restore design name
        if (artwork.name) {
          setDesignName(artwork.name);
        }

        // Restore document settings
        if (artwork.document_settings) {
          setDocumentSettings(artwork.document_settings);
          const newDims = calculateCanvasDimensions(artwork.document_settings);
          setDimensions(newDims);
          canvasManager.setDimensions(newDims);
          const { w, h } = containerDimensionsRef.current;
          if (w > 0 && h > 0) {
            canvasManager.fitToViewport(w, h, 32, 48);
          }
        }

        // Load fully editable JSON into CanvasManager
        if (artwork.canvas_json) {
          let loadedPages = Array.isArray(artwork.canvas_json)
            ? artwork.canvas_json
            : [artwork.canvas_json];

          // Set pages state
          setPages(loadedPages.map((json: any, idx: number) => ({
            id: `page-${idx}-${Date.now()}`,
            thumbnail: null,
            canvasJson: json
          })));
          setActivePageIndex(0);

          await canvasManager.loadTemplate({
            canvas_json: loadedPages[0],
            backgroundColor: artwork.document_settings?.backgroundColor || undefined,
          } as any);
        }

        // Keep track of IDs so saves update the same row
        artworkIdRef.current = artwork.id;
        if (artwork.design_template_id) {
          designTemplateIdRef.current = String(artwork.design_template_id);
        }
      } catch (err) {
        console.warn('Could not pre-load artwork:', err);
      }
    };

    void loadArtwork();

    return () => {
      isMounted = false;
    };
  }, [artworkIdProp, canvasManager]);

  const handleSaveAsTemplate = useCallback(async () => {
    // If we're in admin-template mode, delegate to the admin template publish logic
    const isAdminTemplateMode =
      mode === 'admin-template' ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('mode') ===
        'admin-template');
    if (isAdminTemplateMode) {
      if (saveInProgressRef.current) return;
      saveInProgressRef.current = true;
      try {
        setSaveStatus('saving');
        await handleSaveAdminTemplate(true); // is_active: true
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        setTemplateSavedMsg('Template published successfully!');
        setTimeout(() => setTemplateSavedMsg(null), 4500);
      } catch (err: any) {
        console.error('Publish template failed:', err);
        setSaveStatus('error');
        setSaveError(err.message || 'Could not publish template.');
      } finally {
        saveInProgressRef.current = false;
      }
      return;
    }

    const manager = canvasManagerRef.current;
    const canvas = manager?.getCanvas();
    if (!manager || !canvas) return;

    try {
      setSaveStatus('saving');

      // This must happen before thumbnail generation and canvas JSON creation.
      await uploadBase64ImagesInCanvas(canvas);

      let thumbDataUrl = '';

      try {
        thumbDataUrl =
          (await manager.getCleanPreviewDataUrl(0.8)) ?? '';
      } catch (error) {
        // Keep saving the editable template even if an external CORS image
        // prevents thumbnail generation.
        console.warn('Could not create template thumbnail:', error);
      }

      const activeTemplateId = designTemplateIdRef.current;
      const isProductTemplate = activeTemplateId?.startsWith('prod_');
      const targetTemplateId = isProductTemplate ? null : activeTemplateId;

      let activeProductId = productIdRef.current;
      if (!activeProductId || activeProductId === 'default') {
        if (isProductTemplate && activeTemplateId) {
          activeProductId = activeTemplateId.replace('prod_', '');
        } else {
          activeProductId = 'default';
        }
      }

      const canvasJson = await replaceEmbeddedImageSourcesInJson(
        manager.getSerializableJson()
      );

      const currentDoc = documentSettingsRef.current;
      const currentDims = dimensionsRef.current;
      const artworkConfig = {
        width: currentDoc.width,
        height: currentDoc.height,
        unit: currentDoc.unit || 'mm',
        dpi: currentDoc.dpi || 300,
        bleed: currentDoc.bleed ?? 0,
        safe_area: currentDoc.safeArea ?? 0,
        safeArea: currentDoc.safeArea ?? 0,
        margin: currentDoc.margin ?? currentDoc.safeArea ?? 0,
        trim: currentDoc.trim ?? true,
        trim_area: {
          width: currentDoc.width,
          height: currentDoc.height,
        },
        trimArea: {
          width: currentDoc.width,
          height: currentDoc.height,
        },
        orientation: currentDoc.orientation || (currentDoc.width >= currentDoc.height ? 'landscape' : 'portrait'),
        print_area: {
          width: currentDims.widthPx,
          height: currentDims.heightPx,
        },
        printArea: {
          width: currentDims.widthPx,
          height: currentDims.heightPx,
        },
        guides: {
          showBleed: manager.getGuidesSettings()?.showBleed ?? true,
          showSafeZone: manager.getGuidesSettings()?.showSafeZone ?? true,
          showTrim: manager.getGuidesSettings()?.showTrim ?? true,
          bleedColor: manager.getGuidesSettings()?.bleedColor,
          safeZoneColor: manager.getGuidesSettings()?.safeZoneColor,
          trimColor: manager.getGuidesSettings()?.trimColor,
        },
        backgroundColor: currentDoc.backgroundColor || '#ffffff',
        name: currentDoc.name || designNameRef.current,
      };

      const saved = await designerService.saveAsDesignTemplate({
        template_id: targetTemplateId,
        product_id: activeProductId,
        name: designNameRef.current || 'Custom Design Template',
        category: 'Corporate',
        canvas_json: canvasJson,
        template_json: canvasJson,
        artwork_config: artworkConfig,
        thumbnail_url: thumbDataUrl,
        is_active: true,
      });

      if (saved?.id) {
        designTemplateIdRef.current = String(saved.id);
      }

      setSaveStatus('saved');
      setLastSavedAt(new Date());
      setTemplateSavedMsg(
        `Template "${saved?.name || designNameRef.current}" saved successfully to design_templates table!`
      );
      setTimeout(() => setTemplateSavedMsg(null), 4500);
    } catch (err: any) {
      console.error('Save template failed:', err);
      setSaveStatus('error');
      setSaveError(err.message || 'Could not save template to database.');
    }
  }, [handleSaveAdminTemplate, mode, uploadBase64ImagesInCanvas, replaceEmbeddedImageSourcesInJson]);

  // Template apply handler (tracks design_template_id, applies dynamic artwork configuration, updates pages, and triggers autosave)
  const handleApplyTemplate = useCallback(async (template: DesignerTemplate | any) => {
    designTemplateIdRef.current = String(template.id);
    const templateTitle = template.title || template.name;
    if (templateTitle) {
      setDesignName((prev) => {
        if (!prev || prev === 'Untitled Design') {
          return templateTitle;
        }
        return prev;
      });
    }

    const product = template.product || {};
    const savedDocument = template.document_settings || {};
    const savedArtwork = template.artwork_config || {};
    const numberOr = (value: unknown, fallback: number, allowZero = false) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && (allowZero ? parsed >= 0 : parsed > 0)
        ? parsed
        : fallback;
    };

    const templateArtworkConfig = {
      ...savedArtwork,
      ...savedDocument,
      name: templateTitle || savedDocument.name || designNameRef.current,
      width: numberOr(
        template.width_mm ?? savedDocument.width ?? savedArtwork.width ?? product.width_mm ?? template.widthMm,
        documentSettingsRef.current.width
      ),
      height: numberOr(
        template.height_mm ?? savedDocument.height ?? savedArtwork.height ?? product.height_mm ?? template.heightMm,
        documentSettingsRef.current.height
      ),
      unit: savedDocument.unit ?? savedArtwork.unit ?? 'mm',
      dpi: numberOr(savedDocument.dpi ?? savedArtwork.dpi, 300),
      bleed: numberOr(
        template.bleed_mm ?? savedDocument.bleed ?? savedArtwork.bleed ?? product.bleed_mm,
        3,
        true
      ),
      safeArea: numberOr(
        template.safe_area_mm ?? savedDocument.safeArea ?? savedArtwork.safeArea ?? savedArtwork.safe_area ?? product.safe_area_mm,
        3,
        true
      ),
      margin: numberOr(
        template.margin_mm ?? savedDocument.margin ?? savedArtwork.margin ?? product.margin_mm,
        0,
        true
      ),
      backgroundColor:
        savedDocument.backgroundColor ??
        savedArtwork.backgroundColor ??
        template.backgroundColor ??
        '#ffffff',
    };

    // Extract pages from the selected template (1 page -> 1, 2 pages -> 2, 3 pages -> 3, etc.)
    const extracted = extractTemplatePages(
      template,
      templateArtworkConfig.backgroundColor
    );

    setPages(extracted.pages);
    setSideNames(extracted.sideNames);
    setActivePageIndex(0);
    setActiveSide('front');
    setPrintSides(extracted.printSides);

    // Render thumbnails for non-active pages (like Back side) asynchronously
    extracted.pages.forEach((p, idx) => {
      if (idx > 0 && !p.thumbnail && p.canvasJson && (p.canvasJson.objects?.length > 0 || p.canvasJson.background)) {
        void renderCanvasJsonToThumbnail(
          p.canvasJson,
          Math.round(dimensionsRef.current?.widthPx ? dimensionsRef.current.widthPx * 0.25 : 320),
          Math.round(dimensionsRef.current?.heightPx ? dimensionsRef.current.heightPx * 0.25 : 200),
          templateArtworkConfig.backgroundColor
        ).then((thumb) => {
          if (thumb) {
            setPages((prev) => {
              const next = [...prev];
              if (next[idx]) {
                next[idx] = { ...next[idx], thumbnail: thumb };
              }
              return next;
            });
          }
        });
      }
    });

    if (canvasManagerRef.current) {
      const newDocSettings = canvasManagerRef.current.initializeArtwork(templateArtworkConfig);
      setDocumentSettings((prev) => ({ ...prev, ...newDocSettings }));
      const newDims = calculateCanvasDimensions(newDocSettings);
      setDimensions(newDims);
      dimensionsRef.current = newDims;
      documentSettingsRef.current = { ...documentSettingsRef.current, ...newDocSettings };

      const { w, h } = containerDimensionsRef.current;
      if (w > 0 && h > 0) {
        canvasManagerRef.current.fitToViewport(w, h, 32, 48);
        setIsAutoFit(true);
      }

      // Load first page of the template onto canvas
      const firstPage = extracted.pages[0];
      if (firstPage) {
        await canvasManagerRef.current.loadTemplate({
          id: String(template.id),
          title: templateTitle,
          category: template.category || 'Corporate',
          template_json: firstPage.canvasJson,
          canvas_json: firstPage.canvasJson,
          backgroundColor: templateArtworkConfig.backgroundColor,
        } as any);

        // Generate first page thumbnail immediately
        const frontThumb = await canvasManagerRef.current.getCleanPreviewDataUrl(0.35);
        if (frontThumb) {
          setPages((prev) => {
            const next = [...prev];
            if (next[0]) {
              next[0] = { ...next[0], thumbnail: frontThumb };
            }
            return next;
          });
        }
      }
    }

    scheduleAutosave();
  }, [scheduleAutosave]);

  // Export handlers
  const handleExportPdf = useCallback(async () => {
    const manager = canvasManagerRef.current;
    if (!manager) return;
    const canvas = manager.getCanvas();
    if (!canvas) return;

    try {
      const wasGuidesVisible = manager.getGuidesVisible();
      const prevZoom = manager.getZoom();

      manager.setGuidesVisible(false);
      canvas.discardActiveObject();
      manager.setZoom(1.0);
      canvas.requestRenderAll();

      const svg = canvas.toSVG();

      manager.setZoom(prevZoom);
      manager.setGuidesVisible(wasGuidesVisible);
      canvas.requestRenderAll();

      await exportVectorPdf(
        [svg],
        documentSettings,
        dimensionsRef.current.widthPx,
        dimensionsRef.current.heightPx,
        { filename: `${(documentSettings.name || 'artwork').toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_vector.pdf` }
      );
    } catch (err) {
      console.error('Vector PDF Export failed:', err);
      alert(`Could not export Vector PDF file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [documentSettings]);

  const handleExportPng = useCallback(async () => {
    if (!canvasManagerRef.current) return;
    try {
      await exportHighResolutionImage(
        canvasManagerRef.current,
        documentSettings,
        dimensionsRef.current,
        { format: 'png', dpi: 300 }
      );
    } catch (err) {
      console.error('PNG Export failed:', err);
      alert('Could not export PNG file.');
    }
  }, [documentSettings]);

  const handleExportJpg = useCallback(async () => {
    if (!canvasManagerRef.current) return;
    try {
      await exportHighResolutionImage(
        canvasManagerRef.current,
        documentSettings,
        dimensionsRef.current,
        { format: 'jpeg', dpi: 300, quality: 0.98 }
      );
    } catch (err) {
      console.error('JPG Export failed:', err);
      alert('Could not export JPG file.');
    }
  }, [documentSettings]);

  const handleExportPsd = useCallback(async () => {
    if (!canvasManagerRef.current) return;
    try {
      await exportLayeredPsd(
        canvasManagerRef.current,
        documentSettings,
        dimensionsRef.current
      );
    } catch (err) {
      console.error('PSD Export failed:', err);
      alert('Could not generate layered PSD file.');
    }
  }, [documentSettings]);

  // Lifecycle for Fabric Canvas initialization
  const handleCanvasReady = useCallback(
    (canvasEl: HTMLCanvasElement, containerW: number, containerH: number) => {
      const currentDims = dimensionsRef.current;
      containerDimensionsRef.current = { w: containerW, h: containerH };

      const manager = new CanvasManager(currentDims, {
        showBleed: true,
        showSafeZone: true,
        showTrim: true,
      });

      canvasManagerRef.current = manager;
      setCanvasManager(manager);
      manager.initialize(canvasEl, containerW, containerH);

      // Listen for selection events
      const unsubscribeSelection = manager.onSelectionChange((state) => {
        setSelected(state);
        if (state) {
          setIsPropertiesOpen(true);
        }
      });

      // Listen for zoom events
      const unsubscribeZoom = manager.onZoomChange((z) => {
        setZoom(z);
      });

      // Listen for guides events
      const unsubscribeGuides = manager.onGuidesChange((visible) => {
        setShowGuides(visible);
      });

      // Listen for preflight report events
      const unsubscribePreflight = manager.onPreflightChange((report) => {
        setPreflightReport(report);
      });

      // Listen for history events (Undo / Redo status)
      const unsubscribeHistory = manager.onHistoryChange((u, r) => {
        setCanUndo(u);
        setCanRedo(r);
      });

      // Initial fit to screen with full visible canvas
      const fitZ = calculateFitZoom(currentDims.widthPx, currentDims.heightPx, containerW, containerH, 32, 48);
      manager.setZoom(fitZ);

      return () => {
        unsubscribeSelection();
        unsubscribeZoom();
        unsubscribeGuides();
        unsubscribePreflight();
        unsubscribeHistory();
        manager.dispose();
        canvasManagerRef.current = null;
        setCanvasManager(null);
      };
    },
    []
  );

  // Preload popular typography in background
  useEffect(() => {
    preloadPopularFonts();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const manager = canvasManagerRef.current;
      if (!manager) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        manager.deleteSelected();
      } else if (e.key === 'Escape') {
        if (isPreviewOpen) setIsPreviewOpen(false);
        else if (isCustomSizeOpen) setIsCustomSizeOpen(false);
        else manager.deselectAll();
      } else if (e.key === 'v' || e.key === 'V') {
        if (isPanMode) handleTogglePanMode();
      } else if (e.key === 'h' || e.key === 'H') {
        if (!isPanMode) handleTogglePanMode();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        manager.zoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        manager.zoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleFitCanvas();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        manager.resetZoom();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        manager.duplicateSelected();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === ';' || e.key === ':')) {
        e.preventDefault();
        handleToggleGuides();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          manager.redo();
        } else {
          manager.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        manager.redo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setIsPreviewOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveDraft();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFitCanvas, handleSaveDraft, handleToggleGuides, handleTogglePanMode, isPanMode, isPreviewOpen, isCustomSizeOpen]);

  useEffect(() => {
    const hasAlert =
      !!preflightReport?.hasBleedViolation ||
      !!preflightReport?.hasTrimLineViolation ||
      !!preflightReport?.hasSafeZoneViolation;

    if (!hasAlert) {
      setShowPreflightAlert(false);
      return;
    }

    // Show alert immediately
    setShowPreflightAlert(true);

    // Hide after 2 seconds
    const timer = window.setTimeout(() => {
      setShowPreflightAlert(false);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    preflightReport?.hasBleedViolation,
    preflightReport?.hasTrimLineViolation,
    preflightReport?.hasSafeZoneViolation,
  ]);


  return (
    <div className="fixed inset-0 z-50 flex flex-col h-screen w-screen max-h-screen max-w-screen overflow-hidden bg-white text-gray-900 font-sans select-none">
      {/* Top Toolbar */}
      <DesignerToolbar
        designName={designName}
        onDesignNameChange={setDesignName}
        documentSettings={documentSettings}
        isPanMode={isPanMode}
        onTogglePanMode={handleTogglePanMode}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitCanvas={handleFitCanvas}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => canvasManagerRef.current?.undo()}
        onRedo={() => canvasManagerRef.current?.redo()}
        isPropertiesOpen={isPropertiesOpen}
        onToggleProperties={() => setIsPropertiesOpen((prev) => !prev)}
        showGuides={showGuides}
        onToggleGuides={handleToggleGuides}
        onSave={handleSaveDraft}
        onSaveAsTemplate={handleSaveAsTemplate}
        onSaveVersion={handleSaveVersion}
        onOpenPreview={() => setIsPreviewOpen(true)}
        onOpenCustomSize={() => setIsCustomSizeOpen(true)}
        onExportPdf={handleExportPdf}
        onExportPng={handleExportPng}
        onExportJpg={handleExportJpg}
        onExportPsd={handleExportPsd}
        canvasManager={canvasManager}
        preflightReport={preflightReport}
        onAddToCart={handleAddToCartClick}
        isAdminTemplateMode={
          mode === 'admin-template' ||
          (typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('mode') ===
            'admin-template'
            : false)
        }
      />

      {/* Template Saved Toast Notification */}
      {templateSavedMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <span>✓</span>
          <span>{templateSavedMsg}</span>
        </div>
      )}

      {/* Autosave status */}
      {saveStatus !== 'idle' && (
        <div
          className={`fixed right-4 top-16 z-[70] max-w-sm rounded-lg border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm ${saveStatus === 'error'
            ? 'border-red-200 bg-red-50/95 text-red-700'
            : saveStatus === 'saving' || saveStatus === 'unsaved'
              ? 'border-amber-200 bg-amber-50/95 text-amber-700'
              : saveStatus === 'local-only'
                ? 'border-blue-200 bg-blue-50/95 text-blue-700'
                : 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
            }`}
          title={saveError ?? undefined}
        >
          {saveStatus === 'unsaved' && 'Unsaved changes'}
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' &&
            `All changes saved${lastSavedAt
              ? ` at ${lastSavedAt.toLocaleTimeString()}`
              : ''
            }`}
          {saveStatus === 'local-only' && 'Saved locally — product ID required for cloud save'}
          {saveStatus === 'error' &&
            `Save failed: ${saveError ?? 'Unknown error'}`}
        </div>
      )}

      {/* Main Workspace Area (Sidebar + Canvas + Properties) */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative w-full h-full">
        {/* Left Sidebar */}
        <DesignerSidebar
          activeTab={activeSidebarTab}
          onSelectTab={setActiveSidebarTab}
          canvasManager={canvasManager}
          selected={selected}
          productId={productId ?? ''}
          onApplyTemplate={handleApplyTemplate}
        />

        {/* Center Canvas Area with Live Zone Alert Banners */}
        <div className="relative flex-1 h-full w-full min-h-0 min-w-0 overflow-hidden flex flex-col">

          {/* Floating Draw Toolbar */}
          {activeSidebarTab === 'draw' && (
            <FloatingDrawToolbar
              canvasManager={canvasManager}
              onClose={() => setActiveSidebarTab(null)}
              onSelectTab={setActiveSidebarTab}
            />
          )}

          {/* Bleed Overflow Alert (Most Critical - Red) */}
          {showPreflightAlert && preflightReport?.hasBleedViolation && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-rose-600/95 text-white px-4 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold backdrop-blur-xs border border-rose-500 animate-in fade-in slide-in-from-top-2 duration-200 max-w-xl">
              <AlertTriangle className="w-4 h-4 text-rose-200 flex-shrink-0" />
              <span>Bleed Overflow: Elements extend beyond the printable bleed area. Content outside the red line will be completely lost.</span>
            </div>
          )}

          {/* Trim Line Alert (Warning - Dark/Black) */}
          {showPreflightAlert &&
            !preflightReport?.hasBleedViolation &&
            preflightReport?.hasTrimLineViolation && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 text-white px-4 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold backdrop-blur-xs border border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200 max-w-xl">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Trim Line Alert: Elements cross the dark cut line. The printer&apos;s guillotine will slice through these parts.</span>
              </div>
            )}

          {/* Safe Zone Alert (Info - Amber) */}
          {showPreflightAlert &&
            !preflightReport?.hasBleedViolation &&
            !preflightReport?.hasTrimLineViolation &&
            preflightReport?.hasSafeZoneViolation && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-amber-500/95 text-white px-4 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold backdrop-blur-xs border border-amber-400 animate-in fade-in slide-in-from-top-2 duration-200 max-w-xl">
                <AlertTriangle className="w-4 h-4 text-amber-100 flex-shrink-0" />
                <span>Safe Zone Alert: Elements are outside the safe margin. Text and logos here may be cut off during trimming.</span>
              </div>
            )}

          {/* Front / Back Side Switcher for print_sides === 'both' and 2 pages */}
          {printSides === 'both' && pages.length === 2 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center bg-white/95 backdrop-blur-md px-1.5 py-1 rounded-2xl shadow-lg border border-gray-200">
              <button
                type="button"
                onClick={() => handleSwitchSide('front')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${activeSide === 'front'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
              >
                <span>Front Side</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchSide('back')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${activeSide === 'back'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
              >
                <span>Back Side</span>
              </button>
            </div>
          )}

          <DesignerCanvas
            zoom={zoom}
            setZoom={handleZoomChange}
            dimensions={dimensions}
            canvasManager={canvasManager}
            onCanvasReady={handleCanvasReady}
            onContainerResize={handleContainerResize}
            showRulers={true}
            selected={selected}
            onSelectSidebarTab={setActiveSidebarTab}
            activeSidebarTab={activeSidebarTab}
            onUpdateDocumentSettings={handleUpdateDocumentSettings}
          />

          {/* Page Manager Tray */}
          <PageManagerTray
            pages={pages}
            activePageIndex={activePageIndex}
            onPageSelect={handlePageSelect}
            onAddPage={handleAddPage}
            onDuplicatePage={handleDuplicatePage}
            onDeletePage={handleDeletePage}
            onUpdatePageThumbnail={(idx, thumb) => {
              setPages((prev) => {
                if (prev[idx]?.thumbnail === thumb) return prev;
                const next = [...prev];
                if (next[idx]) {
                  next[idx] = { ...next[idx], thumbnail: thumb };
                }
                return next;
              });
            }}
            onOpenPreview={async () => {
              await getCurrentPagesState();
              setIsPreviewOpen(true);
            }}
            canvasManager={canvasManager}
            printSides={printSides}
            sideNames={sideNames}
          />

          {/* Inline Ready for Print Preflight Checklist Card */}
          {preflightReport && (
            <div className="w-full flex-shrink-0 bg-white">
              <PreflightBadge
                report={preflightReport}
                canvasManager={canvasManager}
              />
            </div>
          )}
        </div>

        {/* Right Properties Panel */}
        {isPropertiesOpen && (
          <DesignerProperties
            selected={selected}
            documentSettings={documentSettings}
            dimensions={dimensions}
            onUpdateDocumentSettings={handleUpdateDocumentSettings}
            canvasManager={canvasManager}
            onOpenPreview={() => setIsPreviewOpen(true)}
            onClose={() => setIsPropertiesOpen(false)}
          />
        )}
      </div>

      {/* Bottom Bar */}
      <DesignerBottomBar
        selected={selected}
        documentSettings={documentSettings}
        dimensions={dimensions}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitCanvas={handleFitCanvas}
        showGuides={showGuides}
        onToggleGuides={handleToggleGuides}
      />

      {/* Print Preview Modal */}
      <ArtworkPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        documentSettings={documentSettings}
        dimensions={dimensions}
        canvasManager={canvasManager}
        preflightReport={preflightReport}
        pages={pages}
        activePageIndex={activePageIndex}
        printSides={printSides}
        onExportPdf={handleExportPdf}
        onExportPng={handleExportPng}
        onExportJpg={handleExportJpg}
        onExportPsd={handleExportPsd}
      />

      {/* Custom Banner & Artwork Size Modal */}
      <CustomBannerSizeModal
        isOpen={isCustomSizeOpen}
        onClose={() => setIsCustomSizeOpen(false)}
        currentSettings={documentSettings}
        onApply={handleUpdateDocumentSettings}
      />

      {/* Add to Cart Modal */}
      <AddToCartModal
        isOpen={isAddToCartOpen}
        onClose={() => setIsAddToCartOpen(false)}
        productId={productId || 'default'}
        artworkId={artworkIdRef.current}
        artworkName={designName}
        previewDataUrl={previewThumbnailUrl}
        dimensionsText={`${documentSettings.width} × ${documentSettings.height} ${documentSettings.unit || 'mm'} (${documentSettings.dpi || 300} DPI)`}
      />
    </div>
  );
}
