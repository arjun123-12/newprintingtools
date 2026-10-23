'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Gift,
  Coins,
  ShieldCheck,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  Tag,
  Edit2,
  FolderPlus,
  Archive,
  Layers,
  Info,
  X,
  Package,
} from 'lucide-react';
import { spinWinService, RewardCategory } from '@/services/spinWinService';

interface SegmentConfig {
  id?: number;
  category_id?: number | null;
  category_code?: string;
  category_name?: string;
  code: string;
  title: string;
  reward_type: 'print_credit' | 'free_product' | 'premium_upgrade' | 'shipping_upgrade';
  badge_text?: string;
  value: number;
  inventory?: number | null | '';
  inventory_consumed?: number;
  description?: string;
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
  const [activeTab, setActiveTab] = useState<'spin_win' | 'categories' | 'ledger' | 'gateways'>('spin_win');

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

  const [categories, setCategories] = useState<RewardCategory[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | 'all'>('all');
  const [segments, setSegments] = useState<SegmentConfig[]>([]);

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RewardCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: '',
    icon: 'tag',
    is_default: false,
    is_active: true,
    sort_order: 1,
  });
  const [categorySaving, setCategorySaving] = useState(false);

  const [stats, setStats] = useState({
    total_spins: 0,
    total_rewards_issued: 0,
    total_active_vouchers: 0,
    total_redeemed: 0,
    total_categories: 0,
    active_categories: 0,
  });

  // Ledger state
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerItems, setLedgerItems] = useState<any[]>([]);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatus, setLedgerStatus] = useState('');
  const [ledgerCategory, setLedgerCategory] = useState<string>('');

  // Load Settings and Categories
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
        setCategories(data.categories ?? []);
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
        category_id: ledgerCategory ? Number(ledgerCategory) : undefined,
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
  }, [activeTab, ledgerSearch, ledgerStatus, ledgerCategory]);

  // Handle Save All Settings and Segments
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const sanitizedSegments = segments.map((s) => ({
        ...s,
        inventory: s.inventory !== '' && s.inventory !== null && s.inventory !== undefined ? Number(s.inventory) : null,
        category_id: s.category_id ? Number(s.category_id) : (categories.find((c) => c.is_default)?.id || null),
      }));

      await spinWinService.updateAdminSettings({
        enabled,
        min_order_spend: Number(minOrderSpend),
        banner_title: bannerTitle,
        banner_subtitle: bannerSubtitle,
        banner_tagline: bannerTagline,
        segments: sanitizedSegments,
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
    const defaultCat = categories.find((c) => c.is_default) || categories[0];
    const initialCatId = selectedCategoryFilter !== 'all' ? selectedCategoryFilter : defaultCat?.id;

    const newSeg: SegmentConfig = {
      category_id: initialCatId,
      code: `custom_reward_${Date.now()}`,
      title: 'New Reward Prize',
      reward_type: 'print_credit',
      badge_text: '$15',
      value: 15.0,
      inventory: null,
      description: 'Exclusive reward for customer orders.',
      terms_text: 'Valid on future print orders over $50.',
      how_to_use: 'Apply code at checkout on future print orders.',
      color_bg: '#fef08a',
      color_text: '#854d0e',
      probability_weight: 15,
      min_order_spend: 0.0,
      expiry_days: 90,
      is_active: true,
      sort_order: segments.length + 1,
    };
    setSegments((prev) => [...prev, newSeg]);
  };

  const handleDeleteSegment = async (index: number, segId?: number) => {
    if (segments.length <= 4) {
      alert('The wheel requires at least 4 segments for circular balance.');
      return;
    }

    if (segId) {
      if (!confirm('Are you sure you want to permanently delete this reward segment?')) return;
      try {
        await spinWinService.deleteAdminReward(segId);
        setSegments((prev) => prev.filter((s) => s.id !== segId));
        setSuccessMsg('Reward segment deleted.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        alert(err.response?.data?.message || 'Could not delete reward segment.');
      }
    } else {
      setSegments((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Open modal for new category
  const handleOpenNewCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      code: '',
      description: '',
      icon: 'tag',
      is_default: false,
      is_active: true,
      sort_order: categories.length + 1,
    });
    setShowCategoryModal(true);
  };

  // Open modal for editing category
  const handleOpenEditCategory = (cat: RewardCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      code: cat.code,
      description: cat.description || '',
      icon: cat.icon || 'tag',
      is_default: cat.is_default,
      is_active: cat.is_active,
      sort_order: cat.sort_order,
    });
    setShowCategoryModal(true);
  };

  // Save category (create or update)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategorySaving(true);
    try {
      if (editingCategory) {
        await spinWinService.updateAdminCategory(editingCategory.id, categoryForm);
        setSuccessMsg(`Category '${categoryForm.name}' updated successfully.`);
      } else {
        await spinWinService.createAdminCategory(categoryForm);
        setSuccessMsg(`Category '${categoryForm.name}' created successfully.`);
      }
      setShowCategoryModal(false);
      setTimeout(() => setSuccessMsg(null), 3500);
      void fetchSettings();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Could not save category.');
    } finally {
      setCategorySaving(false);
    }
  };

  // Delete category with safe handling notice
  const handleDeleteCategory = async (cat: RewardCategory) => {
    if (cat.is_default || cat.code === 'default') {
      alert('The Default category cannot be deleted as it is required as the universal system fallback.');
      return;
    }

    const defaultCat = categories.find((c) => c.is_default);
    const confirmMsg = `Are you sure you want to delete '${cat.name}'?\n\nSafe Handling Notice: Any existing rewards under this category will automatically be migrated to '${defaultCat?.name || 'Default'}' so no historical or active reward data is lost.`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await spinWinService.deleteAdminCategory(cat.id);
      setSuccessMsg(res.message || `Category '${cat.name}' deleted safely.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      void fetchSettings();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Could not delete category.');
    }
  };

  // Filtered segments for display
  const displayedSegments = selectedCategoryFilter === 'all'
    ? segments
    : segments.filter((s) => s.category_id === selectedCategoryFilter);

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
            Configure Category-Based Spin & Win rewards, promotional categories, inventory caps, and durable ledgers.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-bold gap-1">
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
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'categories'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Reward Categories ({categories.length})
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Reward Categories</span>
          <span className="text-2xl font-black text-pink-400 mt-1 block">{categories.length}</span>
          <span className="text-[10px] text-slate-400 font-medium">Active: {categories.filter(c => c.is_active).length}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Configured Rewards</span>
          <span className="text-2xl font-black text-amber-300 mt-1 block">{segments.length}</span>
          <span className="text-[10px] text-slate-400 font-medium">Active: {segments.filter(s => s.is_active).length}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Vouchers in Circulation</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">{stats.total_active_vouchers}</span>
          <span className="text-[10px] text-slate-400 font-medium">Redeemed: {stats.total_redeemed}</span>
        </div>
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-950/60 border border-emerald-600/50 rounded-2xl text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-rose-950/60 border border-rose-600/50 rounded-2xl text-rose-300 text-xs font-semibold animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: SPIN & WIN WHEEL CONFIGURATION */}
      {activeTab === 'spin_win' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-400" />
                  <span>Promotional Rules & Global Banner</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Controls qualification thresholds and header copy on the post-payment reward modal.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-pink-600/25 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">Promotion Status</label>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  {enabled ? 'Active — Customers spin after verified payment.' : 'Disabled — Wheel is hidden.'}
                </p>
              </div>

              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-1">
                <label className="text-xs font-bold text-slate-200 block">Minimum Order Spend ($ AUD)</label>
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

          {/* Configurable Reward Segments with Category Filter */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-pink-400" />
                  <span>Configured Wheel Reward Segments ({segments.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rewards are organized by business category. Limited inventory rewards decrement atomically upon winning.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSegment}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition self-start md:self-auto"
              >
                <Plus className="w-3.5 h-3.5 text-pink-400" />
                <span>Add Reward</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter by Category:</span>
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Rewards ({segments.length})
              </button>
              {categories.map((cat) => {
                const count = segments.filter((s) => s.category_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedCategoryFilter === cat.id
                        ? 'bg-pink-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                      {count}
                    </span>
                    {cat.is_default && (
                      <span className="text-[9px] text-amber-300 font-bold uppercase">(Default)</span>
                    )}
                  </button>
                );
              })}
            </div>

            {displayedSegments.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 text-xs space-y-2">
                <Package className="w-6 h-6 mx-auto text-slate-500" />
                <p>No rewards found for the selected category.</p>
                <button
                  type="button"
                  onClick={handleAddSegment}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-pink-600/20 text-pink-300 hover:bg-pink-600/30 rounded-lg text-xs font-bold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Reward to this Category</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedSegments.map((seg, idx) => {
                  const originalIndex = segments.findIndex((s) => s.code === seg.code);
                  return (
                    <div
                      key={seg.id || seg.code || idx}
                      className="bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 transition-all space-y-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-black">
                            {idx + 1}
                          </span>
                          <input
                            type="color"
                            value={seg.color_bg || '#fef08a'}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'color_bg', e.target.value)}
                            className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer"
                            title="Pick slice color"
                          />
                          <input
                            type="text"
                            value={seg.title}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'title', e.target.value)}
                            placeholder="Segment Title"
                            className="font-bold text-sm bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-pink-500"
                          />
                          <input
                            type="text"
                            value={seg.badge_text || ''}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'badge_text', e.target.value)}
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
                              onChange={(e) => handleUpdateSegment(originalIndex, 'is_active', e.target.checked)}
                              className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteSegment(originalIndex, seg.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                            title="Remove Reward"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Category, Type, Value, Inventory, Odds, Validity */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Target Category</label>
                          <select
                            value={seg.category_id || ''}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'category_id', e.target.value ? Number(e.target.value) : null)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-pink-500"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.is_default ? '(Default)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Reward Type</label>
                          <select
                            value={seg.reward_type}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'reward_type', e.target.value as any)}
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
                            onChange={(e) => handleUpdateSegment(originalIndex, 'value', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-pink-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            Inventory Cap (Blank = Unlimited)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Unlimited"
                            value={seg.inventory === null || seg.inventory === undefined ? '' : seg.inventory}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'inventory', e.target.value === '' ? null : parseInt(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-pink-500"
                          />
                          {seg.inventory_consumed !== undefined && seg.inventory_consumed > 0 && (
                            <span className="text-[10px] text-emerald-400 mt-0.5 block">
                              Won: {seg.inventory_consumed}
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            Odds Weight ({seg.probability_weight})
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={seg.probability_weight}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'probability_weight', parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-pink-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Validity (Days)</label>
                          <input
                            type="number"
                            min="1"
                            value={seg.expiry_days}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'expiry_days', parseInt(e.target.value) || 30)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>

                      {/* Description, Terms, Instructions */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Reward Description</label>
                          <input
                            type="text"
                            value={seg.description || ''}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'description', e.target.value)}
                            placeholder="e.g. 100 Premium Silk Business Cards with double-sided print"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-pink-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Terms & Conditions</label>
                          <input
                            type="text"
                            value={seg.terms_text}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'terms_text', e.target.value)}
                            placeholder="e.g. Valid on standard 350gsm Silk Business Cards..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-pink-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Usage Instructions (How to Redeem)</label>
                          <input
                            type="text"
                            value={seg.how_to_use}
                            onChange={(e) => handleUpdateSegment(originalIndex, 'how_to_use', e.target.value)}
                            placeholder="e.g. Added to your Print Bank. Redeem at checkout..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      )}

      {/* TAB 2: REWARD CATEGORIES MANAGEMENT */}
      {activeTab === 'categories' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-pink-400" />
                <span>Spin & Win Reward Categories</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Organize tailored reward wheels for specific industries. Deleting a category automatically migrates its rewards to Default so data is never lost.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenNewCategory}
              className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-pink-600/20 transition"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const count = segments.filter((s) => s.category_id === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className={`bg-slate-950/80 border rounded-2xl p-5 space-y-4 transition ${
                    cat.is_default
                      ? 'border-amber-500/40 shadow-sm shadow-amber-500/10'
                      : 'border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{cat.name}</span>
                        {cat.is_default && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Default / Fallback
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-pink-400 block">code: {cat.code}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cat.is_active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {cat.description || 'No description provided.'}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Gift className="w-3.5 h-3.5 text-pink-400" />
                      <span className="font-bold text-slate-200">{count}</span>
                      <span>Configured Rewards</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        title="Edit Category"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {!cat.is_default && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                          title="Safely Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DURABLE REWARD LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span>Durable Customer Reward & Spin Ledger</span>
              </h2>
              <p className="text-xs text-slate-400">
                Auditable historical record of each verified spin entitlement, category assigned, and voucher redemption.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search code, category or order..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                />
              </div>

              <select
                value={ledgerCategory}
                onChange={(e) => setLedgerCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

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
                    <th className="py-2.5 px-3">Category</th>
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
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                          {item.category_name || item.category?.name || 'Default / General'}
                        </span>
                      </td>
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

      {/* TAB 4: BPOINT PAYMENT GATEWAY DETAILS */}
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
                <li>Category-targeted rewards with atomic inventory decrements</li>
                <li>Spin entitlements strictly locked to verified payment success</li>
                <li>Idempotent requests prevent double-awarding on refreshes or multiple tabs</li>
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

      {/* CREATE / EDIT CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Tag className="w-4 h-4 text-pink-400" />
                <span>{editingCategory ? 'Edit Reward Category' : 'Create Reward Category'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g. Health & Fitness"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Slug Code (Optional)</label>
                <input
                  type="text"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  placeholder="auto-generated from name if left empty"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Target audience and industry details"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">Default Fallback Category</span>
                  <span className="text-[10px] text-slate-400">Used when customers have no category</span>
                </div>
                <input
                  type="checkbox"
                  checked={categoryForm.is_default}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_default: e.target.checked })}
                  className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">Active Status</span>
                  <span className="text-[10px] text-slate-400">Enable category for spins and rewards</span>
                </div>
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={categorySaving}
                  className="px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl font-bold shadow-lg shadow-pink-600/20 transition disabled:opacity-50"
                >
                  {categorySaving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
