'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useAuth } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import { useTheme } from '@/lib/themeStore';

function AdminLoginContent() {
  const { setAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Screen: 'signin' | '2fa' | 'reset' | 'reset_success'
  const [screen, setScreen] = useState<'signin' | '2fa' | 'reset' | 'reset_success'>('signin');
  const [method, setMethod] = useState<'password' | 'otp'>('password');

  // Form states
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  // OTP State (6 separate boxes)
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [tempToken, setTempToken] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('89');
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Reset Password State
  const [resetEmail, setResetEmail] = useState('');

  // UI status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Resend Countdown
  useEffect(() => {
    let interval: any = null;
    if (screen === '2fa' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen, resendTimer]);

  const clearMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  // OTP handlers: Auto-advance, backspace, and paste support
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasteData[i] || '';
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pasteData.length, 5);
    otpRefs.current[nextIndex]?.focus();
  };

  // Submit Screen 1 (Admin sign in)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const trimmedInput = emailOrPhone.trim();
    if (!trimmedInput) {
      setErrorMsg('Enter a valid work email address.');
      return;
    }

    if (method === 'password') {
      if (!password || password.length < 8) {
        setErrorMsg('Password must be at least 8 characters.');
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.post('/platform/auth/login', {
          email: trimmedInput,
          password,
        });

        if (res.data?.success && res.data?.data?.access_token) {
          setAuth(res.data.data.admin, res.data.data.access_token, res.data.data.refresh_token);
          setSuccessMsg('Signed in successfully.');
          const searchParams = new URLSearchParams(window.location.search);
          const nextUrl = searchParams.get('next') || '/dashboard';
          setTimeout(() => { window.location.href = nextUrl; }, 300);
        } else if (res.data?.data?.requires_2fa) {
          setTempToken(res.data.data.temp_token || '');
          const phoneLast2 = res.data?.data?.masked_phone?.slice(-2) || '89';
          setMaskedMobile(phoneLast2);
          setScreen('2fa');
          setResendTimer(30);
          setCanResend(false);
          setOtp(['', '', '', '', '', '']);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } else {
          setErrorMsg('Invalid login response from server.');
        }
      } catch (err: any) {
        const serverError = err.response?.data?.error?.message || 'Admin login failed. Please check your credentials.';
        setErrorMsg(serverError);
      } finally {
        setLoading(false);
      }
    } else {
      // Mobile OTP Login
      const phoneDigits = trimmedInput.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        setErrorMsg('Enter a valid 10-digit mobile number.');
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.post('/platform/auth/send-otp', {
          phone: phoneDigits,
        });

        setMaskedMobile(phoneDigits.slice(-2));
        setScreen('2fa');
        setResendTimer(30);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        setSuccessMsg(res.data?.message || 'OTP sent to mobile via SMS & WhatsApp.');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } catch (err: any) {
        const errMsg = err.response?.data?.error?.message || 'Failed to send OTP to this number.';
        setErrorMsg(errMsg);
      } finally {
        setLoading(false);
      }
    }
  };

  // Submit Screen 2 (Two-step verification)
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      setErrorMsg('Enter the full 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      let res: any;
      if (method === 'otp') {
        const phoneDigits = emailOrPhone.replace(/\D/g, '');
        res = await apiClient.post('/platform/auth/login-otp', {
          phone: phoneDigits,
          otp: fullOtp,
        });
      } else {
        const headers = tempToken ? { Authorization: `Bearer ${tempToken}` } : undefined;
        res = await apiClient.post(
          '/platform/auth/2fa/verify',
          { token: fullOtp },
          { headers }
        );
      }

      if (res.data?.success && res.data?.data?.access_token) {
        setAuth(res.data.data.admin, res.data.data.access_token, res.data.data.refresh_token);
        const searchParams = new URLSearchParams(window.location.search);
        const nextUrl = searchParams.get('next') || '/dashboard';
        window.location.href = nextUrl;
      } else {
        setErrorMsg('Verification failed — invalid token.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Invalid or expired 6-digit OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    clearMessages();
    setCanResend(false);
    setResendTimer(30);

    try {
      await apiClient.post('/platform/auth/resend-2fa', { temp_token: tempToken }).catch(() => {});
      setSuccessMsg('A new OTP has been sent.');
    } catch (_) {
      setSuccessMsg('A new OTP has been sent.');
    }
  };

  // Submit Screen 3 (Password Reset)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const email = resetEmail.trim();
    if (!email || !email.includes('@')) {
      setErrorMsg('Enter a valid work email address.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/platform/auth/forgot-password', { email });
    } catch (_) {
      // Per spec: Never reveal whether an email exists
    } finally {
      setLoading(false);
      setScreen('reset_success');
    }
  };

  return (
    <div className="grid min-h-screen w-full grid-cols-1 min-[900px]:grid-cols-[1.05fr_1fr] bg-[var(--bg)] text-[var(--ink)]">
      {/* ── HERO PANEL ── */}
      <section
        className="flex flex-col justify-between p-6 sm:p-10 min-[900px]:p-[40px_56px] text-[#b8c4d0] relative overflow-hidden"
        style={{ background: 'var(--sidebar)' }}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-[46px] h-[46px] rounded-[13px] flex items-center justify-center font-extrabold text-[24px] text-white select-none"
            style={{ background: 'var(--brand)' }}
          >
            N
          </div>
          <span className="text-white font-extrabold text-[28px] tracking-[-0.02em]">
            Nanoshipy
          </span>
        </div>

        {/* Hero Content */}
        <div className="my-8 max-w-[480px]">
          <h1 className="text-white text-[28px] sm:text-[34px] lg:text-[36px] font-extrabold leading-[1.18] tracking-[-0.03em] mb-3">
            Admin console for the whole platform.
          </h1>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-[#b8c4d0] mb-7">
            Manage sellers, couriers, KYC approvals, remittance and disputes from one secure place.
          </p>

          {/* Translucent Tracking Card */}
          <div
            className="rounded-[14px] p-4 mb-8"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <div className="flex justify-between items-center text-white text-[13px] font-bold">
              <span>NS-ADMIN-NETWORK</span>
              <small className="text-[#b8c4d0] font-normal text-[11px]">Real-time carrier sync</small>
            </div>
            <div className="flex items-center my-3.5">
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--brand)' }} />
              <u className="h-[2px] flex-1" style={{ background: 'var(--brand)' }} />
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--brand)' }} />
              <u className="h-[2px] flex-1" style={{ background: 'var(--brand)' }} />
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--brand)' }} />
              <u className="h-[2px] flex-1 opacity-25" style={{ background: 'rgba(255,255,255,0.25)' }} />
              <i className="w-2.5 h-2.5 rounded-full opacity-30" style={{ background: 'rgba(255,255,255,0.25)' }} />
            </div>
            <div className="flex justify-between text-[11px] text-[#b8c4d0]">
              <span>Gateways</span>
              <span>Allocated</span>
              <span>In Transit</span>
              <span>Settled</span>
            </div>
          </div>

          {/* Three Live Stats */}
          <div className="flex flex-wrap gap-7 pt-2 border-t border-white/10">
            <div>
              <b className="block text-white text-[22px] font-extrabold tracking-[-0.02em] font-variant-numeric tabular-nums">
                3,400+
              </b>
              <span className="text-[12.5px] text-[#b8c4d0]">Sellers</span>
            </div>
            <div>
              <b className="block text-white text-[22px] font-extrabold tracking-[-0.02em] font-variant-numeric tabular-nums">
                19,000+
              </b>
              <span className="text-[12.5px] text-[#b8c4d0]">Pincodes</span>
            </div>
            <div>
              <b className="block text-white text-[22px] font-extrabold tracking-[-0.02em] font-variant-numeric tabular-nums">
                91%
              </b>
              <span className="text-[12.5px] text-[#b8c4d0]">On-time delivery</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[12px] text-[#b8c4d0]/80">
          © {new Date().getFullYear()} Nanoshipy Logistics. All rights reserved. -{' '}
          <a
            href="https://growax360.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline font-semibold text-white/90"
          >
            Growax360
          </a>
        </div>
      </section>

      {/* ── FORM PANEL ── */}
      <section className="flex flex-col justify-center items-center p-6 sm:p-12 relative min-h-[500px]">
        {/* Theme Toggle Top-Right */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle light or dark theme"
          className="absolute top-5 right-6 text-[13px] font-semibold px-3 py-1.5 rounded-[10px] cursor-pointer transition-colors"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
          }}
        >
          Theme: {theme === 'dark' ? 'Dark' : 'Light'}
        </button>

        {/* Form Container (max-width: 420px) */}
        <div className="w-full max-w-[420px]">
          {/* Inline Alert / Notification Area */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-4 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold"
              style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}
            >
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div
              role="alert"
              className="mb-4 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold"
              style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}
            >
              {successMsg}
            </div>
          )}

          {/* ═════════ SCREEN 1: ADMIN SIGN IN ═════════ */}
          {screen === 'signin' && (
            <div>
              <h2 className="text-[26px] font-extrabold tracking-[-0.02em] mb-1 text-[var(--ink)]">
                Admin sign in
              </h2>
              <p className="text-[13px] text-[var(--muted)] mb-5">
                Restricted access. Authorised staff only.
              </p>

              {/* Login Method Segmented Control */}
              <div
                role="group"
                aria-label="Sign in method"
                className="flex p-1 mb-5 rounded-[10px]"
                style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
              >
                <button
                  type="button"
                  aria-pressed={method === 'password'}
                  onClick={() => { setMethod('password'); clearMessages(); }}
                  className={`flex-1 py-1.5 text-[12.5px] font-bold rounded-[7px] cursor-pointer transition-all ${
                    method === 'password'
                      ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Work email & password
                </button>
                <button
                  type="button"
                  aria-pressed={method === 'otp'}
                  onClick={() => { setMethod('otp'); clearMessages(); }}
                  className={`flex-1 py-1.5 text-[12.5px] font-bold rounded-[7px] cursor-pointer transition-all ${
                    method === 'otp'
                      ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Mobile number OTP
                </button>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                <div>
                  <label className="block text-[13px] font-semibold text-[var(--ink)] mb-1.5">
                    {method === 'password' ? 'Work email' : 'Mobile number'}
                  </label>
                  <div
                    className="flex items-center px-3 rounded-[10px] transition-all focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand)]"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    {method === 'otp' && (
                      <span className="font-bold text-[var(--muted)] pr-2.5 mr-2.5 border-r border-[var(--line)] select-none">
                        +91
                      </span>
                    )}
                    <input
                      type={method === 'password' ? 'email' : 'tel'}
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      placeholder={method === 'password' ? 'care@nanoshipy.com' : '10-digit mobile number'}
                      autoComplete={method === 'password' ? 'username' : 'tel-national'}
                      maxLength={method === 'otp' ? 10 : undefined}
                      className="w-full py-2.5 bg-transparent border-0 outline-none text-[14px] text-[var(--ink)]"
                      required
                    />
                  </div>
                </div>

                {method === 'password' && (
                  <div>
                    <label className="block text-[13px] font-semibold text-[var(--ink)] mb-1.5">
                      Password
                    </label>
                    <div
                      className="flex items-center px-3 rounded-[10px] transition-all focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand)]"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className="w-full py-2.5 bg-transparent border-0 outline-none text-[14px] text-[var(--ink)]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="text-[12.5px] font-bold cursor-pointer ml-2"
                        style={{ color: 'var(--brand)' }}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Keep me signed in + Forgot password */}
                <div className="flex items-center justify-between text-[13px] pt-1 pb-1">
                  <label className="inline-flex items-center gap-2 text-[var(--muted)] font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={(e) => setKeepSignedIn(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--brand)' }}
                    />
                    <span>Keep me signed in</span>
                  </label>
                  {method === 'password' && (
                    <button
                      type="button"
                      onClick={() => { setScreen('reset'); clearMessages(); }}
                      className="font-bold cursor-pointer"
                      style={{ color: 'var(--brand)' }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-[10px] text-[15px] font-bold cursor-pointer transition-opacity"
                  style={{
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? 'Please wait...' : method === 'password' ? 'Continue' : 'Send OTP'}
                </button>
              </form>
            </div>
          )}

          {/* ═════════ SCREEN 2: TWO-STEP VERIFICATION ═════════ */}
          {screen === '2fa' && (
            <div>
              <button
                type="button"
                onClick={() => { setScreen('signin'); clearMessages(); }}
                className="text-[13px] font-bold mb-4 inline-block cursor-pointer"
                style={{ color: 'var(--brand)' }}
              >
                &larr; Back
              </button>

              <h2 className="text-[26px] font-extrabold tracking-[-0.02em] mb-1 text-[var(--ink)]">
                Two-step verification
              </h2>
              <p className="text-[13px] text-[var(--muted)] mb-5">
                Enter the 6-digit code sent to your registered mobile ending in {maskedMobile}.
              </p>

              <form onSubmit={handleVerify2FA} className="space-y-4" noValidate>
                {/* 6 OTP Boxes */}
                <div className="flex gap-2 justify-between my-4">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      aria-label="OTP digit"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="w-full h-12 text-center text-[18px] font-bold rounded-[10px] outline-none transition-all focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink)',
                      }}
                    />
                  ))}
                </div>

                {/* Resend Timer & Button */}
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-[var(--muted)]">Didn't receive the code?</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={!canResend}
                    className="font-bold cursor-pointer disabled:opacity-50 disabled:cursor-default"
                    style={{ color: 'var(--brand)' }}
                  >
                    {canResend ? 'Resend OTP' : `Resend in ${resendTimer}s`}
                  </button>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-[10px] text-[15px] font-bold cursor-pointer transition-opacity"
                  style={{
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? 'Verifying...' : 'Verify and sign in'}
                </button>
              </form>
            </div>
          )}

          {/* ═════════ SCREEN 3: RESET YOUR PASSWORD ═════════ */}
          {screen === 'reset' && (
            <div>
              <button
                type="button"
                onClick={() => { setScreen('signin'); clearMessages(); }}
                className="text-[13px] font-bold mb-4 inline-block cursor-pointer"
                style={{ color: 'var(--brand)' }}
              >
                &larr; Back to sign in
              </button>

              <h2 className="text-[26px] font-extrabold tracking-[-0.02em] mb-1 text-[var(--ink)]">
                Reset your password
              </h2>
              <p className="text-[13px] text-[var(--muted)] mb-5">
                We will send a reset link to verify your identity.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
                <div>
                  <label className="block text-[13px] font-semibold text-[var(--ink)] mb-1.5">
                    Work email
                  </label>
                  <div
                    className="flex items-center px-3 rounded-[10px] transition-all focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand)]"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="care@nanoshipy.com"
                      autoComplete="email"
                      className="w-full py-2.5 bg-transparent border-0 outline-none text-[14px] text-[var(--ink)]"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-[10px] text-[15px] font-bold cursor-pointer transition-opacity"
                  style={{
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? 'Sending link...' : 'Send reset link'}
                </button>
              </form>
            </div>
          )}

          {/* ═════════ SCREEN 3 SUCCESS: CHECK YOUR EMAIL ═════════ */}
          {screen === 'reset_success' && (
            <div className="text-center py-4">
              <div
                className="w-[52px] h-[52px] rounded-full mx-auto mb-4 flex items-center justify-center text-[26px] font-extrabold"
                style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}
              >
                &#10003;
              </div>
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em] mb-2 text-[var(--ink)]">
                Check your email
              </h2>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-6">
                If the address belongs to an admin account, a reset link is on its way.
              </p>
              <button
                type="button"
                onClick={() => { setScreen('signin'); clearMessages(); }}
                className="w-full py-3 rounded-[10px] text-[14px] font-bold cursor-pointer"
                style={{
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                }}
              >
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)] flex items-center justify-center font-bold text-[var(--muted)]">Loading...</div>}>
      <AdminLoginContent />
    </Suspense>
  );
}
