'use client';

import React, { ChangeEvent, FormEvent, useMemo, useState } from 'react';

type ProductStatus = 'active' | 'draft' | 'archived';

interface PricingTier {
  id: string;
  minQuantity: number;
  maxQuantity: number | '';
  price: number;
}

interface ProductVariant {
  id: string;
  name: string;
  size: string;
  material: string;
  finish: string;
  sku: string;
  basePrice: number;
  salePrice: number | '';
  status: 'active' | 'draft';
}

interface Specification {
  id: string;
  name: string;
  value: string;
}

interface Product {
  id: number;
  name: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  variants: number;
  price: string;
  status: ProductStatus;
  image?: string;
}

interface ProductForm {
  name: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  status: ProductStatus;

  allowTemplates: boolean;
  templateCategory: string;
  canvasSizes: string;
  minimumDpi: number;
  maximumFileSize: number;
  allowCustomerUpload: boolean;
  allowCustomerEditing: boolean;
  requireSafeArea: boolean;
  requireBleed: boolean;
  bleedSize: number;
  trimSize: string;

  printingSides: 'front' | 'both';
  colorMode: 'CMYK' | 'RGB';
  resolution: 150 | 300 | 600;
  cropMarks: boolean;
  safeZone: number;
}

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Business Cards',
    slug: 'business-cards',
    category: 'Stationery',
    shortDescription: 'Professional business cards.',
    description: '',
    variants: 12,
    price: '$49–$149',
    status: 'active',
  },
  {
    id: 2,
    name: 'A4 Flyers',
    slug: 'a4-flyers',
    category: 'Flyers',
    shortDescription: 'High-quality promotional flyers.',
    description: '',
    variants: 8,
    price: '$35–$320',
    status: 'active',
  },
  {
    id: 3,
    name: 'A3 Posters',
    slug: 'a3-posters',
    category: 'Posters',
    shortDescription: 'Large format promotional posters.',
    description: '',
    variants: 6,
    price: '$55–$480',
    status: 'active',
  },
  {
    id: 4,
    name: 'Pull-Up Banners',
    slug: 'pull-up-banners',
    category: 'Signage',
    shortDescription: 'Portable pull-up banners.',
    description: '',
    variants: 4,
    price: '$99–$260',
    status: 'active',
  },
  {
    id: 5,
    name: 'DL Brochures',
    slug: 'dl-brochures',
    category: 'Brochures',
    shortDescription: 'Professional DL brochures.',
    description: '',
    variants: 10,
    price: '$45–$380',
    status: 'active',
  },
  {
    id: 6,
    name: 'Letterheads',
    slug: 'letterheads',
    category: 'Stationery',
    shortDescription: 'Premium printed letterheads.',
    description: '',
    variants: 5,
    price: '$38–$175',
    status: 'active',
  },
  {
    id: 7,
    name: 'Stickers',
    slug: 'stickers',
    category: 'Stickers',
    shortDescription: 'Custom printed stickers.',
    description: '',
    variants: 14,
    price: '$25–$220',
    status: 'active',
  },
  {
    id: 8,
    name: 'Corflute Signs',
    slug: 'corflute-signs',
    category: 'Signage',
    shortDescription: 'Durable corflute signage.',
    description: '',
    variants: 3,
    price: '$65–$390',
    status: 'draft',
  },
];

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const emptyVariant = (): ProductVariant => ({
  id: createId(),
  name: '',
  size: '',
  material: '',
  finish: '',
  sku: '',
  basePrice: 0,
  salePrice: '',
  status: 'active',
});

const emptyPricingTier = (): PricingTier => ({
  id: createId(),
  minQuantity: 1,
  maxQuantity: '',
  price: 0,
});

const emptySpecification = (): Specification => ({
  id: createId(),
  name: '',
  value: '',
});

const initialForm: ProductForm = {
  name: '',
  slug: '',
  category: '',
  shortDescription: '',
  description: '',
  status: 'draft',

  allowTemplates: true,
  templateCategory: '',
  canvasSizes: '',
  minimumDpi: 300,
  maximumFileSize: 20,
  allowCustomerUpload: true,
  allowCustomerEditing: true,
  requireSafeArea: true,
  requireBleed: true,
  bleedSize: 3,
  trimSize: '',

  printingSides: 'front',
  colorMode: 'CMYK',
  resolution: 300,
  cropMarks: false,
  safeZone: 5,
};

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30';

const selectClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30';

const textareaClass =
  'w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        )}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-slate-300">
      {children}
      {required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-left transition hover:border-slate-700"
    >
      <div className="pr-4">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>

      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-sky-600' : 'bg-slate-700'
          }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-[18px]' : 'left-0.5'
            }`}
        />
      </span>
    </button>
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [search, setSearch] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);

  const [form, setForm] = useState<ProductForm>(initialForm);

  const [variants, setVariants] = useState<ProductVariant[]>([
    emptyVariant(),
  ]);

  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([
    {
      id: createId(),
      minQuantity: 1,
      maxQuantity: 99,
      price: 49,
    },
  ]);

  const [specifications, setSpecifications] = useState<Specification[]>([
    {
      id: createId(),
      name: 'Width',
      value: '',
    },
    {
      id: createId(),
      name: 'Height',
      value: '',
    },
    {
      id: createId(),
      name: 'Unit',
      value: 'mm',
    },
    {
      id: createId(),
      name: 'Material',
      value: '',
    },
  ]);

  const [imagePreview, setImagePreview] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return products;

    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }, [products, search]);

  const resetForm = () => {
    setForm(initialForm);
    setVariants([emptyVariant()]);
    setPricingTiers([
      {
        id: createId(),
        minQuantity: 1,
        maxQuantity: 99,
        price: 49,
      },
    ]);
    setSpecifications([
      { id: createId(), name: 'Width', value: '' },
      { id: createId(), name: 'Height', value: '' },
      { id: createId(), name: 'Unit', value: 'mm' },
      { id: createId(), name: 'Material', value: '' },
    ]);
    setImagePreview('');
    setErrors({});
  };

  const openAddProduct = () => {
    resetForm();
    setShowAddProduct(true);
  };

  const closeAddProduct = () => {
    setShowAddProduct(false);
    setErrors({});
  };

  const updateForm = <K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleProductNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slug || slugify(value),
    }));
  };

  // -----------------------------
  // IMAGE
  // -----------------------------

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({
        ...prev,
        image: 'Please upload a valid image file.',
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        image: 'Image must be smaller than 5MB.',
      }));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setImagePreview(reader.result as string);

      setErrors((prev) => {
        const next = { ...prev };
        delete next.image;
        return next;
      });
    };

    reader.readAsDataURL(file);
  };

  // -----------------------------
  // VARIANTS
  // -----------------------------

  const addVariant = () => {
    setVariants((prev) => [...prev, emptyVariant()]);
  };

  const removeVariant = (id: string) => {
    if (variants.length === 1) return;

    setVariants((prev) => prev.filter((variant) => variant.id !== id));
  };

  const duplicateVariant = (variant: ProductVariant) => {
    setVariants((prev) => [
      ...prev,
      {
        ...variant,
        id: createId(),
        name: `${variant.name} Copy`,
        sku: '',
      },
    ]);
  };

  const updateVariant = <K extends keyof ProductVariant>(
    id: string,
    key: K,
    value: ProductVariant[K]
  ) => {
    setVariants((prev) =>
      prev.map((variant) =>
        variant.id === id
          ? {
            ...variant,
            [key]: value,
          }
          : variant
      )
    );
  };

  // -----------------------------
  // PRICING
  // -----------------------------

  const addPricingTier = () => {
    setPricingTiers((prev) => {
      const last = prev[prev.length - 1];

      return [
        ...prev,
        {
          id: createId(),
          minQuantity:
            last && last.maxQuantity !== ''
              ? Number(last.maxQuantity) + 1
              : 1,
          maxQuantity: '',
          price: 0,
        },
      ];
    });
  };

  const removePricingTier = (id: string) => {
    if (pricingTiers.length === 1) return;

    setPricingTiers((prev) => prev.filter((tier) => tier.id !== id));
  };

  const updatePricingTier = <K extends keyof PricingTier>(
    id: string,
    key: K,
    value: PricingTier[K]
  ) => {
    setPricingTiers((prev) =>
      prev.map((tier) =>
        tier.id === id
          ? {
            ...tier,
            [key]: value,
          }
          : tier
      )
    );
  };

  // -----------------------------
  // SPECIFICATIONS
  // -----------------------------

  const addSpecification = () => {
    setSpecifications((prev) => [...prev, emptySpecification()]);
  };

  const removeSpecification = (id: string) => {
    setSpecifications((prev) =>
      prev.filter((specification) => specification.id !== id)
    );
  };

  const updateSpecification = (
    id: string,
    key: keyof Specification,
    value: string
  ) => {
    setSpecifications((prev) =>
      prev.map((specification) =>
        specification.id === id
          ? {
            ...specification,
            [key]: value,
          }
          : specification
      )
    );
  };

  // -----------------------------
  // VALIDATION
  // -----------------------------

  const validate = (publishing: boolean) => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Product name is required.';
    }

    if (!form.slug.trim()) {
      newErrors.slug = 'Product slug is required.';
    }

    if (!form.category.trim()) {
      newErrors.category = 'Category is required.';
    }

    if (publishing && variants.length === 0) {
      newErrors.variants = 'At least one variant is required.';
    }

    const emptyVariantIndex = variants.findIndex(
      (variant) =>
        !variant.name.trim() ||
        !variant.sku.trim() ||
        Number(variant.basePrice) <= 0
    );

    if (publishing && emptyVariantIndex !== -1) {
      newErrors.variants =
        'Every variant requires a name, SKU and price greater than 0.';
    }

    const skuList = variants
      .map((variant) => variant.sku.trim().toLowerCase())
      .filter(Boolean);

    const duplicateSku = skuList.find(
      (sku, index) => skuList.indexOf(sku) !== index
    );

    if (duplicateSku) {
      newErrors.variants = `Duplicate SKU found: ${duplicateSku}`;
    }

    for (let i = 0; i < pricingTiers.length; i++) {
      const current = pricingTiers[i];

      if (current.minQuantity < 1) {
        newErrors.pricing = 'Minimum quantity must be at least 1.';
        break;
      }

      if (
        current.maxQuantity !== '' &&
        Number(current.maxQuantity) < current.minQuantity
      ) {
        newErrors.pricing =
          'Maximum quantity cannot be smaller than minimum quantity.';
        break;
      }

      if (current.price <= 0) {
        newErrors.pricing = 'Pricing must be greater than 0.';
        break;
      }

      const next = pricingTiers[i + 1];

      if (
        next &&
        current.maxQuantity !== '' &&
        next.minQuantity <= Number(current.maxQuantity)
      ) {
        newErrors.pricing = 'Pricing quantity ranges cannot overlap.';
        break;
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // -----------------------------
  // SAVE
  // -----------------------------

  const calculatePriceRange = () => {
    const prices = variants
      .map((variant) => Number(variant.salePrice || variant.basePrice))
      .filter((price) => price > 0);

    if (!prices.length) return '$0';

    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return min === max
      ? `$${min.toFixed(0)}`
      : `$${min.toFixed(0)}–$${max.toFixed(0)}`;
  };

  const saveProduct = (status: ProductStatus) => {
    const publishing = status === 'active';

    if (!validate(publishing)) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });

      return;
    }

    const newProduct: Product = {
      id: Date.now(),
      name: form.name.trim(),
      slug: form.slug.trim(),
      category: form.category,
      shortDescription: form.shortDescription,
      description: form.description,
      variants: variants.length,
      price: calculatePriceRange(),
      status,
      image: imagePreview,
    };

    setProducts((prev) => [newProduct, ...prev]);

    setToast(
      status === 'active'
        ? 'Product published successfully.'
        : 'Product saved as draft.'
    );

    setShowAddProduct(false);
    resetForm();

    window.setTimeout(() => {
      setToast('');
    }, 3000);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    saveProduct(form.status === 'active' ? 'active' : 'draft');
  };

  // -----------------------------
  // FORM VIEW
  // -----------------------------

  if (showAddProduct) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-950">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-6 py-4">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={closeAddProduct}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 18l-6-6 6-6"
                  />
                </svg>
              </button>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  Products / New Product
                </p>
                <h1 className="truncate text-lg font-semibold text-white">
                  Add Product
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => saveProduct('draft')}
                className="hidden rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white sm:block"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={() => saveProduct('active')}
                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-900/20 transition hover:bg-sky-500"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="hidden sm:inline">Publish Product</span>
                <span className="sm:hidden">Publish</span>
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mx-auto max-w-7xl p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Create a new product
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure product information, variants, pricing, templates and
              print settings.
            </p>
          </div>

          <div className="space-y-5">
            {/* --------------------------------
                BASIC INFORMATION
            -------------------------------- */}
            <Section
              title="Basic Information"
              description="Basic information customers will see about this product."
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <FieldLabel required>Product Name</FieldLabel>
                  <input
                    value={form.name}
                    onChange={(e) => handleProductNameChange(e.target.value)}
                    placeholder="e.g. Business Cards"
                    className={inputClass}
                  />
                  {errors.name && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <FieldLabel required>Product Slug</FieldLabel>
                  <input
                    value={form.slug}
                    onChange={(e) =>
                      updateForm('slug', slugify(e.target.value))
                    }
                    placeholder="business-cards"
                    className={inputClass}
                  />
                  {errors.slug && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.slug}
                    </p>
                  )}
                </div>

                <div>
                  <FieldLabel required>Category</FieldLabel>
                  <select
                    value={form.category}
                    onChange={(e) => updateForm('category', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select category</option>
                    <option value="Stationery">Stationery</option>
                    <option value="Flyers">Flyers</option>
                    <option value="Posters">Posters</option>
                    <option value="Signage">Signage</option>
                    <option value="Brochures">Brochures</option>
                    <option value="Stickers">Stickers</option>
                    <option value="Banners">Banners</option>
                    <option value="Packaging">Packaging</option>
                  </select>
                  {errors.category && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.category}
                    </p>
                  )}
                </div>

                <div>
                  <FieldLabel>Status</FieldLabel>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      updateForm(
                        'status',
                        e.target.value as ProductStatus
                      )
                    }
                    className={selectClass}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <FieldLabel>Short Description</FieldLabel>
                  <input
                    value={form.shortDescription}
                    onChange={(e) =>
                      updateForm('shortDescription', e.target.value)
                    }
                    placeholder="Short description shown in product cards..."
                    className={inputClass}
                  />
                </div>

                <div className="lg:col-span-2">
                  <FieldLabel>Product Description</FieldLabel>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(e) =>
                      updateForm('description', e.target.value)
                    }
                    placeholder="Describe this product..."
                    className={textareaClass}
                  />
                </div>
              </div>
            </Section>

            {/* --------------------------------
                IMAGE + QUICK SETTINGS
            -------------------------------- */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Section
                  title="Product Image"
                  description="Upload the main image used in your product catalog."
                >
                  <div
                    className={`relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${imagePreview
                        ? 'border-slate-700 bg-slate-950'
                        : 'border-slate-700 bg-slate-950/60'
                      }`}
                  >
                    {imagePreview ? (
                      <>
                        <img
                          src={imagePreview}
                          alt="Product preview"
                          className="h-full max-h-[280px] w-full object-contain"
                        />

                        <div className="absolute right-3 top-3 flex gap-2">
                          <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg hover:bg-slate-800">
                            Replace
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={handleImageUpload}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => setImagePreview('')}
                            className="rounded-lg border border-red-500/20 bg-slate-900/95 px-3 py-2 text-xs font-medium text-red-400 shadow-lg hover:bg-red-500/10"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center px-6 py-10 text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
                          <svg
                            className="h-6 w-6 text-slate-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L21 13"
                            />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                            />
                          </svg>
                        </div>

                        <p className="text-sm font-medium text-slate-200">
                          Drop your product image here
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          PNG, JPG or WebP up to 5MB
                        </p>

                        <span className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-xs font-medium text-white">
                          Browse Files
                        </span>

                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </label>
                    )}
                  </div>

                  {errors.image && (
                    <p className="mt-2 text-xs text-red-400">
                      {errors.image}
                    </p>
                  )}
                </Section>
              </div>

              <Section
                title="Product Defaults"
                description="Default values used when customers create designs."
              >
                <div className="space-y-3">
                  <Toggle
                    checked={form.allowTemplates}
                    onChange={(value) => updateForm('allowTemplates', value)}
                    label="Allow Templates"
                    description="Enable templates for this product."
                  />

                  <Toggle
                    checked={form.allowCustomerUpload}
                    onChange={(value) =>
                      updateForm('allowCustomerUpload', value)
                    }
                    label="Customer Upload"
                    description="Allow customer image uploads."
                  />

                  <Toggle
                    checked={form.allowCustomerEditing}
                    onChange={(value) =>
                      updateForm('allowCustomerEditing', value)
                    }
                    label="Customer Editing"
                    description="Allow customers to edit templates."
                  />
                </div>
              </Section>
            </div>

            {/* --------------------------------
                VARIANTS
            -------------------------------- */}
            <Section
              title="Product Variants"
              description="Create different sizes, materials, finishes and prices."
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {variants.length} Variant
                    {variants.length !== 1 ? 's' : ''}
                  </p>

                  {errors.variants && (
                    <p className="mt-1 text-xs text-red-400">
                      {errors.variants}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={addVariant}
                  className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-500"
                >
                  <span className="text-base leading-none">+</span>
                  Add Variant
                </button>
              </div>

              <div className="space-y-4">
                {variants.map((variant, index) => (
                  <div
                    key={variant.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs font-semibold text-slate-300">
                          {index + 1}
                        </span>

                        <span className="text-sm font-medium text-slate-200">
                          {variant.name || `Variant ${index + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => duplicateVariant(variant)}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
                        >
                          Duplicate
                        </button>

                        <button
                          type="button"
                          onClick={() => removeVariant(variant.id)}
                          disabled={variants.length === 1}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <FieldLabel>Variant Name</FieldLabel>
                        <input
                          value={variant.name}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              'name',
                              e.target.value
                            )
                          }
                          placeholder="Standard"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <FieldLabel>Size</FieldLabel>
                        <input
                          value={variant.size}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              'size',
                              e.target.value
                            )
                          }
                          placeholder="90 × 55 mm"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <FieldLabel>Material</FieldLabel>
                        <input
                          value={variant.material}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              'material',
                              e.target.value
                            )
                          }
                          placeholder="350gsm"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <FieldLabel>Finish</FieldLabel>
                        <select
                          value={variant.finish}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              'finish',
                              e.target.value
                            )
                          }
                          className={selectClass}
                        >
                          <option value="">Select finish</option>
                          <option value="Matte">Matte</option>
                          <option value="Gloss">Gloss</option>
                          <option value="Uncoated">Uncoated</option>
                          <option value="Soft Touch">Soft Touch</option>
                        </select>
                      </div>

                      <div>
                        <FieldLabel>SKU</FieldLabel>
                        <input
                          value={variant.sku}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              'sku',
                              e.target.value.toUpperCase()
                            )
                          }
                          placeholder="BC-STD-001"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <FieldLabel>Base Price</FieldLabel>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.basePrice}
                            onChange={(e) =>
                              updateVariant(
                                variant.id,
                                'basePrice',
                                Number(e.target.value)
                              )
                            }
                            className={`${inputClass} pl-7`}
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel>Sale Price</FieldLabel>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.salePrice}
                            onChange={(e) =>
                              updateVariant(
                                variant.id,
                                'salePrice',
                                e.target.value === ''
                                  ? ''
                                  : Number(e.target.value)
                              )
                            }
                            placeholder="Optional"
                            className={`${inputClass} pl-7`}
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel>Status</FieldLabel>
                        <select
                          value={variant.status}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              'status',
                              e.target.value as 'active' | 'draft'
                            )
                          }
                          className={selectClass}
                        >
                          <option value="active">Active</option>
                          <option value="draft">Draft</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* --------------------------------
                DYNAMIC PRICING
            -------------------------------- */}
            <Section
              title="Dynamic Pricing"
              description="Set quantity-based pricing for this product."
            >
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <div className="hidden grid-cols-[1fr_1fr_1fr_48px] gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:grid">
                  <span>Minimum Quantity</span>
                  <span>Maximum Quantity</span>
                  <span>Price</span>
                  <span />
                </div>

                <div className="divide-y divide-slate-800">
                  {pricingTiers.map((tier, index) => (
                    <div
                      key={tier.id}
                      className="grid grid-cols-1 gap-3 bg-slate-950/50 p-4 md:grid-cols-[1fr_1fr_1fr_48px] md:items-end"
                    >
                      <div>
                        <FieldLabel>
                          Minimum Quantity
                        </FieldLabel>
                        <input
                          type="number"
                          min="1"
                          value={tier.minQuantity}
                          onChange={(e) =>
                            updatePricingTier(
                              tier.id,
                              'minQuantity',
                              Number(e.target.value)
                            )
                          }
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <FieldLabel>
                          Maximum Quantity
                        </FieldLabel>
                        <input
                          type="number"
                          min={tier.minQuantity}
                          value={tier.maxQuantity}
                          onChange={(e) =>
                            updatePricingTier(
                              tier.id,
                              'maxQuantity',
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value)
                            )
                          }
                          placeholder="Unlimited"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <FieldLabel>Price</FieldLabel>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={tier.price}
                            onChange={(e) =>
                              updatePricingTier(
                                tier.id,
                                'price',
                                Number(e.target.value)
                              )
                            }
                            className={`${inputClass} pl-7`}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removePricingTier(tier.id)}
                        disabled={pricingTiers.length === 1}
                        className="flex h-[42px] items-center justify-center rounded-lg border border-slate-800 text-slate-500 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Remove pricing tier ${index + 1}`}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 7h12M9 7V4h6v3m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7h10z"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {errors.pricing && (
                <p className="mt-3 text-xs text-red-400">
                  {errors.pricing}
                </p>
              )}

              <button
                type="button"
                onClick={addPricingTier}
                className="mt-4 flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-sky-500/40 hover:bg-sky-500/5 hover:text-sky-400"
              >
                <span className="text-base leading-none">+</span>
                Add Pricing Tier
              </button>
            </Section>

            {/* --------------------------------
                SPECIFICATIONS
            -------------------------------- */}
            <Section
              title="Product Specifications"
              description="Define technical specifications shown to customers."
            >
              <div className="space-y-3">
                {specifications.map((specification) => (
                  <div
                    key={specification.id}
                    className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_44px]"
                  >
                    <input
                      value={specification.name}
                      onChange={(e) =>
                        updateSpecification(
                          specification.id,
                          'name',
                          e.target.value
                        )
                      }
                      placeholder="Specification"
                      className={inputClass}
                    />

                    <input
                      value={specification.value}
                      onChange={(e) =>
                        updateSpecification(
                          specification.id,
                          'value',
                          e.target.value
                        )
                      }
                      placeholder="Value"
                      className={inputClass}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeSpecification(specification.id)
                      }
                      className="flex h-[42px] items-center justify-center rounded-lg border border-slate-800 text-slate-500 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addSpecification}
                className="mt-4 flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-sky-500/40 hover:bg-sky-500/5 hover:text-sky-400"
              >
                <span className="text-base leading-none">+</span>
                Add Specification
              </button>
            </Section>

            {/* --------------------------------
                TEMPLATE SETTINGS
            -------------------------------- */}
            <Section
              title="Template Configuration"
              description="Configure how this product works with your design editor and customer templates."
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <FieldLabel>Template Category</FieldLabel>
                  <input
                    value={form.templateCategory}
                    onChange={(e) =>
                      updateForm('templateCategory', e.target.value)
                    }
                    placeholder="e.g. Business Cards"
                    className={inputClass}
                  />
                </div>

                <div>
                  <FieldLabel>Allowed Canvas Sizes</FieldLabel>
                  <input
                    value={form.canvasSizes}
                    onChange={(e) =>
                      updateForm('canvasSizes', e.target.value)
                    }
                    placeholder="90x55mm, 85x55mm"
                    className={inputClass}
                  />
                </div>

                <div>
                  <FieldLabel>Minimum DPI</FieldLabel>
                  <select
                    value={form.minimumDpi}
                    onChange={(e) =>
                      updateForm('minimumDpi', Number(e.target.value))
                    }
                    className={selectClass}
                  >
                    <option value={150}>150 DPI</option>
                    <option value={300}>300 DPI</option>
                    <option value={600}>600 DPI</option>
                  </select>
                </div>

                <div>
                  <FieldLabel>Maximum File Size</FieldLabel>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={form.maximumFileSize}
                      onChange={(e) =>
                        updateForm(
                          'maximumFileSize',
                          Number(e.target.value)
                        )
                      }
                      className={`${inputClass} pr-12`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                      MB
                    </span>
                  </div>
                </div>

                <div>
                  <FieldLabel>Bleed Size</FieldLabel>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.bleedSize}
                      onChange={(e) =>
                        updateForm('bleedSize', Number(e.target.value))
                      }
                      className={`${inputClass} pr-12`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                      mm
                    </span>
                  </div>
                </div>

                <div>
                  <FieldLabel>Trim Size</FieldLabel>
                  <input
                    value={form.trimSize}
                    onChange={(e) =>
                      updateForm('trimSize', e.target.value)
                    }
                    placeholder="90 × 55 mm"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <Toggle
                  checked={form.requireSafeArea}
                  onChange={(value) =>
                    updateForm('requireSafeArea', value)
                  }
                  label="Require Safe Area"
                  description="Show safe-area guidance in the editor."
                />

                <Toggle
                  checked={form.requireBleed}
                  onChange={(value) =>
                    updateForm('requireBleed', value)
                  }
                  label="Require Bleed"
                  description="Require bleed around the print artwork."
                />
              </div>
            </Section>

            {/* --------------------------------
                PRINT SETTINGS
            -------------------------------- */}
            <Section
              title="Print Settings"
              description="Technical print and export requirements."
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <FieldLabel>Printing Sides</FieldLabel>
                  <select
                    value={form.printingSides}
                    onChange={(e) =>
                      updateForm(
                        'printingSides',
                        e.target.value as 'front' | 'both'
                      )
                    }
                    className={selectClass}
                  >
                    <option value="front">Front Only</option>
                    <option value="both">Front & Back</option>
                  </select>
                </div>

                <div>
                  <FieldLabel>Color Mode</FieldLabel>
                  <select
                    value={form.colorMode}
                    onChange={(e) =>
                      updateForm(
                        'colorMode',
                        e.target.value as 'CMYK' | 'RGB'
                      )
                    }
                    className={selectClass}
                  >
                    <option value="CMYK">CMYK</option>
                    <option value="RGB">RGB</option>
                  </select>
                </div>

                <div>
                  <FieldLabel>Resolution</FieldLabel>
                  <select
                    value={form.resolution}
                    onChange={(e) =>
                      updateForm(
                        'resolution',
                        Number(e.target.value) as 150 | 300 | 600
                      )
                    }
                    className={selectClass}
                  >
                    <option value={150}>150 DPI</option>
                    <option value={300}>300 DPI</option>
                    <option value={600}>600 DPI</option>
                  </select>
                </div>

                <div>
                  <FieldLabel>Safe Zone</FieldLabel>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.safeZone}
                      onChange={(e) =>
                        updateForm('safeZone', Number(e.target.value))
                      }
                      className={`${inputClass} pr-12`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                      mm
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 max-w-md">
                <Toggle
                  checked={form.cropMarks}
                  onChange={(value) => updateForm('cropMarks', value)}
                  label="Crop Marks"
                  description="Include crop marks during print export."
                />
              </div>
            </Section>

            {/* --------------------------------
                BOTTOM ACTIONS
            -------------------------------- */}
            <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-800 pt-5 sm:flex-row">
              <button
                type="button"
                onClick={closeAddProduct}
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => saveProduct('draft')}
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-900"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={() => saveProduct('active')}
                className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500"
              >
                Publish Product
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // -----------------------------
  // PRODUCT CATALOG
  // -----------------------------

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Product Catalog
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Manage print products, variants, and dynamic pricing.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddProduct}
          className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative w-full max-w-sm">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m20 20-4-4"
            />
          </svg>

          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="group rounded-xl border border-slate-800 bg-slate-900 p-5 transition-colors hover:border-slate-700"
            >
              <div className="mb-3 flex items-start justify-between">
                {product.image ? (
                  <div className="h-10 w-10 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                    <img
                      src={product.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-600/10">
                    <svg
                      className="h-5 w-5 text-sky-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
                      />
                    </svg>
                  </div>
                )}

                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${product.status === 'active'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      : product.status === 'draft'
                        ? 'border-slate-500/20 bg-slate-500/10 text-slate-400'
                        : 'border-red-500/20 bg-red-500/10 text-red-400'
                    }`}
                >
                  {product.status === 'active'
                    ? 'Active'
                    : product.status === 'draft'
                      ? 'Draft'
                      : 'Archived'}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-white">
                {product.name}
              </h3>

              <p className="mt-0.5 text-xs text-slate-500">
                {product.category}
              </p>

              {product.shortDescription && (
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                  {product.shortDescription}
                </p>
              )}

              <div className="mt-4 flex items-end justify-between border-t border-slate-800 pt-3">
                <div>
                  <p className="text-xs text-slate-500">Price range</p>
                  <p className="text-sm font-medium text-slate-300">
                    {product.price}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-slate-500">Variants</p>
                  <p className="text-sm font-medium text-slate-300">
                    {product.variants}
                  </p>
                </div>

                <button
                  type="button"
                  className="text-xs font-medium text-sky-400 opacity-0 transition group-hover:opacity-100 hover:text-sky-300"
                >
                  Edit →
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/50 px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
            <svg
              className="h-5 w-5 text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <circle cx="11" cy="11" r="7" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m20 20-4-4"
              />
            </svg>
          </div>

          <h3 className="mt-4 text-sm font-semibold text-white">
            No products found
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Try another search term.
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-slate-900 px-4 py-3 shadow-2xl">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10">
            <svg
              className="h-4 w-4 text-emerald-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <span className="text-sm text-slate-200">{toast}</span>
        </div>
      )}
    </div>
  );
}