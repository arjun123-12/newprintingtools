'use client';

import React from 'react';
import {
  LayoutTemplate,
  Sparkles,
  Type,
  Image as ImageIcon,
  UploadCloud,
  Layers,
  Paintbrush,
  Wallpaper,
  ChevronLeft,
} from 'lucide-react';
import { ActiveSidebarTab, SelectedObjectState } from '@/types/designer';
import { CanvasManager } from './canvas/CanvasManager';
import { TemplatesPanel } from './panels/TemplatesPanel';
import { ElementsPanel } from './panels/ElementsPanel';
import { TextPanel } from './panels/TextPanel';
import { StockPhotosPanel } from './panels/StockPhotosPanel';
import { UploadsPanel } from './panels/UploadsPanel';
import { BrushPanel } from './panels/BrushPanel';
import { LayersPanel } from './panels/LayersPanel';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { BorderPanel } from './panels/BorderPanel';

interface DesignerSidebarProps {
  activeTab: ActiveSidebarTab;
  onSelectTab: (tab: ActiveSidebarTab) => void;
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
}

interface TabItem {
  id: ActiveSidebarTab;
  label: string;
  icon: React.ElementType;
}

const SIDEBAR_TABS: TabItem[] = [
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'elements', label: 'Elements', icon: Sparkles },
  { id: 'photos', label: 'Photos', icon: ImageIcon },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'uploads', label: 'Uploads', icon: UploadCloud },
  { id: 'draw', label: 'Draw', icon: Paintbrush },
  { id: 'background', label: 'Background', icon: Wallpaper },
  { id: 'layers', label: 'Layers', icon: Layers },
];

export const DesignerSidebar: React.FC<DesignerSidebarProps> = ({
  activeTab,
  onSelectTab,
  canvasManager,
  selected,
}) => {
  const stopDrawingIfActive = () => {
    if (activeTab === 'draw' && canvasManager) {
      canvasManager.disableDrawingMode();
      if (canvasManager.getBrushSettings().tool === 'eraser') {
        canvasManager.setBrushSettings({ tool: 'brush' });
      }
    }
  };

  const handleTabClick = (tabId: ActiveSidebarTab) => {
    if (activeTab === tabId) {
      stopDrawingIfActive();
      onSelectTab(null); // toggle collapse
    } else {
      stopDrawingIfActive();
      onSelectTab(tabId);
    }
  };

  const getPanelTitle = () => {
    if (activeTab === 'photos') return 'Stock Photos';
    if (activeTab === 'draw') return 'Illustrator Draw';
    return activeTab;
  };

  return (
    <div className="flex h-full min-h-0 flex-shrink-0 z-30 select-none bg-white">
      {/* Icon Navigation Dock */}
      <aside className="w-18 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-2 z-20 shadow-xs">
        {SIDEBAR_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`
    w-16 h-15 rounded-xl py-2 flex flex-col items-center justify-center gap-1
    border transition-all duration-200 ease-in-out
    ${isActive
                  ? `
          bg-[#f0ebff]
          border-[#8b5cf6]
          text-[#7c3aed]
          shadow-sm
        `
                  : `
          bg-white
          border-transparent
          text-[#5f6368]
          hover:bg-[#f7f7f8]
          hover:border-[#d9d9df]
          hover:text-[#7c3aed]
          hover:shadow-sm
        `
                }
  `}
            >
              <Icon
                className={`
      w-5 h-5 transition-colors duration-200
      ${isActive ? 'text-[#7c3aed]' : 'text-[#5f6368] group-hover:text-[#7c3aed]'}
    `}
              />

              <span
                className={`
      text-[10px] tracking-tight transition-colors duration-200
      ${isActive ? 'font-semibold' : 'font-medium'}
    `}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </aside>

      {/* Expandable Drawer Panel */}
      {activeTab && (
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden shadow-xl relative animate-in slide-in-from-left duration-200">
          {/* Drawer Header */}
          <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-gray-50/50">
            <span className="font-bold text-sm text-gray-800 capitalize">
              {getPanelTitle()}
            </span>
            <button
              type="button"
              onClick={() => {
                stopDrawingIfActive();
                onSelectTab(null);
              }}
              title="Close panel"
              className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-200/60 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            {activeTab === 'templates' && <TemplatesPanel canvasManager={canvasManager} />}
            {activeTab === 'elements' && <ElementsPanel canvasManager={canvasManager} />}
            {activeTab === 'photos' && <StockPhotosPanel canvasManager={canvasManager} />}
            {activeTab === 'text' && <TextPanel canvasManager={canvasManager} />}
            {activeTab === 'uploads' && <UploadsPanel canvasManager={canvasManager} />}
            {activeTab === 'draw' && <BrushPanel canvasManager={canvasManager} />}
            {activeTab === 'background' && <BackgroundPanel canvasManager={canvasManager} />}
            {activeTab === 'layers' && (
              <LayersPanel canvasManager={canvasManager} selected={selected} />
            )}
            {activeTab === 'border' && (
              <BorderPanel canvasManager={canvasManager} selected={selected} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
