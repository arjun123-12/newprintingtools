'use client';

import type { ReactNode } from 'react';
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

  // Do not show the admin sidebar on the login page.
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <AdminSidebar />

        <div className="flex min-w-0 flex-1 flex-col pl-60 min-h-screen">
          {children}
        </div>
      </div>
    </AdminAuthGuard>
  );
}