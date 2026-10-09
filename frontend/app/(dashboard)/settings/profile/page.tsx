'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import { User, Mail, Phone, Shield, Save, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function ProfileSettingsPage() {
  const { user, setAuth, accessToken } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await apiClient.put('/settings/profile', { name, phone });
      if (res.data.success) {
        toast.success('Profile updated successfully!');
        if (res.data.data) {
          setAuth(res.data.data, accessToken || '');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Account Profile</h1>
        <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-1">Manage your personal account information and contact settings</p>
      </div>

      <SettingsNav />

      <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#F2ECF7] bg-white dark:bg-[#131620] shadow-sm space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-100 dark:border-[#F2ECF7] pb-6">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-[#8410DC]/10 border border-purple-200 dark:border-[#8410DC]/20 flex items-center justify-center text-[#8410DC] dark:text-[#D6A8FF] font-bold text-2xl uppercase">
            {(user?.name || 'U').charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-[#14121F]">{user?.name || 'User'}</h2>
            <p className="text-xs text-[#7E7994] dark:text-[#534F66]">{user?.email}</p>
            <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-[#8410DC]/10 text-[#8410DC] dark:text-[#D6A8FF] border border-purple-200 dark:border-[#8410DC]/20 capitalize">
              <Shield className="w-3 h-3" /> {user?.role?.name || (typeof user?.role === 'string' ? user?.role : 'Owner')}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-[#534F66]" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#E8DEF2] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#534F66]" />
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full bg-slate-100 dark:bg-white/[0.01] border border-slate-200 dark:border-[#F2ECF7] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#7E7994] dark:text-[#534F66] cursor-not-allowed"
              />
            </div>
            <p className="text-[10px] text-[#534F66] mt-1">Email address is managed by workspace administrator.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3 w-4 h-4 text-[#534F66]" />
              <input
                type="tel"
                placeholder="+91 9876543210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#E8DEF2] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#8410DC] hover:bg-[#8410DC] disabled:bg-indigo-400 text-white font-semibold text-xs shadow-md transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
