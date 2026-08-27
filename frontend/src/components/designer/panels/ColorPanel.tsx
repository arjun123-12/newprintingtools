'use client';

import React from 'react';
import { CanvasManager } from '../canvas/CanvasManager';
import { SelectedObjectState } from '@/types/designer';
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
      (selected.type === 'path' || selected.type === 'brush' || selected.isBrushPath)
  );
  const isShape = Boolean(selected && !isText && !isPath && selected.type !== 'image');

  let label = 'Colour';
  let currentColor = '#000000';
  let handleColorChange = (color: string) => {
    if (!canvasManager) return;
    canvasManager.setBackgroundColor(color);
  };

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
      if (!canvasManager) return;
      canvasManager.updateSelectedProperty('fill', color);
    };
  } else if (isShape && selected) {
    label = 'Shape Colour';
    currentColor = selected.fill || '#2563eb';
    handleColorChange = (color: string) => {
      if (!canvasManager) return;
      canvasManager.updateSelectedProperty('fill', color);
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
    currentColor = (canvasManager.getBackgroundSettings().color as string) || '#ffffff';
    handleColorChange = (color: string) => {
      canvasManager.setBackgroundColor(color);
    };
  }

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden">
      <ColorPicker
        label={label}
        value={currentColor}
        onChange={handleColorChange}
        canvasManager={canvasManager}
        onClose={onClose}
        embedded={true}
      />
    </div>
  );
};
