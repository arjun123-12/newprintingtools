'use client';

import QuoteManager from '../enquiries/[id]/QuoteManager';

export default function AdminQuotesPage() {
  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
    <div><p className="text-sm font-semibold text-sky-700">Sales</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Quotes</h1><p className="mt-1 text-sm text-slate-500">Create and send a quote directly to any customer, with or without an enquiry.</p></div>
    <QuoteManager standalone />
  </main>;
}
