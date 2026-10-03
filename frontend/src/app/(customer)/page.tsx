'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Menu,
  ArrowRight,
  Truck,
  Gem,
  Pencil,
  Package,
  UploadCloud,
  LayoutGrid,
  Sparkles,
  Scissors,
  ShieldCheck,
  Target,
  QrCode,
  Download,
  Layers,
  Type,
  Image as ImageIcon,
  Flame,
  Megaphone,
  Signpost,
  Tag,
  FileText,
  Shirt,
  PartyPopper,
  Box,
} from 'lucide-react';

export default function CustomerHomePage() {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('popular');

  const categories = [
    { id: 'popular', name: 'Popular', icon: Flame },
    { id: 'marketing', name: 'Marketing', icon: Megaphone },
    { id: 'signage', name: 'Signage', icon: Signpost },
    { id: 'stickers', name: 'Stickers', icon: Tag },
    { id: 'stationery', name: 'Business Stationery', icon: FileText },
    { id: 'apparel', name: 'Apparel', icon: Shirt },
    { id: 'events', name: 'Events', icon: PartyPopper },
    { id: 'packaging', name: 'Packaging', icon: Box },
  ];

  const popularProducts = [
    {
      id: 'business-cards',
      title: 'Business Cards',
      price: 'From $39.00',
      image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
      link: '/categories/business-cards',
      category: 'popular',
    },
    {
      id: 'flyers',
      title: 'Flyers',
      price: 'From $69.00',
      image: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=600&q=80',
      link: '/categories/flyers',
      category: 'popular',
    },
    {
      id: 'brochures',
      title: 'Brochures',
      price: 'From $99.00',
      image: 'https://images.unsplash.com/photo-1606836577743-f3f858d966ba?auto=format&fit=crop&w=600&q=80',
      link: '/products',
      category: 'popular',
    },
    {
      id: 'posters',
      title: 'Posters',
      price: 'From $49.00',
      image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
      link: '/products',
      category: 'popular',
    },
    {
      id: 'vinyl-banners',
      title: 'Vinyl Banners',
      price: 'From $89.00',
      image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80',
      link: '/categories/banners',
      category: 'popular',
    },
    {
      id: 'pull-up-banners',
      title: 'Pull Up Banners',
      price: 'From $199.00',
      image: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80',
      link: '/categories/banners',
      category: 'popular',
    },
    {
      id: 'a-frames',
      title: 'A-Frames',
      price: 'From $189.00',
      image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=600&q=80',
      link: '/categories/signage',
      category: 'popular',
    },
    {
      id: 'stickers-labels',
      title: 'Stickers & Labels',
      price: 'From $39.00',
      image: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=600&q=80',
      link: '/products',
      category: 'popular',
    },
  ];

  const industries = [
    {
      name: 'Restaurant & Cafe',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80',
      link: '/products',
    },
    {
      name: 'Real Estate',
      image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80',
      link: '/products',
    },
    {
      name: 'Construction & Trades',
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80',
      link: '/products',
    },
    {
      name: 'Beauty & Salon',
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80',
      link: '/products',
    },
    {
      name: 'Automotive',
      image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=400&q=80',
      link: '/products',
    },
    {
      name: 'Retail',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80',
      link: '/products',
    },
    {
      name: 'Events',
      image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&q=80',
      link: '/products',
    },
    {
      name: 'Corporate',
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
      link: '/products',
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white text-slate-900">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP CATEGORY SUBNAV BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 shadow-xs transition-colors"
            >
              <Menu className="w-4 h-4" />
              <span>All Products</span>
            </Link>
            <Link
              href="/categories/business-cards"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0"
            >
              Business Cards
            </Link>
            <Link
              href="/categories/flyers"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0"
            >
              Flyers
            </Link>
            <Link
              href="/products"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0"
            >
              Brochures
            </Link>
            <Link
              href="/categories/banners"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0"
            >
              Banners
            </Link>
            <Link
              href="/categories/signage"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0"
            >
              Signage
            </Link>
            <Link
              href="/products"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0"
            >
              Stickers
            </Link>
            <Link
              href="/products"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0"
            >
              Apparel
            </Link>
            <Link
              href="/design"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0"
            >
              Templates
            </Link>
            <Link
              href="/products"
              className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
            >
              Deals
            </Link>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-slate-50/60 via-white to-white py-12 lg:py-16 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-6 space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
                What would you
                <br />
                like to print?
              </h1>

              <p className="text-base sm:text-lg text-slate-600 font-medium">
                Professional printing. Easy online design. Fast turnaround.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all"
                >
                  <span>Shop Printing</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/design"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-xl border border-slate-300 shadow-xs hover:border-slate-400 transition-all"
                >
                  <span>Start Designing</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* 4 Value Props */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-slate-200/80">
                <div className="flex items-start gap-2.5">
                  <Truck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">Fast Turnaround</h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Get it when you need it</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Gem className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">Premium Quality</h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Professional finish</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Pencil className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">Design Online</h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Easy and powerful</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Package className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">Australia-Wide Delivery</h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Right to your door</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Hero Product Collage Mockup */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              <div className="relative w-full max-w-xl h-[360px] sm:h-[400px]">
                {/* 1. Pull Up Banner Standing on Right */}
                <div className="absolute right-0 top-0 w-36 sm:w-44 h-[350px] sm:h-[390px] bg-slate-900 rounded-xl shadow-2xl border-4 border-slate-800 overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-300 z-20 flex flex-col justify-between p-4 text-white">
                  <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-cyan-400 to-rose-500" />
                    <span className="text-[9px] font-bold tracking-widest uppercase">Erry Imprints</span>
                  </div>
                  <div className="my-auto space-y-2">
                    <h5 className="text-xl sm:text-2xl font-black leading-none tracking-tight">
                      GROW<br />YOUR<br />BUSINESS
                    </h5>
                    <p className="text-[9px] text-slate-400 tracking-wider">PRINT • DESIGN • DELIVER</p>
                  </div>
                  <div className="h-14 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-[10px] font-bold">
                    Stand Out Everywhere
                  </div>
                </div>

                {/* 2. Trifold Brochure in Center */}
                <div className="absolute right-28 sm:right-36 top-10 w-44 sm:w-56 h-[270px] sm:h-[300px] bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden transform -rotate-3 hover:rotate-0 transition-transform duration-300 z-10 p-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="w-full h-24 rounded-md overflow-hidden bg-slate-100 mb-2">
                      <img
                        src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80"
                        alt="Brochure Mockup"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Professional</span>
                    <h6 className="text-sm font-black text-slate-900 leading-tight">BUILD YOUR BRAND</h6>
                    <p className="text-[9px] text-slate-500 leading-tight">Multi-fold premium brochures with silk coating.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
                    <div className="h-6 bg-slate-100 rounded text-[8px] flex items-center justify-center font-bold text-slate-600">
                      150gsm Gloss
                    </div>
                    <div className="h-6 bg-blue-50 rounded text-[8px] flex items-center justify-center font-bold text-blue-600">
                      Fast Dispatch
                    </div>
                  </div>
                </div>

                {/* 3. Stack of Business Cards on Left */}
                <div className="absolute left-2 sm:left-6 bottom-4 w-44 sm:w-52 h-28 sm:h-32 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 transform rotate-3 hover:rotate-0 transition-transform duration-300 z-30 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" />
                      <span className="text-[10px] font-black tracking-tight text-slate-900">ERRY IMPRINTS</span>
                    </div>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">450gsm</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900">Luxury Business Cards</p>
                    <p className="text-[9px] text-slate-400">Matte / Velvet / Spot UV</p>
                  </div>
                  <div className="w-full h-1.5 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full" />
                </div>

                {/* 4. Angled Marketing Flyer in Front */}
                <div className="absolute right-12 sm:right-20 -bottom-2 w-40 sm:w-48 h-32 sm:h-36 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl shadow-xl p-3 transform -rotate-6 hover:rotate-0 transition-transform duration-300 z-30 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[8px] text-indigo-300 font-bold uppercase tracking-wider">
                    <span>Flyer Print</span>
                    <span>A5 / A6</span>
                  </div>
                  <p className="text-sm font-black leading-tight tracking-tight">
                    MAKE IT<br />HAPPEN
                  </p>
                  <p className="text-[8px] text-slate-300">Vibrant full-colour double-sided flyers.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. POPULAR PRODUCTS SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Popular Products
            </h2>
            <Link
              href="/products"
              className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
            >
              <span>View All Products</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* 8 Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {popularProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all group flex flex-col"
              >
                {/* Product Image Frame */}
                <Link href={product.link} className="relative h-44 sm:h-48 w-full bg-slate-100 overflow-hidden block">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </Link>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <Link href={product.link} className="block">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                        {product.title}
                      </h3>
                    </Link>
                    <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-1">
                      {product.price}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={product.link}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group/btn"
                    >
                      <span>Order Now</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter Pills Underneath */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-8">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. "3 EASY WAYS TO ORDER" SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-3xl p-6 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                3 Easy Ways to Order
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Get your printing products in just a few clicks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Way 1: Upload Your Artwork */}
              <Link
                href="/products"
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all flex items-center justify-between group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white font-black text-base flex items-center justify-center shrink-0 shadow-sm">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Upload Your Artwork
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Already have a design? Upload and order.
                    </p>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                  <UploadCloud className="w-6 h-6" />
                </div>
              </Link>

              {/* Way 2: Design Online */}
              <Link
                href="/design"
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-sm">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-blue-700 transition-colors">
                      Design Online
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Create it yourself using our easy design studio.
                    </p>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                  <Pencil className="w-5 h-5" />
                </div>
              </Link>

              {/* Way 3: Choose a Template */}
              <Link
                href="/design"
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-rose-200 transition-all flex items-center justify-between group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-rose-500 text-white font-black text-base flex items-center justify-center shrink-0 shadow-sm">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-rose-700 transition-colors">
                      Choose a Template
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Select a professional design and customise it.
                    </p>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                  <LayoutGrid className="w-6 h-6" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. "DON'T HAVE ARTWORK? NO PROBLEM." SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 lg:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Content */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-2">
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  Don&apos;t have artwork? No problem.
                </h2>
                <p className="text-base text-slate-600 font-medium">
                  Create professional print-ready designs online.
                </p>
              </div>

              <div>
                <Link
                  href="/design"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all"
                >
                  <span>Start Designing</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* 5 Feature Icons Row */}
              <div className="grid grid-cols-5 gap-3 pt-4">
                <div className="text-center space-y-1.5">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shadow-xs">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 block leading-tight">Templates</span>
                </div>

                <div className="text-center space-y-1.5">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 block leading-tight">AI Design</span>
                </div>

                <div className="text-center space-y-1.5">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 block leading-tight">Background Removal</span>
                </div>

                <div className="text-center space-y-1.5">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 block leading-tight">Artwork Check</span>
                </div>

                <div className="text-center space-y-1.5">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shadow-xs">
                    <Target className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 block leading-tight">Logo Vectorisation</span>
                </div>
              </div>
            </div>

            {/* Right Designer App Frame Mockup */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border-8 border-slate-900 bg-slate-900 shadow-2xl overflow-hidden">
                {/* Designer App Window Bar */}
                <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs text-white">
                  <div className="flex items-center gap-2">
                    <Menu className="w-4 h-4 text-slate-400" />
                    <span className="font-black text-xs tracking-wider">ERRY IMPRINTS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md text-[11px] font-bold flex items-center gap-1.5 text-white">
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* Designer Workspace Body */}
                <div className="bg-slate-100 grid grid-cols-12 min-h-[320px]">
                  {/* Left Designer Tools */}
                  <div className="col-span-1 bg-white border-r border-slate-200 py-3 flex flex-col items-center gap-4 text-slate-600">
                    <LayoutGrid className="w-4 h-4 text-blue-600" />
                    <Type className="w-4 h-4" />
                    <ImageIcon className="w-4 h-4" />
                    <UploadCloud className="w-4 h-4" />
                    <Layers className="w-4 h-4" />
                  </div>

                  {/* Canvas Area */}
                  <div className="col-span-8 p-6 flex items-center justify-center bg-slate-100/80">
                    <div className="w-full max-w-sm h-48 bg-white rounded-lg shadow-lg border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between">
                      {/* Geometric Brand Color Accent */}
                      <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-bl from-blue-600 via-indigo-600 to-cyan-400 transform skew-x-12 translate-x-10" />

                      <div className="relative z-10 space-y-0.5">
                        <h4 className="text-base font-black text-slate-900">Your Name</h4>
                        <p className="text-xs text-slate-500 font-semibold">Director</p>
                      </div>

                      <div className="relative z-10 space-y-1 text-[10px] text-slate-600 font-medium">
                        <p>☎ 0412 345 678</p>
                        <p>✉ youremail@company.com</p>
                        <p>🌐 www.yourwebsite.com</p>
                      </div>

                      <div className="absolute right-3 bottom-3 z-10 bg-white p-1.5 rounded-md shadow-xs border border-slate-100">
                        <QrCode className="w-7 h-7 text-slate-900" />
                      </div>
                    </div>
                  </div>

                  {/* Right Templates Column */}
                  <div className="col-span-3 bg-white border-l border-slate-200 p-3 space-y-2 hidden sm:block">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Templates</span>
                    <div className="h-16 rounded bg-slate-100 border border-slate-200 overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=200&q=80"
                        alt="Template 1"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="h-16 rounded bg-slate-100 border border-slate-200 overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=200&q=80"
                        alt="Template 2"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. "PRINTING FOR YOUR INDUSTRY" SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 bg-slate-50/60 border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Printing for Your Industry
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Tailored printing products for every business.
              </p>
            </div>
            <Link
              href="/products"
              className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group shrink-0"
            >
              <span>View All Industries</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* 8 Industry Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
            {industries.map((ind) => (
              <Link
                key={ind.name}
                href={ind.link}
                className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md hover:border-blue-300 transition-all group flex flex-col text-center"
              >
                <div className="h-24 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={ind.image}
                    alt={ind.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-2.5">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight block">
                    {ind.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
