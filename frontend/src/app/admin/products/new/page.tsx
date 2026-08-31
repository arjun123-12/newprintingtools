'use client';

import React from 'react';
import ProductForm from '@/components/admin/products/ProductForm';

export default function CreateProductPage() {
  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <ProductForm mode="create" />
    </div>
  );
}
