'use client';

import React, { useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  Plus,
  Type,
  CaseUpper,
} from 'lucide-react';
import { SelectedObjectState } from '@/types/designer';
import { FontSelector } from './FontSelector';
import { ColorPicker } from './ColorPicker';

interface TextControlsProps {
  selected: SelectedObjectState;
  onUpdate: <K extends keyof SelectedObjectState>(prop: K, value: SelectedObjectState[K]) => void;
}

export const TextControls: React.FC<TextControlsProps> = ({ selected, onUpdate }) => {
  const [isColorOpen, setIsColorOpen] = useState(false);
  const fontSize = selected.fontSize || 32;
  const isBold = selected.fontWeight === 'bold' || selected.fontWeight === 700 || selected.fontWeight === '700';
  const isItalic = selected.fontStyle === 'italic';
  const isUnderline = Boolean(selected.underline);
  const isLinethrough = Boolean(selected.linethrough);
  const textAlign = selected.textAlign || 'left';
  const charSpacing = selected.charSpacing || 0;
  const lineHeight = selected.lineHeight || 1.16;

  const handleFontSizeChange = (val: number) => {
    const clamped = Math.max(Math.min(val, 300), 6);
    onUpdate('fontSize', clamped);
  };

  const handleToggleBold = () => {
    onUpdate('fontWeight', isBold ? 'normal' : 'bold');
  };

  const handleToggleItalic = () => {
    onUpdate('fontStyle', isItalic ? 'normal' : 'italic');
  };

  const handleToggleUnderline = () => {
    onUpdate('underline', !isUnderline);
  };

  const handleToggleLinethrough = () => {
    onUpdate('linethrough', !isLinethrough);
  };

  const handleToggleUppercase = () => {
    if (!selected.text) return;
    const isAllUpper = selected.text === selected.text.toUpperCase();
    onUpdate('text', isAllUpper ? selected.text.toLowerCase() : selected.text.toUpperCase());
  };

  return (
    <div className="space-y-4">
      {/* Font Family Selector */}
      <FontSelector
        value={selected.fontFamily || 'Inter, sans-serif'}
        onChange={(family) => onUpdate('fontFamily', family)}
      />

      {/* Font Size & Style Row */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Font Size Stepper */}
        <div>
          <label className="text-[11px] font-semibold text-gray-600 block mb-1">
            Font Size (pt)
          </label>
          <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => handleFontSizeChange(fontSize - 2)}
              className="p-2 hover:bg-gray-100 text-gray-600 transition"
              title="Decrease Font Size"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              value={fontSize}
              min={6}
              max={300}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              className="w-full text-center text-xs font-semibold text-gray-800 focus:outline-none py-1.5"
            />
            <button
              type="button"
              onClick={() => handleFontSizeChange(fontSize + 2)}
              className="p-2 hover:bg-gray-100 text-gray-600 transition"
              title="Increase Font Size"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Text Color Trigger */}
        <div>
          <label className="text-[11px] font-semibold text-gray-600 block mb-1">
            Text Color (CMYK)
          </label>
          <button
            type="button"
            onClick={() => setIsColorOpen(!isColorOpen)}
            className="w-full flex items-center justify-between border border-gray-200 rounded-lg p-1.5 bg-white shadow-2xs h-[34px] hover:border-blue-400 transition"
          >
            <div
              className="w-5 h-5 rounded border border-gray-300 shadow-2xs"
              style={{ backgroundColor: selected.fill || '#0f172a' }}
            />
            <span className="text-[10px] font-mono font-bold text-gray-700 uppercase">
              {selected.fill || '#0f172a'}
            </span>
          </button>
        </div>
      </div>

      {/* Expandable CMYK Color Controls */}
      {isColorOpen && (
        <div className="p-3 bg-gray-50/90 border border-gray-200 rounded-xl shadow-inner animate-in fade-in zoom-in-95 duration-100">
          <ColorPicker
            label="Text Print Color"
            value={selected.fill || '#0f172a'}
            onChange={(color) => onUpdate('fill', color)}
          />
        </div>
      )}

      {/* Formatting & Alignment Toolbar */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-gray-600 block">
          Formatting & Alignment
        </label>
        <div className="flex items-center justify-between gap-1 p-1 bg-gray-50 border border-gray-200 rounded-lg">
          {/* Bold */}
          <button
            type="button"
            onClick={handleToggleBold}
            title="Bold"
            className={`p-1.5 rounded transition ${
              isBold ? 'bg-white text-blue-600 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={handleToggleItalic}
            title="Italic"
            className={`p-1.5 rounded transition ${
              isItalic ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Underline */}
          <button
            type="button"
            onClick={handleToggleUnderline}
            title="Underline"
            className={`p-1.5 rounded transition ${
              isUnderline ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          {/* Strikethrough */}
          <button
            type="button"
            onClick={handleToggleLinethrough}
            title="Strikethrough"
            className={`p-1.5 rounded transition ${
              isLinethrough ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          {/* Uppercase toggle */}
          <button
            type="button"
            onClick={handleToggleUppercase}
            title="Toggle Uppercase"
            className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 transition"
          >
            <CaseUpper className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-gray-200 my-auto" />

          {/* Align Left */}
          <button
            type="button"
            onClick={() => onUpdate('textAlign', 'left')}
            title="Align Left"
            className={`p-1.5 rounded transition ${
              textAlign === 'left' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>

          {/* Align Center */}
          <button
            type="button"
            onClick={() => onUpdate('textAlign', 'center')}
            title="Align Center"
            className={`p-1.5 rounded transition ${
              textAlign === 'center' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>

          {/* Align Right */}
          <button
            type="button"
            onClick={() => onUpdate('textAlign', 'right')}
            title="Align Right"
            className={`p-1.5 rounded transition ${
              textAlign === 'right' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          {/* Align Justify */}
          <button
            type="button"
            onClick={() => onUpdate('textAlign', 'justify')}
            title="Justify"
            className={`p-1.5 rounded transition ${
              textAlign === 'justify' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Advanced Typography: Spacing & Line Height */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        {/* Letter Spacing (charSpacing) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-gray-500">Letter Spacing</span>
            <span className="text-xs text-gray-700 font-mono font-medium">{charSpacing}</span>
          </div>
          <input
            type="range"
            min="-50"
            max="300"
            step="10"
            value={charSpacing}
            onChange={(e) => onUpdate('charSpacing', Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Line Height */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-gray-500">Line Height</span>
            <span className="text-xs text-gray-700 font-mono font-medium">{lineHeight.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="2.5"
            step="0.05"
            value={lineHeight}
            onChange={(e) => onUpdate('lineHeight', Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>
    </div>
  );
};
