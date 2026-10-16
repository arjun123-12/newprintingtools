export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_ME: '/auth/me',
  AUTH_CSRF_COOKIE: '/sanctum/csrf-cookie',

  // Catalog
  PRODUCTS: '/products',
  PRODUCT_BY_SLUG: (slug: string) => `/products/${slug}`,
  CATEGORIES: '/categories',
  PRICING_CALCULATE: '/pricing/calculate',

  // Artwork & Storage
  ARTWORK_PRESIGNED_URL: '/artwork/presign-upload',
  ARTWORK_VERIFY: '/artwork/verify',

  // Cart & Checkout
  CART: '/cart',
  CART_ITEMS: '/cart/items',
  CHECKOUT_DATA: '/checkout/data',
  CHECKOUT_SHIPPING_RATES: '/checkout/shipping-rates',
  CHECKOUT_LOCATIONS: '/checkout/locations',
  CHECKOUT_VALIDATE: '/checkout/validate',
  CHECKOUT_PROCESS: '/checkout/process',
  ADDRESSES: '/addresses',

  // Orders
  ORDERS: '/orders',
  ORDER_DETAIL: (orderNumber: string) => `/orders/${orderNumber}`,


  ORDER_PAYMENT_SESSION: (orderNumber: string) =>
    `/orders/${encodeURIComponent(orderNumber)}/payment-session`,
  ORDER_PROCESS_PAYMENT: (orderNumber: string) =>
    `/orders/${encodeURIComponent(orderNumber)}/process-payment`,

  // Admin
  ADMIN_METRICS: '/admin/metrics',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_PRODUCTS_ARCHIVED: '/admin/products/archived',
  ADMIN_PRODUCT_RESTORE: (id: string | number) => `/admin/products/${id}/restore`,
  ADMIN_PRODUCTS_BULK_RESTORE: '/admin/products/bulk-restore',
  ADMIN_PRODUCTS_BULK_ARCHIVE: '/admin/products/bulk-archive',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_CATEGORIES_ARCHIVED: '/admin/categories/archived',
  ADMIN_CATEGORY_RESTORE: (id: string | number) => `/admin/categories/${id}/restore`,
  ADMIN_CATEGORIES_BULK_RESTORE: '/admin/categories/bulk-restore',
  ADMIN_CATEGORIES_BULK_ARCHIVE: '/admin/categories/bulk-archive',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_ARTWORK_QUEUE: '/admin/artwork-queue',
  ADMIN_CUSTOMERS: '/admin/customers',
  ADMIN_CUSTOMERS_IMPORT_PREVIEW: '/admin/customers/import/preview',
  ADMIN_CUSTOMERS_IMPORT: '/admin/customers/import',
  ADMIN_CUSTOMERS_IMPORT_REPORT: '/admin/customers/import/download-report',
  ADMIN_CUSTOMER_DETAIL: (id: string | number) => `/admin/customers/${id}`,
  ADMIN_CUSTOMER_GUEST_ARTWORKS: '/admin/customers/guest-artworks',
  ADMIN_INVOICES: '/admin/invoices',
  ADMIN_INVOICE_DETAIL: (id: string | number) => `/admin/invoices/${id}`,
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_REPORTS_FILTER_OPTIONS: '/admin/reports/filter-options',

  // Shipping & CouriersPlease Carrier Endpoints
  ADMIN_SHIPPING_STATUS: '/admin/shipping/status',
  ADMIN_SHIPPING_ORIGIN: '/admin/shipping/origin',
  ADMIN_SHIPPING_ORDERS: '/admin/shipping/orders',
  ADMIN_SHIPPING_CREATE: (orderId: string | number) => `/admin/shipping/orders/${orderId}/create-shipment`,
  ADMIN_SHIPPING_LABEL: (consignmentNumber: string) => `/admin/shipping/shipments/${consignmentNumber}/label`,
  ADMIN_SHIPPING_TRACK: (consignmentNumber: string) => `/admin/shipping/shipments/${consignmentNumber}/track`,
  ADMIN_SHIPPING_DELIVERY_CHOICES: '/admin/shipping/delivery-choices',
  ADMIN_SHIPPING_BOOK_PICKUP: '/admin/shipping/book-pickup',
  CUSTOMER_ORDER_TRACKING: (orderId: string | number) => `/orders/${orderId}/tracking`,
} as const;

