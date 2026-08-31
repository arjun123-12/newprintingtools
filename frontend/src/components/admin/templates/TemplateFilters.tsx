'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { ProductOption } from './templateForm/types';

export interface TemplateFiltersState {
  search: string;
  category: string;
  productId: string;
  status: string;
}

export interface TemplateFiltersProps {
  filters: TemplateFiltersState;
  onFilterChange: (filters: TemplateFiltersState) => void;
  products: ProductOption[];
}

const TEMPLATE_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'Corporate', label: 'Corporate & Business' },
  { value: 'Modern', label: 'Modern & Minimal' },
  { value: 'Creative', label: 'Creative & Artistic' },
  { value: 'Luxury', label: 'Luxury & Elegant' },
  { value: 'Events', label: 'Events & Promotions' },
  { value: 'General', label: 'General Starter' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active / Published' },
  { value: 'inactive', label: 'Inactive / Draft' },
];

export const TemplateFilters: React.FC<TemplateFiltersProps> = ({
  filters,
  onFilterChange,
  products,
}) => {
  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.category) ||
    Boolean(filters.productId) ||
    Boolean(filters.status);

  const resetFilters = () => {
    onFilterChange({
      search: '',
      category: '',
      productId: '',
      status: '',
    });
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search templates by name…"
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full h-9 pl-9 pr-3 text-xs text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-gray-400"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, search: '' })}
              className="absolute right-2.5 p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Product Filter */}
        <div>
          <select
            value={filters.productId}
            onChange={(e) => onFilterChange({ ...filters, productId: e.target.value })}
            className="w-full h-9 px-3 text-xs text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={filters.category}
            onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
            className="w-full h-9 px-3 text-xs text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
          >
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="w-full h-9 px-3 text-xs text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 px-3 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors shrink-0 flex items-center gap-1"
              title="Reset all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateFilters;
