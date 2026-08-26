'use client';

import React, { useState } from 'react';
import { LayoutTemplate, Search, Sparkles, Check, ArrowRight } from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import { PRINT_TEMPLATES } from '../data/templatesData';
import { DesignerTemplate } from '@/types/designer';

interface TemplatesPanelProps {
  canvasManager: CanvasManager | null;
}

const CATEGORIES = ['All', 'Business Cards', 'Flyers', 'Invitations'];

export const TemplatesPanel: React.FC<TemplatesPanelProps> = ({ canvasManager }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const filteredTemplates = PRINT_TEMPLATES.filter((tpl) => {
    const matchesCat =
      selectedCategory === 'All' || tpl.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tpl.description && tpl.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleApplyTemplate = async (template: DesignerTemplate) => {
    if (!canvasManager) return;
    setActiveTemplateId(template.id);
    await canvasManager.loadTemplate(template);
  };

  return (
    <div className="p-4 space-y-4 select-none custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Templates
          </h3>
        </div>
        <span className="text-[10px] text-gray-400">Print Ready</span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search print templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50/70 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition text-[11px] ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates List */}
      <div className="space-y-3 pt-1">
        {filteredTemplates.map((template) => {
          const isApplied = activeTemplateId === template.id;
          return (
            <div
              key={template.id}
              onClick={() => handleApplyTemplate(template)}
              draggable
              onDragEnd={() => handleApplyTemplate(template)}
              className={`group relative rounded-2xl border bg-white overflow-hidden cursor-pointer transition shadow-2xs hover:shadow-md ${
                isApplied ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-blue-400'
              }`}
            >
              {/* Template Card Preview */}
              <div
                className="h-28 w-full p-4 flex flex-col justify-between relative overflow-hidden transition group-hover:scale-[1.02]"
                style={{ background: template.thumbnailBg }}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white">
                    {template.category}
                  </span>
                  {isApplied && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white shadow-xs">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-extrabold text-white truncate drop-shadow-xs">
                    {template.title}
                  </h4>
                  <p className="text-[10px] text-white/70 truncate mt-0.5">
                    {template.description}
                  </p>
                </div>

                {/* Hover CTA Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold backdrop-blur-2xs">
                  <span>Use This Template</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No templates matching &quot;{searchQuery}&quot;
          </div>
        )}
      </div>
    </div>
  );
};
