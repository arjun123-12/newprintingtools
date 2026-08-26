'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/customer/Header';
import Footer from '@/components/customer/Footer';

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = pathname.startsWith('/admin') || pathname.startsWith('/design');

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
    </div>
  );
}
