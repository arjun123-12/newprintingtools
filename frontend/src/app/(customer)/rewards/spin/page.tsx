'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Crown, Sparkles, ShieldCheck, ArrowLeft, ShoppingBag } from 'lucide-react';
import SpinWheel from '@/components/SpinWheel';

function SpinWheelContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('spin_token') || undefined;
  const orderNumber = searchParams.get('order') || searchParams.get('order_number') || undefined;
  const reviewToken = searchParams.get('review_token') || undefined;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white selection:bg-amber-400 selection:text-slate-950">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_30%,rgba(124,58,237,0.35),transparent_70%),radial-gradient(40%_40%_at_85%_90%,rgba(236,72,153,0.2),transparent_70%)]" />

      {/* Top Brand Bar */}
      <div className="relative z-10 mb-8 flex items-center justify-between w-full max-w-xl px-2">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft size={14} />
          <span>Back to Store</span>
        </Link>
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Crown size={15} />
          <span>ERRY IMPRINTS VIP REWARDS</span>
        </div>
      </div>

      {/* Hero Headline */}
      <div className="relative z-10 mb-8 text-center max-w-lg">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/30 bg-pink-500/10 px-3.5 py-1 text-xs font-extrabold text-pink-300">
          <Sparkles size={13} className="text-pink-400" />
          <span>OFFICIAL PRIZE WHEEL</span>
        </div>
        <h1 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-sm">
          Spin to win
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-300">
          One spin. One guaranteed reward. Good luck!
        </p>
        {orderNumber && (
          <p className="mt-1 text-xs font-mono text-amber-300">
            Qualifying Order: #{orderNumber}
          </p>
        )}
      </div>

      {/* The Premium Interactive Wheel */}
      <div className="relative z-10 my-2">
        <SpinWheel
          token={token}
          orderNumber={orderNumber}
          reviewToken={reviewToken}
        />
      </div>

      {/* Trust Badges & Guarantee Terms */}
      <div className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 max-w-md text-center">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Server-verified spin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-400" />
          <span>Instant discount code</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShoppingBag size={14} className="text-sky-400" />
          <span>Valid on next order</span>
        </div>
      </div>
    </main>
  );
}

export default function SpinWheelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">
          Loading Spin & Win Wheel…
        </div>
      }
    >
      <SpinWheelContent />
    </Suspense>
  );
}
