'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TemplateTable,
} from '@/components/admin/templates/TemplateTable';
import {
  TemplateFilters,
  TemplateFiltersState,
} from '@/components/admin/templates/TemplateFilters';
import { TemplateCard } from '@/components/admin/templates/TemplateCard';
import { TemplateActions } from '@/components/admin/templates/TemplateActions';
import {
  EmptyState,
  LoadingState,
  ErrorState,
  ConfirmDialog,
} from '@/components/admin/shared';
import { TemplateListItem, ProductOption } from '@/components/admin/templates/templateForm/types';
import {
  LayoutTemplate,
  CheckCircle2,
  FileEdit,
  LayoutGrid,
  List,
  Trash2,
} from 'lucide-react';

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '');

type UnknownRecord = Record<string, any>;

function findArray(
  payload: UnknownRecord | null,
  collectionKey: string
): UnknownRecord[] {
  const candidates = [
    payload,
    payload?.data,
    payload?.data?.data,
    payload?.data?.[collectionKey],
    payload?.[collectionKey],
  ];

  const collection = candidates.find(Array.isArray);
  return Array.isArray(collection) ? collection : [];
}

function normalizeTemplates(payload: UnknownRecord): TemplateListItem[] {
  return findArray(payload, 'templates').map((template) => ({
    ...template,
    id: String(template.id),
    product_id: String(
      template.product_id ?? template.product?.id ?? ''
    ),
    name: String(template.name ?? 'Untitled Template'),
    category: template.category ?? null,
    thumbnail_url: template.thumbnail_url ?? null,
    is_active:
      template.is_active === true ||
      template.is_active === 1 ||
      template.is_active === '1',
  })) as TemplateListItem[];
}

function normalizeProducts(payload: UnknownRecord): ProductOption[] {
  return findArray(payload, 'products').map((product) => ({
    id: String(product.id),
    name: String(product.name ?? 'Unnamed Product'),
    slug: product.slug ? String(product.slug) : undefined,
  })) as ProductOption[];
}

export default function AdminTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');

  const [filters, setFilters] = useState<TemplateFiltersState>({
    search: '',
    category: '',
    productId: '',
    status: '',
  });

  // Multi-select & Bulk Delete State
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }, []);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('auth_token');
    router.replace('/admin/login');
  }, [router]);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setSelectedTemplateIds(new Set());

      const token = getToken();

      if (!token) {
        handleUnauthorized();
        throw new Error('Please log in to view design templates.');
      }

      const authHeaders = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const [tplRes, prodRes] = await Promise.all([
        fetch(`${API_URL}/admin/design-templates`, {
          headers: authHeaders,
          cache: 'no-store',
        }),
        fetch(`${API_URL}/admin/products`, {
          headers: authHeaders,
          cache: 'no-store',
        }),
      ]);

      if (tplRes.status === 401 || prodRes.status === 401) {
        handleUnauthorized();
        throw new Error('Your login session has expired.');
      }

      const [tplData, prodData] = await Promise.all([
        tplRes.json().catch(() => null),
        prodRes.json().catch(() => null),
      ]);

      if (!tplRes.ok) {
        throw new Error(
          tplData?.message ??
          `Could not load templates (${tplRes.status}).`
        );
      }

      if (!prodRes.ok) {
        throw new Error(
          prodData?.message ??
          `Could not load products (${prodRes.status}).`
        );
      }

      const normalizedTemplates = normalizeTemplates(tplData ?? {});
      const normalizedProducts = normalizeProducts(prodData ?? {});

      setTemplates(normalizedTemplates);
      setProducts(normalizedProducts);
    } catch (err: any) {
      console.error('Failed to load design templates:', err);
      setError(err.message || 'Could not load templates from backend.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, handleUnauthorized]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleActive = async (template: TemplateListItem) => {
    const nextState = !template.is_active;

    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, is_active: nextState } : t))
    );

    try {
      const token = getToken();

      if (!token) {
        handleUnauthorized();
        throw new Error('Please log in again.');
      }

      const response = await fetch(`${API_URL}/admin/design-templates/${template.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: nextState }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Your login session has expired.');
      }

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message ?? 'Could not update template.');
      }
    } catch (err) {
      console.error('Error updating template status:', err);
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_active: !nextState } : t))
      );
    }
  };

  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllTemplates = () => {
    if (filteredTemplates.length === 0) return;
    const allSelected = filteredTemplates.every((t) => selectedTemplateIds.has(t.id));
    if (allSelected) {
      setSelectedTemplateIds(new Set());
    } else {
      setSelectedTemplateIds(new Set(filteredTemplates.map((t) => t.id)));
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Template',
      message: 'Are you sure you want to permanently delete this template? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const token = getToken();
          if (!token) {
            handleUnauthorized();
            throw new Error('Please log in again.');
          }

          const response = await fetch(`${API_URL}/admin/design-templates/${templateId}`, {
            method: 'DELETE',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.status === 401) {
            handleUnauthorized();
            throw new Error('Your login session has expired.');
          }

          if (!response.ok) {
            const result = await response.json().catch(() => null);
            throw new Error(result?.message ?? 'Could not delete template.');
          }

          setTemplates((prev) => prev.filter((t) => t.id !== templateId));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          alert('Failed to delete template: ' + (err.message || 'Unknown error'));
        }
      },
    });
  };

  const handleBulkDeleteTemplates = () => {
    const ids = Array.from(selectedTemplateIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Delete ${ids.length} Selected Template${ids.length > 1 ? 's' : ''}`,
      message: `Are you sure you want to permanently delete the ${ids.length} selected template${ids.length > 1 ? 's' : ''}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          setIsBulkDeleting(true);
          const token = getToken();
          if (!token) {
            handleUnauthorized();
            throw new Error('Please log in again.');
          }

          const response = await fetch(`${API_URL}/admin/design-templates/bulk-delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ ids }),
          });

          if (response.status === 401) {
            handleUnauthorized();
            throw new Error('Your login session has expired.');
          }

          if (!response.ok) {
            const result = await response.json().catch(() => null);
            throw new Error(result?.message ?? 'Could not delete templates.');
          }

          setSelectedTemplateIds(new Set());
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData(true);
        } catch (err: any) {
          alert('Failed to delete templates: ' + (err.message || 'Unknown error'));
        } finally {
          setIsBulkDeleting(false);
        }
      },
    });
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesCat = t.category?.toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }

      if (filters.productId && t.product_id !== filters.productId) {
        return false;
      }

      if (filters.category && t.category !== filters.category) {
        return false;
      }

      if (filters.status) {
        const isActive = filters.status === 'active';
        if (t.is_active !== isActive) return false;
      }

      return true;
    });
  }, [templates, filters]);

  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter((t) => t.is_active).length;
    const drafts = total - active;
    return { total, active, drafts };
  }, [templates]);

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen font-sans space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Design Templates Library
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Create, customize, and publish starter artwork layouts for online design studio customers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Multi-selection & Bulk Delete in Header */}
          {filteredTemplates.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer select-none bg-white hover:bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 transition shadow-2xs">
                <input
                  type="checkbox"
                  checked={
                    filteredTemplates.length > 0 &&
                    filteredTemplates.every((t) => selectedTemplateIds.has(t.id))
                  }
                  onChange={toggleSelectAllTemplates}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                />
                <span>Select All</span>
              </label>

              {selectedTemplateIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDeleteTemplates}
                  disabled={isBulkDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedTemplateIds.size})</span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid'
                ? 'bg-gray-100 text-blue-600 font-bold'
                : 'text-gray-400 hover:text-gray-700'
                }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table'
                ? 'bg-gray-100 text-blue-600 font-bold'
                : 'text-gray-400 hover:text-gray-700'
                }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <TemplateActions onRefresh={() => loadData(true)} isRefreshing={refreshing} />
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <LayoutTemplate className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-[10px]">
              Total Templates
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
              Published & Active
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

      {/* Filters */}
      <TemplateFilters
        filters={filters}
        onFilterChange={setFilters}
        products={products}
      />

      {/* Content Area */}
      {loading ? (
        <LoadingState message="Loading templates…" className="py-24 bg-white rounded-xl border border-gray-200" />
      ) : error ? (
        <ErrorState
          title="Could not load templates"
          message={error}
          onRetry={() => loadData(false)}
        />
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          title="No templates found"
          description={
            templates.length === 0
              ? 'Create your first design template or open visual studio to design starter artwork.'
              : 'No templates match your filter criteria.'
          }
          action={
            templates.length === 0 ? (
              <Link
                href="/admin/templates/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                <span>Create First Template</span>
              </Link>
            ) : undefined
          }
          className="bg-white py-16"
        />
      ) : viewMode === 'table' ? (
        <TemplateTable
          templates={filteredTemplates}
          selectedIds={selectedTemplateIds}
          onToggleSelect={toggleTemplateSelection}
          onToggleSelectAll={toggleSelectAllTemplates}
          onToggleActive={handleToggleActive}
          onDeleteTemplate={handleDeleteTemplate}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedTemplateIds.has(template.id)}
              onToggleSelect={toggleTemplateSelection}
              onToggleActive={handleToggleActive}
              onDeleteTemplate={handleDeleteTemplate}
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
        confirmLabel="Delete"
        variant="danger"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
