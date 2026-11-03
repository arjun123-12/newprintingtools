'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Mic, MicOff, Send, Sparkles, X } from 'lucide-react';
import { apiClient } from '@/services/api/client';
import { manualOrderService } from '@/services/admin/manualOrderService';

type ProductMatch = { id: string; name: string; sku: string; base_price?: string | number | null; sale_price?: string | number | null };
type DraftItem = { product_name: string; product_id: string; quantity: number; specifications: string; unit_price_ex_gst: string; matches: ProductMatch[] };
type CustomerMatch = { id: number; name: string; email: string; phone?: string; company_name?: string };
type AssistantDraft = {
  action: 'quote' | 'order' | 'unknown';
  customer: { name: string; email: string; company_name: string; phone: string; matches: CustomerMatch[] };
  items: DraftItem[];
  delivery_method: string;
  delivery_address: string;
  customer_notes: string;
  internal_notes: string;
  send_to_customer: boolean;
  clarification: string;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount || 0);

export default function AdminVoiceAssistantPopup({ onClose }: { onClose: () => void }) {
  const [command, setCommand] = useState('');
  const [language, setLanguage] = useState('en-AU');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [totals, setTotals] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const updateItem = (index: number, updates: Partial<DraftItem>) => {
    setDraft((current) => current ? ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item) }) : current);
    setTotals(null);
  };

  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Use Chrome or type the command below.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const spoken = Array.from(event.results as ArrayLike<any>).map((result: any) => result[0]?.transcript || '').join(' ').trim();
      if (spoken) setCommand((previous) => `${previous} ${spoken}`.trim());
    };
    recognition.onerror = (event: any) => setError(event.error === 'not-allowed' ? 'Allow microphone access in your browser settings, then try again.' : 'Could not hear that clearly. You can type the command instead.');
    recognition.onend = () => setListening(false);
    setError('');
    setListening(true);
    recognition.start();
  };

  const interpretCommand = async () => {
    setBusy(true); setError(''); setSuccess(''); setDraft(null); setTotals(null);
    try {
      const response = await apiClient.post('/admin/assistant/interpret', { command });
      const parsed = response.data?.data;
      const customers = parsed.customer?.matches || [];
      const firstCustomer = customers.find((customer: CustomerMatch) => customer.email?.toLowerCase() === parsed.customer?.email?.toLowerCase()) || (customers.length === 1 ? customers[0] : null);
      const items: DraftItem[] = (parsed.items || []).map((item: any) => {
        const matches: ProductMatch[] = item.matches || [];
        const match = matches.find((product) => product.name.toLowerCase() === String(item.product_name || '').toLowerCase()) || (matches.length === 1 ? matches[0] : null);
        const referencePrice = match?.sale_price ?? match?.base_price;
        return {
          product_name: match?.name || item.product_name || '',
          product_id: match?.id || '',
          quantity: Number(item.quantity) || 1,
          specifications: item.specifications || '',
          unit_price_ex_gst: item.unit_price_ex_gst !== null && item.unit_price_ex_gst !== undefined ? String(item.unit_price_ex_gst) : referencePrice !== null && referencePrice !== undefined ? String(referencePrice) : '',
          matches,
        };
      });
      setDraft({
        action: parsed.action,
        customer: {
          name: firstCustomer?.name || parsed.customer?.name || '',
          email: firstCustomer?.email || parsed.customer?.email || '',
          company_name: firstCustomer?.company_name || parsed.customer?.company_name || '',
          phone: firstCustomer?.phone || parsed.customer?.phone || '',
          matches: customers,
        },
        items,
        delivery_method: parsed.delivery_method || 'Standard delivery (Free)',
        delivery_address: parsed.delivery_address || (/pickup/i.test(parsed.delivery_method || '') ? 'Store pickup' : ''),
        customer_notes: parsed.customer_notes || '',
        internal_notes: parsed.internal_notes || '',
        send_to_customer: parsed.action === 'quote' || Boolean(parsed.send_to_customer),
        clarification: parsed.clarification || '',
      });
      if (parsed.action === 'unknown') setError('Assistant could not tell whether you want a quote or an order. Please make that explicit and interpret again.');
      if (parsed.clarification) setError(parsed.clarification);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not understand the command. Try saying the action, customer, product, quantity, and any specifications.');
    } finally { setBusy(false); }
  };

  const calculatePreview = async () => {
    if (!draft) return;
    setBusy(true); setError('');
    try {
      const items = draft.items.map((item) => ({ product_id: item.product_id || undefined, product_name: item.product_name, quantity: item.quantity, unit_price_ex_gst: Number(item.unit_price_ex_gst), specifications: item.specifications }));
      if (draft.action === 'order') {
        const result = await manualOrderService.calculateTotals({ items, delivery_method: draft.delivery_method });
        setTotals(result.data);
      } else {
        const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price_ex_gst, 0);
        const shipping = /express/i.test(draft.delivery_method) ? 15 : 0;
        setTotals({ subtotal_ex_gst: subtotal, shipping_fee_inc_gst: shipping, gst_amount: (subtotal + shipping) * 0.1, total_inc_gst: subtotal + shipping + (subtotal + shipping) * 0.1 });
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not calculate the preview. Check product quantities and prices.');
    } finally { setBusy(false); }
  };

  const confirmCreate = async () => {
    if (!draft || !totals) return;
    if (!draft.customer.email || !draft.items.length || draft.items.some((item) => !item.product_name || !item.quantity || item.unit_price_ex_gst === '')) {
      setError('Add the customer email, product, quantity, and unit price before creating.'); return;
    }
    if (draft.action === 'order' && !draft.delivery_address.trim()) { setError('Delivery address is required to create an order.'); return; }
    const actionLabel = draft.action === 'quote' ? (draft.send_to_customer ? 'create and email this quote' : 'create and email this quote') : (draft.send_to_customer ? 'create this order and send it to the customer for approval' : 'save this order as a draft');
    if (!window.confirm(`Confirm: ${actionLabel} to ${draft.customer.name || draft.customer.email} for ${formatCurrency(Number(totals.total_inc_gst))}?`)) return;

    setBusy(true); setError(''); setSuccess('');
    const items = draft.items.map((item) => ({ product_id: item.product_id || null, product_name: item.product_name, quantity: Number(item.quantity), unit_price_ex_gst: Number(item.unit_price_ex_gst), specifications: item.specifications, options: item.specifications ? { specifications: item.specifications } : {} }));
    let savedOrderMessage = '';
    try {
      if (draft.action === 'quote') {
        const response = await apiClient.post('/admin/quotes', {
          recipient_name: draft.customer.name,
          recipient_email: draft.customer.email,
          customer_phone: draft.customer.phone,
          company_name: draft.customer.company_name,
          items,
          delivery_method: draft.delivery_method,
          delivery_address: draft.delivery_address,
          customer_notes: draft.customer_notes,
        });
        setSuccess(`${response.data?.message || 'Quote created.'} Quote number: ${response.data?.data?.quote_number || 'created'}.`);
      } else {
        const response = await manualOrderService.createOrder({
          customer_id: draft.customer.matches.find((customer) => customer.email.toLowerCase() === draft.customer.email.toLowerCase())?.id,
          customer_name: draft.customer.name,
          customer_email: draft.customer.email,
          customer_phone: draft.customer.phone,
          company_name: draft.customer.company_name,
          delivery_method: draft.delivery_method,
          delivery_address: draft.delivery_address,
          customer_notes: draft.customer_notes,
          internal_notes: draft.internal_notes,
          items,
        });
        const orderId = response.data?.id || response.data?.data?.id;
        savedOrderMessage = `Order draft ${response.data?.data?.order_number || orderId || ''} created.`;
        let message = savedOrderMessage;
        if (draft.send_to_customer && orderId) {
          const sent = await manualOrderService.sendForApproval(orderId);
          message = sent.message || `Order ${response.data?.data?.order_number || ''} sent to customer for approval.`;
        }
        setSuccess(message);
      }
      setDraft(null); setTotals(null); setCommand('');
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.message || 'Please check the details and try again.';
      if (savedOrderMessage) {
        setSuccess(savedOrderMessage);
        setError(`The order draft was saved, but sending it for customer approval failed: ${detail} You can retry from the order page.`);
        setDraft(null); setTotals(null); setCommand('');
      } else {
        setError(`Could not create this quote/order. ${detail}`);
      }
    } finally { setBusy(false); }
  };

  const chooseCustomer = (email: string) => {
    const customer = draft?.customer.matches.find((match) => match.email === email);
    if (!customer) return;
    setDraft((current) => current ? ({ ...current, customer: { ...current.customer, name: customer.name, email: customer.email, phone: customer.phone || '', company_name: customer.company_name || '' } }) : current);
  };

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="admin-assistant-title" className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 text-slate-900 shadow-2xl sm:h-[min(92dvh,900px)] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-slate-200">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Sparkles className="h-5 w-5"/></div><div className="min-w-0"><h1 id="admin-assistant-title" className="truncate text-base font-bold">Voice & Command Assistant</h1><p className="text-xs text-slate-500">Create a quote or order</p></div></div>
        <button type="button" onClick={onClose} className="ml-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close assistant"><X className="h-5 w-5"/></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"><div className="mx-auto max-w-2xl space-y-5">
      <p className="text-sm text-slate-500">Speak or type naturally. Review the extracted details and price before you confirm.</p>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="assistant-command" className="text-sm font-semibold">Your command</label>
        <textarea id="assistant-command" value={command} onChange={(event) => setCommand(event.target.value)} rows={4} placeholder="Example: Create a quote for Alex at alex@example.com, 500 A5 flyers, double-sided, standard delivery." className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={startVoice} disabled={listening || busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{listening ? <MicOff className="h-4 w-4 text-rose-500"/> : <Mic className="h-4 w-4"/>}{listening ? 'Listening…' : 'Speak command'}</button>
          <select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Voice recognition language"><option value="en-AU">English (Australia)</option><option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option></select>
          <button type="button" onClick={interpretCommand} disabled={busy || command.trim().length < 3} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">{busy && !totals ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>}Understand command</button>
        </div>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><span>{error}</span></div>}
      {success && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/><span>{success}</span></div>}

      {draft && <section className="space-y-5 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-sky-700">Review before creating</p><h2 className="mt-1 text-lg font-bold">{draft.action === 'quote' ? 'Customer quote' : draft.action === 'order' ? 'Manual order' : 'Choose quote or order'}</h2></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Not sent yet</span></div>
        {draft.action !== 'unknown' && <>
          <div className="grid gap-3 md:grid-cols-2">
            <div>{draft.customer.matches.length > 0 && <><label className="mb-1 block text-xs font-semibold text-slate-600">Matched customer</label><select value={draft.customer.email} onChange={(event) => chooseCustomer(event.target.value)} className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Choose a customer…</option>{draft.customer.matches.map((customer) => <option key={customer.id} value={customer.email}>{customer.name} · {customer.email}</option>)}</select></>}
              <label className="mb-1 block text-xs font-semibold text-slate-600">Customer name</label><input value={draft.customer.name} onChange={(event) => setDraft({ ...draft, customer: { ...draft.customer, name: event.target.value } })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Customer name"/></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Customer email</label><input type="email" value={draft.customer.email} onChange={(event) => setDraft({ ...draft, customer: { ...draft.customer, email: event.target.value } })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="customer@example.com"/></div>
          </div>
          <div className="space-y-3"><h3 className="text-sm font-bold">Products and prices</h3>{draft.items.map((item, index) => <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
            <div className="md:col-span-4"><label className="mb-1 block text-[11px] font-semibold text-slate-500">Product</label>{item.matches.length > 0 ? <select value={item.product_id} onChange={(event) => { const product = item.matches.find((match) => match.id === event.target.value); updateItem(index, { product_id: product?.id || '', product_name: product?.name || '', unit_price_ex_gst: String(product?.sale_price ?? product?.base_price ?? item.unit_price_ex_gst) }); }} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">{item.matches.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select> : <input value={item.product_name} onChange={(event) => updateItem(index, { product_name: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"/>}</div>
            <div className="md:col-span-2"><label className="mb-1 block text-[11px] font-semibold text-slate-500">Quantity</label><input type="number" min={1} value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"/></div>
            <div className="md:col-span-3"><label className="mb-1 block text-[11px] font-semibold text-slate-500">Unit price ex GST · confirm</label><input type="number" min={0} step="0.01" value={item.unit_price_ex_gst} onChange={(event) => updateItem(index, { unit_price_ex_gst: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" placeholder="Enter price"/></div>
            <div className="md:col-span-3"><label className="mb-1 block text-[11px] font-semibold text-slate-500">Specs</label><input value={item.specifications} onChange={(event) => updateItem(index, { specifications: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" placeholder="Size, sides, stock…"/></div>
          </div>)}</div>
          <div className="grid gap-3 md:grid-cols-2"><div><label className="mb-1 block text-xs font-semibold text-slate-600">Delivery method</label><input value={draft.delivery_method} onChange={(event) => { setDraft({ ...draft, delivery_method: event.target.value }); setTotals(null); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></div><div><label className="mb-1 block text-xs font-semibold text-slate-600">Delivery address {draft.action === 'order' ? '(required)' : ''}</label><input value={draft.delivery_address} onChange={(event) => setDraft({ ...draft, delivery_address: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Street, suburb, state, postcode"/></div></div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={calculatePreview} disabled={busy || draft.items.length === 0 || draft.items.some((item) => item.unit_price_ex_gst === '')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{busy ? 'Calculating…' : 'Calculate preview'}</button>
            {totals && <div className="text-right text-sm"><p className="text-slate-500">Subtotal {formatCurrency(Number(totals.subtotal_ex_gst))} · GST {formatCurrency(Number(totals.gst_amount))}</p><p className="font-bold">Total {formatCurrency(Number(totals.total_inc_gst))}</p></div>}</div>
          {totals && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">{draft.action === 'quote' ? <p className="text-xs text-slate-700">The quote email will be sent to the customer after your confirmation.</p> : <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={draft.send_to_customer} onChange={(event) => setDraft({ ...draft, send_to_customer: event.target.checked })}/>Send order for customer approval after creating</label>}<button type="button" onClick={confirmCreate} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"><Send className="h-4 w-4"/>{busy ? 'Working…' : draft.action === 'quote' ? 'Confirm & Email Quote' : draft.send_to_customer ? 'Confirm & Send Order' : 'Confirm & Save Draft'}</button></div>}
          {draft.action === 'quote' && <p className="text-xs text-slate-500">Quote creation sends the customer email through the existing quote system after you confirm.</p>}
        </>}
      </section>}
      </div></div>
    </section>
  </div>;
}
