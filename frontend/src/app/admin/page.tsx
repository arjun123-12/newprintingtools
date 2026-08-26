import Link from 'next/link';
import { Button } from '@/components/common/Button';

export default function AdminRootPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin Operations</h1>
        <p className="text-sm text-slate-400">Access commercial print operations, catalog, and production pipelines.</p>
        <div className="flex flex-col gap-3">
          <Link href="/admin/login">
            <Button className="w-full bg-sky-600 hover:bg-sky-500 text-white">
              Sign In to Admin Portal
            </Button>
          </Link>
          <Link href="/admin/dashboard">
            <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
              Go to Dashboard
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="w-full text-slate-400 hover:text-slate-200">
              ← Return to Customer Store
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
