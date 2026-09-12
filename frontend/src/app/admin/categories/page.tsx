'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderTree,
  Plus,
  Search,
  Edit2,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
} from 'lucide-react';
import {
  AdminInput,
  AdminTextarea,
  AdminSelect,
  AdminSwitch,
  AdminNumberInput,
  FormSection,
  FormGrid,
  StatusBadge,
  ConfirmDialog,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@/components/admin/shared';
import { formatImageUrl } from '@/utils/imageUrl';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  parent?: {
    id: string;
    name: string;
  } | null;
}

interface CategoryForm {
  id?: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

const initialForm: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  parent_id: '',
  image_url: '',
  sort_order: 0,
  is_active: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  // Multi-select & Bulk Delete State
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [confirmBulkDialog, setConfirmBulkDialog] = useState<boolean>(false);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);
      setSelectedCategoryIds(new Set());

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      const response = await fetch(`${API_URL}/admin/categories`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const responseText = await response.text();
      let result: any = null;

      try {
        result = JSON.parse(responseText);
      } catch {
        result = { message: responseText };
      }

      if (!response.ok) {
        throw new Error(result?.message || `Could not load categories (${response.status}).`);
      }

      const rows = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      setCategories(rows);
    } catch (error: any) {
      console.error('Category loading error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Could not load categories.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;

    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.slug.toLowerCase().includes(query) ||
        Boolean(c.description?.toLowerCase().includes(query))
    );
  }, [categories, search]);

  const openCreateForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setErrors({});
    setMessage(null);
    setShowForm(true);
  };

  const openEditForm = (cat: Category) => {
    setForm({
      id: cat.id,
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      parent_id: cat.parent_id || '',
      image_url: cat.image_url || '',
      sort_order: cat.sort_order || 0,
      is_active: cat.is_active !== false,
    });
    setEditingId(cat.id);
    setErrors({});
    setMessage(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setErrors({});
    setShowForm(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage(null);
      setErrors({});

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        description: form.description.trim() || null,
        parent_id: form.parent_id || null,
        image_url: form.image_url.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: Boolean(form.is_active),
      };

      const url = editingId ? `${API_URL}/admin/categories/${editingId}` : `${API_URL}/admin/categories`;
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let result: any = null;

      try {
        result = JSON.parse(responseText);
      } catch {
        result = { message: responseText };
      }

      if (!response.ok || !result?.success) {
        if (response.status === 422 && result?.errors) {
          const validationErrors: Record<string, string> = {};
          Object.entries(result.errors).forEach(([field, fieldMessages]) => {
            validationErrors[field] = Array.isArray(fieldMessages) ? String(fieldMessages[0]) : String(fieldMessages);
          });
          setErrors(validationErrors);
        }
        throw new Error(result?.message || `Could not save category (${response.status}).`);
      }

      setMessage({
        type: 'success',
        text: editingId ? 'Category updated successfully.' : 'Category created successfully.',
      });
      setShowForm(false);
      setForm(initialForm);
      setEditingId(null);
      await loadCategories();
    } catch (error: any) {
      console.error('Category save error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Could not save category.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    const nextState = !cat.is_active;

    // Optimistic UI update
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, is_active: nextState } : c)));

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      await fetch(`${API_URL}/admin/categories/${cat.id}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_active: nextState }),
      });
    } catch (err) {
      console.error('Failed to toggle category active status:', err);
      // Revert
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, is_active: !nextState } : c)));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const prevList = [...categories];
    setCategories((prev) => prev.filter((c) => c.id !== id));

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      await fetch(`${API_URL}/admin/categories/${id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setMessage({ type: 'success', text: 'Category deleted successfully.' });
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      setCategories(prevList);
      setMessage({ type: 'error', text: err.message || 'Failed to delete category.' });
    }
  };

  const toggleCategorySelection = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCategories = () => {
    if (filteredCategories.length === 0) return;
    const allSelected = filteredCategories.every((c) => selectedCategoryIds.has(c.id));
    if (allSelected) {
      setSelectedCategoryIds(new Set());
    } else {
      setSelectedCategoryIds(new Set(filteredCategories.map((c) => c.id)));
    }
  };

  const handleBulkDeleteCategories = async () => {
    const ids = Array.from(selectedCategoryIds);
    if (ids.length === 0) return;

    try {
      setIsBulkDeleting(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      const response = await fetch(`${API_URL}/admin/categories/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Failed to delete categories');
      }

      setMessage({ type: 'success', text: `${ids.length} categories deleted successfully.` });
      setSelectedCategoryIds(new Set());
      setConfirmBulkDialog(false);
      await loadCategories();
    } catch (err: any) {
      console.error('Bulk delete categories failed:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to delete categories' });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen font-sans space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Categories Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Organize catalog hierarchy for business cards, brochures, apparel, and signage.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Notice Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-medium">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Add / Edit Form Modal / Card */}
      {showForm && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900">
              {editingId ? 'Edit Category' : 'Create New Category'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormGrid cols={2} gap="md">
              <AdminInput
                label="Category Name"
                placeholder="e.g. Business Cards"
                value={form.name}
                required
                error={errors.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    name: val,
                    slug: !editingId ? slugify(val) : prev.slug,
                  }));
                }}
              />

              <AdminInput
                label="Slug"
                placeholder="e.g. business-cards"
                value={form.slug}
                required
                error={errors.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
              />

              <AdminSelect
                label="Parent Category (Optional)"
                value={form.parent_id}
                error={errors.parent_id}
                onChange={(e) => setForm((prev) => ({ ...prev, parent_id: e.target.value }))}
                placeholder="None (Top Level)"
                options={categories
                  .filter((c) => c.id !== editingId)
                  .map((c) => ({ value: c.id, label: c.name }))}
              />

              <AdminNumberInput
                label="Sort Order"
                min={0}
                value={form.sort_order}
                onChange={(val) => setForm((prev) => ({ ...prev, sort_order: typeof val === 'number' ? val : 0 }))}
                helperText="Lower numbers appear first in catalog navigation."
              />

              <div className="sm:col-span-2">
                <AdminInput
                  label="Category Image URL (Optional)"
                  placeholder="https://example.com/images/category.jpg"
                  value={form.image_url}
                  error={errors.image_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2">
                <AdminTextarea
                  label="Description"
                  placeholder="Overview of products within this category…"
                  value={form.description}
                  rows={2}
                  error={errors.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2 pt-1 border-t border-gray-100">
                <AdminSwitch
                  label="Category Active"
                  description="Visible in customer storefront navigation."
                  checked={form.is_active}
                  onChange={(val) => setForm((prev) => ({ ...prev, is_active: val }))}
                />
              </div>
            </FormGrid>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update Category' : 'Create Category'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar & Multi-Select Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex items-center w-full sm:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search categories by name, slug, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-gray-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {filteredCategories.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer select-none bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200 transition shadow-2xs">
              <input
                type="checkbox"
                checked={
                  filteredCategories.length > 0 &&
                  filteredCategories.every((c) => selectedCategoryIds.has(c.id))
                }
                onChange={toggleSelectAllCategories}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
              />
              <span>Select All</span>
            </label>

            {selectedCategoryIds.size > 0 && (
              <button
                type="button"
                onClick={() => setConfirmBulkDialog(true)}
                disabled={isBulkDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedCategoryIds.size})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Categories Table */}
      {loading ? (
        <LoadingState message="Loading categories…" className="py-24 bg-white rounded-xl border border-gray-200" />
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          title="No categories found"
          description={
            categories.length === 0
              ? 'Get started by creating your first product category.'
              : 'No categories match your search.'
          }
          action={
            categories.length === 0 ? (
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            ) : undefined
          }
          className="bg-white py-16"
        />
      ) : (
        <div className="w-full bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-gray-200">
              <thead className="bg-gray-50/80 text-gray-600 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredCategories.length > 0 &&
                        filteredCategories.every((c) => selectedCategoryIds.has(c.id))
                      }
                      onChange={toggleSelectAllCategories}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Parent</th>
                  <th className="py-3.5 px-4">Sort Order</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Active</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredCategories.map((category) => {
                  const isSelected = selectedCategoryIds.has(category.id);
                  return (
                    <tr
                      key={category.id}
                      className={`hover:bg-gray-50/60 transition-colors group ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCategorySelection(category.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {category.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={formatImageUrl(category.image_url)}
                                alt={category.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FolderTree className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block">{category.name}</span>
                            {category.description && (
                              <span className="text-[11px] text-gray-400 line-clamp-1 max-w-xs block">
                                {category.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-gray-600 text-[11px]">
                        /{category.slug}
                      </td>

                      <td className="py-3 px-4 text-gray-600 text-[11px]">
                        {category.parent?.name || '—'}
                      </td>

                      <td className="py-3 px-4 font-semibold text-gray-700">
                        {category.sort_order}
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={category.is_active ? 'active' : 'inactive'} />
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(category)}
                          className={`
                            w-8 h-4 rounded-full transition-colors relative inline-block cursor-pointer
                            ${category.is_active ? 'bg-blue-600' : 'bg-gray-200'}
                          `}
                        >
                          <span
                            className={`
                              w-3 h-3 bg-white rounded-full transition-transform absolute top-0.5
                              ${category.is_active ? 'left-4.5' : 'left-0.5'}
                            `}
                          />
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditForm(category)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(category)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Single Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            handleDeleteCategory(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete Category"
        message={`Are you sure you want to delete category "${deleteTarget?.name}"? Products under this category will become uncategorized.`}
        confirmLabel="Delete Category"
        variant="danger"
      />

      {/* Delete Multiple Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmBulkDialog}
        onClose={() => setConfirmBulkDialog(false)}
        onConfirm={handleBulkDeleteCategories}
        title={`Delete ${selectedCategoryIds.size} Selected Categories`}
        message={`Are you sure you want to permanently delete the ${selectedCategoryIds.size} selected categories? Products under these categories will become uncategorized. This action cannot be undone.`}
        confirmLabel="Delete Selected"
        variant="danger"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
