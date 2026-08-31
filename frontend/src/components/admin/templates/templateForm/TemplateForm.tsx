'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoadingState } from '@/components/admin/shared';
import { BasicTemplateInfo } from './BasicTemplateInfo';
import { TemplateCanvasConfig } from './TemplateCanvasConfig';
import { TemplateThumbnail } from './TemplateThumbnail';
import { TemplateAttributes } from './TemplateAttributes';
import { TemplateStatus } from './TemplateStatus';
import { TemplateFormData, TemplateFormErrors, ProductOption } from './types';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Palette,
  ExternalLink,
  Save,
  FileText,
  Sparkles,
  Sliders,
  ImageIcon,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

export interface TemplateFormProps {
  mode: 'create' | 'edit';
  templateId?: string;
  initialData?: any;
  onSuccess?: (savedTemplate: any) => void;
  onCancel?: () => void;
}

const defaultInitialForm: TemplateFormData = {
  name: '',
  category: 'Corporate',
  product_id: '',
  thumbnail_url: '',
  is_active: true,
  canvas_json: {
    version: '6.0.0',
    objects: [],
    background: '#ffffff',
  },
  attributes: [],
};

type TemplateTab = 'details' | 'canvas' | 'options' | 'thumbnail_status';

const TABS: { id: TemplateTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'details', label: '1. Basic Info & Product', icon: FileText },
  { id: 'canvas', label: '2. Visual Studio & Canvas', icon: Sparkles },
  { id: 'options', label: '3. Printing Options', icon: Sliders },
  { id: 'thumbnail_status', label: '4. Preview & Publishing', icon: ImageIcon },
];

export const TemplateForm: React.FC<TemplateFormProps> = ({
  mode,
  templateId,
  initialData,
  onSuccess,
  onCancel,
}) => {
  const router = useRouter();

  const [formData, setFormData] = useState<TemplateFormData>(defaultInitialForm);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<TemplateTab>('details');

  const [loading, setLoading] = useState<boolean>(Boolean(mode === 'edit' && !initialData));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<TemplateFormErrors>({});
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load products list for dropdown
  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const res = await fetch(`${API_URL}/admin/products`, {
          headers: { Accept: 'application/json' },
        });
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setProducts(json.data.map((p: any) => ({ id: p.id, name: p.name, slug: p.slug })));
        }
      } catch (err) {
        console.warn('Could not load products for template assignment:', err);
      } finally {
        if (isMounted) setProductsLoading(false);
      }
    };

    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load initial template data
  useEffect(() => {
    const normalize = (t: any): TemplateFormData => ({
      name: t.name || '',
      category: t.category || 'Corporate',
      product_id: t.product_id || t.product?.id || '',
      thumbnail_url: t.thumbnail_url || '',
      is_active: t.is_active !== false,
      canvas_json: t.canvas_json || {
        version: '6.0.0',
        objects: [],
        background: '#ffffff',
      },
      attributes: Array.isArray(t.attributes) ? t.attributes : [],
    });

    if (initialData) {
      setFormData(normalize(initialData));
      setLoading(false);
      return;
    }

    if (mode === 'edit') {
      if (!templateId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      fetch(`${API_URL}/admin/templates/${templateId}`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json) => {
          if (json.success && json.data) {
            setFormData(normalize(json.data));
          }
        })
        .catch((err) => {
          console.error('Failed to load template details:', err);
          setNotice({ type: 'error', text: 'Could not load template details for editing.' });
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [mode, templateId, initialData]);

  const validate = (): boolean => {
    const errs: TemplateFormErrors = {};
    if (!formData.name.trim()) errs.name = 'Template name is required.';
    if (!formData.product_id) errs.product_id = 'Please select an associated product.';

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setCurrentTab('details');
    }
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setNotice({ type: 'error', text: 'Please fill in all required fields.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    const payload = {
      name: formData.name.trim(),
      category: formData.category || 'Corporate',
      product_id: formData.product_id,
      thumbnail_url: formData.thumbnail_url || null,
      is_active: formData.is_active,
      canvas_json: formData.canvas_json,
    };

    const isEdit = mode === 'edit' && templateId;
    const url = isEdit ? `${API_URL}/admin/templates/${templateId}` : `${API_URL}/admin/templates`;
    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      let result: any = null;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { message: responseText };
      }

      if (!res.ok || !result?.success) {
        if (result?.errors) {
          const fieldErrors: TemplateFormErrors = {};
          Object.keys(result.errors).forEach((key) => {
            fieldErrors[key] = Array.isArray(result.errors[key]) ? result.errors[key][0] : result.errors[key];
          });
          setErrors(fieldErrors);
        }
        throw new Error(result?.message || `Template save failed (HTTP ${res.status}).`);
      }

      const saved = result.data;
      setNotice({
        type: 'success',
        text: isEdit ? 'Template updated successfully!' : 'Template created successfully!',
      });

      onSuccess?.(saved);

      if (mode === 'create' && saved?.id) {
        router.push(`/admin/templates/${saved.id}/edit`);
      }
    } catch (err: any) {
      console.error('Template save error:', err);
      setNotice({ type: 'error', text: err.message || 'An error occurred while saving.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextTab = () => {
    const currentIndex = TABS.findIndex((t) => t.id === currentTab);
    if (currentIndex < TABS.length - 1) {
      setCurrentTab(TABS[currentIndex + 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevTab = () => {
    const currentIndex = TABS.findIndex((t) => t.id === currentTab);
    if (currentIndex > 0) {
      setCurrentTab(TABS[currentIndex - 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return <LoadingState message="Loading template details…" className="py-24" />;
  }

  const designerUrl = formData.product_id
    ? `/admin/designer?productId=${formData.product_id}${templateId ? `&templateId=${templateId}` : ''}`
    : null;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 pb-16 font-sans select-none">
      {/* Sticky Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-4 z-20 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/templates"
            className="p-2 text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
            title="Back to templates list"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>{mode === 'create' ? 'Create Design Template' : formData.name || 'Edit Template'}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${formData.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {formData.is_active ? 'Published' : 'Draft'}
              </span>
            </h1>
            <p className="text-[11px] text-gray-400">
              {mode === 'create' ? 'Define details and launch visual studio' : `Template ID: ${templateId || 'N/A'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {designerUrl && (
            <Link
              href={designerUrl}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Launch Studio</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
            </Link>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Saving…' : mode === 'create' ? 'Create Template' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-medium">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab Navigation Pill Bar */}
      <div className="bg-white p-1.5 rounded-2xl border border-gray-200 shadow-xs flex items-center overflow-x-auto gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          const hasError = tab.id === 'details' && (errors.name || errors.product_id);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentTab(tab.id)}
              className={`
                flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all
                ${isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'}
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
              {hasError && (
                <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white ml-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tabbed Form Sections */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-6"
      >
        {currentTab === 'details' && (
          <div className="animate-in fade-in duration-150">
            <BasicTemplateInfo
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              products={products}
              productsLoading={productsLoading}
            />
          </div>
        )}

        {currentTab === 'canvas' && (
          <div className="animate-in fade-in duration-150">
            <TemplateCanvasConfig
              formData={formData}
              setFormData={setFormData}
              templateId={templateId}
            />
          </div>
        )}

        {currentTab === 'options' && (
          <div className="animate-in fade-in duration-150">
            <TemplateAttributes formData={formData} setFormData={setFormData} />
          </div>
        )}

        {currentTab === 'thumbnail_status' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <TemplateThumbnail formData={formData} setFormData={setFormData} />
            <TemplateStatus formData={formData} setFormData={setFormData} />
          </div>
        )}

        {/* Step Navigation Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
          <div>
            {currentTab !== 'details' ? (
              <button
                type="button"
                onClick={prevTab}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Tab</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancel || (() => router.push('/admin/templates'))}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentTab !== 'thumbnail_status' ? (
              <button
                type="button"
                onClick={nextTab}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100/70 transition-colors"
              >
                <span>Next Tab</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving…' : mode === 'create' ? 'Create Template' : 'Save Template'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TemplateForm;
