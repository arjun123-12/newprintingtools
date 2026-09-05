'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoadingState } from '@/components/admin/shared';
import { BasicTemplateInfo } from './BasicTemplateInfo';
import { TemplatePrintDimensions } from './TemplatePrintDimensions';
import { TemplateCanvasConfig } from './TemplateCanvasConfig';
import { TemplateThumbnail } from './TemplateThumbnail';
import { TemplateAttributes } from './TemplateAttributes';
import { TemplateStatus } from './TemplateStatus';
import { TemplateFormData, TemplateFormErrors, ProductOption } from './types';
import {
  createTemplateDraft,
  sanitizeCanvasJson,
} from '@/services/designTemplateService';
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
  'http://localhost:8000/api/v1';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  // A new admin template remains hidden until it is published from the designer.
  is_active: false,
  print_sides: 'front',
  width_mm: null,
  height_mm: null,
  margin_mm: 0,
  bleed_mm: 0,
  safe_area_mm: 0,
  canvas_json: {
    version: '6.0.0',
    objects: [],
    background: '#ffffff',
  },
  back_canvas_json: null,
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
  const [hasCustomizedMeasurements, setHasCustomizedMeasurements] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<TemplateTab>('details');

  const [loading, setLoading] = useState<boolean>(Boolean(mode === 'edit' && !initialData));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<TemplateFormErrors>({});
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLaunchingStudio, setIsLaunchingStudio] =
    useState<boolean>(false);

  const selectedProduct = products.find(
    (p) => p.id === formData.product_id || p.slug === formData.product_id || p.name === formData.product_id
  );

  const handleProductSelect = (selectedId: string) => {
    const prod = products.find(
      (p) => p.id === selectedId || p.slug === selectedId || p.name === selectedId
    );

    if (prod && !hasCustomizedMeasurements) {
      setFormData((prev) => ({
        ...prev,
        product_id: prod.id,
        print_sides: prod.print_sides || prev.print_sides || 'front',
        width_mm: prod.width_mm !== null && prod.width_mm !== undefined ? Number(prod.width_mm) : prev.width_mm,
        height_mm: prod.height_mm !== null && prod.height_mm !== undefined ? Number(prod.height_mm) : prev.height_mm,
        margin_mm: prod.margin_mm !== null && prod.margin_mm !== undefined ? Number(prod.margin_mm) : prev.margin_mm,
        bleed_mm: prod.bleed_mm !== null && prod.bleed_mm !== undefined ? Number(prod.bleed_mm) : prev.bleed_mm,
        safe_area_mm: prod.safe_area_mm !== null && prod.safe_area_mm !== undefined ? Number(prod.safe_area_mm) : prev.safe_area_mm,
      }));
    } else {
      setFormData((prev) => ({ ...prev, product_id: selectedId }));
    }
  };

  const handleLaunchStudio = async () => {
    const rawProductId = String(formData.product_id ?? '').trim();

    // AdminSelect should return product.id. This fallback also normalizes an
    // older saved form value that contains the product name or slug.
    const selectedProduct = products.find(
      (product) =>
        product.id === rawProductId ||
        product.slug === rawProductId ||
        product.name === rawProductId
    );

    const productId = selectedProduct?.id ?? rawProductId;

    if (!productId) {
      setErrors((previous) => ({
        ...previous,
        product_id: 'Please select a product.',
      }));

      setNotice({
        type: 'error',
        text: 'Please select a product.',
      });

      setCurrentTab('details');
      return;
    }

    if (!UUID_PATTERN.test(productId)) {
      setErrors((previous) => ({
        ...previous,
        product_id: 'The selected product has an invalid ID.',
      }));

      setNotice({
        type: 'error',
        text: `Selected product has an invalid UUID: ${productId}`,
      });

      setCurrentTab('details');
      return;
    }

    if (!formData.name.trim()) {
      setErrors((previous) => ({
        ...previous,
        name: 'Template name is required.',
      }));

      setNotice({
        type: 'error',
        text: 'Template name is required.',
      });

      setCurrentTab('details');
      return;
    }

    setIsLaunchingStudio(true);
    setNotice(null);

    try {
      // Existing template: update it first to save any changes (e.g. name or product) before launching studio.
      if (templateId) {
        const payload = {
          name: formData.name.trim(),
          category: formData.category || 'Corporate',
          product_id: productId,
          thumbnail_url: formData.thumbnail_url || null,
          is_active: formData.is_active,
          print_sides: formData.print_sides || 'front',
          width_mm: typeof formData.width_mm === 'number' && !isNaN(formData.width_mm) ? formData.width_mm : null,
          height_mm: typeof formData.height_mm === 'number' && !isNaN(formData.height_mm) ? formData.height_mm : null,
          margin_mm: typeof formData.margin_mm === 'number' && !isNaN(formData.margin_mm) ? formData.margin_mm : 0,
          bleed_mm: typeof formData.bleed_mm === 'number' && !isNaN(formData.bleed_mm) ? formData.bleed_mm : 0,
          safe_area_mm: typeof formData.safe_area_mm === 'number' && !isNaN(formData.safe_area_mm) ? formData.safe_area_mm : 0,
          artwork_config: formData.artwork_config || null,
          canvas_json: sanitizeCanvasJson(
            formData.canvas_json
          ),
          ...(formData.back_canvas_json ? { back_canvas_json: sanitizeCanvasJson(formData.back_canvas_json) } : {}),
        };
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;
        const res = await fetch(`${API_URL}/admin/design-templates/${templateId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('Could not save template changes before launching studio.');
        }

        router.push(
          `/design?mode=admin-template&templateId=${templateId}`
        );

        return;
      }

      // New template: create an inactive draft first.
      const template = await createTemplateDraft({
        product_id: productId,
        name: formData.name.trim(),
        category: formData.category || null,
        print_sides: formData.print_sides || 'front',
        width_mm: typeof formData.width_mm === 'number' && !isNaN(formData.width_mm) ? formData.width_mm : null,
        height_mm: typeof formData.height_mm === 'number' && !isNaN(formData.height_mm) ? formData.height_mm : null,
        margin_mm: typeof formData.margin_mm === 'number' && !isNaN(formData.margin_mm) ? formData.margin_mm : 0,
        bleed_mm: typeof formData.bleed_mm === 'number' && !isNaN(formData.bleed_mm) ? formData.bleed_mm : 0,
        safe_area_mm: typeof formData.safe_area_mm === 'number' && !isNaN(formData.safe_area_mm) ? formData.safe_area_mm : 0,
        canvas_json: formData.canvas_json || {
          version: '6.0.0',
          objects: [],
          background: '#ffffff',
        },
        back_canvas_json: formData.back_canvas_json || null,
        thumbnail_url: formData.thumbnail_url || null,
        artwork_config: formData.artwork_config || null,
        is_active: false,
      });

      router.push(
        `/design?mode=admin-template&templateId=${template.id}`
      );
      return;
    } catch (error) {
      console.error('Could not launch studio:', error);

      setNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Could not launch template designer.',
      });
    } finally {
      setIsLaunchingStudio(false);
    }
  };

  // Load products list for dropdown
  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;
        const res = await fetch(`${API_URL}/admin/products`, {
          headers: { 
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          cache: 'no-store',
        });
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setProducts(json.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            print_sides: p.print_sides,
            width_mm: p.width_mm,
            height_mm: p.height_mm,
            margin_mm: p.margin_mm,
            bleed_mm: p.bleed_mm,
            safe_area_mm: p.safe_area_mm,
          })));
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
    const normalize = (t: any): TemplateFormData => {
      let cj = t.canvas_json;
      if (Array.isArray(cj) && cj.length === 0) cj = null;
      if (typeof cj === 'object' && cj !== null && Object.keys(cj).length === 0) cj = null;

      const hasCustom = t.width_mm !== null || t.height_mm !== null || (t.print_sides && t.print_sides !== 'front');
      if (hasCustom) {
        setHasCustomizedMeasurements(true);
      }

      return {
        name: t.name || '',
        category: t.category || 'Corporate',
        product_id: t.product_id || t.product?.id || '',
        thumbnail_url: t.thumbnail_url || '',
        is_active: t.is_active !== false,
        print_sides: t.print_sides || 'front',
        width_mm: t.width_mm !== null && t.width_mm !== undefined && t.width_mm !== '' ? parseFloat(t.width_mm) : null,
        height_mm: t.height_mm !== null && t.height_mm !== undefined && t.height_mm !== '' ? parseFloat(t.height_mm) : null,
        margin_mm: t.margin_mm !== null && t.margin_mm !== undefined && t.margin_mm !== '' ? parseFloat(t.margin_mm) : 0,
        bleed_mm: t.bleed_mm !== null && t.bleed_mm !== undefined && t.bleed_mm !== '' ? parseFloat(t.bleed_mm) : 0,
        safe_area_mm: t.safe_area_mm !== null && t.safe_area_mm !== undefined && t.safe_area_mm !== '' ? parseFloat(t.safe_area_mm) : 0,
        canvas_json: cj || {
          version: '6.0.0',
          objects: [],
          background: '#ffffff',
        },
        back_canvas_json: t.back_canvas_json || null,
        artwork_config: t.artwork_config || null,
        attributes: Array.isArray(t.attributes) ? t.attributes : [],
      };
    };

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

      fetch(
        `${API_URL}/admin/design-templates/${templateId}`,
        {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          cache: 'no-store',
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

    if (formData.width_mm !== null && formData.width_mm !== undefined && (isNaN(formData.width_mm) || formData.width_mm <= 0)) {
      errs.width_mm = 'Width must be greater than 0 mm.';
    }
    if (formData.height_mm !== null && formData.height_mm !== undefined && (isNaN(formData.height_mm) || formData.height_mm <= 0)) {
      errs.height_mm = 'Height must be greater than 0 mm.';
    }
    if (formData.margin_mm !== null && formData.margin_mm !== undefined && (isNaN(formData.margin_mm) || formData.margin_mm < 0)) {
      errs.margin_mm = 'Margin cannot be negative.';
    }
    if (formData.bleed_mm !== null && formData.bleed_mm !== undefined && (isNaN(formData.bleed_mm) || formData.bleed_mm < 0)) {
      errs.bleed_mm = 'Bleed cannot be negative.';
    }
    if (formData.safe_area_mm !== null && formData.safe_area_mm !== undefined && (isNaN(formData.safe_area_mm) || formData.safe_area_mm < 0)) {
      errs.safe_area_mm = 'Safe area cannot be negative.';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setCurrentTab('details');
    }
    return Object.keys(errs).length === 0;
  };

  const handleSaveEdit = async () => {
    setIsSubmitting(true);
    setNotice(null);

    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category || 'Corporate',
        product_id: formData.product_id,
        thumbnail_url: formData.thumbnail_url || null,
        is_active: formData.is_active,
        print_sides: formData.print_sides || 'front',
        width_mm: typeof formData.width_mm === 'number' && !isNaN(formData.width_mm) ? formData.width_mm : null,
        height_mm: typeof formData.height_mm === 'number' && !isNaN(formData.height_mm) ? formData.height_mm : null,
        margin_mm: typeof formData.margin_mm === 'number' && !isNaN(formData.margin_mm) ? formData.margin_mm : 0,
        bleed_mm: typeof formData.bleed_mm === 'number' && !isNaN(formData.bleed_mm) ? formData.bleed_mm : 0,
        safe_area_mm: typeof formData.safe_area_mm === 'number' && !isNaN(formData.safe_area_mm) ? formData.safe_area_mm : 0,
        ...(formData.artwork_config ? { artwork_config: formData.artwork_config } : {}),
        ...(formData.back_canvas_json ? { back_canvas_json: formData.back_canvas_json } : {}),
      };

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;
      const res = await fetch(`${API_URL}/admin/design-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Could not save template changes.');
      }

      setNotice({ type: 'success', text: 'Template changes saved successfully.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error('Could not save template edit:', error);
      setNotice({
        type: 'error',
        text: error.message || 'Could not save template changes.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setNotice({ type: 'error', text: 'Please fill in all required fields.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (mode === 'edit') {
      await handleSaveEdit();
    } else {
      await handleLaunchStudio();
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

  // const designerUrl = formData.product_id
  //   ? `/admin/designer?productId=${formData.product_id}${templateId ? `&templateId=${templateId}` : ''}`
  //   : null;

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
          <button
            type="button"
            onClick={handleLaunchStudio}
            disabled={
              isLaunchingStudio ||
              !formData.product_id ||
              !formData.name.trim()
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Palette className="h-3.5 w-3.5" />

            <span>
              {isLaunchingStudio
                ? 'Opening Studio...'
                : 'Launch Studio'}
            </span>

            <ExternalLink className="ml-0.5 h-3 w-3 opacity-80" />
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isLaunchingStudio}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {mode === 'create'
                ? isLaunchingStudio
                  ? 'Opening Studio...'
                  : 'Create & Design'
                : isSubmitting
                  ? 'Saving...'
                  : 'Save Changes'}
            </span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${notice.type === 'success'
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
          <div className="space-y-6 animate-in fade-in duration-150">
            <BasicTemplateInfo
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              products={products}
              productsLoading={productsLoading}
              onProductSelect={handleProductSelect}
            />
            <TemplatePrintDimensions
              formData={formData}
              setFormData={setFormData}
              selectedProduct={selectedProduct}
              onCustomize={() => setHasCustomizedMeasurements(true)}
              errors={errors}
            />
          </div>
        )}

        {currentTab === 'canvas' && (
          <div className="animate-in fade-in duration-150">
            <TemplateCanvasConfig
              formData={formData}
              onLaunchStudio={handleLaunchStudio}
              isLaunchingStudio={isLaunchingStudio}
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
              disabled={isSubmitting || isLaunchingStudio}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {mode === 'create'
                  ? isLaunchingStudio
                    ? 'Opening Studio…'
                    : 'Create & Design'
                  : isSubmitting
                    ? 'Saving…'
                    : 'Save Template'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TemplateForm;
