'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ProductTable,
  ProductListItem,
} from '@/components/admin/products/ProductTable';
import {
  ProductFilters,
  ProductFiltersState,
} from '@/components/admin/products/ProductFilters';
import { ProductCard } from '@/components/admin/products/ProductCard';
import { ProductActions } from '@/components/admin/products/ProductActions';
import {
  EmptyState,
  LoadingState,
  ErrorState,
} from '@/components/admin/shared';
import { CategoryOption } from '@/components/admin/products/productForm/types';
import {
  Package,
  CheckCircle2,
  FileEdit,
  Layers,
  LayoutGrid,
  List,
} from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const [filters, setFilters] = useState<ProductFiltersState>({
    search: '',
    category: '',
    type: '',
    status: '',
  });

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [prodRes, catRes] = await Promise.all([
        fetch(`${API_URL}/admin/products`, {
          headers: { Accept: 'application/json' },
        }),
        fetch(`${API_URL}/admin/categories`, {
          headers: { Accept: 'application/json' },
        }),
      ]);

      const prodData = await prodRes.json();
      const catData = await catRes.json();

      if (prodData.success && Array.isArray(prodData.data)) {
        setProducts(prodData.data);
      } else if (Array.isArray(prodData)) {
        setProducts(prodData);
      }

      if (catData.success && Array.isArray(catData.data)) {
        setCategories(catData.data);
      } else if (Array.isArray(catData)) {
        setCategories(catData);
      }
    } catch (err: any) {
      console.error('Failed to load admin products:', err);
      setError(err.message || 'Could not load products from the backend.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = async (product: ProductListItem) => {
    const nextState = !product.is_active;

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_active: nextState } : p))
    );

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('auth_token')
          : null;

      const res = await fetch(`${API_URL}/admin/products/${product.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          is_active: nextState,
          status: nextState ? 'published' : 'draft',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }
    } catch (err) {
      console.error('Error updating active state:', err);
      // Revert on failure
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: !nextState } : p))
      );
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    // Optimistic delete
    const previous = [...products];
    setProducts((prev) => prev.filter((p) => p.id !== productId));

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('auth_token')
          : null;

      await fetch(`${API_URL}/admin/products/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (err) {
      console.error('Error deleting product:', err);
      setProducts(previous);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesSku = p.sku?.toLowerCase().includes(query);
        const matchesSlug = p.slug?.toLowerCase().includes(query);
        if (!matchesName && !matchesSku && !matchesSlug) return false;
      }

      // Category
      if (filters.category) {
        const catId = p.category_id || (p as any).category?.id;
        if (catId !== filters.category) return false;
      }

      // Product Type
      if (filters.type && p.product_type !== filters.type) {
        return false;
      }

      // Status
      if (filters.status) {
        const pStatus = p.status || (p.is_active ? 'published' : 'draft');
        if (pStatus !== filters.status) return false;
      }

      return true;
    });
  }, [products, filters]);

  // Statistics
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.is_active).length;
    const drafts = total - active;
    return { total, active, drafts };
  }, [products]);

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen font-sans space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Product Catalog
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage print specifications, pricing matrices, print areas, and design templates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-gray-100 text-blue-600 font-bold'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-gray-100 text-blue-600 font-bold'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <ProductActions onRefresh={() => loadData(true)} isRefreshing={refreshing} />
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-[10px]">
              Total Products
            </span>
            <span className="text-xl font-extrabold text-gray-900">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-[10px]">
              Active / Published
            </span>
            <span className="text-xl font-extrabold text-gray-900">{stats.active}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <FileEdit className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-[10px]">
              Drafts / Inactive
            </span>
            <span className="text-xl font-extrabold text-gray-900">{stats.drafts}</span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <ProductFilters
        filters={filters}
        onFilterChange={setFilters}
        categories={categories}
      />

      {/* Product Content Area */}
      {loading ? (
        <LoadingState message="Loading catalog products…" className="py-24 bg-white rounded-xl border border-gray-200" />
      ) : error ? (
        <ErrorState
          title="Could not load products"
          message={error}
          onRetry={() => loadData(false)}
        />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No products found"
          description={
            products.length === 0
              ? 'Get started by creating your first print product specification.'
              : 'No products match your current search and filter criteria.'
          }
          action={
            products.length === 0 ? (
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                <span>Create First Product</span>
              </Link>
            ) : undefined
          }
          className="bg-white py-16"
        />
      ) : viewMode === 'table' ? (
        <ProductTable
          products={filteredProducts}
          onToggleActive={handleToggleActive}
          onDeleteProduct={handleDeleteProduct}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
