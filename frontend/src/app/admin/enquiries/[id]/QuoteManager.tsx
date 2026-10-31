'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '@/services/api/client';
import {
  manualOrderService,
  CalculatedTotals,
} from '@/services/admin/manualOrderService';
import {
  Plus,
  Trash2,
  Pencil,
  Send,
  Copy,
  ExternalLink,
  ChevronDown,
  Layers,
  Sliders,
  Sparkles,
  Package,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  ShieldCheck,
  RefreshCw,
  Save,
  Check,
} from 'lucide-react';

interface CustomerOption {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
}

interface ProductCatalogOption {
  id: string;
  name: string;
  slug: string;
  base_price: string;
}

interface DesignTemplateOption {
  id: string;
  name: string;
  thumbnail_url?: string | null;
  width_mm?: number | string | null;
  height_mm?: number | string | null;
}

export interface QuoteItemPayload {
  id?: string;
  client_key?: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price_ex_gst?: number;
  price?: number;
  line_total_ex_gst?: number;
  specifications?: string;
  options?: Record<string, any>;
}

export interface QuoteRecord {
  id: number;
  quote_number: string;
  recipient_name: string | null;
  recipient_email: string;
  enquiry_name?: string | null;
  status: string;
  total_inc_gst: number;
  currency: string;
  expires_at: string | null;
  order_id: string | null;
  created_at?: string;
}

export interface EnquiryQuoteContext {
  id: number;
  name: string;
  email: string;
  product_id?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  delivery_location?: string | null;
  specifications?: Record<string, unknown> | null;
}

const SIZE_PRESETS: Record<string, { width: string; height: string; label: string }> = {
  custom: { width: '', height: '', label: 'Custom Dimensions (mm)' },
  a4: { width: '210', height: '297', label: 'A4 (210 × 297 mm)' },
  a3: { width: '297', height: '420', label: 'A3 (297 × 420 mm)' },
  a5: { width: '148', height: '210', label: 'A5 (148 × 210 mm)' },
  a6: { width: '105', height: '148', label: 'A6 (105 × 148 mm)' },
  business_card: { width: '90', height: '55', label: 'Business Card (90 × 55 mm)' },
  dl: { width: '99', height: '210', label: 'DL Flyer (99 × 210 mm)' },
  poster_a2: { width: '420', height: '594', label: 'A2 Poster (420 × 594 mm)' },
  poster_a1: { width: '594', height: '841', label: 'A1 Poster (594 × 841 mm)' },
  banner: { width: '850', height: '2000', label: 'Pull-Up Banner (850 × 2000 mm)' },
  corflute: { width: '600', height: '900', label: 'Corflute Sign (600 × 900 mm)' },
};

const STOCK_OPTIONS = [
  '350gsm Premium Silk Artboard',
  '450gsm Heavyweight Artboard',
  '150gsm Gloss Artpaper',
  '150gsm Matte Artpaper',
  '80gsm Uncoated Bond',
  '100gsm Recycled Laser',
  'Vinyl Adhesive Sticker (Gloss)',
  'Vinyl Adhesive Sticker (Matte)',
  '5mm White Corflute Board',
  '450gsm Outdoor Heavy PVC Banner',
  '3mm Aluminium Composite Panel',
  'Custom Material...',
];

const SIDES_OPTIONS = [
  'Double Sided (Full Colour 4/4)',
  'Single Sided (Full Colour 4/0)',
  'Black & White (1/0)',
  'Double Sided Black & White (1/1)',
];

const FINISH_OPTIONS = [
  'None / Uncoated',
  'Matte Lamination (Both Sides)',
  'Gloss Lamination (Both Sides)',
  'Soft Touch Velvet Lamination',
  'Spot UV Gloss + Matte Cello',
  'Gold Foil Stamping',
  'Silver Foil Stamping',
  'Eyelets Every 500mm + Ropes',
  'Hemmed Edges',
];

const createQuoteLineKey = () => `quote-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function QuoteManager({
  enquiry,
  standalone = false,
}: {
  enquiry?: EnquiryQuoteContext;
  standalone?: boolean;
}) {
  // Directory & Autocomplete data
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogOption[]>([]);

  // Customer Details Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState(enquiry?.name || '');
  const [customerEmail, setCustomerEmail] = useState(enquiry?.email || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Standard delivery (Free)');
  const [deliveryAddress, setDeliveryAddress] = useState(enquiry?.delivery_location || '');
  const [shippingFee, setShippingFee] = useState<number | null>(null);

  // Notes & Quote Settings
  const [internalNotes, setInternalNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState(
    'Please check all quote details carefully. Reply or accept online when you are ready to proceed with production.'
  );
  const [validDays, setValidDays] = useState(14);

  // Products List State
  const initialSpecs = enquiry?.specifications
    ? Object.entries(enquiry.specifications)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : '';

  const [items, setItems] = useState<QuoteItemPayload[]>(() => {
    if (enquiry) {
      return [
        {
          client_key: createQuoteLineKey(),
          product_name: enquiry.product_name || 'Custom Print Product',
          product_id: enquiry.product_id || null,
          quantity: enquiry.quantity || 500,
          unit_price_ex_gst: 0.2,
          price: (enquiry.quantity || 500) * 0.2,
          specifications: initialSpecs || 'Standard Specifications',
          options: {
            specifications: initialSpecs || 'Standard Specifications',
          },
        },
      ];
    }
    return [
      {
        client_key: createQuoteLineKey(),
        product_name: 'Custom A4 Flyer / Print',
        quantity: 500,
        unit_price_ex_gst: 0.24,
        price: 120.0,
        specifications: '210 × 297 mm • 350gsm Premium Silk Artboard • Double Sided (Full Colour 4/4)',
        options: {
          product_name: 'Custom A4 Flyer / Print',
          dimensions: '210 × 297 mm',
          width_mm: '210',
          height_mm: '297',
          stock: '350gsm Premium Silk Artboard',
          sides: 'Double Sided (Full Colour 4/4)',
          finish: 'None / Uncoated',
        },
      },
    ];
  });

  // Server & Live Calculated Totals
  const [totals, setTotals] = useState<CalculatedTotals>({
    items: [],
    subtotal_ex_gst: 0,
    shipping_fee_inc_gst: 0.0,
    gst_amount: 0,
    discount_amount: 0.0,
    total_inc_gst: 0,
    currency: 'AUD',
  });

  // Modal State for Adding / Editing Product
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [modalTab, setModalTab] = useState<'custom' | 'catalog'>('custom');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Custom Product Tab State
  const [customName, setCustomName] = useState('');
  const [customPresetSize, setCustomPresetSize] = useState('a4');
  const [customWidth, setCustomWidth] = useState('210');
  const [customHeight, setCustomHeight] = useState('297');
  const [customStock, setCustomStock] = useState('350gsm Premium Silk Artboard');
  const [customSides, setCustomSides] = useState('Double Sided (Full Colour 4/4)');
  const [customFinish, setCustomFinish] = useState('None / Uncoated');
  const [customQty, setCustomQty] = useState<number>(500);
  const [customPrice, setCustomPrice] = useState<number>(120);
  const [customNotes, setCustomNotes] = useState('');

  // Catalog Tab State
  const [modalProductId, setModalProductId] = useState('');
  const [productTemplates, setProductTemplates] = useState<DesignTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [catalogQuantity, setCatalogQuantity] = useState<number>(500);
  const [catalogPrice, setCatalogPrice] = useState<number>(100);
  const [catalogSpecs, setCatalogSpecs] = useState('Standard Specifications');

  // Quotes Management & History State
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [quoteUrl, setQuoteUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Load Customer Directory & Product Catalog
  useEffect(() => {
    async function loadDirectory() {
      try {
        const custRes = await apiClient.get('/admin/customers');
        if (custRes.data?.data) {
          setCustomers(custRes.data.data.data || custRes.data.data || []);
        }
      } catch {
        // Fallback silently
      }

      try {
        const prodRes = await apiClient.get('/products');
        if (prodRes.data?.data) {
          setCatalogProducts(prodRes.data.data.data || prodRes.data.data || []);
        }
      } catch {
        // Fallback silently
      }
    }
    loadDirectory();
  }, []);

  // Load Quote History
  const loadQuotes = useCallback(async () => {
    setLoadingQuotes(true);
    try {
      const url = standalone ? '/admin/quotes' : `/admin/enquiries/${enquiry?.id}/quotes`;
      const response = await apiClient.get(url);
      if (response.data?.success) {
        setQuotes(response.data.data || []);
      }
    } catch {
      // Ignore background load error
    } finally {
      setLoadingQuotes(false);
    }
  }, [enquiry?.id, standalone]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // When catalog product changes in modal, load its templates and default price
  useEffect(() => {
    let cancelled = false;
    setProductTemplates([]);
    setSelectedTemplateId('');
    setTemplateLoadError(null);

    if (!modalProductId) return;

    const prod = catalogProducts.find((p) => p.id === modalProductId);
    if (prod && prod.base_price) {
      setCatalogPrice(parseFloat(prod.base_price) || 100);
    }

    setLoadingTemplates(true);
    apiClient
      .get(`/designer/templates/${modalProductId}`)
      .then((res) => {
        if (cancelled) return;
        const templates = res.data?.data?.data || res.data?.data || [];
        setProductTemplates(Array.isArray(templates) ? templates : []);
      })
      .catch(() => {
        if (!cancelled) setTemplateLoadError('Could not load templates for this product.');
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modalProductId, catalogProducts]);

  // Live Totals Calculation (instant client computation + synced with server)
  useEffect(() => {
    let subtotalEx = 0;
    items.forEach((item) => {
      const q = Math.max(1, Number(item.quantity) || 1);
      const lineEx =
        typeof item.price === 'number'
          ? item.price
          : typeof item.line_total_ex_gst === 'number'
          ? item.line_total_ex_gst
          : typeof item.unit_price_ex_gst === 'number'
          ? item.unit_price_ex_gst * q
          : 0;
      subtotalEx += lineEx;
    });

    let shipFee = 0;
    if (shippingFee !== null && !isNaN(shippingFee)) {
      shipFee = Math.max(0, shippingFee);
    } else {
      const lower = deliveryMethod.toLowerCase();
      if (lower.includes('express')) {
        shipFee = 15.0;
      } else {
        shipFee = 0.0;
      }
    }

    const gst = Math.round((subtotalEx + shipFee) * 0.1 * 100) / 100;
    const totalInc = Math.round((subtotalEx + shipFee + gst) * 100) / 100;

    // Instant responsive state update
    setTotals({
      items: [],
      subtotal_ex_gst: Math.round(subtotalEx * 100) / 100,
      shipping_fee_inc_gst: shipFee,
      gst_amount: gst,
      discount_amount: 0.0,
      total_inc_gst: totalInc,
      currency: 'AUD',
    });

    // Also call server-side calculation for verified consistency if items exist
    if (items.length > 0) {
      manualOrderService
        .calculateTotals({
          items: items.map((it) => ({
            ...it,
            quantity: it.quantity,
            price: it.price,
            unit_price_ex_gst: it.unit_price_ex_gst,
          })),
          delivery_method: deliveryMethod,
          shipping_fee: shippingFee !== null ? shippingFee : undefined,
        })
        .then((res) => {
          if (res.success && res.data) {
            setTotals(res.data);
          }
        })
        .catch(() => {
          // Keep local calculation fallback
        });
    }
  }, [items, deliveryMethod, shippingFee]);

  // Handle selecting an existing customer
  const handleSelectCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setSelectedCustomerId(null);
      return;
    }
    const customer = customers.find((c) => String(c.id) === val);
    if (customer) {
      setSelectedCustomerId(customer.id);
      setCustomerName(customer.name);
      setCustomerEmail(customer.email);
      if (customer.phone) setCustomerPhone(customer.phone);
      if (customer.company_name) setCompanyName(customer.company_name);
    }
  };

  // Open modal for adding a new product
  const handleOpenAddProduct = () => {
    setEditingItemIndex(null);
    setModalTab('custom');
    setCustomName('');
    setCustomPresetSize('a4');
    setCustomWidth('210');
    setCustomHeight('297');
    setCustomStock('350gsm Premium Silk Artboard');
    setCustomSides('Double Sided (Full Colour 4/4)');
    setCustomFinish('None / Uncoated');
    setCustomQty(500);
    setCustomPrice(120);
    setCustomNotes('');
    setModalProductId('');
    setProductTemplates([]);
    setSelectedTemplateId('');
    setCatalogQuantity(500);
    setCatalogPrice(100);
    setCatalogSpecs('Standard Specifications');
    setShowAddProductModal(true);
  };

  // Open modal for editing an existing product configuration
  const handleOpenEditProduct = (index: number) => {
    const item = items[index];
    if (!item) return;

    setEditingItemIndex(index);

    if (item.product_id) {
      setModalTab('catalog');
      setModalProductId(item.product_id);
      setSelectedTemplateId(item.options?.template_id || '');
      setCatalogQuantity(item.quantity || 500);
      setCatalogPrice(
        item.price ?? (item.unit_price_ex_gst ? item.unit_price_ex_gst * item.quantity : 100)
      );
      setCatalogSpecs(item.specifications || item.options?.specifications || 'Standard Specifications');
    } else {
      setModalTab('custom');
      setCustomName(item.product_name || '');
      setCustomQty(item.quantity || 500);
      setCustomPrice(item.price ?? 120);

      let w = item.options?.width_mm ? String(item.options.width_mm) : '';
      let h = item.options?.height_mm ? String(item.options.height_mm) : '';
      if ((!w || !h) && item.options?.dimensions) {
        const m = String(item.options.dimensions).match(/(\d+)\s*[×x*]\s*(\d+)/i);
        if (m) {
          w = m[1];
          h = m[2];
        }
      }
      if (!w || !h) {
        w = '210';
        h = '297';
      }
      setCustomWidth(w);
      setCustomHeight(h);

      const matchedPreset = Object.entries(SIZE_PRESETS).find(
        ([k, v]) => k !== 'custom' && v.width === w && v.height === h
      );
      setCustomPresetSize(matchedPreset ? matchedPreset[0] : 'custom');

      const stock = item.options?.stock || '350gsm Premium Silk Artboard';
      setCustomStock(stock);

      const sides = item.options?.sides || 'Double Sided (Full Colour 4/4)';
      setCustomSides(sides);

      const finish = item.options?.finish || 'None / Uncoated';
      setCustomFinish(finish);

      setCustomNotes(item.options?.notes || '');
    }

    setShowAddProductModal(true);
  };

  // Preset size change handler
  const handlePresetSizeChange = (presetKey: string) => {
    setCustomPresetSize(presetKey);
    const preset = SIZE_PRESETS[presetKey];
    if (preset && presetKey !== 'custom') {
      setCustomWidth(preset.width);
      setCustomHeight(preset.height);
    }
  };

  // Add Item to table
  const handleAddItem = (newProd: QuoteItemPayload) => {
    setItems((prev) => [...prev, { ...newProd, client_key: newProd.client_key || createQuoteLineKey() }]);
    setShowAddProductModal(false);
    setEditingItemIndex(null);
  };

  // Save changes to the existing product being edited
  const handleSaveEditedProduct = () => {
    if (editingItemIndex === null || !items[editingItemIndex]) return;

    const prevItem = items[editingItemIndex];

    if (modalTab === 'custom') {
      if (!customName.trim()) {
        alert('Please enter a product name for the custom item.');
        return;
      }

      const qty = Math.max(1, parseInt(String(customQty)) || 500);
      const price = Math.max(0, parseFloat(String(customPrice)) || 0);
      const activeStock = customStock.trim() || 'Custom Stock';

      const dimStr = customWidth && customHeight ? `${customWidth} × ${customHeight} mm` : '';
      const specParts = [
        dimStr,
        activeStock,
        customSides,
        customFinish !== 'None / Uncoated' ? customFinish : '',
      ].filter(Boolean);

      const formattedSpecs = specParts.join(' • ');

      const updatedItem: QuoteItemPayload = {
        ...prevItem,
        product_id: undefined,
        product_name: customName.trim(),
        specifications: formattedSpecs || 'Custom Specifications',
        quantity: qty,
        price: price,
        unit_price_ex_gst: qty > 0 ? price / qty : price,
        options: {
          ...(prevItem.options || {}),
          product_name: customName.trim(),
          dimensions: dimStr,
          width_mm: customWidth,
          height_mm: customHeight,
          stock: activeStock,
          sides: customSides,
          finish: customFinish,
          notes: customNotes.trim(),
          specifications: formattedSpecs || 'Custom Specifications',
        },
      };

      setItems((prev) => {
        const next = [...prev];
        next[editingItemIndex] = updatedItem;
        return next;
      });
    } else {
      const product = catalogProducts.find((entry) => entry.id === modalProductId);
      const template = productTemplates.find((entry) => entry.id === selectedTemplateId);
      const qty = Math.max(1, parseInt(String(catalogQuantity)) || 500);
      const price =
        Math.max(0, parseFloat(String(catalogPrice))) ||
        (parseFloat(product?.base_price || '100') || 100);
      const specs = catalogSpecs.trim() || 'Standard Specifications';
      const prodName = product ? product.name : prevItem.product_name;

      const updatedItem: QuoteItemPayload = {
        ...prevItem,
        product_id: product ? product.id : prevItem.product_id,
        product_name: prodName,
        specifications: specs,
        quantity: qty,
        price: price,
        unit_price_ex_gst: qty > 0 ? price / qty : price,
        options: {
          ...(prevItem.options || {}),
          product_name: prodName,
          specifications: specs,
          ...(template
            ? {
                template_id: template.id,
                template_name: template.name,
                template_thumbnail_url: template.thumbnail_url || null,
                dimensions:
                  template.width_mm && template.height_mm
                    ? `${template.width_mm} × ${template.height_mm} mm`
                    : undefined,
              }
            : {}),
        },
      };

      setItems((prev) => {
        const next = [...prev];
        next[editingItemIndex] = updatedItem;
        return next;
      });
    }

    setShowAddProductModal(false);
    setEditingItemIndex(null);
  };

  // Add Custom Product & Full Configuration
  const handleAddCustomProduct = () => {
    if (!customName.trim()) {
      alert('Please enter a product name for the custom item.');
      return;
    }

    const qty = Math.max(1, parseInt(String(customQty)) || 500);
    const price = Math.max(0, parseFloat(String(customPrice)) || 0);
    const activeStock = customStock.trim() || 'Custom Stock';

    const dimStr = customWidth && customHeight ? `${customWidth} × ${customHeight} mm` : '';
    const specParts = [
      dimStr,
      activeStock,
      customSides,
      customFinish !== 'None / Uncoated' ? customFinish : '',
    ].filter(Boolean);

    const formattedSpecs = specParts.join(' • ');

    const newItem: QuoteItemPayload = {
      product_name: customName.trim(),
      specifications: formattedSpecs || 'Custom Specifications',
      quantity: qty,
      price: price,
      unit_price_ex_gst: qty > 0 ? price / qty : price,
      options: {
        product_name: customName.trim(),
        dimensions: dimStr,
        width_mm: customWidth,
        height_mm: customHeight,
        stock: activeStock,
        sides: customSides,
        finish: customFinish,
        notes: customNotes.trim(),
        specifications: formattedSpecs || 'Custom Specifications',
      },
    };

    handleAddItem(newItem);
  };

  // Add Catalog Product
  const handleAddCatalogProduct = () => {
    const product = catalogProducts.find((entry) => entry.id === modalProductId);
    if (!product) return;

    const template = productTemplates.find((entry) => entry.id === selectedTemplateId);
    const qty = Math.max(1, parseInt(String(catalogQuantity)) || 500);
    const price =
      Math.max(0, parseFloat(String(catalogPrice))) ||
      (parseFloat(product.base_price) || 100);
    const specs = catalogSpecs.trim() || 'Standard Specifications';

    handleAddItem({
      product_id: product.id,
      product_name: product.name,
      specifications: specs,
      quantity: qty,
      price: price,
      unit_price_ex_gst: qty > 0 ? price / qty : price,
      options: {
        product_name: product.name,
        specifications: specs,
        ...(template
          ? {
              template_id: template.id,
              template_name: template.name,
              template_thumbnail_url: template.thumbnail_url || null,
              dimensions:
                template.width_mm && template.height_mm
                  ? `${template.width_mm} × ${template.height_mm} mm`
                  : undefined,
            }
          : {}),
      },
    });

    setModalProductId('');
    setProductTemplates([]);
    setSelectedTemplateId('');
    setCatalogQuantity(500);
    setCatalogPrice(100);
    setCatalogSpecs('Standard Specifications');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit and send quote
  const handleSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setQuoteUrl('');
    setCopied(false);

    if (!customerEmail.trim()) {
      setError('Recipient customer email is required.');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one product item to the quote.');
      return;
    }

    setSending(true);
    try {
      const url = standalone ? '/admin/quotes' : `/admin/enquiries/${enquiry?.id}/quotes`;
      const payload = {
        recipient_name: customerName.trim(),
        recipient_email: customerEmail.trim().toLowerCase(),
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim().toLowerCase(),
        customer_phone: customerPhone.trim(),
        company_name: companyName.trim(),
        customer_id: selectedCustomerId,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress.trim(),
        shipping_fee: shippingFee !== null ? shippingFee : undefined,
        terms: customerNotes.trim(),
        customer_notes: customerNotes.trim(),
        internal_notes: internalNotes.trim(),
        valid_for_days: validDays,
        items: items.map((it) => {
          const qty = Math.max(1, it.quantity);
          const price = typeof it.price === 'number' ? it.price : 0;
          const unitPrice =
            typeof it.unit_price_ex_gst === 'number' && it.unit_price_ex_gst > 0
              ? it.unit_price_ex_gst
              : qty > 0
              ? price / qty
              : price;

          return {
            product_id: it.product_id || undefined,
            product_name: it.product_name,
            quantity: qty,
            unit_price_ex_gst: unitPrice,
            price: price,
            line_total_ex_gst: price,
            specifications: it.specifications || '',
            options: it.options || {},
          };
        }),
      };

      const response = await apiClient.post(url, payload);
      const data = response.data?.data;
      setSuccessMsg(response.data?.message || 'Quote created and sent successfully.');
      if (data?.quote_url) {
        setQuoteUrl(data.quote_url);
      }
      await loadQuotes();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Unable to send this quote. Please check the details and try again.'
      );
    } finally {
      setSending(false);
    }
  };

  // Resend existing quote email
  const handleResendQuote = async (quoteId: number) => {
    setResendingId(quoteId);
    setError(null);
    setSuccessMsg(null);
    setQuoteUrl('');
    try {
      const response = await apiClient.post(`/admin/quotes/${quoteId}/resend`);
      setSuccessMsg(response.data?.message || 'Quote email resent successfully.');
      if (response.data?.data?.quote_url) {
        setQuoteUrl(response.data.data.quote_url);
      }
      await loadQuotes();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not resend quote email.');
    } finally {
      setResendingId(null);
    }
  };

  const copyQuoteUrl = () => {
    if (!quoteUrl) return;
    navigator.clipboard.writeText(quoteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Feedback Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          {quoteUrl && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-xs text-slate-300">Quote link:</span>
              <a
                href={quoteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 hover:text-sky-300 underline font-mono break-all inline-flex items-center gap-1"
              >
                <span>{quoteUrl}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={copyQuoteUrl}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs border border-slate-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy link'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Form Layout */}
      <form onSubmit={handleSendQuote} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Customer Details, Products Table, Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Customer Details Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-slate-200">Customer details</h2>
              <span className="text-[11px] text-slate-500">Contact & delivery information</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Customer Selector */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Select existing customer</label>
                <div className="relative">
                  <select
                    value={selectedCustomerId || ''}
                    onChange={handleSelectCustomer}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs appearance-none focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="">Select customer or enter details manually...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company_name ? `(${c.company_name})` : ''} - {c.email}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Customer Email */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">
                  Customer email <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Customer name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contact Name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Customer phone</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 0412 345 678"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Company name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Business / Studio"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Delivery Method */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Delivery method</label>
                <div className="relative">
                  <select
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs appearance-none focus:outline-none focus:border-sky-500"
                  >
                    <option value="Standard delivery (Free)">Standard delivery (Free)</option>
                    <option value="Express delivery">Express delivery (+$15.00)</option>
                    <option value="Store pickup (Free)">Store pickup (Free)</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Delivery Address */}
              <div className="md:col-span-2">
                <label className="block text-slate-400 mb-1.5 font-medium">Delivery address</label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="123 Printing Lane, Richmond VIC 3121"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* 2. Products Table Section (Artwork fields omitted) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Products & quote items</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Configure custom print specifications, materials, and quantities for this quote.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddProduct}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add product</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="pb-2.5 font-medium">Product</th>
                    <th className="pb-2.5 font-medium">Specifications & Options</th>
                    <th className="pb-2.5 font-medium">Qty</th>
                    <th className="pb-2.5 font-medium">Price (ex. GST)</th>
                    <th className="pb-2.5 font-medium">Total</th>
                    <th className="pb-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        No products added yet. Click &quot;Add product&quot; above to configure items.
                      </td>
                    </tr>
                  )}
                  {items.map((item, idx) => {
                    const lineKey = item.client_key || `quote-line-${idx}`;
                    const linePrice =
                      typeof item.price === 'number'
                        ? item.price
                        : typeof item.unit_price_ex_gst === 'number'
                        ? item.unit_price_ex_gst * item.quantity
                        : 0;

                    return (
                      <tr key={lineKey} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 font-medium text-slate-200">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs flex-shrink-0">
                              <Layers className="w-4 h-4 text-sky-400" />
                            </div>
                            <div>
                              <div className="font-semibold text-white">{item.product_name}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] ${
                                    item.product_id
                                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                      : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                                  }`}
                                >
                                  {item.product_id ? 'Catalog' : 'Custom'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-slate-300 max-w-sm">
                          <div className="text-xs leading-relaxed font-medium">
                            {item.specifications || 'Standard Specifications'}
                          </div>
                          {item.options?.notes && (
                            <div className="mt-1 text-[11px] text-sky-400/90 italic">
                              Notes: {item.options.notes}
                            </div>
                          )}
                          {item.options?.template_name && (
                            <div className="mt-1 text-[10px] text-sky-400 font-medium">
                              Template: {item.options.template_name}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-slate-200 font-mono">{item.quantity}</td>
                        <td className="py-3 text-slate-200 font-mono">
                          ${linePrice > 0 ? (linePrice / item.quantity).toFixed(3) : '0.000'}
                          <span className="text-[10px] text-slate-500 ml-1">/ea</span>
                        </td>
                        <td className="py-3 text-white font-semibold font-mono">
                          ${linePrice.toFixed(2)}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditProduct(idx)}
                              className="p-1.5 rounded hover:bg-sky-500/10 text-slate-400 hover:text-sky-400 transition-colors"
                              title="Edit product configuration & specifications"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Notes & Quote Terms Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Customer notes & terms <span className="text-slate-500 font-normal">(visible on quote)</span>
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Instructions, payment terms, or notes for customer review..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  Internal notes <span className="text-slate-500 font-normal">(private to staff)</span>
                </label>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Valid:</span>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={validDays}
                    onChange={(e) => setValidDays(Number(e.target.value) || 14)}
                    className="w-12 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-100 text-center font-mono focus:outline-none focus:border-sky-500"
                  />
                  <span>days</span>
                </div>
              </div>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Staff prepress, supplier margin, or delivery notes..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Right 1 Column: Totals Summary & Actions */}
        <div className="space-y-6">
          {/* Live Quote Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Quote summary</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Live Pricing
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal (ex. GST)</span>
                <span className="text-slate-200 font-mono">
                  ${totals.subtotal_ex_gst.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Delivery fee</span>
                <span className="text-slate-200 font-mono">
                  ${totals.shipping_fee_inc_gst.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST (10%)</span>
                <span className="text-slate-200 font-mono">
                  ${totals.gst_amount.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-sm font-bold text-white">
                <span>Total (AUD)</span>
                <span className="text-base font-mono text-emerald-400">
                  ${totals.total_inc_gst.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={sending || items.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-600/20 disabled:opacity-50 transition"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Send quote to {customerEmail ? customerEmail : 'customer'}</span>
              </button>
            </div>
          </div>

          {/* Recent Quotes / Quote History Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {standalone ? 'Recent Quotes' : 'Quote History'}
              </h3>
              <button
                type="button"
                onClick={loadQuotes}
                disabled={loadingQuotes}
                className="p-1 rounded text-slate-400 hover:text-white transition"
                title="Refresh quotes"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingQuotes ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs max-h-96 overflow-y-auto">
              {loadingQuotes ? (
                <p className="text-xs text-slate-500 py-3 text-center">Loading quote history…</p>
              ) : quotes.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No quotes sent yet.</p>
              ) : (
                quotes.map((q) => {
                  let statusBadge = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (q.status === 'sent') statusBadge = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                  if (q.status === 'accepted') statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  if (q.status === 'declined') statusBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  if (q.status === 'expired') statusBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                  return (
                    <div
                      key={q.id}
                      className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-200">{q.quote_number}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${statusBadge}`}>
                          {q.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        To: {q.recipient_email}
                        {q.recipient_name && ` (${q.recipient_name})`}
                      </div>
                      {standalone && q.enquiry_name && (
                        <div className="text-[10px] text-slate-500">
                          Enquiry: {q.enquiry_name}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-700/40">
                        <span className="font-mono font-bold text-emerald-400 text-xs">
                          {q.currency} {Number(q.total_inc_gst).toFixed(2)}
                        </span>
                        {q.status === 'sent' && (
                          <button
                            type="button"
                            disabled={resendingId === q.id}
                            onClick={() => handleResendQuote(q.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-50"
                          >
                            {resendingId === q.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            <span>{resendingId === q.id ? 'Sending…' : 'Resend'}</span>
                          </button>
                        )}
                        {q.order_id && (
                          <span className="text-[10px] font-semibold text-emerald-400">
                            Order converted
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Add / Edit Product Configuration Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-sky-400" />
                  {editingItemIndex !== null
                    ? 'Edit product & configure specifications'
                    : 'Add product & configure specifications'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingItemIndex !== null
                    ? `Modifying item #${editingItemIndex + 1}: ${items[editingItemIndex]?.product_name || ''}`
                    : 'Choose from catalog or configure a fully customized print product.'}
                </p>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalTab('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    modalTab === 'custom'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Custom Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('catalog')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    modalTab === 'catalog'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>From Catalog</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* TAB 1: CUSTOM PRODUCT CONFIGURATION */}
              {modalTab === 'custom' && (
                <div className="space-y-4">
                  {/* Product Name */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Product Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Custom A3 Promo Posters, Folded Menus, Business Cards"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500 placeholder-slate-500"
                    />
                  </div>

                  {/* Dimensions & Size Preset */}
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-semibold">Dimensions & Size</label>
                      <span className="text-[11px] text-slate-500">Preset or manual mm</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 text-[11px]">Size Preset</label>
                        <select
                          value={customPresetSize}
                          onChange={(e) => handlePresetSizeChange(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                        >
                          {Object.entries(SIZE_PRESETS).map(([key, val]) => (
                            <option key={key} value={key}>
                              {val.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 text-[11px]">Width (mm)</label>
                        <input
                          type="number"
                          value={customWidth}
                          onChange={(e) => {
                            setCustomWidth(e.target.value);
                            setCustomPresetSize('custom');
                          }}
                          placeholder="e.g. 210"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 text-[11px]">Height (mm)</label>
                        <input
                          type="number"
                          value={customHeight}
                          onChange={(e) => {
                            setCustomHeight(e.target.value);
                            setCustomPresetSize('custom');
                          }}
                          placeholder="e.g. 297"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stock, Printing Sides, Finish */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Paper Stock / Material</label>
                      <input
                        type="text"
                        list="stock-options-list"
                        value={customStock}
                        onChange={(e) => setCustomStock(e.target.value)}
                        placeholder="e.g. 350gsm Premium Silk Artboard"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                      />
                      <datalist id="stock-options-list">
                        {STOCK_OPTIONS.filter((st) => st !== 'Custom Material...').map((st) => (
                          <option key={st} value={st} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Print Sides / Colour</label>
                      <input
                        type="text"
                        list="sides-options-list"
                        value={customSides}
                        onChange={(e) => setCustomSides(e.target.value)}
                        placeholder="e.g. Double Sided (Full Colour 4/4)"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                      />
                      <datalist id="sides-options-list">
                        {SIDES_OPTIONS.map((side) => (
                          <option key={side} value={side} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Finish / Coating</label>
                      <input
                        type="text"
                        list="finish-options-list"
                        value={customFinish}
                        onChange={(e) => setCustomFinish(e.target.value)}
                        placeholder="e.g. None / Uncoated, Matte Lamination"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                      />
                      <datalist id="finish-options-list">
                        {FINISH_OPTIONS.map((fn) => (
                          <option key={fn} value={fn} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Quantity & Price */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={customQty}
                        onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
                      />
                      <div className="flex gap-1.5 mt-2">
                        {[100, 250, 500, 1000, 2500].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setCustomQty(q)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                              customQty === q
                                ? 'bg-sky-600 text-white border-sky-500'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-slate-400 font-medium">Total Price ($AUD ex. GST)</label>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {customQty > 0 ? `$${(customPrice / customQty).toFixed(3)}/ea` : ''}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-2">
                        Total ex. GST. GST (10%) calculated automatically.
                      </p>
                    </div>
                  </div>

                  {/* Custom Notes / Finishing Instructions */}
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">
                      Special Requirements / Finishing Notes <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="e.g. 6mm round corners, score and fold in half, hole punch on left"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500 placeholder-slate-500"
                    />
                  </div>

                  {/* Live Spec Preview */}
                  <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Configuration Preview:</span>
                      </div>
                      <p className="text-slate-300 mt-1 font-medium">
                        {customName || 'Custom Print'} —{' '}
                        {customWidth && customHeight ? `${customWidth}×${customHeight}mm • ` : ''}
                        {customStock} • {customSides}
                        {customFinish && customFinish !== 'None / Uncoated' ? ` • ${customFinish}` : ''}
                      </p>
                    </div>

                    <div className="text-right pl-3 flex-shrink-0">
                      <div className="text-slate-400 text-[10px]">Qty: {customQty}</div>
                      <div className="text-sky-400 font-bold font-mono text-sm">
                        ${customPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CATALOG PRODUCT */}
              {modalTab === 'catalog' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">
                      Catalog Product <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={modalProductId}
                      onChange={(e) => setModalProductId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Select a catalog product...</option>
                      {catalogProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Base price: ${p.base_price})
                        </option>
                      ))}
                    </select>
                  </div>

                  {modalProductId && (
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">
                          Design template <span className="text-slate-500 font-normal">(Optional)</span>
                        </label>
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                          disabled={loadingTemplates}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs disabled:opacity-60 focus:outline-none focus:border-sky-500"
                        >
                          <option value="">
                            {loadingTemplates ? 'Loading templates…' : 'Standard specifications (No template)'}
                          </option>
                          {productTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                              {template.width_mm && template.height_mm
                                ? ` (${template.width_mm} × ${template.height_mm} mm)`
                                : ''}
                            </option>
                          ))}
                        </select>
                        {templateLoadError && (
                          <p className="mt-1.5 text-[11px] text-slate-400">{templateLoadError}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">Specifications / Description</label>
                        <input
                          type="text"
                          value={catalogSpecs}
                          onChange={(e) => setCatalogSpecs(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={catalogQuantity}
                            onChange={(e) => setCatalogQuantity(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Price ($AUD ex. GST)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={catalogPrice}
                            onChange={(e) => setCatalogPrice(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/60">
              <button
                type="button"
                onClick={() => {
                  setShowAddProductModal(false);
                  setEditingItemIndex(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs transition"
              >
                Cancel
              </button>

              {editingItemIndex !== null ? (
                <button
                  type="button"
                  onClick={handleSaveEditedProduct}
                  disabled={
                    modalTab === 'custom'
                      ? !customName.trim()
                      : !modalProductId || loadingTemplates
                  }
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Product Changes</span>
                </button>
              ) : modalTab === 'custom' ? (
                <button
                  type="button"
                  onClick={handleAddCustomProduct}
                  disabled={!customName.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Product to Quote</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddCatalogProduct}
                  disabled={!modalProductId || loadingTemplates}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Catalog Product to Quote</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
