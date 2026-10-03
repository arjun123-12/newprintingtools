'use client';

import React, {
    useCallback,
    useEffect,
    useState,
} from 'react';

import Link from 'next/link';

import {
    useParams,
    useRouter,
} from 'next/navigation';

import {
    ArrowLeft,
    CalendarDays,
    Download,
    FileText,
    Loader2,
    Mail,
    MapPin,
    Package,
    Phone,
    RefreshCw,
    UserRound,
} from 'lucide-react';

import briefApiClient from '@/services/api/briefClient';

import {
    clientBriefService,
} from '@/services/clientBriefService';

interface BriefFile {
    id: number;
    name: string;
    mime_type?: string | null;
    size_bytes?: number;
    url?: string | null;
}

interface ClientBriefDetail {
    id: number;
    uuid: string;

    client_name?: string | null;
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;

    request_type?: string | null;
    reorder_reference?: string | null;

    project_name?: string | null;
    product?: string | null;
    quantity?: number | null;

    width?: string | number | null;
    height?: string | number | null;
    unit?: string | null;

    print_sides?: string | null;

    fulfilment?: string | null;
    delivery_address?: string | null;

    colours?: string | null;
    description?: string | null;
    additional_notes?: string | null;

    requested_date?: string | null;

    status: string;
    is_active?: boolean;

    expires_at?: string | null;
    submitted_at?: string | null;

    created_at?: string | null;
    updated_at?: string | null;

    files?: BriefFile[];
}

const STATUS_OPTIONS = [
    {
        value: 'draft',
        label: 'Draft',
    },
    {
        value: 'new',
        label: 'New',
    },
    {
        value: 'reviewed',
        label: 'Reviewed',
    },
    {
        value: 'needs_info',
        label: 'Needs Info',
    },
    {
        value: 'in_progress',
        label: 'In Progress',
    },
    {
        value: 'proof_sent',
        label: 'Proof Sent',
    },
    {
        value: 'approved',
        label: 'Approved',
    },
    {
        value: 'completed',
        label: 'Completed',
    },
    {
        value: 'cancelled',
        label: 'Cancelled',
    },
];

export default function ClientBriefDetailPage() {
    const params = useParams();
    const router = useRouter();

    const rawId =
        params?.id;

    const id =
        Number(
            Array.isArray(rawId)
                ? rawId[0]
                : rawId
        );

    const [brief, setBrief] =
        useState<ClientBriefDetail | null>(
            null
        );

    const [checkingAuth, setCheckingAuth] =
        useState(true);

    const [loading, setLoading] =
        useState(true);

    const [updating, setUpdating] =
        useState(false);

    const [error, setError] =
        useState<string | null>(
            null
        );

    // =========================================
    // VERIFY CLIENT BRIEF ADMIN SESSION
    // =========================================

    useEffect(() => {
        let cancelled = false;

        const verifyLogin =
            async () => {
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

                    if (cancelled) {
                        return;
                    }

                    const user =
                        response.data?.data;

                    if (
                        !user ||
                        user.role !==
                        'client_brief_admin'
                    ) {
                        throw new Error(
                            'Invalid Client Brief account.'
                        );
                    }

                    setCheckingAuth(
                        false
                    );
                } catch (
                authError
                ) {
                    console.error(
                        'Brief authentication failed:',
                        authError
                    );

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

    // =========================================
    // LOAD BRIEF
    // =========================================

    const loadBrief =
        useCallback(async () => {
            if (
                !Number.isFinite(id) ||
                id <= 0
            ) {
                setError(
                    'Invalid client brief ID.'
                );

                setLoading(false);

                return;
            }

            try {
                setLoading(true);
                setError(null);

                const data =
                    await clientBriefService
                        .getAdminBrief(id);

                setBrief(data);
            } catch (
            loadError: any
            ) {
                console.error(
                    'Could not load client brief:',
                    loadError
                );

                if (
                    loadError?.response
                        ?.status === 401 ||
                    loadError?.response
                        ?.status === 403
                ) {
                    sessionStorage.removeItem(
                        'brief_auth_token'
                    );

                    sessionStorage.removeItem(
                        'brief_auth_user'
                    );

                    router.replace(
                        '/client-brief-admin/login'
                    );

                    return;
                }

                setError(
                    loadError?.response
                        ?.data?.message ??
                    'Could not load client brief.'
                );
            } finally {
                setLoading(false);
            }
        }, [
            id,
            router,
        ]);

    useEffect(() => {
        if (!checkingAuth) {
            void loadBrief();
        }
    }, [
        checkingAuth,
        loadBrief,
    ]);

    // =========================================
    // UPDATE STATUS
    // =========================================

    const handleStatusChange =
        async (
            newStatus: string
        ) => {
            if (!brief) {
                return;
            }

            try {
                setUpdating(true);
                setError(null);

                await clientBriefService
                    .updateBrief(
                        brief.id,
                        {
                            status:
                                newStatus,
                        }
                    );

                setBrief(
                    (current) =>
                        current
                            ? {
                                ...current,
                                status:
                                    newStatus,
                            }
                            : current
                );
            } catch (
            updateError: any
            ) {
                setError(
                    updateError
                        ?.response?.data
                        ?.message ??
                    'Could not update status.'
                );
            } finally {
                setUpdating(false);
            }
        };

    // =========================================
    // ENABLE / DISABLE LINK
    // =========================================

    const toggleLink =
        async () => {
            if (!brief) {
                return;
            }

            const nextValue =
                !(brief.is_active ?? true);

            try {
                setUpdating(true);
                setError(null);

                await clientBriefService
                    .updateBrief(
                        brief.id,
                        {
                            is_active:
                                nextValue,
                        }
                    );

                setBrief(
                    (current) =>
                        current
                            ? {
                                ...current,
                                is_active:
                                    nextValue,
                            }
                            : current
                );
            } catch (
            updateError: any
            ) {
                setError(
                    updateError
                        ?.response?.data
                        ?.message ??
                    'Could not update link.'
                );
            } finally {
                setUpdating(false);
            }
        };

    if (
        checkingAuth ||
        loading
    ) {
        return (
            <main className="flex min-h-[500px] items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-purple-600" />

                    <p className="mt-3 text-sm text-slate-500">
                        Loading client brief...
                    </p>
                </div>
            </main>
        );
    }

    if (!brief) {
        return (
            <main className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center">

                    <h1 className="text-xl font-bold">
                        Client brief unavailable
                    </h1>

                    <p className="mt-3 text-sm text-red-600">
                        {error ??
                            'Brief could not be found.'}
                    </p>

                    <Link
                        href="/client-brief-admin/briefs"
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />

                        Back to Briefs
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50">

            <div className="mx-auto max-w-7xl space-y-6 px-5 py-8">

                {/* HEADER */}

                <div className="flex flex-wrap items-start justify-between gap-4">

                    <div>
                        <Link
                            href="/client-brief-admin/briefs"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-700"
                        >
                            <ArrowLeft className="h-4 w-4" />

                            Client Briefs
                        </Link>

                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-purple-600">
                            Client Brief
                        </p>

                        <h1 className="mt-1 text-2xl font-bold text-slate-900">
                            {brief.client_name ||
                                `Brief #${brief.id}`}
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Brief #{brief.id}

                            {brief.company_name
                                ? ` · ${brief.company_name}`
                                : ''}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">

                        <button
                            type="button"
                            onClick={() =>
                                void loadBrief()
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700"
                        >
                            <RefreshCw className="h-4 w-4" />

                            Refresh
                        </button>

                        <button
                            type="button"
                            onClick={
                                toggleLink
                            }
                            disabled={
                                updating
                            }
                            className={`rounded-xl px-4 py-2.5 text-xs font-bold ${brief.is_active ??
                                    true
                                    ? 'border border-red-200 bg-red-50 text-red-700'
                                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                }`}
                        >
                            {brief.is_active ??
                                true
                                ? 'Disable Client Link'
                                : 'Enable Client Link'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* STATUS */}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                    <div className="flex flex-wrap items-end justify-between gap-5">

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Current Status
                            </p>

                            <StatusBadge
                                status={
                                    brief.status
                                }
                            />
                        </div>

                        <label className="block min-w-[220px] text-xs font-semibold text-slate-600">
                            Change status

                            <select
                                value={
                                    brief.status
                                }
                                disabled={
                                    updating
                                }
                                onChange={(e) =>
                                    void handleStatusChange(
                                        e.target
                                            .value
                                    )
                                }
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500"
                            >
                                {STATUS_OPTIONS.map(
                                    (
                                        option
                                    ) => (
                                        <option
                                            key={
                                                option.value
                                            }
                                            value={
                                                option.value
                                            }
                                        >
                                            {
                                                option.label
                                            }
                                        </option>
                                    )
                                )}
                            </select>
                        </label>
                    </div>
                </section>

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_320px]">

                    <div className="space-y-6">

                        {/* CLIENT DETAILS */}

                        <Section title="Client Details">

                            <div className="grid gap-5 sm:grid-cols-2">

                                <Info
                                    icon={
                                        UserRound
                                    }
                                    label="Client name"
                                    value={
                                        brief.client_name
                                    }
                                />

                                <Info
                                    icon={
                                        Package
                                    }
                                    label="Company"
                                    value={
                                        brief.company_name
                                    }
                                />

                                <Info
                                    icon={
                                        Mail
                                    }
                                    label="Email"
                                    value={
                                        brief.email
                                    }
                                />

                                <Info
                                    icon={
                                        Phone
                                    }
                                    label="Phone"
                                    value={
                                        brief.phone
                                    }
                                />

                            </div>
                        </Section>

                        {/* PROJECT */}

                        <Section title="Project Requirements">

                            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

                                <Info
                                    label="Request type"
                                    value={pretty(
                                        brief.request_type
                                    )}
                                />

                                <Info
                                    label="Product"
                                    value={
                                        brief.product
                                    }
                                />

                                <Info
                                    label="Quantity"
                                    value={
                                        brief.quantity !==
                                            null &&
                                            brief.quantity !==
                                            undefined
                                            ? String(
                                                brief.quantity
                                            )
                                            : null
                                    }
                                />

                                <Info
                                    label="Print sides"
                                    value={pretty(
                                        brief.print_sides
                                    )}
                                />

                                <Info
                                    label="Requested date"
                                    value={formatDate(
                                        brief.requested_date
                                    )}
                                />

                                <Info
                                    label="Previous job reference"
                                    value={
                                        brief.reorder_reference
                                    }
                                />

                            </div>
                        </Section>

                        {/* SIZE */}

                        <Section title="Size & Fulfilment">

                            <div className="grid gap-5 sm:grid-cols-3">

                                <Info
                                    label="Width"
                                    value={
                                        brief.width !==
                                            null &&
                                            brief.width !==
                                            undefined
                                            ? `${brief.width} ${brief.unit ?? ''}`
                                            : null
                                    }
                                />

                                <Info
                                    label="Height"
                                    value={
                                        brief.height !==
                                            null &&
                                            brief.height !==
                                            undefined
                                            ? `${brief.height} ${brief.unit ?? ''}`
                                            : null
                                    }
                                />

                                <Info
                                    label="Fulfilment"
                                    value={pretty(
                                        brief.fulfilment
                                    )}
                                />

                            </div>

                            {brief.delivery_address && (
                                <div className="mt-6">
                                    <Info
                                        icon={
                                            MapPin
                                        }
                                        label="Delivery address"
                                        value={
                                            brief.delivery_address
                                        }
                                    />
                                </div>
                            )}
                        </Section>

                        {/* INSTRUCTIONS */}

                        <Section title="Client Instructions">

                            <ContentBlock
                                label="Preferred colours"
                                value={
                                    brief.colours
                                }
                            />

                            <ContentBlock
                                label="Project instructions"
                                value={
                                    brief.description
                                }
                            />

                            <ContentBlock
                                label="Additional notes"
                                value={
                                    brief.additional_notes
                                }
                            />

                        </Section>

                        {/* FILES */}

                        <Section title="Uploaded Artwork & References">

                            {!brief.files ||
                                brief.files.length ===
                                0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">

                                    <FileText className="mx-auto h-8 w-8 text-slate-300" />

                                    <p className="mt-2 text-sm text-slate-500">
                                        No files uploaded.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">

                                    {brief.files.map(
                                        (
                                            file
                                        ) => (
                                            <div
                                                key={
                                                    file.id
                                                }
                                                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">

                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                                                        <FileText className="h-5 w-5" />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-slate-800">
                                                            {
                                                                file.name
                                                            }
                                                        </p>

                                                        <p className="mt-0.5 text-xs text-slate-500">
                                                            {file.mime_type ??
                                                                'File'}

                                                            {file.size_bytes
                                                                ? ` · ${formatBytes(
                                                                    file.size_bytes
                                                                )}`
                                                                : ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                {file.url && (
                                                    <a
                                                        href={
                                                            file.url
                                                        }
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-purple-300 hover:text-purple-700"
                                                    >
                                                        <Download className="h-4 w-4" />

                                                        Open / Download
                                                    </a>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </Section>
                    </div>

                    {/* RIGHT SIDEBAR */}

                    <aside className="space-y-5 lg:sticky lg:top-6">

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <h2 className="font-bold text-slate-900">
                                Brief Information
                            </h2>

                            <div className="mt-5 space-y-4">

                                <SidebarRow
                                    label="Brief ID"
                                    value={`#${brief.id}`}
                                />

                                <SidebarRow
                                    label="Submitted"
                                    value={
                                        brief.submitted_at
                                            ? formatDateTime(
                                                brief.submitted_at
                                            )
                                            : 'Not submitted'
                                    }
                                />

                                <SidebarRow
                                    label="Created"
                                    value={formatDateTime(
                                        brief.created_at
                                    )}
                                />

                                <SidebarRow
                                    label="Expires"
                                    value={formatDateTime(
                                        brief.expires_at
                                    )}
                                />

                                <SidebarRow
                                    label="Client link"
                                    value={
                                        brief.is_active ??
                                            true
                                            ? 'Active'
                                            : 'Disabled'
                                    }
                                />

                                <SidebarRow
                                    label="Files"
                                    value={String(
                                        brief.files
                                            ?.length ??
                                        0
                                    )}
                                />

                            </div>
                        </section>

                        {brief.requested_date && (
                            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

                                <CalendarDays className="h-6 w-6 text-amber-700" />

                                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-amber-700">
                                    Requested completion
                                </p>

                                <p className="mt-1 font-bold text-amber-900">
                                    {formatDate(
                                        brief.requested_date
                                    )}
                                </p>
                            </section>
                        )}

                    </aside>
                </div>
            </div>
        </main>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-base font-bold text-slate-900">
                {title}
            </h2>

            {children}
        </section>
    );
}

function Info({
    icon: Icon,
    label,
    value,
}: {
    icon?: React.ElementType;
    label: string;
    value?: string | null;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">

                {Icon && (
                    <Icon className="h-3.5 w-3.5" />
                )}

                {label}
            </div>

            <p className="mt-1 break-words text-sm font-medium text-slate-800">
                {value || '—'}
            </p>
        </div>
    );
}

function ContentBlock({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    if (!value) {
        return null;
    }

    return (
        <div className="mb-5 last:mb-0">

            <p className="text-xs font-semibold text-slate-500">
                {label}
            </p>

            <div className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {value}
            </div>
        </div>
    );
}

function SidebarRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">

            <span className="text-xs text-slate-500">
                {label}
            </span>

            <strong className="text-right text-xs text-slate-700">
                {value}
            </strong>
        </div>
    );
}

function StatusBadge({
    status,
}: {
    status: string;
}) {
    return (
        <span className="mt-2 inline-flex rounded-full bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-700">
            {pretty(status)}
        </span>
    );
}

function pretty(
    value?: string | null
) {
    if (!value) {
        return '—';
    }

    return value
        .replaceAll(
            '_',
            ' '
        )
        .replace(
            /\b\w/g,
            (letter) =>
                letter.toUpperCase()
        );
}

function formatDate(
    value?: string | null
) {
    if (!value) {
        return '—';
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        'en-AU',
        {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }
    ).format(date);
}

function formatDateTime(
    value?: string | null
) {
    if (!value) {
        return '—';
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        'en-AU',
        {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }
    ).format(date);
}

function formatBytes(
    bytes: number
) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const kb =
        bytes / 1024;

    if (kb < 1024) {
        return `${kb.toFixed(
            1
        )} KB`;
    }

    return `${(
        kb / 1024
    ).toFixed(2)} MB`;
}