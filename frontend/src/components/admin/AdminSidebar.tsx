'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { removeAuthToken } from '@/utils/storageHelper';
import { canAccessSection, isSuperAdmin } from '@/utils/adminPermissions';
import { apiClient } from '@/services/api/client';

interface NavItem {
  label: string;
  href: string;
  permissionKey: string | 'super_admin';
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    permissionKey: 'dashboard',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Orders',
    href: '/admin/orders',
    permissionKey: 'orders',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: 'Customer Enquiries',
    href: '/admin/enquiries',
    permissionKey: 'enquiries',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    label: 'Quotes',
    href: '/admin/quotes',
    permissionKey: 'enquiries',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h8m-8 4h5m-8 5h14a2 2 0 002-2V6a2 2 0 00-2-2H7L3 8v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Products',
    href: '/admin/products',
    permissionKey: 'products',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
      </svg>
    ),
  },
  {
    label: 'Categories',
    href: '/admin/categories',
    permissionKey: 'categories',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    label: 'Templates',
    href: '/admin/templates',
    permissionKey: 'templates',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    label: 'Design Assets',
    href: '/admin/designer/assets',
    permissionKey: 'design_assets',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: 'Artwork Queue',
    href: '/admin/artwork',
    permissionKey: 'artwork',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Customers',
    href: '/admin/customers',
    permissionKey: 'customers',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Pricing Rules',
    href: '/admin/pricing',
    permissionKey: 'pricing',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Invoices',
    href: '/admin/invoices',
    permissionKey: 'invoices',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Shipping',
    href: '/admin/shipping',
    permissionKey: 'shipping',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    permissionKey: 'reports',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    permissionKey: 'settings',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  // Staff & Permissions - Strictly Super Admin only
  {
    label: 'Staff & Permissions',
    href: '/admin/staff',
    permissionKey: 'super_admin',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [enquiryNotificationCount, setEnquiryNotificationCount] = useState<number>(0);
  const latestEnquiryIdRef = useRef<number>(0);

  // Check and update enquiry notifications
  const fetchEnquiryNotificationCount = useCallback(async () => {
    // Only check if current admin has permission to access enquiries
    if (!user || (!isSuperAdmin(user) && !canAccessSection(user, 'enquiries'))) {
      return;
    }

    // If currently viewing Customer Enquiries, clear badge immediately
    if (pathname.startsWith('/admin/enquiries')) {
      setEnquiryNotificationCount(0);
      return;
    }

    try {
      const storedLastSeenId = typeof window !== 'undefined'
        ? localStorage.getItem('admin_last_seen_enquiry_id')
        : null;

      const params: Record<string, string> = {};
      if (storedLastSeenId) {
        params.after_id = storedLastSeenId;
      }

      const res = await apiClient.get('/admin/enquiries/notification-count', { params });
      if (res.data?.success) {
        const count = Number(res.data.count) || 0;
        setEnquiryNotificationCount(count);
        if (res.data.latest_id) {
          latestEnquiryIdRef.current = res.data.latest_id;
        }
      }
    } catch {
      // ignore network errors silently in background
    }
  }, [user, pathname]);

  // When admin navigates to /admin/enquiries or /admin/enquiries/[id], clear notification
  useEffect(() => {
    if (pathname.startsWith('/admin/enquiries')) {
      setEnquiryNotificationCount(0);
      if (typeof window !== 'undefined') {
        if (latestEnquiryIdRef.current > 0) {
          localStorage.setItem('admin_last_seen_enquiry_id', String(latestEnquiryIdRef.current));
        }
        localStorage.setItem('admin_last_seen_enquiry_time', new Date().toISOString());
      }
    }
  }, [pathname]);

  // Initial fetch and polling every 25 seconds
  useEffect(() => {
    fetchEnquiryNotificationCount();

    const interval = setInterval(fetchEnquiryNotificationCount, 25000);

    // Listen for custom 'enquiries_read' event when enquiry page or detail marks items as read
    const handleEnquiriesRead = (e: any) => {
      setEnquiryNotificationCount(0);
      if (e?.detail?.latest_id && typeof window !== 'undefined') {
        latestEnquiryIdRef.current = e.detail.latest_id;
        localStorage.setItem('admin_last_seen_enquiry_id', String(e.detail.latest_id));
      }
    };
    window.addEventListener('enquiries_read', handleEnquiriesRead);

    // Also refresh on window focus
    const handleFocus = () => {
      fetchEnquiryNotificationCount();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('enquiries_read', handleEnquiriesRead);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchEnquiryNotificationCount]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      removeAuthToken();
    }
    router.push('/admin/login');
  }

  // Filter navigation items strictly based on user permissions
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.permissionKey === 'super_admin') {
      return isSuperAdmin(user);
    }
    return canAccessSection(user, item.permissionKey);
  });

  const superAdmin = isSuperAdmin(user);

  return (
    <aside className="fixed top-0 left-0 bottom-0 z-30 w-60 h-screen bg-white border-r border-gray-200 flex flex-col shrink-0 font-sans select-none">
      {/* Brand Logo & Portal Tag */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <Link href="/admin/dashboard" className="flex items-center group">
          <Image
            src="/assets/images/erry_imprints_logo.png"
            alt="Erry Imprints"
            width={160}
            height={38}
            className="h-8.5 w-auto object-contain transition-opacity hover:opacity-90"
            priority
          />
        </Link>
      </div>

      {/* User Status Card */}
      {user && (
        <div className="px-3 py-2.5 mx-3 mt-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 uppercase shadow-2xs">
            {user.name?.charAt(0) || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
              {user.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {superAdmin ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Super Admin
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold bg-blue-100 text-blue-800 capitalize">
                  {user.role_preset?.replace('_', ' ') || 'Staff Member'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nav Items List */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 group
                ${isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/60 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              <span className={`transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.href === '/admin/enquiries' && enquiryNotificationCount > 0 ? (
                <span
                  className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-rose-500 text-white shadow-xs animate-pulse"
                  title={`${enquiryNotificationCount} new customer ${enquiryNotificationCount === 1 ? 'enquiry' : 'enquiries'}`}
                >
                  {enquiryNotificationCount > 99 ? '99+' : enquiryNotificationCount}
                </span>
              ) : item.permissionKey === 'super_admin' ? (
                <span className="ml-auto text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                  ADMIN
                </span>
              ) : isActive ? (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Footer Navigation */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-1">
        <Link
          href="/admin/change-password"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span>Security / Password</span>
        </Link>
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span>View Storefront</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 hover:text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
