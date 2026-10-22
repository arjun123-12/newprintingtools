'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Gift,
  Coins,
  ShieldCheck,
  Crown,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  Search,
  ExternalLink,
} from 'lucide-react';
import { spinWinService } from '@/services/spinWinService';

interface SegmentConfig {
  id?: number;
  code: string;
  title: string;
  reward_type: 'print_credit' | 'free_product' | 'premium_upgrade' | 'shipping_upgrade';
  badge_text?: string;
  value: number;
  terms_text: string;
  how_to_use: string;
  color_bg: string;
  color_text: string;
  probability_weight: number;
  min_order_spend: number;
  expiry_days: number;
  is_active: boolean;
  sort_order: number;
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'spin_win' | 'ledger' | 'gateways'>('spin_win');

  // Spin & Win Settings State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [minOrderSpend, setMinOrderSpend] = useState<number>(0);
  const [bannerTitle, setBannerTitle] = useState('SPIN & WIN');
  const [bannerSubtitle, setBannerSubtitle] = useState('AMAZING PRINTING REWARDS AWAIT!');
  const [bannerTagline, setBannerTagline] = useState('Play the wheel and unlock exciting rewards for your business.');

  const [segments, setSegments] = useState<SegmentConfig[]>([]);
  const [stats, setStats] = useState({
    total_spins: 0,
    total_rewards_issued: 0,
    total_active_vouchers: 0,
    total_redeemed: 0,
  });

  // Ledger state
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerItems, setLedgerItems] = useState<any[]>([]);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatus, setLedgerStatus] = useState('');

  // Load Settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await spinWinService.getAdminSettings();
      if (data) {
        setEnabled(data.settings?.enabled ?? true);
        setMinOrderSpend(Number(data.settings?.min_order_spend ?? 0));
        setBannerTitle(data.settings?.banner_title ?? 'SPIN & WIN');
        setBannerSubtitle(data.settings?.banner_subtitle ?? 'AMAZING PRINTING REWARDS AWAIT!');
        setBannerTagline(data.settings?.banner_tagline ?? 'Play the wheel and unlock exciting rewards for your business.');
        setSegments(data.segments ?? []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Could not load Spin & Win settings.');
    } finally {
      setLoading(false);
    }
  };

  // Load Ledger
  const fetchLedger = async () => {
    try {
      setLedgerLoading(true);
      const res = await spinWinService.getAdminLedger({
        search: ledgerSearch,
        status: ledgerStatus || undefined,
      });
      setLedgerItems(res?.data ?? []);
    } catch (err: any) {
      console.warn('Could not load ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
      void fetchLedger();
    }
  }, [activeTab, ledgerSearch, ledgerStatus]);

  // Handle Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await spinWinService.updateAdminSettings({
        enabled,
        min_order_spend: Number(minOrderSpend),
        banner_title: bannerTitle,
        banner_subtitle: bannerSubtitle,
        banner_tagline: bannerTagline,
        segments,
      });
      setSuccessMsg('Spin & Win reward segments and settings saved successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      void fetchSettings();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSegment = (index: number, field: keyof SegmentConfig, value: any) => {
    setSegments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddSegment = () => {
    const newSeg: SegmentConfig = {
      code: `custom_reward_${Date.now()}`,
      title: 'New Reward Prize',
      reward_type: 'print_credit',
      badge_text: '$15',
      value: 15.00,
      terms_text: 'Valid on future print orders over $50.',
      how_to_use: 'Apply code at checkout on future print orders.',
      color_bg: '#fef08a',
      color_text: '#854d0e',
      probability_weight: 15,
      min_order_spend: 0.00,
      expiry_days: 90,
      is_active: true,
      sort_order: segments.length + 1,
    };
    setSegments((prev) => [...prev, newSeg]);
  };

  const handleDeleteSegment = (index: number) => {
    if (segments.length <= 4) {
      alert('The wheel requires at least 4 segments for circular balance.');
      return;
    }
    setSegments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-pink-500" />
            <h1 className="text-2xl font-black text-white tracking-tight">Platform Settings</h1>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Configure Spin & Win reward wheel, promotional rules, durable prize ledgers, and gateway parameters.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('spin_win')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'spin_win'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Spin & Win Wheel
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'ledger'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Durable Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gateways')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'gateways'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            BPOINT Gateway
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Spins Completed</span>
          <span className="text-2xl font-black text-white mt-1 block">{stats.total_spins}</span>
          <span className="text-[10px] text-emerald-400 font-medium">100% Verified Paid Orders</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Rewards Issued</span>
          <span className="text-2xl font-black text-pink-400 mt-1 block">{stats.total_rewards_issued}</span>
          <span className="text-[10px] text-slate-400 font-medium">Recorded in Durable Ledger</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Vouchers Available</span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">{stats.total_active_vouchers}</span>
          <span className="text-[10px] text-amber-300/80 font-medium">Ready for Checkout Use</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Redeemed on Future Orders</span>
          <span className="text-2xl font-black text-sky-400 mt-1 block">{stats.total_redeemed}</span>
          <span className="text-[10px] text-sky-300 font-medium">Applied toward Future Jobs</span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-950/80 border border-rose-500/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: SPIN & WIN CONFIGURATION */}
      {activeTab === 'spin_win' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* General Promotion Controls */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>Spin & Win Wheel Promotion Controls</span>
              </h2>

              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-200 block">Promotional Status</label>
                  <p className="text-[11px] text-slate-400 mt-0.5">Toggle wheel availability after paid orders</p>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-5 h-5 accent-pink-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-1">
                <label className="text-xs font-bold text-slate-200 block">Min. Order Spend (AUD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minOrderSpend}
                  onChange={(e) => setMinOrderSpend(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500"
                />
                <span className="text-[10px] text-slate-400">Set 0.00 for all paid orders to qualify</span>
              </div>

              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-1">
                <label className="text-xs font-bold text-slate-200 block">Banner Headline</label>
                <input
                  type="text"
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500"
                />
                <span className="text-[10px] text-slate-400">Displayed prominently on the wheel header</span>
              </div>
            </div>
          </div>

          {/* Configurable Reward Segments */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-pink-400" />
                  <span>Configured Wheel Reward Segments ({segments.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Server selects winning segments securely based on configured weights. Client animation renders these exact slices.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSegment}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 text-pink-400" />
                <span>Add Segment</span>
              </button>
            </div>

            <div className="space-y-3">
              {segments.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  className="bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 transition-all space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-black">
                        {idx + 1}
                      </span>
                      <input
                        type="color"
                        value={seg.color_bg || '#fef08a'}
                        onChange={(e) => handleUpdateSegment(idx, 'color_bg', e.target.value)}
                        className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer"
                        title="Pick slice color"
                      />
                      <input
                        type="text"
                        value={seg.title}
                        onChange={(e) => handleUpdateSegment(idx, 'title', e.target.value)}
                        placeholder="Segment Title"
                        className="font-bold text-sm bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-pink-500"
                      />
                      <input
                        type="text"
                        value={seg.badge_text || ''}
                        onChange={(e) => handleUpdateSegment(idx, 'badge_text', e.target.value)}
                        placeholder="Badge (e.g. FREE, $25)"
                        className="w-24 text-xs font-black bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-pink-300 focus:outline-none focus:border-pink-500 uppercase"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">Active:</span>
                        <input
                          type="checkbox"
                          checked={seg.is_active}
                          onChange={(e) => handleUpdateSegment(idx, 'is_active', e.target.checked)}
                          className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSegment(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                        title="Remove Segment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Reward Type</label>
                      <select
                        value={seg.reward_type}
                        onChange={(e) => handleUpdateSegment(idx, 'reward_type', e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-pink-500"
                      >
                        <option value="print_credit">Print Credit (Wallet Dollar)</option>
                        <option value="free_product">Free Product Voucher</option>
                        <option value="premium_upgrade">Premium Finish Upgrade</option>
                        <option value="shipping_upgrade">Free Shipping Upgrade</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Value ($ AUD)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={seg.value}
                        onChange={(e) => handleUpdateSegment(idx, 'value', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">
                        Odds Weight ({seg.probability_weight})
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={seg.probability_weight}
                        onChange={(e) => handleUpdateSegment(idx, 'probability_weight', parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Validity (Days)</label>
                      <input
                        type="number"
                        min="1"
                        value={seg.expiry_days}
                        onChange={(e) => handleUpdateSegment(idx, 'expiry_days', parseInt(e.target.value) || 30)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Terms & Conditions</label>
                      <input
                        type="text"
                        value={seg.terms_text}
                        onChange={(e) => handleUpdateSegment(idx, 'terms_text', e.target.value)}
                        placeholder="e.g. Valid on standard 350gsm Silk Business Cards..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">How to Use (Customer Instructions)</label>
                      <input
                        type="text"
                        value={seg.how_to_use}
                        onChange={(e) => handleUpdateSegment(idx, 'how_to_use', e.target.value)}
                        placeholder="e.g. Added to your Print Bank. Redeem at checkout..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: DURABLE REWARD LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span>Durable Customer Reward & Spin Ledger</span>
              </h2>
              <p className="text-xs text-slate-400">
                Auditable historical record of each verified spin entitlement, prize awarded, and voucher redemption.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search code or order..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                />
              </div>

              <select
                value={ledgerStatus}
                onChange={(e) => setLedgerStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="redeemed">Redeemed</option>
                <option value="expired">Expired</option>
              </select>

              <button
                type="button"
                onClick={fetchLedger}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
                title="Refresh Ledger"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-pink-500 mb-2" />
              <p className="text-xs">Loading ledger entries...</p>
            </div>
          ) : ledgerItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No reward records found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Reward Code</th>
                    <th className="py-2.5 px-3">Prize Title</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Value</th>
                    <th className="py-2.5 px-3">Customer / Order</th>
                    <th className="py-2.5 px-3">Expires</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200 font-medium">
                  {ledgerItems.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-pink-300">{item.reward_code}</td>
                      <td className="py-3 px-3 font-semibold text-white">{item.title}</td>
                      <td className="py-3 px-3 uppercase text-[10px] text-slate-400">
                        {item.reward_type?.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-300">
                        {Number(item.value) > 0 ? `$${Number(item.value).toFixed(2)}` : 'FREE'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold">{item.user?.name || 'Guest Checkout'}</div>
                        <span className="text-[10px] text-slate-400">Order #{item.order?.order_number || 'N/A'}</span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-400">
                        {new Date(item.expires_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : item.status === 'redeemed'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BPOINT PAYMENT GATEWAY DETAILS */}
      {activeTab === 'gateways' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">BPOINT Payment Gateway (PCI-DSS SAQ-A)</h2>
              <p className="text-xs text-slate-400">Server environment parameters configured in Laravel <code>.env</code></p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="font-bold text-slate-300 block">Security & Integrity Controls</span>
              <ul className="space-y-1.5 text-slate-400 text-[11px] list-disc list-inside">
                <li>Server-authoritative payment verification via BPOINT v5 API</li>
                <li>Zero cardholder data stored on premises (Hosted iFrame tokenization)</li>
                <li>Spin entitlements locked to verified payment success</li>
                <li>Atomic transactions prevent multi-tab and double-spin exploits</li>
              </ul>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="font-bold text-slate-300 block">Environment Variable Reference</span>
              <div className="space-y-1 text-slate-400 font-mono text-[10.5px]">
                <div><code>BPOINT_ENABLED=true</code></div>
                <div><code>BPOINT_MERCHANT_NUMBER=...</code></div>
                <div><code>BPOINT_API_USERNAME=...</code></div>
                <div><code>BPOINT_BASE_URL=https://www.bpoint.com.au/rest/v5</code></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
