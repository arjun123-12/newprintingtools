'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Sparkles } from 'lucide-react';
import { POPULAR_FONTS, FontFamilyItem, loadFont } from '../utils/fonts';

interface FontSelectorProps {
  value?: string;
  onChange: (fontFamily: string, fontItem?: FontFamilyItem) => void;
}

export const FontSelector: React.FC<FontSelectorProps> = ({
  value = 'Inter, sans-serif',
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find currently selected font item
  const currentFont =
    POPULAR_FONTS.find((f) => f.family === value || f.name.toLowerCase() === value.toLowerCase()) ||
    POPULAR_FONTS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredFonts = POPULAR_FONTS.filter((font) => {
    const matchesSearch =
      font.name.toLowerCase().includes(search.toLowerCase()) ||
      font.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || font.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectFont = async (font: FontFamilyItem) => {
    await loadFont(font);
    onChange(font.family, font);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="text-[11px] font-semibold text-gray-600 block mb-1">
        Font Family
      </label>

      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-gray-800 transition shadow-2xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      >
        <span className="truncate font-medium" style={{ fontFamily: currentFont.family }}>
          {currentFont.name}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1.5" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in duration-100">
          {/* Search Bar */}
          <div className="px-3 pb-2 border-b border-gray-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fonts..."
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Categories */}
            <div className="flex items-center gap-1 mt-2 overflow-x-auto custom-scrollbar pb-0.5 text-[10px]">
              {['all', 'sans-serif', 'serif', 'display', 'handwriting'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 rounded capitalize whitespace-nowrap transition ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat.replace('-serif', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Font List */}
          <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
            {filteredFonts.length > 0 ? (
              filteredFonts.map((font) => {
                const isSelected = font.id === currentFont.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => handleSelectFont(font)}
                    onMouseEnter={() => {
                      if (font.googleFont) loadFont(font);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm" style={{ fontFamily: font.family }}>
                        {font.name}
                      </span>
                      <span className="text-[9px] text-gray-400 capitalize">{font.category}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-6 text-center text-xs text-gray-400">
                No fonts found matching &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
