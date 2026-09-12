'use client';

import React from 'react';
import Link from 'next/link';
import { StatusBadge, ConfirmDialog } from '@/components/admin/shared';
import { TemplateListItem } from './templateForm/types';
import { Edit2, Palette, Trash2, LayoutTemplate, ExternalLink } from 'lucide-react';
import { formatImageUrl } from '@/utils/imageUrl';

export interface TemplateTableProps {
  templates: TemplateListItem[];
  selectedIds?: Set<string>;
  onToggleSelect?: (templateId: string) => void;
  onToggleSelectAll?: () => void;
  onToggleActive?: (template: TemplateListItem) => void;
  onDeleteTemplate?: (templateId: string) => void;
  isLoading?: boolean;
}

export const TemplateTable: React.FC<TemplateTableProps> = ({
  templates,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleActive,
  onDeleteTemplate,
  isLoading = false,
}) => {
  const [deleteTarget, setDeleteTarget] = React.useState<TemplateListItem | null>(null);

  const allSelected =
    templates.length > 0 &&
    selectedIds !== undefined &&
    templates.every((t) => selectedIds.has(t.id));

  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs divide-y divide-gray-200">
          <thead className="bg-gray-50/80 text-gray-600 uppercase text-[10px] font-bold tracking-wider">
            <tr>
              {onToggleSelect && (
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                  />
                </th>
              )}
              <th className="py-3.5 px-4">Template</th>
              <th className="py-3.5 px-4">Product</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-center">Active</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {templates.map((template) => {
              const isSelected = selectedIds?.has(template.id) ?? false;
              const productName = template.product?.name || 'Unassigned Product';
              const imgUrl = template.thumbnail_url;
              const designerUrl = template.product_id
                ? `/admin/designer?productId=${template.product_id}&templateId=${template.id}`
                : null;

              return (
                <tr
                  key={template.id}
                  className={`hover:bg-gray-50/60 transition-colors group ${
                    isSelected ? 'bg-blue-50/40' : ''
                  }`}
                >
                  {onToggleSelect && (
                    <td className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(template.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                      />
                    </td>
                  )}
                  {/* Template Info */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-9 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {imgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${formatImageUrl(imgUrl)}?v=${template.updated_at || Date.now()}`}
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <LayoutTemplate className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <Link
                          href={`/admin/templates/${template.id}/edit`}
                          className="font-bold text-gray-900 hover:text-blue-600 transition-colors block text-xs"
                        >
                          {template.name}
                        </Link>
                        <span className="text-[11px] text-gray-400 block mt-0.5">
                          ID: {template.id.slice(0, 8)}…
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/50">
                      {productName}
                    </span>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4 text-gray-600 text-[11px]">
                    {template.category || 'General'}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4">
                    <StatusBadge status={template.is_active ? 'active' : 'inactive'} />
                  </td>

                  {/* Active Toggle */}
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleActive?.(template)}
                      className={`
                        w-8 h-4 rounded-full transition-colors relative inline-block cursor-pointer
                        ${template.is_active ? 'bg-blue-600' : 'bg-gray-200'}
                      `}
                    >
                      <span
                        className={`
                          w-3 h-3 bg-white rounded-full transition-transform absolute top-0.5
                          ${template.is_active ? 'left-4.5' : 'left-0.5'}
                        `}
                      />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {designerUrl && (
                        <Link
                          href={designerUrl}
                          target="_blank"
                          className="inline-flex items-center gap-1 p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-[11px] font-semibold"
                          title="Open in Visual Designer Studio"
                        >
                          <Palette className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Design</span>
                        </Link>
                      )}

                      <Link
                        href={`/admin/templates/${template.id}/edit`}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Template Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Link>

                      {onDeleteTemplate && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(template)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteTemplate?.(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete Design Template"
        message={`Are you sure you want to delete template "${deleteTarget?.name}"? Customers will no longer see this starter layout in the designer.`}
        confirmLabel="Delete Template"
        variant="danger"
      />
    </div>
  );
};

export default TemplateTable;
