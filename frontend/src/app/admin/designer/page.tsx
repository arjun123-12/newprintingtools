'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const Designer = dynamic(() => import('@/components/designer/Designer'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-[600px] bg-slate-50 text-gray-700 gap-3">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-semibold text-gray-500">Loading Artwork Studio…</p>
    </div>
  ),
});

function AdminDesignerInner() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId') || undefined;
  const templateId = searchParams.get('templateId') || undefined;
  const artworkId = searchParams.get('artworkId') || undefined;
  const mode = searchParams.get('mode') || (templateId ? 'admin-template' : undefined);

  return (
    <div className="w-full h-full min-h-[85vh] flex flex-col">
      <Designer productId={productId} templateId={templateId} artworkId={artworkId} mode={mode} />
    </div>
  );
}

export default function AdminDesignerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[600px] bg-slate-50 text-gray-700 gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-gray-500">Loading Designer…</p>
        </div>
      }
    >
      <AdminDesignerInner />
    </Suspense>
  );
}
