'use client';

import { useEffect, useState } from 'react';

type RewardExpiryCountdownProps = { expiresAt?: string | null; className?: string };

export default function RewardExpiryCountdown({ expiresAt, className = '' }: RewardExpiryCountdownProps) {
  const expiryTime = expiresAt ? new Date(expiresAt).getTime() : NaN;
  const [remainingMs, setRemainingMs] = useState(() => Number.isFinite(expiryTime) ? Math.max(0, expiryTime - Date.now()) : null);

  useEffect(() => {
    if (!Number.isFinite(expiryTime)) {
      setRemainingMs(null);
      return;
    }
    const update = () => setRemainingMs(Math.max(0, expiryTime - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiryTime]);

  if (remainingMs === null) return null;
  if (remainingMs <= 0) return <p role="status" className={`font-bold text-rose-300 ${className}`}>This reward has expired. The discount code can no longer be used.</p>;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return <p aria-live="off" className={`font-semibold text-amber-200 ${className}`}>Use your reward before it expires: <span className="font-mono tabular-nums">{days}d {hours}h {minutes}m {seconds}s</span> remaining</p>;
}
