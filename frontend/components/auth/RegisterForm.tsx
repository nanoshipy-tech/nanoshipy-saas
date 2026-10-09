'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterInput } from '@/lib/validators';
import { apiClient } from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';

export const RegisterForm = () => {
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterInput) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await apiClient.post('/auth/register', data);
      if (response.data.success) {
        setSuccessMsg('Registration successful! Please check your email to verify your account.');
      }
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error?.message || 'Registration failed. Please try again.');
    }
  };

  if (successMsg) {
    return <Alert type="success" message={successMsg} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errorMsg && <Alert type="error" message={errorMsg} />}
      
      <Input 
        label="Company Name" 
        {...register('company_name')} 
        error={errors.company_name?.message} 
      />

      <Input 
        label="Subdomain (used for login)" 
        {...register('subdomain')} 
        error={errors.subdomain?.message} 
        placeholder="your-company"
      />
      
      <Input 
        label="Your Name" 
        {...register('name')} 
        error={errors.name?.message} 
      />

      <Input 
        label="Email" 
        type="email" 
        {...register('email')} 
        error={errors.email?.message} 
      />
      
      <Input 
        label="Password" 
        type="password" 
        {...register('password')} 
        error={errors.password?.message} 
      />

      <Input 
        label="Phone Number (optional)" 
        {...register('phone')} 
        error={errors.phone?.message} 
      />

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Create Account
      </Button>
    </form>
  );
};
