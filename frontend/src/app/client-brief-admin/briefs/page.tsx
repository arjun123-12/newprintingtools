'use client';

import React, {
    FormEvent,
    useCallback,
    useEffect,
    useState,
} from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
    Check,
    Clipboard,
    ExternalLink,
    FileText,
    Link2,
    Loader2,
    LogOut,
    Plus,
    RefreshCw,
    UserRound,
} from 'lucide-react';

import briefApiClient from '@/services/api/briefClient';

import {
    ClientBrief,
    CreatedClientBrief,
    clientBriefService,
} from '@/services/clientBriefService';

export default function ClientBriefsPage() {
    const router = useRouter();

    const [checkingAuth, setCheckingAuth] =
        useState(true);

    const [userName, setUserName] =
        useState('');

    const [briefs, setBriefs] =
        useState<ClientBrief[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [creating, setCreating] =
        useState(false);

    const [loggingOut, setLoggingOut] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const [clientName, setClientName] =
        useState('');

    const [companyName, setCompanyName] =
        useState('');

    const [email, setEmail] =
        useState('');

    const [expiresInDays, setExpiresInDays] =
        useState('7');

    const [createdBrief, setCreatedBrief] =
        useState<CreatedClientBrief | null>(null);

    const [copied, setCopied] =
        useState(false);

    // ===========================
    // AUTH CHECK
    // ===========================

    useEffect(() => {
        let cancelled = false;

        const verifyLogin = async () => {
            const token =
                sessionStorage.getItem(
                    'brief_auth_token'
                );

            if (!token) {
                router.replace(
                    '/client-brief-admin/login'
                );
                return;
            }

            try {
                const response =
                    await briefApiClient.get(
                        '/client-brief-auth/me'
                    );

                if (cancelled) return;

                const user =
                    response.data?.data;

                if (
                    !user ||
                    user.role !==
                    'client_brief_admin'
                ) {
                    throw new Error(
                        'Invalid account'
                    );
                }

                setUserName(
                    user.name ||
                    user.email ||
                    'Client Brief Admin'
                );

                setCheckingAuth(false);
            } catch {
                sessionStorage.removeItem(
                    'brief_auth_token'
                );

                sessionStorage.removeItem(
                    'brief_auth_user'
                );

                if (!cancelled) {
                    router.replace(
                        '/client-brief-admin/login'
                    );
                }
            }
        };

        void verifyLogin();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // ===========================
    // LOAD BRIEFS
    // ===========================

    const loadBriefs =
        useCallback(async () => {
            try {
                setLoading(true);
                setError(null);

                const result =
                    await clientBriefService.getAdminBriefs();

                setBriefs(
                    result.data ?? []
                );
            } catch (err: any) {
                console.error(err);

                setError(
                    err?.response?.data
                        ?.message ??
                    'Could not load client briefs.'
                );
            } finally {
                setLoading(false);
            }
        }, []);

    useEffect(() => {
        if (!checkingAuth) {
            void loadBriefs();
        }
    }, [
        checkingAuth,
        loadBriefs,
    ]);

    // ===========================
    // CREATE LINK
    // ===========================

    const handleCreate = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        try {
            setCreating(true);
            setError(null);
            setCopied(false);
            setCreatedBrief(null);

            const result =
                await clientBriefService.createBrief(
                    {
                        client_name:
                            clientName.trim() ||
                            undefined,

                        company_name:
                            companyName.trim() ||
                            undefined,

                        email:
                            email.trim() ||
                            undefined,

                        expires_in_days:
                            Number(
                                expiresInDays
                            ) || 7,
                    }
                );

            setCreatedBrief(result);

            setClientName('');
            setCompanyName('');
            setEmail('');
            setExpiresInDays('7');

            await loadBriefs();
        } catch (err: any) {
            setError(
                err?.response?.data
                    ?.message ??
                'Could not create client link.'
            );
        } finally {
            setCreating(false);
        }
    };

    // ===========================
    // COPY
    // ===========================

    const copyLink = async () => {
        if (
            !createdBrief?.client_url
        ) {
            return;
        }

        await navigator.clipboard.writeText(
            createdBrief.client_url
        );

        setCopied(true);

        setTimeout(
            () => setCopied(false),
            2000
        );
    };

    // ===========================
    // LOGOUT
    // ===========================

    const handleLogout = async () => {
        try {
            setLoggingOut(true);

            await briefApiClient.post(
                '/client-brief-auth/logout'
            );
        } catch {
            // logout locally anyway
        } finally {
            sessionStorage.removeItem(
                'brief_auth_token'
            );

            sessionStorage.removeItem(
                'brief_auth_user'
            );

            router.replace(
                '/client-brief-admin/login'
            );

            setLoggingOut(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="flex min-h-[500px] items-center justify-center">
                <div className="text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-purple-600" />

                    <p className="mt-3 text-sm text-slate-500">
                        Checking access...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50">
            {/* HEADER */}

            <div className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">

                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-purple-600">
                            Client Brief Desk
                        </p>

                        <h1 className="mt-1 text-2xl font-bold text-slate-900">
                            Client Briefs
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden text-right md:block">
                            <p className="text-sm font-semibold text-slate-800">
                                {userName}
                            </p>

                            <p className="text-xs text-slate-500">
                                Client Brief Admin
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={
                                loggingOut
                            }
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            {loggingOut ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <LogOut className="h-4 w-4" />
                            )}

                            Logout
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-5 py-8">

                {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">

                    {/* CREATE CLIENT LINK */}

                    <div className="space-y-5">
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                                    <Link2 className="h-5 w-5" />
                                </div>

                                <div>
                                    <h2 className="font-bold text-slate-900">
                                        Create Client Link
                                    </h2>

                                    <p className="text-xs text-slate-500">
                                        Generate a private form link.
                                    </p>
                                </div>
                            </div>

                            <form
                                onSubmit={
                                    handleCreate
                                }
                                className="mt-6 space-y-4"
                            >
                                <Field label="Client name">
                                    <input
                                        value={
                                            clientName
                                        }
                                        onChange={(e) =>
                                            setClientName(
                                                e.target
                                                    .value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                        placeholder="Client name"
                                    />
                                </Field>

                                <Field label="Company">
                                    <input
                                        value={
                                            companyName
                                        }
                                        onChange={(e) =>
                                            setCompanyName(
                                                e.target
                                                    .value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                        placeholder="Optional"
                                    />
                                </Field>

                                <Field label="Email">
                                    <input
                                        type="email"
                                        value={
                                            email
                                        }
                                        onChange={(e) =>
                                            setEmail(
                                                e.target
                                                    .value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                        placeholder="client@example.com"
                                    />
                                </Field>

                                <Field label="Link expiry">
                                    <select
                                        value={
                                            expiresInDays
                                        }
                                        onChange={(e) =>
                                            setExpiresInDays(
                                                e.target
                                                    .value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    >
                                        <option value="1">
                                            1 day
                                        </option>

                                        <option value="3">
                                            3 days
                                        </option>

                                        <option value="7">
                                            7 days
                                        </option>

                                        <option value="14">
                                            14 days
                                        </option>

                                        <option value="30">
                                            30 days
                                        </option>
                                    </select>
                                </Field>

                                <button
                                    type="submit"
                                    disabled={
                                        creating
                                    }
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-60"
                                >
                                    {creating ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}

                                    {creating
                                        ? 'Creating...'
                                        : 'Generate Private Link'}
                                </button>
                            </form>
                        </section>

                        {/* GENERATED LINK */}

                        {createdBrief && (
                            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

                                <div className="flex items-center gap-2 text-emerald-800">
                                    <Check className="h-5 w-5" />

                                    <strong>
                                        Link created
                                    </strong>
                                </div>

                                <input
                                    readOnly
                                    value={
                                        createdBrief.client_url
                                    }
                                    className="mt-4 w-full rounded-xl border border-emerald-200 bg-white px-3 py-3 text-xs"
                                />

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={
                                            copyLink
                                        }
                                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white"
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4" />
                                        ) : (
                                            <Clipboard className="h-4 w-4" />
                                        )}

                                        {copied
                                            ? 'Copied'
                                            : 'Copy Link'}
                                    </button>

                                    <a
                                        href={
                                            createdBrief.client_url
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white py-2.5 text-xs font-bold text-emerald-800"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Open
                                    </a>
                                </div>
                            </section>
                        )}
                    </div>

                    {/* CLIENT REQUEST LIST */}

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

                            <div>
                                <h2 className="font-bold text-slate-900">
                                    Client Requests
                                </h2>

                                <p className="text-xs text-slate-500">
                                    Submitted and pending briefs
                                </p>
                            </div>

                            <button
                                onClick={() =>
                                    void loadBriefs()
                                }
                                className="rounded-lg border border-slate-200 p-2"
                            >
                                <RefreshCw
                                    className={`h-4 w-4 ${loading
                                            ? 'animate-spin'
                                            : ''
                                        }`}
                                />
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex min-h-64 items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                            </div>
                        ) : briefs.length ===
                            0 ? (
                            <div className="flex min-h-64 items-center justify-center text-center">
                                <div>
                                    <FileText className="mx-auto h-9 w-9 text-slate-300" />

                                    <p className="mt-3 font-semibold text-slate-700">
                                        No briefs yet
                                    </p>

                                    <p className="text-xs text-slate-500">
                                        Create your first client link.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[650px]">

                                    <thead className="bg-slate-50">
                                        <tr className="text-left text-xs text-slate-500">
                                            <th className="px-5 py-3">
                                                Client
                                            </th>

                                            <th className="px-5 py-3">
                                                Status
                                            </th>

                                            <th className="px-5 py-3">
                                                Files
                                            </th>

                                            <th className="px-5 py-3">
                                                Submitted
                                            </th>

                                            <th className="px-5 py-3" />
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">

                                        {briefs.map(
                                            (
                                                brief
                                            ) => (
                                                <tr
                                                    key={
                                                        brief.id
                                                    }
                                                >
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">

                                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                                                                <UserRound className="h-4 w-4" />
                                                            </div>

                                                            <div>
                                                                <p className="text-sm font-semibold">
                                                                    {brief.client_name ||
                                                                        'Unnamed Client'}
                                                                </p>

                                                                <p className="text-xs text-slate-500">
                                                                    {brief.company_name ||
                                                                        brief.email ||
                                                                        `Brief #${brief.id}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <StatusBadge
                                                            status={
                                                                brief.status
                                                            }
                                                        />
                                                    </td>

                                                    <td className="px-5 py-4 text-sm">
                                                        {brief.files_count ??
                                                            0}
                                                    </td>

                                                    <td className="px-5 py-4 text-xs text-slate-500">
                                                        {brief.submitted_at
                                                            ? new Date(
                                                                brief.submitted_at
                                                            ).toLocaleDateString()
                                                            : 'Pending'}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <Link
                                                            href={`/client-brief-admin/briefs/${brief.id}`}
                                                            className="flex w-fit items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"
                                                        >
                                                            View
                                                            <ExternalLink className="h-3 w-3" />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}

const inputClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10';

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block text-xs font-semibold text-slate-700">
            {label}
            {children}
        </label>
    );
}

function StatusBadge({
    status,
}: {
    status: string;
}) {
    return (
        <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700">
            {status
                .replaceAll('_', ' ')
                .replace(
                    /\b\w/g,
                    (char) =>
                        char.toUpperCase()
                )}
        </span>
    );
}