'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  FileText,
  DollarSign,
  Receipt,
  Percent,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Download,
  Printer,
  Search,
  Filter,
  CreditCard,
  Building,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Info,
  Calendar,
  ShieldCheck,
  X,
  ExternalLink,
  ChevronDown,
  Plus,
  Edit2,
  Banknote,
  Loader2,
  Pencil,
} from 'lucide-react';
import {
  invoiceService,
  TaxInvoiceOrder,
  InvoiceStats,
  StoreTaxInfo,
  InvoicePayment,
} from '@/services/admin/invoiceService';

// Default store info if API is loading or offline
const DEFAULT_STORE_INFO: StoreTaxInfo = {
  name: 'Erry Imprints Pty Ltd',
  trading_name: 'Erry Imprints',
  abn: '12 345 678 901',
  email: 'Info@erryimprints.com.au',
  phone: '',
  address_line_1: '115 Montague Road,  ',
  city: 'Pooraka',
  state: ' SA',
  postcode: '5095',
  country: 'Australia',
  gst_rate: 0.10,
};

type PaymentFilterTab = 'all' | 'paid' | 'unpaid' | 'failed';

export default function AdminInvoicesPage() {
  const [orders, setOrders] = useState<TaxInvoiceOrder[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreTaxInfo>(DEFAULT_STORE_INFO);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tabFilter, setTabFilter] = useState<PaymentFilterTab>('all');
  const [gatewayFilter, setGatewayFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Active Selected Invoice Modal
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<TaxInvoiceOrder | null>(null);
  // Active Selected Payment Audit Flyout
  const [selectedAuditPayment, setSelectedAuditPayment] = useState<{
    order: TaxInvoiceOrder;
    payment: InvoicePayment;
  } | null>(null);

  // Active Payment Modal (Cash / In-store / Manual Update)
  const [paymentModalOrder, setPaymentModalOrder] = useState<TaxInvoiceOrder | null>(null);
  const [recordingStatusTarget, setRecordingStatusTarget] = useState<'paid' | 'unpaid'>('paid');
  const [recordingPaymentMethod, setRecordingPaymentMethod] = useState<'cash' | 'bank_transfer' | 'pos' | 'cheque'>('cash');
  const [recordingPaymentAmount, setRecordingPaymentAmount] = useState<string>('');
  const [recordingPaymentRef, setRecordingPaymentRef] = useState<string>('');
  const [recordingPaymentNotes, setRecordingPaymentNotes] = useState<string>('');
  const [recordingPaymentDate, setRecordingPaymentDate] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  // Clipboard copy state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleOpenPaymentModal = (order: TaxInvoiceOrder) => {
    setPaymentModalOrder(order);
    setRecordingStatusTarget(order.payment_status === 'paid' ? 'unpaid' : 'paid');
    setRecordingPaymentMethod('cash');
    setRecordingPaymentAmount(order.total_inc_gst ? String(Number(order.total_inc_gst).toFixed(2)) : '0.00');
    setRecordingPaymentRef(`CASH-${order.order_number}`);
    setRecordingPaymentNotes('');
    setRecordingPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentError(null);
    setPaymentSuccess(null);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder) return;

    setIsSubmittingPayment(true);
    setPaymentError(null);
    setPaymentSuccess(null);

    try {
      const res = await invoiceService.recordPayment(paymentModalOrder.id, {
        payment_status: recordingStatusTarget,
        payment_method: recordingPaymentMethod,
        amount: parseFloat(recordingPaymentAmount) || Number(paymentModalOrder.total_inc_gst) || 0,
        reference: recordingPaymentRef.trim() || undefined,
        notes: recordingPaymentNotes.trim() || undefined,
        paid_at: recordingPaymentDate ? `${recordingPaymentDate}T12:00:00` : undefined,
      });

      if (res.success) {
        setPaymentSuccess(res.message || 'Payment updated successfully');
        // Refresh invoices ledger
        await fetchInvoiceData(true);
        // If current selected invoice order was this one, update it as well
        if (selectedInvoiceOrder && selectedInvoiceOrder.id === paymentModalOrder.id) {
          if (res.data) {
            setSelectedInvoiceOrder(res.data);
          }
        }
        setTimeout(() => {
          setPaymentModalOrder(null);
          setPaymentSuccess(null);
        }, 800);
      } else {
        setPaymentError(res.message || 'Failed to update payment status');
      }
    } catch (err: any) {
      console.error('Failed to update payment:', err);
      setPaymentError(err?.response?.data?.message || err?.message || 'Error communicating with server');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const fetchInvoiceData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await invoiceService.getInvoices({
        search: searchQuery.trim() || undefined,
        payment_status: tabFilter !== 'all' ? tabFilter : undefined,
        gateway: gatewayFilter !== 'all' ? gatewayFilter : undefined,
        sort_by: sortBy,
      });

      if (res.success) {
        setOrders(res.data);
        setStats(res.stats);
        if (res.store_info) {
          setStoreInfo(res.store_info);
        }
      } else {
        setError('Failed to load invoice records');
      }
    } catch (err: any) {
      console.error('Error fetching tax invoices:', err);
      setError(err?.message || 'Error communicating with invoice API server');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [tabFilter, gatewayFilter, sortBy]);

  // Handle escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (paymentModalOrder) setPaymentModalOrder(null);
        if (selectedInvoiceOrder) setSelectedInvoiceOrder(null);
        if (selectedAuditPayment) setSelectedAuditPayment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paymentModalOrder, selectedInvoiceOrder, selectedAuditPayment]);

  // Client-side quick filter on search query for instant responsiveness
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();

    return orders.filter((o) => {
      const invNum = o.invoice?.invoice_number?.toLowerCase() || '';
      const ordNum = o.order_number?.toLowerCase() || '';
      const userName = o.user?.name?.toLowerCase() || '';
      const userEmail = o.user?.email?.toLowerCase() || '';
      const userCompany = o.user?.company_name?.toLowerCase() || '';
      const userAbn = o.user?.abn?.toLowerCase() || '';
      const shipName = o.shipping_address?.name?.toLowerCase() || '';
      const shipCompany = o.shipping_address?.company?.toLowerCase() || '';

      const txnIds = (o.payments || []).map((p) => (p.transaction_id || '').toLowerCase());
      const hasMatchTxn = txnIds.some((id) => id.includes(q));

      return (
        invNum.includes(q) ||
        ordNum.includes(q) ||
        userName.includes(q) ||
        userEmail.includes(q) ||
        userCompany.includes(q) ||
        userAbn.includes(q) ||
        shipName.includes(q) ||
        shipCompany.includes(q) ||
        hasMatchTxn
      );
    });
  }, [orders, searchQuery]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Format currency in Australian Dollars (AUD)
  const formatAUD = (amount: number | string | undefined | null) => {
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(isNaN(num) ? 0 : num);
  };

  // Format Australian dates
  const formatDateAU = (dateString?: string | null) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTimeAU = (dateString?: string | null) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  // Export BAS CSV
  const handleExportCSV = () => {
    if (!filteredOrders.length) return;

    const headers = [
      'Invoice Number',
      'Order Reference',
      'Issue Date',
      'Customer Name',
      'Company Name',
      'Customer Email',
      'Customer ABN',
      'Subtotal Ex-GST (AUD)',
      '10% GST (AUD)',
      'Shipping Inc-GST (AUD)',
      'Total Inc-GST (AUD)',
      'Payment Status',
      'Payment Gateway',
      'Transaction ID',
      'Card Scheme',
      'Card Masked',
      'Receipt Number',
      'Authorisation ID',
    ];

    const rows = filteredOrders.map((o) => {
      const primaryPayment = o.payments && o.payments.length > 0 ? o.payments[0] : null;
      const payload = primaryPayment?.payload || {};

      return [
        `"${o.invoice?.invoice_number || ''}"`,
        `"${o.order_number || ''}"`,
        `"${formatDateAU(o.created_at)}"`,
        `"${(o.user?.name || o.shipping_address?.name || '').replace(/"/g, '""')}"`,
        `"${(o.user?.company_name || o.shipping_address?.company || '').replace(/"/g, '""')}"`,
        `"${o.user?.email || o.shipping_address?.email || ''}"`,
        `"${o.user?.abn || ''}"`,
        Number(o.subtotal_ex_gst || 0).toFixed(2),
        Number(o.gst_amount || 0).toFixed(2),
        Number(o.shipping_fee_inc_gst || 0).toFixed(2),
        Number(o.total_inc_gst || 0).toFixed(2),
        `"${o.payment_status}"`,
        `"${primaryPayment?.gateway || 'N/A'}"`,
        `"${primaryPayment?.transaction_id || payload.txn_number || ''}"`,
        `"${payload.card_scheme || ''}"`,
        `"${payload.card_masked || ''}"`,
        `"${payload.receipt_number || ''}"`,
        `"${payload.authorise_id || ''}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ato-tax-invoices-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Tax Invoices (AUD)</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" /> ATO Compliant
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-0.5">
                Australian Tax Invoices with ABN {storeInfo.abn} • 10% GST breakdown & successful payment transaction audit trail.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <Link
            href="/admin/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0d5c3a] hover:bg-[#09472c] text-sm font-bold text-white transition shadow-sm"
            title="Create Custom Tax Invoice"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </Link>

          <button
            onClick={() => fetchInvoiceData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-sm font-medium text-slate-300 hover:text-white transition shadow-sm disabled:opacity-50"
            title="Refresh Invoices"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!filteredOrders.length}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white transition shadow-sm disabled:opacity-50"
            title="Export Australian BAS Reconciliation CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export BAS CSV</span>
          </button>
        </div>
      </div>

      {/* ─── ATO BAS Summary KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced Revenue (Inc GST) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Invoiced (Inc-GST)
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight">
              {stats ? formatAUD(stats.total_revenue_inc_gst) : '$0.00 AUD'}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <span className="text-emerald-400 font-medium">Gross AUD</span>
              <span>• Total collected revenue</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 h-1 w-24 bg-gradient-to-l from-emerald-500 to-transparent" />
        </div>

        {/* Net Sales Ex-GST (ATO BAS Box G1) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Net Sales (Ex-GST)
            </span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight">
              {stats ? formatAUD(stats.total_subtotal_ex_gst) : '$0.00 AUD'}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <span className="text-sky-400 font-medium">BAS Box G1</span>
              <span>• Taxable baseline sales</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 h-1 w-24 bg-gradient-to-l from-sky-500 to-transparent" />
        </div>

        {/* 10% Australian GST Liability (ATO BAS Box 1A) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              10% GST Collected
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-400 tracking-tight">
              {stats ? formatAUD(stats.total_gst_collected) : '$0.00 AUD'}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <span className="text-amber-400 font-medium">BAS Box 1A</span>
              <span>• GST payable to ATO</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 h-1 w-24 bg-gradient-to-l from-amber-500 to-transparent" />
        </div>

        {/* Successful Payments Count & Gateway Reconciliation */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Successful Payments
            </span>
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight">
              {stats ? stats.successful_payments_count : 0}{' '}
              <span className="text-sm font-normal text-slate-400">
                / {stats ? stats.total_orders_count : 0} orders
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <span className="text-violet-400 font-medium">
                {stats?.gateways?.bpoint ? `BPoint (${stats.gateways.bpoint.count})` : 'Active Gateway'}
              </span>
              <span>• 100% captured</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 h-1 w-24 bg-gradient-to-l from-violet-500 to-transparent" />
        </div>
      </div>

      {/* ─── Search, Tabs & Filters ─────────────────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Invoice (INV-...), Order (PO-...), Customer, ABN, or Transaction ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Gateway Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">Gateway:</span>
            <select
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="all">All Gateways</option>
              <option value="cash">Cash (In-Store Payment)</option>
              <option value="bpoint">BPoint (Commonwealth Bank)</option>
              <option value="stripe">Stripe</option>
              <option value="square">Square</option>
              <option value="bank_transfer">Direct Bank Transfer</option>
            </select>

            <span className="text-xs text-slate-400 whitespace-nowrap ml-2">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_high">Amount (High to Low)</option>
              <option value="amount_low">Amount (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setTabFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tabFilter === 'all'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
            >
              All Invoices ({orders.length})
            </button>
            <button
              onClick={() => setTabFilter('paid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tabFilter === 'paid'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Paid & Succeeded ({orders.filter((o) => o.payment_status === 'paid').length})</span>
            </button>
            <button
              onClick={() => setTabFilter('unpaid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tabFilter === 'unpaid'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Pending / Unpaid ({orders.filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'failed').length})</span>
            </button>
            <button
              onClick={() => setTabFilter('failed')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tabFilter === 'failed'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Failed / Refunded ({orders.filter((o) => o.payment_status === 'failed' || o.payment_status === 'refunded').length})</span>
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-300">{filteredOrders.length}</span> matching tax records
          </div>
        </div>
      </div>

      {/* ─── Invoices & Payments Table ─────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
            <p className="text-sm font-medium">Loading Australian Tax Invoices & Payment Ledger…</p>
          </div>
        ) : error ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-rose-400">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={() => fetchInvoiceData()}
              className="mt-2 px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
            >
              Try Again
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Receipt className="w-10 h-10 stroke-1 text-slate-600" />
            <p className="text-base font-semibold text-slate-400">No Tax Invoices Found</p>
            <p className="text-xs text-slate-500 max-w-sm text-center">
              No orders matched your active filters. Try adjusting the search keywords or payment status tabs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Tax Invoice & Order</th>
                  <th className="py-3.5 px-4">Customer & ABN</th>
                  <th className="py-3.5 px-4">Payment & Audit</th>
                  <th className="py-3.5 px-4 text-right">Subtotal (Ex-GST)</th>
                  <th className="py-3.5 px-4 text-right">10% GST</th>
                  <th className="py-3.5 px-4 text-right">Total (Inc-GST)</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredOrders.map((order) => {
                  const invoiceNum = order.invoice?.invoice_number || `INV-${order.order_number.replace('PO-', '')}`;
                  const isPaid = order.payment_status === 'paid';
                  const primaryPayment = order.payments && order.payments.length > 0 ? order.payments[0] : null;
                  const paymentPayload = primaryPayment?.payload || {};

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Invoice & Order Ref */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-sky-400 text-xs bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                              {invoiceNum}
                            </span>
                            <button
                              onClick={() => copyToClipboard(invoiceNum)}
                              className="text-slate-500 hover:text-slate-300 transition"
                              title="Copy Invoice Number"
                            >
                              {copiedText === invoiceNum ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span className="font-mono text-slate-300">{order.order_number}</span>
                            <span>•</span>
                            <span>{formatDateAU(order.created_at)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Customer & ABN */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-200 text-sm">
                            {order.user?.name || order.shipping_address?.name || 'Guest Checkout'}
                          </span>
                          {(order.user?.company_name || order.shipping_address?.company) && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Building className="w-3 h-3 text-slate-500" />
                              {order.user?.company_name || order.shipping_address?.company}
                            </span>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">
                              {order.user?.email || order.shipping_address?.email || '—'}
                            </span>
                            {order.user?.abn && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                ABN {order.user.abn}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Payment & Audit Trail */}
                      <td className="py-3.5 px-4 align-top">
                        {primaryPayment ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {/* Gateway Badge */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${primaryPayment.gateway === 'cash'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : primaryPayment.gateway === 'bpoint'
                                      ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                              >
                                {primaryPayment.gateway === 'cash' ? (
                                  <Banknote className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <CreditCard className="w-3 h-3" />
                                )}
                                {primaryPayment.gateway === 'cash' ? 'Cash' : primaryPayment.gateway}
                              </span>

                              {paymentPayload.card_masked && (
                                <span className="text-xs text-slate-300 font-mono">
                                  {paymentPayload.card_scheme || 'Card'} {paymentPayload.card_masked}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span className="font-mono text-[11px]">
                                Txn: {primaryPayment.transaction_id || paymentPayload.txn_number || 'N/A'}
                              </span>

                              {paymentPayload.authorise_id && (
                                <button
                                  onClick={() =>
                                    setSelectedAuditPayment({ order, payment: primaryPayment })
                                  }
                                  className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-0.5"
                                >
                                  <span>Auth {paymentPayload.authorise_id}</span>
                                  <Info className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {paymentPayload.notes && (
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={paymentPayload.notes}>
                                Note: {paymentPayload.notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 py-1">
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-500/70" />
                              <span>Payment Awaiting</span>
                            </div>
                            <button
                              onClick={() => handleOpenPaymentModal(order)}
                              className="text-[11px] text-emerald-400 hover:underline inline-flex items-center gap-1 self-start"
                            >
                              <Banknote className="w-3 h-3" />
                              <span>Record Cash</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Subtotal Ex-GST */}
                      <td className="py-3.5 px-4 align-top text-right font-mono text-slate-300 text-xs">
                        {formatAUD(order.subtotal_ex_gst)}
                      </td>

                      {/* 10% GST */}
                      <td className="py-3.5 px-4 align-top text-right font-mono text-amber-400 text-xs">
                        {formatAUD(order.gst_amount)}
                      </td>

                      {/* Total Inc-GST */}
                      <td className="py-3.5 px-4 align-top text-right font-mono font-bold text-white text-sm">
                        {formatAUD(order.total_inc_gst)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 align-top text-center">
                        {isPaid ? (
                          <button
                            onClick={() => handleOpenPaymentModal(order)}
                            title="Paid (Click to view or edit payment details)"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Paid</span>
                            <Pencil className="w-3 h-3 text-emerald-400/60 ml-0.5" />
                          </button>
                        ) : order.payment_status === 'failed' ? (
                          <button
                            onClick={() => handleOpenPaymentModal(order)}
                            title="Failed (Click to update status)"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 transition cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Failed</span>
                            <Pencil className="w-3 h-3 text-rose-400/60 ml-0.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenPaymentModal(order)}
                            title="Click to update status / record customer cash payment"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 transition cursor-pointer group/status"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Unpaid</span>
                            <Pencil className="w-3 h-3 text-amber-300 group-hover/status:scale-110 transition ml-0.5" />
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid ? (
                            <button
                              onClick={() => handleOpenPaymentModal(order)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
                              title="Record Customer Cash Payment & Mark as Paid"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Pay in Cash</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenPaymentModal(order)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition"
                              title="Edit Payment Record / Revert Status"
                            >
                              <Pencil className="w-3 h-3 text-slate-400" />
                              <span>Payment</span>
                            </button>
                          )}

                          <Link
                            href={`/admin/invoices/${order.id}/edit`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
                            title="Edit in Invoice Editor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </Link>

                          <button
                            onClick={() => setSelectedInvoiceOrder(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs font-medium transition"
                            title="View Full ATO Tax Invoice"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Tax Invoice</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedInvoiceOrder(order);
                              setTimeout(() => window.print(), 300);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Quick Print Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL: Official Australian Tax Invoice (ATO Compliant) ──────────── */}
      {selectedInvoiceOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm print:static print:p-0 print:bg-transparent print:block print:overflow-visible"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedInvoiceOrder(null);
          }}
        >
          <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150 print:max-h-none print:overflow-visible print:shadow-none print:w-full print:rounded-none">
            {/* Modal Screen Action Toolbar (Hidden during print) */}
            <div className="print:hidden flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-sky-400" />
                <span className="font-semibold text-sm">
                  Official Australian Tax Invoice Preview • {selectedInvoiceOrder.invoice?.invoice_number || selectedInvoiceOrder.order_number}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedInvoiceOrder.payment_status !== 'paid' && (
                  <button
                    onClick={() => handleOpenPaymentModal(selectedInvoiceOrder)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Pay in Cash</span>
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Tax Invoice</span>
                </button>
                <button
                  onClick={() => setSelectedInvoiceOrder(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Area - Formatted according to ATO Australian Tax Invoice Standards */}
            <div id="printable-tax-invoice" className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 bg-white text-slate-900 print:overflow-visible print:p-0">
              {/* Header section with ATO Title & Seller ABN */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-900 pb-6">
                <div>
                  <div className="mb-3">
                    <Image
                      src="/assets/images/erry_imprints_logo.png"
                      alt="Erry Imprints"
                      width={180}
                      height={42}
                      className="h-10 w-auto object-contain"
                    />
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight text-slate-950 uppercase">
                    TAX INVOICE
                  </div>
                  <div className="mt-2 text-sm text-slate-700 font-medium">
                    <div className="font-bold text-base text-slate-900">{storeInfo.name}</div>
                    {storeInfo.trading_name && <div>Trading as: {storeInfo.trading_name}</div>}
                    <div className="font-semibold text-slate-950 mt-1">
                      ABN: <span className="font-mono text-base font-bold">{storeInfo.abn}</span>
                    </div>
                    <div>{storeInfo.address_line_1}</div>
                    <div>
                      {storeInfo.city}, {storeInfo.state} {storeInfo.postcode}, {storeInfo.country}
                    </div>
                    <div className="mt-1">
                      Email: {storeInfo.email} • Ph: {storeInfo.phone}
                    </div>
                  </div>
                </div>

                <div className="sm:text-right space-y-1 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500 font-medium">Invoice Number:</span>{' '}
                    <span className="font-mono font-bold text-slate-950 text-base">
                      {selectedInvoiceOrder.invoice?.invoice_number || `INV-${selectedInvoiceOrder.order_number}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Order Reference:</span>{' '}
                    <span className="font-mono font-semibold text-slate-900">{selectedInvoiceOrder.order_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Date of Issue:</span>{' '}
                    <span className="font-semibold text-slate-900">{formatDateAU(selectedInvoiceOrder.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Currency:</span>{' '}
                    <span className="font-semibold text-slate-900">AUD (Australian Dollars)</span>
                  </div>

                  {/* Payment Stamp */}
                  <div className="pt-2">
                    {selectedInvoiceOrder.payment_status === 'paid' ? (
                      <span className="inline-block px-3 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs uppercase tracking-wider">
                        ✓ PAID IN FULL
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs uppercase tracking-wider">
                        PAYMENT PENDING
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Recipient Details (Buyer) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 text-sm max-w-md">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Invoiced To (Buyer)
                </div>
                <div className="font-bold text-slate-900 text-base">
                  {selectedInvoiceOrder.user?.name || selectedInvoiceOrder.shipping_address?.name || 'Customer'}
                </div>
                {(selectedInvoiceOrder.user?.company_name || selectedInvoiceOrder.shipping_address?.company) && (
                  <div className="font-semibold text-slate-800">
                    {selectedInvoiceOrder.user?.company_name || selectedInvoiceOrder.shipping_address?.company}
                  </div>
                )}
                {selectedInvoiceOrder.user?.abn && (
                  <div className="mt-1 font-mono font-semibold text-slate-900">
                    Buyer ABN: {selectedInvoiceOrder.user.abn}
                  </div>
                )}
                <div className="mt-1 text-slate-600">
                  <div>{selectedInvoiceOrder.user?.email || selectedInvoiceOrder.shipping_address?.email}</div>
                  {selectedInvoiceOrder.user?.phone && <div>Ph: {selectedInvoiceOrder.user.phone}</div>}
                </div>
              </div>

              {/* Itemized Table with ATO GST Breakdown */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <th className="py-3 px-4">Item & Specifications</th>
                      <th className="py-3 px-4 text-center">Qty</th>
                      <th className="py-3 px-4 text-right">Unit Price (Ex-GST)</th>
                      <th className="py-3 px-4 text-right">10% GST</th>
                      <th className="py-3 px-4 text-right">Total (Inc-GST)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedInvoiceOrder.items && selectedInvoiceOrder.items.length > 0 ? (
                      selectedInvoiceOrder.items.map((item, idx) => {
                        const unitEx = Number(item.unit_price_ex_gst || 0);
                        const lineTotalInc = Number(item.total_price_inc_gst || 0);
                        const lineTotalEx = unitEx * Number(item.quantity || 1);
                        const lineGst = lineTotalInc - lineTotalEx;

                        return (
                          <tr key={item.id || idx}>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-900">{item.product_name}</div>
                              {item.product_sku && (
                                <div className="text-xs text-slate-500 font-mono">SKU: {item.product_sku}</div>
                              )}
                              {item.options_snapshot && typeof item.options_snapshot === 'object' && (
                                <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                                  {Object.entries(item.options_snapshot).map(([k, v]) => (
                                    <span key={k} className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                      <strong className="capitalize">{k.replace('_', ' ')}:</strong> {String(v)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center font-medium text-slate-900">{item.quantity}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-700">{formatAUD(unitEx)}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                              {formatAUD(lineGst > 0 ? lineGst : lineTotalInc * 0.1)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                              {formatAUD(lineTotalInc)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 px-4 text-center text-slate-500 italic">
                          Custom Print Order Production Services
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Totals Box */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t-2 border-slate-900 pt-6">
                <div className="w-full sm:w-1/2 space-y-4">
                  {/* Payment Verification Receipt Box */}
                  {selectedInvoiceOrder.payments && selectedInvoiceOrder.payments.length > 0 && (
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-900 uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>Payment Verification & Receipt</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-700">
                        <div>
                          <span className="text-slate-500">Gateway:</span>{' '}
                          <strong className="capitalize">
                            {selectedInvoiceOrder.payments[0].gateway === 'cash'
                              ? 'Cash (In-Store Payment)'
                              : selectedInvoiceOrder.payments[0].gateway}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Txn / Ref:</span>{' '}
                          <strong className="font-mono">{selectedInvoiceOrder.payments[0].transaction_id || 'N/A'}</strong>
                        </div>
                        {selectedInvoiceOrder.payments[0].payload?.card_masked && (
                          <div>
                            <span className="text-slate-500">Card:</span>{' '}
                            <strong>{selectedInvoiceOrder.payments[0].payload.card_scheme} ({selectedInvoiceOrder.payments[0].payload.card_masked})</strong>
                          </div>
                        )}
                        {selectedInvoiceOrder.payments[0].payload?.authorise_id && (
                          <div>
                            <span className="text-slate-500">Auth Code:</span>{' '}
                            <strong className="font-mono">{selectedInvoiceOrder.payments[0].payload.authorise_id}</strong>
                          </div>
                        )}
                        {selectedInvoiceOrder.payments[0].payload?.receipt_number && (
                          <div>
                            <span className="text-slate-500">Receipt No:</span>{' '}
                            <strong className="font-mono">{selectedInvoiceOrder.payments[0].payload.receipt_number}</strong>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Paid Date:</span>{' '}
                          <strong>{formatDateTimeAU(selectedInvoiceOrder.payments[0].created_at)}</strong>
                        </div>
                        {selectedInvoiceOrder.payments[0].payload?.notes && (
                          <div className="col-span-2 pt-1 border-t border-emerald-200/60">
                            <span className="text-slate-500">Staff Notes:</span>{' '}
                            <span className="font-medium text-slate-800">{selectedInvoiceOrder.payments[0].payload.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 italic">
                    Note: This document is an official Australian Tax Invoice for GST purposes. Prices shown are in Australian Dollars (AUD) and include 10% Goods and Services Tax (GST) where applicable. Please retain for your tax and BAS accounting records.
                  </div>
                </div>

                {/* Subtotals & Final Amount Due */}
                <div className="w-full sm:w-5/12 bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-2.5 text-sm">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal (Excluding GST):</span>
                    <span className="font-mono font-medium">{formatAUD(selectedInvoiceOrder.subtotal_ex_gst)}</span>
                  </div>

                  <div className="flex justify-between text-slate-700">
                    <span>Australian GST (10%):</span>
                    <span className="font-mono font-medium text-amber-800">{formatAUD(selectedInvoiceOrder.gst_amount)}</span>
                  </div>

                  {Number(selectedInvoiceOrder.shipping_fee_inc_gst || 0) > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Shipping (Inc-GST):</span>
                      <span className="font-mono font-medium">{formatAUD(selectedInvoiceOrder.shipping_fee_inc_gst)}</span>
                    </div>
                  )}

                  {Number(selectedInvoiceOrder.discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount:</span>
                      <span className="font-mono font-medium">-{formatAUD(selectedInvoiceOrder.discount_amount)}</span>
                    </div>
                  )}

                  <div className="border-t-2 border-slate-900 pt-3 flex justify-between text-base font-extrabold text-slate-950">
                    <span>Total (Including GST):</span>
                    <span className="font-mono text-lg">{formatAUD(selectedInvoiceOrder.total_inc_gst)}</span>
                  </div>

                  <div className="border-t border-slate-200 pt-2 flex justify-between text-xs text-slate-600">
                    <span>Amount Paid:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {selectedInvoiceOrder.payment_status === 'paid'
                        ? formatAUD(selectedInvoiceOrder.total_inc_gst)
                        : '$0.00 AUD'}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm font-bold text-slate-900">
                    <span>Balance Due:</span>
                    <span className="font-mono">
                      {selectedInvoiceOrder.payment_status === 'paid'
                        ? '$0.00 AUD'
                        : formatAUD(selectedInvoiceOrder.total_inc_gst)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL / FLYOUT: Detailed Payment Audit Log ───────────────────────── */}
      {selectedAuditPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Payment Gateway Audit</h3>
                  <p className="text-xs text-slate-400">
                    Order {selectedAuditPayment.order.order_number} • {selectedAuditPayment.payment.gateway.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAuditPayment(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <div className="text-slate-500 font-medium">Gateway Transaction ID</div>
                  <div className="font-mono font-bold text-sky-400 mt-0.5">
                    {selectedAuditPayment.payment.transaction_id || selectedAuditPayment.payment.payload?.txn_number || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Settlement Status</div>
                  <div className="font-semibold text-emerald-400 mt-0.5 capitalize">
                    {selectedAuditPayment.payment.status}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Captured Amount</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {formatAUD(selectedAuditPayment.payment.amount)} {selectedAuditPayment.payment.currency}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Processed Timestamp</div>
                  <div className="text-slate-300 mt-0.5">
                    {formatDateTimeAU(selectedAuditPayment.payment.created_at)}
                  </div>
                </div>
              </div>

              {selectedAuditPayment.payment.payload && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-300 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>Gateway Response Metadata</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {selectedAuditPayment.payment.payload.response_text || 'Approved'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500">Card Scheme:</span>{' '}
                      <strong>{selectedAuditPayment.payment.payload.card_scheme || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Card Type:</span>{' '}
                      <strong>{selectedAuditPayment.payment.payload.card_type || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Masked Card:</span>{' '}
                      <strong className="font-mono">{selectedAuditPayment.payment.payload.card_masked || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Receipt No:</span>{' '}
                      <strong className="font-mono">{selectedAuditPayment.payment.payload.receipt_number || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Authorisation ID:</span>{' '}
                      <strong className="font-mono text-sky-400">
                        {selectedAuditPayment.payment.payload.authorise_id || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Bank Response:</span>{' '}
                      <strong className="font-mono">
                        {selectedAuditPayment.payment.payload.bank_response_code || '00'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Settlement Date:</span>{' '}
                      <strong className="font-mono">
                        {selectedAuditPayment.payment.payload.settlement_date || 'N/A'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAuditPayment(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white transition"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Record / Update Cash Payment Status ───────────────────────── */}
      {paymentModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingPayment) setPaymentModalOrder(null);
          }}
        >
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Banknote className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Record Payment / Update Status</h3>
                  <p className="text-xs text-slate-400">
                    Order <span className="font-mono text-slate-300 font-semibold">{paymentModalOrder.order_number}</span> •{' '}
                    {paymentModalOrder.invoice?.invoice_number || `INV-${paymentModalOrder.order_number}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModalOrder(null)}
                disabled={isSubmittingPayment}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customer & Total Snapshot */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Customer</span>
                <div className="font-medium text-slate-200 text-sm">
                  {paymentModalOrder.user?.name || paymentModalOrder.shipping_address?.name || 'Guest Customer'}
                </div>
                <div className="text-xs text-slate-500">
                  {paymentModalOrder.user?.email || paymentModalOrder.shipping_address?.email || '—'}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Total Invoice (Inc-GST)</span>
                <div className="font-mono font-bold text-lg text-emerald-400">
                  {formatAUD(paymentModalOrder.total_inc_gst)}
                </div>
                <div className="text-[11px] text-slate-500">
                  Status: <span className="capitalize font-medium text-slate-300">{paymentModalOrder.payment_status}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              {/* Payment Status Switch */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Target Payment Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordingStatusTarget('paid')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold border transition ${recordingStatusTarget === 'paid'
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Mark as Paid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordingStatusTarget('unpaid')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold border transition ${recordingStatusTarget === 'unpaid'
                        ? 'bg-amber-600/20 text-amber-300 border-amber-500/50 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Revert to Unpaid</span>
                  </button>
                </div>
              </div>

              {recordingStatusTarget === 'paid' ? (
                <>
                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Payment Method
                    </label>
                    <select
                      value={recordingPaymentMethod}
                      onChange={(e) => setRecordingPaymentMethod(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="cash">💵 Cash (In-Store / Counter)</option>
                      <option value="bank_transfer">🏦 Direct Bank Transfer / EFT</option>
                      <option value="pos">💳 EFTPOS / Counter POS Terminal</option>
                      <option value="cheque">📄 Cheque</option>
                    </select>
                  </div>

                  {/* Amount & Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Amount Paid (AUD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={recordingPaymentAmount}
                          onChange={(e) => setRecordingPaymentAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Payment Date
                      </label>
                      <input
                        type="date"
                        value={recordingPaymentDate}
                        onChange={(e) => setRecordingPaymentDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Reference / Receipt # */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Receipt / Reference Number
                    </label>
                    <input
                      type="text"
                      value={recordingPaymentRef}
                      onChange={(e) => setRecordingPaymentRef(e.target.value)}
                      placeholder="e.g. CASH-PO-12345 or Cash Register Docket #"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </>
              ) : (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>Confirm Status Reversal</span>
                  </div>
                  <p className="text-amber-200/80">
                    Setting status to Unpaid will flag the order and its tax invoice as pending payment.
                  </p>
                </div>
              )}

              {/* Staff Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Internal Staff Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={recordingPaymentNotes}
                  onChange={(e) => setRecordingPaymentNotes(e.target.value)}
                  placeholder="e.g. Paid in cash at Adelaide showroom counter to staff member."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Alerts */}
              {paymentError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {paymentSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{paymentSuccess}</span>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentModalOrder(null)}
                  disabled={isSubmittingPayment}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 hover:text-white transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white transition shadow-sm disabled:opacity-50"
                >
                  {isSubmittingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save & Mark {recordingStatusTarget === 'paid' ? 'Paid' : 'Unpaid'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
