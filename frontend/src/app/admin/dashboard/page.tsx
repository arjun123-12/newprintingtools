'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Metric {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ReactNode;
  color: string;
}

interface Order {
  id: string;
  customer: string;
  product: string;
  total: string;
  status: 'pending' | 'artwork_review' | 'printing' | 'dispatched' | 'delivered';
  date: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<Order['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  artwork_review: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  printing: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  dispatched: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  delivered: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};
const STATUS_LABELS: Record<Order['status'], string> = {
  pending: 'Pending',
  artwork_review: 'Artwork Review',
  printing: 'Printing',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_ORDERS: Order[] = [
  { id: 'ORD-10042', customer: 'Mitchell & Co.', product: 'Business Cards (500)', total: '$89.00', status: 'artwork_review', date: '25 Aug 2026' },
  { id: 'ORD-10041', customer: 'Sunrise Bakery', product: 'A3 Flyers (1000)', total: '$145.00', status: 'printing', date: '25 Aug 2026' },
  { id: 'ORD-10040', customer: 'Peak Builders', product: 'Pull-Up Banner (x2)', total: '$260.00', status: 'dispatched', date: '24 Aug 2026' },
  { id: 'ORD-10039', customer: 'Nova Tech', product: 'Letterhead (250)', total: '$72.50', status: 'pending', date: '24 Aug 2026' },
  { id: 'ORD-10038', customer: 'Green Earth Co.', product: 'Stickers (A4 Sheet x10)', total: '$55.00', status: 'delivered', date: '23 Aug 2026' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    apiClient
      .get(API_ENDPOINTS.ADMIN_METRICS)
      .then((r) => setMetrics(r.data?.data ?? {}))
      .catch(() => setMetrics({}))
      .finally(() => setLoadingMetrics(false));
  }, []);

  const METRIC_CARDS: Metric[] = [
    {
      label: 'Revenue (Aug)',
      value: loadingMetrics ? '—' : '$24,830',
      change: '+18% vs Jul',
      positive: true,
      color: 'from-sky-500/20 to-blue-600/10 border-sky-500/20',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Orders This Month',
      value: loadingMetrics ? '—' : '312',
      change: '+24 today',
      positive: true,
      color: 'from-emerald-500/20 to-teal-600/10 border-emerald-500/20',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: 'Artwork Pending',
      value: loadingMetrics ? '—' : '17',
      change: '3 overdue',
      positive: false,
      color: 'from-violet-500/20 to-purple-600/10 border-violet-500/20',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Active Customers',
      value: loadingMetrics ? '—' : '1,084',
      change: '+56 this week',
      positive: true,
      color: 'from-amber-500/20 to-orange-600/10 border-amber-500/20',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Operations Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          &nbsp;·&nbsp;Real-time overview of revenue, production, and dispatch.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {METRIC_CARDS.map((m) => (
          <div
            key={m.label}
            className={`rounded-xl border bg-gradient-to-br p-5 space-y-3 ${m.color}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{m.label}</p>
              <div className="p-2 rounded-lg bg-slate-800/60">{m.icon}</div>
            </div>
            <p className="text-3xl font-bold text-white">{m.value}</p>
            <p className={`text-xs font-medium ${m.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {m.positive ? '▲' : '▼'} {m.change}
            </p>
          </div>
        ))}
      </div>

      {/* Production Status Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Production Pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Pending', count: 24, color: 'bg-amber-500' },
            { label: 'Artwork Review', count: 17, color: 'bg-violet-500' },
            { label: 'Printing', count: 38, color: 'bg-sky-500' },
            { label: 'Dispatched', count: 56, color: 'bg-emerald-500' },
            { label: 'Delivered', count: 177, color: 'bg-slate-600' },
          ].map((stage) => (
            <div key={stage.label} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-800/50">
              <div className={`w-3 h-3 rounded-full ${stage.color}`} />
              <span className="text-2xl font-bold text-white">{stage.count}</span>
              <span className="text-xs text-slate-400 text-center leading-tight">{stage.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Recent Orders</h2>
          <a href="/admin/orders" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
            View all →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-medium">Order</th>
                <th className="text-left px-6 py-3 font-medium">Customer</th>
                <th className="text-left px-6 py-3 font-medium">Product</th>
                <th className="text-left px-6 py-3 font-medium">Total</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {MOCK_ORDERS.map((order) => (
                <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-sky-400 font-medium">{order.id}</td>
                  <td className="px-6 py-4 text-slate-300">{order.customer}</td>
                  <td className="px-6 py-4 text-slate-400">{order.product}</td>
                  <td className="px-6 py-4 text-white font-medium">{order.total}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
