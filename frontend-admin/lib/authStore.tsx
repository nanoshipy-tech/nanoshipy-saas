'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiClient, refreshPlatformAuthSession, setPlatformAccessToken } from './apiClient';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  tenant?: { name: string; subdomain: string };
  role: string;
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshInProgress = useRef(false);

  const clearLegacyStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('platform_access_token');
      localStorage.removeItem('platform_refresh_token');
      localStorage.removeItem('platform_user');
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (refreshInProgress.current) return;
      refreshInProgress.current = true;

      // Purge any tokens previously exposed in localStorage
      clearLegacyStorage();

      try {
        // Attempt session restore via httpOnly platform_refresh_token cookie
        const token = await refreshPlatformAuthSession();
        if (token) {
          setAccessTokenState(token);
          setPlatformAccessToken(token);

          const meRes = await apiClient.get('/platform/auth/me');
          if (meRes.data?.success) {
            setUser(meRes.data.data);
          }
        }
      } catch {
        setUser(null);
        setAccessTokenState(null);
        setPlatformAccessToken(null);
      } finally {
        setIsLoading(false);
        refreshInProgress.current = false;
      }
    };

    initAuth();
  }, []);

  const setAuth = (newUser: User, token: string, refreshToken?: string) => {
    clearLegacyStorage();
    setUser(newUser);
    setAccessTokenState(token);
    setPlatformAccessToken(token);
  };

  const logout = async () => {
    try {
      await apiClient.post('/platform/auth/logout');
    } catch {
      // ignore
    } finally {
      setUser(null);
      setAccessTokenState(null);
      setPlatformAccessToken(null);
      clearLegacyStorage();
      if (typeof window !== 'undefined') {
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
