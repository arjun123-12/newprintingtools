'use client';

import React from 'react';
import { useAttendance } from '@/context/AttendanceContext';

export const IdleConfirmationModal: React.FC = () => {
  const { isIdleModalOpen, resumeWorking, startBreak, isActionLoading } = useAttendance();

  if (!isIdleModalOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h3 id="idle-modal-title" className="text-lg font-bold text-slate-900">
            Are you still working?
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            No activity has been detected for the last 2 minutes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => void resumeWorking()}
            disabled={isActionLoading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            Continue Working
          </button>
          <button
            type="button"
            onClick={() => void startBreak()}
            disabled={isActionLoading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 active:scale-95 transition-all disabled:opacity-50"
          >
            Take a Break
          </button>
        </div>
      </div>
    </div>
  );
};
