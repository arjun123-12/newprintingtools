'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CreditCard,
  ShieldCheck,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Lock,
  ExternalLink,
  ChevronRight,
  Palette,
  Receipt,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { checkoutService, CreatedOrder } from '@/services/checkoutService';

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

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdentifier = searchParams.get('order');
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Order state
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gateway & Session state
  const [gatewayStatus, setGatewayStatus] = useState<
    'idle' | 'loading' | 'ready' | 'disabled' | 'error' | 'success'
  >('idle');
  const [gatewayMessage, setGatewayMessage] = useState<string>('');
  const [authKey, setAuthKey] = useState<string | null>(null);
  const [clientScriptUrl, setClientScriptUrl] = useState<string>(
    'https://bpoint.uat.linkly.com.au/rest/clientscripts/api.js'
  );
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    receiptNumber?: string;
    txnNumber?: string;
    message?: string;
  } | null>(null);

  const controllerRef = useRef<any>(null);

  // 1. Authenticate and load authoritative order details
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(
        `/login?redirect=${encodeURIComponent(
          window.location.pathname + window.location.search
        )}`
      );
      return;
    }

    if (!orderIdentifier) {
      setError('No order reference provided. Please return to checkout.');
      setLoading(false);
      return;
    }

    const loadOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await checkoutService.getOrder(orderIdentifier);
        setOrder(data);

        // Check if order is already paid
        if (data.payment_status === 'paid') {
          setGatewayStatus('success');
          setPaymentSuccessData({
            message: 'This order has already been paid and confirmed.',
          });
        }
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            'Unable to load order details. Please verify your order number or check your account.'
        );
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      loadOrder();
    }
  }, [orderIdentifier, isAuthenticated, authLoading, router]);

  // 2. Initialize payment session with backend once order is verified
  const initPaymentSession = async (orderNumber: string) => {
    try {
      setGatewayStatus('loading');
      setPaymentError(null);
      setIframeLoaded(false);

      const response = await checkoutService.createPaymentSession(orderNumber);

      if (response?.data?.enabled && response?.data?.authkey) {
        setAuthKey(response.data.authkey);
        if (response.data.client_script_url) {
          setClientScriptUrl(response.data.client_script_url);
        }
        setGatewayStatus('ready');
      } else {
        setGatewayStatus('disabled');
        setGatewayMessage(
          response?.message ||
            'BPOINT UAT payment gateway is currently disabled in server configuration.'
        );
      }
    } catch (err: any) {
      const is503 = err.response?.status === 503;
      const isGatewayDisabled =
        err.response?.data?.data?.gateway_enabled === false ||
        err.response?.data?.gateway_enabled === false;

      if (is503 || isGatewayDisabled) {
        setGatewayStatus('disabled');
        setGatewayMessage(
          err.response?.data?.message ||
            'BPOINT UAT payment gateway is disabled on the server. Your order remains pending.'
        );
      } else if (err.response?.status === 409) {
        // Order already paid
        setGatewayStatus('success');
        setPaymentSuccessData({
          message: 'This order has already been paid and confirmed.',
        });
      } else {
        setGatewayStatus('error');
        setPaymentError(
          err.response?.data?.message ||
            'Unable to initiate payment session with BPOINT gateway.'
        );
      }
    }
  };

  useEffect(() => {
    if (order && order.payment_status !== 'paid' && gatewayStatus === 'idle') {
      initPaymentSession(order.order_number);
    }
  }, [order, gatewayStatus]);

  // 3. Render BPOINT secure iFrame fields once AuthKey is active
  useEffect(() => {
    if (!authKey || gatewayStatus !== 'ready') return;

    let isMounted = true;

    const setupBpointFields = () => {
      if (!window.BPOINT?.txn?.authkey?.setupIframeFields) {
        console.warn('BPOINT client SDK not found on window object.');
        return;
      }

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
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              'font-size': '14px',
              color: '#0f172a',
              'line-height': '22px',
            },
            focus: {
              color: '#0f172a',
            },
            invalid: {
              color: '#dc2626',
            },
          },
          onFormLoaded: function (controller: any) {
            if (isMounted) {
              controllerRef.current = controller;
              setIframeLoaded(true);
            }
          },
          onFormLoadError: function (err: any) {
            if (isMounted) {
              console.error('BPOINT iframe load error:', err);
              setPaymentError('Failed to load secure card fields. Please refresh.');
            }
          },
        });
      } catch (e: any) {
        console.error('Error mounting BPOINT iframe fields:', e);
        if (isMounted) {
          setPaymentError('Could not initialize card input fields.');
        }
      }
    };

    const scriptId = 'bpoint-client-script';
    let scriptElement = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (window.BPOINT?.txn?.authkey?.setupIframeFields) {
      setupBpointFields();
    } else if (scriptElement) {
      scriptElement.addEventListener('load', setupBpointFields);
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = clientScriptUrl;
      script.type = 'text/javascript';
      script.async = true;
      script.onload = setupBpointFields;
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
  }, [authKey, gatewayStatus, clientScriptUrl]);

  // 4. Handle Payment Submission
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!controllerRef.current || !authKey || !order) {
      setPaymentError('Payment form is not ready yet. Please wait a moment.');
      return;
    }

    setSubmitting(true);
    setPaymentError(null);

    // Call official BPOINT controller.submit
    controllerRef.current.submit(async (code: string, data: any) => {
      if (code === 'success') {
        try {
          // Verify & complete transaction on backend
          const result = await checkoutService.processPayment(
            order.order_number,
            authKey
          );

          if (result.success && result.data?.paid) {
            setGatewayStatus('success');
            setPaymentSuccessData({
              receiptNumber: result.data?.receipt_number,
              txnNumber: result.data?.txn_number,
              message: result.message || 'Payment completed successfully.',
            });
            // Update local order status
            setOrder((prev) =>
              prev ? { ...prev, payment_status: 'paid', status: 'processing' } : prev
            );
          } else {
            setPaymentError(
              result.message || 'Payment declined. Your order remains pending.'
            );
          }
        } catch (err: any) {
          setPaymentError(
            err.response?.data?.message ||
              'Payment verification failed. Your order remains pending.'
          );
        } finally {
          setSubmitting(false);
        }
      } else {
        setSubmitting(false);
        const detailMsg =
          data?.details?.[0]?.message ||
          data?.message ||
          'Card verification failed. Please check the entered card details.';
        setPaymentError(detailMsg);
      }
    });
  };

  // Loading State
  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <Loader2 className="w-10 h-10 animate-spin text-sky-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Preparing Payment Checkout...</h2>
        <p className="text-slate-500 text-sm mt-1">
          Retrieving authoritative order details from backend
        </p>
      </div>
    );
  }

  // Error State: Order Not Found
  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Order Not Found</h2>
        <p className="text-slate-600 mb-6 text-sm">
          {error || 'The requested order could not be located.'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/checkout"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white font-semibold text-sm rounded-xl hover:bg-sky-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Checkout</span>
          </Link>
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-200 transition"
          >
            <span>View All Orders</span>
          </Link>
        </div>
      </div>
    );
  }

  const payableTotal = Number(order.total_inc_gst || order.total).toFixed(2);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <style jsx global>{`
        .bpoint-field-wrapper {
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.875rem;
          padding: 0.5rem 0.875rem;
          min-height: 46px;
          display: flex;
          align-items: center;
          transition: all 0.2s ease-in-out;
        }
        .bpoint-field-wrapper.is-focused {
          border-color: #0284c7 !important;
          background-color: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15) !important;
        }
        .bpoint-field-wrapper.is-invalid {
          border-color: #ef4444 !important;
          background-color: #fff5f5 !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15) !important;
        }
        .bpoint-field-wrapper.is-valid {
          border-color: #10b981 !important;
        }
        .bpoint-field-wrapper iframe {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          min-height: 24px;
        }
      `}</style>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6">
        <Link href="/cart" className="hover:text-slate-900 transition">
          Cart
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link href="/checkout" className="hover:text-slate-900 transition">
          Checkout
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-sky-600">BPOINT Secure Payment</span>
      </nav>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-400/20 border border-sky-400/30 text-sky-300 text-xs font-bold uppercase tracking-wider mb-2">
              {gatewayStatus === 'success' || order.payment_status === 'paid' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Payment Confirmed & Paid</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-amber-300">Pending Payment Authorization</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Order #{order.order_number}
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Created on{' '}
              {new Date(order.created_at).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="text-left sm:text-right bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
            <span className="text-xs text-slate-300 block uppercase font-medium">
              Authoritative Total
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white">
              ${payableTotal}
            </span>
            <span className="text-[11px] text-sky-200 block font-medium">
              AUD inc. 10% GST
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Order Summary & Address Snapshots */}
        <div className="lg:col-span-7 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-sky-600" />
              <span>Order Items ({order.items?.length || 0})</span>
            </h2>

            <div className="divide-y divide-slate-100">
              {order.items?.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 truncate">
                      {item.product_name}
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5 space-x-2">
                      <span>SKU: {item.product_sku || 'N/A'}</span>
                      <span>•</span>
                      <span>
                        Qty: <strong>{item.quantity}</strong>
                      </span>
                    </div>

                    {item.options_snapshot &&
                      Object.keys(item.options_snapshot).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(item.options_snapshot).map(([optKey, optVal]) => (
                            <span
                              key={optKey}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-600 font-medium"
                            >
                              <span className="text-slate-400 mr-1">{optKey}:</span>
                              {String(optVal)}
                            </span>
                          ))}
                        </div>
                      )}

                    {item.artwork_id && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                        <Palette className="w-3.5 h-3.5" />
                        <span>
                          Custom Artwork Linked (
                          {item.artwork?.name || 'Production Ready'})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-slate-900 block">
                      ${Number(item.total_price_inc_gst).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ${Number(item.unit_price_ex_gst).toFixed(4)} ex GST
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Frozen Address Snapshots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Shipping Address */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-sky-600" />
                <span>Shipping Address</span>
              </span>
              <p className="font-bold text-sm text-slate-900">
                {order.shipping_address?.name}
              </p>
              {order.shipping_address?.company && (
                <p className="text-xs text-slate-500">
                  {order.shipping_address.company}
                </p>
              )}
              <p className="text-xs text-slate-600 mt-1">
                {order.shipping_address?.address_line_1}
              </p>
              {order.shipping_address?.address_line_2 && (
                <p className="text-xs text-slate-600">
                  {order.shipping_address.address_line_2}
                </p>
              )}
              <p className="text-xs text-slate-600">
                {order.shipping_address?.city}, {order.shipping_address?.state}{' '}
                {order.shipping_address?.postcode}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Phone: {order.shipping_address?.phone}
              </p>
            </div>

            {/* Billing Address */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                <span>Billing Address</span>
              </span>
              <p className="font-bold text-sm text-slate-900">
                {order.billing_address?.name}
              </p>
              {order.billing_address?.company && (
                <p className="text-xs text-slate-500">
                  {order.billing_address.company}
                </p>
              )}
              <p className="text-xs text-slate-600 mt-1">
                {order.billing_address?.address_line_1}
              </p>
              {order.billing_address?.address_line_2 && (
                <p className="text-xs text-slate-600">
                  {order.billing_address.address_line_2}
                </p>
              )}
              <p className="text-xs text-slate-600">
                {order.billing_address?.city}, {order.billing_address?.state}{' '}
                {order.billing_address?.postcode}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Phone: {order.billing_address?.phone}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: BPOINT Payment Form / Gateway Status */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">BPOINT Payment</h3>
                  <p className="text-xs text-slate-500">v5 UAT Secure Payment Gateway</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-mono text-[11px] font-semibold">
                UAT Mode
              </span>
            </div>

            {/* Price Breakdown */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (ex GST)</span>
                <span className="font-semibold text-slate-800">
                  ${Number(order.subtotal_ex_gst).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Australian GST (10%)</span>
                <span className="font-semibold text-slate-800">
                  ${Number(order.gst_amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping ({order.shipping_carrier || 'Australia Post'})</span>
                <span className="font-semibold text-slate-800">
                  {Number(order.shipping_fee_inc_gst) === 0 ? (
                    <span className="text-emerald-600 font-bold">FREE</span>
                  ) : (
                    `$${Number(order.shipping_fee_inc_gst).toFixed(2)}`
                  )}
                </span>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount</span>
                  <span>-${Number(order.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-sm font-black text-slate-900">
                <span>Payable Total</span>
                <span className="text-lg text-sky-600">${payableTotal} AUD</span>
              </div>
            </div>

            {/* STATE 1: PAYMENT SUCCESS / ALREADY PAID */}
            {(gatewayStatus === 'success' || order.payment_status === 'paid') && (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900 text-base">Payment Verified!</h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    {paymentSuccessData?.message ||
                      'Your order has been paid and queued for production.'}
                  </p>
                </div>

                {paymentSuccessData?.receiptNumber && (
                  <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 text-xs text-left space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Receipt No:</span>
                      <strong className="text-slate-800">
                        {paymentSuccessData.receiptNumber}
                      </strong>
                    </div>
                    {paymentSuccessData.txnNumber && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Transaction Ref:</span>
                        <span className="text-slate-700">
                          {paymentSuccessData.txnNumber}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href={`/orders`}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <span>View in My Orders</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href="/"
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition text-center"
                  >
                    Return to Store
                  </Link>
                </div>
              </div>
            )}

            {/* STATE 2: GATEWAY DISABLED / NOT CONFIGURED */}
            {gatewayStatus === 'disabled' && (
              <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm">
                      BPOINT Gateway Disabled (UAT)
                    </h4>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      {gatewayMessage ||
                        'The BPOINT payment gateway is disabled by default until valid UAT credentials are configured in your Laravel server environment.'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/70 rounded-xl border border-amber-100 text-[11px] text-amber-900 space-y-1">
                  <span className="font-semibold block text-amber-800">
                    Order Status: <span className="uppercase font-bold">Pending (Unpaid)</span>
                  </span>
                  <p className="text-slate-500">
                    Your order total of <strong>${payableTotal} AUD</strong> is secured.
                    Once credentials are configured in <code>.env</code>, payments can be completed here.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => initPaymentSession(order.order_number)}
                    className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Gateway Connection</span>
                  </button>

                  <Link
                    href="/orders"
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 text-center"
                  >
                    <span>View Orders History</span>
                  </Link>
                </div>
              </div>
            )}

            {/* STATE 3: GATEWAY LOADING */}
            {gatewayStatus === 'loading' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    Connecting to BPOINT Secure Session...
                  </h4>
                  <p className="text-slate-500 text-xs mt-1">
                    Establishing encrypted session token for Order #{order.order_number}
                  </p>
                </div>
              </div>
            )}

            {/* STATE 4: GATEWAY ERROR */}
            {gatewayStatus === 'error' && (
              <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-rose-900 text-sm">
                      Unable to Start Payment Session
                    </h4>
                    <p className="text-xs text-rose-700 mt-1">
                      {paymentError ||
                        'Communication with the BPOINT payment server failed.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => initPaymentSession(order.order_number)}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Session Initialization</span>
                </button>
              </div>
            )}

            {/* STATE 5: BPOINT SECURE IFRAME FORM */}
            {gatewayStatus === 'ready' && (
              <form onSubmit={handlePaymentSubmit} className="space-y-4 pt-1">
                {paymentError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {/* Secure Card Fields rendered in BPOINT Hosted iFrames */}
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Name on Card
                    </label>
                    <div id="bpoint-card-name" className="bpoint-field-wrapper" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Card Number
                    </label>
                    <div id="bpoint-card-number" className="bpoint-field-wrapper" />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Exp. Month
                      </label>
                      <div id="bpoint-expiry-month" className="bpoint-field-wrapper" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Exp. Year
                      </label>
                      <div id="bpoint-expiry-year" className="bpoint-field-wrapper" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        CVN / CVC
                      </label>
                      <div id="bpoint-cvn" className="bpoint-field-wrapper" />
                    </div>
                  </div>
                </div>

                {!iframeLoaded && (
                  <div className="py-2 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Loading BPOINT secure fields...</span>
                  </div>
                )}

                {/* Submit Payment Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!iframeLoaded || submitting}
                    className={`w-full py-3.5 px-4 font-bold text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-sm ${
                      !iframeLoaded || submitting
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20 hover:shadow-md'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying with BPOINT...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Pay ${payableTotal} AUD via BPOINT</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Security Badges */}
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>PCI-DSS SAQ-A compliant hosted iframe fields</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-sky-500 shrink-0" />
                <span>Raw card data never reaches or touches application servers</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Cart remains intact until payment verification succeeds</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
          <Loader2 className="w-10 h-10 animate-spin text-sky-600 mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Loading Order Details...</h2>
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}
