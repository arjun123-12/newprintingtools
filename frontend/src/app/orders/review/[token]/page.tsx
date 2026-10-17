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
  MessageSquare,
  Check,
  RefreshCw,
  AlertTriangle,
  Truck,
  Eye,
} from 'lucide-react';
import { orderReviewService, CustomerReviewData } from '@/services/orderReviewService';
import { Artwork3DViewer } from '@/components/designer/controls/Artwork3DViewer';
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

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function OrderReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  // Data & loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<CustomerReviewData | null>(null);
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
  const [checkSpelling, setCheckSpelling] = useState(false);
  const [checkSpecs, setCheckSpecs] = useState(false);
  const [checkApproval, setCheckApproval] = useState(false);

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
    'https://bpoint.uat.linkly.com.au/rest/clientscripts/api.js'
  );
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  const bpointControllerRef = useRef<any>(null);

  // 1. Fetch Authoritative Order Data
  const loadOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await orderReviewService.getReviewOrder(token);
      if (res.success && res.data) {
        setOrderData(res.data);

        // Derive initial step based on order status
        if (res.data.status === 'in_production' || res.data.payment_status === 'paid') {
          if (res.data.status === 'in_production') {
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
    const proofFiles = orderData?.proof.files || [];
    const hasUploadedProof = proofFiles.some((f) => !f.mime_type?.includes('pdf')) || Boolean(orderData?.proof.thumbnail_url);
    if (hasUploadedProof) {
      setTemplatePreviewUrl(null);
      setTemplateBackPreviewUrl(null);
      return;
    }

    const savedCanvas = orderData?.proof.template_canvas_json;
    const frontCanvas = getCanvasPage(savedCanvas, 0);
    const backCanvas = getCanvasPage(
      orderData?.proof.template_back_canvas_json ?? savedCanvas,
      orderData?.proof.template_back_canvas_json ? 0 : 1
    );
    const settings = orderData?.proof.document_settings || {};
    const savedDimensions = orderData?.proof.dimensions || {};
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
    if (!checkSpelling || !checkSpecs || !checkApproval || !orderData) return;

    try {
      setApproving(true);
      setApprovalError(null);
      const res = await orderReviewService.approveProof(token, {
        spelling_confirmed: checkSpelling,
        specs_confirmed: checkSpecs,
        proof_version_confirmed: checkApproval,
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
      proofContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
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
  const proofFiles = orderData.proof?.files || [];
  const frontFile = proofFiles.find((f) => f.label.toLowerCase() === 'front') || proofFiles[0];
  const backFile = proofFiles.find((f) => f.label.toLowerCase() === 'back') || (proofFiles.length > 1 ? proofFiles[1] : null);
  const isImageFile = (file: (typeof proofFiles)[number] | null | undefined) =>
    Boolean(file?.url && !file.mime_type?.includes('pdf') && !file.url.toLowerCase().endsWith('.pdf'));
  const isPreviewImageUrl = (url?: string | null) => Boolean(url && !/\.pdf(?:$|[?#])/i.test(url));
  const proofThumbnailUrl = isPreviewImageUrl(orderData.proof.thumbnail_url)
    ? orderData.proof.thumbnail_url
    : null;
  const rawFrontUrl = isImageFile(frontFile)
    ? frontFile?.url
    : (proofThumbnailUrl || templatePreviewUrl);
  const frontMockupUrl = rawFrontUrl ? formatImageUrl(rawFrontUrl) : null;
  const rawBackUrl = isImageFile(backFile) ? backFile?.url : null;
  const backMockupUrl = rawBackUrl ? formatImageUrl(rawBackUrl) : null;
  const flatTemplatePreviewUrl = templatePreviewUrl || proofThumbnailUrl;
  const savedDocumentSettings = orderData.proof.document_settings || {};
  const savedDimensions = orderData.proof.dimensions || {};
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

  return (
    <div className="min-h-screen bg-[#FDFBF9] text-slate-800 flex flex-col font-sans">
      <style jsx global>{`
        .bpoint-field-wrapper {
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          min-height: 44px;
          display: flex;
          align-items: center;
          transition: all 0.2s ease-in-out;
        }
        .bpoint-field-wrapper.is-focused {
          border-color: #e11d48 !important;
          box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.15) !important;
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
          min-height: 24px;
        }
      `}</style>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Title Bar & Progress Stepper */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {currentStep === 'review'
                ? 'Your artwork is ready to review'
                : currentStep === 'payment'
                ? 'Proof approved — Complete payment'
                : 'Order confirmed & in production'}
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Order {orderData.order_number} • {primaryItem?.product_name || 'Print Products'} • {orderData.proof.version_label}
            </p>
          </div>

          {/* Stepper matching screenshot: 1 Review artwork -> 2 Payment -> 3 Production */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-medium text-slate-400 self-start md:self-auto bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-xs">
            {/* Step 1 */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  currentStep === 'review'
                    ? 'bg-[#E11D48] text-white shadow-xs'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {currentStep !== 'review' ? <Check className="w-3.5 h-3.5" /> : '1'}
              </span>
              <span
                className={`font-semibold ${
                  currentStep === 'review' ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                Review artwork
              </span>
            </div>

            <span className="w-6 h-px bg-slate-300"></span>

            {/* Step 2 */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  currentStep === 'payment'
                    ? 'bg-[#E11D48] text-white shadow-xs'
                    : currentStep === 'production'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep === 'production' ? <Check className="w-3.5 h-3.5" /> : '2'}
              </span>
              <span
                className={`font-semibold ${
                  currentStep === 'payment' ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                Payment
              </span>
            </div>

            <span className="w-6 h-px bg-slate-300"></span>

            {/* Step 3 */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  currentStep === 'production'
                    ? 'bg-[#E11D48] text-white shadow-xs'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </span>
              <span
                className={`font-semibold ${
                  currentStep === 'production' ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                Production
              </span>
            </div>
          </div>
        </div>

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

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Proof Viewer & Approval/Change Request Forms (approx 7.5 cols) */}
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
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            proofView === '3d'
                              ? 'bg-[#E11D48] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          3D Mockup
                        </button>
                        <button
                          type="button"
                          onClick={() => setProofView('flat')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            proofView === 'flat'
                              ? 'bg-[#E11D48] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Flat view
                        </button>
                      </div>

                      {proofView === 'flat' && backMockupUrl && (
                        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            onClick={() => setActiveSide('front')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                              activeSide === 'front'
                                ? 'bg-[#E11D48] text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Front
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveSide('back')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                              activeSide === 'back'
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

                  {/* Viewport: 3D Scene or Flat Artwork */}
                  {proofView === '3d' ? (
                    frontMockupUrl ? (
                      <div className="h-[460px] sm:h-[540px] w-full overflow-hidden bg-slate-950">
                        <Artwork3DViewer
                          previewUrl={frontMockupUrl}
                          backPreviewUrl={backMockupUrl}
                          documentSettings={mockupDocumentSettings}
                          dimensions={mockupDimensions}
                          autoRotateInitially={true}
                        />
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
                    <div className="bg-[#EBEBEB] min-h-[420px] sm:min-h-[500px] p-6 sm:p-10 flex items-center justify-center overflow-auto relative">
                      <div
                        className="transition-transform duration-200 shadow-2xl rounded-2xl overflow-hidden bg-white max-w-full"
                        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
                      >
                        {(activeSide === 'front' ? frontMockupUrl : backMockupUrl) ? (
                          <img
                            src={activeSide === 'front' ? frontMockupUrl! : backMockupUrl!}
                            alt={`${activeSide === 'front' ? 'Front' : 'Back'} Flat Proof`}
                            className="max-h-[460px] max-w-full object-contain block mx-auto select-none"
                          />
                        ) : (
                          <div className="w-[500px] h-[300px] flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8">
                            <Package className="w-12 h-12 mb-2 stroke-1" />
                            <p className="text-sm font-semibold">Flat artwork preview not available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Active File Details Footer */}
                  {((proofView === 'flat' && activeSide === 'back') ? (backFile || frontFile) : frontFile) && (
                    <div className="px-6 py-3 bg-white border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                      <span className="font-medium text-slate-700">
                        {((proofView === 'flat' && activeSide === 'back') ? (backFile || frontFile) : frontFile)?.label}: {((proofView === 'flat' && activeSide === 'back') ? (backFile || frontFile) : frontFile)?.file_name}
                      </span>
                      {((proofView === 'flat' && activeSide === 'back') ? (backFile || frontFile) : frontFile)?.file_size_bytes && (
                        <span>{(((proofView === 'flat' && activeSide === 'back') ? (backFile || frontFile) : frontFile)!.file_size_bytes! / (1024 * 1024)).toFixed(2)} MB</span>
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
                          checked={checkSpelling}
                          onChange={(e) => setCheckSpelling(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-[#E11D48] focus:ring-[#E11D48] w-4 h-4"
                        />
                        <span className="leading-tight group-hover:text-slate-900">
                          Spelling, contact details and all pages checked
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 select-none group">
                        <input
                          type="checkbox"
                          checked={checkSpecs}
                          onChange={(e) => setCheckSpecs(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-[#E11D48] focus:ring-[#E11D48] w-4 h-4"
                        />
                        <span className="leading-tight group-hover:text-slate-900">
                          Size, quantity, stock and finish confirmed
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 select-none group">
                        <input
                          type="checkbox"
                          checked={checkApproval}
                          onChange={(e) => setCheckApproval(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-[#E11D48] focus:ring-[#E11D48] w-4 h-4"
                        />
                        <span className="leading-tight group-hover:text-slate-900">
                          I approve {orderData.proof.version_label} for printing
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

            {/* STEP 2: PAYMENT CONTENT */}
            {currentStep === 'payment' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-pink-50 text-[#E11D48] flex items-center justify-center">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">BPOINT Secure Payment</h2>
                      <p className="text-xs text-slate-500">256-bit SSL encrypted card payment</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
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

                {gatewayStatus === 'ready' && (
                  <form onSubmit={handlePaymentSubmit} className="space-y-4 max-w-lg">
                    {paymentError && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>{paymentError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Cardholder Name
                      </label>
                      <div id="bpoint-card-name" className="bpoint-field-wrapper" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Card Number
                      </label>
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
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          CVN
                        </label>
                        <div id="bpoint-cvn" className="bpoint-field-wrapper" />
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={submittingPayment || !iframeLoaded}
                        className="w-full py-3.5 px-4 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {submittingPayment ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        <span>
                          Pay ${orderData.totals.total_inc_gst.toFixed(2)} AUD Securely
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* STEP 3: PRODUCTION CONTENT */}
            {currentStep === 'production' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-sm text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Order In Production!
                  </h2>
                  <p className="text-slate-600 text-sm mt-1 max-w-md mx-auto">
                    Your proof has been approved and payment has been verified. Your job has been scheduled for printing.
                  </p>
                </div>

                {paymentReceipt && (
                  <div className="inline-block bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3 text-xs text-slate-600">
                    BPOINT Payment Receipt: <strong className="text-slate-900">{paymentReceipt}</strong>
                  </div>
                )}

                <div className="max-w-md mx-auto bg-slate-50 rounded-2xl p-6 text-left space-y-4">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Production Timeline
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center gap-3 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-semibold">Proof V{orderData.proof.current_version} Approved</span>
                    </div>
                    <div className="flex items-center gap-3 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-semibold">Payment Confirmed (${orderData.totals.total_inc_gst.toFixed(2)} AUD)</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#E11D48] font-bold">
                      <span className="w-4 h-4 rounded-full border-2 border-[#E11D48] flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48]"></span>
                      </span>
                      <span>Printing & Finishing</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span className="w-4 h-4 rounded-full border-2 border-slate-300"></span>
                      <span>Quality Inspection & Dispatch</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Order Summary & Version History (approx 4.5 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Order Summary Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-slate-900">Order summary</h2>

              {/* Items preview */}
              <div className="space-y-4">
                {orderData.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 pb-4 border-b border-slate-100">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0">
                      {orderData.proof.thumbnail_url ? (
                        <img
                          src={orderData.proof.thumbnail_url}
                          alt="Thumbnail"
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
              <div className="space-y-2.5 text-xs">
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
              {currentStep === 'review' && (
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleApproveProof}
                    disabled={
                      !checkSpelling ||
                      !checkSpecs ||
                      !checkApproval ||
                      approving ||
                      orderData.status === 'changes_requested'
                    }
                    className="w-full py-3.5 px-4 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-sm rounded-2xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {approving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    <span>Approve &amp; continue to payment</span>
                  </button>

                  <p className="text-[11px] text-center text-slate-400">
                    Complete all 3 checks to continue.
                  </p>
                </div>
              )}

              {/* Call to Action for Payment step */}
              {currentStep === 'payment' && (
                <div className="space-y-2 pt-2">
                  <div className="p-3 bg-pink-50 border border-pink-200 rounded-xl text-xs text-[#E11D48] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
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

            {/* Version History Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Version history</h2>

              <div className="space-y-3">
                {orderData.proof.versions?.map((ver) => (
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

            {/* Delivery Summary Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Truck className="w-3.5 h-3.5 text-slate-600" />
                <span>Delivery Address</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {orderData.delivery_summary.full_address || 'Standard Delivery'}
              </p>
            </div>
          </div>
        </div>
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
