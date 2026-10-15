'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuthToken, removeAuthToken } from '@/utils/storageHelper';
import type { CustomerUser } from '@/context/AuthContext';
import {
  isSuperAdmin,
  canAccessSection,
  getRequiredPermissionForPath,
  getFirstPermittedRoute,
  ADMIN_PERMISSIONS,
} from '@/utils/adminPermissions';

interface AdminAuthGuardProps {
  children: ReactNode;
}

type AuthStatus = 'checking' | 'authorized' | 'unauthorized' | 'forbidden';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

export default function AdminAuthGuard({
  children,
}: AdminAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === '/admin/login';
  const isChangePasswordPage = pathname === '/admin/change-password';

  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    if (typeof window === 'undefined') return 'checking';
    return getAuthToken() ? 'authorized' : 'checking';
  });

  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(null);
  const [deniedSection, setDeniedSection] = useState<string>('');

  useEffect(() => {
    if (isLoginPage) {
      return;
    }

    const token = getAuthToken();

    if (!token) {
      setAuthStatus('unauthorized');
      router.replace('/admin/login');
      return;
    }

    const controller = new AbortController();

    const verifyAdmin = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        // Explicit unauthorized or forbidden response from backend
        if (response.status === 401 || response.status === 403) {
          removeAuthToken();
          setAuthStatus('unauthorized');
          router.replace('/admin/login');
          return;
        }

        // Non-auth server error (e.g. 500, 502, 503) during reload
        if (!response.ok) {
          return;
        }

        const result = await response.json();
        const user: CustomerUser = result?.data;

        // Verify active and admin/staff status
        const isActive = user && user.is_active !== false;
        const isAdmin = user && (user.role === 'admin' || user.role === 'staff' || Boolean(user.is_admin) || Boolean(user.is_super_admin));

        if (!isActive || !isAdmin) {
          removeAuthToken();
          setAuthStatus('unauthorized');
          router.replace('/admin/login');
          return;
        }

        setCurrentUser(user);

        // Enforce password change on first login
        if (user.must_change_password && !isChangePasswordPage) {
          router.replace('/admin/change-password');
          return;
        }

        // Check granular section permission
        const requiredPermission = getRequiredPermissionForPath(pathname);

        if (requiredPermission === 'super_admin') {
          if (!isSuperAdmin(user)) {
            setDeniedSection('Staff & System Permissions (Super Administrator only)');
            setAuthStatus('forbidden');
            return;
          }
        } else if (requiredPermission && requiredPermission !== 'dashboard') {
          if (!canAccessSection(user, requiredPermission)) {
            const permMeta = ADMIN_PERMISSIONS.find((p) => p.key === requiredPermission);
            setDeniedSection(permMeta ? permMeta.name : requiredPermission);
            setAuthStatus('forbidden');
            return;
          }
        } else if (requiredPermission === 'dashboard') {
          // If staff doesn't have dashboard permission, redirect to their first permitted route
          if (!isSuperAdmin(user) && !canAccessSection(user, 'dashboard')) {
            const firstRoute = getFirstPermittedRoute(user);
            if (firstRoute !== pathname && firstRoute !== '/admin/dashboard') {
              router.replace(firstRoute);
              return;
            } else if (!canAccessSection(user, 'dashboard')) {
              setDeniedSection('Dashboard');
              setAuthStatus('forbidden');
              return;
            }
          }
        }

        setAuthStatus('authorized');
      } catch (err: any) {
        if (controller.signal.aborted || err?.name === 'AbortError') {
          return;
        }
      }
    };

    verifyAdmin();

    return () => {
      controller.abort();
    };
  }, [isLoginPage, isChangePasswordPage, pathname, router]);

  // Login page is always accessible
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (authStatus === 'unauthorized') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-400">Redirecting to login...</p>
      </div>
    );
  }

  if (authStatus === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Verifying administrator permissions...</p>
        </div>
      </div>
    );
  }

  // Polished Access Denied Screen (403 Forbidden)
  if (authStatus === 'forbidden') {
    const fallbackRoute = getFirstPermittedRoute(currentUser);

    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6 select-none font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200/80 p-8 shadow-xl text-center space-y-5">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center justify-center mx-auto shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 tracking-wide uppercase">
              403 Forbidden
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Access Denied
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your staff user account does not have permission to view or manage the{' '}
              <strong className="text-slate-900">{deniedSection || 'requested'}</strong> section.
            </p>
            <p className="text-[11px] text-slate-400">
              Only a Super Administrator can assign permissions to your staff profile.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href={fallbackRoute}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              Return to Permitted Section
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}