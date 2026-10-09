'use client';

import React, { useState, useMemo } from 'react';
import { FormSection, FormGrid, AdminNumberInput } from '@/components/admin/shared';
import {
  ProductFormData,
  FormErrors,
  PricingTierItem,
  FoldingPricingConfig,
  FoldingPricingTier,
  FoldingPricingMethod,
  FoldingOptionConfig,
} from './types';
import {
  Plus,
  Trash2,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Check,
  AlertCircle,
  Edit2,
  X,
  Star,
  CheckCircle2,
  Sliders,
  HelpCircle,
} from 'lucide-react';

interface ProductPricingProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  errors: FormErrors;
}

// 7 Supported Standard Folding Types
export const STANDARD_FOLDING_TYPES = [
  { value: 'no_fold', label: 'No Folding (Flat Sheet)', defaultCharge: 0, defaultMethod: 'per_order' as FoldingPricingMethod },
  { value: 'half_fold', label: 'Half Fold', defaultCharge: 10, defaultMethod: 'per_order' as FoldingPricingMethod },
  { value: 'tri_fold', label: 'Tri-Fold / Letter Fold', defaultCharge: 15, defaultMethod: 'quantity_based' as FoldingPricingMethod },
  { value: 'z_fold', label: 'Z-Fold', defaultCharge: 15, defaultMethod: 'quantity_based' as FoldingPricingMethod },
  { value: 'gate_fold', label: 'Gate Fold', defaultCharge: 20, defaultMethod: 'quantity_based' as FoldingPricingMethod },
  { value: 'double_parallel_fold', label: 'Double Parallel Fold', defaultCharge: 20, defaultMethod: 'quantity_based' as FoldingPricingMethod },
  { value: 'custom_fold', label: 'Custom Fold', defaultCharge: 25, defaultMethod: 'quantity_based' as FoldingPricingMethod },
];

export const DEFAULT_EXAMPLE_TIERS: FoldingPricingTier[] = [
  { id: 'ftier_1', min_quantity: 100, max_quantity: 249, charge: 10.00 },
  { id: 'ftier_2', min_quantity: 250, max_quantity: 499, charge: 20.00 },
  { id: 'ftier_3', min_quantity: 500, max_quantity: 999, charge: 35.00 },
  { id: 'ftier_4', min_quantity: 1000, max_quantity: null, charge: 60.00 },
];

const DEFAULT_INITIAL_OPTIONS: FoldingOptionConfig[] = [
  {
    id: 'no_fold',
    name: 'No Folding (Flat Sheet)',
    type: 'no_fold',
    active: true,
    is_active: true,
    is_default: true,
    pricing_method: 'per_order',
    charge: 0,
    tiers: [],
  },
  {
    id: 'half_fold',
    name: 'Half Fold',
    type: 'half_fold',
    active: true,
    is_active: true,
    is_default: false,
    pricing_method: 'per_order',
    charge: 10,
    tiers: [],
  },
  {
    id: 'tri_fold',
    name: 'Tri-Fold / Letter Fold',
    type: 'tri_fold',
    active: true,
    is_active: true,
    is_default: false,
    pricing_method: 'quantity_based',
    charge: 15,
    tiers: DEFAULT_EXAMPLE_TIERS,
  },
];

// Helper to normalize options from Record or Array into a clean array
function normalizeFoldingOptions(
  raw: Record<string, FoldingOptionConfig> | FoldingOptionConfig[] | undefined
): FoldingOptionConfig[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((opt, idx) => ({
      ...opt,
      id: opt.id || opt.type || `opt_${idx}`,
      name: opt.name || STANDARD_FOLDING_TYPES.find((t) => t.value === opt.type)?.label || 'Folding Option',
      type: opt.type || opt.id || 'custom_fold',
      active: opt.active !== false && opt.is_active !== false,
      is_active: opt.active !== false && opt.is_active !== false,
      is_default: Boolean(opt.is_default),
      pricing_method: opt.pricing_method || 'quantity_based',
      charge: typeof opt.charge === 'number' ? opt.charge : 10,
      tiers: opt.tiers || (opt.pricing_method === 'quantity_based' ? DEFAULT_EXAMPLE_TIERS : []),
    }));
  }
  return Object.entries(raw).map(([key, opt], idx) => ({
    ...opt,
    id: opt.id || key,
    name: opt.name || STANDARD_FOLDING_TYPES.find((t) => t.value === (opt.type || key))?.label || key,
    type: opt.type || key,
    active: opt.active !== false && opt.is_active !== false,
    is_active: opt.active !== false && opt.is_active !== false,
    is_default: Boolean(opt.is_default),
    pricing_method: opt.pricing_method || 'quantity_based',
    charge: typeof opt.charge === 'number' ? opt.charge : 10,
    tiers: opt.tiers || (opt.pricing_method === 'quantity_based' ? DEFAULT_EXAMPLE_TIERS : []),
  }));
}

// Robust tier validation (sorts a copy without mutating the display order)
export function validateFoldingTiers(tiers: FoldingPricingTier[]): string[] {
  const errs: string[] = [];
  if (!tiers || tiers.length === 0) {
    errs.push('Quantity-based pricing requires at least one quantity tier.');
    return errs;
  }

  tiers.forEach((tier, index) => {
    const tierNum = index + 1;
    const min = Number(tier.min_quantity);
    if (!Number.isInteger(min) || min < 1) {
      errs.push(`Tier #${tierNum}: Minimum quantity must be a positive integer.`);
    }

    if (tier.max_quantity !== null && tier.max_quantity !== '' && tier.max_quantity !== undefined) {
      const max = Number(tier.max_quantity);
      if (!Number.isInteger(max)) {
        errs.push(`Tier #${tierNum}: Maximum quantity must be an integer.`);
      } else if (max < min) {
        errs.push(`Tier #${tierNum}: Maximum quantity (${max}) must be greater than or equal to minimum quantity (${min}).`);
      }
    }

    const charge = Number(tier.charge);
    if (!Number.isFinite(charge) || charge < 0) {
      errs.push(`Tier #${tierNum}: Folding charge must be a finite, non-negative number.`);
    }
  });

  // Sort a copy by min_quantity to detect overlaps regardless of display order
  const sorted = [...tiers]
    .map((t, originalIndex) => ({
      ...t,
      originalIndex,
      min: Number(t.min_quantity) || 0,
      max:
        t.max_quantity === null || t.max_quantity === '' || t.max_quantity === undefined
          ? Infinity
          : Number(t.max_quantity) || 0,
    }))
    .sort((a, b) => a.min - b.min);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.max >= next.min) {
      const maxDisplay = current.max === Infinity ? 'Unlimited' : current.max;
      errs.push(
        `Quantity ranges overlap: Tier #${current.originalIndex + 1} (${current.min}–${maxDisplay}) overlaps with Tier #${next.originalIndex + 1} (starts at ${next.min}).`
      );
    }
  }

  return errs;
}

// Calculate next tier without ever creating an overlapping tier
export function calculateNextNonOverlappingTier(tiers: FoldingPricingTier[]): FoldingPricingTier[] {
  if (!tiers || tiers.length === 0) {
    return [
      {
        id: `ftier_${Date.now()}`,
        min_quantity: 100,
        max_quantity: 249,
        charge: 10.00,
      },
    ];
  }

  const updated = [...tiers];
  // Check if any existing tier has max_quantity === null or empty (unlimited)
  const openEndedIdx = updated.findIndex(
    (t) => t.max_quantity === null || t.max_quantity === '' || t.max_quantity === undefined
  );

  if (openEndedIdx !== -1) {
    const openTier = updated[openEndedIdx];
    const openMin = Math.max(1, Number(openTier.min_quantity) || 100);
    // Cap the previous open tier with a reasonable span
    const capAt = openMin >= 1000 ? openMin + 1499 : openMin + 499;
    updated[openEndedIdx] = {
      ...openTier,
      max_quantity: capAt,
    };

    const newMin = capAt + 1;
    const lastCharge = typeof openTier.charge === 'number' ? openTier.charge : 10;
    const newTier: FoldingPricingTier = {
      id: `ftier_${Date.now()}`,
      min_quantity: newMin,
      max_quantity: null, // new top tier takes over the unlimited range
      charge: Number((lastCharge * 1.5).toFixed(2)),
    };

    return [...updated, newTier];
  }

  // All tiers have finite max_quantity: find highest max boundary across all tiers
  const highestMax = Math.max(
    ...updated.map((t) => (typeof t.max_quantity === 'number' ? t.max_quantity : Number(t.min_quantity) || 0))
  );

  const newMin = highestMax + 1;
  const lastTier = updated[updated.length - 1];
  const lastCharge = typeof lastTier?.charge === 'number' ? lastTier.charge : 10;
  const newTier: FoldingPricingTier = {
    id: `ftier_${Date.now()}`,
    min_quantity: newMin,
    max_quantity: null,
    charge: Number((lastCharge * 1.5).toFixed(2)),
  };

  return [...updated, newTier];
}

export const ProductPricing: React.FC<ProductPricingProps> = ({
  formData,
  setFormData,
  errors,
}) => {
  const [foldingPanelOpen, setFoldingPanelOpen] = useState<boolean>(true);
  const [activeOptionId, setActiveOptionId] = useState<string>('');
  const [isAddingOption, setIsAddingOption] = useState<boolean>(false);

  // New option form state
  const [newOptionType, setNewOptionType] = useState<string>('half_fold');
  const [newOptionName, setNewOptionName] = useState<string>('Half Fold');
  const [newOptionMethod, setNewOptionMethod] = useState<FoldingPricingMethod>('per_order');
  const [newOptionIsDefault, setNewOptionIsDefault] = useState<boolean>(false);
  const [newOptionError, setNewOptionError] = useState<string>('');

  // Normalize current folding_pricing config
  const rawFoldingPricing = formData.folding_pricing;
  const foldingEnabled = Boolean(rawFoldingPricing?.enabled);

  // Extract normalized options list
  const configuredOptions: FoldingOptionConfig[] = useMemo(() => {
    const list = normalizeFoldingOptions(rawFoldingPricing?.options);
    if (list.length === 0 && rawFoldingPricing?.enabled) {
      return DEFAULT_INITIAL_OPTIONS;
    }
    return list;
  }, [rawFoldingPricing]);

  // Set default active option ID if not set
  React.useEffect(() => {
    if (configuredOptions.length > 0) {
      if (!activeOptionId || !configuredOptions.some((o) => o.id === activeOptionId)) {
        const defaultOpt = configuredOptions.find((o) => o.is_default) || configuredOptions[0];
        setActiveOptionId(defaultOpt.id || defaultOpt.type || 'no_fold');
      }
    }
  }, [configuredOptions, activeOptionId]);

  // Active option being inspected/edited
  const activeOption = useMemo(() => {
    return configuredOptions.find((o) => o.id === activeOptionId) || configuredOptions[0] || null;
  }, [configuredOptions, activeOptionId]);

  // Update folding configuration helper
  const updateFoldingConfig = (
    updater: (prevOptions: FoldingOptionConfig[]) => {
      options: FoldingOptionConfig[];
      enabled?: boolean;
    }
  ) => {
    setFormData((prev) => {
      const currentList = normalizeFoldingOptions(prev.folding_pricing?.options);
      const baseList = currentList.length > 0 ? currentList : configuredOptions;
      const { options: newOptions, enabled } = updater(baseList);

      const isEnabled = enabled !== undefined ? enabled : Boolean(prev.folding_pricing?.enabled);
      const primaryOpt = newOptions.find((o) => o.is_default) || newOptions[0];

      return {
        ...prev,
        folding_pricing: {
          enabled: isEnabled,
          pricing_method: primaryOpt?.pricing_method || 'quantity_based',
          additional_charge: primaryOpt?.charge ?? 10.0,
          tiers: primaryOpt?.tiers || DEFAULT_EXAMPLE_TIERS,
          options: newOptions,
        },
      };
    });
  };

  // Toggle Folding Enabled/Disabled
  const toggleFoldingEnabled = (enabled: boolean) => {
    setFormData((prev) => {
      const currentOptions = normalizeFoldingOptions(prev.folding_pricing?.options);
      const optionsToUse = currentOptions.length > 0 ? currentOptions : DEFAULT_INITIAL_OPTIONS;
      const primaryOpt = optionsToUse.find((o) => o.is_default) || optionsToUse[0];

      return {
        ...prev,
        folding_pricing: {
          enabled,
          pricing_method: primaryOpt?.pricing_method || 'quantity_based',
          additional_charge: primaryOpt?.charge ?? 10.0,
          tiers: primaryOpt?.tiers || DEFAULT_EXAMPLE_TIERS,
          options: optionsToUse,
        },
      };
    });
  };

  // Handle adding a new folding option
  const handleCreateOption = () => {
    setNewOptionError('');
    const trimmedName = newOptionName.trim();
    if (!trimmedName) {
      setNewOptionError('Please enter a display name for the folding option.');
      return;
    }

    // Duplicate check
    const isDuplicate = configuredOptions.some(
      (o) =>
        o.type === newOptionType ||
        (o.name || '').trim().toLowerCase() === trimmedName.toLowerCase() ||
        o.id === newOptionType
    );

    if (isDuplicate) {
      setNewOptionError(`A folding option for "${trimmedName}" or style "${newOptionType}" is already configured.`);
      return;
    }

    const typeDef = STANDARD_FOLDING_TYPES.find((t) => t.value === newOptionType);
    const newId = `${newOptionType}_${Date.now()}`;

    const newOpt: FoldingOptionConfig = {
      id: newId,
      name: trimmedName,
      type: newOptionType,
      active: true,
      is_active: true,
      is_default: newOptionIsDefault,
      pricing_method: newOptionMethod,
      charge: typeDef?.defaultCharge ?? 10,
      tiers: newOptionMethod === 'quantity_based' ? DEFAULT_EXAMPLE_TIERS : [],
    };

    updateFoldingConfig((prev) => {
      let updatedList = [...prev];
      if (newOptionIsDefault) {
        updatedList = updatedList.map((o) => ({ ...o, is_default: false }));
      }
      return { options: [...updatedList, newOpt] };
    });

    setActiveOptionId(newId);
    setIsAddingOption(false);
    setNewOptionName('');
    setNewOptionIsDefault(false);
  };

  // Handle deleting an option with confirmation
  const handleDeleteOption = (optId: string) => {
    const target = configuredOptions.find((o) => o.id === optId);
    if (!target) return;

    if (configuredOptions.length <= 1) {
      alert('At least one folding option must remain configured while folding is enabled.');
      return;
    }

    const hasConfig =
      target.pricing_method === 'quantity_based'
        ? (target.tiers && target.tiers.length > 0)
        : (typeof target.charge === 'number' && target.charge > 0);

    const confirmMsg = hasConfig
      ? `Are you sure you want to delete "${target.name}"? Its configured pricing (${target.pricing_method}) will be removed.`
      : `Are you sure you want to remove the folding option "${target.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    updateFoldingConfig((prev) => {
      const remaining = prev.filter((o) => o.id !== optId);
      // If deleted option was default, make first remaining default
      if (target.is_default && remaining.length > 0) {
        remaining[0] = { ...remaining[0], is_default: true };
      }
      return { options: remaining };
    });

    if (activeOptionId === optId) {
      const nextOpt = configuredOptions.find((o) => o.id !== optId);
      if (nextOpt) setActiveOptionId(nextOpt.id || nextOpt.type || '');
    }
  };

  // Update active option property
  const updateActiveOption = (patch: Partial<FoldingOptionConfig>) => {
    if (!activeOption) return;

    updateFoldingConfig((prev) => {
      const updated = prev.map((opt) => {
        if (opt.id === activeOption.id) {
          return { ...opt, ...patch };
        }
        if (patch.is_default) {
          // Unset default on all other options
          return { ...opt, is_default: false };
        }
        return opt;
      });
      return { options: updated };
    });
  };

  // Method change for active option (preserves user-entered data)
  const handleActiveMethodChange = (newMethod: FoldingPricingMethod) => {
    if (!activeOption) return;
    updateActiveOption({
      pricing_method: newMethod,
      // If switching to quantity_based and has no tiers yet, seed example tiers
      tiers:
        newMethod === 'quantity_based' && (!activeOption.tiers || activeOption.tiers.length === 0)
          ? DEFAULT_EXAMPLE_TIERS
          : activeOption.tiers,
    });
  };

  // Add tier without overlap
  const handleAddTier = () => {
    if (!activeOption) return;
    const currentTiers = activeOption.tiers || [];
    const updatedTiers = calculateNextNonOverlappingTier(currentTiers);
    updateActiveOption({ tiers: updatedTiers });
  };

  // Update tier field
  const handleUpdateTier = (tierIdx: number, field: keyof FoldingPricingTier, val: any) => {
    if (!activeOption) return;
    const tiers = [...(activeOption.tiers || [])];
    tiers[tierIdx] = { ...tiers[tierIdx], [field]: val };
    updateActiveOption({ tiers });
  };

  // Remove tier
  const handleRemoveTier = (tierIdx: number) => {
    if (!activeOption) return;
    const tiers = (activeOption.tiers || []).filter((_, i) => i !== tierIdx);
    updateActiveOption({ tiers });
  };

  // Quick fill example tiers with confirmation
  const handleQuickFillExampleTiers = () => {
    if (!activeOption) return;
    const existing = activeOption.tiers || [];
    if (existing.length > 0) {
      const confirm = window.confirm(
        'Replace current custom folding tiers with example reference tiers (100: $10, 250: $20, 500: $35, 1000: $60)? This will overwrite current tiers.'
      );
      if (!confirm) return;
    }
    updateActiveOption({ tiers: DEFAULT_EXAMPLE_TIERS });
  };

  // Inline Tier Validation Errors for active option
  const tierValidationErrors = useMemo(() => {
    if (!foldingEnabled || !activeOption || activeOption.pricing_method !== 'quantity_based') {
      return [];
    }
    return validateFoldingTiers(activeOption.tiers || []);
  }, [foldingEnabled, activeOption]);

  // Standard Product Volume Pricing Tiers
  const addPricingTier = () => {
    const lastTier = formData.pricing_tiers[formData.pricing_tiers.length - 1];
    const nextMin =
      lastTier && typeof lastTier.maxQuantity === 'number' ? lastTier.maxQuantity + 1 : 100;

    const newTier: PricingTierItem = {
      id: `tier_${Date.now()}`,
      minQuantity: nextMin,
      maxQuantity: nextMin + 150,
      price: formData.base_price ? parseFloat((formData.base_price * 0.85).toFixed(2)) : 0,
    };

    setFormData((prev) => ({
      ...prev,
      pricing_tiers: [...prev.pricing_tiers, newTier],
    }));
  };

  const removePricingTier = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      pricing_tiers: prev.pricing_tiers.filter((_, i) => i !== index),
    }));
  };

  const updateTier = (index: number, field: keyof PricingTierItem, val: any) => {
    setFormData((prev) => {
      const updated = [...prev.pricing_tiers];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, pricing_tiers: updated };
    });
  };

  const calculateMargin = () => {
    if (typeof formData.cost_price !== 'number' || formData.cost_price <= 0) return null;
    const effectivePrice =
      typeof formData.sale_price === 'number' && formData.sale_price > 0
        ? formData.sale_price
        : formData.base_price;
    if (effectivePrice <= 0) return null;
    const profit = effectivePrice - formData.cost_price;
    const marginPct = (profit / effectivePrice) * 100;
    return {
      profit: profit.toFixed(2),
      marginPct: marginPct.toFixed(1),
    };
  };

  const margin = calculateMargin();

  return (
    <FormSection
      title="Pricing & Volume Discounts"
      description="Set standard retail unit pricing, promotional sales, cost tracking, folding add-on rates, and bulk volume discount breaks."
    >
      <div className="space-y-6">
        {/* Core Pricing Grid */}
        <FormGrid cols={3} gap="md">
          <AdminNumberInput
            label="Base Price"
            prefix="$"
            placeholder="0.00"
            step={0.01}
            min={0}
            value={formData.base_price}
            required
            error={errors.base_price}
            onChange={(val) =>
              setFormData((prev) => ({ ...prev, base_price: typeof val === 'number' ? val : 0 }))
            }
            helperText="Default single-unit retail price."
          />

          <AdminNumberInput
            label="Sale Price (Discounted)"
            prefix="$"
            placeholder="Optional"
            step={0.01}
            min={0}
            value={formData.sale_price ?? ''}
            error={errors.sale_price}
            onChange={(val) => setFormData((prev) => ({ ...prev, sale_price: val }))}
            helperText="Overrides base price with a discounted rate if set."
          />

          <AdminNumberInput
            label="Cost Price (Internal)"
            prefix="$"
            placeholder="0.00"
            step={0.01}
            min={0}
            value={formData.cost_price ?? ''}
            error={errors.cost_price}
            onChange={(val) => setFormData((prev) => ({ ...prev, cost_price: val }))}
            helperText="Wholesale print production cost for profit analysis."
          />
        </FormGrid>

        {/* Profit Margin Indicator */}
        {margin && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-medium">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>
                Estimated Profit per Unit: <strong>${margin.profit}</strong>
              </span>
            </div>
            <span className="font-bold text-emerald-700 bg-white px-2.5 py-0.5 rounded-md border border-emerald-200">
              {margin.marginPct}% Margin
            </span>
          </div>
        )}

        {/* ─── FOLDING ADD-ON PRICING PANEL (Collapsible) ───────────────────── */}
        <div className="border border-indigo-200/80 bg-indigo-50/30 rounded-2xl overflow-hidden transition-all shadow-2xs">
          {/* Header Bar with Toggle & Accordion */}
          <div className="p-4 bg-gradient-to-r from-indigo-50/90 to-white flex items-center justify-between gap-4 border-b border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-gray-900 tracking-tight">
                    Folding Add-on Pricing
                  </h4>
                  {foldingEnabled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <Check className="w-3 h-3" /> Enabled
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Configure product-specific folding options and finisher pricing rules.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Enable Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={foldingEnabled}
                  onChange={(e) => toggleFoldingEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-xs font-semibold text-gray-700">
                  {foldingEnabled ? 'Active' : 'Off'}
                </span>
              </label>

              <button
                type="button"
                onClick={() => setFoldingPanelOpen((prev) => !prev)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
                title={foldingPanelOpen ? 'Collapse folding pricing' : 'Expand folding pricing'}
              >
                {foldingPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {foldingPanelOpen && (
            <div className="p-5 space-y-5 bg-white/95">
              {!foldingEnabled ? (
                <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center space-y-1">
                  <p className="text-xs font-medium text-gray-600">
                    Folding add-on pricing is currently disabled for this product.
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Flip the toggle above to enable and configure custom folding styles and finishing rates.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Options Manager Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">
                          Product Folding Options ({configuredOptions.length})
                        </span>
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-200">
                          Configured for this product
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Manage available fold styles, default selections, and individual finishing rate calculations.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingOption((prev) => !prev);
                          setNewOptionError('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-2xs"
                      >
                        {isAddingOption ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{isAddingOption ? 'Cancel' : 'Add Folding Option'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Add Option Form Card (Expanded when Add button clicked) */}
                  {isAddingOption && (
                    <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900">Add New Folding Option</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingOption(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {newOptionError && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{newOptionError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Folding Type
                          </label>
                          <select
                            value={newOptionType}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewOptionType(val);
                              const typeDef = STANDARD_FOLDING_TYPES.find((t) => t.value === val);
                              if (typeDef) {
                                setNewOptionName(typeDef.label);
                                setNewOptionMethod(typeDef.defaultMethod);
                              }
                            }}
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                          >
                            {STANDARD_FOLDING_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Option Display Name
                          </label>
                          <input
                            type="text"
                            value={newOptionName}
                            onChange={(e) => setNewOptionName(e.target.value)}
                            placeholder="e.g. Tri-Fold / Letter Fold"
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-600 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Pricing Method
                          </label>
                          <select
                            value={newOptionMethod}
                            onChange={(e) => setNewOptionMethod(e.target.value as FoldingPricingMethod)}
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                          >
                            <option value="per_order">Per Order (Flat fee)</option>
                            <option value="per_copy">Per Printed Copy (× Quantity)</option>
                            <option value="quantity_based">Quantity-based (Tier Table)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-indigo-100">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={newOptionIsDefault}
                            onChange={(e) => setNewOptionIsDefault(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span>Make this the default folding choice</span>
                        </label>

                        <button
                          type="button"
                          onClick={handleCreateOption}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                        >
                          Save Option
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Configured Options List (Cards Table) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {configuredOptions.map((opt) => {
                      const isSelected = activeOption?.id === opt.id;
                      const isActive = opt.active !== false && opt.is_active !== false;
                      const isDefault = Boolean(opt.is_default);

                      return (
                        <div
                          key={opt.id || opt.type}
                          onClick={() => setActiveOptionId(opt.id || opt.type || '')}
                          className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-900 leading-tight">
                                  {opt.name}
                                </span>
                                {isDefault && (
                                  <span
                                    title="Default selection"
                                    className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200"
                                  >
                                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Default
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                <span className="capitalize px-1.5 py-0.2 bg-gray-100 rounded text-gray-600 font-medium">
                                  {opt.pricing_method === 'quantity_based'
                                    ? 'Quantity-based'
                                    : opt.pricing_method === 'per_copy'
                                    ? 'Per Copy'
                                    : 'Per Order'}
                                </span>
                                <span>•</span>
                                <span>
                                  {opt.type === 'no_fold'
                                    ? '$0.00 (Flat)'
                                    : opt.pricing_method === 'quantity_based'
                                    ? `${opt.tiers?.length || 0} tiers`
                                    : opt.pricing_method === 'per_copy'
                                    ? `$${(opt.charge ?? 0).toFixed(2)} / unit`
                                    : `$${(opt.charge ?? 0).toFixed(2)} fixed`}
                                </span>
                              </div>
                            </div>

                            {/* Status & Delete */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateFoldingConfig((prev) => ({
                                    options: prev.map((o) =>
                                      o.id === opt.id ? { ...o, active: !isActive, is_active: !isActive } : o
                                    ),
                                  }));
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                                }`}
                                title={isActive ? 'Click to deactivate' : 'Click to activate'}
                              >
                                {isActive ? 'Active' : 'Inactive'}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOption(opt.id || opt.type || '');
                                }}
                                className="p-1 text-gray-300 hover:text-rose-600 rounded transition"
                                title="Remove Option"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Focused Editor for the Selected Option */}
                  {activeOption && (
                    <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 pb-3">
                        <div className="flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-indigo-600" />
                          <div>
                            <h5 className="text-xs font-bold text-gray-900">
                              Configuring: <span className="text-indigo-600">{activeOption.name}</span>
                            </h5>
                            <p className="text-[10px] text-gray-400">
                              Fine-tune finisher rates, volume discounts, and default customer status.
                            </p>
                          </div>
                        </div>

                        {/* Top Controls: Default toggle & Active toggle */}
                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 select-none">
                            <input
                              type="checkbox"
                              checked={Boolean(activeOption.is_default)}
                              onChange={(e) => updateActiveOption({ is_default: e.target.checked })}
                              className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span>Default Selection</span>
                          </label>

                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 select-none">
                            <input
                              type="checkbox"
                              checked={activeOption.active !== false && activeOption.is_active !== false}
                              onChange={(e) =>
                                updateActiveOption({ active: e.target.checked, is_active: e.target.checked })
                              }
                              className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span>Active</span>
                          </label>
                        </div>
                      </div>

                      {/* Pricing Method Selector for this Option */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Finishing Rate Calculation Method:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleActiveMethodChange('per_order')}
                            className={`py-2 px-3 text-left rounded-lg text-xs font-semibold border transition-all ${
                              activeOption.pricing_method === 'per_order'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-bold">Per Order</div>
                            <div className={`text-[10px] font-normal ${activeOption.pricing_method === 'per_order' ? 'text-indigo-100' : 'text-gray-400'}`}>
                              Fixed charge once per order
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleActiveMethodChange('per_copy')}
                            className={`py-2 px-3 text-left rounded-lg text-xs font-semibold border transition-all ${
                              activeOption.pricing_method === 'per_copy'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-bold">Per Printed Copy</div>
                            <div className={`text-[10px] font-normal ${activeOption.pricing_method === 'per_copy' ? 'text-indigo-100' : 'text-gray-400'}`}>
                              Multiplied by quantity ordered
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleActiveMethodChange('quantity_based')}
                            className={`py-2 px-3 text-left rounded-lg text-xs font-semibold border transition-all ${
                              activeOption.pricing_method === 'quantity_based'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-bold">Quantity-based</div>
                            <div className={`text-[10px] font-normal ${activeOption.pricing_method === 'quantity_based' ? 'text-indigo-100' : 'text-gray-400'}`}>
                              Tier table mapped by quantity
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Display relevant input ONLY based on selected method */}
                      {activeOption.pricing_method === 'per_order' && (
                        <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2">
                          <div className="max-w-xs">
                            <AdminNumberInput
                              label="Fixed Folding Charge per Order"
                              prefix="$"
                              step={0.01}
                              min={0}
                              value={activeOption.charge ?? 0}
                              onChange={(val) =>
                                updateActiveOption({ charge: typeof val === 'number' ? val : 0 })
                              }
                              helperText="Added once to customer subtotal regardless of volume."
                            />
                          </div>
                        </div>
                      )}

                      {activeOption.pricing_method === 'per_copy' && (
                        <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2">
                          <div className="max-w-xs">
                            <AdminNumberInput
                              label="Charge per Printed Copy"
                              prefix="$"
                              step={0.001}
                              min={0}
                              value={activeOption.charge ?? 0}
                              onChange={(val) =>
                                updateActiveOption({ charge: typeof val === 'number' ? val : 0 })
                              }
                              helperText="Multiplied by ordered quantity (e.g., $0.05 × 500 = $25.00)."
                            />
                          </div>
                        </div>
                      )}

                      {activeOption.pricing_method === 'quantity_based' && (
                        <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-800">
                                Volume Quantity Tiers ({activeOption.tiers?.length || 0})
                              </span>
                              <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-medium">
                                Exact tier match takes precedence
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleQuickFillExampleTiers}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-2xs"
                                title="Quick load standard testing tiers (100: $10, 250: $20, 500: $35, 1000: $60)"
                              >
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                <span>Quick Fill Example Tiers</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleAddTier}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-2xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Tier</span>
                              </button>
                            </div>
                          </div>

                          {/* Tier Validation Warnings Banner */}
                          {tierValidationErrors.length > 0 && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-700">
                              <div className="flex items-center gap-1.5 font-bold">
                                <AlertCircle className="w-4 h-4 text-rose-600" />
                                <span>Tier Configuration Warnings</span>
                              </div>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                                {tierValidationErrors.map((msg, i) => (
                                  <li key={i}>{msg}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Tiers Table */}
                          {(activeOption.tiers || []).length > 0 ? (
                            <div className="overflow-x-auto border border-gray-200 rounded-xl">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50/80 text-gray-600 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200">
                                  <tr>
                                    <th className="py-2.5 px-4 w-40">Min Quantity</th>
                                    <th className="py-2.5 px-4 w-40">Max Quantity</th>
                                    <th className="py-2.5 px-4 w-44">Folding Charge</th>
                                    <th className="py-2.5 px-4 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {(activeOption.tiers || []).map((tier, tIdx) => (
                                    <tr key={tier.id || tIdx} className="hover:bg-gray-50/50 transition">
                                      <td className="py-2 px-4">
                                        <AdminNumberInput
                                          min={1}
                                          value={tier.min_quantity}
                                          onChange={(val) =>
                                            handleUpdateTier(
                                              tIdx,
                                              'min_quantity',
                                              typeof val === 'number' ? val : 1
                                            )
                                          }
                                        />
                                      </td>
                                      <td className="py-2 px-4">
                                        <AdminNumberInput
                                          placeholder="No limit"
                                          min={tier.min_quantity}
                                          value={tier.max_quantity ?? ''}
                                          onChange={(val) =>
                                            handleUpdateTier(
                                              tIdx,
                                              'max_quantity',
                                              val === '' ? null : val
                                            )
                                          }
                                        />
                                      </td>
                                      <td className="py-2 px-4">
                                        <AdminNumberInput
                                          prefix="$"
                                          step={0.01}
                                          min={0}
                                          value={tier.charge}
                                          onChange={(val) =>
                                            handleUpdateTier(
                                              tIdx,
                                              'charge',
                                              typeof val === 'number' ? val : 0
                                            )
                                          }
                                        />
                                      </td>
                                      <td className="py-2 px-4 text-right">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveTier(tIdx)}
                                          className="p-1.5 text-gray-400 hover:text-rose-600 transition rounded-md"
                                          title="Delete Tier"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-center space-y-1">
                              <p className="text-xs text-gray-500">No volume tiers configured for this option.</p>
                              <button
                                type="button"
                                onClick={handleQuickFillExampleTiers}
                                className="text-xs text-indigo-600 font-semibold hover:underline"
                              >
                                Click here to fill example test tiers (100: $10, 250: $20, 500: $35, 1000: $60)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quantity Tier Pricing Matrix (Unchanged standard product pricing tiers) */}
        <div className="space-y-3 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-gray-700 select-none">
                Quantity Tier Pricing Matrix ({formData.pricing_tiers.length})
              </span>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Automatically applies volume rate discounts when customers order larger quantities.
              </p>
            </div>

            <button
              type="button"
              onClick={addPricingTier}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100/70 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Tier</span>
            </button>
          </div>

          {formData.pricing_tiers.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 text-gray-600 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Min Quantity</th>
                    <th className="py-3 px-4">Max Quantity</th>
                    <th className="py-3 px-4">Price per Unit</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {formData.pricing_tiers.map((tier, idx) => (
                    <tr key={tier.id || idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2 px-4 w-44">
                        <AdminNumberInput
                          min={1}
                          value={tier.minQuantity}
                          onChange={(val) =>
                            updateTier(idx, 'minQuantity', typeof val === 'number' ? val : 1)
                          }
                        />
                      </td>
                      <td className="py-2 px-4 w-44">
                        <AdminNumberInput
                          placeholder="No limit"
                          min={tier.minQuantity}
                          value={tier.maxQuantity ?? ''}
                          onChange={(val) => updateTier(idx, 'maxQuantity', val)}
                        />
                      </td>
                      <td className="py-2 px-4 w-44">
                        <AdminNumberInput
                          prefix="$"
                          step={0.001}
                          value={tier.price}
                          onChange={(val) =>
                            updateTier(idx, 'price', typeof val === 'number' ? val : 0)
                          }
                        />
                      </td>
                      <td className="py-2 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removePricingTier(idx)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 transition-colors rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-center">
              <p className="text-xs text-gray-500">
                No volume discount tiers added. Standard base price will apply for all order quantities.
              </p>
            </div>
          )}
        </div>
      </div>
    </FormSection>
  );
};

export default ProductPricing;
