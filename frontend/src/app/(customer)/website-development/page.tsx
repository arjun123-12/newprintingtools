'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Globe2, LayoutTemplate, Server, ShieldCheck, Wrench } from 'lucide-react';

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const SERVICES = [
  ['website_design', 'Website design'], ['development', 'Website development'], ['redesign', 'Redesign'],
  ['ecommerce', 'Online store'], ['hosting', 'Hosting management'], ['domain', 'Domain setup'],
  ['maintenance', 'Ongoing maintenance'], ['seo', 'SEO setup'],
];

export default function WebsiteDevelopmentPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(['development']);
  const [addons, setAddons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = (id: string) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`${API}/web-development/projects`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, services: selected, infrastructure: { hosting_status: payload.hosting_status, hosting_provider: payload.hosting_provider, domain_status: payload.domain_status, domain_name: payload.domain_name, addons } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? Object.values(result.errors ?? {}).flat().join(' ') ?? 'Could not submit your request.');
      router.push(`/website-project/${result.data.token}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit your request.'); setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900 sm:py-16"><div className="mx-auto max-w-6xl">
    <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-indigo-700">← Back to store</Link>
    <div className="mt-7 grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
      <section className="lg:sticky lg:top-8"><span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700"><Globe2 className="h-4 w-4"/> Website services</span>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Your website, built and looked after.</h1>
        <p className="mt-4 max-w-lg leading-7 text-slate-600">Tell us about your idea. A project manager will review your brief and connect you with the right developer for a direct conversation.</p>
        <div className="mt-8 space-y-3">{[[LayoutTemplate,'Design and development'],[Server,'Hosting and domain setup'],[Wrench,'Maintenance and support']].map(([Icon,title])=>{const I=Icon as typeof Globe2;return <div key={String(title)} className="flex items-center gap-3 rounded-xl border bg-white p-4"><I className="h-5 w-5 text-indigo-600"/><span className="text-sm font-semibold">{String(title)}</span></div>})}</div>
        <p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600"/> Your project gets a private update and file sharing link.</p>
      </section>
      <form onSubmit={submit} className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm sm:p-8">
        <div><h2 className="text-xl font-bold">Tell us what you need</h2><p className="mt-1 text-sm text-slate-500">We’ll follow up to discuss the details and prepare a quote.</p></div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Your name *<input name="client_name" required maxLength={120} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/></label><label className="text-sm font-semibold">Business name<input name="company_name" maxLength={160} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/></label><label className="text-sm font-semibold">Email *<input type="email" name="email" required className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/></label><label className="text-sm font-semibold">Phone<input name="phone" className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/></label></div>
        <label className="block text-sm font-semibold">Project name *<input name="project_name" required maxLength={160} placeholder="e.g. New cafe website" className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/></label>
        <fieldset><legend className="text-sm font-semibold">Services you’re interested in *</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{SERVICES.map(([id,label])=><label key={id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${selected.includes(id)?'border-indigo-400 bg-indigo-50':'border-slate-200'}`}><input type="checkbox" checked={selected.includes(id)} onChange={()=>toggle(id)} className="accent-indigo-700"/>{label}</label>)}</div></fieldset>
        <label className="block text-sm font-semibold">Website type<select name="website_type" className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="">Choose if known</option><option>Business website</option><option>Online store</option><option>Portfolio</option><option>Landing page</option><option>Web application</option><option>Other</option></select></label>
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><div><h3 className="font-bold">Domain & hosting</h3><p className="mt-1 text-xs text-slate-500">If you already know what you have, share it here. You can choose “Not sure” if you need guidance.</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Hosting<select name="hosting_status" className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="not_sure">Not sure / need advice</option><option value="already_have">I already have hosting</option><option value="need">I need hosting</option></select></label><label className="text-sm font-semibold">Hosting provider<input name="hosting_provider" placeholder="e.g. Hostinger, AWS" className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/></label>
          <label className="text-sm font-semibold">Domain<select name="domain_status" className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="not_sure">Not sure / need advice</option><option value="already_have">I already own a domain</option><option value="need_purchase">I need a domain purchased</option></select></label><label className="text-sm font-semibold">Domain name<input name="domain_name" placeholder="e.g. yourbusiness.com.au" className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/></label></div>
        </section>
        <fieldset><legend className="text-sm font-semibold">Optional add-ons</legend><p className="mt-1 text-xs text-slate-500">Select anything you’d like included in the estimate.</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{[['business_email','Business email'],['ssl_security','SSL & security setup'],['backup','Automated backups'],['seo','SEO setup'],['analytics','Analytics setup'],['payment_gateway','Payment gateway'],['content_writing','Content writing'],['speed_optimization','Speed optimization']].map(([id,label])=><label key={id} className={`flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm ${addons.includes(id)?'border-sky-400 bg-sky-50':'border-slate-200'}`}><input type="checkbox" checked={addons.includes(id)} onChange={()=>setAddons((old)=>old.includes(id)?old.filter((x)=>x!==id):[...old,id])} className="accent-sky-700"/>{label}</label>)}</div></fieldset>
        <label className="block text-sm font-semibold">Reference websites or links<textarea name="reference_urls" rows={2} placeholder="Links that show the style or features you like" className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Project requirements *<textarea name="requirements" required minLength={10} rows={4} placeholder="Describe your goals, pages, features and any questions." className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/></label><label className="text-sm font-semibold">Preferred deadline<input name="requested_deadline" type="date" min={new Date().toISOString().slice(0,10)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 font-normal"/><span className="mt-2 block font-normal text-xs text-slate-500">We’ll confirm a realistic timeline after reviewing the scope.</span></label></div>
        <button disabled={busy || selected.length===0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3.5 font-bold text-white hover:bg-indigo-800 disabled:opacity-50">{busy?'Sending request…':'Send project enquiry'}<ArrowRight className="h-4 w-4"/></button>
      </form>
    </div>
    <section className="mx-auto mt-14 max-w-4xl">
      <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-sky-700">Quick answers</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Frequently asked questions</h2><p className="mt-2 text-sm text-slate-500">A few helpful details before you send your project enquiry.</p></div>
      <div className="mt-6 space-y-3">{[
        ['How much will my website or app cost?', 'The cost depends on the features, design, integrations and content your project needs. Share your requirements and budget range; our team will discuss the scope and send you a quote before work starts.'],
        ['How long does a project take?', 'Timing depends on the project scope and how quickly content and feedback are provided. We’ll agree on a practical timeline and milestones with you before development begins.'],
        ['I already have a domain or hosting. Can I keep using it?', 'Yes. Tell us your domain name and hosting provider in the form. We can review what you already have and let you know if it suits the project. Please don’t enter passwords or access keys in this form.'],
        ['Can you help if I don’t know what I need?', 'Absolutely. Choose “Not sure / need advice” for domain or hosting and describe your idea in the requirements box. We’ll help work out the right setup together.'],
        ['What happens after I submit the form?', 'We’ll review your brief, follow up to clarify anything needed, then share the proposed scope, quote and timeline. Work starts after you approve the quote.'],
        ['Do you provide support after launch?', 'We can discuss hosting, maintenance, updates, backups and other support options that fit your website or app. Select any add-ons you’re interested in and we’ll include them in the discussion.'],
      ].map(([question,answer])=><details key={question} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><summary className="cursor-pointer list-none pr-7 font-semibold text-slate-900 marker:hidden after:float-right after:-mr-7 after:text-sky-700 after:content-['+'] group-open:after:content-['−']">{question}</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{answer}</p></details>)}</div>
    </section></div></main>;
}
