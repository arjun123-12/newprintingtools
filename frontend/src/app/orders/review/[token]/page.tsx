'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  ShieldCheck,
  CreditCard,
  Package,
  Clock,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Check,
  RefreshCw,
  AlertTriangle,
  Truck,
  Eye,
  FileCheck,
  Image as ImageIcon,
  ThumbsUp,
  Printer,
  Scissors,
  PackageCheck,
  Store,
  MapPin,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { orderReviewService, CustomerReviewData } from '@/services/orderReviewService';
import { Artwork3DViewer } from '@/components/designer/controls/Artwork3DViewer';
import SpinAndWinWheel from '@/components/rewards/SpinAndWinWheel';
import { formatImageUrl } from '@/utils/imageUrl';
import type { CanvasDimensions, DocumentSettings, UnitType } from '@/types/designer';

function getCanvasPage(value: unknown, pageIndex = 0): Record<string, any> | null {
  let parsed: any = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (Array.isArray(parsed)) return getCanvasPage(parsed[pageIndex], 0);
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed.objects)) {
    const background = String(parsed.background || '').trim().toLowerCase();
    const hasVisibleContent = parsed.objects.length > 0 || Boolean(parsed.backgroundImage) ||
      (background !== '' && !['#fff', '#ffffff', 'white', 'transparent', 'rgba(0, 0, 0, 0)'].includes(background));
    return pageIndex === 0 && hasVisibleContent ? parsed : null;
  }
  if (Array.isArray(parsed.pages)) {
    const page = parsed.pages[pageIndex];
    return getCanvasPage(page?.canvas_json ?? page?.template_json ?? page, 0);
  }
  if (parsed.canvas_json !== undefined) return getCanvasPage(parsed.canvas_json, pageIndex);
  if (parsed.template_json !== undefined) return getCanvasPage(parsed.template_json, pageIndex);
  return null;
}

declare global {
  interface Window {
    BPOINT?: {
      txn?: {
        authkey?: {
          setupIframeFields: (authkey: string, options: any) => void;
        };
      };
    };
  }
}

interface TrackOrderStep {
  key: string;
  label: string;
  pickupLabel?: string;
  description: string;
  pickupDescription?: string;
  icon: React.ComponentType<{ className?: string }>;
  pickupIcon?: React.ComponentType<{ className?: string }>;
}

const TRACK_ORDER_STEPS: TrackOrderStep[] = [
  {
    key: 'order_received',
    label: 'Order Received',
    description: 'Payment confirmed and order is being prepared.',
    icon: FileCheck,
  },
  {
    key: 'artwork_review',
    label: 'Artwork Review',
    description: 'Artwork checked for print readiness.',
    icon: ImageIcon,
  },
  {
    key: 'artwork_approved',
    label: 'Artwork Approved',
    description: 'Final artwork approved and sent to production.',
    icon: ThumbsUp,
  },
  {
    key: 'printing',
    label: 'Printing',
    description: 'Commercial printing in progress on selected material.',
    icon: Printer,
  },
  {
    key: 'cutting_and_finishing',
    label: 'Cutting & Finishing',
    description: 'Precision trimming, guillotine cutting, folding & finishing.',
    icon: Scissors,
  },
  {
    key: 'quality_check_and_packaging',
    label: 'Quality Check & Packaging',
    description: 'Quality inspected and securely packaged.',
    icon: PackageCheck,
  },
  {
    key: 'pickup_or_delivery',
    label: 'Delivery',
    pickupLabel: 'Pickup in Store',
    description: 'Dispatched and delivered to your address.',
    pickupDescription: 'Packed and ready for pickup in store.',
    icon: Truck,
    pickupIcon: Store,
  },
];

function getTrackOrderStepIndex(status: string): number {
  switch (status) {
    case 'draft':
    case 'pending_payment':
      return 0; // Step 1: Order Received
    case 'artwork_required':
    case 'artwork_review':
    case 'changes_requested':
      return 1; // Step 2: Artwork Review
    case 'approved':
      return 2; // Step 3: Artwork Approved
    case 'printing':
    case 'in_production':
    case 'production_started':
      return 3; // Step 4: Printing
    case 'cutting_and_finishing':
    case 'cutting_in_progress':
      return 4; // Step 5: Cutting & Finishing
    case 'quality_check_and_packaging':
    case 'production_completed':
    case 'packing':
      return 5; // Step 6: Quality Check & Packaging
    case 'ready_for_pickup':
    case 'ready_for_shipping':
    case 'ready_for_dispatch':
    case 'dispatched':
    case 'handed_over_to_courier':
    case 'delivered':
    case 'collected':
      return 6; // Step 7: Pickup in Store / Delivery
    default:
      return 3;
  }
}

function getTrackOrderStepTitle(stepIndex: number, isPickup: boolean, status?: string): string {
  switch (stepIndex) {
    case 0:
      return 'Order Received';
    case 1:
      return 'Artwork Review';
    case 2:
      return 'Artwork Approved';
    case 3:
      return 'Printing';
    case 4:
      return 'Cutting & Finishing';
    case 5:
      return 'Quality Check & Packaging';
    case 6:
      return isPickup ? 'Pickup in Store' : 'Delivery';
    default:
      return 'Printing';
  }
}

function getTrackOrderSubtitle(stepIndex: number, orderNumber: string, isPickup: boolean, status?: string): string {
  switch (stepIndex) {
    case 0:
      return `Your order ${orderNumber} has been received and payment is confirmed.`;
    case 1:
      return `Your order ${orderNumber} artwork is currently checked for print readiness.`;
    case 2:
      return `Your order ${orderNumber} artwork has been approved and sent to production.`;
    case 3:
      return `Your order ${orderNumber} is currently printing on our commercial digital & offset presses.`;
    case 4:
      return `Your order ${orderNumber} is undergoing precision cutting, trimming, folding and finishing.`;
    case 5:
      return `Your order ${orderNumber} has completed production and is in quality inspection and packaging.`;
    case 6:
      if (isPickup) {
        return status === 'collected'
          ? `Your order ${orderNumber} has been collected from our store. Thank you for your business!`
          : `Your order ${orderNumber} is packed and ready for pickup in store.`;
      }
      return status === 'delivered'
        ? `Your order ${orderNumber} has been delivered to your provided address.`
        : `Your order ${orderNumber} is on the way for delivery to your address.`;
    default:
      return `Your order ${orderNumber} is currently in production. Our team is printing and finishing your order.`;
  }
}

interface PageProps {
  params: Promise<{ token: string }>;
}

const ORDER_TRUST_PRODUCTS = [
  'Business Cards',
  'Flyers & Brochures',
  'Posters',
  'Vinyl & Pull-Up Banners',
  'Stickers & Labels',
  'Signage',
  'Packaging & Roll Labels',
];

function OrderTrustStrip() {
  return (
    <section
      aria-label="Erry Imprints print products and service guarantees"
      className="sticky top-20 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur"
    >
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="hidden shrink-0 items-center gap-2 text-xs font-bold text-slate-700 sm:flex">
          <PackageCheck className="h-4 w-4 text-emerald-600" />
          <span>Print products we deliver</span>
        </div>
        <div className="order-review-trust-marquee relative min-w-0 flex-1 overflow-hidden">
          <div className="order-review-trust-track flex w-max items-center">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                aria-hidden={copy === 1}
                className="flex shrink-0 items-center gap-6 pr-6 sm:gap-8 sm:pr-8"
              >
                {ORDER_TRUST_PRODUCTS.map((product) => (
                  <span key={product} className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
                    {product}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <span className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-white to-transparent" aria-hidden="true" />
          <span className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 text-[11px] font-semibold text-emerald-700 lg:flex">
          <ShieldCheck className="h-4 w-4" />
          <span>Quality checked · Australia-wide</span>
        </div>
      </div>
    </section>
  );
}

type ZonedClockParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function getZonedClockParts(date: Date, timeZone: string): ZonedClockParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function zonedTimeToTimestamp(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  const desiredWallTime = Date.UTC(year, month - 1, day, hour, minute, 0);
  let timestamp = desiredWallTime;
  // Resolve the timezone offset iteratively so DST changes are respected.
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = getZonedClockParts(new Date(timestamp), timeZone);
    const representedWallTime = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    timestamp += desiredWallTime - representedWallTime;
  }
  return timestamp;
}

function getNextBusinessCutoffTimestamp(now: number, cutoffTime: string, timeZone: string): number {
  const localNow = getZonedClockParts(new Date(now), timeZone);
  const [hour, minute] = cutoffTime.split(':').map(Number);
  let localDate = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));
  let target = zonedTimeToTimestamp(localNow.year, localNow.month, localNow.day, hour || 10, minute || 0, timeZone);

  if (target <= now || localDate.getUTCDay() === 0 || localDate.getUTCDay() === 6) {
    do {
      localDate.setUTCDate(localDate.getUTCDate() + 1);
    } while (localDate.getUTCDay() === 0 || localDate.getUTCDay() === 6);

    target = zonedTimeToTimestamp(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth() + 1,
      localDate.getUTCDate(),
      hour || 10,
      minute || 0,
      timeZone,
    );
  }

  return target;
}

function formatCountdown(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

function getCountdownUnits(milliseconds: number): { days: string; hours: string; minutes: string; seconds: string } {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(totalSeconds % 60).padStart(2, '0'),
  };
}

interface ReviewCountdownCardProps {
  orderData: CustomerReviewData;
}

function ReviewCountdownCard({ orderData }: ReviewCountdownCardProps) {
  // Self-contained 1-second timer: updates ONLY this card without re-rendering the 2300-line parent page
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timezone = orderData.order_cutoff_timezone || 'Australia/Adelaide';
  const cutoffTime = orderData.order_cutoff_time || '10:00';
  const isPaid = orderData.payment_status === 'paid';
  const dispatchTarget = isPaid && orderData.estimated_dispatch_at
    ? Date.parse(orderData.estimated_dispatch_at)
    : Number.NaN;
  const target = isPaid ? dispatchTarget : getNextBusinessCutoffTimestamp(now, cutoffTime, timezone);
  const hasValidTarget = Number.isFinite(target);
  const units = hasValidTarget ? getCountdownUnits(target - now) : null;
  const targetDate = hasValidTarget
    ? new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(target))
    : null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-4 sm:p-5 transition-shadow shadow-xs hover:shadow-md ${isPaid
        ? 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 via-teal-50/60 to-emerald-50/80 text-emerald-950'
        : 'border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-amber-100/40 to-orange-50/60 text-amber-950'
        }`}
    >
      {/* Subtle ambient glow aura */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full blur-2xl opacity-40 transition-opacity ${isPaid ? 'bg-emerald-400/30' : 'bg-amber-400/30'
          }`}
      />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Header row: animated icon + title + status pill */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className={`relative flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-colors ${isPaid
                ? 'border-emerald-300/80 bg-white/95 text-emerald-600'
                : 'border-amber-300/80 bg-white/95 text-amber-600'
                }`}
            >
              {/* Gentle animated ping ring, respecting prefers-reduced-motion */}
              <span
                className={`absolute inset-0 rounded-xl opacity-25 motion-safe:animate-ping motion-reduce:hidden ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                style={{ animationDuration: '3s' }}
              />
              {/* Subtle pulse on the clock icon */}
              <Clock className="relative h-5 w-5 motion-safe:animate-pulse motion-reduce:animate-none" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight">
                {isPaid ? 'Estimated Dispatch Countdown' : 'Time Until Next Cut-Off'}
              </h2>
              <p className={`text-[11px] sm:text-xs font-medium ${isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isPaid
                  ? 'Live production & packaging timer'
                  : `Daily cut-off: ${cutoffTime} (${timezone.replace('Australia/', '')} time)`}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${isPaid
              ? 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
              : 'bg-amber-100/80 border-amber-300 text-amber-800'
              }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isPaid ? 'bg-emerald-600' : 'bg-amber-600'
                } motion-safe:animate-pulse`}
            />
            {isPaid ? 'In Production' : 'Daily Cut-Off'}
          </span>
        </div>

        {/* Digit tiles: only rendered if a valid countdown target exists */}
        {units && (
          <div className="grid w-full max-w-[680px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-3 py-1">
            {/* Days Tile */}
            <div
              className={`flex min-w-0 w-full flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-1 sm:px-3 py-2 sm:py-2.5 shadow-xs transition-transform ${isPaid
                ? 'border-emerald-200/90 bg-white/95 text-emerald-950'
                : 'border-amber-200/90 bg-white/95 text-amber-950'
                }`}
            >
              <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">
                {units.days}
              </span>
              <span
                className={`mt-0.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase ${isPaid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
              >
                Days
              </span>
            </div>

            <span
              className={`font-mono text-sm sm:text-xl font-bold select-none ${isPaid ? 'text-emerald-400' : 'text-amber-400'
                }`}
            >
              :
            </span>

            {/* Hours Tile */}
            <div
              className={`flex min-w-0 w-full flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-1 sm:px-3 py-2 sm:py-2.5 shadow-xs transition-transform ${isPaid
                ? 'border-emerald-200/90 bg-white/95 text-emerald-950'
                : 'border-amber-200/90 bg-white/95 text-amber-950'
                }`}
            >
              <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">
                {units.hours}
              </span>
              <span
                className={`mt-0.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase ${isPaid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
              >
                Hours
              </span>
            </div>

            <span
              className={`font-mono text-sm sm:text-xl font-bold select-none ${isPaid ? 'text-emerald-400' : 'text-amber-400'
                }`}
            >
              :
            </span>

            {/* Minutes Tile */}
            <div
              className={`flex min-w-0 w-full flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-1 sm:px-3 py-2 sm:py-2.5 shadow-xs transition-transform ${isPaid
                ? 'border-emerald-200/90 bg-white/95 text-emerald-950'
                : 'border-amber-200/90 bg-white/95 text-amber-950'
                }`}
            >
              <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">
                {units.minutes}
              </span>
              <span
                className={`mt-0.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase ${isPaid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
              >
                Min
              </span>
            </div>

            <span
              className={`font-mono text-sm sm:text-xl font-bold select-none ${isPaid ? 'text-emerald-400' : 'text-amber-400'
                }`}
              aria-hidden="true"
            >
              :
            </span>

            {/* Seconds Tile */}
            <div
              className={`flex min-w-0 w-full flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-1 sm:px-3 py-2 sm:py-2.5 shadow-xs transition-transform ${isPaid
                ? 'border-emerald-200/90 bg-white/95 text-emerald-950'
                : 'border-amber-200/90 bg-white/95 text-amber-950'
                }`}
            >
              <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">
                {units.seconds}
              </span>
              <span
                className={`mt-0.5 text-[9px] sm:text-[11px] font-bold tracking-wider uppercase ${isPaid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
              >
                Sec
              </span>
            </div>
          </div>
        )}

        {/* Explanatory lines below digits */}
        <div className="pt-1 text-xs">
          {isPaid ? (
            targetDate ? (
              <div className="space-y-0.5 text-emerald-900">
                <p className="font-medium text-emerald-950">
                  Estimated dispatch: <span className="font-semibold">{targetDate}</span> ({timezone.replace('Australia/', '')} time)
                </p>
                <p className="text-[11px] text-emerald-800">
                  Based on {orderData.production_days} production business day{orderData.production_days === 1 ? '' : 's'}. Courier delivery time is additional.
                </p>
              </div>
            ) : (
              <p className="text-emerald-900 font-medium">
                Your payment is confirmed. The dispatch estimate will appear once production time is set for this order.
              </p>
            )
          ) : (
            <div className="space-y-0.5 text-amber-900">
              <p className="font-medium text-amber-950">
                Pay before today’s cut-off to start processing today.
              </p>
              {targetDate && (
                <p className="text-[11px] text-amber-800">
                  Next cut-off deadline: <span className="font-semibold">{targetDate}</span> ({timezone.replace('Australia/', '')} time).
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrderReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  // Data & loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<CustomerReviewData | null>(null);
  const [selectedProofItemId, setSelectedProofItemId] = useState<string>('');
  const [templatePreviewUrl, setTemplatePreviewUrl] = useState<string | null>(null);
  const [templateBackPreviewUrl, setTemplateBackPreviewUrl] = useState<string | null>(null);

  // Stepper state: 'review' | 'payment' | 'production'
  const [currentStep, setCurrentStep] = useState<'review' | 'payment' | 'production'>('review');

  // Proof viewer states
  const [proofView, setProofView] = useState<'3d' | 'flat'>('3d');
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const proofContainerRef = useRef<HTMLDivElement>(null);

  // Confirmation checkboxes
  const [checkArtwork, setCheckArtwork] = useState(false);
  const [checkOrderDetails, setCheckOrderDetails] = useState(false);
  const [checkCopyright, setCheckCopyright] = useState(false);
  const [checkFinalApproval, setCheckFinalApproval] = useState(false);

  // Change request state
  const [changeComment, setChangeComment] = useState('');
  const [submittingChanges, setSubmittingChanges] = useState(false);
  const [changeSuccessMessage, setChangeSuccessMessage] = useState<string | null>(null);

  // Approval state
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Payment states (BPOINT)
  const [gatewayStatus, setGatewayStatus] = useState<
    'idle' | 'loading' | 'ready' | 'disabled' | 'error' | 'success'
  >('idle');
  const [gatewayMessage, setGatewayMessage] = useState('');
  const [authKey, setAuthKey] = useState<string | null>(null);
  const [clientScriptUrl, setClientScriptUrl] = useState(
    'https://www.bpoint.com.au/rest/clientscripts/api.js'
  );
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  const [showStatusHistoryLog, setShowStatusHistoryLog] = useState(false);
  const bpointControllerRef = useRef<any>(null);

  // 1. Fetch Authoritative Order Data
  const loadOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await orderReviewService.getReviewOrder(token);
      if (res.success && res.data) {
        setOrderData(res.data);
        setSelectedProofItemId(res.data.items?.[0]?.id || '');

        // Derive initial step based on order status
        const isPostReviewStatus = [
          'in_production',
          'printing',
          'production_started',
          'cutting_and_finishing',
          'cutting_in_progress',
          'quality_check_and_packaging',
          'production_completed',
          'packing',
          'ready_for_pickup',
          'ready_for_shipping',
          'ready_for_dispatch',
          'dispatched',
          'handed_over_to_courier',
          'delivered',
          'collected',
        ].includes(res.data.status);

        if (isPostReviewStatus || res.data.payment_status === 'paid') {
          if (isPostReviewStatus || res.data.status === 'in_production') {
            setCurrentStep('production');
          } else {
            setCurrentStep('payment');
            setGatewayStatus('success');
          }
        } else if (res.data.proof?.is_approved) {
          setCurrentStep('payment');
        } else {
          setCurrentStep('review');
        }
      } else {
        setError('Order could not be loaded.');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'This review link is invalid, has expired, or has been revoked. Please reach out to your account manager.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadOrder();
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const selectedItem = orderData?.items.find((item) => item.id === selectedProofItemId) || orderData?.items[0];
    const itemCanvas = selectedItem?.artwork_preview?.canvas_json;
    const selectedFiles = selectedItem?.artwork_preview?.files || [];
    const hasSelectedItemImage = selectedFiles.some((file) => !file.mime_type?.includes('pdf')) ||
      Boolean(selectedItem?.artwork_preview?.thumbnail_url);
    setTemplatePreviewUrl(null);
    setTemplateBackPreviewUrl(null);
    // Offscreen Fabric previews are only used for single-item artwork review.
    // Do not render large canvases while the customer is paying/tracking or on
    // multi-item orders, where each item must use its own uploaded proof.
    if (currentStep !== 'review' || (orderData?.items.length ?? 0) > 1) return;
    if (hasSelectedItemImage) {
      setTemplatePreviewUrl(null);
      setTemplateBackPreviewUrl(null);
      return;
    }

    const savedCanvas = itemCanvas ?? orderData?.proof.template_canvas_json;
    const frontCanvas = getCanvasPage(savedCanvas, 0);
    const backCanvas = getCanvasPage(
      itemCanvas ?? orderData?.proof.template_back_canvas_json ?? savedCanvas,
      itemCanvas || !orderData?.proof.template_back_canvas_json ? 1 : 0
    );
    const settings = selectedItem?.artwork_preview?.document_settings || orderData?.proof.document_settings || {};
    const savedDimensions = selectedItem?.artwork_preview?.dimensions || orderData?.proof.dimensions || {};
    const dpi = Number(savedDimensions.dpi || settings.dpi) || 300;
    const unit = String(settings.unit || 'mm').toLowerCase();
    const toPixels = (value?: number) => {
      if (!value) return undefined;
      if (unit === 'mm') return (value / 25.4) * dpi;
      if (unit === 'cm') return (value / 2.54) * dpi;
      if (unit === 'in' || unit === 'inch' || unit === 'inches') return value * dpi;
      return value;
    };
    const sourceWidth = Number(savedDimensions.width_px) || toPixels(Number(settings.width)) || undefined;
    const sourceHeight = Number(savedDimensions.height_px) || toPixels(Number(settings.height)) || undefined;

    if (!frontCanvas && !backCanvas) {
      setTemplatePreviewUrl(null);
      setTemplateBackPreviewUrl(null);
      return;
    }

    const renderTemplatePreview = async () => {
      try {
        const { renderCanvasJsonToThumbnail } = await import('@/components/designer/utils/canvasThumbnail');
        const [front, back] = await Promise.all([
          frontCanvas
            ? renderCanvasJsonToThumbnail(frontCanvas, 1920, 1080, '#ffffff', sourceWidth, sourceHeight)
            : null,
          backCanvas
            ? renderCanvasJsonToThumbnail(backCanvas, 1920, 1080, '#ffffff', sourceWidth, sourceHeight)
            : null,
        ]);
        if (!cancelled) {
          setTemplatePreviewUrl(front);
          setTemplateBackPreviewUrl(back);
        }
      } catch (previewError) {
        console.warn('Could not render the selected template preview:', previewError);
      }
    };

    renderTemplatePreview();
    return () => { cancelled = true; };
  }, [
    orderData?.proof.thumbnail_url,
    orderData?.proof.template_canvas_json,
    orderData?.proof.template_back_canvas_json,
    orderData?.proof.document_settings,
    orderData?.proof.dimensions,
    orderData?.items,
    selectedProofItemId,
    currentStep,
  ]);

  // 2. Initialize BPOINT payment session if on payment step
  const initPaymentSession = async () => {
    if (!token) return;
    try {
      setGatewayStatus('loading');
      setPaymentError(null);
      setIframeLoaded(false);

      const res = await orderReviewService.createPaymentSession(token);
      if (res.success && res.data?.enabled && res.data?.authkey) {
        setAuthKey(res.data.authkey);
        if (res.data.client_script_url) {
          setClientScriptUrl(res.data.client_script_url);
        }
        setGatewayStatus('ready');
      } else {
        setGatewayStatus('disabled');
        setGatewayMessage(
          res.data?.message ||
          res.message ||
          'BPOINT payment gateway is in test mode or awaiting server configuration.'
        );
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setGatewayStatus('success');
        setCurrentStep('production');
      } else if (err.response?.status === 503 || err.response?.data?.data?.gateway_enabled === false) {
        setGatewayStatus('disabled');
        setGatewayMessage(
          err.response?.data?.message ||
          'BPOINT gateway is currently disabled. Server payment verification is required.'
        );
      } else {
        setGatewayStatus('error');
        setPaymentError(
          err.response?.data?.message || 'Unable to connect to secure payment gateway.'
        );
      }
    }
  };

  useEffect(() => {
    if (currentStep === 'payment' && gatewayStatus === 'idle') {
      initPaymentSession();
    }
  }, [currentStep, gatewayStatus]);

  // 3. Mount BPOINT iFrame fields
  useEffect(() => {
    if (!authKey || gatewayStatus !== 'ready' || currentStep !== 'payment') return;

    let isMounted = true;

    const setupFields = () => {
      if (!window.BPOINT?.txn?.authkey?.setupIframeFields) return;

      try {
        window.BPOINT.txn.authkey.setupIframeFields(authKey, {
          card: {
            number: { selector: '#bpoint-card-number' },
            expiry: {
              month: { selector: '#bpoint-expiry-month' },
              year: { selector: '#bpoint-expiry-year' },
            },
            cvn: { selector: '#bpoint-cvn' },
            name: { selector: '#bpoint-card-name' },
          },
          fieldClasses: {
            focused: 'is-focused',
            invalid: 'is-invalid',
            valid: 'is-valid',
          },
          styles: {
            default: {
              'font-family':
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              'font-size': '14px',
              color: '#0f172a',
            },
            focus: { color: '#0f172a' },
            invalid: { color: '#dc2626' },
          },
          onFormLoaded: function (controller: any) {
            if (isMounted) {
              bpointControllerRef.current = controller;
              setIframeLoaded(true);
            }
          },
          onFormLoadError: function (err: any) {
            if (isMounted) {
              console.error('BPOINT iframe error:', err);
              setPaymentError('Failed to load secure card fields. Please refresh.');
            }
          },
        });
      } catch (e) {
        console.error('Error mounting BPOINT fields:', e);
      }
    };

    const scriptId = 'bpoint-client-script-portal';
    let scriptElement = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (window.BPOINT?.txn?.authkey?.setupIframeFields) {
      setupFields();
    } else if (scriptElement) {
      scriptElement.addEventListener('load', setupFields);
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = clientScriptUrl;
      script.type = 'text/javascript';
      script.async = true;
      script.onload = setupFields;
      script.onerror = () => {
        if (isMounted) {
          setPaymentError('Unable to connect to BPOINT security service.');
        }
      };
      document.body.appendChild(script);
    }

    return () => {
      isMounted = false;
    };
  }, [authKey, gatewayStatus, clientScriptUrl, currentStep]);

  // 4. Handle Change Request
  const handleSubmitChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeComment.trim()) return;

    try {
      setSubmittingChanges(true);
      setChangeSuccessMessage(null);
      const res = await orderReviewService.requestChanges(token, changeComment);
      if (res.success) {
        setChangeSuccessMessage('Your change request has been submitted. Our prepress team has been notified and will upload a revised proof.');
        setChangeComment('');
        await loadOrder();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit change request.');
    } finally {
      setSubmittingChanges(false);
    }
  };

  // 5. Handle Proof Approval
  const handleApproveProof = async () => {
    if (!checkArtwork || !checkOrderDetails || !checkCopyright || !checkFinalApproval || !orderData) return;

    try {
      setApproving(true);
      setApprovalError(null);
      const res = await orderReviewService.approveProof(token, {
        spelling_confirmed: checkArtwork,
        specs_confirmed: checkOrderDetails,
        proof_version_confirmed: checkFinalApproval,
        version_number: orderData.proof.current_version,
      });

      if (res.success) {
        await loadOrder();
        setCurrentStep('payment');
      } else {
        setApprovalError(res.message || 'Approval could not be completed.');
      }
    } catch (err: any) {
      setApprovalError(
        err.response?.data?.message || 'Approval failed. Please ensure you are viewing the latest proof.'
      );
    } finally {
      setApproving(false);
    }
  };

  // 6. Handle Payment Form Submission
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bpointControllerRef.current || !authKey) {
      setPaymentError('Payment form is still loading. Please try again.');
      return;
    }

    setSubmittingPayment(true);
    setPaymentError(null);

    bpointControllerRef.current.submit(async (code: string, data: any) => {
      if (code === 'success') {
        try {
          const result = await orderReviewService.processPayment(token, authKey);
          if (result.success && result.data?.paid) {
            setPaymentReceipt(result.data?.receipt_number || 'VERIFIED');
            setGatewayStatus('success');
            setCurrentStep('production');
            await loadOrder();
          } else {
            setPaymentError(result.message || 'Payment could not be verified.');
          }
        } catch (err: any) {
          setPaymentError(
            err.response?.data?.message || 'Payment verification failed with server.'
          );
        } finally {
          setSubmittingPayment(false);
        }
      } else {
        setSubmittingPayment(false);
        setPaymentError(
          data?.details?.[0]?.message || data?.message || 'Card verification failed.'
        );
      }
    });
  };

  // 7. Fullscreen toggle
  const toggleFullscreen = () => {
    if (!proofContainerRef.current) return;
    if (!document.fullscreenElement) {
      proofContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF9] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 text-[#E11D48] animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Loading Order Proof...</h2>
        <p className="text-slate-500 text-sm mt-1">Verifying encrypted review credentials</p>
      </div>
    );
  }

  // Error / Invalid Link state
  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-[#FDFBF9] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Proof Link Inactive</h2>
          <p className="text-slate-600 mb-6 text-sm leading-relaxed">
            {error || 'This proof review link is no longer valid or has expired.'}
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 mb-6 text-left space-y-1">
            <p className="font-semibold text-slate-700">Need a new link?</p>
            <p>Please contact our team or reply to your order email to request a new secure link.</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-5 py-3 bg-slate-900 text-white font-semibold text-sm rounded-xl hover:bg-slate-800 transition"
          >
            Visit Erry Imprints Homepage
          </Link>
        </div>
      </div>
    );
  }

  const primaryItem = orderData.items[0];
  const selectedProofItem = orderData.items.find((item) => item.id === selectedProofItemId) || primaryItem;
  const isMultiItemOrder = orderData.items.length > 1;
  const selectedArtwork = selectedProofItem?.artwork_preview;
  const itemProofFiles = selectedArtwork?.files || [];

  // Multi-item isolation: each product only shows its own files.
  // Legacy single-item orders fall back to orderData.proof.files.
  const proofFiles = itemProofFiles.length > 0
    ? itemProofFiles
    : (orderData.proof?.files || []);

  const frontFile = proofFiles.find((f) => f.label?.toLowerCase() === 'front') || proofFiles[0];
  const backFile = proofFiles.find((f) => f.label?.toLowerCase() === 'back') || (proofFiles.length > 1 && proofFiles[0] === frontFile ? proofFiles[1] : null);
  const isImageFile = (file: (typeof proofFiles)[number] | null | undefined) =>
    Boolean(file?.url && !file.mime_type?.includes('pdf') && !file.url.toLowerCase().endsWith('.pdf'));
  const isPreviewImageUrl = (url?: string | null) => Boolean(url && !/\.pdf(?:$|[?#])/i.test(url));
  const proofThumbnailUrl = isPreviewImageUrl(selectedArtwork?.thumbnail_url)
    ? selectedArtwork?.thumbnail_url
    : (!isMultiItemOrder && isPreviewImageUrl(orderData.proof.thumbnail_url)
      ? orderData.proof.thumbnail_url
      : null);

  // Exact front/back artwork files already saved for the order as the 3D surface textures
  const rawFrontUrl = (isImageFile(frontFile) ? (frontFile?.preview_url || frontFile?.url) : null)
    || (isPreviewImageUrl(selectedArtwork?.front_preview_url) ? selectedArtwork?.front_preview_url : null)
    || (isPreviewImageUrl(selectedArtwork?.front_url) ? selectedArtwork?.front_url : null)
    || proofThumbnailUrl
    || (!isMultiItemOrder ? templatePreviewUrl : null);
  const frontMockupUrl = rawFrontUrl ? formatImageUrl(rawFrontUrl) : null;
  const rawBackUrl = (isImageFile(backFile) ? (backFile?.preview_url || backFile?.url) : null)
    || (isPreviewImageUrl(selectedArtwork?.back_preview_url) ? selectedArtwork?.back_preview_url : null)
    || (isPreviewImageUrl(selectedArtwork?.back_url) ? selectedArtwork?.back_url : null)
    || (!isMultiItemOrder ? templateBackPreviewUrl : null);
  const backMockupUrl = rawBackUrl ? formatImageUrl(rawBackUrl) : null;
  const flatTemplatePreviewUrl = templatePreviewUrl || proofThumbnailUrl;
  const savedDocumentSettings = selectedArtwork?.document_settings || orderData.proof.document_settings || {};
  const savedDimensions = selectedArtwork?.dimensions || orderData.proof.dimensions || {};
  const previewDpi = Number(savedDimensions.dpi || savedDocumentSettings.dpi) || 300;
  const previewWidthPx = Number(savedDimensions.width_px) || 1000;
  const previewHeightPx = Number(savedDimensions.height_px) || 650;
  const previewUnit = (savedDocumentSettings.unit || 'mm') as UnitType;
  const previewWidth = Number(savedDocumentSettings.width) || (previewWidthPx / previewDpi) * 25.4;
  const previewHeight = Number(savedDocumentSettings.height) || (previewHeightPx / previewDpi) * 25.4;
  const previewBleed = Number(savedDocumentSettings.bleed) || 0;
  const previewSafeArea = Number(savedDocumentSettings.safeArea) || 0;
  const mockupDocumentSettings = {
    ...savedDocumentSettings,
    width: previewWidth,
    height: previewHeight,
    unit: previewUnit,
    dpi: previewDpi,
    bleed: previewBleed,
    safeArea: previewSafeArea,
    name: savedDocumentSettings.name || primaryItem?.product_name || 'Print artwork',
  } as DocumentSettings;
  const mockupDimensions = {
    unit: previewUnit,
    widthPx: previewWidthPx,
    heightPx: previewHeightPx,
    widthMm: previewWidth,
    heightMm: previewHeight,
    bleedMm: previewBleed,
    safeZoneMm: previewSafeArea,
    bleedPx: 0,
    safeZonePx: 0,
    totalWidthPx: previewWidthPx,
    totalHeightPx: previewHeightPx,
    dpi: previewDpi,
  } satisfies CanvasDimensions;

  // Helper renderers for flexible step layout
  const renderOrderSummaryCard = (showApproveButton = false) => {
    if (!orderData) return null;
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-5">
        <h2 className="text-base font-bold text-slate-900">Order summary</h2>

        {/* Items preview */}
        <div className="space-y-4">
          {orderData.items.map((item) => (
            <div key={item.id} className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-b-0 last:pb-0">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0">
                {(item.artwork_preview?.thumbnail_url || (item.id === primaryItem?.id ? orderData.proof.thumbnail_url : null)) ? (
                  <img
                    src={formatImageUrl(item.artwork_preview?.thumbnail_url || orderData.proof.thumbnail_url || '')}
                    alt={`${item.product_name} artwork`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-slate-900 truncate">
                  {item.product_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{item.quantity} pieces</p>
                <p className="text-xs text-slate-500">{item.specifications}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Financial Breakdown */}
        <div className="space-y-2.5 text-xs pt-2 border-t border-slate-100">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-medium text-slate-800">
              ${orderData.totals.subtotal_ex_gst.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST (10%)</span>
            <span className="font-medium text-slate-800">
              ${orderData.totals.gst_amount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Shipping</span>
            <span className="font-medium text-slate-800">
              {orderData.totals.shipping_fee_inc_gst === 0
                ? '$0.00'
                : `$${orderData.totals.shipping_fee_inc_gst.toFixed(2)}`}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
            <span className="font-bold text-sm text-slate-900">Total (AUD)</span>
            <span className="text-xl font-extrabold text-slate-900">
              ${orderData.totals.total_inc_gst.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Primary Call to Action Button (Review step) */}
        {showApproveButton && currentStep === 'review' && (
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleApproveProof}
              disabled={
                !checkArtwork ||
                !checkOrderDetails ||
                !checkCopyright ||
                !checkFinalApproval ||
                approving ||
                orderData.status === 'changes_requested'
              }
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {approving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>Approve &amp; continue to payment</span>
            </button>

            <p className="text-[11px] text-center text-slate-400">
              Complete all 4 checks to continue.
            </p>
          </div>
        )}

        {/* Call to Action for Payment step */}
        {currentStep === 'payment' && (
          <div className="space-y-2 pt-2">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Proof approved! Complete payment to queue for printing.</span>
            </div>
          </div>
        )}

        {/* Production Note */}
        <div className="p-3.5 bg-sky-50/80 rounded-2xl border border-sky-100 flex items-start gap-2.5 text-xs text-sky-800">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <span>Production begins after approval and verified payment.</span>
        </div>
      </div>
    );
  };

  // Render: Delivery Summary Card
  const renderDeliverySummaryCard = () => {
    if (!orderData) return null;
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Truck className="w-3.5 h-3.5 text-slate-600" />
          <span>Delivery Address</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed font-medium">
          {orderData.delivery_summary.full_address || 'Standard Delivery'}
        </p>
      </div>
    );
  };

  // Render: Version History Card
  const renderVersionHistoryCard = () => {
    if (!orderData?.proof.versions?.length) return null;
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Version history</h2>

        <div className="space-y-3">
          {orderData.proof.versions.map((ver) => (
            <div
              key={ver.version_number}
              className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100"
            >
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                {ver.thumbnail_url ? (
                  <img
                    src={ver.thumbnail_url}
                    alt={ver.label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <Package className="w-5 h-5 text-slate-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">{ver.label}</span>
                  {ver.is_approved ? (
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Approved
                    </span>
                  ) : ver.version_number === orderData.proof.current_version ? (
                    <span className="text-[11px] font-semibold text-[#E11D48] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48]"></span>
                      Awaiting your approval
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Superseded</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Uploaded {ver.uploaded_at}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render: BPOINT Payment Card
  const renderPaymentCard = () => {
    if (!orderData) return null;
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep('review')}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition flex items-center justify-center shrink-0 cursor-pointer"
              title="Back to artwork review"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-pink-50 text-[#E11D48] flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">BPOINT Secure Payment</h2>
              <p className="text-xs text-slate-500">256-bit SSL encrypted card payment</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full shrink-0">
            Proof V{orderData.proof.current_version} Approved
          </span>
        </div>

        {/* Payment form or status state */}
        {gatewayStatus === 'loading' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#E11D48]" />
            <p className="text-sm font-semibold text-slate-800">
              Initializing secure payment gateway...
            </p>
          </div>
        )}

        {gatewayStatus === 'disabled' && (
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-sm">
                  BPOINT Gateway In Test / Sandbox Mode
                </h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {gatewayMessage ||
                    'Live payment processing requires valid BPOINT merchant credentials configured in the server environment.'}
                </p>
              </div>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-amber-100 text-xs text-slate-600">
              Your proof approval for <strong>{orderData.proof.version_label}</strong> has been securely recorded in the audit history.
            </div>
            <button
              type="button"
              onClick={() => initPaymentSession()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        )}

        {gatewayStatus === 'success' && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Payment successfully verified. Your order has been placed into production!</span>
          </div>
        )}

        {gatewayStatus === 'ready' && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4 max-w-lg">
            {paymentError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{paymentError}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Cardholder Name
                </label>
                <span className="text-[11px] font-medium text-slate-400">
                  e.g. John Doe
                </span>
              </div>
              <div id="bpoint-card-name" className="bpoint-field-wrapper" />
              <p className="text-[11px] text-slate-400 mt-1">Full name as displayed on the card</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Card Number
                </label>
                <div className="flex items-center gap-1 opacity-80">
                  <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200">VISA</span>
                  <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200">MC</span>
                  <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200">AMEX</span>
                </div>
              </div>
              <div id="bpoint-card-number" className="bpoint-field-wrapper" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Month (MM)
                </label>
                <div id="bpoint-expiry-month" className="bpoint-field-wrapper" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Year (YY)
                </label>
                <div id="bpoint-expiry-year" className="bpoint-field-wrapper" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    CVN
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">3-4 digits</span>
                </div>
                <div id="bpoint-cvn" className="bpoint-field-wrapper" />
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <button
                type="submit"
                disabled={submittingPayment || !iframeLoaded}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {submittingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>
                  Approve artwork & proceed to production — ${orderData.totals.total_inc_gst.toFixed(2)} AUD
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep('review')}
                disabled={submittingPayment}
                className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
                <span>Back to artwork review</span>
              </button>

              <div className="flex items-center justify-center gap-2.5 text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1 font-medium text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  256-bit SSL Bank Encryption
                </span>
                <span>•</span>
                <span>Commonwealth Bank BPOINT</span>
              </div>
            </div>
          </form>
        )}
      </div>
    );
  };

  // Render: Production Progress Card (Shown at the top after countdown during production tracking)
  const renderProductionProgressCard = () => {
    if (!orderData) return null;

    const currentIdx = getTrackOrderStepIndex(orderData.status);
    const isStorePickup = Boolean(orderData.delivery_summary?.method?.toLowerCase().includes('pickup'));
    const isDeliveredOrCollected = orderData.status === 'delivered' || orderData.status === 'collected';
    const currentStepTitle = getTrackOrderStepTitle(currentIdx, isStorePickup, orderData.status);
    const currentStepSubtitle = getTrackOrderSubtitle(currentIdx, orderData.order_number, isStorePickup, orderData.status);

    const progressPercentage = Math.min(
      100,
      Math.round(((currentIdx + (isDeliveredOrCollected ? 1 : 0.5)) / TRACK_ORDER_STEPS.length) * 100)
    );

    // Current Header Icon
    const CurrentStepIcon = (() => {
      if (currentIdx === 0) return FileCheck;
      if (currentIdx === 1) return ImageIcon;
      if (currentIdx === 2) return ThumbsUp;
      if (currentIdx === 3) return Printer;
      if (currentIdx === 4) return Scissors;
      if (currentIdx === 5) return PackageCheck;
      if (currentIdx === 6) return isStorePickup ? Store : Truck;
      return isStorePickup ? ShoppingBag : MapPin;
    })();

    return (
      <div className="relative overflow-hidden bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 lg:p-8 shadow-sm transition-all duration-300">
        {/* Soft background ambient glow */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full blur-3xl opacity-35 transition-opacity ${
            isDeliveredOrCollected ? 'bg-emerald-400/25' : 'bg-rose-500/20'
          }`}
        />

        {/* Top Row: Icon + Title + Step badge + Subtitle */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 sm:pb-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-rose-50 via-white to-rose-100/70 border border-rose-200/80 flex items-center justify-center text-[#E11D48] shrink-0 shadow-xs">
              <span
                className="absolute inset-0 rounded-2xl bg-rose-400 opacity-20 motion-safe:animate-ping motion-reduce:hidden"
                style={{ animationDuration: '3s' }}
              />
              <CurrentStepIcon className="relative w-7 h-7 sm:w-8 sm:h-8 motion-safe:animate-[pulse_3s_ease-in-out_infinite]" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {currentStepTitle}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-rose-50 text-rose-600 border border-rose-200/70 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 motion-reduce:hidden" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E11D48]" />
                  </span>
                  <span>STEP {currentIdx + 1} OF {TRACK_ORDER_STEPS.length}</span>
                </span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 sm:mt-1.5 leading-relaxed font-medium">
                {currentStepSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {paymentReceipt && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs text-slate-600 font-mono">
                Receipt: <strong className="text-slate-900">{paymentReceipt}</strong>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Order {orderData.order_number}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar & Stage Counter */}
        <div className="relative z-10 pt-5 sm:pt-6">
          <div className="flex items-center justify-between text-xs font-bold mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ORDER PROGRESS</span>
              <span className="text-[11px] font-semibold text-slate-500">
                · {currentIdx + (isDeliveredOrCollected ? 1 : 0)} of {TRACK_ORDER_STEPS.length} stages completed
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-extrabold text-slate-800">
              <span className="text-[#E11D48]">{progressPercentage}%</span>
              <span className="text-slate-400 font-normal">complete</span>
            </span>
          </div>

          {/* Animated Gradient Bar */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/70 shadow-2xs">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-rose-500 to-[#E11D48] transition-all duration-700 ease-out shadow-xs"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* 7-Step Stepper Display: Desktop Grid / Horizontal Flow */}
        <div className="relative z-10 hidden lg:flex items-stretch gap-1.5 xl:gap-2 w-full pt-6">
          {TRACK_ORDER_STEPS.map((step, idx) => {
            const isComplete = idx < currentIdx || (idx === TRACK_ORDER_STEPS.length - 1 && isDeliveredOrCollected);
            const isCurrent = idx === currentIdx && !isDeliveredOrCollected;
            const StepIcon = isStorePickup && step.pickupIcon ? step.pickupIcon : step.icon;

            let title = isStorePickup && step.pickupLabel ? step.pickupLabel : step.label;
            let description = isStorePickup && step.pickupDescription ? step.pickupDescription : step.description;

            if (idx === 6) {
              if (isStorePickup) {
                title = 'Pickup in Store';
                description = orderData.status === 'collected'
                  ? 'Order collected by customer from store.'
                  : 'Order is packed and ready for pickup in store.';
              } else {
                title = 'Delivery';
                description = orderData.status === 'delivered'
                  ? 'Delivered to your provided address.'
                  : 'Dispatched and on the way for delivery to your address.';
              }
            }

            return (
              <React.Fragment key={step.key}>
                <div
                  className={`flex-1 min-w-0 relative p-3 xl:p-3.5 rounded-2xl border transition-all duration-300 flex flex-col justify-between text-center ${
                    isCurrent
                      ? 'bg-gradient-to-b from-rose-50/60 via-white to-rose-50/40 border-rose-300 ring-2 ring-[#E11D48]/25 shadow-md shadow-rose-500/10 motion-safe:scale-[1.02]'
                      : isComplete
                        ? 'bg-emerald-50/40 border-emerald-200/90 shadow-2xs hover:border-emerald-300 hover:shadow-xs'
                        : 'bg-white border-slate-200/80 shadow-2xs opacity-80 hover:opacity-100 hover:border-slate-300'
                  }`}
                >
                  {/* Top Step Number Circle */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-transform ${
                        isComplete
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : isCurrent
                            ? 'bg-[#E11D48] text-white shadow-xs motion-safe:animate-pulse'
                            : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    {isCurrent && (
                      <span className="w-2 h-2 rounded-full bg-[#E11D48] motion-safe:animate-ping" />
                    )}
                  </div>

                  {/* Center Circular Icon */}
                  <div className="my-1.5 flex justify-center">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform ${
                        isComplete
                          ? 'bg-emerald-100/80 text-emerald-600 border border-emerald-200/70'
                          : isCurrent
                            ? 'bg-rose-100/80 text-[#E11D48] border border-rose-200/80 shadow-xs motion-safe:scale-105'
                            : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                      }`}
                    >
                      <StepIcon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Step Title & Description */}
                  <div className="my-1.5 flex-1 flex flex-col justify-center">
                    <h5 className="text-xs font-bold text-slate-900 leading-tight mb-1 truncate" title={title}>
                      {title}
                    </h5>
                    <p className="text-[11px] text-slate-500 leading-snug line-clamp-3">
                      {description}
                    </p>
                  </div>

                  {/* Bottom Status Indicator */}
                  <div className="mt-2 pt-1 flex justify-center items-center min-h-[24px]">
                    {isComplete ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200/80 shadow-2xs">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Completed</span>
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#E11D48] bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200/80 shadow-2xs">
                        <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" />
                        <span>Current Step</span>
                      </span>
                    ) : (
                      <div className="h-5" />
                    )}
                  </div>
                </div>

                {/* Arrow separator between cards */}
                {idx < TRACK_ORDER_STEPS.length - 1 && (
                  <div className="flex items-center justify-center shrink-0 self-center">
                    <ChevronRight
                      className={`w-4 h-4 transition-colors ${
                        idx < currentIdx
                          ? 'text-emerald-400'
                          : idx === currentIdx
                            ? 'text-rose-400 motion-safe:animate-pulse'
                            : 'text-slate-300'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile & Tablet Stepper Display */}
        <div className="relative z-10 lg:hidden pt-5 space-y-4">
          {/* Mobile Current Step Spotlight Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-white to-rose-50/50 border border-rose-200/90 shadow-xs flex items-start gap-3.5">
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-[#E11D48] to-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="absolute inset-0 rounded-xl bg-rose-400 opacity-20 motion-safe:animate-ping motion-reduce:hidden" />
              <CurrentStepIcon className="w-6 h-6 motion-safe:animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-rose-600 bg-rose-100/90 px-2 py-0.5 rounded-full border border-rose-200/60">
                  Active Stage · {currentIdx + 1} of {TRACK_ORDER_STEPS.length}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E11D48]">
                  <Loader2 className="w-3 h-3 motion-safe:animate-spin" />
                  Live
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 mt-1">{currentStepTitle}</h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{currentStepSubtitle}</p>
            </div>
          </div>

          {/* Mobile Horizontal Snap-Scroll Cards Track */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1 mb-2">
              <span>All 7 Production Stages</span>
              <span className="text-slate-400 flex items-center gap-1">
                Swipe stages <ChevronRight className="w-3 h-3" />
              </span>
            </div>

            <div className="flex items-stretch gap-2.5 overflow-x-auto pb-3 pt-1 -mx-2 px-2 snap-x snap-mandatory scrollbar-none">
              {TRACK_ORDER_STEPS.map((step, idx) => {
                const isComplete = idx < currentIdx || (idx === TRACK_ORDER_STEPS.length - 1 && isDeliveredOrCollected);
                const isCurrent = idx === currentIdx && !isDeliveredOrCollected;
                const StepIcon = isStorePickup && step.pickupIcon ? step.pickupIcon : step.icon;

                let title = isStorePickup && step.pickupLabel ? step.pickupLabel : step.label;
                let description = isStorePickup && step.pickupDescription ? step.pickupDescription : step.description;

                if (idx === 6) {
                  if (isStorePickup) {
                    title = 'Pickup in Store';
                    description = orderData.status === 'collected'
                      ? 'Order collected by customer from store.'
                      : 'Order is packed and ready for pickup in store.';
                  } else {
                    title = 'Delivery';
                    description = orderData.status === 'delivered'
                      ? 'Delivered to your provided address.'
                      : 'Dispatched and on the way for delivery to your address.';
                  }
                }

                return (
                  <div
                    key={step.key}
                    className={`w-[160px] sm:w-[175px] shrink-0 snap-center relative p-3.5 rounded-2xl border transition-all flex flex-col justify-between text-center ${
                      isCurrent
                        ? 'bg-gradient-to-b from-rose-50/80 via-white to-rose-50/40 border-rose-300 ring-2 ring-[#E11D48]/25 shadow-md shadow-rose-500/10'
                        : isComplete
                          ? 'bg-emerald-50/40 border-emerald-200/90 shadow-2xs'
                          : 'bg-white border-slate-200/80 shadow-2xs opacity-85'
                    }`}
                  >
                    {/* Top Row: Step Number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isComplete
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                              ? 'bg-[#E11D48] text-white shadow-xs'
                              : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-[#E11D48]">Active</span>
                      )}
                    </div>

                    {/* Circular Icon */}
                    <div className="my-1.5 flex justify-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isComplete
                            ? 'bg-emerald-100/80 text-emerald-600 border border-emerald-200/70'
                            : isCurrent
                              ? 'bg-rose-100/80 text-[#E11D48] border border-rose-200/80 shadow-xs'
                              : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                        }`}
                      >
                        <StepIcon className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div className="my-1 flex-1 flex flex-col justify-center">
                      <h5 className="text-xs font-bold text-slate-900 leading-tight mb-1">
                        {title}
                      </h5>
                      <p className="text-[10px] text-slate-500 leading-snug line-clamp-3">
                        {description}
                      </p>
                    </div>

                    {/* Bottom Status Indicator */}
                    <div className="mt-2 pt-1 flex justify-center items-center min-h-[22px]">
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200/80">
                          <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                          <span>Done</span>
                        </span>
                      ) : isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#E11D48] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/80">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>Current</span>
                        </span>
                      ) : (
                        <div className="h-4" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Status History Collapsible Section */}
        <div className="relative z-10 pt-5 mt-6 sm:mt-7 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs sm:text-sm">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Order Status History</span>
              {orderData.status_history && orderData.status_history.length > 0 && (
                <span className="text-[11px] font-semibold text-slate-400 font-mono">
                  ({orderData.status_history.length} event{orderData.status_history.length === 1 ? '' : 's'})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowStatusHistoryLog((prev) => !prev)}
              className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition cursor-pointer"
            >
              <span>{showStatusHistoryLog ? 'Hide Log' : 'View Full Log'}</span>
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  showStatusHistoryLog ? 'rotate-90' : ''
                }`}
              />
            </button>
          </div>

          {/* Status History Events List */}
          {showStatusHistoryLog && (
            <div className="mt-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
              {orderData.status_history && orderData.status_history.length > 0 ? (
                <div className="space-y-3">
                  {orderData.status_history.map((hist, i) => (
                    <div
                      key={hist.id || i}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 pb-3 border-b border-slate-200/60 last:border-b-0 last:pb-0 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-900">{hist.description || hist.event_type}</p>
                          {hist.status_label && (
                            <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                              {hist.status_label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 sm:text-right shrink-0 font-mono">
                        {hist.formatted_date || hist.time_ago || hist.created_at}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-500">
                  Prepress verification and order creation logged.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] text-slate-800 flex flex-col font-sans">
      <style jsx global>{`
        .bpoint-field-wrapper {
          background-color: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 0.875rem;
          padding: 0 0.875rem;
          height: 46px;
          display: flex;
          align-items: center;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .bpoint-field-wrapper:hover {
          border-color: #cbd5e1;
        }
        .bpoint-field-wrapper.is-focused {
          border-color: #e11d48 !important;
          box-shadow: 0 0 0 3.5px rgba(225, 29, 72, 0.12) !important;
          background-color: #ffffff !important;
        }
        .bpoint-field-wrapper.is-invalid {
          border-color: #ef4444 !important;
          background-color: #fff5f5 !important;
        }
        .bpoint-field-wrapper.is-valid {
          border-color: #10b981 !important;
        }
        .bpoint-field-wrapper iframe {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          min-height: 26px;
          display: block;
        }
        @keyframes order-review-trust-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .order-review-trust-track {
          animation: order-review-trust-scroll 34s linear infinite;
        }
        .order-review-trust-marquee:hover .order-review-trust-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .order-review-trust-track { animation: none; }
          .order-review-trust-marquee { overflow-x: auto; }
        }
      `}</style>

      <OrderTrustStrip />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Title Bar & Progress Stepper */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
          <div>
            {currentStep === 'payment' && (
              <button
                type="button"
                onClick={() => setCurrentStep('review')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#E11D48] mb-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to artwork review</span>
              </button>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {currentStep === 'review'
                ? 'Your artwork is ready to review'
                : currentStep === 'payment'
                  ? 'Proof approved — Complete payment'
                  : 'Track Your Order Progress'}
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Order {orderData.order_number} • {primaryItem?.product_name || 'Print Products'} • {orderData.proof.version_label}
            </p>
          </div>

          {/* Stepper matching screenshot: 1 Review artwork -> 2 Payment -> 3 Track order */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-medium text-slate-400 self-start md:self-auto bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-xs">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => {
                if (currentStep === 'payment') setCurrentStep('review');
              }}
              className={`flex items-center gap-1.5 text-left ${currentStep === 'payment' ? 'cursor-pointer hover:opacity-80' : ''}`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${currentStep === 'review'
                  ? 'bg-[#E11D48] text-white shadow-xs'
                  : 'bg-emerald-500 text-white'
                  }`}
              >
                {currentStep !== 'review' ? <Check className="w-3.5 h-3.5" /> : '1'}
              </span>
              <span
                className={`font-semibold ${currentStep === 'review' ? 'text-slate-900' : 'text-slate-500'
                  }`}
              >
                Review artwork
              </span>
            </button>

            <span className="w-6 h-px bg-slate-300"></span>

            {/* Step 2 */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${currentStep === 'payment'
                  ? 'bg-[#E11D48] text-white shadow-xs'
                  : currentStep === 'production'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-600'
                  }`}
              >
                {currentStep === 'production' ? <Check className="w-3.5 h-3.5" /> : '2'}
              </span>
              <span
                className={`font-semibold ${currentStep === 'payment' ? 'text-slate-900' : 'text-slate-400'
                  }`}
              >
                Payment
              </span>
            </div>

            <span className="w-6 h-px bg-slate-300"></span>

            {/* Step 3 */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${currentStep === 'production'
                  ? 'bg-[#E11D48] text-white shadow-xs'
                  : 'bg-slate-200 text-slate-600'
                  }`}
              >
                3
              </span>
              <span
                className={`font-semibold ${currentStep === 'production' ? 'text-slate-900' : 'text-slate-400'
                  }`}
              >
                Track Order
              </span>
            </div>
          </div>
        </div>

        <ReviewCountdownCard orderData={orderData} />

        {/* Top Order Production Progress Tracking Card (shown after countdown) */}
        {currentStep === 'production' && renderProductionProgressCard()}

        {/* Change Request Banner (if currently changes_requested) */}
        {orderData.status === 'changes_requested' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h3 className="font-bold text-amber-900">Change Request In Progress</h3>
              <p className="text-amber-800 mt-0.5">
                Our prepress design team is working on your revision. You will receive an updated email link once Proof V{orderData.proof.current_version + 1} is ready.
              </p>
            </div>
          </div>
        )}

        {/* Change Request Success Message */}
        {changeSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h3 className="font-bold text-emerald-900">Request Received</h3>
              <p className="text-emerald-800 mt-0.5">{changeSuccessMessage}</p>
            </div>
          </div>
        )}

        {/* Customer Visible Notes Callout */}
        {orderData.customer_notes && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h3 className="font-bold text-sky-900">Note from your Account Manager</h3>
              <p className="text-sky-800 mt-0.5 leading-relaxed">{orderData.customer_notes}</p>
            </div>
          </div>
        )}

        {/* Step-specific Layouts */}
        {currentStep === 'payment' ? (
          /* STEP 2: PAYMENT STEP */
          (gatewayStatus === 'success' || orderData.payment_status === 'paid') ? (
            /* When paid: Full-Width Celebration & Order Summary */
            <div className="space-y-8">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-3 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  Payment successfully verified! Your order #{orderData.order_number} has been placed into production.
                </span>
              </div>

              {/* Full-Width Spin & Win Reward Wheel on Desktop (Temporarily disabled for customer view) */}
              {/* <SpinAndWinWheel
                orderNumber={orderData.order_number}
                reviewToken={token}
              /> */}

              {/* Order Summary & Delivery Details */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-6">
                  {renderOrderSummaryCard(false)}
                  {renderDeliverySummaryCard()}
                </div>
                <div className="lg:col-span-5 space-y-6">
                  {renderVersionHistoryCard()}
                  <div className="p-4 bg-sky-50/80 rounded-2xl border border-sky-100 flex items-start gap-2.5 text-xs text-sky-800">
                    <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <span>Production begins immediately after verified payment. Your tax invoice will be sent via email.</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* When awaiting payment: 2-column layout (Summary on Left, BPOINT form on Right) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* FIRST: Order Summary Column (Left on desktop, Top on mobile) */}
              <div className="lg:col-span-7 space-y-6">
                {renderOrderSummaryCard(false)}
                {renderDeliverySummaryCard()}
                {renderVersionHistoryCard()}
              </div>

              {/* SECOND: Payment Form Column (Right on desktop, Bottom on mobile) */}
              <div className="lg:col-span-5 space-y-6">
                {renderPaymentCard()}
                <div className="p-4 bg-sky-50/80 rounded-2xl border border-sky-100 flex items-start gap-2.5 text-xs text-sky-800">
                  <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <span>Production begins immediately after verified payment. Your tax invoice will be sent via email.</span>
                </div>
              </div>
            </div>
          )
        ) : currentStep === 'production' ? (
          /* STEP 3: PRODUCTION STEP (Progress card is shown at top after countdown; lower section displays shipping/pickup info & order details) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (7 cols): Courier / Pickup & Order Summary */}
            <div className="lg:col-span-7 space-y-6">
              {/* Courier & Tracking Details Card */}
              {(orderData.shipping_carrier ||
                orderData.tracking_number ||
                ['handed_over_to_courier', 'dispatched', 'delivered'].includes(orderData.status)) && (
                <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
                        <Truck className="w-3.5 h-3.5" />
                        <span>Delivery with {orderData.shipping_carrier || 'Courier Partner'}</span>
                      </div>

                      <div className="flex flex-wrap items-baseline gap-2 pt-1">
                        <span className="text-xs text-slate-400 font-medium">Tracking Number:</span>
                        <span className="font-mono text-lg font-bold text-white tracking-wide">
                          {orderData.tracking_number || 'Awaiting dispatch confirmation'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">
                        Delivering to: {orderData.delivery_summary?.full_address || 'Shipping address provided'}
                      </p>
                    </div>

                    {orderData.carrier_tracking_url ? (
                      <a
                        href={orderData.carrier_tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs shadow-md transition shrink-0"
                      >
                        <span>Track Package</span>
                        <ExternalLink className="w-4 h-4 text-slate-700" />
                      </a>
                    ) : orderData.tracking_number ? (
                      <div className="text-xs text-slate-400 sm:text-right">
                        <span>Direct carrier tracking link unavailable</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Store Pickup Notice Card (if method is pickup and ready) */}
              {Boolean(orderData.delivery_summary?.method?.toLowerCase().includes('pickup')) &&
                ['ready_for_pickup', 'collected'].includes(orderData.status) && (
                <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Store className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                        {orderData.status === 'collected' ? 'Order Collected' : 'Ready for Pickup in Store'}
                      </span>
                      <h4 className="text-base font-bold text-white">
                        {orderData.status === 'collected'
                          ? 'Thank you! Your order has been collected.'
                          : 'Your print package is ready for pickup in store!'}
                      </h4>
                      <p className="text-xs text-slate-300">
                        Please present your order number <strong className="text-white font-mono">{orderData.order_number}</strong> at our collection counter.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {renderOrderSummaryCard(false)}
            </div>

            {/* Right Column (5 cols): Delivery & Version History Details */}
            <div className="lg:col-span-5 space-y-6">
              {renderDeliverySummaryCard()}
              {renderVersionHistoryCard()}
            </div>
          </div>
        ) : (
          /* STEP 1: REVIEW ARTWORK */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Proof Viewer & Approval/Change Request Forms (approx 8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* STEP 1: REVIEW ARTWORK CONTENT */}
              {currentStep === 'review' && (
                <>
                  {/* Proof Viewer Container */}
                  <div
                    ref={proofContainerRef}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden"
                  >
                    {/* Proof Toolbar */}
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 mr-1 uppercase tracking-wide">
                          Artwork proof
                        </span>
                        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setProofView('3d')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${proofView === '3d'
                              ? 'bg-[#E11D48] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                              }`}
                          >
                            3D Mockup
                          </button>
                          <button
                            type="button"
                            onClick={() => setProofView('flat')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${proofView === 'flat'
                              ? 'bg-[#E11D48] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                              }`}
                          >
                            Flat view
                          </button>
                        </div>

                        {backMockupUrl && (
                          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              onClick={() => setActiveSide('front')}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${activeSide === 'front'
                                ? 'bg-[#E11D48] text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                              Front
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveSide('back')}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${activeSide === 'back'
                                ? 'bg-[#E11D48] text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                              Back
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: Zoom controls (for flat view) and Fullscreen */}
                      <div className="flex items-center gap-2">
                        {proofView === 'flat' && (
                          <div className="flex items-center border border-slate-200 rounded-xl px-2 py-1 bg-slate-50 text-xs font-semibold text-slate-700">
                            <button
                              type="button"
                              onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                              className="px-1.5 py-0.5 hover:text-slate-900"
                              title="Zoom out"
                            >
                              <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 font-mono text-[11px]">{zoomLevel}%</span>
                            <button
                              type="button"
                              onClick={() => setZoomLevel((z) => Math.min(200, z + 25))}
                              className="px-1.5 py-0.5 hover:text-slate-900"
                              title="Zoom in"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={toggleFullscreen}
                          className="p-1.5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
                          title="Toggle Fullscreen"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {orderData.items.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-6 py-3">
                        <span className="mr-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Products:
                        </span>
                        {orderData.items.map((item, index) => {
                          const isSelected = (selectedProofItem?.id || primaryItem?.id) === item.id;
                          const itemArt = item.artwork_preview;
                          const hasBothSides = Boolean(itemArt?.front_url && itemArt?.back_url) || (itemArt?.files && itemArt.files.length >= 2);
                          const hasFrontOnly = Boolean(itemArt?.front_url || (itemArt?.files && itemArt.files.length === 1));

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedProofItemId(item.id);
                                setActiveSide('front');
                              }}
                              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${isSelected
                                ? 'bg-[#E11D48] text-white shadow-sm ring-2 ring-[#E11D48]/30'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                            >
                              <span className="font-mono text-[11px] opacity-80">#{index + 1}</span>
                              <span className="truncate max-w-[160px]">{item.product_name}</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                  }`}
                              >
                                {hasBothSides ? 'Front & Back' : hasFrontOnly ? 'Front Only' : 'Pending'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Viewport: 3D Scene or Flat Artwork */}
                    {proofView === '3d' ? (
                      frontMockupUrl ? (
                        <div
                          className="relative h-[460px] sm:h-[540px] w-full overflow-hidden bg-slate-950 select-none"
                          onContextMenu={(event) => event.preventDefault()}
                        >
                          <Artwork3DViewer
                            previewUrl={frontMockupUrl}
                            backPreviewUrl={backMockupUrl}
                            documentSettings={mockupDocumentSettings}
                            dimensions={mockupDimensions}
                            autoRotateInitially={false}
                            activeSide={activeSide}
                          />
                          <div aria-hidden="true" className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pointer-events-none select-none">
                            <img
                              src="/assets/images/erry_imprints_logo_white.png"
                              alt=""
                              draggable={false}
                              style={{ opacity: (orderData.proof_watermark_opacity ?? 40) / 100 }}
                              className="w-32 sm:w-44 h-auto drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#EBEBEB] min-h-[380px] p-6 flex items-center justify-center text-center">
                          <div className="max-w-sm rounded-2xl bg-white p-8 shadow-sm">
                            <Package className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                            <p className="text-sm font-semibold text-slate-700">3D mockup preview unavailable</p>
                            <p className="mt-1 text-xs text-slate-500">A front artwork image must be included in the proof to show this preview.</p>
                          </div>
                        </div>
                      )
                    ) : (
                      <div
                        className="bg-[#EBEBEB] min-h-[420px] sm:min-h-[500px] p-6 sm:p-10 flex items-center justify-center overflow-auto relative"
                        onContextMenu={(event) => event.preventDefault()}
                      >
                        <div
                          className="transition-transform duration-200 shadow-2xl rounded-none overflow-hidden bg-white max-w-full"
                          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
                        >
                          {(activeSide === 'front' ? frontMockupUrl : backMockupUrl) ? (
                            <div className="relative inline-block max-h-[460px] max-w-full align-middle select-none">
                              <img
                                src={activeSide === 'front' ? frontMockupUrl! : backMockupUrl!}
                                alt={`${activeSide === 'front' ? 'Front' : 'Back'} Flat Proof`}
                                draggable={false}
                                onContextMenu={(event) => event.preventDefault()}
                                className="max-h-[460px] max-w-full object-contain block mx-auto select-none rounded-none pointer-events-none"
                              />
                              <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none">
                                <img
                                  src="/assets/images/erry_imprints_logo.png"
                                  alt=""
                                  draggable={false}
                                  style={{ opacity: (orderData.proof_watermark_opacity ?? 40) / 100 }}
                                  className="w-28 sm:w-40 h-auto drop-shadow-[0_1px_3px_rgba(255,255,255,0.9)]"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="w-[500px] h-[300px] flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8 rounded-none">
                              <Package className="w-12 h-12 mb-2 stroke-1" />
                              <p className="text-sm font-semibold">
                                {activeSide === 'back' ? 'Back artwork not available for this product' : 'Artwork preview not available'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Active File Details Footer */}
                    {((activeSide === 'back' && backFile) ? backFile : frontFile) && (
                      <div className="px-6 py-3 bg-white border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                        <span className="font-medium text-slate-700">
                          {((activeSide === 'back' && backFile) ? backFile : frontFile)?.label || (activeSide === 'back' ? 'Back' : 'Front')}: {((activeSide === 'back' && backFile) ? backFile : frontFile)?.file_name}
                        </span>
                        {((activeSide === 'back' && backFile) ? backFile : frontFile)?.file_size_bytes && (
                          <span>{(((activeSide === 'back' && backFile) ? backFile : frontFile)!.file_size_bytes! / (1024 * 1024)).toFixed(2)} MB</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Two-Card Grid: Confirmation & Change Request */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card 1: Confirm your artwork */}
                    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-slate-900">Confirm your artwork</h3>

                      <div className="space-y-3.5">
                        <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 select-none group">
                          <input
                            type="checkbox"
                            checked={checkArtwork}
                            onChange={(e) => setCheckArtwork(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-[#E11D48] focus:ring-[#E11D48] w-4 h-4 shrink-0"
                          />
                          <span className="leading-relaxed group-hover:text-slate-900">
                            Artwork checked: I have checked all pages and sides, spelling, contact details, prices, images, layout and QR codes. I approve the current proof as correct.
                          </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 select-none group">
                          <input
                            type="checkbox"
                            checked={checkOrderDetails}
                            onChange={(e) => setCheckOrderDetails(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-[#E11D48] focus:ring-[#E11D48] w-4 h-4 shrink-0"
                          />
                          <span className="leading-relaxed group-hover:text-slate-900">
                            Order details confirmed: I confirm the size, quantity, material, finish, printing sides, delivery details and total price. I understand screen colours may differ from printed colours.
                          </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 select-none group">
                          <input
                            type="checkbox"
                            checked={checkCopyright}
                            onChange={(e) => setCheckCopyright(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-[#E11D48] focus:ring-[#E11D48] w-4 h-4 shrink-0"
                          />
                          <span className="leading-relaxed group-hover:text-slate-900">
                            Copyright and permissions: I own or have the necessary licences and permissions to reproduce all supplied content, images, logos and trademarks, and authorise Erry Imprints to print them.
                          </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 select-none group">
                          <input
                            type="checkbox"
                            checked={checkFinalApproval}
                            onChange={(e) => setCheckFinalApproval(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-[#E11D48] focus:ring-[#E11D48] w-4 h-4 shrink-0"
                          />
                          <span className="leading-relaxed group-hover:text-slate-900">
                            Final approval — no amendments: I am authorised to approve this order and understand it will be locked after approval. Changes or cancellation are not guaranteed, and correcting approved customer content errors may incur reprint costs. This does not limit my rights under Australian Consumer Law.
                          </span>
                        </label>
                      </div>

                      {approvalError && (
                        <p className="text-xs text-rose-600 font-semibold">{approvalError}</p>
                      )}
                    </div>

                    {/* Card 2: Request changes (optional) */}
                    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-2">
                          Request changes <span className="text-slate-400 font-normal">(optional)</span>
                        </h3>
                        <textarea
                          value={changeComment}
                          onChange={(e) => setChangeComment(e.target.value)}
                          placeholder="Add a comment to let us know what changes you'd like..."
                          rows={3}
                          className="w-full text-xs text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E11D48] resize-none"
                        />
                      </div>

                      <div className="mt-4 flex justify-start">
                        <button
                          type="button"
                          onClick={handleSubmitChanges}
                          disabled={submittingChanges || !changeComment.trim()}
                          className="px-4 py-2 bg-pink-50 hover:bg-pink-100 text-[#E11D48] border border-pink-200 font-bold text-xs rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {submittingChanges ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5" />
                          )}
                          <span>Send change request</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>

            {/* RIGHT COLUMN: Order Summary & Version History (approx 4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              {renderOrderSummaryCard(true)}
              {renderVersionHistoryCard()}
              {renderDeliverySummaryCard()}
            </div>
          </div>
        )}
      </main>

      {/* Footer matching reference screenshot bottom strip */}
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-pink-50 text-[#E11D48] flex items-center justify-center font-bold text-xs">
                1
              </span>
              <div>
                <p className="font-bold text-xs text-slate-800">Create order</p>
                <p className="text-[11px] text-slate-400">Add customer &amp; products</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-pink-50 text-[#E11D48] flex items-center justify-center font-bold text-xs">
                2
              </span>
              <div>
                <p className="font-bold text-xs text-slate-800">Upload proof</p>
                <p className="text-[11px] text-slate-400">Attach artwork proof</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-pink-50 text-[#E11D48] flex items-center justify-center font-bold text-xs">
                3
              </span>
              <div>
                <p className="font-bold text-xs text-slate-800">Customer approval</p>
                <p className="text-[11px] text-slate-400">Review &amp; approve</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-pink-50 text-[#E11D48] flex items-center justify-center font-bold text-xs">
                4
              </span>
              <div>
                <p className="font-bold text-xs text-slate-800">Payment</p>
                <p className="text-[11px] text-slate-400">Secure payment</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-pink-50 text-[#E11D48] flex items-center justify-center font-bold text-xs">
                5
              </span>
              <div>
                <p className="font-bold text-xs text-slate-800">Production</p>
                <p className="text-[11px] text-slate-400">Order moves to print</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
