'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAuthToken, removeAuthToken } from '@/utils/storageHelper';

interface AdminAuthGuardProps {
    children: ReactNode;
}

type AuthStatus = 'checking' | 'authorized' | 'unauthorized';

const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    'http://127.0.0.1:8000/api/v1';

export default function AdminAuthGuard({
    children,
}: AdminAuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();

    const isLoginPage = pathname === '/admin/login';

    // If an auth token is already stored, initialize state to 'authorized' immediately.
    // This allows page refresh to cleanly reload the page without kicking the admin to login.
    const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
        if (typeof window === 'undefined') return 'checking';
        return getAuthToken() ? 'authorized' : 'checking';
    });

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

                // If non-auth server error (e.g. 500, 502, 503), do not boot admin out on reload
                if (!response.ok) {
                    return;
                }

                const result = await response.json();
                const user = result?.data;

                // Validate admin permissions safely
                const isAdmin = user && (user.role === 'admin' || Boolean(user.is_admin));

                if (!isAdmin) {
                    removeAuthToken();
                    setAuthStatus('unauthorized');
                    router.replace('/admin/login');
                    return;
                }

                setAuthStatus('authorized');
            } catch (err: any) {
                // If request was aborted (e.g. React StrictMode unmount/remount), ignore
                if (controller.signal.aborted || err?.name === 'AbortError') {
                    return;
                }
                // On transient network errors during reload, preserve existing token and don't redirect
            }
        };

        verifyAdmin();

        return () => {
            controller.abort();
        };
    }, [isLoginPage, router]);

    // Login page is always accessible.
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
                <p className="text-sm text-slate-400">Checking administrator access...</p>
            </div>
        );
    }

    return <>{children}</>;
}