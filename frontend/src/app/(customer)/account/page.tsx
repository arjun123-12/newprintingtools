'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Building2,
  Calendar,
  Layers,
  Palette,
  ShoppingCart,
  Trash2,
  ExternalLink,
  LogOut,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/services/api/client';
import { useCartStore } from '@/stores/cartStore';

interface SavedCustomerArtwork {
  id: string;
  name: string;
  product_id?: string | null;
  product?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  template_id?: string | null;
  design_template_id?: string | null;
  thumbnail_url?: string | null;
  width_px?: number;
  height_px?: number;
  dpi?: number;
  unit?: string;
  design_status?: string;
  created_at: string;
  updated_at: string;
}

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const itemsCount = useCartStore((state) => state.itemsCount);

  const [artworks, setArtworks] = useState<SavedCustomerArtwork[]>([]);
  const [loadingArtworks, setLoadingArtworks] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/account');
      return;
    }

    if (isAuthenticated) {
      const fetchArtworks = async () => {
        setLoadingArtworks(true);
        try {
          const response = await apiClient.get('/artworks');
          if (response.data?.success && Array.isArray(response.data?.data)) {
            setArtworks(response.data.data);
          }
        } catch (err) {
          console.warn('Could not load saved artworks:', err);
        } finally {
          setLoadingArtworks(false);
        }
      };

      void fetchArtworks();
    }
  }, [authLoading, isAuthenticated, router]);

  const handleDeleteArtwork = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved design?')) return;

    try {
      await apiClient.delete(`/artworks/${id}`);
      setArtworks((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Could not delete the artwork.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-sm font-semibold">Loading your account...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Profile Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-sky-500/20">
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{user.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                {user.role}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user.email}
              </span>
              {user.company_name && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {user.company_name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto">
          <Link
            href="/cart"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
          >
            <ShoppingCart className="w-4 h-4 text-sky-600" />
            <span>Cart ({itemsCount})</span>
          </Link>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Saved Artworks / Customer Designs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Palette className="w-5 h-5 text-sky-600" />
              <span>My Saved Designs & Artworks</span>
            </h2>
            <p className="text-xs text-slate-500">
              Designs created or customized by you from Admin templates or custom uploads
            </p>
          </div>

          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline"
          >
            <span>Create New Design</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingArtworks ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-600" />
            <p className="text-xs">Loading your saved designs...</p>
          </div>
        ) : artworks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">No saved designs yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Pick a print product, select an Admin template, customize it in the online studio, and save it!
              </p>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              Browse Products & Templates
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {artworks.map((artwork) => {
              const productId = artwork.product_id || artwork.product?.id || 'default';

              return (
                <div
                  key={artwork.id}
                  className="group relative bg-white rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-lg transition-all flex flex-col overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[3/2] bg-slate-100 flex items-center justify-center p-3 overflow-hidden border-b border-slate-100">
                    {artwork.thumbnail_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={artwork.thumbnail_url}
                        alt={artwork.name}
                        className="max-h-full max-w-full object-contain rounded-md shadow-xs group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <Layers className="w-8 h-8 stroke-1" />
                        <span className="text-[10px]">Print Canvas</span>
                      </div>
                    )}

                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[10px] font-bold text-slate-600 border border-slate-200/80 shadow-2xs uppercase">
                      {artwork.design_status || 'Draft'}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1">
                        {artwork.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {artwork.product?.name || 'Custom Print Product'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(artwork.updated_at).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteArtwork(e, artwork.id)}
                          title="Delete design"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <Link
                          href={`/design/${productId}?artworkId=${artwork.id}`}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs flex items-center gap-1 transition"
                        >
                          <span>Edit</span>
                          <ExternalLink className="w-3 h-3" />
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
    </div>
  );
}
