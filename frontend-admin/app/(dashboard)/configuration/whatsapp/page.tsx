'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { MessageSquare, Key, ShieldCheck, CheckCircle2, AlertTriangle, Send, Loader2, RefreshCw, Copy, ExternalLink, Eye, EyeOff, FileText, Check, Layers, Truck, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WhatsAppConfigurationPage() {
  const [formData, setFormData] = useState({
    whatsapp_provider: 'growax',
    growax_whatsapp_api_key: '',
    growax_whatsapp_api_key_masked: '',
    growax_connection_key: '',
    growax_connection_key_masked: '',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_access_token: '',
    whatsapp_access_token_masked: '',
    whatsapp_verify_token: '',
    whatsapp_template_otp: 'otp_verification',
    whatsapp_template_order: 'order_dispatched',
    whatsapp_template_ndr: 'ndr_alert',
    whatsapp_template_remittance: 'cod_remittance',
  });

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingTemplate, setTestingTemplate] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showConnKey, setShowConnKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Test Message State
  const [testPhone, setTestPhone] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('otp_verification');

  const templates = [
    { id: 'otp_verification', name: 'OTP Verification Template', preview: 'Your NanoShipy account verification OTP is 849201. It expires in 10 minutes.' },
    { id: 'order_dispatched', name: 'Shipment Out for Delivery Template', preview: 'Hi Rahul, your order #NS-9821 from Sharma Store is out for delivery today with Delhivery. Track: https://nanoshipy.com/track/DL123456' },
    { id: 'ndr_alert', name: 'NDR Exception Action Alert', preview: 'Urgent: Delivery attempt failed for Order #NS-9821 (Customer Unavailable). Click here to confirm correct address: https://nanoshipy.com/ndr/NS-9821' },
    { id: 'cod_remittance', name: 'COD Payout Remittance Template', preview: 'Good news! ₹12,450 for 14 COD orders has been remitted to your bank account ending 4091. UTR: HDFC89127391823' },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/platform/settings/whatsapp');
      const data = res.data.data;
      setFormData({
        whatsapp_provider: data.whatsapp_provider || 'growax',
        growax_whatsapp_api_key: '',
        growax_whatsapp_api_key_masked: data.growax_whatsapp_api_key_masked || '',
        growax_connection_key: '',
        growax_connection_key_masked: data.growax_connection_key_masked || '0b061d...8e9b',
        whatsapp_phone_number_id: data.whatsapp_phone_number_id || '1142498715624861',
        whatsapp_business_account_id: data.whatsapp_business_account_id || '',
        whatsapp_access_token: '',
        whatsapp_access_token_masked: data.whatsapp_access_token_masked || '',
        whatsapp_verify_token: data.whatsapp_verify_token || 'nanoshipy_wa_secret',
        whatsapp_template_otp: data.whatsapp_template_otp || 'otp_verification',
        whatsapp_template_order: data.whatsapp_template_order || 'order_dispatched',
        whatsapp_template_ndr: data.whatsapp_template_ndr || 'ndr_alert',
        whatsapp_template_remittance: data.whatsapp_template_remittance || 'cod_remittance',
      });
      setStatus(data.status || null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load WhatsApp API configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        whatsapp_provider: formData.whatsapp_provider,
        whatsapp_phone_number_id: formData.whatsapp_phone_number_id,
        whatsapp_business_account_id: formData.whatsapp_business_account_id,
        whatsapp_verify_token: formData.whatsapp_verify_token,
        whatsapp_template_otp: formData.whatsapp_template_otp,
        whatsapp_template_order: formData.whatsapp_template_order,
        whatsapp_template_ndr: formData.whatsapp_template_ndr,
        whatsapp_template_remittance: formData.whatsapp_template_remittance,
      };

      if (formData.growax_whatsapp_api_key && formData.growax_whatsapp_api_key.trim() !== '') {
        payload.growax_whatsapp_api_key = formData.growax_whatsapp_api_key.trim();
      }

      if (formData.growax_connection_key && formData.growax_connection_key.trim() !== '') {
        payload.growax_connection_key = formData.growax_connection_key.trim();
      }

      const res = await apiClient.put('/platform/settings/whatsapp', payload);
      if (res.data.success) {
        setSuccessMsg('Growax Connection Key & API Settings saved successfully!');
        toast.success('Growax credentials saved!');
        fetchSettings();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save WhatsApp settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSendSampleTemplate = async () => {
    if (!testPhone) {
      toast.error('Please enter a target mobile phone number');
      return;
    }
    setTestingTemplate(true);
    try {
      const res = await apiClient.post('/platform/settings/whatsapp/test', {
        recipient_phone: testPhone,
        template_name: selectedTemplate,
      });
      if (res.data.success) {
        toast.success(`Sample WhatsApp template sent to ${testPhone}!`);
      } else {
        toast.error(res.data.error?.message || 'Failed to send sample WhatsApp template');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to send sample WhatsApp template');
    } finally {
      setTestingTemplate(false);
    }
  };

  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://api.nanoshipy.com'}/api/v1/whatsapp/webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-[#534F66] gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#8410DC]" />
        <span>Loading WhatsApp API credentials & Template IDs...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-500" />
            WhatsApp Gateway & Template ID Settings
          </h1>
          <p className="text-sm text-[#7E7994] dark:text-[#534F66] mt-1">
            Configure Growax CRM Connection Key / Meta WhatsApp Gateway credentials and map approved Template IDs.
          </p>
        </div>
        {status?.connected ? (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Status: {status.status || 'Connected & Active (Growax CRM)'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold rounded-xl">
            <AlertTriangle className="w-4 h-4" />
            API Key Missing
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Credentials & Template Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Growax Section */}
        <div className="p-6 bg-white dark:bg-slate-900 border-2 border-emerald-500/30 rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-500" />
              1. Growax CRM Connection Key & API Key (Primary)
            </h2>
            <a
              href="https://automate.growax.in/vb/developers/connection-key"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#8410DC] dark:text-[#D6A8FF] hover:underline flex items-center gap-1 font-semibold"
            >
              Open Connection Key Portal <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
                Growax Connection Key (Bearer Token){' '}
                {formData.growax_connection_key_masked && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                    ({formData.growax_connection_key_masked})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showConnKey ? 'text' : 'password'}
                  placeholder={formData.growax_connection_key_masked ? '•••••••• (Leave blank to keep existing)' : 'e.g. 0b061d1ce23633a91d7d64c16ac78aa9a3a9db56cca319c3b87e5a209e738e9b'}
                  value={formData.growax_connection_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, growax_connection_key: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConnKey(!showConnKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConnKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
                Growax API Key / WABA Token{' '}
                {formData.growax_whatsapp_api_key_masked && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                    ({formData.growax_whatsapp_api_key_masked})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder={formData.growax_whatsapp_api_key_masked ? '•••••••• (Leave blank to keep existing)' : 'e.g. 1ca85c5e8ec193c712a6631a7a500729aadae3811024d893455acec60ef2b02e'}
                  value={formData.growax_whatsapp_api_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, growax_whatsapp_api_key: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Template ID Mapping Section */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            2. Approved WhatsApp Template Name / Template ID Mapping
          </h2>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66]">
            Enter the exact approved Template Name or Template ID from your Growax / Meta BSP Dashboard:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                OTP Verification Template ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. otp_verification or 9821034"
                value={formData.whatsapp_template_otp}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_template_otp: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#8410DC]" />
                Shipment Tracking Template ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. order_dispatched or 9821035"
                value={formData.whatsapp_template_order}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_template_order: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                NDR Exception Action Template ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ndr_alert or 9821036"
                value={formData.whatsapp_template_ndr}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_template_ndr: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                COD Remittance Payout Template ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. cod_remittance or 9821037"
                value={formData.whatsapp_template_remittance}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_template_remittance: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Webhook Endpoint Box */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            WhatsApp Webhook Endpoint
          </h2>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66]">URL for handling delivery receipts & inbound messages:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 select-all outline-none"
            />
            <button
              type="button"
              onClick={copyWebhookUrl}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl transition flex-shrink-0"
              title="Copy URL"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={fetchSettings}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-[#534F66] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            <RefreshCw className="w-4 h-4" /> Reset Form
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Save WhatsApp API Settings & Connection Keys
          </button>
        </div>
      </form>

      {/* Sample Templates & Test Messaging Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            Sample WhatsApp Templates & Testing
          </h2>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-1">
            Select a sample WhatsApp notification template below to send a live test message.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                selectedTemplate === t.id
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-[#E8DEF2] hover:border-emerald-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                  selectedTemplate === t.id ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'
                }`}
              >
                {selectedTemplate === t.id && <Check className="w-3 h-3" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">{t.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-sans">{t.preview}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100 dark:border-[#E8DEF2]">
          <input
            type="text"
            placeholder="Target WhatsApp Mobile (e.g. 919876543210)"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            disabled={testingTemplate || !testPhone}
            onClick={handleSendSampleTemplate}
            className="flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition disabled:opacity-50 cursor-pointer shrink-0"
          >
            {testingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Sample WhatsApp Template
          </button>
        </div>
      </div>
    </div>
  );
}
