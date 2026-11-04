'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getAuthToken } from '@/utils/storageHelper';
import { AlertCircle, CheckCircle2, Gift, Loader2, Mail, Plus, Send, Tag } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api/v1';
type Offer = {
  id: number;
  name: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  minimum_subtotal?: string | number;
  maximum_discount?: string | number;
  quantity?: number | string;
  product_details?: string;
  status: string;
  usage_count: number;
  usage_limit?: number;
  campaigns_count?: number;
  starts_at?: string;
  ends_at?: string;
};
type Customer = { id: number; name: string; email: string; marketing_consent: boolean };
type MarketingContact = { id: number; name: string; email: string };

export default function AdminCouponsPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ good: boolean; text: string } | null>(null);
  const [offer, setOffer] = useState({
    name: '',
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    minimum_subtotal: '0',
    quantity: '',
    product_details: '',
    maximum_discount: '',
    usage_limit: '',
    starts_at: '',
    hours: '',
  });
  const [campaign, setCampaign] = useState({ offer_id: '', subject: '', headline: '', message: '' });
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [newContact, setNewContact] = useState({ name: '', email: '' });
  const [newContactConsent, setNewContactConsent] = useState(false);
  const [allConsented, setAllConsented] = useState(false);
  const [confirmConsent, setConfirmConsent] = useState(false);

  const headers = useMemo(() => {
    const token = getAuthToken();
    return { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [o, c, m] = await Promise.all([fetch(`${API_URL}/admin/offers`, { headers }), fetch(`${API_URL}/admin/offers/customers`, { headers }), fetch(`${API_URL}/admin/offers/contacts`, { headers })]);
      const oj = await o.json(); const cj = await c.json(); const mj = await m.json();
      if (!o.ok || !c.ok || !m.ok) throw new Error(oj.message || cj.message || mj.message || 'Could not load offers.');
      setOffers(oj.data || []); setCustomers(cj.data || []); setContacts(mj.data || []);
    } catch (e) { setMessage({ good: false, text: e instanceof Error ? e.message : 'Could not load offers.' }); }
    finally { setLoading(false); }
  };

  const addRecipient = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch(`${API_URL}/admin/offers/contacts`, { method: 'POST', headers, body: JSON.stringify({ ...newContact, confirm_consent: newContactConsent }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || Object.values(result.errors || {}).flat().join(' ') || 'Could not add recipient.');
      const saved = result.data as MarketingContact;
      setContacts((current) => [saved, ...current.filter((contact) => contact.id !== saved.id)]);
      setSelectedContactIds((current) => current.includes(saved.id) ? current : [...current, saved.id]);
      setNewContact({ name: '', email: '' }); setNewContactConsent(false);
      setMessage({ good: true, text: `${saved.email} added to recipients and selected for this campaign.` });
    } catch (e) { setMessage({ good: false, text: e instanceof Error ? e.message : 'Could not add recipient.' }); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const createOffer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMessage(null);
    try {
      const hoursNum = Number(offer.hours);
      let calculatedEndsAt: string | null = null;
      if (hoursNum > 0) {
        const baseDate = offer.starts_at ? new Date(offer.starts_at) : new Date();
        const targetDate = new Date(baseDate.getTime() + hoursNum * 3600 * 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        calculatedEndsAt = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;
      }
      const response = await fetch(`${API_URL}/admin/offers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...offer,
          discount_value: Number(offer.discount_value),
          minimum_subtotal: offer.minimum_subtotal ? Number(offer.minimum_subtotal) : 0,
          quantity: offer.quantity ? Number(offer.quantity) : null,
          product_details: offer.product_details?.trim() || null,
          maximum_discount: offer.maximum_discount ? Number(offer.maximum_discount) : null,
          usage_limit: offer.usage_limit ? Number(offer.usage_limit) : null,
          starts_at: offer.starts_at || null,
          ends_at: calculatedEndsAt,
        }),
      });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || Object.values(result.errors || {}).flat().join(' ') || 'Could not create offer.');
      setOffer({
        name: '',
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        minimum_subtotal: '0',
        quantity: '',
        product_details: '',
        maximum_discount: '',
        usage_limit: '',
        starts_at: '',
        hours: '',
      });
      setCampaign((v) => ({ ...v, offer_id: String(result.data.id), subject: `A special offer for you: ${result.data.name}`, headline: result.data.name }));
      setMessage({ good: true, text: `Offer ${result.data.code} created. Choose recipients and prepare the email below.` }); await load();
    } catch (e) { setMessage({ good: false, text: e instanceof Error ? e.message : 'Could not create offer.' }); }
    finally { setBusy(false); }
  };

  const sendCampaign = async () => {
    if (!campaign.offer_id || !confirmConsent || (!allConsented && selected.length + selectedContactIds.length === 0)) return;
    if (!window.confirm(`Send this offer email to ${allConsented ? 'all opted-in customers and added recipients' : `${selected.length + selectedContactIds.length} selected recipients`}?`)) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`${API_URL}/admin/offers/${campaign.offer_id}/campaign`, { method: 'POST', headers, body: JSON.stringify({ ...campaign, customer_ids: allConsented ? [] : selected, contact_ids: allConsented ? [] : selectedContactIds, all_consented: allConsented, confirm_consent: true }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || Object.values(result.errors || {}).flat().join(' ') || 'Campaign failed.');
      setMessage({ good: true, text: result.message || 'Campaign sent.' }); setSelected([]); setSelectedContactIds([]); setAllConsented(false); setConfirmConsent(false); await load();
    } catch (e) { setMessage({ good: false, text: e instanceof Error ? e.message : 'Campaign failed.' }); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
    <div className="mx-auto max-w-6xl space-y-6">
      <header><div className="flex items-center gap-3"><div className="rounded-xl bg-violet-100 p-2 text-violet-700"><Gift size={22} /></div><div><h1 className="text-2xl font-bold">Offers & Promotions</h1><p className="text-sm text-slate-500">Create discount codes and email opted-in customers.</p></div></div></header>
      {message && <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${message.good ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message.good ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />} {message.text}</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={createOffer} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Tag size={18} /> Design offer</h2>
          <label className="block text-sm">Offer name<input required maxLength={120} value={offer.name} onChange={e => setOffer({ ...offer, name: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" placeholder="Spring print sale" /></label>
          <label className="block text-sm">Discount code<input required maxLength={40} value={offer.code} onChange={e => setOffer({ ...offer, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} className="mt-1 w-full rounded-lg border p-2.5 font-mono" placeholder="SPRING15" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm">Type<select value={offer.discount_type} onChange={e => setOffer({ ...offer, discount_type: e.target.value as 'percentage' | 'fixed' })} className="mt-1 w-full rounded-lg border p-2.5"><option value="percentage">Percent off</option><option value="fixed">AUD off</option></select></label><label className="text-sm">Value<input required type="number" min="0.01" step="0.01" value={offer.discount_value} onChange={e => setOffer({ ...offer, discount_value: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" /></label></div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Cost (AUD)
              <input
                type="number"
                min="0"
                step="0.01"
                value={offer.minimum_subtotal}
                onChange={e => setOffer({ ...offer, minimum_subtotal: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2.5"
                placeholder="0.00"
              />
            </label>
            <label className="text-sm">
              Qty (optional)
              <input
                type="number"
                min="1"
                step="1"
                value={offer.quantity}
                onChange={e => setOffer({ ...offer, quantity: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2.5"
                placeholder="e.g. 500"
              />
            </label>
          </div>
          <label className="block text-sm">
            Product details (optional)
            <textarea
              rows={2}
              maxLength={1000}
              value={offer.product_details}
              onChange={e => setOffer({ ...offer, product_details: e.target.value })}
              className="mt-1 w-full rounded-lg border p-2.5"
              placeholder="e.g. 450gsm Heavy Artboard, Double Sided, Matt Celloglaze"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Starts (optional)
              <input
                type="datetime-local"
                value={offer.starts_at}
                onChange={e => setOffer({ ...offer, starts_at: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2.5"
              />
            </label>
            <label className="text-sm">
              Add hours (optional)
              <input
                type="number"
                min="1"
                step="1"
                value={offer.hours}
                onChange={e => setOffer({ ...offer, hours: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2.5"
                placeholder="e.g. 24"
              />
              {Number(offer.hours) > 0 ? (
                <span className="mt-1 block text-[11px] text-slate-500">
                  Expires in {offer.hours}h ({(() => {
                    const baseDate = offer.starts_at ? new Date(offer.starts_at) : new Date();
                    const targetDate = new Date(baseDate.getTime() + Number(offer.hours) * 3600 * 1000);
                    return targetDate.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                  })()})
                </span>
              ) : null}
            </label>
          </div>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"><Plus size={17} />Design offer</button>
        </form>

        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Mail size={18} /> Promotional email</h2>
          <label className="block text-sm">Offer<select value={campaign.offer_id} onChange={e => setCampaign({ ...campaign, offer_id: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5"><option value="">Choose an offer</option>{offers.map(o => <option key={o.id} value={o.id}>{o.name} · {o.code}</option>)}</select></label>
          <label className="block text-sm">Email subject<input maxLength={180} value={campaign.subject} onChange={e => setCampaign({ ...campaign, subject: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" placeholder="A special offer for you" /></label>
          <label className="block text-sm">Headline<input maxLength={180} value={campaign.headline} onChange={e => setCampaign({ ...campaign, headline: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" /></label>
          <label className="block text-sm">Message<textarea maxLength={5000} rows={4} value={campaign.message} onChange={e => setCampaign({ ...campaign, message: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" placeholder="Tell customers about the offer and its terms." /></label>
          <div className="rounded-xl bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>Who should receive this email?</span><span className="text-slate-500">{allConsented ? `${customers.filter(c => c.marketing_consent).length + contacts.length} opted in` : `${selected.length + selectedContactIds.length} selected`}</span></div>
            <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={allConsented} onChange={e => { setAllConsented(e.target.checked); setSelected([]); setSelectedContactIds([]) }} />Send to all customers who opted in</label>
            {!allConsented && <>
              <div className="max-h-52 overflow-auto rounded-lg border bg-white">{loading ? <div className="p-3 text-xs text-slate-500">Loading customers…</div> : <>
                {customers.map(c => <label key={`user-${c.id}`} className="flex items-center gap-2 border-b px-3 py-2 text-xs last:border-0"><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(v => e.target.checked ? [...v, c.id] : v.filter(id => id !== c.id))} /><span className="min-w-0"><span className="block font-medium">{c.name}</span><span className="text-slate-500">{c.email}</span></span><span className={`ml-auto shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${c.marketing_consent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{c.marketing_consent ? 'Opted in' : 'Confirm consent'}</span></label>)}
                {contacts.map(c => <label key={`contact-${c.id}`} className="flex items-center gap-2 border-b px-3 py-2 text-xs last:border-0"><input type="checkbox" checked={selectedContactIds.includes(c.id)} onChange={e => setSelectedContactIds(v => e.target.checked ? [...v, c.id] : v.filter(id => id !== c.id))} /><span className="min-w-0"><span className="block font-medium">{c.name}</span><span className="text-slate-500">{c.email}</span></span><span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">Added recipient</span></label>)}
                {!customers.length && !contacts.length && <div className="p-3 text-xs text-slate-600">No email recipients yet. Add someone below.</div>}
              </>}</div>
              <form onSubmit={addRecipient} className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-white p-3"><p className="text-xs font-bold text-slate-800">Add a new email recipient</p><div className="grid gap-2 sm:grid-cols-2"><input required maxLength={120} value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} placeholder="Customer name" className="rounded-lg border p-2 text-xs" /><input required type="email" maxLength={255} value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} placeholder="customer@example.com" className="rounded-lg border p-2 text-xs" /></div><label className="flex items-start gap-2 text-[11px] leading-4 text-slate-600"><input type="checkbox" required checked={newContactConsent} onChange={e => setNewContactConsent(e.target.checked)} className="mt-0.5" />I have permission to send promotional emails to this address.</label><button disabled={busy || !newContactConsent} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Add and select recipient</button></form>
            </>}
          </div>
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={confirmConsent} onChange={e => setConfirmConsent(e.target.checked)} className="mt-1" />I confirm the selected customers gave permission to receive promotional emails. Their consent will be saved. Unsubscribed customers are excluded.</label>
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs text-violet-900"><strong>Email preview</strong><div className="mt-1 text-sm font-bold">{campaign.headline || 'Your offer headline'}</div><p className="mt-1 whitespace-pre-wrap">{campaign.message || 'Your promotional message appears here.'}</p><div className="mt-2 font-mono">Code: {offers.find(o => String(o.id) === campaign.offer_id)?.code || '—'} · Includes unsubscribe link</div></div>
          <button type="button" onClick={sendCampaign} disabled={busy || !campaign.offer_id || !campaign.subject.trim() || !campaign.headline.trim() || !campaign.message.trim() || !confirmConsent || (!allConsented && selected.length + selectedContactIds.length === 0)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}Send campaign</button>
          <p className="text-[11px] text-slate-500">Emails send immediately. Recipients must have opted in. Each email includes an unsubscribe link.</p>
        </section>
      </div>
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">Offers</h2>{loading ? <Loader2 className="animate-spin text-slate-400" /> : offers.length === 0 ? <p className="text-sm text-slate-500">No offers yet. Create your first discount code above.</p> : <div className="divide-y">{offers.map(o => <div key={o.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><span className="font-semibold">{o.name}</span><code className="rounded bg-slate-100 px-2 py-1">{o.code}</code><span>{o.discount_type === 'percentage' ? `${o.discount_value}% off` : `${o.discount_value} off`}</span>{o.minimum_subtotal && Number(o.minimum_subtotal) > 0 ? <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Cost: ${o.minimum_subtotal}</span> : null}{o.quantity ? <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Qty: {o.quantity}</span> : null}{o.product_details ? <span className="max-w-xs truncate rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-500" title={o.product_details}>{o.product_details}</span> : null}<span className="ml-auto text-slate-500">{o.usage_count}{o.usage_limit ? ` / ${o.usage_limit}` : ''} redemptions · {o.campaigns_count || 0} campaigns · {o.status}</span></div>)}</div>}</section>
    </div>
  </main>;
}
