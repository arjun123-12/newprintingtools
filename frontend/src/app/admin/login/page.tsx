
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';

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
      if (user.role !== 'admin' || user.is_admin !== true) {
        sessionStorage.removeItem('auth_token');

        setError(
          'Only administrator accounts can access the admin panel.'
        );

        return;
      }

      // Store authentication token only for the current browser tab/session.
      sessionStorage.setItem('auth_token', token);

      router.replace('/admin/dashboard');
      router.refresh();
    } catch (error: unknown) {
      // Remove any invalid/stale authentication token.
      sessionStorage.removeItem('auth_token');

      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ??
          'Email or password is incorrect.'
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
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Admin Portal
          </h1>

          <p className="text-sm text-slate-400">
            Sign in to manage print operations
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Email Address"
            type="email"
            placeholder="admin@printecommerce.com.au"
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
            className="w-full bg-sky-600 text-white hover:bg-sky-500"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In to Dashboard'}
          </Button>

          <div className="pt-2">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-3 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Admin Credentials</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@printecommerce.com.au');
                    setPassword('SecretAdmin2026!');
                  }}
                  className="text-[11px] font-medium text-sky-400 hover:text-sky-300 underline underline-offset-2 transition"
                >
                  Quick Fill
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-400 space-y-0.5">
                <div>Email: <span className="text-slate-200">admin@printecommerce.com.au</span></div>
                <div>Password: <span className="text-slate-200">SecretAdmin2026!</span></div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
