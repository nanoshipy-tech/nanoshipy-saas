'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@/lib/validators';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/lib/authStore';
import { Alert } from '@/components/ui/Alert';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export const LoginForm = () => {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [errorMsg, setErrorMsg] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      subdomain: '',
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data: LoginInput) => {
    setErrorMsg('');
    try {
      const response = await apiClient.post('/auth/login', data);
      const resData = response.data;

      if (resData.success) {
        if (resData.data.requires_2fa) {
          router.push(`/two-factor?token=${resData.data.temp_token}`);
        } else {
          setAuth(resData.data.user, resData.data.access_token, resData.data.refresh_token);
          router.push('/dashboard');
        }
      }
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error?.message || 'Login failed. Please verify credentials.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errorMsg && <Alert type="error" message={errorMsg} />}

      <div>
        <label className="text-[11px] text-slate-700 font-black uppercase tracking-wider block mb-1.5">
          Tenant Subdomain
        </label>
        <div className="relative">
          <Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            {...register('subdomain')}
            placeholder="testcorp"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition shadow-2xs"
          />
        </div>
        {errors.subdomain && <p className="text-[10px] font-extrabold text-rose-600 mt-1">{errors.subdomain.message}</p>}
      </div>

      <div>
        <label className="text-[11px] text-slate-700 font-black uppercase tracking-wider block mb-1.5">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="email"
            {...register('email')}
            placeholder="test@testcorp.com"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition shadow-2xs"
          />
        </div>
        {errors.email && <p className="text-[10px] font-extrabold text-rose-600 mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="text-[11px] text-slate-700 font-black uppercase tracking-wider block mb-1.5">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="password"
            {...register('password')}
            placeholder="••••••••••••"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition shadow-2xs"
          />
        </div>
        {errors.password && <p className="text-[10px] font-extrabold text-rose-600 mt-1">{errors.password.message}</p>}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Link href="/forgot-password" className="text-xs font-extrabold text-[#8410DC] hover:underline">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] active:scale-[0.99] disabled:bg-blue-400 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <span>Sign in to Seller Account</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold">
        <span>Test Account:</span>
        <span className="font-mono text-[#8410DC] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">test@testcorp.com</span>
      </div>
    </form>
  );
};
