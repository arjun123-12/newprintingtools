'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/services/api/client';
import {
  manualOrderService,
  ManualOrderItemPayload,
  CalculatedTotals,
} from '@/services/admin/manualOrderService';
import {
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
  Send,
  Save,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Check,
  ChevronDown,
  Layers,
  FileCheck,
} from 'lucide-react';

interface CustomerOption {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
}

interface ProductCatalogOption {
  id: string;
  name: string;
  slug: string;
  base_price: string;
}

export default function CreateManualOrderPage() {
  const router = useRouter();

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('Studio Coffee Pty Ltd');
  const [customerEmail, setCustomerEmail] = useState('hello@studiocoffee.com.au');
  const [customerPhone, setCustomerPhone] = useState('0412 345 678');
  const [companyName, setCompanyName] = useState('Studio Coffee Pty Ltd');
  const [deliveryMethod, setDeliveryMethod] = useState('Standard delivery (Free)');
  const [deliveryAddress, setDeliveryAddress] = useState('12 Harper Lane, Richmond VIC 3121, Australia');

  // Notes
  const [internalNotes, setInternalNotes] = useState(
    'Repeat customer. Please check brand colours are consistent with last order (MO-001542).'
  );
  const [customerNotes, setCustomerNotes] = useState(
    'Please check all details carefully. Let us know if you\'d like any changes.'
  );

  // Products List
  const [items, setItems] = useState<ManualOrderItemPayload[]>([
    {
      product_name: 'Business cards',
      specifications: '90 × 55 mm, 350gsm Matte',
      quantity: 1000,
      price: 100.0,
      unit_price_ex_gst: 0.1,
    },
  ]);

  // Proof files state
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofPreviews, setProofPreviews] = useState<Array<{ name: string; size: string; label: string }>>([
    { name: 'STUDIO_COFFEE_BC_front.pdf', size: '2.4 MB', label: 'Front' },
    { name: 'STUDIO_COFFEE_BC_back.pdf', size: '2.3 MB', label: 'Back' },
  ]);
  const [proofVersion, setProofVersion] = useState('V1');

  // Server Calculated Totals
  const [totals, setTotals] = useState<CalculatedTotals>({
    items: [],
    subtotal_ex_gst: 100.0,
    shipping_fee_inc_gst: 0.0,
    gst_amount: 10.0,
    discount_amount: 0.0,
    total_inc_gst: 110.0,
    currency: 'AUD',
  });

  // Autocomplete data
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogOption[]>([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // Status & notifications
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load customer directory & product catalog
  useEffect(() => {
    async function loadDirectory() {
      try {
        const custRes = await apiClient.get('/admin/customers');
        if (custRes.data?.data) {
          setCustomers(custRes.data.data.data || custRes.data.data || []);
        }
      } catch (e) {
        // Fallback
      }

      try {
        const prodRes = await apiClient.get('/products');
        if (prodRes.data?.data) {
          setCatalogProducts(prodRes.data.data.data || prodRes.data.data || []);
        }
      } catch (e) {
        // Fallback
      }
    }
    loadDirectory();
  }, []);

  // Recalculate totals on server whenever items or delivery method change
  useEffect(() => {
    async function fetchServerCalculations() {
      if (items.length === 0) return;
      try {
        const res = await manualOrderService.calculateTotals({
          items,
          delivery_method: deliveryMethod,
        });
        if (res.success && res.data) {
          setTotals(res.data);
        }
      } catch (e) {
        // Keep current totals
      }
    }
    fetchServerCalculations();
  }, [items, deliveryMethod]);

  // Handle selecting an existing customer
  const handleSelectCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setSelectedCustomerId(null);
      return;
    }
    const customer = customers.find((c) => String(c.id) === val);
    if (customer) {
      setSelectedCustomerId(customer.id);
      setCustomerName(customer.name);
      setCustomerEmail(customer.email);
      if (customer.phone) setCustomerPhone(customer.phone);
      if (customer.company_name) setCompanyName(customer.company_name);
    }
  };

  // Add Item to table
  const handleAddItem = (newProd: ManualOrderItemPayload) => {
    setItems((prev) => [...prev, newProd]);
    setShowAddProductModal(false);
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('An order must contain at least one product.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Proof file upload handling
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    setProofFiles((prev) => [...prev, ...files]);
    const previews = files.map((f, i) => ({
      name: f.name,
      size: (f.size / (1024 * 1024)).toFixed(1) + ' MB',
      label: (f.name.toLowerCase().includes('back') || i === 1) ? 'Back' : 'Front',
    }));
    setProofPreviews(previews);
  };

  // Save manual order draft
  const handleSaveDraft = async () => {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        company_name: companyName,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress,
        customer_notes: customerNotes,
        internal_notes: internalNotes,
        items,
      };

      const res = await manualOrderService.createOrder(payload);
      if (res.success && res.data?.id) {
        const orderId = res.data.id;
        // Upload proof files if selected
        if (proofFiles.length > 0) {
          try {
            await manualOrderService.uploadProof(orderId, proofFiles);
          } catch (uploadErr) {
            console.error('Proof upload note:', uploadErr);
          }
        }
        setSuccessMsg(`Draft order ${res.data.order_number} created successfully.`);
        setTimeout(() => {
          router.push(`/admin/orders/${orderId}`);
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save manual order draft.');
    } finally {
      setSaving(false);
    }
  };

  // Send for approval
  const handleSendForApproval = async () => {
    setError(null);
    setSending(true);
    try {
      const payload = {
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        company_name: companyName,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress,
        customer_notes: customerNotes,
        internal_notes: internalNotes,
        items,
      };

      const createRes = await manualOrderService.createOrder(payload);
      if (createRes.success && createRes.data?.id) {
        const orderId = createRes.data.id;
        // Upload files
        if (proofFiles.length > 0) {
          await manualOrderService.uploadProof(orderId, proofFiles);
        }
        // Send approval
        const sendRes = await manualOrderService.sendForApproval(orderId);
        setSuccessMsg(`Order ${createRes.data.order_number} sent for customer approval!`);
        setTimeout(() => {
          router.push(`/admin/orders/${orderId}`);
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send order for approval.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto">
      {/* Top Breadcrumb & Workflow Notice */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="text-[11px] font-semibold text-pink-500 uppercase tracking-widest">
              01 / Staff — Create & Send
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Create, upload artwork, and send to your customer for approval.
            </p>
          </div>
        </div>
      </div>

      {/* Main Title & Stepper */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">Create manual order</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            Draft
          </span>
        </div>

        {/* 3-Step Wizard Progress */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-[11px]">
              1
            </span>
            <span className="text-white font-medium">Order details</span>
          </div>
          <div className="w-8 h-[1px] bg-slate-700" />
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-[11px]">
              2
            </span>
            <span>Artwork</span>
          </div>
          <div className="w-8 h-[1px] bg-slate-700" />
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-[11px]">
              3
            </span>
            <span>Review & send</span>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Order Details, Products, Artwork, Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Details Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Customer details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Customer</label>
                <div className="relative">
                  <select
                    value={selectedCustomerId || ''}
                    onChange={handleSelectCustomer}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs appearance-none focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="">Studio Coffee Pty Ltd (Select existing...)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company_name ? `(${c.company_name})` : ''} - {c.email}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Customer email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Delivery method</label>
                <div className="relative">
                  <select
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs appearance-none focus:outline-none focus:border-sky-500"
                  >
                    <option value="Standard delivery (Free)">Standard delivery (Free)</option>
                    <option value="Express delivery">Express delivery (+$15.00)</option>
                    <option value="Store pickup (Free)">Store pickup (Free)</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Delivery address</label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Products Table Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Products</h2>
              <button
                type="button"
                onClick={() => setShowAddProductModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add product</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="pb-2.5 font-medium">Product</th>
                    <th className="pb-2.5 font-medium">Specifications</th>
                    <th className="pb-2.5 font-medium">Qty</th>
                    <th className="pb-2.5 font-medium">Price</th>
                    <th className="pb-2.5 font-medium">Total</th>
                    <th className="pb-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/20">
                      <td className="py-3 font-medium text-slate-200 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs">
                          <Layers className="w-4 h-4 text-pink-400" />
                        </div>
                        <span>{item.product_name}</span>
                      </td>
                      <td className="py-3 text-slate-400 max-w-xs">{item.specifications}</td>
                      <td className="py-3 text-slate-200 font-mono">{item.quantity}</td>
                      <td className="py-3 text-slate-200 font-mono">
                        ${Number(item.price ?? 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-white font-semibold font-mono">
                        ${Number(item.price ?? 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Artwork Proof Upload Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Artwork</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-medium">Proof version</span>
                  <select
                    value={proofVersion}
                    onChange={(e) => setProofVersion(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 font-mono"
                  >
                    <option value="V1">V1</option>
                    <option value="V2">V2</option>
                    <option value="V3">V3</option>
                  </select>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Ready for review
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-pink-500/50 bg-slate-900/50 rounded-xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[140px]"
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.ai,.eps,.png,.jpg,.jpeg"
                />
                <Upload className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-xs text-slate-300 font-medium">
                  Drag and drop your artwork files here
                </p>
                <p className="text-[11px] text-pink-400 hover:underline mt-0.5">or browse files</p>
                <span className="text-[10px] text-slate-500 mt-2">
                  PDF, AI, EPS, PNG or JPG (max 50MB)
                </span>
              </div>

              {/* Uploaded Proof Cards (Front & Back) */}
              {proofPreviews.map((file, i) => (
                <div
                  key={i}
                  className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex flex-col justify-between"
                >
                  <div className="w-full h-20 bg-slate-950 rounded-lg flex items-center justify-center border border-slate-800 relative overflow-hidden group">
                    <div className="text-center">
                      <p className="text-[10px] font-mono tracking-widest text-pink-400 font-bold uppercase">
                        STUDIO COFFEE
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {file.label === 'Front' ? 'Good Coffee Brighter Days' : 'Coffee People Places'}
                      </p>
                    </div>
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-medium bg-slate-900/80 text-slate-300 rounded border border-slate-700">
                      {file.label}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="text-slate-200 font-medium truncate text-[11px]">{file.name}</p>
                      <p className="text-[10px] text-slate-500">{file.size}</p>
                    </div>
                    <FileCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes Section: Internal notes & Customer notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Internal notes{' '}
                <span className="text-slate-500 font-normal">(not visible to customer)</span>
              </label>
              <textarea
                rows={3}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notes for prepress/dispatch team..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Customer notes{' '}
                <span className="text-slate-500 font-normal">(visible to customer)</span>
              </label>
              <textarea
                rows={3}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Instructions or notes for customer review..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Right 1 Column: Order Summary, Activity, Action Buttons */}
        <div className="space-y-6">
          {/* Order Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Order summary</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                Draft
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="text-slate-200 font-mono">
                  ${totals.subtotal_ex_gst.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST (10%)</span>
                <span className="text-slate-200 font-mono">
                  ${totals.gst_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping</span>
                <span className="text-slate-200 font-mono">
                  ${totals.shipping_fee_inc_gst.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-sm font-bold text-white">
                <span>Total (AUD)</span>
                <span className="text-base font-mono text-emerald-400">
                  ${totals.total_inc_gst.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Timeline Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Activity
            </h3>

            <div className="space-y-4 text-xs pt-1">
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-pink-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">Draft created</p>
                  <p className="text-[11px] text-slate-500">Just now by Sarah Chen</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Artwork uploaded</p>
                  <p className="text-[11px] text-slate-500">
                    {proofPreviews.length > 0 ? 'Ready' : 'Pending'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Customer notified</p>
                  <p className="text-[11px] text-slate-500">Pending</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Customer approval</p>
                  <p className="text-[11px] text-slate-500">Pending</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Payment received</p>
                  <p className="text-[11px] text-slate-500">Pending</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Production</p>
                  <p className="text-[11px] text-slate-500">Pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSendForApproval}
              disabled={sending || saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-medium text-sm rounded-xl shadow-md shadow-pink-600/20 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Sending...' : 'Send for approval'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || sending}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs rounded-xl transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving draft...' : 'Save draft'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white">Add Product</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select from Catalog</label>
                <select
                  onChange={(e) => {
                    const prod = catalogProducts.find((p) => p.id === e.target.value);
                    if (prod) {
                      handleAddItem({
                        product_id: prod.id,
                        product_name: prod.name,
                        specifications: 'Custom Specifications',
                        quantity: 1000,
                        price: parseFloat(prod.base_price) || 100.0,
                      });
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs"
                >
                  <option value="">Select a catalog product...</option>
                  {catalogProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.base_price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <p className="text-slate-400 font-medium mb-2">Or Custom Product</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Product Name (e.g. A3 Flyers)"
                    id="custom_name"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Specifications (e.g. 150gsm Gloss)"
                    id="custom_specs"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Qty (e.g. 500)"
                      id="custom_qty"
                      defaultValue={500}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Price ($AUD)"
                      id="custom_price"
                      defaultValue={120}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = (document.getElementById('custom_name') as HTMLInputElement)?.value || 'Custom Print';
                  const specs = (document.getElementById('custom_specs') as HTMLInputElement)?.value || 'Standard';
                  const qty = parseInt((document.getElementById('custom_qty') as HTMLInputElement)?.value || '500');
                  const price = parseFloat((document.getElementById('custom_price') as HTMLInputElement)?.value || '120');
                  handleAddItem({
                    product_name: name,
                    specifications: specs,
                    quantity: qty,
                    price,
                  });
                }}
                className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
