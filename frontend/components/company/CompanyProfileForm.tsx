'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/env';
import { apiClient } from '../../lib/apiClient';
import { useFileUpload } from '../../lib/useFileUpload';
import { Camera, Building2, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface CompanyProfile {
  legal_name: string | null;
  gstin: string | null;
  business_type: string | null;
  support_email: string | null;
  support_phone: string | null;
  logo_url: string | null;
}

export const CompanyProfileForm = () => {
  const [profile, setProfile] = useState<CompanyProfile>({
    legal_name: '',
    gstin: '',
    business_type: '',
    support_email: '',
    support_phone: '',
    logo_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { uploadFile, isUploading } = useFileUpload();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/company/profile');
        if (res?.data?.data) {
          const d = res.data.data;
          setProfile({
            legal_name: d.legal_name || d.company_name || '',
            gstin: d.gstin || '',
            business_type: d.business_type || '',
            support_email: d.support_email || '',
            support_phone: d.support_phone || '',
            logo_url: d.logo_url || null,
          });
        }
      } catch (err: any) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      setError('');
      const res = await uploadFile('/company/profile/logo', file, 'logo');
      const newLogoUrl = res?.data?.logo_url || res?.logo_url;
      if (newLogoUrl) {
        setProfile(prev => ({ ...prev, logo_url: newLogoUrl }));
      }
      toast.success('Logo uploaded successfully');
      setSuccess('Logo uploaded successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to upload logo';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await apiClient.put('/company/profile', profile);
      toast.success('Company profile updated successfully');
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to update profile';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const backendUrl = API_URL.replace('/api/v1', '');
  const logoUrl = profile?.logo_url 
    ? (profile.logo_url.startsWith('http') ? profile.logo_url : `${backendUrl}${profile.logo_url}`)
    : null;

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#131620] p-8 rounded-xl shadow-sm border border-slate-200 dark:border-[#F2ECF7] text-center text-xs font-semibold text-[#534F66]">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8410DC]" />
        Loading company profile...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-[#131620] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-[#F2ECF7]">
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs border border-red-200">{error}</div>}
      {success && <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl text-xs border border-emerald-200">{success}</div>}
      
      <div className="flex items-center space-x-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center overflow-hidden border border-slate-200 dark:border-[#E8DEF2]">
            {logoUrl ? (
              <img src={logoUrl} alt="Company Logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-8 h-8 text-[#8410DC]" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-[#8410DC] text-white p-1.5 rounded-full cursor-pointer hover:bg-[#730ec2] shadow-sm transition">
            <Camera className="w-3.5 h-3.5" />
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
          </label>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#14121F]">Company Logo</h3>
          <p className="text-xs text-[#7E7994] mt-0.5">JPG, PNG or SVG up to 2MB</p>
          {isUploading && <p className="text-xs text-[#8410DC] font-semibold mt-1">Uploading...</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Company / Legal Name</label>
          <input
            type="text"
            name="legal_name"
            placeholder="e.g. Acme Logistics Private Limited"
            value={profile.legal_name || ''}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-200 dark:border-[#E8DEF2] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white px-3.5 py-2.5 text-xs focus:border-[#8410DC] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">GSTIN Number</label>
          <input
            type="text"
            name="gstin"
            placeholder="e.g. 29ABCDE1234F1Z5"
            value={profile.gstin || ''}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-200 dark:border-[#E8DEF2] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white px-3.5 py-2.5 text-xs focus:border-[#8410DC] focus:outline-none uppercase"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Business Structure</label>
          <select
            name="business_type"
            value={profile.business_type || ''}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-200 dark:border-[#E8DEF2] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white px-3.5 py-2.5 text-xs focus:border-[#8410DC] focus:outline-none"
          >
            <option value="">Select Structure</option>
            <option value="individual">Individual / Proprietorship</option>
            <option value="partnership">Partnership Firm</option>
            <option value="llp">Limited Liability Partnership (LLP)</option>
            <option value="pvt_ltd">Private Limited Company</option>
            <option value="public_ltd">Public Limited Company</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Support Email</label>
          <input
            type="email"
            name="support_email"
            placeholder="support@company.com"
            value={profile.support_email || ''}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-200 dark:border-[#E8DEF2] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white px-3.5 py-2.5 text-xs focus:border-[#8410DC] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Support Phone / WhatsApp</label>
          <input
            type="text"
            name="support_phone"
            placeholder="+91 9876543210"
            value={profile.support_phone || ''}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-200 dark:border-[#E8DEF2] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white px-3.5 py-2.5 text-xs focus:border-[#8410DC] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#8410DC] hover:bg-[#8410DC] disabled:bg-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving Profile...' : 'Save Profile Changes'}
        </button>
      </div>
    </form>
  );
};
