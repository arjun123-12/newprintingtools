'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Copy } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';

export interface PageData {
  id: string;
  thumbnail: string | null;
  canvasJson: Record<string, any>;
}

interface PageManagerTrayProps {
  pages: PageData[];
  activePageIndex: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  canvasManager: CanvasManager | null;
}

export const PageManagerTray: React.FC<PageManagerTrayProps> = ({
  pages,
  activePageIndex,
  onPageSelect,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  canvasManager,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isExpanded) {
    return (
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#1a1a1a] rounded-t-xl z-30 shadow-lg border-t border-l border-r border-gray-800">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-center w-16 h-6 text-gray-400 hover:text-white transition-colors"
          title="Show Pages"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-gray-800 z-30 transition-transform duration-300">
      {/* Toggle Button */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] rounded-t-xl border-t border-l border-r border-gray-800">
        <button
          onClick={() => setIsExpanded(false)}
          className="flex items-center justify-center w-16 h-6 text-gray-400 hover:text-white transition-colors"
          title="Hide Pages"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 bg-white flex items-center gap-4 overflow-x-auto custom-scrollbar">
        {pages.map((page, idx) => (
          <div
            key={page.id}
            onClick={() => onPageSelect(idx)}
            className={`
              relative group flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden cursor-pointer
              transition-all duration-200 border-2
              ${activePageIndex === idx ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.5)]' : 'border-gray-700 hover:border-gray-500'}
            `}
          >
            {/* Thumbnail */}
            <div className="w-full h-full bg-white flex items-center justify-center">
              {page.thumbnail ? (
                <img
                  src={page.thumbnail}
                  alt={`Page ${idx + 1}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-gray-400 text-xs font-medium">Page {idx + 1}</span>
              )}
            </div>

            {/* Page Number Badge */}
            <div className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
              {idx + 1}
            </div>

            {/* Actions overlay */}
            <div className={`
              absolute top-0 right-0 p-1 flex flex-col gap-1
              opacity-0 group-hover:opacity-100 transition-opacity
              bg-gradient-to-l from-black/50 to-transparent w-full items-end
            `}>
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(idx);
                  }}
                  className="p-1.5 bg-gray-900/80 hover:bg-red-600 text-white rounded-md transition-colors"
                  title="Delete Page"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicatePage(idx);
                }}
                className="p-1.5 bg-gray-900/80 hover:bg-blue-600 text-white rounded-md transition-colors"
                title="Duplicate Page"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {/* Add Page Button */}
        <button
          onClick={onAddPage}
          className="flex-shrink-0 w-32 h-24 rounded-lg border-2 border-dashed border-gray-600 hover:border-gray-400 bg-gray-800 hover:bg-gray-700 flex flex-col items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
          title="Add New Page"
        >
          <Plus className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Add Page</span>
        </button>
      </div>
    </div>
  );
};
