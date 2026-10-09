'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import {
  Save, RefreshCw, Printer, Settings2, Upload, Info,
} from 'lucide-react';
import { useFileUpload } from '@/lib/useFileUpload';
import { SettingsNav } from '@/components/settings/SettingsNav';

// ─── Helper components ──────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, title, desc, children }: {
  icon: React.ElementType; title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="w-9 h-9 rounded-xl bg-[#F6EFFF] flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-[#8410DC]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#8410DC]/20 focus:border-[#8410DC] transition"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SubRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-600 mb-1.5 leading-tight">{label}</p>
      {children}
    </div>
  );
}

function CheckboxRow({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 mb-2 cursor-pointer group">
      <input
        type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-[#8410DC] focus:ring-[#8410DC]/30 cursor-pointer accent-[#8410DC]"
      />
      <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800">{label}</span>
    </label>
  );
}

const YES_NO = [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }];

// ─── localStorage helpers ───────────────────────────────────────────────────────
const LS_KEY = 'nanoshipy_label_settings_v1';
function loadLocalSettings(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveLocalSettings(data: Record<string, string>) {
  if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// ─── Default values ─────────────────────────────────────────────────────────────
const DEFAULTS: Record<string, string> = {
  order_weight: '',
  barcode_enabled: 'no',
  barcode_format: 'code128_b2',
  hide_payment_method: 'no',
  hide_prepaid_amount: 'yes',
  hide_cod_amount: 'no',
  hide_product_name: 'no',
  hide_sku: 'no',
  show_full_product_value: 'no',
  print_all_products_thermal: 'no',
  enable_company_gstin: 'yes',
  hide_customer_contact: 'yes',
  hide_invoice_no: 'no',
  hide_invoice_date: 'no',
  show_product_options: 'no',
  show_dimension_small1: 'yes',
  show_dimension_small2: 'yes',
  show_dimension_a4: 'yes',
  show_dimension_4in1: 'yes',
  show_weight_small1: 'yes',
  show_weight_small2: 'yes',
  show_weight_a4: 'yes',
  show_weight_4in1: 'yes',
  mask_customer_name: 'no',
  mask_customer_address: 'no',
  mask_customer_phone: 'no',
  print_in_browser: 'no',
  hide_return_warehouse: 'no',
  default_label_format: '4x6',
  label_logo_url: '',
};

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function ManageLabelPage() {
  const [form, setForm] = useState<Record<string, string>>(DEFAULTS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const { uploadFile, isUploading: isUploadingLogo } = useFileUpload();

  const set = useCallback((key: string, val: string) =>
    setForm(prev => ({ ...prev, [key]: val })), []);

  // Load on mount
  useEffect(() => {
    const localData = loadLocalSettings();
    setForm(prev => ({ ...prev, ...localData }));
    apiClient.get('/settings')
      .then(res => {
        if (res.data.success) {
          const s = res.data.data;
          setForm(prev => ({
            ...prev,
            default_label_format: s.default_label_format?.value ?? prev.default_label_format,
            label_logo_url:       s.label_logo_url?.value       ?? prev.label_logo_url,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Backend-supported fields
      const apiPayload: Record<string, any> = {
        default_label_format: form.default_label_format,
      };
      if (form.label_logo_url) apiPayload.label_logo_url = form.label_logo_url;
      await apiClient.put('/settings', apiPayload);
      // All UI-extended fields go to localStorage
      saveLocalSettings(form);
      toast.success('Label settings saved successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save label settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(DEFAULTS);
    saveLocalSettings({});
    toast.success('Label settings reset to defaults');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    try {
      const res = await uploadFile('/company/profile/logo', e.target.files[0], 'logo');
      const url = res?.data?.logo_url || res?.logo_url;
      if (url) { set('label_logo_url', url); toast.success('Logo uploaded!'); }
    } catch { toast.error('Upload failed'); }
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-[#D6A8FF] border-t-[#5B069A] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Label</h1>
          <p className="text-xs text-slate-500 mt-1">Configure shipping label appearance, barcode settings, and display preferences</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-[#8410DC] hover:bg-[#6c0cb5] rounded-xl transition shadow-sm cursor-pointer disabled:opacity-60">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <SettingsNav />


      {/* ── 2. Label Format & Branding ── */}
      <SectionCard icon={Printer} title="Shipping Label Settings"
        desc="Set your customer order dimensions and merchant brand logo">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Order Dimensions (Weight in Grams)
              </label>
              <input
                type="number" min={0}
                value={form.order_weight}
                onChange={e => set('order_weight', e.target.value)}
                placeholder="Order Weight"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#8410DC]/20 focus:border-[#8410DC]"
              />
              <p className="text-[11px] text-slate-400 mt-1">Note: Default value 50 gm, if blank.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Default Label Format</label>
              <SelectInput value={form.default_label_format} onChange={v => set('default_label_format', v)}
                options={[
                  { value: '4x6',      label: '4" × 6" Thermal Standard' },
                  { value: '4x4',      label: '4" × 4" Thermal Square' },
                  { value: '3x5',      label: '3" × 5" Compact Thermal' },
                  { value: 'a4',       label: 'A4 Single Label' },
                  { value: 'a4_4in1', label: 'A4 Four-in-One (4 labels/page)' },
                  { value: 'a4_2in1', label: 'A4 Two-in-One (2 labels/page)' },
                  { value: 'a6',       label: 'A6 Pocket Format' },
                ]}
              />
            </div>
          </div>

          {/* Right */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Merchant Brand Logo</label>
            {form.label_logo_url && (
              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center p-1.5 overflow-hidden shadow-sm">
                  <img
                    src={form.label_logo_url.startsWith('http')
                      ? form.label_logo_url
                      : `${process.env.NEXT_PUBLIC_API_URL || 'https://api.nanoshipy.com'}${form.label_logo_url}`}
                    alt="Merchant logo"
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div>
                  <span className="inline-block text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">✓ Logo Active on Label</span>
                  <button onClick={() => set('label_logo_url', '')} className="block text-xs text-red-500 hover:text-red-700 mt-1 cursor-pointer">Remove</button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={form.label_logo_url} onChange={e => set('label_logo_url', e.target.value)}
                placeholder="https://yourstore.com/logo.png"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#8410DC]/20 focus:border-[#8410DC]" />
              <label className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8410DC] hover:bg-[#6c0cb5] text-white text-sm font-bold cursor-pointer transition shrink-0">
                <Upload className="w-3.5 h-3.5" />
                {isUploadingLogo ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, or WebP. Transparent background recommended.</p>
          </div>
        </div>
      </SectionCard>

      {/* ── 3. Barcode Settings ── */}
      <SectionCard icon={Settings2} title="Shipping Label Barcode Settings"
        desc="Set your customer shipping barcode and barcode format according to you">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Enable Order ID Barcode</label>
            <SelectInput value={form.barcode_enabled} onChange={v => set('barcode_enabled', v)} options={YES_NO} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Barcode Format</label>
            <SelectInput value={form.barcode_format} onChange={v => set('barcode_format', v)} options={[
              { value: 'code128_b2',  label: 'Code 128-B 2' },
              { value: 'code128_b1',  label: 'Code 128-B 1' },
              { value: 'code39',      label: 'Code 39' },
              { value: 'qr',         label: 'QR Code' },
              { value: 'data_matrix', label: 'Data Matrix' },
            ]} />
          </div>
        </div>
      </SectionCard>

      {/* ── 4. Other Label Settings ── */}
      <SectionCard icon={Settings2} title="Shipping Label Other Settings"
        desc="Configure GSTIN, payment method, invoice no., invoice date, contact no., and more">

        {/* 12 dropdowns in 3 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
          <SubRow label="Hide Payment Method">
            <SelectInput value={form.hide_payment_method} onChange={v => set('hide_payment_method', v)} options={YES_NO} />
          </SubRow>
          <SubRow label="Hide Amount from Pre-Paid Orders">
            <SelectInput value={form.hide_prepaid_amount} onChange={v => set('hide_prepaid_amount', v)} options={YES_NO} />
          </SubRow>
          <SubRow label="Hide Order/Product Amount from COD Orders">
            <SelectInput value={form.hide_cod_amount} onChange={v => set('hide_cod_amount', v)} options={YES_NO} />
          </SubRow>

          <SubRow label="Hide Product Name">
            <SelectInput value={form.hide_product_name} onChange={v => set('hide_product_name', v)} options={YES_NO} />
          </SubRow>
          <SubRow label="Hide SKU (Product Code)">
            <SelectInput value={form.hide_sku} onChange={v => set('hide_sku', v)} options={YES_NO} />
          </SubRow>
          <SubRow label="Show Complete Value of Product/SKU">
            <SelectInput value={form.show_full_product_value} onChange={v => set('show_full_product_value', v)} options={YES_NO} />
          </SubRow>

          <SubRow label="Print All Products (Thermal Label)">
            <SelectInput value={form.print_all_products_thermal} onChange={v => set('print_all_products_thermal', v)} options={YES_NO} />
          </SubRow>
          <SubRow label="Enable Company GSTIN Number">
            <SelectInput value={form.enable_company_gstin} onChange={v => set('enable_company_gstin', v)} options={YES_NO} />
          </SubRow>
          <SubRow label="Hide Customer Contact No.">
            <SelectInput value={form.hide_customer_contact} onChange={v => set('hide_customer_contact', v)} options={YES_NO} />
          </SubRow>

          <SubRow label="Hide Invoice No.">
            <SelectInput value={form.hide_invoice_no} onChange={v => set('hide_invoice_no', v)} options={YES_NO} />
          </SubRow>
          <SubRow label="Hide Invoice Date">
            <SelectInput value={form.hide_invoice_date} onChange={v => set('hide_invoice_date', v)} options={YES_NO} />
          </SubRow>
          <SubRow label="Show Product Options (Shopify Orders Only)">
            <SelectInput value={form.show_product_options} onChange={v => set('show_product_options', v)} options={YES_NO} />
          </SubRow>
        </div>

        {/* Checkbox groups */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-5 mt-4 border-t border-slate-100">
          {/* Show Dimension */}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Show Dimension on Shipping Labels</p>
            {([
              ['show_dimension_small1', 'Small Size – Format 1'],
              ['show_dimension_small2', 'Small Size – Format 2'],
              ['show_dimension_a4',     'A4 Size'],
              ['show_dimension_4in1',   'Four in One'],
            ] as [string, string][]).map(([key, label]) => (
              <CheckboxRow key={key} label={label} checked={form[key] === 'yes'}
                onChange={v => set(key, v ? 'yes' : 'no')} />
            ))}
          </div>
          {/* Show Weight */}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Show Weight on Shipping Labels</p>
            {([
              ['show_weight_small1', 'Small Size – Format 1'],
              ['show_weight_small2', 'Small Size – Format 2'],
              ['show_weight_a4',     'A4 Size'],
              ['show_weight_4in1',   'Four in One'],
            ] as [string, string][]).map(([key, label]) => (
              <CheckboxRow key={key} label={label} checked={form[key] === 'yes'}
                onChange={v => set(key, v ? 'yes' : 'no')} />
            ))}
          </div>
          {/* Mask Customer Info */}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Mask Customer Info (Thermal Label)</p>
            {([
              ['mask_customer_name',    'Name'],
              ['mask_customer_address', 'Address'],
              ['mask_customer_phone',   'Phone Number'],
            ] as [string, string][]).map(([key, label]) => (
              <CheckboxRow key={key} label={label} checked={form[key] === 'yes'}
                onChange={v => set(key, v ? 'yes' : 'no')} />
            ))}
          </div>
        </div>

        {/* Print in browser + hide return warehouse */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-1 pt-4 mt-4 border-t border-slate-100">
          <SubRow label="Print in Browser (Thermal Label)">
            <SelectInput value={form.print_in_browser} onChange={v => set('print_in_browser', v)} options={YES_NO} />
          </SubRow>
          <SubRow label="Hide Return Warehouse Address">
            <SelectInput value={form.hide_return_warehouse} onChange={v => set('hide_return_warehouse', v)} options={YES_NO} />
          </SubRow>
        </div>
      </SectionCard>

      {/* ── Save bar ── */}
      <div className="flex items-center justify-end gap-3 pt-2 pb-8">
        <button onClick={handleReset}
          className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer">
          Reset to Defaults
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[#8410DC] hover:bg-[#6c0cb5] rounded-xl transition shadow-md cursor-pointer disabled:opacity-60">
          <Save className="w-4 h-4" />
          {saving ? 'Saving Label Settings…' : 'Save Label Settings'}
        </button>
      </div>
    </div>
  );
}
