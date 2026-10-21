'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  HelpCircle,
  MessageSquare,
  History,
  FileText,
  Printer,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Eye,
  GripVertical,
  Paperclip,
  CreditCard,
  Building,
  User,
  Edit2,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';
import { invoiceService, TaxInvoiceOrder, StoreTaxInfo } from '@/services/admin/invoiceService';
import { customerService, CustomerItem } from '@/services/admin/customerService';
import { CustomerDrawer } from './CustomerDrawer';

export interface InvoiceLineItem {
  id: string;
  service_date: string;
  product_id?: string | null;
  product_name: string;
  product_sku?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  tax_rate: number; // 10.0 for 10% GST, 0.0 for GST Free
}

interface InvoiceEditorProps {
  invoiceId?: string; // If editing existing invoice
  initialData?: TaxInvoiceOrder | null;
}

const DEFAULT_NOTE_TO_CUSTOMER =
  'We appreciate your business. Below are the bank details for payment. Feel free to contact us via email or message in case of any queries.';

export const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ invoiceId, initialData }) => {
  const router = useRouter();

  // Loading & submission state
  const [loading, setLoading] = useState<boolean>(Boolean(invoiceId && !initialData));
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available Data lists
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Customer Drawer Slide-over
  const [isCustomerDrawerOpen, setIsCustomerDrawerOpen] = useState(false);

  // Selected Customer details
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  // Header Invoice Fields
  const [invoiceNumber, setInvoiceNumber] = useState<string>('1684');
  const [terms, setTerms] = useState<string>('Due on receipt');
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [poReference, setPoReference] = useState<string>('');
  const [taxMode, setTaxMode] = useState<'exclusive' | 'inclusive' | 'out_of_scope'>('exclusive');

  // Line items
  const [lines, setLines] = useState<InvoiceLineItem[]>([
    {
      id: '1',
      service_date: new Date().toISOString().slice(0, 10),
      product_id: null,
      product_name: '',
      product_sku: '',
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
      tax_rate: 10.0,
    },
  ]);

  // Bottom Left fields
  const [noteToCustomer, setNoteToCustomer] = useState<string>(DEFAULT_NOTE_TO_CUSTOMER);
  const [memoOnStatement, setMemoOnStatement] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [notesAndAttachmentsOpen, setNotesAndAttachmentsOpen] = useState(false);
  const [paymentsSectionOpen, setPaymentsSectionOpen] = useState(false);

  // Bottom Right totals fields
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);

  // Print/Preview Modal
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  // 1. Fetch Customers & Products on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          customerService.getCustomers(),
          apiClient.get('/admin/products'),
        ]);

        if (custRes.success && Array.isArray(custRes.data)) {
          setCustomers(custRes.data);
        }

        const prods = prodRes.data?.data;
        if (Array.isArray(prods)) {
          setProducts(prods);
        }
      } catch (err) {
        console.error('Failed to load customers or products:', err);
      }
    };

    fetchData();
  }, []);

  // 2. Fetch existing Invoice data if editing
  useEffect(() => {
    if (initialData) {
      populateFromOrder(initialData);
      setLoading(false);
      return;
    }

    if (invoiceId) {
      setLoading(true);
      invoiceService
        .getInvoiceDetail(invoiceId)
        .then((res) => {
          if (res.success && res.data) {
            populateFromOrder(res.data);
          }
        })
        .catch((err) => {
          setErrorMessage(err?.response?.data?.message || 'Failed to load invoice details');
        })
        .finally(() => setLoading(false));
    }
  }, [invoiceId, initialData]);

  const populateFromOrder = (order: TaxInvoiceOrder) => {
    if (order.invoice?.invoice_number) {
      setInvoiceNumber(order.invoice.invoice_number);
    } else {
      setInvoiceNumber(order.order_number);
    }

    if (order.user) {
      setSelectedCustomerId(String(order.user.id));
      setSelectedCustomer(order.user as any);
    }

    if (order.invoice?.issued_at) {
      setInvoiceDate(order.invoice.issued_at.slice(0, 10));
    }
    if (order.invoice?.due_at) {
      setDueDate(order.invoice.due_at.slice(0, 10));
    }

    if (order.customer_notes) {
      setNoteToCustomer(order.customer_notes);
    }

    // Parse admin notes metadata
    if (order.admin_notes) {
      try {
        const meta = typeof order.admin_notes === 'string' ? JSON.parse(order.admin_notes) : order.admin_notes;
        if (meta.terms) setTerms(meta.terms);
        if (meta.po_reference) setPoReference(meta.po_reference);
        if (meta.tax_mode) setTaxMode(meta.tax_mode);
        if (meta.memo_on_statement) setMemoOnStatement(meta.memo_on_statement);
        if (meta.primary_payment_method) setPaymentMethod(meta.primary_payment_method);
        if (meta.discount_type) setDiscountType(meta.discount_type);
        if (meta.discount_value !== undefined) setDiscountValue(Number(meta.discount_value));
      } catch {
        // Ignored
      }
    }

    if (order.discount_amount) {
      setDiscountValue(Number(order.discount_amount));
      setDiscountType('fixed');
    }
    if (order.shipping_fee_inc_gst) {
      setShippingFee(Number(order.shipping_fee_inc_gst));
    }

    if (order.items && order.items.length > 0) {
      setLines(
        order.items.map((item, idx) => ({
          id: item.id || String(idx + 1),
          service_date: item.created_at
            ? item.created_at.slice(0, 10)
            : order.created_at
              ? order.created_at.slice(0, 10)
              : new Date().toISOString().slice(0, 10),
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku || '',
          description: (item.options_snapshot as any)?.description || item.product_name || '',
          quantity: item.quantity,
          rate: Number(item.unit_price_ex_gst || item.unit_price_inc_gst || 0),
          amount: Number(item.unit_price_ex_gst || 0) * item.quantity,
          tax_rate: (item.options_snapshot as any)?.tax_rate ?? 10.0,
        }))
      );
    }
  };

  // 3. Auto-calculate Due Date based on Terms & Invoice Date
  useEffect(() => {
    try {
      const invD = new Date(invoiceDate);
      if (isNaN(invD.getTime())) return;

      let days = 0;
      if (terms === 'Net 15') days = 15;
      else if (terms === 'Net 30') days = 30;
      else if (terms === 'Net 60') days = 60;
      else days = 0; // Due on receipt

      invD.setDate(invD.getDate() + days);
      setDueDate(invD.toISOString().slice(0, 10));
    } catch {
      // Ignored
    }
  }, [terms, invoiceDate]);

  // 4. Handle Customer Selection
  const handleSelectCustomer = (cId: string) => {
    setSelectedCustomerId(cId);
    if (!cId) {
      setSelectedCustomer(null);
      return;
    }
    const found = customers.find((c) => String(c.id) === String(cId));
    if (found) {
      setSelectedCustomer(found);
    }
  };

  // 5. Line Items Operations
  const handleLineChange = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        const updated = { ...line, [field]: value };

        // If product selected, auto-populate description and rate
        if (field === 'product_id' && value) {
          const chosenProd = products.find((p) => String(p.id) === String(value));
          if (chosenProd) {
            updated.product_name = chosenProd.name;
            updated.product_sku = chosenProd.sku || '';
            updated.description = chosenProd.short_description || chosenProd.name;
            const chosenRate = Number(
              chosenProd.sale_price && Number(chosenProd.sale_price) > 0
                ? chosenProd.sale_price
                : chosenProd.base_price > 0
                  ? chosenProd.base_price
                  : chosenProd.starting_price || 0
            );
            if (chosenRate > 0) {
              updated.rate = chosenRate;
            }
          }
        }

        // Recalculate line amount
        const qty = Number(updated.quantity) || 0;
        const rate = Number(updated.rate) || 0;
        updated.amount = Math.round(qty * rate * 100) / 100;

        return updated;
      })
    );
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        service_date: invoiceDate,
        product_id: null,
        product_name: '',
        product_sku: '',
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
        tax_rate: 10.0,
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) {
      // Keep at least one empty line
      setLines([
        {
          id: String(Date.now()),
          service_date: invoiceDate,
          product_id: null,
          product_name: '',
          product_sku: '',
          description: '',
          quantity: 1,
          rate: 0,
          amount: 0,
          tax_rate: 10.0,
        },
      ]);
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleClearAllLines = () => {
    setLines([
      {
        id: String(Date.now()),
        service_date: invoiceDate,
        product_id: null,
        product_name: '',
        product_sku: '',
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
        tax_rate: 10.0,
      },
    ]);
  };

  // 6. Real-time Totals Calculations
  const calculations = useMemo(() => {
    let rawSubtotal = 0;
    let totalTax = 0;

    lines.forEach((line) => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const lineTotal = qty * rate;
      const taxRate = Number(line.tax_rate) || 0;

      if (taxMode === 'exclusive') {
        const lineTax = taxRate > 0 ? lineTotal * (taxRate / 100) : 0;
        rawSubtotal += lineTotal;
        totalTax += lineTax;
      } else if (taxMode === 'inclusive') {
        const lineTax = taxRate > 0 ? lineTotal - lineTotal / (1 + taxRate / 100) : 0;
        rawSubtotal += lineTotal - lineTax;
        totalTax += lineTax;
      } else {
        // out_of_scope
        rawSubtotal += lineTotal;
        totalTax += 0;
      }
    });

    // Discount
    let discountAmount = 0;
    if (discountValue > 0) {
      if (discountType === 'percentage') {
        discountAmount = rawSubtotal * (discountValue / 100);
      } else {
        discountAmount = Math.min(discountValue, rawSubtotal);
      }
    }

    const discountedSubtotal = Math.max(0, rawSubtotal - discountAmount);

    // Adjust tax if discount applies
    let finalGst = totalTax;
    if (rawSubtotal > 0 && discountAmount > 0) {
      finalGst = totalTax * (discountedSubtotal / rawSubtotal);
    }

    const grandTotal = discountedSubtotal + finalGst + Number(shippingFee || 0);

    return {
      rawSubtotal,
      discountAmount,
      discountedSubtotal,
      finalGst,
      shippingFee: Number(shippingFee || 0),
      grandTotal,
    };
  }, [lines, taxMode, discountType, discountValue, shippingFee]);

  // 7. Save and Submit Handler
  const handleSaveInvoice = async (markPaid: boolean = false) => {
    // Basic validation
    if (!selectedCustomerId && !selectedCustomer?.name) {
      setErrorMessage('Please select or create a customer.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const validLines = lines.filter((l) => l.product_name.trim() || l.amount > 0 || l.product_id);
    if (validLines.length === 0) {
      setErrorMessage('Please add at least one product or service line item.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      customer_id: selectedCustomerId || null,
      customer_name: selectedCustomer?.name || 'Customer',
      customer_email: selectedCustomer?.email || null,
      billing_address: selectedCustomer?.addresses?.find((a: any) => a.type === 'billing') || {
        name: selectedCustomer?.name,
        address_line_1: '',
        suburb: 'Sydney',
        state: 'NSW',
        postcode: '2000',
        country: 'AU',
      },
      invoice_number: invoiceNumber.trim(),
      terms,
      issued_at: invoiceDate,
      due_at: dueDate,
      po_reference: poReference.trim() || null,
      tax_mode: taxMode,
      items: validLines.map((l) => ({
        product_id: l.product_id || null,
        product_name: l.product_name.trim() || 'Custom Print Service',
        product_sku: l.product_sku || '',
        description: l.description.trim() || '',
        service_date: l.service_date || invoiceDate,
        quantity: l.quantity,
        rate: l.rate,
        amount: l.amount,
        tax_rate: l.tax_rate,
      })),
      discount_type: discountType,
      discount_value: discountValue,
      shipping_fee: shippingFee,
      customer_notes: noteToCustomer.trim(),
      memo_on_statement: memoOnStatement.trim() || null,
      payment_method: paymentMethod,
      status: markPaid ? 'paid' : 'issued',
    };

    try {
      let res;
      if (invoiceId) {
        res = await invoiceService.updateInvoice(invoiceId, payload);
      } else {
        res = await invoiceService.createInvoice(payload);
      }

      if (res.success) {
        setSuccessMessage('Invoice saved successfully!');
        setTimeout(() => {
          router.push('/admin/invoices');
        }, 1200);
      } else {
        setErrorMessage(res.message || 'Failed to save invoice.');
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Error occurred while saving invoice.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
        <p className="text-sm font-semibold">Loading invoice details…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-gray-900 pb-28 font-sans antialiased">
      {/* ─── Top QuickBooks-Style Header ────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-6 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/invoices"
            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition"
            title="Back to All Invoices"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">
              {invoiceId ? 'Edit Invoice' : 'Invoice'}
            </span>
            <span className="text-xs text-gray-400 font-mono">#{invoiceNumber}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Manage</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Take tour</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition flex items-center gap-1"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Feedback</span>
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <Link
            href="/admin/invoices"
            className="text-xs text-sky-700 hover:underline font-medium"
          >
            Old layout
          </Link>
        </div>
      </div>

      {/* ─── Main Content Canvas ────────────────────────────────────────────── */}
      <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Alerts */}
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ─── Top Customer & Invoice Metadata Card ───────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left side: Add / Select Customer */}
            <div className="md:col-span-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">
                  Customer <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsCustomerDrawerOpen(true);
                      } else {
                        handleSelectCustomer(e.target.value);
                      }
                    }}
                    className="flex-1 h-9 px-3 rounded-lg border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white text-gray-900"
                  >
                    <option value="">Add Customer / Select...</option>
                    <option value="__add_new__" className="font-bold text-emerald-700">
                      + Add new customer
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company_name ? `(${c.company_name})` : ''} - {c.email}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsCustomerDrawerOpen(true)}
                    className="h-9 px-3 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition shrink-0"
                    title="Add new customer"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    New
                  </button>
                </div>
              </div>

              {/* Customer Details Preview Lines */}
              {selectedCustomer ? (
                <div className="p-3 rounded-lg bg-gray-50/70 border border-gray-100 text-xs text-gray-600 space-y-1 relative group">
                  <button
                    type="button"
                    onClick={() => setIsCustomerDrawerOpen(true)}
                    className="absolute top-2.5 right-2.5 p-1 text-gray-400 hover:text-gray-700 transition"
                    title="Edit customer details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <p className="font-bold text-gray-900">{selectedCustomer.name}</p>
                  {selectedCustomer.company_name && (
                    <p className="text-[11px] text-gray-500 font-medium">
                      {selectedCustomer.company_name}
                    </p>
                  )}
                  {selectedCustomer.email && (
                    <p className="text-[11px] text-gray-500">{selectedCustomer.email}</p>
                  )}
                  {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 && (
                    <p className="text-[11px] text-gray-500">
                      {selectedCustomer.addresses[0].address_line_1},{' '}
                      {selectedCustomer.addresses[0].suburb}{' '}
                      {selectedCustomer.addresses[0].state}{' '}
                      {selectedCustomer.addresses[0].postcode}
                    </p>
                  )}
                </div>
              ) : (
                <div className="h-16 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-[11px] text-gray-400">
                  Select a customer to view billing address and contact details
                </div>
              )}
            </div>

            {/* Spacer */}
            <div className="hidden md:block md:col-span-2" />

            {/* Right side: Invoice Header metadata inputs */}
            <div className="md:col-span-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Invoice no.
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Terms
                  </label>
                  <select
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
                  >
                    <option value="Due on receipt">Due on receipt</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Invoice date
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Secondary metadata row: PO Reference & Tax mode */}
          <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-xs w-full">
              <label className="block text-[11px] text-gray-600 mb-1">PO Reference no.</label>
              <input
                type="text"
                placeholder=""
                value={poReference}
                onChange={(e) => setPoReference(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
              />
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-[11px] text-gray-600 mb-1">
                Invoice amounts are
              </label>
              <select
                value={taxMode}
                onChange={(e) => setTaxMode(e.target.value as any)}
                className="h-8 px-3 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white text-gray-900"
              >
                <option value="exclusive">Exclusive of Tax</option>
                <option value="inclusive">Inclusive of Tax</option>
                <option value="out_of_scope">Out of scope of Tax</option>
              </select>
            </div>
          </div>
        </div>

        {/* ─── Product or service Line Items Table Card ───────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
          <div className="px-6 py-3.5 border-b border-gray-200 bg-gray-50/60 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 tracking-tight uppercase">
              Product or service
            </h3>
            <span className="text-[11px] text-gray-500">
              {lines.length} {lines.length === 1 ? 'line' : 'lines'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/40 text-[11px] font-semibold text-gray-600">
                  <th className="py-2.5 px-3 w-8 text-center text-gray-400">#</th>
                  <th className="py-2.5 px-3 w-32">Service Date</th>
                  <th className="py-2.5 px-3 w-64">Product/service</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 w-20 text-right">Qty</th>
                  <th className="py-2.5 px-3 w-28 text-right">Rate</th>
                  <th className="py-2.5 px-3 w-28 text-right">Amount</th>
                  <th className="py-2.5 px-3 w-28">GST</th>
                  <th className="py-2.5 px-2 w-8 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-gray-50/70 group transition-colors">
                    {/* Index / Grip */}
                    <td className="py-2 px-3 text-center text-gray-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Service Date */}
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        value={line.service_date}
                        onChange={(e) => handleLineChange(line.id, 'service_date', e.target.value)}
                        className="w-full h-8 px-2 rounded border border-gray-200 focus:border-emerald-600 focus:outline-hidden text-xs bg-white"
                      />
                    </td>

                    {/* Product / Service Selector */}
                    <td className="py-2 px-3">
                      <div className="space-y-1">
                        <select
                          value={line.product_id || ''}
                          onChange={(e) => handleLineChange(line.id, 'product_id', e.target.value || null)}
                          className="w-full h-8 px-2 rounded border border-gray-200 focus:border-emerald-600 focus:outline-hidden text-xs bg-white text-gray-900"
                        >
                          <option value="">Select product or service...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                        {!line.product_id && (
                          <input
                            type="text"
                            placeholder="Custom service name"
                            value={line.product_name}
                            onChange={(e) => handleLineChange(line.id, 'product_name', e.target.value)}
                            className="w-full h-7 px-2 rounded border border-gray-100 focus:border-emerald-600 focus:outline-hidden text-[11px]"
                          />
                        )}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-2 px-3">
                      <textarea
                        rows={2}
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => handleLineChange(line.id, 'description', e.target.value)}
                        className="w-full p-1.5 rounded border border-gray-200 focus:border-emerald-600 focus:outline-hidden text-xs resize-y"
                      />
                    </td>

                    {/* Qty */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(line.id, 'quantity', Number(e.target.value))}
                        className="w-full h-8 px-2 rounded border border-gray-200 focus:border-emerald-600 focus:outline-hidden text-xs text-right"
                      />
                    </td>

                    {/* Rate */}
                    <td className="py-2 px-3 text-right">
                      <div className="relative flex items-center">
                        <span className="absolute left-2 text-gray-400">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.rate}
                          onChange={(e) => handleLineChange(line.id, 'rate', Number(e.target.value))}
                          className="w-full h-8 pl-5 pr-2 rounded border border-gray-200 focus:border-emerald-600 focus:outline-hidden text-xs text-right font-medium"
                        />
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-2 px-3 text-right font-semibold text-gray-900">
                      ${Number(line.amount || 0).toFixed(2)}
                    </td>

                    {/* GST */}
                    <td className="py-2 px-3">
                      <select
                        value={line.tax_rate}
                        onChange={(e) => handleLineChange(line.id, 'tax_rate', Number(e.target.value))}
                        className="w-full h-8 px-2 rounded border border-gray-200 focus:border-emerald-600 focus:outline-hidden text-xs bg-white"
                      >
                        <option value={10.0}>10.0% GST</option>
                        <option value={0.0}>GST Free (0%)</option>
                      </select>
                    </td>

                    {/* Delete line action */}
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Delete line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer Buttons */}
          <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAddLine}
              className="px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white text-xs font-semibold text-gray-700 transition flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-700" />
              <span>Add product or service</span>
            </button>

            <button
              type="button"
              onClick={handleClearAllLines}
              className="text-xs text-gray-500 hover:text-gray-800 transition font-medium"
            >
              Clear all lines
            </button>
          </div>
        </div>

        {/* ─── Bottom Sections: Notes, Payment Options & Financial Totals ─────── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Customer Payment Options & Notes */}
          <div className="md:col-span-7 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-4">
              <div>
                <h4 className="text-xs font-bold text-gray-900 tracking-tight mb-2">
                  Customer payment options
                </h4>
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1">
                    Note to customer
                  </label>
                  <textarea
                    rows={4}
                    value={noteToCustomer}
                    onChange={(e) => setNoteToCustomer(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 mb-1">
                  Memo on statement (hidden)
                </label>
                <textarea
                  rows={2}
                  placeholder="This memo will not show up on your invoice, but will appear on the statement."
                  value={memoOnStatement}
                  onChange={(e) => setMemoOnStatement(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                />
              </div>

              {/* Notes and Attachments Collapsible */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setNotesAndAttachmentsOpen(!notesAndAttachmentsOpen)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 py-1"
                >
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                    <span>Notes and attachments</span>
                  </div>
                  {notesAndAttachmentsOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {notesAndAttachmentsOpen && (
                  <div className="pt-3 space-y-3">
                    <div className="border border-dashed border-gray-300 rounded-lg p-5 text-center hover:bg-gray-50/50 transition cursor-pointer">
                      <span className="text-xs text-sky-700 font-semibold hover:underline block mx-auto">
                        Add attachment
                      </span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        Max file size: 20 MB
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payments Collapsible */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentsSectionOpen(!paymentsSectionOpen)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 py-1"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                    <span>Payments settings</span>
                  </div>
                  {paymentsSectionOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {paymentsSectionOpen && (
                  <div className="pt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Primary payment method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full h-8 px-2 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
                      >
                        <option value="bank_transfer">Direct Deposit / Bank Transfer</option>
                        <option value="credit_card">Credit Card (Stripe)</option>
                        <option value="cash">Cash</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">Language</label>
                      <select
                        disabled
                        className="w-full h-8 px-2 rounded border border-gray-200 text-xs bg-gray-50 text-gray-500"
                      >
                        <option>English</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Financial Totals Card */}
          <div className="md:col-span-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-3.5">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">Subtotal</span>
                <span className="font-semibold text-gray-900">
                  A${calculations.rawSubtotal.toFixed(2)}
                </span>
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium">Discount</span>
                  <div className="flex rounded border border-gray-300 overflow-hidden text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`px-1.5 py-0.5 font-bold ${discountType === 'percentage'
                          ? 'bg-gray-800 text-white'
                          : 'bg-white text-gray-600'
                        }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-1.5 py-0.5 font-bold ${discountType === 'fixed'
                          ? 'bg-gray-800 text-white'
                          : 'bg-white text-gray-600'
                        }`}
                    >
                      $
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 h-7 px-2 rounded border border-gray-300 focus:outline-hidden text-right text-xs"
                  />
                  <span className="text-rose-600 font-semibold w-16 text-right">
                    -A${calculations.discountAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Shipping fee */}
              <div className="flex items-center justify-between text-xs gap-3">
                <span className="text-gray-600 font-medium">Shipping</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingFee || ''}
                    onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-20 h-7 px-2 rounded border border-gray-300 focus:outline-hidden text-right text-xs"
                  />
                  <span className="font-semibold text-gray-900 w-16 text-right">
                    A${calculations.shippingFee.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* GST (10%) */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">GST (10%)</span>
                <span className="font-semibold text-gray-900">
                  A${calculations.finalGst.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-gray-200 pt-3" />

              {/* Invoice Total */}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-gray-900">Invoice total</span>
                <span className="text-lg font-black text-gray-900 tracking-tight">
                  A${calculations.grandTotal.toFixed(2)}
                </span>
              </div>

              <div className="pt-1 text-right">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="text-[11px] text-sky-700 hover:underline font-medium inline-flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>Preview tax breakdown</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sticky Bottom Action Bar ────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3.5 z-40 flex items-center justify-between shadow-lg">
        <div>
          <Link
            href="/admin/invoices"
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-gray-500" />
            <span>Print or Preview</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveInvoice(false)}
            disabled={saving}
            className="px-5 py-2 rounded-full border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold transition shadow-2xs disabled:opacity-50"
          >
            Save and close
          </button>

          <button
            type="button"
            onClick={() => handleSaveInvoice(false)}
            disabled={saving}
            className="px-6 py-2 rounded-full bg-[#0d5c3a] hover:bg-[#09472c] text-white text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <span>Save and send</span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Customer Slide-Over Drawer ──────────────────────────────────────── */}
      <CustomerDrawer
        isOpen={isCustomerDrawerOpen}
        onClose={() => setIsCustomerDrawerOpen(false)}
        initialCustomer={selectedCustomer}
        onCustomerSaved={(newCust) => {
          setCustomers((prev) => {
            const exists = prev.some((c) => c.id === newCust.id);
            if (exists) {
              return prev.map((c) => (c.id === newCust.id ? newCust : c));
            }
            return [newCust, ...prev];
          });
          setSelectedCustomerId(String(newCust.id));
          setSelectedCustomer(newCust);
        }}
      />

      {/* ─── Printable Tax Invoice Preview Modal ─────────────────────────────── */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl text-gray-900 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">TAX INVOICE</h2>
                <p className="text-xs text-gray-500">Australian Tax Invoice • ATO Compliant</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold flex items-center gap-1 text-gray-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Store & Customer details */}
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div>
                <p className="font-bold text-gray-900">Erry Imprints Pty Ltd</p>
                <p className="text-gray-500">ABN: 12 345 678 901</p>
                <p className="text-gray-500">Info@erryimprints.com.au</p>
                <p className="text-gray-500">Sydney NSW 2000, Australia</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500">Invoice Number: <strong>{invoiceNumber}</strong></p>
                <p className="text-gray-500">Invoice Date: {invoiceDate}</p>
                <p className="text-gray-500">Due Date: {dueDate}</p>
                <p className="text-gray-500">Terms: {terms}</p>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg text-xs">
              <span className="font-semibold text-gray-700 block">Bill To:</span>
              <p className="font-bold text-gray-900">{selectedCustomer?.name || 'Walk-in Customer'}</p>
              {selectedCustomer?.email && <p className="text-gray-500">{selectedCustomer.email}</p>}
            </div>

            {/* Items */}
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b text-gray-600 font-semibold text-[11px]">
                  <th className="py-2">Item / Service</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l, i) => (
                  <tr key={l.id || i}>
                    <td className="py-2">
                      <p className="font-medium text-gray-900">{l.product_name || 'Printing Service'}</p>
                      {l.description && <p className="text-[11px] text-gray-500">{l.description}</p>}
                    </td>
                    <td className="py-2 text-right">{l.quantity}</td>
                    <td className="py-2 text-right">${Number(l.rate).toFixed(2)}</td>
                    <td className="py-2 text-right font-medium">${Number(l.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t pt-3 flex flex-col items-end text-xs space-y-1">
              <div className="flex justify-between w-48">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-medium">${calculations.rawSubtotal.toFixed(2)}</span>
              </div>
              {calculations.discountAmount > 0 && (
                <div className="flex justify-between w-48 text-rose-600">
                  <span>Discount:</span>
                  <span>-${calculations.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between w-48">
                <span className="text-gray-500">GST (10%):</span>
                <span className="font-medium">${calculations.finalGst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-48 font-bold text-sm text-gray-900 border-t pt-1">
                <span>Total Inc GST:</span>
                <span>${calculations.grandTotal.toFixed(2)} AUD</span>
              </div>
            </div>

            {noteToCustomer && (
              <div className="text-[11px] text-gray-500 bg-gray-50 p-3 rounded">
                <strong>Payment Instructions:</strong>
                <p className="mt-1">{noteToCustomer}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
