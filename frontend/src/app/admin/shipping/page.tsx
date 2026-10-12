'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  Send,
  Navigation,
  FileText,
  Calendar,
  Building,
  Phone,
  Mail,
  ChevronRight,
  Info,
  X,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  shippingService,
  ShippingOrder,
  CarrierConfigStatus,
  TrackingResponse,
  ShipmentRecord,
} from '@/services/admin/shippingService';

type FilterTab = 'all' | 'ready_to_ship' | 'shipped';

export default function AdminShippingPage() {
  const [orders, setOrders] = useState<ShippingOrder[]>([]);
  const [carrierConfig, setCarrierConfig] = useState<CarrierConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Tracking Modal State
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [activeTracking, setActiveTracking] = useState<TrackingResponse | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Origin Config Modal State
  const [originModalOpen, setOriginModalOpen] = useState(false);
  const [originForm, setOriginForm] = useState({
    suburb: '',
    postcode: '',
    state: 'NSW',
    name: 'Erry Imprints Dispatch',
    company_name: 'Erry Imprints',
    phone: '0400000000',
    email: 'orders@erryimprints.com.au',
    address1: '123 Printing Way',
  });
  const [originSaving, setOriginSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOrdersAndStatus = async () => {
    try {
      setLoading(true);
      const res = await shippingService.getOrders({
        status: filterTab === 'all' ? undefined : filterTab,
        search: search.trim() ? search : undefined,
      });

      setOrders(res.data || []);
      if (res.carrier_config) {
        setCarrierConfig(res.carrier_config);
        setOriginForm({
          suburb: res.carrier_config.dispatch_suburb || '',
          postcode: res.carrier_config.dispatch_postcode || '',
          state: res.carrier_config.dispatch_state || 'NSW',
          name: res.carrier_config.dispatch_name || 'Erry Imprints Dispatch',
          company_name: res.carrier_config.dispatch_company || 'Erry Imprints',
          phone: '0400000000',
          email: 'orders@erryimprints.com.au',
          address1: '123 Printing Way',
        });
      }
    } catch (err: any) {
      console.error('Failed to load shipping orders:', err);
      showToast('error', 'Failed to load shipping data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersAndStatus();
  }, [filterTab]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCreateShipment = async (order: ShippingOrder) => {
    if (!carrierConfig?.dispatch_origin_configured) {
      showToast('error', 'Please configure Dispatch Suburb and Postcode before creating shipments.');
      setOriginModalOpen(true);
      return;
    }

    try {
      setActionLoading(order.id);
      const res = await shippingService.createShipment(order.id, {
        is_signature_required: false,
        is_atl: true,
      });

      showToast('success', `Shipment booked! Consignment: ${res.data.shipment.consignment_code}`);
      fetchOrdersAndStatus();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Shipment booking failed.';
      showToast('error', msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTrackParcel = async (consignmentCode: string) => {
    try {
      setTrackingLoading(true);
      setTrackingModalOpen(true);
      setActiveTracking(null);

      const trackingData = await shippingService.trackParcel(consignmentCode);
      setActiveTracking(trackingData);
    } catch (err: any) {
      showToast('error', 'Unable to fetch live tracking milestones.');
      setActiveTracking({
        tracking_code: consignmentCode,
        status: 'Shipment Created',
        events: [
          {
            date: new Date().toLocaleDateString('en-AU'),
            time: 'Just now',
            action: 'Consignment created. Awaiting depot collection and barcode scan.',
            contractor: 'CouriersPlease Network',
          },
        ],
      });
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleSaveOrigin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originForm.suburb || !originForm.postcode) {
      showToast('error', 'Dispatch Suburb and Postcode are required.');
      return;
    }

    try {
      setOriginSaving(true);
      await shippingService.updateOrigin(originForm);
      showToast('success', 'Dispatch origin updated successfully.');
      setOriginModalOpen(false);
      fetchOrdersAndStatus();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to update origin.');
    } finally {
      setOriginSaving(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const term = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(term) ||
        o.tracking_number?.toLowerCase().includes(term) ||
        o.user?.name?.toLowerCase().includes(term) ||
        o.shipping_address?.suburb?.toLowerCase().includes(term) ||
        o.shipping_address?.postcode?.toLowerCase().includes(term)
    );
  }, [orders, search]);

  const stats = useMemo(() => {
    const ready = orders.filter((o) => o.payment_status === 'paid' && !o.tracking_number).length;
    const shipped = orders.filter((o) => !!o.tracking_number).length;
    return { total: orders.length, ready, shipped };
  }, [orders]);

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto bg-slate-950 text-slate-100 min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm animate-in fade-in slide-in-from-top-4 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 via-orange-500/10 to-amber-500/5 border border-amber-500/30 text-amber-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                CouriersPlease Shipping Panel
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {carrierConfig?.environment === 'sandbox' ? 'Sandbox Mode' : 'Production'}
                </span>
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Generate domestic consignments, download shipping labels, and track parcels live.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setOriginModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            Dispatch Origin Settings
          </button>
          <button
            onClick={fetchOrdersAndStatus}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Carrier Configuration & Dispatch Origin Status Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Origin Config Status Card */}
        <div className="lg:col-span-2 rounded-xl bg-slate-900/70 border border-slate-800 p-5 relative overflow-hidden backdrop-blur-xs shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Configured Dispatch Origin</h3>
                {carrierConfig?.dispatch_origin_configured ? (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active & Ready
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Configuration Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Quotes and consignments require an Australian dispatch origin. Do not assume Sydney 2000.
              </p>
            </div>

            <button
              onClick={() => setOriginModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors shrink-0"
            >
              Configure Origin
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Dispatch Suburb</span>
              <span className="font-semibold text-slate-200">
                {carrierConfig?.dispatch_suburb || (
                  <span className="text-rose-400 italic">Not configured</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Postcode</span>
              <span className="font-semibold text-slate-200">
                {carrierConfig?.dispatch_postcode || (
                  <span className="text-rose-400 italic">Not configured</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">State</span>
              <span className="font-semibold text-slate-200">
                {carrierConfig?.dispatch_state || 'NSW'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Sender Identity</span>
              <span className="font-semibold text-slate-200 truncate block">
                {carrierConfig?.dispatch_name || 'Erry Imprints Dispatch'}
              </span>
            </div>
          </div>
        </div>

        {/* Carrier Connection Card */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5 space-y-3 backdrop-blur-xs shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              API Carrier Service
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Basic Auth
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Account Status</span>
              <span className="text-slate-200 font-medium">
                {carrierConfig?.has_credentials ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {carrierConfig.account_number_masked || 'Connected'}
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Awaiting Credentials in .env
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">API Gateway</span>
              <span className="text-slate-300 font-mono text-[11px]">
                {carrierConfig?.environment === 'sandbox'
                  ? 'api-test.couriersplease.com.au'
                  : 'api.couriersplease.com.au'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400">Default Rate Card</span>
              <span className="text-slate-300 font-semibold">{carrierConfig?.default_rate_card || 'L55'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Origin Configuration Warning Banner */}
      {!carrierConfig?.dispatch_origin_configured && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center justify-between gap-4 text-amber-200 text-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">Dispatch origin is not configured.</p>
              <p className="text-amber-200/80 text-[11px] mt-0.5">
                CouriersPlease strictly requires a sender suburb and postcode before quotes and consignment labels can be requested.
              </p>
            </div>
          </div>
          <button
            onClick={() => setOriginModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shrink-0"
          >
            Set Dispatch Origin Now
          </button>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Orders ({stats.total})
          </button>
          <button
            onClick={() => setFilterTab('ready_to_ship')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterTab === 'ready_to_ship'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Ready to Ship</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filterTab === 'ready_to_ship'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {stats.ready}
            </span>
          </button>
          <button
            onClick={() => setFilterTab('shipped')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterTab === 'shipped'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Dispatched</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filterTab === 'shipped'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {stats.shipped}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by order #, tracking #, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-amber-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Orders & Shipments Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl backdrop-blur-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-800/80">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Order / Customer</th>
                <th className="py-3.5 px-4">Destination</th>
                <th className="py-3.5 px-4">Items / Total</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4">Consignment / Status</th>
                <th className="py-3.5 px-4 text-right">Carrier Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                      <span>Loading shipping orders...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="w-8 h-8 text-slate-700" />
                      <p className="text-sm font-medium text-slate-400">No matching orders found</p>
                      <p className="text-xs text-slate-600">
                        {filterTab === 'ready_to_ship'
                          ? 'All eligible paid orders currently have consignments generated.'
                          : 'Try adjusting your search or filter tab.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const hasConsignment = !!order.tracking_number;
                  const isPaid = order.payment_status === 'paid';
                  const destination = order.shipping_address;
                  const latestShipment = order.shipments?.[0];

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Order / Customer */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <span>{order.order_number}</span>
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          {destination?.name || order.user?.name || 'Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {destination?.phone || order.user?.phone || 'No phone'}
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-medium text-slate-300">
                          {destination?.suburb || destination?.city || 'Sydney'},{' '}
                          {destination?.state || 'NSW'} {destination?.postcode || '2000'}
                        </div>
                        <div className="text-slate-500 text-[11px] truncate max-w-[200px]">
                          {destination?.address_line_1 || 'Address not provided'}
                        </div>
                      </td>

                      {/* Items / Total */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="text-slate-300">
                          {order.items?.length || 1} product(s)
                        </div>
                        <div className="font-semibold text-white mt-0.5">
                          ${parseFloat(String(order.total_inc_gst || 0)).toFixed(2)} AUD
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {isPaid ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {order.payment_status.toUpperCase()}
                        </span>
                      </td>

                      {/* Consignment / Carrier Status */}
                      <td className="py-3.5 px-4 align-top">
                        {hasConsignment ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                {order.tracking_number}
                              </span>
                              <button
                                onClick={() => copyToClipboard(order.tracking_number!)}
                                className="text-slate-500 hover:text-slate-300 p-0.5"
                                title="Copy tracking code"
                              >
                                {copiedText === order.tracking_number ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <span className="inline-block text-[11px] text-slate-400 font-medium">
                              {order.shipping_carrier || 'CouriersPlease'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">
                            {isPaid ? 'Awaiting shipment creation' : 'Awaiting order payment'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right align-top">
                        <div className="flex items-center justify-end gap-2">
                          {!hasConsignment ? (
                            <button
                              onClick={() => handleCreateShipment(order)}
                              disabled={actionLoading === order.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-xs disabled:opacity-50"
                            >
                              {actionLoading === order.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              Book CouriersPlease
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleTrackParcel(order.tracking_number!)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
                                title="View tracking milestones"
                              >
                                <Navigation className="w-3 h-3 text-amber-400" />
                                Track
                              </button>

                              <a
                                href={shippingService.getLabelDownloadUrl(order.tracking_number!)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
                                title="Download / Print CouriersPlease Label"
                              >
                                <Download className="w-3 h-3" />
                                Label
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Tracking Milestones Modal */}
      {trackingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">CouriersPlease Live Tracking</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {activeTracking?.tracking_code || 'Tracking'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTrackingModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {trackingLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
                  <span className="text-xs">Locating parcel in CouriersPlease network...</span>
                </div>
              ) : activeTracking ? (
                <>
                  {/* Status Banner */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Current Status</span>
                      <span className="text-sm font-bold text-emerald-400">
                        {activeTracking.status || 'In Transit'}
                      </span>
                    </div>
                    {activeTracking.eta && (
                      <div className="text-right">
                        <span className="text-slate-500 text-[11px] block">Estimated Delivery</span>
                        <span className="text-xs font-semibold text-slate-200">
                          {activeTracking.eta}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Milestones Vertical Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Scan History & Milestones
                    </h4>

                    {activeTracking.events && activeTracking.events.length > 0 ? (
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                        {activeTracking.events.map((evt, idx) => (
                          <div key={idx} className="relative group">
                            <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-amber-500/20 border-2 border-amber-400 shrink-0" />
                            <div className="space-y-0.5">
                              <p className="text-xs font-semibold text-slate-200">{evt.action}</p>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <span>{evt.date}</span>
                                <span>•</span>
                                <span>{evt.time}</span>
                                {evt.contractor && (
                                  <>
                                    <span>•</span>
                                    <span>{evt.contractor}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 text-center">
                        Consignment booked. First scan milestone will appear as soon as the courier scans the parcel barcode at dispatch collection.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                onClick={() => setTrackingModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close Tracking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Origin Settings Modal */}
      {originModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Configure Dispatch Origin</h3>
              </div>
              <button
                onClick={() => setOriginModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrigin} className="p-6 space-y-4">
              <p className="text-xs text-slate-400">
                CouriersPlease calculates quotes and schedules collections based on this dispatch address. Please do not assume Sydney 2000; specify your exact printing facility location.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Dispatch Suburb <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Manly"
                    value={originForm.suburb}
                    onChange={(e) => setOriginForm({ ...originForm, suburb: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Postcode <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2095"
                    value={originForm.postcode}
                    onChange={(e) => setOriginForm({ ...originForm, postcode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">State Code</label>
                  <select
                    value={originForm.state}
                    onChange={(e) => setOriginForm({ ...originForm, state: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="NSW">NSW</option>
                    <option value="VIC">VIC</option>
                    <option value="QLD">QLD</option>
                    <option value="SA">SA</option>
                    <option value="WA">WA</option>
                    <option value="TAS">TAS</option>
                    <option value="ACT">ACT</option>
                    <option value="NT">NT</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Sender Contact Name</label>
                  <input
                    type="text"
                    placeholder="Dispatch Team"
                    value={originForm.name}
                    onChange={(e) => setOriginForm({ ...originForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. 123 Printing Way"
                  value={originForm.address1}
                  onChange={(e) => setOriginForm({ ...originForm, address1: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Phone</label>
                  <input
                    type="text"
                    placeholder="0400000000"
                    value={originForm.phone}
                    onChange={(e) => setOriginForm({ ...originForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Dispatch Email</label>
                  <input
                    type="email"
                    placeholder="orders@erryimprints.com.au"
                    value={originForm.email}
                    onChange={(e) => setOriginForm({ ...originForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOriginModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={originSaving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-1.5"
                >
                  {originSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Origin Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
