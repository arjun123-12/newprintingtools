'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

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

    const [authStatus, setAuthStatus] =
        useState<AuthStatus>('checking');

    const isLoginPage = pathname === '/admin/login';

    useEffect(() => {
        if (isLoginPage) {
            return;
        }

        setAuthStatus('checking');

        const token = localStorage.getItem('auth_token');

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

                if (!response.ok) {
                    throw new Error('Authentication failed.');
                }

                const result = await response.json();
                const user = result?.data;

                if (
                    !user ||
                    user.role !== 'admin' ||
                    user.is_admin !== true
                ) {
                    throw new Error('Administrator access required.');
                }

                setAuthStatus('authorized');
            } catch {
                if (controller.signal.aborted) {
                    return;
                }

                localStorage.removeItem('auth_token');
                setAuthStatus('unauthorized');
                router.replace('/admin/login');
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

    // Never render admin content until authorization succeeds.
    if (authStatus !== 'authorized') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950">
                <p className="text-sm text-slate-400">
                    {authStatus === 'checking'
                        ? 'Checking administrator access...'
                        : 'Redirecting to login...'}
                </p>
            </div>
        );
    }

    return <>{children}</>;
}