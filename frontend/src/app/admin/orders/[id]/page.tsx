'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStatusStyle, formatStatusLabel } from '@/utils/orderStatus';
import {
  manualOrderService,
  ManualOrderDetail,
} from '@/services/admin/manualOrderService';
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Send,
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Layers,
  FileCheck,
  Play,
  RotateCcw,
  Bell,
  Trash2,
  Upload,
  Plus,
  Truck,
  ExternalLink,
} from 'lucide-react';

const PRODUCTION_STATUS_SEQUENCE = [
  { value: 'printing', label: 'Printing' },
  { value: 'cutting_and_finishing', label: 'Cutting & Finishing' },
  { value: 'quality_check_and_packaging', label: 'Quality Check & Packaging' },
  { value: 'ready_for_pickup', label: 'Ready for Store Pickup' },
  { value: 'handed_over_to_courier', label: 'Handed over to courier' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'collected', label: 'Order Collected' },
];

const getProductionStatusSequence = (isPickup: boolean) => [
  { value: 'printing', label: 'Printing' },
  { value: 'cutting_and_finishing', label: 'Cutting & Finishing' },
  { value: 'quality_check_and_packaging', label: 'Quality Check & Packaging' },
  ...(isPickup
    ? [
        { value: 'ready_for_pickup', label: 'Ready for Store Pickup' },
        { value: 'collected', label: 'Order Collected by Customer' },
      ]
    : [
        { value: 'handed_over_to_courier', label: 'Handed over to courier (Out for Delivery)' },
        { value: 'delivered', label: 'Delivered to Address' },
      ]),
];

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdminOrderDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  const router = useRouter();

  const [order, setOrder] = useState<ManualOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Production status workflow state
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [carrier, setCarrier] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);
  const [statusActionMessage, setStatusActionMessage] = useState<string | null>(null);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);

  // Upload revision state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Actions in flight
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await manualOrderService.getOrder(orderId);
      if (res.success && res.data) {
        setOrder(res.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    if (order) {
      setSelectedStatus(order.status);
      setCarrier(order.shipping_carrier || '');
      setTrackingNumber(order.tracking_number || '');
    }
  }, [order]);

  const handleUpdateStatus = async () => {
    if (!order || !selectedStatus) return;
    setStatusActionError(null);
    setStatusActionMessage(null);

    // Require carrier and tracking number when selecting Handed over to courier
    if (selectedStatus === 'handed_over_to_courier' || selectedStatus === 'dispatched') {
      if (!carrier.trim()) {
        setStatusActionError('Carrier name is required before saving "Handed over to courier".');
        return;
      }
      if (!trackingNumber.trim()) {
        setStatusActionError('Tracking number is required before saving "Handed over to courier".');
        return;
      }
    }

    setStatusUpdating(true);
    try {
      const res = await manualOrderService.updateProductionStatus(order.id, {
        status: selectedStatus,
        shipping_carrier: carrier.trim(),
        carrier: carrier.trim(),
        tracking_number: trackingNumber.trim(),
      });

      if (res.success) {
        setStatusActionMessage(res.message || 'Order status updated and recorded to history.');
        fetchOrder();
      }
    } catch (err: any) {
      setStatusActionError(
        err?.response?.data?.message || 'Failed to update order status.'
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCopyLink = () => {
    if (order?.review_link?.url) {
      navigator.clipboard.writeText(order.review_link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendForApproval = async () => {
    if (!order) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await manualOrderService.sendForApproval(order.id);
      if (res.success) {
        setActionSuccess('Review invitation dispatched to customer email.');
        fetchOrder();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send for approval.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateLink = async () => {
    if (!order) return;
    if (!confirm('Regenerating will revoke the previous customer link. Continue?')) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await manualOrderService.regenerateLink(order.id);
      if (res.success) {
        setActionSuccess('Customer review link regenerated.');
        fetchOrder();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to regenerate link.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!order) return;
    if (!confirm('Are you sure you want to revoke this customer review link?')) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await manualOrderService.revokeLink(order.id);
      if (res.success) {
        setActionSuccess('Customer review link revoked.');
        fetchOrder();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to revoke link.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReminder = async () => {
    if (!order) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await manualOrderService.sendReminder(order.id);
      if (res.success) {
        setActionSuccess(res.message || 'Reminder sent to customer.');
        fetchOrder();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send reminder.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToProduction = async () => {
    if (!order) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await manualOrderService.moveToProduction(order.id);
      if (res.success) {
        setActionSuccess('Order successfully moved into production queue!');
        fetchOrder();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not move order to production.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadRevision = async () => {
    if (!order || uploadFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const nextVersion = (order.current_proof_version || 1) + 1;
      const res = await manualOrderService.uploadProof(order.id, uploadFiles, nextVersion);
      if (res.success) {
        setActionSuccess(`Proof V${nextVersion} uploaded successfully.`);
        setShowUploadModal(false);
        setUploadFiles([]);
        fetchOrder();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to upload revision.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    if (!confirm(`Are you sure you want to permanently delete order ${order.order_number} directly from the database? This cannot be undone.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await manualOrderService.deleteOrder(order.id);
      if (res.success) {
        alert(res.message || 'Order deleted successfully from database.');
        router.push('/admin/orders');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete order from database.');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
          <span>Loading order details...</span>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex-1 p-8 space-y-4">
        <Link href="/admin/orders" className="text-sky-400 text-sm hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </Link>
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-sm">
          {error || 'Order not found.'}
        </div>
      </div>
    );
  }

  const isApproved = Boolean(order.approved_proof_version);
  const isPaid = order.payment_status === 'paid';
  const canAdvanceToProduction = isApproved && isPaid && order.status !== 'in_production';

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white font-mono">{order.order_number}</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${getStatusStyle(
                  order.status
                )}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                <span>{formatStatusLabel(order.status)}</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isPaid
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {isPaid ? 'PAID' : 'UNPAID'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Customer: {order.customer.name} ({order.customer.email}) • Created {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canAdvanceToProduction && (
            <button
              onClick={handleMoveToProduction}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Advance to Production</span>
            </button>
          )}

          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-pink-400" />
            <span>Upload Revision</span>
          </button>

          <button
            onClick={handleDeleteOrder}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            title="Permanently delete this order from database"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete from DB</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Change Request Banner (if customer requested changes) */}
      {order.status === 'changes_requested' && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200 text-sm">Customer Requested Changes</p>
              <p className="text-slate-300 mt-1">
                The customer reviewed Proof V{order.current_proof_version} and submitted revision requests.
                Upload a revised proof (V{(order.current_proof_version || 1) + 1}) to send an updated review link.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium text-xs whitespace-nowrap"
          >
            Upload Revised Proof
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Customer Review Link, Products, Proofs, Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Review Link Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span>Customer Review Portal Link</span>
                <span className="text-slate-500 font-mono text-xs">(Unguessable Secure Token)</span>
              </h2>
              {order.review_link && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    order.review_link.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {order.review_link.status.toUpperCase()}
                </span>
              )}
            </div>

            {order.review_link?.url ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-sky-400">
                  <span className="truncate flex-1">{order.review_link.url}</span>
                  <button
                    onClick={handleCopyLink}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Copy Link"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={order.review_link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Open Customer Review"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-4">
                    <span>
                      Opens:{' '}
                      <strong className="text-slate-200 font-mono">{order.review_link.open_count}</strong>
                    </span>
                    {order.review_link.last_opened_at && (
                      <span>
                        Last opened:{' '}
                        <strong className="text-slate-200">{order.review_link.last_opened_at}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSendReminder}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                      title="Send email reminder (rate limited 24h)"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>Send Reminder</span>
                    </button>

                    <button
                      onClick={handleRegenerateLink}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                      <span>Regenerate Link</span>
                    </button>

                    <button
                      onClick={handleRevokeLink}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-red-400 text-xs transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-slate-400">No active review link generated yet.</p>
                <button
                  onClick={handleSendForApproval}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium rounded-lg"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Generate Link & Send for Approval</span>
                </button>
              </div>
            )}
          </div>

          {/* Products & Specifications */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">Ordered Products</h2>
            <div className="divide-y divide-slate-800 text-xs">
              {order.items.map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-pink-400 flex-shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200 text-sm">{item.product_name}</p>
                      <p className="text-slate-400 mt-0.5">{item.specifications}</p>
                      <p className="text-slate-500 text-[11px] font-mono mt-1">SKU: {item.product_sku}</p>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-bold text-white text-sm font-mono">
                      ${item.total_price_inc_gst.toFixed(2)}
                    </p>
                    <p className="text-slate-500 text-[11px] font-mono">
                      {item.quantity} qty @ ${(item.total_price_inc_gst / item.quantity).toFixed(2)} ea
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Proof Versions History */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Artwork Proof Versions</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Current Version: Proof V{order.current_proof_version}
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload New Version</span>
              </button>
            </div>

            <div className="space-y-3">
              {order.proof.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="bg-slate-800/40 border border-slate-800 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-pink-400 text-xs">
                      V{ver.version_number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{ver.label}</span>
                        {ver.is_approved ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Approved by Customer
                          </span>
                        ) : ver.version_number === order.current_proof_version ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Pending Customer Review
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                            Archived
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">Uploaded {ver.uploaded_at_formatted}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {ver.pdf_url && (
                      <a
                        href={ver.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes: Internal Notes & Customer Visible Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <span className="font-semibold text-slate-300 block">
                Internal Notes <span className="text-slate-500 font-normal">(Staff only - never exposed)</span>
              </span>
              <p className="text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
                {order.internal_notes || 'No internal notes added.'}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <span className="font-semibold text-slate-300 block">
                Customer Notes <span className="text-slate-500 font-normal">(Visible on customer portal)</span>
              </span>
              <p className="text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
                {order.customer_notes || 'No customer notes added.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Summary, Customer Info, Audit Timeline */}
        <div className="space-y-6">
          {/* Order Production & Shipping Status Control */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-white">Production & Shipping Status</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {order.status_label || order.status.replace(/_/g, ' ')}
              </span>
            </div>

            {statusActionError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{statusActionError}</span>
              </div>
            )}

            {statusActionMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{statusActionMessage}</span>
              </div>
            )}

            {/* Mobile-Friendly Status Selection Control */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-400 block">
                  Update Status (Customer Visible Sequence)
                </label>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-slate-800 text-sky-400 border border-slate-700 text-center leading-tight inline-flex flex-col items-center justify-center shrink-0">
                  {order.delivery_method?.toLowerCase().includes('pickup') ? (
                    <>
                      <span>Store</span>
                      <span>Pickup</span>
                    </>
                  ) : (
                    <>
                      <span>Courier</span>
                      <span>Delivery</span>
                    </>
                  )}
                </span>
              </div>

              {(() => {
                const isPickup = Boolean(order.delivery_method?.toLowerCase().includes('pickup'));
                const sequenceOptions = getProductionStatusSequence(isPickup);

                return (
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setStatusActionError(null);
                    }}
                    disabled={statusUpdating}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                  >
                    {!sequenceOptions.some((s) => s.value === order.status) && (
                      <option value={order.status}>
                        Current: {order.status_label || order.status.replace(/_/g, ' ')}
                      </option>
                    )}
                    {sequenceOptions.map((s, idx) => (
                      <option key={s.value} value={s.value}>
                        {idx + 1}. {s.label}
                      </option>
                    ))}
                  </select>
                );
              })()}

              {/* Courier & Tracking required when Handed over to courier is selected */}
              {(selectedStatus === 'handed_over_to_courier' ||
                selectedStatus === 'dispatched' ||
                order.status === 'handed_over_to_courier' ||
                order.status === 'dispatched' ||
                order.status === 'delivered') && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-amber-400" />
                      Courier & Consignment Details
                    </span>
                    {(selectedStatus === 'handed_over_to_courier' || selectedStatus === 'dispatched') && (
                      <span className="text-[10px] text-amber-400 font-medium">Required</span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Shipping Carrier</label>
                    <input
                      type="text"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      placeholder="e.g. CouriersPlease, Australia Post, StarTrack"
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {['CouriersPlease', 'Australia Post', 'StarTrack', 'TNT'].map((suggested) => (
                        <button
                          key={suggested}
                          type="button"
                          onClick={() => setCarrier(suggested)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          {suggested}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. CPAFXLC18669399 or 9970016078"
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {order.carrier_tracking_url && (
                    <div className="pt-1">
                      <a
                        href={order.carrier_tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Carrier Tracking Page</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleUpdateStatus}
                disabled={statusUpdating || !selectedStatus}
                className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {statusUpdating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Status...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Order Status</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3">
              Order Financials
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal (ex GST)</span>
                <span className="text-slate-200 font-mono">${order.subtotal_ex_gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST (10%)</span>
                <span className="text-slate-200 font-mono">${order.gst_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping ({order.delivery_method})</span>
                <span className="text-slate-200 font-mono">
                  ${order.shipping_fee_inc_gst.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-sm font-bold text-white">
                <span>Total (AUD)</span>
                <span className="text-base font-mono text-emerald-400">
                  ${order.total_inc_gst.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery & Customer Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Customer & Delivery
            </h3>
            <div className="space-y-1.5 text-slate-300">
              <p className="font-semibold text-white">{order.customer.name}</p>
              {order.customer.company_name && (
                <p className="text-slate-400">{order.customer.company_name}</p>
              )}
              <p className="text-slate-400">{order.customer.email}</p>
              {order.customer.phone && <p className="text-slate-400">{order.customer.phone}</p>}
              <div className="border-t border-slate-800 pt-2 mt-2">
                <span className="text-slate-500 font-medium block">Delivery Address:</span>
                <p className="text-slate-300 mt-0.5">{order.delivery_address}</p>
              </div>
            </div>
          </div>

          {/* Append-Only Activity Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Activity History
            </h3>
            <div className="space-y-3.5 text-xs max-h-80 overflow-y-auto pr-1">
              {order.activities.length === 0 ? (
                <p className="text-slate-500 text-xs">No activity logged yet.</p>
              ) : (
                order.activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-pink-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-slate-200 font-medium leading-snug">{act.description}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {act.time_ago} • {act.actor_name || act.actor_type}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Revision Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white">Upload Revised Proof</h3>
            <p className="text-xs text-slate-400">
              Upload revised artwork files for Proof V{(order.current_proof_version || 1) + 1}. This creates an append-only revision and resets customer approval.
            </p>

            <div className="border-2 border-dashed border-slate-700 hover:border-pink-500 p-6 rounded-xl text-center cursor-pointer">
              <input
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setUploadFiles(Array.from(e.target.files));
                  }
                }}
                accept=".pdf,.ai,.eps,.png,.jpg,.jpeg"
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-pink-600 file:text-white hover:file:bg-pink-500"
              />
              <p className="text-[11px] text-slate-500 mt-2">PDF, AI, EPS, PNG, JPG (max 50MB)</p>
            </div>

            {uploadFiles.length > 0 && (
              <div className="text-xs text-slate-300 space-y-1">
                {uploadFiles.map((f, i) => (
                  <p key={i} className="truncate">
                    • {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFiles([]);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadRevision}
                disabled={uploading || uploadFiles.length === 0}
                className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Save & Create Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
