'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Key,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertTriangle,
  Save,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function GoogleAuthConfigurationPage() {
  const [formData, setFormData] = useState({
    google_auth_enabled: false,
    google_client_id: '',
    google_client_secret: '',
  });

  const [maskedSecret, setMaskedSecret] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [redirectUris, setRedirectUris] = useState<string[]>([]);
  const [javascriptOrigins, setJavascriptOrigins] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/platform/settings/google-auth');
      const data = res.data?.data || {};
      setFormData({
        google_auth_enabled: !!data.google_auth_enabled,
        google_client_id: data.google_client_id || '',
        google_client_secret: '',
      });
      setMaskedSecret(data.google_client_secret_masked || '');
      setHasSecret(!!data.has_google_client_secret);
      setRedirectUris(data.redirect_uris || [
        'https://api.nanoshipy.com/api/v1/auth/google/callback',
        'https://app.nanoshipy.com/auth/callback',
      ]);
      setJavascriptOrigins(data.javascript_origins || [
        'https://app.nanoshipy.com',
        'https://nanoshipy.com',
      ]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load Google Auth configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        google_auth_enabled: formData.google_auth_enabled,
        google_client_id: formData.google_client_id.trim(),
      };

      if (formData.google_client_secret && formData.google_client_secret.trim()) {
        payload.google_client_secret = formData.google_client_secret.trim();
      }

      await apiClient.put('/platform/settings/google-auth', payload);
      setSuccessMsg('Google OAuth credentials and settings saved successfully!');
      toast.success('Google Authentication settings updated');
      fetchSettings();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save Google Auth settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#534F66] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        <span className="font-medium">Loading Google Auth configuration...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <svg className="w-7 h-7" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google Sign-In & Account Creation
          </h1>
          <p className="text-sm text-slate-500 dark:text-[#7E7994] mt-1">
            Configure Google OAuth 2.0 credentials for 1-click merchant registration and login.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {formData.google_auth_enabled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Live & Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
              Disabled
            </span>
          )}
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

      {/* Main Settings Card */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-[#2D2845] rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-[#2D2845] pb-3">
            <Key className="w-4 h-4 text-purple-500" />
            OAuth 2.0 Client Credentials
          </h2>

          {/* Toggle Switch */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#25213B] rounded-xl border border-slate-100 dark:border-[#312B4C]">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Enable Google Authentication & Registration
              </span>
              <p className="text-xs text-slate-500 dark:text-[#7E7994]">
                When enabled, merchants see "Continue with Google" buttons on Login & Sign-up pages.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, google_auth_enabled: !formData.google_auth_enabled })}
              className={`p-1 rounded-full transition-colors ${
                formData.google_auth_enabled ? 'text-purple-600' : 'text-slate-400'
              }`}
            >
              {formData.google_auth_enabled ? (
                <ToggleRight className="w-9 h-9 fill-current" />
              ) : (
                <ToggleLeft className="w-9 h-9 fill-current" />
              )}
            </button>
          </div>

          {/* Google Client ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#7E7994]">
              Google Client ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required={formData.google_auth_enabled}
              value={formData.google_client_id}
              onChange={(e) => setFormData({ ...formData, google_client_id: e.target.value })}
              placeholder="e.g. 1234567890-abcdefg.apps.googleusercontent.com"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-[#25213B] border border-slate-200 dark:border-[#312B4C] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-slate-400 dark:text-[#65607C]">
              Obtained from Google Cloud Console &rarr; APIs & Services &rarr; Credentials.
            </p>
          </div>

          {/* Google Client Secret */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#7E7994]">
                Google Client Secret <span className="text-red-500">*</span>
              </label>
              {hasSecret && (
                <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Secret configured ({maskedSecret})
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={formData.google_client_secret}
                onChange={(e) => setFormData({ ...formData, google_client_secret: e.target.value })}
                placeholder={hasSecret ? '•••••••••••••••••••• (Leave blank to keep existing secret)' : 'Enter Client Secret (GOCSPX-...)'}
                className="w-full px-4 py-2.5 pr-10 text-sm bg-slate-50 dark:bg-[#25213B] border border-slate-200 dark:border-[#312B4C] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-[#65607C]">
              Your Client Secret is securely stored in encrypted platform settings and never exposed to the public.
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Credentials...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Google Credentials
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Google Cloud Console Setup Guide & Redirect URIs Card */}
      <div className="bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-[#2D2845] rounded-2xl p-6 shadow-sm space-y-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-[#2D2845] pb-3">
          <Info className="w-4 h-4 text-purple-500" />
          Google Cloud Console Configuration Guide
        </h2>

        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-[#908BA7] leading-relaxed">
            Follow these steps in your{' '}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="text-purple-600 hover:underline inline-flex items-center gap-1 font-semibold"
            >
              Google Cloud Console Credentials Page
              <ExternalLink className="w-3 h-3" />
            </a>{' '}
            to enable Google Sign-in:
          </p>

          <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 dark:text-[#88839F]">
            <li>Click <strong>Create Credentials</strong> &rarr; <strong>OAuth client ID</strong>.</li>
            <li>Select Application type: <strong>Web application</strong>.</li>
            <li>Add the <strong>Authorized JavaScript Origins</strong> listed below.</li>
            <li>Add the <strong>Authorized Redirect URIs</strong> listed below.</li>
            <li>Copy the generated <strong>Client ID</strong> and <strong>Client Secret</strong> into the fields above and click Save.</li>
          </ol>
        </div>

        {/* Authorized JavaScript Origins */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#7E7994]">
            Authorized JavaScript Origins
          </span>
          <div className="space-y-2">
            {javascriptOrigins.map((origin, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-[#25213B] border border-slate-200 dark:border-[#312B4C] rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200"
              >
                <span>{origin}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(origin, `origin-${idx}`)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#312B4C] text-slate-500 dark:text-slate-400 transition-colors"
                  title="Copy Origin"
                >
                  {copiedIndex === `origin-${idx}` ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Authorized Redirect URIs */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#7E7994]">
            Authorized Redirect URIs
          </span>
          <div className="space-y-2">
            {redirectUris.map((uri, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-[#25213B] border border-slate-200 dark:border-[#312B4C] rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200"
              >
                <span>{uri}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(uri, `uri-${idx}`)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#312B4C] text-slate-500 dark:text-slate-400 transition-colors"
                  title="Copy URI"
                >
                  {copiedIndex === `uri-${idx}` ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
