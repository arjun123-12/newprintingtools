'use client';

import React from 'react';
import { computeTurnaroundState } from '@/utils/turnaroundTime';
import { Clock, CheckCircle2, AlertCircle, Plus, Pencil } from 'lucide-react';

interface TurnaroundCellProps {
  estimatedCompletionAt?: string | null;
  startedAt?: string | null;
  orderStatus: string;
  durationValue?: number | null;
  durationUnit?: string | null;
  now: number;
  onEdit: () => void;
}

export default function TurnaroundCell({
  estimatedCompletionAt,
  startedAt,
  orderStatus,
  durationValue,
  durationUnit,
  now,
  onEdit,
}: TurnaroundCellProps) {
  const turnaround = computeTurnaroundState(
    estimatedCompletionAt,
    startedAt,
    now,
    orderStatus,
    durationValue,
    durationUnit
  );

  // When no turnaround deadline is configured
  if (turnaround.status === 'not_set') {
    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 bg-slate-800/60 hover:bg-slate-800 hover:text-sky-300 border border-slate-700/80 transition-all group"
          title="Click to set turnaround duration or deadline"
        >
          <Clock className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
          <span>Not set</span>
          <span className="text-[10px] text-sky-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            + Set ETA
          </span>
        </button>
      </div>
    );
  }

  // When order has reached a completed status (delivered, collected, completed)
  if (turnaround.status === 'completed') {
    return (
      <div className="space-y-1.5 min-w-[155px] max-w-[210px]">
        <div className="flex items-center justify-between gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition opacity-0 group-hover:opacity-100"
            title="Edit turnaround settings"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>

        <div className="text-[11px] text-slate-400 truncate font-mono">
          {turnaround.completionDateFormatted}
        </div>

        {/* Compact completed bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full w-full bg-emerald-500/60 rounded-full" />
        </div>
      </div>
    );
  }

  // Active or Overdue Countdown with Animated Progress Bar
  return (
    <div className="space-y-1.5 min-w-[170px] max-w-[230px] group/turnaround">
      {/* Top Row: Status Badge & Live Remaining Countdown */}
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${turnaround.badgeClass}`}
        >
          {turnaround.isOverdue ? (
            <AlertCircle className="w-3 h-3 animate-pulse" />
          ) : (
            <Clock className="w-3 h-3" />
          )}
          <span>{turnaround.statusLabel}</span>
        </span>

        <button
          type="button"
          onClick={onEdit}
          className="p-1 rounded text-slate-500 hover:text-sky-300 hover:bg-slate-800 transition opacity-60 hover:opacity-100"
          title="Edit deadline or duration"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>

      {/* Countdown and Deadline */}
      <div className="flex flex-col">
        <span
          className={`text-xs font-mono font-bold leading-tight ${
            turnaround.isOverdue
              ? 'text-rose-400'
              : turnaround.status === 'urgent'
              ? 'text-orange-400'
              : turnaround.status === 'due_soon'
              ? 'text-amber-300'
              : 'text-emerald-400'
          }`}
        >
          {turnaround.remainingText}
        </span>
        <span className="text-[10px] text-slate-400 mt-0.5 truncate font-mono" title={turnaround.completionDateFormatted}>
          ETA: {turnaround.completionDateFormatted}
        </span>
      </div>

      {/* Smooth Animated Horizontal Progress Bar */}
      <div
        className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden p-0.2 border border-slate-700/60 shadow-2xs"
        title={`Elapsed time: ${Math.round(turnaround.elapsedPercent)}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out motion-reduce:transition-none ${turnaround.progressBarClass}`}
          style={{ width: `${turnaround.elapsedPercent}%` }}
        />
      </div>
    </div>
  );
}
