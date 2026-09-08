'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FormActions, LoadingState } from '@/components/admin/shared';
import { BasicInformation } from './BasicInformation';
import { ProductContent } from './ProductContent';
import { ProductMedia } from './ProductMedia';
import { ProductConfiguration } from './ProductConfiguration';
import { ProductAttributes } from './ProductAttributes';
import { ProductVariants } from './ProductVariants';
import { ProductPricing } from './ProductPricing';
import { ProductPrintDimensions } from './ProductPrintDimensions';
import { ProductPrintAreas } from './ProductPrintAreas';
import { ProductTemplates } from './ProductTemplates';
import { ProductInventory } from './ProductInventory';
import { ProductShipping } from './ProductShipping';
import { ProductSeo } from './ProductSeo';
import { ProductFormData, FormErrors, CategoryOption } from './types';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
  Sliders,
  Image as ImageIcon,
  Printer,
  Package,
  Search,
  ChevronRight,
  ChevronLeft,
  Save,
} from 'lucide-react';
import Link from 'next/link';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

export interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  initialData?: any;
  onSuccess?: (savedProduct: any) => void;
  onCancel?: () => void;
}

const defaultInitialForm: ProductFormData = {
  name: '',
  slug: '',
  sku: '',
  category_id: '',
  product_type: 'standard_print',
  short_description: '',
  description: '',
  featured_image_url: '',
  media: {
    front: [],
    back: [],
  },
  min_quantity: 1,
  turnaround_days: 3,
  allow_custom_design: true,
  allow_customer_upload: true,
  is_active: true,
  is_featured: false,
  status: 'draft',
  attributes: [],
  variants: [],
  base_price: 0,
  sale_price: '',
  cost_price: '',
  pricing_tiers: [],
  sides_count: 1,
  sides: [
    {
      side_number: 1,
      name: 'Front',
      type: 'front',
      sort_order: 1,
      is_active: true,
      print_areas: [],
    }
  ],
  width_mm: null,
  height_mm: null,
  margin_mm: 0,
  bleed_mm: 0,
  safe_area_mm: 0,
  design_template_ids: [],
  track_inventory: false,
  stock_quantity: 0,
  low_stock_threshold: 10,
  weight_kg: '',
  length_cm: '',
  width_cm: '',
  height_cm: '',
  free_shipping: false,
  meta_title: '',
  meta_description: '',
};

type FormTab = 'general' | 'pricing' | 'inventory' | 'seo' | string;

export const ProductForm: React.FC<ProductFormProps> = ({
  mode,
  productId,
  initialData,
  onSuccess,
  onCancel,
}) => {
  const router = useRouter();

  const [formData, setFormData] = useState<ProductFormData>(defaultInitialForm);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);

  const [currentTab, setCurrentTab] = useState<FormTab>('general');
  const [loading, setLoading] = useState<boolean>(Boolean(mode === 'edit' && !initialData));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const TABS = useMemo(() => {
    const baseTabs: { id: FormTab; label: string; icon: React.FC<{ className?: string }> }[] = [
      { id: 'general', label: '1. General Details', icon: FileText },
    ];

    formData.sides.forEach((side, index) => {
      baseTabs.push({
        id: `side_${index}`,
        label: `${index + 2}. ${side.name || `Side ${index + 1}`}`,
        icon: ImageIcon,
      });
    });

    const offset = formData.sides.length + 2;
    baseTabs.push(
      { id: 'pricing', label: `${offset}. Attributes & Pricing`, icon: Sliders },
      { id: 'inventory', label: `${offset + 1}. Inventory & Shipping`, icon: Package },
      { id: 'seo', label: `${offset + 2}. SEO & Storefront`, icon: Search }
    );

    return baseTabs;
  }, [formData.sides]);

  // Load categories
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;
        const res = await fetch(`${API_URL}/admin/categories`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const json = await res.json();
        if (isMounted) {
          if (json.success && Array.isArray(json.data)) {
            setCategories(json.data);
          } else if (Array.isArray(json)) {
            setCategories(json);
          }
        }
      } catch (err) {
        console.warn('Could not load admin categories, trying fallback:', err);
        try {
          const fallbackRes = await fetch(`${API_URL}/categories`);
          const fallbackJson = await fallbackRes.json();
          if (isMounted && fallbackJson.data) {
            setCategories(fallbackJson.data);
          }
        } catch {
          // ignore
        }
      } finally {
        if (isMounted) setCategoriesLoading(false);
      }
    };

    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Normalize and load initial data
  useEffect(() => {
    const normalizeProduct = (p: any): ProductFormData => ({
      name: p.name || '',
      slug: p.slug || '',
      sku: p.sku || '',
      category_id: p.category_id || p.category?.id || '',
      product_type: p.product_type || 'standard_print',
      short_description: p.short_description || '',
      description: p.description || '',
      featured_image_url: p.featured_image_url || '',
      media: {
        front: p.media?.front ? p.media.front.map((img: any) => img.url).filter((url: string) => url !== p.featured_image_url) : (Array.isArray(p.images) ? p.images.filter((i: any) => i.side === 'front').map((img: any) => img.url).filter((url: string) => url !== p.featured_image_url) : []),
        back: p.media?.back ? p.media.back.map((img: any) => img.url) : (Array.isArray(p.images) ? p.images.filter((i: any) => i.side === 'back').map((img: any) => img.url) : []),
      },
      min_quantity: typeof p.min_quantity === 'number' ? p.min_quantity : 1,
      turnaround_days: typeof p.turnaround_days === 'number' ? p.turnaround_days : 3,
      allow_custom_design: p.allow_custom_design !== false,
      allow_customer_upload: p.allow_customer_upload !== false,
      is_active: p.is_active !== false,
      is_featured: Boolean(p.is_featured),
      status: p.status || (p.is_active ? 'published' : 'draft'),
      attributes: Array.isArray(p.attributes) ? p.attributes : [],
      variants: Array.isArray(p.variants) ? p.variants : [],
      base_price: typeof p.base_price === 'number' ? p.base_price : parseFloat(p.base_price) || 0,
      sale_price: p.sale_price !== null && p.sale_price !== undefined && p.sale_price !== '' ? parseFloat(p.sale_price) : '',
      cost_price: p.cost_price !== null && p.cost_price !== undefined && p.cost_price !== '' ? parseFloat(p.cost_price) : '',
      pricing_tiers: Array.isArray(p.pricing_tiers) ? p.pricing_tiers : [],
      sides_count: Array.isArray(p.sides) && p.sides.length > 0 ? p.sides.length : 1,
      sides: Array.isArray(p.sides) && p.sides.length > 0
        ? p.sides.map((side: any) => ({
          id: side.id,
          side_number: side.side_number,
          name: side.name,
          type: side.type,
          sort_order: side.sort_order,
          is_active: side.is_active !== false,
          background_color: side.background_color,
          background_image_url: side.background_image_url,
          preview_image_url: side.preview_image_url,
          mockup_image_url: side.mockup_image_url,
          print_areas: Array.isArray(side.print_areas) ? side.print_areas : [],
        }))
        : [
          {
            side_number: 1,
            name: 'Front',
            type: 'front',
            sort_order: 1,
            is_active: true,
            print_areas: [],
          }
        ],
      width_mm: p.width_mm !== null && p.width_mm !== undefined && p.width_mm !== '' ? parseFloat(p.width_mm) : null,
      height_mm: p.height_mm !== null && p.height_mm !== undefined && p.height_mm !== '' ? parseFloat(p.height_mm) : null,
      margin_mm: p.margin_mm !== null && p.margin_mm !== undefined && p.margin_mm !== '' ? parseFloat(p.margin_mm) : 0,
      bleed_mm: p.bleed_mm !== null && p.bleed_mm !== undefined && p.bleed_mm !== '' ? parseFloat(p.bleed_mm) : 0,
      safe_area_mm: p.safe_area_mm !== null && p.safe_area_mm !== undefined && p.safe_area_mm !== '' ? parseFloat(p.safe_area_mm) : 0,
      design_template_ids: Array.isArray(p.design_template_ids) ? p.design_template_ids : [],
      track_inventory: Boolean(p.track_inventory),
      stock_quantity: typeof p.stock_quantity === 'number' ? p.stock_quantity : 0,
      low_stock_threshold: typeof p.low_stock_threshold === 'number' ? p.low_stock_threshold : 10,
      weight_kg: p.weight_kg ?? '',
      length_cm: p.length_cm ?? '',
      width_cm: p.width_cm ?? '',
      height_cm: p.height_cm ?? '',
      free_shipping: Boolean(p.free_shipping),
      meta_title: p.meta_title || '',
      meta_description: p.meta_description || '',
    });

    if (initialData) {
      setFormData(normalizeProduct(initialData));
      setLoading(false);
      return;
    }

    if (mode === 'edit') {
      if (!productId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

      fetch(`${API_URL}/admin/products/${productId}`, {
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
            setFormData(normalizeProduct(json.data));
          } else if (json.data) {
            setFormData(normalizeProduct(json.data));
          } else if (json.id) {
            setFormData(normalizeProduct(json));
          }
        })
        .catch((err) => {
          console.error('Failed to fetch product for editing:', err);
          setNotice({ type: 'error', text: 'Could not load product details for editing.' });
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [mode, productId, initialData]);

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!formData.name.trim()) errs.name = 'Product name is required.';
    if (!formData.sku.trim()) errs.sku = 'SKU is required.';
    if (formData.base_price < 0 || isNaN(formData.base_price)) errs.base_price = 'Base price must be a positive number.';
    if (formData.min_quantity < 1) errs.min_quantity = 'Minimum quantity must be at least 1.';
    if (formData.turnaround_days < 1) errs.turnaround_days = 'Turnaround time must be at least 1 day.';

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
      if (errs.name || errs.sku || errs.min_quantity || errs.turnaround_days) {
        setCurrentTab('general');
      } else if (errs.base_price) {
        setCurrentTab('pricing');
      } else if (errs.width_mm || errs.height_mm || errs.margin_mm || errs.bleed_mm || errs.safe_area_mm) {
        setCurrentTab('general');
      }
    }

    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (saveAsDraft: boolean = false) => {
    if (!validate()) {
      setNotice({ type: 'error', text: 'Please correct the highlighted fields before saving.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (saveAsDraft) {
      setIsSavingDraft(true);
    } else {
      setIsSubmitting(true);
    }
    setNotice(null);

    const isDataUri = formData.featured_image_url?.startsWith('data:');
    const featuredUrlToSend = isDataUri ? null : formData.featured_image_url || null;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

    // Helper to detect correct file extension from blob MIME type
    const getExtFromMime = (mime: string) => {
      if (mime.includes('svg')) return 'svg';
      if (mime.includes('pdf')) return 'pdf';
      if (mime.includes('tiff') || mime.includes('tif')) return 'tif';
      if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
      if (mime.includes('webp')) return 'webp';
      return 'png';
    };

    // Ensure all side background images that are data URIs get uploaded to server
    const processedSides = await Promise.all(
      formData.sides.map(async (side, sIdx) => {
        let bgUrl = side.background_image_url;
        if (bgUrl && bgUrl.startsWith('data:')) {
          try {
            const blob = await fetch(bgUrl).then((r) => r.blob());
            const ext = getExtFromMime(blob.type);
            const uploadFormData = new FormData();
            uploadFormData.append('image', blob, `side_${sIdx + 1}_bg.${ext}`);
            const uploadRes = await fetch(`${API_URL}/designer/uploads/canvas-image`, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: uploadFormData,
            });
            const uploadJson = await uploadRes.json();
            if (uploadJson.success && uploadJson.data?.url) {
              bgUrl = uploadJson.data.url;
            }
          } catch (e) {
            console.warn('Failed to upload side background image:', e);
          }
        }
        return {
          ...side,
          background_image_url: bgUrl || undefined,
          print_areas: side.print_areas.map((pa) => ({ ...pa })),
        };
      })
    );

    // Sync permanent URLs back to local state
    setFormData((prev) => ({ ...prev, sides: processedSides }));

    const payload = {
      name: formData.name.trim(),
      slug: formData.slug.trim() || formData.name.toLowerCase().replace(/\s+/g, '-'),
      sku: formData.sku.trim().toUpperCase(),
      category_id: formData.category_id || null,
      product_type: formData.product_type,
      short_description: formData.short_description || null,
      description: formData.description || null,
      min_quantity: Number(formData.min_quantity) || 1,
      turnaround_days: Number(formData.turnaround_days) || 3,
      base_price: Number(formData.base_price) || 0,
      sale_price: formData.sale_price !== '' && formData.sale_price !== null ? Number(formData.sale_price) : null,
      cost_price: formData.cost_price !== '' && formData.cost_price !== null ? Number(formData.cost_price) : null,
      featured_image_url: featuredUrlToSend,
      width_mm: typeof formData.width_mm === 'number' && !isNaN(formData.width_mm) ? formData.width_mm : null,
      height_mm: typeof formData.height_mm === 'number' && !isNaN(formData.height_mm) ? formData.height_mm : null,
      margin_mm: typeof formData.margin_mm === 'number' && !isNaN(formData.margin_mm) ? formData.margin_mm : 0,
      bleed_mm: typeof formData.bleed_mm === 'number' && !isNaN(formData.bleed_mm) ? formData.bleed_mm : 0,
      safe_area_mm: typeof formData.safe_area_mm === 'number' && !isNaN(formData.safe_area_mm) ? formData.safe_area_mm : 0,
      sides: processedSides,
      status: saveAsDraft ? 'draft' : formData.is_active ? 'published' : 'draft',
      is_active: saveAsDraft ? false : formData.is_active,
      is_featured: formData.is_featured,
      allow_custom_design: formData.allow_custom_design,
      allow_customer_upload: formData.allow_customer_upload,
      meta_title: formData.meta_title || null,
      meta_description: formData.meta_description || null,
    };

    const isEdit = mode === 'edit' && productId;
    const url = isEdit ? `${API_URL}/admin/products/${productId}` : `${API_URL}/admin/products`;
    const method = isEdit ? 'PATCH' : 'POST';

    try {

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
          const fieldErrors: FormErrors = {};
          Object.keys(result.errors).forEach((key) => {
            fieldErrors[key] = Array.isArray(result.errors[key]) ? result.errors[key][0] : result.errors[key];
          });
          setErrors(fieldErrors);
        }
        throw new Error(result?.message || `Product save failed (HTTP ${res.status}).`);
      }

      const savedProduct = result.data;
      const targetId = savedProduct?.id || productId;

      // Helper to detect correct file extension from blob MIME type
      const getExtFromMime = (mime: string) => {
        if (mime.includes('svg')) return 'svg';
        if (mime.includes('pdf')) return 'pdf';
        if (mime.includes('tiff') || mime.includes('tif')) return 'tif';
        if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
        if (mime.includes('webp')) return 'webp';
        return 'png';
      };

      // Upload featured image
      if (isDataUri && targetId) {
        try {
          const blob = await fetch(formData.featured_image_url).then((r) => r.blob());
          const ext = getExtFromMime(blob.type);
          const imageFormData = new FormData();
          imageFormData.append('image', blob, `featured_image.${ext}`);
          imageFormData.append('is_featured', '1');
          imageFormData.append('side', 'front');
          imageFormData.append('alt_text', formData.name);

          await fetch(`${API_URL}/admin/products/${targetId}/images`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: imageFormData,
          });
        } catch (imgErr) {
          console.warn('Could not upload featured image asset:', imgErr);
        }
      }

      // Upload front media
      if (targetId && formData.media.front.length > 0) {
        for (let i = 0; i < formData.media.front.length; i++) {
          const galleryUrl = formData.media.front[i];
          if (galleryUrl.startsWith('data:')) {
            try {
              const blob = await fetch(galleryUrl).then((r) => r.blob());
              const ext = getExtFromMime(blob.type);
              const imageFormData = new FormData();
              imageFormData.append('image', blob, `front_media_${i}.${ext}`);
              imageFormData.append('is_featured', '0');
              imageFormData.append('side', 'front');
              imageFormData.append('alt_text', `${formData.name} - Front Media ${i + 1}`);

              await fetch(`${API_URL}/admin/products/${targetId}/images`, {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: imageFormData,
              });
            } catch (imgErr) {
              console.warn(`Could not upload front media image ${i}:`, imgErr);
            }
          }
        }
      }

      // Upload back media
      if (targetId && formData.media.back.length > 0) {
        for (let i = 0; i < formData.media.back.length; i++) {
          const galleryUrl = formData.media.back[i];
          if (galleryUrl.startsWith('data:')) {
            try {
              const blob = await fetch(galleryUrl).then((r) => r.blob());
              const ext = getExtFromMime(blob.type);
              const imageFormData = new FormData();
              imageFormData.append('image', blob, `back_media_${i}.${ext}`);
              imageFormData.append('is_featured', '0');
              imageFormData.append('side', 'back');
              imageFormData.append('alt_text', `${formData.name} - Back Media ${i + 1}`);

              await fetch(`${API_URL}/admin/products/${targetId}/images`, {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: imageFormData,
              });
            } catch (imgErr) {
              console.warn(`Could not upload back media image ${i}:`, imgErr);
            }
          }
        }
      }

      setNotice({
        type: 'success',
        text: isEdit ? 'Product updated successfully!' : 'Product created successfully!',
      });

      onSuccess?.(savedProduct);

      if (mode === 'create' && savedProduct?.id) {
        router.push(`/admin/products/${savedProduct.id}/edit`);
      }
    } catch (err: any) {
      console.error('Product save error:', err);
      setNotice({ type: 'error', text: err.message || 'An error occurred while saving.' });
    } finally {
      setIsSubmitting(false);
      setIsSavingDraft(false);
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
    return <LoadingState message="Loading product details…" className="py-24" />;
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-16 font-sans select-none">
      {/* Sticky Header Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-4 z-20 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="p-2 text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
            title="Back to products list"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>{mode === 'create' ? 'Create Print Product' : formData.name || 'Edit Product'}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${formData.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {formData.is_active ? 'Published' : 'Draft'}
              </span>
            </h1>
            <p className="text-[11px] text-gray-400">
              {mode === 'create' ? 'Configure details in organized tabs below' : `SKU: ${formData.sku || 'N/A'}`}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {mode === 'edit' && formData.slug && (
            <Link
              href={`/products/${formData.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Storefront</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting || isSavingDraft}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {isSavingDraft ? 'Saving Draft…' : 'Save Draft'}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || isSavingDraft}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Saving…' : mode === 'create' ? 'Publish Product' : 'Save Changes'}</span>
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
          const hasError =
            (tab.id === 'general' && (errors.name || errors.sku || errors.min_quantity || errors.turnaround_days)) ||
            (tab.id === 'pricing' && errors.base_price);

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

      {/* Tabbed Content Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(false);
        }}
        className="space-y-6"
      >
        {/* TAB 1: General Details */}
        {currentTab === 'general' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <BasicInformation
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              categories={categories}
              categoriesLoading={categoriesLoading}
            />
            <ProductContent formData={formData} setFormData={setFormData} errors={errors} />
            <ProductConfiguration formData={formData} setFormData={setFormData} errors={errors} />
            <ProductPrintDimensions formData={formData} setFormData={setFormData} errors={errors} />
          </div>
        )}

        {/* DYNAMIC SIDE TABS */}
        {formData.sides.map((side, index) => {
          const tabId = `side_${index}`;
          if (currentTab !== tabId) return null;

          return (
            <div key={tabId} className="space-y-6 animate-in fade-in duration-150">
              <ProductMedia
                formData={formData}
                setFormData={setFormData}
                sideIndex={index}
                onSelectSide={(targetIndex) => setCurrentTab(`side_${targetIndex}`)}
              />
              <ProductPrintAreas formData={formData} setFormData={setFormData} sideIndex={index} />
              {index === 0 && <ProductTemplates formData={formData} setFormData={setFormData} />}
            </div>
          );
        })}

        {/* TAB 4: Attributes & Pricing */}
        {currentTab === 'pricing' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <ProductPricing formData={formData} setFormData={setFormData} errors={errors} />
            <ProductAttributes formData={formData} setFormData={setFormData} />
            <ProductVariants formData={formData} setFormData={setFormData} />
          </div>
        )}

        {/* TAB 5: Inventory & Shipping */}
        {currentTab === 'inventory' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <ProductInventory formData={formData} setFormData={setFormData} />
            <ProductShipping formData={formData} setFormData={setFormData} />
          </div>
        )}

        {/* TAB 6: SEO & Storefront */}
        {currentTab === 'seo' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <ProductSeo formData={formData} setFormData={setFormData} errors={errors} />
          </div>
        )}

        {/* Bottom Step Navigation & Actions */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
          <div>
            {currentTab !== 'general' ? (
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
                onClick={onCancel || (() => router.push('/admin/products'))}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentTab !== 'seo' ? (
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
              disabled={isSubmitting || isSavingDraft}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving…' : mode === 'create' ? 'Publish Product' : 'Save Product'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
