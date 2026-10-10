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
  PrintingPricingConfig,
  PrintingSideConfig,
  PrintingPricingTier,
  GsmOptionConfig,
  GsmPricingTier,
  SqmPricingConfig,
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
  Printer,
  Copy,
  Maximize2,
  Calculator,
} from 'lucide-react';

interface ProductPricingProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  errors: FormErrors;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FOLDING CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const STANDARD_FOLDING_TYPES = [
  { value: 'no_fold', label: 'No Folding (Flat Sheet)', defaultCharge: 0, defaultMethod: 'per_order' as FoldingPricingMethod },
  { value: 'half_fold', label: 'Half Fold', defaultCharge: 10, defaultMethod: 'per_order' as FoldingPricingMethod },
  { value: 'tri_fold', label: 'Tri-Fold / Letter Fold', defaultCharge: 15, defaultMethod: 'quantity_based' as FoldingPricingMethod },
  { value: 'z_fold', label: 'Z-Fold', defaultCharge: 15, defaultMethod: 'quantity_based' as FoldingPricingMethod },
  { value: 'gate_fold', label: 'Gate Fold', defaultCharge: 20, defaultMethod: 'quantity_based' as FoldingPricingMethod },
  { value: 'double_parallel_fold', label: 'Double Parallel Fold', defaultCharge: 20, defaultMethod: 'quantity_based' as FoldingPricingMethod },
  { value: 'custom_fold', label: 'Custom Fold', defaultCharge: 25, defaultMethod: 'quantity_based' as FoldingPricingMethod },
];

/**
 * Returns fresh instances of example folding tiers to prevent mutating shared state.
 */
export const createDefaultExampleTiers = (): FoldingPricingTier[] => [
  { id: `ftier_1_${Date.now()}_1`, min_quantity: 100, max_quantity: 249, charge: 10.00 },
  { id: `ftier_2_${Date.now()}_2`, min_quantity: 250, max_quantity: 499, charge: 20.00 },
  { id: `ftier_3_${Date.now()}_3`, min_quantity: 500, max_quantity: 999, charge: 35.00 },
  { id: `ftier_4_${Date.now()}_4`, min_quantity: 1000, max_quantity: null, charge: 60.00 },
];

export const DEFAULT_EXAMPLE_TIERS = createDefaultExampleTiers();

export const createDefaultInitialFoldingOptions = (): FoldingOptionConfig[] => [
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
    tiers: createDefaultExampleTiers(),
  },
];

export const DEFAULT_INITIAL_OPTIONS = createDefaultInitialFoldingOptions();

/**
 * Normalizes folding options from Record or Array into a clean array.
 * Ensures active/is_active consistency and guarantees exactly one default option.
 */
export function normalizeFoldingOptions(
  raw: Record<string, FoldingOptionConfig> | FoldingOptionConfig[] | undefined
): FoldingOptionConfig[] {
  if (!raw) return [];
  let list: FoldingOptionConfig[] = [];

  if (Array.isArray(raw)) {
    list = raw.map((opt, idx) => {
      const isAct = opt.active !== false && opt.is_active !== false;
      return {
        ...opt,
        id: opt.id || opt.type || `opt_${idx}`,
        name: opt.name || STANDARD_FOLDING_TYPES.find((t) => t.value === opt.type)?.label || 'Folding Option',
        type: opt.type || opt.id || 'custom_fold',
        active: isAct,
        is_active: isAct,
        is_default: Boolean(opt.is_default),
        pricing_method: opt.pricing_method || 'quantity_based',
        charge: typeof opt.charge === 'number' ? opt.charge : 10,
        tiers: Array.isArray(opt.tiers)
          ? opt.tiers.map((t) => ({ ...t }))
          : opt.pricing_method === 'quantity_based'
            ? createDefaultExampleTiers()
            : [],
      };
    });
  } else {
    list = Object.entries(raw).map(([key, opt], idx) => {
      const isAct = opt.active !== false && opt.is_active !== false;
      return {
        ...opt,
        id: opt.id || key,
        name: opt.name || STANDARD_FOLDING_TYPES.find((t) => t.value === (opt.type || key))?.label || key,
        type: opt.type || key,
        active: isAct,
        is_active: isAct,
        is_default: Boolean(opt.is_default),
        pricing_method: opt.pricing_method || 'quantity_based',
        charge: typeof opt.charge === 'number' ? opt.charge : 10,
        tiers: Array.isArray(opt.tiers)
          ? opt.tiers.map((t) => ({ ...t }))
          : opt.pricing_method === 'quantity_based'
            ? createDefaultExampleTiers()
            : [],
      };
    });
  }

  // Ensure only one default exists
  let defaultFound = false;
  list = list.map((opt) => {
    if (opt.is_default) {
      if (!defaultFound && opt.is_active) {
        defaultFound = true;
        return opt;
      }
      return { ...opt, is_default: false };
    }
    return opt;
  });

  if (!defaultFound && list.length > 0) {
    const firstActiveIdx = list.findIndex((o) => o.is_active);
    if (firstActiveIdx !== -1) {
      list[firstActiveIdx] = { ...list[firstActiveIdx], is_default: true };
    } else {
      list[0] = { ...list[0], is_default: true };
    }
  }

  return list;
}

/**
 * Robust validation for folding tiers.
 */
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

/**
 * Calculate next tier without creating overlapping tiers or arbitrarily mutating unlimited ranges.
 */
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

  const updated = tiers.map((t) => ({ ...t }));
  const openEndedIdx = updated.findIndex(
    (t) => t.max_quantity === null || t.max_quantity === '' || t.max_quantity === undefined
  );

  if (openEndedIdx !== -1) {
    const openTier = updated[openEndedIdx];
    const openMin = Math.max(1, Number(openTier.min_quantity) || 100);
    const step = openMin >= 1000 ? 1500 : 500;
    const newCap = openMin + step - 1;

    updated[openEndedIdx] = {
      ...openTier,
      max_quantity: newCap,
    };

    const newMin = newCap + 1;
    const lastCharge = typeof openTier.charge === 'number' ? openTier.charge : 10;
    const newTier: FoldingPricingTier = {
      id: `ftier_${Date.now()}`,
      min_quantity: newMin,
      max_quantity: null,
      charge: Number((lastCharge * 1.5).toFixed(2)),
    };

    return [...updated, newTier];
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// 2. PRINTING CONFIGURATION CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const STANDARD_PRINTING_SIDE_PRESETS = [
  { value: 'front_only', label: 'Single-Sided (Front Only)', sideType: 'front_only' },
  { value: 'front_back', label: 'Double-Sided (Front & Back)', sideType: 'front_back' },
  { value: 'custom', label: 'Custom Side / Page Option', sideType: 'custom' },
];

/**
 * Returns fresh instances of default single-sided fixed total tiers.
 */
export const createDefaultPrintingSingleTiers = (): PrintingPricingTier[] => [
  { id: `ptier_${Date.now()}_1`, quantity: 100, total_price: 25.00, per_card_price: 0.25, label: 'Starter' },
  { id: `ptier_${Date.now()}_2`, quantity: 250, total_price: 40.00, per_card_price: 0.16, label: 'Standard' },
  { id: `ptier_${Date.now()}_3`, quantity: 500, total_price: 60.00, per_card_price: 0.12, label: 'Popular' },
  { id: `ptier_${Date.now()}_4`, quantity: 1000, total_price: 95.00, per_card_price: 0.095, label: 'Best Value' },
];

/**
 * Returns fresh instances of default double-sided fixed total tiers.
 */
export const createDefaultPrintingDoubleTiers = (): PrintingPricingTier[] => [
  { id: `ptier_${Date.now()}_5`, quantity: 100, total_price: 35.00, per_card_price: 0.35, label: 'Starter' },
  { id: `ptier_${Date.now()}_6`, quantity: 250, total_price: 55.00, per_card_price: 0.22, label: 'Standard' },
  { id: `ptier_${Date.now()}_7`, quantity: 500, total_price: 85.00, per_card_price: 0.17, label: 'Popular' },
  { id: `ptier_${Date.now()}_8`, quantity: 1000, total_price: 135.00, per_card_price: 0.135, label: 'Best Value' },
];

export const createInitialPrintingOptions = (): PrintingSideConfig[] => [
  {
    id: 'front_only',
    name: 'Single-Sided (Front Only)',
    side_type: 'front_only',
    is_active: true,
    active: true,
    is_default: true,
    tiers: createDefaultPrintingSingleTiers(),
  },
  {
    id: 'front_back',
    name: 'Double-Sided (Front & Back)',
    side_type: 'front_back',
    is_active: true,
    active: true,
    is_default: false,
    tiers: createDefaultPrintingDoubleTiers(),
  },
];

/**
 * Ensures that both Front Only (single-sided) and Back (double-sided) options are present.
 * If raw data only has one side option (e.g. only Front Only), this guarantees Double-Sided (Front & Back)
 * is also present so the admin can configure both sides alongside GSM.
 */
export function ensureStandardPrintingSideOptions(list: PrintingSideConfig[]): PrintingSideConfig[] {
  if (!list || list.length === 0) {
    return createInitialPrintingOptions();
  }

  let updated = [...list];

  const hasFront = updated.some(
    (opt) =>
      opt.id === 'front_only' ||
      opt.side_type === 'front_only' ||
      (opt.name && (opt.name.toLowerCase().includes('front') || opt.name.toLowerCase().includes('single')))
  );

  const hasBack = updated.some(
    (opt) =>
      opt.id === 'front_back' ||
      opt.side_type === 'front_back' ||
      (opt.name && (opt.name.toLowerCase().includes('back') || opt.name.toLowerCase().includes('double')))
  );

  if (!hasFront) {
    updated.unshift({
      id: 'front_only',
      name: 'Single-Sided (Front Only)',
      side_type: 'front_only',
      is_active: true,
      active: true,
      is_default: !updated.some((o) => o.is_default),
      tiers: createDefaultPrintingSingleTiers(),
    });
  }

  if (!hasBack) {
    const frontIdx = updated.findIndex(
      (opt) =>
        opt.id === 'front_only' ||
        opt.side_type === 'front_only' ||
        (opt.name && (opt.name.toLowerCase().includes('front') || opt.name.toLowerCase().includes('single')))
    );

    const backOption: PrintingSideConfig = {
      id: 'front_back',
      name: 'Double-Sided (Front & Back)',
      side_type: 'front_back',
      is_active: true,
      active: true,
      is_default: false,
      tiers: createDefaultPrintingDoubleTiers(),
    };

    if (frontIdx !== -1) {
      updated.splice(frontIdx + 1, 0, backOption);
    } else {
      updated.push(backOption);
    }
  }

  return updated;
}

/**
 * Normalizes printing configuration options.
 * Guarantees active/is_active consistency and strictly one default option.
 */
export function normalizePrintingOptions(
  raw: PrintingSideConfig[] | Record<string, PrintingSideConfig> | undefined
): PrintingSideConfig[] {
  if (!raw) return [];
  let list: PrintingSideConfig[] = [];

  if (Array.isArray(raw)) {
    list = raw.map((opt, idx) => {
      const isAct = opt.is_active !== false && opt.active !== false;
      return {
        ...opt,
        id: opt.id || `print_opt_${idx}`,
        name: opt.name || `Option ${idx + 1}`,
        side_type: opt.side_type || 'custom',
        is_active: isAct,
        active: isAct,
        is_default: Boolean(opt.is_default),
        tiers: Array.isArray(opt.tiers)
          ? opt.tiers.map((t) => {
            const qty = Number(t.quantity) || 100;
            const total = Number(t.total_price) || 0;
            return {
              ...t,
              id: t.id || `ptier_${Date.now()}_${Math.random()}`,
              quantity: qty,
              total_price: total,
              per_card_price: qty > 0 ? total / qty : 0,
              label: t.label || '',
            };
          })
          : [],
      };
    });
  } else {
    list = Object.entries(raw).map(([key, opt], idx) => {
      const isAct = opt.is_active !== false && opt.active !== false;
      return {
        ...opt,
        id: opt.id || key,
        name: opt.name || key,
        side_type: opt.side_type || 'custom',
        is_active: isAct,
        active: isAct,
        is_default: Boolean(opt.is_default),
        tiers: Array.isArray(opt.tiers)
          ? opt.tiers.map((t) => {
            const qty = Number(t.quantity) || 100;
            const total = Number(t.total_price) || 0;
            return {
              ...t,
              id: t.id || `ptier_${Date.now()}_${Math.random()}`,
              quantity: qty,
              total_price: total,
              per_card_price: qty > 0 ? total / qty : 0,
              label: t.label || '',
            };
          })
          : [],
      };
    });
  }

  // Ensure only one default exists among active options
  let defaultFound = false;
  list = list.map((opt) => {
    if (opt.is_default) {
      if (!defaultFound && opt.is_active) {
        defaultFound = true;
        return opt;
      }
      return { ...opt, is_default: false };
    }
    return opt;
  });

  if (!defaultFound && list.length > 0) {
    const firstActiveIdx = list.findIndex((o) => o.is_active);
    if (firstActiveIdx !== -1) {
      list[firstActiveIdx] = { ...list[firstActiveIdx], is_default: true };
    } else {
      list[0] = { ...list[0], is_default: true };
    }
  }

  return list;
}

/**
 * Validates fixed-total printing quantity tiers for positive integers, unique quantities, and non-negative prices.
 */
export function validatePrintingTiers(tiers: PrintingPricingTier[]): string[] {
  const errs: string[] = [];
  if (!tiers || tiers.length === 0) {
    errs.push('At least one quantity tier must be configured for this printing configuration.');
    return errs;
  }

  const seenQuantities = new Set<number>();
  tiers.forEach((tier, index) => {
    const num = index + 1;
    const qty = Number(tier.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      errs.push(`Tier #${num}: Quantity must be a positive integer.`);
    } else if (seenQuantities.has(qty)) {
      errs.push(`Tier #${num}: Duplicate quantity (${qty}) found. Each quantity tier must have a unique quantity.`);
    } else {
      seenQuantities.add(qty);
    }

    const price = Number(tier.total_price);
    if (!Number.isFinite(price) || price < 0) {
      errs.push(`Tier #${num}: Fixed total price must be a finite, non-negative number.`);
    }
  });

  return errs;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.5 GSM CONFIGURATION CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const STANDARD_GSM_PRESETS = [
  { value: '128_gsm', gsm: 128, label: '128 GSM', defaultStock: 'Standard Paper' },
  { value: '150_gsm', gsm: 150, label: '150 GSM', defaultStock: 'Gloss Art Paper' },
  { value: '170_gsm', gsm: 170, label: '170 GSM', defaultStock: 'Silk / Matte Paper' },
  { value: '250_gsm', gsm: 250, label: '250 GSM', defaultStock: 'Premium Card' },
  { value: '300_gsm', gsm: 300, label: '300 GSM', defaultStock: 'Heavy Cardstock' },
  { value: '350_gsm', gsm: 350, label: '350 GSM', defaultStock: 'Ultra-Heavy Board' },
  { value: 'custom_gsm', gsm: 0, label: 'Custom GSM', defaultStock: '' },
];

/**
 * Automatically creates standard quantity tiers (100, 250, 500, 1000) scaled according to GSM weight.
 * Lighter paper (e.g. 128 GSM) is priced lower, while heavier cardstock (350 GSM) is priced proportionally higher.
 */
export const createDefaultGsmTiers = (
  gsmInput?: number | string,
  scaleFactor: number = 1.0,
  customBase100Price?: number
): PrintingPricingTier[] => {
  const gsmNum =
    typeof gsmInput === 'number'
      ? gsmInput
      : parseInt(String(gsmInput || '').replace(/[^0-9]/g, ''), 10) || 150;

  // Realistic weight-based price scaling:
  let weightRatio = 1.0;
  if (gsmNum <= 135) {
    weightRatio = 0.8; // 128 GSM
  } else if (gsmNum <= 160) {
    weightRatio = 0.9; // 150 GSM
  } else if (gsmNum <= 200) {
    weightRatio = 1.0; // 170 GSM
  } else if (gsmNum <= 270) {
    weightRatio = 1.15; // 250 GSM
  } else if (gsmNum <= 320) {
    weightRatio = 1.3; // 300 GSM
  } else {
    weightRatio = 1.5; // 350+ GSM
  }

  // Base 100-unit package price
  const base100 =
    customBase100Price !== undefined && customBase100Price > 0
      ? customBase100Price
      : Math.round(25.0 * weightRatio * scaleFactor * 100) / 100;

  // Standard volume discounts across package tiers:
  const p100 = base100;
  const p250 = Math.round(base100 * 1.6 * 100) / 100;
  const p500 = Math.round(base100 * 2.4 * 100) / 100;
  const p1000 = Math.round(base100 * 3.8 * 100) / 100;

  const timestamp = Date.now();
  return [
    {
      id: `gtier_${timestamp}_1`,
      quantity: 100,
      total_price: p100,
      per_card_price: parseFloat((p100 / 100).toFixed(4)),
      label: 'Starter',
    },
    {
      id: `gtier_${timestamp}_2`,
      quantity: 250,
      total_price: p250,
      per_card_price: parseFloat((p250 / 250).toFixed(4)),
      label: 'Standard',
    },
    {
      id: `gtier_${timestamp}_3`,
      quantity: 500,
      total_price: p500,
      per_card_price: parseFloat((p500 / 500).toFixed(4)),
      label: 'Popular',
    },
    {
      id: `gtier_${timestamp}_4`,
      quantity: 1000,
      total_price: p1000,
      per_card_price: parseFloat((p1000 / 1000).toFixed(4)),
      label: 'Best Value',
    },
  ];
};

export const createInitialGsmOptions = (): GsmOptionConfig[] => [
  {
    id: 'gsm_128',
    gsm: 128,
    name: '128 GSM',
    stock_name: 'Standard Art Paper',
    is_active: true,
    active: true,
    is_default: true,
    tiers: createDefaultGsmTiers(128),
    side_tiers: {
      front_only: createDefaultGsmTiers(128, 1.0),
      front_back: createDefaultGsmTiers(128, 1.4),
    },
  },
  {
    id: 'gsm_150',
    gsm: 150,
    name: '150 GSM',
    stock_name: 'Gloss Art Paper',
    is_active: true,
    active: true,
    is_default: false,
    tiers: createDefaultGsmTiers(150),
    side_tiers: {
      front_only: createDefaultGsmTiers(150, 1.0),
      front_back: createDefaultGsmTiers(150, 1.4),
    },
  },
];

const normalizeGsmTierList = (rawTiers: any[]): PrintingPricingTier[] => {
  if (!Array.isArray(rawTiers)) return [];
  return rawTiers.map((t) => {
    const qty = Number(t.quantity) || 100;
    const total = Number(t.total_price) || 0;
    return {
      ...t,
      id: t.id || `gtier_${Date.now()}_${Math.random()}`,
      quantity: qty,
      total_price: total,
      per_card_price: qty > 0 ? total / qty : 0,
      label: t.label || '',
    };
  });
};

export function normalizeGsmOptions(
  raw: GsmOptionConfig[] | Record<string, GsmOptionConfig> | undefined
): GsmOptionConfig[] {
  if (!raw) return [];
  let list: GsmOptionConfig[] = [];

  const processOpt = (opt: any, defaultId: string, defaultName: string): GsmOptionConfig => {
    const isAct = opt.is_active !== false && opt.active !== false;
    const normalizedTiers = normalizeGsmTierList(opt.tiers);
    let sideTiers: Record<string, PrintingPricingTier[]> = {};

    if (opt.side_tiers && typeof opt.side_tiers === 'object') {
      Object.entries(opt.side_tiers).forEach(([k, v]) => {
        sideTiers[k] = normalizeGsmTierList(v as any[]);
      });
    }

    if (!sideTiers.front_only && normalizedTiers.length > 0) {
      sideTiers.front_only = normalizedTiers;
    }
    if (!sideTiers.front_back && normalizedTiers.length > 0) {
      sideTiers.front_back = normalizedTiers.map((t) => {
        const doublePrice = Math.round(t.total_price * 1.4 * 100) / 100;
        return {
          ...t,
          id: `gtier_fb_${t.quantity}`,
          total_price: doublePrice,
          per_card_price: t.quantity > 0 ? doublePrice / t.quantity : 0,
        };
      });
    }

    return {
      ...opt,
      id: opt.id || defaultId,
      name: opt.name || defaultName,
      gsm: opt.gsm !== undefined ? opt.gsm : '',
      stock_name: opt.stock_name || '',
      is_active: isAct,
      active: isAct,
      is_default: Boolean(opt.is_default),
      tiers: normalizedTiers,
      side_tiers: sideTiers,
    };
  };

  if (Array.isArray(raw)) {
    list = raw.map((opt, idx) =>
      processOpt(opt, `gsm_${idx}_${Date.now()}`, `${opt.gsm || 300} GSM`)
    );
  } else {
    list = Object.entries(raw).map(([key, opt]) =>
      processOpt(opt, key, key)
    );
  }

  // Ensure only one default exists among active options
  let defaultFound = false;
  list = list.map((opt) => {
    if (opt.is_default) {
      if (!defaultFound && opt.is_active) {
        defaultFound = true;
        return opt;
      }
      return { ...opt, is_default: false };
    }
    return opt;
  });

  if (!defaultFound && list.length > 0) {
    const firstActiveIdx = list.findIndex((o) => o.is_active);
    if (firstActiveIdx !== -1) {
      list[firstActiveIdx] = { ...list[firstActiveIdx], is_default: true };
    } else {
      list[0] = { ...list[0], is_default: true };
    }
  }

  return list;
}

export function validateGsmTiers(tiers: PrintingPricingTier[]): string[] {
  return validatePrintingTiers(tiers);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MAIN PRODUCT PRICING COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const ProductPricing: React.FC<ProductPricingProps> = ({
  formData,
  setFormData,
  errors,
}) => {
  // ── A. PRINTING CONFIGURATION STATE ─────────────────────────────────────────
  const [printingPanelOpen, setPrintingPanelOpen] = useState<boolean>(true);
  const [activePrintingOptionId, setActivePrintingOptionId] = useState<string>('');
  const [isAddingPrintingOption, setIsAddingPrintingOption] = useState<boolean>(false);
  const [newPrintingOptionName, setNewPrintingOptionName] = useState<string>('Single-Sided (Front Only)');
  const [newPrintingOptionSideType, setNewPrintingOptionSideType] = useState<string>('front_only');
  const [newPrintingOptionIsDefault, setNewPrintingOptionIsDefault] = useState<boolean>(false);
  const [newPrintingOptionError, setNewPrintingOptionError] = useState<string>('');
  const [selectedSummaryQty, setSelectedSummaryQty] = useState<number | null>(null);

  const rawPrintingPricing = formData.printing_pricing;
  const printingEnabled = Boolean(rawPrintingPricing?.enabled);

  const configuredPrintingOptions: PrintingSideConfig[] = useMemo(() => {
    const list = normalizePrintingOptions(rawPrintingPricing?.options);
    if (list.length === 0 && !rawPrintingPricing?.enabled) {
      return [];
    }
    // Guarantee both Front (single-sided) and Back (double-sided) options are present
    return ensureStandardPrintingSideOptions(list);
  }, [rawPrintingPricing]);

  // Synchronize active printing option ID
  React.useEffect(() => {
    if (configuredPrintingOptions.length > 0) {
      if (!activePrintingOptionId || !configuredPrintingOptions.some((o) => o.id === activePrintingOptionId)) {
        const defaultOpt = configuredPrintingOptions.find((o) => o.is_default && o.is_active) || configuredPrintingOptions[0];
        setActivePrintingOptionId(defaultOpt.id || 'front_only');
      }
    }
  }, [configuredPrintingOptions, activePrintingOptionId]);

  const activePrintingOption = useMemo(() => {
    return configuredPrintingOptions.find((o) => o.id === activePrintingOptionId) || configuredPrintingOptions[0] || null;
  }, [configuredPrintingOptions, activePrintingOptionId]);

  const updatePrintingConfig = (
    updater: (prevOptions: PrintingSideConfig[]) => {
      options: PrintingSideConfig[];
      enabled?: boolean;
    }
  ) => {
    setFormData((prev) => {
      const baseList = configuredPrintingOptions;
      const { options: newOptions, enabled } = updater(baseList);
      const isEnabled = enabled !== undefined ? enabled : Boolean(prev.printing_pricing?.enabled);

      return {
        ...prev,
        printing_pricing: {
          enabled: isEnabled,
          options: newOptions,
          gsm_options: prev.printing_pricing?.gsm_options ?? configuredGsmOptions,
        },
      };
    });
  };

  const togglePrintingEnabled = (enabled: boolean) => {
    setFormData((prev) => {
      const currentOptions = normalizePrintingOptions(prev.printing_pricing?.options);
      const optionsToUse = ensureStandardPrintingSideOptions(currentOptions);
      const currentGsm = normalizeGsmOptions(prev.printing_pricing?.gsm_options);
      const gsmToUse = currentGsm.length > 0 ? currentGsm : createInitialGsmOptions();

      return {
        ...prev,
        printing_pricing: {
          enabled,
          options: optionsToUse,
          gsm_options: gsmToUse,
        },
      };
    });
  };

  const handleCreatePrintingOption = () => {
    setNewPrintingOptionError('');
    const trimmedName = newPrintingOptionName.trim();
    if (!trimmedName) {
      setNewPrintingOptionError('Please enter a display name for the printing configuration.');
      return;
    }

    const isDuplicate = configuredPrintingOptions.some(
      (o) =>
        (o.name || '').trim().toLowerCase() === trimmedName.toLowerCase() ||
        o.id === newPrintingOptionSideType
    );

    if (isDuplicate) {
      setNewPrintingOptionError(`A printing configuration with name "${trimmedName}" is already configured.`);
      return;
    }

    const newId = `${newPrintingOptionSideType}_${Date.now()}`;
    const defaultTiers =
      newPrintingOptionSideType === 'front_back'
        ? createDefaultPrintingDoubleTiers()
        : createDefaultPrintingSingleTiers();

    const newOpt: PrintingSideConfig = {
      id: newId,
      name: trimmedName,
      side_type: newPrintingOptionSideType,
      is_active: true,
      active: true,
      is_default: newPrintingOptionIsDefault,
      tiers: defaultTiers,
    };

    updatePrintingConfig((prev) => {
      let updatedList = [...prev];
      if (newPrintingOptionIsDefault) {
        updatedList = updatedList.map((o) => ({ ...o, is_default: false }));
      }
      return { options: [...updatedList, newOpt] };
    });

    setActivePrintingOptionId(newId);
    setIsAddingPrintingOption(false);
    setNewPrintingOptionName('Single-Sided (Front Only)');
    setNewPrintingOptionIsDefault(false);
  };

  const handleDeletePrintingOption = (optId: string) => {
    const target = configuredPrintingOptions.find((o) => o.id === optId);
    if (!target) return;

    if (configuredPrintingOptions.length <= 1) {
      alert('At least one printing configuration must remain configured while this feature is enabled.');
      return;
    }

    const hasTiers = target.tiers && target.tiers.length > 0;
    const confirmMsg = hasTiers
      ? `Are you sure you want to delete "${target.name}"? Its ${target.tiers.length} configured quantity tiers will be removed.`
      : `Are you sure you want to delete "${target.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    updatePrintingConfig((prev) => {
      const remaining = prev.filter((o) => o.id !== optId);
      // If deleted option was default, elect the first remaining active option as default
      if (target.is_default && remaining.length > 0) {
        const nextActiveIdx = remaining.findIndex((o) => o.is_active);
        const idxToDefault = nextActiveIdx !== -1 ? nextActiveIdx : 0;
        remaining[idxToDefault] = { ...remaining[idxToDefault], is_default: true };
      }
      return { options: remaining };
    });

    if (activePrintingOptionId === optId) {
      const nextOpt = configuredPrintingOptions.find((o) => o.id !== optId);
      if (nextOpt) setActivePrintingOptionId(nextOpt.id);
    }
  };

  const updateActivePrintingOption = (patch: Partial<PrintingSideConfig>) => {
    if (!activePrintingOption) return;

    updatePrintingConfig((prev) => {
      const updated = prev.map((opt) => {
        if (opt.id === activePrintingOption.id) {
          const nextOpt = { ...opt, ...patch };
          if (patch.is_active !== undefined) {
            nextOpt.active = patch.is_active;
          }
          return nextOpt;
        }
        if (patch.is_default) {
          return { ...opt, is_default: false };
        }
        return opt;
      });

      // If active option was deactivated and was default, promote another active option to default
      if (patch.is_active === false && activePrintingOption.is_default) {
        const nextActive = updated.find((o) => o.is_active && o.id !== activePrintingOption.id);
        if (nextActive) {
          nextActive.is_default = true;
          const curr = updated.find((o) => o.id === activePrintingOption.id);
          if (curr) curr.is_default = false;
        }
      }

      return { options: updated };
    });
  };

  const handleAddPrintingTier = () => {
    if (!activePrintingOption) return;
    const currentTiers = activePrintingOption.tiers || [];
    const maxQty = currentTiers.length > 0 ? Math.max(...currentTiers.map((t) => Number(t.quantity) || 0)) : 0;
    const nextQty = maxQty > 0 ? maxQty + 250 : 100;
    const suggestedTotal = parseFloat((nextQty * 0.15).toFixed(2));
    const perCard = nextQty > 0 ? suggestedTotal / nextQty : 0;

    const newTier: PrintingPricingTier = {
      id: `ptier_${Date.now()}_${Math.random()}`,
      quantity: nextQty,
      total_price: suggestedTotal,
      per_card_price: perCard,
      label: nextQty >= 1000 ? 'Best Value' : nextQty >= 500 ? 'Popular' : 'Standard',
    };

    updateActivePrintingOption({
      tiers: [...currentTiers, newTier],
    });
  };

  const handleUpdatePrintingTier = (
    tierIdx: number,
    field: keyof PrintingPricingTier,
    val: any
  ) => {
    if (!activePrintingOption) return;
    const tiers = [...(activePrintingOption.tiers || [])];
    const target = { ...tiers[tierIdx], [field]: val };

    const qty = Number(field === 'quantity' ? val : target.quantity) || 0;
    const total = Number(field === 'total_price' ? val : target.total_price) || 0;
    // Recalculate per-card price immediately and preserve full precision internally
    target.per_card_price = qty > 0 ? total / qty : 0;

    tiers[tierIdx] = target;
    updateActivePrintingOption({ tiers });
  };

  const handleRemovePrintingTier = (tierIdx: number) => {
    if (!activePrintingOption) return;
    const tiers = (activePrintingOption.tiers || []).filter((_, i) => i !== tierIdx);
    updateActivePrintingOption({ tiers });
  };

  const handleQuickFillStandardPrintingTiers = () => {
    if (!activePrintingOption) return;
    const existing = activePrintingOption.tiers || [];
    if (existing.length > 0) {
      const confirm = window.confirm(
        'Replace current tiers with standard quantity tiers (100, 250, 500, 1000)? This will overwrite current tiers.'
      );
      if (!confirm) return;
    }

    const freshTiers =
      activePrintingOption.side_type === 'front_back'
        ? createDefaultPrintingDoubleTiers()
        : createDefaultPrintingSingleTiers();

    updateActivePrintingOption({ tiers: freshTiers });
  };

  const printingTierValidationErrors = useMemo(() => {
    if (!printingEnabled || !activePrintingOption) {
      return [];
    }
    return validatePrintingTiers(activePrintingOption.tiers || []);
  }, [printingEnabled, activePrintingOption]);

  // Selected tier for live summary
  const summaryTier = useMemo(() => {
    if (!activePrintingOption || !activePrintingOption.tiers || activePrintingOption.tiers.length === 0) {
      return null;
    }
    if (selectedSummaryQty) {
      const found = activePrintingOption.tiers.find((t) => t.quantity === selectedSummaryQty);
      if (found) return found;
    }
    return activePrintingOption.tiers[0];
  }, [activePrintingOption, selectedSummaryQty]);

  // ── A.2 GSM CONFIGURATION STATE & HANDLERS ─────────────────────────────────
  const [activeSectionTab, setActiveSectionTab] = useState<'sides' | 'gsm'>('sides');
  const [activeGsmSideTab, setActiveGsmSideTab] = useState<'front_only' | 'front_back'>('front_only');
  const [activeGsmOptionId, setActiveGsmOptionId] = useState<string>('');
  const [isAddingGsmOption, setIsAddingGsmOption] = useState<boolean>(false);
  const [newGsmOptionPreset, setNewGsmOptionPreset] = useState<string>('128_gsm');
  const [newGsmOptionName, setNewGsmOptionName] = useState<string>('128 GSM');
  const [newGsmOptionValue, setNewGsmOptionValue] = useState<number | string>(128);
  const [newGsmOptionStock, setNewGsmOptionStock] = useState<string>('');
  const [newGsmOptionIsDefault, setNewGsmOptionIsDefault] = useState<boolean>(false);
  const [newGsmOptionError, setNewGsmOptionError] = useState<string>('');
  const [selectedGsmSummaryQty, setSelectedGsmSummaryQty] = useState<number | null>(null);
  const [newGsmAutoCreateTiers, setNewGsmAutoCreateTiers] = useState<boolean>(true);
  const [newGsmTierScale, setNewGsmTierScale] = useState<'standard' | 'economy' | 'premium'>('standard');

  const configuredGsmOptions: GsmOptionConfig[] = useMemo(() => {
    const list = normalizeGsmOptions(rawPrintingPricing?.gsm_options);
    if (list.length === 0 && rawPrintingPricing?.enabled) {
      return createInitialGsmOptions();
    }
    return list;
  }, [rawPrintingPricing]);

  // Synchronize active GSM option ID
  React.useEffect(() => {
    if (configuredGsmOptions.length > 0) {
      if (!activeGsmOptionId || !configuredGsmOptions.some((o) => o.id === activeGsmOptionId)) {
        const defaultOpt = configuredGsmOptions.find((o) => o.is_default && o.is_active) || configuredGsmOptions[0];
        setActiveGsmOptionId(defaultOpt.id || 'gsm_128');
      }
    }
  }, [configuredGsmOptions, activeGsmOptionId]);

  const activeGsmOption = useMemo(() => {
    return configuredGsmOptions.find((o) => o.id === activeGsmOptionId) || configuredGsmOptions[0] || null;
  }, [configuredGsmOptions, activeGsmOptionId]);

  const updateGsmConfig = (
    updater: (prevOptions: GsmOptionConfig[]) => GsmOptionConfig[]
  ) => {
    setFormData((prev) => {
      const currentGsmList = normalizeGsmOptions(prev.printing_pricing?.gsm_options);
      const baseGsmList = currentGsmList.length > 0 ? currentGsmList : configuredGsmOptions;
      const newGsmOptions = updater(baseGsmList);

      return {
        ...prev,
        printing_pricing: {
          enabled: Boolean(prev.printing_pricing?.enabled),
          options: configuredPrintingOptions,
          gsm_options: newGsmOptions,
        },
      };
    });
  };

  const handleCreateGsmOption = () => {
    setNewGsmOptionError('');
    const trimmedName = newGsmOptionName.trim();
    if (!trimmedName) {
      setNewGsmOptionError('Please enter a display name for the GSM option.');
      return;
    }

    const isDuplicate = configuredGsmOptions.some(
      (o) => (o.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setNewGsmOptionError(`A GSM option with name "${trimmedName}" is already configured.`);
      return;
    }

    const gsmVal = newGsmOptionValue || trimmedName.replace(/[^0-9]/g, '') || 150;
    const scaleFactor = newGsmTierScale === 'economy' ? 0.85 : newGsmTierScale === 'premium' ? 1.2 : 1.0;
    const initialTiers = newGsmAutoCreateTiers
      ? createDefaultGsmTiers(gsmVal, scaleFactor)
      : [];
    const doubleTiers = newGsmAutoCreateTiers
      ? createDefaultGsmTiers(gsmVal, scaleFactor * 1.4)
      : [];

    const newId = `gsm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newOpt: GsmOptionConfig = {
      id: newId,
      name: trimmedName,
      gsm: gsmVal,
      stock_name: newGsmOptionStock.trim() || undefined,
      is_active: true,
      active: true,
      is_default: newGsmOptionIsDefault,
      tiers: initialTiers,
      side_tiers: {
        front_only: initialTiers,
        front_back: doubleTiers,
      },
    };

    updateGsmConfig((prev) => {
      let updatedList = [...prev];
      if (newGsmOptionIsDefault) {
        updatedList = updatedList.map((o) => ({ ...o, is_default: false }));
      }
      return [...updatedList, newOpt];
    });

    setActiveGsmOptionId(newId);
    setIsAddingGsmOption(false);
    setNewGsmOptionName('128 GSM');
    setNewGsmOptionValue(128);
    setNewGsmOptionStock('');
    setNewGsmOptionIsDefault(false);
    setNewGsmAutoCreateTiers(true);
    setNewGsmTierScale('standard');
  };

  const handleDeleteGsmOption = (optId: string) => {
    const target = configuredGsmOptions.find((o) => o.id === optId);
    if (!target) return;

    if (configuredGsmOptions.length <= 1) {
      alert('At least one GSM option must remain configured.');
      return;
    }

    const hasTiers = target.tiers && target.tiers.length > 0;
    const confirmMsg = hasTiers
      ? `Are you sure you want to delete "${target.name}"? Its ${target.tiers.length} configured quantity tiers will be removed.`
      : `Are you sure you want to delete "${target.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    updateGsmConfig((prev) => {
      const remaining = prev.filter((o) => o.id !== optId);
      if (target.is_default && remaining.length > 0) {
        const nextActiveIdx = remaining.findIndex((o) => o.is_active);
        const idxToDefault = nextActiveIdx !== -1 ? nextActiveIdx : 0;
        remaining[idxToDefault] = { ...remaining[idxToDefault], is_default: true };
      }
      return remaining;
    });

    if (activeGsmOptionId === optId) {
      const nextOpt = configuredGsmOptions.find((o) => o.id !== optId);
      if (nextOpt) setActiveGsmOptionId(nextOpt.id);
    }
  };

  const updateActiveGsmOption = (patch: Partial<GsmOptionConfig>) => {
    if (!activeGsmOption) return;

    updateGsmConfig((prev) => {
      const updated = prev.map((opt) => {
        if (opt.id === activeGsmOption.id) {
          const nextOpt = { ...opt, ...patch };
          if (patch.is_active !== undefined) {
            nextOpt.active = patch.is_active;
          }
          return nextOpt;
        }
        if (patch.is_default) {
          return { ...opt, is_default: false };
        }
        return opt;
      });

      if (patch.is_active === false && activeGsmOption.is_default) {
        const nextActive = updated.find((o) => o.is_active && o.id !== activeGsmOption.id);
        if (nextActive) {
          nextActive.is_default = true;
          const curr = updated.find((o) => o.id === activeGsmOption.id);
          if (curr) curr.is_default = false;
        }
      }

      return updated;
    });
  };

  const activeGsmCurrentTiers = useMemo((): PrintingPricingTier[] => {
    if (!activeGsmOption) return [];
    if (activeGsmOption.side_tiers && activeGsmOption.side_tiers[activeGsmSideTab]) {
      return activeGsmOption.side_tiers[activeGsmSideTab];
    }
    if (activeGsmSideTab === 'front_only') {
      return activeGsmOption.tiers || [];
    }
    return (activeGsmOption.tiers || []).map((t) => {
      const doublePrice = Math.round(t.total_price * 1.4 * 100) / 100;
      return {
        ...t,
        id: `gtier_fb_${t.quantity}`,
        total_price: doublePrice,
        per_card_price: t.quantity > 0 ? doublePrice / t.quantity : 0,
      };
    });
  }, [activeGsmOption, activeGsmSideTab]);

  const updateActiveGsmSideTiers = (newTiers: PrintingPricingTier[]) => {
    if (!activeGsmOption) return;
    const currentSideTiers = activeGsmOption.side_tiers || {
      front_only: activeGsmOption.tiers || [],
      front_back: (activeGsmOption.tiers || []).map((t) => {
        const doublePrice = Math.round(t.total_price * 1.4 * 100) / 100;
        return {
          ...t,
          id: `gtier_fb_${t.quantity}`,
          total_price: doublePrice,
          per_card_price: t.quantity > 0 ? doublePrice / t.quantity : 0,
        };
      }),
    };

    const updatedSideTiers = {
      ...currentSideTiers,
      [activeGsmSideTab]: newTiers,
    };

    const patch: Partial<GsmOptionConfig> = {
      side_tiers: updatedSideTiers,
    };
    if (activeGsmSideTab === 'front_only') {
      patch.tiers = newTiers;
    }
    updateActiveGsmOption(patch);
  };

  const handleAddGsmTier = () => {
    if (!activeGsmOption) return;
    const currentTiers = activeGsmCurrentTiers;
    const maxQty = currentTiers.length > 0 ? Math.max(...currentTiers.map((t) => Number(t.quantity) || 0)) : 0;
    const nextQty = maxQty > 0 ? maxQty + 250 : 100;
    const scale = activeGsmSideTab === 'front_back' ? 1.4 : 1.0;
    const suggestedTotal = parseFloat((nextQty * 0.15 * scale).toFixed(2));
    const perCard = nextQty > 0 ? suggestedTotal / nextQty : 0;

    const newTier: PrintingPricingTier = {
      id: `gtier_${Date.now()}_${Math.random()}`,
      quantity: nextQty,
      total_price: suggestedTotal,
      per_card_price: perCard,
      label: nextQty >= 1000 ? 'Best Value' : nextQty >= 500 ? 'Popular' : 'Standard',
    };

    updateActiveGsmSideTiers([...currentTiers, newTier]);
  };

  const handleUpdateGsmTier = (
    tierIdx: number,
    field: keyof PrintingPricingTier,
    val: any
  ) => {
    if (!activeGsmOption) return;
    const tiers = [...activeGsmCurrentTiers];
    const target = { ...tiers[tierIdx], [field]: val };

    const qty = Number(field === 'quantity' ? val : target.quantity) || 0;
    const total = Number(field === 'total_price' ? val : target.total_price) || 0;
    target.per_card_price = qty > 0 ? total / qty : 0;

    tiers[tierIdx] = target;
    updateActiveGsmSideTiers(tiers);
  };

  const handleRemoveGsmTier = (tierIdx: number) => {
    if (!activeGsmOption) return;
    const tiers = activeGsmCurrentTiers.filter((_, i) => i !== tierIdx);
    updateActiveGsmSideTiers(tiers);
  };

  const handleAutoGenerateGsmTiers = () => {
    if (!activeGsmOption) return;
    const existing = activeGsmCurrentTiers;
    if (existing.length > 0) {
      const sideLabel = activeGsmSideTab === 'front_back' ? 'Double-Sided' : 'Single-Sided';
      const confirm = window.confirm(
        `Recalculate ${sideLabel} quantity tiers specifically for ${activeGsmOption.name} (${activeGsmOption.gsm || 150} GSM)? Current tiers will be replaced.`
      );
      if (!confirm) return;
    }

    const scale = activeGsmSideTab === 'front_back' ? 1.4 : 1.0;
    const freshTiers = createDefaultGsmTiers(activeGsmOption.gsm || activeGsmOption.name, scale);
    updateActiveGsmSideTiers(freshTiers);
  };

  const handleQuickFillStandardGsmTiers = () => {
    if (!activeGsmOption) return;
    const existing = activeGsmCurrentTiers;
    if (existing.length > 0) {
      const sideLabel = activeGsmSideTab === 'front_back' ? 'Double-Sided' : 'Single-Sided';
      const confirm = window.confirm(
        `Replace current ${sideLabel} tiers with standard quantity tiers calculated for ${activeGsmOption.name}? This will overwrite current tiers.`
      );
      if (!confirm) return;
    }

    const scale = activeGsmSideTab === 'front_back' ? 1.4 : 1.0;
    const freshTiers = createDefaultGsmTiers(activeGsmOption.gsm || activeGsmOption.name, scale);
    updateActiveGsmSideTiers(freshTiers);
  };

  const handleQuickAddGsmPreset = (preset: typeof STANDARD_GSM_PRESETS[0]) => {
    const exists = configuredGsmOptions.some(
      (o) => (o.name || '').toLowerCase() === preset.label.toLowerCase()
    );
    if (exists) {
      const existing = configuredGsmOptions.find(
        (o) => (o.name || '').toLowerCase() === preset.label.toLowerCase()
      );
      if (existing) setActiveGsmOptionId(existing.id);
      return;
    }

    const newId = `gsm_${preset.gsm || Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const baseTiers = createDefaultGsmTiers(preset.gsm, 1.0);
    const doubleTiers = createDefaultGsmTiers(preset.gsm, 1.4);
    const newOpt: GsmOptionConfig = {
      id: newId,
      name: preset.label,
      gsm: preset.gsm,
      stock_name: preset.defaultStock,
      is_active: true,
      active: true,
      is_default: configuredGsmOptions.length === 0,
      tiers: baseTiers,
      side_tiers: {
        front_only: baseTiers,
        front_back: doubleTiers,
      },
    };

    updateGsmConfig((prev) => [...prev, newOpt]);
    setActiveGsmOptionId(newId);
  };

  const gsmTierValidationErrors = useMemo(() => {
    if (!printingEnabled || !activeGsmOption) {
      return [];
    }
    return validateGsmTiers(activeGsmCurrentTiers);
  }, [printingEnabled, activeGsmOption, activeGsmCurrentTiers]);

  const gsmSummaryTier = useMemo(() => {
    if (!activeGsmOption || activeGsmCurrentTiers.length === 0) {
      return null;
    }
    if (selectedGsmSummaryQty) {
      const found = activeGsmCurrentTiers.find((t) => t.quantity === selectedGsmSummaryQty);
      if (found) return found;
    }
    return activeGsmCurrentTiers[0];
  }, [activeGsmOption, activeGsmCurrentTiers, selectedGsmSummaryQty]);

  // ── B. FOLDING STATE & HANDLERS ─────────────────────────────────────────────
  const [foldingPanelOpen, setFoldingPanelOpen] = useState<boolean>(true);
  const [activeFoldingOptionId, setActiveFoldingOptionId] = useState<string>('');
  const [isAddingFoldingOption, setIsAddingFoldingOption] = useState<boolean>(false);

  const [newFoldingOptionType, setNewFoldingOptionType] = useState<string>('half_fold');
  const [newFoldingOptionName, setNewFoldingOptionName] = useState<string>('Half Fold');
  const [newFoldingOptionMethod, setNewFoldingOptionMethod] = useState<FoldingPricingMethod>('per_order');
  const [newFoldingOptionIsDefault, setNewFoldingOptionIsDefault] = useState<boolean>(false);
  const [newFoldingOptionError, setNewFoldingOptionError] = useState<string>('');

  const rawFoldingPricing = formData.folding_pricing;
  const foldingEnabled = Boolean(rawFoldingPricing?.enabled);

  const configuredFoldingOptions: FoldingOptionConfig[] = useMemo(() => {
    const list = normalizeFoldingOptions(rawFoldingPricing?.options);
    if (list.length === 0 && rawFoldingPricing?.enabled) {
      return createDefaultInitialFoldingOptions();
    }
    return list;
  }, [rawFoldingPricing]);

  React.useEffect(() => {
    if (configuredFoldingOptions.length > 0) {
      if (!activeFoldingOptionId || !configuredFoldingOptions.some((o) => o.id === activeFoldingOptionId)) {
        const defaultOpt = configuredFoldingOptions.find((o) => o.is_default && o.is_active) || configuredFoldingOptions[0];
        setActiveFoldingOptionId(defaultOpt.id || defaultOpt.type || 'no_fold');
      }
    }
  }, [configuredFoldingOptions, activeFoldingOptionId]);

  const activeFoldingOption = useMemo(() => {
    return configuredFoldingOptions.find((o) => o.id === activeFoldingOptionId) || configuredFoldingOptions[0] || null;
  }, [configuredFoldingOptions, activeFoldingOptionId]);

  const updateFoldingConfig = (
    updater: (prevOptions: FoldingOptionConfig[]) => {
      options: FoldingOptionConfig[];
      enabled?: boolean;
    }
  ) => {
    setFormData((prev) => {
      const currentList = normalizeFoldingOptions(prev.folding_pricing?.options);
      const baseList = currentList.length > 0 ? currentList : configuredFoldingOptions;
      const { options: newOptions, enabled } = updater(baseList);

      const isEnabled = enabled !== undefined ? enabled : Boolean(prev.folding_pricing?.enabled);
      const primaryOpt = newOptions.find((o) => o.is_default) || newOptions[0];

      return {
        ...prev,
        folding_pricing: {
          enabled: isEnabled,
          pricing_method: primaryOpt?.pricing_method || 'quantity_based',
          additional_charge: primaryOpt?.charge ?? 10.0,
          tiers: primaryOpt?.tiers || createDefaultExampleTiers(),
          options: newOptions,
        },
      };
    });
  };

  const toggleFoldingEnabled = (enabled: boolean) => {
    setFormData((prev) => {
      const currentOptions = normalizeFoldingOptions(prev.folding_pricing?.options);
      const optionsToUse = currentOptions.length > 0 ? currentOptions : createDefaultInitialFoldingOptions();
      const primaryOpt = optionsToUse.find((o) => o.is_default) || optionsToUse[0];

      return {
        ...prev,
        folding_pricing: {
          enabled,
          pricing_method: primaryOpt?.pricing_method || 'quantity_based',
          additional_charge: primaryOpt?.charge ?? 10.0,
          tiers: primaryOpt?.tiers || createDefaultExampleTiers(),
          options: optionsToUse,
        },
      };
    });
  };

  const handleCreateFoldingOption = () => {
    setNewFoldingOptionError('');
    const trimmedName = newFoldingOptionName.trim();
    if (!trimmedName) {
      setNewFoldingOptionError('Please enter a display name for the folding option.');
      return;
    }

    const isDuplicate = configuredFoldingOptions.some(
      (o) =>
        o.type === newFoldingOptionType ||
        (o.name || '').trim().toLowerCase() === trimmedName.toLowerCase() ||
        o.id === newFoldingOptionType
    );

    if (isDuplicate) {
      setNewFoldingOptionError(`A folding option for "${trimmedName}" or style "${newFoldingOptionType}" is already configured.`);
      return;
    }

    const typeDef = STANDARD_FOLDING_TYPES.find((t) => t.value === newFoldingOptionType);
    const newId = `${newFoldingOptionType}_${Date.now()}`;

    const newOpt: FoldingOptionConfig = {
      id: newId,
      name: trimmedName,
      type: newFoldingOptionType,
      active: true,
      is_active: true,
      is_default: newFoldingOptionIsDefault,
      pricing_method: newFoldingOptionMethod,
      charge: typeDef?.defaultCharge ?? 10,
      tiers: newFoldingOptionMethod === 'quantity_based' ? createDefaultExampleTiers() : [],
    };

    updateFoldingConfig((prev) => {
      let updatedList = [...prev];
      if (newFoldingOptionIsDefault) {
        updatedList = updatedList.map((o) => ({ ...o, is_default: false }));
      }
      return { options: [...updatedList, newOpt] };
    });

    setActiveFoldingOptionId(newId);
    setIsAddingFoldingOption(false);
    setNewFoldingOptionName('');
    setNewFoldingOptionIsDefault(false);
  };

  const handleDeleteFoldingOption = (optId: string) => {
    const target = configuredFoldingOptions.find((o) => o.id === optId);
    if (!target) return;

    if (configuredFoldingOptions.length <= 1) {
      alert('At least one folding option must remain configured while folding is enabled.');
      return;
    }

    const hasConfig =
      target.pricing_method === 'quantity_based'
        ? target.tiers && target.tiers.length > 0
        : typeof target.charge === 'number' && target.charge > 0;

    const confirmMsg = hasConfig
      ? `Are you sure you want to delete "${target.name}"? Its configured pricing (${target.pricing_method}) will be removed.`
      : `Are you sure you want to remove the folding option "${target.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    updateFoldingConfig((prev) => {
      const remaining = prev.filter((o) => o.id !== optId);
      if (target.is_default && remaining.length > 0) {
        remaining[0] = { ...remaining[0], is_default: true };
      }
      return { options: remaining };
    });

    if (activeFoldingOptionId === optId) {
      const nextOpt = configuredFoldingOptions.find((o) => o.id !== optId);
      if (nextOpt) setActiveFoldingOptionId(nextOpt.id || nextOpt.type || '');
    }
  };

  const updateActiveFoldingOption = (patch: Partial<FoldingOptionConfig>) => {
    if (!activeFoldingOption) return;

    updateFoldingConfig((prev) => {
      const updated = prev.map((opt) => {
        if (opt.id === activeFoldingOption.id) {
          const nextOpt = { ...opt, ...patch };
          if (patch.is_active !== undefined) {
            nextOpt.active = patch.is_active;
          }
          return nextOpt;
        }
        if (patch.is_default) {
          return { ...opt, is_default: false };
        }
        return opt;
      });
      return { options: updated };
    });
  };

  const handleActiveFoldingMethodChange = (newMethod: FoldingPricingMethod) => {
    if (!activeFoldingOption) return;
    updateActiveFoldingOption({
      pricing_method: newMethod,
      tiers:
        newMethod === 'quantity_based' && (!activeFoldingOption.tiers || activeFoldingOption.tiers.length === 0)
          ? createDefaultExampleTiers()
          : activeFoldingOption.tiers,
    });
  };

  const handleAddFoldingTier = () => {
    if (!activeFoldingOption) return;
    const currentTiers = activeFoldingOption.tiers || [];
    const updatedTiers = calculateNextNonOverlappingTier(currentTiers);
    updateActiveFoldingOption({ tiers: updatedTiers });
  };

  const handleUpdateFoldingTier = (tierIdx: number, field: keyof FoldingPricingTier, val: any) => {
    if (!activeFoldingOption) return;
    const tiers = [...(activeFoldingOption.tiers || [])];
    tiers[tierIdx] = { ...tiers[tierIdx], [field]: val };
    updateActiveFoldingOption({ tiers });
  };

  const handleRemoveFoldingTier = (tierIdx: number) => {
    if (!activeFoldingOption) return;
    const tiers = (activeFoldingOption.tiers || []).filter((_, i) => i !== tierIdx);
    updateActiveFoldingOption({ tiers });
  };

  const handleQuickFillExampleFoldingTiers = () => {
    if (!activeFoldingOption) return;
    const existing = activeFoldingOption.tiers || [];
    if (existing.length > 0) {
      const confirm = window.confirm(
        'Replace current custom folding tiers with example reference tiers (100: $10, 250: $20, 500: $35, 1000: $60)? This will overwrite current tiers.'
      );
      if (!confirm) return;
    }
    updateActiveFoldingOption({ tiers: createDefaultExampleTiers() });
  };

  const foldingTierValidationErrors = useMemo(() => {
    if (!foldingEnabled || !activeFoldingOption || activeFoldingOption.pricing_method !== 'quantity_based') {
      return [];
    }
    return validateFoldingTiers(activeFoldingOption.tiers || []);
  }, [foldingEnabled, activeFoldingOption]);

  // ── C. STANDARD PRODUCT VOLUME PRICING TIERS ──────────────────────────────
  const pricingTiersSafe = formData.pricing_tiers || [];

  const addPricingTier = () => {
    const list = formData.pricing_tiers || [];
    const lastTier = list[list.length - 1];
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
      pricing_tiers: [...(prev.pricing_tiers || []), newTier],
    }));
  };

  const removePricingTier = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      pricing_tiers: (prev.pricing_tiers || []).filter((_, i) => i !== index),
    }));
  };

  const updateTier = (index: number, field: keyof PricingTierItem, val: any) => {
    setFormData((prev) => {
      const updated = [...(prev.pricing_tiers || [])];
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

  // ── C. SQUARE METER (M²) PRICING STATE & HANDLERS ─────────────────────────
  const rawSqmPricing = formData.sqm_pricing ?? formData.printing_pricing?.sqm_pricing;
  const sqmPricingEnabled = Boolean(rawSqmPricing?.enabled);

  const sqmConfig: SqmPricingConfig = useMemo(() => {
    return {
      enabled: sqmPricingEnabled,
      price_per_sqm: rawSqmPricing?.price_per_sqm ?? '',
      min_area_sqm: rawSqmPricing?.min_area_sqm ?? '',
      setup_fee: rawSqmPricing?.setup_fee ?? '',
    };
  }, [rawSqmPricing, sqmPricingEnabled]);

  const toggleSqmPricing = (enabled: boolean) => {
    const updated: SqmPricingConfig = {
      ...sqmConfig,
      enabled,
      price_per_sqm: sqmConfig.price_per_sqm !== '' ? sqmConfig.price_per_sqm : 45.0,
      min_area_sqm: sqmConfig.min_area_sqm !== '' ? sqmConfig.min_area_sqm : 0.25,
    };
    setFormData((prev) => ({
      ...prev,
      sqm_pricing: updated,
      printing_pricing: prev.printing_pricing
        ? { ...prev.printing_pricing, sqm_pricing: updated }
        : prev.printing_pricing,
    }));
  };

  const updateSqmField = (field: keyof SqmPricingConfig, val: any) => {
    const numVal = typeof val === 'number' ? val : val === '' ? '' : parseFloat(val) || 0;
    const updated: SqmPricingConfig = {
      ...sqmConfig,
      [field]: numVal,
    };
    setFormData((prev) => ({
      ...prev,
      sqm_pricing: updated,
      printing_pricing: prev.printing_pricing
        ? { ...prev.printing_pricing, sqm_pricing: updated }
        : prev.printing_pricing,
    }));
  };

  // Live Area Estimation
  const sqmCalculations = useMemo(() => {
    const w = typeof formData.width_mm === 'number' ? formData.width_mm : null;
    const h = typeof formData.height_mm === 'number' ? formData.height_mm : null;
    if (!w || !h || w <= 0 || h <= 0) return null;

    const actualArea = (w * h) / 1000000;
    const minArea = typeof sqmConfig.min_area_sqm === 'number' ? sqmConfig.min_area_sqm : 0;
    const billableArea = Math.max(actualArea, minArea);
    const rate = typeof sqmConfig.price_per_sqm === 'number' ? sqmConfig.price_per_sqm : 0;
    const setup = typeof sqmConfig.setup_fee === 'number' ? sqmConfig.setup_fee : 0;
    const estPrice = (billableArea * rate) + setup;

    return {
      actualArea,
      billableArea,
      estPrice,
    };
  }, [formData.width_mm, formData.height_mm, sqmConfig]);

  return (
    <FormSection
      title="Pricing & Volume Discounts"
      description="Set standard retail unit pricing, promotional sales, cost tracking, printing configuration fixed-total tiers, folding add-on rates, and volume discounts."
    >
      <div className="space-y-6">



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

        {/* Square Meter (m²) Pricing Panel */}
        <div className="p-4 bg-gradient-to-r from-amber-50/60 via-white to-amber-50/30 border border-amber-200/90 rounded-2xl space-y-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Maximize2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-gray-900 tracking-tight">
                    Square Meter (m²) Area-Based Pricing
                  </h4>
                  {sqmPricingEnabled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <Check className="w-3 h-3" /> Enabled
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      Optional
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Calculate pricing dynamically from custom width × height area dimensions (ideal for banners, vinyl, posters & signage).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sqmPricingEnabled}
                  onChange={(e) => toggleSqmPricing(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                <span className="ml-2 text-xs font-semibold text-gray-700">
                  {sqmPricingEnabled ? 'Active' : 'Off'}
                </span>
              </label>
            </div>
          </div>

          {sqmPricingEnabled ? (
            <div className="space-y-3.5 pt-1">
              <FormGrid cols={3} gap="md">
                <AdminNumberInput
                  label="Rate per m² ($ / m²)"
                  prefix="$"
                  placeholder="e.g. 45.00"
                  step={0.01}
                  min={0}
                  value={sqmConfig.price_per_sqm}
                  onChange={(val) => updateSqmField('price_per_sqm', val)}
                  helperText="Authoritative rate charged per square meter of print."
                />

                <AdminNumberInput
                  label="Min Billable Area (m²)"
                  suffix="m²"
                  placeholder="e.g. 0.25"
                  step={0.01}
                  min={0}
                  value={sqmConfig.min_area_sqm}
                  onChange={(val) => updateSqmField('min_area_sqm', val)}
                  helperText="Minimum billable threshold if customer specs smaller size."
                />

                <AdminNumberInput
                  label="Area Setup Surcharge ($)"
                  prefix="$"
                  placeholder="Optional, e.g. 10.00"
                  step={0.01}
                  min={0}
                  value={sqmConfig.setup_fee ?? ''}
                  onChange={(val) => updateSqmField('setup_fee', val)}
                  helperText="Fixed one-time handling / cutting charge added per item."
                />
              </FormGrid>

              {/* Dynamic Live Area Estimation Bar */}
              {sqmCalculations ? (
                <div className="p-3 bg-gradient-to-r from-amber-50 via-white to-amber-50/50 border border-amber-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-amber-600" />
                      Live Area Calculation:
                    </span>
                    <span className="font-semibold text-gray-800">
                      {formData.width_mm}mm × {formData.height_mm}mm
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="font-mono text-gray-700">
                      {sqmCalculations.actualArea.toFixed(4)} m²
                    </span>
                    {sqmCalculations.billableArea !== sqmCalculations.actualArea && (
                      <span className="text-amber-700 text-[11px] font-semibold bg-amber-100/70 px-1.5 py-0.5 rounded">
                        (Billed at minimum {sqmCalculations.billableArea} m²)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-[11px]">Estimated Base:</span>
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-mono">
                      ${sqmCalculations.estPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-gray-50/80 border border-dashed border-gray-200 rounded-xl text-center">
                  <p className="text-[11px] text-gray-500">
                    Product dimensions not set yet. Enter Width (mm) and Height (mm) in General specifications or customer enters custom dimensions on storefront to trigger live square meter pricing.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">
              Flip the toggle above to configure square meter (m²) pricing (e.g. $45/m², min 0.25m²) for large-format prints, signage, and roll substrates.
            </p>
          )}
        </div>

        {/* ─── PRINTING CONFIGURATION PRICING PANEL (Collapsible) ─────────── */}
        <div className="border border-sky-200/90 bg-sky-50/30 rounded-2xl overflow-hidden transition-all shadow-2xs">
          {/* Header Bar with Toggle & Accordion */}
          <div className="p-4 bg-gradient-to-r from-sky-50/90 to-white flex items-center justify-between gap-4 border-b border-sky-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-gray-900 tracking-tight">
                    Printing Configuration Pricing (Fixed-Total Tiers)
                  </h4>
                  {printingEnabled ? (
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
                  Configure product-specific side options (Front only, Front & back, etc.) with authoritative fixed-total quantity pricing.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Enable Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={printingEnabled}
                  onChange={(e) => togglePrintingEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                <span className="ml-2 text-xs font-semibold text-gray-700">
                  {printingEnabled ? 'Active' : 'Off'}
                </span>
              </label>

              <button
                type="button"
                onClick={() => setPrintingPanelOpen((prev) => !prev)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
                title={printingPanelOpen ? 'Collapse printing configuration' : 'Expand printing configuration'}
              >
                {printingPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {printingPanelOpen && (
            <div className="p-5 space-y-5 bg-white/95">
              {!printingEnabled ? (
                <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center space-y-1">
                  <p className="text-xs font-medium text-gray-600">
                    Fixed-total printing configuration pricing is disabled for this product.
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Flip the toggle above to configure Single-Sided, Double-Sided, or custom side options with exact package pricing (e.g. 100 cards = $25, 250 cards = $40).
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Options Manager Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">
                          {activeSectionTab === 'sides'
                            ? `Printing Side Configurations (${configuredPrintingOptions.length})`
                            : `GSM Configurations (${configuredGsmOptions.length})`}
                        </span>
                        <span className="text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded font-semibold border border-sky-200">
                          Product Specific
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {activeSectionTab === 'sides'
                          ? 'Select a configuration below to manage its fixed-total quantity tiers. Each option maintains independent pricing.'
                          : 'Select a GSM option below to manage its fixed-total quantity tiers. Each option maintains independent pricing.'}
                      </p>
                    </div>

                    {activeSectionTab === 'sides' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingPrintingOption((prev) => !prev);
                          setNewPrintingOptionError('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition shadow-2xs"
                      >
                        {isAddingPrintingOption ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{isAddingPrintingOption ? 'Cancel' : 'Add Configuration'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingGsmOption((prev) => !prev);
                          setNewGsmOptionError('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition shadow-2xs"
                      >
                        {isAddingGsmOption ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{isAddingGsmOption ? 'Cancel' : 'Add GSM Option'}</span>
                      </button>
                    )}
                  </div>

                  {/* Add Configuration Modal / Inline Card (Printing Sides) */}
                  {activeSectionTab === 'sides' && isAddingPrintingOption && (
                    <div className="p-4 bg-sky-50/50 border border-sky-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-900">Add New Printing Side Option</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingPrintingOption(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {newPrintingOptionError && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{newPrintingOptionError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Preset / Type
                          </label>
                          <select
                            value={newPrintingOptionSideType}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewPrintingOptionSideType(val);
                              const match = STANDARD_PRINTING_SIDE_PRESETS.find((p) => p.value === val);
                              if (match) {
                                setNewPrintingOptionName(match.label);
                              }
                            }}
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-sky-600 shadow-2xs"
                          >
                            {STANDARD_PRINTING_SIDE_PRESETS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={newPrintingOptionName}
                            onChange={(e) => setNewPrintingOptionName(e.target.value)}
                            placeholder="e.g. Single-Sided (Front Only)"
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-sky-600 shadow-2xs"
                          />
                        </div>

                        <div className="flex flex-col justify-end">
                          <label className="flex items-center gap-2 cursor-pointer mb-2 select-none">
                            <input
                              type="checkbox"
                              checked={newPrintingOptionIsDefault}
                              onChange={(e) => setNewPrintingOptionIsDefault(e.target.checked)}
                              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                            />
                            <span className="text-xs font-semibold text-gray-700">Set as default option</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleCreatePrintingOption}
                            className="w-full h-9 px-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs transition shadow-2xs"
                          >
                            Create Configuration
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add GSM Option Modal / Inline Card */}
                  {activeSectionTab === 'gsm' && isAddingGsmOption && (
                    <div className="p-4 bg-sky-50/50 border border-sky-200 rounded-xl space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-sky-900">Add New GSM Option</span>
                          <span className="text-[10px] text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-full font-semibold border border-sky-200">
                            Auto Tier Creation
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAddingGsmOption(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {newGsmOptionError && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{newGsmOptionError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Preset / Type
                          </label>
                          <select
                            value={newGsmOptionPreset}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewGsmOptionPreset(val);
                              const match = STANDARD_GSM_PRESETS.find((p) => p.value === val);
                              if (match && match.gsm > 0) {
                                setNewGsmOptionName(match.label);
                                setNewGsmOptionValue(match.gsm);
                                if (match.defaultStock) {
                                  setNewGsmOptionStock(match.defaultStock);
                                }
                              }
                            }}
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-sky-600 shadow-2xs"
                          >
                            {STANDARD_GSM_PRESETS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            GSM Display Name
                          </label>
                          <input
                            type="text"
                            value={newGsmOptionName}
                            onChange={(e) => {
                              setNewGsmOptionName(e.target.value);
                              const parsed = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                              if (parsed > 0) setNewGsmOptionValue(parsed);
                            }}
                            placeholder="e.g. 170 GSM"
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-sky-600 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            GSM Weight (g/m²)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={newGsmOptionValue}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value, 10) : '';
                              setNewGsmOptionValue(val);
                              if (val) {
                                setNewGsmOptionName(`${val} GSM`);
                              }
                            }}
                            placeholder="e.g. 170"
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-sky-600 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Paper / Stock Name (Optional)
                          </label>
                          <input
                            type="text"
                            value={newGsmOptionStock}
                            onChange={(e) => setNewGsmOptionStock(e.target.value)}
                            placeholder="e.g. Silk / Matte Paper"
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-sky-600 shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Feature: Automatic Tier Creation Option */}
                      <div className="p-3 bg-white border border-sky-200/90 rounded-xl space-y-2.5 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={newGsmAutoCreateTiers}
                              onChange={(e) => setNewGsmAutoCreateTiers(e.target.checked)}
                              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                            />
                            <div>
                              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                Automatically create quantity tiers for this GSM
                              </span>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                Generates 4 standard tiers (100, 250, 500, 1000 cards) scaled according to this paper weight ({newGsmOptionValue || 128} GSM).
                              </p>
                            </div>
                          </label>

                          {newGsmAutoCreateTiers && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-600 shrink-0">Pricing Rate:</span>
                              <select
                                value={newGsmTierScale}
                                onChange={(e) => setNewGsmTierScale(e.target.value as any)}
                                className="h-7 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-800 focus:bg-white focus:outline-none focus:border-sky-600"
                              >
                                <option value="standard">Standard Scaling</option>
                                <option value="economy">Economy (-15%)</option>
                                <option value="premium">Premium (+20%)</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {newGsmAutoCreateTiers && (
                          <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[11px] font-bold text-sky-900">
                              Generated Tiers Preview:
                            </span>
                            {createDefaultGsmTiers(
                              newGsmOptionValue || 128,
                              newGsmTierScale === 'economy' ? 0.85 : newGsmTierScale === 'premium' ? 1.2 : 1.0
                            ).map((t) => (
                              <span
                                key={t.quantity}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-150 text-[11px] font-mono font-medium"
                              >
                                <strong>{t.quantity} cards</strong>
                                <span className="text-gray-300">•</span>
                                <span className="text-emerald-700 font-bold">${t.total_price.toFixed(2)}</span>
                                <span className="text-gray-400 text-[10px]">(${t.quantity > 0 ? (t.total_price / t.quantity).toFixed(2) : '0.00'}/card)</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newGsmOptionIsDefault}
                            onChange={(e) => setNewGsmOptionIsDefault(e.target.checked)}
                            className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                          />
                          <span className="text-xs font-semibold text-gray-700">Set as default GSM option</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingGsmOption(false)}
                            className="h-9 px-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg text-xs transition shadow-2xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateGsmOption}
                            className="h-9 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs transition shadow-2xs inline-flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create GSM Option</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Option Selector Tabs */}
                  <div className="flex flex-wrap items-center gap-2">
                    {configuredPrintingOptions.map((opt) => {
                      const isSelected = activeSectionTab === 'sides' && activePrintingOption?.id === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setActiveSectionTab('sides');
                            setActivePrintingOptionId(opt.id);
                            setSelectedSummaryQty(null);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition border select-none ${isSelected
                              ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                              : opt.is_active
                                ? 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                : 'bg-gray-100/70 text-gray-400 border-gray-200 line-through'
                            }`}
                        >
                          <span>{opt.name}</span>
                          {opt.is_default && (
                            <span
                              className={`p-0.5 rounded-full ${isSelected ? 'bg-sky-500 text-amber-200' : 'bg-amber-100 text-amber-600'
                                }`}
                              title="Default option for customer selection"
                            >
                              <Star className="w-3 h-3 fill-current" />
                            </span>
                          )}
                          {!opt.is_active && (
                            <span className="text-[9px] px-1 bg-gray-200 text-gray-600 rounded">Off</span>
                          )}
                        </button>
                      );
                    })}

                    {/* GSM Tab (Placed right beside the existing tabs in highlighted empty space) */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSectionTab('gsm');
                        setSelectedGsmSummaryQty(null);
                      }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border select-none ${activeSectionTab === 'gsm'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                    >
                      <span>GSM</span>
                      {configuredGsmOptions.length > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeSectionTab === 'gsm'
                              ? 'bg-sky-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                            }`}
                        >
                          {configuredGsmOptions.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Active Configuration Details & Tiers */}
                  {activeSectionTab === 'sides' && activePrintingOption && (
                    <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-4">
                      {/* Configuration Controls Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <span className="text-xs font-semibold text-gray-500 shrink-0">Name:</span>
                          <input
                            type="text"
                            value={activePrintingOption.name}
                            onChange={(e) => updateActivePrintingOption({ name: e.target.value })}
                            className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:border-sky-600 w-full max-w-xs"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Active Toggle */}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={activePrintingOption.is_active}
                              onChange={(e) =>
                                updateActivePrintingOption({
                                  is_active: e.target.checked,
                                  active: e.target.checked,
                                })
                              }
                              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                            />
                            <span className="text-xs font-semibold text-gray-700">Active</span>
                          </label>

                          {/* Default Toggle Button */}
                          {!activePrintingOption.is_default ? (
                            <button
                              type="button"
                              onClick={() => updateActivePrintingOption({ is_default: true })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                              title="Set as the default option presented to customers"
                            >
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              <span>Set Default</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              <span>Default</span>
                            </span>
                          )}

                          {/* Delete Configuration Button */}
                          <button
                            type="button"
                            onClick={() => handleDeletePrintingOption(activePrintingOption.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            title="Delete this printing configuration"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Live Summary Preview Pill */}
                      {summaryTier && (
                        <div className="p-3 bg-gradient-to-r from-sky-50 via-white to-sky-50/50 border border-sky-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sky-900 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-sky-600" />
                              Live Calculation:
                            </span>
                            <span className="font-semibold text-gray-800">
                              {summaryTier.quantity} cards
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="font-bold text-sky-700">
                              Fixed total: ${summaryTier.total_price.toFixed(2)}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Price per card: ${(summaryTier.quantity > 0 ? summaryTier.total_price / summaryTier.quantity : 0).toFixed(2)}
                            </span>
                            {summaryTier.label && (
                              <span className="text-gray-500 text-[11px]">({summaryTier.label})</span>
                            )}
                          </div>

                          {/* Quick Quantity Switcher Chips */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 mr-1">Preview tier:</span>
                            {(activePrintingOption.tiers || []).map((t) => (
                              <button
                                key={t.id || t.quantity}
                                type="button"
                                onClick={() => setSelectedSummaryQty(t.quantity)}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${summaryTier.quantity === t.quantity
                                    ? 'bg-sky-600 text-white font-bold'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                  }`}
                              >
                                {t.quantity}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tier Validation Errors */}
                      {printingTierValidationErrors.length > 0 && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-700">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            <span>Tier Configuration Warnings</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                            {printingTierValidationErrors.map((msg, i) => (
                              <li key={i}>{msg}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Fixed Total Quantity Tiers Table */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-800">
                            Quantity Tiers ({activePrintingOption.tiers?.length || 0})
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleQuickFillStandardPrintingTiers}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-2xs"
                              title="Fill standard reference tiers (100, 250, 500, 1000)"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>Quick Fill Standard Tiers</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleAddPrintingTier}
                              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Quantity Tier</span>
                            </button>
                          </div>
                        </div>

                        {activePrintingOption.tiers && activePrintingOption.tiers.length > 0 ? (
                          <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200">
                                <tr>
                                  <th className="py-2.5 px-4 w-36">Quantity (Units)</th>
                                  <th className="py-2.5 px-4 w-44">Fixed Total Price ($)</th>
                                  <th className="py-2.5 px-4 w-44">Price Per Card (Auto)</th>
                                  <th className="py-2.5 px-4">Display Label (Optional)</th>
                                  <th className="py-2.5 px-4 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {activePrintingOption.tiers.map((tier, tIdx) => {
                                  const qty = Number(tier.quantity) || 0;
                                  const total = Number(tier.total_price) || 0;
                                  const perCard = qty > 0 ? (total / qty).toFixed(2) : '0.00';

                                  return (
                                    <tr key={tier.id || tIdx} className="hover:bg-gray-50/50 transition">
                                      <td className="py-2 px-4">
                                        <AdminNumberInput
                                          min={1}
                                          step={1}
                                          value={tier.quantity}
                                          onChange={(val) =>
                                            handleUpdatePrintingTier(
                                              tIdx,
                                              'quantity',
                                              typeof val === 'number' ? val : 1
                                            )
                                          }
                                        />
                                      </td>
                                      <td className="py-2 px-4">
                                        <AdminNumberInput
                                          prefix="$"
                                          step={0.01}
                                          min={0}
                                          value={tier.total_price}
                                          onChange={(val) =>
                                            handleUpdatePrintingTier(
                                              tIdx,
                                              'total_price',
                                              typeof val === 'number' ? val : 0
                                            )
                                          }
                                        />
                                      </td>
                                      <td className="py-2 px-4">
                                        <div className="h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs font-mono text-gray-800">
                                          <span className="font-bold text-emerald-700">${perCard}</span>
                                          <span className="text-[10px] text-gray-400">/card</span>
                                        </div>
                                      </td>
                                      <td className="py-2 px-4">
                                        <input
                                          type="text"
                                          placeholder="e.g. Popular, Starter"
                                          value={tier.label || ''}
                                          onChange={(e) =>
                                            handleUpdatePrintingTier(tIdx, 'label', e.target.value)
                                          }
                                          className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-sky-600 shadow-2xs"
                                        />
                                      </td>
                                      <td className="py-2 px-4 text-right">
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePrintingTier(tIdx)}
                                          className="p-1.5 text-gray-400 hover:text-rose-600 transition rounded-md"
                                          title="Delete Tier"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-4 border border-dashed border-gray-200 rounded-xl bg-white text-center space-y-1">
                            <p className="text-xs text-gray-500">
                              No fixed-total tiers configured for &ldquo;{activePrintingOption.name}&rdquo;.
                            </p>
                            <button
                              type="button"
                              onClick={handleQuickFillStandardPrintingTiers}
                              className="text-xs text-sky-600 font-semibold hover:underline"
                            >
                              Click here to fill standard tiers (100: $25, 250: $40, 500: $60, 1000: $95)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* GSM Configuration Pricing Interface */}
                  {activeSectionTab === 'gsm' && (
                    <div className="space-y-4">
                      {/* GSM Sub-Option Selector Chips */}
                      {configuredGsmOptions.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-sky-50/40 rounded-xl border border-sky-100">
                          <span className="text-xs font-bold text-sky-900 mr-1 shrink-0">GSM Options:</span>
                          {configuredGsmOptions.map((opt) => {
                            const isSelected = activeGsmOption?.id === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setActiveGsmOptionId(opt.id);
                                  setSelectedGsmSummaryQty(null);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border select-none ${isSelected
                                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                                    : opt.is_active
                                      ? 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                                      : 'bg-gray-100/70 text-gray-400 border-gray-200 line-through'
                                  }`}
                              >
                                <span>{opt.name}</span>
                                {opt.stock_name && (
                                  <span
                                    className={`text-[10px] ${isSelected ? 'text-sky-100' : 'text-gray-400'
                                      }`}
                                  >
                                    ({opt.stock_name})
                                  </span>
                                )}
                                {opt.is_default && (
                                  <span
                                    className={`p-0.5 rounded-full ${isSelected ? 'bg-sky-500 text-amber-200' : 'bg-amber-100 text-amber-600'
                                      }`}
                                    title="Default GSM option"
                                  >
                                    <Star className="w-3 h-3 fill-current" />
                                  </span>
                                )}
                                {!opt.is_active && (
                                  <span className="text-[9px] px-1 bg-gray-200 text-gray-600 rounded">Off</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-5 bg-gray-50/70 border border-gray-200 rounded-xl text-center space-y-3">
                          <p className="text-xs font-semibold text-gray-700">
                            No GSM options configured yet.
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Add GSM options (e.g. 128 GSM, 150 GSM, 170 GSM, 250 GSM, 300 GSM, 350 GSM) to configure independent quantity pricing tiers.
                          </p>
                          <div className="flex flex-wrap justify-center gap-2 pt-1">
                            {STANDARD_GSM_PRESETS.filter((p) => p.gsm > 0).map((preset) => (
                              <button
                                key={preset.value}
                                type="button"
                                onClick={() => handleQuickAddGsmPreset(preset)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{preset.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active GSM Details & Tiers */}
                      {activeGsmOption && (
                        <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-4">
                          {/* Configuration Controls Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-200">
                            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                              <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                                <span className="text-xs font-semibold text-gray-500 shrink-0">GSM Name:</span>
                                <input
                                  type="text"
                                  value={activeGsmOption.name}
                                  onChange={(e) => updateActiveGsmOption({ name: e.target.value })}
                                  placeholder="e.g. 128 GSM"
                                  className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:border-sky-600 w-full max-w-[170px]"
                                />
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs font-semibold text-gray-500 shrink-0">Weight:</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={activeGsmOption.gsm ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value, 10) : '';
                                    updateActiveGsmOption({ gsm: val });
                                  }}
                                  placeholder="e.g. 150"
                                  className="h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:border-sky-600 w-16"
                                />
                                <span className="text-[11px] text-gray-400 font-medium">GSM</span>
                              </div>

                              <div className="flex items-center gap-2 flex-1 min-w-[170px]">
                                <span className="text-xs font-semibold text-gray-500 shrink-0">Paper / Stock:</span>
                                <input
                                  type="text"
                                  value={activeGsmOption.stock_name || ''}
                                  onChange={(e) => updateActiveGsmOption({ stock_name: e.target.value })}
                                  placeholder="e.g. Standard Art Paper (optional)"
                                  className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:border-sky-600 w-full max-w-[200px]"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Active Toggle */}
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={activeGsmOption.is_active}
                                  onChange={(e) =>
                                    updateActiveGsmOption({
                                      is_active: e.target.checked,
                                      active: e.target.checked,
                                    })
                                  }
                                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                                />
                                <span className="text-xs font-semibold text-gray-700">Active</span>
                              </label>

                              {/* Default Toggle Button */}
                              {!activeGsmOption.is_default ? (
                                <button
                                  type="button"
                                  onClick={() => updateActiveGsmOption({ is_default: true })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                                  title="Set as default GSM option presented to customers"
                                >
                                  <Star className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Set Default</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                  <span>Default</span>
                                </span>
                              )}

                              {/* Delete GSM Option Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteGsmOption(activeGsmOption.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                title="Delete this GSM configuration"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Live Summary Preview Pill */}
                          {gsmSummaryTier && (
                            <div className="p-3 bg-gradient-to-r from-sky-50 via-white to-sky-50/50 border border-sky-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sky-900 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-sky-600" />
                                  Live Calculation:
                                </span>
                                <span className="font-semibold text-gray-800">
                                  {gsmSummaryTier.quantity} cards
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="font-bold text-sky-700">
                                  Fixed total: ${gsmSummaryTier.total_price.toFixed(2)}
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Price per card: ${(gsmSummaryTier.quantity > 0 ? gsmSummaryTier.total_price / gsmSummaryTier.quantity : 0).toFixed(2)}
                                </span>
                                {gsmSummaryTier.label && (
                                  <span className="text-gray-500 text-[11px]">({gsmSummaryTier.label})</span>
                                )}
                              </div>

                              {/* Quick Quantity Switcher Chips */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 mr-1">Preview tier:</span>
                                {(activeGsmCurrentTiers || []).map((t) => (
                                  <button
                                    key={t.id || t.quantity}
                                    type="button"
                                    onClick={() => setSelectedGsmSummaryQty(t.quantity)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${gsmSummaryTier?.quantity === t.quantity
                                        ? 'bg-sky-600 text-white font-bold'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                      }`}
                                  >
                                    {t.quantity}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tier Validation Errors */}
                          {gsmTierValidationErrors.length > 0 && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-700">
                              <div className="flex items-center gap-1.5 font-bold">
                                <AlertCircle className="w-4 h-4 text-rose-600" />
                                <span>Tier Configuration Warnings</span>
                              </div>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                                {gsmTierValidationErrors.map((msg, i) => (
                                  <li key={i}>{msg}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Side Selector Tabs inside GSM Configuration */}
                          <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-white border border-gray-200 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-700">Printing Sides:</span>
                              <div className="inline-flex items-center p-1 bg-gray-100 rounded-lg border border-gray-200">
                                <button
                                  type="button"
                                  onClick={() => setActiveGsmSideTab('front_only')}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                                    activeGsmSideTab === 'front_only'
                                      ? 'bg-white text-sky-700 shadow-2xs font-bold border border-gray-200/80'
                                      : 'text-gray-600 hover:text-gray-900'
                                  }`}
                                >
                                  Single-Sided (Front Only)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveGsmSideTab('front_back')}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                                    activeGsmSideTab === 'front_back'
                                      ? 'bg-white text-sky-700 shadow-2xs font-bold border border-gray-200/80'
                                      : 'text-gray-600 hover:text-gray-900'
                                  }`}
                                >
                                  Double-Sided (Front & Back)
                                </button>
                              </div>
                            </div>

                            <span className="text-[11px] text-gray-500 font-medium">
                              Configuring tiers for <strong className="text-gray-800">{activeGsmOption.name}</strong> •{' '}
                              <strong className="text-sky-700">{activeGsmSideTab === 'front_back' ? 'Double-Sided' : 'Single-Sided'}</strong>
                            </span>
                          </div>

                          {/* Fixed Total Quantity Tiers Table */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-800">
                                Quantity Tiers ({activeGsmCurrentTiers?.length || 0})
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleAutoGenerateGsmTiers}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition shadow-2xs"
                                  title={`Auto-generate and scale quantity tiers specifically for ${activeGsmOption.name} (${activeGsmSideTab})`}
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Auto-Generate Tiers</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={handleQuickFillStandardGsmTiers}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-2xs"
                                  title="Fill standard reference tiers (100, 250, 500, 1000)"
                                >
                                  <Sparkles className="w-3 h-3 text-gray-400" />
                                  <span>Quick Fill Standard Tiers</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={handleAddGsmTier}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition shadow-2xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add Quantity Tier</span>
                                </button>
                              </div>
                            </div>

                            {activeGsmCurrentTiers && activeGsmCurrentTiers.length > 0 ? (
                              <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200">
                                    <tr>
                                      <th className="py-2.5 px-4 w-36">Quantity (Units)</th>
                                      <th className="py-2.5 px-4 w-44">Fixed Total Price ($)</th>
                                      <th className="py-2.5 px-4 w-44">Price Per Card (Auto)</th>
                                      <th className="py-2.5 px-4">Display Label (Optional)</th>
                                      <th className="py-2.5 px-4 text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {activeGsmCurrentTiers.map((tier, tIdx) => {
                                      const qty = Number(tier.quantity) || 0;
                                      const total = Number(tier.total_price) || 0;
                                      const perCard = qty > 0 ? (total / qty).toFixed(2) : '0.00';

                                      return (
                                        <tr key={tier.id || tIdx} className="hover:bg-gray-50/50 transition">
                                          <td className="py-2 px-4">
                                            <AdminNumberInput
                                              min={1}
                                              step={1}
                                              value={tier.quantity}
                                              onChange={(val) =>
                                                handleUpdateGsmTier(
                                                  tIdx,
                                                  'quantity',
                                                  typeof val === 'number' ? val : 1
                                                )
                                              }
                                            />
                                          </td>
                                          <td className="py-2 px-4">
                                            <AdminNumberInput
                                              prefix="$"
                                              step={0.01}
                                              min={0}
                                              value={tier.total_price}
                                              onChange={(val) =>
                                                handleUpdateGsmTier(
                                                  tIdx,
                                                  'total_price',
                                                  typeof val === 'number' ? val : 0
                                                )
                                              }
                                            />
                                          </td>
                                          <td className="py-2 px-4">
                                            <div className="h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs font-mono text-gray-800">
                                              <span className="font-bold text-emerald-700">${perCard}</span>
                                              <span className="text-[10px] text-gray-400">/card</span>
                                            </div>
                                          </td>
                                          <td className="py-2 px-4">
                                            <input
                                              type="text"
                                              placeholder="e.g. Popular, Starter"
                                              value={tier.label || ''}
                                              onChange={(e) =>
                                                handleUpdateGsmTier(tIdx, 'label', e.target.value)
                                              }
                                              className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-sky-600 shadow-2xs"
                                            />
                                          </td>
                                          <td className="py-2 px-4 text-right">
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveGsmTier(tIdx)}
                                              className="p-1.5 text-gray-400 hover:text-rose-600 transition rounded-md"
                                              title="Delete Tier"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="p-4 border border-dashed border-gray-200 rounded-xl bg-white text-center space-y-2">
                                <p className="text-xs text-gray-500">
                                  No quantity tiers configured yet for &ldquo;{activeGsmOption.name}&rdquo; ({activeGsmSideTab === 'front_back' ? 'Double-Sided' : 'Single-Sided'}).
                                </p>
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleAutoGenerateGsmTiers}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition shadow-2xs"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Auto-Generate Tiers</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleAddGsmTier}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Tier Manually</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
                          Product Folding Options ({configuredFoldingOptions.length})
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
                          setIsAddingFoldingOption((prev) => !prev);
                          setNewFoldingOptionError('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-2xs"
                      >
                        {isAddingFoldingOption ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{isAddingFoldingOption ? 'Cancel' : 'Add Folding Option'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Add Option Form Card */}
                  {isAddingFoldingOption && (
                    <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900">Add New Folding Option</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingFoldingOption(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {newFoldingOptionError && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{newFoldingOptionError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Folding Type
                          </label>
                          <select
                            value={newFoldingOptionType}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewFoldingOptionType(val);
                              const typeDef = STANDARD_FOLDING_TYPES.find((t) => t.value === val);
                              if (typeDef) {
                                setNewFoldingOptionName(typeDef.label);
                                setNewFoldingOptionMethod(typeDef.defaultMethod);
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
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={newFoldingOptionName}
                            onChange={(e) => setNewFoldingOptionName(e.target.value)}
                            placeholder="e.g. Tri-Fold Brochure"
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-600 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Pricing Calculation Method
                          </label>
                          <select
                            value={newFoldingOptionMethod}
                            onChange={(e) => setNewFoldingOptionMethod(e.target.value as FoldingPricingMethod)}
                            className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                          >
                            <option value="per_order">Per Order (Flat Setup Fee)</option>
                            <option value="per_copy">Per Copy / Unit</option>
                            <option value="quantity_based">Quantity Tier Based</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newFoldingOptionIsDefault}
                            onChange={(e) => setNewFoldingOptionIsDefault(e.target.checked)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <span className="text-xs font-semibold text-gray-700">Set as default option for customer</span>
                        </label>

                        <button
                          type="button"
                          onClick={handleCreateFoldingOption}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition shadow-2xs"
                        >
                          Create Option
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Options List / Selector */}
                  <div className="flex flex-wrap items-center gap-2">
                    {configuredFoldingOptions.map((opt) => {
                      const isSelected = activeFoldingOption?.id === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setActiveFoldingOptionId(opt.id || opt.type || '')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition border select-none ${isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : opt.is_active
                                ? 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                : 'bg-gray-100/70 text-gray-400 border-gray-200 line-through'
                            }`}
                        >
                          <span>{opt.name}</span>
                          {opt.is_default && (
                            <span
                              className={`p-0.5 rounded-full ${isSelected ? 'bg-indigo-500 text-amber-200' : 'bg-amber-100 text-amber-600'
                                }`}
                              title="Default option for customer"
                            >
                              <Star className="w-3 h-3 fill-current" />
                            </span>
                          )}
                          {!opt.is_active && (
                            <span className="text-[9px] px-1 bg-gray-200 text-gray-600 rounded">Off</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Option Editor */}
                  {activeFoldingOption && (
                    <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-4">
                      {/* Active Option Settings Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <span className="text-xs font-semibold text-gray-500 shrink-0">Name:</span>
                          <input
                            type="text"
                            value={activeFoldingOption.name}
                            onChange={(e) => updateActiveFoldingOption({ name: e.target.value })}
                            className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:border-indigo-600 w-full max-w-xs"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Active Toggle */}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={activeFoldingOption.is_active}
                              onChange={(e) =>
                                updateActiveFoldingOption({
                                  is_active: e.target.checked,
                                  active: e.target.checked,
                                })
                              }
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span className="text-xs font-semibold text-gray-700">Active</span>
                          </label>

                          {/* Default Toggle Button */}
                          {!activeFoldingOption.is_default ? (
                            <button
                              type="button"
                              onClick={() => updateActiveFoldingOption({ is_default: true })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                              title="Set as default folding style"
                            >
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              <span>Set Default</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              <span>Default</span>
                            </span>
                          )}

                          {/* Delete Option Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteFoldingOption(activeFoldingOption.id || '')}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            title="Delete folding option"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Pricing Method Selector */}
                      <div>
                        <label className="block text-xs font-bold text-gray-800 mb-1.5">
                          Pricing Method for &ldquo;{activeFoldingOption.name}&rdquo;
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleActiveFoldingMethodChange('per_order')}
                            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${activeFoldingOption.pricing_method === 'per_order'
                                ? 'bg-indigo-50/60 border-indigo-600 text-indigo-950 ring-1 ring-indigo-600/30'
                                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                              }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">Per Order</span>
                                {activeFoldingOption.pricing_method === 'per_order' && (
                                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 mt-1">
                                Flat charge applied once per order line.
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleActiveFoldingMethodChange('per_copy')}
                            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${activeFoldingOption.pricing_method === 'per_copy'
                                ? 'bg-indigo-50/60 border-indigo-600 text-indigo-950 ring-1 ring-indigo-600/30'
                                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                              }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">Per Printed Copy</span>
                                {activeFoldingOption.pricing_method === 'per_copy' && (
                                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 mt-1">
                                Fixed folding fee multiplied by quantity.
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleActiveFoldingMethodChange('quantity_based')}
                            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${activeFoldingOption.pricing_method === 'quantity_based'
                                ? 'bg-indigo-50/60 border-indigo-600 text-indigo-950 ring-1 ring-indigo-600/30'
                                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                              }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">Quantity Tier Based</span>
                                {activeFoldingOption.pricing_method === 'quantity_based' && (
                                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 mt-1">
                                Tiered charges based on order volume breaks.
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Pricing Inputs according to selected method */}
                      {activeFoldingOption.pricing_method === 'per_order' && (
                        <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-2">
                          <label className="block text-xs font-bold text-gray-800">
                            Per-Order Flat Folding Fee
                          </label>
                          <div className="max-w-xs">
                            <AdminNumberInput
                              prefix="$"
                              step={0.01}
                              min={0}
                              value={activeFoldingOption.charge ?? 0}
                              onChange={(val) =>
                                updateActiveFoldingOption({ charge: typeof val === 'number' ? val : 0 })
                              }
                              helperText="Flat finisher setup fee added once regardless of quantity."
                            />
                          </div>
                        </div>
                      )}

                      {activeFoldingOption.pricing_method === 'per_copy' && (
                        <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-2">
                          <label className="block text-xs font-bold text-gray-800">
                            Per-Printed-Copy Folding Charge
                          </label>
                          <div className="max-w-xs">
                            <AdminNumberInput
                              prefix="$"
                              step={0.001}
                              min={0}
                              value={activeFoldingOption.charge ?? 0}
                              onChange={(val) =>
                                updateActiveFoldingOption({ charge: typeof val === 'number' ? val : 0 })
                              }
                              helperText="Charged for each folded sheet produced."
                            />
                          </div>
                        </div>
                      )}

                      {activeFoldingOption.pricing_method === 'quantity_based' && (
                        <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="block text-xs font-bold text-gray-800">
                                Quantity Volume Tiers ({activeFoldingOption.tiers?.length || 0})
                              </span>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Set non-overlapping quantity intervals and charges.
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleQuickFillExampleFoldingTiers}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-2xs"
                                title="Quick load standard testing tiers (100: $10, 250: $20, 500: $35, 1000: $60)"
                              >
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                <span>Quick Fill Example Tiers</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleAddFoldingTier}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-2xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Tier</span>
                              </button>
                            </div>
                          </div>

                          {/* Tier Validation Warnings Banner */}
                          {foldingTierValidationErrors.length > 0 && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-700">
                              <div className="flex items-center gap-1.5 font-bold">
                                <AlertCircle className="w-4 h-4 text-rose-600" />
                                <span>Tier Configuration Warnings</span>
                              </div>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                                {foldingTierValidationErrors.map((msg, i) => (
                                  <li key={i}>{msg}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Tiers Table */}
                          {(activeFoldingOption.tiers || []).length > 0 ? (
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
                                  {(activeFoldingOption.tiers || []).map((tier, tIdx) => (
                                    <tr key={tier.id || tIdx} className="hover:bg-gray-50/50 transition">
                                      <td className="py-2 px-4">
                                        <AdminNumberInput
                                          min={1}
                                          value={tier.min_quantity}
                                          onChange={(val) =>
                                            handleUpdateFoldingTier(
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
                                            handleUpdateFoldingTier(
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
                                            handleUpdateFoldingTier(
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
                                          onClick={() => handleRemoveFoldingTier(tIdx)}
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
                                onClick={handleQuickFillExampleFoldingTiers}
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

        {/* ─── QUANTITY TIER PRICING MATRIX (Unchanged standard product pricing tiers) ─── */}
        <div className="space-y-3 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-gray-700 select-none">
                Quantity Tier Pricing Matrix ({pricingTiersSafe.length})
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

          {pricingTiersSafe.length > 0 ? (
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
                  {pricingTiersSafe.map((tier, idx) => (
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
