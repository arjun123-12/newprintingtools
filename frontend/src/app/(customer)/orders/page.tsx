'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Truck,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  MapPin,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Navigation,
} from 'lucide-react';
import { shippingService, TrackingResponse } from '@/services/admin/shippingService';

export default function OrdersPage() {
  const [orderQuery, setOrderQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<TrackingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = orderQuery.trim();
    if (!query) return;

    try {
      setLoading(true);
      setError(null);
      setTrackingData(null);

      // If it looks like a tracking code (e.g. CP...)
      if (query.toUpperCase().startsWith('CP') || query.length >= 10) {
        const res = await shippingService.trackParcel(query);
        setTrackingData(res);
      } else {
        // Try looking up by order ID
        const res = await shippingService.getCustomerTracking(query);
        setTrackingData(res);
      }
    } catch (err: any) {
      console.error('Tracking lookup error:', err);
      setError(
        'Unable to find live tracking details for this reference. Please check your order or consignment number.'
      );
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/20">
            <Truck className="w-3.5 h-3.5 text-amber-600" />
            CouriersPlease Domestic Tracking
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            Track Your Print Order
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Enter your CouriersPlease consignment number or order number to see live transit scans and delivery progress.
          </p>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8">
          <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Enter Consignment # (e.g. CPWL...) or Order #"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !orderQuery.trim()}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Locating...
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  Track Parcel
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Tracking Results */}
        {trackingData && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Results Header */}
            <div className="bg-slate-900 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider block">
                  Carrier: CouriersPlease Express
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h3 className="text-xl font-bold font-mono text-white">
                    {trackingData.tracking_code}
                  </h3>
                  <button
                    onClick={() => copyCode(trackingData.tracking_code)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Copy tracking number"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {trackingData.status || 'In Transit'}
                </span>
              </div>
            </div>

            {/* Results Body */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* ETA / Info bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {trackingData.status || 'Active Shipment'}
                  </span>
                </div>
                {trackingData.eta && (
                  <div>
                    <span className="text-slate-500 block">Estimated Arrival</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{trackingData.eta}</span>
                  </div>
                )}
                {trackingData.pod && (
                  <div>
                    <span className="text-slate-500 block">Proof of Delivery (POD)</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{trackingData.pod}</span>
                  </div>
                )}
              </div>

              {/* Milestones Vertical Timeline */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Parcel Movement History
                </h4>

                {trackingData.events && trackingData.events.length > 0 ? (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {trackingData.events.map((evt, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-amber-500/20 border-2 border-amber-500 shrink-0" />
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-slate-800">{evt.action}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
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
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600">
                    Consignment booked with CouriersPlease. Live scans will appear here once the courier collects the parcel from our facility.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
