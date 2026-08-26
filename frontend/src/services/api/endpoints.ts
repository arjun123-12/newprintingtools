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
  CHECKOUT_PROCESS: '/checkout/process',

  // Orders
  ORDERS: '/orders',
  ORDER_DETAIL: (orderNumber: string) => `/orders/${orderNumber}`,

  // Admin
  ADMIN_METRICS: '/admin/metrics',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_ARTWORK_QUEUE: '/admin/artwork-queue',
} as const;
