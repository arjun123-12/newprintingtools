'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useEnquiry } from '@/context/EnquiryContext';

interface CustomerEnquiryInterceptorProps {
  children: React.ReactNode;
}

export const CustomerEnquiryInterceptor: React.FC<CustomerEnquiryInterceptorProps> = ({ children }) => {
  const { isAdmin, isAuthLoading, openEnquiryModal } = useEnquiry();
  const pathname = usePathname();

  useEffect(() => {
    // If auth state is still resolving, do not attach or intercept yet
    if (isAuthLoading) return;

    // Authenticated administrators have full access and are never intercepted
    if (isAdmin) return;

    // Do not intercept within admin portal routes
    if (pathname?.startsWith('/admin') || pathname?.startsWith('/client-brief-admin')) {
      return;
    }

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // 1. Never intercept within dialogs or the enquiry modal itself
      if (
        target.closest('[role="dialog"]') ||
        target.closest('#enquiry-modal-root') ||
        target.closest('.enquiry-modal-container')
      ) {
        return;
      }

      // 2. Never intercept the floating enquiry trigger or explicit modal buttons
      if (
        target.closest('[aria-label="Request a custom printing quote"]') ||
        target.closest('[aria-label="Close"]') ||
        target.closest('button[data-enquiry-trigger]')
      ) {
        return;
      }

      // 3. Find closest clickable anchor or button
      const link = target.closest('a');
      const button = target.closest('button');
      const clickable = link || button;

      if (!clickable) return;

      const href = link?.getAttribute('href') || '';

      // Allow informational and essential navigation:
      // Home, about, contact, terms, privacy, auth login/register, admin login, tel, mailto
      const isInformationalHref =
        href === '/' ||
        href.startsWith('/#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('/about') ||
        href.startsWith('/terms') ||
        href.startsWith('/privacy') ||
        href.startsWith('/login') ||
        href.startsWith('/register') ||
        href.startsWith('/account') ||
        href.startsWith('/admin') ||
        href.startsWith('/client-brief');

      // Check if this target is an interactive shopping link or element
      const isShoppingHref =
        href.startsWith('/products') ||
        href.startsWith('/categories') ||
        href.startsWith('/design') ||
        href.startsWith('/cart') ||
        href.startsWith('/checkout');

      const text = (clickable.textContent || '').trim().toLowerCase();
      const isShoppingButton =
        text.includes('order now') ||
        text.includes('add to cart') ||
        text.includes('buy now') ||
        text.includes('proceed to checkout') ||
        text.includes('start designing') ||
        text.includes('shop printing') ||
        text.includes('customize') ||
        text.includes('blank canvas') ||
        clickable.classList.contains('shopping-action-btn');

      // Check if clicking inside a product card
      const productCard =
        target.closest('[data-product-card]') ||
        target.closest('.group');

      const cardTitleEl =
        productCard?.querySelector('h3') ||
        productCard?.querySelector('h2') ||
        productCard?.querySelector('h4');

      const cardTitle = cardTitleEl?.textContent?.trim();

      if (isShoppingButton || (isShoppingHref && !isInformationalHref)) {
        event.preventDefault();
        event.stopPropagation();

        let inferredName = cardTitle || '';
        if (!inferredName && link) {
          inferredName = link.textContent?.trim() || '';
        }

        openEnquiryModal({
          productName: inferredName && inferredName !== 'Shop Printing' && inferredName !== 'Start Designing' && inferredName !== 'Order Now' ? inferredName : undefined,
          sourceUrl: typeof window !== 'undefined' ? window.location.pathname : '',
        });
      }
    };

    // Use capturing phase so we intercept before child routers trigger navigation
    document.addEventListener('click', handleGlobalClick, true);

    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [isAdmin, isAuthLoading, pathname, openEnquiryModal]);

  return <>{children}</>;
};
