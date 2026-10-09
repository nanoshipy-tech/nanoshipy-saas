'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { twoFactorSchema, TwoFactorInput } from '@/lib/validators';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/lib/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useRouter, useSearchParams } from 'next/navigation';

export const TwoFactorForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get('token');
  const { setAuth } = useAuth();
  
  const [errorMsg, setErrorMsg] = useState('');
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TwoFactorInput>({
    resolver: zodResolver(twoFactorSchema)
  });

  if (!tempToken) {
    return <Alert type="error" message="Missing temporary token. Please log in again." />;
  }

  const onSubmit = async (data: TwoFactorInput) => {
    setErrorMsg('');
    try {
      const response = await apiClient.post('/auth/2fa/verify', { temp_token: tempToken, otp: data.otp });
      const resData = response.data;

      if (resData.success) {
        setAuth(resData.data.user, resData.data.access_token, resData.data.refresh_token);
        router.push('/dashboard');
      }
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error?.message || 'Verification failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errorMsg && <Alert type="error" message={errorMsg} />}
      
      <Input 
        label="6-Digit OTP" 
        {...register('otp')} 
        error={errors.otp?.message} 
        placeholder="123456"
        maxLength={6}
      />

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Verify OTP
      </Button>
    </form>
  );
};
