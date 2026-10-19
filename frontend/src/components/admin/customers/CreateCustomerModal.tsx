'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  MessageSquare,
  MapPin,
  FileEdit,
  CreditCard,
  FileText,
  Compass,
  Users,
  ChevronUp,
  ChevronDown,
  Shield,
  Check,
  Building2,
  Mail,
  Phone,
  Globe,
  AlertCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { customerService, CustomerItem } from '@/services/admin/customerService';

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: CustomerItem) => void;
}

export default function CreateCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated,
}: CreateCustomerModalProps) {
  // Section toggle state
  const [openSections, setOpenSections] = useState<{
    contact: boolean;
    communication: boolean;
    addresses: boolean;
    notes: boolean;
  }>({
    contact: true,
    communication: true,
    addresses: true,
    notes: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Active section for top icon tabs
  const [activeTab, setActiveTab] = useState<'contact' | 'communication' | 'addresses' | 'notes'>('contact');

  // Form Fields
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayNameManuallyEdited, setDisplayNameManuallyEdited] = useState(false);
  const [showDisplayNameOptions, setShowDisplayNameOptions] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [fax, setFax] = useState('');
  const [other, setOther] = useState('');
  const [website, setWebsite] = useState('');
  const [isSubCustomer, setIsSubCustomer] = useState(false);
  const [abn, setAbn] = useState('');

  // Communication Permissions
  const [marketingConsent, setMarketingConsent] = useState(false);

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

  // Notes & Payment
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Due on receipt');
  const [role, setRole] = useState('customer');

  // Form submit status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Display Name auto suggestions
  const displayNameSuggestions = [
    [firstName, lastName].filter(Boolean).join(' '),
    [lastName, firstName].filter(Boolean).join(', '),
    companyName,
    [companyName, [firstName, lastName].filter(Boolean).join(' ')].filter(Boolean).join(' - '),
    [[firstName, lastName].filter(Boolean).join(' '), companyName ? `(${companyName})` : ''].filter(Boolean).join(' '),
  ].filter(Boolean);

  // Auto-fill Display Name if user hasn't typed custom
  useEffect(() => {
    if (!displayNameManuallyEdited) {
      const generated = [firstName, lastName].filter(Boolean).join(' ') || companyName || '';
      setDisplayName(generated);
    }
  }, [firstName, lastName, companyName, displayNameManuallyEdited]);

  // Reset form when modal is opened
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const scrollToSection = (id: string, tab: 'contact' | 'communication' | 'addresses' | 'notes') => {
    setActiveTab(tab);
    setOpenSections((prev) => ({ ...prev, [tab]: true }));
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalDisplayName = displayName.trim() || [firstName, lastName].filter(Boolean).join(' ') || companyName.trim();
    if (!finalDisplayName) {
      setError('Please provide at least a Customer Display Name, First/Last Name, or Company Name.');
      scrollToSection('section-contact', 'contact');
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid email address.');
      scrollToSection('section-contact', 'contact');
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        name: finalDisplayName,
        customer_display_name: finalDisplayName,
        first_name: firstName.trim() || null,
        middle_name: middleName.trim() || null,
        last_name: lastName.trim() || null,
        title: title.trim() || null,
        suffix: suffix.trim() || null,
        company_name: companyName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || mobileNumber.trim() || null,
        mobile_number: mobileNumber.trim() || null,
        fax: fax.trim() || null,
        other: other.trim() || null,
        website: website.trim() || null,
        cc: cc.trim() || null,
        bcc: bcc.trim() || null,
        abn: abn.trim() || null,
        is_sub_customer: isSubCustomer,
        marketing_consent: marketingConsent,
        notes: notes.trim() || null,
        terms: paymentTerms || null,
        role: role || 'customer',
      };

      // Include billing address if provided
      if (billingStreet1.trim() || billingCity.trim() || billingPostcode.trim()) {
        payload.billing_address = {
          street_address_1: billingStreet1.trim(),
          street_address_2: billingStreet2.trim() || null,
          city: billingCity.trim() || 'Sydney',
          state: billingState || 'NSW',
          postcode: billingPostcode.trim() || '2000',
          country: billingCountry || 'AU',
        };
      }

      // Include shipping address
      if (!sameAsBilling && (shippingStreet1.trim() || shippingCity.trim() || shippingPostcode.trim())) {
        payload.shipping_address = {
          street_address_1: shippingStreet1.trim(),
          street_address_2: shippingStreet2.trim() || null,
          city: shippingCity.trim() || 'Sydney',
          state: shippingState || 'NSW',
          postcode: shippingPostcode.trim() || '2000',
          country: shippingCountry || 'AU',
        };
      } else if (sameAsBilling && payload.billing_address) {
        payload.shipping_address = payload.billing_address;
      }

      const res = await customerService.createCustomer(payload);

      if (res && res.success) {
        onCustomerCreated(res.data);
        onClose();
      } else {
        setError(res?.message || 'Failed to create customer. Please check the inputs.');
      }
    } catch (err: any) {
      console.error('Customer creation failed:', err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[Object.keys(err.response?.data?.errors || {})[0]]?.[0] ||
          err.message ||
          'Failed to create customer.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl lg:max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* ─── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 sticky top-0 z-20">
          <h2 className="text-xl font-bold text-white tracking-tight">Customer</h2>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Top Toolbar Icons */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => scrollToSection('section-contact', 'contact')}
                className={`p-1.5 rounded-lg transition ${
                  activeTab === 'contact' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Name and contact"
              >
                <User className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('section-communication', 'communication')}
                className={`p-1.5 rounded-lg transition ${
                  activeTab === 'communication' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Communication permissions"
              >
                <MessageSquare className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('section-addresses', 'addresses')}
                className={`p-1.5 rounded-lg transition ${
                  activeTab === 'addresses' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Addresses"
              >
                <MapPin className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('section-notes', 'notes')}
                className={`p-1.5 rounded-lg transition ${
                  activeTab === 'notes' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Notes & Payment terms"
              >
                <FileEdit className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── Scrollable Form Content ───────────────────────────── */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6 text-xs text-slate-300">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-3 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">{error}</div>
            </div>
          )}

          {/* ═════════ SECTION 1: Name and contact ═════════════════ */}
          <div id="section-contact" className="border-b border-slate-800/80 pb-6 space-y-4">
            <button
              type="button"
              onClick={() => toggleSection('contact')}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2.5 font-bold text-sm text-white group-hover:text-sky-400 transition">
                <User className="w-4 h-4 text-sky-400" />
                <span>Name and contact</span>
              </div>
              {openSections.contact ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.contact && (
              <div className="space-y-4 pt-2">
                {/* Row 1: Title, First name, Middle name, Last name, Suffix */}
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Mr"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Middle name</label>
                    <input
                      type="text"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="Middle"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Suffix</label>
                    <input
                      type="text"
                      value={suffix}
                      onChange={(e) => setSuffix(e.target.value)}
                      placeholder="e.g. Jr"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                {/* Row 2: Customer display name * & Company name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Customer display name <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => {
                          setDisplayName(e.target.value);
                          setDisplayNameManuallyEdited(true);
                        }}
                        placeholder="e.g. John Smith or Acme Pty Ltd"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                      {displayNameSuggestions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowDisplayNameOptions(!showDisplayNameOptions)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                          title="Select display name format"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {showDisplayNameOptions && displayNameSuggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-xl overflow-hidden py-1">
                        <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800/80">
                          Suggested Formats
                        </div>
                        {Array.from(new Set(displayNameSuggestions)).map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setDisplayName(s);
                              setDisplayNameManuallyEdited(true);
                              setShowDisplayNameOptions(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Company name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company / Business Name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                {/* Row 3: Email & Phone number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="customer@example.com.au"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Phone number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 02 9123 4567"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Cc & Bcc */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Cc</label>
                    <input
                      type="text"
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="accountspayable@example.com.au"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Bcc</label>
                    <input
                      type="text"
                      value={bcc}
                      onChange={(e) => setBcc(e.target.value)}
                      placeholder="records@example.com.au"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                {/* Row 5: Mobile number & Fax */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Mobile number</label>
                    <input
                      type="text"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="e.g. 0412 345 678"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Fax</label>
                    <input
                      type="text"
                      value={fax}
                      onChange={(e) => setFax(e.target.value)}
                      placeholder="Fax number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                {/* Row 6: Other, Website, and ABN */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Other</label>
                    <input
                      type="text"
                      value={other}
                      onChange={(e) => setOther(e.target.value)}
                      placeholder="Alternative contact / note"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Website</label>
                    <div className="relative">
                      <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://example.com.au"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      ABN (Australian Business No.)
                    </label>
                    <input
                      type="text"
                      value={abn}
                      onChange={(e) => setAbn(e.target.value)}
                      placeholder="e.g. 51 824 753 556"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                {/* Checkbox: Is a sub-customer */}
                <div className="pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isSubCustomer}
                      onChange={(e) => setIsSubCustomer(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300">Is a sub-customer</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ═════════ SECTION 2: Communication permissions ═══════════ */}
          <div id="section-communication" className="border-b border-slate-800/80 pb-6 space-y-4">
            <button
              type="button"
              onClick={() => toggleSection('communication')}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2.5 font-bold text-sm text-white group-hover:text-sky-400 transition">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span>Communication permissions</span>
              </div>
              {openSections.communication ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.communication && (
              <div className="pt-2">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 text-center space-y-2">
                  <Shield className="w-7 h-7 text-sky-400 mx-auto" />
                  <h4 className="text-xs font-bold text-white">Enter an email to record customer consent.</h4>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    If the customer has opted in to receive email marketing communications, acknowledge it here once
                    you&apos;ve added an email.
                  </p>

                  <div className="pt-3 flex justify-center">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-lg hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        disabled={!email.trim()}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-0 cursor-pointer disabled:opacity-40"
                      />
                      <span className={`text-xs ${email.trim() ? 'text-slate-200' : 'text-slate-500'}`}>
                        Customer acknowledges and consents to receive marketing updates
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═════════ SECTION 3: Addresses ══════════════════════════ */}
          <div id="section-addresses" className="border-b border-slate-800/80 pb-6 space-y-4">
            <button
              type="button"
              onClick={() => toggleSection('addresses')}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2.5 font-bold text-sm text-white group-hover:text-sky-400 transition">
                <MapPin className="w-4 h-4 text-sky-400" />
                <span>Addresses</span>
              </div>
              {openSections.addresses ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.addresses && (
              <div className="space-y-5 pt-2">
                {/* Billing Address Subsection */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <span>Billing address</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Street address 1</label>
                      <input
                        type="text"
                        value={billingStreet1}
                        onChange={(e) => setBillingStreet1(e.target.value)}
                        placeholder="Street and number"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Street address 2</label>
                      <input
                        type="text"
                        value={billingStreet2}
                        onChange={(e) => setBillingStreet2(e.target.value)}
                        placeholder="Suite, unit, floor, building"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">City / Suburb</label>
                      <input
                        type="text"
                        value={billingCity}
                        onChange={(e) => setBillingCity(e.target.value)}
                        placeholder="e.g. Sydney"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">State</label>
                      <input
                        type="text"
                        list="au-states-list"
                        value={billingState}
                        onChange={(e) => setBillingState(e.target.value)}
                        placeholder="State / Province"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                      <datalist id="au-states-list">
                        <option value="NSW">New South Wales</option>
                        <option value="VIC">Victoria</option>
                        <option value="QLD">Queensland</option>
                        <option value="WA">Western Australia</option>
                        <option value="SA">South Australia</option>
                        <option value="TAS">Tasmania</option>
                        <option value="ACT">Australian Capital Territory</option>
                        <option value="NT">Northern Territory</option>
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Postcode</label>
                      <input
                        type="text"
                        value={billingPostcode}
                        onChange={(e) => setBillingPostcode(e.target.value)}
                        placeholder="e.g. 2000"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Country</label>
                      <input
                        type="text"
                        value={billingCountry}
                        onChange={(e) => setBillingCountry(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Same as Billing Toggle */}
                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) => setSameAsBilling(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-200">Shipping address same as billing address</span>
                  </label>
                </div>

                {/* Shipping Address Subsection (if different) */}
                {!sameAsBilling && (
                  <div className="space-y-3 pt-3 border-t border-slate-800/60 animate-in fade-in duration-150">
                    <div className="text-xs font-semibold text-white">Shipping address</div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Street address 1</label>
                        <input
                          type="text"
                          value={shippingStreet1}
                          onChange={(e) => setShippingStreet1(e.target.value)}
                          placeholder="Street and number"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Street address 2</label>
                        <input
                          type="text"
                          value={shippingStreet2}
                          onChange={(e) => setShippingStreet2(e.target.value)}
                          placeholder="Suite, unit, floor, building"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">City / Suburb</label>
                        <input
                          type="text"
                          value={shippingCity}
                          onChange={(e) => setShippingCity(e.target.value)}
                          placeholder="e.g. Melbourne"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">State</label>
                        <input
                          type="text"
                          list="au-states-list"
                          value={shippingState}
                          onChange={(e) => setShippingState(e.target.value)}
                          placeholder="State / Province"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Postcode</label>
                        <input
                          type="text"
                          value={shippingPostcode}
                          onChange={(e) => setShippingPostcode(e.target.value)}
                          placeholder="e.g. 3000"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Country</label>
                        <input
                          type="text"
                          value={shippingCountry}
                          onChange={(e) => setShippingCountry(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═════════ SECTION 4: Notes & Terms ══════════════════════ */}
          <div id="section-notes" className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection('notes')}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2.5 font-bold text-sm text-white group-hover:text-sky-400 transition">
                <FileEdit className="w-4 h-4 text-sky-400" />
                <span>Notes & Payment preferences</span>
              </div>
              {openSections.notes ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.notes && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Payment terms</label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer transition"
                    >
                      <option value="Due on receipt">Due on receipt</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 60">Net 60</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Account Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer transition"
                    >
                      <option value="customer">Standard Customer</option>
                      <option value="admin">Administrator</option>
                      <option value="prepress_operator">Prepress Operator</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal customer notes, delivery instructions, preferences..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ─── Sticky Footer Actions ─────────────────────────────── */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 bg-slate-900 py-2">
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
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save customer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
