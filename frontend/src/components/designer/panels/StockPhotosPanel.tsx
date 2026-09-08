'use client';

import React from 'react';
import { CanvasManager } from '../canvas/CanvasManager';
import { PixabayPanel } from './PixabayPanel';

interface StockPhotosPanelProps {
  canvasManager: CanvasManager | null;
}

export const StockPhotosPanel: React.FC<StockPhotosPanelProps> = ({ canvasManager }) => {
  return <PixabayPanel canvasManager={canvasManager} />;
};
