'use client';

import React, { Suspense } from 'react';
import DesignEditorClient from './[product]/DesignEditorClient';

export default function DesignPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-gray-50">Loading Designer...</div>}>
      <DesignEditorClient />
    </Suspense>
  );
}
