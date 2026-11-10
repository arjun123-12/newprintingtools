'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Sparkles, Trophy, Check, Copy, X, ArrowRight, RotateCcw, Lock, Loader2, BadgeCheck } from 'lucide-react';
import { spinWinService, WonPrize } from '@/services/spinWinService';
import { useAuth } from '@/context/AuthContext';

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
  { label: '10% Off', color: '#7C3AED', darkColor: '#5B21B6', textColor: '#ffffff' },
  { label: 'Free Gift', color: '#EC4899', darkColor: '#BE185D', textColor: '#ffffff' },
  { label: 'Try Again', color: '#334155', darkColor: '#1E293B', textColor: '#ffffff' },
  { label: '25% Off', color: '#F59E0B', darkColor: '#B45309', textColor: '#ffffff' },
  { label: 'Free Ship', color: '#06B6D4', darkColor: '#0E7490', textColor: '#ffffff' },
  { label: '5% Off', color: '#10B981', darkColor: '#047857', textColor: '#ffffff' },
];

// Keep the customer wheel's approved look stable when live reward data loads.
// Admin-configured text and rewards change; the wheel's six visual slices do not.
const CUSTOMER_WHEEL_PALETTE = DEFAULT_SEGMENTS.map(({ color, darkColor, textColor }) => ({
  color,
  darkColor,
  textColor,
}));

const NO_CONFETTI_LABELS = ['TRY AGAIN', 'NO LUCK', 'BETTER LUCK'];

/**
 * Format and balance slice label text so it sits neatly in 1 or 2 lines below the gift icon.
 * Removes long parenthesized tags (e.g. "(Just Pay Shipping)") so text stays clean.
 */
function formatSliceLabel(rawLabel: string) {
  const clean = (rawLabel || '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*·.*$/, '')
    .trim();

  if (!clean) return { line1: '', line2: '' };

  const words = clean.split(/\s+/);
  if (words.length === 1) {
    return { line1: clean, line2: '' };
  }
  if (words.length === 2) {
    return { line1: words[0], line2: words[1] };
  }
  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(' '),
    line2: words.slice(mid).join(' '),
  };
}

/** 3D-styled decorative navy and gold gift box with mini box (flanking the bottom-left of the wheel) */
function DecorativeGiftBoxLeft() {
  return (
    <svg
      viewBox="0 0 110 100"
      className="w-16 h-16 sm:w-22 sm:h-20 drop-shadow-[0_12px_20px_rgba(0,0,0,0.7)]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="decNavyGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0a192f" />
        </linearGradient>
        <linearGradient id="decNavyGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2d4a77" />
          <stop offset="100%" stopColor="#112240" />
        </linearGradient>
        <linearGradient id="decGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="decMiniGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
      </defs>

      {/* Main Navy Box shadow on floor */}
      <ellipse cx="62" cy="88" rx="34" ry="9" fill="rgba(0,0,0,0.5)" />

      {/* Left face */}
      <path d="M 36,44 L 36,80 L 62,92 L 62,54 Z" fill="url(#decNavyGrad1)" />
      {/* Right face */}
      <path d="M 62,54 L 62,92 L 88,80 L 88,44 Z" fill="url(#decNavyGrad2)" />
      {/* Top Lid */}
      <path d="M 62,26 L 92,40 L 62,54 L 32,40 Z" fill="#243b55" stroke="#3b597d" strokeWidth="1" />
      <path d="M 32,40 L 32,46 L 62,60 L 62,54 Z" fill="#1b2d42" />
      <path d="M 62,54 L 62,60 L 92,46 L 92,40 Z" fill="#132133" />

      {/* Gold Ribbon on Main Box */}
      <path d="M 47,33 L 77,47 L 73,49 L 43,35 Z" fill="url(#decGoldGrad)" />
      <path d="M 77,33 L 47,47 L 51,49 L 81,35 Z" fill="url(#decGoldGrad)" />
      <path d="M 47,48 L 51,50 L 51,86 L 47,84 Z" fill="url(#decGoldGrad)" />
      <path d="M 73,50 L 77,48 L 77,84 L 73,86 Z" fill="url(#decGoldGrad)" />

      {/* Golden Bow on top */}
      <path
        d="M 62,28 C 50,14 36,15 42,24 C 47,31 58,29 62,28 Z"
        fill="url(#decGoldGrad)"
        stroke="#fef08a"
        strokeWidth="0.8"
      />
      <path
        d="M 62,28 C 74,14 88,15 82,24 C 77,31 66,29 62,28 Z"
        fill="url(#decGoldGrad)"
        stroke="#fef08a"
        strokeWidth="0.8"
      />
      <ellipse cx="62" cy="27" rx="3.5" ry="3" fill="#fef08a" />
      <path d="M 62,28 Q 54,34 50,42 Q 54,38 62,31 Z" fill="#d97706" />
      <path d="M 62,28 Q 70,34 74,42 Q 70,38 62,31 Z" fill="#d97706" />

      {/* Mini Gold Gift Box in Front */}
      <g transform="translate(6, 44)">
        <ellipse cx="22" cy="40" rx="18" ry="5" fill="rgba(0,0,0,0.4)" />
        <rect x="8" y="18" width="28" height="20" rx="2" fill="url(#decMiniGold)" stroke="#fef08a" strokeWidth="0.8" />
        <rect x="6" y="14" width="32" height="6" rx="1.5" fill="#fef08a" />
        <rect x="19" y="14" width="6" height="24" fill="#0f172a" />
        <path d="M 22,14 C 16,7 9,8 13,12 C 16,15 20,14 22,14 Z" fill="#fef08a" />
        <path d="M 22,14 C 28,7 35,8 31,12 C 28,15 24,14 22,14 Z" fill="#fef08a" />
        <circle cx="22" cy="14" r="2" fill="#d97706" />
      </g>
    </svg>
  );
}

/** 3D-styled decorative navy and gold gift box (flanking the bottom-right of the wheel) */
function DecorativeGiftBoxRight() {
  return (
    <svg
      viewBox="0 0 100 95"
      className="w-15 h-15 sm:w-20 sm:h-19 drop-shadow-[0_12px_20px_rgba(0,0,0,0.7)]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="decNavyGradR1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0a192f" />
        </linearGradient>
        <linearGradient id="decNavyGradR2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2d4a77" />
          <stop offset="100%" stopColor="#112240" />
        </linearGradient>
        <linearGradient id="decGoldGradR" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>

      <ellipse cx="50" cy="84" rx="34" ry="9" fill="rgba(0,0,0,0.5)" />

      <path d="M 24,40 L 24,76 L 50,88 L 50,50 Z" fill="url(#decNavyGradR1)" />
      <path d="M 50,50 L 50,88 L 76,76 L 76,40 Z" fill="url(#decNavyGradR2)" />
      <path d="M 50,22 L 80,36 L 50,50 L 20,36 Z" fill="#243b55" stroke="#3b597d" strokeWidth="1" />
      <path d="M 20,36 L 20,42 L 50,56 L 50,50 Z" fill="#1b2d42" />
      <path d="M 50,50 L 50,56 L 80,42 L 80,36 Z" fill="#132133" />

      <path d="M 35,29 L 65,43 L 61,45 L 31,31 Z" fill="url(#decGoldGradR)" />
      <path d="M 65,29 L 35,43 L 39,45 L 69,31 Z" fill="url(#decGoldGradR)" />
      <path d="M 35,44 L 39,46 L 39,82 L 35,80 Z" fill="url(#decGoldGradR)" />
      <path d="M 61,46 L 65,44 L 65,80 L 61,82 Z" fill="url(#decGoldGradR)" />

      <path
        d="M 50,24 C 38,10 24,11 30,20 C 35,27 46,25 50,24 Z"
        fill="url(#decGoldGradR)"
        stroke="#fef08a"
        strokeWidth="0.8"
      />
      <path
        d="M 50,24 C 62,10 76,11 70,20 C 65,27 54,25 50,24 Z"
        fill="url(#decGoldGradR)"
        stroke="#fef08a"
        strokeWidth="0.8"
      />
      <ellipse cx="50" cy="23" rx="3.5" ry="3" fill="#fef08a" />
      <path d="M 50,24 Q 42,30 38,38 Q 42,34 50,27 Z" fill="#d97706" />
      <path d="M 50,24 Q 58,30 62,38 Q 58,34 50,27 Z" fill="#d97706" />
    </svg>
  );
}

interface SpinWheelProps {
  segments?: SpinSegment[];
  token?: string;
  orderNumber?: string;
  reviewToken?: string;
  onRewardWon?: (prize: WonPrize | { label: string; code: string }) => void;
  className?: string;
  isPreview?: boolean;
  canSpin?: boolean;
}

interface ConfettiParticle {
  id: number;
  color: string;
  dx: string;
  dy: string;
  rot: string;
  size: number;
  shape: 'rect' | 'circle';
  delay: string;
}

export default function SpinWheel({
  segments: propSegments,
  token,
  orderNumber,
  reviewToken,
  onRewardWon,
  className = '',
  isPreview = false,
  canSpin = true,
}: SpinWheelProps) {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [fetchedSegments, setFetchedSegments] = useState<SpinSegment[] | null>(null);
  // Normalize segments
  const segments = useMemo(() => {
    if (propSegments && propSegments.length >= 2) return propSegments;
    if (fetchedSegments && fetchedSegments.length >= 2) return fetchedSegments;
    return DEFAULT_SEGMENTS;
  }, [propSegments, fetchedSegments]);

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
    claimToken?: string;
    rewardType?: WonPrize['reward_type'];
    value?: number;
    targetProduct?: string | null;
  } | null>(null);
  const [startingDesignQuery, setStartingDesignQuery] = useState(false);
  const [designQueryError, setDesignQueryError] = useState<string | null>(null);
  const autoOpenedDesignQuery = useRef(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'claimed' | 'error'>('idle');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isTicking, setIsTicking] = useState(false);
  const [confettiList, setConfettiList] = useState<ConfettiParticle[]>([]);
  const [serverSpinToken, setServerSpinToken] = useState<string | null>(token || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eligibilityState, setEligibilityState] = useState<'loading' | 'ready' | 'unavailable'>(
    token || orderNumber || reviewToken ? 'loading' : isPreview ? 'ready' : 'unavailable'
  );

  const rewardReturnParams = new URLSearchParams();
  if (token) rewardReturnParams.set('token', token);
  if (orderNumber) rewardReturnParams.set('order', orderNumber);
  if (reviewToken) rewardReturnParams.set('review_token', reviewToken);
  const rewardReturnUrl = `/rewards/spin?${rewardReturnParams.toString()}`;
  const registerUrl = `/register?redirect=${encodeURIComponent(rewardReturnUrl)}`;

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
      if (!token && !orderNumber && !reviewToken) {
        setEligibilityState('unavailable');
        setErrorMessage('Open your personal Spin Wheel invitation link to use this wheel.');
        return;
      }
      setEligibilityState('loading');
      setErrorMessage(null);
      try {
        const data = await spinWinService.checkEligibility(
          orderNumber,
          reviewToken,
          token
        );
        if (data.spin_token) {
          setServerSpinToken(data.spin_token);
        }
        const hasSavedPrize = Boolean(data.has_spun && data.prize);
        if (!data.eligible || (!data.spin_token && !hasSavedPrize)) {
          setEligibilityState('unavailable');
          setErrorMessage(data.reason || 'This Spin Wheel invitation is not available. Please contact us for help.');
          return;
        }
        if (data.wheel_segments && data.wheel_segments.length >= 2) {
          setFetchedSegments(data.wheel_segments.map((segment: any, index: number) => ({
            // Prefer the short customer-facing badge so text stays clean on the slice.
            label: segment.badge_text || segment.title || segment.code,
            code: segment.code,
            ...CUSTOMER_WHEEL_PALETTE[index % CUSTOMER_WHEEL_PALETTE.length],
            value: Number(segment.value || 0),
            type: segment.reward_type,
          })));
        } else {
          setEligibilityState('unavailable');
          setErrorMessage('The prize wheel is temporarily unavailable. Please try again later.');
          return;
        }
        if (data.has_spun && data.prize) {
          setWonPrize({
            title: data.prize.title,
            code: data.prize.reward_code,
            subtitle: data.prize.badge_text || 'Your saved reward voucher',
            expiresAt: data.prize.expires_at,
            claimToken: data.prize.claim_token || undefined,
            rewardType: data.prize.reward_type,
            value: data.prize.value,
            targetProduct: data.prize.target_product,
          });
          const segIdx = data.prize.segment_index ?? 0;
          setWinningIndex(segIdx);
          setShowResultModal(true);
          // Calculate angle so slice is positioned under pointer at top
          const targetAngle = 360 * 3 + (360 - (segIdx * sliceAngle + sliceAngle / 2));
          setRotationDegrees(targetAngle);
        }
        setEligibilityState('ready');
      } catch (err: any) {
        setEligibilityState('unavailable');
        setErrorMessage(err.response?.data?.message || 'Could not load your Spin Wheel. Check your connection and reopen the invitation link.');
      }
    };
    void fetchEligibility();
  }, [token, orderNumber, reviewToken, isPreview, sliceAngle]);

  const claimWonReward = useCallback(async () => {
    if (!wonPrize?.claimToken) return;
    setClaimStatus('claiming');
    setClaimError(null);
    try {
      await spinWinService.claimReward(wonPrize.claimToken);
      setClaimStatus('claimed');
    } catch (err: any) {
      setClaimError(err.response?.data?.message || 'Could not add this reward to your account. Sign in with the email that received the invitation.');
      setClaimStatus('error');
    }
  }, [wonPrize?.claimToken]);

  useEffect(() => {
    if (isAuthenticated && wonPrize?.claimToken && claimStatus === 'idle') {
      void claimWonReward();
    }
  }, [isAuthenticated, user?.id, wonPrize?.claimToken, claimStatus, claimWonReward]);

  const openDesignQuery = useCallback(async () => {
    if (!wonPrize?.claimToken || startingDesignQuery) return;
    setStartingDesignQuery(true);
    setDesignQueryError(null);
    try {
      const brief = await spinWinService.startDesignQueryFromReward(wonPrize.claimToken);
      window.location.href = `/client-brief/${brief.token}`;
    } catch (err: any) {
      setDesignQueryError(err.response?.data?.message || 'Could not start your design request. Please try again.');
      setStartingDesignQuery(false);
    }
  }, [wonPrize?.claimToken, startingDesignQuery]);

  useEffect(() => {
    if (!isPreview && claimStatus === 'claimed' && wonPrize?.claimToken && !autoOpenedDesignQuery.current) {
      autoOpenedDesignQuery.current = true;
      void openDesignQuery();
    }
  }, [isPreview, claimStatus, wonPrize?.claimToken, openDesignQuery]);

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
    if (!isPreview && (!canSpin || eligibilityState !== 'ready' || !(serverSpinToken || token))) {
      setErrorMessage('Your personal Spin Wheel link is still loading or is unavailable.');
      return;
    }
    setErrorMessage(null);
    setShowResultModal(false);

    let targetIndex = Math.floor(Math.random() * totalSlices);
    let resolvedPrize: { title: string; code: string; subtitle?: string; expiresAt?: string; claimToken?: string; rewardType?: WonPrize['reward_type']; value?: number; targetProduct?: string | null } | null = null;

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
            claimToken: serverPrize.claim_token || undefined,
            rewardType: serverPrize.reward_type,
            value: serverPrize.value,
            targetProduct: serverPrize.target_product,
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
        claimToken: undefined,
      };
    }

    setClaimStatus('idle');
    setClaimError(null);
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
      const targetOffset = 360 - (targetIndex * sliceAngle + sliceAngle / 2);
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
          const particles: ConfettiParticle[] = Array.from({ length: 68 }).map((_, i) => {
            const angle = (i * (360 / 68)) * (Math.PI / 180);
            const dist = 110 + Math.random() * 140;
            return {
              id: i,
              color: colors[i % colors.length],
              dx: `${Math.cos(angle) * dist}px`,
              dy: `${Math.sin(angle) * dist}px`,
              rot: `${Math.floor(Math.random() * 720) - 360}deg`,
              size: 7 + Math.random() * 5,
              shape: i % 3 === 0 ? 'circle' : 'rect',
              delay: `${Math.floor(Math.random() * 180)}ms`,
            };
          });
          setConfettiList(particles);
          window.setTimeout(() => setConfettiList([]), 2400);
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
  const size = 500;
  const center = size / 2;
  const radius = 214;

  return (
    <div className={`relative flex w-full max-w-[30rem] flex-col items-center justify-center select-none ${className}`}>
      {/* Background Breathing Glow Aura */}
      <div
        className="pointer-events-none absolute h-[440px] w-[440px] rounded-full bg-gradient-to-tr from-amber-500/15 via-violet-600/20 to-pink-500/15 blur-xl opacity-50"
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
        <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center overflow-visible">
          {confettiList.map(c => (
            <span
              key={c.id}
              style={{
                width: `${c.size}px`,
                height: c.shape === 'rect' ? `${c.size * 1.5}px` : `${c.size}px`,
                backgroundColor: c.color,
                borderRadius: c.shape === 'circle' ? '50%' : '2px',
                ['--dx' as string]: c.dx,
                ['--dy' as string]: c.dy,
                ['--rot' as string]: c.rot,
                animationDelay: c.delay,
              }}
              className="celebration-confetti absolute"
            />
          ))}
        </div>
      )}

      {/* Main Wheel Container */}
      <div
        className={`relative aspect-square w-full max-w-[420px] ${
          isSpinning ? 'fast' : ''
        }`}
      >
        {isSpinning && (
          <div aria-hidden="true" className="spin-celebration pointer-events-none absolute -inset-5 z-20 overflow-visible">
            <span className="spin-firework spin-firework-one">🎉</span>
            <span className="spin-firework spin-firework-two">🎊</span>
            <span className="spin-firework spin-firework-three">✨</span>
            {Array.from({ length: 12 }).map((_, index) => (
              <span
                key={index}
                className="spin-star"
                style={{
                  left: `${8 + ((index * 37) % 84)}%`,
                  top: `${7 + ((index * 53) % 86)}%`,
                  animationDelay: `${(index % 6) * 160}ms`,
                }}
              >
                {index % 3 === 0 ? '✦' : '✧'}
              </span>
            ))}
          </div>
        )}
        {/* Outer Gold Metallic Rim */}
        <div className="absolute inset-0 rounded-full border-[10px] border-amber-400 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 p-2 shadow-[0_0_45px_rgba(245,158,11,0.55),0_12px_32px_rgba(0,0,0,0.6)]">
          {/* Glowing Bulbs Ring (20 bulbs along the circumference) */}
          {Array.from({ length: 24 }).map((_, i) => {
            const bulbAngle = (i * 360) / 24;
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
              shapeRendering="geometricPrecision"
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
                const startDeg = -90 + idx * sliceAngle;
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

                const { line1, line2 } = formatSliceLabel(seg.label);
                const isCrowded = totalSlices > 7;
                const maxLineLength = Math.max(line1.length, line2.length);

                let line1FontSize = isCrowded ? 12 : 14;
                if (maxLineLength > 12) {
                  line1FontSize = isCrowded ? 9.5 : 11;
                } else if (maxLineLength > 8) {
                  line1FontSize = isCrowded ? 10.5 : 12.5;
                }
                const line2FontSize = Math.max(line1FontSize - 1.5, isCrowded ? 8.5 : 10);
                const textColor = seg.textColor || '#ffffff';

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

                    {/* Slice Content (Image 2 style: Gift Icon above text) */}
                    <g
                      transform={`translate(${center}, ${center}) rotate(${textAngle + 90})`}
                    >
                      {/* Gift Icon above the text */}
                      <g
                        transform={`translate(0, ${isCrowded ? -165 : -168})`}
                        filter="drop-shadow(0 2px 3px rgba(0,0,0,0.5))"
                      >
                        <g transform={`scale(${isCrowded ? 1.05 : 1.2}) translate(-12, -12)`}>
                          {/* Ribbon Bow Left Loop */}
                          <path
                            d="M 12,6.5 C 10,3.5 6.5,3.2 6.5,5.8 C 6.5,8 10,8.8 12,8.8 Z"
                            fill={textColor}
                            fillOpacity="0.32"
                            stroke={textColor}
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                          />
                          {/* Ribbon Bow Right Loop */}
                          <path
                            d="M 12,6.5 C 14,3.5 17.5,3.2 17.5,5.8 C 17.5,8 14,8.8 12,8.8 Z"
                            fill={textColor}
                            fillOpacity="0.32"
                            stroke={textColor}
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                          />
                          {/* Bow Knot */}
                          <circle cx="12" cy="6.8" r="1.4" fill={textColor} />

                          {/* Box Lid */}
                          <rect
                            x="3"
                            y="8.8"
                            width="18"
                            height="3.6"
                            rx="1.2"
                            fill={textColor}
                            fillOpacity="0.28"
                            stroke={textColor}
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                          />

                          {/* Box Body */}
                          <path
                            d="M 4.5,12.4 L 4.5,19.2 C 4.5,20.4 5.4,21.2 6.5,21.2 L 17.5,21.2 C 18.6,21.2 19.5,20.4 19.5,19.2 L 19.5,12.4 Z"
                            fill={textColor}
                            fillOpacity="0.2"
                            stroke={textColor}
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                          />

                          {/* Vertical Center Ribbon */}
                          <line
                            x1="12"
                            y1="8.8"
                            x2="12"
                            y2="21.2"
                            stroke={textColor}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </g>
                      </g>

                      {/* Slice Text Content below the Gift Icon */}
                      {/* Line 1 */}
                      <text
                        x="0"
                        y={line2 ? (isCrowded ? -138 : -140) : (isCrowded ? -132 : -134)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={textColor}
                        className="font-black tracking-tight"
                        style={{
                          fontSize: `${line1FontSize}px`,
                          fontWeight: 900,
                          filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,0.7))',
                        }}
                      >
                        {line1}
                      </text>

                      {/* Line 2 (if present) */}
                      {line2 && (
                        <text
                          x="0"
                          y={isCrowded ? -122 : -123}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={textColor}
                          className="font-black tracking-tight"
                          style={{
                            fontSize: `${line2FontSize}px`,
                            fontWeight: 800,
                            filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,0.7))',
                          }}
                        >
                          {line2}
                        </text>
                      )}

                      {/* Sub-label (if present) */}
                      {seg.sub && (
                        <text
                          x="0"
                          y={isCrowded ? -107 : -106}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#fef08a"
                          className="font-bold uppercase tracking-wider"
                          style={{
                            fontSize: isCrowded ? '7.5px' : '8.5px',
                            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.75))',
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
            disabled={isSpinning || (!isPreview && (!canSpin || eligibilityState !== 'ready'))}
            aria-label="Spin the wheel"
            className="group relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-4 border-amber-300 bg-gradient-to-tr from-amber-700 via-amber-500 to-yellow-300 font-black tracking-widest text-slate-950 uppercase shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.7)] transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-90"
          >
            {/* Inner Ring with Metallic Sheen */}
            <div className="flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-full border border-amber-200/60 bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 shadow-inner">
              <span className="text-sm sm:text-base font-black text-amber-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                {isSpinning ? 'SPINNING' : eligibilityState === 'loading' && !isPreview ? 'LOADING' : eligibilityState === 'unavailable' && !isPreview ? 'LOCKED' : 'SPIN'}
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

        {/* Decorative Sparkle Stars Around Wheel Frame (Image 2 style) */}
        <span aria-hidden="true" className="pointer-events-none absolute -top-1 left-3 z-20 text-lg text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.85)] animate-pulse">✦</span>
        <span aria-hidden="true" className="pointer-events-none absolute top-4 -right-1 z-20 text-xl text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.85)] animate-pulse" style={{ animationDelay: '350ms' }}>✦</span>
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 -left-3 z-20 text-sm text-yellow-200 drop-shadow-[0_0_6px_rgba(254,240,138,0.7)] animate-pulse" style={{ animationDelay: '700ms' }}>✧</span>
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 -right-3 z-20 text-sm text-yellow-200 drop-shadow-[0_0_6px_rgba(254,240,138,0.7)] animate-pulse" style={{ animationDelay: '1050ms' }}>✧</span>

        {/* Decorative 3D Gift Boxes Flanking the Wheel (Image 2 style) */}
        {/* Bottom-Left: Navy Gift Box with Gold Ribbon + Mini Gold Box */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3 -left-3 sm:-bottom-5 sm:-left-5 z-30 transition-transform duration-300 hover:scale-105"
        >
          <DecorativeGiftBoxLeft />
        </div>

        {/* Bottom-Right: Navy Gift Box with Gold Ribbon */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3 -right-3 sm:-bottom-5 sm:-right-5 z-30 transition-transform duration-300 hover:scale-105"
        >
          <DecorativeGiftBoxRight />
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
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,rgba(124,58,237,0.38),transparent_55%),radial-gradient(ellipse_at_50%_100%,rgba(245,158,11,0.2),transparent_50%),rgba(2,6,23,0.86)] p-4 backdrop-blur-lg"
          style={{ animation: 'fadeIn 0.25s ease-out' }}
        >
          {!NO_CONFETTI_LABELS.some((text) => wonPrize.title.toUpperCase().includes(text)) && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
              {[
                { emoji: '🎉', left: '9%', top: '22%', delay: '0ms' },
                { emoji: '✨', left: '19%', top: '72%', delay: '100ms' },
                { emoji: '🎊', left: '83%', top: '20%', delay: '180ms' },
                { emoji: '🥳', left: '89%', top: '69%', delay: '60ms' },
                { emoji: '💫', left: '50%', top: '10%', delay: '220ms' },
                { emoji: '✨', left: '5%', top: '50%', delay: '280ms' },
                { emoji: '🎉', left: '92%', top: '47%', delay: '140ms' },
              ].map((item, index) => (
                <span
                  key={`${item.emoji}-${index}`}
                  className="celebration-emoji absolute text-3xl drop-shadow-[0_4px_16px_rgba(251,191,36,0.55)] sm:text-4xl"
                  style={{ left: item.left, top: item.top, animationDelay: item.delay }}
                >
                  {item.emoji}
                </span>
              ))}
            </div>
          )}
          <div
            className="celebration-card relative z-[55] w-full max-w-sm rounded-[2rem] border border-amber-300/40 bg-gradient-to-b from-slate-900/95 via-indigo-950/95 to-slate-950/95 p-6 text-center text-white shadow-[0_24px_100px_rgba(0,0,0,0.65),0_0_55px_rgba(245,158,11,0.18)] backdrop-blur-xl sm:p-7"
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
            <div className="celebration-medallion mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-white/50 bg-gradient-to-tr from-amber-300 via-yellow-200 to-amber-500 text-amber-950 shadow-[0_0_34px_rgba(251,191,36,0.38)]">
              <Trophy size={28} />
            </div>

            {/* Congratulations Headline */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.12em] text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.12)]">
              <span aria-hidden="true">🎉</span> YOU DID IT! <span aria-hidden="true">🎉</span>
            </span>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-200/80">Your wheel reward</p>
            <h3 className="mt-1 text-2xl font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300 sm:text-3xl">
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

            {wonPrize.claimToken && (
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-3 text-left">
                {claimStatus === 'claimed' ? (
                  <div className="flex items-start gap-2 text-emerald-200">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Reward added to your account</p>
                      <p className="mt-1 text-[10px] text-slate-300">
                        {wonPrize.rewardType === 'print_credit' ? `AUD $${Number(wonPrize.value || 0).toFixed(2)} is now in your Print Bank.` : 'You can find this reward in My Print Bank.'}
                      </p>
                      <Link href="/account" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 hover:text-emerald-100">View My Print Bank <ArrowRight className="h-3 w-3" /></Link>
                    </div>
                  </div>
                ) : isAuthenticated ? (
                  <div>
                    <p className="text-xs font-bold text-white">Save this reward to your account</p>
                    <p className="mt-1 text-[10px] text-slate-300">Signed in as {user?.email}. Use the email that received this invitation.</p>
                    {claimStatus === 'claiming' && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-200"><Loader2 className="h-3 w-3 animate-spin" /> Adding reward to your Print Bank…</p>}
                    {claimError && <p role="alert" className="mt-2 text-[10px] text-rose-300">{claimError}</p>}
                    {claimStatus === 'error' && <button type="button" onClick={() => void claimWonReward()} className="mt-2 text-[10px] font-bold text-amber-200 underline">Try again</button>}
                    {claimStatus === 'error' && <button type="button" onClick={async () => { await logout(); setClaimStatus('idle'); setClaimError(null); }} className="ml-3 mt-2 text-[10px] font-bold text-sky-200 underline">Use another account</button>}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-white">Log in to add this reward to your account</p>
                    <p className="mt-1 text-[10px] text-slate-300">{wonPrize.rewardType === 'print_credit' ? `Your AUD $${Number(wonPrize.value || 0).toFixed(2)} print credit will appear in your Print Bank.` : 'Keep this reward in your account and use it on a future order.'}</p>
                    <form className="mt-3 space-y-2" onSubmit={async (event) => {
                      event.preventDefault();
                      setClaimError(null);
                      try {
                        await login({ email: claimEmail.trim(), password: claimPassword });
                      } catch (err: any) {
                        setClaimError(err.response?.data?.message || err.message || 'Login failed. Check your email and password.');
                      }
                    }}>
                      <input type="email" required autoComplete="email" value={claimEmail} onChange={(event) => setClaimEmail(event.target.value)} placeholder="Email used for this invitation" className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-white outline-none focus:border-amber-300" />
                      <input type="password" required autoComplete="current-password" value={claimPassword} onChange={(event) => setClaimPassword(event.target.value)} placeholder="Password" className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-white outline-none focus:border-amber-300" />
                      {claimError && <p role="alert" className="text-[10px] text-rose-300">{claimError}</p>}
                      <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2.5 text-xs font-extrabold text-emerald-950 transition hover:bg-emerald-400"><Lock className="h-3.5 w-3.5" /> Log in &amp; save reward</button>
                    </form>
                    <p className="mt-2 text-center text-[10px] text-slate-400">New here? <Link href={registerUrl} className="font-bold text-amber-200 underline">Create an account</Link></p>
                  </div>
                )}
              </div>
            )}
            {wonPrize.targetProduct && <p className="mt-3 rounded-xl bg-violet-500/10 px-3 py-2 text-left text-xs text-violet-100">Reward applies to: <strong>{wonPrize.targetProduct}</strong>{wonPrize.rewardType === 'product_discount' ? ` · ${wonPrize.value}% off` : wonPrize.rewardType === 'free_product' ? ' · one free unit' : ''}</p>}
            {wonPrize.claimToken && claimStatus === 'claimed' && (
              <div className="mt-3">
                <button type="button" disabled={startingDesignQuery} onClick={() => void openDesignQuery()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg disabled:opacity-60">
                  {startingDesignQuery ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {startingDesignQuery ? 'Opening design request…' : 'Upload artwork / start design query'}
                </button>
                {designQueryError && <p role="alert" className="mt-2 text-left text-xs text-rose-300">{designQueryError}</p>}
              </div>
            )}

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
