'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';

interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
  is_super_admin?: boolean;
}

interface AttendanceItem {
  id: number;
  user_id: number;
  date: string;
  login_at: string;
  logout_at: string | null;
  last_heartbeat_at: string | null;
  status: string;
  effective_status: 'active' | 'idle' | 'on_break' | 'logged_out' | 'disconnected';
  active_seconds: number;
  idle_seconds: number;
  break_seconds: number;
  total_duration_seconds: number;
  working_seconds: number;
  session_duration_seconds?: number;
  user?: UserInfo;
}

interface SummaryStats {
  date: string;
  total_sessions: number;
  active_count: number;
  idle_count: number;
  on_break_count: number;
  disconnected_count: number;
  logged_out_count: number;
  total_working_seconds: number;
}

interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

function formatDurationHuman(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return '0s';
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs === 0 && mins === 0) {
    return `${secs}s`;
  }
  if (hrs === 0) {
    return `${mins}m`;
  }
  return `${hrs}h ${mins}m`;
}

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function AdminAttendancePage() {
  const [attendances, setAttendances] = useState<AttendanceItem[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });

  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAttendances = useCallback(
    async (page = 1) => {
      try {
        const params: Record<string, string | number> = {
          page,
          per_page: 15,
        };
        if (search.trim()) params.search = search.trim();
        if (selectedDate) params.date = selectedDate;
        if (selectedStatus) params.status = selectedStatus;

        const [listRes, sumRes] = await Promise.all([
          apiClient.get(API_ENDPOINTS.ADMIN_ATTENDANCES, { params }),
          apiClient.get(API_ENDPOINTS.ADMIN_ATTENDANCES_SUMMARY, {
            params: selectedDate ? { date: selectedDate } : {},
          }),
        ]);

        if (listRes.data?.success) {
          setAttendances(listRes.data.data || []);
          if (listRes.data.pagination) {
            setPagination(listRes.data.pagination);
          }
        }

        if (sumRes.data?.success) {
          setSummary(sumRes.data.data || null);
        }
      } catch (err) {
        console.error('Failed to load attendances', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, selectedDate, selectedStatus]
  );

  useEffect(() => {
    setLoading(true);
    const delayDebounce = setTimeout(() => {
      void fetchAttendances(1);
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [fetchAttendances]);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchAttendances(pagination.current_page);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedStatus('');
  };

  // Status indicator badges matching requirement 7:
  // Active — Green, Idle — Orange, On Break — Amber, Logged Out — Grey
  const renderStatusBadge = (status: AttendanceItem['effective_status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'idle':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Idle
          </span>
        );
      case 'on_break':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            On Break
          </span>
        );
      case 'disconnected':
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
            title="Browser connection lost or closed without explicit logout"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Disconnected
          </span>
        );
      case 'logged_out':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Logged Out
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 p-6 sm:p-8">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Employee Attendance
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Monitor real-time employee attendance, session durations, breaks, and working hours.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-slate-500 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Now</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {summary ? summary.active_count : '—'}
          </p>
          <p className="mt-0.5 text-2xs text-slate-400">Mouse activity detected</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Idle Now</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {summary ? summary.idle_count : '—'}
          </p>
          <p className="mt-0.5 text-2xs text-slate-400">&gt;2 min inactivity</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">On Break</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {summary ? summary.on_break_count : '—'}
          </p>
          <p className="mt-0.5 text-2xs text-slate-400">Taking a break</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Disconnected</span>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">
            {summary ? summary.disconnected_count : '—'}
          </p>
          <p className="mt-0.5 text-2xs text-slate-400">Connection interrupted</p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-blue-100 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Hours Today</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {summary ? formatDurationHuman(summary.total_working_seconds) : '—'}
          </p>
          <p className="mt-0.5 text-2xs text-slate-400">Excludes breaks</p>
        </div>
      </div>

      {/* Filter Bar: Basic Employee Search & Date Filter */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 max-w-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee by name or email…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Date Picker Filter */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Today
              </button>
            </div>

            {/* Status Dropdown Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="on_break">On Break</option>
              <option value="disconnected">Disconnected</option>
              <option value="logged_out">Logged Out</option>
            </select>
          </div>

          {(search || selectedStatus || selectedDate !== new Date().toISOString().split('T')[0]) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main Attendance Table (Exact required fields from requirement 7) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 font-semibold text-slate-600">
              <tr>
                <th className="py-3.5 pl-6 pr-3">Employee Name</th>
                <th className="px-3 py-3.5">Date</th>
                <th className="px-3 py-3.5">Attendance Login Time</th>
                <th className="px-3 py-3.5">Attendance Logout Time</th>
                <th className="px-3 py-3.5 text-center">Session Duration</th>
                <th className="px-3 py-3.5 text-center">Break Duration</th>
                <th className="px-3 py-3.5 text-center">Idle Duration</th>
                <th className="px-3 py-3.5 text-center font-bold text-slate-900">Attendance Duration (Excl. Breaks)</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skel-${idx}`} className="animate-pulse">
                    <td className="py-4 pl-6 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-200" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-24 rounded bg-slate-200" />
                          <div className="h-2.5 w-32 rounded bg-slate-100" />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4"><div className="h-3 w-16 rounded bg-slate-200" /></td>
                    <td className="px-3 py-4"><div className="h-3 w-14 rounded bg-slate-200" /></td>
                    <td className="px-3 py-4"><div className="h-3 w-14 rounded bg-slate-200" /></td>
                    <td className="px-3 py-4 text-center"><div className="mx-auto h-3 w-12 rounded bg-slate-200" /></td>
                    <td className="px-3 py-4 text-center"><div className="mx-auto h-3 w-12 rounded bg-slate-200" /></td>
                    <td className="px-3 py-4 text-center"><div className="mx-auto h-3 w-12 rounded bg-slate-200" /></td>
                    <td className="px-3 py-4 text-center"><div className="mx-auto h-3 w-14 rounded bg-slate-200" /></td>
                    <td className="py-4 pl-3 pr-6 text-right"><div className="ml-auto h-5 w-18 rounded-full bg-slate-200" /></td>
                  </tr>
                ))
              ) : attendances.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="mx-auto h-10 w-10 text-slate-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-semibold text-slate-700">No attendance records found</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Try adjusting the date, employee search, or status filter.
                    </p>
                  </td>
                </tr>
              ) : (
                attendances.map((item) => {
                  const sessionSecs = item.session_duration_seconds ?? (item.logout_at
                    ? Math.max(0, Math.floor((new Date(item.logout_at).getTime() - new Date(item.login_at).getTime()) / 1000))
                    : Math.max(0, Math.floor((Date.now() - new Date(item.login_at).getTime()) / 1000)));

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Employee Name */}
                      <td className="py-3.5 pl-6 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-xs text-white uppercase shadow-2xs">
                            {item.user?.name?.charAt(0) || 'E'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {item.user?.name || `Employee #${item.user_id}`}
                            </p>
                            <p className="text-2xs text-slate-500 truncate">
                              {item.user?.email || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-slate-600">
                        {formatDate(item.date)}
                      </td>

                      {/* Attendance Login Time */}
                      <td className="px-3 py-3.5 whitespace-nowrap font-medium text-slate-700">
                        {formatTime(item.login_at)}
                      </td>

                      {/* Attendance Logout Time */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-slate-600">
                        {item.logout_at ? (
                          formatTime(item.logout_at)
                        ) : (
                          <span className="text-slate-400 font-normal">Active / Open</span>
                        )}
                      </td>

                      {/* Session Duration */}
                      <td className="px-3 py-3.5 text-center font-medium text-slate-800">
                        {formatDurationHuman(sessionSecs)}
                      </td>

                      {/* Break Duration */}
                      <td className="px-3 py-3.5 text-center font-medium text-amber-700">
                        {formatDurationHuman(item.break_seconds)}
                      </td>

                      {/* Idle Duration */}
                      <td className="px-3 py-3.5 text-center font-medium text-amber-600">
                        {formatDurationHuman(item.idle_seconds)}
                      </td>

                      {/* Attendance Duration (Excl. Breaks) */}
                      <td className="px-3 py-3.5 text-center font-bold text-slate-900 bg-slate-50/50">
                        {formatDurationHuman(item.working_seconds ?? item.active_seconds + item.idle_seconds)}
                      </td>

                      {/* Current Status */}
                      <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                        {renderStatusBadge(item.effective_status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5 text-xs text-slate-600">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-900">
                {Math.min((pagination.current_page - 1) * pagination.per_page + 1, pagination.total)}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(pagination.current_page * pagination.per_page, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{pagination.total}</span> records
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchAttendances(pagination.current_page - 1)}
                disabled={pagination.current_page <= 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-medium text-slate-700">
                {pagination.current_page} / {pagination.last_page}
              </span>
              <button
                type="button"
                onClick={() => void fetchAttendances(pagination.current_page + 1)}
                disabled={pagination.current_page >= pagination.last_page}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
