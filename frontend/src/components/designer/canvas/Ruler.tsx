'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Trash2 } from 'lucide-react';
import {
  CanvasDimensions,
  DocumentSettings,
  SelectedObjectState,
} from '@/types/designer';
import { CanvasManager } from './CanvasManager';

const RULER_SIZE = 24;
const RULER_BACKGROUND = '#ffffff';
const RULER_BORDER = '#e2e8f0';
const TICK_MAJOR_COLOR = '#64748b';
const TICK_MEDIUM_COLOR = '#94a3b8';
const TICK_MINOR_COLOR = '#cbd5e1';
const LABEL_COLOR = '#475569';
const ACTIVE_COLOR = '#7d2ae8';

interface RulerProps {
  zoom: number;
  dimensions: CanvasDimensions;
  canvasManager: CanvasManager | null;
  paperRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewportRef?: React.RefObject<HTMLDivElement | null>;
  selected?: SelectedObjectState | null;
  onUpdateDocumentSettings?: (
    settings: Partial<DocumentSettings>
  ) => void;
}

interface Geometry {
  viewportWidth: number;
  viewportHeight: number;
  originX: number;
  originY: number;
  paperWidth: number;
  paperHeight: number;
}

interface DraggingGuide {
  orientation: 'horizontal' | 'vertical';
  viewportPosition: number;
  valueMm: number;
}

const INITIAL_GEOMETRY: Geometry = {
  viewportWidth: 0,
  viewportHeight: 0,
  originX: 0,
  originY: 0,
  paperWidth: 0,
  paperHeight: 0,
};

/**
 * Ruler spacing is internally calculated in centimeters,
 * but all displayed ruler values are converted to millimeters.
 */
function getRulerSteps(pxPerCm: number) {
  let majorStepCm = 5;
  let mediumStepCm = 1;
  let minorStepCm = 0.1;
  let showMinorTicks = true;

  if (pxPerCm >= 70) {
    majorStepCm = 1;
    mediumStepCm = 0.5;
    minorStepCm = 0.1;
    showMinorTicks = true;
  } else if (pxPerCm >= 35) {
    majorStepCm = 2;
    mediumStepCm = 1;
    minorStepCm = 0.2;
    showMinorTicks = true;
  } else if (pxPerCm >= 12) {
    majorStepCm = 5;
    mediumStepCm = 1;
    minorStepCm = 0.1;
    showMinorTicks = pxPerCm >= 18;
  } else if (pxPerCm >= 6) {
    majorStepCm = 10;
    mediumStepCm = 2;
    minorStepCm = 1;
    showMinorTicks = false;
  } else {
    majorStepCm = 20;
    mediumStepCm = 5;
    minorStepCm = 1;
    showMinorTicks = false;
  }

  return {
    majorStepCm,
    mediumStepCm,
    minorStepCm,
    showMinorTicks,
  };
}

export const Ruler: React.FC<RulerProps> = ({
  zoom,
  dimensions,
  canvasManager,
  paperRef,
  containerRef,
  viewportRef,
  selected = null,
  onUpdateDocumentSettings,
}) => {
  const horizontalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const verticalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const selectionAnimationFrameRef = useRef<number | null>(null);
  const cursorAnimationFrameRef = useRef<number | null>(null);

  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);

  const [geometry, setGeometry] =
    useState<Geometry>(INITIAL_GEOMETRY);

  const [cursor, setCursor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [draggingGuide, setDraggingGuide] =
    useState<DraggingGuide | null>(null);

  const [guideRevision, setGuideRevision] = useState(0);
  const [selectionRevision, setSelectionRevision] = useState(0);

  const widthMm = Math.max(dimensions.widthMm || 1, 1);
  const heightMm = Math.max(dimensions.heightMm || 1, 1);

  const widthPx = Math.max(dimensions.widthPx || 1, 1);
  const heightPx = Math.max(dimensions.heightPx || 1, 1);

  // User ruler guides live in Fabric/artwork coordinates, and the artwork
  // includes bleed on all four sides. widthPx/heightPx are trim-only.
  const bleedPx = Math.max(0, Number(dimensions.bleedPx) || 0);
  const artworkWidthPx = widthPx + bleedPx * 2;
  const artworkHeightPx = heightPx + bleedPx * 2;

  const readGeometry = useCallback(() => {
    const paper = paperRef.current;
    const viewport =
      viewportRef?.current ?? containerRef.current;

    if (!paper || !viewport) return;

    const paperRect = paper.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();

    const nextGeometry = {
      viewportWidth: Math.max(0, viewport.clientWidth),
      viewportHeight: Math.max(0, viewport.clientHeight),

      originX: paperRect.left - viewportRect.left,
      originY: paperRect.top - viewportRect.top,

      paperWidth: paperRect.width,
      paperHeight: paperRect.height,
    };

    setGeometry((previous) => {
      const unchanged =
        Math.abs(
          previous.viewportWidth -
          nextGeometry.viewportWidth
        ) < 0.25 &&
        Math.abs(
          previous.viewportHeight -
          nextGeometry.viewportHeight
        ) < 0.25 &&
        Math.abs(
          previous.originX - nextGeometry.originX
        ) < 0.25 &&
        Math.abs(
          previous.originY - nextGeometry.originY
        ) < 0.25 &&
        Math.abs(
          previous.paperWidth -
          nextGeometry.paperWidth
        ) < 0.25 &&
        Math.abs(
          previous.paperHeight -
          nextGeometry.paperHeight
        ) < 0.25;

      return unchanged ? previous : nextGeometry;
    });
  }, [containerRef, paperRef, viewportRef]);

  const scheduleGeometryRead = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    animationFrameRef.current =
      window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        readGeometry();
      });
  }, [readGeometry]);

  useEffect(() => {
    const viewport =
      viewportRef?.current ?? containerRef.current;

    const paper = paperRef.current;

    if (!viewport || !paper) return;

    readGeometry();

    const observer = new ResizeObserver(
      scheduleGeometryRead
    );

    observer.observe(viewport);
    observer.observe(paper);

    viewport.addEventListener(
      'scroll',
      scheduleGeometryRead,
      { passive: true }
    );

    window.addEventListener(
      'resize',
      scheduleGeometryRead
    );

    return () => {
      observer.disconnect();

      viewport.removeEventListener(
        'scroll',
        scheduleGeometryRead
      );

      window.removeEventListener(
        'resize',
        scheduleGeometryRead
      );

      if (
        animationFrameRef.current !== null
      ) {
        window.cancelAnimationFrame(
          animationFrameRef.current
        );

        animationFrameRef.current = null;
      }
    };
  }, [
    containerRef,
    paperRef,
    readGeometry,
    scheduleGeometryRead,
    viewportRef,
  ]);

  useEffect(() => {
    scheduleGeometryRead();
  }, [
    zoom,
    dimensions,
    scheduleGeometryRead,
  ]);

  useEffect(() => {
    const canvas =
      canvasManager?.getCanvas();

    if (!canvas) return;

    const refresh = () => {
      if (
        selectionAnimationFrameRef.current !==
        null
      ) {
        return;
      }

      selectionAnimationFrameRef.current =
        window.requestAnimationFrame(() => {
          selectionAnimationFrameRef.current =
            null;

          setSelectionRevision(
            (value) => value + 1
          );
        });
    };

    canvas.on(
      'selection:created',
      refresh
    );

    canvas.on(
      'selection:updated',
      refresh
    );

    canvas.on(
      'selection:cleared',
      refresh
    );

    canvas.on(
      'object:moving',
      refresh
    );

    canvas.on(
      'object:scaling',
      refresh
    );

    canvas.on(
      'object:rotating',
      refresh
    );

    canvas.on(
      'object:modified',
      refresh
    );

    return () => {
      canvas.off(
        'selection:created',
        refresh
      );

      canvas.off(
        'selection:updated',
        refresh
      );

      canvas.off(
        'selection:cleared',
        refresh
      );

      canvas.off(
        'object:moving',
        refresh
      );

      canvas.off(
        'object:scaling',
        refresh
      );

      canvas.off(
        'object:rotating',
        refresh
      );

      canvas.off(
        'object:modified',
        refresh
      );

      if (
        selectionAnimationFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          selectionAnimationFrameRef.current
        );

        selectionAnimationFrameRef.current =
          null;
      }
    };
  }, [canvasManager]);

  /**
   * RULER COORDINATE MODEL
   *
   * paperWidth/paperHeight are bleed-inclusive, while widthMm/heightMm are
   * trim dimensions. Ruler 0 must sit on the BLACK trim line, not on the
   * outer RED bleed edge.
   */
  const dpi = dimensions.dpi || 300;
  const bleedMm = (bleedPx / dpi) * 25.4;
  const artworkWidthMm = widthMm + bleedMm * 2;
  const artworkHeightMm = heightMm + bleedMm * 2;

  const xPxPerMm =
    geometry.paperWidth / Math.max(artworkWidthMm, 0.0001);

  const yPxPerMm =
    geometry.paperHeight / Math.max(artworkHeightMm, 0.0001);

  const trimOriginX =
    geometry.originX + bleedMm * xPxPerMm;

  const trimOriginY =
    geometry.originY + bleedMm * yPxPerMm;

  /**
   * Convert a Fabric/artwork coordinate to the ruler value.
   * Fabric 0 is the outer RED bleed edge; ruler 0 is the BLACK trim edge.
   */
  const canvasPxToRulerMm = useCallback(
    (canvasPx: number): number =>
      Number((((canvasPx - bleedPx) / dpi) * 25.4).toFixed(1)),
    [bleedPx, dpi]
  );

  /**
   * Pixels per centimeter.
   * Used internally for choosing ruler spacing.
   */
  const pxPerCmX =
    xPxPerMm * 10;

  const pxPerCmY =
    yPxPerMm * 10;

  const selectedBounds = useMemo(() => {
    const activeObject =
      canvasManager
        ?.getCanvas()
        ?.getActiveObject();

    const bounds =
      activeObject?.getBoundingRect();

    if (bounds) return bounds;

    if (!selected) return null;

    return {
      left: selected.left,
      top: selected.top,

      width:
        selected.width *
        (selected.scaleX || 1),

      height:
        selected.height *
        (selected.scaleY || 1),
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canvasManager,
    selected,
    selectionRevision,
  ]);

  const prepareCanvas = useCallback(
    (
      canvas: HTMLCanvasElement,
      cssWidth: number,
      cssHeight: number
    ) => {
      const dpr =
        window.devicePixelRatio || 1;

      const pixelWidth = Math.max(
        1,
        Math.round(cssWidth * dpr)
      );

      const pixelHeight = Math.max(
        1,
        Math.round(cssHeight * dpr)
      );

      if (
        canvas.width !== pixelWidth
      ) {
        canvas.width = pixelWidth;
      }

      if (
        canvas.height !== pixelHeight
      ) {
        canvas.height = pixelHeight;
      }

      const styleWidth =
        `${cssWidth}px`;

      const styleHeight =
        `${cssHeight}px`;

      if (
        canvas.style.width !==
        styleWidth
      ) {
        canvas.style.width =
          styleWidth;
      }

      if (
        canvas.style.height !==
        styleHeight
      ) {
        canvas.style.height =
          styleHeight;
      }

      const context =
        canvas.getContext('2d');

      if (!context) return null;

      context.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      context.clearRect(
        0,
        0,
        cssWidth,
        cssHeight
      );

      return context;
    },
    []
  );

  // ----------------------------------------------------
  // Draw Top Horizontal Ruler - MILLIMETERS
  // ----------------------------------------------------
  const drawHorizontalRuler =
    useCallback(() => {
      const canvas =
        horizontalCanvasRef.current;

      if (
        !canvas ||
        geometry.viewportWidth <= 0 ||
        xPxPerMm <= 0
      ) {
        return;
      }

      const ctx = prepareCanvas(
        canvas,
        geometry.viewportWidth,
        RULER_SIZE
      );

      if (!ctx) return;

      ctx.fillStyle =
        RULER_BACKGROUND;

      ctx.fillRect(
        0,
        0,
        geometry.viewportWidth,
        RULER_SIZE
      );

      // Bottom border
      ctx.strokeStyle =
        RULER_BORDER;

      ctx.lineWidth = 1;

      ctx.beginPath();

      ctx.moveTo(
        0,
        RULER_SIZE - 0.5
      );

      ctx.lineTo(
        geometry.viewportWidth,
        RULER_SIZE - 0.5
      );

      ctx.stroke();

      // Selected object highlight
      if (selectedBounds) {
        const scale =
          geometry.paperWidth /
          Math.max(artworkWidthPx, 1);

        const start =
          geometry.originX +
          selectedBounds.left *
          scale;

        const end =
          start +
          selectedBounds.width *
          scale;

        if (end > start) {
          ctx.fillStyle =
            'rgba(125, 42, 232, 0.12)';

          ctx.fillRect(
            start,
            0,
            end - start,
            RULER_SIZE - 1
          );

          ctx.strokeStyle =
            ACTIVE_COLOR;

          ctx.lineWidth = 1;

          ctx.beginPath();

          ctx.moveTo(
            Math.round(start) + 0.5,
            0
          );

          ctx.lineTo(
            Math.round(start) + 0.5,
            RULER_SIZE
          );

          ctx.moveTo(
            Math.round(end) - 0.5,
            0
          );

          ctx.lineTo(
            Math.round(end) - 0.5,
            RULER_SIZE
          );

          ctx.stroke();
        }
      }

      const totalMm = widthMm;

      const {
        majorStepCm,
        mediumStepCm,
        minorStepCm,
        showMinorTicks,
      } = getRulerSteps(pxPerCmX);

      const majorStepMm =
        majorStepCm * 10;

      const mediumStepMm =
        mediumStepCm * 10;

      const minorStepMm =
        minorStepCm * 10;

      // ------------------------------------------------
      // 1mm / minor ticks
      // ------------------------------------------------
      if (
        showMinorTicks &&
        minorStepMm > 0
      ) {
        ctx.strokeStyle =
          TICK_MINOR_COLOR;

        ctx.lineWidth = 1;

        ctx.beginPath();

        const numMinor = Math.round(
          totalMm / minorStepMm
        );

        for (
          let i = 0;
          i <= numMinor;
          i++
        ) {
          const mm =
            i * minorStepMm;

          if (
            Math.abs(
              mm % majorStepMm
            ) < 0.001
          ) {
            continue;
          }

          if (
            Math.abs(
              mm % mediumStepMm
            ) < 0.001
          ) {
            continue;
          }

          const x =
            Math.round(
              trimOriginX +
              mm * xPxPerMm
            ) + 0.5;

          if (
            x < -10 ||
            x >
            geometry.viewportWidth +
            10
          ) {
            continue;
          }

          ctx.moveTo(
            x,
            RULER_SIZE - 3.5
          );

          ctx.lineTo(
            x,
            RULER_SIZE
          );
        }

        ctx.stroke();
      }

      // ------------------------------------------------
      // 5mm ticks
      // ------------------------------------------------
      if (
        mediumStepMm <= 10 &&
        pxPerCmX >= 12
      ) {
        ctx.strokeStyle =
          TICK_MINOR_COLOR;

        ctx.lineWidth = 1;

        ctx.beginPath();

        const numMedium =
          Math.round(
            totalMm / mediumStepMm
          );

        for (
          let i = 0;
          i <= numMedium;
          i++
        ) {
          const mm =
            i * mediumStepMm;

          if (
            Math.abs(
              mm % majorStepMm
            ) < 0.001
          ) {
            continue;
          }

          const x =
            Math.round(
              trimOriginX +
              mm * xPxPerMm
            ) + 0.5;

          if (
            x < -10 ||
            x >
            geometry.viewportWidth +
            10
          ) {
            continue;
          }

          ctx.moveTo(
            x,
            RULER_SIZE - 5
          );

          ctx.lineTo(
            x,
            RULER_SIZE
          );
        }

        ctx.stroke();
      }

      // ------------------------------------------------
      // Medium ticks
      // ------------------------------------------------
      ctx.strokeStyle =
        TICK_MEDIUM_COLOR;

      ctx.lineWidth = 1;

      ctx.beginPath();

      const numMedium =
        Math.round(
          totalMm / mediumStepMm
        );

      for (
        let i = 0;
        i <= numMedium;
        i++
      ) {
        const mm =
          i * mediumStepMm;

        if (
          Math.abs(
            mm % majorStepMm
          ) < 0.001
        ) {
          continue;
        }

        const x =
          Math.round(
            trimOriginX +
            mm * xPxPerMm
          ) + 0.5;

        if (
          x < -10 ||
          x >
          geometry.viewportWidth +
          10
        ) {
          continue;
        }

        ctx.moveTo(
          x,
          RULER_SIZE - 6.5
        );

        ctx.lineTo(
          x,
          RULER_SIZE
        );
      }

      ctx.stroke();

      // ------------------------------------------------
      // Major ticks
      // ------------------------------------------------
      ctx.strokeStyle =
        TICK_MAJOR_COLOR;

      ctx.lineWidth = 1;

      ctx.beginPath();

      const numMajor =
        Math.floor(
          totalMm / majorStepMm
        );

      for (
        let i = 0;
        i <= numMajor;
        i++
      ) {
        const mm =
          i * majorStepMm;

        const x =
          Math.round(
            trimOriginX +
            mm * xPxPerMm
          ) + 0.5;

        if (
          x < -10 ||
          x >
          geometry.viewportWidth +
          10
        ) {
          continue;
        }

        ctx.moveTo(
          x,
          RULER_SIZE - 10
        );

        ctx.lineTo(
          x,
          RULER_SIZE
        );
      }

      ctx.stroke();

      // Page boundaries
      ctx.strokeStyle =
        TICK_MAJOR_COLOR;

      ctx.lineWidth = 1;

      ctx.beginPath();

      const x0 =
        Math.round(
          geometry.originX
        ) + 0.5;

      ctx.moveTo(
        x0,
        0
      );

      ctx.lineTo(
        x0,
        RULER_SIZE
      );

      const xEnd =
        Math.round(
          geometry.originX +
          geometry.paperWidth
        ) + 0.5;

      ctx.moveTo(
        xEnd,
        0
      );

      ctx.lineTo(
        xEnd,
        RULER_SIZE
      );

      ctx.stroke();

      // ------------------------------------------------
      // MM labels
      // ------------------------------------------------
      ctx.font =
        '500 10px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      ctx.fillStyle =
        LABEL_COLOR;

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'top';

      for (
        let i = 0;
        i <= numMajor;
        i++
      ) {
        const mm =
          i * majorStepMm;

        const x =
          trimOriginX +
          mm * xPxPerMm;

        if (
          x < -20 ||
          x >
          geometry.viewportWidth +
          20
        ) {
          continue;
        }

        ctx.fillText(
          `${mm}`,
          x,
          2
        );
      }

      // Cursor
      if (cursor) {
        ctx.strokeStyle =
          ACTIVE_COLOR;

        ctx.lineWidth = 1.5;

        ctx.beginPath();

        ctx.moveTo(
          cursor.x + 0.5,
          0
        );

        ctx.lineTo(
          cursor.x + 0.5,
          RULER_SIZE
        );

        ctx.stroke();
      }
    },
      [
        cursor,
        geometry,
        prepareCanvas,
        pxPerCmX,
        selectedBounds,
        widthMm,
        artworkWidthPx,
        trimOriginX,
        xPxPerMm,
        canvasPxToRulerMm,
      ]
    );

  // ----------------------------------------------------
  // Draw Left Vertical Ruler - MILLIMETERS
  // ----------------------------------------------------
  const drawVerticalRuler =
    useCallback(() => {
      const canvas =
        verticalCanvasRef.current;

      if (
        !canvas ||
        geometry.viewportHeight <= 0 ||
        yPxPerMm <= 0
      ) {
        return;
      }

      const ctx = prepareCanvas(
        canvas,
        RULER_SIZE,
        geometry.viewportHeight
      );

      if (!ctx) return;

      ctx.fillStyle =
        RULER_BACKGROUND;

      ctx.fillRect(
        0,
        0,
        RULER_SIZE,
        geometry.viewportHeight
      );

      // Right border
      ctx.strokeStyle =
        RULER_BORDER;

      ctx.lineWidth = 1;

      ctx.beginPath();

      ctx.moveTo(
        RULER_SIZE - 0.5,
        0
      );

      ctx.lineTo(
        RULER_SIZE - 0.5,
        geometry.viewportHeight
      );

      ctx.stroke();

      // Selected object highlight
      if (selectedBounds) {
        const scale =
          geometry.paperHeight /
          Math.max(artworkHeightPx, 1);

        const start =
          geometry.originY +
          selectedBounds.top *
          scale;

        const end =
          start +
          selectedBounds.height *
          scale;

        if (end > start) {
          ctx.fillStyle =
            'rgba(125, 42, 232, 0.12)';

          ctx.fillRect(
            0,
            start,
            RULER_SIZE - 1,
            end - start
          );

          ctx.strokeStyle =
            ACTIVE_COLOR;

          ctx.lineWidth = 1;

          ctx.beginPath();

          ctx.moveTo(
            0,
            Math.round(start) + 0.5
          );

          ctx.lineTo(
            RULER_SIZE,
            Math.round(start) + 0.5
          );

          ctx.moveTo(
            0,
            Math.round(end) - 0.5
          );

          ctx.lineTo(
            RULER_SIZE,
            Math.round(end) - 0.5
          );

          ctx.stroke();
        }
      }

      const totalMm =
        heightMm;

      const {
        majorStepCm,
        mediumStepCm,
        minorStepCm,
        showMinorTicks,
      } = getRulerSteps(pxPerCmY);

      const majorStepMm =
        majorStepCm * 10;

      const mediumStepMm =
        mediumStepCm * 10;

      const minorStepMm =
        minorStepCm * 10;

      // Minor ticks
      if (
        showMinorTicks &&
        minorStepMm > 0
      ) {
        ctx.strokeStyle =
          TICK_MINOR_COLOR;

        ctx.lineWidth = 1;

        ctx.beginPath();

        const numMinor =
          Math.round(
            totalMm / minorStepMm
          );

        for (
          let i = 0;
          i <= numMinor;
          i++
        ) {
          const mm =
            i * minorStepMm;

          if (
            Math.abs(
              mm % majorStepMm
            ) < 0.001
          ) {
            continue;
          }

          if (
            Math.abs(
              mm % mediumStepMm
            ) < 0.001
          ) {
            continue;
          }

          const y =
            Math.round(
              trimOriginY +
              mm * yPxPerMm
            ) + 0.5;

          if (
            y < -10 ||
            y >
            geometry.viewportHeight +
            10
          ) {
            continue;
          }

          ctx.moveTo(
            RULER_SIZE - 3.5,
            y
          );

          ctx.lineTo(
            RULER_SIZE,
            y
          );
        }

        ctx.stroke();
      }

      // Medium ticks
      if (
        mediumStepMm <= 10 &&
        pxPerCmY >= 12
      ) {
        ctx.strokeStyle =
          TICK_MINOR_COLOR;

        ctx.lineWidth = 1;

        ctx.beginPath();

        const numMedium =
          Math.round(
            totalMm / mediumStepMm
          );

        for (
          let i = 0;
          i <= numMedium;
          i++
        ) {
          const mm =
            i * mediumStepMm;

          if (
            Math.abs(
              mm % majorStepMm
            ) < 0.001
          ) {
            continue;
          }

          const y =
            Math.round(
              trimOriginY +
              mm * yPxPerMm
            ) + 0.5;

          if (
            y < -10 ||
            y >
            geometry.viewportHeight +
            10
          ) {
            continue;
          }

          ctx.moveTo(
            RULER_SIZE - 5,
            y
          );

          ctx.lineTo(
            RULER_SIZE,
            y
          );
        }

        ctx.stroke();
      }

      // Medium ticks
      ctx.strokeStyle =
        TICK_MEDIUM_COLOR;

      ctx.lineWidth = 1;

      ctx.beginPath();

      const numMedium =
        Math.round(
          totalMm / mediumStepMm
        );

      for (
        let i = 0;
        i <= numMedium;
        i++
      ) {
        const mm =
          i * mediumStepMm;

        if (
          Math.abs(
            mm % majorStepMm
          ) < 0.001
        ) {
          continue;
        }

        const y =
          Math.round(
            trimOriginY +
            mm * yPxPerMm
          ) + 0.5;

        if (
          y < -10 ||
          y >
          geometry.viewportHeight +
          10
        ) {
          continue;
        }

        ctx.moveTo(
          RULER_SIZE - 6.5,
          y
        );

        ctx.lineTo(
          RULER_SIZE,
          y
        );
      }

      ctx.stroke();

      // Major ticks
      ctx.strokeStyle =
        TICK_MAJOR_COLOR;

      ctx.lineWidth = 1;

      ctx.beginPath();

      const numMajor =
        Math.floor(
          totalMm / majorStepMm
        );

      for (
        let i = 0;
        i <= numMajor;
        i++
      ) {
        const mm =
          i * majorStepMm;

        const y =
          Math.round(
            trimOriginY +
            mm * yPxPerMm
          ) + 0.5;

        if (
          y < -10 ||
          y >
          geometry.viewportHeight +
          10
        ) {
          continue;
        }

        ctx.moveTo(
          RULER_SIZE - 10,
          y
        );

        ctx.lineTo(
          RULER_SIZE,
          y
        );
      }

      ctx.stroke();

      // Page boundaries
      ctx.strokeStyle =
        TICK_MAJOR_COLOR;

      ctx.lineWidth = 1;

      ctx.beginPath();

      const y0 =
        Math.round(
          geometry.originY
        ) + 0.5;

      ctx.moveTo(
        0,
        y0
      );

      ctx.lineTo(
        RULER_SIZE,
        y0
      );

      const yEnd =
        Math.round(
          geometry.originY +
          geometry.paperHeight
        ) + 0.5;

      ctx.moveTo(
        0,
        yEnd
      );

      ctx.lineTo(
        RULER_SIZE,
        yEnd
      );

      ctx.stroke();

      // ------------------------------------------------
      // MM labels
      // ------------------------------------------------
      ctx.font =
        '500 10px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      ctx.fillStyle =
        LABEL_COLOR;

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'middle';

      for (
        let i = 0;
        i <= numMajor;
        i++
      ) {
        const mm =
          i * majorStepMm;

        const y =
          trimOriginY +
          mm * yPxPerMm;

        if (
          y < -20 ||
          y >
          geometry.viewportHeight +
          20
        ) {
          continue;
        }

        ctx.save();

        ctx.translate(
          8,
          y
        );

        ctx.rotate(
          -Math.PI / 2
        );

        ctx.fillText(
          `${mm}`,
          0,
          0
        );

        ctx.restore();
      }

      // Cursor
      if (cursor) {
        ctx.strokeStyle =
          ACTIVE_COLOR;

        ctx.lineWidth = 1.5;

        ctx.beginPath();

        ctx.moveTo(
          0,
          cursor.y + 0.5
        );

        ctx.lineTo(
          RULER_SIZE,
          cursor.y + 0.5
        );

        ctx.stroke();
      }
    },
      [
        cursor,
        geometry,
        heightMm,
        artworkHeightPx,
        trimOriginY,
        prepareCanvas,
        pxPerCmY,
        selectedBounds,
        yPxPerMm,
        canvasPxToRulerMm,
      ]
    );

  useEffect(() => {
    drawHorizontalRuler();
    drawVerticalRuler();
  }, [
    drawHorizontalRuler,
    drawVerticalRuler,
  ]);

  // ----------------------------------------------------
  // Cursor tracking
  // ----------------------------------------------------
  useEffect(() => {
    const viewport =
      viewportRef?.current ??
      containerRef.current;

    if (!viewport) return;

    const handlePointerMove = (
      event: PointerEvent
    ) => {
      const rect =
        viewport.getBoundingClientRect();

      pendingCursorRef.current = {
        x:
          event.clientX -
          rect.left,

        y:
          event.clientY -
          rect.top,
      };

      if (
        cursorAnimationFrameRef.current !==
        null
      ) {
        return;
      }

      cursorAnimationFrameRef.current =
        window.requestAnimationFrame(() => {
          cursorAnimationFrameRef.current =
            null;

          if (
            pendingCursorRef.current
          ) {
            setCursor(
              pendingCursorRef.current
            );

            pendingCursorRef.current =
              null;
          }
        });
    };

    const handlePointerLeave = () => {
      pendingCursorRef.current = null;

      if (
        cursorAnimationFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          cursorAnimationFrameRef.current
        );

        cursorAnimationFrameRef.current =
          null;
      }

      setCursor(null);
    };

    viewport.addEventListener(
      'pointermove',
      handlePointerMove
    );

    viewport.addEventListener(
      'pointerleave',
      handlePointerLeave
    );

    return () => {
      viewport.removeEventListener(
        'pointermove',
        handlePointerMove
      );

      viewport.removeEventListener(
        'pointerleave',
        handlePointerLeave
      );

      if (
        cursorAnimationFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          cursorAnimationFrameRef.current
        );

        cursorAnimationFrameRef.current =
          null;
      }
    };
  }, [
    containerRef,
    viewportRef,
  ]);

  // ----------------------------------------------------
  // Guide dragging
  // ----------------------------------------------------
  const startGuideDrag = (
    orientation:
      | 'horizontal'
      | 'vertical',
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const viewport =
      viewportRef?.current ??
      containerRef.current;

    const paper =
      paperRef.current;

    if (!viewport || !paper) return;

    const update = (
      clientX: number,
      clientY: number
    ) => {
      const viewportRect =
        viewport.getBoundingClientRect();

      const paperRect =
        paper.getBoundingClientRect();

      const viewportPosition =
        orientation === 'horizontal'
          ? clientY -
          viewportRect.top
          : clientX -
          viewportRect.left;

      const paperPosition =
        orientation === 'horizontal'
          ? clientY -
          paperRect.top
          : clientX -
          paperRect.left;

      // Convert the pointer into the exact Fabric/artwork coordinate first,
      // then use the same ruler conversion used by existing guides.
      const canvasPosition =
        orientation === 'horizontal'
          ? paperPosition *
          (artworkHeightPx / Math.max(paperRect.height, 1))
          : paperPosition *
          (artworkWidthPx / Math.max(paperRect.width, 1));

      const mm = canvasPxToRulerMm(canvasPosition);

      setDraggingGuide({
        orientation,
        viewportPosition,
        valueMm:
          Number(mm.toFixed(1)),
      });
    };

    update(
      event.clientX,
      event.clientY
    );

    const handleMove = (
      moveEvent: PointerEvent
    ) =>
      update(
        moveEvent.clientX,
        moveEvent.clientY
      );

    const handleUp = (
      upEvent: PointerEvent
    ) => {
      window.removeEventListener(
        'pointermove',
        handleMove
      );

      window.removeEventListener(
        'pointerup',
        handleUp
      );

      const paperRect =
        paper.getBoundingClientRect();

      const screenPosition =
        orientation === 'horizontal'
          ? upEvent.clientY -
          paperRect.top
          : upEvent.clientX -
          paperRect.left;

      // FIRST-CREATE FIX:
      // Convert pointer against the complete bleed-inclusive artwork.
      // Previously this used trim-only widthPx/heightPx, so the temporary
      // line looked correct but jumped to a different position on release.
      const canvasPosition =
        orientation === 'horizontal'
          ? screenPosition *
          (artworkHeightPx / Math.max(paperRect.height, 1))
          : screenPosition *
          (artworkWidthPx / Math.max(paperRect.width, 1));

      const maximum =
        orientation === 'horizontal'
          ? artworkHeightPx
          : artworkWidthPx;

      if (
        canvasPosition >= 0 &&
        canvasPosition <= maximum
      ) {
        canvasManager?.addUserGuide(
          orientation,
          Math.round(canvasPosition)
        );

        setGuideRevision(
          (value) => value + 1
        );
      }

      setDraggingGuide(null);
    };

    window.addEventListener(
      'pointermove',
      handleMove
    );

    window.addEventListener(
      'pointerup',
      handleUp,
      { once: true }
    );
  };

  const startExistingGuideDrag = (
    guide: {
      id: string;
      orientation: 'horizontal' | 'vertical';
      posPx: number;
    },
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const viewport = viewportRef?.current ?? containerRef.current;
    const paper = paperRef.current;
    if (!viewport || !paper) return;

    const originalPosPx = guide.posPx;
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    let latestCanvasPosition = originalPosPx;
    let isInsideArtwork = true;
    let hasDragged = false;

    const update = (clientX: number, clientY: number) => {
      const viewportRect = viewport.getBoundingClientRect();
      const paperRect = paper.getBoundingClientRect();

      const screenPosition =
        guide.orientation === 'horizontal'
          ? clientY - paperRect.top
          : clientX - paperRect.left;

      latestCanvasPosition =
        guide.orientation === 'horizontal'
          ? screenPosition *
          (artworkHeightPx / Math.max(paperRect.height, 1))
          : screenPosition *
          (artworkWidthPx / Math.max(paperRect.width, 1));

      const maximum =
        guide.orientation === 'horizontal'
          ? artworkHeightPx
          : artworkWidthPx;

      isInsideArtwork =
        latestCanvasPosition >= 0 &&
        latestCanvasPosition <= maximum;

      const valueMm = canvasPxToRulerMm(latestCanvasPosition);

      setDraggingGuide({
        orientation: guide.orientation,
        viewportPosition:
          guide.orientation === 'horizontal'
            ? clientY - viewportRect.top
            : clientX - viewportRect.left,
        valueMm,
      });

      if (isInsideArtwork) {
        canvasManager?.updateUserGuide(
          guide.id,
          Number(latestCanvasPosition.toFixed(2))
        );
      }
    };

    function handleMove(moveEvent: PointerEvent) {
      moveEvent.preventDefault();

      // Do not start a drag on an ordinary click/double-click.
      // This keeps the guide stable and lets onDoubleClick delete it reliably.
      if (!hasDragged) {
        const dx = moveEvent.clientX - startClientX;
        const dy = moveEvent.clientY - startClientY;
        if (Math.hypot(dx, dy) < 3) return;
        hasDragged = true;
      }

      update(moveEvent.clientX, moveEvent.clientY);
    }

    function cleanup() {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      setDraggingGuide(null);
      if (hasDragged) {
        setGuideRevision((value) => value + 1);
      }
    }

    function handleUp(upEvent: PointerEvent) {
      if (hasDragged) {
        update(upEvent.clientX, upEvent.clientY);

        if (isInsideArtwork) {
          canvasManager?.updateUserGuide(
            guide.id,
            Number(latestCanvasPosition.toFixed(2))
          );
        } else {
          canvasManager?.removeUserGuide(guide.id);
        }
      }

      cleanup();
    }

    function handleCancel() {
      if (hasDragged) {
        canvasManager?.updateUserGuide(guide.id, originalPosPx);
      }
      cleanup();
    }

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp, { once: true });
    window.addEventListener('pointercancel', handleCancel, { once: true });
  };

  const userGuides = useMemo(
    () =>
      canvasManager?.getUserGuides?.() ??
      [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasManager, guideRevision]
  );

  const clearGuides = () => {
    canvasManager?.clearUserGuides?.();

    setGuideRevision(
      (value) => value + 1
    );
  };

  // Kept for API compatibility with DesignerCanvas. Safe-area settings are
  // intentionally fixed here and are not editable from the ruler overlay.
  void onUpdateDocumentSettings;

  return (
    <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
      {/* Page framing guidelines */}
      {geometry.originX > 0 && (
        <>
          <div
            className="pointer-events-none absolute top-6 bottom-0 w-px bg-slate-300/40"
            style={{
              left:
                `${geometry.originX}px`,
            }}
          />

          <div
            className="pointer-events-none absolute top-6 bottom-0 w-px bg-slate-300/40"
            style={{
              left:
                `${geometry.originX + geometry.paperWidth}px`,
            }}
          />
        </>
      )}

      {geometry.originY > 0 && (
        <>
          <div
            className="pointer-events-none absolute left-6 right-0 h-px bg-slate-300/40"
            style={{
              top:
                `${geometry.originY}px`,
            }}
          />

          <div
            className="pointer-events-none absolute left-6 right-0 h-px bg-slate-300/40"
            style={{
              top:
                `${geometry.originY + geometry.paperHeight}px`,
            }}
          />
        </>
      )}

      {/* Hit areas for existing purple ruler guides. Their visible dashed
          lines are painted by CanvasGuides; these overlays add interaction. */}
      {userGuides.map((guide) =>
        guide.orientation === 'horizontal' ? (
          <div
            key={guide.id}
            className="group pointer-events-auto absolute z-30 h-3 -translate-y-1/2 cursor-row-resize touch-none"
            style={{
              left: `${geometry.originX}px`,
              top: `${geometry.originY +
                guide.posPx * (geometry.paperHeight / Math.max(artworkHeightPx, 1))
                }px`,
              width: `${geometry.paperWidth}px`,
            }}
            onPointerDown={(event) => startExistingGuideDrag(guide, event)}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              canvasManager?.removeUserGuide(guide.id);
              setGuideRevision((value) => value + 1);
            }}
            title={`${canvasPxToRulerMm(guide.posPx)} mm — drag to move, double-click to delete`}
          >
            {/* Visible guide is rendered once by CanvasGuides.
                This div is only the invisible drag/delete hit area. */}
          </div>
        ) : (
          <div
            key={guide.id}
            className="group pointer-events-auto absolute z-30 w-3 -translate-x-1/2 cursor-col-resize touch-none"
            style={{
              left: `${geometry.originX +
                guide.posPx * (geometry.paperWidth / Math.max(artworkWidthPx, 1))
                }px`,
              top: `${geometry.originY}px`,
              height: `${geometry.paperHeight}px`,
            }}
            onPointerDown={(event) => startExistingGuideDrag(guide, event)}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              canvasManager?.removeUserGuide(guide.id);
              setGuideRevision((value) => value + 1);
            }}
            title={`${canvasPxToRulerMm(guide.posPx)} mm — drag to move, double-click to delete`}
          >
            {/* Visible guide is rendered once by CanvasGuides.
                This div is only the invisible drag/delete hit area. */}
          </div>
        )
      )}

      {/* Top Horizontal Ruler */}
      <div
        className="pointer-events-auto absolute left-0 right-0 top-0 h-6 cursor-row-resize select-none"
        onPointerDown={(event) =>
          startGuideDrag(
            'horizontal',
            event
          )
        }
        title="Drag down to add a horizontal guide"
      >
        <canvas
          ref={horizontalCanvasRef}
          className="block"
        />
      </div>

      {/* Left Vertical Ruler */}
      <div
        className="pointer-events-auto absolute bottom-0 left-0 top-0 w-6 cursor-col-resize select-none"
        onPointerDown={(event) =>
          startGuideDrag(
            'vertical',
            event
          )
        }
        title="Drag right to add a vertical guide"
      >
        <canvas
          ref={verticalCanvasRef}
          className="block"
        />
      </div>

      {/* Top-left corner */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-6 w-6 border-b border-r border-[#e2e8f0] bg-white" />

      {/* Clear Guides */}
      {userGuides.length > 0 && (
        <button
          type="button"
          onClick={clearGuides}
          className="pointer-events-auto absolute bottom-3 left-8 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-xs hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Remove all ruler guides"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear guides
        </button>
      )}

      {/* Interactive Guide Dragging */}
      {draggingGuide && (
        <div
          className="pointer-events-none absolute z-50"
          style={
            draggingGuide.orientation ===
              'horizontal'
              ? {
                left: 0,
                right: 0,
                top: `${draggingGuide.viewportPosition}px`,
                borderTop:
                  `1px solid ${ACTIVE_COLOR}`,
              }
              : {
                top: 0,
                bottom: 0,
                left: `${draggingGuide.viewportPosition}px`,
                borderLeft:
                  `1px solid ${ACTIVE_COLOR}`,
              }
          }
        >
          <span
            className="absolute rounded bg-[#22242a] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white shadow-md select-none"
            style={
              draggingGuide.orientation ===
                'horizontal'
                ? {
                  left:
                    `${Math.max(
                      geometry.originX + 12,
                      32
                    )}px`,
                  top: '4px',
                }
                : {
                  top:
                    `${Math.max(
                      geometry.originY + 12,
                      32
                    )}px`,
                  left: '4px',
                }
            }
          >
            {draggingGuide.valueMm.toFixed(1)} mm
          </span>
        </div>
      )}
    </div>
  );
};

export default Ruler;
