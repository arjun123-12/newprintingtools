'use client';

import React from 'react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState, DesignerGradientValue } from '@/types/designer';
import { ColorPicker } from '../controls/ColorPicker';

interface ColorPanelProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
  onClose?: () => void;
}

export const ColorPanel: React.FC<ColorPanelProps> = ({
  canvasManager,
  selected,
  onClose,
}) => {
  const isDrawing = canvasManager?.isDrawingMode() ?? false;

  const isText = Boolean(
    selected &&
    (selected.type === 'textbox' ||
      selected.type === 'i-text' ||
      selected.type === 'text' ||
      selected.text !== undefined)
  );

  const isPath = Boolean(
    selected &&
    (selected.type === 'path' ||
      selected.type === 'brush' ||
      selected.isBrushPath)
  );

  // Shape identity takes priority over Fabric's underlying object type.
  // Custom SVG/photo shapes or placeholder frames must receive shape color controls.
  const isShape = Boolean(
    selected &&
    !isText &&
    !isPath &&
    !selected.isMultiple &&
    (Boolean(selected.isShape) ||
      selected.type === 'shape' ||
      selected.type === 'rect' ||
      selected.type === 'circle' ||
      selected.type === 'triangle' ||
      selected.type === 'polygon' ||
      selected.type === 'line')
  );

  const isImage = Boolean(
    selected &&
    !isShape &&
    (selected.type === 'image' ||
      selected.type === 'fabricImage' ||
      (Boolean(selected.isFrame) && !selected.isCanvaPlaceholder) ||
      Boolean(selected.src))
  );

  const editableColors = selected?.editableColors || canvasManager?.getSelectedEditableColors() || [];
  const hasMultipleColors = editableColors.length > 1;
  const activeColorIndex = selected?.activeColorIndex ?? canvasManager?.getActiveEditableColorIndex() ?? 0;
  const safeActiveIndex = Math.min(Math.max(0, activeColorIndex), Math.max(0, editableColors.length - 1));

  let label = 'Colour';
  let currentValue: string | DesignerGradientValue = '#000000';
  let allowGradient = false;

  if (hasMultipleColors) {
    label = `Colour ${safeActiveIndex + 1}`;
    currentValue = editableColors[safeActiveIndex] || '#000000';
    allowGradient = false;
  } else if (isDrawing && canvasManager) {
    label = 'Brush Colour';
    currentValue = canvasManager.getBrushSettings().color || '#2563eb';
    allowGradient = false;
  } else if (isText && selected) {
    label = 'Text Colour';
    currentValue = selected.fillGradient || selected.fill || '#000000';
    allowGradient = true;
  } else if (isPath && selected) {
    label = 'Stroke Colour';
    currentValue = selected.stroke || (typeof selected.fill === 'string' ? selected.fill : '#2563eb');
    allowGradient = false;
  } else if (isShape && selected) {
    label = 'Shape Colour';
    currentValue = selected.fillGradient || selected.fill || '#2563eb';
    allowGradient = true;
  } else if (selected && !isImage) {
    label = selected.isShape ? 'Shape Colour' : 'Element Colour';
    currentValue = selected.fillGradient || selected.fill || '#2563eb';
    allowGradient = selected.isCanvaPlaceholder !== false;
  } else if (canvasManager) {
    label = 'Background Colour';
    const bgSettings = canvasManager.getBackgroundSettings();
    if (bgSettings.type === 'gradient' && bgSettings.gradient) {
      currentValue = bgSettings.gradient;
    } else {
      currentValue = (bgSettings.color as string) || '#ffffff';
    }
    allowGradient = true;
  }

  const handleColorChange = (value: string | DesignerGradientValue) => {
    if (hasMultipleColors) {
      const pickedColor = typeof value === 'string' ? value : (value?.stops?.[0]?.color || '#000000');
      const sourceColor = editableColors[safeActiveIndex];
      if (sourceColor && canvasManager) {
        canvasManager.updateSelectedColorBySource(sourceColor, pickedColor, safeActiveIndex);
      }
      return;
    }

    if (typeof value === 'object' && value !== null && 'stops' in value) {
      if (isShape || (selected && !isPath && !isDrawing && !isImage)) {
        canvasManager?.setSelectedGradient(value, false);
      } else if (!selected && canvasManager) {
        canvasManager.setBackgroundGradient(value, false);
      }
    } else {
      // Solid color
      if (isDrawing && canvasManager) {
        canvasManager.setBrushSettings({ color: value });
      } else if (isText && selected) {
        canvasManager?.updateSelectedProperty('fill', value);
      } else if (isPath && selected) {
        canvasManager?.updateSelectedProperty('stroke', value);
        canvasManager?.updateSelectedProperty('fill', value);
      } else if (isShape || (selected && !isImage)) {
        canvasManager?.updateSelectedProperty('fill', value);
      } else if (canvasManager) {
        canvasManager.setBackgroundColor(value);
      }
    }
  };

  const handleGradientChange = (gradient: DesignerGradientValue) => {
    if (isShape || (selected && !isPath && !isDrawing && !isImage)) {
      canvasManager?.setSelectedGradient(gradient, true);
    } else if (!selected && canvasManager) {
      canvasManager.setBackgroundGradient(gradient, true);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden bg-white select-none">
      {hasMultipleColors && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Element Colours
            </span>
            <span className="text-[10px] font-medium text-gray-400">
              {safeActiveIndex + 1} of {editableColors.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {editableColors.map((col, i) => (
              <button
                key={`${col}-${i}`}
                type="button"
                onClick={() => canvasManager?.setActiveEditableColorIndex(i)}
                title={`Colour ${i + 1}: ${col}`}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
                  safeActiveIndex === i
                    ? 'border-[#7c3aed] ring-2 ring-[#7c3aed] ring-offset-1 bg-white shadow-xs scale-105'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:scale-102'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-lg border border-black/15 shadow-2xs"
                  style={{ backgroundColor: col }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <ColorPicker
        key={hasMultipleColors ? `multi-${safeActiveIndex}-${editableColors[safeActiveIndex]}` : 'single-color'}
        label={label}
        value={currentValue}
        onChange={handleColorChange}
        canvasManager={canvasManager}
        onClose={onClose}
        embedded
        allowGradient={allowGradient}
        onGradientChange={handleGradientChange}
      />
    </div>
  );
};

export default ColorPanel;
