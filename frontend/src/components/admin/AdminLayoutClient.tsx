'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminAuthGuard from '@/components/admin/AdminAuthGuard';

interface AdminLayoutClientProps {
  children: ReactNode;
}

export default function AdminLayoutClient({
  children,
}: AdminLayoutClientProps) {
  const pathname = usePathname();
  const [isQrOrderView, setIsQrOrderView] = useState(false);

  useEffect(() => {
    const syncQrViewFromUrl = () => {
      setIsQrOrderView(
        /^\/admin\/orders\/[^/]+$/.test(window.location.pathname) &&
        new URLSearchParams(window.location.search).has('scan')
      );
    };
    const handleQrViewChange = (event: Event) => {
      setIsQrOrderView(Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active));
    };

    syncQrViewFromUrl();
    window.addEventListener('popstate', syncQrViewFromUrl);
    window.addEventListener('admin-qr-order-view-change', handleQrViewChange);
    return () => {
      window.removeEventListener('popstate', syncQrViewFromUrl);
      window.removeEventListener('admin-qr-order-view-change', handleQrViewChange);
    };
  }, [pathname]);

  // Do not show the admin sidebar on the login page.
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AdminAuthGuard>
      <div className={`${isQrOrderView ? 'min-h-screen w-full overflow-x-hidden bg-slate-950' : 'min-h-screen bg-slate-50'} font-sans text-slate-900`}>
        {!isQrOrderView && <AdminSidebar />}

        <div className={`flex min-w-0 flex-1 flex-col min-h-screen ${isQrOrderView ? 'w-full' : 'pl-60'}`}>
          {children}
        </div>
      </div>
    </AdminAuthGuard>
  );
}
