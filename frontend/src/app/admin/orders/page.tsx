'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { manualOrderService, ManualOrderListItem } from '@/services/admin/manualOrderService';
import { Plus, Search, RefreshCw, ExternalLink, Eye, AlertCircle, Trash2, Pencil, Copy } from 'lucide-react';

type FilterTab = 'all' | 'draft' | 'artwork_review' | 'changes_requested' | 'in_production' | 'dispatched' | 'delivered';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-700/50 text-slate-300 border border-slate-600',
  pending_payment: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  artwork_review: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  changes_requested: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  in_production: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  dispatched: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  delivered: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_payment: 'Pending Payment',
  artwork_review: 'Artwork Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  in_production: 'Printing',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Artwork Review', value: 'artwork_review' },
  { label: 'Changes Requested', value: 'changes_requested' },
  { label: 'Printing', value: 'in_production' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Delivered', value: 'delivered' },
];

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<ManualOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await manualOrderService.getOrders({
        status: filter === 'all' ? undefined : filter,
        search: search.trim() || undefined,
      });
      if (res.success && res.data) {
        setOrders(res.data.data || []);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadOrders]);

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`Are you sure you want to permanently delete order ${orderNumber} directly from the database? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await manualOrderService.deleteOrder(orderId);
      if (res.success) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete order from database.');
    }
  };

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Order Management</h1>
            <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
              {orders.length} orders
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Manual orders, artwork proofing, approval links, and production tracking.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => loadOrders()}
            className="p-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/admin/orders/create"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-medium text-sm rounded-lg shadow-sm shadow-pink-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create manual order</span>
          </Link>
        </div>
      </div>

      {/* Search and Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by order ID, customer name, email, or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === tab.value
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider bg-slate-900/80">
                <th className="text-left px-6 py-3.5 font-medium">Order ID</th>
                <th className="text-left px-6 py-3.5 font-medium">Customer</th>
                <th className="text-left px-6 py-3.5 font-medium">Product</th>
                <th className="text-left px-6 py-3.5 font-medium">Proof / Link</th>
                <th className="text-left px-6 py-3.5 font-medium">Total (AUD)</th>
                <th className="text-left px-6 py-3.5 font-medium">Status</th>
                <th className="text-left px-6 py-3.5 font-medium">Date</th>
                <th className="text-right px-6 py-3.5 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-500 text-sm">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                      <span>Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-500 text-sm">
                    <p className="text-slate-400 font-medium">No orders found.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {search || filter !== 'all'
                        ? 'Try clearing your filters or search query.'
                        : 'Click "Create manual order" above to start your first order.'}
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="px-6 py-4 font-mono text-sky-400 font-medium whitespace-nowrap">
                      <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-200 font-medium leading-tight">
                        {order.customer.name || 'Customer'}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">{order.customer.email}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-300 max-w-xs truncate">
                      {order.product_summary}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                          {order.proof_version}
                        </span>
                        {order.review_link && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              order.review_link.open_count > 0
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                            title={`Opened ${order.review_link.open_count} time(s)`}
                          >
                            {order.review_link.open_count > 0
                              ? `Opened ${order.review_link.open_count}x`
                              : 'Link sent'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white font-semibold whitespace-nowrap">
                      {order.total_formatted}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_STYLES[order.status] || 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs whitespace-nowrap">
                      {order.date}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
                          title="Manage order"
                        >
                          <span>Manage</span>
                          <span>→</span>
                        </Link>
                        <Link
                          href={`/admin/orders/create?orderId=${order.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                          title="Edit order details, products & configuration"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </Link>
                        <Link
                          href={`/admin/orders/create?copyId=${order.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                          title="Copy / Duplicate order into new draft"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id, order.order_number)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete permanently from database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
