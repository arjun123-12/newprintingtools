'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Truck,
  Package,
  Palette,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight,
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Clock,
  Sparkles,
  Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useEnquiry } from '@/context/EnquiryContext';
import {
  checkoutService,
  CheckoutDataResponse,
  CheckoutAddress,
  CheckoutShippingMethod,
  CheckoutValidationResponse,
} from '@/services/checkoutService';
import { formatImageUrl } from '@/utils/imageUrl';

const AU_STATES = [
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NT', name: 'Northern Territory' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { openEnquiryModal, isAdmin } = useEnquiry();

  // Checkout Data State from Backend
  const [loading, setLoading] = useState(true);
  const [checkoutData, setCheckoutData] = useState<CheckoutDataResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form State: Customer Info
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');

  // Form State: Shipping Address
  const [shippingAddress, setShippingAddress] = useState<CheckoutAddress>({
    name: '',
    phone: '',
    company: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: 'NSW',
    postcode: '',
    country: 'AU',
  });

  // Form State: Billing Address
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingAddress, setBillingAddress] = useState<CheckoutAddress>({
    name: '',
    phone: '',
    company: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: 'NSW',
    postcode: '',
    country: 'AU',
  });

  // Form State: Shipping & Options
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<string>('auspost_standard');
  const [customerNotes, setCustomerNotes] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);

  // Validation & Submission State
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [validationSuccess, setValidationSuccess] = useState<CheckoutValidationResponse['data'] | null>(null);

  // 1. Initial Load of Authoritative Checkout Data
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await checkoutService.getCheckoutData();
        setCheckoutData(data);

        // Pre-fill user contact info
        if (data.user) {
          setCustomerName(data.user.name || '');
          setCustomerEmail(data.user.email || '');
          setCustomerPhone(data.user.phone || '');
          setCustomerCompany(data.user.company_name || '');
        }

        // Pre-fill default shipping address if exists
        const defShip = data.default_shipping_address;
        if (defShip) {
          setShippingAddress({
            name: defShip.name || data.user?.name || '',
            phone: defShip.phone || data.user?.phone || '',
            company: defShip.company || data.user?.company_name || '',
            address_line_1: defShip.address_line_1 || '',
            address_line_2: defShip.address_line_2 || '',
            city: defShip.suburb || defShip.city || '',
            state: defShip.state || 'NSW',
            postcode: defShip.postcode || '',
            country: 'AU',
          });
        } else if (data.user) {
          setShippingAddress((prev) => ({
            ...prev,
            name: data.user.name || '',
            phone: data.user.phone || '',
            company: data.user.company_name || '',
          }));
        }

        // Pre-fill default billing address if exists
        const defBill = data.default_billing_address;
        if (defBill && defBill.id !== defShip?.id) {
          setBillingSameAsShipping(false);
          setBillingAddress({
            name: defBill.name || '',
            phone: defBill.phone || '',
            company: defBill.company || '',
            address_line_1: defBill.address_line_1 || '',
            address_line_2: defBill.address_line_2 || '',
            city: defBill.suburb || defBill.city || '',
            state: defBill.state || 'NSW',
            postcode: defBill.postcode || '',
            country: 'AU',
          });
        }

        // Set default shipping method
        if (data.selected_shipping_method) {
          setSelectedShippingMethodId(data.selected_shipping_method.id);
        } else if (data.available_shipping_methods?.length > 0) {
          setSelectedShippingMethodId(data.available_shipping_methods[0].id);
        }
      } catch (err: any) {
        setFetchError(err.response?.data?.message || 'Could not load your checkout session. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [isAuthenticated, authLoading]);

  // Dynamic Shipping Rate Calculation
  const activeShippingMethod = useMemo(() => {
    const methods = checkoutData?.available_shipping_methods || [];
    return methods.find((m) => m.id === selectedShippingMethodId) || methods[0] || null;
  }, [checkoutData, selectedShippingMethodId]);

  const subtotalExGst = checkoutData?.subtotal_ex_gst || 0;
  const gstAmount = checkoutData?.gst_amount || 0;
  const shippingAmount = activeShippingMethod?.price_inc_gst || 0;
  const grandTotal = useMemo(() => {
    return Math.max(0, subtotalExGst + gstAmount + shippingAmount);
  }, [subtotalExGst, gstAmount, shippingAmount]);

  // Handle Form Submission / Backend Order Creation
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingOrder(true);
    setValidationErrors({});
    setFetchError(null);
    setOrderSuccessMessage(null);

    const payload = {
      shipping_address: {
        ...shippingAddress,
        name: shippingAddress.name.trim() || customerName.trim(),
        email: customerEmail.trim(),
        phone: shippingAddress.phone.trim() || customerPhone.trim(),
        company: shippingAddress.company?.trim() || customerCompany.trim(),
        address_line_1: shippingAddress.address_line_1.trim(),
        address_line_2: shippingAddress.address_line_2?.trim() || undefined,
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim().toUpperCase(),
        postcode: shippingAddress.postcode.trim(),
        country: 'AU',
      },
      billing_address_same_as_shipping: billingSameAsShipping,
      billing_address: billingSameAsShipping
        ? undefined
        : {
            ...billingAddress,
            name: billingAddress.name.trim(),
            phone: billingAddress.phone.trim(),
            company: billingAddress.company?.trim() || undefined,
            address_line_1: billingAddress.address_line_1.trim(),
            address_line_2: billingAddress.address_line_2?.trim() || undefined,
            city: billingAddress.city.trim(),
            state: billingAddress.state.trim().toUpperCase(),
            postcode: billingAddress.postcode.trim(),
            country: 'AU',
          },
      shipping_method_id: selectedShippingMethodId,
      customer_notes: customerNotes.trim() || undefined,
      notes: customerNotes.trim() || undefined,
      save_address: saveAddress,
    };

    try {
      const result = await checkoutService.createOrder(payload);

      // Store only the small order reference needed for the next payment step
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pending_order_id', result.data.id);
        sessionStorage.setItem('pending_order_number', result.data.order_number);
      }

      setOrderSuccessMessage('Order created successfully. Directing to payment...');

      // Navigate to payment preparation step
      const orderParam = result.data.order_number || result.data.id;
      router.push(`/checkout/payment?order=${encodeURIComponent(orderParam)}`);
    } catch (err: any) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setValidationErrors(err.response.data.errors);
      } else {
        setFetchError(err.response?.data?.message || 'Unable to create order. Please verify your details.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // ────────────────────────── RENDER STATES ──────────────────────────

  // 1. Loading State
  if (authLoading || (loading && isAuthenticated)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-sky-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Verifying secure checkout session...</p>
      </div>
    );
  }

  // 1.1 Public visitor guard: Enquiry Mode active (Only authenticated admins can access full checkout)
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Checkout Operating in Enquiry Mode
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Our storefront is operating in <strong>Customer Enquiry & Custom Quotation Mode</strong>. Direct online checkout is reserved for authorized administrators. Please submit an enquiry to receive a formal quotation and invoice.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => openEnquiryModal({ sourceUrl: '/checkout' })}
            className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl shadow-md transition"
          >
            Request a Quote / Submit Enquiry
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-sm rounded-xl transition"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Account Required for Checkout
          </h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Please sign in to access your persistent shopping cart, customized artwork files, and complete your order.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/login?redirect=/checkout"
            className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl shadow-md transition"
          >
            Sign In to Checkout
          </Link>
          <Link
            href="/register?redirect=/checkout"
            className="w-full sm:w-auto px-6 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-sm rounded-xl transition"
          >
            Create an Account
          </Link>
        </div>
        <p className="text-xs text-slate-400 pt-4">
          Return to{' '}
          <Link href="/cart" className="text-sky-600 font-bold hover:underline">
            Shopping Cart
          </Link>
        </p>
      </div>
    );
  }

  // 3. Empty Cart State
  if (checkoutData?.is_empty || !checkoutData?.items || checkoutData.items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
          <Package className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Your Cart is Empty</h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            You don&apos;t have any products in your cart. Add products or design templates before proceeding to checkout.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl shadow-md transition"
          >
            <span>Explore Print Products</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const items = checkoutData.items;

  // 4. Main Active Checkout Layout
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <Link href="/cart" className="hover:text-slate-600 transition flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Cart</span>
            </Link>
            <span>/</span>
            <span className="text-slate-700">Checkout</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
            <Lock className="w-7 h-7 text-sky-600" />
            <span>Secure Checkout</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Logged in as <span className="font-bold text-slate-700">{user?.email}</span>. All payments processed in AUD inc GST.
          </p>
        </div>

        {/* Security Indicator */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>SSL 256-Bit Encrypted</span>
        </div>
      </div>

      {/* Global Error Banner if any */}
      {fetchError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Checkout Notice</p>
            <p>{fetchError}</p>
          </div>
        </div>
      )}

      {/* Validation Success Banner */}
      {validationSuccess && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-emerald-950">
                Checkout Details Successfully Validated!
              </h3>
              <p className="text-sm text-emerald-800 leading-relaxed">
                Your order total is verified at{' '}
                <strong className="font-bold text-emerald-950">${validationSuccess.total.toFixed(2)} AUD</strong> (including{' '}
                ${validationSuccess.gst_amount.toFixed(2)} GST and ${validationSuccess.shipping.toFixed(2)} shipping via{' '}
                {validationSuccess.shipping_method.name}).
              </p>
              <div className="mt-3 p-3.5 bg-white/80 rounded-2xl border border-emerald-200/60 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">Ready for Payment Stage</p>
                <p>
                  Shipping Address: {validationSuccess.shipping_address.address_line_1},{' '}
                  {validationSuccess.shipping_address.city} {validationSuccess.shipping_address.state}{' '}
                  {validationSuccess.shipping_address.postcode}.
                </p>
                <p className="text-emerald-700 font-semibold pt-1">
                  ✓ Order verification complete. Payment gateway integration will connect in the next phase.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {orderSuccessMessage && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold text-sm text-emerald-900">{orderSuccessMessage}</span>
        </div>
      )}

      {/* Two-Column Grid: Form Left, Order Summary Right */}
      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Customer Information */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 leading-tight">Customer Information</h2>
                <p className="text-xs text-slate-400">Order updates and tax invoice will be sent here</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (!shippingAddress.name) {
                        setShippingAddress((prev) => ({ ...prev, name: e.target.value }));
                      }
                    }}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="sarah@example.com.au"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (AU) *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      if (!shippingAddress.phone) {
                        setShippingAddress((prev) => ({ ...prev, phone: e.target.value }));
                      }
                    }}
                    placeholder="0400 000 000"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Name (Optional)</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={customerCompany}
                    onChange={(e) => setCustomerCompany(e.target.value)}
                    placeholder="e.g. Apex Design Studio Pty Ltd"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Shipping Address */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 leading-tight">Shipping Address (Australia)</h2>
                <p className="text-xs text-slate-400">Physical street address for Australia Post & courier delivery</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Street Address *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={shippingAddress.address_line_1}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, address_line_1: e.target.value })}
                    placeholder="e.g. 142 Collins Street"
                    className={`w-full pl-9 pr-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      validationErrors['shipping_address.address_line_1'] ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                    }`}
                  />
                </div>
                {validationErrors['shipping_address.address_line_1'] && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">
                    {validationErrors['shipping_address.address_line_1'][0]}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Apartment, Suite, Unit (Optional)</label>
                <input
                  type="text"
                  value={shippingAddress.address_line_2 || ''}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, address_line_2: e.target.value })}
                  placeholder="e.g. Level 4, Suite 402"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Suburb / City *</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                    placeholder="Melbourne"
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      validationErrors['shipping_address.city'] ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors['shipping_address.city'] && (
                    <p className="text-[11px] text-red-600 mt-1 font-medium">
                      {validationErrors['shipping_address.city'][0]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State / Territory *</label>
                  <select
                    value={shippingAddress.state}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {AU_STATES.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Postcode (4 Digits) *</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    pattern="[0-9]{4}"
                    value={shippingAddress.postcode}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, postcode: e.target.value.replace(/\D/g, '') })}
                    placeholder="3000"
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      validationErrors['shipping_address.postcode'] ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors['shipping_address.postcode'] && (
                    <p className="text-[11px] text-red-600 mt-1 font-medium">
                      {validationErrors['shipping_address.postcode'][0]}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <span>Save this address to my account address book</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Billing Address */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight">Billing Address</h2>
                  <p className="text-xs text-slate-400">Address associated with your payment method</p>
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={billingSameAsShipping}
                  onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                />
                <span className="text-xs sm:text-sm font-semibold text-slate-800">
                  Billing address is the same as shipping address
                </span>
              </label>
            </div>

            {/* Separate Billing Address Fields */}
            {!billingSameAsShipping && (
              <div className="pt-3 border-t border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Billing Name *</label>
                    <input
                      type="text"
                      required={!billingSameAsShipping}
                      value={billingAddress.name}
                      onChange={(e) => setBillingAddress({ ...billingAddress, name: e.target.value })}
                      placeholder="Billing Contact"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Billing Phone *</label>
                    <input
                      type="tel"
                      required={!billingSameAsShipping}
                      value={billingAddress.phone}
                      onChange={(e) => setBillingAddress({ ...billingAddress, phone: e.target.value })}
                      placeholder="0400 000 000"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Street Address *</label>
                  <input
                    type="text"
                    required={!billingSameAsShipping}
                    value={billingAddress.address_line_1}
                    onChange={(e) => setBillingAddress({ ...billingAddress, address_line_1: e.target.value })}
                    placeholder="Street Address"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Suburb / City *</label>
                    <input
                      type="text"
                      required={!billingSameAsShipping}
                      value={billingAddress.city}
                      onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">State *</label>
                    <select
                      value={billingAddress.state}
                      onChange={(e) => setBillingAddress({ ...billingAddress, state: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {AU_STATES.map((st) => (
                        <option key={st.code} value={st.code}>
                          {st.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Postcode *</label>
                    <input
                      type="text"
                      required={!billingSameAsShipping}
                      maxLength={4}
                      value={billingAddress.postcode}
                      onChange={(e) => setBillingAddress({ ...billingAddress, postcode: e.target.value.replace(/\D/g, '') })}
                      placeholder="3000"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Shipping Method Selection */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 leading-tight">Delivery Method</h2>
                <p className="text-xs text-slate-400">Tracked delivery across Australia</p>
              </div>
            </div>

            <div className="space-y-3">
              {(checkoutData.available_shipping_methods || []).map((method) => {
                const isSelected = selectedShippingMethodId === method.id;
                return (
                  <label
                    key={method.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/40 ring-1 ring-sky-500 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping_method"
                        value={method.id}
                        checked={isSelected}
                        onChange={() => setSelectedShippingMethodId(method.id)}
                        className="w-4 h-4 text-sky-600 focus:ring-sky-500 border-slate-300"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{method.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{method.estimated_days}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {method.is_free ? (
                        <div>
                          <span className="text-sm font-black text-emerald-600">FREE</span>
                          <span className="text-[10px] text-slate-400 line-through block">
                            ${Number(method.original_price).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-black text-slate-900">
                          ${Number(method.price_inc_gst).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 5: Order Notes (Optional) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-black text-slate-900">Delivery Instructions / Production Notes (Optional)</h2>
            <textarea
              rows={2}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="e.g. Leave parcel at front door if unattended; urgent delivery required for event on Friday."
              className="w-full p-3 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>
        </div>

        {/* Right Sticky Column: Order Summary */}
        <div className="lg:col-span-5 sticky top-24 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900">Order Summary</h2>
              <span className="text-xs font-bold text-slate-400">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Cart Items List */}
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {items.map((item) => {
                const hasArtwork = Boolean(item.artwork_id && item.artwork);

                return (
                  <div key={item.id} className="flex gap-3 pb-3 border-b border-slate-100 last:border-b-0 last:pb-0">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200/80 shrink-0 overflow-hidden relative flex items-center justify-center">
                      {item.thumbnail_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={formatImageUrl(item.thumbnail_url)}
                          alt={item.product_name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.product_name}
                      </h4>

                      {/* Custom Artwork Badge */}
                      {hasArtwork && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200/60 text-purple-700 text-[10px] font-bold">
                          <Palette className="w-3 h-3" />
                          <span>Custom Artwork Attached</span>
                        </div>
                      )}

                      {/* Selected Options Highlights */}
                      {item.selected_options && Object.keys(item.selected_options).length > 0 && (
                        <p className="text-[11px] text-slate-500 truncate">
                          {Object.entries(item.selected_options)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' • ')}
                        </p>
                      )}

                      {/* Quantity & Price */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500 font-medium">Qty: {item.quantity.toLocaleString()}</span>
                        <span className="font-bold text-slate-900">${Number(item.total_inc_gst).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal (ex GST)</span>
                <span className="font-semibold text-slate-800">${subtotalExGst.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>GST (10% AU)</span>
                <span className="font-semibold text-slate-800">${gstAmount.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Delivery ({activeShippingMethod?.name || 'Standard'})</span>
                </span>
                <span className="font-semibold text-slate-800">
                  {activeShippingMethod?.is_free ? (
                    <span className="text-emerald-600 font-bold">FREE</span>
                  ) : (
                    `$${shippingAmount.toFixed(2)}`
                  )}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                <div>
                  <span className="text-base font-black text-slate-900 block">Total Due</span>
                  <span className="text-[11px] text-slate-400 font-medium">AUD inc. 10% GST</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900">
                    ${grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Proceed CTA */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isCreatingOrder}
                className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-sky-600/20 hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCreatingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating order...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Trust Badges */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>100% Australian Made & Reprint Guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Prepress preflight inspection included</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-sky-500 shrink-0" />
                <span>Server-verified authoritative pricing in AUD</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
