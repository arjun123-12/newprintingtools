'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, FileImage, Link2, Loader2, MessageCircle, Plus, RefreshCw, Send, UploadCloud, ExternalLink, Camera, Image as ImageIcon } from 'lucide-react';
import { adminDesignQueryService, DesignQuery } from '@/services/adminDesignQueryService';
import { useAuth } from '@/context/AuthContext';
import { canAccessSection, isSuperAdmin } from '@/utils/adminPermissions';

const STATUSES = [
  ['draft', 'Draft'], ['new', 'New'], ['in_progress', 'In Progress'], ['proof_sent', 'Awaiting Feedback'],
  ['revision', 'Revision'], ['approved', 'Approved'], ['completed', 'Completed'], ['cancelled', 'Cancelled'],
];

export default function AdminDesignQueriesPage() {
  const { user } = useAuth();
  const canManageOrders = canAccessSection(user, 'orders');
  const canManagePricing = canAccessSection(user, 'pricing');
  const submittedQueriesOnly = !!user && !isSuperAdmin(user) && user.permissions?.includes('design_queries_submitted_only') === true;
  const [items, setItems] = useState<DesignQuery[]>([]);
  const [selected, setSelected] = useState<DesignQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expiry, setExpiry] = useState(7);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [chatImage, setChatImage] = useState<File | null>(null);
  const [designFee, setDesignFee] = useState('0');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await adminDesignQueryService.list();
      setItems(rows);
      if (selected) {
        const fresh = rows.find((row) => row.id === selected.id);
        if (fresh) setSelected(await adminDesignQueryService.get(fresh.id));
        else setSelected(null);
      }
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Design queries could not be loaded.'); }
    finally { setLoading(false); }
  }, [selected?.id]);

  useEffect(() => { void load(); }, [load]);

  const createLink = async () => {
    setBusy(true); setError(''); setGeneratedUrl('');
    try {
      const created = await adminDesignQueryService.create(expiry);
      setGeneratedUrl(created.client_url);
      await load();
      const row = await adminDesignQueryService.get(created.id);
      setSelected(row);
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Customer link could not be generated.'); }
    finally { setBusy(false); }
  };

  const openQuery = async (id: number) => {
    setSelected(null); setBusy(true); setError('');
    try { setSelected(await adminDesignQueryService.get(id)); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Design query could not be opened.'); }
    finally { setBusy(false); }
  };

  useEffect(() => { if (selected) setDesignFee(String(selected.design_fee ?? 0)); }, [selected?.id, selected?.design_fee]);

  const saveDesignFee = async () => {
    if (!selected) return;
    setBusy(true); setError('');
    try { await adminDesignQueryService.updateFee(selected.id, Number(designFee)); setSelected(await adminDesignQueryService.get(selected.id)); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Design fee could not be saved.'); }
    finally { setBusy(false); }
  };

  const setStatus = async (status: string) => {
    if (!selected) return;
    setBusy(true); setError('');
    try { await adminDesignQueryService.update(selected.id, { status }); setSelected(await adminDesignQueryService.get(selected.id)); await load(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Status could not be updated.'); }
    finally { setBusy(false); }
  };

  const sendMessage = async () => {
    if (!selected || (!message.trim() && !chatImage)) return;
    setBusy(true); setError('');
    try { await adminDesignQueryService.sendMessage(selected.id, message, chatImage); setMessage(''); setChatImage(null); setSelected(await adminDesignQueryService.get(selected.id)); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Message could not be sent.'); }
    finally { setBusy(false); }
  };

  const uploadDesign = async () => {
    if (!selected || !uploadFile) return;
    setBusy(true); setError('');
    try { await adminDesignQueryService.upload(selected.id, uploadFile, message); setUploadFile(null); setMessage(''); setSelected(await adminDesignQueryService.get(selected.id)); await load(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Design could not be uploaded.'); }
    finally { setBusy(false); }
  };

  const visibleFiles = useMemo(() => selected?.files ?? [], [selected?.files]);

  return <main className="min-h-screen bg-slate-50 px-5 py-7 text-slate-900 md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-700">Design workspace</p><h1 className="mt-1 text-3xl font-bold">Design Queries</h1><p className="mt-2 text-sm text-slate-500">Handle customer briefs, revisions and approvals. Business name is shown for project context; personal contact details and pricing stay hidden.</p></div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"><RefreshCw className="h-4 w-4"/>Refresh</button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          {!submittedQueriesOnly && <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-bold">Generate customer link</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Generate a separate private link for each customer. Each link creates its own design brief and proof conversation.</p>
            <label className="mt-4 block text-xs font-semibold text-slate-600">Link expiry
              <select value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm"><option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>
            </label>
            <button disabled={busy} onClick={() => void createLink()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4"/>Generate Private Link</button>
            {generatedUrl && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-800">Customer link ready</p><input readOnly value={generatedUrl} className="mt-2 w-full rounded-lg border bg-white px-2 py-2 text-xs"/><button onClick={() => { void navigator.clipboard.writeText(generatedUrl); setCopied(true); }} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">{copied ? <Check className="h-3.5 w-3.5"/> : <Copy className="h-3.5 w-3.5"/>}{copied ? 'Copied' : 'Copy link'}</button></div>}
          </div>}
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-bold">{submittedQueriesOnly ? 'Submitted customer queries' : 'Query queue'}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{items.length}</span></div>
            <div className="max-h-[65vh] overflow-y-auto">
              {loading ? <div className="p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin"/>Loading…</div> : items.length === 0 ? <p className="p-6 text-sm text-slate-500">{submittedQueriesOnly ? 'No customer-submitted design forms yet.' : 'No design queries yet. Generate a link to get started.'}</p> : items.map((item) => <button key={item.id} onClick={() => void openQuery(item.id)} className={`block w-full border-b px-4 py-3 text-left hover:bg-violet-50 ${selected?.id === item.id ? 'bg-violet-50' : ''}`}><span className="flex items-center justify-between gap-2"><b className="truncate text-sm">{item.product || `Query #${item.id}`}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{(item.status || 'draft').replaceAll('_', ' ')}</span></span><span className="mt-1 block text-xs text-slate-500">DQ-{String(item.id).padStart(4, '0')} · {item.request_type || 'design'}{item.quantity ? ` · Qty ${item.quantity}` : ''}</span></button>)}
            </div>
          </div>
        </aside>

        <section className="min-h-[600px] rounded-2xl border bg-white p-5 shadow-sm md:p-6">
          {!selected ? <div className="flex min-h-[540px] flex-col items-center justify-center text-center text-slate-400"><FileImage className="h-12 w-12"/><h2 className="mt-4 font-bold text-slate-700">Select a design query</h2><p className="mt-1 max-w-sm text-sm">Business name is shown for project context. Personal contact details and pricing stay hidden; design files and the customer conversation appear here.</p>{busy && <Loader2 className="mt-4 h-5 w-5 animate-spin"/>}</div> : <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-700">Design Query DQ-{String(selected.id).padStart(4, '0')}</p><h2 className="mt-1 text-2xl font-bold">{selected.product || 'Design request'}</h2><p className="mt-1 text-sm text-slate-500">Business: {selected.company_name || 'Not provided'}</p>{canManageOrders && selected.linked_order && <div className="mt-3 flex flex-wrap gap-2"><Link href={`/admin/orders/create?orderId=${selected.linked_order.id}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Order {selected.linked_order.order_number} · Set price</Link><Link href={`/admin/orders/${selected.linked_order.id}`} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800">Open order · Send payment link</Link></div>}</div><label className="text-xs font-semibold text-slate-600">Status<select value={selected.status} disabled={busy} onChange={(e) => void setStatus(e.target.value)} className="mt-1 block rounded-lg border bg-white px-3 py-2 text-sm">{STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
            {selected.spin_reward && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-900">Spin reward: {selected.spin_reward.title}</p><p className="mt-1 text-sm text-amber-800">{selected.spin_reward.target_product || selected.product} · {selected.spin_reward.reward_type === 'product_discount' ? `${selected.spin_reward.value}% discount` : selected.spin_reward.reward_type === 'free_product' ? '1 free unit' : `AUD $${Number(selected.spin_reward.value || 0).toFixed(2)}`} · Code {selected.spin_reward.reward_code}</p></div>}
            {canManagePricing && <div className="flex flex-wrap items-end gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4"><label className="text-xs font-bold text-sky-900">Design service fee (AUD $)<input type="number" min="0" step="0.01" value={designFee} onChange={(e) => setDesignFee(e.target.value)} className="mt-1 block w-48 rounded-lg border bg-white px-3 py-2 text-sm"/></label><button disabled={busy} onClick={() => void saveDesignFee()} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white">Save & notify customer</button><span className="text-xs text-sky-800">Customer must accept before final design approval. Current: {selected.design_fee_accepted_at ? 'accepted' : 'awaiting acceptance'}.</span></div>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Business', selected.company_name], ['Quantity', selected.quantity], ['Size', selected.width && selected.height ? `${selected.width} × ${selected.height} ${selected.unit || ''}` : null], ['Print sides', selected.print_sides], ['Requested date', selected.requested_date]].map(([label, value]) => value ? <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div> : null)}</div>
            {(selected.colours || selected.description || selected.additional_notes) && <div className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">Design requirements</h3>{selected.colours && <p className="whitespace-pre-wrap text-sm"><b>Colours:</b> {selected.colours}</p>}{selected.description && <p className="whitespace-pre-wrap text-sm">{selected.description}</p>}{selected.additional_notes && <p className="whitespace-pre-wrap text-sm text-slate-600">{selected.additional_notes}</p>}</div>}
            <div className="space-y-3"><h3 className="font-bold">References and design previews</h3>{visibleFiles.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">No files attached yet.</p> : <div className="grid gap-3 sm:grid-cols-2">{visibleFiles.map((file) => <div key={file.id} className="rounded-xl border p-3">{file.mime_type?.startsWith('image/') && <img src={file.url ?? ''} alt={file.name} loading="lazy" decoding="async" className="mb-3 max-h-80 w-full rounded-lg object-contain"/>}<div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{file.name}</span>{file.url && <a href={file.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-bold text-violet-700">Open</a>}</div><span className="mt-1 block text-[10px] uppercase text-slate-400">{file.file_type || 'reference'}</span></div>)}</div>}</div>
            <div className="rounded-xl border p-4"><h3 className="flex items-center gap-2 font-bold"><MessageCircle className="h-4 w-4"/>Customer conversation</h3><div className="mt-3 max-h-96 space-y-2 overflow-y-auto">{(selected.messages ?? []).length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : selected.messages?.map((entry) => <div key={entry.id} className={`max-w-[90%] rounded-xl p-3 text-sm ${entry.author === 'employee' ? 'ml-auto bg-violet-50' : 'bg-slate-100'}`}><b>{entry.author === 'employee' ? 'Design team' : 'Customer'}</b>{entry.message && <p className="mt-1 whitespace-pre-wrap">{entry.message}</p>}{entry.attachment_url && <a href={entry.attachment_url} target="_blank" rel="noreferrer"><img src={entry.attachment_url} alt={entry.attachment_name || 'Chat image'} className="mt-2 max-h-72 rounded-lg object-contain"/></a>}<time className="mt-1 block text-[10px] text-slate-400">{new Date(entry.created_at).toLocaleString()}</time></div>)}</div><textarea value={message} onChange={(e) => setMessage(e.target.value)} onPaste={(e) => { const item = Array.from(e.clipboardData.items).find((entry) => entry.type.startsWith('image/')); const file = item?.getAsFile(); if (file) { setChatImage(file); setUploadFile(null); } }} placeholder="Type a message or paste an image" className="mt-3 min-h-20 w-full rounded-lg border p-3 text-sm"/><div className="mt-2 flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><Camera className="h-4 w-4"/>Camera<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { setChatImage(e.target.files?.[0] ?? null); setUploadFile(null); }}/></label><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><ImageIcon className="h-4 w-4"/>Photo<input type="file" accept="image/*" className="hidden" onChange={(e) => { setChatImage(e.target.files?.[0] ?? null); setUploadFile(null); }}/></label>{chatImage && <button type="button" onClick={() => setChatImage(null)} className="max-w-48 truncate text-xs text-slate-500">{chatImage.name} · remove</button>}<label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><UploadCloud className="h-4 w-4"/>Attach design<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.ai,.eps,.psd,.tif,.tiff" className="hidden" onChange={(e) => { setUploadFile(e.target.files?.[0] ?? null); setChatImage(null); }}/></label>{uploadFile && <span className="max-w-48 truncate text-xs text-slate-500">{uploadFile.name}</span>}<div className="flex-1"/>{uploadFile ? <button disabled={busy} onClick={() => void uploadDesign()} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"><UploadCloud className="h-4 w-4"/>Upload & send preview</button> : <button disabled={busy || (!message.trim() && !chatImage)} onClick={() => void sendMessage()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"><Send className="h-4 w-4"/>Send message</button>}</div></div>
          </div>}
        </section>
      </section>
      {!submittedQueriesOnly && <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold">Customer design links</h2><p className="mt-1 text-xs text-slate-500">Each row is a separate customer link and design query.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{items.length}</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Query</th><th className="px-5 py-3">Customer / request</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3">Private link</th></tr></thead>
            <tbody className="divide-y">
              {items.map((item) => <tr key={item.id}>
                <td className="px-5 py-3 font-semibold">DQ-{String(item.id).padStart(4, '0')}</td>
                <td className="px-5 py-3">{item.company_name || item.product || 'Awaiting customer details'}<span className="ml-2 text-xs text-slate-400">{item.company_name ? `· ${item.product || 'Design request'}` : item.request_type || 'design'}</span></td>
                <td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{(item.status || 'draft').replaceAll('_', ' ')}</span></td>
                <td className="px-5 py-3 text-xs text-slate-500">{item.expires_at ? new Date(item.expires_at).toLocaleDateString() : 'No expiry'}</td>
                <td className="px-5 py-3">{item.client_url ? <div className="flex items-center gap-2"><button type="button" onClick={() => void navigator.clipboard.writeText(item.client_url!)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold hover:bg-slate-50"><Copy className="h-3.5 w-3.5"/>Copy</button><a href={item.client_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700"><ExternalLink className="h-3.5 w-3.5"/>Open</a></div> : <span className="text-xs text-slate-400">Link unavailable</span>}</td>
              </tr>)}
              {!loading && items.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">No links yet. Generate one link per customer above.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}
    </div>
  </main>;
}
