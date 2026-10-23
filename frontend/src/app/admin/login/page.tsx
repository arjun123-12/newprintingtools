
'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';
import { getAuthToken, setAuthToken, removeAuthToken } from '@/utils/storageHelper';

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    token_type: string;
    abilities: string[];
    user: {
      id: string | number;
      name: string;
      email: string;
      role: string;
      is_admin: boolean;
    };
  };
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('admin@printecommerce.com.au');
  const [password, setPassword] = useState('SecretAdmin2026!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated with a valid token, navigate directly to dashboard
  useEffect(() => {
    const existingToken = getAuthToken();
    if (existingToken) {
      router.replace('/admin/dashboard');
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post<LoginResponse>(
        API_ENDPOINTS.AUTH_LOGIN,
        {
          email: email.trim(),
          password,
        }
      );

      const token = response.data?.data?.token;
      const user = response.data?.data?.user;

      if (!token) {
        throw new Error('Authentication token was not returned.');
      }

      if (!user) {
        throw new Error('User information was not returned.');
      }

      // Only admin users can access the admin panel.
      if (user.role !== 'admin' && !user.is_admin) {
        removeAuthToken();

        setError(
          'Only administrator accounts can access the admin panel.'
        );

        return;
      }

      // Store authentication token across both localStorage and sessionStorage
      setAuthToken(token);

      // Force full page navigation to ensure AdminAuthGuard and layout initialize cleanly
      window.location.href = '/admin/dashboard';
    } catch (error: unknown) {
      // Remove any invalid/stale authentication token.
      removeAuthToken();

      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ??
          'Email/username or password is incorrect.'
        );

        return;
      }

      if (error instanceof Error) {
        setError(error.message);
        return;
      }

      setError('Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Image
              src="/assets/images/erry_imprints_logo_white.png"
              alt="Erry Imprints"
              width={200}
              height={48}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Admin Portal
          </h1>

          <p className="text-sm text-slate-400">
            Sign in to manage print operations
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Email or Username"
            type="text"
            placeholder="admin or admin@printecommerce.com.au"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            required
          />

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-sky-600 text-white hover:bg-sky-500 font-bold"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In to Dashboard'}
          </Button>

          <div className="pt-2">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-3 text-xs text-slate-300 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Quick-Fill Credentials:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin');
                    setPassword('password');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-left transition"
                >
                  <div className="text-[10px] text-slate-400">Username / Password</div>
                  <div className="text-xs font-bold text-amber-300">admin / password</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@admin.com');
                    setPassword('password');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-left transition"
                >
                  <div className="text-[10px] text-slate-400">Admin Email</div>
                  <div className="text-xs font-bold text-emerald-400">admin@admin.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@printecommerce.com.au');
                    setPassword('SecretAdmin2026!');
                  }}
                  className="col-span-2 px-2.5 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-left transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-[10px] text-slate-400">Super Admin</div>
                    <div className="text-xs font-bold text-sky-300">admin@printecommerce.com.au</div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">SecretAdmin2026!</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
