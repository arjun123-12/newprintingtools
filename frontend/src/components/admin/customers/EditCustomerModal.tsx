'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  MapPin,
  Building2,
  Mail,
  Phone,
  AlertCircle,
  Check,
  RefreshCw,
  FileEdit,
  Shield,
  Layers,
} from 'lucide-react';
import { customerService, CustomerItem } from '@/services/admin/customerService';

interface EditCustomerModalProps {
  isOpen: boolean;
  customer: CustomerItem | null;
  onClose: () => void;
  onCustomerUpdated: (customer: CustomerItem) => void;
}

export default function EditCustomerModal({
  isOpen,
  customer,
  onClose,
  onCustomerUpdated,
}: EditCustomerModalProps) {
  // Active Tab
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'role'>('profile');

  // Form Fields
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [abn, setAbn] = useState('');
  const [role, setRole] = useState('customer');

  // Billing Address
  const [billingStreet1, setBillingStreet1] = useState('');
  const [billingStreet2, setBillingStreet2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('NSW');
  const [billingPostcode, setBillingPostcode] = useState('');
  const [billingCountry, setBillingCountry] = useState('Australia');

  // Shipping Address
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shippingStreet1, setShippingStreet1] = useState('');
  const [shippingStreet2, setShippingStreet2] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('NSW');
  const [shippingPostcode, setShippingPostcode] = useState('');
  const [shippingCountry, setShippingCountry] = useState('Australia');

  // State & Loading
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load customer data when modal opens or customer changes
  useEffect(() => {
    if (customer && isOpen) {
      setName(customer.name || '');
      setCompanyName(customer.company_name || '');
      setEmail(customer.email || '');
      setPhone(customer.phone || '');
      setAbn(customer.abn || '');
      setRole(customer.role || 'customer');
      setError(null);
      setSuccessMsg(null);

      // Populate billing address
      const billing = customer.addresses?.find((a) => a.type === 'billing') || customer.addresses?.[0];
      if (billing) {
        setBillingStreet1(billing.address_line_1 || '');
        setBillingStreet2(billing.address_line_2 || '');
        setBillingCity(billing.suburb || '');
        setBillingState(billing.state || 'NSW');
        setBillingPostcode(billing.postcode || '');
        setBillingCountry(billing.country || 'Australia');
      } else {
        setBillingStreet1('');
        setBillingStreet2('');
        setBillingCity('');
        setBillingState('NSW');
        setBillingPostcode('');
        setBillingCountry('Australia');
      }

      // Populate shipping address
      const shipping = customer.addresses?.find((a) => a.type === 'shipping');
      if (shipping) {
        setSameAsBilling(false);
        setShippingStreet1(shipping.address_line_1 || '');
        setShippingStreet2(shipping.address_line_2 || '');
        setShippingCity(shipping.suburb || '');
        setShippingState(shipping.state || 'NSW');
        setShippingPostcode(shipping.postcode || '');
        setShippingCountry(shipping.country || 'Australia');
      } else {
        setSameAsBilling(true);
        setShippingStreet1('');
        setShippingStreet2('');
        setShippingCity('');
        setShippingState('NSW');
        setShippingPostcode('');
        setShippingCountry('Australia');
      }
    }
  }, [customer, isOpen]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const payload: Record<string, any> = {
        name: name.trim(),
        customer_display_name: name.trim(),
        company_name: companyName.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        abn: abn.trim() || null,
        role,
      };

      if (billingStreet1.trim()) {
        payload.billing_address = {
          street1: billingStreet1.trim(),
          street2: billingStreet2.trim() || null,
          city: billingCity.trim() || 'Sydney',
          state: billingState.trim() || 'NSW',
          postcode: billingPostcode.trim() || '2000',
          country: billingCountry.trim() || 'Australia',
        };
      }

      if (sameAsBilling && billingStreet1.trim()) {
        payload.shipping_address = {
          street1: billingStreet1.trim(),
          street2: billingStreet2.trim() || null,
          city: billingCity.trim() || 'Sydney',
          state: billingState.trim() || 'NSW',
          postcode: billingPostcode.trim() || '2000',
          country: billingCountry.trim() || 'Australia',
        };
      } else if (!sameAsBilling && shippingStreet1.trim()) {
        payload.shipping_address = {
          street1: shippingStreet1.trim(),
          street2: shippingStreet2.trim() || null,
          city: shippingCity.trim() || 'Sydney',
          state: shippingState.trim() || 'NSW',
          postcode: shippingPostcode.trim() || '2000',
          country: shippingCountry.trim() || 'Australia',
        };
      }

      const res = await customerService.updateCustomer(customer.id, payload);

      if (res && res.success) {
        setSuccessMsg('Customer profile updated successfully!');
        onCustomerUpdated(res.data);
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setError(res?.message || 'Failed to update customer profile.');
      }
    } catch (err: any) {
      console.error('Error updating customer:', err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors
            ? Object.values(err.response.data.errors).flat().join(', ')
            : err.message || 'Failed to update customer profile.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-sm">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Edit Customer Profile
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  #{customer.id}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Update customer contact information, trade ABN, role, and address book.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-6 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            General &amp; Contact
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('addresses')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'addresses'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Addresses
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('role')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'role'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Role &amp; Permissions
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: General & Contact */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Customer Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Smith"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. john@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Phone / Mobile</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0412 345 678"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Company / Business Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Studio Coffee Pty Ltd"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Australian Business Number (ABN)
                </label>
                <input
                  type="text"
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="e.g. 12 345 678 901"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enables wholesale / trade account pricing and tax exemption handling.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Addresses */}
          {activeTab === 'addresses' && (
            <div className="space-y-5">
              {/* Billing Address */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  Billing Address
                </h4>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={billingStreet1}
                    onChange={(e) => setBillingStreet1(e.target.value)}
                    placeholder="Street Address 1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                  />
                  <input
                    type="text"
                    value={billingStreet2}
                    onChange={(e) => setBillingStreet2(e.target.value)}
                    placeholder="Street Address 2 / Suite / Unit (Optional)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <input
                      type="text"
                      value={billingCity}
                      onChange={(e) => setBillingCity(e.target.value)}
                      placeholder="Suburb / City"
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                    <select
                      value={billingState}
                      onChange={(e) => setBillingState(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer transition"
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
                    <input
                      type="text"
                      value={billingPostcode}
                      onChange={(e) => setBillingPostcode(e.target.value)}
                      placeholder="Postcode"
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                    <input
                      type="text"
                      value={billingCountry}
                      onChange={(e) => setBillingCountry(e.target.value)}
                      placeholder="Country"
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address Toggle */}
              <div className="pt-2 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    Shipping Address
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) => setSameAsBilling(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Same as billing address</span>
                  </label>
                </div>

                {!sameAsBilling && (
                  <div className="space-y-2.5 pt-1">
                    <input
                      type="text"
                      value={shippingStreet1}
                      onChange={(e) => setShippingStreet1(e.target.value)}
                      placeholder="Shipping Street Address 1"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                    <input
                      type="text"
                      value={shippingStreet2}
                      onChange={(e) => setShippingStreet2(e.target.value)}
                      placeholder="Shipping Street Address 2 / Suite (Optional)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <input
                        type="text"
                        value={shippingCity}
                        onChange={(e) => setShippingCity(e.target.value)}
                        placeholder="Suburb / City"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                      <select
                        value={shippingState}
                        onChange={(e) => setShippingState(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer transition"
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
                      <input
                        type="text"
                        value={shippingPostcode}
                        onChange={(e) => setShippingPostcode(e.target.value)}
                        placeholder="Postcode"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                      <input
                        type="text"
                        value={shippingCountry}
                        onChange={(e) => setShippingCountry(e.target.value)}
                        placeholder="Country"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Role & Permissions */}
          {activeTab === 'role' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Account Access Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer transition"
                >
                  <option value="customer">Customer (Standard storefront access)</option>
                  <option value="admin">Administrator (Full admin portal permissions)</option>
                  <option value="prepress_operator">Prepress Operator (Proofing &amp; Artwork tools)</option>
                  <option value="staff">Staff Member</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Shield className="w-4 h-4 text-sky-400" />
                  Security Notice
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Changing the user role will immediately alter the customer's portal navigation and API authorization. Administrator and Prepress roles grant access to protected order management and backend operations.
                </p>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 bg-slate-900 py-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow-md transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
