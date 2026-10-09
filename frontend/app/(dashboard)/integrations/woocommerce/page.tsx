'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Globe, RefreshCw, CheckCircle2, XCircle, Trash2, ArrowLeft, ExternalLink, ShieldCheck, Key, Clock, AlertCircle } from 'lucide-react';
import { API_URL } from '@/lib/env';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function WooCommerceIntegrationPage() {
  const [connection, setConnection] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Form state
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');

  useEffect(() => {
    fetchConnection();
  }, []);

  const fetchConnection = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/integrations/storefront');
      if (res.data.success) {
        const woo = (res.data.data || []).find((c: any) => c.platform === 'woocommerce');
        setConnection(woo || null);
        if (woo) fetchLogs(woo.id);
      }
    } catch {
      toast.error('Failed to load integration status');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (id: string) => {
    try {
      const res = await apiClient.get(`/integrations/storefront/${id}/logs`);
      if (res.data.success) {
        setLogs(res.data.data || []);
      }
    } catch {
      // ignore
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await apiClient.post('/integrations/storefront/woocommerce/connect', {
        store_url: storeUrl,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      });

      if (res.data.success) {
        toast.success('WooCommerce store connected successfully!');
        setConnection(res.data.data);
        setStoreUrl('');
        setConsumerKey('');
        setConsumerSecret('');
        fetchLogs(res.data.data.id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to connect WooCommerce store');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!connection) return;
    try {
      setSyncing(true);
      const res = await apiClient.post(`/integrations/storefront/${connection.id}/sync`);
      if (res.data.success) {
        toast.success('WooCommerce order sync triggered!');
        fetchLogs(connection.id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const confirmDisconnect = async () => {
    if (!connection) return;
    setIsDisconnecting(true);
    try {
      await apiClient.delete(`/integrations/storefront/${connection.id}`);
      toast.success('WooCommerce store disconnected');
      setConnection(null);
      setLogs([]);
      setIsDisconnectModalOpen(false);
    } catch {
      toast.error('Failed to disconnect store');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-3">
        <RefreshCw className="w-6 h-6 text-[#2563eb] animate-spin" />
        <span className="text-sm font-semibold text-[#4b5563]">Loading WooCommerce integration...</span>
      </div>
    );
  }

  const webhookUrl = connection ? `${API_URL}/storefront/webhooks/${connection.id}` : '';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <Link href="/integrations" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4b5563] hover:text-[#0a0d14] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Integrations
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center text-[#2563eb]">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0a0d14]">WooCommerce Integration</h1>
            <p className="text-xs text-[#4b5563] mt-0.5">Automate order import and tracking status updates with WooCommerce</p>
          </div>
        </div>

        {connection && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="ns-btn-primary"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Orders Now'}
            </button>
            <button
              onClick={() => setIsDisconnectModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] font-semibold text-xs hover:bg-[#fee2e2] transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        )}
      </div>

      {connection ? (
        /* Connected View */
        <div className="space-y-6">
          {/* Connection Status Card */}
          <div className="p-6 rounded-2xl border border-[#e2e6ef] bg-white shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
                <span className="text-sm font-bold text-[#0a0d14]">Store Connected & Active</span>
              </div>
              <span className="ns-pill-green">ACTIVE SYNC</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e6ef]">
                <p className="text-[#6b7280]">Store Domain</p>
                <p className="font-bold text-[#0a0d14] mt-0.5 truncate">{connection.store_url || connection.subdomain || 'WooCommerce Store'}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e6ef]">
                <p className="text-[#6b7280]">Last Order Sync</p>
                <p className="font-bold text-[#0a0d14] mt-0.5">
                  {connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString('en-IN') : 'Never'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e6ef]">
                <p className="text-[#6b7280]">Sync Frequency</p>
                <p className="font-bold text-[#0a0d14] mt-0.5">Real-time Webhook + Hourly Fallback</p>
              </div>
            </div>

            {/* Webhook Configuration Help */}
            <div className="p-4 rounded-xl bg-[#eff6ff] border border-[#bfdbfe] space-y-2">
              <div className="flex items-center gap-2 text-[#1e40af] font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
                WooCommerce Webhook Endpoint
              </div>
              <p className="text-xs text-[#374151]">
                To enable instant order creation when customer places an order on WooCommerce, paste this URL into your <strong>WooCommerce &gt; Settings &gt; Advanced &gt; Webhooks</strong> section:
              </p>
              <div className="p-2.5 bg-white border border-[#bfdbfe] rounded-lg font-mono text-xs text-[#1e40af] break-all select-all font-semibold">
                {webhookUrl || `${API_URL}/storefront/webhooks/` + connection.id}
              </div>
            </div>
          </div>

          {/* Sync Logs */}
          <div className="ns-card p-6 space-y-4">
            <h3 className="text-base font-bold text-[#0a0d14]">Sync Execution Logs</h3>
            {logs.length === 0 ? (
              <p className="text-xs text-[#6b7280]">No sync logs recorded yet. Trigger a sync to see output.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log: any) => (
                  <div key={log.id} className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e6ef] text-xs flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[#0a0d14]">{log.action || 'Order Sync'}</p>
                      <p className="text-[#4b5563] mt-0.5">{log.message || log.details}</p>
                    </div>
                    <span className="text-[10.5px] text-[#6b7280]">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Setup Form */
        <div className="ns-card p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#0a0d14]">Connect your WooCommerce Store</h3>
            <p className="text-xs text-[#4b5563] mt-1">
              Generate REST API Consumer Key and Consumer Secret in your WooCommerce Admin under <strong>Settings &gt; Advanced &gt; REST API</strong>.
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Store Website URL</label>
              <input
                type="url"
                required
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://myfashionstore.com"
                className="ns-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Consumer Key (ck_...)</label>
              <input
                type="text"
                required
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="ns-input font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Consumer Secret (cs_...)</label>
              <input
                type="password"
                required
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="ns-input font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="ns-btn-primary"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              {saving ? 'Connecting Store...' : 'Connect WooCommerce Store'}
            </button>
          </form>
        </div>
      )}

      <ConfirmModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        onConfirm={confirmDisconnect}
        title="Disconnect WooCommerce Store"
        description="Are you sure you want to disconnect this WooCommerce store? Automated order sync and fulfillment updates will be discontinued."
        confirmText="Yes, Disconnect"
        variant="danger"
        isLoading={isDisconnecting}
      />
    </div>
  );
}
