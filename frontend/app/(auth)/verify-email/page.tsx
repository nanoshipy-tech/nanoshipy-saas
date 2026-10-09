'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
      return;
    }

    apiClient.post('/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        setMessage('Your email has been successfully verified! You can now log in.');
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error.response?.data?.error?.message || 'Verification failed.');
      });
  }, [token]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h2 className="text-center text-2xl font-extrabold text-slate-900 dark:text-[#14121F]">Email Verification</h2>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {status === 'loading' && <Spinner className="w-8 h-8 mb-4" />}
        {status === 'success' && <Alert type="success" message={message} className="w-full mb-4" />}
        {status === 'error' && <Alert type="error" message={message} className="w-full mb-4" />}
        
        {status !== 'loading' && (
          <Link href="/login" className="text-indigo-650 dark:text-[#D6A8FF] hover:text-indigo-750 font-bold hover:underline">
            Go to Login
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070b14] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <Suspense fallback={<Spinner />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
