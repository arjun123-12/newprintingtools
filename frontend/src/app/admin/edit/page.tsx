'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductForm from '@/components/admin/products/ProductForm';

function AdminEditInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || undefined;

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <ProductForm mode="edit" productId={id} />
    </div>
  );
}

export default function AdminEditPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-gray-500">Loading form…</div>
      }
    >
      <AdminEditInner />
    </Suspense>
  );
}
