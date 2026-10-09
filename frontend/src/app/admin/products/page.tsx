'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAuthToken } from '@/utils/storageHelper';
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
  ConfirmDialog,
} from '@/components/admin/shared';
import { CategoryOption } from '@/components/admin/products/productForm/types';
import {
  Package,
  CheckCircle2,
  FileEdit,
  Layers,
  LayoutGrid,
  List,
  Archive,
  RotateCcw,
} from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

export default function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [archivedProducts, setArchivedProducts] = useState<ProductListItem[]>([]);
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

  // Multi-select & Bulk Action State
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [isBulkRestoring, setIsBulkRestoring] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    variant: 'danger',
    onConfirm: async () => {},
  });

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setSelectedProductIds(new Set());

      const token = getAuthToken();
      const authHeaders = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const [prodRes, archRes, catRes] = await Promise.all([
        fetch(`${API_URL}/admin/products`, {
          headers: authHeaders,
        }),
        fetch(`${API_URL}/admin/products/archived`, {
          headers: authHeaders,
        }),
        fetch(`${API_URL}/admin/categories`, {
          headers: authHeaders,
        }),
      ]);

      const prodData = await prodRes.json();
      const archData = await archRes.json();
      const catData = await catRes.json();

      if (prodData.success && Array.isArray(prodData.data)) {
        setProducts(prodData.data);
      } else if (Array.isArray(prodData)) {
        setProducts(prodData);
      }

      if (archData.success && Array.isArray(archData.data)) {
        setArchivedProducts(archData.data);
      } else if (Array.isArray(archData)) {
        setArchivedProducts(archData);
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
    if (activeTab === 'archived') return;

    const nextState = !product.is_active;

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_active: nextState } : p))
    );

    try {
      const token = getAuthToken();

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

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const currentProducts = activeTab === 'active' ? products : archivedProducts;

  const toggleSelectAllProducts = () => {
    if (filteredProducts.length === 0) return;
    const allSelected = filteredProducts.every((p) => selectedProductIds.has(p.id));
    if (allSelected) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleArchiveProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    setConfirmDialog({
      isOpen: true,
      title: 'Move to Archive',
      message: `Are you sure you want to move "${product?.name || 'this product'}" to archive? It will be removed from the active catalog and storefront, but can be restored at any time.`,
      confirmLabel: 'Move to archive',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const token = getAuthToken();

          const response = await fetch(`${API_URL}/admin/products/${productId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          const data = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(data?.message || 'Failed to archive product');
          }

          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData(true);
        } catch (err: any) {
          alert('Failed to archive product: ' + (err.message || 'Unknown error'));
        }
      },
    });
  };

  const handleBulkArchiveProducts = () => {
    const ids = Array.from(selectedProductIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Move ${ids.length} Product${ids.length > 1 ? 's' : ''} to Archive`,
      message: `Are you sure you want to move the ${ids.length} selected product${ids.length > 1 ? 's' : ''} to archive? They will be removed from the active catalog and storefront, but can be restored at any time.`,
      confirmLabel: 'Move to archive',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsBulkDeleting(true);
          const token = getAuthToken();

          const response = await fetch(`${API_URL}/admin/products/bulk-delete`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ ids }),
          });

          const data = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(data?.message || 'Failed to archive products');
          }

          setSelectedProductIds(new Set());
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData(true);
        } catch (err: any) {
          alert('Failed to archive products: ' + (err.message || 'Unknown error'));
        } finally {
          setIsBulkDeleting(false);
        }
      },
    });
  };

  const handleRestoreProduct = async (productId: string) => {
    try {
      const token = getAuthToken();

      const response = await fetch(`${API_URL}/admin/products/${productId}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to restore product');
      }

      await loadData(true);
    } catch (err: any) {
      alert('Failed to restore product: ' + (err.message || 'Unknown error'));
    }
  };

  const handleBulkRestoreProducts = () => {
    const ids = Array.from(selectedProductIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Restore ${ids.length} Product${ids.length > 1 ? 's' : ''}`,
      message: `Are you sure you want to restore the ${ids.length} selected product${ids.length > 1 ? 's' : ''}? They will become visible again in the active catalog and storefront.`,
      confirmLabel: 'Restore Products',
      variant: 'info',
      onConfirm: async () => {
        try {
          setIsBulkRestoring(true);
          const token = getAuthToken();

          const response = await fetch(`${API_URL}/admin/products/bulk-restore`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ ids }),
          });

          const data = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(data?.message || 'Failed to restore products');
          }

          setSelectedProductIds(new Set());
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData(true);
        } catch (err: any) {
          alert('Failed to restore products: ' + (err.message || 'Unknown error'));
        } finally {
          setIsBulkRestoring(false);
        }
      },
    });
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return currentProducts.filter((p) => {
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
  }, [currentProducts, filters]);

  // Statistics
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.is_active).length;
    const drafts = total - active;
    const archived = archivedProducts.length;
    return { total, active, drafts, archived };
  }, [products, archivedProducts]);

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
          {/* Multi-selection & Bulk Actions in Header */}
          {filteredProducts.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer select-none bg-white hover:bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 transition shadow-2xs">
                <input
                  type="checkbox"
                  checked={
                    filteredProducts.length > 0 &&
                    filteredProducts.every((p) => selectedProductIds.has(p.id))
                  }
                  onChange={toggleSelectAllProducts}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                />
                <span>Select All</span>
              </label>

              {selectedProductIds.size > 0 && (
                activeTab === 'active' ? (
                  <button
                    type="button"
                    onClick={handleBulkArchiveProducts}
                    disabled={isBulkDeleting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive Selected ({selectedProductIds.size})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleBulkRestoreProducts}
                    disabled={isBulkRestoring}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Selected ({selectedProductIds.size})</span>
                  </button>
                )
              )}
            </div>
          )}

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

      {/* Catalog Views Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('active');
            setSelectedProductIds(new Set());
          }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Active Catalog</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              activeTab === 'active'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {products.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('archived');
            setSelectedProductIds(new Set());
          }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'archived'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Archived Products</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              activeTab === 'archived'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {archivedProducts.length}
          </span>
        </button>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-[10px]">
              Active Catalog
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
              Published
            </span>
            <span className="text-xl font-extrabold text-gray-900">{stats.active}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <FileEdit className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-[10px]">
              Drafts / Inactive
            </span>
            <span className="text-xl font-extrabold text-gray-900">{stats.drafts}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-[10px]">
              Archived
            </span>
            <span className="text-xl font-extrabold text-gray-900">{stats.archived}</span>
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
          title={activeTab === 'archived' ? 'No archived products' : 'No products found'}
          description={
            activeTab === 'archived'
              ? archivedProducts.length === 0
                ? 'There are no archived products. Products moved to archive will appear here and can be restored at any time.'
                : 'No archived products match your current search and filter criteria.'
              : products.length === 0
              ? 'Get started by creating your first print product specification.'
              : 'No products match your current search and filter criteria.'
          }
          action={
            activeTab === 'active' && products.length === 0 ? (
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
          selectedIds={selectedProductIds}
          onToggleSelect={toggleProductSelection}
          onToggleSelectAll={toggleSelectAllProducts}
          onToggleActive={activeTab === 'active' ? handleToggleActive : undefined}
          onDeleteProduct={activeTab === 'active' ? handleArchiveProduct : undefined}
          onRestoreProduct={activeTab === 'archived' ? handleRestoreProduct : undefined}
          isArchivedView={activeTab === 'archived'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isSelected={selectedProductIds.has(product.id)}
              onToggleSelect={toggleProductSelection}
              onToggleActive={activeTab === 'active' ? handleToggleActive : undefined}
              onDeleteProduct={activeTab === 'active' ? handleArchiveProduct : undefined}
              onRestoreProduct={activeTab === 'archived' ? handleRestoreProduct : undefined}
              isArchivedView={activeTab === 'archived'}
            />
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel || (activeTab === 'archived' ? 'Restore' : 'Move to archive')}
        variant={confirmDialog.variant || 'danger'}
        isLoading={isBulkDeleting || isBulkRestoring}
      />
    </div>
  );
}
