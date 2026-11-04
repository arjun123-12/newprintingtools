'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sparkles, Trophy, Check, Copy, X, ArrowRight, RotateCcw } from 'lucide-react';
import { spinWinService, WonPrize } from '@/services/spinWinService';

export interface SpinSegment {
  label: string;
  sub?: string;
  code?: string;
  color: string;
  darkColor: string;
  textColor?: string;
  value?: number;
  type?: string;
}

export const DEFAULT_SEGMENTS: SpinSegment[] = [
  { label: '10% OFF', sub: 'Entire Order', color: '#be123c', darkColor: '#881337', textColor: '#ffffff' },
  { label: '$20 CREDIT', sub: 'Print Voucher', color: '#1d4ed8', darkColor: '#1e3a8a', textColor: '#ffffff' },
  { label: 'FREE SHIPPING', sub: 'Standard Delivery', color: '#047857', darkColor: '#064e3b', textColor: '#ffffff' },
  { label: '15% OFF', sub: 'Next Print Job', color: '#7e22ce', darkColor: '#581c87', textColor: '#ffffff' },
  { label: 'FREE EXPRESS', sub: 'Delivery Upgrade', color: '#b45309', darkColor: '#78350f', textColor: '#ffffff' },
  { label: '5% OFF', sub: 'Instant Discount', color: '#be185d', darkColor: '#831843', textColor: '#ffffff' },
  { label: 'FREE UPGRADE', sub: 'Premium Artboard', color: '#0f766e', darkColor: '#134e4a', textColor: '#ffffff' },
  { label: '$10 VOUCHER', sub: 'Bonus Credit', color: '#4338ca', darkColor: '#312e81', textColor: '#ffffff' },
];

const NO_CONFETTI_LABELS = ['TRY AGAIN', 'NO LUCK', 'BETTER LUCK'];

interface SpinWheelProps {
  segments?: SpinSegment[];
  token?: string;
  orderNumber?: string;
  reviewToken?: string;
  onRewardWon?: (prize: WonPrize | { label: string; code: string }) => void;
  className?: string;
  isPreview?: boolean;
}

interface ConfettiParticle {
  id: number;
  color: string;
  dx: string;
  dy: string;
  rot: string;
  size: number;
  shape: 'rect' | 'circle';
}

export default function SpinWheel({
  segments: propSegments,
  token,
  orderNumber,
  reviewToken,
  onRewardWon,
  className = '',
  isPreview = false,
}: SpinWheelProps) {
  // Normalize segments
  const segments = useMemo(() => {
    if (propSegments && propSegments.length >= 2) return propSegments;
    return DEFAULT_SEGMENTS;
  }, [propSegments]);

  const totalSlices = segments.length;
  const sliceAngle = 360 / totalSlices;

  // Spin State
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [wonPrize, setWonPrize] = useState<{
    title: string;
    code: string;
    subtitle?: string;
    expiresAt?: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isTicking, setIsTicking] = useState(false);
  const [confettiList, setConfettiList] = useState<ConfettiParticle[]>([]);
  const [serverSpinToken, setServerSpinToken] = useState<string | null>(token || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sparkles in the background (8 randomized twinkling points)
  const sparkles = useMemo(() => {
    return Array.from({ length: 9 }).map((_, i) => ({
      id: i,
      top: `${12 + (i * 29) % 76}%`,
      left: `${10 + (i * 37) % 80}%`,
      delay: `${(i * 0.45).toFixed(2)}s`,
      size: `${4 + (i % 3) * 2}px`,
    }));
  }, []);

  // Fetch verified backend eligibility if token/order is provided
  useEffect(() => {
    if (isPreview) return;
    const fetchEligibility = async () => {
      try {
        if (!token && !orderNumber && !reviewToken) return;
        const data = await spinWinService.checkEligibility(
          orderNumber,
          reviewToken,
          token
        );
        if (data.spin_token) {
          setServerSpinToken(data.spin_token);
        }
        if (data.has_spun && data.prize) {
          setWonPrize({
            title: data.prize.title,
            code: data.prize.reward_code,
            subtitle: data.prize.badge_text || 'Your saved reward voucher',
            expiresAt: data.prize.expires_at,
          });
          const segIdx = data.prize.segment_index ?? 0;
          setWinningIndex(segIdx);
          // Calculate angle so slice is positioned under pointer at top
          const targetAngle = 360 * 3 + (360 - (segIdx * sliceAngle));
          setRotationDegrees(targetAngle);
        }
      } catch (err: any) {
        // Fallback silently to client mode if offline or preview
      }
    };
    void fetchEligibility();
  }, [token, orderNumber, reviewToken, isPreview, sliceAngle]);

  // Pointer tick sound / visual effect
  const tickRef = useRef<number | null>(null);
  const triggerTickAnimation = useCallback(() => {
    setIsTicking(true);
    if (tickRef.current) window.clearTimeout(tickRef.current);
    tickRef.current = window.setTimeout(() => setIsTicking(false), 80);
  }, []);

  // Handle Spin Launch
  const handleSpin = async () => {
    if (isSpinning) return;
    setErrorMessage(null);
    setShowResultModal(false);

    let targetIndex = Math.floor(Math.random() * totalSlices);
    let resolvedPrize: { title: string; code: string; subtitle?: string; expiresAt?: string } | null = null;

    // Check if we have server credentials to execute a verified spin
    const activeToken = serverSpinToken || token;
    if (!isPreview && activeToken) {
      try {
        const response = await spinWinService.spin(
          orderNumber,
          activeToken,
          reviewToken
        );
        const serverPrize = response.prize;
        if (serverPrize) {
          targetIndex = serverPrize.segment_index ?? 0;
          resolvedPrize = {
            title: serverPrize.title,
            code: serverPrize.reward_code,
            subtitle: serverPrize.badge_text || 'Reward Voucher',
            expiresAt: serverPrize.expires_at,
          };
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Unable to execute spin.';
        setErrorMessage(msg);
        return;
      }
    }

    if (!resolvedPrize) {
      const seg = segments[targetIndex];
      const randomCode = `SPIN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      resolvedPrize = {
        title: seg.label,
        code: seg.code || randomCode,
        subtitle: seg.sub || 'Exclusive reward voucher',
      };
    }

    setIsSpinning(true);
    setWinningIndex(null);

    // 1. Wind-up step: pull back slightly (-10deg) for physical feel
    const currentBase = Math.floor(rotationDegrees / 360) * 360;
    const windUpDegrees = currentBase - 12;
    setRotationDegrees(windUpDegrees);

    // 2. Main launch: after 260ms wind-up, accelerate and ease out to winning slice
    setTimeout(() => {
      // Calculate final target degrees:
      // Pointer is at the top (0deg / -90deg SVG coordinates).
      // Target slice center offset = 360 - (targetIndex * sliceAngle)
      const fullSpins = 360 * 6; // 6 full rotations
      const targetOffset = 360 - (targetIndex * sliceAngle);
      const finalRotation = currentBase + fullSpins + targetOffset;

      setRotationDegrees(finalRotation);

      // Simulate pointer flicks as wheel spins past segments
      const totalSpinTimeMs = 5000;
      const intervalTicks = [350, 700, 1100, 1550, 2050, 2600, 3200, 3850, 4450, 4900];
      intervalTicks.forEach(delay => {
        setTimeout(() => triggerTickAnimation(), delay);
      });

      // 3. Reveal win moment after wheel decelerates to complete stop (5.1s)
      setTimeout(() => {
        setIsSpinning(false);
        setWinningIndex(targetIndex);
        setWonPrize(resolvedPrize);

        // Generate confetti burst unless winning segment is "TRY AGAIN"
        const isNoConfetti = NO_CONFETTI_LABELS.some(text =>
          resolvedPrize?.title.toUpperCase().includes(text)
        );

        if (!isNoConfetti) {
          const colors = ['#f59e0b', '#ec4899', '#38bdf8', '#10b981', '#a855f7', '#fbbf24'];
          const particles: ConfettiParticle[] = Array.from({ length: 42 }).map((_, i) => {
            const angle = (i * (360 / 42)) * (Math.PI / 180);
            const dist = 110 + Math.random() * 140;
            return {
              id: i,
              color: colors[i % colors.length],
              dx: `${Math.cos(angle) * dist}px`,
              dy: `${Math.sin(angle) * dist}px`,
              rot: `${Math.floor(Math.random() * 720) - 360}deg`,
              size: 7 + Math.random() * 5,
              shape: i % 3 === 0 ? 'circle' : 'rect',
            };
          });
          setConfettiList(particles);
        }

        // Show modal with pop-in
        setShowResultModal(true);

        if (onRewardWon && resolvedPrize) {
          onRewardWon(resolvedPrize as any);
        }
      }, totalSpinTimeMs + 120);
    }, 260);
  };

  const copyCodeToClipboard = () => {
    if (!wonPrize?.code) return;
    void navigator.clipboard.writeText(wonPrize.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2400);
  };

  // SVG Geometry Constants
  const size = 420;
  const center = size / 2;
  const radius = center - 24; // inner radius inside rim

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Background Breathing Glow Aura */}
      <div
        className={`glow pointer-events-none absolute h-[440px] w-[440px] rounded-full bg-gradient-to-tr from-amber-500/25 via-violet-600/30 to-pink-500/25 blur-3xl ${
          isSpinning ? 'fast' : ''
        }`}
      />

      {/* Twinkling Gold Sparkles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {sparkles.map(s => (
          <div
            key={s.id}
            className="spark"
            style={{
              top: s.top,
              left: s.left,
              animationDelay: s.delay,
              width: s.size,
              height: s.size,
            }}
          />
        ))}
      </div>

      {/* Confetti Container */}
      {confettiList.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-visible">
          {confettiList.map(c => (
            <span
              key={c.id}
              className="absolute"
              style={{
                width: `${c.size}px`,
                height: c.shape === 'rect' ? `${c.size * 1.5}px` : `${c.size}px`,
                backgroundColor: c.color,
                borderRadius: c.shape === 'circle' ? '50%' : '2px',
                ['--dx' as string]: c.dx,
                ['--dy' as string]: c.dy,
                ['--rot' as string]: c.rot,
                animation: 'confetti 1.8s cubic-bezier(0.18, 0.89, 0.32, 1) forwards',
              }}
            />
          ))}
        </div>
      )}

      {/* Main Wheel Container */}
      <div
        className={`relative aspect-square w-full max-w-[340px] sm:max-w-[400px] md:max-w-[420px] ${
          isSpinning ? 'fast' : ''
        }`}
      >
        {/* Outer Gold Metallic Rim */}
        <div className="absolute inset-0 rounded-full border-[10px] border-amber-400 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 p-2 shadow-[0_0_45px_rgba(245,158,11,0.55),0_12px_32px_rgba(0,0,0,0.6)]">
          {/* Glowing Bulbs Ring (20 bulbs along the circumference) */}
          {Array.from({ length: 20 }).map((_, i) => {
            const bulbAngle = (i * 360) / 20;
            const rad = (bulbAngle * Math.PI) / 180;
            const x = 50 + 47.8 * Math.sin(rad);
            const y = 50 - 47.8 * Math.cos(rad);
            return (
              <div
                key={i}
                className="bulb absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200"
                style={{
                  top: `${y}%`,
                  left: `${x}%`,
                  backgroundColor: i % 2 === 0 ? '#ffffff' : '#fef08a',
                  boxShadow: '0 0 8px 1px #ffffff, 0 0 14px 2px #f59e0b',
                  animationDelay: `${(i % 4) * 0.4}s`,
                }}
              />
            );
          })}
        </div>

        {/* Inner Dark Bezel */}
        <div className="absolute inset-[10px] overflow-hidden rounded-full border-2 border-amber-900/60 bg-slate-950 shadow-inner">
          {/* Rotating Wheel Group */}
          <div
            className="h-full w-full"
            style={{
              transform: `rotate(${rotationDegrees}deg)`,
              transition: isSpinning
                ? 'transform 5s cubic-bezier(0.15, 0.9, 0.2, 1)'
                : 'transform 0.26s ease-out',
            }}
          >
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="h-full w-full"
              style={{ overflow: 'visible' }}
            >
              <defs>
                {/* Wheel Gloss Gradient Overlay */}
                <linearGradient id="wheelGloss" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                  <stop offset="48%" stopColor="#ffffff" stopOpacity="0.04" />
                  <stop offset="52%" stopColor="#000000" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
                </linearGradient>

                {/* Metallic Gold Hub Gradient */}
                <radialGradient id="goldHubGrad" cx="40%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="40%" stopColor="#f59e0b" />
                  <stop offset="85%" stopColor="#b45309" />
                  <stop offset="100%" stopColor="#78350f" />
                </radialGradient>

                {/* Slices Gradients with Soft Depth */}
                {segments.map((seg, idx) => (
                  <linearGradient
                    key={`grad-${idx}`}
                    id={`sliceGrad-${idx}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor={seg.color} />
                    <stop offset="100%" stopColor={seg.darkColor} />
                  </linearGradient>
                ))}
              </defs>

              {/* Slices */}
              {segments.map((seg, idx) => {
                // Slice arc geometry: slice 0 centered at top pointer (-90deg)
                const startDeg = -90 - sliceAngle / 2 + idx * sliceAngle;
                const endDeg = startDeg + sliceAngle;
                const startRad = (startDeg * Math.PI) / 180;
                const endRad = (endDeg * Math.PI) / 180;

                const x1 = center + radius * Math.cos(startRad);
                const y1 = center + radius * Math.sin(startRad);
                const x2 = center + radius * Math.cos(endRad);
                const y2 = center + radius * Math.sin(endRad);

                const pathD = `M ${center},${center} L ${x1},${y1} A ${radius},${radius} 0 0,1 ${x2},${y2} Z`;
                const textAngle = startDeg + sliceAngle / 2;
                const isWinner = winningIndex === idx;

                return (
                  <g
                    key={idx}
                    style={{
                      animation: isWinner ? 'winpulse 0.7s ease-in-out 3' : 'none',
                    }}
                  >
                    {/* Slice Wedge */}
                    <path
                      d={pathD}
                      fill={`url(#sliceGrad-${idx})`}
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                    />

                    {/* Slice Text Content */}
                    <g
                      transform={`translate(${center}, ${center}) rotate(${textAngle}) translate(${
                        radius * 0.64
                      }, 0) rotate(90)`}
                    >
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={seg.textColor || '#ffffff'}
                        className="font-extrabold tracking-wider"
                        style={{
                          fontSize: totalSlices > 8 ? '11px' : '13px',
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
                        }}
                      >
                        {seg.label}
                      </text>
                      {seg.sub && (
                        <text
                          y="13"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#fef08a"
                          className="font-semibold uppercase tracking-wider"
                          style={{
                            fontSize: '8.5px',
                            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
                          }}
                        >
                          {seg.sub}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}

              {/* Gloss Highlight Overlay */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="url(#wheelGloss)"
                pointerEvents="none"
              />
            </svg>
          </div>
        </div>

        {/* Center Metallic Gold Hub with SPIN Button */}
        <div className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          {/* Idle Pulsing Ring Ripple */}
          <div className="hub-ring pointer-events-none absolute -inset-3 rounded-full border-2 border-amber-300/80 bg-amber-400/20" />

          {/* Central Button */}
          <button
            type="button"
            onClick={() => void handleSpin()}
            disabled={isSpinning}
            aria-label="Spin the wheel"
            className="group relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-4 border-amber-300 bg-gradient-to-tr from-amber-700 via-amber-500 to-yellow-300 font-black tracking-widest text-slate-950 uppercase shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.7)] transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-90"
          >
            {/* Inner Ring with Metallic Sheen */}
            <div className="flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-full border border-amber-200/60 bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 shadow-inner">
              <span className="text-sm sm:text-base font-black text-amber-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                {isSpinning ? 'SPINNING' : 'SPIN'}
              </span>
            </div>
          </button>
        </div>

        {/* Top Gold Teardrop Pointer with Realistic Needle Flick */}
        <div
          className="pointer-events-none absolute -top-3 left-1/2 z-30 -translate-x-1/2 transition-transform duration-75"
          style={{
            transform: `translateX(-50%) ${isTicking ? 'rotate(-24deg)' : 'rotate(0deg)'}`,
            transformOrigin: 'top center',
          }}
        >
          <svg
            width="34"
            height="46"
            viewBox="0 0 34 46"
            fill="none"
            className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)]"
          >
            {/* Outer Gold Teardrop Needle */}
            <path
              d="M17 44 C 17 44, 4 23, 4 14 C 4 6.8 9.8 1 17 1 C 24.2 1 30 6.8 30 14 C 30 23, 17 44, 17 44 Z"
              fill="url(#goldHubGrad)"
              stroke="#fef08a"
              strokeWidth="2"
            />
            {/* Center Gem / Pivot */}
            <circle cx="17" cy="14" r="5" fill="#ffffff" stroke="#92400e" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Error Notification */}
      {errorMessage && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Winning Reward Result Modal */}
      {showResultModal && wonPrize && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
          style={{ animation: 'fadeIn 0.25s ease-out' }}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl border border-amber-400/40 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-6 text-center text-white shadow-2xl"
            style={{ animation: 'pop 0.35s cubic-bezier(0.18, 0.89, 0.32, 1)' }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowResultModal(false)}
              className="absolute top-4 right-4 rounded-full bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            {/* Trophy Icon */}
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-200 text-amber-950 shadow-lg shadow-amber-500/30">
              <Trophy size={28} />
            </div>

            {/* Congratulations Headline */}
            <span className="inline-block rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-bold text-amber-300">
              CONGRATULATIONS!
            </span>
            <h3 className="mt-2 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300">
              {wonPrize.title}
            </h3>
            <p className="mt-1 text-xs text-slate-300">{wonPrize.subtitle}</p>

            {/* Voucher Code Box */}
            <div className="mt-4 rounded-2xl border border-amber-300/30 bg-slate-950/70 p-3">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Your Reward Promo Code
              </span>
              <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-slate-900 px-3 py-2 font-mono text-sm font-bold text-amber-300 border border-slate-800">
                <span className="truncate">{wonPrize.code}</span>
                <button
                  type="button"
                  onClick={copyCodeToClipboard}
                  className="flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-950 hover:bg-amber-300"
                >
                  {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              {wonPrize.expiresAt && (
                <p className="mt-2 text-[10px] text-slate-400">
                  Valid until {new Date(wonPrize.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
              {isPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setShowResultModal(false);
                    void handleSpin();
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 py-2.5 text-xs font-bold text-amber-950 hover:from-amber-300 hover:to-yellow-300"
                >
                  <RotateCcw size={14} />
                  <span>Spin again</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

