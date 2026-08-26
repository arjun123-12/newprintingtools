'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Printer,
  Save,
  Download,
  Eye,
  Undo2,
  Redo2,
  Hand,
  MousePointer,
  Sliders,
  Layers,
  ChevronDown,
  ArrowLeft,
  FileCheck,
  CheckCircle2,
  Maximize2,
  FileCode,
  Image as ImageIcon,
  History,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Move,
} from 'lucide-react';
import { DocumentSettings } from '@/types/designer';
import { ZoomControls } from './controls/ZoomControls';
import { CanvasManager } from './canvas/CanvasManager';
import { PreflightBadge } from './controls/PreflightBadge';
import { PreflightReport } from './utils/preflightCheck';

interface DesignerToolbarProps {
  designName: string;
  onDesignNameChange: (name: string) => void;
  documentSettings: DocumentSettings;
  isPanMode: boolean;
  onTogglePanMode: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitCanvas: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isPropertiesOpen?: boolean;
  onToggleProperties?: () => void;
  showGuides: boolean;
  onToggleGuides: () => void;
  onSave?: () => void;
  onSaveVersion?: () => void;
  onOpenPreview?: () => void;
  onOpenCustomSize?: () => void;
  onExportPng?: () => void;
  onExportJpg?: () => void;
  onExportPsd?: () => void;
  canvasManager?: CanvasManager | null;
  preflightReport?: PreflightReport | null;
}

export const DesignerToolbar: React.FC<DesignerToolbarProps> = ({
  designName,
  onDesignNameChange,
  documentSettings,
  isPanMode,
  onTogglePanMode,
  zoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitCanvas,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isPropertiesOpen = true,
  onToggleProperties,
  showGuides,
  onToggleGuides,
  onSave,
  onSaveVersion,
  onOpenPreview,
  onOpenCustomSize,
  onExportPng,
  onExportJpg,
  onExportPsd,
  canvasManager = null,
  preflightReport = null,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'file' | 'view' | 'export' | 'align' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const alignMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        exportMenuRef.current &&
        !exportMenuRef.current.contains(target) &&
        alignMenuRef.current &&
        !alignMenuRef.current.contains(target)
      ) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 flex-shrink-0 bg-white text-gray-800 border-b border-gray-200 flex items-center justify-between px-4 z-40 select-none shadow-xs">
      {/* Left section: Navigation, Menus & Document Title */}
      <div className="flex items-center gap-3" ref={menuRef}>
        <Link
          href="/"
          className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
          title="Back to store"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Logo / Brand Icon */}
        <div className="flex items-center gap-2 pr-2 border-r border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Printer className="w-4 h-4" />
          </div>
          <span className="font-bold text-xs tracking-tight text-gray-900 hidden md:inline">
            PrintStudio Pro
          </span>
        </div>

        {/* Menus: File, View, Size */}
        <div className="flex items-center gap-1 text-xs">
          {/* File Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
              className="px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition flex items-center gap-1"
            >
              <span>File</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {activeMenu === 'file' && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    if (onSave) onSave();
                    setActiveMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Save className="w-3.5 h-3.5 text-gray-400" />
                    <span>Save Draft</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">Ctrl+S</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSaveVersion) onSaveVersion();
                    setActiveMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-gray-400" />
                    <span>Save New Version</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenCustomSize) onOpenCustomSize();
                    setActiveMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Maximize2 className="w-3.5 h-3.5 text-gray-400" />
                    <span>Banner / Custom Size...</span>
                  </span>
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenPreview) onOpenPreview();
                    setActiveMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                    <span>Print Preview</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
              className="px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition flex items-center gap-1"
            >
              <span>View</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {activeMenu === 'view' && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    onToggleGuides();
                    setActiveMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>Show Bleed & Safe Guides</span>
                  <span className="text-[10px] text-gray-400">{showGuides ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (canvasManager) {
                      const cur = canvasManager.getSmartGuidesEnabled();
                      canvasManager.setSmartGuidesEnabled(!cur);
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>Smart Snapping</span>
                  <span className="text-[10px] text-gray-400">
                    {canvasManager?.getSmartGuidesEnabled() !== false ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (canvasManager) {
                      canvasManager.clearUserGuides();
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>Clear User Ruler Guides</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onFitCanvas();
                    setActiveMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>Fit Canvas to Screen</span>
                  <span className="text-[10px] text-gray-400">Ctrl+0</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetZoom();
                    setActiveMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>Reset 100% Zoom</span>
                  <span className="text-[10px] text-gray-400">Ctrl+1</span>
                </button>
              </div>
            )}
          </div>

          {/* Custom Banner / Size Trigger Button */}
          {onOpenCustomSize && (
            <button
              type="button"
              onClick={onOpenCustomSize}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-blue-700 bg-blue-50/80 hover:bg-blue-100 font-semibold transition"
              title="Change banner or artwork dimensions"
            >
              <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {documentSettings.width} × {documentSettings.height} {documentSettings.unit}
              </span>
            </button>
          )}
        </div>

        {/* Editable Design Title */}
        <div className="hidden sm:flex items-center pl-2">
          {isEditingName ? (
            <input
              type="text"
              value={designName}
              onChange={(e) => onDesignNameChange(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditingName(false);
              }}
              autoFocus
              className="text-xs font-semibold px-2 py-1 rounded border border-blue-500 bg-blue-50/30 text-gray-900 focus:outline-none max-w-[200px]"
            />
          ) : (
            <span
              onClick={() => setIsEditingName(true)}
              className="text-xs font-semibold text-gray-700 hover:text-blue-600 hover:bg-gray-50 px-2 py-1 rounded cursor-pointer transition truncate max-w-[200px]"
              title="Click to rename design"
            >
              {designName}
            </span>
          )}
        </div>
      </div>

      {/* Center Section: Undo/Redo, Mode Toggles, Guides & Zoom */}
      <div className="flex items-center gap-1.5">
        {/* Undo / Redo */}
        <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5 mr-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-white transition disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-white transition disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Pointer (V) vs Pan (H) Mode */}
        <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5">
          <button
            type="button"
            onClick={onTogglePanMode}
            title="Select & Move Objects (V)"
            className={`p-1.5 rounded-md transition ${
              !isPanMode
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MousePointer className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePanMode}
            title="Pan Hand Tool (H)"
            className={`p-1.5 rounded-md transition ${
              isPanMode
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Hand className="w-4 h-4" />
          </button>
        </div>

        {/* Guides Toggle Button */}
        <button
          type="button"
          onClick={onToggleGuides}
          title={`Toggle Print Safe Zone & Bleed Guides (Ctrl+;) - Currently ${showGuides ? 'ON' : 'OFF'}`}
          className={`p-2 rounded-lg border transition ${
            showGuides
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-2xs'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Element Alignment Dropdown Menu */}
        <div className="relative" ref={alignMenuRef}>
          <button
            type="button"
            onClick={() => setActiveMenu(activeMenu === 'align' ? null : 'align')}
            title="Align Elements to Canvas (Left, Center, Right, Top, Middle, Bottom)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
              activeMenu === 'align'
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <AlignCenter className="w-3.5 h-3.5 text-gray-600" />
            <span className="hidden sm:inline">Align</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {activeMenu === 'align' && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none space-y-3"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <AlignCenter className="w-3.5 h-3.5 text-blue-600" />
                  <span>Align to Canvas</span>
                </span>
              </div>

              {/* Horizontal Alignment */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Horizontal
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      canvasManager?.alignSelected('left');
                      setActiveMenu(null);
                    }}
                    title="Align Left"
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition text-[11px] font-semibold text-gray-700 hover:text-blue-700 shadow-2xs"
                  >
                    <AlignLeft className="w-4 h-4" />
                    <span>Left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      canvasManager?.alignSelected('center');
                      setActiveMenu(null);
                    }}
                    title="Center Horizontally"
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition text-[11px] font-semibold text-gray-700 hover:text-blue-700 shadow-2xs"
                  >
                    <AlignCenter className="w-4 h-4" />
                    <span>Center</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      canvasManager?.alignSelected('right');
                      setActiveMenu(null);
                    }}
                    title="Align Right"
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition text-[11px] font-semibold text-gray-700 hover:text-blue-700 shadow-2xs"
                  >
                    <AlignRight className="w-4 h-4" />
                    <span>Right</span>
                  </button>
                </div>
              </div>

              {/* Vertical Alignment */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Vertical
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      canvasManager?.alignSelected('top');
                      setActiveMenu(null);
                    }}
                    title="Align Top"
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition text-[11px] font-semibold text-gray-700 hover:text-blue-700 shadow-2xs"
                  >
                    <AlignStartVertical className="w-4 h-4" />
                    <span>Top</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      canvasManager?.alignSelected('middle');
                      setActiveMenu(null);
                    }}
                    title="Center Vertically"
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition text-[11px] font-semibold text-gray-700 hover:text-blue-700 shadow-2xs"
                  >
                    <AlignCenterVertical className="w-4 h-4" />
                    <span>Middle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      canvasManager?.alignSelected('bottom');
                      setActiveMenu(null);
                    }}
                    title="Align Bottom"
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition text-[11px] font-semibold text-gray-700 hover:text-blue-700 shadow-2xs"
                  >
                    <AlignEndVertical className="w-4 h-4" />
                    <span>Bottom</span>
                  </button>
                </div>
              </div>

              {/* Center in Canvas (Both) */}
              <button
                type="button"
                onClick={() => {
                  canvasManager?.alignSelected('center-both');
                  setActiveMenu(null);
                }}
                className="w-full py-2 px-3 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs"
              >
                <Move className="w-3.5 h-3.5" />
                <span>Center in Canvas</span>
              </button>
            </div>
          )}
        </div>

        {/* Zoom Controls (Compact in top toolbar) */}
        <ZoomControls
          zoom={zoom}
          onZoomChange={onZoomChange}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onResetZoom={onResetZoom}
          onFitCanvas={onFitCanvas}
          compact
        />
      </div>

      {/* Right Section: Inspector, Preview & Export Dropdown */}
      <div className="flex items-center gap-2" ref={exportMenuRef}>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>300 DPI Print Ready</span>
        </div>

        {onToggleProperties && (
          <button
            type="button"
            onClick={onToggleProperties}
            title={isPropertiesOpen ? 'Hide Inspector Panel' : 'Show Inspector Panel'}
            className={`p-2 rounded-lg border transition ${
              isPropertiesOpen
                ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-2xs'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}

        {/* View Preview Button */}
        {onOpenPreview && (
          <button
            type="button"
            onClick={onOpenPreview}
            title="Preview Clean Artwork (without guides or controls)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-300 transition shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden md:inline">Preview</span>
          </button>
        )}

        {/* Export Dropdown Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveMenu(activeMenu === 'export' ? null : 'export')}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-blue-200" />
          </button>

          {activeMenu === 'export' && (
            <div className="absolute top-full right-0 mt-1.5 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                High-Resolution Print Files
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onExportPsd) onExportPsd();
                  setActiveMenu(null);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-gray-800 hover:bg-blue-50/70 hover:text-blue-700 flex items-center justify-between group transition"
              >
                <span className="flex items-center gap-2 font-bold">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  <span>Download Layered PSD</span>
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                  300 DPI
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onExportPng) onExportPng();
                  setActiveMenu(null);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-gray-800 hover:bg-blue-50/70 hover:text-blue-700 flex items-center justify-between transition"
              >
                <span className="flex items-center gap-2 font-medium">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Download High-Res PNG</span>
                </span>
                <span className="text-[10px] text-gray-400">Lossless</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onExportJpg) onExportJpg();
                  setActiveMenu(null);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-gray-800 hover:bg-blue-50/70 hover:text-blue-700 flex items-center justify-between transition"
              >
                <span className="flex items-center gap-2 font-medium">
                  <ImageIcon className="w-4 h-4 text-amber-600" />
                  <span>Download High-Res JPG</span>
                </span>
                <span className="text-[10px] text-gray-400">Print CMYK/RGB</span>
              </button>

              <div className="my-1.5 border-t border-gray-100" />

              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Design Management
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onSave) onSave();
                  setActiveMenu(null);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
              >
                <Save className="w-4 h-4 text-gray-400" />
                <span>Save Design Draft</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSaveVersion) onSaveVersion();
                  setActiveMenu(null);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
              >
                <History className="w-4 h-4 text-gray-400" />
                <span>Save New Version</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
