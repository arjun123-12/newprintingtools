'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  DocumentSettings,
  SelectedObjectState,
  ActiveSidebarTab,
  CanvasDimensions,
} from '@/types/designer';
import { calculateCanvasDimensions, calculateFitZoom } from './utils/dimensions';
import { CanvasManager } from './canvas/CanvasManager';
import { DesignerToolbar } from './DesignerToolbar';
import { DesignerSidebar } from './DesignerSidebar';
import { DesignerCanvas } from './DesignerCanvas';
import { DesignerProperties } from './DesignerProperties';
import { DesignerBottomBar } from './DesignerBottomBar';
import { designerService } from './services/designerService';
import { exportHighResolutionImage } from './services/exportService';
import { exportLayeredPsd } from './services/psdExportService';
import { preloadPopularFonts } from './utils/fonts';
import { PreflightReport } from './utils/preflightCheck';
import { PreflightBadge } from './controls/PreflightBadge';
import { ArtworkPreviewModal } from './controls/ArtworkPreviewModal';
import { CustomBannerSizeModal } from './controls/CustomBannerSizeModal';
import { AlertTriangle } from 'lucide-react';

interface DesignerProps {
  productId?: string;
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

export default function Designer({
  productId,
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

  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const dimensionsRef = useRef<CanvasDimensions>(dimensions);
  dimensionsRef.current = dimensions;

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

  const handleSaveDraft = useCallback(() => {
    const manager = canvasManagerRef.current;
    if (!manager) return;
    const canvas = manager.getCanvas();
    if (!canvas) return;

    const canvasJson = canvas.toJSON();
    designerService.saveDraftLocally(productId || 'default', {
      version: '1.0',
      product_id: productId,
      name: designName,
      dimensions: dimensionsRef.current,
      document: documentSettings,
      background_color: documentSettings.backgroundColor || '#ffffff',
      canvas_json: canvasJson,
    });
  }, [designName, documentSettings, productId]);

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

  // Export handlers
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

      // Initial fit to screen with full visible canvas
      const fitZ = calculateFitZoom(currentDims.widthPx, currentDims.heightPx, containerW, containerH, 32, 48);
      manager.setZoom(fitZ);

      return () => {
        unsubscribeSelection();
        unsubscribeZoom();
        unsubscribeGuides();
        unsubscribePreflight();
        manager.dispose();
        canvasManagerRef.current = null;
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
        isPropertiesOpen={isPropertiesOpen}
        onToggleProperties={() => setIsPropertiesOpen((prev) => !prev)}
        showGuides={showGuides}
        onToggleGuides={handleToggleGuides}
        onSave={handleSaveDraft}
        onSaveVersion={handleSaveVersion}
        onOpenPreview={() => setIsPreviewOpen(true)}
        onOpenCustomSize={() => setIsCustomSizeOpen(true)}
        onExportPng={handleExportPng}
        onExportJpg={handleExportJpg}
        onExportPsd={handleExportPsd}
        canvasManager={canvasManagerRef.current}
        preflightReport={preflightReport}
        selected={selected}
      />

      {/* Main Workspace Area (Sidebar + Canvas + Properties) */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative w-full h-full">
        {/* Left Sidebar */}
        <DesignerSidebar
          activeTab={activeSidebarTab}
          onSelectTab={setActiveSidebarTab}
          canvasManager={canvasManagerRef.current}
          selected={selected}
        />

        {/* Center Canvas Area with Live Safe Margin Banner */}
        <div className="relative flex-1 h-full w-full min-h-0 min-w-0 overflow-hidden flex flex-col">
          {preflightReport?.hasSafeZoneViolation && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-amber-500/95 text-white px-4 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold backdrop-blur-xs border border-amber-400 animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertTriangle className="w-4 h-4 text-amber-100 flex-shrink-0" />
              <span>Safe Margin Alert: Elements extend outside the 3mm safe print margin.</span>
            </div>
          )}

          <DesignerCanvas
            zoom={zoom}
            setZoom={handleZoomChange}
            dimensions={dimensions}
            canvasManager={canvasManagerRef.current}
            onCanvasReady={handleCanvasReady}
            onContainerResize={handleContainerResize}
            showRulers={true}
            selected={selected}
          />

          {/* Floating Ready for Print Preflight Checklist Card in Bottom-Right */}
          {preflightReport && (
            <div className="absolute bottom-2 right-4 z-40">
              <PreflightBadge
                report={preflightReport}
                canvasManager={canvasManagerRef.current}
              />
            </div>
          )}
        </div>

        {/* Right Properties Panel */}
        {isPropertiesOpen && (
          <DesignerProperties
            selected={selected}
            documentSettings={documentSettings}
            onUpdateDocumentSettings={handleUpdateDocumentSettings}
            canvasManager={canvasManagerRef.current}
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
        canvasManager={canvasManagerRef.current}
        preflightReport={preflightReport}
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