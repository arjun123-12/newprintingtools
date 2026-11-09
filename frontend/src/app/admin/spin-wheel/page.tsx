'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAuthToken } from '@/utils/storageHelper';
import {
  Sparkles,
  Crown,
  Trophy,
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Gift,
  Tag,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import SpinWheel, { DEFAULT_SEGMENTS } from '@/components/SpinWheel';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api/v1';

type OrderRecipient = {
  order_id: string;
  order_number: string;
  customer_id?: number;
  name: string;
  email: string;
  total: number | string;
  payment_status?: string;
  has_spun: boolean;
  spun_at?: string;
  created_at: string;
};

type CampaignContact = { id: number; name: string; email: string };

export default function AdminSpinWheelPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ good: boolean; text: string } | null>(null);

  // Settings State
  const [settings, setSettings] = useState({
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

  const [stats, setStats] = useState<any>(null);
  const [paidOrders, setPaidOrders] = useState<OrderRecipient[]>([]);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '', consent: false });
  const [ledger, setLedger] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);

  const previewSegments = useMemo(() => {
    const defaultCategory = categories.find((category) => category.is_default);
    const categorySegments = segments.filter((segment) => segment.is_active && (
      !defaultCategory || Number(segment.category_id) === Number(defaultCategory.id)
    ));
    return categorySegments.map((segment, index) => ({
      // Match the customer wheel: reward wording is dynamic, slice styling stays consistent.
      ...DEFAULT_SEGMENTS[index % DEFAULT_SEGMENTS.length],
      label: segment.badge_text || segment.title || segment.code,
      code: segment.code,
      value: Number(segment.value || 0),
      type: segment.reward_type,
    }));
  }, [segments, categories]);

  // Campaign Form State
  const [campaign, setCampaign] = useState({
    subject: '🎁 Spin to Win Your Exclusive Print Reward! | Erry Imprints',
    headline: "You've Unlocked a Free Spin!",
    message:
      'Thank you for completing your payment! As a special reward, you are invited to spin our prize wheel to unlock exclusive discounts, print credits, and free delivery upgrades on your next order.',
  });

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [rewardId, setRewardId] = useState('');
  const [rewardAssignments, setRewardAssignments] = useState<Record<string, string>>({});
  const [allOrdersSelected, setAllOrdersSelected] = useState(false);

  const headers = useMemo(() => {
    const token = getAuthToken();
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, recipRes, ledgerRes] = await Promise.all([
        fetch(`${API_URL}/admin/spin-win/settings`, { headers }),
        fetch(`${API_URL}/admin/spin-win/campaign-recipients`, { headers }),
        fetch(`${API_URL}/admin/spin-win/ledger`, { headers }),
      ]);

      if (settingsRes.ok) {
        const sj = await settingsRes.json();
        if (sj.data?.settings) {
          setSettings((prev) => ({ ...prev, ...sj.data.settings }));
          setCampaign((prev) => ({
            ...prev,
            subject: sj.data.settings.invitation_subject || prev.subject,
            headline: sj.data.settings.invitation_headline || prev.headline,
            message: sj.data.settings.invitation_message || prev.message,
          }));
        }
        if (sj.data?.stats) setStats(sj.data.stats);
        if (sj.data?.categories) setCategories(sj.data.categories);
        if (sj.data?.segments) setSegments(sj.data.segments);
      }

      if (recipRes.ok) {
        const rj = await recipRes.json();
        setPaidOrders(rj.data?.orders || rj.data?.paid_orders || []);
        setContacts(rj.data?.contacts || []);
        setCustomers(rj.data?.customers || []);
      }

      if (ledgerRes.ok) {
        const lj = await ledgerRes.json();
        setLedger(lj.data?.data || []);
      }
    } catch (e: any) {
      setMessage({ good: false, text: e.message || 'Could not load spin wheel data.' });
    } finally {
      setLoading(false);
    }
  };

  const addCampaignRecipient = async () => {
    if (!newRecipient.name.trim() || !newRecipient.email.trim() || !newRecipient.consent) {
      setMessage({ good: false, text: 'Enter recipient name and email, then confirm they agreed to receive promotional email.' });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/admin/spin-win/campaign-recipients`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: newRecipient.name, email: newRecipient.email, confirm_consent: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.errors?.email?.[0] || 'Could not add recipient.');
      const contact = result.data as CampaignContact;
      setContacts((prev) => [contact, ...prev.filter((item) => item.id !== contact.id)]);
      setSelectedContactIds((prev) => prev.includes(contact.id) ? prev : [...prev, contact.id]);
      setNewRecipient({ name: '', email: '', consent: false });
      setMessage({ good: true, text: 'Recipient added and selected. Choose the reward, then send the invitation.' });
    } catch (error: any) {
      setMessage({ good: false, text: error.message || 'Could not add recipient.' });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const toggleAutoSend = async (enabled: boolean) => {
    setBusy(true);
    try {
      const updated = {
        ...settings,
        auto_send_on_payment: enabled,
      };
      const response = await fetch(`${API_URL}/admin/spin-win/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated),
      });
      if (response.ok) {
        setSettings((prev) => ({ ...prev, auto_send_on_payment: enabled }));
        setMessage({
          good: true,
          text: enabled
            ? 'Automatic Spin Wheel invitation enabled for all verified completed payments.'
            : 'Automatic Spin Wheel invitation disabled. Wheel invitations are now sent manually by admin.',
        });
      }
    } catch (e) {
      setMessage({ good: false, text: 'Could not update auto-send setting.' });
    } finally {
      setBusy(false);
    }
  };

  const sendInvitationCampaign = async () => {
    if (
      !allOrdersSelected &&
      selectedOrderIds.length === 0 &&
      selectedCustomerIds.length === 0 &&
      selectedContactIds.length === 0
    ) {
      alert('Please select at least one recipient to send the spin wheel invitation.');
      return;
    }

    const countText = allOrdersSelected
      ? 'customers on all orders, regardless of payment status'
      : `${selectedOrderIds.length + selectedCustomerIds.length + selectedContactIds.length} selected recipients`;

    if (!window.confirm(`Send Spin & Win Wheel VIP invitation email to ${countText}?`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/admin/spin-win/send-invitation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          order_ids: allOrdersSelected ? [] : selectedOrderIds,
          customer_ids: allOrdersSelected ? [] : selectedCustomerIds,
          contact_ids: allOrdersSelected ? [] : selectedContactIds,
          reward_id: rewardId ? Number(rewardId) : null,
          reward_assignments: {
            orders: Object.fromEntries(selectedOrderIds.filter((id) => rewardAssignments[`order:${id}`]).map((id) => [id, Number(rewardAssignments[`order:${id}`])])),
            customers: Object.fromEntries(selectedCustomerIds.filter((id) => rewardAssignments[`customer:${id}`]).map((id) => [String(id), Number(rewardAssignments[`customer:${id}`])])),
            contacts: Object.fromEntries(selectedContactIds.filter((id) => rewardAssignments[`contact:${id}`]).map((id) => [String(id), Number(rewardAssignments[`contact:${id}`])])),
          },
          all_paid: false,
          all_orders: allOrdersSelected,
          subject: campaign.subject,
          headline: campaign.headline,
          message: campaign.message,
        }),
      });
      const result = await response.json();
      if (response.status === 202) {
        setMessage({
          good: false,
          text: 'Server accepted the request, but it did not confirm that the email was sent. The recipients are still selected; check the backend deployment and mail transport before retrying.',
        });
        return;
      }
      if (!response.ok)
        throw new Error(result.message || 'Failed to send spin invitations.');
      setMessage({
        good: true,
        text: result.message || 'Spin Wheel invitations sent successfully!',
      });
      setSelectedOrderIds([]);
      setSelectedCustomerIds([]);
      setSelectedContactIds([]);
      setRewardAssignments({});
      setAllOrdersSelected(false);
      await loadData();
    } catch (e: any) {
      setMessage({
        good: false,
        text: e.message || 'Failed to send spin invitations.',
      });
    } finally {
      setBusy(false);
    }
  };

  const renderRewardAssignment = (key: string) => (
    <select
      aria-label="Guaranteed reward for this recipient"
      value={rewardAssignments[key] || ''}
      onChange={(event) => setRewardAssignments((current) => ({ ...current, [key]: event.target.value }))}
      onClick={(event) => event.stopPropagation()}
      className="max-w-[150px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700 focus:border-amber-400 focus:outline-none"
    >
      <option value="">Campaign default</option>
      {segments.filter((segment) => segment.is_active).map((segment) => (
        <option key={segment.id} value={segment.id}>{segment.badge_text || segment.title || segment.code}</option>
      ))}
    </select>
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header with Stats */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-2.5 text-slate-950 shadow-md shadow-amber-500/20">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Spin & Win Wheel Module
                </h1>
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-900 uppercase">
                  VIP Rewards
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Manage the interactive prize wheel, send invitation emails to customers, and track rewards.
              </p>
            </div>
          </div>

          {stats && (
            <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-2.5 shadow-sm text-xs">
              <div>
                <span className="block text-slate-400 font-medium">Total Spins</span>
                <span className="font-extrabold text-sm text-slate-900">{stats.total_spins}</span>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <span className="block text-slate-400 font-medium">Active Vouchers</span>
                <span className="font-extrabold text-sm text-amber-600">{stats.total_active_vouchers}</span>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <span className="block text-slate-400 font-medium">Redeemed</span>
                <span className="font-extrabold text-sm text-emerald-600">{stats.total_redeemed}</span>
              </div>
            </div>
          )}
        </header>

        {/* Global Feedback Banner */}
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

        {/* Top Feature Card: Payment Completion Automation */}
        <section className="rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-50 via-white to-pink-50 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-amber-400/20 p-2 text-amber-700">
                <Crown size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Automatic Wheel Invitation on Completed Payment
                </h2>
                <p className="text-xs text-slate-600 max-w-xl mt-0.5">
                  When a customer completes payment through checkout or customer review link,
                  automatically send them an invitation email with a direct link to spin the prize wheel.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-slate-700">
                {settings.auto_send_on_payment ? 'Auto-send Enabled' : 'Auto-send Disabled'}
              </span>
              <button
                type="button"
                onClick={() => void toggleAutoSend(!settings.auto_send_on_payment)}
                disabled={busy}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.auto_send_on_payment ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.auto_send_on_payment ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Two-Column Layout: Live Wheel Preview (Left) & Send Campaign Form (Right) */}
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left: Interactive Wheel Live Preview */}
          <section className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-xl flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Interactive Wheel Preview
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Live Test Mode</span>
            </div>

            {/* The Live Interactive Wheel Component */}
            <div className="my-3 w-full flex justify-center">
              <SpinWheel segments={previewSegments} isPreview={true} />
            </div>

            <p className="mt-3 text-center text-[11px] text-slate-400 max-w-xs">
              Click <strong>SPIN</strong> in the center to test the wind-up physical easing,
              needle flicking, and confetti celebration.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-800 w-full flex items-center justify-between text-xs text-slate-400">
              <span>Customer Direct Link:</span>
              <Link
                href="/rewards/spin"
                target="_blank"
                className="flex items-center gap-1 font-mono text-amber-400 hover:underline"
              >
                <span>/rewards/spin</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          </section>

          {/* Right: Send Spin Wheel Email Campaign */}
          <section className="lg:col-span-7 space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                  <Mail size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Send Spin Wheel Invitation
                  </h2>
                  <p className="text-xs text-slate-500">
                    Choose which customers should receive a VIP invitation to spin the wheel.
                  </p>
                </div>
              </div>
            </div>

            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Email subject</span>
              <input
                maxLength={180}
                value={campaign.subject}
                onChange={(e) => setCampaign({ ...campaign, subject: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium focus:border-amber-400 focus:outline-none"
                placeholder="🎁 Spin to Win Your Exclusive Print Reward! | Erry Imprints"
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Default reward for selected recipients (optional)</span>
              <select value={rewardId} onChange={(e) => setRewardId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-amber-400 focus:outline-none">
                <option value="">Standard / Random prize wheel (weighted probabilities)</option>
                {segments.filter((segment) => segment.is_active).map((segment) => (
                  <option key={segment.id} value={segment.id}>{segment.title || segment.badge_text || segment.code} · {categories.find((category) => Number(category.id) === Number(segment.category_id))?.name || 'Default'}</option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-slate-500">Choose a default reward for everyone in this campaign. You can override it for individual recipients below; leave blank for weighted random prizes.</span>
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Headline</span>
              <input
                maxLength={180}
                value={campaign.headline}
                onChange={(e) => setCampaign({ ...campaign, headline: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium focus:border-amber-400 focus:outline-none"
                placeholder="You've Unlocked a Free Spin!"
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Promotional Message</span>
              <textarea
                rows={3}
                maxLength={5000}
                value={campaign.message}
                onChange={(e) => setCampaign({ ...campaign, message: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-amber-400 focus:outline-none"
                placeholder="Thank you for completing your payment! You are invited to spin our prize wheel..."
              />
            </label>

            {/* Recipient Picker */}
            <div className="rounded-2xl bg-slate-50 p-4 space-y-2 border border-slate-100">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Who should receive this invitation?</span>
                <span className="text-slate-500">
                  {allOrdersSelected
                    ? 'All orders, regardless of payment status'
                    : `${selectedOrderIds.length + selectedCustomerIds.length + selectedContactIds.length} selected`}
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={allOrdersSelected}
                  onChange={(e) => {
                    setAllOrdersSelected(e.target.checked);
                    setSelectedOrderIds([]);
                    setSelectedCustomerIds([]);
                    setSelectedContactIds([]);
                  }}
                  className="rounded"
                />
                <span>Send to all order customers, whether paid or unpaid</span>
              </label>

              {!allOrdersSelected && (
                <div className="max-h-64 overflow-auto rounded-xl border bg-white divide-y text-xs">
                  {paidOrders.length > 0 && (
                    <div className="bg-slate-100/70 px-3 py-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10">
                      Recent Orders · Any Payment Status ({paidOrders.length})
                    </div>
                  )}
                  {paidOrders.map((po) => {
                    const isSelected = selectedOrderIds.includes(po.order_id);
                    return (
                      <div
                        key={po.order_id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50"
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
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
                            className="rounded"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">
                                #{po.order_number}
                              </span>
                              <span className="text-slate-700 truncate">{po.name}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">{po.email}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="block font-semibold text-slate-800">
                              AUD ${Number(po.total).toFixed(2)}
                            </span>
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                po.has_spun
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {po.has_spun ? 'Already spun' : `${(po.payment_status || 'unpaid').replaceAll('_', ' ')} · Ready to spin`}
                            </span>
                          </div>
                        </label>
                        {renderRewardAssignment(`order:${po.order_id}`)}
                      </div>
                    );
                  })}
                  {customers.length > 0 && (
                    <div className="bg-slate-100/70 px-3 py-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10">
                      Registered Customers ({customers.length})
                    </div>
                  )}
                  {customers.map((c) => {
                    const isSelected = selectedCustomerIds.includes(c.id);
                    return (
                      <div key={`customer-${c.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              setSelectedCustomerIds((prev) =>
                                e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                              )
                            }
                            className="rounded"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block font-semibold text-slate-800">{c.name}</span>
                            <span className="text-[11px] text-slate-400">{c.email} {c.company_name ? `· ${c.company_name}` : ''}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">Customer Account</span>
                        </label>
                        {renderRewardAssignment(`customer:${c.id}`)}
                      </div>
                    );
                  })}
                  {contacts.length > 0 && (
                    <div className="bg-slate-100/70 px-3 py-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10">
                      Marketing Contacts ({contacts.length})
                    </div>
                  )}
                  {contacts.map((contact) => {
                    const isSelected = selectedContactIds.includes(contact.id);
                    return <div key={`contact-${contact.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input type="checkbox" checked={isSelected} onChange={(e) => setSelectedContactIds((prev) => e.target.checked ? [...prev, contact.id] : prev.filter((id) => id !== contact.id))} className="rounded" />
                        <div className="min-w-0 flex-1"><span className="block font-semibold text-slate-800">{contact.name}</span><span className="text-[11px] text-slate-400">{contact.email} · Added recipient</span></div>
                      </label>
                      {renderRewardAssignment(`contact:${contact.id}`)}
                    </div>;
                  })}
                </div>
              )}
              {!allOrdersSelected && <div className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_1fr_auto]">
                <input value={newRecipient.name} onChange={(e) => setNewRecipient((prev) => ({ ...prev, name: e.target.value }))} placeholder="New recipient name" className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs" />
                <input type="email" value={newRecipient.email} onChange={(e) => setNewRecipient((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email address" className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs" />
                <button type="button" onClick={() => void addCampaignRecipient()} disabled={busy} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Add recipient</button>
                <label className="sm:col-span-3 flex items-start gap-2 text-[11px] text-slate-600"><input type="checkbox" checked={newRecipient.consent} onChange={(e) => setNewRecipient((prev) => ({ ...prev, consent: e.target.checked }))} className="mt-0.5 rounded" /><span>I confirm this person agreed to receive promotional Spin Wheel emails.</span></label>
              </div>}
            </div>

            {/* Email Preview Snippet */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <Mail size={13} />
                <span>Customer Email Preview</span>
              </div>
              <p className="mt-1 font-bold text-sm text-slate-900">{campaign.headline}</p>
              <p className="mt-0.5 text-slate-700 line-clamp-2">{campaign.message}</p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-amber-800 bg-white border border-amber-300 px-2.5 py-1 rounded-lg">
                <Sparkles size={11} className="text-amber-500" />
                <span>Includes Direct One-Time Spin Token Link</span>
              </div>
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={sendInvitationCampaign}
              disabled={busy || (!allOrdersSelected && selectedOrderIds.length === 0 && selectedCustomerIds.length === 0 && selectedContactIds.length === 0)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 py-3 font-bold text-slate-950 hover:brightness-105 disabled:opacity-40 shadow-md shadow-amber-500/20"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              <span>Send Spin Wheel Invitation</span>
            </button>
          </section>
        </div>

        {/* Bottom Table: Spin Ledger & Won Rewards */}
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                <span>Recent Spin Wins & Reward Vouchers</span>
              </h2>
              <p className="text-xs text-slate-500">
                Live audit trail of winning spins, issued discount codes, and redemption status.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
          </div>

          {ledger.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
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
                  {ledger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold block text-slate-900">
                          {row.user?.name || row.order?.user?.name || 'Customer'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {row.order?.order_number ? `#${row.order.order_number}` : 'VIP Spin'}
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
    </main>
  );
}
