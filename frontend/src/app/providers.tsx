'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { EnquiryProvider } from '@/context/EnquiryContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  React.useEffect(() => {
    const handleWheel = () => {
      const active = document.activeElement;
      if (active && (active as HTMLInputElement).type === 'number') {
        (active as HTMLElement).blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EnquiryProvider>
          {children}
        </EnquiryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
