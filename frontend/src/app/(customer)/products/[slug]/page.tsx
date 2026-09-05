'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Layers,
  Palette,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LayoutTemplate,
  Ruler,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  category?: { id: string; name: string };
  description?: string;
  starting_price?: number | string;
  images?: { id: string; url: string; is_primary?: boolean }[];
}

interface AdminTemplate {
  id: string;
  product_id: string;
  name: string;
  category?: string;
  artwork_config?: {
    width?: number;
    height?: number;
    unit?: string;
    bleed?: number;
    safe_area?: number;
    margin?: number;
    dpi?: number;
    orientation?: string;
  };
  thumbnail_url?: string | null;
  canvas_json?: any;
}

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.slug) return;

    const fetchProductAndTemplates = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch product
        const prodRes = await apiClient.get(`/products/${params.slug}`);
        const prodData = prodRes.data?.data;
        if (!prodData) {
          throw new Error('Product not found.');
        }
        setProduct(prodData);

        // 2. Fetch admin-created templates for this product
        try {
          const tmplRes = await apiClient.get(`/designer/templates/${prodData.id}`);
          if (tmplRes.data?.success && Array.isArray(tmplRes.data?.data)) {
            setTemplates(tmplRes.data.data);
          } else {
            setTemplates([]);
          }
        } catch {
          setTemplates([]);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to load product details.');
      } finally {
        setLoading(false);
      }
    };

    void fetchProductAndTemplates();
  }, [params?.slug]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-sm font-semibold">Loading product templates...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800">{error || 'Product Not Found'}</h2>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-sky-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Products</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Products</span>
        </Link>

        <span className="text-xs text-slate-400">
          Product ID: <code className="text-slate-600 font-mono text-[11px]">{product.id.slice(0, 8)}</code>
        </span>
      </div>

      {/* Product Hero Info */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
              {product.category?.name || 'Commercial Print'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {product.name}
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed">
            {product.description || 'Select an Admin-created starter template to customize in our online studio or launch with a blank print-ready canvas.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <Link
            href={`/design/${product.id}`}
            className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md"
          >
            <Palette className="w-4 h-4 text-sky-400" />
            <span>Blank Canvas Studio</span>
          </Link>
        </div>
      </div>

      {/* Admin Templates Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-sky-600" />
              <span>Admin-Created Templates ({templates.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Select any template to edit. Your edits create an independent customer artwork; the Admin template remains protected.
            </p>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
            <LayoutTemplate className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Pre-designed Templates Available</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You can start designing directly on a clean canvas with pre-configured print dimensions.
            </p>
            <Link
              href={`/design/${product.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Palette className="w-4 h-4" />
              <span>Start Blank Design</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {templates.map((template) => {
              const cfg = template.artwork_config || {};
              const dims = cfg.width && cfg.height ? `${cfg.width} × ${cfg.height} ${cfg.unit || 'mm'}` : null;
              const bleed = cfg.bleed ? `Bleed: ${cfg.bleed}mm` : null;

              return (
                <div
                  key={template.id}
                  className="group bg-white rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[3/2] bg-slate-100 flex items-center justify-center p-4 overflow-hidden border-b border-slate-100">
                    {template.thumbnail_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={template.thumbnail_url}
                        alt={template.name}
                        className="max-h-full max-w-full object-contain rounded-md shadow-xs group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400">
                        <LayoutTemplate className="w-8 h-8 text-sky-500/70" />
                        <span className="text-[10px] font-bold text-slate-500">{template.name}</span>
                      </div>
                    )}

                    {dims && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-[10px] font-bold text-slate-700 border border-slate-200/80 shadow-2xs">
                        {dims}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1">
                        {template.name}
                      </h4>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                        {bleed && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-medium">
                            {bleed}
                          </span>
                        )}
                        {cfg.safe_area && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-medium">
                            Safe: {cfg.safe_area}mm
                          </span>
                        )}
                        {cfg.dpi && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-medium">
                            {cfg.dpi} DPI
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/design/${product.id}?templateId=${template.id}`}
                      className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-1.5 text-center"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Customize Template</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
