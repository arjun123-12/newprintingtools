'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import SpinWheel from '@/components/SpinWheel';

function SpinWheelContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('spin_token') || undefined;
  const orderNumber = searchParams.get('order') || searchParams.get('order_number') || undefined;
  const reviewToken = searchParams.get('review_token') || undefined;

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-slate-950 px-3 py-5 text-white selection:bg-amber-400 selection:text-slate-950 sm:px-5 sm:py-7">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_30%,rgba(124,58,237,0.35),transparent_70%),radial-gradient(40%_40%_at_85%_90%,rgba(236,72,153,0.2),transparent_70%)]" />

      <div className="relative z-10 mb-3 flex flex-col items-center sm:mb-4">
        <Image
          src="/assets/images/erry_imprints_logo_white.png"
          alt="Erry Imprints"
          width={176}
          height={46}
          priority
          className="h-9 w-auto object-contain sm:h-11"
        />
        <span className="mt-1 text-[10px] font-bold tracking-[0.2em] text-amber-300">CUSTOMER REWARD</span>
      </div>

      <div className="relative z-10 mb-2 max-w-lg text-center sm:mb-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-[10px] font-extrabold text-pink-300 sm:text-xs">
          <Sparkles size={13} className="text-pink-400" />
          <span>YOU&apos;RE INVITED</span>
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white drop-shadow-sm sm:text-4xl">
          Spin to win
        </h1>
        <p className="mt-1 text-xs text-slate-300 sm:text-sm">
          Tap the wheel for your exclusive reward.
        </p>
        {orderNumber && (
          <p className="mt-1 text-[11px] font-mono text-amber-300">
            Qualifying Order: #{orderNumber}
          </p>
        )}
      </div>

      {/* The Premium Interactive Wheel */}
      <div className="relative z-10 w-full max-w-[420px]">
        <SpinWheel
          token={token}
          orderNumber={orderNumber}
          reviewToken={reviewToken}
          className="mx-auto w-full max-w-[min(90vw,420px)]"
        />
      </div>

      <p className="relative z-10 mt-2 text-center text-[10px] text-slate-500 sm:mt-3">
        Your reward will appear here after the wheel stops.
      </p>
    </main>
  );
}

export default function SpinWheelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100svh] items-center justify-center bg-slate-950 text-sm text-white">
          Opening your reward wheel…
        </div>
      }
    >
      <SpinWheelContent />
    </Suspense>
  );
}
