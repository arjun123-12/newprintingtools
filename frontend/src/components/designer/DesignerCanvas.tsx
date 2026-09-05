'use client';

import {
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
  onUpdateDocumentSettings?: (settings: Partial<DocumentSettings>) => void;
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
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [eraserSize, setEraserSize] = useState(20);
  const [dropError, setDropError] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({
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

    const unsubMode = canvasManager.onDrawingModeChange(checkEraser);
    const unsubSettings = canvasManager.onBrushSettingsChange((settings) => {
      setIsEraserActive(
        canvasManager.isDrawingMode() && settings.tool === 'eraser'
      );
      setEraserSize(settings.size || 20);
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

    // Use a fresh canvas node per mount to avoid StrictMode initialization errors.
    const canvasEl = document.createElement('canvas');
    paperEl.replaceChildren(canvasEl);

    const containerW = containerEl.clientWidth;
    const containerH = containerEl.clientHeight;
    const cleanup = onCanvasReady?.(canvasEl, containerW, containerH);

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        const width = containerEl.clientWidth;
        const height = containerEl.clientHeight;

        if (width > 0 && height > 0) {
          onContainerResize?.(width, height);
        }
      });

      resizeObserver.observe(containerEl);
    }

    return () => {
      resizeObserver?.disconnect();

      if (typeof cleanup === 'function') {
        cleanup();
      }

      paperEl.replaceChildren();
    };
  }, [onCanvasReady, onContainerResize]);

  useEffect(() => {
    if (canvasManager && typeof zoom === 'number') {
      canvasManager.setZoom(zoom);
    }
  }, [zoom, canvasManager]);

  const storeFreepikImage = async (
    freepikId: string
  ): Promise<string> => {
    const token = localStorage.getItem('auth_token');
    const productIdFromUrl = new URLSearchParams(
      window.location.search
    ).get('productId');
    const activeProductId = productId || productIdFromUrl;

    if (!token) {
      throw new Error('Please log in again.');
    }

    if (!activeProductId || activeProductId === 'default') {
      throw new Error(
        'Please connect this design to a valid product first.'
      );
    }

    const response = await fetch(
      `${API_URL}/freepik/resources/${encodeURIComponent(freepikId)}/use`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: activeProductId,
        }),
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.message ?? 'Could not store the Freepik image.'
      );
    }

    const responseData = result?.data?.data ?? result?.data;
    const storedImageUrl =
      responseData?.url ??
      responseData?.image_url ??
      responseData?.public_url ??
      responseData?.storage_url ??
      responseData?.local_url ??
      responseData?.asset?.url;

    if (typeof storedImageUrl !== 'string' || !storedImageUrl.trim()) {
      console.error('Unexpected Freepik use response:', result);
      throw new Error(
        'Laravel did not return the stored Freepik image URL.'
      );
    }

    return makeAbsoluteStorageUrl(storedImageUrl);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropError(null);

    if (!canvasManager) return;

    try {
      const freepikId = event.dataTransfer.getData(
        'application/x-freepik-id'
      );

      let imageUrl = event.dataTransfer.getData('text/plain');

      // A Freepik asset must first be copied into our own Laravel storage.
      if (freepikId) {
        imageUrl = await storeFreepikImage(freepikId);
      }

      // Support images dropped directly from the user's computer.
      if (!imageUrl && event.dataTransfer.files?.length > 0) {
        const file = event.dataTransfer.files[0];

        if (file.type.startsWith('image/')) {
          imageUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => {
              reject(new Error('Could not read the selected image.'));
            };

            reader.readAsDataURL(file);
          });
        }
      }

      const isSupportedImageUrl =
        imageUrl.startsWith('http://') ||
        imageUrl.startsWith('https://') ||
        imageUrl.startsWith('data:image/');

      if (!imageUrl || !isSupportedImageUrl) {
        throw new Error('The dropped item is not a supported image.');
      }

      const fabricCanvas = canvasManager.getCanvas();

      if (!fabricCanvas) {
        throw new Error('Canvas is not ready.');
      }

      const pointer = (fabricCanvas as any).getScenePoint
        ? (fabricCanvas as any).getScenePoint(event.nativeEvent)
        : (fabricCanvas as any).getPointer(event.nativeEvent);

      if (pointer) {
        const targetFrame = canvasManager.getFrameUnderPoint(pointer);

        if (targetFrame) {
          await canvasManager.slotImageIntoFrame(targetFrame, imageUrl);
          return;
        }
      }

      await canvasManager.addImageFromUrl(imageUrl);

      // Preserve Freepik metadata in the Fabric canvas JSON.
      if (freepikId) {
        const addedObject = fabricCanvas.getActiveObject() as any;

        addedObject?.set({
          provider: 'freepik',
          providerAssetId: freepikId,
          sourceType: 'freepik',
          originalSrc: imageUrl,
          excludeFromExport: false,
        });

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
        if (isEraserActive) {
          setMousePos({
            x: event.clientX,
            y: event.clientY,
            visible: true,
          });
        }
      }}
      onMouseEnter={(event) => {
        if (isEraserActive) {
          setMousePos({
            x: event.clientX,
            y: event.clientY,
            visible: true,
          });
        }
      }}
      onMouseLeave={() => {
        setMousePos((previous) => ({
          ...previous,
          visible: false,
        }));
      }}
      className="relative flex h-full w-full min-h-0 min-w-0 flex-1 select-none items-center justify-center overflow-hidden bg-[#eef1f6] bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] bg-[length:20px_20px] p-4"
    >
      {dropError && (
        <div className="absolute right-4 top-4 z-[80] max-w-sm rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 shadow-lg">
          {dropError}
        </div>
      )}

      <ContextualToolbar
        selected={selected}
        canvasManager={canvasManager || null}
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
            width: `${Math.max(eraserSize * zoom, 8)}px`,
            height: `${Math.max(eraserSize * zoom, 8)}px`,
          }}
        />
      )}

      <div className="relative shrink-0">
        {showRulers && dimensions && (
          <Ruler
            zoom={zoom}
            dimensions={dimensions}
            canvasManager={canvasManager || null}
            paperRef={paperRef}
            containerRef={containerRef}
            selected={selected}
            onUpdateDocumentSettings={onUpdateDocumentSettings}
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
          {selected && (
            <ElementActionBar
              selected={selected}
              canvasManager={canvasManager || null}
              zoom={zoom}
            />
          )}

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
