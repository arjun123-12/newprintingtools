'use client';

import { useEffect, useRef, useState } from "react";
import { CanvasDimensions, SelectedObjectState, ActiveSidebarTab } from "@/types/designer";
import { CanvasManager } from "./canvas/CanvasManager";
import { Ruler } from "./canvas/Ruler";
import { ContextualToolbar } from "./toolbar/ContextualToolbar";
import { ElementActionBar } from "./toolbar/ElementActionBar";
import { RotationBadge } from "./toolbar/RotationBadge";

export interface DesignerCanvasProps {
  zoom: number;
  setZoom?: (zoom: number) => void;
  dimensions?: CanvasDimensions;
  canvasManager?: CanvasManager | null;
  selected?: SelectedObjectState | null;
  onCanvasReady?: (
    canvasEl: HTMLCanvasElement,
    containerW: number,
    containerH: number
  ) => (() => void) | void;
  onContainerResize?: (width: number, height: number) => void;
  showRulers?: boolean;
  onSelectSidebarTab?: (tab: ActiveSidebarTab) => void;
  activeSidebarTab?: ActiveSidebarTab;
}

export function DesignerCanvas({
  zoom,
  setZoom,
  dimensions,
  canvasManager,
  selected = null,
  onCanvasReady,
  onContainerResize,
  showRulers = true,
  onSelectSidebarTab,
  activeSidebarTab,
}: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [isEraserActive, setIsEraserActive] = useState<boolean>(false);
  const [eraserSize, setEraserSize] = useState<number>(20);
  const [mousePos, setMousePos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  useEffect(() => {
    if (!canvasManager) return;

    const checkEraser = () => {
      const isDrawing = canvasManager.isDrawingMode();
      const settings = canvasManager.getBrushSettings();
      setIsEraserActive(isDrawing && settings.tool === 'eraser');
      setEraserSize(settings.size || 20);
    };

    checkEraser();

    const unsubMode = canvasManager.onDrawingModeChange(() => checkEraser());
    const unsubSettings = canvasManager.onBrushSettingsChange((s) => {
      setIsEraserActive(canvasManager.isDrawingMode() && s.tool === 'eraser');
      setEraserSize(s.size || 20);
    });

    return () => {
      unsubMode();
      unsubSettings();
    };
  }, [canvasManager]);

  useEffect(() => {
    const paperEl = paperRef.current;
    const containerEl = containerRef.current;
    if (!paperEl || !containerEl) return;

    // Fresh canvas node per mount to avoid StrictMode re-initialization error
    const canvasEl = document.createElement("canvas");
    paperEl.replaceChildren(canvasEl);

    const containerW = containerEl.clientWidth;
    const containerH = containerEl.clientHeight;

    let cleanup: (() => void) | void;
    if (onCanvasReady) {
      cleanup = onCanvasReady(canvasEl, containerW, containerH);
    }

    // Attach ResizeObserver to keep canvas container informed of true viewport size
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        const width = containerEl.clientWidth;
        const height = containerEl.clientHeight;
        if (width > 0 && height > 0 && onContainerResize) {
          onContainerResize(width, height);
        }
      });
      resizeObserver.observe(containerEl);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (typeof cleanup === "function") {
        cleanup();
      }
      if (paperEl) {
        paperEl.replaceChildren();
      }
    };
  }, [onCanvasReady, onContainerResize]);

  /*
   * Zoom the Fabric display & viewport via canvasManager.
   */
  useEffect(() => {
    if (canvasManager && typeof zoom === "number") {
      canvasManager.setZoom(zoom);
    }
  }, [zoom, canvasManager]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasManager) return;
    const url = e.dataTransfer.getData('text/plain');
    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/'))) {
      await canvasManager.setBackgroundImage(url, {
        fit: 'cover',
        scale: 1.0,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseMove={(e) => {
        if (isEraserActive) {
          setMousePos({ x: e.clientX, y: e.clientY, visible: true });
        }
      }}
      onMouseEnter={(e) => {
        if (isEraserActive) {
          setMousePos({ x: e.clientX, y: e.clientY, visible: true });
        }
      }}
      onMouseLeave={() => {
        setMousePos((prev) => ({ ...prev, visible: false }));
      }}
      className="relative flex-1 h-full w-full min-h-0 min-w-0 overflow-hidden bg-[#eef1f6] bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:20px_20px] select-none flex items-center justify-center p-4"
    >
      {/* Floating Canva Contextual Toolbar (Top of Workspace) */}
      <ContextualToolbar
        selected={selected}
        canvasManager={canvasManager || null}
        zoom={zoom}
        onSelectSidebarTab={onSelectSidebarTab}
        activeSidebarTab={activeSidebarTab}
      />

      {/* Floating Canva Eraser Cursor Indicator */}
      {isEraserActive && mousePos.visible && (
        <div
          className="fixed pointer-events-none z-50 rounded-full border-2 border-blue-600 bg-blue-500/15 -translate-x-1/2 -translate-y-1/2 shadow-xs transition-none"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            width: `${Math.max(eraserSize * zoom, 8)}px`,
            height: `${Math.max(eraserSize * zoom, 8)}px`,
          }}
        />
      )}

      {/* Workspace Canvas Container with Rulers */}
      <div className="relative flex-shrink-0">
        {showRulers && dimensions && (
          <Ruler
            zoom={zoom}
            dimensions={dimensions}
            canvasManager={canvasManager || null}
            paperRef={paperRef}
            containerRef={containerRef}
          />
        )}

        {/* Canvas Paper Card with Clear Visible Bounds and Offset for 4-Sided Rulers */}
        <div
          ref={paperRef}
          style={{ margin: showRulers ? '24px' : '0px' }}
          className="relative bg-white shadow-2xl rounded-xs ring-1 ring-black/15 flex-shrink-0"
        >
          {/* Floating Element Action Bar attached directly to the active element */}
          {selected && (
            <ElementActionBar
              selected={selected}
              canvasManager={canvasManager || null}
              zoom={zoom}
            />
          )}

          {/* Canva Live Rotation Badge floating over the rotating element */}
          <RotationBadge
            canvasManager={canvasManager || null}
            selected={selected}
            zoom={zoom}
          />
        </div>
      </div>
    </div>
  );
}

export default DesignerCanvas;