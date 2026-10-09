'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, ResetPasswordInput } from '@/lib/validators';
import { apiClient } from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useRouter, useSearchParams } from 'next/navigation';

export const ResetPasswordForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema)
  });

  if (!token) {
    return <Alert type="error" message="Invalid or missing reset token." />;
  }

  const onSubmit = async (data: ResetPasswordInput) => {
    setMsg(null);
    try {
      const response = await apiClient.post('/auth/reset-password', { ...data, token });
      if (response.data.success) {
        setMsg({ type: 'success', text: 'Password reset successful. Redirecting to login...' });
        setTimeout(() => router.push('/login'), 3000);
      }
    } catch (error: any) {
      setMsg({ type: 'error', text: error.response?.data?.error?.message || 'Reset failed. Please try again.' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {msg && <Alert type={msg.type} message={msg.text} />}
      
      <Input 
        label="New Password" 
        type="password" 
        {...register('new_password')} 
        error={errors.new_password?.message} 
      />

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Reset Password
      </Button>
    </form>
  );
};
