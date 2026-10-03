'use client';

import React, {
    FormEvent,
    useState,
} from 'react';

import { useRouter } from 'next/navigation';

import {
    Loader2,
    LockKeyhole,
    Mail,
} from 'lucide-react';

import briefApiClient from '@/services/api/briefClient';

export default function ClientBriefLoginPage() {
    const router = useRouter();

    const [email, setEmail] =
        useState('');

    const [password, setPassword] =
        useState('');

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(
            null
        );

    const handleSubmit = async (
        event: FormEvent
    ) => {
        event.preventDefault();

        setError(null);

        try {
            setLoading(true);

            const response =
                await briefApiClient.post(
                    '/client-brief-auth/login',
                    {
                        email,
                        password,
                    }
                );

            const token =
                response.data?.data?.token;

            const user =
                response.data?.data?.user;

            if (
                typeof token !== 'string' ||
                token.length < 10 ||
                token.length > 1000
            ) {
                console.error(
                    'Invalid brief auth token:',
                    {
                        type: typeof token,
                        length: String(token).length,
                    }
                );

                throw new Error(
                    'Invalid authentication token returned by server.'
                );
            }

            sessionStorage.removeItem(
                'brief_auth_token'
            );

            sessionStorage.removeItem(
                'brief_auth_user'
            );

            sessionStorage.setItem(
                'brief_auth_token',
                token
            );

            if (user) {
                sessionStorage.setItem(
                    'brief_auth_user',
                    JSON.stringify({
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                    })
                );
            }

            router.replace('/client-brief-admin/briefs');
        } catch (error: any) {
            console.error(
                'Client brief login failed:',
                error
            );

            setError(
                error?.response?.data
                    ?.message ??
                error?.message ??
                'Could not sign in.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl sm:p-9">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 text-white">
                    <LockKeyhole className="h-6 w-6" />
                </div>

                <div className="mt-6 text-center">
                    <h1 className="text-2xl font-bold text-white">
                        Client Brief Desk
                    </h1>

                    <p className="mt-2 text-sm text-slate-400">
                        Sign in to manage client
                        print requests.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="mt-7 space-y-4"
                >
                    <label className="block">
                        <span className="text-xs font-semibold text-slate-300">
                            Email
                        </span>

                        <div className="relative mt-2">
                            <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />

                            <input
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) =>
                                    setEmail(
                                        e.target.value
                                    )
                                }
                                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-purple-500"
                                placeholder="briefadmin@example.com"
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold text-slate-300">
                            Password
                        </span>

                        <div className="relative mt-2">
                            <LockKeyhole className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />

                            <input
                                type="password"
                                required
                                autoComplete="current-password"
                                value={
                                    password
                                }
                                onChange={(e) =>
                                    setPassword(
                                        e.target.value
                                    )
                                }
                                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-purple-500"
                                placeholder="••••••••"
                            />
                        </div>
                    </label>

                    {error && (
                        <div className="rounded-xl border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-60"
                    >
                        {loading && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}

                        {loading
                            ? 'Signing in...'
                            : 'Sign in'}
                    </button>
                </form>
            </div>
        </main>
    );
}