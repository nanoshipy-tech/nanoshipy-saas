'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Authenticating with Google...');

  useEffect(() => {
    const processCallback = async () => {
      const error = searchParams.get('error');
      const token = searchParams.get('token');
      const refresh = searchParams.get('refresh');
      const isNew = searchParams.get('new') === '1';

      if (error) {
        setErrorMsg(error);
        toast.error(error);
        setTimeout(() => router.push('/login'), 2500);
        return;
      }

      if (!token) {
        setErrorMsg('No authentication token received from Google callback.');
        setTimeout(() => router.push('/login'), 2500);
        return;
      }

      try {
        setStatus('Setting up your session...');
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        const meRes = await apiClient.get('/auth/me');
        const userData = meRes.data?.data;

        if (!userData) {
          throw new Error('Could not fetch user profile with received credentials.');
        }

        setAuth(userData, token, refresh || undefined);

        if (isNew) {
          toast.success('Welcome to Nanoshipy! Your merchant workspace is active.');
        } else {
          toast.success('Successfully logged in with Google!');
        }

        router.replace('/dashboard');
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err.message || 'Google authentication failed';
        setErrorMsg(msg);
        toast.error(msg);
        setTimeout(() => router.push('/login'), 2500);
      }
    };

    processCallback();
  }, [searchParams, router, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7FD] px-4">
      <div className="w-full max-w-md bg-white border border-[#E8DEF2] rounded-3xl p-8 shadow-xl text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-purple-50 border border-purple-200">
            {errorMsg ? (
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            ) : (
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#14121F] tracking-tight">
            {errorMsg ? 'Authentication Failed' : 'Signing You In'}
          </h2>
          <p className="text-sm text-[#534F66]">
            {errorMsg || status}
          </p>
        </div>

        {errorMsg && (
          <div className="pt-2">
            <button
              onClick={() => router.push('/login')}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-all"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8F7FD]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
