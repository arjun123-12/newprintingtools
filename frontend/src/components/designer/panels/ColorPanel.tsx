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

  let label = 'Colour';
  let currentValue: string | DesignerGradientValue = '#000000';
  let allowGradient = false;

  if (isDrawing && canvasManager) {
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
      <ColorPicker
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
