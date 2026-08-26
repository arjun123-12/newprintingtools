"use client";

import { useEffect, useRef } from "react";
import { CanvasDimensions, SelectedObjectState } from "@/types/designer";
import { CanvasManager } from "./canvas/CanvasManager";
import { Ruler } from "./canvas/Ruler";
import { ContextualToolbar } from "./toolbar/ContextualToolbar";
import { ElementActionBar } from "./toolbar/ElementActionBar";

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
}: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);

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
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && onContainerResize) {
            onContainerResize(width, height);
          }
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
      className="relative flex-1 h-full w-full min-h-0 min-w-0 overflow-hidden bg-[#eef1f6] bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:20px_20px] select-none flex items-center justify-center p-4"
    >
      {/* Floating Canva Contextual Toolbar (Top of Workspace) */}
      {selected && (
        <ContextualToolbar
          selected={selected}
          canvasManager={canvasManager || null}
          zoom={zoom}
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
        </div>
      </div>
    </div>
  );
}

export default DesignerCanvas;