'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react';

import {
  CanvasDimensions,
  DocumentSettings,
  SelectedObjectState,
  ActiveSidebarTab,
} from '@/types/designer';

import { CanvasManager } from './canvas/CanvasManager';
import { Ruler } from './canvas/Ruler';
import { ContextualToolbar } from './toolbar/ContextualToolbar';
import { ElementActionBar } from './toolbar/ElementActionBar';
import { RotationBadge } from './toolbar/RotationBadge';
import { ResizeBadge } from './toolbar/ResizeBadge';

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '');

const BACKEND_URL = API_URL.replace(/\/api\/v1$/, '');

export interface DesignerCanvasProps {
  zoom: number;
  productId?: string;
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

  onUpdateDocumentSettings?: (
    settings: Partial<DocumentSettings>
  ) => void;
}

function makeAbsoluteStorageUrl(url: string): string {
  try {
    return new URL(url, `${BACKEND_URL}/`).toString();
  } catch {
    return url;
  }
}

export function DesignerCanvas({
  zoom,
  productId,
  setZoom,
  dimensions,
  canvasManager,
  selected = null,
  onCanvasReady,
  onContainerResize,
  showRulers = true,
  onSelectSidebarTab,
  activeSidebarTab,
  onUpdateDocumentSettings,
}: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const previousZoomRef = useRef(zoom);
  const scrollUpdateFrameRef = useRef<number | null>(null);
  const isSpacePressedRef = useRef(false);
  const isViewportPanningRef = useRef(false);
  const panStartRef = useRef({
    pointerX: 0,
    pointerY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  /*
   * Fabric manages only the children inside canvasHostRef.
   * React toolbar elements remain separate and will not be removed.
   */
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  const canvasManagerRef = useRef<CanvasManager | null | undefined>(
    canvasManager
  );

  const onCanvasReadyRef = useRef(onCanvasReady);
  const onContainerResizeRef = useRef(onContainerResize);

  const [isEraserActive, setIsEraserActive] = useState(false);
  const [eraserSize, setEraserSize] = useState(20);
  const [dropError, setDropError] = useState<string | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isViewportPanning, setIsViewportPanning] = useState(false);

  const [mousePos, setMousePos] = useState({
    x: 0,
    y: 0,
    visible: false,
  });

  /*
   * Keep latest callback references without rebuilding the Fabric canvas.
   */
  useEffect(() => {
    onCanvasReadyRef.current = onCanvasReady;
  }, [onCanvasReady]);

  useEffect(() => {
    onContainerResizeRef.current = onContainerResize;
  }, [onContainerResize]);

  useEffect(() => {
    canvasManagerRef.current = canvasManager;
  }, [canvasManager]);

  /*
   * Initialize Fabric canvas only when this component mounts.
   *
   * Previously paperRef.replaceChildren(canvasEl) removed the React toolbar
   * elements and recreated the canvas when callback references changed.
   */
  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    const containerEl = containerRef.current;

    if (!canvasHost || !containerEl) return;

    const canvasEl = document.createElement('canvas');

    canvasEl.style.display = 'block';
    canvasHost.replaceChildren(canvasEl);

    const containerW = containerEl.clientWidth;
    const containerH = containerEl.clientHeight;

    const cleanup = onCanvasReadyRef.current?.(
      canvasEl,
      containerW,
      containerH
    );

    let resizeFrame: number | null = null;

    const updateCanvasPosition = () => {
      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame);
      }

      resizeFrame = requestAnimationFrame(() => {
        const manager = canvasManagerRef.current;
        const canvas = manager?.getCanvas();

        if (!canvas) return;

        canvas.calcOffset();
        canvas.requestRenderAll();
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      const width = containerEl.clientWidth;
      const height = containerEl.clientHeight;

      if (width <= 0 || height <= 0) return;

      onContainerResizeRef.current?.(width, height);
      updateCanvasPosition();
    });

    resizeObserver.observe(containerEl);

    window.addEventListener('resize', updateCanvasPosition);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasPosition);

      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame);
      }

      if (scrollUpdateFrameRef.current !== null) {
        cancelAnimationFrame(scrollUpdateFrameRef.current);
        scrollUpdateFrameRef.current = null;
      }

      if (typeof cleanup === 'function') {
        cleanup();
      }

      canvasHost.replaceChildren();
    };
  }, []);

  /*
   * Detect eraser state.
   */
  useEffect(() => {
    if (!canvasManager) return;

    const checkEraser = () => {
      const isDrawing = canvasManager.isDrawingMode();
      const settings = canvasManager.getBrushSettings();

      setIsEraserActive(
        isDrawing && settings.tool === 'eraser'
      );

      setEraserSize(settings.size || 20);
    };

    checkEraser();

    const unsubscribeMode =
      canvasManager.onDrawingModeChange(checkEraser);

    const unsubscribeSettings =
      canvasManager.onBrushSettingsChange((settings) => {
        setIsEraserActive(
          canvasManager.isDrawingMode() &&
          settings.tool === 'eraser'
        );

        setEraserSize(settings.size || 20);
      });

    return () => {
      unsubscribeMode();
      unsubscribeSettings();
    };
  }, [canvasManager]);

  /*
   * Apply zoom without rebuilding the canvas.
   */
  useEffect(() => {
    if (!canvasManager || typeof zoom !== 'number') return;

    const viewport = scrollViewportRef.current;
    const previousZoom = Math.max(previousZoomRef.current || zoom, 0.01);
    const zoomRatio = zoom / previousZoom;
    const previousCenterX = viewport
      ? viewport.scrollLeft + viewport.clientWidth / 2
      : 0;
    const previousCenterY = viewport
      ? viewport.scrollTop + viewport.clientHeight / 2
      : 0;

    canvasManager.setZoom(zoom);
    previousZoomRef.current = zoom;

    const frame = requestAnimationFrame(() => {
      const canvas = canvasManager.getCanvas();

      if (!canvas) return;

      if (viewport && Number.isFinite(zoomRatio) && zoomRatio > 0) {
        viewport.scrollLeft = Math.max(
          0,
          previousCenterX * zoomRatio - viewport.clientWidth / 2
        );
        viewport.scrollTop = Math.max(
          0,
          previousCenterY * zoomRatio - viewport.clientHeight / 2
        );
      }

      canvas.calcOffset();
      canvas.requestRenderAll();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [zoom, canvasManager]);

  /*
   * Ensure Fabric remains interactive.
   */
  useEffect(() => {
    if (!canvasManager) return;

    // Restore normal pointer mode and enforce non-draggable upper canvas
    canvasManager.enableSelectionMode();
    canvasManager.ensureUpperCanvasNonDraggable();
  }, [canvasManager]);

  /*
   * Keyboard navigation and shortcuts.
   */
  useEffect(() => {
    if (!canvasManager) return;

    let keyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let movedViaKeys = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement | null;

      if (
        targetElement instanceof HTMLInputElement ||
        targetElement instanceof HTMLTextAreaElement ||
        targetElement?.isContentEditable
      ) {
        return;
      }

      /* Hold Space to temporarily pan the zoomed artwork, Canva-style. */
      if (event.code === 'Space') {
        event.preventDefault();

        if (!isSpacePressedRef.current) {
          isSpacePressedRef.current = true;
          setIsSpacePressed(true);
        }

        return;
      }

      const canvas = canvasManager.getCanvas();

      if (!canvas) return;

      const activeObject = canvas.getActiveObject();

      /*
       * Do not run canvas shortcuts while editing text.
       */
      if (
        activeObject &&
        (activeObject as typeof activeObject & {
          isEditing?: boolean;
        }).isEditing
      ) {
        return;
      }

      const isMac =
        typeof navigator !== 'undefined' &&
        /Mac|iPod|iPhone|iPad/.test(navigator.platform);

      const isCtrlOrCmd = isMac
        ? event.metaKey
        : event.ctrlKey;

      /* Canva-style zoom keyboard shortcuts. */
      if (
        isCtrlOrCmd &&
        (event.key === '+' || event.key === '=')
      ) {
        event.preventDefault();

        if (setZoom) {
          setZoom(Math.min(Number((zoom + 0.1).toFixed(2)), 8));
        } else {
          canvasManager.zoomIn();
        }

        return;
      }

      if (
        isCtrlOrCmd &&
        (event.key === '-' || event.key === '_')
      ) {
        event.preventDefault();

        if (setZoom) {
          setZoom(Math.max(Number((zoom - 0.1).toFixed(2)), 0.1));
        } else {
          canvasManager.zoomOut();
        }

        return;
      }

      if (isCtrlOrCmd && event.key === '0') {
        event.preventDefault();

        if (setZoom) {
          setZoom(1);
        } else {
          canvasManager.resetZoom();
        }

        return;
      }

      /*
       * Group: Ctrl/Cmd + G
       */
      if (
        isCtrlOrCmd &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'g'
      ) {
        event.preventDefault();
        canvasManager.groupSelected();
        return;
      }

      /*
       * Ungroup: Ctrl/Cmd + Shift + G
       */
      if (
        isCtrlOrCmd &&
        event.shiftKey &&
        event.key.toLowerCase() === 'g'
      ) {
        event.preventDefault();
        canvasManager.ungroupSelected();
        return;
      }

      /*
       * Select all: Ctrl/Cmd + A
       */
      if (
        isCtrlOrCmd &&
        event.key.toLowerCase() === 'a'
      ) {
        event.preventDefault();
        canvasManager.selectAll();
        return;
      }

      /*
       * Duplicate: Ctrl/Cmd + D
       */
      if (
        isCtrlOrCmd &&
        event.key.toLowerCase() === 'd'
      ) {
        event.preventDefault();
        canvasManager.duplicateSelected();
        return;
      }

      /*
       * Delete selected object.
       */
      if (
        activeObject &&
        (event.key === 'Delete' || event.key === 'Backspace')
      ) {
        event.preventDefault();
        canvasManager.deleteSelected();
        return;
      }

      const isArrowKey =
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown';

      if (!activeObject || !isArrowKey) return;

      event.preventDefault();

      const step = event.shiftKey ? 10 : 1;
      const currentLeft = activeObject.left ?? 0;
      const currentTop = activeObject.top ?? 0;

      if (event.key === 'ArrowLeft') {
        activeObject.set('left', currentLeft - step);
      }

      if (event.key === 'ArrowRight') {
        activeObject.set('left', currentLeft + step);
      }

      if (event.key === 'ArrowUp') {
        activeObject.set('top', currentTop - step);
      }

      if (event.key === 'ArrowDown') {
        activeObject.set('top', currentTop + step);
      }

      activeObject.setCoords();
      canvas.requestRenderAll();

      movedViaKeys = true;

      if (keyDebounceTimer) {
        clearTimeout(keyDebounceTimer);
      }

      keyDebounceTimer = setTimeout(() => {
        if (!movedViaKeys) return;

        movedViaKeys = false;

        canvasManager.updateSelectedProperty(
          'left',
          activeObject.left
        );
      }, 300);
    };

    const stopTemporaryPan = () => {
      isSpacePressedRef.current = false;
      isViewportPanningRef.current = false;
      setIsSpacePressed(false);
      setIsViewportPanning(false);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      stopTemporaryPan();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', stopTemporaryPan);

    return () => {
      if (keyDebounceTimer) {
        clearTimeout(keyDebounceTimer);
      }

      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', stopTemporaryPan);
    };
  }, [canvasManager, setZoom, zoom]);

  /*
   * Save a Freepik image in Laravel storage.
   */
  const storeFreepikImage = useCallback(
    async (freepikId: string): Promise<string> => {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token')
          : null;

      const productIdFromUrl =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get(
            'productId'
          )
          : null;

      const activeProductId =
        productId || productIdFromUrl;

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const body: Record<string, unknown> = {};

      if (
        activeProductId &&
        activeProductId !== 'default'
      ) {
        body.product_id = activeProductId;
      }

      const response = await fetch(
        `${API_URL}/freepik/resources/${encodeURIComponent(
          freepikId
        )}/use`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ??
          'Could not store the Freepik image.'
        );
      }

      const responseData =
        result?.data?.data ?? result?.data;

      const storedImageUrl =
        responseData?.url ??
        responseData?.image_url ??
        responseData?.public_url ??
        responseData?.storage_url ??
        responseData?.local_url ??
        responseData?.asset?.url;

      if (
        typeof storedImageUrl !== 'string' ||
        !storedImageUrl.trim()
      ) {
        console.error(
          'Unexpected Freepik use response:',
          result
        );

        throw new Error(
          'Laravel did not return the stored Freepik image URL.'
        );
      }

      return makeAbsoluteStorageUrl(storedImageUrl);
    },
    [productId]
  );

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setDropError(null);

    if (!canvasManager) return;

    try {
      const freepikId =
        event.dataTransfer.getData(
          'application/x-freepik-id'
        );

      const fallbackFreepikUrl =
        event.dataTransfer.getData(
          'application/x-freepik-url'
        );

      let imageUrl =
        event.dataTransfer.getData('text/plain');

      /*
       * Copy Freepik asset into Laravel storage.
       */
      if (freepikId) {
        try {
          imageUrl = await storeFreepikImage(freepikId);
        } catch (storeError) {
          console.warn(
            'Could not store Freepik image. Using fallback URL:',
            storeError
          );

          if (fallbackFreepikUrl) {
            imageUrl = fallbackFreepikUrl;
          }
        }
      }

      /*
       * Support local image file drops.
       */
      if (
        !imageUrl &&
        event.dataTransfer.files?.length > 0
      ) {
        const file = event.dataTransfer.files[0];

        if (file.type.startsWith('image/')) {
          imageUrl = await new Promise<string>(
            (resolve, reject) => {
              const reader = new FileReader();

              reader.onload = () => {
                resolve(String(reader.result));
              };

              reader.onerror = () => {
                reject(
                  new Error(
                    'Could not read the selected image.'
                  )
                );
              };

              reader.readAsDataURL(file);
            }
          );
        }
      }

      const isSupportedImageUrl =
        imageUrl.startsWith('http://') ||
        imageUrl.startsWith('https://') ||
        imageUrl.startsWith('data:image/');

      if (!imageUrl || !isSupportedImageUrl) {
        throw new Error(
          'The dropped item is not a supported image.'
        );
      }

      const fabricCanvas = canvasManager.getCanvas();

      if (!fabricCanvas) {
        throw new Error('Canvas is not ready.');
      }

      const canvasWithPointerMethods =
        fabricCanvas as typeof fabricCanvas & {
          getScenePoint?: (
            event: Event
          ) => { x: number; y: number };

          getPointer?: (
            event: Event
          ) => { x: number; y: number };
        };

      const pointer =
        typeof canvasWithPointerMethods.getScenePoint ===
          'function'
          ? canvasWithPointerMethods.getScenePoint(
            event.nativeEvent
          )
          : canvasWithPointerMethods.getPointer?.(
            event.nativeEvent
          );

      if (pointer) {
        const targetFrame =
          canvasManager.getFrameUnderPoint(pointer);

        if (targetFrame) {
          await canvasManager.slotImageIntoFrame(
            targetFrame,
            imageUrl
          );

          return;
        }
      }

      await canvasManager.addImageFromUrl(imageUrl);

      const addedObject =
        fabricCanvas.getActiveObject() as
        | (ReturnType<
          typeof fabricCanvas.getActiveObject
        > & {
          provider?: string;
          providerAssetId?: string;
          sourceType?: string;
          originalSrc?: string;
          excludeFromExport?: boolean;
        })
        | null;

      if (addedObject) {
        /*
         * Every newly added image must remain selectable.
         */
        addedObject.set({
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
        });

        /*
         * Preserve Freepik metadata in Fabric JSON.
         */
        if (freepikId) {
          addedObject.set({
            provider: 'freepik',
            providerAssetId: freepikId,
            sourceType: 'freepik',
            originalSrc: imageUrl,
            excludeFromExport: false,
          });
        }

        addedObject.setCoords();
        fabricCanvas.setActiveObject(addedObject);
        fabricCanvas.requestRenderAll();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not add the image.';

      console.error('Image drop failed:', error);
      setDropError(message);
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseMove={(event) => {
        if (!isEraserActive) return;

        setMousePos({
          x: event.clientX,
          y: event.clientY,
          visible: true,
        });
      }}
      onMouseEnter={(event) => {
        if (!isEraserActive) return;

        setMousePos({
          x: event.clientX,
          y: event.clientY,
          visible: true,
        });
      }}
      onMouseLeave={() => {
        setMousePos((previous) => ({
          ...previous,
          visible: false,
        }));
      }}
      className="relative h-full w-full min-h-0 min-w-0 flex-1 select-none overflow-hidden bg-[#eef1f6] bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] bg-[length:20px_20px]"
    >
      {dropError && (
        <div className="absolute right-4 top-4 z-[80] max-w-sm rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 shadow-lg">
          {dropError}
        </div>
      )}

      <ContextualToolbar
        selected={selected}
        canvasManager={canvasManager ?? null}
        zoom={zoom}
        onSelectSidebarTab={onSelectSidebarTab}
        activeSidebarTab={activeSidebarTab}
      />

      {isEraserActive && mousePos.visible && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-600 bg-blue-500/15 shadow-xs"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            width: `${Math.max(
              eraserSize * zoom,
              8
            )}px`,
            height: `${Math.max(
              eraserSize * zoom,
              8
            )}px`,
          }}
        />
      )}

      <div
        ref={scrollViewportRef}
        className={`absolute inset-0 overflow-auto overscroll-contain ${isViewportPanning
            ? 'cursor-grabbing'
            : isSpacePressed
              ? 'cursor-grab'
              : ''
          }`}
        onScroll={() => {
          if (scrollUpdateFrameRef.current !== null) return;

          scrollUpdateFrameRef.current = requestAnimationFrame(() => {
            scrollUpdateFrameRef.current = null;
            canvasManagerRef.current?.getCanvas()?.calcOffset();
          });
        }}
        onWheel={(event) => {
          /* Shift + wheel scrolls horizontally, like Canva. */
          if (
            event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            Math.abs(event.deltaX) < Math.abs(event.deltaY)
          ) {
            event.preventDefault();
            event.currentTarget.scrollLeft += event.deltaY;
          }
        }}
        onPointerDownCapture={(event) => {
          const shouldPan =
            (isSpacePressedRef.current && event.button === 0) ||
            event.button === 1;

          if (!shouldPan) return;

          event.preventDefault();
          event.stopPropagation();

          isViewportPanningRef.current = true;
          setIsViewportPanning(true);
          panStartRef.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft,
            scrollTop: event.currentTarget.scrollTop,
          };

          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMoveCapture={(event) => {
          if (!isViewportPanningRef.current) return;

          event.preventDefault();
          event.stopPropagation();

          const start = panStartRef.current;
          event.currentTarget.scrollLeft =
            start.scrollLeft - (event.clientX - start.pointerX);
          event.currentTarget.scrollTop =
            start.scrollTop - (event.clientY - start.pointerY);
        }}
        onPointerUpCapture={(event) => {
          if (!isViewportPanningRef.current) return;

          event.preventDefault();
          event.stopPropagation();
          isViewportPanningRef.current = false;
          setIsViewportPanning(false);

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancelCapture={(event) => {
          isViewportPanningRef.current = false;
          setIsViewportPanning(false);

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <div className="flex min-h-full w-max min-w-full items-center justify-center p-4">
          <div className="relative shrink-0">
            {showRulers && dimensions && (
              <Ruler
                zoom={zoom}
                dimensions={dimensions}
                canvasManager={canvasManager ?? null}
                paperRef={paperRef}
                containerRef={containerRef}
                selected={selected}
                onUpdateDocumentSettings={
                  onUpdateDocumentSettings
                }
              />
            )}

            <div
              ref={paperRef}
              style={{
                marginTop: showRulers ? '24px' : '0px',
                marginLeft: showRulers ? '24px' : '0px',
              }}
              className="relative shrink-0 rounded-sm bg-white shadow-2xl ring-1 ring-black/15"
            >
              {/* Fabric owns only this container */}
              <div
                ref={canvasHostRef}
                className="relative z-0"
              />

              {/* React overlays remain outside the Fabric container */}
              {selected && (
                <ElementActionBar
                  selected={selected}
                  canvasManager={canvasManager ?? null}
                  zoom={zoom}
                />
              )}

              <div className="pointer-events-none">
                <RotationBadge
                  canvasManager={canvasManager ?? null}
                  selected={selected}
                  zoom={zoom}
                />
              </div>

              <div className="pointer-events-none">
                <ResizeBadge
                  canvasManager={canvasManager ?? null}
                  selected={selected}
                  zoom={zoom}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DesignerCanvas;
