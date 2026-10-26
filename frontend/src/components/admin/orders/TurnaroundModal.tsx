'use client';

import React, { useState, useEffect } from 'react';
import {
  calculateTurnaroundDeadline,
  formatTurnaroundDate,
  computeTurnaroundState,
} from '@/utils/turnaroundTime';
import { manualOrderService } from '@/services/admin/manualOrderService';
import {
  Clock,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface TurnaroundModalProps {
  orderId: string;
  orderNumber: string;
  currentDurationValue?: number | null;
  currentDurationUnit?: string | null;
  currentDayType?: string | null;
  currentStartedAt?: string | null;
  currentEstimatedCompletionAt?: string | null;
  currentTimezone?: string;
  orderStatus: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedTurnaround: any) => void;
}

const PRESETS = [
  { id: '24h', label: '24 Hours', value: 24, unit: 'hours', dayType: 'calendar' as const },
  { id: '2d_biz', label: '2 Business Days', value: 2, unit: 'days', dayType: 'business' as const },
  { id: '3d_biz', label: '3 Business Days', value: 3, unit: 'days', dayType: 'business' as const },
  { id: '5d_biz', label: '5 Business Days', value: 5, unit: 'days', dayType: 'business' as const },
  { id: 'custom', label: 'Custom Duration', value: 0, unit: 'days', dayType: 'business' as const },
];

export default function TurnaroundModal({
  orderId,
  orderNumber,
  currentDurationValue,
  currentDurationUnit,
  currentDayType,
  currentStartedAt,
  currentEstimatedCompletionAt,
  currentTimezone = 'Australia/Sydney',
  orderStatus,
  isOpen,
  onClose,
  onSuccess,
}: TurnaroundModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('3d_biz');
  const [durationValue, setDurationValue] = useState<number>(3);
  const [durationUnit, setDurationUnit] = useState<'hours' | 'days'>('days');
  const [dayType, setDayType] = useState<'business' | 'calendar'>('business');
  const [customDeadline, setCustomDeadline] = useState<string>('');
  const [useExactDeadline, setUseExactDeadline] = useState<boolean>(false);
  const [startClockNow, setStartClockNow] = useState<boolean>(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from current props when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (currentDurationValue) {
        setDurationValue(currentDurationValue);
        const unit = (currentDurationUnit === 'hours' ? 'hours' : 'days') as 'hours' | 'days';
        const dType = (currentDayType === 'calendar' ? 'calendar' : 'business') as 'business' | 'calendar';
        setDurationUnit(unit);
        setDayType(dType);

        // Find matching preset
        const matched = PRESETS.find(
          (p) => p.value === currentDurationValue && p.unit === unit && p.dayType === dType
        );
        setSelectedPreset(matched ? matched.id : 'custom');
      } else {
        setSelectedPreset('3d_biz');
        setDurationValue(3);
        setDurationUnit('days');
        setDayType('business');
      }

      if (currentEstimatedCompletionAt) {
        // Convert to local datetime string format: YYYY-MM-DDTHH:mm
        const d = new Date(currentEstimatedCompletionAt);
        if (!isNaN(d.getTime())) {
          const tzOffset = d.getTimezoneOffset() * 60000;
          const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
          setCustomDeadline(localISOTime);
        }
      } else {
        setCustomDeadline('');
      }

      setUseExactDeadline(Boolean(currentEstimatedCompletionAt && !currentDurationValue));
      setStartClockNow(Boolean(!currentStartedAt));
    }
  }, [
    isOpen,
    currentDurationValue,
    currentDurationUnit,
    currentDayType,
    currentStartedAt,
    currentEstimatedCompletionAt,
  ]);

  if (!isOpen) return null;

  // Handle Preset selection
  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    setUseExactDeadline(false);
    const p = PRESETS.find((x) => x.id === presetId);
    if (p && p.id !== 'custom') {
      setDurationValue(p.value);
      setDurationUnit(p.unit as 'hours' | 'days');
      setDayType(p.dayType);
    }
  };

  // Calculate live preview of completion date
  const computePreview = () => {
    if (useExactDeadline && customDeadline) {
      const parsed = new Date(customDeadline);
      if (!isNaN(parsed.getTime())) {
        return {
          deadlineDate: parsed,
          formatted: formatTurnaroundDate(parsed),
        };
      }
    }

    const start = (startClockNow || !currentStartedAt)
      ? new Date()
      : new Date(currentStartedAt);

    const deadline = calculateTurnaroundDeadline(
      start,
      Math.max(1, durationValue),
      durationUnit,
      dayType
    );

    return {
      deadlineDate: deadline,
      formatted: formatTurnaroundDate(deadline),
    };
  };

  const preview = computePreview();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let finalEstimatedCompletion: string | null = null;
      if (useExactDeadline && customDeadline) {
        const d = new Date(customDeadline);
        if (!isNaN(d.getTime())) {
          finalEstimatedCompletion = d.toISOString();
        }
      } else if (preview.deadlineDate) {
        finalEstimatedCompletion = preview.deadlineDate.toISOString();
      }

      const payload = {
        turnaround_duration_value: useExactDeadline ? null : durationValue,
        turnaround_duration_unit: useExactDeadline ? null : durationUnit,
        turnaround_day_type: useExactDeadline ? 'business' : dayType,
        estimated_completion_at: finalEstimatedCompletion,
        start_clock_now: startClockNow,
      };

      const res = await manualOrderService.updateTurnaround(orderId, payload);
      if (res.success) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.message || 'Failed to update turnaround time.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update turnaround time.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Turnaround Time &amp; Deadline</h3>
              <p className="text-xs text-slate-400">Order {orderNumber} · Admin Only</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Turnaround Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESETS.map((p) => {
                const isSelected = !useExactDeadline && selectedPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-center transition-all border ${
                      isSelected
                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-xs'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setUseExactDeadline(true)}
                className={`px-3 py-2 rounded-xl text-xs font-medium text-center transition-all border ${
                  useExactDeadline
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Exact Deadline Date
              </button>
            </div>
          </div>

          {/* Custom Duration Controls (when Custom preset selected) */}
          {!useExactDeadline && selectedPreset === 'custom' && (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3 animate-in fade-in duration-150">
              <span className="text-xs font-semibold text-slate-300">Custom Duration Settings</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Duration Value</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={durationValue}
                    onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Unit</label>
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value as 'hours' | 'days')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="days">Days</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Day Calculation</label>
                  <select
                    value={dayType}
                    disabled={durationUnit === 'hours'}
                    onChange={(e) => setDayType(e.target.value as 'business' | 'calendar')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 disabled:opacity-50"
                  >
                    <option value="business">Business Days (Mon-Fri)</option>
                    <option value="calendar">Calendar Days (All)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Exact Deadline Picker (when chosen) */}
          {useExactDeadline && (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2 animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-slate-300">
                Exact Estimated Completion Deadline
              </label>
              <input
                type="datetime-local"
                value={customDeadline}
                onChange={(e) => setCustomDeadline(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <p className="text-[11px] text-slate-500">
                Manually set exact completion date &amp; time. Overrides automatic calculation.
              </p>
            </div>
          )}

          {/* Start Clock Option */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-800">
            <input
              type="checkbox"
              id="startClockNow"
              checked={startClockNow}
              onChange={(e) => setStartClockNow(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 bg-slate-900 border-slate-700 focus:ring-sky-500"
            />
            <label htmlFor="startClockNow" className="text-xs text-slate-300 cursor-pointer select-none">
              Start turnaround clock now
              {currentStartedAt && (
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Currently started: {formatTurnaroundDate(currentStartedAt)}
                </span>
              )}
            </label>
          </div>

          {/* Live Preview Box */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                Estimated Completion (ETA)
              </span>
              <p className="text-sm font-bold text-sky-400 mt-0.5 font-mono">
                {preview.formatted || 'Calculating…'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Timezone: <span className="text-slate-400 font-medium">{currentTimezone}</span>
              </p>
            </div>
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-sm transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save Turnaround</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
