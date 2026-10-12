'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  MessageSquare,
  MapPin,
  FileEdit,
  CreditCard,
  FileText,
  Users,
  ChevronDown,
  ChevronUp,
  Shield,
  Upload,
  Check,
  Plus,
} from 'lucide-react';
import { customerService } from '@/services/admin/customerService';

export interface CustomerFormData {
  id?: string | number;
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  customer_display_name: string;
  company_name: string;
  email: string;
  phone: string;
  cc: string;
  bcc: string;
  mobile_number: string;
  fax: string;
  other: string;
  website: string;
  is_sub_customer: boolean;
  marketing_opt_in: boolean;
  billing_address: {
    street1: string;
    street2: string;
    street3?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  same_as_billing: boolean;
  shipping_address: {
    street1: string;
    street2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  notes: string;
  primary_payment_method: string;
  terms: string;
  delivery_options: string;
  language: string;
}

const INITIAL_CUSTOMER: CustomerFormData = {
  title: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: '',
  customer_display_name: '',
  company_name: '',
  email: '',
  phone: '',
  cc: '',
  bcc: '',
  mobile_number: '',
  fax: '',
  other: '',
  website: '',
  is_sub_customer: false,
  marketing_opt_in: false,
  billing_address: {
    street1: '',
    street2: '',
    street3: '',
    city: '',
    state: 'NSW',
    postcode: '',
    country: 'Australia',
  },
  same_as_billing: true,
  shipping_address: {
    street1: '',
    street2: '',
    city: '',
    state: 'NSW',
    postcode: '',
    country: 'Australia',
  },
  notes: '',
  primary_payment_method: '',
  terms: 'Due on receipt',
  delivery_options: 'Email with PDF',
  language: 'English',
};

interface CustomerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerSaved: (customer: any) => void;
  initialCustomer?: any;
}

export const CustomerDrawer: React.FC<CustomerDrawerProps> = ({
  isOpen,
  onClose,
  onCustomerSaved,
  initialCustomer,
}) => {
  const [formData, setFormData] = useState<CustomerFormData>(INITIAL_CUSTOMER);
  const [showAddress3, setShowAddress3] = useState(false);
  const [showAddressPreview, setShowAddressPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Section collapsible states
  const [openSections, setOpenSections] = useState({
    nameAndContact: true,
    communication: true,
    addresses: true,
    notesAndAttachments: true,
    payments: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (initialCustomer) {
      const bAddr = initialCustomer.billing_address || (Array.isArray(initialCustomer.addresses) ? initialCustomer.addresses.find((a: any) => a.type === 'billing') : null);
      const sAddr = initialCustomer.shipping_address || (Array.isArray(initialCustomer.addresses) ? initialCustomer.addresses.find((a: any) => a.type === 'shipping') : null);

      setFormData({
        ...INITIAL_CUSTOMER,
        ...initialCustomer,
        customer_display_name: initialCustomer.customer_display_name || initialCustomer.name || '',
        billing_address: {
          ...INITIAL_CUSTOMER.billing_address,
          ...(bAddr || {}),
          street1: bAddr?.street1 || bAddr?.address_line_1 || '',
          street2: bAddr?.street2 || bAddr?.address_line_2 || '',
          city: bAddr?.city || bAddr?.suburb || '',
          state: bAddr?.state || 'NSW',
          postcode: bAddr?.postcode || '',
          country: bAddr?.country || 'Australia',
        },
        shipping_address: {
          ...INITIAL_CUSTOMER.shipping_address,
          ...(sAddr || {}),
          street1: sAddr?.street1 || sAddr?.address_line_1 || '',
          street2: sAddr?.street2 || sAddr?.address_line_2 || '',
          city: sAddr?.city || sAddr?.suburb || '',
          state: sAddr?.state || 'NSW',
          postcode: sAddr?.postcode || '',
          country: sAddr?.country || 'Australia',
        },
      });
    } else {
      setFormData(INITIAL_CUSTOMER);
    }
  }, [initialCustomer, isOpen]);

  // Auto-generate Customer display name suggestions if user hasn't explicitly customized
  const handleNameOrCompanyChange = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      const fullName = [updated.first_name, updated.middle_name, updated.last_name]
        .filter(Boolean)
        .join(' ');
      
      // If customer_display_name was empty or previously matching fullName/company, update it
      if (!prev.customer_display_name || prev.customer_display_name === prev.company_name || prev.customer_display_name === [prev.first_name, prev.middle_name, prev.last_name].filter(Boolean).join(' ')) {
        updated.customer_display_name = fullName || updated.company_name || '';
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!formData.customer_display_name.trim() && !formData.first_name.trim() && !formData.company_name.trim()) {
      setError('Please provide a Customer display name or Company name.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: formData.customer_display_name.trim(),
        customer_display_name: formData.customer_display_name.trim(),
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim(),
        last_name: formData.last_name.trim(),
        title: formData.title.trim(),
        suffix: formData.suffix.trim(),
        company_name: formData.company_name.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || formData.mobile_number.trim() || null,
        mobile_number: formData.mobile_number.trim() || null,
        fax: formData.fax.trim() || null,
        other: formData.other.trim() || null,
        website: formData.website.trim() || null,
        cc: formData.cc.trim() || null,
        bcc: formData.bcc.trim() || null,
        is_sub_customer: formData.is_sub_customer,
        billing_address: {
          street1: formData.billing_address.street1,
          street2: [formData.billing_address.street2, formData.billing_address.street3].filter(Boolean).join(', '),
          city: formData.billing_address.city,
          state: formData.billing_address.state,
          postcode: formData.billing_address.postcode,
          country: formData.billing_address.country,
        },
        shipping_address: formData.same_as_billing
          ? {
              street1: formData.billing_address.street1,
              street2: [formData.billing_address.street2, formData.billing_address.street3].filter(Boolean).join(', '),
              city: formData.billing_address.city,
              state: formData.billing_address.state,
              postcode: formData.billing_address.postcode,
              country: formData.billing_address.country,
            }
          : {
              street1: formData.shipping_address.street1,
              street2: formData.shipping_address.street2,
              city: formData.shipping_address.city,
              state: formData.shipping_address.state,
              postcode: formData.shipping_address.postcode,
              country: formData.shipping_address.country,
            },
        notes: formData.notes,
        primary_payment_method: formData.primary_payment_method,
        terms: formData.terms,
      };

      let result;
      if (formData.id) {
        result = await customerService.updateCustomer(formData.id, payload);
      } else {
        result = await customerService.createCustomer(payload);
      }

      if (result.success && result.data) {
        onCustomerSaved(result.data);
        onClose();
      } else {
        setError(result.message || 'Failed to save customer');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Error saving customer');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden border-l border-gray-200">
        {/* ─── Top Drawer Header ────────────────────────────────────────── */}
        <div className="px-6 py-3.5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Customer</h2>
          
          <div className="flex items-center gap-1.5 text-gray-400">
            <button
              type="button"
              onClick={() => toggleSection('nameAndContact')}
              className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
              title="Name and contact"
            >
              <User className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleSection('communication')}
              className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
              title="Communication permissions"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleSection('addresses')}
              className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
              title="Addresses"
            >
              <MapPin className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleSection('notesAndAttachments')}
              className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
              title="Notes and attachments"
            >
              <FileEdit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleSection('payments')}
              className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
              title="Payments"
            >
              <CreditCard className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-md transition text-gray-500"
              title="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Scrollable Body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-xs text-gray-800">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* ─── 1. Name and Contact ──────────────────────────────────── */}
          <div className="border-b border-gray-200 pb-5">
            <button
              type="button"
              onClick={() => toggleSection('nameAndContact')}
              className="w-full flex items-center justify-between text-left font-bold text-gray-900 pb-3"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Name and contact</span>
              </div>
              {openSections.nameAndContact ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {openSections.nameAndContact && (
              <div className="space-y-3.5 pt-1">
                {/* 5-item row: Title, First, Middle, Last, Suffix */}
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Title</label>
                    <input
                      type="text"
                      placeholder=""
                      value={formData.title}
                      onChange={(e) => handleNameOrCompanyChange('title', e.target.value)}
                      className="w-full h-8 px-2 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">First name</label>
                    <input
                      type="text"
                      placeholder=""
                      value={formData.first_name}
                      onChange={(e) => handleNameOrCompanyChange('first_name', e.target.value)}
                      className="w-full h-8 px-2 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Middle name</label>
                    <input
                      type="text"
                      placeholder=""
                      value={formData.middle_name}
                      onChange={(e) => handleNameOrCompanyChange('middle_name', e.target.value)}
                      className="w-full h-8 px-2 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Last name</label>
                    <input
                      type="text"
                      placeholder=""
                      value={formData.last_name}
                      onChange={(e) => handleNameOrCompanyChange('last_name', e.target.value)}
                      className="w-full h-8 px-2 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Suffix</label>
                    <input
                      type="text"
                      placeholder=""
                      value={formData.suffix}
                      onChange={(e) => handleNameOrCompanyChange('suffix', e.target.value)}
                      className="w-full h-8 px-2 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                </div>

                {/* Customer display name & Company name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-700 font-semibold mb-1">
                      Customer display name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customer_display_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, customer_display_name: e.target.value }))}
                      placeholder="e.g. John Doe / Acme Corp"
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Company name</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => handleNameOrCompanyChange('company_name', e.target.value)}
                      placeholder=""
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                </div>

                {/* Email & Phone number */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder=""
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Phone number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder=""
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                </div>

                {/* Cc & Bcc */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Cc</label>
                    <input
                      type="text"
                      value={formData.cc}
                      onChange={(e) => setFormData((prev) => ({ ...prev, cc: e.target.value }))}
                      placeholder=""
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Bcc</label>
                    <input
                      type="text"
                      value={formData.bcc}
                      onChange={(e) => setFormData((prev) => ({ ...prev, bcc: e.target.value }))}
                      placeholder=""
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                </div>

                {/* Mobile number & Fax */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Mobile number</label>
                    <input
                      type="text"
                      value={formData.mobile_number}
                      onChange={(e) => setFormData((prev) => ({ ...prev, mobile_number: e.target.value }))}
                      placeholder=""
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Fax</label>
                    <input
                      type="text"
                      value={formData.fax}
                      onChange={(e) => setFormData((prev) => ({ ...prev, fax: e.target.value }))}
                      placeholder=""
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                </div>

                {/* Other & Website */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Other</label>
                    <input
                      type="text"
                      value={formData.other}
                      onChange={(e) => setFormData((prev) => ({ ...prev, other: e.target.value }))}
                      placeholder=""
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Website</label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                      placeholder="https://"
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                  </div>
                </div>

                {/* Sub-customer checkbox */}
                <div className="pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.is_sub_customer}
                      onChange={(e) => setFormData((prev) => ({ ...prev, is_sub_customer: e.target.checked }))}
                      className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-gray-300"
                    />
                    <span>Is a sub-customer</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ─── 2. Communication Permissions ───────────────────────── */}
          <div className="border-b border-gray-200 pb-5">
            <button
              type="button"
              onClick={() => toggleSection('communication')}
              className="w-full flex items-center justify-between text-left font-bold text-gray-900 pb-3"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Communication permissions</span>
              </div>
              {openSections.communication ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {openSections.communication && (
              <div className="pt-2 text-center py-4 px-3 bg-gray-50/50 rounded-lg border border-gray-100 space-y-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-500">
                  <Shield className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-gray-800 text-xs">
                  Enter an email to record customer consent.
                </h4>
                <p className="text-[11px] text-gray-500 max-w-sm mx-auto leading-relaxed">
                  If the customer has opted in to receive email marketing communications, acknowledge it here once you've added an email.
                </p>
                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-gray-700 text-xs">
                    <input
                      type="checkbox"
                      checked={formData.marketing_opt_in}
                      onChange={(e) => setFormData((prev) => ({ ...prev, marketing_opt_in: e.target.checked }))}
                      className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-gray-300"
                    />
                    <span>Customer has consented to marketing emails</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ─── 3. Addresses ────────────────────────────────────────── */}
          <div className="border-b border-gray-200 pb-5">
            <button
              type="button"
              onClick={() => toggleSection('addresses')}
              className="w-full flex items-center justify-between text-left font-bold text-gray-900 pb-3"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Addresses</span>
              </div>
              {openSections.addresses ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {openSections.addresses && (
              <div className="space-y-4 pt-1">
                <div>
                  <h4 className="font-semibold text-gray-800 text-xs mb-2.5">Billing address</h4>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">Street address 1</label>
                        <input
                          type="text"
                          value={formData.billing_address.street1}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              billing_address: { ...prev.billing_address, street1: e.target.value },
                            }))
                          }
                          className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">Street address 2</label>
                        <input
                          type="text"
                          value={formData.billing_address.street2}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              billing_address: { ...prev.billing_address, street2: e.target.value },
                            }))
                          }
                          className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                        />
                      </div>
                    </div>

                    {!showAddress3 ? (
                      <button
                        type="button"
                        onClick={() => setShowAddress3(true)}
                        className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 font-medium"
                      >
                        <ChevronDown className="w-3 h-3" />
                        <span>Add lines</span>
                      </button>
                    ) : (
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">Street address 3</label>
                        <input
                          type="text"
                          value={formData.billing_address.street3 || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              billing_address: { ...prev.billing_address, street3: e.target.value },
                            }))
                          }
                          className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">City / Suburb</label>
                        <input
                          type="text"
                          value={formData.billing_address.city}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              billing_address: { ...prev.billing_address, city: e.target.value },
                            }))
                          }
                          className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">State</label>
                        <select
                          value={formData.billing_address.state}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              billing_address: { ...prev.billing_address, state: e.target.value },
                            }))
                          }
                          className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
                        >
                          <option value="NSW">NSW</option>
                          <option value="VIC">VIC</option>
                          <option value="QLD">QLD</option>
                          <option value="WA">WA</option>
                          <option value="SA">SA</option>
                          <option value="TAS">TAS</option>
                          <option value="ACT">ACT</option>
                          <option value="NT">NT</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">Postcode</label>
                        <input
                          type="text"
                          value={formData.billing_address.postcode}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              billing_address: { ...prev.billing_address, postcode: e.target.value },
                            }))
                          }
                          className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">Country</label>
                        <input
                          type="text"
                          value={formData.billing_address.country}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              billing_address: { ...prev.billing_address, country: e.target.value },
                            }))
                          }
                          className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setShowAddressPreview(!showAddressPreview)}
                        className="text-[11px] text-sky-700 hover:text-sky-900 font-medium"
                      >
                        Preview address
                      </button>
                      {showAddressPreview && (
                        <div className="mt-2 p-2.5 rounded bg-gray-50 border border-gray-200 text-gray-600 text-[11px]">
                          <p>{formData.billing_address.street1 || 'No street specified'}</p>
                          {formData.billing_address.street2 && <p>{formData.billing_address.street2}</p>}
                          {formData.billing_address.street3 && <p>{formData.billing_address.street3}</p>}
                          <p>
                            {formData.billing_address.city} {formData.billing_address.state}{' '}
                            {formData.billing_address.postcode}
                          </p>
                          <p>{formData.billing_address.country}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <h4 className="font-semibold text-gray-800 text-xs mb-2">Shipping address</h4>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-gray-700 text-xs">
                    <input
                      type="checkbox"
                      checked={formData.same_as_billing}
                      onChange={(e) => setFormData((prev) => ({ ...prev, same_as_billing: e.target.checked }))}
                      className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-gray-300"
                    />
                    <span className="font-medium">Same as billing address</span>
                  </label>

                  {!formData.same_as_billing && (
                    <div className="space-y-3 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Street address 1</label>
                          <input
                            type="text"
                            value={formData.shipping_address.street1}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                shipping_address: { ...prev.shipping_address, street1: e.target.value },
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Street address 2</label>
                          <input
                            type="text"
                            value={formData.shipping_address.street2}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                shipping_address: { ...prev.shipping_address, street2: e.target.value },
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">City / Suburb</label>
                          <input
                            type="text"
                            value={formData.shipping_address.city}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                shipping_address: { ...prev.shipping_address, city: e.target.value },
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">State</label>
                          <select
                            value={formData.shipping_address.state}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                shipping_address: { ...prev.shipping_address, state: e.target.value },
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
                          >
                            <option value="NSW">NSW</option>
                            <option value="VIC">VIC</option>
                            <option value="QLD">QLD</option>
                            <option value="WA">WA</option>
                            <option value="SA">SA</option>
                            <option value="TAS">TAS</option>
                            <option value="ACT">ACT</option>
                            <option value="NT">NT</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Postcode</label>
                          <input
                            type="text"
                            value={formData.shipping_address.postcode}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                shipping_address: { ...prev.shipping_address, postcode: e.target.value },
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Country</label>
                          <input
                            type="text"
                            value={formData.shipping_address.country}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                shipping_address: { ...prev.shipping_address, country: e.target.value },
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─── 4. Notes and Attachments ───────────────────────────── */}
          <div className="border-b border-gray-200 pb-5">
            <button
              type="button"
              onClick={() => toggleSection('notesAndAttachments')}
              className="w-full flex items-center justify-between text-left font-bold text-gray-900 pb-3"
            >
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Notes and attachments</span>
              </div>
              {openSections.notesAndAttachments ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {openSections.notesAndAttachments && (
              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder=""
                    className="w-full p-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-600 mb-1">Attachments</label>
                  <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50/50 transition cursor-pointer">
                    <button
                      type="button"
                      className="text-xs text-sky-700 font-semibold hover:underline block mx-auto"
                    >
                      Add attachment
                    </button>
                    <span className="text-[11px] text-gray-400 block mt-1">
                      Max file size: 20 MB
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── 5. Payments ─────────────────────────────────────────── */}
          <div className="pb-6">
            <button
              type="button"
              onClick={() => toggleSection('payments')}
              className="w-full flex items-center justify-between text-left font-bold text-gray-900 pb-3"
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Payments</span>
              </div>
              {openSections.payments ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {openSections.payments && (
              <div className="space-y-3.5 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Primary payment method</label>
                    <select
                      value={formData.primary_payment_method}
                      onChange={(e) => setFormData((prev) => ({ ...prev, primary_payment_method: e.target.value }))}
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
                    >
                      <option value="">Select a primary payment method</option>
                      <option value="bank_transfer">Direct Deposit / Bank Transfer</option>
                      <option value="credit_card">Credit Card (Stripe)</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="direct_debit">Direct Debit</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Terms</label>
                    <select
                      value={formData.terms}
                      onChange={(e) => setFormData((prev) => ({ ...prev, terms: e.target.value }))}
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
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
                    <label className="block text-[11px] text-gray-600 mb-1">Sales form delivery options</label>
                    <select
                      value={formData.delivery_options}
                      onChange={(e) => setFormData((prev) => ({ ...prev, delivery_options: e.target.value }))}
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
                    >
                      <option value="Email with PDF">Email with PDF</option>
                      <option value="Print later">Print later</option>
                      <option value="Send later">Send later</option>
                      <option value="None">None</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Language to use when you send invoices</label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData((prev) => ({ ...prev, language: e.target.value }))}
                      className="w-full h-8 px-2.5 rounded border border-gray-300 focus:outline-hidden focus:border-emerald-600 text-xs bg-white"
                    >
                      <option value="English">English</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Sticky Bottom Action Footer ──────────────────────────────── */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 rounded-full bg-[#0d5c3a] hover:bg-[#09472c] text-white text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
