'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import api from '@/services/api/client';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function requestCode(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.post('/auth/password/otp', { email: email.trim() });
      setCodeSent(true);
      setNotice(response.data.message || 'If an account exists, a reset code has been sent.');
    } catch (e: any) { setError(e?.response?.data?.message ?? 'We could not send a reset code. Please try again.'); }
    finally { setBusy(false); }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.post('/auth/password/reset', { email: email.trim(), otp, password, password_confirmation: passwordConfirmation });
      setDone(true); setNotice(response.data.message || 'Your password has been reset.');
      window.setTimeout(() => router.push('/login'), 1800);
    } catch (e: any) {
      const messages = e?.response?.data?.errors ? Object.values(e.response.data.errors).flat().join(' ') : '';
      setError(messages || e?.response?.data?.message || 'Password reset failed. Check the code and try again.');
    } finally { setBusy(false); }
  }

  return <main className="flex min-h-[80vh] items-center justify-center bg-slate-50 px-4 py-12"><section className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-9">
    <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-sky-700"><ArrowLeft className="h-4 w-4"/>Back to sign in</Link>
    <header className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><KeyRound className="h-6 w-6"/></div><h1 className="mt-4 text-2xl font-black text-slate-900">Reset your password</h1><p className="mt-2 text-sm leading-6 text-slate-500">We’ll email you a one-time code to verify your account.</p></header>
    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {!codeSent?<form onSubmit={requestCode} className="space-y-4"><label className="block text-xs font-bold uppercase tracking-wide text-slate-700">Email address<div className="relative mt-1.5"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"/></div></label><button disabled={busy} className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60">{busy?'Sending code…':'Send reset code'}</button></form>:!done?<form onSubmit={resetPassword} className="space-y-4"><label className="block text-xs font-bold uppercase tracking-wide text-slate-700">Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"/></label><label className="block text-xs font-bold uppercase tracking-wide text-slate-700">6-digit code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Enter code from email" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm tracking-[.3em]"/><span className="mt-1 block text-[11px] font-normal normal-case text-slate-500">Code expires after 10 minutes.</span></label><label className="block text-xs font-bold uppercase tracking-wide text-slate-700">New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"/></label><label className="block text-xs font-bold uppercase tracking-wide text-slate-700">Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={passwordConfirmation} onChange={e=>setPasswordConfirmation(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"/></label><button disabled={busy||otp.length!==6} className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60">{busy?'Resetting password…':'Reset password'}</button><button type="button" disabled={busy} onClick={()=>void requestCode()} className="w-full text-sm font-semibold text-sky-700 hover:underline">Send a new code</button></form>:<div className="text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600"/><p className="mt-2 text-sm text-slate-600">Taking you back to sign in…</p></div>}
    <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5"/>For your security, reset codes expire after 10 minutes.</p>
  </section></main>;
}
