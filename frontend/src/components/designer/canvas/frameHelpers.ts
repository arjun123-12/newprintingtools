import {
  Circle,
  Rect,
  Polygon,
  Path,
  Point,
  FabricObject,
} from 'fabric';
import { FrameShapeType } from '@/types/designer';
import { CANVA_FRAME_PLACEHOLDER_SVG, FRAME_PRESETS } from '../data/framesData';

/**
 * Generates a centered Fabric.js clipPath for any Canva frame shape.
 *
 * @param shape The FrameShapeType to build
 * @param width Content width in px
 * @param height Content height in px
 */
export function createFrameClipPath(
  shape: FrameShapeType,
  width: number,
  height: number
): FabricObject {
  const minDim = Math.min(width, height);
  const w = width;
  const h = height;

  switch (shape) {
    case 'circle':
      return new Circle({
        radius: minDim / 2,
        originX: 'center',
        originY: 'center',
      });

    case 'square':
      return new Rect({
        width: minDim,
        height: minDim,
        originX: 'center',
        originY: 'center',
      });

    case 'rounded-rect':
      return new Rect({
        width: w,
        height: h,
        rx: minDim * 0.12,
        ry: minDim * 0.12,
        originX: 'center',
        originY: 'center',
      });

    case 'squircle':
      return new Rect({
        width: w,
        height: h,
        rx: minDim * 0.28,
        ry: minDim * 0.28,
        originX: 'center',
        originY: 'center',
      });

    case 'pill':
      return new Rect({
        width: w,
        height: h,
        rx: minDim / 2,
        ry: minDim / 2,
        originX: 'center',
        originY: 'center',
      });

    case 'oval': {
      // Stretched circle
      return new Circle({
        radius: minDim / 2,
        scaleX: w / minDim,
        scaleY: h / minDim,
        originX: 'center',
        originY: 'center',
      });
    }

    case 'arch': {
      // Canva Arch window: straight bottom, arched top
      const r = w / 2;
      const topH = r;
      const bottomH = Math.max(h - topH, 0);
      const halfW = w / 2;
      const halfH = h / 2;

      // SVG path centered around (0, 0)
      const pathStr = `M ${-halfW} ${halfH} L ${-halfW} ${halfH - bottomH} A ${r} ${r} 0 0 1 ${halfW} ${halfH - bottomH} L ${halfW} ${halfH} Z`;
      return new Path(pathStr, {
        originX: 'center',
        originY: 'center',
      });
    }

    case 'heart': {
      // Centered 10-point heart polygon normalized to (w, h)
      const sX = w / 260;
      const sY = h / 260;
      return new Polygon(
        [
          new Point(0, -90 * sY),
          new Point(50 * sX, -135 * sY),
          new Point(105 * sX, -115 * sY),
          new Point(125 * sX, -50 * sY),
          new Point(105 * sX, 15 * sY),
          new Point(0, 125 * sY),
          new Point(-105 * sX, 15 * sY),
          new Point(-125 * sX, -50 * sY),
          new Point(-105 * sX, -115 * sY),
          new Point(-50 * sX, -135 * sY),
        ],
        {
          originX: 'center',
          originY: 'center',
        }
      );
    }

    case 'star': {
      // 5-point star normalized around center
      const s = minDim / 240;
      return new Polygon(
        [
          new Point(0 * s, -110 * s),
          new Point(32 * s, -32 * s),
          new Point(115 * s, -32 * s),
          new Point(46 * s, 20 * s),
          new Point(72 * s, 102 * s),
          new Point(0 * s, 50 * s),
          new Point(-72 * s, 102 * s),
          new Point(-46 * s, 20 * s),
          new Point(-115 * s, -32 * s),
          new Point(-32 * s, -32 * s),
        ],
        {
          originX: 'center',
          originY: 'center',
        }
      );
    }

    case 'hexagon': {
      const s = minDim / 240;
      return new Polygon(
        [
          new Point(0 * s, -115 * s),
          new Point(100 * s, -58 * s),
          new Point(100 * s, 58 * s),
          new Point(0 * s, 115 * s),
          new Point(-100 * s, 58 * s),
          new Point(-100 * s, -58 * s),
        ],
        {
          originX: 'center',
          originY: 'center',
        }
      );
    }

    case 'octagon': {
      const s = minDim / 240;
      return new Polygon(
        [
          new Point(-45 * s, -110 * s),
          new Point(45 * s, -110 * s),
          new Point(110 * s, -45 * s),
          new Point(110 * s, 45 * s),
          new Point(45 * s, 110 * s),
          new Point(-45 * s, 110 * s),
          new Point(-110 * s, 45 * s),
          new Point(-110 * s, -45 * s),
        ],
        {
          originX: 'center',
          originY: 'center',
        }
      );
    }

    case 'diamond': {
      const halfW = w / 2;
      const halfH = h / 2;
      return new Polygon(
        [
          new Point(0, -halfH),
          new Point(halfW, 0),
          new Point(0, halfH),
          new Point(-halfW, 0),
        ],
        {
          originX: 'center',
          originY: 'center',
        }
      );
    }

    case 'triangle': {
      const halfW = w / 2;
      const halfH = h / 2;
      return new Polygon(
        [
          new Point(0, -halfH),
          new Point(halfW, halfH),
          new Point(-halfW, halfH),
        ],
        {
          originX: 'center',
          originY: 'center',
        }
      );
    }

    case 'shield': {
      const halfW = w / 2;
      const halfH = h / 2;
      const pathStr = `M 0 ${-halfH} L ${halfW} ${-halfH * 0.7} L ${halfW} ${halfH * 0.15} C ${halfW} ${halfH * 0.65} 0 ${halfH} 0 ${halfH} C 0 ${halfH} ${-halfW} ${halfH * 0.65} ${-halfW} ${halfH * 0.15} L ${-halfW} ${-halfH * 0.7} Z`;
      return new Path(pathStr, {
        originX: 'center',
        originY: 'center',
      });
    }

    case 'flower': {
      // 8-petal scalloped bloom
      const s = minDim / 200;
      const pathStr = `M 0 ${-95 * s} C ${25 * s} ${-95 * s} ${45 * s} ${-65 * s} ${67 * s} ${-67 * s} C ${89 * s} ${-45 * s} ${65 * s} ${-25 * s} ${95 * s} 0 C ${65 * s} ${25 * s} ${89 * s} ${45 * s} ${67 * s} ${67 * s} C ${45 * s} ${89 * s} ${25 * s} ${65 * s} 0 ${95 * s} C ${-25 * s} ${65 * s} ${-45 * s} ${89 * s} ${-67 * s} ${67 * s} C ${-89 * s} ${45 * s} ${-65 * s} ${25 * s} ${-95 * s} 0 C ${-65 * s} ${-25 * s} ${-89 * s} ${-45 * s} ${-67 * s} ${-67 * s} C ${-45 * s} ${-89 * s} ${-25 * s} ${-65 * s} 0 ${-95 * s} Z`;
      return new Path(pathStr, {
        originX: 'center',
        originY: 'center',
      });
    }

    case 'blob': {
      const s = minDim / 200;
      const pathStr = `M 0 ${-88 * s} C ${60 * s} ${-98 * s} ${95 * s} ${-50 * s} ${90 * s} ${10 * s} C ${85 * s} ${70 * s} ${40 * s} ${95 * s} ${-10 * s} ${90 * s} C ${-60 * s} ${85 * s} ${-95 * s} ${40 * s} ${-90 * s} ${-20 * s} C ${-85 * s} ${-70 * s} ${-50 * s} ${-80 * s} 0 ${-88 * s} Z`;
      return new Path(pathStr, {
        originX: 'center',
        originY: 'center',
      });
    }

    case 'phone': {
      // iPhone frame - screen area with rounded corners
      return new Rect({
        width: w * 0.88,
        height: h * 0.94,
        rx: minDim * 0.18,
        ry: minDim * 0.18,
        originX: 'center',
        originY: 'center',
      });
    }

    case 'tablet': {
      // iPad frame - screen area
      return new Rect({
        width: w * 0.9,
        height: h * 0.92,
        rx: minDim * 0.08,
        ry: minDim * 0.08,
        originX: 'center',
        originY: 'center',
      });
    }

    case 'laptop': {
      // Laptop screen area
      return new Rect({
        width: w * 0.86,
        height: h * 0.68,
        rx: minDim * 0.04,
        ry: minDim * 0.04,
        originX: 'center',
        originY: 'center',
        top: -h * 0.08,
      });
    }

    case 'desktop': {
      // iMac screen area
      return new Rect({
        width: w * 0.9,
        height: h * 0.65,
        rx: minDim * 0.04,
        ry: minDim * 0.04,
        originX: 'center',
        originY: 'center',
        top: -h * 0.1,
      });
    }

    case 'polaroid': {
      // Classic Polaroid photo window (square cutout with wider bottom border)
      return new Rect({
        width: w * 0.84,
        height: h * 0.72,
        rx: 4,
        ry: 4,
        originX: 'center',
        originY: 'center',
        top: -h * 0.08,
      });
    }

    case 'stamp': {
      // Postage stamp serrated edge
      const halfW = w / 2;
      const halfH = h / 2;
      const pathStr = `M ${-halfW + 6} ${-halfH + 6} L ${halfW - 6} ${-halfH + 6} L ${halfW - 6} ${halfH - 6} L ${-halfW + 6} ${halfH - 6} Z`;
      return new Path(pathStr, {
        originX: 'center',
        originY: 'center',
      });
    }

    case 'torn-paper': {
      const halfW = w / 2;
      const halfH = h / 2;
      const pathStr = `M ${-halfW + 6} ${-halfH + 6} Q 0 ${-halfH + 2} ${halfW - 6} ${-halfH + 6} L ${halfW - 6} ${halfH - 6} Q 0 ${halfH - 2} ${-halfW + 6} ${halfH - 6} Z`;
      return new Path(pathStr, {
        originX: 'center',
        originY: 'center',
      });
    }

    case 'filmstrip': {
      return new Rect({
        width: w * 0.88,
        height: h * 0.75,
        rx: 6,
        ry: 6,
        originX: 'center',
        originY: 'center',
      });
    }

    default:
      return new Rect({
        width: w,
        height: h,
        rx: minDim * 0.08,
        ry: minDim * 0.08,
        originX: 'center',
        originY: 'center',
      });
  }
}
