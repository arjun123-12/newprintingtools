'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

export interface ProductEnquirySpecs {
  size?: string;
  gsm?: string;
  paper_stock?: string;
  printing_sides?: string;
  finishing?: string;
  folding?: string;
  [key: string]: any;
}

export interface ProductEnquiryContext {
  productId?: string;
  productName?: string;
  quantity?: number;
  specifications?: ProductEnquirySpecs;
  sourceUrl?: string;
  designName?: string;
}

interface EnquiryContextType {
  isOpen: boolean;
  productContext: ProductEnquiryContext | null;
  openEnquiryModal: (context?: ProductEnquiryContext) => void;
  closeEnquiryModal: () => void;
  isAdmin: boolean;
  isAuthLoading: boolean;
  interceptShoppingAction: (e: React.MouseEvent, context?: ProductEnquiryContext) => boolean;
}

const EnquiryContext = createContext<EnquiryContextType | null>(null);

export function EnquiryProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [productContext, setProductContext] = useState<ProductEnquiryContext | null>(null);

  // Authenticated Admin check validated against the backend Sanctum user
  const isAdmin = useMemo(() => {
    return Boolean(user && user.role === 'admin' && user.is_admin === true);
  }, [user]);

  const openEnquiryModal = useCallback((context?: ProductEnquiryContext) => {
    if (context) {
      setProductContext((prev) => ({
        ...prev,
        ...context,
        sourceUrl: context.sourceUrl || (typeof window !== 'undefined' ? window.location.pathname : ''),
      }));
    }
    setIsOpen(true);
  }, []);

  const closeEnquiryModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * Helper to intercept an interactive shopping element:
   * - If user is verified admin: returns false (allows normal action)
   * - If public visitor: prevents default, opens enquiry modal with context, returns true (intercepted)
   */
  const interceptShoppingAction = useCallback(
    (e: React.MouseEvent, context?: ProductEnquiryContext): boolean => {
      if (isAdmin) {
        // Authenticated administrator continues normally
        return false;
      }

      // Public visitor: intercept action
      e.preventDefault();
      e.stopPropagation();
      openEnquiryModal(context);
      return true;
    },
    [isAdmin, openEnquiryModal]
  );

  return (
    <EnquiryContext.Provider
      value={{
        isOpen,
        productContext,
        openEnquiryModal,
        closeEnquiryModal,
        isAdmin,
        isAuthLoading,
        interceptShoppingAction,
      }}
    >
      {children}
    </EnquiryContext.Provider>
  );
}

export function useEnquiry() {
  const context = useContext(EnquiryContext);
  if (!context) {
    throw new Error('useEnquiry must be used within an EnquiryProvider');
  }
  return context;
}
