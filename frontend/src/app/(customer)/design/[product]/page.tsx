'use client';

import { Suspense, use } from 'react';
import DesignEditorClient from './DesignEditorClient';

interface DesignEditorPageProps {
  params: Promise<{
    product: string;
  }>;
}

export default function DesignEditorPage({
  params,
}: DesignEditorPageProps) {
  const { product } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-gray-50">
          Loading Designer...
        </div>
      }
    >
      <DesignEditorClient product={product} />
    </Suspense>
  );
}