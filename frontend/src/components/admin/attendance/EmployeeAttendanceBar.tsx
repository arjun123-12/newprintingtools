'use client';

import React, { useState, useMemo } from 'react';
import { LogIn, Coffee, LogOut, Clock, Timer, Info } from 'lucide-react';
import { useAttendance } from '@/context/AttendanceContext';
import { useAuth } from '@/context/AuthContext';

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const EmployeeAttendanceBar: React.FC = () => {
  const { user } = useAuth();
  const {
    attendance,
    status,
    sessionDurationSeconds,
    currentBreakDurationSeconds,
    totalBreakSeconds,
    isActionLoading,
    attendanceLogin,
    attendanceLogout,
    startBreak,
    endBreak,
  } = useAttendance();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isClockedIn = status !== 'logged_out';
  const isOnBreak = status === 'on_break';

  // Status configuration matching requirements (Active: Green, Idle: Orange, On Break: Amber, Logged Out: Grey)
  const statusConfig = useMemo(() => {
    switch (status) {
      case 'active':
        return {
          label: 'Active',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotClass: 'bg-emerald-500',
        };
      case 'idle':
        return {
          label: 'Idle',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          dotClass: 'bg-amber-500 animate-pulse',
        };
      case 'on_break':
        return {
          label: `On Break (${formatTimer(currentBreakDurationSeconds)})`,
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
          dotClass: 'bg-amber-500 animate-ping',
        };
      case 'logged_out':
      default:
        return {
          label: 'Logged Out',
          badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
          dotClass: 'bg-slate-400',
        };
    }
  }, [status, currentBreakDurationSeconds]);

  // Only render for staff / admin employees
  if (!user || (!user.is_admin && user.role !== 'staff' && !user.is_super_admin)) {
    return null;
  }

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await attendanceLogout();
  };

  return (
    <>
      <div className="sticky top-0 z-20 w-full border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur-xs shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Attendance Status & Live Metrics */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Indicator */}
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-semibold ${statusConfig.badgeClass}`}
              title="Attendance Status"
            >
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${statusConfig.dotClass}`} />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    status === 'active'
                      ? 'bg-emerald-500'
                      : status === 'idle'
                      ? 'bg-amber-500'
                      : status === 'on_break'
                      ? 'bg-amber-600'
                      : 'bg-slate-400'
                  }`}
                />
              </span>
              <span>{statusConfig.label}</span>
            </div>

            {/* Attendance Metrics */}
            <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-600 font-medium">
              {/* Login Time */}
              <div className="flex items-center gap-1.5" title="Attendance Login Time">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Login:{' '}
                  <strong className="text-slate-800 font-semibold">
                    {attendance?.login_at
                      ? new Date(attendance.login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </strong>
                </span>
              </div>

              {/* Session Duration */}
              <div className="flex items-center gap-1.5" title="Total Session Duration">
                <Timer className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Session:{' '}
                  <strong className="text-slate-800 font-semibold">
                    {isClockedIn ? formatTimer(sessionDurationSeconds) : '—'}
                  </strong>
                </span>
              </div>

              {/* Total Break Duration */}
              <div className="flex items-center gap-1.5" title="Total Break Duration">
                <Coffee className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Breaks:{' '}
                  <strong className="text-slate-800 font-semibold">
                    {formatTimer(totalBreakSeconds)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Info notice */}
            {isClockedIn && (
              <span
                className="hidden lg:inline-flex items-center gap-1 text-[11px] text-slate-500"
                title="Only mouse movements and clicks are tracked to detect 2-minute inactivity. No keystrokes or screen captures."
              >
                <Info className="h-3 w-3 text-slate-400" />
                Activity tracking active
              </span>
            )}
          </div>

          {/* Right: Three Buttons in Exact Required Order: 1. Login, 2. Break, 3. Logout */}
          <div className="flex items-center gap-2">
            {/* 1. Login — Green button with login icon */}
            <button
              type="button"
              onClick={() => void attendanceLogin()}
              disabled={isClockedIn || isActionLoading}
              title="Start attendance session (Clock In)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Login</span>
            </button>

            {/* 2. Break — Neutral or amber button with coffee icon */}
            <button
              type="button"
              onClick={() => {
                if (isOnBreak) {
                  void endBreak();
                } else {
                  void startBreak();
                }
              }}
              disabled={!isClockedIn || isActionLoading}
              title={isOnBreak ? 'Resume active work' : 'Pause and start break'}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none ${
                isOnBreak
                  ? 'border-amber-400 bg-amber-500 text-white hover:bg-amber-600'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Coffee className="h-3.5 w-3.5" />
              <span>{isOnBreak ? 'End Break' : 'Break'}</span>
            </button>

            {/* 3. Logout — Red button with logout icon */}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              disabled={!isClockedIn || isActionLoading}
              title="End attendance session (Clock Out) without signing out of your account"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-600 bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <LogOut className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">End Attendance Session?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will record your attendance logout time and calculate your final working hours. You will remain logged into your account.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmLogout()}
                className="w-full rounded-xl border border-rose-600 bg-rose-600 py-2 px-4 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors"
              >
                Clock Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
