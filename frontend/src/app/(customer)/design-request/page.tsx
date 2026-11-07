'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, LoaderCircle, MessageCircle, Palette, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');

export default function DesignRequestStartPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const requestStarted = useRef(false);

  const startRequest = useCallback(async () => {
    if (requestStarted.current) return;
    requestStarted.current = true;
    setStarting(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/client-brief/start`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.data?.token) {
        throw new Error(result?.message ?? 'We could not open the request form. Please try again.');
      }
      router.push(`/client-brief/${encodeURIComponent(result.data.token)}`);
    } catch (err) {
      requestStarted.current = false;
      setError(err instanceof Error ? err.message : 'We could not open the request form. Please try again.');
      setStarting(false);
    }
  }, [router]);

  useEffect(() => {
    void startRequest();
  }, [startRequest]);

  return (
    <main className="min-h-[75vh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-100 via-slate-50 to-white px-4 py-12 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-violet-700">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-violet-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> Custom design studio
            </div>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">Let’s make your idea stand out.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Tell us what you want to create and share any reference images. Our team will prepare a design preview for you to review online.</p>
            <div className="mt-8 inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-700 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-violet-700/25">
              {starting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Opening your design enquiry form…</> : <>Preparing your secure enquiry form <ArrowRight className="h-4 w-4" /></>}
            </div>
            {error && <button onClick={() => void startRequest()} className="mt-3 block text-sm font-bold text-violet-700 underline underline-offset-4">Try again</button>}
            {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{error}</p>}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Your request is private. We’ll email you when there’s an update.</p>
          </section>

          <section className="relative overflow-hidden rounded-[2rem] border border-white bg-white/90 p-6 shadow-2xl shadow-indigo-950/10 backdrop-blur sm:p-8">
            <div className="absolute -right-14 -top-16 h-48 w-48 rounded-full bg-violet-200/50 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Made for your brand</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">From first idea to print</h2></div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Palette className="h-5 w-5" /></div>
              </div>
              <div className="mt-7 space-y-3">
                {[
                  { icon: MessageCircle, title: 'Share your brief', text: 'Choose your product and describe what you need.' },
                  { icon: UploadCloud, title: 'Add inspiration', text: 'Upload a logo, sketch or reference image.' },
                  { icon: Eye, title: 'Review and approve', text: 'Preview the design, chat with our team and request changes.' },
                ].map(({ icon: Icon, title, text }, index) => <div key={title} className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-700"><Icon className="h-4 w-4" />{index < 2 && <span className="absolute -bottom-5 left-1/2 h-4 w-px bg-violet-200" />}</div>
                  <div><p className="text-sm font-bold text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>
                  {index === 2 && <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-500" />}
                </div>)}
              </div>
              <div className="mt-5 rounded-xl bg-slate-950 px-4 py-3 text-center text-xs font-semibold text-white">A clear preview. A few easy revisions. Your design, ready for print.</div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
