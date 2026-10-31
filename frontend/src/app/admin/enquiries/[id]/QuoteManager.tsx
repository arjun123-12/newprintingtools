'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/services/api/client';
import { Copy, Loader2, Plus, Send, Trash2 } from 'lucide-react';

type QuoteItem = { product_name: string; product_id?: string | null; quantity: number; unit_price_ex_gst: number; specifications: string };
type QuoteRecord = { id: number; quote_number: string; recipient_name: string | null; recipient_email: string; enquiry_name?: string | null; status: string; total_inc_gst: number; currency: string; expires_at: string | null; order_id: string | null };

type EnquiryQuoteContext = { id: number; name: string; email: string; product_id?: string | null; product_name?: string | null; quantity?: number | null; delivery_location?: string | null; specifications?: Record<string, unknown> | null };

export default function QuoteManager({ enquiry, standalone = false }: { enquiry?: EnquiryQuoteContext; standalone?: boolean }) {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [quoteUrl, setQuoteUrl] = useState('');
  const [recipientName, setRecipientName] = useState(enquiry?.name || '');
  const [recipientEmail, setRecipientEmail] = useState(enquiry?.email || '');
  const [items, setItems] = useState<QuoteItem[]>([{ product_name: enquiry?.product_name || '', product_id: enquiry?.product_id, quantity: enquiry?.quantity || 1, unit_price_ex_gst: 0, specifications: Object.entries(enquiry?.specifications || {}).map(([k, v]) => `${k}: ${v}`).join(', ') }]);
  const [deliveryMethod, setDeliveryMethod] = useState('Standard delivery');
  const [deliveryAddress, setDeliveryAddress] = useState(enquiry?.delivery_location || '');
  const [shippingFee, setShippingFee] = useState(0);
  const [terms, setTerms] = useState('');
  const [validDays, setValidDays] = useState(14);

  const loadQuotes = useCallback(async () => {
    try {
      const response = await apiClient.get(standalone ? '/admin/quotes' : `/admin/enquiries/${enquiry?.id}/quotes`);
      if (response.data?.success) setQuotes(response.data.data || []);
    } catch { setMessage('Could not load quote history.'); }
    finally { setLoading(false); }
  }, [enquiry?.id, standalone]);
  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  const updateItem = (index: number, patch: Partial<QuoteItem>) => setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  const sendQuote = async (event: React.FormEvent) => {
    event.preventDefault(); setSending(true); setMessage(''); setQuoteUrl('');
    try {
      const url = standalone ? '/admin/quotes' : `/admin/enquiries/${enquiry?.id}/quotes`;
      const response = await apiClient.post(url, { recipient_name: recipientName, recipient_email: recipientEmail, items, delivery_method: deliveryMethod, delivery_address: deliveryAddress, shipping_fee: shippingFee, terms, valid_for_days: validDays });
      const data = response.data?.data;
      setMessage(response.data?.message || 'Quote created.');
      setQuoteUrl(data?.quote_url || '');
      await loadQuotes();
    } catch (error: any) { setMessage(error.response?.data?.message || 'Could not send quote.'); }
    finally { setSending(false); }
  };
  const resendQuote = async (quoteId: number) => {
    setResendingId(quoteId); setMessage(''); setQuoteUrl('');
    try {
      const response = await apiClient.post(`/admin/quotes/${quoteId}/resend`);
      setMessage(response.data?.message || 'Quote email sent again.');
      setQuoteUrl(response.data?.data?.quote_url || '');
    } catch (error: any) { setMessage(error.response?.data?.message || 'Could not resend quote email.'); }
    finally { setResendingId(null); }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900';
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
    <div><h3 className="font-bold text-slate-900">{standalone ? 'Create a customer quote' : 'Customer Quotes'}</h3><p className="mt-1 text-xs text-slate-500">Send a quote first. An order is created only after the customer accepts it.</p></div>
    {message && <div className="rounded-lg bg-sky-50 p-3 text-xs text-sky-800">{message}{quoteUrl && <div className="mt-2 flex flex-wrap items-center gap-2"><a className="break-all font-semibold underline" href={quoteUrl} target="_blank" rel="noreferrer">Open quote</a><button type="button" onClick={() => navigator.clipboard.writeText(quoteUrl)} className="inline-flex items-center gap-1 rounded border px-2 py-1"><Copy size={13}/> Copy link</button></div>}</div>}
    <form onSubmit={sendQuote} className="space-y-3">
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Send to name<input maxLength={255} className={inputClass} value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Customer name"/></label><label className="text-xs text-slate-500">Send quote to email<input required type="email" maxLength={255} className={inputClass} value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="customer@example.com"/></label></div>
      {items.map((item, index) => <div key={index} className="rounded-xl border border-slate-200 p-3 space-y-2">
        <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-600">Item {index + 1}</span>{items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} aria-label="Remove item" className="text-rose-600"><Trash2 size={15}/></button>}</div>
        <input required maxLength={255} className={inputClass} placeholder="Product / item name" value={item.product_name} onChange={e => updateItem(index, { product_name: e.target.value })}/>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Quantity<input required min={1} type="number" className={inputClass} value={item.quantity} onChange={e => updateItem(index, { quantity: Number(e.target.value) })}/></label><label className="text-xs text-slate-500">Unit price (AUD, ex GST)<input required min={0} step="0.01" type="number" className={inputClass} value={item.unit_price_ex_gst} onChange={e => updateItem(index, { unit_price_ex_gst: Number(e.target.value) })}/></label></div>
        <textarea maxLength={2000} rows={2} className={inputClass} placeholder="Specifications" value={item.specifications} onChange={e => updateItem(index, { specifications: e.target.value })}/>
      </div>)}
      <button type="button" onClick={() => setItems([...items, { product_name: '', quantity: 1, unit_price_ex_gst: 0, specifications: '' }])} className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700"><Plus size={15}/> Add item</button>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Delivery method<input className={inputClass} value={deliveryMethod} onChange={e => setDeliveryMethod(e.target.value)}/></label><label className="text-xs text-slate-500">Delivery fee (AUD, ex GST)<input min={0} step="0.01" type="number" className={inputClass} value={shippingFee} onChange={e => setShippingFee(Number(e.target.value))}/></label></div>
      <input className={inputClass} placeholder="Delivery address" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}/>
      <div className="grid grid-cols-2 gap-2"><textarea maxLength={5000} rows={2} className={inputClass} placeholder="Quote terms / notes" value={terms} onChange={e => setTerms(e.target.value)}/><label className="text-xs text-slate-500">Valid for (days)<input min={1} max={90} type="number" className={inputClass} value={validDays} onChange={e => setValidDays(Number(e.target.value))}/></label></div>
      <button disabled={sending} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin"/> : <Send size={15}/>} Send quote to {recipientEmail || 'customer email'}</button>
    </form>
    <div className="border-t pt-3"><h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{standalone ? 'Recent quotes' : 'Quote history'}</h4>{loading ? <p className="text-xs text-slate-400">Loading…</p> : quotes.length ? <ul className="space-y-2">{quotes.map(q => <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs"><span><b>{q.quote_number}</b><span className="ml-2 capitalize text-slate-500">{q.status}</span><span className="ml-2 text-slate-500">to {q.recipient_email}</span>{standalone && q.enquiry_name && <span className="ml-2 text-slate-500">· Enquiry: {q.enquiry_name}</span>}{q.order_id && <span className="ml-2 text-emerald-700">Order created</span>}</span><span className="flex items-center gap-2"><b>{q.currency} {Number(q.total_inc_gst).toFixed(2)}</b>{q.status === 'sent' && <button type="button" disabled={resendingId === q.id} onClick={() => resendQuote(q.id)} className="rounded border border-slate-300 px-2 py-1 font-semibold text-sky-700 disabled:opacity-50">{resendingId === q.id ? 'Sending…' : 'Resend email'}</button>}</span></li>)}</ul> : <p className="text-xs text-slate-400">No quotes sent yet.</p>}</div>
  </section>;
}
