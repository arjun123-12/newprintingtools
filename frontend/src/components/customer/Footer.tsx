'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Layers,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Truck,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';

export default function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith('/design')) {
    return null;
  }

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 text-sm mt-auto">
      {/* Top Value Propositions */}
      <div className="border-b border-slate-800 bg-slate-950/60 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">-Wide Delivery</h4>
              <p className="text-xs text-slate-400">Fast courier dispatch to Sydney, Melb, Bris & beyond.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">100% Quality Guarantee</h4>
              <p className="text-xs text-slate-400">Prepress proofing check on every single print file.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Live Instant Pricing</h4>
              <p className="text-xs text-slate-400">Wholesale trade quantity breaks calculated in AUD.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">n Tax Invoices</h4>
              <p className="text-xs text-slate-400">10% GST itemized breakdowns and instant ABN invoicing.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        {/* Brand Col */}
        <div className="lg:col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Print<span className="text-sky-500">Store</span>
            </span>
          </Link>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
            Commercial and trade custom printing services delivering high-grade business stationery, marketing collateral, outdoor banners, packaging, and promo merch across .
          </p>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-sky-400" />
              <span>1300 000 000 (Mon-Fri 8:30am - 5:30pm AEST)</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-sky-400" />
              <span>orders@printstore.com.au</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-400" />
              <span>Production Hubs: Sydney NSW & Melbourne VIC</span>
            </div>
          </div>
        </div>

        {/* Popular Products */}
        <div>
          <h5 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Popular Products</h5>
          <ul className="space-y-2 text-xs">
            <li><Link href="/products" className="hover:text-sky-400 transition-colors">Premium Business Cards</Link></li>
            <li><Link href="/products" className="hover:text-sky-400 transition-colors">Gloss & Matt Flyers</Link></li>
            <li><Link href="/products" className="hover:text-sky-400 transition-colors">Pull-Up Banners</Link></li>
            <li><Link href="/products" className="hover:text-sky-400 transition-colors">Corflute Signs</Link></li>
            <li><Link href="/products" className="hover:text-sky-400 transition-colors">Custom Vinyl Stickers</Link></li>
            <li><Link href="/products" className="hover:text-sky-400 transition-colors">Folded Menus & Booklets</Link></li>
          </ul>
        </div>

        {/* Customer Tools */}
        <div>
          <h5 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Customer Tools</h5>
          <ul className="space-y-2 text-xs">
            <li><Link href="/design" className="hover:text-sky-400 transition-colors">Online Canvas Designer</Link></li>
            <li><Link href="/cart" className="hover:text-sky-400 transition-colors">Artwork Upload & Check</Link></li>
            <li><Link href="/orders" className="hover:text-sky-400 transition-colors">Track Order Production</Link></li>
            <li><Link href="/account" className="hover:text-sky-400 transition-colors">Trade Accounts & ABN</Link></li>
            <li><Link href="/categories" className="hover:text-sky-400 transition-colors">Print Specifications & Bleed</Link></li>
          </ul>
        </div>

        {/* Admin & Operations */}
        <div>
          <h5 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Operations</h5>
          <ul className="space-y-2 text-xs">
            <li><Link href="/admin/login" className="hover:text-sky-400 transition-colors">Admin Portal Login</Link></li>
            <li><Link href="/admin/dashboard" className="hover:text-sky-400 transition-colors">Operations Dashboard</Link></li>
            <li><Link href="/admin/artwork" className="hover:text-sky-400 transition-colors">Preflight Queue</Link></li>
            <li><Link href="/admin/orders" className="hover:text-sky-400 transition-colors">Production Pipelines</Link></li>
            <li><Link href="/admin/settings" className="hover:text-sky-400 transition-colors">Platform Settings</Link></li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-800/80 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} PrintStore  Pty Ltd. ABN 00 000 000 000. All prices in AUD include 10% GST.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms of Service</Link>
            <span>•</span>
            <Link href="/shipping-policy" className="hover:text-slate-400 transition-colors">AU Shipping Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
