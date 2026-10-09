'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { MapPin, Key, ToggleLeft, ToggleRight, CheckCircle2, AlertTriangle, Save, Loader2, Zap } from 'lucide-react';

export default function AddressLocationSettingsPage() {
  const [formData, setFormData] = useState({
    pincode_autofill_enabled: true,
    google_places_enabled: false,
    pincode_external_fallback_enabled: true,
    google_maps_api_key: '',
    google_maps_api_key_masked: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/platform/settings/location');
      const data = res.data.data;
      setFormData({
        pincode_autofill_enabled: !!data.pincode_autofill_enabled,
        google_places_enabled: !!data.google_places_enabled,
        pincode_external_fallback_enabled: !!data.pincode_external_fallback_enabled,
        google_maps_api_key: '',
        google_maps_api_key_masked: data.google_maps_api_key_masked || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load location settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: 'pincode_autofill_enabled' | 'google_places_enabled' | 'pincode_external_fallback_enabled') => {
    setFormData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage(null);
    try {
      const res = await apiClient.post('/platform/settings/location/test-maps', {
        apiKey: formData.google_maps_api_key || undefined,
      });
      setTestStatus('success');
      setTestMessage(res.data?.data?.message || 'Google Maps API connection verified successfully! Geocoding & Places services are active.');
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.response?.data?.error?.message || 'Failed to verify Google Maps API key.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiClient.put('/platform/settings/location', {
        pincode_autofill_enabled: formData.pincode_autofill_enabled,
        google_places_enabled: formData.google_places_enabled,
        pincode_external_fallback_enabled: formData.pincode_external_fallback_enabled,
        google_maps_api_key: formData.google_maps_api_key || undefined,
      });

      setSuccessMsg('Location and address settings updated successfully!');
      fetchSettings();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update location settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-[#534F66] gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#8410DC]" />
        <span>Loading location settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] tracking-tight">Location & Address Settings</h1>
        <p className="text-sm text-[#7E7994] dark:text-[#534F66] mt-1">
          Configure pincode auto-fill engine, external fallback APIs, and Google Places Autocomplete.
        </p>
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
        {/* Toggle Switches Card */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#8410DC]" />
            Address Feature Controls
          </h2>

          {/* Toggle 1: Pincode Autofill */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-[#E8DEF2]">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Enable Pincode Auto-Fill Engine</p>
              <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">Automatically resolves District, State, and City from 6-digit Indian pincodes.</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('pincode_autofill_enabled')}
              className={`p-1 transition rounded-full ${formData.pincode_autofill_enabled ? 'text-emerald-500' : 'text-[#534F66]'}`}
            >
              {formData.pincode_autofill_enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Toggle 2: External API Fallback */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-[#E8DEF2]">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Enable India Post External Fallback</p>
              <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">Falls back to India Post public API if pincode is missing from local database.</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('pincode_external_fallback_enabled')}
              className={`p-1 transition rounded-full ${formData.pincode_external_fallback_enabled ? 'text-emerald-500' : 'text-[#534F66]'}`}
            >
              {formData.pincode_external_fallback_enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Toggle 3: Google Places Autocomplete */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Enable Google Places Autocomplete</p>
              <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">Allows merchants to search full street addresses via Google Maps Places API.</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('google_places_enabled')}
              className={`p-1 transition rounded-full ${formData.google_places_enabled ? 'text-emerald-500' : 'text-[#534F66]'}`}
            >
              {formData.google_places_enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>
        </div>

        {/* Secret Key Card */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-[#8410DC]" />
              Google Maps API Credentials
            </h2>
            <button
              type="button"
              disabled={testStatus === 'testing' || (!formData.google_maps_api_key && !formData.google_maps_api_key_masked)}
              onClick={handleTestConnection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-[#8410DC] text-xs font-semibold rounded-lg border border-purple-200/60 dark:border-purple-800/40 transition disabled:opacity-40"
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing API Key...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Test Connection</span>
                </>
              )}
            </button>
          </div>

          {testMessage && (
            <div className={`p-4 rounded-xl text-xs space-y-2.5 ${
              testStatus === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400'
            }`}>
              <div className="flex items-start gap-2.5">
                {testStatus === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                )}
                <span className="font-medium leading-relaxed">{testMessage}</span>
              </div>

              {testStatus === 'error' && (testMessage.toLowerCase().includes('referer') || testMessage.toLowerCase().includes('restriction')) && (
                <div className="mt-2 p-3 bg-white/70 dark:bg-black/20 rounded-lg border border-red-200 dark:border-red-900/30 text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5">
                  <p className="font-bold text-slate-900 dark:text-white">How to fix this in Google Cloud Console (1 minute):</p>
                  <ol className="list-decimal pl-4 space-y-1 leading-normal">
                    <li>Open <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noreferrer" className="text-[#8410DC] underline font-bold">Google Cloud Console → Credentials</a>.</li>
                    <li>Click on your API key (<span className="font-mono text-[10px]">{formData.google_maps_api_key_masked || 'AIzaSy...'}</span>).</li>
                    <li>Under <strong>Set an application restriction</strong>, change from <em>Websites</em> to <strong>None</strong> (or choose <em>IP addresses</em> and enter server IP <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold">34.93.11.164</code>).</li>
                    <li>Under <strong>API restrictions</strong>, ensure <strong>Geocoding API</strong> and <strong>Places API</strong> are selected / enabled.</li>
                    <li>Click <strong>Save</strong> at the bottom, wait 60 seconds, and click <strong>Test Connection</strong> again!</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">
              Google Maps API Key {formData.google_maps_api_key_masked && <span className="text-emerald-600 dark:text-emerald-400 font-normal">(Saved: {formData.google_maps_api_key_masked})</span>}
            </label>
            <input
              type="password"
              placeholder={formData.google_maps_api_key_masked ? 'Enter new API key to update' : 'AIzaSy...'}
              value={formData.google_maps_api_key}
              onChange={(e) => setFormData(prev => ({ ...prev, google_maps_api_key: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#8410DC]"
            />
            <p className="text-[11px] text-[#7E7994] mt-1">API keys are stored securely in platform configuration and masked in all API responses.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#8410DC] hover:bg-[#6c0db5] text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
