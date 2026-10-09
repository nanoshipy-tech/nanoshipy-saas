'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordInput } from '@/lib/validators';
import { apiClient } from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';

export const ForgotPasswordForm = () => {
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setMsg(null);
    try {
      const response = await apiClient.post('/auth/forgot-password', data);
      if (response.data.success) {
        setMsg({ type: 'success', text: response.data.data.message });
      }
    } catch (error: any) {
      setMsg({ type: 'error', text: error.response?.data?.error?.message || 'Request failed. Please try again.' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {msg && <Alert type={msg.type} message={msg.text} />}
      
      <Input 
        label="Subdomain" 
        {...register('subdomain')} 
        error={errors.subdomain?.message} 
      />
      
      <Input 
        label="Email" 
        type="email" 
        {...register('email')} 
        error={errors.email?.message} 
      />

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Send Reset Link
      </Button>
    </form>
  );
};
