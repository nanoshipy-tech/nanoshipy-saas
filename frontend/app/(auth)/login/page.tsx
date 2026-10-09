'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import { Shield, ArrowRight, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuth();

  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const [authMethod, setAuthMethod] = useState<'password' | 'otp'>('password');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [infoMsg, setInfoMsg] = useState('');

  // 2FA state
  const [stage, setStage] = useState<'credentials' | '2fa'>('credentials');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [totpToken, setTotpToken] = useState('');

  useEffect(() => {
    const urlErr = searchParams.get('error');
    if (urlErr) {
      setError(decodeURIComponent(urlErr));
    }
  }, [searchParams]);

  useEffect(() => {
    let timer: any = null;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  useEffect(() => {
    try {
      router.prefetch('/dashboard');
    } catch (_) {}
  }, [router]);

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { data } = await apiClient.get('/auth/google/url');
      if (data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setError('Google Sign-in is not configured or currently disabled.');
        setGoogleLoading(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to start Google sign-in.');
      setGoogleLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError('');
    setInfoMsg('');
    setSendingOtp(true);
    try {
      const { data } = await apiClient.post('/auth/login/send-otp', {
        phone: cleanPhone,
      });
      setOtpSent(true);
      setResendTimer(30);
      setInfoMsg(data.message || 'OTP verification code sent via SMS & WhatsApp.');
      toast.success('OTP sent successfully via SMS & WhatsApp!');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to send OTP to this number. Please check the number.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!otpCode || otpCode.trim().length < 4) {
      setError('Please enter the 6-digit OTP code received.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', {
        phone: cleanPhone,
        otp: otpCode.trim(),
      });

      if (data.data?.requires_2fa) {
        setPreAuthToken(data.data.pre_auth_token);
        setStage('2fa');
      } else {
        setAuth(data.data.user, data.data.access_token, data.data.refresh_token);
        toast.success('Signed in successfully!');
        const next = searchParams.get('next') || '/dashboard';
        router.push(next);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMethod === 'otp') {
      return handleOtpLogin(e);
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password, subdomain: subdomain || undefined });
      if (data.data?.requires_2fa) {
        setPreAuthToken(data.data.pre_auth_token);
        setStage('2fa');
      } else {
        setAuth(data.data.user, data.data.access_token, data.data.refresh_token);
        const next = searchParams.get('next') || '/dashboard';
        router.push(next);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/verify-2fa', { pre_auth_token: preAuthToken, totp_token: totpToken });
      setAuth(data.data.user, data.data.access_token, data.data.refresh_token);
      const next = searchParams.get('next') || '/dashboard';
      router.push(next);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Invalid 2FA code.');
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
          <div className="flex-1 flex flex-col justify-center max-w-[380px]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 w-fit"
              style={{ background: 'rgba(132,16,220,0.20)', border: '1px solid rgba(214,168,255,0.30)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D6A8FF] animate-pulse" />
              <span className="text-[11.5px] font-semibold text-[#E7D3FF]">Seller Workspace</span>
            </div>

            <h1 className="text-[36px] font-bold text-white leading-[1.15] tracking-tight mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Ship orders.<br />
              <span style={{ background: 'linear-gradient(90deg, #D6A8FF, #E7D3FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Track everything.
              </span>
            </h1>
            <p className="text-[14px] leading-relaxed mb-8" style={{ color: '#BCA8D9' }}>
              Book shipments across 18+ couriers, manage NDRs, recharge your wallet, and grow your business with powerful analytics.
            </p>

            <div className="space-y-3">
              {[
                'Unified multi-courier shipping portal',
                'Automated NDR workflow & RTO reduction',
                'Instant wallet recharge & transparent rates',
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
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[360px]">

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <img src="/logo.png" alt="Nanoshipy Logo" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-bold text-lg text-[#14121F] font-sans">Nanoshipy</span>
          </div>

          {stage === 'credentials' ? (
            <>
              <div className="mb-6">
                <h2 className="text-[24px] font-bold text-[#14121F] tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Sign in to workspace
                </h2>
                <p className="text-[12.5px] text-[#534F66] mt-1">Access your seller account and shipping operations.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
                  {error}
                </div>
              )}

              {/* Google Sign-in Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border font-semibold text-[13px] text-[#14121F] bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm border-[#E8DEF2] hover:border-purple-300 disabled:opacity-60"
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
                <span>Continue with Google</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#F0E8F6]"></div>
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-white px-3 text-[#7E7994] font-medium">Or choose sign in method</span>
                </div>
              </div>

              {/* Segmented Tab: Password vs Mobile OTP */}
              <div className="flex p-1 rounded-xl bg-slate-100/90 mb-4 border border-[#E8DEF2]">
                <button
                  type="button"
                  onClick={() => { setAuthMethod('password'); setError(''); setInfoMsg(''); }}
                  className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${
                    authMethod === 'password'
                      ? 'bg-white text-[#14121F] shadow-xs'
                      : 'text-[#7E7994] hover:text-[#14121F]'
                  }`}
                >
                  Work Email
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMethod('otp'); setError(''); setInfoMsg(''); }}
                  className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${
                    authMethod === 'otp'
                      ? 'bg-white text-[#14121F] shadow-xs'
                      : 'text-[#7E7994] hover:text-[#14121F]'
                  }`}
                >
                  Mobile Number OTP
                </button>
              </div>

              {infoMsg && (
                <div className="mb-4 p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-[12px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-none" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {authMethod === 'password' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">Email address *</label>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com"
                      className="w-full border rounded-xl px-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all"
                      style={{ borderColor: '#E8DEF2' }}
                      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#5B069A'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(91,6,154,0.15)'; }}
                      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E8DEF2'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                        className="w-full border rounded-xl px-3.5 py-2.5 pr-10 text-[13px] font-medium bg-white outline-none transition-all"
                        style={{ borderColor: '#E8DEF2' }}
                        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#5B069A'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(91,6,154,0.15)'; }}
                        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E8DEF2'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#7E7994' }}>
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[12px] text-[#534F66] font-medium">
                      <input type="checkbox" defaultChecked className="rounded text-[#5B069A]" />Stay signed in
                    </label>
                    <Link href="/forgot-password" className="text-[12px] font-semibold hover:underline" style={{ color: '#5B069A' }}>
                      Forgot password?
                    </Link>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] text-white cursor-pointer disabled:opacity-60 mt-2 transition-all"
                    style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)', boxShadow: '0 2px 8px rgba(91,6,154,0.4)' }}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign in</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={otpSent ? handleOtpLogin : handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#14121F] mb-1.5">Mobile Number *</label>
                    <div className="flex gap-2">
                      <div className="px-3 py-2.5 bg-slate-100 border border-[#E8DEF2] rounded-xl text-[13px] font-bold text-slate-700 select-none flex items-center">
                        +91
                      </div>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="9876543210"
                        className="w-full border rounded-xl px-3.5 py-2.5 text-[13px] font-medium bg-white outline-none transition-all"
                        style={{ borderColor: '#E8DEF2' }}
                        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#5B069A'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(91,6,154,0.15)'; }}
                        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E8DEF2'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>

                  {otpSent && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11.5px] font-semibold text-[#14121F]">6-digit OTP code *</label>
                        {resendTimer > 0 ? (
                          <span className="text-[11px] font-semibold text-[#7E7994]">Resend in {resendTimer}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={sendingOtp}
                            className="text-[11px] font-bold hover:underline cursor-pointer"
                            style={{ color: '#5B069A' }}
                          >
                            Resend OTP
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        className="w-full border rounded-xl px-3.5 py-2.5 text-center text-lg font-bold font-mono tracking-widest text-[#14121F] bg-white outline-none transition-all"
                        style={{ borderColor: '#E8DEF2' }}
                        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#5B069A'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(91,6,154,0.15)'; }}
                        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E8DEF2'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
                      />
                    </div>
                  )}

                  {!otpSent ? (
                    <button
                      type="submit"
                      disabled={sendingOtp || phone.replace(/\D/g, '').length < 10}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] text-white cursor-pointer disabled:opacity-60 mt-2 transition-all"
                      style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)', boxShadow: '0 2px 8px rgba(91,6,154,0.4)' }}
                    >
                      {sendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Send Login OTP</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 4}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] text-white cursor-pointer disabled:opacity-60 mt-2 transition-all"
                      style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)', boxShadow: '0 2px 8px rgba(91,6,154,0.4)' }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Verify & Sign in</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                  )}
                </form>
              )}

              <div className="mt-6 pt-5 border-t border-[#F2ECF7] text-center">
                <p className="text-[12.5px] text-[#534F66]">
                  Don't have a seller account?{' '}
                  <Link href="/register" className="font-semibold hover:underline" style={{ color: '#5B069A' }}>
                    Create workspace
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: '#F6EFFF', border: '1px solid #D6A8FF' }}>
                <Shield className="w-6 h-6 text-[#5B069A]" />
              </div>
              <h2 className="text-[22px] font-bold text-[#14121F] mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Two-factor auth
              </h2>
              <p className="text-[12.5px] text-[#534F66] mb-6">Enter the 6-digit code from your authenticator app.</p>
              <form onSubmit={handle2fa} className="space-y-4">
                <input type="text" required maxLength={6} value={totpToken}
                  onChange={e => setTotpToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="000 000"
                  className="w-full border rounded-2xl px-4 py-4 text-center text-3xl font-bold text-[#14121F] outline-none transition-all"
                  style={{ borderColor: '#E8DEF2', letterSpacing: '0.35em' }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#5B069A'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(91,6,154,0.15)'; }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#E8DEF2'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
                />
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-[13px] text-white cursor-pointer disabled:opacity-60 transition-all"
                  style={{ background: 'linear-gradient(135deg, #5B069A, #8410DC)', boxShadow: '0 2px 8px rgba(91,6,154,0.4)' }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Verify & Continue'}
                </button>
                <button type="button" onClick={() => setStage('credentials')}
                  className="w-full text-center text-[12px] font-semibold cursor-pointer" style={{ color: '#534F66' }}>
                  ← Back to sign in
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FD]">
        <Loader2 className="w-8 h-8 animate-spin text-[#5B069A]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
