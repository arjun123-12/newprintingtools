import type { Canvas } from 'fabric';
import { colorConversionService } from './colorConversionService';
import { imageColorWorker } from './imageColorWorker';
import { iccProfileService } from './iccProfileService';

interface OriginalObjectColors {
  fill?: any;
  stroke?: any;
  shadowColor?: string;
  originalSrc?: string;
  colorMap?: Map<string, string>; // For multi-color SVG objects
}

class SoftProofService {
  private isProofingActive = false;
  private currentProfileId: string = 'fogra39';
  private originalStateMap: WeakMap<any, OriginalObjectColors> = new WeakMap();

  public isPrintPreviewActive(): boolean {
    return this.isProofingActive;
  }

  public getActiveProfileId(): string {
    return this.currentProfileId;
  }

  public setActiveProfileId(profileId: string): void {
    this.currentProfileId = profileId;
  }

  /**
   * Toggle Print Preview Soft Proofing mode on the canvas without mutating
   * history or permanently modifying the user's artwork.
   */
  public async setPrintPreview(
    canvas: Canvas | null | undefined,
    enabled: boolean,
    profileId?: string
  ): Promise<boolean> {
    if (!canvas) return false;
    const targetProfile = profileId || this.currentProfileId || iccProfileService.getDefaultProfileId();
    this.currentProfileId = targetProfile;

    if (enabled === this.isProofingActive) {
      return this.isProofingActive;
    }

    const objects = canvas.getObjects();

    if (enabled) {
      // 1. Turning ON Print Preview
      // Collect unique colors first to ensure minimal transformations
      const uniqueColors = new Set<string>();

      const inspectColor = (val: any) => {
        if (typeof val === 'string' && val.startsWith('#')) {
          uniqueColors.add(val.toUpperCase());
        }
      };

      for (const obj of objects) {
        inspectColor(obj.fill);
        inspectColor(obj.stroke);
        if (obj.shadow && typeof obj.shadow.color === 'string') {
          inspectColor(obj.shadow.color);
        }
        // Multi-color SVG editable colors
        const editableColors = (obj as any)._editableColors || (obj as any).editableColors;
        if (Array.isArray(editableColors)) {
          editableColors.forEach(inspectColor);
        }
      }

      // Pre-warm unique color conversions
      await Promise.all(
        Array.from(uniqueColors).map((hex) =>
          colorConversionService.softProofHex(hex, targetProfile)
        )
      );

      // Apply soft-proof appearance non-destructively
      for (const obj of objects) {
        const stored: OriginalObjectColors = {
          fill: obj.fill,
          stroke: obj.stroke,
          shadowColor: obj.shadow?.color,
        };

        // Vector fills and strokes
        if (typeof obj.fill === 'string' && obj.fill.startsWith('#')) {
          const proof = await colorConversionService.softProofHex(obj.fill, targetProfile);
          obj.set('fill', proof);
        }

        if (typeof obj.stroke === 'string' && obj.stroke.startsWith('#')) {
          const proof = await colorConversionService.softProofHex(obj.stroke, targetProfile);
          obj.set('stroke', proof);
        }

        if (obj.shadow && typeof obj.shadow.color === 'string' && obj.shadow.color.startsWith('#')) {
          const proof = await colorConversionService.softProofHex(obj.shadow.color, targetProfile);
          obj.shadow.color = proof;
        }

        // Multi-color SVG paths
        if (typeof (obj as any).forEachObject === 'function') {
          (obj as any).forEachObject((child: any) => {
            if (typeof child.fill === 'string' && child.fill.startsWith('#')) {
              this.originalStateMap.set(child, { fill: child.fill, stroke: child.stroke });
              colorConversionService.softProofHex(child.fill, targetProfile).then((proof) => {
                child.set('fill', proof);
              });
            }
          });
        }

        // Images / Photos
        if (obj.type === 'image' || obj.type === 'fabricImage') {
          const imgEl = (obj as any)._element || (typeof (obj as any).getElement === 'function' ? (obj as any).getElement() : null);
          const origSrc = (obj as any)._originalSrc || (obj as any).src;
          if (imgEl && origSrc) {
            stored.originalSrc = origSrc;
            (obj as any)._originalSrc = origSrc;
            imageColorWorker
              .getSoftProofImageUrl(imgEl, origSrc, targetProfile)
              .then((softProofDataUrl) => {
                if (this.isProofingActive && softProofDataUrl) {
                  (obj as any).setSrc?.(softProofDataUrl, () => {
                    canvas.requestRenderAll();
                  });
                }
              })
              .catch((err) => {
                console.warn('[SoftProofService] Image soft proof error:', err);
              });
          }
        }

        this.originalStateMap.set(obj, stored);
      }

      this.isProofingActive = true;
      canvas.requestRenderAll();
      return true;
    } else {
      // 2. Turning OFF Print Preview: Restore 100% exact original RGB artwork
      for (const obj of objects) {
        const stored = this.originalStateMap.get(obj);
        if (stored) {
          if (stored.fill !== undefined) obj.set('fill', stored.fill);
          if (stored.stroke !== undefined) obj.set('stroke', stored.stroke);
          if (obj.shadow && stored.shadowColor !== undefined) {
            obj.shadow.color = stored.shadowColor;
          }

          // Restore multi-color SVG children
          if (typeof (obj as any).forEachObject === 'function') {
            (obj as any).forEachObject((child: any) => {
              const childStored = this.originalStateMap.get(child);
              if (childStored) {
                if (childStored.fill !== undefined) child.set('fill', childStored.fill);
                if (childStored.stroke !== undefined) child.set('stroke', childStored.stroke);
              }
            });
          }

          // Restore Image original source
          if (stored.originalSrc && (obj.type === 'image' || obj.type === 'fabricImage')) {
            (obj as any).setSrc?.(stored.originalSrc, () => {
              canvas.requestRenderAll();
            });
          }
        }
      }

      this.isProofingActive = false;
      canvas.requestRenderAll();
      return false;
    }
  }
}

export const softProofService = new SoftProofService();
