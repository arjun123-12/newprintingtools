import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
      <h2 className="text-4xl font-bold text-blue-500 mb-2">404</h2>
      <p className="text-lg text-slate-300 mb-6">Page Not Found</p>
      <Link
        href="/design"
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-600/25"
      >
        Open Artwork Studio
      </Link>
    </div>
  );
}
