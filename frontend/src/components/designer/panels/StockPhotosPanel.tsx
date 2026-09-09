'use client';

import React, { useState } from 'react';
import { Sparkles, Camera, Image as ImageIcon } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { PixabayPanel } from './PixabayPanel';
import { FreepikPanel } from './FreepikPanel';
import { PexelsPanel } from './PexelsPanel';

interface StockPhotosPanelProps {
  canvasManager: CanvasManager | null;
}

export const StockPhotosPanel: React.FC<StockPhotosPanelProps> = ({
  canvasManager,
}) => {
  const [provider, setProvider] = useState<'pexels' | 'pixabay' | 'freepik'>('pexels');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Provider Switcher */}
      <div className="px-3.5 pt-3 pb-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center p-1 bg-slate-200/80 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setProvider('pexels')}
            className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg font-bold text-[11px] transition-all ${
              provider === 'pexels'
                ? 'bg-white text-[#05a081] shadow-sm ring-1 ring-black/[0.03]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-[#05a081]" />
            <span>Pexels</span>
          </button>
          <button
            type="button"
            onClick={() => setProvider('pixabay')}
            className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg font-bold text-[11px] transition-all ${
              provider === 'pixabay'
                ? 'bg-white text-purple-700 shadow-sm ring-1 ring-black/[0.03]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
            <span>Pixabay</span>
          </button>
          <button
            type="button"
            onClick={() => setProvider('freepik')}
            className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg font-bold text-[11px] transition-all ${
              provider === 'freepik'
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/[0.03]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Freepik</span>
          </button>
        </div>
      </div>

      {/* Provider Panel Body */}
      <div className="flex-1 overflow-hidden">
        {provider === 'pexels' && <PexelsPanel canvasManager={canvasManager} />}
        {provider === 'pixabay' && <PixabayPanel canvasManager={canvasManager} />}
        {provider === 'freepik' && <FreepikPanel canvasManager={canvasManager} />}
      </div>
    </div>
  );
};

