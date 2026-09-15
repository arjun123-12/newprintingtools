'use client';

import React from 'react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';
import {
  ColorPicker,
  ColorGradientValue,
} from '../controls/ColorPicker';

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

  // isShape is explicit because uploaded SVG/photo shapes may internally be
  // Fabric groups or images. Their selected.type alone is not reliable.
  const isShape = Boolean(
    selected &&
    !isText &&
    !isPath &&
    !selected.isMultiple &&
    (selected.isShape ||
      selected.type === 'shape' ||
      selected.type === 'rect' ||
      selected.type === 'circle' ||
      selected.type === 'triangle' ||
      selected.type === 'polygon' ||
      selected.type === 'line')
  );

  let label = 'Colour';
  let currentColor = '#000000';
  let handleColorChange = (color: string) => {
    canvasManager?.setBackgroundColor(color);
  };
  let handleGradientChange: ((gradient: ColorGradientValue) => void) | undefined;

  if (isDrawing && canvasManager) {
    label = 'Brush Colour';
    currentColor = canvasManager.getBrushSettings().color || '#2563eb';
    handleColorChange = (color: string) => {
      canvasManager.setBrushSettings({ color });
    };
  } else if (isText && selected) {
    label = 'Text Colour';
    currentColor = selected.fill || '#000000';
    handleColorChange = (color: string) => {
      canvasManager?.updateSelectedProperty('fill', color);
    };
  } else if (isShape && selected) {
    label = 'Shape Colour';
    currentColor = selected.fill || '#2563eb';
    handleColorChange = (color: string) => {
      canvasManager?.updateSelectedProperty('fill', color);
    };
    handleGradientChange = (gradient: ColorGradientValue) => {
      canvasManager?.setSelectedGradient(gradient);
    };
  } else if (isPath && selected) {
    label = 'Stroke Colour';
    currentColor = selected.stroke || selected.fill || '#2563eb';
    handleColorChange = (color: string) => {
      if (!canvasManager) return;
      canvasManager.updateSelectedProperty('stroke', color);
      canvasManager.updateSelectedProperty('fill', color);
    };
  } else if (canvasManager) {
    label = 'Background Colour';
    currentColor =
      (canvasManager.getBackgroundSettings().color as string) || '#ffffff';
    handleColorChange = (color: string) => {
      canvasManager.setBackgroundColor(color);
    };
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white select-none">
      <ColorPicker
        label={label}
        value={currentColor}
        onChange={handleColorChange}
        canvasManager={canvasManager}
        onClose={onClose}
        embedded
        allowGradient={isShape && selected?.isCanvaPlaceholder !== false}
        onGradientChange={handleGradientChange}
      />
    </div>
  );
};

export default ColorPanel;
