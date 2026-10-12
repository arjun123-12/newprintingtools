import type { ReactNode } from 'react';
import AdminLayoutClient from '@/components/admin/AdminLayoutClient';

export const metadata = {
  title: 'Admin Panel | Erry Imprints',
  description: 'Manage print operations, orders, products, and customers.',
};

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return (
    <AdminLayoutClient>
      {children}
    </AdminLayoutClient>
  );
}