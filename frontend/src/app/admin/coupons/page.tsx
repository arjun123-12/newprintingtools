'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getAuthToken } from '@/utils/storageHelper';
import {
  AlertCircle,
  CheckCircle2,
  Gift,
  Loader2,
  Mail,
  Plus,
  Send,
  Tag,
  Sparkles,
  Crown,
  Trophy,
  RefreshCw,
  Check,
  ExternalLink,
} from 'lucide-react';
import SpinWheel from '@/components/SpinWheel';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api/v1';

type Offer = {
  id: number;
  name: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  minimum_subtotal?: string | number;
  maximum_discount?: string | number;
  quantity?: number | string;
  product_details?: string;
  status: string;
  usage_count: number;
  usage_limit?: number;
  campaigns_count?: number;
  starts_at?: string;
  ends_at?: string;
};

type Customer = { id: number; name: string; email: string; marketing_consent: boolean };
type MarketingContact = { id: number; name: string; email: string };

type PaidOrderRecipient = {
  order_id: string;
  order_number: string;
  customer_id?: number;
  name: string;
  email: string;
  total: number | string;
  has_spun: boolean;
  spun_at?: string;
  created_at: string;
};

export default function AdminCouponsPage() {
  const [activeTab, setActiveTab] = useState<'offers' | 'spin_wheel'>('offers');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ good: boolean; text: string } | null>(null);

  // Standard Offers State
  const [offer, setOffer] = useState({
    name: '',
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    minimum_subtotal: '0',
    quantity: '',
    product_details: '',
    maximum_discount: '',
    usage_limit: '',
    starts_at: '',
    hours: '',
  });
  const [campaign, setCampaign] = useState({ offer_id: '', subject: '', headline: '', message: '' });
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [newContact, setNewContact] = useState({ name: '', email: '' });
  const [newContactConsent, setNewContactConsent] = useState(false);
  const [allConsented, setAllConsented] = useState(false);
  const [confirmConsent, setConfirmConsent] = useState(false);

  // Spin & Win Wheel Promotion State
  const [spinSettings, setSpinSettings] = useState({
    enabled: true,
    auto_send_on_payment: true,
    min_order_spend: 0,
    banner_title: 'SPIN & WIN',
    banner_subtitle: 'AMAZING PRINTING REWARDS AWAIT!',
    banner_tagline: 'Play the wheel and unlock exciting rewards for your business.',
    invitation_subject: '🎁 Spin to Win Your Exclusive Print Reward! | Erry Imprints',
    invitation_headline: "You've Unlocked a Free Spin!",
    invitation_message:
      'Thank you for completing your payment! As a special reward, you are invited to spin our prize wheel to unlock exclusive discounts, print credits, and free delivery upgrades on your next order.',
  });
  const [paidOrders, setPaidOrders] = useState<PaidOrderRecipient[]>([]);
  const [spinLedger, setSpinLedger] = useState<any[]>([]);
  const [spinStats, setSpinStats] = useState<any>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedSpinCustomerIds, setSelectedSpinCustomerIds] = useState<number[]>([]);
  const [allPaidSelected, setAllPaidSelected] = useState(false);
  const [spinCampaign, setSpinCampaign] = useState({
    subject: '🎁 Spin to Win Your Exclusive Print Reward! | Erry Imprints',
    headline: "You've Unlocked a Free Spin!",
    message:
      'Thank you for completing your payment! As a special reward, you are invited to spin our prize wheel to unlock exclusive discounts, print credits, and free delivery upgrades on your next order.',
  });

  const headers = useMemo(() => {
    const token = getAuthToken();
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [o, c, m] = await Promise.all([
        fetch(`${API_URL}/admin/offers`, { headers }),
        fetch(`${API_URL}/admin/offers/customers`, { headers }),
        fetch(`${API_URL}/admin/offers/contacts`, { headers }),
      ]);
      const oj = await o.json();
      const cj = await c.json();
      const mj = await m.json();
      if (!o.ok || !c.ok || !m.ok)
        throw new Error(oj.message || cj.message || mj.message || 'Could not load offers.');
      setOffers(oj.data || []);
      setCustomers(cj.data || []);
      setContacts(mj.data || []);
    } catch (e) {
      setMessage({ good: false, text: e instanceof Error ? e.message : 'Could not load offers.' });
    } finally {
      setLoading(false);
    }
  };

  const loadSpinData = async () => {
    try {
      const [settingsRes, recipRes, ledgerRes] = await Promise.all([
        fetch(`${API_URL}/admin/spin-win/settings`, { headers }),
        fetch(`${API_URL}/admin/spin-win/campaign-recipients`, { headers }),
        fetch(`${API_URL}/admin/spin-win/ledger`, { headers }),
      ]);
      if (settingsRes.ok) {
        const sj = await settingsRes.json();
        if (sj.data?.settings) {
          setSpinSettings((prev) => ({ ...prev, ...sj.data.settings }));
          setSpinCampaign((prev) => ({
            ...prev,
            subject: sj.data.settings.invitation_subject || prev.subject,
            headline: sj.data.settings.invitation_headline || prev.headline,
            message: sj.data.settings.invitation_message || prev.message,
          }));
        }
        if (sj.data?.stats) setSpinStats(sj.data.stats);
      }
      if (recipRes.ok) {
        const rj = await recipRes.json();
        setPaidOrders(rj.data?.paid_orders || []);
      }
      if (ledgerRes.ok) {
        const lj = await ledgerRes.json();
        setSpinLedger(lj.data?.data || []);
      }
    } catch (e) {
      console.error('Could not load spin data', e);
    }
  };

  useEffect(() => {
    void load();
    void loadSpinData();
  }, []);

  const addRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/admin/offers/contacts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...newContact, confirm_consent: newContactConsent }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ||
            Object.values(result.errors || {})
              .flat()
              .join(' ') ||
            'Could not add recipient.'
        );
      const saved = result.data as MarketingContact;
      setContacts((current) => [saved, ...current.filter((contact) => contact.id !== saved.id)]);
      setSelectedContactIds((current) =>
        current.includes(saved.id) ? current : [...current, saved.id]
      );
      setNewContact({ name: '', email: '' });
      setNewContactConsent(false);
      setMessage({ good: true, text: `${saved.email} added to recipients and selected.` });
    } catch (e) {
      setMessage({ good: false, text: e instanceof Error ? e.message : 'Could not add recipient.' });
    } finally {
      setBusy(false);
    }
  };

  const createOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const hoursNum = Number(offer.hours);
      let calculatedEndsAt: string | null = null;
      if (hoursNum > 0) {
        const baseDate = offer.starts_at ? new Date(offer.starts_at) : new Date();
        const targetDate = new Date(baseDate.getTime() + hoursNum * 3600 * 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        calculatedEndsAt = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(
          targetDate.getDate()
        )}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;
      }
      const response = await fetch(`${API_URL}/admin/offers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...offer,
          discount_value: Number(offer.discount_value),
          minimum_subtotal: offer.minimum_subtotal ? Number(offer.minimum_subtotal) : 0,
          quantity: offer.quantity ? Number(offer.quantity) : null,
          product_details: offer.product_details?.trim() || null,
          maximum_discount: offer.maximum_discount ? Number(offer.maximum_discount) : null,
          usage_limit: offer.usage_limit ? Number(offer.usage_limit) : null,
          starts_at: offer.starts_at || null,
          ends_at: calculatedEndsAt,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ||
            Object.values(result.errors || {})
              .flat()
              .join(' ') ||
            'Could not create offer.'
        );
      setOffer({
        name: '',
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        minimum_subtotal: '0',
        quantity: '',
        product_details: '',
        maximum_discount: '',
        usage_limit: '',
        starts_at: '',
        hours: '',
      });
      setCampaign((v) => ({
        ...v,
        offer_id: String(result.data.id),
        subject: `A special offer for you: ${result.data.name}`,
        headline: result.data.name,
      }));
      setMessage({
        good: true,
        text: `Offer ${result.data.code} created. Choose recipients and prepare the email below.`,
      });
      await load();
    } catch (e) {
      setMessage({ good: false, text: e instanceof Error ? e.message : 'Could not create offer.' });
    } finally {
      setBusy(false);
    }
  };

  const sendCampaign = async () => {
    if (
      !campaign.offer_id ||
      !confirmConsent ||
      (!allConsented && selected.length + selectedContactIds.length === 0)
    )
      return;
    if (
      !window.confirm(
        `Send this offer email to ${
          allConsented
            ? 'all opted-in customers and added recipients'
            : `${selected.length + selectedContactIds.length} selected recipients`
        }?`
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/admin/offers/${campaign.offer_id}/campaign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...campaign,
          customer_ids: allConsented ? [] : selected,
          contact_ids: allConsented ? [] : selectedContactIds,
          all_consented: allConsented,
          confirm_consent: true,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ||
            Object.values(result.errors || {})
              .flat()
              .join(' ') ||
            'Campaign failed.'
        );
      setMessage({ good: true, text: result.message || 'Campaign sent.' });
      setSelected([]);
      setSelectedContactIds([]);
      setAllConsented(false);
      setConfirmConsent(false);
      await load();
    } catch (e) {
      setMessage({ good: false, text: e instanceof Error ? e.message : 'Campaign failed.' });
    } finally {
      setBusy(false);
    }
  };

  const toggleAutoSend = async (enabled: boolean) => {
    setBusy(true);
    try {
      const updated = {
        ...spinSettings,
        auto_send_on_payment: enabled,
      };
      const response = await fetch(`${API_URL}/admin/spin-win/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated),
      });
      if (response.ok) {
        setSpinSettings((prev) => ({ ...prev, auto_send_on_payment: enabled }));
        setMessage({
          good: true,
          text: enabled
            ? 'Automatic Spin Wheel invitation enabled for all verified completed payments.'
            : 'Automatic Spin Wheel invitation disabled. Invitations are now managed manually by admin.',
        });
      }
    } catch (e) {
      setMessage({ good: false, text: 'Could not update auto-send setting.' });
    } finally {
      setBusy(false);
    }
  };

  const sendSpinInvitationCampaign = async () => {
    if (
      !allPaidSelected &&
      selectedOrderIds.length === 0 &&
      selectedSpinCustomerIds.length === 0 &&
      selectedContactIds.length === 0
    ) {
      alert('Please select at least one recipient to send the spin wheel invitation.');
      return;
    }

    const countText = allPaidSelected
      ? 'all qualifying customers with completed payments'
      : `${
          selectedOrderIds.length + selectedSpinCustomerIds.length + selectedContactIds.length
        } selected recipients`;

    if (!window.confirm(`Send Spin & Win Wheel VIP invitation email to ${countText}?`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/admin/spin-win/send-invitation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          order_ids: allPaidSelected ? [] : selectedOrderIds,
          customer_ids: allPaidSelected ? [] : selectedSpinCustomerIds,
          contact_ids: allPaidSelected ? [] : selectedContactIds,
          all_paid: allPaidSelected,
          subject: spinCampaign.subject,
          headline: spinCampaign.headline,
          message: spinCampaign.message,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || 'Failed to send spin invitations.');
      setMessage({
        good: true,
        text: result.message || 'Spin Wheel invitations sent successfully!',
      });
      setSelectedOrderIds([]);
      setSelectedSpinCustomerIds([]);
      setSelectedContactIds([]);
      setAllPaidSelected(false);
      await loadSpinData();
    } catch (e) {
      setMessage({
        good: false,
        text: e instanceof Error ? e.message : 'Failed to send spin invitations.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700 shadow-sm">
              <Gift size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Offers & Promotions</h1>
              <p className="text-sm text-slate-500">
                Design discount offers, manage the Spin & Win wheel, and email promotional campaigns.
              </p>
            </div>
          </div>
          {spinStats && (
            <div className="flex items-center gap-3 bg-white border rounded-xl px-4 py-2 shadow-sm text-xs">
              <div>
                <span className="block text-slate-500">Total Spins</span>
                <span className="font-bold text-slate-900">{spinStats.total_spins}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="block text-slate-500">Active Vouchers</span>
                <span className="font-bold text-amber-600">{spinStats.total_active_vouchers}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="block text-slate-500">Redeemed</span>
                <span className="font-bold text-emerald-600">{spinStats.total_redeemed}</span>
              </div>
            </div>
          )}
        </header>

        {/* Global Feedback Alert */}
        {message && (
          <div
            className={`flex items-center gap-2 rounded-xl border p-3.5 text-sm ${
              message.good
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {message.good ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4">
          <button
            type="button"
            onClick={() => setActiveTab('offers')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition ${
              activeTab === 'offers'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag size={16} />
            <span>Discount Offers & Coupons</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('spin_wheel');
              void loadSpinData();
            }}
            className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition ${
              activeTab === 'spin_wheel'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles size={16} className="text-amber-500" />
            <span>Spin & Win Wheel Promotions</span>
            <span className="rounded-full bg-gradient-to-r from-amber-500 to-pink-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
              VIP
            </span>
          </button>
        </div>

        {/* TAB 1: STANDARD DISCOUNT OFFERS */}
        {activeTab === 'offers' && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Form: Create Offer */}
              <form onSubmit={createOffer} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Tag size={18} /> Design offer
                </h2>
                <label className="block text-sm">
                  Offer name
                  <input
                    required
                    maxLength={120}
                    value={offer.name}
                    onChange={(e) => setOffer({ ...offer, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border p-2.5"
                    placeholder="Spring print sale"
                  />
                </label>
                <label className="block text-sm">
                  Discount code
                  <input
                    required
                    maxLength={40}
                    value={offer.code}
                    onChange={(e) =>
                      setOffer({
                        ...offer,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                      })
                    }
                    className="mt-1 w-full rounded-lg border p-2.5 font-mono"
                    placeholder="SPRING15"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Type
                    <select
                      value={offer.discount_type}
                      onChange={(e) =>
                        setOffer({
                          ...offer,
                          discount_type: e.target.value as 'percentage' | 'fixed',
                        })
                      }
                      className="mt-1 w-full rounded-lg border p-2.5"
                    >
                      <option value="percentage">Percent off</option>
                      <option value="fixed">AUD off</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    Value
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={offer.discount_value}
                      onChange={(e) => setOffer({ ...offer, discount_value: e.target.value })}
                      className="mt-1 w-full rounded-lg border p-2.5"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Cost (AUD)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={offer.minimum_subtotal}
                      onChange={(e) => setOffer({ ...offer, minimum_subtotal: e.target.value })}
                      className="mt-1 w-full rounded-lg border p-2.5"
                      placeholder="0.00"
                    />
                  </label>
                  <label className="text-sm">
                    Qty (optional)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={offer.quantity}
                      onChange={(e) => setOffer({ ...offer, quantity: e.target.value })}
                      className="mt-1 w-full rounded-lg border p-2.5"
                      placeholder="e.g. 500"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  Product details (optional)
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={offer.product_details}
                    onChange={(e) => setOffer({ ...offer, product_details: e.target.value })}
                    className="mt-1 w-full rounded-lg border p-2.5"
                    placeholder="e.g. 450gsm Heavy Artboard, Double Sided, Matt Celloglaze"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Starts (optional)
                    <input
                      type="datetime-local"
                      value={offer.starts_at}
                      onChange={(e) => setOffer({ ...offer, starts_at: e.target.value })}
                      className="mt-1 w-full rounded-lg border p-2.5"
                    />
                  </label>
                  <label className="text-sm">
                    Add hours (optional)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={offer.hours}
                      onChange={(e) => setOffer({ ...offer, hours: e.target.value })}
                      className="mt-1 w-full rounded-lg border p-2.5"
                      placeholder="e.g. 24"
                    />
                    {Number(offer.hours) > 0 ? (
                      <span className="mt-1 block text-[11px] text-slate-500">
                        Expires in {offer.hours}h (
                        {(() => {
                          const baseDate = offer.starts_at ? new Date(offer.starts_at) : new Date();
                          const targetDate = new Date(
                            baseDate.getTime() + Number(offer.hours) * 3600 * 1000
                          );
                          return targetDate.toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          });
                        })()}
                        )
                      </span>
                    ) : null}
                  </label>
                </div>
                <button
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  <Plus size={17} />
                  Design offer
                </button>
              </form>

              {/* Right Form: Send Promotional Email */}
              <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Mail size={18} /> Promotional email
                </h2>
                <label className="block text-sm">
                  Offer
                  <select
                    value={campaign.offer_id}
                    onChange={(e) => setCampaign({ ...campaign, offer_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border p-2.5"
                  >
                    <option value="">Choose an offer</option>
                    {offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} · {o.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Email subject
                  <input
                    maxLength={180}
                    value={campaign.subject}
                    onChange={(e) => setCampaign({ ...campaign, subject: e.target.value })}
                    className="mt-1 w-full rounded-lg border p-2.5"
                    placeholder="A special offer for you"
                  />
                </label>
                <label className="block text-sm">
                  Headline
                  <input
                    maxLength={180}
                    value={campaign.headline}
                    onChange={(e) => setCampaign({ ...campaign, headline: e.target.value })}
                    className="mt-1 w-full rounded-lg border p-2.5"
                  />
                </label>
                <label className="block text-sm">
                  Message
                  <textarea
                    maxLength={5000}
                    rows={3}
                    value={campaign.message}
                    onChange={(e) => setCampaign({ ...campaign, message: e.target.value })}
                    className="mt-1 w-full rounded-lg border p-2.5"
                    placeholder="Tell customers about the offer and its terms."
                  />
                </label>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                    <span>Who should receive this email?</span>
                    <span className="text-slate-500">
                      {allConsented
                        ? `${
                            customers.filter((c) => c.marketing_consent).length + contacts.length
                          } opted in`
                        : `${selected.length + selectedContactIds.length} selected`}
                    </span>
                  </div>
                  <label className="mb-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allConsented}
                      onChange={(e) => {
                        setAllConsented(e.target.checked);
                        setSelected([]);
                        setSelectedContactIds([]);
                      }}
                    />
                    Send to all customers who opted in
                  </label>
                  {!allConsented && (
                    <>
                      <div className="max-h-52 overflow-auto rounded-lg border bg-white">
                        {loading ? (
                          <div className="p-3 text-xs text-slate-500">Loading customers…</div>
                        ) : (
                          <>
                            {customers.map((c) => (
                              <label
                                key={`user-${c.id}`}
                                className="flex items-center gap-2 border-b px-3 py-2 text-xs last:border-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.includes(c.id)}
                                  onChange={(e) =>
                                    setSelected((v) =>
                                      e.target.checked
                                        ? [...v, c.id]
                                        : v.filter((id) => id !== c.id)
                                    )
                                  }
                                />
                                <span className="min-w-0">
                                  <span className="block font-medium">{c.name}</span>
                                  <span className="text-slate-500">{c.email}</span>
                                </span>
                                <span
                                  className={`ml-auto shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                                    c.marketing_consent
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {c.marketing_consent ? 'Opted in' : 'Confirm consent'}
                                </span>
                              </label>
                            ))}
                            {contacts.map((c) => (
                              <label
                                key={`contact-${c.id}`}
                                className="flex items-center gap-2 border-b px-3 py-2 text-xs last:border-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedContactIds.includes(c.id)}
                                  onChange={(e) =>
                                    setSelectedContactIds((v) =>
                                      e.target.checked
                                        ? [...v, c.id]
                                        : v.filter((id) => id !== c.id)
                                    )
                                  }
                                />
                                <span className="min-w-0">
                                  <span className="block font-medium">{c.name}</span>
                                  <span className="text-slate-500">{c.email}</span>
                                </span>
                                <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                  Added recipient
                                </span>
                              </label>
                            ))}
                          </>
                        )}
                      </div>
                      <form
                        onSubmit={addRecipient}
                        className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-white p-3"
                      >
                        <p className="text-xs font-bold text-slate-800">Add a new email recipient</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            required
                            maxLength={120}
                            value={newContact.name}
                            onChange={(e) =>
                              setNewContact({ ...newContact, name: e.target.value })
                            }
                            placeholder="Customer name"
                            className="rounded-lg border p-2 text-xs"
                          />
                          <input
                            required
                            type="email"
                            maxLength={255}
                            value={newContact.email}
                            onChange={(e) =>
                              setNewContact({ ...newContact, email: e.target.value })
                            }
                            placeholder="customer@example.com"
                            className="rounded-lg border p-2 text-xs"
                          />
                        </div>
                        <label className="flex items-start gap-2 text-[11px] leading-4 text-slate-600">
                          <input
                            type="checkbox"
                            required
                            checked={newContactConsent}
                            onChange={(e) => setNewContactConsent(e.target.checked)}
                            className="mt-0.5"
                          />
                          I have permission to send promotional emails to this address.
                        </label>
                        <button
                          disabled={busy || !newContactConsent}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          Add and select recipient
                        </button>
                      </form>
                    </>
                  )}
                </div>
                <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                  <input
                    type="checkbox"
                    checked={confirmConsent}
                    onChange={(e) => setConfirmConsent(e.target.checked)}
                    className="mt-1"
                  />
                  I confirm the selected customers gave permission to receive promotional emails.
                </label>
                <button
                  type="button"
                  onClick={sendCampaign}
                  disabled={
                    busy ||
                    !campaign.offer_id ||
                    !campaign.subject.trim() ||
                    !campaign.headline.trim() ||
                    !campaign.message.trim() ||
                    !confirmConsent ||
                    (!allConsented && selected.length + selectedContactIds.length === 0)
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                  Send campaign
                </button>
              </section>
            </div>

            {/* Existing Offers Table */}
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold">Active Offers</h2>
              {loading ? (
                <Loader2 className="animate-spin text-slate-400" />
              ) : offers.length === 0 ? (
                <p className="text-sm text-slate-500">No offers yet. Create your first discount code above.</p>
              ) : (
                <div className="divide-y">
                  {offers.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <span className="font-semibold">{o.name}</span>
                      <code className="rounded bg-slate-100 px-2 py-1">{o.code}</code>
                      <span>
                        {o.discount_type === 'percentage'
                          ? `${o.discount_value}% off`
                          : `$${o.discount_value} off`}
                      </span>
                      {o.minimum_subtotal && Number(o.minimum_subtotal) > 0 ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          Cost: ${o.minimum_subtotal}
                        </span>
                      ) : null}
                      {o.quantity ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          Qty: {o.quantity}
                        </span>
                      ) : null}
                      {o.product_details ? (
                        <span
                          className="max-w-xs truncate rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-500"
                          title={o.product_details}
                        >
                          {o.product_details}
                        </span>
                      ) : null}
                      <span className="ml-auto text-slate-500">
                        {o.usage_count}
                        {o.usage_limit ? ` / ${o.usage_limit}` : ''} redemptions ·{' '}
                        {o.campaigns_count || 0} campaigns · {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: SPIN & WIN WHEEL PROMOTIONS */}
        {activeTab === 'spin_wheel' && (
          <div className="space-y-6">
            {/* Top Automation Card: Auto-send on Payment Completion */}
            <div className="rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-50 via-white to-pink-50 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-amber-400/20 p-2 text-amber-700">
                    <Crown size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Automatic Wheel Invitation on Completed Payment
                    </h2>
                    <p className="text-xs text-slate-600 max-w-xl">
                      When a customer completes payment via checkout or customer review link,
                      automatically email them an exclusive invitation link to spin the prize wheel.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-slate-700">
                    {spinSettings.auto_send_on_payment ? 'Auto-send Enabled' : 'Auto-send Disabled'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleAutoSend(!spinSettings.auto_send_on_payment)}
                    disabled={busy}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      spinSettings.auto_send_on_payment ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        spinSettings.auto_send_on_payment ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Split Grid: Live Wheel Interactive Preview + Email Campaign Dispatcher */}
            <div className="grid gap-6 lg:grid-cols-12 items-start">
              {/* Left Column (5 Cols): Premium Spin Wheel Interactive Preview */}
              <div className="lg:col-span-5 rounded-2xl border bg-slate-950 p-6 text-white shadow-md flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Live Wheel Preview
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Interactive Test Mode</span>
                </div>

                {/* The actual premium SpinWheel component */}
                <div className="my-3 w-full flex justify-center">
                  <SpinWheel isPreview={true} />
                </div>

                <p className="mt-3 text-center text-[11px] text-slate-400">
                  Click <strong>SPIN</strong> in the center to test the wind-up, ticking needle,
                  and confetti win celebration.
                </p>
              </div>

              {/* Right Column (7 Cols): Send Spin Wheel Email Campaign to Specific Customers */}
              <div className="lg:col-span-7 space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Mail size={18} className="text-amber-600" />
                    <span>Send Spin Wheel Invitation</span>
                  </h2>
                  <span className="text-xs font-medium text-slate-500">
                    Manual VIP Campaign
                  </span>
                </div>

                <label className="block text-sm">
                  Email subject
                  <input
                    maxLength={180}
                    value={spinCampaign.subject}
                    onChange={(e) => setSpinCampaign({ ...spinCampaign, subject: e.target.value })}
                    className="mt-1 w-full rounded-lg border p-2.5 text-xs font-medium"
                    placeholder="🎁 Spin to Win Your Exclusive Print Reward! | Erry Imprints"
                  />
                </label>

                <label className="block text-sm">
                  Headline
                  <input
                    maxLength={180}
                    value={spinCampaign.headline}
                    onChange={(e) => setSpinCampaign({ ...spinCampaign, headline: e.target.value })}
                    className="mt-1 w-full rounded-lg border p-2.5 text-xs font-medium"
                    placeholder="You've Unlocked a Free Spin!"
                  />
                </label>

                <label className="block text-sm">
                  Promotional Message
                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={spinCampaign.message}
                    onChange={(e) => setSpinCampaign({ ...spinCampaign, message: e.target.value })}
                    className="mt-1 w-full rounded-lg border p-2.5 text-xs"
                    placeholder="Thank you for completing your payment! You are invited to spin our prize wheel..."
                  />
                </label>

                {/* Recipient Picker: Customers with completed payment */}
                <div className="rounded-xl bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Select Paid Customers or Recipients</span>
                    <span className="text-slate-500">
                      {allPaidSelected
                        ? 'All qualifying paid orders'
                        : `${
                            selectedOrderIds.length +
                            selectedSpinCustomerIds.length +
                            selectedContactIds.length
                          } selected`}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={allPaidSelected}
                      onChange={(e) => {
                        setAllPaidSelected(e.target.checked);
                        setSelectedOrderIds([]);
                        setSelectedSpinCustomerIds([]);
                        setSelectedContactIds([]);
                      }}
                    />
                    <span>Send to all customers who completed payment</span>
                  </label>

                  {!allPaidSelected && (
                    <div className="max-h-56 overflow-auto rounded-lg border bg-white divide-y text-xs">
                      {paidOrders.length === 0 ? (
                        <div className="p-3 text-slate-500">No paid orders found yet.</div>
                      ) : (
                        paidOrders.map((po) => {
                          const isSelected = selectedOrderIds.includes(po.order_id);
                          return (
                            <label
                              key={po.order_id}
                              className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  setSelectedOrderIds((prev) =>
                                    e.target.checked
                                      ? [...prev, po.order_id]
                                      : prev.filter((id) => id !== po.order_id)
                                  );
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-800">
                                    #{po.order_number}
                                  </span>
                                  <span className="text-slate-600 truncate">{po.name}</span>
                                </div>
                                <span className="text-[11px] text-slate-400">{po.email}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="block font-semibold text-slate-700">
                                  AUD ${Number(po.total).toFixed(2)}
                                </span>
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    po.has_spun
                                      ? 'bg-slate-100 text-slate-500'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {po.has_spun ? 'Already spun' : 'Paid · Ready to spin'}
                                </span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Email Preview Card */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <Mail size={13} className="text-amber-600" />
                    <span>Customer Email Preview</span>
                  </div>
                  <p className="mt-1 font-bold text-sm text-slate-900">{spinCampaign.headline}</p>
                  <p className="mt-0.5 text-slate-700 line-clamp-2">{spinCampaign.message}</p>
                  <div className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] font-bold text-amber-700 bg-white border border-amber-300 px-2 py-1 rounded-md">
                    <span>Includes Direct Spin Token Link</span>
                  </div>
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={sendSpinInvitationCampaign}
                  disabled={
                    busy ||
                    (!allPaidSelected &&
                      selectedOrderIds.length === 0 &&
                      selectedSpinCustomerIds.length === 0 &&
                      selectedContactIds.length === 0)
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-3 font-bold text-white hover:from-amber-500 hover:to-yellow-500 disabled:opacity-40 shadow-sm"
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  <span>Send Spin Wheel Invitation</span>
                </button>
              </div>
            </div>

            {/* Bottom Section: Spin Reward Won Ledger */}
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-2 border-b">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Trophy size={18} className="text-amber-500" />
                    <span>Recent Spin Wins & Reward Vouchers</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live record of winning spins, issued coupon codes, and redemption status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadSpinData()}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <RefreshCw size={13} />
                  <span>Refresh</span>
                </button>
              </div>

              {spinLedger.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No spin rewards recorded yet. Once customers spin the wheel, their won prizes will appear here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 text-slate-600">
                        <th className="py-2.5 px-3">Customer / Order</th>
                        <th className="py-2.5 px-3">Prize Won</th>
                        <th className="py-2.5 px-3">Voucher Code</th>
                        <th className="py-2.5 px-3">Value</th>
                        <th className="py-2.5 px-3">Expires</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      {spinLedger.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3">
                            <span className="font-semibold block text-slate-900">
                              {row.user?.name || row.order?.user?.name || 'Customer'}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {row.order?.order_number ? `#${row.order.order_number}` : 'Promo Spin'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800">{row.title}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-violet-700">
                            {row.reward_code}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            AUD ${Number(row.value).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {row.expires_at ? new Date(row.expires_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                row.status === 'redeemed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : row.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
