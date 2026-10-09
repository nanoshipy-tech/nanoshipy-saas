'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Lock, Shield, KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    try {
      setSaving(true);
      const res = await apiClient.put('/settings/security/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (res.data.success) {
        toast.success('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Security Settings</h1>
        <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">Manage your password, 2FA authentication, and security preferences</p>
      </div>

      <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#F2ECF7] bg-white dark:bg-[#131620] shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#F2ECF7] pb-4">
          <KeyRound className="w-5 h-5 text-[#8410DC] dark:text-[#D6A8FF]" />
          <h2 className="text-base font-bold text-slate-900 dark:text-[#14121F]">Change Security Password</h2>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#8410DC] hover:bg-[#8410DC] disabled:bg-indigo-400 text-white font-semibold text-xs shadow-md transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {saving ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#F2ECF7] bg-white dark:bg-[#131620] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#14121F]">Two-Factor Authentication (2FA)</h3>
              <p className="text-xs text-[#7E7994] dark:text-[#534F66]">Add an extra layer of security using TOTP Authenticator apps</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            ENABLED
          </span>
        </div>
      </div>
    </div>
  );
}
