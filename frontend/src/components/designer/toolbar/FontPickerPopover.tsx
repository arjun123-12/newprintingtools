'use client';

import React, { useState } from 'react';
import { Search, Check, Sparkles } from 'lucide-react';
import { POPULAR_FONTS, FontFamilyItem, loadFont } from '../utils/fonts';

interface FontPickerPopoverProps {
  currentFamily: string;
  onSelectFamily: (family: string) => void;
  onClose: () => void;
}

export const FontPickerPopover: React.FC<FontPickerPopoverProps> = ({
  currentFamily,
  onSelectFamily,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'sans-serif', label: 'Sans Serif' },
    { id: 'serif', label: 'Serif' },
    { id: 'display', label: 'Display' },
    { id: 'handwriting', label: 'Handwriting' },
  ];

  const filteredFonts = POPULAR_FONTS.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.family.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'all' || f.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleSelect = async (font: FontFamilyItem) => {
    await loadFont(font);
    onSelectFamily(font.family);
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Search Header */}
      <div className="relative mb-2.5">
        <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search fonts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100/80 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 custom-scrollbar mb-1 border-b border-gray-100">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition ${
              activeCategory === cat.id
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Font List */}
      <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5 pr-1">
        {filteredFonts.map((font) => {
          const isSelected =
            currentFamily === font.family ||
            currentFamily.includes(font.name) ||
            currentFamily.toLowerCase().startsWith(font.name.toLowerCase());

          return (
            <button
              key={font.id}
              type="button"
              onClick={() => handleSelect(font)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition ${
                isSelected
                  ? 'bg-blue-50/80 text-blue-700 font-semibold'
                  : 'hover:bg-gray-100 text-gray-800'
              }`}
            >
              <span style={{ fontFamily: font.family }} className="text-sm truncate">
                {font.name}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {font.popular && (
                  <span className="p-0.5 text-amber-500" title="Popular Font">
                    <Sparkles className="w-3 h-3" />
                  </span>
                )}
                {isSelected && <Check className="w-4 h-4 text-blue-600" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
