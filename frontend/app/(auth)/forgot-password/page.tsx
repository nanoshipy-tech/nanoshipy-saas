'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { ArrowRight, Loader2, CheckCircle2, KeyRound, ShieldCheck, Mail, MessageSquare, Smartphone, Eye, EyeOff, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  
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

  const [activeChannel, setActiveChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your registered email address or mobile number.');
      return;
    }

    setLoading(true);
    try {
      const isEmail = cleanId.includes('@');
      const payload: any = { channel: 'email' };
      if (isEmail) {
        payload.email = cleanId.toLowerCase();
      } else {
        payload.phone = cleanId.replace(/\D/g, '');
      }

      const res = await apiClient.post('/auth/forgot-password', payload);
      if (res.data.success) {
        setActiveChannel('email');
        setChannels(res.data.data?.channels || ['email', 'whatsapp', 'sms']);
        toast.success('6-Digit OTP code dispatched to your email address!');
        setStep('verify');
        setCountdown(30);
        setCanResend(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchChannel = async (targetChannel: 'whatsapp' | 'sms' | 'email') => {
    setError('');
    setLoading(true);
    try {
      const cleanId = identifier.trim();
      const isEmail = cleanId.includes('@');
      const payload: any = { channel: targetChannel };
      if (isEmail) {
        payload.email = cleanId.toLowerCase();
      } else {
        payload.phone = cleanId.replace(/\D/g, '');
      }

      const res = await apiClient.post('/auth/forgot-password', payload);
      if (res.data.success) {
        setActiveChannel(targetChannel);
        const channelName = targetChannel === 'whatsapp' ? 'WhatsApp' : (targetChannel === 'sms' ? 'SMS' : 'Email');
        toast.success(`OTP code sent via ${channelName}!`);
        setCountdown(30);
        setCanResend(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || `Failed to send code via ${targetChannel}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    await handleSwitchChannel(activeChannel);
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length < 6) {
      setError('Please enter the 6-digit security OTP code.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const cleanId = identifier.trim();
      const isEmail = cleanId.includes('@');
      const payload: any = {
        otp: otp.trim(),
        new_password: newPassword,
      };

      if (isEmail) {
        payload.email = cleanId.toLowerCase();
      } else {
        payload.phone = cleanId.replace(/\D/g, '');
      }

      const res = await apiClient.post('/auth/reset-password', payload);
      if (res.data.success) {
        toast.success('Password reset successfully!');
        setStep('success');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reset password. Please check your OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-[#F8F7FD]">
      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex flex-col w-[50%] relative overflow-hidden"
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
          <div className="flex-1 flex flex-col justify-center max-w-[420px]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 w-fit"
              style={{ background: 'rgba(132,16,220,0.20)', border: '1px solid rgba(214,168,255,0.30)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D6A8FF] animate-pulse" />
              <span className="text-[11.5px] font-semibold text-[#E7D3FF]">Multi-Channel Security</span>
            </div>

            <h1 className="text-[34px] font-bold text-white leading-[1.2] tracking-tight mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Instant Account Recovery<br />
              <span style={{ background: 'linear-gradient(90deg, #D6A8FF, #E7D3FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                via Email, WhatsApp & SMS.
              </span>
            </h1>
            <p className="text-[14px] leading-relaxed mb-8" style={{ color: '#BCA8D9' }}>
              Recover your account in seconds. We dispatch a 6-digit OTP code to your registered email, WhatsApp, and mobile SMS simultaneously.
            </p>

            {/* Feature Pills */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-white/90 bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold block">Email Dispatch</span>
                  <span className="text-[11px] text-white/60">Delivered directly to your inbox with 1-click button.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/90 bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold block">WhatsApp Instant Trigger</span>
                  <span className="text-[11px] text-white/60">Direct Growax verification alert to your WhatsApp.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/90 bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold block">SMS Mobile Gateway</span>
                  <span className="text-[11px] text-white/60">High-priority SMS delivery to your phone.</span>
                </div>
              </div>
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
        <div className="w-full max-w-[380px]">

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <img src="/logo.png" alt="Nanoshipy Logo" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-bold text-lg text-[#14121F] font-sans">Nanoshipy</span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <span className="font-bold">Error:</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: REQUEST OTP */}
          {step === 'request' && (
            <>
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-[#F6EFFF] border border-[#D6A8FF] text-[#5B069A]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-[24px] font-bold text-[#14121F] tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Forgot Password?
                </h2>
                <p className="text-[12.5px] text-[#534F66] mt-1">
                  Enter your registered Email or Mobile Number to receive an instant verification code.
                </p>
              </div>

              {/* Channels indicator */}
              <div className="mb-5 p-3 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between text-[11px] font-medium text-purple-900">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-purple-600" /> Email</span>
                <span className="text-purple-300">•</span>
                <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp</span>
                <span className="text-purple-300">•</span>
                <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-blue-600" /> SMS</span>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">
                    Registered Email or Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="user@nanoshipy.com or 9876543210"
                    className="w-full border rounded-xl px-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all shadow-xs"
                    style={{ borderColor: '#E8DEF2' }}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#5B069A'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(91,6,154,0.15)'; }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E8DEF2'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] text-white cursor-pointer disabled:opacity-60 mt-2 transition-all shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Get 6-Digit OTP</span><ArrowRight className="w-4 h-4" /></>}
                </button>

                <div className="text-center pt-2">
                  <Link href="/login" className="text-[12.5px] font-semibold hover:underline" style={{ color: '#5B069A' }}>
                    ← Back to sign in
                  </Link>
                </div>
              </form>
            </>
          )}

          {/* STEP 2: VERIFY OTP & RESET PASSWORD */}
          {step === 'verify' && (
            <>
              <div className="mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-[#F6EFFF] border border-[#D6A8FF] text-[#5B069A]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-[22px] font-bold text-[#14121F] tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Enter Security OTP
                </h2>
                <p className="text-[12.5px] text-[#534F66] mt-1">
                  We sent a 6-digit verification code to <strong className="text-slate-900">{identifier}</strong> via <span className="font-semibold text-purple-700 capitalize">{activeChannel}</span>.
                </p>
              </div>

              {/* 1-Click Channel Switcher (If user doesn't receive email) */}
              <div className="mb-4 p-3 bg-purple-50/80 border border-purple-100/90 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-purple-900 flex items-center gap-1.5">
                    {activeChannel === 'email' && <Mail className="w-3.5 h-3.5 text-purple-600" />}
                    {activeChannel === 'whatsapp' && <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                    {activeChannel === 'sms' && <Smartphone className="w-3.5 h-3.5 text-blue-600" />}
                    Active: <span className="capitalize">{activeChannel}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Didn't receive?</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-purple-100/80">
                  <button
                    type="button"
                    onClick={() => handleSwitchChannel('whatsapp')}
                    disabled={loading}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer ${activeChannel === 'whatsapp' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800'}`}
                  >
                    <MessageSquare className="w-3 h-3 text-emerald-500" /> Send via WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchChannel('sms')}
                    disabled={loading}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer ${activeChannel === 'sms' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-50 border border-blue-200 text-blue-800'}`}
                  >
                    <Smartphone className="w-3 h-3 text-blue-500" /> Send via SMS
                  </button>
                </div>
              </div>

              <form onSubmit={handleVerifyAndReset} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[11.5px] font-semibold text-[#14121F]">
                      6-Digit Verification Code *
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
                      placeholder="At least 8 characters (1 upper, 1 num, 1 special)"
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
                    placeholder="Re-enter your new password"
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Verify OTP & Reset Password</span><CheckCircle2 className="w-4 h-4" /></>}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('request')}
                    className="text-[12px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    ← Change Email / Phone
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
                Password Updated!
              </h2>
              <p className="text-[13px] text-[#534F66] mb-6">
                Your Nanoshipy password has been reset securely. You can now sign in with your new credentials.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full py-3 rounded-xl font-semibold text-[13px] text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)' }}
              >
                Sign In to Account →
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
