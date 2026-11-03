'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { AlertTriangle, ArrowLeft, Check, Download, Printer, QrCode, RefreshCw, ScanLine, Search, ShieldCheck, Video, VideoOff } from 'lucide-react';
import { manualOrderService } from '@/services/admin/manualOrderService';

const STATIONS = [
  { key: 'printing', label: 'Printing', description: 'Start printing for approved orders.' },
  { key: 'cutting_and_finishing', label: 'Cutting & Finishing', description: 'Move printed orders to finishing.' },
  { key: 'quality_check_and_packaging', label: 'Quality Check & Packaging', description: 'Complete quality checks and packaging.' },
  { key: 'ready_for_dispatch', label: 'Ready for Pickup / Dispatch', description: 'Mark production complete and ready to leave.' },
  { key: 'handed_over_to_courier', label: 'Handed Over to Courier', description: 'Record courier handoff.' },
  { key: 'delivered', label: 'Delivered', description: 'Confirm delivery to the customer.' },
  { key: 'collected', label: 'Collected', description: 'Confirm customer pickup.' },
] as const;

type Station = (typeof STATIONS)[number];
type StationOrder = {
  id: string;
  item_id: string;
  item_name: string;
  item_quantity: number;
  item_status: string;
  order_number: string;
  customer_name: string;
  customer_email?: string | null;
  status: string;
  payment_status: string;
  delivery_method: string;
  product_summary: string;
  target_status: string;
  target_label: string;
};

const statusLabel = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ProductionStationsPage() {
  const [station, setStation] = useState<Station | null>(null);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<StationOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scanBusyRef = useRef(false);
  const processingOrderRef = useRef(false);
  const recentScansRef = useRef<Map<string, number>>(new Map());
  const processedOrderQrRef = useRef<Set<string>>(new Set());

  const fetchStationOrders = useCallback(async (stage: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await manualOrderService.getProductionStationOrders(stage);
      setOrders(response?.data?.orders || []);
      setSelectedOrderId(null);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not load this station queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stageKey = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('stage');
    const activeStation = STATIONS.find((item) => item.key === stageKey) || null;
    setStation(activeStation);
    if (!activeStation) return;
    window.dispatchEvent(new CustomEvent('admin-qr-order-view-change', { detail: { active: true } }));
    void fetchStationOrders(activeStation.key);
    return () => {
      window.dispatchEvent(new CustomEvent('admin-qr-order-view-change', { detail: { active: false } }));
    };
  }, [fetchStationOrders]);

  useEffect(() => {
    if (station || typeof window === 'undefined') return;
    let cancelled = false;
    Promise.all(STATIONS.map(async (item) => {
      const url = new URL(`/admin/production/stations?stage=${encodeURIComponent(item.key)}`, window.location.origin).toString();
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M', margin: 2, width: 320,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      return [item.key, dataUrl] as const;
    })).then((entries) => {
      if (!cancelled) setQrCodes(Object.fromEntries(entries));
    }).catch((qrError) => {
      console.error('Could not generate station QR codes:', qrError);
      if (!cancelled) setError('Could not generate station QR codes.');
    });
    return () => { cancelled = true; };
  }, [station]);

  const visibleOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return orders;
    return orders.filter((order) => [order.order_number, order.customer_name, order.customer_email, order.product_summary]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch)));
  }, [orders, search]);

  const selectedOrder = orders.find((order) => order.item_id === selectedOrderId) || null;

  const handleScannedOrderQr = useCallback(async (rawValue: string) => {
    if (!station || processingOrderRef.current) return;
    if (processedOrderQrRef.current.has(rawValue)) return;
    const previousValueScanAt = recentScansRef.current.get(rawValue) || 0;
    if (Date.now() - previousValueScanAt < 5000) return;
    recentScansRef.current.set(rawValue, Date.now());
    let orderId: string | null = null;
    let itemId: string | null = null;
    try {
      const scannedUrl = new URL(rawValue);
      if (scannedUrl.origin !== window.location.origin) {
        setError('This QR is not an order label from this store. Scan the QR printed for the order.');
        return;
      }
      const match = scannedUrl.pathname.match(/^\/admin\/orders\/([^/]+)\/?$/);
      itemId = scannedUrl.searchParams.get('itemQr');
      if (match && itemId) orderId = decodeURIComponent(match[1]);
    } catch {
      // The order label QR currently encodes the authenticated admin order URL.
    }

    if (!orderId) {
      setError('Product QR not recognized. Scan this order item’s Product QR from the order detail page.');
      return;
    }

    processingOrderRef.current = true;
    setUpdating(true);
    setError(null);
    setSuccess(null);
    try {
      let shippingCarrier = carrier.trim();
      let shippingTracking = trackingNumber.trim();
      if (station.key === 'handed_over_to_courier' && (!shippingCarrier || !shippingTracking)) {
        shippingCarrier = window.prompt('Enter courier name for this shipment:')?.trim() || '';
        shippingTracking = window.prompt('Enter tracking number for this shipment:')?.trim() || '';
        if (!shippingCarrier || !shippingTracking) {
          setError('Courier handoff needs both carrier and tracking number. Scan the product QR again after entering them.');
          return;
        }
        setCarrier(shippingCarrier);
        setTrackingNumber(shippingTracking);
      }
      const response = await manualOrderService.completeProductionStationOrder(station.key, orderId, {
        item_id: itemId!,
        shipping_carrier: shippingCarrier,
        tracking_number: shippingTracking,
      });
      const orderNumber = response?.data?.order_number || orderId;
      const targetLabel = response?.data?.status_label || station.label;
      processedOrderQrRef.current.add(rawValue);
      const itemName = response?.data?.item_name || 'Product';
      const orderUpdated = response?.data?.order_status_updated;
      setSuccess(`${itemName} · ${orderNumber} moved to ${targetLabel}${orderUpdated ? ' (all order items reached this stage)' : ' (other products are still at earlier stages)'}.`);
      if ('vibrate' in navigator) navigator.vibrate?.(100);
      await fetchStationOrders(station.key);
      if (response?.data?.warning) setError(response.data.warning);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.errors?.order?.[0]
        || requestError?.response?.data?.message
        || 'This order could not be moved at this station.';
      recentScansRef.current.set(rawValue, Number.MAX_SAFE_INTEGER);
      setError(message);
    } finally {
      processingOrderRef.current = false;
      setUpdating(false);
    }
  }, [fetchStationOrders, station]);

  useEffect(() => {
    if (!scannerActive || !station) return;
    let cancelled = false;
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access needs a secure HTTPS connection and a supported browser.');
        }
        const BarcodeDetectorConstructor = (window as any).BarcodeDetector;
        if (!BarcodeDetectorConstructor) {
          throw new Error('QR camera scanning is not supported by this browser. Use Chrome on Android or scan the order QR with a supported camera scanner.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new BarcodeDetectorConstructor({ formats: ['qr_code'] });
        const scanFrame = async () => {
          const video = videoRef.current;
          if (!video || cancelled) return;
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !scanBusyRef.current) {
            scanBusyRef.current = true;
            try {
              const detected = await detector.detect(video);
              const value = detected?.[0]?.rawValue;
              if (value) await handleScannedOrderQr(value);
            } catch (scanError) {
              console.warn('Station QR scan frame failed:', scanError);
            } finally {
              scanBusyRef.current = false;
            }
          }
          if (!cancelled) animationFrameRef.current = window.requestAnimationFrame(scanFrame);
        };
        animationFrameRef.current = window.requestAnimationFrame(scanFrame);
      } catch (cameraError: any) {
        setScannerActive(false);
        setError(cameraError?.message || 'Could not open the camera. Allow camera permission and try again.');
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      scanBusyRef.current = false;
    };
  }, [handleScannedOrderQr, scannerActive, station]);

  const handleComplete = async () => {
    if (!station || !selectedOrder) return;
    if (station.key === 'handed_over_to_courier' && (!carrier.trim() || !trackingNumber.trim())) {
      setError('Carrier and tracking number are required before courier handoff.');
      return;
    }
    if (!window.confirm(`Move order ${selectedOrder.order_number} from ${statusLabel(selectedOrder.status)} to ${selectedOrder.target_label} and notify the customer?`)) return;

    setUpdating(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await manualOrderService.completeProductionStationOrder(station.key, selectedOrder.id, {
        item_id: selectedOrder.item_id,
        shipping_carrier: carrier.trim(),
        tracking_number: trackingNumber.trim(),
      });
      setSuccess(`${selectedOrder.order_number} moved to ${response?.data?.status_label || selectedOrder.target_label}.`);
      setCarrier('');
      setTrackingNumber('');
      await fetchStationOrders(station.key);
      if (response?.data?.warning) setError(response.data.warning);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.response?.data?.errors?.order?.[0] || 'Could not update this order. Refresh the queue and try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (station) {
    return (
      <main className="min-h-screen w-full overflow-x-hidden bg-slate-950 px-3 py-4 text-slate-100 sm:px-5 sm:py-6">
        <div className="mx-auto w-full max-w-xl space-y-4">
          <header className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <a href="/admin/production/stations" onClick={() => {
              setStation(null);
              window.dispatchEvent(new CustomEvent('admin-qr-order-view-change', { detail: { active: false } }));
            }} className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Station QR codes
            </a>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-400">Production Station</p>
                <h1 className="mt-1 text-xl font-bold text-white">{station.label}</h1>
              </div>
              <button type="button" onClick={() => void fetchStationOrders(station.key)} disabled={loading} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800" aria-label="Refresh station orders">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Eligible orders only · {orders.length} waiting</p>
          </header>

          <section className="rounded-2xl border border-sky-500/25 bg-slate-900 p-4">
            <div className="flex items-start gap-3">
              <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white">Scan order label</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">The machine QR sets this stage. Start the camera and scan the unique Order QR on each job label; eligible orders update automatically.</p>
              </div>
            </div>
            {scannerActive ? (
              <div className="mt-3 space-y-3">
                <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" aria-label="Order QR scanner camera" />
                <button type="button" onClick={() => setScannerActive(false)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"><VideoOff className="h-4 w-4" /> Stop scanner</button>
              </div>
            ) : (
              <button type="button" onClick={() => { recentScansRef.current.clear(); setError(null); setScannerActive(true); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500"><Video className="h-4 w-4" /> Start camera scanner</button>
            )}
            {updating && <p className="mt-2 text-center text-xs font-medium text-sky-300">Verifying order and updating status…</p>}
          </section>

          {error && (() => {
            const warning = /^(stage sequence|payment|delivery) warning:/i.test(error);
            const heading = error.startsWith('Stage sequence warning:') ? 'Stage sequence warning' : 'Order warning';
            return (
              <div role="alert" className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${warning ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
                {warning && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <div className="min-w-0">{warning && <p className="mb-1 font-semibold">{heading}</p>}{error}</div>
              </div>
            );
          })()}
          {success && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">{success}</div>}

          <label className="relative block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find order, customer, or product" className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500" />
          </label>

          {loading && orders.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading eligible orders…</div>
          ) : visibleOrders.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">No eligible orders are waiting at this stage.</div>
          ) : (
            <div className="space-y-2">
              {visibleOrders.map((order) => {
                const selected = selectedOrderId === order.item_id;
                return (
                  <button key={order.item_id} type="button" onClick={() => { setSelectedOrderId(order.item_id); setError(null); }} className={`w-full rounded-xl border p-4 text-left transition ${selected ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-white">{order.order_number}</p>
                        <p className="mt-1 text-xs text-slate-300">{order.customer_name}</p>
                        <p className="mt-1 break-words text-xs font-medium text-slate-200 [overflow-wrap:anywhere]">{order.item_name} × {order.item_quantity}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">{statusLabel(order.status)}</span>
                    </div>
                    <p className="mt-3 text-[11px] font-semibold text-sky-300">On confirm → {order.target_label}</p>
                  </button>
                );
              })}
            </div>
          )}

          {selectedOrder && (
            <section className="sticky bottom-3 rounded-2xl border border-sky-500/30 bg-slate-900 p-4 shadow-2xl">
              <p className="text-xs text-slate-400">Selected order</p>
              <h2 className="mt-1 text-base font-bold text-white">{selectedOrder.order_number}</h2>
              {station.key === 'handed_over_to_courier' && (
                <div className="mt-3 space-y-2">
                  <input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Carrier name" aria-label="Carrier name" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500" />
                  <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Tracking number" aria-label="Tracking number" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500" />
                </div>
              )}
              <button type="button" onClick={() => void handleComplete()} disabled={updating} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
                {updating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {updating ? 'Updating order…' : `Confirm ${selectedOrder.target_label}`}
              </button>
            </section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 print:hidden"><ArrowLeft className="h-3.5 w-3.5" /> Orders</Link>
            <h1 className="text-2xl font-bold tracking-tight">Production Station QR Codes</h1>
            <p className="mt-1 text-sm text-slate-500">Print one fixed QR for each machine. Scanning opens that stage&apos;s eligible order queue.</p>
          </div>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 print:hidden"><Printer className="h-4 w-4" /> Print all labels</button>
        </header>

        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 print:hidden">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" /><p>Staff sign in and scan the fixed machine QR once. At that station, scan each order&apos;s unique Order QR label; eligible orders update automatically. The server checks the stage transition, records who changed it, and sends the customer update.</p></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
          {STATIONS.map((item) => (
            <article key={item.key} className="station-qr-card flex break-inside-avoid flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm print:rounded-none print:shadow-none">
              <div className="mb-3 flex items-center gap-2 text-slate-500"><QrCode className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-widest">Production Station</span></div>
              <h2 className="text-base font-bold text-slate-900">{item.label}</h2>
              <p className="mt-1 min-h-9 text-xs text-slate-500">{item.description}</p>
              <div className="my-3 flex h-48 w-48 items-center justify-center rounded-xl bg-white p-2">
                {qrCodes[item.key] ? <img src={qrCodes[item.key]} alt={`${item.label} station QR code`} className="h-full w-full" /> : <span className="text-xs text-slate-400">Generating…</span>}
              </div>
              <a href={qrCodes[item.key] || undefined} download={`${item.key}-station-qr.png`} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 print:hidden"><Download className="h-3.5 w-3.5" /> Download QR</a>
              <a href={`/admin/production/stations?stage=${encodeURIComponent(item.key)}`} className="mt-2 text-xs font-medium text-sky-700 hover:text-sky-900 print:hidden">Open station queue</a>
            </article>
          ))}
        </div>
      </div>
      <style jsx global>{`@media print { body { background: #fff !important; } .station-qr-card { border: 1px solid #cbd5e1 !important; } }`}</style>
    </main>
  );
}
