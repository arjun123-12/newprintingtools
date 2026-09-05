import React from 'react';
import DesignEditorClient from './DesignEditorClient';

export function generateStaticParams() {
  return [{ product: 'default' }];
}

export const dynamicParams = true;

export default function DesignEditorPage({
  params,
}: {
  params: { product: string };
}) {
  return (
    <React.Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-gray-50">Loading Designer...</div>}>
      <DesignEditorClient product={params?.product} />
    </React.Suspense>
  );
}
