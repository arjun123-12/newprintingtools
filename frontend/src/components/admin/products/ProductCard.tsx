'use client';

import React from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/admin/shared';
import { ProductListItem } from './ProductTable';
import { Edit2, Eye, Trash2, Image as ImageIcon } from 'lucide-react';
import { formatImageUrl } from '@/utils/imageUrl';

export interface ProductCardProps {
  product: ProductListItem;
  onToggleActive?: (product: ProductListItem) => void;
  isSelected?: boolean;
  onToggleSelect?: (productId: string) => void;
  onDeleteProduct?: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onToggleActive,
  isSelected = false,
  onToggleSelect,
  onDeleteProduct,
}) => {
  const categoryName = product.category_name || product.category?.name || 'Uncategorized';
  const imgUrl = product.featured_image_url;

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
        onClick={() => onToggleSelect?.(product.id)}
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
              onChange={() => onToggleSelect(product.id)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 bg-white shadow-xs cursor-pointer"
            />
          </div>
        )}

        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={formatImageUrl(imgUrl)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <ImageIcon className="w-8 h-8 text-gray-300" />
        )}

        <div className={`absolute top-2 ${onToggleSelect ? 'left-8' : 'left-2'}`}>
          <StatusBadge status={product.status || (product.is_active ? 'published' : 'draft')} />
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {product.slug && (
            <Link
              href={`/products/${product.slug}`}
              target="_blank"
              className="p-1.5 bg-white/90 backdrop-blur-xs text-gray-700 hover:text-blue-600 rounded-lg shadow-sm"
              title="View on Store"
            >
              <Eye className="w-3.5 h-3.5" />
            </Link>
          )}
          <Link
            href={`/admin/products/${product.id}/edit`}
            className="p-1.5 bg-white/90 backdrop-blur-xs text-gray-700 hover:text-blue-600 rounded-lg shadow-sm"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Link>
          {onDeleteProduct && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProduct(product.id);
              }}
              className="p-1.5 bg-white/90 backdrop-blur-xs text-rose-600 hover:bg-rose-50 rounded-lg shadow-sm"
              title="Delete Product"
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
            {categoryName}
          </span>
          <Link
            href={`/admin/products/${product.id}/edit`}
            className="block text-xs font-bold text-gray-900 hover:text-blue-600 transition-colors line-clamp-1 mt-0.5"
          >
            {product.name}
          </Link>
          <span className="text-[11px] text-gray-400 font-mono block mt-0.5">
            SKU: {product.sku || 'N/A'}
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          <div>
            <span className="text-[10px] text-gray-400 block">From</span>
            <span className="font-bold text-gray-900">
              ${Number(product.base_price || 0).toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onToggleActive?.(product)}
            className={`
              text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors
              ${product.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}
            `}
          >
            {product.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
