'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';

export interface CustomerUser {
  id: string | number;
  name: string;
  email: string;
  phone?: string | null;
  company_name?: string | null;
  abn?: string | null;
  role: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: CustomerUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<CustomerUser>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone?: string;
    company_name?: string;
  }) => Promise<CustomerUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async (authToken: string): Promise<CustomerUser | null> => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.AUTH_ME, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.data?.success && response.data?.data) {
        return response.data.data as CustomerUser;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!storedToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    const currentUser = await fetchCurrentUser(storedToken);
    if (currentUser) {
      setUser(currentUser);
    } else {
      localStorage.removeItem('auth_token');
      setUser(null);
      setToken(null);
    }
    setIsLoading(false);
  }, [fetchCurrentUser]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (credentials: { email: string; password: string }): Promise<CustomerUser> => {
    setIsLoading(true);
    try {
      const sessionId = typeof window !== 'undefined' ? localStorage.getItem('designer_session_id') : null;

      const response = await apiClient.post(
        API_ENDPOINTS.AUTH_LOGIN,
        credentials,
        sessionId ? { headers: { 'X-Session-ID': sessionId } } : {}
      );

      const data = response.data?.data;
      const receivedToken = data?.token;
      const receivedUser = data?.user;

      if (!receivedToken || !receivedUser) {
        throw new Error('Login succeeded but authentication token was missing.');
      }

      localStorage.setItem('auth_token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);

      // Trigger cart reload after login
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cart-updated'));
      }

      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone?: string;
    company_name?: string;
  }): Promise<CustomerUser> => {
    setIsLoading(true);
    try {
      const sessionId = typeof window !== 'undefined' ? localStorage.getItem('designer_session_id') : null;

      const response = await apiClient.post(
        API_ENDPOINTS.AUTH_REGISTER,
        data,
        sessionId ? { headers: { 'X-Session-ID': sessionId } } : {}
      );

      const responseData = response.data?.data;
      const receivedToken = responseData?.token;
      const receivedUser = responseData?.user;

      if (!receivedToken || !receivedUser) {
        throw new Error('Registration succeeded but authentication token was missing.');
      }

      localStorage.setItem('auth_token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cart-updated'));
      }

      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (token) {
        await apiClient.post(API_ENDPOINTS.AUTH_LOGOUT).catch(() => {});
      }
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      setToken(null);
      setIsLoading(false);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cart-updated'));
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: Boolean(user && token),
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
