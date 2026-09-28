'use client';

import React, {
    useCallback,
    useEffect,
    useState,
} from 'react';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
    ArrowLeft,
    Calendar,
    CheckCircle2,
    Download,
    FileText,
    Loader2,
    Mail,
    MapPin,
    Package,
    Phone,
    RefreshCw,
    User,
} from 'lucide-react';

import {
    clientBriefService,
} from '@/services/clientBriefService';

interface BriefFile {
    id: number;
    name: string;
    mime_type?: string | null;
    size_bytes?: number;
    url?: string;
}

interface ClientBriefDetail {
    id: number;
    uuid: string;

    client_name?: string | null;
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;

    request_type?: string;
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
    { value: 'draft', label: 'Draft' },
    { value: 'new', label: 'New' },
    { value: 'reviewed', label: 'Reviewed' },
    {
        value: 'needs_info',
        label: 'Need More Info',
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

    const rawId = params?.id;

    const id = Number(
        Array.isArray(rawId)
            ? rawId[0]
            : rawId
    );

    const [brief, setBrief] =
        useState<ClientBriefDetail | null>(
            null
        );

    const [loading, setLoading] =
        useState(true);

    const [updating, setUpdating] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const loadBrief = useCallback(
        async () => {
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
                    await clientBriefService.getAdminBrief(
                        id
                    );

                setBrief(data);
            } catch (err: any) {
                console.error(
                    'Failed to load client brief:',
                    err
                );

                setError(
                    err?.response?.data
                        ?.message ??
                    'Could not load client brief.'
                );
            } finally {
                setLoading(false);
            }
        },
        [id]
    );

    useEffect(() => {
        void loadBrief();
    }, [loadBrief]);

    const updateStatus = async (
        status: string
    ) => {
        if (!brief) return;

        try {
            setUpdating(true);
            setError(null);

            await clientBriefService.updateBrief(
                brief.id,
                {
                    status,
                }
            );

            setBrief((current) =>
                current
                    ? {
                        ...current,
                        status,
                    }
                    : current
            );
        } catch (err: any) {
            console.error(
                'Failed to update status:',
                err
            );

            setError(
                err?.response?.data
                    ?.message ??
                'Could not update status.'
            );
        } finally {
            setUpdating(false);
        }
    };

    const toggleActive = async () => {
        if (!brief) return;

        const nextValue =
            !(brief.is_active ?? true);

        try {
            setUpdating(true);
            setError(null);

            await clientBriefService.updateBrief(
                brief.id,
                {
                    is_active: nextValue,
                }
            );

            setBrief((current) =>
                current
                    ? {
                        ...current,
                        is_active: nextValue,
                    }
                    : current
            );
        } catch (err: any) {
            console.error(
                'Failed to update brief:',
                err
            );

            setError(
                err?.response?.data
                    ?.message ??
                'Could not update client brief.'
            );
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-600" />

                    <p className="mt-3 text-sm text-slate-500">
                        Loading client brief...
                    </p>
                </div>
            </div>
        );
    }

    if (!brief) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center">
                    <h1 className="text-xl font-bold text-slate-900">
                        Client brief unavailable
                    </h1>

                    <p className="mt-2 text-sm text-red-600">
                        {error ??
                            'Client brief could not be found.'}
                    </p>

                    <Link
                        href="/admin/client-briefs"
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Client Briefs
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Link
                            href="/admin/client-briefs"
                            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-700"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Client Briefs
                        </Link>

                        <h1 className="text-2xl font-bold text-slate-900">
                            {brief.client_name ||
                                'Client Brief'}
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Brief #{brief.id}
                            {brief.company_name
                                ? ` · ${brief.company_name}`
                                : ''}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                void loadBrief()
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </button>

                        <button
                            type="button"
                            onClick={toggleActive}
                            disabled={updating}
                            className={`rounded-xl px-4 py-2.5 text-xs font-bold ${brief.is_active ??
                                    true
                                    ? 'border border-red-200 bg-red-50 text-red-700'
                                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                }`}
                        >
                            {brief.is_active ??
                                true
                                ? 'Disable Link'
                                : 'Enable Link'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Status */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Workflow status
                            </p>

                            <StatusBadge
                                status={
                                    brief.status
                                }
                            />
                        </div>

                        <div className="min-w-[220px]">
                            <label className="text-xs font-semibold text-slate-600">
                                Change status

                                <select
                                    value={
                                        brief.status
                                    }
                                    disabled={
                                        updating
                                    }
                                    onChange={(event) =>
                                        void updateStatus(
                                            event.target
                                                .value
                                        )
                                    }
                                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500"
                                >
                                    {STATUS_OPTIONS.map(
                                        (option) => (
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
                    </div>
                </section>

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.8fr)]">
                    <div className="space-y-6">
                        {/* Client */}
                        <Section title="Client Details">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Info
                                    icon={User}
                                    label="Client"
                                    value={
                                        brief.client_name
                                    }
                                />

                                <Info
                                    icon={Package}
                                    label="Company"
                                    value={
                                        brief.company_name
                                    }
                                />

                                <Info
                                    icon={Mail}
                                    label="Email"
                                    value={
                                        brief.email
                                    }
                                />

                                <Info
                                    icon={Phone}
                                    label="Phone"
                                    value={
                                        brief.phone
                                    }
                                />
                            </div>
                        </Section>

                        {/* Job */}
                        <Section title="Project Requirements">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                                        brief.quantity !=
                                            null
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
                                    label="Previous job"
                                    value={
                                        brief.reorder_reference
                                    }
                                />
                            </div>
                        </Section>

                        {/* Size */}
                        <Section title="Size & Fulfilment">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <Info
                                    label="Width"
                                    value={
                                        brief.width !=
                                            null
                                            ? `${brief.width} ${brief.unit ??
                                            ''
                                            }`
                                            : null
                                    }
                                />

                                <Info
                                    label="Height"
                                    value={
                                        brief.height !=
                                            null
                                            ? `${brief.height} ${brief.unit ??
                                            ''
                                            }`
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
                                <div className="mt-5">
                                    <Info
                                        icon={MapPin}
                                        label="Delivery address"
                                        value={
                                            brief.delivery_address
                                        }
                                    />
                                </div>
                            )}
                        </Section>

                        {/* Requirements */}
                        <Section title="Artwork Instructions">
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

                        {/* Files */}
                        <Section title="Uploaded Files">
                            {!brief.files ||
                                brief.files.length ===
                                0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center">
                                    <FileText className="mx-auto h-8 w-8 text-slate-300" />

                                    <p className="mt-2 text-sm text-slate-500">
                                        No files were
                                        uploaded.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {brief.files.map(
                                        (file) => (
                                            <div
                                                key={
                                                    file.id
                                                }
                                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
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
                                                        Open
                                                    </a>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </Section>
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-5 lg:sticky lg:top-6">
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="font-bold text-slate-900">
                                Brief Information
                            </h2>

                            <div className="mt-5 space-y-4">
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
                                    label="Link expires"
                                    value={formatDateTime(
                                        brief.expires_at
                                    )}
                                />

                                <SidebarRow
                                    label="Link status"
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
                                            ?.length ?? 0
                                    )}
                                />
                            </div>
                        </section>

                        {brief.submitted_at && (
                            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                                <CheckCircle2 className="h-6 w-6 text-emerald-700" />

                                <h3 className="mt-3 font-bold text-emerald-900">
                                    Brief submitted
                                </h3>

                                <p className="mt-1 text-xs leading-5 text-emerald-700">
                                    The customer has
                                    completed this
                                    project brief.
                                </p>
                            </section>
                        )}

                        {brief.requested_date && (
                            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                <Calendar className="h-6 w-6 text-amber-700" />

                                <h3 className="mt-3 font-bold text-amber-900">
                                    Requested date
                                </h3>

                                <p className="mt-1 text-sm text-amber-800">
                                    {formatDate(
                                        brief.requested_date
                                    )}
                                </p>
                            </section>
                        )}
                    </aside>
                </div>
            </div>
        </div>
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
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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

            <div className="mt-1 break-words text-sm font-medium text-slate-800">
                {value || '—'}
            </div>
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
    if (!value) return null;

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
    if (!value) return '—';

    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
        );
}

function formatDate(
    value?: string | null
) {
    if (!value) return '—';

    const date = new Date(value);

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
    if (!value) return '—';

    const date = new Date(value);

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

    const kb = bytes / 1024;

    if (kb < 1024) {
        return `${kb.toFixed(1)} KB`;
    }

    return `${(
        kb / 1024
    ).toFixed(2)} MB`;
}