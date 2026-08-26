'use client';

import dynamic from 'next/dynamic';

const Designer = dynamic(() => import('@/components/designer/Designer'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
      <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-semibold text-slate-300">Loading Artwork Studio...</p>
    </div>
  ),
});

export default function DesignEditorPage({
  params,
}: {
  params: { product: string };
}) {
  return <Designer productId={params.product} />;
}
