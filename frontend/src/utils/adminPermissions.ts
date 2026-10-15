import type { CustomerUser } from '@/context/AuthContext';

export interface AdminPermissionDef {
  key: string;
  name: string;
  description: string;
  category: 'General' | 'Operations' | 'Catalog' | 'Design' | 'Customers' | 'Financial';
  routePath: string;
}

/**
 * Stable canonical catalog of admin permissions.
 * Matches backend User::PERMISSIONS.
 */
export const ADMIN_PERMISSIONS: AdminPermissionDef[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    description: 'System overview and performance metrics',
    category: 'General',
    routePath: '/admin/dashboard',
  },
  {
    key: 'orders',
    name: 'Orders',
    description: 'Order fulfillment and production tracking',
    category: 'Operations',
    routePath: '/admin/orders',
  },
  {
    key: 'enquiries',
    name: 'Customer Enquiries',
    description: 'Customer contact messages and support queries',
    category: 'Operations',
    routePath: '/admin/enquiries',
  },
  {
    key: 'products',
    name: 'Products',
    description: 'Print product catalog, specifications & variants',
    category: 'Catalog',
    routePath: '/admin/products',
  },
  {
    key: 'categories',
    name: 'Categories',
    description: 'Product category taxonomy and hierarchy',
    category: 'Catalog',
    routePath: '/admin/categories',
  },
  {
    key: 'templates',
    name: 'Templates',
    description: 'Publish and manage design canvas templates',
    category: 'Design',
    routePath: '/admin/templates',
  },
  {
    key: 'design_assets',
    name: 'Design Assets',
    description: 'Graphics, fonts, stickers, and cliparts',
    category: 'Design',
    routePath: '/admin/designer/assets',
  },
  {
    key: 'artwork',
    name: 'Artwork Queue',
    description: 'Preflight artwork checks and client files',
    category: 'Design',
    routePath: '/admin/artwork',
  },
  {
    key: 'customers',
    name: 'Customers',
    description: 'Customer directory and ABN trade accounts',
    category: 'Customers',
    routePath: '/admin/customers',
  },
  {
    key: 'pricing',
    name: 'Pricing Rules',
    description: 'Quantity breaks and markup pricing matrix',
    category: 'Catalog',
    routePath: '/admin/pricing',
  },
  {
    key: 'invoices',
    name: 'Invoices',
    description: 'AUD tax invoices, GST breakdowns and payments',
    category: 'Financial',
    routePath: '/admin/invoices',
  },
  {
    key: 'shipping',
    name: 'Shipping',
    description: 'Couriers, tracking consignments, and dispatch',
    category: 'Operations',
    routePath: '/admin/shipping',
  },
  {
    key: 'reports',
    name: 'Reports',
    description: 'Operational, revenue, and production analytics',
    category: 'General',
    routePath: '/admin/reports',
  },
  {
    key: 'settings',
    name: 'Settings',
    description: 'Store platform settings and configuration',
    category: 'General',
    routePath: '/admin/settings',
  },
];

/**
 * Checks whether user has Super Admin status.
 * Super Admins retain full, unrestricted access.
 */
export function isSuperAdmin(user: CustomerUser | null | undefined): boolean {
  if (!user || user.is_active === false) {
    return false;
  }

  if (user.is_super_admin === true) {
    return true;
  }

  // Backward compatibility fallback: existing admin role without granular permissions array
  if (user.role === 'admin' && (!user.permissions || user.permissions.length === 0)) {
    return true;
  }

  return false;
}

/**
 * Checks whether user has permission to access a specific admin section.
 * Denies access by default. Super Admin always returns true.
 */
export function canAccessSection(
  user: CustomerUser | null | undefined,
  permissionKey: string
): boolean {
  if (!user || user.is_active === false) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  if (!user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }

  return user.permissions.includes(permissionKey);
}

/**
 * Resolves required permission key or 'super_admin' for a given admin URL pathname.
 */
export function getRequiredPermissionForPath(pathname: string): string | 'super_admin' | null {
  // Public or universally accessible admin sub-routes
  if (pathname === '/admin/login' || pathname === '/admin/change-password') {
    return null;
  }

  // Staff management strictly requires Super Admin
  if (pathname === '/admin/staff' || pathname.startsWith('/admin/staff/')) {
    return 'super_admin';
  }

  // Match routes to permission keys
  if (pathname === '/admin' || pathname === '/admin/dashboard' || pathname.startsWith('/admin/dashboard/')) {
    return 'dashboard';
  }
  if (pathname === '/admin/orders' || pathname.startsWith('/admin/orders/')) {
    return 'orders';
  }
  if (pathname === '/admin/enquiries' || pathname.startsWith('/admin/enquiries/')) {
    return 'enquiries';
  }
  if (pathname === '/admin/products' || pathname.startsWith('/admin/products/') || pathname.startsWith('/admin/attributes') || pathname.startsWith('/admin/edit')) {
    return 'products';
  }
  if (pathname === '/admin/categories' || pathname.startsWith('/admin/categories/')) {
    return 'categories';
  }
  if (pathname === '/admin/templates' || pathname.startsWith('/admin/templates/')) {
    return 'templates';
  }
  if (pathname === '/admin/designer' || pathname.startsWith('/admin/designer/')) {
    return 'design_assets';
  }
  if (pathname === '/admin/artwork' || pathname.startsWith('/admin/artwork/')) {
    return 'artwork';
  }
  if (pathname === '/admin/customers' || pathname.startsWith('/admin/customers/')) {
    return 'customers';
  }
  if (pathname === '/admin/pricing' || pathname.startsWith('/admin/pricing/') || pathname.startsWith('/admin/coupons')) {
    return 'pricing';
  }
  if (pathname === '/admin/invoices' || pathname.startsWith('/admin/invoices/') || pathname.startsWith('/admin/payments')) {
    return 'invoices';
  }
  if (pathname === '/admin/shipping' || pathname.startsWith('/admin/shipping/')) {
    return 'shipping';
  }
  if (pathname === '/admin/reports' || pathname.startsWith('/admin/reports/')) {
    return 'reports';
  }
  if (pathname === '/admin/settings' || pathname.startsWith('/admin/settings/')) {
    return 'settings';
  }

  // Default fallback for any other admin path
  return 'dashboard';
}

/**
 * Returns the first permitted landing route for a staff user.
 */
export function getFirstPermittedRoute(user: CustomerUser | null | undefined): string {
  if (!user) return '/admin/login';
  if (isSuperAdmin(user)) return '/admin/dashboard';

  for (const perm of ADMIN_PERMISSIONS) {
    if (canAccessSection(user, perm.key)) {
      return perm.routePath;
    }
  }

  return '/admin/dashboard';
}
