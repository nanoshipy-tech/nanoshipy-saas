'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { MessageSquare, Key, ToggleLeft, ToggleRight, CheckCircle2, AlertTriangle, Save, Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SmsConfigurationPage() {
  const [formData, setFormData] = useState({
    sms_provider: 'fast2sms',
    sms_sender_id: 'NSHIPY',
    dlt_entity_id: '',
    sms_api_key: '',
    sms_api_key_masked: '',
    sms_enabled: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Test SMS State
  const [testPhone, setTestPhone] = useState('9150826341');
  const [testingSms, setTestingSms] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; simulated?: boolean; provider?: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/platform/settings/sms');
      const data = res.data.data;
      setFormData({
        sms_provider: data.sms_provider || 'fast2sms',
        sms_sender_id: data.sms_sender_id || 'NSHIPY',
        dlt_entity_id: data.dlt_entity_id || '',
        sms_api_key: '',
        sms_api_key_masked: data.sms_api_key_masked || '',
        sms_enabled: !!data.sms_enabled,
      });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load SMS Gateway configuration');
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
      await apiClient.put('/platform/settings/sms', {
        sms_provider: formData.sms_provider,
        sms_sender_id: formData.sms_sender_id,
        dlt_entity_id: formData.dlt_entity_id,
        sms_enabled: formData.sms_enabled,
        sms_api_key: formData.sms_api_key || undefined,
      });

      setSuccessMsg('SMS Gateway configuration saved successfully!');
      toast.success('SMS Gateway settings updated');
      fetchSettings();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save SMS Gateway settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSms = async () => {
    if (!testPhone || testPhone.trim().replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid 10-digit mobile number for testing.');
      return;
    }
    setTestingSms(true);
    setTestResult(null);
    try {
      const res = await apiClient.post('/platform/settings/sms/test', {
        recipient_phone: testPhone.trim(),
        message: 'Nanoshipy: Verification test SMS from Admin Panel. Code: 894120',
      });
      if (res.data.success) {
        setTestResult({
          success: true,
          message: res.data.data?.message || 'Test SMS dispatched successfully!',
          simulated: res.data.data?.simulated,
          provider: res.data.data?.provider,
        });
        toast.success(res.data.data?.simulated ? 'Mock SMS Generated (Sandbox)' : 'Test SMS dispatched!');
      } else {
        const errMsg = res.data.error?.message || 'Failed to send test SMS.';
        setTestResult({ success: false, message: errMsg });
        toast.error(errMsg);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Test SMS connection failed.';
      setTestResult({ success: false, message: errMsg });
      toast.error(errMsg);
    } finally {
      setTestingSms(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-[#534F66] gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
        <span>Loading SMS Gateway configuration...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-purple-500" />
            SMS Gateway & DLT Configuration
          </h1>
          <p className="text-sm text-[#7E7994] dark:text-[#534F66] mt-1">
            Configure DLT registered SMS gateways (Fast2SMS, MSG91, Custom DLT HTTP API).
          </p>
        </div>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Toggle Switch */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Enable Transactional SMS Dispatch</p>
            <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">Send SMS alerts for order updates, OTPs, and delivery status updates.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, sms_enabled: !prev.sms_enabled }))}
            className={`p-1 transition rounded-full ${formData.sms_enabled ? 'text-emerald-500' : 'text-[#534F66]'}`}
          >
            {formData.sms_enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
          </button>
        </div>

        {/* Credentials Form */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-500" />
            SMS Gateway & DLT Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">SMS Provider</label>
              <select
                value={formData.sms_provider}
                onChange={(e) => setFormData(prev => ({ ...prev, sms_provider: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
              >
                <option value="apitxt">Apitxt (apitxt.com OTP API)</option>
                <option value="fast2sms">Fast2SMS (Quick DLT)</option>
                <option value="msg91">MSG91</option>
                <option value="custom_dlt">Custom DLT HTTP Gateway</option>
                <option value="mydreams">My Dreams Technology (app.mydreamstechnology.in)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
                DLT Sender ID / Header {formData.sms_provider !== 'apitxt' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder={formData.sms_provider === 'apitxt' ? 'Optional for Apitxt' : 'e.g. NSHIPY'}
                value={formData.sms_sender_id}
                onChange={(e) => setFormData(prev => ({ ...prev, sms_sender_id: e.target.value.toUpperCase() }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {formData.sms_provider === 'apitxt' && (
            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl text-xs text-purple-900 dark:text-purple-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Apitxt 3-Parameter OTP API Mode Active
              </p>
              <p className="text-[#6B6D76] dark:text-purple-300">
                Simply enter your <strong>Auth Key</strong> below. The system will automatically dispatch OTPs directly to <code className="px-1 py-0.5 bg-white dark:bg-slate-900 rounded border border-purple-200 dark:border-purple-800">https://apitxt.com/api/sendOTP</code> passing <strong>Auth Key</strong>, <strong>Mobile Number</strong>, and <strong>OTP Value</strong>.
              </p>
            </div>
          )}

          {formData.sms_provider === 'mydreams' && (
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl text-xs text-blue-900 dark:text-blue-200 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                My Dreams Technology Active (app.mydreamstechnology.in)
              </p>
              <p className="text-[#6B6D76] dark:text-blue-300">
                Transactional SMS will be dispatched via HTTP GET using your API key and Sender ID (default: <strong>MDTDMO</strong>). You can manage DLT templates and review transmission audit logs at{' '}
                <a href="/configuration/sms/mydreams" className="underline font-semibold text-blue-600 dark:text-blue-400">
                  My Dreams Settings & Logs →
                </a>
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">DLT Entity ID</label>
            <input
              type="text"
              placeholder="e.g. 1301157000000000000"
              value={formData.dlt_entity_id}
              onChange={(e) => setFormData(prev => ({ ...prev, dlt_entity_id: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
              SMS Gateway API Key / Auth Key{' '}
              {formData.sms_api_key_masked && (
                <span className="text-emerald-600 dark:text-emerald-400 font-normal">(Saved: {formData.sms_api_key_masked})</span>
              )}
            </label>
            <input
              type="password"
              placeholder={formData.sms_api_key_masked ? 'Enter new API key to overwrite' : 'Enter API Key'}
              value={formData.sms_api_key}
              onChange={(e) => setFormData(prev => ({ ...prev, sms_api_key: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save SMS Credentials'}
          </button>
        </div>
      </form>

      {/* Live Connection & Dispatch Test Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
            <Send className="w-4 h-4 text-purple-500" />
            Live Gateway Dispatch & Connection Test
          </h2>
          <span className="text-xs px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-800">
            Selected Gateway: <strong>{formData.sms_provider.toUpperCase()}</strong>
          </span>
        </div>
        <p className="text-xs text-[#7E7994] dark:text-[#534F66]">
          Enter an Indian mobile number to trigger an immediate live SMS. This tests API authentication, network reachability, and carrier IP whitelisting.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Enter 10-digit mobile (e.g. 9150826341)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="button"
            onClick={handleTestSms}
            disabled={testingSms}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {testingSms ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Test SMS
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div
            className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
              testResult.success
                ? testResult.simulated
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">
                {testResult.success
                  ? testResult.simulated
                    ? 'Gateway Status: Mock / Sandbox Fallback'
                    : 'Gateway Status: Live SMS Dispatched'
                  : 'Gateway Status: Connection / Authentication Error'}
              </p>
              <p>{testResult.message}</p>
              {testResult.provider && (
                <p className="text-[11px] opacity-80">Provider: {testResult.provider}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
