'use client';

import React from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/admin/shared';
import { TemplateListItem } from './templateForm/types';
import { Edit2, Palette, Trash2, LayoutTemplate } from 'lucide-react';
import { formatImageUrl } from '@/utils/imageUrl';

export interface TemplateCardProps {
  template: TemplateListItem;
  onToggleActive?: (template: TemplateListItem) => void;
  isSelected?: boolean;
  onToggleSelect?: (templateId: string) => void;
  onDeleteTemplate?: (templateId: string) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onToggleActive,
  isSelected = false,
  onToggleSelect,
  onDeleteTemplate,
}) => {
  const productName = template.product?.name || 'Unassigned';
  const imgUrl = template.thumbnail_url;
  const designerUrl = template.product_id
    ? `/admin/designer?productId=${template.product_id}&templateId=${template.id}`
    : null;

  return (
    <div
      className={`bg-white rounded-xl border shadow-xs transition-all overflow-hidden flex flex-col group relative ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/10'
          : 'border-gray-200 hover:shadow-sm hover:border-gray-300'
      }`}
    >
      {/* Thumbnail */}
      <div
        className="aspect-[4/3] bg-gray-100 relative overflow-hidden flex items-center justify-center border-b border-gray-100 cursor-pointer"
        onClick={() => onToggleSelect?.(template.id)}
      >
        {/* Selection Checkbox */}
        {onToggleSelect && (
          <div
            className="absolute top-2 left-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(template.id)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 bg-white shadow-xs cursor-pointer"
            />
          </div>
        )}

        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${formatImageUrl(imgUrl)}?v=${template.updated_at || Date.now()}`}
            alt={template.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <LayoutTemplate className="w-8 h-8 text-gray-300" />
        )}

        <div className={`absolute top-2 ${onToggleSelect ? 'left-8' : 'left-2'}`}>
          <StatusBadge status={template.is_active ? 'active' : 'inactive'} />
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {designerUrl && (
            <Link
              href={designerUrl}
              target="_blank"
              className="p-1.5 bg-white/90 backdrop-blur-xs text-blue-600 hover:bg-blue-50 rounded-lg shadow-sm font-semibold text-xs"
              title="Open in Designer Studio"
            >
              <Palette className="w-3.5 h-3.5" />
            </Link>
          )}
          <Link
            href={`/admin/templates/${template.id}/edit`}
            className="p-1.5 bg-white/90 backdrop-blur-xs text-gray-700 hover:text-blue-600 rounded-lg shadow-sm"
            title="Edit Details"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Link>
          {onDeleteTemplate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTemplate(template.id);
              }}
              className="p-1.5 bg-white/90 backdrop-blur-xs text-rose-600 hover:bg-rose-50 rounded-lg shadow-sm"
              title="Delete Template"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
            {productName}
          </span>
          <Link
            href={`/admin/templates/${template.id}/edit`}
            className="block text-xs font-bold text-gray-900 hover:text-blue-600 transition-colors line-clamp-1 mt-0.5"
          >
            {template.name}
          </Link>
          <span className="text-[11px] text-gray-400 block mt-0.5">
            Category: {template.category || 'General'}
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          {designerUrl ? (
            <Link
              href={designerUrl}
              target="_blank"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              <Palette className="w-3 h-3" />
              <span>Studio</span>
            </Link>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => onToggleActive?.(template)}
            className={`
              text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors
              ${template.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}
            `}
          >
            {template.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateCard;
