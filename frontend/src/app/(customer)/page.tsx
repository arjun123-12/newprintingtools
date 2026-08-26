import Link from 'next/link';
import { Button } from '@/components/common/Button';

export default function CustomerHomePage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            🇦🇺 -Wide Fast Dispatch & Free Delivery Over $150
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
            High-Impact Custom Print for Modern n Brands
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
            From luxury business cards to large-format outdoor signage. Instant live pricing, preflight artwork verification, and online design tools.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href="/products">
              <Button size="lg" className="bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/25">
                Explore Print Products
              </Button>
            </Link>
            <Link href="/categories">
              <Button variant="outline" size="lg" className="border-slate-700 text-slate-200 hover:bg-slate-800">
                Browse Categories
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="ghost" size="lg" className="text-slate-400 hover:text-white">
                Admin Portal →
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
