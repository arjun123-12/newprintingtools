'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  DocumentSettings,
  SelectedObjectState,
  ActiveSidebarTab,
  CanvasDimensions,
  DesignerTemplate,
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
import { AlertTriangle } from 'lucide-react';

interface DesignerProps {
  productId?: string;
  templateId?: string;
  initialSettings?: Partial<DocumentSettings>;
}

const DEFAULT_DOCUMENT: DocumentSettings = {
  name: 'Custom Print Artwork',
  width: 90,
  height: 50,
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

export default function Designer({
  productId,
  templateId,
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
  const [isAutoFit, setIsAutoFit] = useState<boolean>(true);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [showPreflightAlert, setShowPreflightAlert] = useState<boolean>(false);
  const [canvasManager, setCanvasManager] = useState<CanvasManager | null>(null);
  const [saveStatus, setSaveStatus] = useState<ArtworkSaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const dimensionsRef = useRef<CanvasDimensions>(dimensions);
  dimensionsRef.current = dimensions;

  const productIdRef = useRef<string | undefined>(productId);
  productIdRef.current = productId;

  const designNameRef = useRef<string>(designName);
  designNameRef.current = designName;

  const documentSettingsRef = useRef<DocumentSettings>(documentSettings);
  documentSettingsRef.current = documentSettings;

  const artworkIdRef = useRef<string | null>(null);
  const designTemplateIdRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef<boolean>(false);
  const saveQueuedRef = useRef<boolean>(false);
  const metadataAutosaveReadyRef = useRef<boolean>(false);

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

  const handleSaveDraft = useCallback(async (): Promise<void> => {
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

        // Include custom designer properties but never persist editor guides.
        const canvasJson = canvas.toObject([
          'id',
          'name',
          'originalSrc',
          'naturalWidth',
          'naturalHeight',
          'fileSizeBytes',
          'isFrame',
          'isFrameImage',
          'frameId',
          'isBrushPath',
          'brushType',
        ]) as Record<string, any>;

        if (Array.isArray(canvasJson.objects)) {
          canvasJson.objects = canvasJson.objects.filter(
            (object: Record<string, unknown>) => !object.isGuide
          );
        }

        // Always keep a local recovery copy, even if the API is unavailable.
        designerService.saveDraftLocally(currentProductId || 'default', {
          version: '1.0',
          product_id: currentProductId,
          name: currentName,
          dimensions: currentDimensions,
          document: currentDocument,
          background_color: currentDocument.backgroundColor || '#ffffff',
          canvas_json: canvasJson,
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
          const savedArtwork = await designerService.saveArtworkDraft(
            artworkIdRef.current,
            {
              product_id: currentProductId,
              design_template_id: designTemplateIdRef.current,
              name: currentName,
              canvas_json: canvasJson,
              document_settings: currentDocument,
              width_px: currentDimensions.widthPx,
              height_px: currentDimensions.heightPx,
              dpi: currentDocument.dpi || 300,
            }
          );

          artworkIdRef.current = savedArtwork.id;
          designerService.rememberArtworkId(
            currentProductId,
            savedArtwork.id
          );

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
  }, []);

  const handleSaveVersion = useCallback(() => {
    const manager = canvasManagerRef.current;
    if (!manager) return;
    const canvas = manager.getCanvas();
    if (!canvas) return;

    const canvasJson = canvas.toJSON();
    const versionTimestamp = new Date().toISOString();
    designerService.saveDraftLocally(`${productId || 'default'}_v_${Date.now()}`, {
      version: versionTimestamp,
      product_id: productId,
      name: `${designName} (Version ${new Date().toLocaleTimeString()})`,
      dimensions: dimensionsRef.current,
      document: documentSettings,
      background_color: documentSettings.backgroundColor || '#ffffff',
      canvas_json: canvasJson,
    });
  }, [designName, documentSettings, productId]);

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

    let isMounted = true;
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/admin/templates/${activeTmplId}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const result = await res.json();
        if (result.success && result.data && isMounted) {
          designTemplateIdRef.current = String(result.data.id);
          if (result.data.name) {
            setDesignName(result.data.name);
          }
          if (result.data.canvas_json) {
            await canvasManager.loadTemplate({
              id: String(result.data.id),
              title: result.data.name,
              category: result.data.category || 'Corporate',
              canvas_json: result.data.canvas_json,
            } as any);
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
  }, [templateId, canvasManager]);

  const handleSaveAsTemplate = useCallback(async () => {
    const manager = canvasManagerRef.current;
    const canvas = manager?.getCanvas();
    if (!manager || !canvas) return;

    try {
      setSaveStatus('saving');
      const thumbDataUrl = await manager.getCleanPreviewDataUrl(0.8);

      const canvasJson = canvas.toObject([
        'id',
        'name',
        'originalSrc',
        'naturalWidth',
        'naturalHeight',
        'fileSizeBytes',
        'isFrame',
        'isFrameImage',
        'frameId',
        'isBrushPath',
        'brushType',
      ]) as Record<string, any>;

      if (Array.isArray(canvasJson.objects)) {
        canvasJson.objects = canvasJson.objects.filter(
          (object: Record<string, unknown>) => !object.isGuide
        );
      }

      const activeProductId = productIdRef.current || 'default';
      const activeTemplateId = designTemplateIdRef.current;

      const saved = await designerService.saveAsDesignTemplate({
        template_id: activeTemplateId,
        product_id: activeProductId,
        name: designNameRef.current || 'Custom Design Template',
        category: 'Corporate',
        canvas_json: canvasJson,
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
  }, []);

  // Template apply handler (tracks design_template_id and triggers autosave)
  const handleApplyTemplate = useCallback((template: DesignerTemplate) => {
    designTemplateIdRef.current = String(template.id);
    const templateTitle = template.title || (template as any).name;
    if (templateTitle) {
      setDesignName((prev) => {
        if (!prev || prev === 'Untitled Design') {
          return templateTitle;
        }
        return prev;
      });
    }
    scheduleAutosave();
  }, [scheduleAutosave]);

  // Export handlers
  const handleExportPdf = useCallback(async () => {
    const manager = canvasManagerRef.current;
    if (!manager) return;
    try {
      await exportVectorPdf(
        manager,
        documentSettings,
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
          />

          {/* Floating Ready for Print Preflight Checklist Card in Bottom-Right */}
          {preflightReport && (
            <div className="absolute bottom-2 right-4 z-40">
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
    </div>
  );
}
