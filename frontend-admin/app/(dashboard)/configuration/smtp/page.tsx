'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Mail, Server, Lock, Send, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Eye, EyeOff, FileText, Check,
  Package, AlertCircle, Receipt, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SmtpConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingTemplate, setTestingTemplate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_encryption: 'tls',
    smtp_username: '',
    smtp_password: '',
    smtp_password_status: 'Not set',
    smtp_sender_name: '',
    smtp_sender_email: '',
    smtp_enabled: true,
  });

  const [testEmail, setTestEmail] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('otp_verification');

  const templates = [
    {
      id: 'otp_verification',
      name: 'OTP Security Verification',
      desc: 'Sent during seller registration & 2FA login verification.',
      icon: <ShieldCheck className="w-4 h-4 text-[#8410DC] shrink-0" />,
    },
    {
      id: 'order_dispatched',
      name: 'Order Dispatched Notification',
      desc: 'Sent to customers when courier scans & dispatches shipment.',
      icon: <Package className="w-4 h-4 text-[#8410DC] shrink-0" />,
    },
    {
      id: 'ndr_alert',
      name: 'NDR Delivery Exception Alert',
      desc: 'Sent when shipment delivery fails due to customer unavailable or wrong address.',
      icon: <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />,
    },
    {
      id: 'cod_remittance',
      name: 'COD Remittance Summary',
      desc: 'Sent to sellers when weekly COD payouts are remitted to their bank.',
      icon: <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />,
    },
  ];

  const fetchConfig = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.get('/platform/smtp');
      if (res.data.success) {
        const d = res.data.data;
        setFormData({
          smtp_host: d.smtp_host || '',
          smtp_port: d.smtp_port || 587,
          smtp_encryption: d.smtp_encryption || 'tls',
          smtp_username: d.smtp_username || '',
          smtp_password: d.smtp_password || '',
          smtp_password_status: d.smtp_password_status || (d.smtp_password ? 'Configured' : 'Not set'),
          smtp_sender_name: d.smtp_sender_name || '',
          smtp_sender_email: d.smtp_sender_email || '',
          smtp_enabled: d.smtp_enabled !== false,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to load SMTP configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload: any = { ...formData };
      if (payload.smtp_password && payload.smtp_password.trim()) {
        payload.smtp_password = payload.smtp_password.trim();
      } else {
        delete payload.smtp_password;
      }
      const res = await apiClient.put('/platform/smtp', payload);
      if (res.data.success) {
        toast.success('SMTP Configuration & Password saved successfully!');
        fetchConfig();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to save SMTP configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter a recipient email address for testing.');
      return;
    }
    setTesting(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post('/platform/smtp/test', { target_email: testEmail });
      if (res.data.success) {
        toast.success(res.data.data?.message || `Test email sent successfully to ${testEmail}!`);
      } else {
        setErrorMsg(res.data.error?.message || 'Failed to send test email.');
        toast.error(res.data.error?.message || 'Test email failed.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Test email failed. Check host, credentials, or firewall.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSendSampleTemplate = async () => {
    if (!testEmail) {
      toast.error('Please enter a recipient email address for testing sample template.');
      return;
    }
    setTestingTemplate(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post('/platform/smtp/test', {
        target_email: testEmail,
        template_name: selectedTemplate,
      });
      if (res.data.success) {
        toast.success(`Sample template test email sent to ${testEmail}!`);
      } else {
        setErrorMsg(res.data.error?.message || 'Failed to send template email.');
        toast.error(res.data.error?.message || 'Template email test failed.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to send sample template.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setTestingTemplate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#8410DC]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#8410DC]" />
            SMTP Email Server & Sample Template Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure platform outgoing mail server for transactional notifications and test sample email templates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.smtp_enabled}
              onChange={(e) => setFormData({ ...formData, smtp_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8410DC]"></div>
            <span className="ml-2 text-xs font-semibold text-slate-700">
              {formData.smtp_enabled ? 'SMTP Enabled' : 'SMTP Disabled'}
            </span>
          </label>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SMTP Host */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              SMTP Host Server <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Server className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                placeholder="smtp.hostinger.com or smtp.gmail.com"
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
              />
            </div>
          </div>

          {/* Port & Encryption */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                SMTP Port <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                placeholder="587"
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value, 10) || 587 })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Encryption
              </label>
              <select
                value={formData.smtp_encryption}
                onChange={(e) => setFormData({ ...formData, smtp_encryption: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
              >
                <option value="tls">TLS (STARTTLS / 587)</option>
                <option value="ssl">SSL (Implicit / 465)</option>
                <option value="none">None (Plaintext / 25)</option>
              </select>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              SMTP Username / Email
            </label>
            <input
              type="text"
              placeholder="care@nanoshipy.com"
              value={formData.smtp_username}
              onChange={(e) => setFormData({ ...formData, smtp_username: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                SMTP Password
              </label>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${formData.smtp_password_status === 'Configured' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                {formData.smtp_password_status}
              </span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter 16-character App Password (e.g. ynct plkb fdbk yelf)"
                value={formData.smtp_password}
                onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                className="w-full pl-9 pr-20 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
              />
              <div className="absolute right-2.5 top-2 flex items-center gap-1">
                {formData.smtp_password && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formData.smtp_password);
                      toast.success('SMTP password copied to clipboard!');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer rounded"
                    title="Copy password"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer rounded"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {formData.smtp_password ? (
              <div className="mt-2 flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 font-medium">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Configured Password: <strong className="font-mono">{showPassword ? formData.smtp_password : '••••••••••••••••'}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="underline font-bold cursor-pointer hover:text-emerald-900 ml-2"
                >
                  {showPassword ? 'Hide plain text' : 'Show plain text'}
                </button>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                No password currently configured. Enter your Google App Password (16 characters) and save.
              </div>
            )}
          </div>

          {/* Sender Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Sender Name
            </label>
            <input
              type="text"
              placeholder="Nanoshipy Support"
              value={formData.smtp_sender_name}
              onChange={(e) => setFormData({ ...formData, smtp_sender_name: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
            />
          </div>

          {/* Sender Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Sender Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="care@nanoshipy.com"
              value={formData.smtp_sender_email}
              onChange={(e) => setFormData({ ...formData, smtp_sender_email: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{saving ? 'Saving Configuration...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Sample Templates & Test Dispatch Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#8410DC]" />
            Sample Notification Templates & Live Testing
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Select a sample notification template below and send a live preview email to any recipient address.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                selectedTemplate === t.id
                  ? 'border-[#8410DC] bg-purple-50/50'
                  : 'border-slate-200 hover:border-purple-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                  selectedTemplate === t.id ? 'border-[#8410DC] bg-[#8410DC] text-white' : 'border-slate-300'
                }`}
              >
                {selectedTemplate === t.id && <Check className="w-3 h-3" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  {t.icon}
                  <p className="text-xs font-bold text-slate-900">{t.name}</p>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100">
          <input
            type="email"
            placeholder="Enter recipient email address (e.g. test@example.com)"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
          />
          <button
            type="button"
            disabled={testingTemplate || !testEmail}
            onClick={handleSendSampleTemplate}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {testingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{testingTemplate ? 'Sending Template...' : 'Send Sample Template Test'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
