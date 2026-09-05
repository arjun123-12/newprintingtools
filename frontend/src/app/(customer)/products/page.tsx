'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  Palette,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  category_name?: string;
  category?: {
    id: string;
    name: string;
  };
  description?: string;
  starting_price?: number | string;
  is_custom_design_enabled?: boolean;
  images?: { id: string; url: string; is_primary?: boolean }[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get('/products');
        if (response.data?.success && Array.isArray(response.data?.data)) {
          setProducts(response.data.data);
        } else {
          setProducts([]);
        }
      } catch (err) {
        setError('Could not load products. Please check connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchProducts();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          Commercial Print Studio
        </span>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900">
          All Commercial Print Products
        </h1>

        <p className="text-sm sm:text-base text-slate-600">
          Choose a product to customize with our ready-to-print Admin templates or create your own custom design in the online studio.
        </p>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          <p className="text-sm font-semibold">Loading print products...</p>
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
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          No products found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => {
            const primaryImg = product.images?.find((img) => img.is_primary)?.url || product.images?.[0]?.url;
            const categoryName = product.category?.name || product.category_name || 'Stationery';

            return (
              <div
                key={product.id}
                className="group bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-200 flex flex-col overflow-hidden"
              >
                {/* Product Thumbnail / Mockup */}
                <div className="relative aspect-[4/3] bg-gradient-to-tr from-slate-100 to-slate-50 flex items-center justify-center p-6 overflow-hidden border-b border-slate-100">
                  {primaryImg ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={primaryImg}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <div className="w-16 h-16 rounded-2xl bg-sky-100/50 text-sky-600 flex items-center justify-center">
                        <Layers className="w-8 h-8" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{product.name}</span>
                    </div>
                  )}

                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[11px] font-bold text-slate-700 border border-slate-200/80 shadow-xs">
                    {categoryName}
                  </span>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900 group-hover:text-sky-600 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 line-clamp-2">
                      {product.description || 'Full-color high-resolution offset and digital commercial printing with fast dispatch.'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Starting from</span>
                      <span className="text-lg font-black text-slate-900">
                        ${product.starting_price || '25.00'} <span className="text-[11px] font-normal text-slate-400">inc GST</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/products/${product.slug}`}
                        className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition text-center"
                      >
                        <span>View Templates</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      <Link
                        href={`/design/${product.id}`}
                        className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition text-center"
                      >
                        <Palette className="w-3.5 h-3.5" />
                        <span>Design Studio</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
