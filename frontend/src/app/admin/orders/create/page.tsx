'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/services/api/client';
import {
  manualOrderService,
  ManualOrderItemPayload,
  CalculatedTotals,
} from '@/services/admin/manualOrderService';
import {
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
  Send,
  Save,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Layers,
  FileCheck,
  Sliders,
  Sparkles,
  RotateCcw,
  Package,
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

const createOrderLineKey = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export interface ProductArtworkEntry {
  id: string;
  file: File;
  name: string;
  size: string;
  previewUrl: string | null;
  side: 'Front' | 'Back';
}

function inferArtworkSide(filename: string, existing: ProductArtworkEntry[] = []): 'Front' | 'Back' {
  const lower = filename.toLowerCase();
  if (/(^|[._\-\s])back([._\-\s]|$)/i.test(lower) || lower.includes('back')) {
    return 'Back';
  }
  if (/(^|[._\-\s])front([._\-\s]|$)/i.test(lower) || lower.includes('front')) {
    return 'Front';
  }
  const hasFront = existing.some((e) => e.side === 'Front');
  const hasBack = existing.some((e) => e.side === 'Back');
  if (hasFront && !hasBack) {
    return 'Back';
  }
  return 'Front';
}

export default function CreateManualOrderPage() {
  const router = useRouter();

  // Existing order state (if loaded or saved)
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Standard delivery (Free)');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Notes
  const [internalNotes, setInternalNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState(
    'Please check all details carefully. Let us know if you\'d like any changes.'
  );

  // Products List
  const [items, setItems] = useState<ManualOrderItemPayload[]>([]);

  const [itemArtworkEntries, setItemArtworkEntries] = useState<Record<string, ProductArtworkEntry[]>>({});
  const [uploadedItemArtwork, setUploadedItemArtwork] = useState<Record<string, boolean>>({});

  // Server Calculated Totals
  const [totals, setTotals] = useState<CalculatedTotals>({
    items: [],
    subtotal_ex_gst: 0,
    shipping_fee_inc_gst: 0.0,
    gst_amount: 0,
    discount_amount: 0.0,
    total_inc_gst: 0,
    currency: 'AUD',
  });

  // Autocomplete data
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogOption[]>([]);

  // Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [modalTab, setModalTab] = useState<'catalog' | 'custom'>('custom');

  // Catalog Tab State
  const [modalProductId, setModalProductId] = useState('');
  const [productTemplates, setProductTemplates] = useState<DesignTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [catalogQuantity, setCatalogQuantity] = useState<number>(500);
  const [catalogPrice, setCatalogPrice] = useState<number>(100);
  const [catalogSpecs, setCatalogSpecs] = useState('Standard Specifications');

  // Custom Product Tab State
  const [customName, setCustomName] = useState('');
  const [customPresetSize, setCustomPresetSize] = useState('a4');
  const [customWidth, setCustomWidth] = useState('210');
  const [customHeight, setCustomHeight] = useState('297');
  const [customStock, setCustomStock] = useState('350gsm Premium Silk Artboard');
  const [customCustomStock, setCustomCustomStock] = useState('');
  const [customSides, setCustomSides] = useState('Double Sided (Full Colour 4/4)');
  const [customFinish, setCustomFinish] = useState('None / Uncoated');
  const [customQty, setCustomQty] = useState<number>(500);
  const [customPrice, setCustomPrice] = useState<number>(120);
  const [customNotes, setCustomNotes] = useState('');

  // Status & notifications
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      Object.values(itemArtworkEntries).flat().forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
    };
  }, []);

  // Load customer directory & product catalog & check query params
  useEffect(() => {
    async function loadDirectory() {
      try {
        const custRes = await apiClient.get('/admin/customers');
        if (custRes.data?.data) {
          setCustomers(custRes.data.data.data || custRes.data.data || []);
        }
      } catch (e) {
        // Fallback
      }

      try {
        const prodRes = await apiClient.get('/products');
        if (prodRes.data?.data) {
          setCatalogProducts(prodRes.data.data.data || prodRes.data.data || []);
        }
      } catch (e) {
        // Fallback
      }
    }
    loadDirectory();

    // Check if editing an existing order via query params
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const orderIdParam = searchParams.get('orderId') || searchParams.get('id');
      if (orderIdParam) {
        loadExistingOrder(orderIdParam);
      }
    }
  }, []);

  const loadExistingOrder = async (orderId: string) => {
    try {
      const res = await manualOrderService.getOrder(orderId);
      if (res.success && res.data) {
        const ord = res.data;
        setCurrentOrderId(ord.id);
        setOrderNumber(ord.order_number);
        setSelectedCustomerId(ord.customer?.id || null);
        setCustomerName(ord.customer?.name || '');
        setCustomerEmail(ord.customer?.email || '');
        setCustomerPhone(ord.customer?.phone || '');
        setCompanyName(ord.customer?.company_name || '');
        setDeliveryMethod(ord.delivery_method || 'Standard delivery (Free)');
        setDeliveryAddress(ord.shipping_address?.address_line_1 || '');
        setInternalNotes(ord.internal_notes || (ord as any).admin_notes || '');
        if (ord.customer_notes) setCustomerNotes(ord.customer_notes);

        if (Array.isArray(ord.items)) {
          setItems(
            ord.items.map((it: any) => ({
              id: it.id,
              client_key: it.id,
              artwork_id: it.artwork_id || null,
              product_id: it.product_id,
              product_name: it.product_name,
              specifications: it.options?.specifications || it.product_name,
              quantity: it.quantity,
              price: it.line_total_ex_gst ?? (it.unit_price_ex_gst * it.quantity),
              unit_price_ex_gst: it.unit_price_ex_gst,
              options: it.options || {},
            }))
          );
        }

      }
    } catch (e) {
      console.error('Failed to load existing order:', e);
    }
  };

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
    apiClient.get(`/designer/templates/${modalProductId}`)
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

    return () => { cancelled = true; };
  }, [modalProductId, catalogProducts]);

  // Recalculate totals on server whenever items or delivery method change
  useEffect(() => {
    async function fetchServerCalculations() {
      if (items.length === 0) {
        setTotals({
          items: [],
          subtotal_ex_gst: 0,
          shipping_fee_inc_gst: 0.0,
          gst_amount: 0,
          discount_amount: 0.0,
          total_inc_gst: 0,
          currency: 'AUD',
        });
        return;
      }
      try {
        const res = await manualOrderService.calculateTotals({
          items,
          delivery_method: deliveryMethod,
        });
        if (res.success && res.data) {
          setTotals(res.data);
        }
      } catch (e) {
        // Keep current totals
      }
    }
    fetchServerCalculations();
  }, [items, deliveryMethod]);

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

  // Add Item to table
  const handleAddItem = (newProd: ManualOrderItemPayload) => {
    setItems((prev) => [...prev, { ...newProd, client_key: newProd.client_key || createOrderLineKey() }]);
    setShowAddProductModal(false);
  };

  // Add Catalog Product
  const handleAddCatalogProduct = () => {
    const product = catalogProducts.find((entry) => entry.id === modalProductId);
    if (!product) return;

    const template = productTemplates.find((entry) => entry.id === selectedTemplateId);
    const qty = Math.max(1, parseInt(String(catalogQuantity)) || 500);
    const price = Math.max(0, parseFloat(String(catalogPrice)) || (parseFloat(product.base_price) || 100));
    const specs = catalogSpecs.trim() || 'Standard Specifications';

    handleAddItem({
      product_id: product.id,
      product_name: product.name,
      specifications: specs,
      quantity: qty,
      price: price,
      options: {
        product_name: product.name,
        specifications: specs,
        ...(template ? {
          template_id: template.id,
          template_name: template.name,
          template_thumbnail_url: template.thumbnail_url || null,
          dimensions: template.width_mm && template.height_mm ? `${template.width_mm} × ${template.height_mm} mm` : undefined,
        } : {}),
      },
    });

    setModalProductId('');
    setProductTemplates([]);
    setSelectedTemplateId('');
    setCatalogQuantity(500);
    setCatalogPrice(100);
    setCatalogSpecs('Standard Specifications');
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

  // Add Custom Product & Full Configuration
  const handleAddCustomProduct = () => {
    if (!customName.trim()) {
      alert('Please enter a product name for the custom item.');
      return;
    }

    const qty = Math.max(1, parseInt(String(customQty)) || 500);
    const price = Math.max(0, parseFloat(String(customPrice)) || 0);

    const activeStock = customStock === 'Custom Material...'
      ? (customCustomStock.trim() || 'Custom Stock')
      : customStock;

    const dimStr = customWidth && customHeight ? `${customWidth} × ${customHeight} mm` : '';
    const specParts = [
      dimStr,
      activeStock,
      customSides,
      customFinish !== 'None / Uncoated' ? customFinish : '',
    ].filter(Boolean);

    const formattedSpecs = specParts.join(' • ');

    const newItem: ManualOrderItemPayload = {
      product_name: customName.trim(),
      specifications: formattedSpecs || 'Custom Specifications',
      quantity: qty,
      price: price,
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

    // Reset custom form state
    setCustomName('');
    setCustomPresetSize('a4');
    setCustomWidth('210');
    setCustomHeight('297');
    setCustomStock('350gsm Premium Silk Artboard');
    setCustomCustomStock('');
    setCustomSides('Double Sided (Full Colour 4/4)');
    setCustomFinish('None / Uncoated');
    setCustomQty(500);
    setCustomPrice(120);
    setCustomNotes('');
  };

  // Remove / Delete single item
  const handleRemoveItem = async (index: number) => {
    if (items.length <= 1) {
      alert('An order must contain at least one product.');
      return;
    }

    const itemToRemove = items[index];
    const lineKey = itemToRemove?.client_key || itemToRemove?.id;

    // If order is saved in DB and item has a DB ID, delete directly from database
    if (currentOrderId && itemToRemove?.id) {
      if (!confirm(`Delete "${itemToRemove.product_name}" directly from the database?`)) {
        return;
      }
      try {
        const res = await manualOrderService.deleteOrderItem(currentOrderId, itemToRemove.id);
        if (res.success) {
          setItems((prev) => prev.filter((_, i) => i !== index));
          if (lineKey) {
            setItemArtworkEntries((prev) => {
              const next = { ...prev };
              (next[lineKey] || []).forEach((e) => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl); });
              delete next[lineKey];
              return next;
            });
          }
          setSuccessMsg('Product deleted directly from database.');
          return;
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to delete product from database.');
        return;
      }
    }

    // Otherwise remove from local list
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (lineKey) {
      setItemArtworkEntries((prev) => {
        const next = { ...prev };
        (next[lineKey] || []).forEach((e) => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl); });
        delete next[lineKey];
        return next;
      });
    }
  };

  // Direct database deletion of order
  const handleDeleteOrderFromDb = async () => {
    if (!currentOrderId) {
      if (confirm('Discard all unsaved changes and reset this draft?')) {
        resetForm();
      }
      return;
    }

    const confirmMsg = orderNumber
      ? `Are you sure you want to permanently delete order ${orderNumber} directly from the database? This cannot be undone.`
      : 'Are you sure you want to permanently delete this order directly from the database? This cannot be undone.';

    if (!confirm(confirmMsg)) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await manualOrderService.deleteOrder(currentOrderId);
      if (res.success) {
        alert(res.message || 'Order deleted successfully from database.');
        router.push('/admin/orders');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete order from database.');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setCurrentOrderId(null);
    setOrderNumber(null);
    setSelectedCustomerId(null);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCompanyName('');
    setDeliveryAddress('');
    setInternalNotes('');
    setItems([]);
    setItemArtworkEntries((prev) => {
      Object.values(prev).flat().forEach((e) => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl); });
      return {};
    });
    setUploadedItemArtwork({});
  };

  const handleItemArtworkSelect = (lineKey: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files);
    for (const file of selectedFiles) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'svg', 'pdf', 'webp'].includes(extension || '')) {
        setError(`Artwork ${file.name} has an unsupported format. Use JPG, PNG, SVG, WEBP, or PDF.`);
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError(`Artwork ${file.name} exceeds the 50MB limit.`);
        return;
      }
    }
    setError(null);

    setItemArtworkEntries((prev) => {
      const existing = prev[lineKey] || [];
      const knownKeys = new Set(existing.map((e) => `${e.file.name}:${e.file.size}:${e.file.lastModified}`));
      const newEntries: ProductArtworkEntry[] = [];
      const runningList = [...existing];

      for (const file of selectedFiles) {
        const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
        if (knownKeys.has(fileKey)) continue;

        const side = inferArtworkSide(file.name, runningList);
        const previewUrl = file.type.startsWith('image/') || /\.(png|jpe?g|svg|webp)$/i.test(file.name)
          ? URL.createObjectURL(file)
          : null;

        const entry: ProductArtworkEntry = {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          previewUrl,
          side,
        };

        newEntries.push(entry);
        runningList.push(entry);
        knownKeys.add(fileKey);
      }

      return { ...prev, [lineKey]: [...existing, ...newEntries] };
    });
  };

  const handleToggleArtworkSide = (lineKey: string, entryId: string, side: 'Front' | 'Back') => {
    setItemArtworkEntries((prev) => {
      const existing = prev[lineKey] || [];
      return {
        ...prev,
        [lineKey]: existing.map((item) => (item.id === entryId ? { ...item, side } : item)),
      };
    });
  };

  const handleRemoveArtworkFile = (lineKey: string, entryId: string) => {
    setItemArtworkEntries((prev) => {
      const existing = prev[lineKey] || [];
      const target = existing.find((item) => item.id === entryId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return {
        ...prev,
        [lineKey]: existing.filter((item) => item.id !== entryId),
      };
    });
  };

  const uploadArtworkFilesForItems = async (orderId: string, savedItems?: any[]) => {
    const linesWithFiles = items
      .map((item, index) => ({ item, index, entries: itemArtworkEntries[item.client_key || item.id || ''] || [] }))
      .filter((entry) => entry.entries.length > 0);
    if (linesWithFiles.length === 0) return;

    let databaseItems = Array.isArray(savedItems) ? savedItems : [];
    if (databaseItems.length < items.length) {
      const orderDetail = await manualOrderService.getOrder(orderId);
      databaseItems = orderDetail.data?.items || databaseItems;
    }

    for (const entry of linesWithFiles) {
      const databaseItem = databaseItems[entry.index];
      if (!databaseItem?.id) {
        throw new Error(`Could not find the saved order line for ${entry.item.product_name}. Save the order, then try uploading again.`);
      }
      const files = entry.entries.map((e) => e.file);
      const labels = entry.entries.map((e) => e.side);
      await manualOrderService.uploadProof(orderId, files, undefined, databaseItem.id, labels);
      const key = entry.item.client_key || entry.item.id || '';
      setItemArtworkEntries((previous) => { const next = { ...previous }; delete next[key]; return next; });
      setUploadedItemArtwork((previous) => ({ ...previous, [key]: true }));
    }
  };

  const syncSavedOrderLineIds = (savedItems?: any[]) => {
    if (!Array.isArray(savedItems) || savedItems.length !== items.length) return;
    setItems((previous) => previous.map((item, index) => ({
      ...item,
      id: savedItems[index]?.id || item.id,
      client_key: savedItems[index]?.id || item.client_key,
    })));
  };

  // Save manual order draft
  const handleSaveDraft = async () => {
    if (!customerEmail.trim()) {
      setError('Please provide a customer email address.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one product to the order.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        company_name: companyName,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress || 'TBD',
        customer_notes: customerNotes,
        internal_notes: internalNotes,
        items,
      };

      let orderId = currentOrderId;

      if (orderId) {
        // Update existing order
        const res = await manualOrderService.updateOrder(orderId, payload);
        if (res.success) {
          await uploadArtworkFilesForItems(orderId, res.data?.items);
          syncSavedOrderLineIds(res.data?.items);
          setSuccessMsg(`Order ${orderNumber || ''} updated successfully in database.`);
        }
      } else {
        // Create new order draft
        const res = await manualOrderService.createOrder(payload);
        if (res.success && res.data?.id) {
          const newOrderId = String(res.data.id);
          setCurrentOrderId(newOrderId);
          setOrderNumber(res.data.order_number);

          await uploadArtworkFilesForItems(newOrderId, res.data.items);
          syncSavedOrderLineIds(res.data.items);

          setSuccessMsg(`Draft order ${res.data.order_number} created and saved in database.`);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save manual order draft.');
    } finally {
      setSaving(false);
    }
  };

  // Send for approval
  const handleSendForApproval = async () => {
    if (!customerEmail.trim()) {
      setError('Please provide a customer email address.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one product to the order.');
      return;
    }

    setError(null);
    setSending(true);
    try {
      const payload = {
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        company_name: companyName,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress || 'TBD',
        customer_notes: customerNotes,
        internal_notes: internalNotes,
        items,
      };

      let orderId: string | null = currentOrderId;
      let orderNum: string | null = orderNumber;

      if (orderId) {
        const updateRes = await manualOrderService.updateOrder(orderId, payload);
        await uploadArtworkFilesForItems(orderId, updateRes.data?.items);
        syncSavedOrderLineIds(updateRes.data?.items);
      } else {
        const createRes = await manualOrderService.createOrder(payload);
        if (createRes.success && createRes.data?.id) {
          orderId = createRes.data.id;
          orderNum = createRes.data.order_number;
          setCurrentOrderId(orderId);
          setOrderNumber(orderNum);
          await uploadArtworkFilesForItems(createRes.data.id, createRes.data.items);
          syncSavedOrderLineIds(createRes.data.items);
        }
      }

      if (orderId) {
        await manualOrderService.sendForApproval(orderId);
        setSuccessMsg(`Order ${orderNum || ''} sent for customer approval!`);
        setTimeout(() => router.push(`/admin/orders/${orderId}`), 800);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send order for approval.');
    } finally {
      setSending(false);
    }
  };

  const artworkProductCount = items.reduce((count, item, index) => {
    const lineKey = item.client_key || item.id || `line-${index}`;
    const hasPendingArtwork = (itemArtworkEntries[lineKey]?.length || 0) > 0;
    return count + (hasPendingArtwork || Boolean(item.artwork_id || uploadedItemArtwork[lineKey]) ? 1 : 0);
  }, 0);

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto">
      {/* Top Breadcrumb & Workflow Notice */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="text-[11px] font-semibold text-pink-500 uppercase tracking-widest">
              01 / Staff — Create & Send
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Create, configure custom products, upload artwork, and send to your customer for approval.
            </p>
          </div>
        </div>

        {/* Direct DB Deletion Button if order exists in DB */}
        {currentOrderId && (
          <button
            type="button"
            onClick={handleDeleteOrderFromDb}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            title="Permanently delete this order from the database"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{deleting ? 'Deleting...' : 'Delete from DB'}</span>
          </button>
        )}
      </div>

      {/* Main Title & Stepper */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {currentOrderId ? `Order ${orderNumber || 'Draft'}` : 'Create manual order'}
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {currentOrderId ? 'Saved Draft' : 'Draft'}
          </span>
          {currentOrderId && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              In Database
            </span>
          )}
        </div>

        {/* 3-Step Wizard Progress */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-[11px]">
              1
            </span>
            <span className="text-white font-medium">Order details</span>
          </div>
          <div className="w-8 h-[1px] bg-slate-700" />
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-[11px]">
              2
            </span>
            <span>Artwork</span>
          </div>
          <div className="w-8 h-[1px] bg-slate-700" />
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-[11px]">
              3
            </span>
            <span>Review & send</span>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Order Details, Products, Artwork, Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Details Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Customer details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Customer</label>
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

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Customer email *</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

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

              <div>
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

          {/* Products Table Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Products & design templates</h2>
                <p className="text-[11px] text-slate-500 mt-1">
                  Each product has its own numbered artwork box directly below it. Match the product name before uploading.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-colors"
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
                <tbody className="divide-y divide-slate-800">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        No products added yet. Click &quot;Add product&quot; above to add catalog or custom products.
                      </td>
                    </tr>
                  )}
                  {items.map((item, idx) => {
                    const lineKey = item.client_key || item.id || `line-${idx}`;
                    const selectedArtworkEntries = itemArtworkEntries[lineKey] || [];
                    return (
                    <React.Fragment key={lineKey}>
                    <tr className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 font-medium text-slate-200">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs flex-shrink-0">
                            <Layers className="w-4 h-4 text-pink-400" />
                          </div>
                          <div>
                            <div className="font-semibold text-white">{item.product_name}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] ${item.product_id ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'}`}>
                                {item.product_id ? 'Catalog' : 'Custom'}
                              </span>
                              {item.id && (
                                <span className="text-[9px] text-emerald-400/90 font-mono">DB Saved</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-slate-300 max-w-sm">
                        <div className="text-xs leading-relaxed font-medium">
                          {item.specifications || 'Standard Specifications'}
                        </div>
                        {item.options?.notes && (
                          <div className="mt-1 text-[11px] text-pink-400/90 italic">
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
                        ${Number(item.price ?? 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-white font-semibold font-mono">
                        ${Number(item.price ?? 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                          title={currentOrderId && item.id ? 'Delete product directly from database' : 'Remove product'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    <tr className="border-b-2 border-slate-700/80 bg-slate-950/50">
                      <td colSpan={6} className="px-3 pb-3 pt-2">
                        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex h-7 min-w-7 items-center justify-center rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 text-[10px] font-bold text-sky-300">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="min-w-0">
                                <h3 className="text-xs font-semibold text-white">Artwork for {item.product_name}</h3>
                                <p className="text-[10px] text-slate-500">
                                  Supports both Front and Back artwork. Attached specifically to product {idx + 1}.
                                </p>
                              </div>
                            </div>
                            {(item.artwork_id || uploadedItemArtwork[lineKey]) && selectedArtworkEntries.length === 0 && (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400">
                                Existing artwork attached
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <label
                              className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/40 p-5 text-center transition-colors hover:border-pink-500/50"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                handleItemArtworkSelect(lineKey, event.dataTransfer.files);
                              }}
                            >
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.svg,.png,.pdf,.webp"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                  handleItemArtworkSelect(lineKey, event.target.files);
                                  event.currentTarget.value = '';
                                }}
                              />
                              <Upload className="mb-2 h-6 w-6 text-slate-400" />
                              <p className="text-xs font-medium text-slate-300">Drag & drop Front & Back files</p>
                              <p className="mt-1 text-[11px] text-pink-400">or browse files (multi-select allowed)</p>
                              <span className="mt-2 text-[10px] text-slate-500">JPG, PNG, SVG, PDF (max 50MB each)</span>
                            </label>

                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:col-span-2">
                              {selectedArtworkEntries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-950/70 p-3 transition-colors hover:border-slate-600"
                                >
                                  <div className="flex items-start gap-3">
                                    {entry.previewUrl ? (
                                      <img
                                        src={entry.previewUrl}
                                        alt={`Preview of ${entry.name}`}
                                        className="h-16 w-16 shrink-0 rounded-lg border border-slate-700 bg-slate-900 object-contain p-0.5"
                                      />
                                    ) : (
                                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400">
                                        <FileCheck className="h-6 w-6" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-medium text-slate-200" title={entry.name}>
                                        {entry.name}
                                      </p>
                                      <p className="mt-0.5 text-[10px] text-slate-500">{entry.size}</p>

                                      {/* Side indicator badge and toggle */}
                                      <div className="mt-2 flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium text-slate-400">Side:</span>
                                        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-[10px]">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleArtworkSide(lineKey, entry.id, 'Front')}
                                            className={`rounded px-2 py-0.5 font-semibold transition ${
                                              entry.side === 'Front'
                                                ? 'bg-sky-600 text-white shadow-xs'
                                                : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                          >
                                            Front
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleArtworkSide(lineKey, entry.id, 'Back')}
                                            className={`rounded px-2 py-0.5 font-semibold transition ${
                                              entry.side === 'Back'
                                                ? 'bg-purple-600 text-white shadow-xs'
                                                : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                          >
                                            Back
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveArtworkFile(lineKey, entry.id)}
                                      className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                                      title={`Remove ${entry.name}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {selectedArtworkEntries.length === 0 && (
                                <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/30 px-4 text-center text-xs text-slate-500">
                                  {item.artwork_id || uploadedItemArtwork[lineKey]
                                    ? 'Artwork is saved for this product. Upload new files above to revise proof.'
                                    : 'No artwork selected yet. Drag & drop or browse Front and/or Back images.'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                  )})}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Internal notes <span className="text-slate-500 font-normal">(not visible to customer)</span>
              </label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notes for prepress/dispatch team..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Customer notes <span className="text-slate-500 font-normal">(visible to customer)</span>
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Instructions or notes for customer review..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Right 1 Column: Totals Summary & Actions */}
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Order summary</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                {currentOrderId ? orderNumber || 'Draft' : 'Draft'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="text-slate-200 font-mono">
                  ${totals.subtotal_ex_gst.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST (10%)</span>
                <span className="text-slate-200 font-mono">
                  ${totals.gst_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping</span>
                <span className="text-slate-200 font-mono">
                  ${totals.shipping_fee_inc_gst.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-sm font-bold text-white">
                <span>Total (AUD)</span>
                <span className="text-base font-mono text-emerald-400">
                  ${totals.total_inc_gst.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Activity
            </h3>
            <div className="space-y-4 text-xs pt-1">
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-pink-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">
                    {currentOrderId ? 'Draft saved in database' : 'Draft created'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {currentOrderId ? orderNumber : 'Ready to save'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${artworkProductCount > 0 ? 'bg-pink-500' : 'bg-slate-700'} mt-1 flex-shrink-0`}
                />
                <div>
                  <p className={`${artworkProductCount > 0 ? 'text-slate-200' : 'text-slate-400'} font-medium`}>
                    Artwork uploaded
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {artworkProductCount > 0 ? `${artworkProductCount} product(s) have artwork` : 'Pending'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Customer notified</p>
                  <p className="text-[11px] text-slate-500">Pending</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Customer approval</p>
                  <p className="text-[11px] text-slate-500">Pending</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Payment received</p>
                  <p className="text-[11px] text-slate-500">Pending</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Production</p>
                  <p className="text-[11px] text-slate-500">Pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSendForApproval}
              disabled={sending || saving || deleting || items.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-medium text-sm rounded-xl shadow-md shadow-pink-600/20 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Sending...' : 'Send for approval'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || sending || deleting || items.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs rounded-xl transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : (currentOrderId ? 'Save changes to DB' : 'Save draft to DB')}</span>
            </button>

            {/* Direct DB Delete Option */}
            {currentOrderId && (
              <button
                type="button"
                onClick={handleDeleteOrderFromDb}
                disabled={deleting || saving || sending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-medium text-xs rounded-xl transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Deleting from DB...' : 'Delete order directly in DB'}</span>
              </button>
            )}

            {!currentOrderId && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Clear all fields and reset?')) resetForm();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset form</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modern Add Product & Configuration Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-pink-500" />
                  Add product & configure specifications
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Choose from catalog or configure a fully customized print product.
                </p>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalTab('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    modalTab === 'custom'
                      ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow'
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
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Custom A3 Promo Posters, Folded Takeaway Menus, Vinyl Decals"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-pink-500 placeholder-slate-500"
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
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-pink-500"
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
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-pink-500"
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
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stock, Printing Sides, Finish */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Paper Stock / Material</label>
                      <select
                        value={customStock}
                        onChange={(e) => setCustomStock(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-pink-500"
                      >
                        {STOCK_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      {customStock === 'Custom Material...' && (
                        <input
                          type="text"
                          value={customCustomStock}
                          onChange={(e) => setCustomCustomStock(e.target.value)}
                          placeholder="Type custom material..."
                          className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-pink-500"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Print Sides / Colour</label>
                      <select
                        value={customSides}
                        onChange={(e) => setCustomSides(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-pink-500"
                      >
                        {SIDES_OPTIONS.map((side) => (
                          <option key={side} value={side}>
                            {side}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Finish / Coating</label>
                      <select
                        value={customFinish}
                        onChange={(e) => setCustomFinish(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-pink-500"
                      >
                        {FINISH_OPTIONS.map((fn) => (
                          <option key={fn} value={fn}>
                            {fn}
                          </option>
                        ))}
                      </select>
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
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono focus:outline-none focus:border-pink-500"
                      />
                      <div className="flex gap-1.5 mt-2">
                        {[100, 250, 500, 1000, 2500].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setCustomQty(q)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                              customQty === q
                                ? 'bg-pink-600 text-white border-pink-500'
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
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono focus:outline-none focus:border-pink-500"
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-pink-500 placeholder-slate-500"
                    />
                  </div>

                  {/* Live Spec Preview */}
                  <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-pink-400 font-semibold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Configuration Preview:</span>
                      </div>
                      <p className="text-slate-300 mt-1 font-medium">
                        {customName || 'Custom Print'} — {customWidth && customHeight ? `${customWidth}×${customHeight}mm • ` : ''}
                        {customStock === 'Custom Material...' ? customCustomStock || 'Custom Material' : customStock} • {customSides}
                        {customFinish !== 'None / Uncoated' ? ` • ${customFinish}` : ''}
                      </p>
                    </div>
                    <div className="text-right pl-3 flex-shrink-0">
                      <div className="text-slate-400 text-[10px]">Qty: {customQty}</div>
                      <div className="text-pink-400 font-bold font-mono text-sm">${customPrice.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CATALOG PRODUCT */}
              {modalTab === 'catalog' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Catalog Product *</label>
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
                            {loadingTemplates ? 'Loading templates…' : 'No template (Custom artwork upload)'}
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
                onClick={() => setShowAddProductModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs transition"
              >
                Cancel
              </button>

              {modalTab === 'custom' ? (
                <button
                  type="button"
                  onClick={handleAddCustomProduct}
                  disabled={!customName.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-semibold shadow-md shadow-pink-600/20 disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Product</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddCatalogProduct}
                  disabled={!modalProductId || loadingTemplates}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{selectedTemplateId ? 'Add Product with Template' : 'Add Catalog Product'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
