'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingCart,
  User,
  Search,
  Menu,
  X,
  Phone,
  Mail,
  Truck,
  Sparkles,
  ChevronDown,
  Layers,
  FileCheck,
  ShieldCheck,
  Palette,
} from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  const cartItems = useCartStore((state) => state.items);
  const totalCartCount = cartItems.length;

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (pathname?.startsWith('/design')) {
    return null;
  }

  const navCategories = [
    { name: 'All Products', href: '/products' },
    { name: 'Business Cards', href: '/categories/business-cards' },
    { name: 'Flyers & Brochures', href: '/categories/flyers' },
    { name: 'Banners & Signs', href: '/categories/banners' },
    { name: 'Signage & Displays', href: '/categories/signage' },
    { name: 'Online Designer', href: '/design', highlight: true },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white transition-shadow duration-200">
      {/* Top Announcement & Quick Contact Bar */}
      <div className="bg-slate-900 text-slate-200 text-xs border-b border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
              <Truck className="w-3.5 h-3.5" />
              <span>Free Delivery on AU Orders over $150</span>
            </span>
            <span className="hidden md:inline-block text-slate-500">|</span>
            <span className="hidden md:inline-flex items-center gap-1 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Quality & Reprint Guarantee</span>
            </span>
          </div>

          <div className="flex items-center gap-5 text-slate-300">
            <a
              href="tel:1300000000"
              className="flex items-center gap-1 hover:text-sky-400 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">1300 000 000</span>
            </a>
            <a
              href="mailto:orders@printstore.com.au"
              className="hidden lg:flex items-center gap-1 hover:text-sky-400 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>orders@printstore.com.au</span>
            </a>
            <Link
              href="/admin"
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className={`border-b border-slate-200 transition-all ${isScrolled ? 'shadow-md bg-white/95 backdrop-blur-md' : 'bg-white'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between gap-4 md:gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                  Print<span className="text-sky-600">Store</span>
                </span>
                <span className="text-[10px] tracking-widest uppercase font-semibold text-slate-400">

                </span>
              </div>
            </Link>

            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
                  }
                }}
                className="relative w-full"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search business cards, flyers, banners, stickers..."
                  className="w-full pl-11 pr-24 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-inner"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Online Designer CTA (Hidden on small mobile) */}
              <Link
                href="/design"
                className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors"
              >
                <Palette className="w-3.5 h-3.5 text-sky-600" />
                <span>Design Studio</span>
              </Link>

              {/* Account Link */}
              <Link
                href="/account"
                className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 text-slate-700 hover:text-sky-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <User className="w-4 h-4" />
                </div>
                <div className="hidden xl:flex flex-col text-left">
                  <span className="text-[11px] text-slate-400 leading-none">Account</span>
                  <span className="text-xs font-semibold text-slate-800 leading-tight">Sign In / Profile</span>
                </div>
              </Link>

              {/* Cart Button */}
              <Link
                href="/cart"
                className="relative flex items-center gap-2 p-2 sm:px-3 sm:py-2 text-slate-700 hover:text-sky-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <div className="relative w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-600">
                  <ShoppingCart className="w-4 h-4" />
                  {mounted && totalCartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                      {totalCartCount > 99 ? '99+' : totalCartCount}
                    </span>
                  )}
                </div>
                <div className="hidden xl:flex flex-col text-left">
                  <span className="text-[11px] text-slate-400 leading-none">Your Cart</span>
                  <span className="text-xs font-semibold text-slate-800 leading-tight">
                    {mounted ? `${totalCartCount} ${totalCartCount === 1 ? 'item' : 'items'}` : 'Cart'}
                  </span>
                </div>
              </Link>

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl md:hidden transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Navigation Bar (Desktop) */}
        <nav className="hidden md:block bg-slate-900 text-slate-100 border-t border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                {navCategories.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 ${item.highlight
                          ? 'text-amber-400 hover:text-amber-300'
                          : isActive
                            ? 'text-sky-400 bg-slate-800'
                            : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
                        }`}
                    >
                      {item.highlight && <Sparkles className="w-3.5 h-3.5" />}
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 text-xs">
                <Link
                  href="/categories"
                  className="text-slate-300 hover:text-white flex items-center gap-1 font-medium"
                >
                  <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Free Artwork Proofing</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[115px] z-40 bg-black/50 backdrop-blur-sm md:hidden animate-fade-in">
          <div className="bg-white border-b border-slate-200 shadow-2xl p-4 max-h-[85vh] overflow-y-auto space-y-4">
            {/* Mobile Search */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
                  setMobileMenuOpen(false);
                }
              }}
              className="relative"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </form>

            {/* Mobile Nav Links */}
            <div className="divide-y divide-slate-100">
              <div className="py-2 space-y-1">
                <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Products & Categories
                </p>
                {navCategories.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {item.highlight && <Sparkles className="w-4 h-4 text-amber-500" />}
                      {item.name}
                    </span>
                    <ChevronDown className="w-4 h-4 -rotate-90 text-slate-400" />
                  </Link>
                ))}
              </div>

              {/* Customer Account & Support */}
              <div className="py-2 space-y-1">
                <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Access
                </p>
                <Link
                  href="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileCheck className="w-4 h-4 text-slate-400" />
                  <span>My Orders & Re-orders</span>
                </Link>
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Account Settings</span>
                </Link>
              </div>

              {/* Phone & Contact Help */}
              <div className="pt-3 pb-1 text-xs text-slate-500 space-y-2 px-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-sky-600" />
                  <span>Call Us: <strong>1300 000 000</strong> (Mon-Fri 8am-6pm AEST)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-sky-600" />
                  <span>orders@printstore.com.au</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}