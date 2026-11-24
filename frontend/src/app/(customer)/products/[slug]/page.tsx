'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Palette,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Loader2,
  LayoutTemplate,
  Search,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  category?: { id: string; name: string };
  description?: string;
  starting_price?: number | string;
  base_price?: number | string;
  sale_price?: number | string;
  display_price?: number | string;
  price?: number | string;
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

interface ProductDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = use(params);
  const [search, setSearch] = useState('');
  const [style, setStyle] = useState('');

  const { data: product, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['public-product', slug],
    queryFn: async () => {
      const prodRes = await apiClient.get(`/products/${encodeURIComponent(slug)}`);
      const product = prodRes.data?.data as ProductDetail | undefined;
      if (!product) throw new Error('Product not found.');
      return product;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ['public-product-templates', slug],
    queryFn: async () => {
      const response = await apiClient.get(`/designer/templates/${encodeURIComponent(slug)}?summary=1`);
      return response.data?.success && Array.isArray(response.data?.data) ? response.data.data as AdminTemplate[] : [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  const error = queryError
    ? ((queryError as any).response?.data?.message || (queryError as Error).message || 'Failed to load product details.')
    : null;
  const filteredTemplates = useMemo(() => templates.filter(template => {
    const matchesSearch = `${template.name} ${template.category || ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStyle = !style || template.name.toLowerCase().includes(style.toLowerCase());
    return matchesSearch && matchesStyle;
  }), [templates, search, style]);

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
    <main className="min-h-[calc(100vh-72px)] bg-[#f8f7fb] text-slate-900">
      <header className="bg-gradient-to-br from-[#d9f7f7] via-white to-[#eadcff] px-4 pb-8 pt-6 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center">
          <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500">
            <Link href="/" className="rounded-full border border-white/80 bg-white/70 px-3 py-1 hover:text-violet-700">Home</Link>
            <ChevronDown className="h-3 w-3 -rotate-90" />
            <span className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 font-medium text-violet-700">Templates</span>
          </div>
          <h1 className="text-center text-2xl font-semibold tracking-tight text-violet-700 sm:text-3xl">What will you design today?</h1>
          <div className="relative mt-5 w-full max-w-[600px]">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${product.name} templates`} aria-label="Search templates" className="h-11 w-full rounded-xl border border-violet-200 bg-white px-11 text-sm shadow-[0_4px_16px_rgba(112,63,245,0.10)] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-violet-300 bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-800">{product.name}<ChevronDown className="ml-1 inline h-3 w-3" /></span>
            <label className="relative flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">Style<ChevronDown className="h-3 w-3" /><select aria-label="Filter templates by style" value={style} onChange={e => setStyle(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">{['', 'Modern', 'Minimal', 'Elegant', 'Corporate', 'Floral'].map(value => <option key={value} value={value}>{value || 'All styles'}</option>)}</select></label>
            <button type="button" disabled className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">Language<ChevronDown className="h-3 w-3" /></button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {templatesError && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Templates could not be loaded right now. Please refresh and try again.</div>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <Link href={`/design/${product.id}`} aria-label={`Create a blank ${product.name}`} className="group flex aspect-[1.75] flex-col items-center justify-center rounded-xl border border-slate-300 bg-[#f2f3f5] text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:shadow-md">
            <span className="text-2xl font-light">+</span><span className="mt-1 px-3 text-center text-[11px] font-medium text-slate-700">Create a blank {product.name}</span>
          </Link>
          {templatesLoading ? Array.from({ length: 10 }, (_, index) => <div key={`skeleton-${index}`} className="aspect-[1.75] animate-pulse rounded-xl border border-slate-200 bg-white" aria-label="Loading template" />) : filteredTemplates.map(template => {
            const cfg = template.artwork_config || {};
            const dims = cfg.width && cfg.height ? `${cfg.width} × ${cfg.height} ${cfg.unit || 'mm'}` : null;
            return <Link key={template.id} data-template-editor href={`/design/${product.id}?templateId=${encodeURIComponent(template.id)}`} aria-label={`Open ${template.name}`} className="group relative block aspect-[1.75] overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg">
              {template.thumbnail_url ? <img src={template.thumbnail_url} alt={template.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" decoding="async" /> : <div className="flex h-full flex-col items-center justify-center gap-2 bg-white text-slate-400"><LayoutTemplate className="h-8 w-8" /><span className="px-3 text-center text-xs font-medium">{template.name}</span></div>}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pb-2 pt-8 opacity-0 transition group-hover:opacity-100"><p className="truncate text-xs font-semibold text-white">{template.name}</p></div>
              {dims && <span className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">{dims}</span>}
            </Link>;
          })}
        </div>
        {!templatesLoading && !templatesError && filteredTemplates.length === 0 && <div className="mt-8 text-center text-sm text-slate-500">{search || style ? 'No templates match your filters.' : 'No pre-designed templates are available yet. Start with a blank design.'}</div>}
      </section>
    </main>
  );
}
