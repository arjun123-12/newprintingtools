'use client';

import { useState } from 'react';

type Status = 'all' | 'pending' | 'artwork_review' | 'printing' | 'dispatched' | 'delivered';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  artwork_review: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  printing: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  dispatched: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  delivered: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  artwork_review: 'Artwork Review',
  printing: 'Printing',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
};

const ORDERS = [
  { id: 'ORD-10042', customer: 'Mitchell & Co.', email: 'admin@mitchellandco.com.au', product: 'Business Cards (500)', total: '$89.00', status: 'artwork_review', date: '25 Aug 2026' },
  { id: 'ORD-10041', customer: 'Sunrise Bakery', email: 'hello@sunrisebakery.com.au', product: 'A3 Flyers (1000)', total: '$145.00', status: 'printing', date: '25 Aug 2026' },
  { id: 'ORD-10040', customer: 'Peak Builders', email: 'orders@peakbuilders.com.au', product: 'Pull-Up Banner (x2)', total: '$260.00', status: 'dispatched', date: '24 Aug 2026' },
  { id: 'ORD-10039', customer: 'Nova Tech', email: 'billing@novatech.com.au', product: 'Letterhead (250)', total: '$72.50', status: 'pending', date: '24 Aug 2026' },
  { id: 'ORD-10038', customer: 'Green Earth Co.', email: 'info@greenearth.com.au', product: 'Stickers (A4 Sheet x10)', total: '$55.00', status: 'delivered', date: '23 Aug 2026' },
  { id: 'ORD-10037', customer: 'Blue Sky Events', email: 'print@blueskyevents.com.au', product: 'A2 Posters (200)', total: '$198.00', status: 'printing', date: '23 Aug 2026' },
  { id: 'ORD-10036', customer: 'Summit Real Estate', email: 'admin@summitrealty.com.au', product: 'DL Brochures (2000)', total: '$320.00', status: 'dispatched', date: '22 Aug 2026' },
  { id: 'ORD-10035', customer: 'The Corner Cafe', email: 'orders@cornercafe.com.au', product: 'Table Cards (100)', total: '$38.00', status: 'delivered', date: '22 Aug 2026' },
];

const FILTER_TABS: { label: string; value: Status }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Artwork Review', value: 'artwork_review' },
  { label: 'Printing', value: 'printing' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Delivered', value: 'delivered' },
];

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<Status>('all');
  const [search, setSearch] = useState('');

  const filtered = ORDERS.filter((o) => {
    const matchStatus = filter === 'all' || o.status === filter;
    const matchSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customer.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Order Management</h1>
          <p className="text-slate-400 text-sm mt-1">Track orders from payment through to dispatch.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{filtered.length} orders</span>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by order ID or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === tab.value
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-medium">Order ID</th>
                <th className="text-left px-6 py-3 font-medium">Customer</th>
                <th className="text-left px-6 py-3 font-medium">Product</th>
                <th className="text-left px-6 py-3 font-medium">Total</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium">Date</th>
                <th className="text-left px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm">
                    No orders match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-sky-400 font-medium">{order.id}</td>
                    <td className="px-6 py-4">
                      <p className="text-slate-200 font-medium">{order.customer}</p>
                      <p className="text-slate-500 text-xs">{order.email}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{order.product}</td>
                    <td className="px-6 py-4 text-white font-semibold">{order.total}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{order.date}</td>
                    <td className="px-6 py-4">
                      <button className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium">
                        View →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
