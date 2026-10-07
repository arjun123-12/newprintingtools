'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FormSection,
  FormGrid,
  AdminInput,
  AdminCheckbox,
} from '@/components/admin/shared';
import { ProductFormData, FormErrors } from './types';
import {
  PrintLayoutConfig,
  FoldingConfig,
  FoldingType,
  PanelConfig,
  FoldConfig,
} from '@/types/folding';
import {
  FOLDING_TYPES,
  calculateDefaultPanels,
  recalculateFoldsFromPanels,
  createDefaultFoldingConfig,
  generateBackSideLayout,
  normalizeFold,
  normalizeFoldMargin,
  normalizeFoldBleed,
} from '@/utils/foldingLayout';
import {
  Layers,
  Scissors,
  ShieldCheck,
  FoldHorizontal,
  FoldVertical,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Link2,
  Unlink2,
} from 'lucide-react';

interface ProductPrintDimensionsProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  errors?: FormErrors;
}

export const ProductPrintDimensions: React.FC<ProductPrintDimensionsProps> = ({
  formData,
  setFormData,
  errors = {},
}) => {
  // Local state for linked edges in bleed and safe margin
  const [linkBleed, setLinkBleed] = useState<boolean>(true);
  const [linkSafeMargin, setLinkSafeMargin] = useState<boolean>(true);
  const [activeSideTab, setActiveSideTab] = useState<'front' | 'back'>('front');
  const [autoMirrorBack, setAutoMirrorBack] = useState<boolean>(true);

  // Derive current print layout or create default structure
  const currentLayout: PrintLayoutConfig = useMemo(() => {
    const w = formData.width_mm || 297;
    const h = formData.height_mm || 210;
    const b = formData.bleed_mm ?? 3;
    const s = formData.safe_area_mm ?? 3;

    if (formData.print_layout) {
      const pl = formData.print_layout;
      const normalizedFolds = (pl.folding?.folds || []).map((f, idx) => normalizeFold(f, idx));
      const normalizedPanels = (pl.folding?.panels || []).map((p, idx) => {
        if (idx === 2 || p.index === 2) {
          return { ...p, label: 'Logo Panel' };
        }
        return p;
      });
      const normalizedBackPanels = (pl.folding?.sides?.back?.panels || []).map((p, idx) => {
        if (idx === 2 || p.index === 2) {
          return { ...p, label: 'Logo Panel' };
        }
        return p;
      });
      return {
        ...pl,
        folding: {
          ...pl.folding,
          panels: normalizedPanels,
          folds: normalizedFolds,
          sides: pl.folding?.sides ? {
            ...pl.folding.sides,
            back: pl.folding.sides.back ? {
              ...pl.folding.sides.back,
              panels: normalizedBackPanels,
            } : undefined,
          } : undefined,
        },
      };
    }

    return {
      width: w,
      height: h,
      orientation: w >= h ? 'landscape' : 'portrait',
      outerBleed: { top: b, right: b, bottom: b, left: b },
      safeMargin: { top: s, right: s, bottom: s, left: s },
      folding: {
        enabled: false,
        type: 'tri-fold',
        panelOrientation: 'vertical',
        panelCount: 3,
        panels: [
          { id: 'p1', index: 0, label: 'Panel 1', width: 100 },
          { id: 'p2', index: 1, label: 'Panel 2', width: 97 },
          { id: 'p3', index: 2, label: 'Logo Panel', width: 100 },
        ],
        folds: [
          normalizeFold({ id: 'f1', index: 0, position: 100 }, 0, 3, 2),
          normalizeFold({ id: 'f2', index: 1, position: 197 }, 1, 3, 2),
        ],
        sameMarginForAllFolds: true,
        sameBleedForAllFolds: true,
        uniformFoldMargin: { top: 3, right: 3, bottom: 3, left: 3 },
        uniformFoldBleed: { top: 2, right: 2, bottom: 2, left: 2 },
      },
    };
  }, [formData.print_layout, formData.width_mm, formData.height_mm, formData.bleed_mm, formData.safe_area_mm]);

  // Dedicated local input state so users can freely edit, clear, backspace, and type decimals without getting stuck
  const [widthInput, setWidthInput] = useState<string>(() => String(formData.width_mm || 297));
  const [heightInput, setHeightInput] = useState<string>(() => String(formData.height_mm || 210));

  useEffect(() => {
    if (typeof currentLayout.width === 'number' && !isNaN(currentLayout.width) && currentLayout.width > 0) {
      setWidthInput((prev) => {
        const parsed = parseFloat(prev);
        return parsed === currentLayout.width ? prev : String(currentLayout.width);
      });
    }
  }, [currentLayout.width]);

  useEffect(() => {
    if (typeof currentLayout.height === 'number' && !isNaN(currentLayout.height) && currentLayout.height > 0) {
      setHeightInput((prev) => {
        const parsed = parseFloat(prev);
        return parsed === currentLayout.height ? prev : String(currentLayout.height);
      });
    }
  }, [currentLayout.height]);

  // Helper to commit layout updates and keep root form values in sync
  const updateLayout = (updater: (prev: PrintLayoutConfig) => PrintLayoutConfig) => {
    setFormData((prev) => {
      const updated = updater(currentLayout);
      const maxBleed = Math.max(
        updated.outerBleed.top,
        updated.outerBleed.right,
        updated.outerBleed.bottom,
        updated.outerBleed.left
      );
      const maxSafe = Math.max(
        updated.safeMargin.top,
        updated.safeMargin.right,
        updated.safeMargin.bottom,
        updated.safeMargin.left
      );

      return {
        ...prev,
        width_mm: updated.width,
        height_mm: updated.height,
        bleed_mm: maxBleed,
        safe_area_mm: maxSafe,
        margin_mm: maxSafe,
        print_layout: updated,
      };
    });
  };

  // Dimensions & Orientation Handlers
  const handleWidthChange = (rawVal: string) => {
    setWidthInput(rawVal);
    const val = parseFloat(rawVal);
    if (!isNaN(val) && val > 0) {
      updateLayout((prev) => {
        const next = { ...prev, width: val };
        next.orientation = val >= prev.height ? 'landscape' : 'portrait';
        return next;
      });
    }
  };

  const handleWidthBlur = () => {
    const val = parseFloat(widthInput);
    if (isNaN(val) || val <= 0) {
      const fallback = currentLayout.width > 0 ? currentLayout.width : 297;
      setWidthInput(String(fallback));
      updateLayout((prev) => ({ ...prev, width: fallback }));
    }
  };

  const handleHeightChange = (rawVal: string) => {
    setHeightInput(rawVal);
    const val = parseFloat(rawVal);
    if (!isNaN(val) && val > 0) {
      updateLayout((prev) => {
        const next = { ...prev, height: val };
        next.orientation = prev.width >= val ? 'landscape' : 'portrait';
        return next;
      });
    }
  };

  const handleHeightBlur = () => {
    const val = parseFloat(heightInput);
    if (isNaN(val) || val <= 0) {
      const fallback = currentLayout.height > 0 ? currentLayout.height : 210;
      setHeightInput(String(fallback));
      updateLayout((prev) => ({ ...prev, height: fallback }));
    }
  };

  const handleOrientationToggle = (orientation: 'landscape' | 'portrait') => {
    updateLayout((prev) => {
      let w = prev.width;
      let h = prev.height;
      if (
        (orientation === 'landscape' && h > w) ||
        (orientation === 'portrait' && w > h)
      ) {
        // Swap width and height
        const temp = w;
        w = h;
        h = temp;
      }
      return {
        ...prev,
        width: w,
        height: h,
        orientation,
      };
    });
  };

  // Bleed Handlers
  const handleBleedEdgeChange = (edge: 'top' | 'right' | 'bottom' | 'left', rawVal: string) => {
    const val = Math.max(0, parseFloat(rawVal) || 0);
    updateLayout((prev) => {
      const newBleed = linkBleed
        ? { top: val, right: val, bottom: val, left: val }
        : { ...prev.outerBleed, [edge]: val };
      return { ...prev, outerBleed: newBleed };
    });
  };

  // Safe Margin Handlers
  const handleSafeMarginChange = (edge: 'top' | 'right' | 'bottom' | 'left', rawVal: string) => {
    const val = Math.max(0, parseFloat(rawVal) || 0);
    updateLayout((prev) => {
      const newMargin = linkSafeMargin
        ? { top: val, right: val, bottom: val, left: val }
        : { ...prev.safeMargin, [edge]: val };
      return { ...prev, safeMargin: newMargin };
    });
  };

  // Folding Toggle Handler
  const handleToggleFolding = (enabled: boolean) => {
    updateLayout((prev) => {
      if (enabled && !prev.folding.enabled) {
        const defaultFolding = createDefaultFoldingConfig(
          prev.folding.type || 'tri-fold',
          prev.width,
          prev.folding.panelCount || 3
        );
        return {
          ...prev,
          folding: defaultFolding,
        };
      }
      return {
        ...prev,
        folding: {
          ...prev.folding,
          enabled,
        },
      };
    });
  };

  // Fold Type Change
  const handleFoldTypeChange = (type: FoldingType) => {
    updateLayout((prev) => {
      const typeOption = FOLDING_TYPES.find((opt) => opt.value === type);
      const panelCount = typeOption?.defaultPanels || prev.folding.panelCount || 3;
      const panels = calculateDefaultPanels(type, panelCount, prev.width);
      const folds = recalculateFoldsFromPanels(
        panels,
        undefined,
        prev.folding.uniformFoldMargin ?? 3,
        prev.folding.uniformFoldBleed ?? 2,
        0
      );

      return {
        ...prev,
        folding: {
          ...prev.folding,
          type,
          panelCount,
          panels,
          folds,
          sides: {
            front: { panels, folds },
            back: generateBackSideLayout(panels, folds),
          },
        },
      };
    });
  };

  // Panel Count Change
  const handlePanelCountChange = (count: number) => {
    const clamped = Math.max(2, Math.min(12, count));
    updateLayout((prev) => {
      const panels = calculateDefaultPanels(prev.folding.type, clamped, prev.width);
      const folds = recalculateFoldsFromPanels(
        panels,
        undefined,
        prev.folding.uniformFoldMargin ?? 3,
        prev.folding.uniformFoldBleed ?? 2,
        0
      );
      return {
        ...prev,
        folding: {
          ...prev.folding,
          panelCount: clamped,
          panels,
          folds,
          sides: {
            front: { panels, folds },
            back: generateBackSideLayout(panels, folds),
          },
        },
      };
    });
  };

  // Individual Panel Width Change
  const handlePanelWidthChange = (index: number, rawVal: string, isBackSide: boolean = false) => {
    const val = Math.max(1, parseFloat(rawVal) || 0);

    updateLayout((prev) => {
      const targetPanels = isBackSide
        ? [...(prev.folding.sides?.back?.panels || prev.folding.panels)]
        : [...prev.folding.panels];

      if (!targetPanels[index]) return prev;

      targetPanels[index] = {
        ...targetPanels[index],
        width: val,
      };

      const recalculatedFolds = recalculateFoldsFromPanels(
        targetPanels,
        isBackSide ? prev.folding.sides?.back?.folds : prev.folding.folds,
        prev.folding.uniformFoldMargin ?? 3,
        prev.folding.uniformFoldBleed ?? 2,
        0
      );

      if (isBackSide) {
        return {
          ...prev,
          folding: {
            ...prev.folding,
            sides: {
              ...prev.folding.sides,
              back: {
                panels: targetPanels,
                folds: recalculatedFolds,
              },
            },
          },
        };
      }

      // If updating front side and autoMirrorBack is active, mirror to back side
      const backSideLayout = autoMirrorBack
        ? generateBackSideLayout(targetPanels, recalculatedFolds)
        : prev.folding.sides?.back;

      return {
        ...prev,
        folding: {
          ...prev.folding,
          panels: targetPanels,
          folds: recalculatedFolds,
          sides: {
            front: { panels: targetPanels, folds: recalculatedFolds },
            back: backSideLayout,
          },
        },
      };
    });
  };

  // Auto-distribute panel widths evenly
  const handleDistributePanelsEvenly = () => {
    updateLayout((prev) => {
      const count = prev.folding.panels.length;
      const baseWidth = Math.round((prev.width / count) * 100) / 100;
      let accumulated = 0;

      const newPanels: PanelConfig[] = prev.folding.panels.map((p, idx) => {
        if (idx === count - 1) {
          const lastW = Math.max(1, Math.round((prev.width - accumulated) * 100) / 100);
          return { ...p, width: lastW };
        }
        accumulated += baseWidth;
        return { ...p, width: baseWidth };
      });

      const newFolds = recalculateFoldsFromPanels(
        newPanels,
        prev.folding.folds,
        prev.folding.uniformFoldMargin ?? 3,
        prev.folding.uniformFoldBleed ?? 2,
        0
      );

      return {
        ...prev,
        folding: {
          ...prev.folding,
          panels: newPanels,
          folds: newFolds,
          sides: {
            front: { panels: newPanels, folds: newFolds },
            back: generateBackSideLayout(newPanels, newFolds),
          },
        },
      };
    });
  };

  // Auto-balance last panel width
  const handleAutoAdjustLastPanel = () => {
    updateLayout((prev) => {
      const panels = [...prev.folding.panels];
      if (panels.length < 2) return prev;
      const otherWidths = panels.slice(0, -1).reduce((s, p) => s + (p.width || 0), 0);
      const remaining = Math.max(1, Math.round((prev.width - otherWidths) * 100) / 100);
      panels[panels.length - 1] = {
        ...panels[panels.length - 1],
        width: remaining,
      };

      const newFolds = recalculateFoldsFromPanels(
        panels,
        prev.folding.folds,
        prev.folding.uniformFoldMargin ?? 3,
        prev.folding.uniformFoldBleed ?? 2,
        0
      );

      return {
        ...prev,
        folding: {
          ...prev.folding,
          panels,
          folds: newFolds,
          sides: {
            front: { panels, folds: newFolds },
            back: generateBackSideLayout(panels, newFolds),
          },
        },
      };
    });
  };

  // Fold Margin & Bleed Handlers (Independent 4-side support)
  const handleFoldMarginChange = (
    foldIndex: number,
    edge: 'top' | 'right' | 'bottom' | 'left',
    rawVal: string
  ) => {
    const val = Math.max(0, parseFloat(rawVal) || 0);
    updateLayout((prev) => {
      const applyToAll = prev.folding.sameMarginForAllFolds;
      const updatedFolds = prev.folding.folds.map((f, idx) => {
        if (applyToAll || idx === foldIndex) {
          const currentMargin = normalizeFoldMargin(f);
          const nextMargin = { ...currentMargin, [edge]: val };
          return {
            ...f,
            margin: nextMargin,
            marginLeft: nextMargin.left,
            marginRight: nextMargin.right,
            marginTop: nextMargin.top,
            marginBottom: nextMargin.bottom,
          };
        }
        return f;
      });

      const backSideLayout = autoMirrorBack
        ? generateBackSideLayout(prev.folding.panels, updatedFolds)
        : prev.folding.sides?.back;

      return {
        ...prev,
        folding: {
          ...prev.folding,
          folds: updatedFolds,
          sides: {
            front: { panels: prev.folding.panels, folds: updatedFolds },
            back: backSideLayout,
          },
        },
      };
    });
  };

  const handleFoldBleedChange = (
    foldIndex: number,
    edge: 'top' | 'right' | 'bottom' | 'left',
    rawVal: string
  ) => {
    const val = Math.max(0, parseFloat(rawVal) || 0);
    updateLayout((prev) => {
      const applyToAll = prev.folding.sameBleedForAllFolds;
      const updatedFolds = prev.folding.folds.map((f, idx) => {
        if (applyToAll || idx === foldIndex) {
          const currentBleed = normalizeFoldBleed(f);
          const nextBleed = { ...currentBleed, [edge]: val };
          return {
            ...f,
            bleed: nextBleed,
            bleedLeft: nextBleed.left,
            bleedRight: nextBleed.right,
            bleedTop: nextBleed.top,
            bleedBottom: nextBleed.bottom,
          };
        }
        return f;
      });

      const backSideLayout = autoMirrorBack
        ? generateBackSideLayout(prev.folding.panels, updatedFolds)
        : prev.folding.sides?.back;

      return {
        ...prev,
        folding: {
          ...prev.folding,
          folds: updatedFolds,
          sides: {
            front: { panels: prev.folding.panels, folds: updatedFolds },
            back: backSideLayout,
          },
        },
      };
    });
  };

  const handleToggleSameMarginForAll = (checked: boolean) => {
    updateLayout((prev) => {
      let updatedFolds = prev.folding.folds;
      if (checked && updatedFolds.length > 0) {
        const sourceMargin = normalizeFoldMargin(updatedFolds[0]);
        updatedFolds = updatedFolds.map((f) => ({
          ...f,
          margin: { ...sourceMargin },
          marginLeft: sourceMargin.left,
          marginRight: sourceMargin.right,
          marginTop: sourceMargin.top,
          marginBottom: sourceMargin.bottom,
        }));
      }
      return {
        ...prev,
        folding: {
          ...prev.folding,
          sameMarginForAllFolds: checked,
          folds: updatedFolds,
        },
      };
    });
  };

  const handleToggleSameBleedForAll = (checked: boolean) => {
    updateLayout((prev) => {
      let updatedFolds = prev.folding.folds;
      if (checked && updatedFolds.length > 0) {
        const sourceBleed = normalizeFoldBleed(updatedFolds[0]);
        updatedFolds = updatedFolds.map((f) => ({
          ...f,
          bleed: { ...sourceBleed },
          bleedLeft: sourceBleed.left,
          bleedRight: sourceBleed.right,
          bleedTop: sourceBleed.top,
          bleedBottom: sourceBleed.bottom,
        }));
      }
      return {
        ...prev,
        folding: {
          ...prev.folding,
          sameBleedForAllFolds: checked,
          folds: updatedFolds,
        },
      };
    });
  };

  // Calculations for display and diagram
  const totalPanelsWidth = useMemo(() => {
    const panels =
      activeSideTab === 'back' && currentLayout.folding.sides?.back?.panels
        ? currentLayout.folding.sides.back.panels
        : currentLayout.folding.panels;
    return Math.round(panels.reduce((sum, p) => sum + (Number(p.width) || 0), 0) * 100) / 100;
  }, [currentLayout.folding, activeSideTab]);

  const widthMismatch = Math.abs(totalPanelsWidth - currentLayout.width) > 0.5;

  return (
    <FormSection
      title="Print & Folding Settings"
      description="Configure sheet trim dimensions, outer bleed margins, inner safety margins, and folding panel specifications."
    >
      <div className="space-y-6">
        {/* --- 1. BASIC PRODUCT PRINT SETTINGS --- */}
        <div className="p-4 bg-gray-50/70 border border-gray-200/80 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-blue-600" />
              Sheet Dimensions & Trim Size
            </h4>
            <div className="flex items-center gap-1.5 bg-gray-200/80 p-0.5 rounded-lg text-xs font-semibold text-gray-600">
              <button
                type="button"
                onClick={() => handleOrientationToggle('landscape')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  currentLayout.orientation === 'landscape'
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'hover:text-gray-900'
                }`}
              >
                Landscape
              </button>
              <button
                type="button"
                onClick={() => handleOrientationToggle('portrait')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  currentLayout.orientation === 'portrait'
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'hover:text-gray-900'
                }`}
              >
                Portrait
              </button>
            </div>
          </div>

          <FormGrid cols={3} gap="md">
            {/* Width */}
            <AdminInput
              label="Width (mm)"
              type="number"
              step="any"
              min="1"
              placeholder="e.g. 297"
              value={widthInput}
              error={errors.width_mm}
              onChange={(e) => handleWidthChange(e.target.value)}
              onBlur={handleWidthBlur}
              helperText="Finished sheet width before folding."
            />

            {/* Height */}
            <AdminInput
              label="Height (mm)"
              type="number"
              step="any"
              min="1"
              placeholder="e.g. 210"
              value={heightInput}
              error={errors.height_mm}
              onChange={(e) => handleHeightChange(e.target.value)}
              onBlur={handleHeightBlur}
              helperText="Finished sheet height in millimetres."
            />

            {/* Orientation Display */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Orientation
              </label>
              <div className="h-10 px-3 flex items-center bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 capitalize">
                {currentLayout.orientation} ({currentLayout.width} × {currentLayout.height} mm)
              </div>
            </div>
          </FormGrid>

          {/* Outer Bleed Settings */}
          <div className="pt-2 border-t border-gray-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
                Outer / Product Bleed (mm)
              </span>
              <button
                type="button"
                onClick={() => setLinkBleed(!linkBleed)}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md transition-all ${
                  linkBleed
                    ? 'bg-blue-100/70 text-blue-700'
                    : 'bg-gray-200/70 text-gray-600 hover:text-gray-900'
                }`}
              >
                {linkBleed ? <Link2 className="w-3 h-3" /> : <Unlink2 className="w-3 h-3" />}
                {linkBleed ? 'Linked (All Sides Same)' : 'Individual Sides'}
              </button>
            </div>

            <FormGrid cols={4} gap="sm">
              <AdminInput
                label="Top (mm)"
                type="number"
                step="any"
                min="0"
                value={currentLayout.outerBleed.top}
                onChange={(e) => handleBleedEdgeChange('top', e.target.value)}
              />
              <AdminInput
                label="Right (mm)"
                type="number"
                step="any"
                min="0"
                value={currentLayout.outerBleed.right}
                onChange={(e) => handleBleedEdgeChange('right', e.target.value)}
              />
              <AdminInput
                label="Bottom (mm)"
                type="number"
                step="any"
                min="0"
                value={currentLayout.outerBleed.bottom}
                onChange={(e) => handleBleedEdgeChange('bottom', e.target.value)}
              />
              <AdminInput
                label="Left (mm)"
                type="number"
                step="any"
                min="0"
                value={currentLayout.outerBleed.left}
                onChange={(e) => handleBleedEdgeChange('left', e.target.value)}
              />
            </FormGrid>
          </div>

          {/* Inner Safe Margin Settings */}
          <div className="pt-2 border-t border-gray-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                Inner / Product Safe Margin (mm)
              </span>
              <button
                type="button"
                onClick={() => setLinkSafeMargin(!linkSafeMargin)}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md transition-all ${
                  linkSafeMargin
                    ? 'bg-emerald-100/70 text-emerald-700'
                    : 'bg-gray-200/70 text-gray-600 hover:text-gray-900'
                }`}
              >
                {linkSafeMargin ? <Link2 className="w-3 h-3" /> : <Unlink2 className="w-3 h-3" />}
                {linkSafeMargin ? 'Linked (All Sides Same)' : 'Individual Sides'}
              </button>
            </div>

            <FormGrid cols={4} gap="sm">
              <AdminInput
                label="Top (mm)"
                type="number"
                step="any"
                min="0"
                value={currentLayout.safeMargin.top}
                onChange={(e) => handleSafeMarginChange('top', e.target.value)}
              />
              <AdminInput
                label="Right (mm)"
                type="number"
                step="any"
                min="0"
                value={currentLayout.safeMargin.right}
                onChange={(e) => handleSafeMarginChange('right', e.target.value)}
              />
              <AdminInput
                label="Bottom (mm)"
                type="number"
                step="any"
                min="0"
                value={currentLayout.safeMargin.bottom}
                onChange={(e) => handleSafeMarginChange('bottom', e.target.value)}
              />
              <AdminInput
                label="Left (mm)"
                type="number"
                step="any"
                min="0"
                value={currentLayout.safeMargin.left}
                onChange={(e) => handleSafeMarginChange('left', e.target.value)}
              />
            </FormGrid>
          </div>
        </div>

        {/* --- 2. FOLDING TOGGLE --- */}
        <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  currentLayout.folding.enabled
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <FoldVertical className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  Folding Configuration
                  {currentLayout.folding.enabled && (
                    <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Enabled
                    </span>
                  )}
                </h4>
                <p className="text-xs text-gray-500">
                  Enable folding to configure fold lines, panels, crease margins, and multi-fold layouts.
                </p>
              </div>
            </div>

            {/* No / Yes Segmented Toggle */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200/80">
              <button
                type="button"
                onClick={() => handleToggleFolding(false)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !currentLayout.folding.enabled
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => handleToggleFolding(true)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentLayout.folding.enabled
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Yes
              </button>
            </div>
          </div>

          {/* --- 3. EXPANDED FOLDING OPTIONS WHEN FOLDING = YES --- */}
          {currentLayout.folding.enabled && (
            <div className="space-y-6 pt-4 border-t border-gray-100 animate-in fade-in duration-200">
              {/* Folding Type Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Folding Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {FOLDING_TYPES.map((ft) => {
                    const isSelected = currentLayout.folding.type === ft.value;
                    return (
                      <button
                        key={ft.value}
                        type="button"
                        onClick={() => handleFoldTypeChange(ft.value)}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-bold ${
                              isSelected ? 'text-blue-700' : 'text-gray-900'
                            }`}
                          >
                            {ft.label}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-2">
                          {ft.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Number of Panels & Panel Orientation */}
              <div className="p-4 bg-gray-50/70 border border-gray-200/70 rounded-xl space-y-4">
                <FormGrid cols={2} gap="md">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Number of Panels
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="2"
                        max="12"
                        value={currentLayout.folding.panelCount}
                        onChange={(e) => handlePanelCountChange(parseInt(e.target.value) || 2)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-24 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500 font-medium">
                        (Generates {Math.max(1, currentLayout.folding.panelCount - 1)} fold line{currentLayout.folding.panelCount > 2 ? 's' : ''})
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Panel Fold Orientation
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateLayout((p) => ({
                            ...p,
                            folding: { ...p.folding, panelOrientation: 'vertical' },
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          currentLayout.folding.panelOrientation !== 'horizontal'
                            ? 'bg-white border-blue-500 text-blue-700 shadow-xs'
                            : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200/60'
                        }`}
                      >
                        <FoldVertical className="w-3.5 h-3.5" />
                        Vertical Folds (Columns)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateLayout((p) => ({
                            ...p,
                            folding: { ...p.folding, panelOrientation: 'horizontal' },
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          currentLayout.folding.panelOrientation === 'horizontal'
                            ? 'bg-white border-blue-500 text-blue-700 shadow-xs'
                            : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200/60'
                        }`}
                      >
                        <FoldHorizontal className="w-3.5 h-3.5" />
                        Horizontal Folds (Rows)
                      </button>
                    </div>
                  </div>
                </FormGrid>
              </div>

              {/* Side Tabs: Front vs Back */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSideTab('front')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeSideTab === 'front'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Front Side Panels
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSideTab('back')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeSideTab === 'back'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Back Side Panels
                  </button>
                </div>

                {activeSideTab === 'back' && (
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoMirrorBack}
                      onChange={(e) => {
                        setAutoMirrorBack(e.target.checked);
                        if (e.target.checked) {
                          updateLayout((prev) => ({
                            ...prev,
                            folding: {
                              ...prev.folding,
                              sides: {
                                ...prev.folding.sides,
                                back: generateBackSideLayout(
                                  prev.folding.panels,
                                  prev.folding.folds
                                ),
                              },
                            },
                          }));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Auto-mirror Front side panels (Reversed order)
                  </label>
                )}
              </div>

              {/* Individual Panel Widths Inputs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800">
                      Individual Panel Widths ({activeSideTab === 'front' ? 'Front' : 'Back'} Side)
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        widthMismatch
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      Total: {totalPanelsWidth} mm / Sheet: {currentLayout.width} mm{' '}
                      {widthMismatch ? '(Mismatch)' : '✓ Balanced'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDistributePanelsEvenly}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      Distribute Evenly
                    </button>
                    {widthMismatch && (
                      <button
                        type="button"
                        onClick={handleAutoAdjustLastPanel}
                        className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Auto-Adjust Last Panel
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className={`grid gap-3 ${
                    currentLayout.folding.panelCount <= 3
                      ? 'grid-cols-3'
                      : currentLayout.folding.panelCount === 4
                      ? 'grid-cols-4'
                      : 'grid-cols-3 sm:grid-cols-6'
                  }`}
                >
                  {(activeSideTab === 'back' && currentLayout.folding.sides?.back?.panels
                    ? currentLayout.folding.sides.back.panels
                    : currentLayout.folding.panels
                  ).map((panel, idx) => {
                    const labelText = (idx === 2 || panel.index === 2)
                      ? 'Logo Panel'
                      : (panel.label || `Panel ${idx + 1}`);

                    return (
                      <div
                        key={panel.id || idx}
                        className="p-3 bg-white border border-gray-200 rounded-xl space-y-1 shadow-2xs"
                      >
                        <span className="text-[11px] font-bold text-gray-500 uppercase block truncate">
                          {labelText}
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            min="1"
                            value={panel.width}
                            disabled={activeSideTab === 'back' && autoMirrorBack}
                            onChange={(e) =>
                              handlePanelWidthChange(idx, e.target.value, activeSideTab === 'back')
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full px-2 py-1.5 text-xs font-bold text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                          />
                          <span className="text-xs text-gray-400 font-semibold">mm</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fold Settings (Margins, Bleeds, Allowance) */}
              <div className="p-4 bg-gray-50/80 border border-gray-200/80 rounded-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Fold Margins & Fold Bleed Settings
                  </h4>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-600">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={currentLayout.folding.sameMarginForAllFolds}
                        onChange={(e) => handleToggleSameMarginForAll(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Apply same margin to all folds
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={currentLayout.folding.sameBleedForAllFolds}
                        onChange={(e) => handleToggleSameBleedForAll(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Apply same bleed to all folds
                    </label>
                  </div>
                </div>

                {/* Individual Fold Cards for EVERY fold with independent 4-side inputs */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {currentLayout.folding.folds.map((rawFold, fIdx) => {
                      const fold = normalizeFold(rawFold, fIdx);
                      return (
                        <div
                          key={fold.id || fIdx}
                          className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-3 shadow-2xs"
                        >
                          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                            <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-600" />
                              Fold {fIdx + 1} (Position: {fold.position} mm)
                            </span>
                          </div>

                          {/* Margin Section */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                Margin (Safe Zone)
                              </span>
                              {currentLayout.folding.sameMarginForAllFolds && (
                                <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                                  Synced to all
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <AdminInput
                                label="Top (mm)"
                                type="number"
                                step="any"
                                min="0"
                                value={fold.margin.top}
                                onChange={(e) => handleFoldMarginChange(fIdx, 'top', e.target.value)}
                              />
                              <AdminInput
                                label="Right (mm)"
                                type="number"
                                step="any"
                                min="0"
                                value={fold.margin.right}
                                onChange={(e) => handleFoldMarginChange(fIdx, 'right', e.target.value)}
                              />
                              <AdminInput
                                label="Bottom (mm)"
                                type="number"
                                step="any"
                                min="0"
                                value={fold.margin.bottom}
                                onChange={(e) => handleFoldMarginChange(fIdx, 'bottom', e.target.value)}
                              />
                              <AdminInput
                                label="Left (mm)"
                                type="number"
                                step="any"
                                min="0"
                                value={fold.margin.left}
                                onChange={(e) => handleFoldMarginChange(fIdx, 'left', e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Bleed Section */}
                          <div className="space-y-1.5 pt-1.5 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                Bleed (Tolerance)
                              </span>
                              {currentLayout.folding.sameBleedForAllFolds && (
                                <span className="text-[10px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded">
                                  Synced to all
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <AdminInput
                                label="Top (mm)"
                                type="number"
                                step="any"
                                min="0"
                                value={fold.bleed.top}
                                onChange={(e) => handleFoldBleedChange(fIdx, 'top', e.target.value)}
                              />
                              <AdminInput
                                label="Right (mm)"
                                type="number"
                                step="any"
                                min="0"
                                value={fold.bleed.right}
                                onChange={(e) => handleFoldBleedChange(fIdx, 'right', e.target.value)}
                              />
                              <AdminInput
                                label="Bottom (mm)"
                                type="number"
                                step="any"
                                min="0"
                                value={fold.bleed.bottom}
                                onChange={(e) => handleFoldBleedChange(fIdx, 'bottom', e.target.value)}
                              />
                              <AdminInput
                                label="Left (mm)"
                                type="number"
                                step="any"
                                min="0"
                                value={fold.bleed.left}
                                onChange={(e) => handleFoldBleedChange(fIdx, 'left', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* --- 4. INTERACTIVE VISUAL FOLDING DIAGRAM --- */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-bold uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Live Folding Layout Diagram ({activeSideTab === 'front' ? 'Front Side' : 'Back Side'})
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400" /> Outer Bleed
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> Safe Zone
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400" /> Fold Line
                    </span>
                  </div>
                </div>

                {/* SVG Visual Layout */}
                <div className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-center overflow-x-auto">
                  <div
                    className="relative border-2 border-red-500/80 border-dashed rounded bg-slate-900/60 flex flex-col justify-between"
                    style={{
                      width: '100%',
                      maxWidth: '680px',
                      height: '160px',
                      padding: '8px',
                    }}
                  >
                    {/* Inner Trim Cut Area */}
                    <div className="relative w-full h-full border-2 border-white/90 bg-white/5 rounded-xs flex overflow-hidden">
                      {/* Panels */}
                      {(activeSideTab === 'back' && currentLayout.folding.sides?.back?.panels
                        ? currentLayout.folding.sides.back.panels
                        : currentLayout.folding.panels
                      ).map((panel, pIdx) => {
                        const totalW = Math.max(currentLayout.width || 297, totalPanelsWidth);
                        const pct = ((panel.width || 1) / totalW) * 100;
                        const labelText = (pIdx === 2 || panel.index === 2)
                          ? 'Logo Panel'
                          : (panel.label || `Panel ${pIdx + 1}`);
                        return (
                          <div
                            key={panel.id || pIdx}
                            className={`h-full flex flex-col items-center justify-center relative border-r border-blue-400/80 border-dashed last:border-r-0 transition-all ${
                              pIdx % 2 === 0 ? 'bg-blue-500/10' : 'bg-slate-500/5'
                            }`}
                            style={{ width: `${pct}%` }}
                          >
                            <span className="text-[11px] font-bold text-white tracking-wide">
                              {labelText}
                            </span>
                            <span className="text-[10px] text-blue-300 font-semibold">
                              {panel.width} mm
                            </span>

                            {/* Fold Indicator if not last panel */}
                            {pIdx < currentLayout.folding.panelCount - 1 && (() => {
                              const activeFolds = (activeSideTab === 'back' && currentLayout.folding.sides?.back?.folds
                                ? currentLayout.folding.sides.back.folds
                                : currentLayout.folding.folds);
                              const curFold = activeFolds[pIdx] ? normalizeFold(activeFolds[pIdx], pIdx) : null;
                              return (
                                <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between items-center transform translate-x-1/2 pointer-events-none z-10 py-1">
                                  <span className="bg-blue-600 text-[8px] font-bold px-1.5 py-0.5 rounded text-white shadow-xs whitespace-nowrap">
                                    Fold {pIdx + 1}
                                  </span>
                                  {curFold && (
                                    <div className="bg-slate-900/95 border border-slate-700/80 text-[7.5px] px-1.5 py-0.5 rounded text-slate-200 text-center shadow-xs whitespace-nowrap">
                                      <span className="text-emerald-400 font-bold block">Safe: L{curFold.margin.left}/R{curFold.margin.right}</span>
                                      <span className="text-red-400 font-bold block">Bleed: L{curFold.bleed.left}/R{curFold.bleed.right}</span>
                                    </div>
                                  )}
                                  <span className="bg-blue-600 text-[8px] font-bold px-1 rounded text-white shadow-xs">
                                    ▼
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Sheet Trim: {currentLayout.width} × {currentLayout.height} mm
                  </span>
                  <span>
                    Total Bleed Size: {currentLayout.width + currentLayout.outerBleed.left + currentLayout.outerBleed.right} ×{' '}
                    {currentLayout.height + currentLayout.outerBleed.top + currentLayout.outerBleed.bottom} mm
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Visual Summary Callout */}
        <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Sides:</strong> {formData.sides_count} {formData.sides_count === 1 ? 'Side' : 'Sides'} •{' '}
              <strong>Finished Trim:</strong> {currentLayout.width} × {currentLayout.height} mm
              {currentLayout.folding.enabled
                ? ` • Folding: ${currentLayout.folding.type} (${currentLayout.folding.panelCount} Panels)`
                : ' • Folding: None'}
              {currentLayout.outerBleed.top > 0 ? ` • Bleed: ${currentLayout.outerBleed.top} mm` : ''}
              {currentLayout.safeMargin.top > 0 ? ` • Safe: ${currentLayout.safeMargin.top} mm` : ''}
            </span>
          </div>
        </div>
      </div>
    </FormSection>
  );
};

export default ProductPrintDimensions;
