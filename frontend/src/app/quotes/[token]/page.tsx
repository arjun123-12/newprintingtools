'use client';

import { use, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, UploadCloud, XCircle } from 'lucide-react';
import { apiClient } from '@/services/api/client';

type Quote = {
  quote_number: string; status: string; customer_name?: string;
  items: Array<{ product_name: string; quantity: number; unit_price_ex_gst: number; line_total_inc_gst: number; options?: { specifications?: string } }>;
  delivery_method?: string; delivery_address?: string; terms?: string; currency: string;
  subtotal_ex_gst: number; shipping_fee_inc_gst: number; gst_amount: number; total_inc_gst: number; expires_at?: string;
  order?: { order_number: string; artwork_files: Array<{ id: string; file_name: string }> } | null;
};

export default function CustomerQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const loadQuote = async () => {
    setError('');
    try { const response = await apiClient.get(`/quotes/${token}`); setQuote(response.data.data); }
    catch (err: any) { setError(err.response?.data?.message || 'This quote link is invalid or unavailable.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadQuote(); }, [token]);
  const respond = async (decision: 'accept' | 'decline') => {
    setBusy(true); setError(''); setNotice('');
    try { const response = await apiClient.post(`/quotes/${token}/respond`, { decision }); setQuote(response.data.data); setNotice(response.data.message); }
    catch (err: any) { setError(err.response?.data?.message || 'Could not submit your response.'); await loadQuote(); }
    finally { setBusy(false); }
  };
  const uploadArtwork = async (event: React.FormEvent) => {
    event.preventDefault(); if (!files.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const body = new FormData(); files.forEach(file => body.append('files[]', file));
      const response = await apiClient.post(`/quotes/${token}/artwork`, body);
      setQuote(response.data.data); setFiles([]); setNotice(response.data.message);
      const input = document.getElementById('quote-artwork-files') as HTMLInputElement | null; if (input) input.value = '';
    } catch (err: any) { setError(err.response?.data?.message || 'Artwork upload failed.'); }
    finally { setBusy(false); }
  };
  const money = (amount: number) => `${quote?.currency || 'AUD'} ${Number(amount || 0).toFixed(2)}`;
  if (loading) return <main className="min-h-screen grid place-items-center bg-slate-50"><Loader2 className="animate-spin text-sky-700"/></main>;
  if (!quote) return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><div className="max-w-lg rounded-2xl bg-white p-8 text-center shadow"><XCircle className="mx-auto mb-3 text-rose-600"/><h1 className="text-xl font-bold">Quote unavailable</h1><p className="mt-2 text-slate-600">{error || 'Please contact our team for help.'}</p></div></main>;

  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><div className="mx-auto max-w-3xl space-y-5">
    <header className="rounded-2xl bg-slate-950 p-6 text-white"><p className="text-sm font-semibold text-sky-300">Erry Imprints</p><h1 className="mt-2 text-2xl font-bold">Your quote</h1><p className="mt-1 text-sm text-slate-300">{quote.quote_number}{quote.customer_name ? ` · Prepared for ${quote.customer_name}` : ''}</p></header>
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Quote details</h2><p className="mt-1 text-sm text-slate-500">Status: <span className="font-semibold capitalize">{quote.status}</span></p></div>{quote.expires_at && quote.status === 'sent' && <p className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 size={14}/> Valid until {new Date(quote.expires_at).toLocaleDateString()}</p>}</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Item</th><th className="py-3">Qty</th><th className="py-3">Unit (ex GST)</th><th className="py-3 text-right">Line total</th></tr></thead><tbody>{quote.items?.map((item, i) => <tr className="border-b align-top" key={i}><td className="py-3 pr-3"><b>{item.product_name}</b>{item.options?.specifications && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.options.specifications}</p>}</td><td className="py-3">{Number(item.quantity).toLocaleString()}</td><td className="py-3">{money(item.unit_price_ex_gst)}</td><td className="py-3 text-right">{money(item.line_total_inc_gst)}</td></tr>)}</tbody></table></div>
      <div className="ml-auto mt-5 max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal (ex GST)</span><span>{money(quote.subtotal_ex_gst)}</span></div><div className="flex justify-between"><span>Delivery · {quote.delivery_method || 'Standard'} (ex GST)</span><span>{money(quote.shipping_fee_inc_gst)}</span></div><div className="flex justify-between"><span>GST</span><span>{money(quote.gst_amount)}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{money(quote.total_inc_gst)}</span></div></div>
      {(quote.delivery_address || quote.terms) && <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">{quote.delivery_address && <p><b>Delivery address:</b> {quote.delivery_address}</p>}{quote.terms && <p className="whitespace-pre-wrap"><b>Terms:</b> {quote.terms}</p>}</div>}
      {quote.status === 'sent' && <div className="mt-6 flex flex-wrap gap-3 border-t pt-5"><button disabled={busy} onClick={() => respond('accept')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50"><CheckCircle2 size={18}/> Accept quote</button><button disabled={busy} onClick={() => respond('decline')} className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 disabled:opacity-50">Decline</button></div>}
      {quote.status === 'expired' && <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This quote has expired. Please contact us for an updated quote.</p>}
      {quote.status === 'declined' && <p className="mt-5 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">This quote was declined. Contact our team if you would like to discuss it.</p>}
    </section>
    {quote.status === 'converted' && quote.order && <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-bold text-emerald-800">Order {quote.order.order_number} created</h2><p className="mt-1 text-sm text-slate-600">Your accepted quote is now an order. Upload your print-ready artwork below; our team will prepare a proof for your approval.</p>
      {!!quote.order.artwork_files?.length && <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="mb-2 text-sm font-semibold">Uploaded artwork</p><ul className="list-inside list-disc text-sm text-slate-600">{quote.order.artwork_files.map(file => <li key={file.id}>{file.file_name}</li>)}</ul></div>}
      <form onSubmit={uploadArtwork} className="mt-5 space-y-3"><label htmlFor="quote-artwork-files" className="block text-sm font-semibold">Artwork files <span className="font-normal text-slate-500">(PDF, PNG, JPG, WebP, AI, EPS, PSD, TIFF; max 25 MB each)</span></label><input id="quote-artwork-files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.ai,.eps,.psd,.tif,.tiff" onChange={e => setFiles(Array.from(e.target.files || []))} className="block w-full rounded-lg border border-slate-300 p-3 text-sm"/><button disabled={busy || !files.length} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={17} className="animate-spin"/> : <UploadCloud size={17}/>} Upload artwork</button></form>
    </section>}
    <p className="text-center text-xs text-slate-500">Questions? Reply to the quote email and our team will help.</p>
  </div></main>;
}
