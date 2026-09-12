'use client';

import React from 'react';
import Link from 'next/link';
import { StatusBadge, ConfirmDialog } from '@/components/admin/shared';
import { Edit2, Eye, Trash2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { formatImageUrl } from '@/utils/imageUrl';

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category_id?: string;
  category_name?: string;
  category?: { name: string };
  product_type: string;
  base_price: number;
  sale_price?: number | null;
  featured_image_url?: string;
  status: string;
  is_active: boolean;
  created_at?: string;
}

export interface ProductTableProps {
  products: ProductListItem[];
  selectedIds?: Set<string>;
  onToggleSelect?: (productId: string) => void;
  onToggleSelectAll?: () => void;
  onToggleActive?: (product: ProductListItem) => void;
  onDeleteProduct?: (productId: string) => void;
  isLoading?: boolean;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleActive,
  onDeleteProduct,
  isLoading = false,
}) => {
  const [deleteTarget, setDeleteTarget] = React.useState<ProductListItem | null>(null);

  const formatTypeLabel = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const allSelected =
    products.length > 0 &&
    selectedIds !== undefined &&
    products.every((p) => selectedIds.has(p.id));

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
              <th className="py-3.5 px-4">Product</th>
              <th className="py-3.5 px-4">SKU</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Type</th>
              <th className="py-3.5 px-4">Price</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-center">Active</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {products.map((product) => {
              const isSelected = selectedIds?.has(product.id) ?? false;
              const categoryName =
                product.category_name || product.category?.name || 'Uncategorized';
              const imgUrl = product.featured_image_url;

              return (
                <tr
                  key={product.id}
                  className={`hover:bg-gray-50/60 transition-colors group ${
                    isSelected ? 'bg-blue-50/40' : ''
                  }`}
                >
                  {onToggleSelect && (
                    <td className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(product.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                      />
                    </td>
                  )}
                  {/* Product Info */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {imgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={formatImageUrl(imgUrl)}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="font-bold text-gray-900 hover:text-blue-600 transition-colors truncate block text-xs"
                        >
                          {product.name}
                        </Link>
                        <span className="text-[11px] text-gray-400 font-mono truncate block">
                          /{product.slug}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="py-3 px-4 font-mono font-medium text-gray-600 text-[11px]">
                    {product.sku || '—'}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700">
                      {categoryName}
                    </span>
                  </td>

                  {/* Product Type */}
                  <td className="py-3 px-4 text-gray-600 text-[11px]">
                    {formatTypeLabel(product.product_type || 'standard_print')}
                  </td>

                  {/* Price */}
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    <div className="flex items-baseline gap-1.5">
                      <span>${Number(product.base_price || 0).toFixed(2)}</span>
                      {product.sale_price && Number(product.sale_price) > 0 && (
                        <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded">
                          Sale: ${Number(product.sale_price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <StatusBadge
                      status={product.status || (product.is_active ? 'published' : 'draft')}
                    />
                  </td>

                  {/* Active Toggle */}
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleActive?.(product)}
                      className={`
                        w-8 h-4 rounded-full transition-colors relative inline-block cursor-pointer
                        ${product.is_active ? 'bg-blue-600' : 'bg-gray-200'}
                      `}
                    >
                      <span
                        className={`
                          w-3 h-3 bg-white rounded-full transition-transform absolute top-0.5
                          ${product.is_active ? 'left-4.5' : 'left-0.5'}
                        `}
                      />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {product.slug && (
                        <Link
                          href={`/products/${product.slug}`}
                          target="_blank"
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View on Store"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      )}

                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Product"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Link>

                      {onDeleteProduct && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(product)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Product"
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
            onDeleteProduct?.(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Product"
        variant="danger"
      />
    </div>
  );
};

export default ProductTable;
