'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { ShieldCheck, Lock, CheckCircle, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token') || '';
  const subUserId = searchParams.get('sub_user_id') || searchParams.get('id') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !subUserId) {
      setError('Missing invitation token or user identifier. Please check your invitation link.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.post('/sub-users/accept-invite', {
        sub_user_id: subUserId,
        token,
        password,
      });

      if (res.data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2500);
      } else {
        throw new Error(res.data.error?.message || 'Failed to accept invitation');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Invitation acceptance failed. Token may be expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Invitation Accepted!</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Your account is now activated. You will be redirected to the login page in a moment...
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8410DC] hover:text-[#5B069A] pt-2"
        >
          Go to Login Now <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl max-w-md w-full space-y-6">
      <div className="text-center space-y-1">
        <div className="w-11 h-11 bg-purple-50 text-[#8410DC] rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-purple-100">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Accept Team Invitation</h1>
        <p className="text-xs text-slate-500">
          Set up your secure password to join your organization workspace on Nanoshipy.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 p-3.5 rounded-xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-[#8410DC] outline-none transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-[#8410DC] outline-none transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Activating Account...</span>
            </>
          ) : (
            <span>Activate Account & Log In</span>
          )}
        </button>
      </form>

      <div className="text-center pt-2 border-t border-slate-100">
        <Link href="/login" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
          Already activated? Return to Login
        </Link>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7FD] p-4 font-sans">
      <Suspense fallback={<div className="text-xs text-slate-500">Loading invitation form...</div>}>
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
