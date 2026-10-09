'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { ArrowRight, Loader2, CheckCircle2, KeyRound, ShieldCheck, Mail, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Verification step state
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let timer: any;
    if (step === 'verify' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            setCanResend(true);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your admin email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/platform/auth/forgot-password', { email: cleanEmail });
      if (res.data.success) {
        toast.success('6-Digit Security OTP dispatched to your admin email!');
        setStep('verify');
        setCountdown(60);
        setCanResend(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to dispatch security code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/platform/auth/forgot-password', { email: email.trim().toLowerCase() });
      toast.success('New 6-digit OTP code dispatched!');
      setCountdown(60);
      setCanResend(false);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length < 6) {
      setError('Please enter the 6-digit security OTP code.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/platform/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        new_password: newPassword,
      });

      if (res.data.success) {
        toast.success('Admin password reset successfully!');
        setStep('success');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reset password. Please check the OTP code.');
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
            <img src="/logo-compressed.png" alt="Nanoshipy Admin Logo" className="w-9 h-9 rounded-xl object-cover shadow-md" />
            <span className="text-white font-bold text-lg tracking-tight font-sans">Nanoshipy Admin</span>
          </div>

          {/* Hero */}
          <div className="flex-1 flex flex-col justify-center max-w-[400px]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 w-fit"
              style={{ background: 'rgba(132,16,220,0.20)', border: '1px solid rgba(214,168,255,0.30)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D6A8FF] animate-pulse" />
              <span className="text-[11.5px] font-semibold text-[#E7D3FF]">Superadmin Console</span>
            </div>

            <h1 className="text-[36px] font-bold text-white leading-[1.15] tracking-tight mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Admin Console<br />
              <span style={{ background: 'linear-gradient(90deg, #D6A8FF, #E7D3FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Account Recovery.
              </span>
            </h1>
            <p className="text-[14px] leading-relaxed mb-8" style={{ color: '#BCA8D9' }}>
              Instant verification code sent via encrypted SMTP mailer to your registered platform administrator account.
            </p>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/80 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Enterprise Platform Security</span>
              </div>
              <p className="text-[11.5px] text-white/60 leading-relaxed">
                6-digit numeric OTP verification code expires in 10 minutes. Session tokens will be automatically rotated upon successful recovery.
              </p>
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
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[360px]">

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <img src="/logo-compressed.png" alt="Nanoshipy Admin Logo" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-bold text-lg text-[#14121F] font-sans">Admin Portal</span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
              {error}
            </div>
          )}

          {/* STEP 1: REQUEST */}
          {step === 'request' && (
            <>
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-[#F6EFFF] border border-[#D6A8FF] text-[#5B069A]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-[24px] font-bold text-[#14121F] tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Reset Admin Password
                </h2>
                <p className="text-[12.5px] text-[#534F66] mt-1">Enter your admin email to receive a 6-digit security code.</p>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="care@nanoshipy.com"
                    className="w-full border rounded-xl px-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all"
                    style={{ borderColor: '#E8DEF2' }}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#5B069A'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(91,6,154,0.15)'; }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E8DEF2'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] text-white cursor-pointer disabled:opacity-60 mt-2 transition-all"
                  style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)', boxShadow: '0 2px 8px rgba(91,6,154,0.4)' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Get Security Code</span><ArrowRight className="w-4 h-4" /></>}
                </button>

                <div className="text-center pt-2">
                  <Link href="/login" className="text-[12.5px] font-semibold hover:underline" style={{ color: '#5B069A' }}>
                    ← Back to sign in
                  </Link>
                </div>
              </form>
            </>
          )}

          {/* STEP 2: VERIFY OTP & RESET */}
          {step === 'verify' && (
            <>
              <div className="mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-[#F6EFFF] border border-[#D6A8FF] text-[#5B069A]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-[22px] font-bold text-[#14121F] tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Verify Admin OTP
                </h2>
                <p className="text-[12.5px] text-[#534F66] mt-1">
                  We sent a 6-digit security code to <strong className="text-slate-900">{email}</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyAndReset} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[11.5px] font-semibold text-[#14121F]">
                      6-Digit Security Code *
                    </label>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={!canResend || loading}
                      className={`text-[11px] font-semibold ${canResend ? 'text-[#8410DC] hover:underline cursor-pointer' : 'text-slate-400'}`}
                    >
                      {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[8px] font-mono text-xl py-2.5 border rounded-xl bg-slate-50 focus:bg-white text-purple-900 font-extrabold outline-none transition-all"
                    style={{ borderColor: '#E8DEF2' }}
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter strong admin password"
                      className="w-full border rounded-xl px-3.5 pr-10 py-2.5 text-[13px] font-medium bg-white outline-none transition-all"
                      style={{ borderColor: '#E8DEF2' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full border rounded-xl px-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all"
                    style={{ borderColor: '#E8DEF2' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] text-white cursor-pointer disabled:opacity-60 mt-2 transition-all shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Reset Admin Password</span><CheckCircle2 className="w-4 h-4" /></>}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('request')}
                    className="text-[12px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    ← Change Email
                  </button>
                </div>
              </form>
            </>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-emerald-50 border border-emerald-200 text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-[22px] font-bold text-[#14121F] mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Admin Password Reset!
              </h2>
              <p className="text-[13px] text-[#534F66] mb-6">
                Your administrator credentials have been updated. You can now log into the superadmin console.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full py-3 rounded-xl font-semibold text-[13px] text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)' }}
              >
                Sign In to Admin Console →
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
