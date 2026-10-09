'use client';

import React, { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070b14] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-[#14121F]">Choose a new password</h2>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex justify-center"><Spinner /></div>}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
