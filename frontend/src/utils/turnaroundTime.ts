/**
 * Turnaround Time and Deadline Calculation Utilities
 */

export type TurnaroundStatus =
  | 'completed'
  | 'not_set'
  | 'on_track'
  | 'due_soon'
  | 'urgent'
  | 'overdue';

export interface TurnaroundComputation {
  status: TurnaroundStatus;
  statusLabel: string;
  remainingText: string;
  completionDateFormatted: string;
  elapsedPercent: number;
  badgeClass: string;
  progressBarClass: string;
  isOverdue: boolean;
  isCompleted: boolean;
}

/**
 * Calculates deadline date based on start date, duration, unit, and business/calendar days.
 */
export function calculateTurnaroundDeadline(
  startDate: Date,
  value: number,
  unit: 'hours' | 'days' = 'days',
  dayType: 'business' | 'calendar' = 'business'
): Date {
  const result = new Date(startDate.getTime());

  if (unit === 'hours') {
    result.setTime(result.getTime() + value * 60 * 60 * 1000);
    return result;
  }

  if (dayType === 'calendar') {
    result.setDate(result.getDate() + value);
    return result;
  }

  // Business days: skip Saturday (6) and Sunday (0)
  let added = 0;
  while (added < value) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }

  return result;
}

/**
 * Formats a Date into standard readable string: e.g. "28 Oct 2026, 05:00 PM"
 */
export function formatTurnaroundDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  return d.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Computes live countdown, progress bar percentage, and status for a given order.
 */
export function computeTurnaroundState(
  estimatedCompletionAt: string | null | undefined,
  startedAt: string | null | undefined,
  nowTimestamp: number,
  orderStatus: string,
  durationValue?: number | null,
  durationUnit?: string | null
): TurnaroundComputation {
  const rawStatus = String(orderStatus || '').toLowerCase().trim();
  const normalizedStatus = rawStatus.replace(/[\s-]+/g, '_');

  const isCompleted =
    [
      'delivered',
      'collected',
      'completed',
      'ready_for_pickup',
      'ready_to_pickup',
      'ready_for_shipping',
      'ready_for_collection',
    ].includes(normalizedStatus) ||
    [
      'delivered',
      'collected',
      'completed',
      'ready for pickup',
      'ready to pickup',
      'ready for shipping',
      'ready for collection',
    ].includes(rawStatus) ||
    (rawStatus.includes('ready') && rawStatus.includes('pickup'));

  if (isCompleted) {
    return {
      status: 'completed',
      statusLabel: 'Completed',
      remainingText: 'Order completed',
      completionDateFormatted: estimatedCompletionAt
        ? formatTurnaroundDate(estimatedCompletionAt)
        : 'Completed',
      elapsedPercent: 100,
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
      progressBarClass: 'bg-emerald-500/70',
      isOverdue: false,
      isCompleted: true,
    };
  }

  if (!estimatedCompletionAt) {
    return {
      status: 'not_set',
      statusLabel: 'Not set',
      remainingText: 'No deadline set',
      completionDateFormatted: 'ETA not set',
      elapsedPercent: 0,
      badgeClass: 'bg-slate-800 text-slate-400 border border-slate-700',
      progressBarClass: 'bg-slate-700',
      isOverdue: false,
      isCompleted: false,
    };
  }

  const deadline = new Date(estimatedCompletionAt).getTime();
  if (isNaN(deadline)) {
    return {
      status: 'not_set',
      statusLabel: 'Invalid date',
      remainingText: 'Invalid deadline',
      completionDateFormatted: 'Invalid date',
      elapsedPercent: 0,
      badgeClass: 'bg-slate-800 text-slate-400 border border-slate-700',
      progressBarClass: 'bg-slate-700',
      isOverdue: false,
      isCompleted: false,
    };
  }

  // Calculate start time
  let start = startedAt ? new Date(startedAt).getTime() : 0;
  if (!start || isNaN(start)) {
    // If no start time saved, estimate start based on duration if available, or default to 2 days before deadline
    if (durationValue && durationValue > 0) {
      const ms = (durationUnit === 'hours' ? durationValue * 3600 : durationValue * 86400) * 1000;
      start = deadline - ms;
    } else {
      start = deadline - 2 * 86400 * 1000;
    }
  }

  const totalDuration = Math.max(1, deadline - start);
  const elapsed = Math.max(0, nowTimestamp - start);
  const remainingMs = deadline - nowTimestamp;
  const elapsedPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  const isOverdue = remainingMs <= 0;

  // Format remaining or overdue text
  let remainingText = '';
  const diffMs = Math.abs(remainingMs);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  let timeString = '';
  if (days > 0) {
    timeString = `${days}d ${hours}h`;
  } else if (hours > 0) {
    timeString = `${hours}h ${minutes}m`;
  } else {
    timeString = `${Math.max(1, minutes)}m`;
  }

  if (isOverdue) {
    remainingText = `Overdue by ${timeString}`;
  } else {
    remainingText = `${timeString} remaining`;
  }

  // Determine status & color scheme based on remaining hours
  // Green: > 48 hours remaining (On track)
  // Yellow: 24 - 48 hours remaining (Due soon)
  // Orange: < 24 hours remaining (Urgent)
  // Red: deadline passed (Overdue)
  const remainingHours = remainingMs / (1000 * 60 * 60);

  if (isOverdue) {
    return {
      status: 'overdue',
      statusLabel: 'Overdue',
      remainingText,
      completionDateFormatted: formatTurnaroundDate(estimatedCompletionAt),
      elapsedPercent: 100,
      badgeClass:
        'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse',
      progressBarClass: 'bg-gradient-to-r from-rose-600 to-red-500 shadow-xs shadow-red-500/40',
      isOverdue: true,
      isCompleted: false,
    };
  }

  if (remainingHours < 24) {
    return {
      status: 'urgent',
      statusLabel: 'Urgent',
      remainingText,
      completionDateFormatted: formatTurnaroundDate(estimatedCompletionAt),
      elapsedPercent,
      badgeClass: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
      progressBarClass:
        'bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600 shadow-xs shadow-orange-500/30',
      isOverdue: false,
      isCompleted: false,
    };
  }

  if (remainingHours <= 48) {
    return {
      status: 'due_soon',
      statusLabel: 'Due soon',
      remainingText,
      completionDateFormatted: formatTurnaroundDate(estimatedCompletionAt),
      elapsedPercent,
      badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      progressBarClass:
        'bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500',
      isOverdue: false,
      isCompleted: false,
    };
  }

  return {
    status: 'on_track',
    statusLabel: 'On track',
    remainingText,
    completionDateFormatted: formatTurnaroundDate(estimatedCompletionAt),
    elapsedPercent,
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    progressBarClass: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    isOverdue: false,
    isCompleted: false,
  };
}
