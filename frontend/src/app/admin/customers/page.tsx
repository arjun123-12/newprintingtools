'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  customerService,
  CustomerItem,
  ArtworkDetail,
  CustomerStats,
} from '@/services/admin/customerService';
import {
  Users,
  Palette,
  FileCheck2,
  Building2,
  Search,
  RefreshCw,
  ExternalLink,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Calendar,
  Layers,
  Sparkles,
  Maximize2,
  X,
  FileText,
  MapPin,
  ShoppingBag,
  Clock,
  CheckCircle,
  AlertCircle,
  FolderOpen,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [guestArtworks, setGuestArtworks] = useState<ArtworkDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Tabs
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'with_artworks' | 'trade' | 'guest'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'artworks' | 'name'>('newest');

  // Expanded customer artworks accordion
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<number>>(new Set());

  // Lightbox Modal for Artworks
  const [selectedArtwork, setSelectedArtwork] = useState<ArtworkDetail | null>(null);

  // Customer Detail Drawer / Modal
  const [activeCustomerDetail, setActiveCustomerDetail] = useState<CustomerItem | null>(null);

  // Fetch customer & artwork data
  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [resCustomers, resGuests] = await Promise.all([
        customerService.getCustomers(),
        customerService.getGuestArtworks(),
      ]);

      if (resCustomers && resCustomers.success) {
        setCustomers(resCustomers.data || []);
        setStats(resCustomers.stats || null);

        // Auto-expand customers with artworks on initial load if few
        if (!isManualRefresh) {
          const withArts = resCustomers.data
            .filter((c) => c.artworks && c.artworks.length > 0)
            .map((c) => c.id);
          setExpandedCustomerIds(new Set(withArts));
        }
      } else {
        setError('Unexpected response format from the server.');
      }

      if (resGuests && resGuests.success) {
        setGuestArtworks(resGuests.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load customers and artworks:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to retrieve customer records from the database.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Toggle expand / collapse customer artwork panel
  const toggleExpandCustomer = (customerId: number) => {
    setExpandedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = customers.map((c) => c.id);
    setExpandedCustomerIds(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedCustomerIds(new Set());
  };

  // Filtered and Sorted Customers
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    // Filter by Tab
    if (activeTab === 'with_artworks') {
      result = result.filter((c) => c.artworks && c.artworks.length > 0);
    } else if (activeTab === 'trade') {
      result = result.filter(
        (c) => (c.company_name && c.company_name.trim() !== '') || (c.abn && c.abn.trim() !== '')
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((c) => c.role === roleFilter);
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const matchName = c.name?.toLowerCase().includes(q);
        const matchEmail = c.email?.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        const matchCompany = c.company_name?.toLowerCase().includes(q);
        const matchAbn = c.abn?.toLowerCase().includes(q);
        const matchArtworkName = c.artworks?.some((a) => a.name?.toLowerCase().includes(q));
        return (
          matchName ||
          matchEmail ||
          matchPhone ||
          matchCompany ||
          matchAbn ||
          matchArtworkName
        );
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'artworks') {
        return (b.artworks?.length || 0) - (a.artworks?.length || 0);
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    return result;
  }, [customers, activeTab, roleFilter, searchQuery, sortBy]);

  // Filtered Guest Artworks
  const filteredGuestArtworks = useMemo(() => {
    if (searchQuery.trim() === '') return guestArtworks;
    const q = searchQuery.toLowerCase().trim();
    return guestArtworks.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.product_name?.toLowerCase().includes(q) ||
        a.session_id?.toLowerCase().includes(q)
    );
  }, [guestArtworks, searchQuery]);

  // Helpers
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Status color styles for artwork
  const getArtworkStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved' || s === 'ready_for_print') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (s === 'uploaded' || s === 'submitted') {
      return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    }
    if (s === 'draft' || s === 'in_progress') {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    if (s === 'rejected' || s === 'failed') {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
    return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      {/* ─── Top Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1.5 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-sky-400" />
            Customers & Saved Artworks
          </h1>
          <p className="text-slate-400 text-sm">
            Customer accounts, trade accounts, ABN verification, and address books.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-sm disabled:opacity-60"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs text-slate-400">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 rounded hover:bg-slate-800 hover:text-slate-200 transition"
            >
              Expand All
            </button>
            <span className="text-slate-700">|</span>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 rounded hover:bg-slate-800 hover:text-slate-200 transition"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* ─── Key Metrics Summary Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Accounts
            </div>
            <div className="text-2xl font-bold text-white mt-0.5">
              {stats?.total_all_users ?? customers.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats?.total_customers ?? 0} registered customers
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Customers With Artworks
            </div>
            <div className="text-2xl font-bold text-white mt-0.5">
              {stats?.customers_with_artworks ??
                customers.filter((c) => c.artworks?.length > 0).length}
            </div>
            <div className="text-[11px] text-emerald-400/90 mt-0.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 inline" />
              Active designers
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Saved Artworks
            </div>
            <div className="text-2xl font-bold text-white mt-0.5">
              {stats?.total_saved_artworks ??
                customers.reduce((acc, c) => acc + (c.artworks?.length || 0), 0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats?.total_customer_artworks ?? 0} customer · {stats?.total_guest_artworks ?? 0} guest
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Trade Accounts (ABN)
            </div>
            <div className="text-2xl font-bold text-white mt-0.5">
              {customers.filter((c) => c.abn || c.company_name).length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Commercial & Agency clients</div>
          </div>
        </div>
      </div>

      {/* ─── Controls: Search, Tabs & Filters ──────────────────────── */}
      <div className="mt-8 bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, email, phone, company, ABN, or artwork title..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-9 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter & Sort Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs text-slate-400">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none font-medium text-xs cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Roles</option>
                <option value="customer" className="bg-slate-900">Customer</option>
                <option value="admin" className="bg-slate-900">Admin</option>
                <option value="prepress_operator" className="bg-slate-900">Prepress Operator</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs text-slate-400">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-200 focus:outline-none font-medium text-xs cursor-pointer"
              >
                <option value="newest" className="bg-slate-900">Newest Registered</option>
                <option value="oldest" className="bg-slate-900">Oldest Registered</option>
                <option value="artworks" className="bg-slate-900">Most Artworks</option>
                <option value="name" className="bg-slate-900">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            All Customers
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-sky-700 text-sky-100' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {customers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('with_artworks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
              activeTab === 'with_artworks'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            With Saved Artworks
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'with_artworks'
                  ? 'bg-sky-700 text-sky-100'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {customers.filter((c) => c.artworks && c.artworks.length > 0).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trade')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
              activeTab === 'trade'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Trade / ABN Accounts
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'trade' ? 'bg-sky-700 text-sky-100' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {customers.filter((c) => c.abn || c.company_name).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guest')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
              activeTab === 'guest'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Guest Designs
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'guest' ? 'bg-sky-700 text-sky-100' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {guestArtworks.length}
            </span>
          </button>
        </div>
      </div>

      {/* ─── Main Content Area ────────────────────────────────────── */}
      <div className="mt-6">
        {loading ? (
          /* Loading State */
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 animate-pulse space-y-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-800 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="w-48 h-4 bg-slate-800 rounded" />
                    <div className="w-32 h-3 bg-slate-800 rounded" />
                  </div>
                </div>
                <div className="h-20 bg-slate-800/50 rounded-lg" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-8 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-semibold text-rose-200">Failed to Load Customer Records</h3>
            <p className="text-xs text-rose-300/80 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={() => loadData(true)}
              className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Request
            </button>
          </div>
        ) : activeTab === 'guest' ? (
          /* ─── Guest Artworks Tab Content ────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Showing <strong>{filteredGuestArtworks.length}</strong> designs created by guest visitors before account registration.
              </span>
            </div>

            {filteredGuestArtworks.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-12 text-center text-slate-400 space-y-2">
                <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-medium text-slate-300">No guest artworks found</p>
                <p className="text-xs text-slate-500">
                  {searchQuery ? 'Try matching another search query.' : 'All saved designs belong to registered customer accounts.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredGuestArtworks.map((artwork) => (
                  <ArtworkCardItem
                    key={artwork.id}
                    artwork={artwork}
                    onOpenLightbox={() => setSelectedArtwork(artwork)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : filteredCustomers.length === 0 ? (
          /* Empty Customers State */
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-12 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">No matching customers found</p>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? `No customers or artworks matched "${searchQuery}".`
                : 'No customer accounts available in this view.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-sky-400 hover:text-sky-300 underline font-medium"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          /* ─── Customers List with Accordion Artworks ─────────────────── */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Showing <strong>{filteredCustomers.length}</strong> customer{filteredCustomers.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredCustomers.map((customer) => {
              const isExpanded = expandedCustomerIds.has(customer.id);
              const artworkList = customer.artworks || [];
              const hasArtworks = artworkList.length > 0;

              return (
                <div
                  key={customer.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition hover:border-slate-700/80"
                >
                  {/* Customer Card Header Row */}
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-inner">
                        {customer.name
                          ? customer.name
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()
                          : 'CU'}
                      </div>

                      {/* Name & Contact Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-white tracking-tight truncate">
                            {customer.name || 'Unnamed Customer'}
                          </h3>

                          {/* Role Badge */}
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              customer.role === 'admin'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : customer.role === 'prepress_operator'
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {customer.role || 'customer'}
                          </span>

                          {/* Trade / Business Badge */}
                          {(customer.company_name || customer.abn) && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5 inline" />
                              {customer.company_name || `ABN: ${customer.abn}`}
                            </span>
                          )}
                        </div>

                        {/* Email & Phone */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                          <a
                            href={`mailto:${customer.email}`}
                            className="inline-flex items-center gap-1.5 hover:text-sky-400 transition"
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            {customer.email}
                          </a>

                          {customer.phone && (
                            <a
                              href={`tel:${customer.phone}`}
                              className="inline-flex items-center gap-1.5 hover:text-sky-400 transition"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              {customer.phone}
                            </a>
                          )}

                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            Joined {formatDate(customer.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800/80">
                      {/* Artwork Counter Pill */}
                      <button
                        type="button"
                        onClick={() => toggleExpandCustomer(customer.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                          hasArtworks
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20'
                            : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:bg-slate-800'
                        }`}
                        title={hasArtworks ? 'Toggle artworks view' : 'No artworks yet'}
                      >
                        <Palette className="w-3.5 h-3.5" />
                        <span>{artworkList.length} Artwork{artworkList.length !== 1 ? 's' : ''}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-0.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-slate-400" />
                        )}
                      </button>

                      {/* Orders Counter */}
                      {customer.orders_count > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/70 border border-slate-700/60 text-slate-300">
                          <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                          {customer.orders_count} Order{customer.orders_count !== 1 ? 's' : ''}
                        </span>
                      )}

                      {/* Details Drawer Button */}
                      <button
                        type="button"
                        onClick={() => setActiveCustomerDetail(customer)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition inline-flex items-center gap-1"
                        title="View customer profile details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Profile</span>
                      </button>
                    </div>
                  </div>

                  {/* ─── Expandable Artwork Gallery Panel ───────────────── */}
                  {isExpanded && (
                    <div className="bg-slate-950/70 border-t border-slate-800/90 p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-3.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <Palette className="w-3.5 h-3.5 text-sky-400" />
                          Saved Artworks by {customer.name} ({artworkList.length})
                        </h4>

                        {hasArtworks && (
                          <span className="text-[11px] text-slate-500">
                            Click any thumbnail to view high-res preview or open in Designer studio
                          </span>
                        )}
                      </div>

                      {!hasArtworks ? (
                        <div className="py-6 px-4 text-center rounded-lg border border-dashed border-slate-800/80 bg-slate-900/30">
                          <p className="text-xs text-slate-400">
                            This customer has not created or saved any design artworks yet.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {artworkList.map((artwork) => (
                            <ArtworkCardItem
                              key={artwork.id}
                              artwork={artwork}
                              onOpenLightbox={() => setSelectedArtwork(artwork)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Artwork Preview Modal (Lightbox) ────────────────────── */}
      {selectedArtwork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <Palette className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedArtwork.name || 'Artwork Preview'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Product: {selectedArtwork.product_name} · {selectedArtwork.width_px} × {selectedArtwork.height_px} px ({selectedArtwork.dpi || 300} DPI)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArtwork(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-950/80 min-h-[300px]">
              {selectedArtwork.thumbnail_url ? (
                <div className="relative group max-h-[460px] flex items-center justify-center">
                  <img
                    src={selectedArtwork.thumbnail_url}
                    alt={selectedArtwork.name}
                    className="max-h-[460px] max-w-full rounded-lg object-contain shadow-2xl border border-slate-800 bg-white"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <FileText className="w-12 h-12 text-slate-600" />
                  <span className="text-xs">No thumbnail rendered yet</span>
                </div>
              )}

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-6 text-xs">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Dimensions</span>
                  <span className="text-white font-medium">
                    {selectedArtwork.width_px} × {selectedArtwork.height_px} px
                  </span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Resolution</span>
                  <span className="text-white font-medium">{selectedArtwork.dpi || 300} DPI</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Status</span>
                  <span className="text-sky-400 font-medium capitalize">{selectedArtwork.status}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Created</span>
                  <span className="text-white font-medium">{formatDate(selectedArtwork.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Artwork ID: <code className="text-slate-400">{selectedArtwork.id}</code>
              </span>

              <div className="flex items-center gap-2">
                {selectedArtwork.thumbnail_url && (
                  <a
                    href={selectedArtwork.thumbnail_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Image Link
                  </a>
                )}

                <Link
                  href={`/admin/designer?artworkId=${selectedArtwork.id}${
                    selectedArtwork.product_id ? `&productId=${selectedArtwork.product_id}` : ''
                  }`}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition inline-flex items-center gap-1.5 shadow-md"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Open in Artwork Studio
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Customer Details Drawer / Modal ───────────────────────── */}
      {activeCustomerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
                  {activeCustomerDetail.name?.[0] || 'C'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{activeCustomerDetail.name}</h3>
                  <p className="text-[11px] text-slate-400">{activeCustomerDetail.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCustomerDetail(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Account Overview */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" /> Account Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Role</span>
                    <span className="text-slate-200 font-medium capitalize">{activeCustomerDetail.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Phone</span>
                    <span className="text-slate-200 font-medium">{activeCustomerDetail.phone || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Company</span>
                    <span className="text-slate-200 font-medium">{activeCustomerDetail.company_name || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">ABN</span>
                    <span className="text-slate-200 font-medium">{activeCustomerDetail.abn || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Registered On</span>
                    <span className="text-slate-200 font-medium">{formatDate(activeCustomerDetail.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Email Verification</span>
                    <span className="text-slate-200 font-medium">
                      {activeCustomerDetail.email_verified_at ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Address Book */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Address Book (
                  {activeCustomerDetail.addresses?.length || 0})
                </h4>
                {activeCustomerDetail.addresses && activeCustomerDetail.addresses.length > 0 ? (
                  <div className="space-y-2">
                    {activeCustomerDetail.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{addr.name}</span>
                          {addr.is_default && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Default {addr.type}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400">
                          {addr.address_line_1}
                          {addr.address_line_2 ? `, ${addr.address_line_2}` : ''}
                        </p>
                        <p className="text-slate-400">
                          {addr.suburb}, {addr.state} {addr.postcode}, {addr.country}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No saved addresses for this customer.</p>
                )}
              </div>

              {/* Orders History */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-violet-400" /> Recent Orders (
                  {activeCustomerDetail.orders?.length || 0})
                </h4>
                {activeCustomerDetail.orders && activeCustomerDetail.orders.length > 0 ? (
                  <div className="space-y-2">
                    {activeCustomerDetail.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-slate-200">#{ord.order_number}</span>
                          <span className="text-slate-500 text-[11px] block">{formatDate(ord.created_at)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-medium block">${ord.total_amount}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 capitalize">
                            {ord.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No orders placed yet.</p>
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveCustomerDetail(null)}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Component: Artwork Card Item ──────────────────────────────
interface ArtworkCardProps {
  artwork: ArtworkDetail;
  onOpenLightbox: () => void;
}

function ArtworkCardItem({ artwork, onOpenLightbox }: ArtworkCardProps) {
  // Format dimensions if available
  const dimText =
    artwork.width_px && artwork.height_px
      ? `${artwork.width_px} × ${artwork.height_px} px`
      : 'Custom Canvas';

  const docSettings = artwork.document_settings;
  const printMm =
    docSettings?.width_mm && docSettings?.height_mm
      ? `${docSettings.width_mm} × ${docSettings.height_mm} mm`
      : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col transition hover:border-slate-700/90 group">
      {/* Thumbnail Area */}
      <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800/80">
        {artwork.thumbnail_url ? (
          <img
            src={artwork.thumbnail_url}
            alt={artwork.name}
            className="w-full h-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600 gap-1.5">
            <Palette className="w-8 h-8 text-slate-700" />
            <span className="text-[11px] text-slate-600">Canvas Design</span>
          </div>
        )}

        {/* Hover Overlay with Lightbox trigger */}
        <button
          type="button"
          onClick={onOpenLightbox}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium text-xs backdrop-blur-[1px]"
          title="Preview artwork"
        >
          <span className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg">
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
            Inspect
          </span>
        </button>

        {/* Status Badge Tag */}
        <div className="absolute top-2 left-2">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-md ${
              artwork.status === 'approved'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
            }`}
          >
            {artwork.status || 'uploaded'}
          </span>
        </div>
      </div>

      {/* Artwork Info */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h5 className="text-xs font-bold text-white tracking-tight truncate" title={artwork.name}>
            {artwork.name || 'Untitled Artwork'}
          </h5>

          {/* Product Name */}
          <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={artwork.product_name}>
            Product: <span className="text-slate-300 font-medium">{artwork.product_name}</span>
          </p>

          {/* Dimensions Specs */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] text-slate-400">
            <span className="bg-slate-950 border border-slate-800/80 px-2 py-0.5 rounded">
              {printMm || dimText}
            </span>
            {artwork.dpi && (
              <span className="bg-slate-950 border border-slate-800/80 px-1.5 py-0.5 rounded">
                {artwork.dpi} DPI
              </span>
            )}
            {artwork.pages_count > 1 && (
              <span className="bg-slate-950 border border-slate-800/80 px-1.5 py-0.5 rounded text-sky-400">
                {artwork.pages_count} Pages
              </span>
            )}
          </div>
        </div>

        {/* Action Link to Admin Designer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">
            {new Date(artwork.created_at).toLocaleDateString('en-AU', {
              month: 'short',
              day: 'numeric',
            })}
          </span>

          <Link
            href={`/admin/designer?artworkId=${artwork.id}${
              artwork.product_id ? `&productId=${artwork.product_id}` : ''
            }`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600 hover:text-white transition"
            title="Open and edit in Admin Designer"
          >
            <ArrowUpRight className="w-3 h-3" />
            Designer
          </Link>
        </div>
      </div>
    </div>
  );
}
