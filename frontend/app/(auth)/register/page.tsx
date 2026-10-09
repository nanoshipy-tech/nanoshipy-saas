'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import { ArrowRight, Loader2, CheckCircle2, ShieldCheck, RefreshCw, User, Building2, Mail, Phone, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuth();

  const [step, setStep] = useState<'form' | 'otp'>('form');

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleGoogleSignup = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { data } = await apiClient.get('/auth/google/url');
      if (data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setError('Google Sign-up is not configured or currently disabled.');
        setGoogleLoading(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to start Google sign-up.');
      setGoogleLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/send-otp', { email, phone });
      if (res.data.success) {
        setStep('otp');
        setInfoMsg(`Verification OTP sent to ${email} and WhatsApp ${phone}`);
        toast.success('OTP sent to Email and WhatsApp!');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to send OTP. Please check your email and phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError('Please enter the valid OTP code.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const { data } = await apiClient.post('/auth/register', {
        name,
        company_name: companyName,
        email,
        phone,
        password,
        otp,
      });

      if (data.success) {
        if (data.data?.access_token && data.data?.user) {
          setAuth(data.data.user, data.data.access_token, data.data.refresh_token);
          toast.success('Account registered & logged in!');
          router.push('/dashboard');
        } else {
          toast.success(data.message || 'Account created successfully! Redirecting to login...');
          router.push('/login');
        }
      } else {
        throw new Error(data.message || 'Registration failed');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-[#F8F7FD]">
      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #14121F 0%, #1A0826 50%, #250B3A 100%)' }}>

        {/* Orbs */}
        <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(132,16,220,0.25) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-80px] left-[-80px] w-[350px] h-[350px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(91,6,154,0.20) 0%, transparent 70%)' }} />
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Nanoshipy Logo" className="w-9 h-9 rounded-xl object-contain shadow-md" />
            <span className="text-white font-bold text-lg tracking-tight font-sans">Nanoshipy</span>
          </div>

          {/* Hero */}
          <div className="flex-1 flex flex-col justify-center max-w-[400px]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 w-fit"
              style={{ background: 'rgba(132,16,220,0.20)', border: '1px solid rgba(214,168,255,0.30)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D6A8FF] animate-pulse" />
              <span className="text-[11.5px] font-semibold text-[#E7D3FF]">Quick Seller Registration</span>
            </div>

            <h1 className="text-[36px] font-bold text-white leading-[1.15] tracking-tight mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Start shipping in<br />
              <span style={{ background: 'linear-gradient(90deg, #D6A8FF, #E7D3FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                less than 60 seconds.
              </span>
            </h1>
            <p className="text-[14px] leading-relaxed mb-8" style={{ color: '#BCA8D9' }}>
              Create your account with instant Email & WhatsApp OTP confirmation.
            </p>

            <div className="space-y-3">
              {[
                'Instant Email & WhatsApp OTP Security',
                'Instant Access to 18+ Courier Partners',
                'Pre-configured NDR & Tracking Engine',
                'Zero Signup Setup Fees',
              ].map(f => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(132,16,220,0.25)', color: '#D6A8FF' }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[13px] text-[#E7D3FF]">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[12px]" style={{ color: '#8A75A5' }}>
            © {new Date().getFullYear()} Nanoshipy Logistics. All rights reserved. -{' '}
            <a
              href="https://growax360.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D6A8FF] hover:underline font-semibold"
            >
              Growax360
            </a>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-[380px] py-6">

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <img src="/logo.png" alt="Nanoshipy Logo" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-bold text-lg text-[#14121F] font-sans">Nanoshipy</span>
          </div>

          <div className="mb-6">
            <h2 className="text-[24px] font-bold text-[#14121F] tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {step === 'form' ? 'Create Your Account' : 'Confirm Security OTP'}
            </h2>
            <p className="text-[12.5px] text-[#534F66] mt-1">
              {step === 'form' ? 'Enter your basic details to register and receive your OTP.' : infoMsg}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
              {error}
            </div>
          )}

          {step === 'form' ? (
            <>
              {/* Google Sign-up Button */}
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border font-semibold text-[13px] text-[#14121F] bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm border-[#E8DEF2] hover:border-purple-300 disabled:opacity-60 mb-4"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Sign up with Google</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#F0E8F6]"></div>
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-white px-3 text-[#7E7994] font-medium">Or register with email</span>
                </div>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
              {/* 1. Full Name */}
              <div>
                <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">User Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full border rounded-xl pl-10 pr-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all border-[#E8DEF2] focus:border-purple-600"
                  />
                </div>
              </div>

              {/* 2. Company Name */}
              <div>
                <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">Company Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Enter company name"
                    required
                    className="w-full border rounded-xl pl-10 pr-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all border-[#E8DEF2] focus:border-purple-600"
                  />
                </div>
              </div>

              {/* 3. Mail ID */}
              <div>
                <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="w-full border rounded-xl pl-10 pr-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all border-[#E8DEF2] focus:border-purple-600"
                  />
                </div>
              </div>

              {/* 4. Phone Number */}
              <div>
                <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">Mobile Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    required
                    className="w-full border rounded-xl pl-10 pr-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all border-[#E8DEF2] focus:border-purple-600"
                  />
                </div>
              </div>

              {/* 5. Password */}
              <div>
                <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                    className="w-full border rounded-xl pl-10 pr-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all border-[#E8DEF2] focus:border-purple-600"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] text-white cursor-pointer disabled:opacity-60 mt-4 transition-all"
                style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)', boxShadow: '0 2px 8px rgba(91,6,154,0.4)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Send OTP Code</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
          ) : (
            <form onSubmit={handleRegisterWithOtp} className="space-y-5">
              <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-2xl text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-purple-600 mx-auto" />
                <p className="text-xs text-purple-900 font-semibold">Enter 6-Digit Security Code</p>
                <p className="text-[11px] text-purple-700">Sent to <b>{email}</b> & <b>{phone}</b></p>
              </div>

              <div>
                <label className="block text-[11.5px] font-semibold text-[#14121F] mb-2 text-center">Security OTP Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  required
                  className="w-full border rounded-xl px-3.5 py-3 text-center text-xl font-mono tracking-widest font-bold bg-white outline-none transition-all border-[#E8DEF2] focus:border-purple-600"
                />
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] text-white cursor-pointer disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)', boxShadow: '0 2px 8px rgba(91,6,154,0.4)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Confirm & Complete Registration</span><ArrowRight className="w-4 h-4" /></>}
              </button>

              <div className="flex items-center justify-between text-xs text-[#7E7994] pt-2">
                <button type="button" onClick={() => setStep('form')} className="hover:underline text-purple-700 font-medium">
                  ← Edit details
                </button>
                <button type="button" onClick={handleSendOtp} className="hover:underline text-purple-700 font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Resend OTP
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-[#F2ECF7] text-center">
            <p className="text-[12.5px] text-[#534F66]">
              Already registered?{' '}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: '#5B069A' }}>
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
