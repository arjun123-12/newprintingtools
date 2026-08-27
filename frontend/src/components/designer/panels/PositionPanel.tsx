'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Lock,
  Unlock,
  RotateCw,
  Layers,
  Sliders,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { AlignmentType, SelectedObjectState } from '@/types/designer';
import { LayersPanel } from './LayersPanel';

interface PositionPanelProps {
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
  onClose?: () => void;
}

export const PositionPanel: React.FC<PositionPanelProps> = ({
  canvasManager,
  selected,
  onClose,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'arrange' | 'layers'>('arrange');
  const [isRatioLocked, setIsRatioLocked] = useState<boolean>(true);

  // Local state for numeric inputs
  const [localWidth, setLocalWidth] = useState<number>(100);
  const [localHeight, setLocalHeight] = useState<number>(100);
  const [localX, setLocalX] = useState<number>(0);
  const [localY, setLocalY] = useState<number>(0);
  const [localAngle, setLocalAngle] = useState<number>(0);

  // Keep local inputs synchronized with active selection
  useEffect(() => {
    if (!selected) return;
    const computedW = Math.round((selected.width || 0) * (selected.scaleX || 1));
    const computedH = Math.round((selected.height || 0) * (selected.scaleY || 1));
    setLocalWidth(Math.max(computedW, 1));
    setLocalHeight(Math.max(computedH, 1));
    setLocalX(Math.round(selected.left || 0));
    setLocalY(Math.round(selected.top || 0));
    setLocalAngle(Math.round(selected.angle || 0));
  }, [selected?.id, selected?.left, selected?.top, selected?.width, selected?.height, selected?.scaleX, selected?.scaleY, selected?.angle]);

  const handleAlign = (type: AlignmentType) => {
    if (!canvasManager) return;
    canvasManager.alignSelected(type);
  };

  const handleWidthChange = (newWidth: number) => {
    const validW = Math.max(Number(newWidth) || 1, 1);
    setLocalWidth(validW);
    if (!canvasManager || !selected) return;

    if (isRatioLocked && localWidth > 0) {
      const ratio = localHeight / localWidth;
      const newHeight = Math.max(Math.round(validW * ratio), 1);
      setLocalHeight(newHeight);
      canvasManager.updateSelectedProperty('width', validW);
      canvasManager.updateSelectedProperty('height', newHeight);
    } else {
      canvasManager.updateSelectedProperty('width', validW);
    }
  };

  const handleHeightChange = (newHeight: number) => {
    const validH = Math.max(Number(newHeight) || 1, 1);
    setLocalHeight(validH);
    if (!canvasManager || !selected) return;

    if (isRatioLocked && localHeight > 0) {
      const ratio = localWidth / localHeight;
      const newWidth = Math.max(Math.round(validH * ratio), 1);
      setLocalWidth(newWidth);
      canvasManager.updateSelectedProperty('height', validH);
      canvasManager.updateSelectedProperty('width', newWidth);
    } else {
      canvasManager.updateSelectedProperty('height', validH);
    }
  };

  const handleXChange = (newX: number) => {
    const validX = Number(newX) || 0;
    setLocalX(validX);
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty('left', validX);
  };

  const handleYChange = (newY: number) => {
    const validY = Number(newY) || 0;
    setLocalY(validY);
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty('top', validY);
  };

  const handleAngleChange = (newAngle: number) => {
    let normalized = Math.round(Number(newAngle) || 0) % 360;
    if (normalized < 0) normalized += 360;
    setLocalAngle(normalized);
    if (!canvasManager) return;
    canvasManager.updateSelectedProperty('angle', normalized);
  };

  const hasSelection = Boolean(selected);

  return (
    <div className="flex flex-col h-full bg-white text-gray-800 select-none overflow-hidden">
      {/* ================================================================ */}
      {/* 1. TOP HEADER                                                    */}
      {/* ================================================================ */}
      <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-white shrink-0">
        <h2 className="font-bold text-sm text-gray-900">Position</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close position panel"
            className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ================================================================ */}
      {/* 2. SUB-TABS (Arrange vs Layers)                                  */}
      {/* ================================================================ */}
      <div className="flex border-b border-gray-200 bg-white shrink-0 px-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('arrange')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all relative ${
            activeSubTab === 'arrange'
              ? 'text-[#7c3aed]'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          Arrange
          {activeSubTab === 'arrange' && (
            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#7c3aed] rounded-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('layers')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all relative ${
            activeSubTab === 'layers'
              ? 'text-[#7c3aed]'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          Layers
          {activeSubTab === 'layers' && (
            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#7c3aed] rounded-full" />
          )}
        </button>
      </div>

      {/* ================================================================ */}
      {/* 3. SUBTAB CONTENT                                                */}
      {/* ================================================================ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5 bg-white">
        {activeSubTab === 'layers' ? (
          <div className="-m-4">
            <LayersPanel canvasManager={canvasManager} selected={selected} />
          </div>
        ) : (
          <>
            {/* 3A. LAYER ORDER (Forward / Backward / To front / To back) */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => canvasManager?.bringForward()}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <svg className="w-4 h-4 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 11 12 6 7 11" />
                    <polyline points="17 18 12 13 7 18" />
                  </svg>
                  <span>Forward</span>
                </button>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => canvasManager?.sendBackward()}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <svg className="w-4 h-4 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="7 13 12 18 17 13" />
                    <polyline points="7 6 12 11 17 6" />
                  </svg>
                  <span>Backward</span>
                </button>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => canvasManager?.bringToFront()}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <BringToFront className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>To front</span>
                </button>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => canvasManager?.sendToBack()}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <SendToBack className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>To back</span>
                </button>
              </div>
            </div>

            {/* 3B. ALIGN TO PAGE */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-900 block">
                Align to page
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => handleAlign('top')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <AlignStartVertical className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>Top</span>
                </button>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => handleAlign('left')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <AlignLeft className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>Left</span>
                </button>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => handleAlign('middle')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <AlignCenterVertical className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>Middle</span>
                </button>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => handleAlign('center')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <AlignCenter className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>Centre</span>
                </button>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => handleAlign('bottom')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <AlignEndVertical className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>Bottom</span>
                </button>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => handleAlign('right')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-800 shadow-2xs transition"
                >
                  <AlignRight className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>Right</span>
                </button>
              </div>
            </div>

            {/* 3C. ADVANCED (Width, Height, Ratio, X, Y, Rotate) */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-900 block">
                Advanced
              </span>

              {/* Width / Height / Ratio Row */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 block mb-1">
                      Width
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        disabled={!hasSelection}
                        value={localWidth}
                        onChange={(e) => handleWidthChange(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] transition disabled:opacity-40"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-sans">
                        px
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-gray-500 block mb-1">
                      Height
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        disabled={!hasSelection}
                        value={localHeight}
                        onChange={(e) => handleHeightChange(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] transition disabled:opacity-40"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-sans">
                        px
                      </span>
                    </div>
                  </div>

                  <div className="pt-5">
                    <button
                      type="button"
                      disabled={!hasSelection}
                      onClick={() => setIsRatioLocked((prev) => !prev)}
                      title={isRatioLocked ? 'Lock aspect ratio (active)' : 'Unlock aspect ratio'}
                      className={`p-2 rounded-lg border transition ${
                        isRatioLocked
                          ? 'bg-[#f0ebff] border-[#8b5cf6] text-[#7c3aed]'
                          : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      {isRatioLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* X & Y Coordinate Position Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-1">
                    X Position
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      disabled={!hasSelection}
                      value={localX}
                      onChange={(e) => handleXChange(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] transition disabled:opacity-40"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-sans">
                      px
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-1">
                    Y Position
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      disabled={!hasSelection}
                      value={localY}
                      onChange={(e) => handleYChange(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] transition disabled:opacity-40"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-sans">
                      px
                    </span>
                  </div>
                </div>
              </div>

              {/* Rotate Angle Control */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-gray-500 block">
                    Rotate
                  </label>
                  <span className="text-xs font-mono font-bold text-gray-800">
                    {localAngle}°
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    disabled={!hasSelection}
                    value={localAngle}
                    onChange={(e) => handleAngleChange(Number(e.target.value))}
                    className="flex-1 accent-[#7c3aed] cursor-pointer h-1.5 bg-gray-200 rounded-lg disabled:opacity-40"
                  />
                  <input
                    type="number"
                    min="0"
                    max="360"
                    disabled={!hasSelection}
                    value={localAngle}
                    onChange={(e) => handleAngleChange(Number(e.target.value))}
                    className="w-14 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-center text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] transition disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
