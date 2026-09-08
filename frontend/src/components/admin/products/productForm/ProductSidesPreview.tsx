'use client';

import React, { useState } from 'react';
import {
  Eye,
  Layers,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRightLeft,
  Maximize2,
  FileCheck,
  Printer,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ProductFormData, ProductSideItem } from './types';
import { formatImageUrl } from '@/utils/imageUrl';

interface ProductSidesPreviewProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  activeSideIndex?: number;
  onSelectSide?: (index: number) => void;
  className?: string;
}

export const ProductSidesPreview: React.FC<ProductSidesPreviewProps> = ({
  formData,
  setFormData,
  activeSideIndex = 0,
  onSelectSide,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'flip'>('grid');
  const [flippedIndex, setFlippedIndex] = useState<number>(0);
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);

  const sides = formData.sides || [];
  const frontSide = sides[0];
  const backSide = sides[1];

  // Helper to add Back side directly
  const handleAddBackSide = () => {
    setFormData((prev) => {
      const nextNumber = prev.sides.length + 1;
      const newSide: ProductSideItem = {
        side_number: nextNumber,
        name: nextNumber === 2 ? 'Back' : `Side ${nextNumber}`,
        type: nextNumber === 2 ? 'back' : 'inside',
        sort_order: nextNumber,
        is_active: true,
        print_areas: prev.sides[0]?.print_areas?.map((pa, idx) => ({
          ...pa,
          id: `area_back_${Date.now()}_${idx}`,
          name: pa.name.replace(/front/i, 'Back'),
        })) || [],
      };

      return {
        ...prev,
        sides_count: nextNumber,
        sides: [...prev.sides, newSide],
      };
    });

    if (onSelectSide) {
      onSelectSide(sides.length); // Switch to the newly created side
    }
  };

  // Dimensions
  const widthMm = formData.width_mm || 90;
  const heightMm = formData.height_mm || 55;
  const aspectRatio = widthMm > 0 && heightMm > 0 ? widthMm / heightMm : 1.6;

  // DB Sync status helper
  const getDbStatus = (side: ProductSideItem) => {
    const hasImage = Boolean(side.background_image_url && side.background_image_url.trim().length > 1);
    const isSavedInDb = Boolean(side.id);
    const isServerUrl = Boolean(
      side.background_image_url &&
      !side.background_image_url.startsWith('data:') &&
      side.background_image_url.length > 1
    );

    if (hasImage && isSavedInDb && isServerUrl) {
      return {
        label: 'Saved in DB',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2,
      };
    }
    if (hasImage && (!isSavedInDb || !isServerUrl)) {
      return {
        label: 'Ready to Save',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: Sparkles,
      };
    }
    return {
      label: 'No Mockup',
      badgeClass: 'bg-gray-50 text-gray-500 border-gray-200',
      icon: AlertCircle,
    };
  };

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden ${className}`}>
      {/* Header Bar */}
      <div className="p-4 bg-gray-50/80 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-gray-900 tracking-tight">
                Live Sides & Mockup Preview
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {sides.length} {sides.length === 1 ? 'Side' : 'Sides'} Configured
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Verify Front & Back Mockups, print boundaries, and database sync status.
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          {/* Guidelines Toggle */}
          <button
            type="button"
            onClick={() => setShowGuidelines(!showGuidelines)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showGuidelines
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
            title="Toggle print safe zone & bleed lines"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Guides {showGuidelines ? 'On' : 'Off'}</span>
          </button>

          {/* Mode Toggle */}
          {sides.length > 1 && (
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Side-by-Side
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flip')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                  viewMode === 'flip'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>Flip Card</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="p-5 bg-slate-50/50">
        {/* Flip Card View */}
        {viewMode === 'flip' && sides.length > 1 ? (
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-gray-700">
                Viewing: <span className="font-bold text-blue-600">{sides[flippedIndex]?.name || `Side ${flippedIndex + 1}`}</span>
              </span>
              <button
                type="button"
                onClick={() => setFlippedIndex((prev) => (prev + 1) % sides.length)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg shadow-2xs transition-all"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Flip to {sides[(flippedIndex + 1) % sides.length]?.name || 'Next Side'}</span>
              </button>
            </div>

            <SidePreviewCard
              side={sides[flippedIndex]}
              index={flippedIndex}
              isActive={activeSideIndex === flippedIndex}
              onSelectSide={onSelectSide}
              showGuidelines={showGuidelines}
              widthMm={widthMm}
              heightMm={heightMm}
              aspectRatio={aspectRatio}
              dbStatus={getDbStatus(sides[flippedIndex])}
            />
          </div>
        ) : (
          /* Grid View (Side-by-Side) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {sides.map((side, idx) => (
              <SidePreviewCard
                key={side.id || idx}
                side={side}
                index={idx}
                isActive={activeSideIndex === idx}
                onSelectSide={onSelectSide}
                showGuidelines={showGuidelines}
                widthMm={widthMm}
                heightMm={heightMm}
                aspectRatio={aspectRatio}
                dbStatus={getDbStatus(side)}
              />
            ))}

            {/* If only 1 side is configured, show a prominent "Add Back Side" placeholder card */}
            {sides.length === 1 && (
              <div className="border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-2xl p-6 bg-white/70 flex flex-col items-center justify-center text-center space-y-3 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800">
                    Back Side Not Configured
                  </h4>
                  <p className="text-[11px] text-gray-400 max-w-[240px] mt-0.5">
                    This product currently has 1 printable side. Add a Back side to upload reverse artwork & mockups.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBackSide}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Back Side</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guidelines Legend Footer */}
      {showGuidelines && (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500 select-none">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-gray-700">Guide Overlay:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs border border-rose-400 bg-rose-50/50 inline-block" />
              <span>Bleed Area (+{formData.bleed_mm || 0}mm)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs border border-blue-500 bg-blue-50/50 inline-block" />
              <span>Trim Boundary ({widthMm}×{heightMm}mm)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs border border-dashed border-emerald-500 inline-block" />
              <span>Safe Zone</span>
            </span>
          </div>
          <span className="text-gray-400 text-[10px]">
            Aspect Ratio: {widthMm}:{heightMm}
          </span>
        </div>
      )}
    </div>
  );
};

interface SidePreviewCardProps {
  side: ProductSideItem;
  index: number;
  isActive: boolean;
  onSelectSide?: (index: number) => void;
  showGuidelines: boolean;
  widthMm: number;
  heightMm: number;
  aspectRatio: number;
  dbStatus: {
    label: string;
    badgeClass: string;
    icon: React.FC<{ className?: string }>;
  };
}

const SidePreviewCard: React.FC<SidePreviewCardProps> = ({
  side,
  index,
  isActive,
  onSelectSide,
  showGuidelines,
  widthMm,
  heightMm,
  aspectRatio,
  dbStatus,
}) => {
  const StatusIcon = dbStatus.icon;
  const hasValidImage = Boolean(
    side.background_image_url &&
    side.background_image_url.trim().length > 1 &&
    side.background_image_url !== 'd'
  );

  const formattedUrl = hasValidImage ? formatImageUrl(side.background_image_url) : null;

  return (
    <div
      className={`rounded-2xl border transition-all bg-white overflow-hidden shadow-2xs flex flex-col ${
        isActive
          ? 'border-blue-400 ring-2 ring-blue-100'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Side Card Header */}
      <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-gray-900 truncate">
              {side.name || `Side ${index + 1}`}
            </h4>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              {side.type || (index === 0 ? 'Front' : 'Back')} Side
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${dbStatus.badgeClass}`}
          >
            <StatusIcon className="w-3 h-3 shrink-0" />
            <span>{dbStatus.label}</span>
          </span>

          {onSelectSide && (
            <button
              type="button"
              onClick={() => onSelectSide(index)}
              className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {isActive ? 'Editing' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {/* Visual Canvas Mockup Area */}
      <div className="p-4 bg-slate-100/70 flex items-center justify-center min-h-[220px] relative overflow-hidden">
        <div
          className="relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex items-center justify-center transition-transform max-w-full"
          style={{
            width: '100%',
            maxWidth: '340px',
            aspectRatio: String(aspectRatio || 1.6),
            backgroundColor: side.background_color || '#ffffff',
          }}
        >
          {/* Background Image / Mockup */}
          {hasValidImage && formattedUrl ? (
            <img
              src={formattedUrl}
              alt={side.name || 'Side Mockup'}
              className="w-full h-full object-contain"
              onError={(e) => {
                // Prevent infinite loop if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="text-center p-4 space-y-1 select-none">
              <FileCheck className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-xs font-semibold text-gray-400">
                No Mockup or Background
              </p>
              <p className="text-[10px] text-gray-300">
                Upload image in the form above
              </p>
            </div>
          )}

          {/* Guide Overlay Lines */}
          {showGuidelines && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Bleed line outer */}
              <div className="absolute inset-0.5 border border-dashed border-rose-400/70 rounded-xs" />

              {/* Trim boundary */}
              <div className="absolute inset-2 border border-blue-500/80 rounded-xs" />

              {/* Safe zone inner */}
              <div className="absolute inset-4 border border-dashed border-emerald-500/70 rounded-xs" />

              {/* Dimension label watermark */}
              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                {widthMm}×{heightMm}mm
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Card Meta Footer */}
      <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-gray-700">Print Areas:</span>
          <span>{side.print_areas?.length || 0} configured</span>
        </div>

        {hasValidImage && (
          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
            Image Loaded
          </span>
        )}
      </div>
    </div>
  );
};

export default ProductSidesPreview;
