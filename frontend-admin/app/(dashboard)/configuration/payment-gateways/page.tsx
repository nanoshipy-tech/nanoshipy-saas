'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  RefreshCw, Check, Copy, Eye, EyeOff, ChevronDown, ChevronUp, FileText, Settings, X
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ──────────── Real Payment Gateway SVG Logos ──────────── */
const RazorpayLogo = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
    <rect width="40" height="40" rx="8" fill="#0C2451"/>
    <path d="M11 28L18 12H22L15.5 26H24L22.5 28H11Z" fill="white"/>
    <path d="M20 12H24L28 20L24.5 28H20.5L24 20L20 12Z" fill="#3395FF"/>
  </svg>
);

const CashfreeLogo = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
    <rect width="40" height="40" rx="8" fill="#00B899"/>
    <circle cx="20" cy="20" r="9" stroke="white" strokeWidth="3" fill="none"/>
    <path d="M16 20 C16 17.8 17.8 16 20 16 C21.5 16 22.8 16.8 23.5 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M24 22 C23.3 23.2 22 24 20 24 C17.8 24 16 22.2 16 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
  </svg>
);

const PayULogo = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
    <rect width="40" height="40" rx="8" fill="#5F259F"/>
    <text x="8" y="27" fontFamily="Arial" fontWeight="900" fontSize="17" fill="white">Pa</text>
    <text x="24" y="27" fontFamily="Arial" fontWeight="900" fontSize="17" fill="#FFC107">U</text>
  </svg>
);

const PhonePeLogo = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
    <rect width="40" height="40" rx="8" fill="#5F259F"/>
    <path d="M20 8 C14 8 10 12 10 18 L10 28 C10 30 11 31 13 31 L14 31 C14 31 14 33 16 33 L22 33 C24 33 24 31 24 31 L27 31 C29 31 30 30 30 28 L30 18 C30 12 26 8 20 8Z" fill="white"/>
    <circle cx="20" cy="19" r="5" fill="#5F259F"/>
    <path d="M20 22 L24 28" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ManualLogo = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
    <rect width="40" height="40" rx="8" fill="#6B7280"/>
    <rect x="10" y="13" width="20" height="14" rx="2" stroke="white" strokeWidth="2" fill="none"/>
    <path d="M10 18 L30 18" stroke="white" strokeWidth="2"/>
    <rect x="14" y="22" width="5" height="2" rx="1" fill="white"/>
  </svg>
);

const PROVIDER_META: Record<string, { logo: React.ReactNode; name: string }> = {
  razorpay:  { logo: <RazorpayLogo />,  name: 'Razorpay' },
  cashfree:  { logo: <CashfreeLogo />,  name: 'Cashfree' },
  payu:      { logo: <PayULogo />,      name: 'PayU' },
  phonepe:   { logo: <PhonePeLogo />,   name: 'PhonePe PG' },
  manual:    { logo: <ManualLogo />,    name: 'Manual / Bank Transfer' },
};

export default function PaymentGatewaysPage() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>({
    min_recharge: 500,
    max_recharge: 500000,
    presets: [500, 1000, 2000, 5000],
    fee_percent: 0,
    auto_gst_invoice: true,
    gst_percent: 18,
    gstin: '',
    gst_on_convenience_fee_only: true,
  });
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>('razorpay');
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, any>>({});
  const [savingGateway, setSavingGateway] = useState<Record<string, boolean>>({});
  const [newPreset, setNewPreset] = useState('');

  // Computed KPI stats (derived from real data, not hardcoded)
  const configuredCount = gateways.filter(g => g.api_secret_status === 'Configured').length;
  const activeDefault = gateways.find(g => g.is_default && g.is_active);
  const totalCount = gateways.length;

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/platform/payment-gateways');
      if (res.data.success) {
        const list = res.data.data.gateways || [];
        setGateways(list);
        if (res.data.data.global_settings) {
          setGlobalSettings((prev: any) => ({ ...prev, ...res.data.data.global_settings }));
        }
        const initialForm: Record<string, any> = {};
        list.forEach((g: any) => {
          initialForm[g.name] = {
            mode: g.mode || 'test',
            api_key: g.api_key || '',
            api_secret: g.api_secret || '',
            webhook_secret: g.webhook_secret || '',
          };
        });
        setFormState(initialForm);
      }
    } catch {
      toast.error('Failed to load payment gateways');
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalSave = async () => {
    try {
      setSavingGlobal(true);
      const res = await apiClient.put('/platform/payment-gateways/global-settings', globalSettings);
      if (res.data.success) {
        toast.success('Global recharge settings updated');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save global settings');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleGatewaySave = async (provider: string) => {
    try {
      setSavingGateway(prev => ({ ...prev, [provider]: true }));
      const state = formState[provider];
      const res = await apiClient.post(`/platform/payment-gateways/${provider}`, {
        mode: state.mode,
        api_key: state.api_key,
        api_secret: state.api_secret,
        webhook_secret: state.webhook_secret,
      });
      if (res.data.success) {
        toast.success(`Saved credentials for ${provider.toUpperCase()}`);
        fetchGateways();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save credentials');
    } finally {
      setSavingGateway(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleActivateToggle = async (provider: string, currentActive: boolean) => {
    try {
      const res = await apiClient.patch(`/platform/payment-gateways/${provider}/activate`, {
        is_active: !currentActive,
      });
      if (res.data.success) {
        toast.success(`${provider.toUpperCase()} status updated`);
        fetchGateways();
      }
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  const handleSetDefault = async (provider: string) => {
    try {
      const res = await apiClient.patch(`/platform/payment-gateways/${provider}/activate`, {
        is_default: true,
        is_active: true,
      });
      if (res.data.success) {
        toast.success(`${provider.toUpperCase()} is now the active default gateway`);
        fetchGateways();
      }
    } catch {
      toast.error('Failed to set default gateway');
    }
  };

  const handleTestConnection = async (provider: string) => {
    try {
      setTesting(prev => ({ ...prev, [provider]: true }));
      setTestResult(prev => ({ ...prev, [provider]: null }));
      const res = await apiClient.post(`/platform/payment-gateways/${provider}/test`);
      if (res.data.success) {
        setTestResult(prev => ({ ...prev, [provider]: { success: true, message: res.data.data?.message || 'Connection test passed' } }));
        toast.success(`Connection test passed for ${provider.toUpperCase()}`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Test connection failed';
      setTestResult(prev => ({ ...prev, [provider]: { success: false, message: msg } }));
      toast.error(msg);
    } finally {
      setTesting(prev => ({ ...prev, [provider]: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    toast.success('Webhook URL copied');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const addPreset = () => {
    const val = parseInt(newPreset);
    if (!val || val < 1) return toast.error('Enter a valid preset amount');
    if (globalSettings.presets.includes(val)) return toast.error('Preset already exists');
    setGlobalSettings({ ...globalSettings, presets: [...globalSettings.presets, val].sort((a, b) => a - b) });
    setNewPreset('');
  };

  const removePreset = (amt: number) => {
    setGlobalSettings({ ...globalSettings, presets: globalSettings.presets.filter((p: number) => p !== amt) });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Payment Gateways</h1>
          <div className="text-xs text-[#7E7994] mt-0.5">Configuration → Payment Gateways</div>
        </div>
        <button
          onClick={fetchGateways}
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-semibold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync status</span>
        </button>
      </div>

      {/* KPI Stats — computed from real data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-[#7E7994] mb-2 font-medium">Active default gateway</div>
          {loading ? (
            <div className="h-7 w-24 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="text-xl font-bold text-slate-900">
              {activeDefault ? (PROVIDER_META[activeDefault.name]?.name || activeDefault.display_name) : '—'}
            </div>
          )}
          <div className="text-[11.5px] text-[#7E7994] mt-1 font-medium capitalize">
            {activeDefault ? `${activeDefault.mode} mode` : 'No default set'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-[#7E7994] mb-2 font-medium">Gateways configured</div>
          {loading ? (
            <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="text-xl font-bold text-slate-900">{configuredCount} / {totalCount}</div>
          )}
          <div className="text-[11.5px] text-[#7E7994] mt-1 font-medium">
            {totalCount - configuredCount > 0 ? `${totalCount - configuredCount} not configured` : 'All configured'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-[#7E7994] mb-2 font-medium">GST on recharge</div>
          <div className="text-xl font-bold text-slate-900">
            {globalSettings.auto_gst_invoice ? `${globalSettings.gst_percent || 18}%` : 'Off'}
          </div>
          <div className="text-[11.5px] text-[#7E7994] mt-1 font-medium">
            {globalSettings.auto_gst_invoice ? 'Auto-invoice enabled' : 'GST invoice disabled'}
          </div>
        </div>
      </div>

      {/* Global Recharge Settings */}
      <div className="bg-white border border-[#e7e7ea] rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-[#eef0f2] flex items-center justify-between">
          <div>
            <h3 className="text-[14.5px] font-semibold text-[#15161a] flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#6b6d76]" />
              Global recharge settings
            </h3>
            <div className="text-xs text-[#6b6d76] mt-0.5">Applies to the seller-facing Add Money flow in the Tenant Portal</div>
          </div>
          <button
            onClick={handleGlobalSave}
            disabled={savingGlobal}
            className="px-4 py-2 rounded-xl bg-[#ff5a1f] hover:bg-[#e04c15] disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            {savingGlobal ? 'Saving...' : 'Save global settings'}
          </button>
        </div>

        <div className="p-5 bg-[#fbfbfc] border-b border-[#e7e7ea] space-y-5">
          {/* Row 1: Limits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">Minimum recharge amount (₹)</label>
              <input
                type="number"
                value={globalSettings.min_recharge}
                onChange={(e) => setGlobalSettings({ ...globalSettings, min_recharge: Number(e.target.value) })}
                className="w-full bg-white border border-[#e7e7ea] rounded-lg px-3 py-2 text-xs font-medium text-[#15161a] focus:outline-none focus:border-[#111]"
              />
            </div>

            <div>
              <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">Maximum per transaction (₹)</label>
              <input
                type="number"
                value={globalSettings.max_recharge}
                onChange={(e) => setGlobalSettings({ ...globalSettings, max_recharge: Number(e.target.value) })}
                className="w-full bg-white border border-[#e7e7ea] rounded-lg px-3 py-2 text-xs font-medium text-[#15161a] focus:outline-none focus:border-[#111]"
              />
            </div>

            <div>
              <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">Convenience fee (%)</label>
              <input
                type="number"
                step="0.1"
                value={globalSettings.fee_percent || 0}
                onChange={(e) => setGlobalSettings({ ...globalSettings, fee_percent: Number(e.target.value) })}
                className="w-full bg-white border border-[#e7e7ea] rounded-lg px-3 py-2 text-xs font-medium text-[#15161a] focus:outline-none focus:border-[#111]"
              />
            </div>
          </div>

          {/* Row 2: Presets */}
          <div>
            <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-2">Recharge presets shown to sellers</label>
            <div className="flex gap-2 flex-wrap items-center">
              {(globalSettings.presets || []).map((amt: number) => (
                <span key={amt} className="flex items-center gap-1 bg-white border border-[#e7e7ea] rounded-full px-3 py-1 text-xs font-semibold text-[#15161a]">
                  ₹{amt.toLocaleString('en-IN')}
                  <button
                    onClick={() => removePreset(amt)}
                    className="text-[#9a9ca5] hover:text-[#c53434] ml-1 leading-none"
                  >×</button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={newPreset}
                  onChange={e => setNewPreset(e.target.value)}
                  placeholder="Amount"
                  className="w-24 border border-dashed border-[#e7e7ea] rounded-full px-3 py-1 text-xs text-[#15161a] focus:outline-none focus:border-[#111]"
                />
                <button
                  onClick={addPreset}
                  className="border border-dashed border-[#e7e7ea] rounded-full px-3 py-1 text-xs font-semibold text-[#6b6d76] hover:border-[#111] hover:text-[#15161a] transition-all"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: GST Settings */}
          <div className="border border-[#e7e7ea] rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[#6b6d76]" />
              <span className="text-[13px] font-semibold text-[#15161a]">GST Invoice Settings</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Required for compliance</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">Auto-generate GST invoice</label>
                <div className="flex items-center gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setGlobalSettings({ ...globalSettings, auto_gst_invoice: !globalSettings.auto_gst_invoice })}
                    className={`w-10 h-6 rounded-full relative transition-all cursor-pointer flex-shrink-0 ${globalSettings.auto_gst_invoice ? 'bg-[#ff5a1f]' : 'bg-[#e6e7ea]'}`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-xs ${globalSettings.auto_gst_invoice ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-xs text-[#6b6d76] font-medium">{globalSettings.auto_gst_invoice ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">GST Rate (%)</label>
                <select
                  value={globalSettings.gst_percent || 18}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, gst_percent: Number(e.target.value) })}
                  disabled={!globalSettings.auto_gst_invoice}
                  className="w-full bg-white border border-[#e7e7ea] rounded-lg px-3 py-2 text-xs font-medium text-[#15161a] focus:outline-none focus:border-[#111] disabled:opacity-50"
                >
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18% (Standard)</option>
                  <option value={28}>28%</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">Your GSTIN (for invoice header)</label>
                <input
                  type="text"
                  value={globalSettings.gstin || ''}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, gstin: e.target.value.toUpperCase() })}
                  disabled={!globalSettings.auto_gst_invoice}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full bg-white border border-[#e7e7ea] rounded-lg px-3 py-2 text-xs font-mono text-[#15161a] focus:outline-none focus:border-[#111] disabled:opacity-50 tracking-widest uppercase"
                />
              </div>

              <div className="md:col-span-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={globalSettings.gst_on_convenience_fee_only ?? true}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, gst_on_convenience_fee_only: e.target.checked })}
                    disabled={!globalSettings.auto_gst_invoice}
                    className="rounded"
                  />
                  <span className="text-xs text-[#6b6d76]">Apply GST only on convenience fee (not on full recharge amount)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Providers Table */}
        <div className="p-4 border-b border-[#eef0f2]">
          <h3 className="text-[14.5px] font-semibold text-[#15161a]">Providers</h3>
          <div className="text-xs text-[#6b6d76] mt-0.5">Only one gateway can be the active default at a time</div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#6b6d76] font-medium">Loading providers...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#eef0f2] text-[11px] uppercase tracking-wider text-[#9a9ca5] font-semibold">
                  <th className="py-2.5 px-4">Provider</th>
                  <th className="py-2.5 px-4">Mode</th>
                  <th className="py-2.5 px-4">Credentials</th>
                  <th className="py-2.5 px-4">Webhook</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Default</th>
                  <th className="py-2.5 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f2]">
                {gateways.map((g) => {
                  const meta = PROVIDER_META[g.name] || {
                    logo: <ManualLogo />,
                    name: g.display_name || g.name,
                  };
                  const isExpanded = expandedRow === g.name;
                  const state = formState[g.name] || {};
                  const result = testResult[g.name];

                  return (
                    <React.Fragment key={g.id || g.name}>
                      <tr className="hover:bg-[#fafafa] transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#15161a]">
                          <div className="flex items-center gap-2.5">
                            {meta.logo}
                            <span>{meta.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5 ${g.mode === 'live' ? 'bg-[#eaf7ee] text-[#1f8a4c]' : g.mode === 'test' ? 'bg-[#fff6e0] text-[#a9720b]' : 'bg-[#f0f0f2] text-[#6b6d76]'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span className="capitalize">{g.mode || 'test'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${g.api_secret_status === 'Configured' ? 'bg-[#eef4ff] text-[#2f5fd6]' : 'bg-[#fdecec] text-[#c53434]'}`}>
                            {g.api_secret_status || 'Not set'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${g.webhook_secret_status === 'Configured' ? 'bg-[#eef4ff] text-[#2f5fd6]' : 'bg-[#fdecec] text-[#c53434]'}`}>
                            {g.webhook_secret_status || 'Not set'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleActivateToggle(g.name, g.is_active)}
                            className={`w-10 h-6 rounded-full relative transition-all cursor-pointer ${g.is_active ? 'bg-[#ff5a1f]' : 'bg-[#e6e7ea]'}`}
                          >
                            <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-xs ${g.is_active ? 'left-4.5' : 'left-0.5'}`} />
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          {g.is_default ? (
                            <span className="font-semibold text-[#15161a] flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 text-emerald-600" /> Default
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetDefault(g.name)}
                              className="text-[#9a9ca5] hover:text-[#15161a] font-medium transition-colors cursor-pointer"
                            >
                              Set as default
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : g.name)}
                            className="text-[#6b6d76] hover:text-[#15161a] font-semibold cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            {isExpanded ? <><ChevronUp className="w-4 h-4" /> Hide</> : <><ChevronDown className="w-4 h-4" /> Expand</>}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#fbfbfc]">
                          <td colSpan={7} className="p-0">
                            <div className="p-5 pl-12 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-[#eef0f2]">
                              {/* Mode selector */}
                              <div>
                                <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">Environment Mode</label>
                                <select
                                  value={state.mode || 'test'}
                                  onChange={(e) => setFormState({ ...formState, [g.name]: { ...state, mode: e.target.value } })}
                                  className="w-full border border-[#e7e7ea] rounded-lg px-3 py-2 text-xs font-medium text-[#15161a] bg-white focus:outline-none focus:border-[#111]"
                                >
                                  <option value="test">Test / Sandbox</option>
                                  <option value="live">Live / Production</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">Key ID / API Key</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={state.api_key || ''}
                                    onChange={(e) => setFormState({ ...formState, [g.name]: { ...state, api_key: e.target.value } })}
                                    placeholder={`Enter ${meta.name} API Key`}
                                    className="w-full border border-[#e7e7ea] rounded-lg px-3 pr-10 py-2 text-xs font-mono text-[#15161a] bg-white focus:outline-none focus:border-[#111]"
                                  />
                                  {state.api_key && (
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(state.api_key)}
                                      className="absolute right-2.5 top-2 text-[#9a9ca5] hover:text-[#15161a] p-1 cursor-pointer"
                                      title="Copy API key"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="relative">
                                <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">Key Secret</label>
                                <div className="relative">
                                  <input
                                    type={showSecret[g.name] ? 'text' : 'password'}
                                    value={state.api_secret || ''}
                                    onChange={(e) => setFormState({ ...formState, [g.name]: { ...state, api_secret: e.target.value } })}
                                    placeholder="Enter secret key"
                                    className="w-full border border-[#e7e7ea] rounded-lg px-3 pr-16 py-2 text-xs font-mono text-[#15161a] bg-white focus:outline-none focus:border-[#111]"
                                  />
                                  <div className="absolute right-2.5 top-2 flex items-center gap-1">
                                    {state.api_secret && (
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(state.api_secret)}
                                        className="text-[#9a9ca5] hover:text-[#15161a] p-1 cursor-pointer"
                                        title="Copy secret"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setShowSecret({ ...showSecret, [g.name]: !showSecret[g.name] })}
                                      className="text-[#9a9ca5] hover:text-[#15161a] p-1 cursor-pointer"
                                      title={showSecret[g.name] ? 'Hide secret' : 'Show secret'}
                                    >
                                      {showSecret[g.name] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="relative">
                                <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">Webhook Secret</label>
                                <div className="relative">
                                  <input
                                    type={showSecret[`wh_${g.name}`] ? 'text' : 'password'}
                                    value={state.webhook_secret || ''}
                                    onChange={(e) => setFormState({ ...formState, [g.name]: { ...state, webhook_secret: e.target.value } })}
                                    placeholder="Enter webhook secret"
                                    className="w-full border border-[#e7e7ea] rounded-lg px-3 pr-16 py-2 text-xs font-mono text-[#15161a] bg-white focus:outline-none focus:border-[#111]"
                                  />
                                  <div className="absolute right-2.5 top-2 flex items-center gap-1">
                                    {state.webhook_secret && (
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(state.webhook_secret)}
                                        className="text-[#9a9ca5] hover:text-[#15161a] p-1 cursor-pointer"
                                        title="Copy webhook secret"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setShowSecret({ ...showSecret, [`wh_${g.name}`]: !showSecret[`wh_${g.name}`] })}
                                      className="text-[#9a9ca5] hover:text-[#15161a] p-1 cursor-pointer"
                                      title={showSecret[`wh_${g.name}`] ? 'Hide secret' : 'Show secret'}
                                    >
                                      {showSecret[`wh_${g.name}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-[11.5px] text-[#6b6d76] font-semibold mb-1.5">
                                  Webhook URL <span className="font-normal text-[#9a9ca5]">(read-only — paste this in your gateway dashboard)</span>
                                </label>
                                <div className="flex items-center gap-2 border border-[#e7e7ea] rounded-lg px-3 py-2 text-xs text-[#6b6d76] bg-[#f8f8f9] font-mono">
                                  <span className="truncate flex-1">{g.webhook_url}</span>
                                  <button
                                    onClick={() => copyToClipboard(g.webhook_url)}
                                    className="ml-auto text-[#15161a] font-semibold hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
                                  >
                                    {copiedUrl === g.webhook_url ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copiedUrl === g.webhook_url ? 'Copied' : 'Copy'}</span>
                                  </button>
                                </div>
                              </div>

                              <div className="col-span-1 md:col-span-2 flex items-center gap-3 pt-2 flex-wrap">
                                <button
                                  onClick={() => handleTestConnection(g.name)}
                                  disabled={testing[g.name]}
                                  className="px-4 py-2 rounded-lg border border-[#e7e7ea] bg-white hover:bg-[#f5f5f7] text-[#15161a] font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  {testing[g.name] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                                  {testing[g.name] ? 'Testing...' : 'Test connection'}
                                </button>
                                <button
                                  onClick={() => handleGatewaySave(g.name)}
                                  disabled={savingGateway[g.name]}
                                  className="px-4 py-2 rounded-lg bg-[#ff5a1f] hover:bg-[#e04c15] disabled:opacity-50 text-white font-semibold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  {savingGateway[g.name] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                                  {savingGateway[g.name] ? 'Saving...' : 'Save changes'}
                                </button>

                                {/* Show real test result — no hardcoded text */}
                                {result && (
                                  <span className={`text-xs font-semibold flex items-center gap-1 ${result.success ? 'text-[#1f8a4c]' : 'text-[#c53434]'}`}>
                                    {result.success
                                      ? <Check className="w-3.5 h-3.5" />
                                      : <X className="w-3.5 h-3.5" />
                                    }
                                    {result.message}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
