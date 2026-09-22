'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Crop,
  GripHorizontal,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Move,
  Paintbrush,
  Shapes,
  Smile,
  Sparkles,
  Type,
  UploadCloud,
  Wallpaper,
  X,
} from 'lucide-react';
import {
  ActiveSidebarTab,
  DesignerTemplate,
  SelectedObjectState,
} from '@/types/designer';
import { CanvasManager } from './canvas/CanvasManager';
import { TemplatesPanel } from './panels/TemplatesPanel';
import { ElementsPanel } from './panels/ElementsPanel';
import { ShapesPanel } from './panels/ShapesPanel';
import { FramesPanel } from './panels/FramesPanel';
import { StockPhotosPanel } from './panels/StockPhotosPanel';
import { FreepikPanel } from './panels/FreepikPanel';
import { UploadsPanel } from './panels/UploadsPanel';
import { IconsPanel } from './panels/IconsPanel';
import { TextPanel } from './panels/TextPanel';
import { LayersPanel } from './panels/LayersPanel';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { BorderPanel } from './panels/BorderPanel';
import { PositionPanel } from './panels/PositionPanel';
import ColorPanel from './panels/ColorPanel';
import { TextEffectsPanel } from './panels/TextEffectsPanel';

interface DesignerSidebarProps {
  activeTab: ActiveSidebarTab;
  onSelectTab: (tab: ActiveSidebarTab) => void;
  canvasManager: CanvasManager | null;
  selected: SelectedObjectState | null;
  productId: string;
  onApplyTemplate?: (
    template: DesignerTemplate
  ) => void | Promise<void>;
}

interface TabItem {
  id: ActiveSidebarTab;
  label: string;
  icon: React.ElementType;
}

const SIDEBAR_TABS: TabItem[] = [
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'elements', label: 'Elements', icon: Sparkles },
  { id: 'shapes', label: 'Shapes', icon: Shapes },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'uploads', label: 'Uploads', icon: UploadCloud },
  { id: 'photos', label: 'Photos', icon: ImageIcon },
  { id: 'freepik', label: 'Freepik', icon: Sparkles },
  { id: 'icons', label: 'Icons', icon: Smile },
  { id: 'frames', label: 'Frames', icon: Crop },
  { id: 'draw', label: 'Draw', icon: Paintbrush },
  { id: 'background', label: 'Background', icon: Wallpaper },
  { id: 'layers', label: 'Layers', icon: Layers },
];

const FLOATING_FRAME_WIDTH = 340;
const FLOATING_FRAME_HEIGHT = 560;

export const DesignerSidebar: React.FC<DesignerSidebarProps> = ({
  activeTab,
  onSelectTab,
  canvasManager,
  selected,
  productId,
  onApplyTemplate,
}) => {
  const [framesDetached, setFramesDetached] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState({
    x: 110,
    y: 92,
  });

  const dragStateRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = window.localStorage.getItem(
      'print_designer_floating_frames_position'
    );

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (
        Number.isFinite(parsed?.x) &&
        Number.isFinite(parsed?.y)
      ) {
        setFloatingPosition({
          x: Math.max(0, parsed.x),
          y: Math.max(0, parsed.y),
        });
      }
    } catch {
      // Ignore malformed saved panel position.
    }
  }, []);

  const stopDrawingIfActive = () => {
    if (activeTab === 'draw' && canvasManager) {
      canvasManager.disableDrawingMode();

      if (canvasManager.getBrushSettings().tool === 'eraser') {
        canvasManager.setBrushSettings({ tool: 'brush' });
      }
    }
  };

  const handleTabClick = (tabId: ActiveSidebarTab) => {
    if (tabId === 'frames' && framesDetached) {
      onSelectTab(activeTab === 'frames' ? null : 'frames');
      return;
    }

    if (activeTab === tabId) {
      stopDrawingIfActive();
      onSelectTab(null);
      return;
    }

    stopDrawingIfActive();
    onSelectTab(tabId);
  };

  const getPanelTitle = () => {
    if (activeTab === 'freepik') return 'Freepik Media';
    if (activeTab === 'photos') return 'Stock Photos';
    if (activeTab === 'icons') return 'Icons Library';
    if (activeTab === 'draw') return 'Illustrator Draw';
    if (activeTab === 'shapes') return 'Shapes & Photo Fill';
    if (activeTab === 'border') return 'Stroke';
    if (activeTab === 'color') return 'Colour & Gradient';
    if (activeTab === 'effects') return 'Effects';
    if (activeTab === 'position') return 'Position';
    return activeTab ?? '';
  };

  const detachFramesPanel = () => {
    setFramesDetached(true);
    onSelectTab('frames');
  };

  const dockFramesPanel = () => {
    setFramesDetached(false);
    onSelectTab('frames');
  };

  const closeFloatingFrames = () => {
    onSelectTab(null);
  };

  const clampFloatingPosition = (x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };

    return {
      x: Math.min(
        Math.max(8, x),
        Math.max(8, window.innerWidth - FLOATING_FRAME_WIDTH - 8)
      ),
      y: Math.min(
        Math.max(56, y),
        Math.max(56, window.innerHeight - 90)
      ),
    };
  };

  const handleFloatingPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - floatingPosition.x,
      offsetY: event.clientY - floatingPosition.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleFloatingPointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const dragState = dragStateRef.current;

    if (
      !dragState ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    const next = clampFloatingPosition(
      event.clientX - dragState.offsetX,
      event.clientY - dragState.offsetY
    );

    setFloatingPosition(next);
  };

  const stopFloatingDrag = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'print_designer_floating_frames_position',
        JSON.stringify(floatingPosition)
      );
    }
  };

  const shouldShowDockedPanel =
    activeTab &&
    activeTab !== 'draw' &&
    !(activeTab === 'frames' && framesDetached);

  const showFloatingFrames =
    framesDetached && activeTab === 'frames';

  return (
    <>
      <div className="flex h-full min-h-0 flex-shrink-0 z-30 select-none bg-white">
        <aside className="w-18 bg-white border-r border-gray-200 flex flex-col items-center py-2.5 gap-1.5 z-20 shadow-xs h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
          {SIDEBAR_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`
                  group w-16 h-14 rounded-xl py-1.5 flex flex-col items-center justify-center gap-1
                  border transition-all duration-200 ease-in-out shrink-0
                  ${isActive
                    ? 'bg-[#f0ebff] border-[#8b5cf6] text-[#7c3aed] shadow-sm'
                    : 'bg-white border-transparent text-[#5f6368] hover:bg-[#f7f7f8] hover:border-[#d9d9df] hover:text-[#7c3aed] hover:shadow-sm'
                  }
                `}
              >
                <Icon
                  className={`w-5 h-5 transition-colors duration-200 ${isActive
                    ? 'text-[#7c3aed]'
                    : 'text-[#5f6368] group-hover:text-[#7c3aed]'
                    }`}
                />
                <span
                  className={`text-[10px] tracking-tight transition-colors duration-200 ${isActive ? 'font-semibold' : 'font-medium'
                    }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </aside>

        {shouldShowDockedPanel && (
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-xl relative animate-in slide-in-from-left duration-200">
            <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between bg-gray-50/50">
              <span className="font-bold text-sm text-gray-800 capitalize">
                {getPanelTitle()}
              </span>

              <div className="flex items-center gap-1">
                {activeTab === 'frames' && (
                  <button
                    type="button"
                    onClick={detachFramesPanel}
                    title="Detach Frames panel"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-purple-700 hover:bg-purple-100 transition"
                  >
                    <Move className="w-3.5 h-3.5" />
                    Detach
                  </button>
                )}

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
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
              {activeTab === 'templates' && (
                <TemplatesPanel
                  canvasManager={canvasManager}
                  productId={productId}
                  onApplyTemplate={onApplyTemplate}
                />
              )}

              {activeTab === 'elements' && (
                <ElementsPanel
                  canvasManager={canvasManager}
                  onSelectTab={onSelectTab}
                />
              )}

              {activeTab === 'shapes' && (
                <ShapesPanel
                  canvasManager={canvasManager}
                  selected={selected}
                />
              )}

              {activeTab === 'frames' && (
                <FramesPanel canvasManager={canvasManager} />
              )}

              {activeTab === 'icons' && (
                <IconsPanel canvasManager={canvasManager} />
              )}

              {activeTab === 'photos' && (
                <StockPhotosPanel canvasManager={canvasManager} />
              )}

              {activeTab === 'freepik' && (
                <FreepikPanel canvasManager={canvasManager} />
              )}

              {activeTab === 'text' && (
                <TextPanel
                  canvasManager={canvasManager}
                  selected={selected}
                />
              )}

              {activeTab === 'uploads' && (
                <UploadsPanel canvasManager={canvasManager} />
              )}

              {activeTab === 'background' && (
                <BackgroundPanel canvasManager={canvasManager} />
              )}

              {activeTab === 'layers' && (
                <LayersPanel
                  canvasManager={canvasManager}
                  selected={selected}
                />
              )}

              {activeTab === 'border' && (
                <BorderPanel
                  canvasManager={canvasManager}
                  selected={selected}
                  onClose={() => onSelectTab(null)}
                />
              )}

              {activeTab === 'position' && (
                <PositionPanel
                  canvasManager={canvasManager}
                  selected={selected}
                  onClose={() => onSelectTab(null)}
                />
              )}

              {activeTab === 'color' && (
                <ColorPanel
                  canvasManager={canvasManager}
                  selected={selected}
                  onClose={() => onSelectTab(null)}
                />
              )}

              {activeTab === 'effects' && selected && (
                <div className="p-4">
                  <TextEffectsPanel
                    canvasManager={canvasManager}
                    selected={selected}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showFloatingFrames && (
        <div
          className="fixed z-[75] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          style={{
            left: floatingPosition.x,
            top: floatingPosition.y,
            width: FLOATING_FRAME_WIDTH,
            height: `min(${FLOATING_FRAME_HEIGHT}px, calc(100vh - 110px))`,
          }}
        >
          <div
            className="h-11 shrink-0 border-b border-gray-200 bg-gray-50/95 px-3 flex items-center justify-between cursor-move touch-none"
            onPointerDown={handleFloatingPointerDown}
            onPointerMove={handleFloatingPointerMove}
            onPointerUp={stopFloatingDrag}
            onPointerCancel={stopFloatingDrag}
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
              <Crop className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-gray-800">
                Frames
              </span>
            </div>

            <div
              className="flex items-center gap-1"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={dockFramesPanel}
                title="Dock Frames panel"
                className="rounded-md px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-200 transition"
              >
                Dock
              </button>

              <button
                type="button"
                onClick={closeFloatingFrames}
                title="Close Frames panel"
                className="p-1 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <FramesPanel canvasManager={canvasManager} />
          </div>
        </div>
      )}
    </>
  );
};

export default DesignerSidebar;
