'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
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

  const [category, setCategory] = useState<CategoryItem | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchCategoryAndProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch category info
        try {
          const catRes = await apiClient.get(`/categories/${slug}`);
          if (catRes.data?.success && catRes.data?.data) {
            setCategory(catRes.data.data);
          }
        } catch {
          // If category endpoint fails or slug is custom, format title from slug
          const formattedName = slug
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          setCategory({
            id: slug,
            name: formattedName,
            slug: slug,
            description: `Explore premium commercial print options for ${formattedName}.`,
          });
        }

        // 2. Fetch products for this category
        const prodRes = await apiClient.get(`/products?category=${slug}`);
        if (prodRes.data?.success && Array.isArray(prodRes.data?.data)) {
          // Also filter on client side in case backend returns all products
          const matched = prodRes.data.data.filter((p: ProductItem) => {
            const catSlug = p.category?.slug?.toLowerCase();
            const catName = (p.category?.name || p.category_name || '').toLowerCase().replace(/\s+/g, '-');
            const cleanSlug = slug.toLowerCase();
            return catSlug === cleanSlug || catName.includes(cleanSlug) || cleanSlug.includes(catName);
          });
          setProducts(matched.length > 0 ? matched : prodRes.data.data);
        } else {
          setProducts([]);
        }
      } catch (err: any) {
        setError('Could not load category products. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchCategoryAndProducts();
  }, [slug]);

  const categoryTitle =
    category?.name ||
    slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white p-8 sm:p-12 shadow-xl border border-slate-800">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Category Collection</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            {categoryTitle}
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            {category?.description ||
              `High-definition commercial print solutions for ${categoryTitle}. Select from starter templates or design your own in our studio.`}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-300">
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
        <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((product) => {
              const primaryImg =
                product.images?.find((img) => img.is_primary)?.url || product.images?.[0]?.url;
              const catLabel = product.category?.name || product.category_name || categoryTitle;

              return (
                <div
                  key={product.id}
                  className="group bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-sky-300 transition-all duration-200 flex flex-col overflow-hidden"
                >
                  {/* Product Thumbnail */}
                  <div className="relative aspect-[4/3] bg-gradient-to-tr from-slate-100 to-slate-50 flex items-center justify-center p-4 overflow-hidden border-b border-slate-100">
                    {primaryImg ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={primaryImg}
                        alt={product.name}
                        className="max-h-full max-w-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400">
                        <div className="w-12 h-12 rounded-xl bg-sky-100/50 text-sky-600 flex items-center justify-center">
                          <Layers className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 text-center px-2 line-clamp-1">{product.name}</span>
                      </div>
                    )}

                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-xs text-[10px] font-bold text-slate-700 border border-slate-200/80 shadow-2xs">
                      {catLabel}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5">
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {product.description ||
                          'Full-color high-resolution offset and digital commercial printing with fast dispatch.'}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Starting from</span>
                        <span className="text-base font-extrabold text-slate-900">
                          ${product.starting_price || '25.00'}{' '}
                          <span className="text-[10px] font-normal text-slate-400">inc GST</span>
                        </span>
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