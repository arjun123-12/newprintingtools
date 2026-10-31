'use client';

import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { isSuperAdmin } from '@/utils/adminPermissions';

interface FilterCategory {
  id: string;
  name: string;
  slug: string;
}

interface FilterProduct {
  id: string;
  name: string;
  sku: string;
  category_id?: string;
}

interface TimelinePoint {
  key: string;
  label: string;
  orders: number;
  revenue: number;
}

interface TopProductItem {
  product_id: string;
  name: string;
  sku: string;
  orders_count: number;
  total_units: number;
  volume_share_pct: number;
  revenue?: number | null;
}

interface MaterialItem {
  name: string;
  units: number;
  share_pct: number;
}

interface MaterialsUsageData {
  has_data: boolean;
  total_stock_units: number;
  total_finish_units: number;
  stocks: MaterialItem[];
  finishes: MaterialItem[];
}

interface TurnaroundData {
  has_data: boolean;
  sample_size: number;
  avg_artwork_approval_hours?: number | null;
  avg_production_dispatch_hours?: number | null;
  avg_total_fulfillment_days?: number | null;
  distribution: {
    under_24h: number;
    one_to_three_days: number;
    three_to_five_days: number;
    over_five_days: number;
  };
}

interface ReportKPIs {
  total_orders: number;
  total_revenue?: number | null;
  average_order_value?: number | null;
  total_units_printed: number;
  in_production_jobs: number;
  completed_jobs: number;
  currency: string;
}

interface ReportResponse {
  can_view_financials: boolean;
  filters: {
    period: string;
    start_date: string;
    end_date: string;
    product_id?: string | null;
    category_id?: string | null;
    order_status: string;
  };
  kpis: ReportKPIs;
  timeline: TimelinePoint[];
  top_products: TopProductItem[];
  materials_usage: MaterialsUsageData;
  turnaround: TurnaroundData;
}

type PeriodType = 'today' | '7d' | '30d' | '90d' | '12m' | 'custom';

export default function AdminReportsPage() {
  const { user: currentUser } = useAuth();
  const isSuper = isSuperAdmin(currentUser);

  // Filter States
  const [period, setPeriod] = useState<PeriodType>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Options for Dropdowns
  const [categoryOptions, setCategoryOptions] = useState<FilterCategory[]>([]);
  const [productOptions, setProductOptions] = useState<FilterProduct[]>([]);

  // Report Data
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart Metric Toggle: 'revenue' | 'orders'
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');
  const [hoveredPoint, setHoveredPoint] = useState<TimelinePoint | null>(null);

  // Load Filter Options
  useEffect(() => {
    apiClient
      .get(API_ENDPOINTS.ADMIN_REPORTS_FILTER_OPTIONS)
      .then((res) => {
        if (res.data?.success && res.data.data) {
          setCategoryOptions(res.data.data.categories || []);
          setProductOptions(res.data.data.products || []);
        }
      })
      .catch((err) => console.error('Error fetching filter options:', err));
  }, []);

  // Fetch Report Data
  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        period,
        product_id: selectedProduct !== 'all' ? selectedProduct : undefined,
        category_id: selectedCategory !== 'all' ? selectedCategory : undefined,
        order_status: selectedStatus !== 'all' ? selectedStatus : undefined,
      };

      if (period === 'custom') {
        if (customStart) params.start_date = customStart;
        if (customEnd) params.end_date = customEnd;
      }

      const res = await apiClient.get(API_ENDPOINTS.ADMIN_REPORTS, { params });
      if (res.data?.success) {
        setReportData(res.data);
        if (!res.data.can_view_financials) {
          setChartMetric('orders');
        }
      }
    } catch (err: any) {
      console.error('Failed to load reports:', err);
      setError(err?.response?.data?.message || 'Failed to load report data. Please check network and permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period, selectedProduct, selectedCategory, selectedStatus]);

  const handleCustomDateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      alert('Please select both start and end dates.');
      return;
    }
    fetchReport();
  };

  const handleResetFilters = () => {
    setPeriod('30d');
    setCustomStart('');
    setCustomEnd('');
    setSelectedProduct('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
  };

  // Currency Formatter
  const formatAud = (val?: number | null) => {
    if (val === null || val === undefined) return '–';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  // Interactive SVG Chart calculations
  const timeline = reportData?.timeline || [];
  const maxVal = useMemo(() => {
    if (timeline.length === 0) return 100;
    const values = timeline.map((pt) => (chartMetric === 'revenue' ? pt.revenue : pt.orders));
    const highest = Math.max(...values, 0);
    return highest === 0 ? 100 : Math.ceil(highest * 1.15);
  }, [timeline, chartMetric]);

  const chartPoints = useMemo(() => {
    if (timeline.length === 0) return '';
    const width = 800;
    const height = 220;
    const paddingX = 40;
    const paddingY = 20;

    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;

    const stepX = timeline.length > 1 ? usableWidth / (timeline.length - 1) : usableWidth / 2;

    return timeline
      .map((pt, i) => {
        const val = chartMetric === 'revenue' ? pt.revenue : pt.orders;
        const x = paddingX + i * stepX;
        const y = height - paddingY - (val / maxVal) * usableHeight;
        return `${x},${y}`;
      })
      .join(' ');
  }, [timeline, chartMetric, maxVal]);

  const areaPoints = useMemo(() => {
    if (!chartPoints || timeline.length === 0) return '';
    const width = 800;
    const height = 220;
    const paddingX = 40;
    const paddingY = 20;
    const usableWidth = width - paddingX * 2;
    const lastX = paddingX + (timeline.length > 1 ? usableWidth : usableWidth / 2);

    return `${paddingX},${height - paddingY} ${chartPoints} ${lastX},${height - paddingY}`;
  }, [chartPoints, timeline]);

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-950 text-slate-100 min-h-screen">
      {/* Header & Print/Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Analytics & Production Reports</h1>
            {reportData && !reportData.can_view_financials && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Operational View (Financial Figures Masked)
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Aggregated revenue metrics, commercial print volumes, substrate usage breakdown, and delivery turnaround speed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Summary
          </button>
          <button
            onClick={() => fetchReport()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </button>
        </div>
      </div>

      {/* Date Range & Filter Controls */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg">
        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold mr-2 uppercase tracking-wider">Date Range:</span>
            {(
              [
                { label: 'Today', val: 'today' },
                { label: 'Last 7 Days', val: '7d' },
                { label: 'Last 30 Days', val: '30d' },
                { label: 'Last 90 Days', val: '90d' },
                { label: 'Last 12 Months', val: '12m' },
                { label: 'Custom Range', val: 'custom' },
              ] as { label: string; val: PeriodType }[]
            ).map((p) => (
              <button
                key={p.val}
                onClick={() => setPeriod(p.val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p.val
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {reportData?.filters && (
            <div className="text-xs font-mono text-slate-400">
              Active Window: <span className="text-white font-semibold">{reportData.filters.start_date}</span> to{' '}
              <span className="text-white font-semibold">{reportData.filters.end_date}</span>
            </div>
          )}
        </div>

        {/* Custom Range Sub-Form (shown only if period === 'custom') */}
        {period === 'custom' && (
          <form onSubmit={handleCustomDateSubmit} className="flex flex-wrap items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">From:</label>
              <input
                type="date"
                required
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">To:</label>
              <input
                type="date"
                required
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded"
            >
              Apply Dates
            </button>
          </form>
        )}

        {/* Multi-Dimensional Granular Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Product
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Products</option>
              {productOptions
                .filter((p) => selectedCategory === 'all' || p.category_id === selectedCategory)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
            </select>
          </div>

          {/* Order Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Order Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Order Statuses</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="artwork_required">Artwork Required</option>
              <option value="artwork_review">Artwork Review</option>
              <option value="in_production">In Production</option>
              <option value="dispatched">Dispatched</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Reset Action */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={fetchReport} className="text-white bg-rose-600 px-3 py-1 rounded font-bold hover:bg-rose-500">
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-900 border border-slate-800 animate-pulse p-4"></div>
            ))}
          </div>
          <div className="h-72 rounded-xl bg-slate-900 border border-slate-800 animate-pulse"></div>
        </div>
      ) : reportData ? (
        <>
          {/* ========================================================================= */}
          {/* 1. TOP-LEVEL KPI METRICS */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total Revenue */}
            <div className="p-5 rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-transparent shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">Total Revenue</span>
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {reportData.can_view_financials ? formatAud(reportData.kpis.total_revenue) : (
                  <span className="text-sm font-normal text-slate-400 italic">Financials Restricted</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {reportData.can_view_financials ? 'Total gross value inc. 10% GST' : 'Authorized financial admins only'}
              </div>
            </div>

            {/* KPI 2: Order Volume */}
            <div className="p-5 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Orders Processed</span>
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {reportData.kpis.total_orders.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Matching active filter selection
              </div>
            </div>

            {/* KPI 3: Average Order Value */}
            <div className="p-5 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-transparent shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">Average Order Value</span>
                <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {reportData.can_view_financials ? formatAud(reportData.kpis.average_order_value) : (
                  <span className="text-sm font-normal text-slate-400 italic">Financials Restricted</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {reportData.can_view_financials ? 'Average basket spend per job' : 'Authorized financial admins only'}
              </div>
            </div>

            {/* KPI 4: Print Units Output */}
            <div className="p-5 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Units Printed</span>
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {reportData.kpis.total_units_printed.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Total commercial print quantity
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. REVENUE & ORDERS OVER TIME INTERACTIVE CHART */}
          {/* ========================================================================= */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  Trend Over Time
                </h2>
                <p className="text-xs text-slate-400">
                  Chronological progression across the selected reporting window.
                </p>
              </div>

              {/* Metric Toggle Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                {reportData.can_view_financials && (
                  <button
                    onClick={() => setChartMetric('revenue')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition ${chartMetric === 'revenue'
                        ? 'bg-sky-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    Revenue ($ AUD)
                  </button>
                )}
                <button
                  onClick={() => setChartMetric('orders')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${chartMetric === 'orders'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Order Volume
                </button>
              </div>
            </div>

            {/* SVG Chart Container */}
            {timeline.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-slate-500 border border-slate-800/60 rounded-lg">
                No order activity recorded in this period.
              </div>
            ) : (
              <div className="relative">
                {/* Active Tooltip Popover */}
                {hoveredPoint && (
                  <div className="absolute top-2 right-4 p-3 rounded-lg bg-slate-950/95 border border-sky-500/40 text-xs shadow-2xl backdrop-blur pointer-events-none z-10 space-y-1">
                    <div className="font-bold text-white">{hoveredPoint.label} ({hoveredPoint.key})</div>
                    {reportData.can_view_financials && (
                      <div className="text-emerald-400 font-mono font-semibold">
                        Revenue: {formatAud(hoveredPoint.revenue)}
                      </div>
                    )}
                    <div className="text-sky-300 font-mono font-semibold">
                      Orders: {hoveredPoint.orders}
                    </div>
                  </div>
                )}

                <svg
                  viewBox="0 0 800 220"
                  className="w-full h-56 overflow-visible select-none"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = 220 - 20 - ratio * 180;
                    return (
                      <g key={ratio}>
                        <line
                          x1="40"
                          y1={y}
                          x2="760"
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x="32"
                          y={y + 3}
                          fill="#64748b"
                          fontSize="9"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {chartMetric === 'revenue'
                            ? `$${Math.round(maxVal * ratio)}`
                            : Math.round(maxVal * ratio)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Baseline */}
                  <line x1="40" y1="200" x2="760" y2="200" stroke="#334155" strokeWidth="1.5" />

                  {/* Area Fill */}
                  {areaPoints && (
                    <polygon points={areaPoints} fill="url(#areaGradient)" />
                  )}

                  {/* Trend Line */}
                  {chartPoints && (
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={chartPoints}
                    />
                  )}

                  {/* Interactive Points */}
                  {timeline.map((pt, i) => {
                    const val = chartMetric === 'revenue' ? pt.revenue : pt.orders;
                    const stepX = timeline.length > 1 ? 720 / (timeline.length - 1) : 360;
                    const cx = 40 + i * stepX;
                    const cy = 200 - (val / maxVal) * 180;

                    return (
                      <g
                        key={pt.key}
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r="4"
                          fill="#0ea5e9"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="hover:r-6 transition-all"
                        />
                        {/* Display periodic date labels */}
                        {(timeline.length <= 15 || i % Math.ceil(timeline.length / 10) === 0) && (
                          <text
                            x={cx}
                            y="214"
                            fill="#64748b"
                            fontSize="9"
                            textAnchor="middle"
                            fontFamily="sans-serif"
                          >
                            {pt.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. TOP PRODUCTS & VOLUME BREAKDOWN */}
          {/* ========================================================================= */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Top Products by Volume & Share
                </h2>
                <p className="text-xs text-slate-400">
                  Ranking based on total printed units and demand frequency.
                </p>
              </div>
            </div>

            {reportData.top_products.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-slate-800/80 rounded-lg">
                No product items found for the current filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Product Name & SKU</th>
                      <th className="py-3 px-4">Units Printed</th>
                      <th className="py-3 px-4">Volume Share</th>
                      <th className="py-3 px-4">Orders</th>
                      {reportData.can_view_financials && <th className="py-3 px-4 text-right">Revenue ($ AUD)</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-normal">
                    {reportData.top_products.map((p) => (
                      <tr key={p.product_id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">
                          {p.total_units.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-sky-500 h-2 rounded-full"
                                style={{ width: `${Math.min(100, p.volume_share_pct)}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-slate-400 text-[11px]">{p.volume_share_pct}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">{p.orders_count}</td>
                        {reportData.can_view_financials && (
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
                            {formatAud(p.revenue)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 4. PRODUCTION DEEP DIVES: MATERIALS USAGE & TURNAROUND METRICS */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Materials Usage Breakdown */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Materials & Stock Usage
                  </h2>
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Stored Order Attributes
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Substrate consumption extracted directly from actual recorded job options.
                </p>

                {!reportData.materials_usage.has_data ? (
                  <div className="p-8 text-center text-xs text-slate-500 border border-slate-800/80 rounded-lg mt-4 space-y-2">
                    <svg className="w-8 h-8 mx-auto text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                    </svg>
                    <p className="font-semibold text-slate-400">No Material Attributes Recorded</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Orders in this period do not contain specific paper stock or substrate options in their item snapshots.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {/* Paper Stocks */}
                    {reportData.materials_usage.stocks.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                          <span>Paper Stocks & Substrates</span>
                          <span className="font-mono text-slate-500">
                            {reportData.materials_usage.total_stock_units.toLocaleString()} units
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {reportData.materials_usage.stocks.map((st, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium text-slate-200">{st.name}</span>
                                <span className="font-mono text-slate-400">
                                  {st.units.toLocaleString()} ({st.share_pct}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-amber-500 h-2 rounded-full"
                                  style={{ width: `${st.share_pct}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Finishes & Coatings */}
                    {reportData.materials_usage.finishes.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                          <span>Finishes & Coatings</span>
                          <span className="font-mono text-slate-500">
                            {reportData.materials_usage.total_finish_units.toLocaleString()} units
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {reportData.materials_usage.finishes.map((fn, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium text-slate-200">{fn.name}</span>
                                <span className="font-mono text-slate-400">
                                  {fn.units.toLocaleString()} ({fn.share_pct}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-500 h-2 rounded-full"
                                  style={{ width: `${fn.share_pct}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Turnaround & Fulfillment Speed */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Turnaround & Fulfillment Speed
                  </h2>
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Timestamp Based
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Speed metrics derived from actual order, design approval, and dispatch events.
                </p>

                {!reportData.turnaround.has_data ? (
                  <div className="p-8 text-center text-xs text-slate-500 border border-slate-800/80 rounded-lg mt-4 space-y-2">
                    <svg className="w-8 h-8 mx-auto text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-semibold text-slate-400">Insufficient Timestamp Data</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Completed orders with verified shipment or artwork approval timestamps are needed to compute turnaround metrics.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {/* Milestones Grid */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase">Artwork Sign-off</div>
                        <div className="text-base font-bold text-sky-400 mt-1 font-mono">
                          {typeof reportData.turnaround.avg_artwork_approval_hours === 'number'
                            ? `${reportData.turnaround.avg_artwork_approval_hours}h`
                            : '–'}
                        </div>
                        <div className="text-[10px] text-slate-500">Order to Approval</div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase">Production Time</div>
                        <div className="text-base font-bold text-indigo-400 mt-1 font-mono">
                          {typeof reportData.turnaround.avg_production_dispatch_hours === 'number'
                            ? `${Math.round(reportData.turnaround.avg_production_dispatch_hours / 24 * 10) / 10}d`
                            : '–'}
                        </div>
                        <div className="text-[10px] text-slate-500">Approval to Dispatch</div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase">Total Delivery</div>
                        <div className="text-base font-bold text-emerald-400 mt-1 font-mono">
                          {typeof reportData.turnaround.avg_total_fulfillment_days === 'number'
                            ? `${reportData.turnaround.avg_total_fulfillment_days}d`
                            : '–'}
                        </div>
                        <div className="text-[10px] text-slate-500">Order to Customer</div>
                      </div>
                    </div>

                    {/* Turnaround Distribution Histogram */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="text-xs font-bold text-slate-300">
                        Fulfillment Time Distribution (Sample: {reportData.turnaround.sample_size} orders)
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <div className="text-emerald-400 font-bold font-mono">
                            {reportData.turnaround.distribution.under_24h}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">&lt; 24 Hours</div>
                        </div>

                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <div className="text-sky-400 font-bold font-mono">
                            {reportData.turnaround.distribution.one_to_three_days}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">1 – 3 Days</div>
                        </div>

                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <div className="text-amber-400 font-bold font-mono">
                            {reportData.turnaround.distribution.three_to_five_days}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">3 – 5 Days</div>
                        </div>

                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <div className="text-violet-400 font-bold font-mono">
                            {reportData.turnaround.distribution.over_five_days}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">&gt; 5 Days</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
