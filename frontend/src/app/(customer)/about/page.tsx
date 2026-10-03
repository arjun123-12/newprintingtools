import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  Sparkles,
  Award,
  Layers,
  Printer,
  Truck,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Store,
  ShoppingCart,
  Send,
  ShieldCheck,
  Eye,
  Building,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Erry Imprints | Quality Print Specialists for Over 8 Years',
  description:
    'Unleashing Imagination: Where Pixels Become Print and Ideas Bloom into Reality. Learn about Erry Imprints, our 8+ years of commercial print expertise, and our seamless 4-step work process.',
};

export default function AboutPage() {
  const processSteps = [
    {
      number: '01',
      title: 'Connect your store',
      description:
        'with the Erry Imprints system. This allows for seamless syncing of your products and ensures that incoming orders for processing.',
      icon: Store,
      badge: 'Integration',
    },
    {
      number: '02',
      title: 'Customer places order',
      description:
        'Because your store is connected, the order details and shipping information are instantly captured and sent to the fulfillment team.',
      icon: ShoppingCart,
      badge: 'Instant Capture',
    },
    {
      number: '03',
      title: 'Print fulfills the order',
      description:
        'Erry Imprints handles the heavy lifting. This stage includes picking the raw inventory, high-quality printing of your designs.',
      icon: Printer,
      badge: 'Production',
    },
    {
      number: '04',
      title: 'Execution & Delivery',
      description:
        'Erry Imprints manages the logistics and shipping, providing tracking information so both you and your customer can monitor the package.',
      icon: Send,
      badge: 'Dispatch',
    },
  ];

  const highlights = [
    'Durable, weather-resistant, and vibrant solutions for any event or promotion.',
    'Precision-crafted visual communication for businesses, retail spaces, and exhibitions.',
    'A vast array of stocks for banners, vinyls, and rigid sign boards.',
    'Tailored programs designed to meet your company’s unique branding and architectural needs.',
    'State-of-the-art printing that captures every detail in large-scale displays.',
  ];

  const portfolioItems = [
    {
      title: 'Towering Outdoor Vinyl Banners',
      category: 'Large-Format Displays',
      image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'Architectural & Retail Signage',
      category: 'Commercial Spaces',
      image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'Premium Corporate Stationery',
      category: 'Brand Identity',
      image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'Vibrant Marketing Collateral',
      category: 'Promotional Print',
      image: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'High-Impact Retractable Displays',
      category: 'Exhibitions & Events',
      image: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'Multi-Fold Brochures & Catalogues',
      category: 'Offset Print',
      image: 'https://images.unsplash.com/photo-1606836577743-f3f858d966ba?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <div className="bg-white min-h-screen text-slate-800">
      {/* ─────────────────────────────────────────────────────────────
          1. BREADCRUMBS
      ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-900 font-bold">About Us</span>
          </nav>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-white py-20 lg:py-24">
        {/* Glow background effects */}
        <div className="absolute left-1/4 top-0 -translate-y-12 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-10 bottom-0 translate-y-12 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-400/30 text-blue-300 text-xs font-black uppercase tracking-wider">
              <Award className="w-4 h-4 text-blue-400" />
              <span>We are just better • Quality For Over 8 years</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
              About Erry Imprints
            </h1>

            <p className="text-xl sm:text-2xl text-blue-200 font-semibold leading-snug">
              Unleashing Imagination: Where Pixels Become Print and Ideas Bloom into Reality.
            </p>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed pt-2">
              Step into a realm where your brand takes center stage on every surface. At Erry Imprints, we don&apos;t
              just print; we transform concepts into tangible experiences that ignite emotions and stir imaginations.
              We are your premier large-format print specialists, wielding the transformative power of digital, offset,
              and wide-format printing to translate your dreams into stunning, multi-dimensional realities. From
              towering outdoor signages to vibrant indoor posters, our mission is to ensure your message is seen, felt,
              and remembered.
            </p>

            {/* CTA Buttons */}
            <div className="pt-4 flex flex-wrap items-center gap-4">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all"
              >
                <span>Our Products</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl border border-white/20 backdrop-blur-md transition-all"
              >
                <span>Contact Us</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. METRICS / STATS SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-b border-slate-200/80 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Stat 1 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Printer className="w-8 h-8" />
              </div>
              <div>
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight block">65K+</span>
                <span className="text-sm font-bold text-slate-600 mt-1 block">Banners Printing</span>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Layers className="w-8 h-8" />
              </div>
              <div>
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight block">52K+</span>
                <span className="text-sm font-bold text-slate-600 mt-1 block">Signages & Posters</span>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight block">8+ Years</span>
                <span className="text-sm font-bold text-slate-600 mt-1 block">Quality Manufacturing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. WHY ERRY IMPRINTS / CAPABILITIES
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Highlights List */}
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-blue-600">
                  Precision & Excellence
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  Crafting Visual Impact Across Australia
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  We blend industrial grade print machinery with rigorous prepress verification to produce prints that
                  withstand the elements and capture every subtle tone.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                {highlights.map((item, index) => (
                  <div key={index} className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">{item}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700"
                >
                  <span>Explore all product categories</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Visual Image */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80"
                  alt="Erry Imprints Wide Format Printing"
                  className="w-full h-[440px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex flex-col justify-end p-8 text-white">
                  <span className="px-3 py-1 rounded-full bg-blue-600/90 text-white text-[11px] font-bold w-fit mb-2">
                    Large Format Print Specialists
                  </span>
                  <h3 className="text-xl font-bold">State-of-the-Art Production Facility</h3>
                  <p className="text-xs text-slate-300 mt-1">High-definition offset, digital, and wide-format roll-to-roll printers.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. OUR WORK PROCESS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-20 bg-slate-50 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-blue-600">
              Seamless Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Our Work Process
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              From store integration to doorstep delivery, our automated workflow ensures swift, precision manufacturing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {processSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-black text-slate-200 group-hover:text-blue-600 transition-colors">
                        {step.number}
                      </span>
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Icon className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {step.badge}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                        {step.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed pt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                    <span>Stage {step.number} Complete</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. AMAZING PORTFOLIO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-600">
                Visual Showcase
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
                Amazing Portfolio
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                A showcase of commercial signage, architectural displays, and high-impact print collateral.
              </p>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 shrink-0"
            >
              <span>Explore All Products</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolioItems.map((item, idx) => (
              <div
                key={idx}
                className="group relative rounded-3xl overflow-hidden border border-slate-200/90 shadow-xs hover:shadow-xl transition-all h-72 flex flex-col justify-end p-6 bg-slate-900"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <div className="relative z-10 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                    {item.category}
                  </span>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {item.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. BOTTOM CTA
      ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
            Ready to Transform Your Ideas into Print?
          </h2>
          <p className="text-blue-100 text-sm sm:text-base max-w-xl mx-auto">
            Experience the Erry Imprints standard: 8+ years of expertise, 65K+ banners printed, and industry-leading turnaround.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/products"
              className="px-8 py-3.5 bg-white text-blue-700 hover:bg-slate-100 font-bold text-sm rounded-xl shadow-lg transition-all"
            >
              Shop All Products
            </Link>
            <Link
              href="/design"
              className="px-8 py-3.5 bg-blue-800/80 hover:bg-blue-800 text-white font-bold text-sm rounded-xl border border-blue-400/30 transition-all"
            >
              Start Designing Online
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
