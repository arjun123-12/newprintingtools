'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ProductForm from '@/components/admin/products/ProductForm';

export default function EditProductClient({ id }: { id?: string }) {
  const hookParams = useParams<{ id: string }>();
  const resolvedId = id || hookParams?.id;

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <ProductForm mode="edit" productId={resolvedId} />
    </div>
  );
}
