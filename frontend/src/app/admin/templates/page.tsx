'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
} from '@/components/admin/shared';
import { TemplateListItem, ProductOption } from '@/components/admin/templates/templateForm/types';
import {
  LayoutTemplate,
  CheckCircle2,
  FileEdit,
  LayoutGrid,
  List,
} from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

export default function AdminTemplatesPage() {
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

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [tplRes, prodRes] = await Promise.all([
        fetch(`${API_URL}/admin/templates`, {
          headers: { Accept: 'application/json' },
        }),
        fetch(`${API_URL}/admin/products`, {
          headers: { Accept: 'application/json' },
        }),
      ]);

      const tplData = await tplRes.json();
      const prodData = await prodRes.json();

      if (tplData.success && Array.isArray(tplData.data)) {
        setTemplates(tplData.data);
      } else if (Array.isArray(tplData)) {
        setTemplates(tplData);
      }

      if (prodData.success && Array.isArray(prodData.data)) {
        setProducts(prodData.data.map((p: any) => ({ id: p.id, name: p.name, slug: p.slug })));
      } else if (Array.isArray(prodData)) {
        setProducts(prodData.map((p: any) => ({ id: p.id, name: p.name, slug: p.slug })));
      }
    } catch (err: any) {
      console.error('Failed to load design templates:', err);
      setError(err.message || 'Could not load templates from backend.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = async (template: TemplateListItem) => {
    const nextState = !template.is_active;

    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, is_active: nextState } : t))
    );

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      await fetch(`${API_URL}/admin/templates/${template.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_active: nextState }),
      });
    } catch (err) {
      console.error('Error updating template status:', err);
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_active: !nextState } : t))
      );
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const previous = [...templates];
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      await fetch(`${API_URL}/admin/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (err) {
      console.error('Error deleting template:', err);
      setTemplates(previous);
    }
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
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-2xs">
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
          onToggleActive={handleToggleActive}
          onDeleteTemplate={handleDeleteTemplate}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
