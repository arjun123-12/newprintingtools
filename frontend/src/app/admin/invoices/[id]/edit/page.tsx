'use client';

import React, { use } from 'react';
import { InvoiceEditor } from '@/components/admin/invoices/InvoiceEditor';

interface EditInvoicePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = use(params);

  return <InvoiceEditor invoiceId={id} />;
}
