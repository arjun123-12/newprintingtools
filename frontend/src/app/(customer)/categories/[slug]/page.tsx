'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  Palette,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
}

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  category_name?: string;
  category?: {
    id: string;
    name: string;
    slug?: string;
  };
  description?: string;
  starting_price?: number | string;
  base_price?: number | string;
  sale_price?: number | string;
  display_price?: number | string;
  price?: number | string;
  is_custom_design_enabled?: boolean;
  images?: { id: string; url: string; is_primary?: boolean }[];
}

interface CategoryDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { slug } = use(params);

  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ['public-category', slug],
    queryFn: async () => {
      const [catRes, prodRes] = await Promise.all([
        apiClient.get(`/categories/${slug}`).catch(() => null),
        apiClient.get('/products', { params: { category: slug, summary: 1 } }),
      ]);
      const formattedName = slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      const category = catRes?.data?.success && catRes.data.data
        ? catRes.data.data as CategoryItem
        : { id: slug, name: formattedName, slug, description: `Explore premium commercial print options for ${formattedName}.` };
      const allProducts: ProductItem[] = prodRes.data?.success && Array.isArray(prodRes.data.data) ? prodRes.data.data : [];
      const matched = allProducts.filter((product) => {
        const catSlug = product.category?.slug?.toLowerCase();
        const catName = (product.category?.name || product.category_name || '').toLowerCase().replace(/\s+/g, '-');
        const cleanSlug = slug.toLowerCase();
        return catSlug === cleanSlug || catName.includes(cleanSlug) || cleanSlug.includes(catName);
      });
      return { category, products: matched.length > 0 ? matched : allProducts };
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
  const category = data?.category ?? null;
  const products = data?.products ?? [];
  const cardColors = [
    ['#eee1fa', '#c5a3ef'],
    ['#dcf7eb', '#88cfab'],
    ['#fff0d0', '#eed08a'],
    ['#e0f5f8', '#9ad6dd'],
    ['#f9e5f3', '#e2a5d6'],
    ['#ffe7da', '#efa989'],
  ];
  const error = isError ? 'Could not load category products. Please try again.' : null;

  const categoryTitle =
    category?.name ||
    slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
      {/* Navigation / Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Products</span>
        </Link>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600 transition">
            Home
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-slate-600 transition">
            Categories
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-700">{categoryTitle}</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-[#f7f1ff] p-5 text-slate-900 sm:p-7">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/70 text-violet-700 border border-violet-200">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Category Collection</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {categoryTitle}
          </h1>

          <p className="text-sm leading-relaxed text-slate-600">
            {category?.description ||
              `High-definition commercial print solutions for ${categoryTitle}. Select from starter templates or design your own in our studio.`}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-700">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Heavyweight Cardstocks
            </span>
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-sky-400" />
              Fast Dispatch
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              100% Quality Guaranteed
            </span>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-violet-400/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Product Grid / Content */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          <p className="text-sm font-semibold">Loading {categoryTitle} products...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 space-y-3">
          <p className="font-semibold text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
            <Layers className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">No Products in this Category Yet</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Products for {categoryTitle} are currently being updated. Browse all commercial print products or launch the online studio.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/products"
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
            >
              Browse All Products
            </Link>
            <Link
              href="/design"
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition shadow-sm"
            >
              Open Design Studio
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-900">
              Available Products ({products.length})
            </h2>
            <span className="text-xs text-slate-400">All prices inc. GST</span>
          </div>

          <div
            aria-label="Available products"
            className={`grid grid-flow-col auto-cols-[min(78vw,230px)] gap-4 overflow-x-auto pb-3 sm:auto-cols-[230px] ${products.length > 4 ? 'grid-rows-2' : 'grid-rows-1'}`}
          >
            {products.map((product, index) => {
              const primaryImg =
                product.images?.find((img) => img.is_primary)?.url || product.images?.[0]?.url;
              const [surface, accent] = cardColors[index % cardColors.length];
              const catLabel = product.category?.name || product.category_name || categoryTitle;

              return (
                <div
                  key={product.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
                >
                  <div
                    className="relative flex min-h-[76px] items-center overflow-hidden px-3 py-2"
                    style={{ backgroundColor: surface }}
                  >
                    <div className="relative z-10 max-w-[58%]">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-slate-900">{product.name}</h3>
                      <p className="mt-1 truncate text-[10px] text-slate-600">{catLabel}</p>
                    </div>
                    <div aria-hidden="true" className="absolute -bottom-1 right-2 h-14 w-[78px] -rotate-6 rounded-md opacity-80" style={{ backgroundColor: accent }} />
                    <div aria-hidden="true" className="absolute -bottom-1 right-1 flex h-[60px] w-[76px] rotate-[7deg] items-center justify-center overflow-hidden rounded-md bg-white p-1 shadow-md transition-transform group-hover:rotate-3">
                      {primaryImg ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={primaryImg} alt="" className="h-full w-full object-contain" loading="lazy" decoding="async" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded" style={{ backgroundColor: accent }}>
                          <Layers className="h-6 w-6 text-slate-700" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between space-y-2 px-3 py-2.5">
                    <div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {product.description ||
                          'Full-color high-resolution offset and digital commercial printing with fast dispatch.'}
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Starting from</span>
                        {(() => {
                          const rawPrice = product.starting_price ?? product.sale_price ?? product.base_price ?? product.display_price ?? product.price ?? 0;
                          const priceNum = Number(rawPrice) || 0;
                          return (
                            <span className="text-base font-extrabold text-slate-900">
                              ${priceNum.toFixed(2)}{' '}
                              <span className="text-[10px] font-normal text-slate-400">inc GST</span>
                            </span>
                          );
                        })()}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={`/products/${product.slug}`}
                          className="py-2 px-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-[11px] flex items-center justify-center gap-1 transition text-center"
                        >
                          <span className="truncate">Templates</span>
                          <ArrowRight className="w-3 h-3 shrink-0" />
                        </Link>

                        <Link
                          href={`/design/${product.id}`}
                          className="py-2 px-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1 shadow-2xs transition text-center"
                        >
                          <Palette className="w-3 h-3 shrink-0" />
                          <span className="truncate">Design</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
