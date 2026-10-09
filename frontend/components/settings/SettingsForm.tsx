'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import {
  Settings, Save, RotateCcw, Info, MapPin, FileText, AlertTriangle, Wallet,
  Printer, Sparkles, Tag, ShieldCheck, Image as ImageIcon, Upload, Check
} from 'lucide-react';
import { useFileUpload } from '@/lib/useFileUpload';

interface SettingField {
  value: any;
  is_override: boolean;
  source: 'tenant_override' | 'platform_default' | 'env_fallback';
}

interface TenantSettings {
  invoice_prefix?: SettingField;
  order_prefix?: SettingField;
  label_prefix?: SettingField;
  default_label_format?: SettingField;
  label_logo_url?: SettingField;
  ndr_auto_rto_threshold?: SettingField;
  low_balance_threshold?: SettingField;
  default_pickup_address_id?: SettingField;
}

interface PickupAddress {
  id: string;
  label: string;
  address_line1: string;
  city: string;
}

const SOURCE_LABELS: Record<string, string> = {
  tenant_override: 'Tenant override',
  platform_default: 'Platform default',
  env_fallback: 'System default',
};

const SourceBadge = ({ source }: { source: string }) => {
  const colors: Record<string, string> = {
    tenant_override: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    platform_default: 'bg-[#8410DC]/20 text-purple-300 border-[#8410DC]/30',
    env_fallback: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${colors[source] || colors.env_fallback}`}>
      <Info className="w-2.5 h-2.5" />
      {SOURCE_LABELS[source] || source}
    </span>
  );
};

export default function SettingsForm() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [addresses, setAddresses] = useState<PickupAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { uploadFile, isUploading: isUploadingLogo } = useFileUpload();

  // Form state
  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [orderPrefix, setOrderPrefix] = useState('ORD-');
  const [labelPrefix, setLabelPrefix] = useState('NSP-');
  const [defaultLabelFormat, setDefaultLabelFormat] = useState('4x6');
  const [labelLogoUrl, setLabelLogoUrl] = useState('');
  const [ndrThreshold, setNdrThreshold] = useState('');
  const [lowBalance, setLowBalance] = useState('');
  const [defaultAddressId, setDefaultAddressId] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, addressRes] = await Promise.all([
        apiClient.get('/settings'),
        apiClient.get('/addresses'),
      ]);
      if (settingsRes.data.success) {
        const s: any = settingsRes.data.data;
        setSettings(s);
        setInvoicePrefix(s.invoice_prefix?.value ?? 'INV');
        setOrderPrefix(s.order_prefix?.value ?? 'ORD-');
        setLabelPrefix(s.label_prefix?.value ?? 'NSP-');
        setDefaultLabelFormat(s.default_label_format?.value ?? '4x6');
        setLabelLogoUrl(s.label_logo_url?.value ?? '');
        setNdrThreshold(s.ndr_auto_rto_threshold?.value ?? '3');
        setLowBalance(s.low_balance_threshold?.value ?? '500');
        setDefaultAddressId(s.default_pickup_address_id?.value ?? '');

        if (!s.label_logo_url?.value) {
          try {
            const profileRes = await apiClient.get('/company/profile');
            if (profileRes.data?.data?.logo_url) {
              setLabelLogoUrl(profileRes.data.data.logo_url);
            }
          } catch (_) {}
        }
      }
      if (addressRes.data.success) {
        setAddresses(addressRes.data.data?.addresses || addressRes.data.data || []);
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const res = await uploadFile('/company/profile/logo', file, 'logo');
      const newLogoUrl = res?.data?.logo_url || res?.logo_url;
      if (newLogoUrl) {
        setLabelLogoUrl(newLogoUrl);
        toast.success('Merchant brand logo uploaded successfully!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to upload logo');
    }
  };

  const handleUseCompanyLogo = async () => {
    try {
      const res = await apiClient.get('/company/profile');
      const compLogo = res.data?.data?.logo_url;
      if (compLogo) {
        setLabelLogoUrl(compLogo);
        toast.success('Attached company profile logo!');
      } else {
        toast.error('No company profile logo found. Please upload one below.');
      }
    } catch (err: any) {
      toast.error('Failed to fetch company profile logo');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (invoicePrefix !== (settings?.invoice_prefix?.value ?? '')) {
        payload.invoice_prefix = invoicePrefix || null;
      }
      if (orderPrefix !== (settings?.order_prefix?.value ?? 'ORD-')) {
        payload.order_prefix = orderPrefix || null;
      }
      if (labelPrefix !== (settings?.label_prefix?.value ?? 'NSP-')) {
        payload.label_prefix = labelPrefix || null;
      }
      if (defaultLabelFormat !== (settings?.default_label_format?.value ?? '4x6')) {
        payload.default_label_format = defaultLabelFormat || null;
      }
      if (labelLogoUrl !== (settings?.label_logo_url?.value ?? '')) {
        payload.label_logo_url = labelLogoUrl || null;
      }
      if (String(ndrThreshold) !== String(settings?.ndr_auto_rto_threshold?.value ?? '')) {
        payload.ndr_auto_rto_threshold = ndrThreshold ? parseInt(ndrThreshold) : null;
      }
      if (String(lowBalance) !== String(settings?.low_balance_threshold?.value ?? '')) {
        payload.low_balance_threshold = lowBalance ? parseFloat(lowBalance) : null;
      }
      if (defaultAddressId !== (settings?.default_pickup_address_id?.value ?? '')) {
        payload.default_pickup_address_id = defaultAddressId || null;
      }

      if (Object.keys(payload).length === 0) {
        toast.success('Settings are up to date');
        return;
      }

      await apiClient.put('/settings', payload);
      toast.success('Settings and prefix configurations saved successfully');
      await fetchSettings();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to save settings';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (key: string) => {
    apiClient.put('/settings', { [key]: null })
      .then(() => { toast.success('Setting reverted to platform default'); fetchSettings(); })
      .catch(() => toast.error('Failed to revert setting'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. SHIPPING LABEL GENERATION & BRANDING */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Shipping Label & Branding Engine</h3>
              <p className="text-xs text-slate-400">Configure label dimensions, custom brand logos, and NanoShipy ecosystem branding</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-[#8410DC]/30 text-purple-300 border border-[#8410DC]/40 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> NanoShipy Verified Engine
          </span>
        </div>

        {/* Brand Logos Preview & Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card A: Official NanoShipy Ecosystem Badge (Always Present) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900/50 to-slate-950/60 border border-purple-500/30 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-900/60 border border-purple-400/40 p-1 flex items-center justify-center shrink-0 shadow-lg shadow-purple-950/50">
              <img
                src="/logo.png"
                alt="NanoShipy Logo"
                className="w-12 h-12 rounded-xl object-contain"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black text-white uppercase tracking-wider">NanoShipy Brand Logo</p>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Mandatory Badge
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Official verified badge embedded in header and footer of every label across all thermal & standard formats.
              </p>
            </div>
          </div>

          {/* Card B: Merchant Store Brand Logo (Customizable) */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-white/15 p-1 flex items-center justify-center shrink-0 overflow-hidden">
              {labelLogoUrl ? (
                <img
                  src={labelLogoUrl.startsWith('http') ? labelLogoUrl : `${process.env.NEXT_PUBLIC_API_URL || 'https://api.nanoshipy.com'}${labelLogoUrl}`}
                  alt="Merchant Brand Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black text-white uppercase tracking-wider">Merchant Brand Logo</p>
                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${labelLogoUrl ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-400'}`}>
                  {labelLogoUrl ? 'Active on Label' : 'Using Store Name'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Appears in the sub-header of every shipping label alongside the courier partner.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Default Print Label Size
            </label>
            <select
              value={defaultLabelFormat}
              onChange={e => setDefaultLabelFormat(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-4 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-purple-500"
            >
              <option value="4x6">4" × 6" Thermal Roll Standard (Recommended)</option>
              <option value="4x4">4" × 4" Thermal Square Label</option>
              <option value="3x5">3" × 5" Compact Thermal Label</option>
              <option value="a4">A4 Single Full Label</option>
              <option value="a4_4in1">A4 4-in-1 Quad Grid (4 labels / page)</option>
              <option value="a4_2in1">A4 2-in-1 Dual Layout (2 labels / page)</option>
              <option value="a6">A6 Standard Pocket Format</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">High-contrast Code128 barcodes + live tracking QR codes render automatically.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300">
                Custom Merchant Brand Logo
              </label>
              <button
                type="button"
                onClick={handleUseCompanyLogo}
                className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 underline cursor-pointer"
              >
                Use Company Profile Logo
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={labelLogoUrl}
                onChange={e => setLabelLogoUrl(e.target.value)}
                placeholder="https://yourstore.com/logo.png or upload below"
                className="flex-1 bg-slate-900/80 border border-white/15 rounded-xl px-4 py-2 text-white text-xs font-bold focus:outline-none focus:border-purple-500 placeholder-slate-600"
              />
              <label className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">Upload PNG, JPG, or WebP logo to display on your labels.</p>
          </div>
        </div>
      </div>

      {/* 2. NUMBERING & PREFIX GENERATION */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Numbering & Reference Prefixes</h3>
            <p className="text-xs text-slate-400">Custom identifier prefixes for Orders, Invoices, and Tracking records</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Invoice Number Prefix
            </label>
            <input
              id="invoice-prefix-input"
              type="text"
              value={invoicePrefix}
              onChange={e => setInvoicePrefix(e.target.value.toUpperCase())}
              placeholder="INV"
              maxLength={20}
              className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-4 py-2.5 text-white font-mono text-xs font-bold focus:outline-none focus:border-purple-500"
            />
            <p className="text-[10px] text-slate-500 mt-1 font-mono">Ex: {invoicePrefix || 'INV'}/2026-27/0001</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Order Reference Prefix
            </label>
            <input
              type="text"
              value={orderPrefix}
              onChange={e => setOrderPrefix(e.target.value.toUpperCase())}
              placeholder="ORD-"
              maxLength={15}
              className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-4 py-2.5 text-white font-mono text-xs font-bold focus:outline-none focus:border-purple-500"
            />
            <p className="text-[10px] text-slate-500 mt-1 font-mono">Ex: {orderPrefix || 'ORD-'}98421</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Label / Tracking Prefix
            </label>
            <input
              type="text"
              value={labelPrefix}
              onChange={e => setLabelPrefix(e.target.value.toUpperCase())}
              placeholder="NSP-"
              maxLength={15}
              className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-4 py-2.5 text-white font-mono text-xs font-bold focus:outline-none focus:border-purple-500"
            />
            <p className="text-[10px] text-slate-500 mt-1 font-mono">Ex: {labelPrefix || 'NSP-'}LBL-7001</p>
          </div>
        </div>
      </div>

      {/* 3. NDR / DELIVERY SETTINGS */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 mb-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">NDR & Delivery Workflows</h3>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Auto-RTO Threshold (Failed Delivery Attempts)
          </label>
          <input
            id="ndr-threshold-input"
            type="number"
            min={1}
            max={10}
            value={ndrThreshold}
            onChange={e => setNdrThreshold(e.target.value)}
            placeholder="3"
            className="w-36 bg-slate-900/80 border border-white/15 rounded-xl px-4 py-2.5 text-white font-bold text-xs focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* 4. WALLET & RECHARGE THRESHOLD */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 mb-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white">Wallet & Low Balance Alerts</h3>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Low Balance Alert Trigger (₹)
          </label>
          <input
            type="number"
            min={100}
            step={50}
            value={lowBalance}
            onChange={e => setLowBalance(e.target.value)}
            placeholder="500"
            className="w-48 bg-slate-900/80 border border-white/15 rounded-xl px-4 py-2.5 text-white font-bold text-xs focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-[#8410DC] hover:bg-[#6c0cb5] text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-purple-900/30 transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving Configurations...' : 'Save Settings & Prefixes'}
        </button>
      </div>
    </div>
  );
}
