'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  UploadCloud,
  ShieldCheck,
  Package,
  Layers,
  Sparkles,
  Paperclip,
} from 'lucide-react';
import { useEnquiry } from '@/context/EnquiryContext';
import { apiClient } from '@/services/api/client';

export const EnquiryModal: React.FC = () => {
  const { isOpen, closeEnquiryModal, productContext } = useEnquiry();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState<number | string>(100);
  const [size, setSize] = useState('Standard Size');
  const [gsm, setGsm] = useState('150 GSM');
  const [sides, setSides] = useState('Double-Sided');
  const [finishing, setFinishing] = useState('Standard Finish');
  const [folding, setFolding] = useState('No Folding');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(true);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [honeypot, setHoneypot] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    reference: string;
    message: string;
  } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync context when opened
  useEffect(() => {
    if (isOpen && productContext) {
      if (productContext.productName) {
        setProductName(productContext.productName);
      }
      if (productContext.quantity) {
        setQuantity(productContext.quantity);
      }
      if (productContext.specifications) {
        const specs = productContext.specifications;
        if (specs.size) setSize(specs.size);
        if (specs.gsm) setGsm(specs.gsm);
        if (specs.paper_stock) setGsm(specs.paper_stock);
        if (specs.printing_sides) setSides(specs.printing_sides);
        if (specs.finishing) setFinishing(specs.finishing);
        if (specs.folding) setFolding(specs.folding);
      }
    }
  }, [isOpen, productContext]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        closeEnquiryModal();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isSubmitting, closeEnquiryModal]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 26 * 1024 * 1024) {
        setErrorMessage('Attachment size must not exceed 25MB.');
        return;
      }
      setAttachment(file);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    // Client-side validations
    if (!name.trim()) {
      setErrorMessage('Please provide your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    if (!privacyConsent) {
      setErrorMessage('Please accept the privacy consent to submit an enquiry.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('email', email.trim().toLowerCase());
      if (phone.trim()) formData.append('phone', phone.trim());

      formData.append('product_name', productName.trim() || 'Custom Print Job');
      if (productContext?.productId) {
        formData.append('product_id', String(productContext.productId));
      }
      if (quantity) {
        formData.append('quantity', String(quantity));
      }

      // Specifications payload
      const specsObj = {
        size: size.trim(),
        gsm: gsm.trim(),
        printing_sides: sides.trim(),
        finishing: finishing.trim(),
        folding: folding.trim(),
      };
      formData.append('specifications', JSON.stringify(specsObj));

      if (deliveryLocation.trim()) {
        formData.append('delivery_location', deliveryLocation.trim());
      }
      if (additionalRequirements.trim()) {
        formData.append('additional_requirements', additionalRequirements.trim());
      }
      if (productContext?.sourceUrl) {
        formData.append('source_url', productContext.sourceUrl);
      }
      formData.append('privacy_consent', '1');

      if (attachment) {
        formData.append('attachment', attachment);
      }

      // Honeypot spam protection
      if (honeypot) {
        formData.append('hp_company_website', honeypot);
      }

      const response = await apiClient.post('/enquiries', formData);

      if (response.data?.success) {
        setSuccessData({
          reference: response.data.data.reference,
          message: response.data.message,
        });
      } else {
        throw new Error(response.data?.message || 'Could not submit enquiry.');
      }
    } catch (err: any) {
      const respMsg = err.response?.data?.message;
      const validationErrors = err.response?.data?.errors;
      if (validationErrors) {
        const firstErr = Object.values(validationErrors).flat()[0];
        setErrorMessage(String(firstErr || 'Please check your inputs and try again.'));
      } else {
        setErrorMessage(respMsg || err.message || 'Unable to submit enquiry. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessData(null);
    setErrorMessage(null);
    closeEnquiryModal();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="enquiry-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 to-sky-950 text-white flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-bold uppercase tracking-wider border border-sky-400/30">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Quote & Production Enquiry</span>
            </div>
            <h2 id="enquiry-modal-title" className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {productName ? `Enquire About ${productName}` : 'Request a Custom Printing Quote'}
            </h2>
            <p className="text-xs text-slate-300 max-w-lg">
              Submit your project specifications below. Our prepress specialists will review your requirements and provide an official quotation within 1 business day.
            </p>
          </div>

          <button
            type="button"
            onClick={closeEnquiryModal}
            disabled={isSubmitting}
            aria-label="Close enquiry modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0 ml-3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {successData ? (
            /* Success confirmation screen */
            <div className="text-center py-8 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-xl font-bold text-slate-900">Enquiry Submitted Successfully</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {successData.message}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-md mx-auto space-y-1.5 text-left">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Reference Code:</span>
                  <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded border border-sky-200">
                    {successData.reference}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Contact:</span>
                  <span className="font-semibold text-slate-800">{name} ({email})</span>
                </div>
                {productName && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Product:</span>
                    <span className="font-semibold text-slate-800">{productName} ({quantity} qty)</span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  Close & Return to Browsing
                </button>
              </div>
            </div>
          ) : (
            /* Main Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <p className="font-semibold">{errorMessage}</p>
                </div>
              )}

              {/* Honeypot field (hidden from view) */}
              <div className="hidden" aria-hidden="true">
                <input
                  type="text"
                  name="hp_company_website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {/* 1. Contact Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  <span>1. Your Contact Details</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. jane@company.com.au"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0412 345 678"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Delivery Suburb / Postcode <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="e.g. Sydney, NSW 2000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Product & Specifications */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-sky-600" />
                  <span>2. Product & Quantity</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Product of Interest
                    </label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Premium Business Cards / Flyers / Custom Sign"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 500"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Print Options */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Paper Stock / GSM</label>
                    <select
                      value={gsm}
                      onChange={(e) => setGsm(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="128 GSM">128 GSM Art Paper</option>
                      <option value="150 GSM">150 GSM Gloss</option>
                      <option value="170 GSM">170 GSM Silk</option>
                      <option value="250 GSM">250 GSM Premium</option>
                      <option value="350 GSM">350 GSM Heavy Board</option>
                      <option value="450 GSM">450 GSM Luxury</option>
                      <option value="Custom Stock">Custom / Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Printing Sides</label>
                    <select
                      value={sides}
                      onChange={(e) => setSides(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Single-Sided">Single-Sided (Front)</option>
                      <option value="Double-Sided">Double-Sided (Both)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Size / Format</label>
                    <input
                      type="text"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      placeholder="e.g. 90x50mm, A5, A4"
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Finishing / Fold</label>
                    <select
                      value={finishing}
                      onChange={(e) => setFinishing(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Standard Finish">Standard Uncoated/Gloss</option>
                      <option value="Matte Velvet Lamination">Matte Velvet</option>
                      <option value="Gloss Lamination">Gloss Lamination</option>
                      <option value="Half-Fold">Half-Fold</option>
                      <option value="Tri-Fold">Tri-Fold</option>
                      <option value="Spot UV Accents">Spot UV Accents</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Additional Requirements & Artwork Upload */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>3. Additional Notes & Artwork</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Special Instructions / Job Deadlines <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={additionalRequirements}
                    onChange={(e) => setAdditionalRequirements(e.target.value)}
                    placeholder="Tell us about your turnaround requirements, custom shapes, Pantone colours, or any specific instructions..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
                  />
                </div>

                {/* File Attachment Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Attach Artwork or Reference File <span className="text-slate-400 font-normal">(Optional, max 25MB)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.ai,.eps,.psd,.tif,.tiff"
                      onChange={handleFileChange}
                      className="hidden"
                      id="enquiry-file-upload"
                    />
                    <label
                      htmlFor="enquiry-file-upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                    >
                      <UploadCloud className="w-4 h-4 text-sky-600" />
                      <span>{attachment ? 'Change File' : 'Upload Artwork File'}</span>
                    </label>

                    {attachment ? (
                      <div className="flex items-center gap-2 text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        <Paperclip className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span className="truncate max-w-[220px]">{attachment.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachment(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-slate-400 hover:text-rose-600 ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">PDF, PNG, JPG, AI, PSD, EPS accepted</span>
                    )}
                  </div>
                </div>

                {/* Privacy Consent */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyConsent}
                      onChange={(e) => setPrivacyConsent(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                    />
                    <span className="text-[11px] text-slate-600 leading-snug">
                      I agree to the privacy policy and consent to Erry Imprints contacting me by email or phone regarding this custom printing quote.
                    </span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEnquiryModal}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Enquiry…</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Quote Enquiry</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
