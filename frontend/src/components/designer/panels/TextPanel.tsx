'use client';

import React from 'react';
import { Type, Plus, Sparkles } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';

interface TextPanelProps {
  canvasManager: CanvasManager | null;
}

interface TypographyPreset {
  id: string;
  name: string;
  category: string;
  title: string;
  titleFont: string;
  titleSize: number;
  titleWeight: string | number;
  titleColor: string;
  subtitle?: string;
  subtitleFont?: string;
  subtitleSize?: number;
  subtitleWeight?: string | number;
  subtitleColor?: string;
}

const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  {
    id: 'luxury-serif',
    name: 'Luxury Serif',
    category: 'Elegant',
    title: 'ELEGANT ARTWORK',
    titleFont: '"Playfair Display", serif',
    titleSize: 42,
    titleWeight: 'bold',
    titleColor: '#0f172a',
    subtitle: 'PREMIUM QUALITY PRINTING',
    subtitleFont: 'Montserrat, sans-serif',
    subtitleSize: 16,
    subtitleWeight: '600',
    subtitleColor: '#64748b',
  },
  {
    id: 'modern-bold',
    name: 'Modern Bold Headline',
    category: 'Modern',
    title: 'BIG SALE EVENT',
    titleFont: '"Bebas Neue", sans-serif',
    titleSize: 56,
    titleWeight: 'normal',
    titleColor: '#2563eb',
    subtitle: 'LIMITED TIME ONLY • UP TO 50% OFF',
    subtitleFont: 'Inter, sans-serif',
    subtitleSize: 14,
    subtitleWeight: 'bold',
    subtitleColor: '#0f172a',
  },
  {
    id: 'script-signature',
    name: 'Handwritten Script',
    category: 'Handwriting',
    title: 'Special Invitation',
    titleFont: '"Great Vibes", cursive',
    titleSize: 52,
    titleWeight: 'normal',
    titleColor: '#0f172a',
    subtitle: 'Save The Date For Our Opening',
    subtitleFont: 'Montserrat, sans-serif',
    subtitleSize: 15,
    subtitleWeight: '500',
    subtitleColor: '#64748b',
  },
  {
    id: 'clean-tech',
    name: 'Minimal Tech Corporate',
    category: 'Corporate',
    title: 'NextGen Solutions',
    titleFont: '"Plus Jakarta Sans", sans-serif',
    titleSize: 38,
    titleWeight: '800',
    titleColor: '#0f172a',
    subtitle: 'Enterprise printing & design services',
    subtitleFont: 'Inter, sans-serif',
    subtitleSize: 16,
    subtitleWeight: 'normal',
    subtitleColor: '#475569',
  },
];

export const TextPanel: React.FC<TextPanelProps> = ({ canvasManager }) => {
  const handleAddHeading = () => {
    if (!canvasManager) return;
    canvasManager.addText({
      text: 'Add a heading',
      fontSize: 48,
      fontWeight: 'bold',
      fontFamily: 'Inter, sans-serif',
      fill: '#0f172a',
      width: 450,
    });
  };

  const handleAddSubheading = () => {
    if (!canvasManager) return;
    canvasManager.addText({
      text: 'Add a subheading',
      fontSize: 28,
      fontWeight: '600',
      fontFamily: 'Inter, sans-serif',
      fill: '#334155',
      width: 380,
    });
  };

  const handleAddBody = () => {
    if (!canvasManager) return;
    canvasManager.addText({
      text: 'Add a little bit of body text. Perfect for descriptions, contact info, and fine details.',
      fontSize: 16,
      fontWeight: 'normal',
      fontFamily: 'Inter, sans-serif',
      fill: '#475569',
      width: 340,
    });
  };

  const handleAddPreset = (preset: TypographyPreset) => {
    if (!canvasManager) return;

    // Add main title centered
    canvasManager.addText({
      text: preset.title,
      fontSize: preset.titleSize,
      fontFamily: preset.titleFont,
      fontWeight: preset.titleWeight,
      fill: preset.titleColor,
      top: 180,
      width: 550,
      textAlign: 'center',
    });

    // Add subtitle if preset has one centered below
    if (preset.subtitle) {
      setTimeout(() => {
        canvasManager.addText({
          text: preset.subtitle!,
          fontSize: preset.subtitleSize || 16,
          fontFamily: preset.subtitleFont || 'Inter, sans-serif',
          fontWeight: preset.subtitleWeight || 'normal',
          fill: preset.subtitleColor || '#64748b',
          top: 255,
          width: 500,
          textAlign: 'center',
        });
      }, 50);
    }
  };

  return (
    <div className="p-4 space-y-5 select-none custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Type className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Add Text
          </h3>
        </div>
        <span className="text-[10px] text-gray-400">Click to insert</span>
      </div>

      {/* Quick Add Hierarchy Cards */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleAddHeading}
          className="w-full text-left p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors">
              Add a heading
            </span>
            <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          type="button"
          onClick={handleAddSubheading}
          className="w-full text-left p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
              Add a subheading
            </span>
            <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          type="button"
          onClick={handleAddBody}
          className="w-full text-left p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 group-hover:text-blue-600 transition-colors">
              Add body text
            </span>
            <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
          </div>
        </button>
      </div>

      {/* Curated Typography Combinations */}
      <div className="space-y-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Curated Font Pairings</span>
        </div>

        <div className="space-y-2.5">
          {TYPOGRAPHY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleAddPreset(preset)}
              className="w-full text-left p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 transition group shadow-2xs"
            >
              <div className="flex flex-col">
                <span
                  className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate"
                  style={{ fontFamily: preset.titleFont }}
                >
                  {preset.title}
                </span>
                {preset.subtitle && (
                  <span
                    className="text-[11px] text-gray-500 mt-0.5 truncate"
                    style={{ fontFamily: preset.subtitleFont }}
                  >
                    {preset.subtitle}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
