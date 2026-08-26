'use client';

import { useState } from 'react';

const PRODUCTS = [
  { id: 1, name: 'Business Cards', category: 'Stationery', variants: 12, price: '$49–$149', status: 'active' },
  { id: 2, name: 'A4 Flyers', category: 'Flyers', variants: 8, price: '$35–$320', status: 'active' },
  { id: 3, name: 'A3 Posters', category: 'Posters', variants: 6, price: '$55–$480', status: 'active' },
  { id: 4, name: 'Pull-Up Banners', category: 'Signage', variants: 4, price: '$99–$260', status: 'active' },
  { id: 5, name: 'DL Brochures', category: 'Brochures', variants: 10, price: '$45–$380', status: 'active' },
  { id: 6, name: 'Letterheads', category: 'Stationery', variants: 5, price: '$38–$175', status: 'active' },
  { id: 7, name: 'Stickers', category: 'Stickers', variants: 14, price: '$25–$220', status: 'active' },
  { id: 8, name: 'Corflute Signs', category: 'Signage', variants: 3, price: '$65–$390', status: 'draft' },
];

export default function AdminProductsPage() {
  const [search, setSearch] = useState('');

  const filtered = PRODUCTS.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Product Catalog</h1>
          <p className="text-slate-400 text-sm mt-1">Manage print products, variants, and dynamic pricing.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search products…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
      />

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((product) => (
          <div key={product.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-colors group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-sky-600/10 border border-sky-500/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                product.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
              }`}>
                {product.status === 'active' ? 'Active' : 'Draft'}
              </span>
            </div>
            <h3 className="text-white font-semibold text-sm">{product.name}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{product.category}</p>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
              <div>
                <p className="text-xs text-slate-500">Price range</p>
                <p className="text-sm font-medium text-slate-300">{product.price}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Variants</p>
                <p className="text-sm font-medium text-slate-300">{product.variants}</p>
              </div>
              <button className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium opacity-0 group-hover:opacity-100">
                Edit →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
