'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';
import { useAuth } from '@/context/AuthContext';

export type AttendanceStatus = 'active' | 'idle' | 'on_break' | 'logged_out' | 'disconnected';

export interface AttendanceBreakRecord {
  id: number;
  attendance_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  date: string;
  login_at: string;
  logout_at: string | null;
  last_heartbeat_at: string | null;
  status: string;
  active_seconds: number;
  idle_seconds: number;
  break_seconds: number;
  total_duration_seconds: number;
  effective_status?: string;
  working_seconds?: number;
  session_duration_seconds?: number;
  active_break?: AttendanceBreakRecord | null;
}

interface AttendanceContextType {
  attendance: AttendanceRecord | null;
  status: AttendanceStatus;
  isIdleModalOpen: boolean;
  activeBreak: AttendanceBreakRecord | null;
  sessionDurationSeconds: number;
  currentBreakDurationSeconds: number;
  totalBreakSeconds: number;
  isActionLoading: boolean;
  attendanceLogin: () => Promise<void>;
  attendanceLogout: () => Promise<void>;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
  resumeWorking: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | null>(null);

const INACTIVITY_TIMEOUT_MS = 120_000; // 120 seconds (2 minutes)
const MOUSE_THROTTLE_MS = 5_000; // Throttle mousemove to once every 5 seconds
const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds periodic heartbeat
const LEADER_RENEWAL_MS = 5_000; // Multi-tab leader election renewal
const LEADER_KEY = 'employee_attendance_leader';
const LAST_ACTIVITY_KEY = 'employee_last_activity_ts';
const TAB_CHANNEL_NAME = 'employee_attendance_sync';

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const isEmployee = Boolean(
    isAuthenticated &&
    user &&
    (user.role === 'staff' || user.role === 'admin' || user.is_admin || user.is_super_admin)
  );

  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>('logged_out');
  const [isIdleModalOpen, setIsIdleModalOpen] = useState<boolean>(false);
  const [activeBreak, setActiveBreak] = useState<AttendanceBreakRecord | null>(null);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState<number>(0);
  const [currentBreakDurationSeconds, setCurrentBreakDurationSeconds] = useState<number>(0);
  const [totalBreakSeconds, setTotalBreakSeconds] = useState<number>(0);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Performance-critical refs
  const lastActivityRef = useRef<number>(Date.now());
  const lastMouseMoveThrottledRef = useRef<number>(0);
  const accumulatedActiveDeltaRef = useRef<number>(0);
  const accumulatedIdleDeltaRef = useRef<number>(0);
  const statusRef = useRef<AttendanceStatus>('logged_out');
  const tabIdRef = useRef<string>('');
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Initialize unique tab ID
  if (!tabIdRef.current && typeof window !== 'undefined') {
    tabIdRef.current = `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  }

  // Keep ref synchronized with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Broadcast message helper across tabs
  const broadcast = useCallback((msg: { type: string; payload?: unknown }) => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(msg);
      } catch {
        // Fallback if BroadcastChannel unavailable
      }
    }
  }, []);

  // Fetch current attendance session on mount or refresh
  const refreshAttendance = useCallback(async () => {
    if (!isEmployee) return;

    try {
      const response = await apiClient.get(API_ENDPOINTS.ATTENDANCE_CURRENT);
      if (response.data?.success) {
        const att: AttendanceRecord | null = response.data.data?.attendance ?? null;
        const curBreak: AttendanceBreakRecord | null = response.data.data?.active_break ?? null;

        if (!att || att.logout_at || att.status === 'logged_out') {
          setAttendance(att);
          setStatus('logged_out');
          statusRef.current = 'logged_out';
          setIsIdleModalOpen(false);
          setActiveBreak(null);
          setSessionDurationSeconds(0);
          setCurrentBreakDurationSeconds(0);
          setTotalBreakSeconds(att?.break_seconds ?? 0);
          return;
        }

        setAttendance(att);
        setActiveBreak(curBreak);
        setTotalBreakSeconds(att.break_seconds ?? 0);

        // Compute elapsed session duration
        if (att.login_at) {
          const loginTime = new Date(att.login_at).getTime();
          setSessionDurationSeconds(Math.max(0, Math.floor((Date.now() - loginTime) / 1000)));
        }

        if (curBreak && !curBreak.ended_at) {
          setStatus('on_break');
          statusRef.current = 'on_break';
          setIsIdleModalOpen(false);
          const startedAt = new Date(curBreak.started_at).getTime();
          setCurrentBreakDurationSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
        } else if (att.status === 'idle') {
          setStatus('idle');
          statusRef.current = 'idle';
          setIsIdleModalOpen(true);
        } else {
          setStatus('active');
          statusRef.current = 'active';
          setIsIdleModalOpen(false);
        }
      }
    } catch {
      // Ignore network errors on background poll
    }
  }, [isEmployee]);

  useEffect(() => {
    if (isEmployee) {
      void refreshAttendance();
    } else {
      setAttendance(null);
      setStatus('logged_out');
      statusRef.current = 'logged_out';
      setIsIdleModalOpen(false);
      setActiveBreak(null);
    }
  }, [isEmployee, refreshAttendance]);

  // Explicit attendance Login button (Clock In)
  const attendanceLogin = useCallback(async () => {
    if (isActionLoading) return;
    setIsActionLoading(true);

    try {
      const response = await apiClient.post(API_ENDPOINTS.ATTENDANCE_LOGIN);
      if (response.data?.success && response.data?.data) {
        const newAtt: AttendanceRecord = response.data.data.attendance;
        setAttendance(newAtt);
        setStatus('active');
        statusRef.current = 'active';
        setIsIdleModalOpen(false);
        setActiveBreak(null);
        setSessionDurationSeconds(0);
        setCurrentBreakDurationSeconds(0);
        setTotalBreakSeconds(newAtt.break_seconds ?? 0);

        const now = Date.now();
        lastActivityRef.current = now;
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        }

        broadcast({ type: 'ATTENDANCE_LOGIN', payload: { attendance: newAtt } });
      }
    } finally {
      setIsActionLoading(false);
    }
  }, [broadcast, isActionLoading]);

  // Explicit attendance Logout button (Clock Out) - does NOT sign out of account
  const attendanceLogout = useCallback(async () => {
    if (isActionLoading) return;
    setIsActionLoading(true);

    try {
      const response = await apiClient.post(API_ENDPOINTS.ATTENDANCE_LOGOUT);
      if (response.data?.success) {
        setStatus('logged_out');
        statusRef.current = 'logged_out';
        setIsIdleModalOpen(false);
        setActiveBreak(null);
        setCurrentBreakDurationSeconds(0);
        accumulatedActiveDeltaRef.current = 0;
        accumulatedIdleDeltaRef.current = 0;

        if (response.data.data?.attendance) {
          setAttendance(response.data.data.attendance);
        }

        broadcast({ type: 'ATTENDANCE_LOGOUT' });
      }
    } finally {
      setIsActionLoading(false);
    }
  }, [broadcast, isActionLoading]);

  // Resume active status (either by mouse activity or clicking "Continue Working")
  const resumeWorking = useCallback(async () => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    }

    if (statusRef.current === 'idle') {
      setStatus('active');
      statusRef.current = 'active';
      setIsIdleModalOpen(false);

      broadcast({ type: 'RESUME_ACTIVE', payload: { timestamp: now } });

      try {
        await apiClient.post(API_ENDPOINTS.ATTENDANCE_STATUS, { status: 'active' });
      } catch {
        // Ignore network errors
      }
    } else if (isIdleModalOpen) {
      setIsIdleModalOpen(false);
    }
  }, [broadcast, isIdleModalOpen]);

  // Start break
  const startBreak = useCallback(async () => {
    if (isActionLoading || statusRef.current === 'logged_out') return;
    setIsActionLoading(true);

    try {
      const response = await apiClient.post(API_ENDPOINTS.ATTENDANCE_BREAK_START);
      if (response.data?.success) {
        const newBreak = response.data.data?.break;
        const updatedAttendance = response.data.data?.attendance;

        setStatus('on_break');
        statusRef.current = 'on_break';
        setIsIdleModalOpen(false);
        setActiveBreak(newBreak);
        setCurrentBreakDurationSeconds(0);
        if (updatedAttendance) {
          setAttendance(updatedAttendance);
          setTotalBreakSeconds(updatedAttendance.break_seconds ?? 0);
        }

        broadcast({ type: 'START_BREAK', payload: { break: newBreak, attendance: updatedAttendance } });
      }
    } finally {
      setIsActionLoading(false);
    }
  }, [broadcast, isActionLoading]);

  // End break
  const endBreak = useCallback(async () => {
    if (isActionLoading) return;
    setIsActionLoading(true);

    try {
      const response = await apiClient.post(API_ENDPOINTS.ATTENDANCE_BREAK_END);
      if (response.data?.success) {
        const updatedAttendance = response.data.data?.attendance;

        setStatus('active');
        statusRef.current = 'active';
        setActiveBreak(null);
        setCurrentBreakDurationSeconds(0);
        const now = Date.now();
        lastActivityRef.current = now;
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        }
        if (updatedAttendance) {
          setAttendance(updatedAttendance);
          setTotalBreakSeconds(updatedAttendance.break_seconds ?? 0);
        }

        broadcast({ type: 'END_BREAK', payload: { attendance: updatedAttendance } });
      }
    } finally {
      setIsActionLoading(false);
    }
  }, [broadcast, isActionLoading]);

  // Native mouse movement and click listener setup (only active after Clock In)
  useEffect(() => {
    if (!isEmployee) return;

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(TAB_CHANNEL_NAME);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.type) return;

        switch (data.type) {
          case 'ATTENDANCE_LOGIN':
            statusRef.current = 'active';
            setStatus('active');
            setIsIdleModalOpen(false);
            if (data.payload?.attendance) setAttendance(data.payload.attendance);
            setSessionDurationSeconds(0);
            lastActivityRef.current = Date.now();
            break;
          case 'ATTENDANCE_LOGOUT':
            statusRef.current = 'logged_out';
            setStatus('logged_out');
            setIsIdleModalOpen(false);
            setActiveBreak(null);
            setCurrentBreakDurationSeconds(0);
            break;
          case 'RESUME_ACTIVE':
            if (statusRef.current !== 'logged_out') {
              statusRef.current = 'active';
              setStatus('active');
              setIsIdleModalOpen(false);
              if (data.payload?.timestamp) {
                lastActivityRef.current = Number(data.payload.timestamp);
              }
            }
            break;
          case 'BECOME_IDLE':
            if (statusRef.current !== 'on_break' && statusRef.current !== 'logged_out') {
              statusRef.current = 'idle';
              setStatus('idle');
              setIsIdleModalOpen(true);
            }
            break;
          case 'START_BREAK':
            statusRef.current = 'on_break';
            setStatus('on_break');
            setIsIdleModalOpen(false);
            if (data.payload?.break) setActiveBreak(data.payload.break);
            if (data.payload?.attendance) {
              setAttendance(data.payload.attendance);
              setTotalBreakSeconds(data.payload.attendance.break_seconds ?? 0);
            }
            setCurrentBreakDurationSeconds(0);
            break;
          case 'END_BREAK':
            statusRef.current = 'active';
            setStatus('active');
            setActiveBreak(null);
            setCurrentBreakDurationSeconds(0);
            lastActivityRef.current = Date.now();
            if (data.payload?.attendance) {
              setAttendance(data.payload.attendance);
              setTotalBreakSeconds(data.payload.attendance.break_seconds ?? 0);
            }
            break;
        }
      };
    } catch {
      // BroadcastChannel unavailable
    }

    const onStorageChange = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        const ts = Number(e.newValue);
        if (!isNaN(ts) && ts > lastActivityRef.current) {
          lastActivityRef.current = ts;
          if (statusRef.current === 'idle') {
            statusRef.current = 'active';
            setStatus('active');
            setIsIdleModalOpen(false);
          }
        }
      }
    };
    window.addEventListener('storage', onStorageChange);

    // Activity detector (throttled mousemove to 5s, click immediate)
    const registerActivity = (now: number) => {
      // Activity tracking only runs after Clock In!
      if (statusRef.current === 'logged_out') return;

      lastActivityRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {
        // Ignore quota errors
      }

      if (statusRef.current === 'idle') {
        statusRef.current = 'active';
        setStatus('active');
        setIsIdleModalOpen(false);
        broadcast({ type: 'RESUME_ACTIVE', payload: { timestamp: now } });
        void apiClient.post(API_ENDPOINTS.ATTENDANCE_STATUS, { status: 'active' }).catch(() => {});
      }
    };

    const handleMouseMove = () => {
      const now = Date.now();
      if (now - lastMouseMoveThrottledRef.current < MOUSE_THROTTLE_MS) {
        return;
      }
      lastMouseMoveThrottledRef.current = now;
      registerActivity(now);
    };

    const handleClick = () => {
      registerActivity(Date.now());
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('storage', onStorageChange);
      if (channel) {
        channel.close();
        broadcastChannelRef.current = null;
      }
    };
  }, [isEmployee, broadcast]);

  // Periodic 1-second timer: Session timer, running break timer, and 120s inactivity check
  useEffect(() => {
    if (!isEmployee) return;

    const timer = setInterval(() => {
      const now = Date.now();

      // If logged out, do not run attendance timers
      if (statusRef.current === 'logged_out') {
        return;
      }

      // Live overall session duration timer
      setSessionDurationSeconds((prev) => prev + 1);

      // If on break:
      if (statusRef.current === 'on_break') {
        setCurrentBreakDurationSeconds((prev) => prev + 1);
        setTotalBreakSeconds((prev) => prev + 1);
        return; // Inactivity detection is strictly paused during breaks
      }

      // Inactivity detection
      const sharedLastActivityStr = typeof window !== 'undefined' ? localStorage.getItem(LAST_ACTIVITY_KEY) : null;
      const sharedLastActivity = sharedLastActivityStr ? Number(sharedLastActivityStr) : 0;
      const effectiveLastActivity = Math.max(lastActivityRef.current, sharedLastActivity);

      const inactiveDuration = now - effectiveLastActivity;

      if (statusRef.current === 'active') {
        accumulatedActiveDeltaRef.current += 1;

        if (inactiveDuration >= INACTIVITY_TIMEOUT_MS) {
          statusRef.current = 'idle';
          setStatus('idle');
          setIsIdleModalOpen(true);

          broadcast({ type: 'BECOME_IDLE' });
          void apiClient.post(API_ENDPOINTS.ATTENDANCE_STATUS, { status: 'idle' }).catch(() => {});
        }
      } else if (statusRef.current === 'idle') {
        accumulatedIdleDeltaRef.current += 1;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isEmployee, broadcast]);

  // Periodic 60-second Heartbeat with Leader Election (only while attendance is running)
  useEffect(() => {
    if (!isEmployee) return;

    const currentTabId = tabIdRef.current;

    const leaderTimer = setInterval(() => {
      if (typeof window === 'undefined') return;
      try {
        const leaderDataStr = localStorage.getItem(LEADER_KEY);
        let shouldBecomeLeader = true;

        if (leaderDataStr) {
          try {
            const parsed = JSON.parse(leaderDataStr);
            if (parsed.tabId !== currentTabId && parsed.expiry > Date.now()) {
              shouldBecomeLeader = false;
            }
          } catch {
            shouldBecomeLeader = true;
          }
        }

        if (shouldBecomeLeader) {
          localStorage.setItem(
            LEADER_KEY,
            JSON.stringify({ tabId: currentTabId, expiry: Date.now() + LEADER_RENEWAL_MS * 2 })
          );
        }
      } catch {
        // Ignore storage exceptions
      }
    }, LEADER_RENEWAL_MS);

    const heartbeatTimer = setInterval(() => {
      if (typeof window === 'undefined') return;

      // Do not send heartbeat if attendance session is logged out
      if (statusRef.current === 'logged_out') {
        accumulatedActiveDeltaRef.current = 0;
        accumulatedIdleDeltaRef.current = 0;
        return;
      }

      let isLeader = false;
      try {
        const leaderDataStr = localStorage.getItem(LEADER_KEY);
        if (leaderDataStr) {
          const parsed = JSON.parse(leaderDataStr);
          isLeader = parsed.tabId === currentTabId;
        }
      } catch {
        isLeader = true;
      }

      if (!isLeader) {
        accumulatedActiveDeltaRef.current = 0;
        accumulatedIdleDeltaRef.current = 0;
        return;
      }

      const activeDelta = accumulatedActiveDeltaRef.current;
      const idleDelta = accumulatedIdleDeltaRef.current;
      accumulatedActiveDeltaRef.current = 0;
      accumulatedIdleDeltaRef.current = 0;

      void apiClient
        .post(API_ENDPOINTS.ATTENDANCE_HEARTBEAT, {
          active_seconds_delta: activeDelta,
          idle_seconds_delta: idleDelta,
          status: statusRef.current,
        })
        .then((res) => {
          if (res.data?.success && res.data?.data?.attendance) {
            setAttendance(res.data.data.attendance);
            setTotalBreakSeconds(res.data.data.attendance.break_seconds ?? 0);
          }
        })
        .catch(() => {
          accumulatedActiveDeltaRef.current += activeDelta;
          accumulatedIdleDeltaRef.current += idleDelta;
        });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(leaderTimer);
      clearInterval(heartbeatTimer);
    };
  }, [isEmployee]);

  return (
    <AttendanceContext.Provider
      value={{
        attendance,
        status,
        isIdleModalOpen,
        activeBreak,
        sessionDurationSeconds,
        currentBreakDurationSeconds,
        totalBreakSeconds,
        isActionLoading,
        attendanceLogin,
        attendanceLogout,
        startBreak,
        endBreak,
        resumeWorking,
        refreshAttendance,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
}
