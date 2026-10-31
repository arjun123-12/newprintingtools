'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ReceiptText, ShieldCheck, Plus } from 'lucide-react';
import QuoteManager from '../enquiries/[id]/QuoteManager';

export default function AdminQuotesPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto">
      {/* Top Breadcrumb & Workflow Status */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Back to Orders"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
              <span>Sales</span>
              <span className="text-slate-600">/</span>
              <span>Quotes</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Create and email formal tax quotes with itemized pricing, custom specifications, and Australian GST.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            10% GST Compliant
          </span>
        </div>
      </div>

      {/* Main Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <ReceiptText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Create and send a quote directly to any customer, with or without an enquiry.
            </p>
          </div>
        </div>
      </div>

      <QuoteManager standalone />
    </div>
  );
}
