'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/customer/Header';
import Footer from '@/components/customer/Footer';
import { EnquiryModal } from '@/components/enquiry/EnquiryModal';
import { EnquiryFloatingTrigger } from '@/components/enquiry/EnquiryFloatingTrigger';
import { CustomerEnquiryInterceptor } from '@/components/enquiry/CustomerEnquiryInterceptor';

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/client-brief-admin');
  const isStandalone = pathname.startsWith('/admin') || pathname.startsWith('/design');

  if (isStandalone) {
    return (
      <CustomerEnquiryInterceptor>
        {children}
        {!isAdminPath && <EnquiryModal />}
      </CustomerEnquiryInterceptor>
    );
  }

  return (
    <CustomerEnquiryInterceptor>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
        <EnquiryModal />
        <EnquiryFloatingTrigger />
      </div>
    </CustomerEnquiryInterceptor>
  );
}
