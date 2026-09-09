'use client';

import React, { Suspense } from 'react';
import DesignEditorClient from './DesignEditorClient';

export default function DesignEditorPage({
  params,
}: {
  params: { product: string };
}) {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-gray-50">Loading Designer...</div>}>
      <DesignEditorClient product={params?.product} />
    </Suspense>
  );
}

