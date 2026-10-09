'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import {
  Truck, ShieldCheck, Zap, Lock, Eye, EyeOff, RefreshCw, Copy, Check, ChevronDown, ChevronUp, MapPin, Image as ImageIcon, Sparkles,
  UploadCloud, Loader2, Link as LinkIcon, Trash2, FolderUp
} from 'lucide-react';
import { API_URL } from '@/lib/env';
import toast from 'react-hot-toast';
import { resolveCourierLogo } from '@/lib/courierLogos';

interface CourierDef {
  code: string;
  name: string;
  category: string;
  defaultLogo: string;
  fields: { name: string; label: string; placeholder: string; isSecret?: boolean }[];
}

const COURIER_DEFS: CourierDef[] = [
  {
    code: 'shipway',
    name: 'Shipway Multi-Carrier Aggregator',
    category: 'Multi-Courier Aggregator & Routing',
    defaultLogo: '/couriers/shipway.svg',
    fields: [
      { name: 'username', label: 'Shipway Account Email', placeholder: 'account@company.com' },
      { name: 'api_key', label: 'Licence Key', placeholder: 'Enter Shipway licence key', isSecret: true },
    ]
  },
  {
    code: 'delhivery',
    name: 'Delhivery Surface & Express',
    category: 'Pan-India Surface & Air Direct',
    defaultLogo: '/couriers/delhivery.svg',
    fields: [
      { name: 'username', label: 'Client Name / Account Name', placeholder: 'DELHIVERY_CLIENT_CODE' },
      { name: 'api_key', label: 'API Access Token', placeholder: 'Enter API token' },
      { name: 'api_secret', label: 'Secret Token', placeholder: 'Enter secret token', isSecret: true },
    ]
  },
  {
    code: 'bluedart',
    name: 'Bluedart DHL Logistics',
    category: 'Air Express Premium Freight',
    defaultLogo: '/couriers/bluedart.svg',
    fields: [
      { name: 'username', label: 'Customer Code / Login ID', placeholder: 'BLUEDART_CUST_123' },
      { name: 'api_key', label: 'License Key', placeholder: 'Enter license key' },
      { name: 'api_secret', label: 'Account Password', placeholder: 'Enter password', isSecret: true },
    ]
  },
  {
    code: 'xpressbees',
    name: 'Xpressbees Direct',
    category: 'E-commerce Standard & Express Logistics',
    defaultLogo: '/couriers/xpressbees.svg',
    fields: [
      { name: 'username', label: 'Account Name / Email', placeholder: 'XPRESSBEES_ACCT' },
      { name: 'api_key', label: 'API Key', placeholder: 'Enter API key' },
      { name: 'api_secret', label: 'Secret Token', placeholder: 'Enter secret token', isSecret: true },
    ]
  },
  {
    code: 'shadowfax',
    name: 'Shadowfax Hyperlocal & Forward',
    category: 'Hyperlocal & Same-Day Logistics',
    defaultLogo: '/couriers/shadowfax.svg',
    fields: [
      { name: 'username', label: 'Client Code / Store ID', placeholder: 'SHADOWFAX_STORE_01' },
      { name: 'api_secret', label: 'API Token', placeholder: 'Enter API token', isSecret: true },
    ]
  },
  {
    code: 'ecomexpress',
    name: 'Ecom Express',
    category: 'Pan-India COD Specialized Logistics',
    defaultLogo: '/couriers/ecomexpress.svg',
    fields: [
      { name: 'username', label: 'Account Code / Username', placeholder: 'ECOM_USER_88' },
      { name: 'api_secret', label: 'Account Password', placeholder: 'Enter password', isSecret: true },
    ]
  },
  {
    code: 'stcourier',
    name: 'ST Courier (Tamil Nadu Express)',
    category: 'Intra-State Physical AWB Roll Pool',
    defaultLogo: '/couriers/stcourier.svg',
    fields: [
      { name: 'username', label: 'Regional Branch Code / Hub ID', placeholder: 'ST_CHE_HUB_01' },
      { name: 'api_key', label: 'Account Reference', placeholder: 'Enter ST Courier Account Ref' },
    ]
  },
  {
    code: 'ekart',
    name: 'Ekart Logistics',
    category: 'First-Mile & Pan-India Network',
    defaultLogo: '/couriers/ekart.svg',
    fields: [
      { name: 'username', label: 'Merchant ID / Client Code', placeholder: 'EKART_MERCHANT_01' },
      { name: 'api_key', label: 'API Access Token', placeholder: 'Enter API Token' },
      { name: 'api_secret', label: 'Secret Key', placeholder: 'Enter Secret Key', isSecret: true },
    ]
  },
  {
    code: 'dtdc',
    name: 'DTDC Express',
    category: 'Express B2C & B2B Cargo Network',
    defaultLogo: '/couriers/dtdc.svg',
    fields: [
      { name: 'username', label: 'Customer Code / Login ID', placeholder: 'DTDC_CUST_ID' },
      { name: 'api_key', label: 'API Key', placeholder: 'Enter DTDC API Key' },
      { name: 'api_secret', label: 'Tracking Password', placeholder: 'Enter Password', isSecret: true },
    ]
  },
  {
    code: 'amazon',
    name: 'Amazon Shipping',
    category: 'Dedicated Commercial E-commerce Rail',
    defaultLogo: '/couriers/amazon.svg',
    fields: [
      { name: 'username', label: 'Merchant Identifier', placeholder: 'AMAZON_SHIP_MERCH_ID' },
      { name: 'api_key', label: 'LWA Client ID', placeholder: 'amzn1.application-oa2-client.xxx' },
      { name: 'api_secret', label: 'Client Secret', placeholder: 'Enter Amazon Client Secret', isSecret: true },
    ]
  },
  {
    code: 'indiapost',
    name: 'India Post Speed Post',
    category: 'Universal Sovereign Postal Network',
    defaultLogo: '/couriers/indiapost.svg',
    fields: [
      { name: 'username', label: 'Customer ID / Facility Code', placeholder: 'IP_FACILITY_CODE' },
      { name: 'api_key', label: 'API Access Key', placeholder: 'Enter India Post API Key' },
    ]
  },
  {
    code: 'smartr',
    name: 'Smartr Logistics',
    category: 'Express Air & Surface Multi-hub Cargo',
    defaultLogo: '/couriers/smartr.svg',
    fields: [
      { name: 'username', label: 'Smartr Account ID', placeholder: 'SMARTR_ACCT_01' },
      { name: 'api_key', label: 'API Key', placeholder: 'Enter API Key' },
      { name: 'api_secret', label: 'API Secret', placeholder: 'Enter API Secret', isSecret: true },
    ]
  },
  {
    code: 'fedex',
    name: 'FedEx Express',
    category: 'Global & Domestic Priority Logistics',
    defaultLogo: '/couriers/fedex.svg',
    fields: [
      { name: 'username', label: 'FedEx Account Number', placeholder: 'FEDEX_ACC_NUM' },
      { name: 'api_key', label: 'API Key', placeholder: 'Enter FedEx API Key' },
      { name: 'api_secret', label: 'Secret Key', placeholder: 'Enter Secret Key', isSecret: true },
    ]
  }
];

export default function PlatformCouriersPage() {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>('shipway');
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState<Record<string, boolean>>({});
  const [logoInputMode, setLogoInputMode] = useState<Record<string, 'upload' | 'url'>>({});

  const handleLogoFileUpload = async (code: string, file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Logo file must be under 10MB');
      return;
    }

    try {
      setUploadingLogo(prev => ({ ...prev, [code]: true }));
      const formData = new FormData();
      formData.append('logo', file);

      // Dedicated courier logo upload endpoint
      const res = await apiClient.post(`/platform/couriers/${code}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data.data?.url) {
        const uploadedUrl = res.data.data.url;
        setFormState(prev => ({
          ...prev,
          [code]: {
            ...prev[code],
            logo_url: uploadedUrl,
          },
        }));
        toast.success(`✓ Logo uploaded and saved for ${code.toUpperCase()}!`);
        await fetchCouriers();
      } else {
        throw new Error(res.data?.error?.message || 'Upload failed');
      }
    } catch (err: any) {
      console.warn('Dedicated logo upload endpoint error, trying fallback...', err);
      try {
        const formData = new FormData();
        formData.append('logo', file);
        const fbRes = await apiClient.post('/platform/couriers/upload-logo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (fbRes.data?.success && fbRes.data.data?.url) {
          const uploadedUrl = fbRes.data.data.url;
          setFormState(prev => ({
            ...prev,
            [code]: {
              ...prev[code],
              logo_url: uploadedUrl,
            },
          }));
          await apiClient.put(`/platform/couriers/${code}`, {
            ...formState[code],
            logo_url: uploadedUrl,
          });
          toast.success(`✓ Logo uploaded and saved for ${code.toUpperCase()}!`);
          await fetchCouriers();
          return;
        }
      } catch (fbErr: any) {
        toast.error(err.response?.data?.error?.message || err.message || 'Failed to upload logo');
      }
    } finally {
      setUploadingLogo(prev => ({ ...prev, [code]: false }));
    }
  };

  useEffect(() => {
    fetchCouriers();
  }, []);

  const fetchCouriers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/platform/couriers');
      if (res.data.success) {
        const list = res.data.data.rows || res.data.data || [];
        setCouriers(list);

        const initialForm: Record<string, any> = {};
        COURIER_DEFS.forEach((c) => {
          const existing = list.find((item: any) =>
            item.provider_key === c.code || item.code === c.code || item.name?.toLowerCase() === c.code
          );
          initialForm[c.code] = {
            is_active: existing ? existing.is_active : true,
            mode: existing ? (existing.mode || 'sandbox') : 'sandbox',
            display_name: existing?.display_name || c.name,
            logo_url: existing?.logo_url || c.defaultLogo,
            api_key: existing?.api_key || '',
            api_secret: existing?.api_secret || '',
            username: existing?.username || '',
            serviceability: (existing?.serviceability_status || (existing?.is_active ? 'Active' : 'Inactive')),
          };
        });
        setFormState(initialForm);
      }
    } catch {
      toast.error('Failed to load courier providers');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCredentials = async (code: string) => {
    try {
      setSaving(prev => ({ ...prev, [code]: true }));
      const state = formState[code] || {};
      const res = await apiClient.put(`/platform/couriers/${code}`, {
        mode: state.mode,
        display_name: state.display_name,
        logo_url: state.logo_url,
        api_key: state.api_key,
        api_secret: state.api_secret,
        username: state.username,
        is_active: state.is_active,
      });
      if (res.data.success) {
        toast.success(`Saved configuration and original logo for ${code.toUpperCase()}!`);
        if (res.data.data) {
          const saved = res.data.data;
          setFormState(prev => ({
            ...prev,
            [code]: {
              ...prev[code],
              mode: saved.mode || prev[code]?.mode || 'sandbox',
              display_name: saved.display_name || prev[code]?.display_name,
              logo_url: saved.logo_url || prev[code]?.logo_url,
              username: saved.username !== undefined ? saved.username : (prev[code]?.username || ''),
              api_key: saved.api_key !== undefined ? saved.api_key : (prev[code]?.api_key || ''),
              api_secret: saved.api_secret !== undefined ? saved.api_secret : (prev[code]?.api_secret || ''),
              is_active: saved.is_active !== undefined ? saved.is_active : prev[code]?.is_active,
            }
          }));
        }
        await fetchCouriers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || `Failed to save configuration for ${code}`);
    } finally {
      setSaving(prev => ({ ...prev, [code]: false }));
    }
  };

  const handleToggleActive = async (code: string) => {
    const current = formState[code]?.is_active ?? false;
    const nextState = !current;
    setFormState(prev => ({
      ...prev,
      [code]: { ...prev[code], is_active: nextState }
    }));

    try {
      const res = await apiClient.patch(`/platform/couriers/${code}/status`, { is_active: nextState });
      if (res.data.success) {
        toast.success(`${code.toUpperCase()} is now ${nextState ? 'ACTIVE' : 'INACTIVE'}`);
      }
    } catch {
      toast.error(`Failed to update status for ${code}`);
      setFormState(prev => ({
        ...prev,
        [code]: { ...prev[code], is_active: current }
      }));
    }
  };

  const handleTestConnection = async (code: string) => {
    try {
      setTesting(prev => ({ ...prev, [code]: true }));
      const res = await apiClient.post(`/platform/couriers/${code}/test`);
      if (res.data.success) {
        toast.success(`Connection test PASSED for ${code.toUpperCase()}! API is live.`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Test connection failed');
    } finally {
      setTesting(prev => ({ ...prev, [code]: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    toast.success('Webhook URL copied');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const connectedCount = COURIER_DEFS.filter(c => (formState[c.code]?.is_active ?? true)).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 4 KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-kpi">
          <div className="admin-kpi-title">Connected Carriers</div>
          <div className="admin-kpi-val">{connectedCount} Active</div>
          <div className="admin-delta admin-delta-up">
            Pan-India &amp; Regional
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Avg. Rate / 500g</div>
          <div className="admin-kpi-val">₹41.50</div>
          <div className="admin-delta admin-delta-neutral">
            Zone A &amp; B base
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Rate Rule Schedules</div>
          <div className="admin-kpi-val">Live</div>
          <div className="admin-delta admin-delta-neutral">
            Syncing real-time
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Paused Networks</div>
          <div className="admin-kpi-val">{COURIER_DEFS.length - connectedCount}</div>
          <div className="admin-delta admin-delta-neutral">
            Disabled integrations
          </div>
        </div>
      </div>

      <div className="admin-card !p-0 overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Carrier Integrations &amp; Rate Cards</h2>
            <p className="text-[12.5px] text-[var(--muted)]">Configure brand logos, display names, API credentials, and inbound webhooks</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/pricing/st-rates"
              className="btn-ref btn-ref-secondary flex items-center gap-1.5 text-[13px]"
            >
              <MapPin className="w-3.5 h-3.5 text-[var(--brand)]" /> ST District Rates
            </Link>
            <button
              type="button"
              onClick={fetchCouriers}
              className="btn-ref btn-ref-secondary flex items-center gap-1.5 text-[13px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">Loading courier integration options…</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {COURIER_DEFS.map((c) => {
              const code = c.code;
              const isExpanded = expandedRow === code;
              const state = formState[code] || {
                mode: 'sandbox',
                is_active: true,
                display_name: c.name,
                logo_url: c.defaultLogo,
              };
              const webhookUrl = `${API_URL}/webhooks/inbound/${code}`;
              const isActive = state.is_active;
              const currentLogo = resolveCourierLogo(code, state.logo_url);

              return (
                <div key={code} className="transition-all">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg)] transition-colors">
                    <div className="flex items-center gap-3.5">
                      {/* Logo Container */}
                      <div
                        className="w-16 h-11 rounded-[10px] p-1.5 flex items-center justify-center shrink-0 border"
                        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentLogo}
                          alt={state.display_name || c.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[14px] font-bold text-[var(--ink)]">{state.display_name || c.name}</h3>
                          <span
                            className="px-2 py-0.5 rounded-[6px] text-[11px] font-semibold"
                            style={{ background: 'var(--bg)', color: 'var(--muted)' }}
                          >
                            {c.category}
                          </span>
                        </div>
                        <p className="text-[12px] text-[var(--muted)] mt-0.5">
                          Code: <span className="font-mono font-bold text-[var(--ink)]">{code}</span> • Status:{' '}
                          <span className={isActive ? 'text-[var(--ok)] font-bold' : 'text-[var(--muted)] font-bold'}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`pill ${state.mode === 'live' ? 'pill-ok' : 'pill-warn'}`}>
                        {state.mode || 'SANDBOX'}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(code)}
                        className={`pill cursor-pointer ${isActive ? 'pill-ok' : 'pill-neutral'}`}
                      >
                        {isActive ? 'ENABLED' : 'DISABLED'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedRow(isExpanded ? null : code)}
                        className="btn-ref btn-ref-secondary flex items-center gap-1 text-[12.5px] py-1.5 px-3 cursor-pointer"
                        title="Configure courier and logo"
                      >
                        Configure {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-6 bg-slate-50/70 border-t border-slate-200 space-y-6">
                      {/* ── COURIER NAME & ORIGINAL LOGO UPDATE SECTION ── */}
                      <div className="p-5 bg-white rounded-2xl border border-purple-100 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                          <ImageIcon className="w-4 h-4 text-[#8410DC]" />
                          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                            Courier Identity &amp; Original Brand Logo
                          </h4>
                          <span className="text-[10px] bg-purple-50 text-[#8410DC] px-2 py-0.5 rounded font-bold border border-purple-200">
                            Updates across Seller Workspace &amp; Labels
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                          {/* Courier Display Name */}
                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                              Courier Display Name
                            </label>
                            <input
                              type="text"
                              value={state.display_name || ''}
                              onChange={e => setFormState({
                                ...formState,
                                [code]: { ...state, display_name: e.target.value }
                              })}
                              placeholder={c.name}
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#8410DC] shadow-xs"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                              Custom name shown to all sellers and customers
                            </p>
                          </div>

                          {/* Logo Upload & URL Options */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-extrabold text-slate-700">
                                Courier Brand Logo
                              </label>
                              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setLogoInputMode(prev => ({ ...prev, [code]: 'upload' }))}
                                  className={`px-2 py-0.5 text-[10.5px] font-bold rounded-md transition ${
                                    (logoInputMode[code] || 'upload') === 'upload'
                                      ? 'bg-white text-[#5B069A] shadow-xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Upload File
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLogoInputMode(prev => ({ ...prev, [code]: 'url' }))}
                                  className={`px-2 py-0.5 text-[10.5px] font-bold rounded-md transition ${
                                    logoInputMode[code] === 'url'
                                      ? 'bg-white text-[#5B069A] shadow-xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Image URL
                                </button>
                              </div>
                            </div>

                            {(logoInputMode[code] || 'upload') === 'upload' ? (
                              <div className="space-y-2">
                                <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-200 hover:border-[#8410DC] rounded-xl p-3 bg-purple-50/30 hover:bg-purple-50/60 transition cursor-pointer group">
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    className="hidden"
                                    disabled={uploadingLogo[code]}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleLogoFileUpload(code, file);
                                    }}
                                  />
                                  <div className="flex items-center gap-2 text-center">
                                    {uploadingLogo[code] ? (
                                      <>
                                        <Loader2 className="w-4 h-4 text-[#8410DC] animate-spin" />
                                        <span className="text-xs font-bold text-[#8410DC]">Uploading logo to server...</span>
                                      </>
                                    ) : (
                                      <>
                                        <UploadCloud className="w-4 h-4 text-[#8410DC] group-hover:scale-110 transition" />
                                        <span className="text-xs font-bold text-slate-800 group-hover:text-[#5B069A]">
                                          Choose Logo Image (PNG, SVG, WebP)
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 mt-0.5">
                                    Max 10MB • Auto-updates across entire platform
                                  </span>
                                </label>

                                {state.logo_url && state.logo_url.startsWith('/uploads/') && (
                                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-[11px] text-emerald-800">
                                    <span className="truncate max-w-[200px] font-mono text-[10px]">
                                      ✓ {state.logo_url}
                                    </span>
                                    <span className="text-[10px] font-bold bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-900 shrink-0">
                                      Custom
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <input
                                  type="text"
                                  value={state.logo_url || ''}
                                  onChange={e => setFormState({
                                    ...formState,
                                    [code]: { ...state, logo_url: e.target.value }
                                  })}
                                  placeholder={c.defaultLogo}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-[#8410DC] shadow-xs"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Direct SVG path or HTTPS URL</p>
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormState({
                                    ...formState,
                                    [code]: { ...state, logo_url: c.defaultLogo }
                                  });
                                  toast('Reset to official courier default logo', { icon: 'ℹ️' });
                                }}
                                className="text-[10.5px] text-[#8410DC] hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Reset to Default Logo</span>
                              </button>
                            </div>
                          </div>

                          {/* Live Preview Box */}
                          <div className="flex flex-col items-center sm:items-start">
                            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                              Live Logo Preview
                            </label>
                            <div className="w-32 h-16 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center p-2 shadow-xs overflow-hidden relative group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={currentLogo}
                                alt={state.display_name || c.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">
                              {state.logo_url?.startsWith('/uploads/') ? '● Custom Uploaded Logo' : '○ Official Brand Logo'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ── ENVIRONMENT & CREDENTIALS ── */}
                      <div className={`grid grid-cols-1 md:grid-cols-${Math.min(c.fields.length + 1, 3)} gap-6`}>
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1.5">Environment Mode</label>
                          <select
                            value={state.mode}
                            onChange={e => setFormState({ ...formState, [code]: { ...state, mode: e.target.value } })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-[#8410DC] shadow-xs cursor-pointer"
                          >
                            <option value="sandbox">Sandbox / Test API</option>
                            <option value="live">Live / Production API</option>
                          </select>
                        </div>

                        {c.fields.map((f) => (
                          <div key={f.name}>
                            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">{f.label}</label>
                            <div className="relative">
                              <input
                                type={f.isSecret ? (showSecret[code] ? 'text' : 'password') : 'text'}
                                value={state[f.name] || ''}
                                onChange={e => setFormState({ ...formState, [code]: { ...state, [f.name]: e.target.value } })}
                                placeholder={f.placeholder}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-[#8410DC] shadow-xs"
                              />
                              {f.isSecret && (
                                <button
                                  type="button"
                                  onClick={() => setShowSecret({ ...showSecret, [code]: !showSecret[code] })}
                                  className="absolute right-3.5 top-2.5 text-[#534F66] hover:text-slate-700 cursor-pointer"
                                >
                                  {showSecret[code] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Webhook URL */}
                      <div>
                        <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1">
                          Inbound Tracking &amp; NDR Webhook Receiver URL
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={webhookUrl}
                            className="input-ref w-full text-[12.5px] font-mono select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(webhookUrl)}
                            className="btn-ref btn-ref-secondary flex items-center gap-1.5 text-[12.5px] flex-none"
                          >
                            {copiedUrl === webhookUrl ? <Check className="w-4 h-4 text-[var(--ok)]" /> : <Copy className="w-4 h-4" />}
                            {copiedUrl === webhookUrl ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => handleSaveCredentials(code)}
                          disabled={saving[code]}
                          className="btn-ref btn-ref-primary flex items-center gap-1.5 text-[13px]"
                        >
                          {saving[code] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                          {saving[code] ? 'Saving…' : 'Save Courier & Logo'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTestConnection(code)}
                          disabled={testing[code]}
                          className="btn-ref btn-ref-secondary flex items-center gap-1.5 text-[13px]"
                        >
                          {testing[code] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                          {testing[code] ? 'Testing…' : 'Test API Connection'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
