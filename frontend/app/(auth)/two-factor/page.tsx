'use client';

import React, { Suspense } from 'react';
import { TwoFactorForm } from '@/components/auth/TwoFactorForm';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

export default function TwoFactorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070b14] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-[#14121F]">Two-Factor Authentication</h2>
          <p className="mt-2 text-center text-sm text-slate-650 dark:text-[#534F66]">
            Enter the 6-digit code from your authenticator app
          </p>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex justify-center"><Spinner /></div>}>
            <TwoFactorForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
