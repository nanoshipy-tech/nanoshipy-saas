'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, refreshAuthSession, setAccessToken as setGlobalAccessToken } from './apiClient';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  tenant?: {
    name: string;
    subdomain: string;
    is_booking_office?: boolean;
    kyc_status?: string;
    status?: string;
  };
  role: { id: string; name: string };
  tenant_id: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        let existingUser: User | null = null;
        let existingToken: string | null = null;
        let storedRefreshToken: string | null = null;

        if (typeof window !== 'undefined') {
          try {
            const rawUser = localStorage.getItem('seller_auth_user');
            if (rawUser) existingUser = JSON.parse(rawUser);
            existingToken = localStorage.getItem('seller_access_token') || sessionStorage.getItem('seller_access_token');
            storedRefreshToken = localStorage.getItem('seller_refresh_token');
          } catch (e) {}
        }

        if (existingUser) {
          setUser(existingUser);
        }

        // 1. Check if we already have an active access token
        if (existingToken) {
          setGlobalAccessToken(existingToken);
          setAccessTokenState(existingToken);

          try {
            const meRes = await apiClient.get('/auth/me');
            if (meRes.data?.success) {
              const freshUser = meRes.data.data;
              setUser(freshUser);
              if (typeof window !== 'undefined') {
                try { localStorage.setItem('seller_auth_user', JSON.stringify(freshUser)); } catch (e) {}
              }
              setIsLoading(false);
              return;
            }
          } catch (meErr: any) {
            // If token expired, fall through to refresh flow
          }
        }

        // 2. Attempt session refresh via cookie or saved fallback refresh token
        if (!storedRefreshToken && typeof window !== 'undefined') {
          storedRefreshToken = localStorage.getItem('seller_refresh_token');
        }

        const isAuthPage = typeof window !== 'undefined' && (
          window.location.pathname.startsWith('/login') ||
          window.location.pathname.startsWith('/register') ||
          window.location.pathname.startsWith('/forgot-password') ||
          window.location.pathname.startsWith('/reset-password')
        );

        if (!existingToken && !storedRefreshToken && isAuthPage) {
          setIsLoading(false);
          return;
        }

        const refreshedToken = await refreshAuthSession(storedRefreshToken);

        if (refreshedToken) {
          setAccessTokenState(refreshedToken);
          setGlobalAccessToken(refreshedToken);

          const meRes = await apiClient.get('/auth/me');
          if (meRes.data?.success) {
            const freshUser = meRes.data.data;
            setUser(freshUser);
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('seller_auth_user', JSON.stringify(freshUser)); } catch (e) {}
            }
            setIsLoading(false);
            return;
          }
        }

        // 3. If neither existing token nor refresh token is valid, clear invalid session
        if (!existingToken && !refreshedToken) {
          setUser(null);
          setAccessTokenState(null);
          setGlobalAccessToken(null);
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('seller_auth_user');
              localStorage.removeItem('seller_access_token');
              localStorage.removeItem('seller_refresh_token');
              sessionStorage.removeItem('seller_access_token');
            } catch (e) {}

            const path = window.location.pathname;
            const isProtected = path.startsWith('/dashboard') ||
                               path.startsWith('/orders') ||
                               path.startsWith('/shipments') ||
                               path.startsWith('/wallet') ||
                               path.startsWith('/analytics') ||
                               path.startsWith('/support') ||
                               path.startsWith('/settings');

            if (isProtected) {
              window.location.href = `/login?next=${encodeURIComponent(path)}`;
            }
          }
        }
      } catch (error) {
        // Safe catch - preserve UI state if offline
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const setAuth = (newUser: User, token: string, refreshToken?: string) => {
    setUser(newUser);
    setAccessTokenState(token);
    setGlobalAccessToken(token);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('seller_auth_user', JSON.stringify(newUser));
        localStorage.setItem('seller_access_token', token);
        sessionStorage.setItem('seller_access_token', token);
        if (refreshToken) {
          localStorage.setItem('seller_refresh_token', refreshToken);
        }
      } catch (e) {}
    }
  };

  const logout = async () => {
    try {
      const rToken = typeof window !== 'undefined' ? localStorage.getItem('seller_refresh_token') : null;
      await apiClient.post('/auth/logout', { refresh_token: rToken });
    } catch (e) {
      // ignore
    } finally {
      setUser(null);
      setAccessTokenState(null);
      setGlobalAccessToken(null);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('seller_auth_user');
          localStorage.removeItem('seller_access_token');
          localStorage.removeItem('seller_refresh_token');
          sessionStorage.removeItem('seller_access_token');
        } catch (e) {}
        window.location.href = '/login';
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, setAuth, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
