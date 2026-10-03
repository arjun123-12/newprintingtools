'use client';

import React, {
    ChangeEvent,
    FormEvent,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    ArrowRight,
    CheckCircle2,
    FileText,
    HelpCircle,
    PackageCheck,
    Palette,
    Printer,
    RotateCcw,
    UploadCloud,
} from 'lucide-react';

const API_URL = (
    process.env.NEXT_PUBLIC_API_URL ??
    'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '');

type RequestType =
    | 'ready'
    | 'design'
    | 'reorder';

type FulfilmentType =
    | 'pickup'
    | 'delivery'
    | 'unsure';

type UnitType =
    | 'mm'
    | 'cm'
    | 'm';

interface ClientBriefFormProps {
    token: string;
}

interface FormState {
    requestType: RequestType;

    contact: string;
    company: string;
    email: string;
    phone: string;

    reorderReference: string;

    product: string;
    quantity: string;
    requestedDate: string;

    width: string;
    height: string;
    unit: UnitType;

    printSides: 'front' | 'back' | 'both';

    fulfilment: FulfilmentType;
    address: string;

    colours: string;
    specs: string;
    additionalNotes: string;

    confirmDetails: boolean;
}

const INITIAL_FORM: FormState = {
    requestType: 'ready',

    contact: '',
    company: '',
    email: '',
    phone: '',

    reorderReference: '',

    product: '',
    quantity: '',

    requestedDate: '',

    width: '',
    height: '',
    unit: 'mm',

    printSides: 'front',

    fulfilment: 'pickup',
    address: '',

    colours: '',
    specs: '',
    additionalNotes: '',

    confirmDetails: false,
};

const PRODUCTS = [
    'Business cards',
    'Flyers',
    'Brochures',
    'Posters',
    'Pull-up banners',
    'Vinyl banners',
    'Stickers / labels',
    'Corflute signs',
    'A-frames',
    'T-shirt printing',
    'Invitations',
    'Menus',
    'Booklets',
    'Other / custom',
];

const MAX_FILE_SIZE =
    50 * 1024 * 1024;

const MAX_FILES = 10;

export default function ClientBriefForm({
    token,
}: ClientBriefFormProps) {
    const [form, setForm] =
        useState<FormState>(
            INITIAL_FORM
        );

    const [files, setFiles] =
        useState<File[]>([]);

    const [submitting, setSubmitting] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const [success, setSuccess] =
        useState(false);

    const [reference, setReference] =
        useState<string | null>(null);

    const [checkingLink, setCheckingLink] =
        useState(true);

    const [linkError, setLinkError] =
        useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const validatePrivateLink = async () => {
            try {
                setCheckingLink(true);
                setLinkError(null);

                const response = await fetch(
                    `${API_URL}/client-brief/${encodeURIComponent(
                        token
                    )}`,
                    {
                        method: 'GET',
                        headers: {
                            Accept: 'application/json',
                        },
                    }
                );

                const result = await response
                    .json()
                    .catch(() => null);

                if (!response.ok) {
                    throw new Error(
                        result?.message ??
                        'This private client link is invalid or expired.'
                    );
                }

                if (cancelled) {
                    return;
                }

                const brief = result?.data;

                if (brief?.submitted) {
                    setLinkError(
                        'This client brief has already been submitted.'
                    );
                    return;
                }

                setForm((current) => ({
                    ...current,
                    contact:
                        current.contact ||
                        brief?.client_name ||
                        '',
                    company:
                        current.company ||
                        brief?.company_name ||
                        '',
                    email:
                        current.email ||
                        brief?.email ||
                        '',
                }));
            } catch (linkValidationError) {
                if (cancelled) {
                    return;
                }

                setLinkError(
                    linkValidationError instanceof Error
                        ? linkValidationError.message
                        : 'This private client link is unavailable.'
                );
            } finally {
                if (!cancelled) {
                    setCheckingLink(false);
                }
            }
        };

        void validatePrivateLink();

        return () => {
            cancelled = true;
        };
    }, [token]);

    const totalUploadSize =
        useMemo(
            () =>
                files.reduce(
                    (total, file) =>
                        total + file.size,
                    0
                ),
            [files]
        );

    const updateField = <
        K extends keyof FormState
    >(
        key: K,
        value: FormState[K]
    ) => {
        setForm((previous) => ({
            ...previous,
            [key]: value,
        }));
    };

    const handleFiles = (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        setError(null);

        const selected =
            Array.from(
                event.target.files ?? []
            );

        if (
            selected.length > MAX_FILES
        ) {
            setError(
                `Please upload no more than ${MAX_FILES} files.`
            );

            event.target.value = '';
            return;
        }

        const oversized =
            selected.find(
                (file) =>
                    file.size >
                    MAX_FILE_SIZE
            );

        if (oversized) {
            setError(
                `${oversized.name} is larger than 50 MB.`
            );

            event.target.value = '';
            return;
        }

        setFiles(selected);
    };

    const removeFile = (
        index: number
    ) => {
        setFiles((current) =>
            current.filter(
                (_, itemIndex) =>
                    itemIndex !== index
            )
        );
    };

    const validate = () => {
        if (!form.contact.trim()) {
            return 'Please enter your contact name.';
        }

        if (!form.email.trim()) {
            return 'Please enter your email address.';
        }

        if (!form.phone.trim()) {
            return 'Please enter your phone number.';
        }

        if (
            form.requestType ===
            'reorder' &&
            !form.reorderReference.trim()
        ) {
            return 'Please enter the previous job reference.';
        }

        if (!form.product.trim()) {
            return 'Please choose a product.';
        }

        if (
            !form.quantity ||
            Number(form.quantity) < 1
        ) {
            return 'Please enter a valid quantity.';
        }

        const hasWidth =
            form.width.trim() !== '';

        const hasHeight =
            form.height.trim() !== '';

        if (hasWidth !== hasHeight) {
            return 'Enter both width and height, or leave both blank.';
        }

        if (
            form.fulfilment ===
            'delivery' &&
            !form.address.trim()
        ) {
            return 'Please enter the delivery address.';
        }

        if (!form.specs.trim()) {
            return 'Please tell us what you need.';
        }

        if (!form.confirmDetails) {
            return 'Please confirm the supplied details are correct.';
        }

        return null;
    };

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        setError(null);

        const validationError =
            validate();

        if (validationError) {
            setError(
                validationError
            );

            return;
        }

        setSubmitting(true);

        try {
            const data =
                new FormData();

            data.append(
                'request_type',
                form.requestType
            );

            data.append(
                'contact',
                form.contact
            );

            data.append(
                'company',
                form.company
            );

            data.append(
                'email',
                form.email
            );

            data.append(
                'phone',
                form.phone
            );

            data.append(
                'reorder_reference',
                form.reorderReference
            );

            data.append(
                'product',
                form.product
            );

            data.append(
                'quantity',
                form.quantity
            );

            data.append(
                'requested_date',
                form.requestedDate
            );

            data.append(
                'width',
                form.width
            );

            data.append(
                'height',
                form.height
            );

            data.append(
                'unit',
                form.unit
            );

            data.append(
                'print_sides',
                form.printSides
            );

            data.append(
                'fulfilment',
                form.fulfilment
            );

            data.append(
                'address',
                form.address
            );

            data.append(
                'colours',
                form.colours
            );

            data.append(
                'specs',
                form.specs
            );

            data.append(
                'additional_notes',
                form.additionalNotes
            );

            files.forEach(
                (file) => {
                    data.append(
                        'files[]',
                        file
                    );
                }
            );

            const response =
                await fetch(
                    `${API_URL}/client-brief/${encodeURIComponent(
                        token
                    )}/submit`,
                    {
                        method: 'POST',
                        body: data,
                        headers: {
                            Accept:
                                'application/json',
                        },
                    }
                );

            const result =
                await response
                    .json()
                    .catch(
                        () => null
                    );

            if (!response.ok) {
                throw new Error(
                    result?.message ??
                    'We could not submit your request.'
                );
            }

            setReference(
                result?.data
                    ?.reference ??
                null
            );

            setSuccess(true);
        } catch (submitError) {
            setError(
                submitError instanceof
                    Error
                    ? submitError.message
                    : 'We could not submit your request.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (checkingLink) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f8f5] px-4">
                <div className="text-center">
                    <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#dce6e3] border-t-[#154e45]" />

                    <p className="mt-4 text-sm text-[#647577]">
                        Checking your private request link...
                    </p>
                </div>
            </main>
        );
    }

    if (linkError) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f8f5] px-4">
                <div className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-2xl font-bold text-[#172e32]">
                        This link is unavailable
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-red-600">
                        {linkError}
                    </p>

                    <p className="mt-5 text-xs leading-5 text-[#647577]">
                        Please contact us for a new private project request link.
                    </p>
                </div>
            </main>
        );
    }

    if (success) {
        return (
            <main className="min-h-screen bg-[#f5f8f5] px-4 py-12 text-[#172e32]">
                <div className="mx-auto max-w-xl rounded-3xl border border-[#dce6e3] bg-white p-8 text-center shadow-sm sm:p-12">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e2f1df] text-[#154e45]">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>

                    <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-[#154e45]">
                        Request received
                    </p>

                    <h1 className="mt-3 text-3xl font-bold tracking-tight">
                        Thanks. We&apos;ll
                        take it from here.
                    </h1>

                    <p className="mt-4 text-sm leading-6 text-[#647577]">
                        Your printing
                        requirements and
                        supplied files have
                        been received for
                        review.
                    </p>

                    {reference && (
                        <div className="mt-7 rounded-2xl bg-[#f5f8f5] p-5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#647577]">
                                Job reference
                            </span>

                            <strong className="mt-1 block text-xl text-[#154e45]">
                                {reference}
                            </strong>
                        </div>
                    )}

                    <p className="mt-6 text-xs leading-5 text-[#647577]">
                        We&apos;ll confirm
                        pricing, artwork and
                        completion details
                        after reviewing your
                        request.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#f5f8f5] text-[#172e32]">
            {/* Header */}
            <header className="border-b border-[#dce6e3] bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#154e45] text-xl font-black text-[#f1f5dd]">
                            P
                        </div>

                        <div>
                            <div className="font-extrabold tracking-tight">
                                PrintStudio Pro
                            </div>

                            <div className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#647577]">
                                Client Job Desk
                            </div>
                        </div>
                    </div>

                    <span className="rounded-full border border-[#c7dccc] bg-[#edf5e9] px-3 py-1.5 text-[11px] font-bold text-[#285740]">
                        Private request link
                    </span>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Heading */}
                <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
                    <div>
                        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#154e45]">
                            New print request
                        </p>

                        <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                            What can we print
                            for you?
                        </h1>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#647577]">
                            Tell us what you
                            need. If you
                            don&apos;t know a
                            specification,
                            leave it blank and
                            ask us for advice.
                        </p>
                    </div>

                    <span className="rounded-full border border-[#c7dccc] bg-[#edf5e9] px-4 py-2 text-xs font-bold text-[#285740]">
                        Request first · We&apos;ll
                        confirm the details
                    </span>
                </div>

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.8fr)]">
                    {/* Form */}
                    <form
                        onSubmit={
                            handleSubmit
                        }
                        className="rounded-2xl border border-[#dce6e3] bg-white p-5 shadow-sm sm:p-7"
                    >
                        {/* Request type */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <RequestChoice
                                checked={
                                    form.requestType ===
                                    'ready'
                                }
                                icon={Printer}
                                title="Print my design"
                                description="I already have artwork"
                                onClick={() =>
                                    updateField(
                                        'requestType',
                                        'ready'
                                    )
                                }
                            />

                            <RequestChoice
                                checked={
                                    form.requestType ===
                                    'design'
                                }
                                icon={Palette}
                                title="Help me design"
                                description="I need design assistance"
                                onClick={() =>
                                    updateField(
                                        'requestType',
                                        'design'
                                    )
                                }
                            />

                            <RequestChoice
                                checked={
                                    form.requestType ===
                                    'reorder'
                                }
                                icon={RotateCcw}
                                title="Order again"
                                description="I have a job reference"
                                onClick={() =>
                                    updateField(
                                        'requestType',
                                        'reorder'
                                    )
                                }
                            />
                        </div>

                        {/* Contact */}
                        <SectionTitle
                            number="01"
                            title="Your details"
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                label="Contact name"
                                required
                            >
                                <input
                                    value={
                                        form.contact
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'contact',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                    placeholder="Your name"
                                />
                            </Field>

                            <Field label="Company / business">
                                <input
                                    value={
                                        form.company
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'company',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                    placeholder="Optional"
                                />
                            </Field>

                            <Field
                                label="Email"
                                required
                            >
                                <input
                                    type="email"
                                    value={
                                        form.email
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'email',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                    placeholder="you@example.com"
                                />
                            </Field>

                            <Field
                                label="Phone"
                                required
                            >
                                <input
                                    type="tel"
                                    value={
                                        form.phone
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'phone',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                    placeholder="Phone number"
                                />
                            </Field>
                        </div>

                        {form.requestType ===
                            'reorder' && (
                                <div className="mt-4">
                                    <Field
                                        label="Previous job reference"
                                        required
                                    >
                                        <input
                                            value={
                                                form.reorderReference
                                            }
                                            onChange={(e) =>
                                                updateField(
                                                    'reorderReference',
                                                    e.target.value
                                                )
                                            }
                                            className={inputClass}
                                            placeholder="e.g. JOB-2026-00128"
                                        />
                                    </Field>
                                </div>
                            )}

                        {/* Job requirements */}
                        <SectionTitle
                            number="02"
                            title="Project requirements"
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                label="Product"
                                required
                            >
                                <input
                                    list="client-products"
                                    value={
                                        form.product
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'product',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                    placeholder="Choose or type a custom product"
                                />

                                <datalist id="client-products">
                                    {PRODUCTS.map(
                                        (product) => (
                                            <option
                                                key={
                                                    product
                                                }
                                                value={
                                                    product
                                                }
                                            />
                                        )
                                    )}
                                </datalist>
                            </Field>

                            <Field
                                label="Quantity"
                                required
                            >
                                <input
                                    type="number"
                                    min={1}
                                    max={10000000}
                                    step={1}
                                    value={
                                        form.quantity
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'quantity',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                    placeholder="500"
                                />
                            </Field>

                            <Field label="Requested date">
                                <input
                                    type="date"
                                    value={
                                        form.requestedDate
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'requestedDate',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                />
                            </Field>

                            <Field label="Print sides">
                                <select
                                    value={
                                        form.printSides
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'printSides',
                                            e.target
                                                .value as FormState['printSides']
                                        )
                                    }
                                    className={inputClass}
                                >
                                    <option value="front">
                                        Front only
                                    </option>

                                    <option value="back">
                                        Back only
                                    </option>

                                    <option value="both">
                                        Front & back
                                    </option>
                                </select>
                            </Field>
                        </div>

                        {/* Dimensions */}
                        <SectionTitle
                            number="03"
                            title="Size & printing"
                        />

                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Width">
                                <input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    value={
                                        form.width
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'width',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                    placeholder="Optional"
                                />
                            </Field>

                            <Field label="Height">
                                <input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    value={
                                        form.height
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'height',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                    placeholder="Optional"
                                />
                            </Field>

                            <Field label="Unit">
                                <select
                                    value={
                                        form.unit
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'unit',
                                            e.target
                                                .value as UnitType
                                        )
                                    }
                                    className={inputClass}
                                >
                                    <option value="mm">
                                        mm
                                    </option>

                                    <option value="cm">
                                        cm
                                    </option>

                                    <option value="m">
                                        m
                                    </option>
                                </select>
                            </Field>
                        </div>

                        <p className="mt-2 text-xs text-[#647577]">
                            Not sure about
                            dimensions? Leave
                            them blank and tell
                            us you need advice.
                        </p>

                        {/* Fulfilment */}
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <Field label="How would you like to receive it?">
                                <select
                                    value={
                                        form.fulfilment
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'fulfilment',
                                            e.target
                                                .value as FulfilmentType
                                        )
                                    }
                                    className={inputClass}
                                >
                                    <option value="pickup">
                                        Pickup
                                    </option>

                                    <option value="delivery">
                                        Delivery
                                    </option>

                                    <option value="unsure">
                                        Please advise
                                    </option>
                                </select>
                            </Field>

                            <Field label="Preferred colours">
                                <input
                                    value={
                                        form.colours
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'colours',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                    placeholder="e.g. Black, gold, #154E45"
                                />
                            </Field>
                        </div>

                        {form.fulfilment ===
                            'delivery' && (
                                <div className="mt-1">
                                    <Field
                                        label="Delivery address"
                                        required
                                    >
                                        <textarea
                                            value={
                                                form.address
                                            }
                                            onChange={(e) =>
                                                updateField(
                                                    'address',
                                                    e.target.value
                                                )
                                            }
                                            className={`${inputClass} min-h-24 resize-y`}
                                            placeholder="Full delivery address"
                                        />
                                    </Field>
                                </div>
                            )}

                        {/* Description */}
                        <SectionTitle
                            number="04"
                            title="Tell us what you need"
                        />

                        <Field
                            label="Project instructions"
                            required
                        >
                            <textarea
                                value={
                                    form.specs
                                }
                                onChange={(e) =>
                                    updateField(
                                        'specs',
                                        e.target.value
                                    )
                                }
                                className={`${inputClass} min-h-32 resize-y`}
                                placeholder="Include material, finish, colours, design instructions, wording, preferred style or anything else we should know."
                            />
                        </Field>

                        <p className="-mt-2 text-xs text-[#647577]">
                            “Please recommend”
                            is completely fine
                            if you&apos;re not
                            sure.
                        </p>

                        <div className="mt-4">
                            <Field label="Additional notes">
                                <textarea
                                    value={
                                        form.additionalNotes
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'additionalNotes',
                                            e.target.value
                                        )
                                    }
                                    className={`${inputClass} min-h-24 resize-y`}
                                    placeholder="Anything else?"
                                />
                            </Field>
                        </div>

                        {/* Uploads */}
                        <SectionTitle
                            number="05"
                            title="Upload artwork & references"
                        />

                        <label className="group block cursor-pointer rounded-2xl border-2 border-dashed border-[#c7d7d2] bg-[#f9fbf9] p-7 text-center transition hover:border-[#6f9b8e] hover:bg-[#f2f8f3]">
                            <UploadCloud className="mx-auto h-8 w-8 text-[#154e45]" />

                            <strong className="mt-3 block text-sm">
                                Upload artwork,
                                logo or reference
                                files
                            </strong>

                            <span className="mt-1 block text-xs text-[#647577]">
                                PDF, PNG, JPG,
                                SVG, AI, PSD or
                                other supplied
                                artwork
                            </span>

                            <span className="mt-2 block text-[11px] text-[#647577]">
                                Maximum 10 files ·
                                50 MB each
                            </span>

                            <input
                                type="file"
                                multiple
                                onChange={
                                    handleFiles
                                }
                                className="sr-only"
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.ai,.eps,.psd,.tif,.tiff"
                            />
                        </label>

                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {files.map(
                                    (
                                        file,
                                        index
                                    ) => (
                                        <div
                                            key={`${file.name}-${index}`}
                                            className="flex items-center justify-between gap-3 rounded-xl border border-[#dce6e3] px-4 py-3"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <FileText className="h-5 w-5 shrink-0 text-[#154e45]" />

                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold">
                                                        {
                                                            file.name
                                                        }
                                                    </p>

                                                    <p className="text-[11px] text-[#647577]">
                                                        {(
                                                            file.size /
                                                            1024 /
                                                            1024
                                                        ).toFixed(
                                                            2
                                                        )}{' '}
                                                        MB
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeFile(
                                                        index
                                                    )
                                                }
                                                className="text-xs font-bold text-red-600 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )
                                )}

                                <p className="text-right text-[11px] text-[#647577]">
                                    Total:{' '}
                                    {(
                                        totalUploadSize /
                                        1024 /
                                        1024
                                    ).toFixed(2)}{' '}
                                    MB
                                </p>
                            </div>
                        )}

                        {/* Confirmation */}
                        <div className="mt-7 rounded-2xl border border-[#dce6e3] bg-[#f8faf8] p-4">
                            <label className="flex cursor-pointer items-start gap-3 text-sm">
                                <input
                                    type="checkbox"
                                    checked={
                                        form.confirmDetails
                                    }
                                    onChange={(e) =>
                                        updateField(
                                            'confirmDetails',
                                            e.target.checked
                                        )
                                    }
                                    className="mt-1 h-4 w-4 accent-[#154e45]"
                                />

                                <span className="leading-6">
                                    I confirm the
                                    supplied
                                    information,
                                    wording and files
                                    are correct to
                                    the best of my
                                    knowledge. I
                                    understand this
                                    is a request and
                                    pricing /
                                    completion date
                                    will be confirmed
                                    after review.
                                </span>
                            </label>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={
                                submitting
                            }
                            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#154e45] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                            {submitting
                                ? 'Sending request...'
                                : 'Send job request'}

                            {!submitting && (
                                <ArrowRight className="h-4 w-4" />
                            )}
                        </button>
                    </form>

                    {/* Right side */}
                    <aside className="space-y-5 lg:sticky lg:top-6">
                        <section className="rounded-2xl border border-[#dce6e3] bg-white p-6 shadow-sm">
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#154e45]">
                                What happens next
                            </p>

                            <h2 className="mt-3 text-2xl font-bold tracking-tight">
                                We&apos;ll take it
                                from here.
                            </h2>

                            <div className="mt-6 space-y-5">
                                <Step
                                    number="1"
                                    title="Request received"
                                    text="Your project gets a job reference."
                                />

                                <Step
                                    number="2"
                                    title="Artwork review"
                                    text="We check your requirements and supplied artwork."
                                />

                                <Step
                                    number="3"
                                    title="Quote & proof"
                                    text="You review pricing and the final proof before production."
                                />

                                <Step
                                    number="4"
                                    title="Production"
                                    text="After approval, we confirm the printing schedule."
                                />
                            </div>
                        </section>

                        <section className="rounded-2xl bg-[#154e45] p-6 text-white shadow-sm">
                            <PackageCheck className="h-7 w-7 text-[#dff0df]" />

                            <h3 className="mt-4 text-xl font-bold">
                                Not sure what to
                                choose?
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-[#d2e7df]">
                                You don&apos;t
                                need to know every
                                printing
                                specification.
                                Tell us the result
                                you&apos;re after
                                and we can
                                recommend the
                                right size,
                                material and
                                finish.
                            </p>
                        </section>

                        <section className="rounded-2xl border border-[#efd8bb] bg-[#fff9ef] p-5">
                            <div className="flex gap-3">
                                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#9a662e]" />

                                <p className="text-xs leading-5 text-[#76542f]">
                                    This private
                                    link is intended
                                    for your project.
                                    Please don&apos;t
                                    forward it
                                    publicly.
                                </p>
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </main>
    );
}

const inputClass =
    'mt-1.5 block w-full rounded-xl border border-[#bfcfca] bg-white px-3.5 py-3 text-sm text-[#172e32] outline-none transition placeholder:text-[#97a5a3] focus:border-[#6a9275] focus:ring-2 focus:ring-[#aacdbf]/40';

function SectionTitle({
    number,
    title,
}: {
    number: string;
    title: string;
}) {
    return (
        <div className="mb-4 mt-8 flex items-center gap-3 border-t border-[#e5ece9] pt-7">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-[#dce6e3] text-[10px] font-bold text-[#657d6f]">
                {number}
            </span>

            <h2 className="text-lg font-bold tracking-tight">
                {title}
            </h2>
        </div>
    );
}

function Field({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block text-xs font-bold text-[#334d50]">
            {label}

            {required && (
                <span className="ml-1 text-red-500">
                    *
                </span>
            )}

            {children}
        </label>
    );
}

function RequestChoice({
    checked,
    icon: Icon,
    title,
    description,
    onClick,
}: {
    checked: boolean;
    icon: React.ElementType;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl border p-4 text-left transition ${checked
                ? 'border-[#6a9275] bg-[#f0f7ed] ring-2 ring-[#aacdbf]/25'
                : 'border-[#dce6e3] bg-white hover:border-[#a8beb6] hover:bg-[#fafcfb]'
                }`}
        >
            <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${checked
                    ? 'bg-[#154e45] text-white'
                    : 'bg-[#edf3ef] text-[#45665c]'
                    }`}
            >
                <Icon className="h-4 w-4" />
            </div>

            <strong className="mt-3 block text-sm">
                {title}
            </strong>

            <span className="mt-1 block text-xs text-[#647577]">
                {description}
            </span>
        </button>
    );
}

function Step({
    number,
    title,
    text,
}: {
    number: string;
    title: string;
    text: string;
}) {
    return (
        <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e2f1df] text-xs font-extrabold text-[#154e45]">
                {number}
            </span>

            <div>
                <strong className="block text-sm">
                    {title}
                </strong>

                <p className="mt-1 text-xs leading-5 text-[#647577]">
                    {text}
                </p>
            </div>
        </div>
    );
}