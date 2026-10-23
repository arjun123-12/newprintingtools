'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Gift,
  Coins,
  CreditCard,
  Truck,
  Package,
  Layers,
  Crown,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  ShoppingBag,
  RotateCw,
  Trophy,
  PartyPopper,
  Zap,
} from 'lucide-react';
import {
  spinWinService,
  WheelSegment,
  WonPrize,
  SpinEligibilityResponse,
} from '@/services/spinWinService';

interface SpinAndWinWheelProps {
  orderNumber?: string;
  reviewToken?: string;
  onRewardWon?: (prize: WonPrize) => void;
  className?: string;
}

export default function SpinAndWinWheel({
  orderNumber,
  reviewToken,
  onRewardWon,
  className = '',
}: SpinAndWinWheelProps) {
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<SpinEligibilityResponse | null>(null);
  const [segments, setSegments] = useState<WheelSegment[]>([]);
  const [spinToken, setSpinToken] = useState<string | null>(null);

  // Spin State
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [wonPrize, setWonPrize] = useState<WonPrize | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);

  // Active lights animation
  const [activeLight, setActiveLight] = useState(0);

  // Fetch initial verified eligibility from backend
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        setLoading(true);
        setSpinError(null);
        const data = await spinWinService.checkEligibility(orderNumber, reviewToken);
        if (!isMounted) return;

        setEligibility(data);

        if (data.wheel_segments && data.wheel_segments.length > 0) {
          setSegments(data.wheel_segments);
        }

        if (data.spin_token) {
          setSpinToken(data.spin_token);
        }

        // If order has already spun, restore the won prize state cleanly
        if (data.has_spun && data.prize) {
          setWonPrize(data.prize);
          const segCount = data.wheel_segments?.length || 8;
          const targetSliceAngle = (360 / segCount) * (data.prize.segment_index || 0);
          setRotationDegrees(360 * 3 + (360 - targetSliceAngle));
        }
      } catch (err: any) {
        if (!isMounted) return;
        setSpinError(err.response?.data?.message || 'Could not verify reward eligibility.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (orderNumber || reviewToken) {
      checkStatus();
    }

    return () => {
      isMounted = false;
    };
  }, [orderNumber, reviewToken]);

  // Alternating bulb lights effect around outer golden rim
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveLight((prev) => (prev + 1) % 2);
    }, 450);
    return () => clearInterval(timer);
  }, []);

  // Keep the celebration brief so it does not distract from the saved reward.
  useEffect(() => {
    if (!confettiActive) return;
    const timer = window.setTimeout(() => setConfettiActive(false), 3200);
    return () => window.clearTimeout(timer);
  }, [confettiActive]);

  // Handle Spin Click (Server-Authoritative)
  const handleSpinClick = async () => {
    if (isSpinning || wonPrize || !spinToken || segments.length === 0) return;

    setIsSpinning(true);
    setSpinError(null);

    try {
      // 1. Backend securely selects and saves the prize BEFORE the wheel spins!
      const response = await spinWinService.spin(orderNumber, spinToken, reviewToken);
      const prize = response.prize;

      // 2. Compute exact target rotation for the pre-selected prize segment
      const segCount = segments.length;
      const sliceAngle = 360 / segCount;
      const targetIndex = prize.segment_index ?? 0;

      // The pointer is pointing down from the top (-90 deg).
      // Angle to rotate so slice targetIndex is exactly under the top pointer:
      const fullRotations = 360 * 6; // 6 dramatic full spins
      const targetSliceOffset = 360 - (targetIndex * sliceAngle);
      // Add slight organic offset within slice (±1.5 degrees) for realistic needle feel
      const jitter = (Math.random() - 0.5) * 3;
      const finalDegrees = fullRotations + targetSliceOffset + jitter;

      // 3. Run client deceleration animation
      setRotationDegrees(finalDegrees);

      // 4. Reveal celebration after wheel completes rotation (4.8 seconds)
      setTimeout(() => {
        setIsSpinning(false);
        setWonPrize(prize);
        setShowWinnerModal(true);
        setConfettiActive(true);
        if (onRewardWon) {
          onRewardWon(prize);
        }
      }, 4850);
    } catch (err: any) {
      setIsSpinning(false);
      setSpinError(
        err.response?.data?.message ||
        'Unable to process spin. Please refresh the page to retry.'
      );
    }
  };

  const copyVoucherCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // If order is not paid or ineligible, render nothing (strictly requires verified backend payment)
  if (loading) {
    return (
      <div className={`p-8 bg-slate-900/60 rounded-3xl border border-slate-800 text-center text-slate-300 ${className}`}>
        <RotateCw className="w-8 h-8 animate-spin mx-auto text-pink-500 mb-3" />
        <p className="text-sm font-semibold">Verifying Paid Order Entitlement & Loading Spin & Win...</p>
      </div>
    );
  }

  // If order is eligible but no active segments are available, show informative message
  if (eligibility?.eligible && segments.length === 0) {
    return (
      <section
        aria-label="Spin and Win Rewards"
        className={`relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 text-white shadow-2xl p-6 text-center ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center mx-auto mb-3">
          <Gift className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">
          Spin & Win Rewards Currently Unavailable
        </h3>
        <p className="text-xs text-slate-300 max-w-md mx-auto">
          Your payment was verified, but there are no active promotional rewards remaining for this category at this time. Please check your account or contact our team if you need assistance!
        </p>
      </section>
    );
  }

  // If order is not paid or ineligible, render nothing (strictly requires verified backend payment)
  if (!eligibility?.eligible) {
    return null;
  }

  // Pre-calculate SVG slice geometry
  const radius = 190;
  const center = 200;
  const sliceAngle = 360 / segments.length;

  const slicePaths = segments.map((seg, idx) => {
    // Slices centered so slice 0 is centered at top pointer (-90 deg)
    const startDeg = -90 - sliceAngle / 2 + idx * sliceAngle;
    const endDeg = startDeg + sliceAngle;

    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const pathD = `M ${center},${center} L ${x1},${y1} A ${radius},${radius} 0 0,1 ${x2},${y2} Z`;
    const midAngle = startDeg + sliceAngle / 2;

    return {
      seg,
      idx,
      pathD,
      midAngle,
    };
  });

  return (
    <section
      aria-label="Spin and Win Rewards"
      className={`@container relative overflow-hidden rounded-3xl border-2 border-amber-400/30 bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 text-white shadow-2xl p-4 sm:p-6 lg:p-7 xl:p-8 2xl:p-10 ${className}`}
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -left-24 w-72 h-72 sm:w-96 sm:h-96 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 sm:w-96 sm:h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Short confetti burst when a new reward is revealed */}
      {confettiActive && (
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {Array.from({ length: 46 }, (_, index) => {
            const colors = ['#fbbf24', '#f472b6', '#38bdf8', '#a78bfa', '#34d399'];
            const drift = `${((index * 37) % 220) - 110}px`;
            return (
              <span
                key={index}
                className={`spin-win-confetti ${index % 4 === 0 ? 'rounded-full' : 'rounded-sm'}`}
                style={{
                  left: `${(index * 43) % 100}%`,
                  backgroundColor: colors[index % colors.length],
                  animationDelay: `${(index % 9) * 45}ms`,
                  animationDuration: `${1700 + (index % 5) * 130}ms`,
                  ['--confetti-drift' as string]: drift,
                  ['--confetti-rotate' as string]: `${(index * 71) % 540}deg`,
                }}
              />
            );
          })}
        </div>
      )}

      <style jsx>{`
        .spin-win-confetti {
          position: absolute;
          top: -12px;
          width: 8px;
          height: 13px;
          opacity: 0;
          animation-name: spin-win-confetti-burst;
          animation-timing-function: cubic-bezier(0.18, 0.72, 0.32, 1);
          animation-fill-mode: both;
        }
        @keyframes spin-win-confetti-burst {
          0% { opacity: 0; transform: translate3d(0, -8px, 0) rotate(0); }
          12% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(var(--confetti-drift), 540px, 0) rotate(var(--confetti-rotate)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .spin-win-confetti { animation-duration: 1ms !important; }
        }
      `}</style>

      {/* Limited-time offer / saved reward message */}
      <div className={`relative z-10 mb-5 sm:mb-6 rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 ${wonPrize ? 'border-emerald-400/40 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-pink-950/70' : 'border-pink-400/30 bg-gradient-to-r from-pink-950/70 via-indigo-950/70 to-amber-950/50'}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-full p-2 ${wonPrize ? 'bg-emerald-400/15 text-emerald-300' : 'bg-pink-400/15 text-pink-300'}`}>
            {wonPrize ? <PartyPopper className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div>
            {wonPrize ? (
              <>
                <p className="text-sm sm:text-base font-extrabold text-white">Congratulations! Your reward is saved for your next order.</p>
                <p className="mt-1 text-xs sm:text-sm text-slate-200">
                  You won <strong className="text-amber-300">{wonPrize.title}</strong>. Use code <strong className="font-mono text-pink-300">{wonPrize.reward_code}</strong> by {new Date(wonPrize.expires_at).toLocaleDateString()}.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm sm:text-base font-extrabold text-white">Spin now and unlock a reward for your next order!</p>
                <p className="mt-1 text-xs sm:text-sm text-slate-300">Limited-time rewards are subject to the terms and expiry date shown with your prize.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* TOP BRANDED BANNER */}
      <div className="relative z-10 flex flex-col @5xl:flex-row items-center justify-between gap-5 border-b border-white/10 pb-5 sm:pb-6 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 self-start xl:self-center">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-600 p-0.5 shadow-lg shadow-pink-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
                ERRY IMPRINTS
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Design • Print • Grow</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">Design Once. Print Everything.</p>
          </div>
        </div>

        {/* Big Spin & Win Title */}
        <div className="text-center @5xl:text-right w-full @5xl:w-auto">
          <div className="flex flex-wrap items-center justify-center @5xl:justify-end gap-2 mb-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>EXCLUSIVE PAYMENT REWARD</span>
            </div>
            {eligibility?.category && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold shadow-sm">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{eligibility.category.name} Rewards</span>
              </div>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-sky-300 drop-shadow-sm">
            SPIN & WIN
          </h2>
          <p className="text-xs xl:text-sm text-slate-300 max-w-md @5xl:max-w-lg @5xl:ml-auto">
            AMAZING PRINTING REWARDS AWAIT! Play the wheel and unlock rewards tailored for your business.
          </p>
        </div>
      </div>

      {/* MAIN CONTENT: ADAPTIVE GRID THAT PREVENTS OVAL COMPRESSION */}
      <div className="relative z-10 grid grid-cols-1 @md:grid-cols-2 @5xl:grid-cols-12 gap-5 lg:gap-5 xl:gap-8 items-start @5xl:items-center">
        {/* CENTER COLUMN: THE WHEEL OF FORTUNE (Rendered first on mobile/tablet/constrained, centered on xl) */}
        <div className="col-span-1 @md:col-span-2 @5xl:col-span-6 flex flex-col items-center justify-center order-1 @5xl:order-2 w-full min-w-0 py-2">
          {/* Guaranteed 1:1 Aspect Ratio Wheel Container (NO explicit height, immune to oval stretching) */}
          <div className="relative w-full max-w-[280px] xs:max-w-[320px] sm:max-w-[360px] md:max-w-[390px] lg:max-w-[380px] xl:max-w-[420px] 2xl:max-w-[450px] aspect-square flex items-center justify-center select-none mx-auto shrink-0">
            {/* Outer Golden Rim with Lighting Bulbs */}
            <div className="absolute inset-0 rounded-full border-[8px] sm:border-[10px] xl:border-[14px] border-amber-400 bg-radial from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_50px_rgba(245,158,11,0.45)]">
              {/* Outer Bulbs */}
              {Array.from({ length: 24 }).map((_, bulbIdx) => {
                const bulbAngle = (bulbIdx * 360) / 24;
                const isLit = (bulbIdx % 2) === activeLight;
                return (
                  <div
                    key={bulbIdx}
                    className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 xl:w-3 xl:h-3 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                    style={{
                      top: `${50 - 47.5 * Math.cos((bulbAngle * Math.PI) / 180)}%`,
                      left: `${50 + 47.5 * Math.sin((bulbAngle * Math.PI) / 180)}%`,
                      backgroundColor: isLit ? '#ffffff' : '#f59e0b',
                      boxShadow: isLit
                        ? '0 0 8px #ffffff, 0 0 14px #fbbf24'
                        : '0 0 2px rgba(0,0,0,0.5)',
                    }}
                  />
                );
              })}
            </div>

            {/* Inner Dark Rim Bezel */}
            <div className="absolute inset-[8px] sm:inset-[10px] xl:inset-[14px] rounded-full border-2 sm:border-4 border-slate-900 bg-slate-950 overflow-hidden shadow-inner" />

            {/* ROTATING SVG WHEEL (Always square, perfectly centered) */}
            <div
              className="absolute inset-[11px] sm:inset-[14px] xl:inset-[18px] rounded-full overflow-hidden"
              style={{
                transform: `rotate(${rotationDegrees}deg)`,
                transition: isSpinning
                  ? 'transform 4.8s cubic-bezier(0.12, 0.8, 0.2, 1.0)'
                  : 'transform 0.4s ease-out',
                willChange: 'transform',
              }}
            >
              <svg viewBox="0 0 400 400" className="w-full h-full">
                <defs>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.4" />
                  </filter>
                </defs>

                {slicePaths.map(({ seg, idx, pathD, midAngle }) => (
                  <g key={seg.id || idx}>
                    <path
                      d={pathD}
                      fill={seg.color_bg || '#fef08a'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />

                    {/* Slice Content (Text & Badge) */}
                    <g
                      transform={`rotate(${midAngle}, ${center}, ${center})`}
                      className="pointer-events-none select-none"
                    >
                      {/* Badge / Value */}
                      <text
                        x={center + 120}
                        y={center}
                        fill={seg.color_text || '#0f172a'}
                        fontSize="11"
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(90, ${center + 120}, ${center})`}
                      >
                        {seg.badge_text || (seg.value > 0 ? `$${seg.value}` : 'FREE')}
                      </text>

                      {/* Prize Title */}
                      <text
                        x={center + 78}
                        y={center}
                        fill={seg.color_text || '#0f172a'}
                        fontSize="9.5"
                        fontWeight="800"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(90, ${center + 78}, ${center})`}
                      >
                        {seg.title.length > 18 ? seg.title.slice(0, 16) + '...' : seg.title}
                      </text>
                    </g>
                  </g>
                ))}
              </svg>
            </div>

            {/* TOP POINTER (Fixed Needle pointing directly downwards) */}
            <div className="absolute -top-3 sm:-top-3.5 xl:-top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
              <div className="w-6 h-6 sm:w-7 sm:h-7 xl:w-8 xl:h-8 rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 border-2 border-white shadow-lg flex items-center justify-center">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-600 border border-white shadow-xs" />
              </div>
              <div
                className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[20px] sm:border-l-[10px] sm:border-r-[10px] sm:border-t-[24px] xl:border-t-[28px] border-t-amber-400 drop-shadow-md -mt-1"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
              />
            </div>

            {/* CENTER HUB: SPIN NOW 3D BUTTON */}
            <div className="absolute z-20">
              <button
                type="button"
                onClick={handleSpinClick}
                disabled={isSpinning || !!wonPrize}
                aria-label="Spin the wheel"
                className={`relative w-18 h-18 sm:w-20 sm:h-20 xl:w-24 xl:h-24 aspect-square rounded-full border-[3px] sm:border-4 border-amber-300 flex flex-col items-center justify-center text-white font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-2xl ${
                  isSpinning
                    ? 'bg-gradient-to-b from-pink-600 to-purple-800 scale-95 cursor-not-allowed opacity-90'
                    : wonPrize
                    ? 'bg-gradient-to-b from-emerald-600 to-teal-800 cursor-default'
                    : 'bg-gradient-to-b from-pink-500 via-pink-600 to-rose-700 hover:scale-105 active:scale-95 hover:shadow-pink-500/50 cursor-pointer'
                }`}
                style={{
                  boxShadow: isSpinning
                    ? '0 0 20px rgba(236,72,153,0.6)'
                    : '0 0 30px rgba(244,63,94,0.7)',
                }}
              >
                {isSpinning ? (
                  <>
                    <RotateCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mb-0.5 sm:mb-1 text-white" />
                    <span className="text-[9px] sm:text-[10px] tracking-tight">SPINNING</span>
                  </>
                ) : wonPrize ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5 text-emerald-200" />
                    <span className="text-[9px] sm:text-[10px] tracking-tight">WON!</span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] sm:text-[11px] xl:text-xs font-black drop-shadow-md">SPIN</span>
                    <span className="text-[8px] sm:text-[9px] xl:text-[10px] text-pink-200 font-bold -mt-0.5">NOW</span>
                    <RotateCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 mt-0.5 opacity-90 animate-spin-slow" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action text under wheel */}
          <div className="mt-5 sm:mt-6 text-center space-y-2 w-full max-w-sm sm:max-w-md mx-auto">
            {spinError && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-center justify-center gap-2 max-w-sm mx-auto">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{spinError}</span>
              </div>
            )}

            {!wonPrize ? (
              <p className="text-xs xl:text-sm text-slate-300">
                {isSpinning
                  ? 'Selecting your guaranteed reward from our prepress vault...'
                  : 'Click the center button to spin. One spin per paid order.'}
              </p>
            ) : (
              <div className="bg-slate-900/90 border-2 border-emerald-500/50 rounded-2xl p-4 text-left space-y-3 w-full max-w-sm sm:max-w-md mx-auto shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                        Saved Won Reward
                      </span>
                      <h4 className="text-sm font-bold text-white">{wonPrize.title}</h4>
                    </div>
                  </div>
                  {wonPrize.badge_text && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      {wonPrize.badge_text}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 bg-slate-950/90 border border-white/10 rounded-xl px-3 py-2">
                  <span className="font-mono text-sm font-black tracking-wider text-pink-300">
                    {wonPrize.reward_code}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyVoucherCode(wonPrize.reward_code)}
                    className="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-white/5">
                  <p>{wonPrize.how_to_use}</p>
                  <p className="text-[10px] text-slate-400">
                    <strong>Terms:</strong> {wonPrize.terms_text} Valid until {new Date(wonPrize.expires_at).toLocaleDateString()}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWinnerModal(true)}
                  className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  View Full Reward Details
                </button>
              </div>
            )}
          </div>
        </div>

        {/* LEFT COLUMN: HOW IT WORKS */}
        <div className="col-span-1 @md:col-span-1 @5xl:col-span-3 space-y-3.5 xl:space-y-4 order-2 @5xl:order-1 flex flex-col justify-between w-full min-w-0">
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-lg">
            <h3 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider mb-3.5 sm:mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>How It Works</span>
            </h3>

            <div className="space-y-3 xl:space-y-3.5">
              <div className="flex items-start gap-2.5 xl:gap-3">
                <div className="w-6 h-6 xl:w-7 xl:h-7 rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center text-[10px] xl:text-xs font-black shrink-0">
                  1
                </div>
                <div>
                  <h4 className="text-xs xl:text-sm font-bold text-slate-100">Place & Pay Order</h4>
                  <p className="text-[11px] xl:text-xs text-slate-400 leading-relaxed">
                    Order verified with BPOINT. Your spin is unlocked!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 xl:gap-3">
                <div className="w-6 h-6 xl:w-7 xl:h-7 rounded-full bg-amber-600/30 text-amber-300 border border-amber-500/40 flex items-center justify-center text-[10px] xl:text-xs font-black shrink-0">
                  2
                </div>
                <div>
                  <h4 className="text-xs xl:text-sm font-bold text-slate-100">Spin the Wheel</h4>
                  <p className="text-[11px] xl:text-xs text-slate-400 leading-relaxed">
                    Click SPIN NOW to discover your guaranteed reward.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 xl:gap-3">
                <div className="w-6 h-6 xl:w-7 xl:h-7 rounded-full bg-pink-600/30 text-pink-300 border border-pink-500/40 flex items-center justify-center text-[10px] xl:text-xs font-black shrink-0">
                  3
                </div>
                <div>
                  <h4 className="text-xs xl:text-sm font-bold text-slate-100">Win a Reward</h4>
                  <p className="text-[11px] xl:text-xs text-slate-400 leading-relaxed">
                    Instant voucher code generated & saved to your Print Bank™.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 xl:gap-3">
                <div className="w-6 h-6 xl:w-7 xl:h-7 rounded-full bg-sky-600/30 text-sky-300 border border-sky-500/40 flex items-center justify-center text-[10px] xl:text-xs font-black shrink-0">
                  4
                </div>
                <div>
                  <h4 className="text-xs xl:text-sm font-bold text-slate-100">Redeem at Checkout</h4>
                  <p className="text-[11px] xl:text-xs text-slate-400 leading-relaxed">
                    Apply your unique code on future print orders.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ERRY+ Member Badge */}
          <div className="bg-gradient-to-r from-amber-500/20 via-pink-500/10 to-indigo-500/20 border border-amber-400/40 rounded-2xl p-3.5 sm:p-4 text-xs space-y-1.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-amber-300 font-extrabold uppercase tracking-wide">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>ERRY+ VIP REWARDS</span>
            </div>
            <p className="text-slate-300 text-[10px] xl:text-[11px] leading-relaxed">
              Every paid order receives a guaranteed prize from our commercial printing rewards pool.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: YOUR POSSIBLE REWARDS */}
        <div className="col-span-1 @md:col-span-1 @5xl:col-span-3 space-y-3.5 xl:space-y-4 order-3 flex flex-col justify-between w-full min-w-0">
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-lg">
            <h3 className="text-sm font-extrabold text-pink-400 uppercase tracking-wider mb-3.5 sm:mb-4 flex items-center justify-between">
              <span>Your Possible Rewards</span>
              <Gift className="w-4 h-4 text-pink-400" />
            </h3>

            <div className="space-y-2 sm:space-y-2.5 max-h-[280px] sm:max-h-[320px] xl:max-h-[390px] 2xl:max-h-[420px] overflow-y-auto pr-1 text-left custom-scrollbar">
              {segments.map((seg, i) => (
                <div
                  key={seg.id || i}
                  className={`p-2 sm:p-2.5 rounded-xl border transition-all text-xs flex items-start gap-2 sm:gap-2.5 ${
                    wonPrize?.title === seg.title
                      ? 'bg-emerald-950/80 border-emerald-500/60 ring-1 ring-emerald-400 shadow-md'
                      : 'bg-white/5 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div
                    className="w-6 h-6 sm:w-7 sm:h-7 xl:w-8 xl:h-8 rounded-lg flex items-center justify-center font-black text-[9px] sm:text-[10px] xl:text-[11px] shrink-0"
                    style={{
                      backgroundColor: seg.color_bg || '#fef08a',
                      color: seg.color_text || '#0f172a',
                    }}
                  >
                    {seg.badge_text || (seg.value > 0 ? `$${seg.value}` : '★')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-100 truncate text-[11px] sm:text-xs">{seg.title}</span>
                      <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300 font-semibold uppercase shrink-0 whitespace-nowrap">
                        {seg.reward_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {seg.how_to_use || seg.terms_text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] sm:text-[11px] text-slate-400 text-center px-1">
            Rewards are automatically recorded in our durable ledger and apply to future orders.
          </div>
        </div>
      </div>

      {/* BOTTOM 4 FEATURE CARDS (FROM ATTACHED INSPIRATION IMAGE) */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4 xl:gap-5 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/10">
        {/* Card 1: $0 Print Shop */}
        <div className="bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 rounded-2xl p-4 xl:p-5 transition-all flex flex-col justify-between h-full space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wide">
              <ShoppingBag className="w-4 h-4 text-sky-400 shrink-0" />
              <span>The $0 Print Shop</span>
            </div>
            <p className="text-[11px] xl:text-xs text-slate-300 leading-relaxed">
              Turn your print spend into free future jobs. Earn Print Dollars on every paid business order.
            </p>
          </div>
          <div>
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-[11px] xl:text-xs font-bold text-sky-400 hover:text-sky-300 transition"
            >
              <span>Explore Products</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Print Bank */}
        <div className="bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 rounded-2xl p-4 xl:p-5 transition-all flex flex-col justify-between h-full space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
              <Coins className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Erry Print Bank™</span>
            </div>
            <p className="text-[11px] xl:text-xs text-slate-300 leading-relaxed">
              Your printing wallet holds active vouchers, print dollar credits, and special promotional allowances.
            </p>
          </div>
          <div>
            <Link
              href="/account"
              className="inline-flex items-center gap-1 text-[11px] xl:text-xs font-bold text-amber-400 hover:text-amber-300 transition"
            >
              <span>View My Print Bank</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 3: Print Investment */}
        <div className="bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 rounded-2xl p-4 xl:p-5 transition-all flex flex-col justify-between h-full space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wide">
              <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Print Investment</span>
            </div>
            <p className="text-[11px] xl:text-xs text-slate-300 leading-relaxed">
              Higher value signage and marketing collateral unlock higher tier reward vouchers automatically.
            </p>
          </div>
          <div>
            <span className="text-[11px] xl:text-xs text-emerald-400 font-semibold block">
              Guaranteed on every paid job
            </span>
          </div>
        </div>

        {/* Card 4: The Secret Print */}
        <div className="bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 rounded-2xl p-4 xl:p-5 transition-all flex flex-col justify-between h-full space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase tracking-wide">
              <Gift className="w-4 h-4 text-pink-400 shrink-0" />
              <span>The Secret Print</span>
            </div>
            <p className="text-[11px] xl:text-xs text-slate-300 leading-relaxed">
              Every dispatch package may include complimentary sample stocks, foil swatches, and bonus discount cards.
            </p>
          </div>
          <div>
            <span className="text-[11px] xl:text-xs text-pink-400 font-semibold block">
              Dispatched with your order
            </span>
          </div>
        </div>
      </div>

      {/* WINNER POPUP MODAL */}
      {showWinnerModal && wonPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 rounded-3xl border-2 border-amber-400/60 shadow-2xl p-6 sm:p-8 text-center text-white space-y-5">
            {/* Crown Icon */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-500 p-0.5 mx-auto shadow-xl shadow-pink-500/30">
              <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-bold uppercase tracking-wider">
                  <PartyPopper className="w-3.5 h-3.5 text-pink-400" />
                  <span>Congratulations! You Won</span>
                </div>
                {wonPrize.category_name && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[11px] font-bold">
                    <span>{wonPrize.category_name}</span>
                  </div>
                )}
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-white">
                {wonPrize.title}
              </h3>
              <p className="text-xs text-slate-300 mt-1">{wonPrize.how_to_use}</p>
            </div>

            {/* Voucher Box with One-Click Copy */}
            <div className="bg-slate-950/80 border border-amber-400/40 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Your Exclusive Voucher Code
              </span>
              <div className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5">
                <span className="font-mono text-base sm:text-lg font-black tracking-wider text-pink-300">
                  {wonPrize.reward_code}
                </span>
                <button
                  type="button"
                  onClick={() => copyVoucherCode(wonPrize.reward_code)}
                  className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 text-left pt-1">
                <strong>Terms:</strong> {wonPrize.terms_text} Expires{' '}
                {new Date(wonPrize.expires_at).toLocaleDateString()}).
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowWinnerModal(false)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition"
              >
                Claim & Continue to Order Details
              </button>

              <div className="flex gap-2">
                <Link
                  href="/account"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <span>My Print Bank</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </Link>

                <Link
                  href="/products"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <span>Shop Products</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
