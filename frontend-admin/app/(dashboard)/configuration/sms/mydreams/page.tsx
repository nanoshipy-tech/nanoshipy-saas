'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import {
  MessageSquare,
  Key,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertTriangle,
  Save,
  Loader2,
  Send,
  ArrowLeft,
  FileText,
  Clock,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TemplateItem {
  id: string;
  template_key: string;
  template_name: string;
  template_text: string;
  variable_order: string[];
  dlt_template_id: string;
  is_active: boolean;
}

interface LogItem {
  id: string;
  phone_masked: string;
  template_key: string | null;
  order_id: string | null;
  status_event: string | null;
  status: string;
  error_message: string | null;
  vendor_response: any;
  sent_at: string;
}

export default function MyDreamsSmsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [senderId, setSenderId] = useState('MDTDMO');
  const [endpoint, setEndpoint] = useState('http://app.mydreamstechnology.in/vb/apikey.php');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  // Test SMS State
  const [testPhone, setTestPhone] = useState('9150826341');
  const [testMessage, setTestMessage] = useState('Dear Customer, your OTP for login to Nanoshipy is 849201. Valid for 30 minutes. Regards, My Dreams Technology Team');
  const [testingSms, setTestingSms] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; simulated?: boolean; messageId?: string } | null>(null);

  // Logs State
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);

  useEffect(() => {
    fetchSettings();
    fetchLogs(1);
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/platform/my-dreams-sms/settings');
      const data = res.data.data;
      setEnabled(!!data.enabled);
      setApiKeyMasked(data.api_key_masked || '');
      setSenderId(data.sender_id || 'MDTDMO');
      setEndpoint(data.endpoint || 'http://app.mydreamstechnology.in/vb/apikey.php');
      setTemplates(data.templates || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load My Dreams Technology settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (page: number) => {
    setLoadingLogs(true);
    try {
      const res = await apiClient.get(`/platform/my-dreams-sms/logs?page=${page}&limit=10`);
      setLogs(res.data.data?.logs || []);
      setLogPage(res.data.data?.pagination?.page || 1);
      setLogTotalPages(res.data.data?.pagination?.total_pages || 1);
    } catch (err: any) {
      console.error('Failed to load logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiClient.put('/platform/my-dreams-sms/settings', {
        enabled,
        api_key: apiKey || undefined,
        sender_id: senderId,
        endpoint,
        templates,
      });

      setSuccessMsg('My Dreams Technology configuration saved successfully!');
      toast.success('Settings saved');
      setApiKey('');
      fetchSettings();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSms = async () => {
    if (!testPhone || testPhone.trim().replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }
    setTestingSms(true);
    setTestResult(null);

    try {
      const res = await apiClient.post('/platform/my-dreams-sms/test', {
        recipient_phone: testPhone.trim(),
        message: testMessage,
      });

      if (res.data.success) {
        setTestResult({
          success: true,
          message: res.data.data?.message || 'Test SMS dispatched successfully!',
          simulated: res.data.data?.simulated,
          messageId: res.data.data?.messageId,
        });
        toast.success(res.data.data?.simulated ? 'Mock SMS Generated (Sandbox)' : 'Test SMS Sent!');
        fetchLogs(1);
      } else {
        const errMsg = res.data.error?.message || 'Failed to dispatch test SMS.';
        setTestResult({ success: false, message: errMsg });
        toast.error(errMsg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message;
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingSms(false);
    }
  };

  const updateTemplateField = (index: number, field: keyof TemplateItem, value: any) => {
    setTemplates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          <span className="text-sm">Loading My Dreams Technology settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/configuration/sms"
            className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to SMS Gateways
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            My Dreams Technology SMS Gateway
          </h1>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">
            Configure HTTP GET endpoint, Sender ID, secure OTP hashing, DLT templates, and transmission logs.
          </p>
        </div>

        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
          enabled
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
        }`}>
          {enabled ? '● Gateway Enabled' : '○ Gateway Disabled'}
        </span>
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* Enable Switch */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Enable My Dreams Technology</p>
            <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">
              Turn ON to route OTPs, order confirmation, out-for-delivery, and tracking links through My Dreams Technology.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`p-1 transition rounded-full ${enabled ? 'text-emerald-500' : 'text-[#534F66]'}`}
          >
            {enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
          </button>
        </div>

        {/* Credentials */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-600" />
            Gateway Credentials & Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
                API Key {apiKeyMasked && <span className="text-emerald-600 font-normal">(Saved: {apiKeyMasked})</span>}
              </label>
              <input
                type="password"
                placeholder={apiKeyMasked ? 'Enter new key to update' : 'Enter My Dreams API Key'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
                Sender ID (6-Letter Alphabetic)
              </label>
              <input
                type="text"
                maxLength={6}
                value={senderId}
                onChange={(e) => setSenderId(e.target.value.toUpperCase())}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
                HTTP GET Endpoint URL
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* DLT Templates Editor */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                DLT Approved Templates & Variable Ordering
              </h2>
              <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">
                Exact DLT registered templates. If a template is left empty, the engine automatically skips sending without error.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {templates.map((tmpl, idx) => (
              <div
                key={tmpl.template_key}
                className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                      {tmpl.template_key}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">{tmpl.template_name}</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tmpl.is_active}
                      onChange={(e) => updateTemplateField(idx, 'is_active', e.target.checked)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Active</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    DLT Message Text (use {'{#var#}'} for placeholders)
                  </label>
                  <textarea
                    rows={2}
                    value={tmpl.template_text}
                    onChange={(e) => updateTemplateField(idx, 'template_text', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-[#E8DEF2] rounded-lg p-3 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Variable Order (Comma-separated slot mapping)
                    </label>
                    <input
                      type="text"
                      value={Array.isArray(tmpl.variable_order) ? tmpl.variable_order.join(', ') : ''}
                      onChange={(e) =>
                        updateTemplateField(
                          idx,
                          'variable_order',
                          e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      placeholder="e.g. name, otp"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-[#E8DEF2] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      DLT Template ID (Optional Reference)
                    </label>
                    <input
                      type="text"
                      value={tmpl.dlt_template_id || ''}
                      onChange={(e) => updateTemplateField(idx, 'dlt_template_id', e.target.value)}
                      placeholder="e.g. 17071618293049102"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-[#E8DEF2] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save My Dreams Configuration
          </button>
        </div>
      </form>

      {/* Live Connection & Test SMS Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
          <Send className="w-4 h-4 text-purple-600" />
          Live Connection & Test SMS
        </h2>
        <p className="text-xs text-[#7E7994] dark:text-[#534F66]">
          Dispatch a live SMS via HTTP GET to verify your My Dreams API Key, Sender ID ({senderId}), and IP reachability.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
                Recipient Mobile (10-digit)
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="e.g. 9150826341"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
                Test Message
              </label>
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleTestSms}
              disabled={testingSms}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {testingSms ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testing Gateway...
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
                      ? 'Gateway Response: Simulated (Sandbox Fallback)'
                      : 'Gateway Response: Live SMS Dispatched'
                    : 'Gateway Response: Dispatch Error'}
                </p>
                <p>{testResult.message}</p>
                {testResult.messageId && (
                  <p className="text-[11px] opacity-80 font-mono">ID: {testResult.messageId}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transmission Audit Logs Table */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              My Dreams SMS Transmission Logs
            </h2>
            <p className="text-xs text-[#7E7994] dark:text-[#534F66]">
              Audit trail of OTPs, order updates, and delivery alerts sent via My Dreams Technology with masked recipients.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchLogs(logPage)}
            disabled={loadingLogs}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg transition"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No transmission logs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-3 px-3">Recipient</th>
                  <th className="py-3 px-3">Template</th>
                  <th className="py-3 px-3">Event / Order</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Time</th>
                  <th className="py-3 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-medium text-slate-900 dark:text-white">
                      {log.phone_masked}
                    </td>
                    <td className="py-3 px-3 font-semibold text-purple-600">
                      {log.template_key || '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {log.status_event || log.order_id || '-'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.status === 'sent'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : log.status === 'simulated'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          : log.status === 'skipped'
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px] max-w-[200px] truncate">
                      {log.error_message || (log.vendor_response ? JSON.stringify(log.vendor_response) : '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {logTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-slate-500">
                  Page {logPage} of {logTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={logPage <= 1}
                    onClick={() => fetchLogs(logPage - 1)}
                    className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={logPage >= logTotalPages}
                    onClick={() => fetchLogs(logPage + 1)}
                    className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
