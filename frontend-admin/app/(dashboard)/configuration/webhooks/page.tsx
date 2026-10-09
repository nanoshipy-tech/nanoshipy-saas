'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Webhook,
  Server,
  Globe,
  Plus,
  Trash2,
  Send,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  X,
  RotateCw,
  Clock,
  History,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  MessageSquare,
  Truck,
  CreditCard,
  ShoppingCart
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WebhookEndpoint {
  id: string;
  tenant_id: string;
  url: string;
  description?: string;
  events: string[];
  is_active: boolean;
  consecutive_failures?: number;
  created_at: string;
  updated_at: string;
}

interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event: string;
  event_id: string;
  payload?: any;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  response_status?: number;
  response_body?: string;
  next_retry_at?: string;
  last_error?: string;
  created_at: string;
  delivered_at?: string;
}

const AVAILABLE_EVENTS = [
  { id: 'export.completed', label: 'Export Completed', desc: 'Dispatched when an asynchronous Excel export finishes successfully.' },
  { id: 'export.failed', label: 'Export Failed', desc: 'Dispatched when an export job fails or encounters an unrecoverable error.' },
  { id: 'shipment.shipped', label: 'Shipment Dispatched', desc: 'Triggered when courier assigns AWB and picks up package.' },
  { id: 'shipment.delivered', label: 'Shipment Delivered', desc: 'Triggered when package is delivered to customer.' },
  { id: 'shipment.status_changed', label: 'Shipment Status Changed', desc: 'Triggered on any courier tracking status transition.' },
  { id: 'order.created', label: 'Order Created', desc: 'Triggered when a merchant creates a new shipment order.' },
  { id: 'ndr.raised', label: 'NDR Exception Raised', desc: 'Triggered when delivery fails or customer action is needed.' },
  { id: 'cod.remitted', label: 'COD Remittance Payout', desc: 'Triggered when weekly COD funds are disbursed to merchant.' },
];

export default function WebhooksConfigurationPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);

  // Add / Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'export.completed',
    'export.failed',
    'order.created',
    'shipment.shipped',
    'shipment.delivered',
  ]);
  const [saving, setSaving] = useState(false);

  // Secret Reveal Modal (shown once on create or rotation)
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string; url: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  // Deliveries Drawer
  const [activeEndpointForDeliveries, setActiveEndpointForDeliveries] = useState<WebhookEndpoint | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(null);

  const inboundWebhooks = [
    {
      name: 'Growax CRM / Meta WhatsApp Webhook',
      url: 'https://api.nanoshipy.com/api/v1/whatsapp/webhook',
      desc: 'Configured in Growax / Meta Business Manager for delivery receipts & inbound chat callbacks.',
      icon: MessageSquare,
    },
    {
      name: 'Courier Tracking & NDR Webhook Receiver',
      url: 'https://api.nanoshipy.com/api/v1/webhooks/inbound/{courier_code}',
      desc: 'Configured in Delhivery, Shipway, Bluedart, Xpressbees dashboard for real-time tracking updates.',
      icon: Truck,
    },
    {
      name: 'Merchant Wallet Auto-Recharge Webhook',
      url: 'https://api.nanoshipy.com/api/v1/webhooks/razorpay',
      desc: 'Configured in Razorpay / PayU dashboard for instant wallet balance credit updates.',
      icon: CreditCard,
    },
    {
      name: 'Shopify & WooCommerce Storefront Webhook',
      url: 'https://api.nanoshipy.com/api/v1/webhooks/storefront/{platform}',
      desc: 'Configured in Shopify / WooCommerce apps for real-time order sync.',
      icon: ShoppingCart,
    },
  ];

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/webhooks');
      if (res.data?.success) {
        setEndpoints(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load webhook endpoints');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) {
      toast.error('Endpoint URL is required');
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error('Select at least one event');
      return;
    }

    try {
      setSaving(true);
      const res = await apiClient.post('/admin/webhooks', {
        url: newUrl,
        description: newDescription || undefined,
        events: selectedEvents,
      });

      if (res.data?.success) {
        const created = res.data.data;
        toast.success('Webhook endpoint registered successfully!');
        setShowAddModal(false);
        setNewUrl('');
        setNewDescription('');

        // Surface secret reveal modal
        if (created.secret) {
          setRevealedSecret({
            id: created.id,
            secret: created.secret,
            url: created.url,
          });
        }

        fetchEndpoints();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to register webhook';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (ep: WebhookEndpoint) => {
    try {
      const res = await apiClient.put(`/admin/webhooks/${ep.id}`, {
        is_active: !ep.is_active,
      });
      if (res.data?.success) {
        toast.success(`Webhook ${!ep.is_active ? 'activated' : 'paused'}`);
        fetchEndpoints();
      }
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook endpoint?')) return;
    try {
      const res = await apiClient.delete(`/admin/webhooks/${id}`);
      if (res.data?.success) {
        toast.success('Webhook endpoint removed');
        if (activeEndpointForDeliveries?.id === id) {
          setActiveEndpointForDeliveries(null);
        }
        fetchEndpoints();
      }
    } catch (err: any) {
      toast.error('Failed to delete webhook');
    }
  };

  const handleRotateSecret = async (ep: WebhookEndpoint) => {
    if (!confirm(`Rotate HMAC signature secret for ${ep.url}? The existing secret will immediately stop working.`)) return;
    try {
      setRotatingId(ep.id);
      const res = await apiClient.post(`/admin/webhooks/${ep.id}/rotate-secret`);
      if (res.data?.success && res.data.data?.secret) {
        toast.success('Secret rotated successfully');
        setRevealedSecret({
          id: ep.id,
          secret: res.data.data.secret,
          url: ep.url,
        });
      }
    } catch (err: any) {
      toast.error('Failed to rotate secret');
    } finally {
      setRotatingId(null);
    }
  };

  const handleTestEndpoint = async (ep: WebhookEndpoint) => {
    try {
      setTestingId(ep.id);
      const res = await apiClient.post(`/admin/webhooks/${ep.id}/test`);
      if (res.data?.success) {
        const delivery = res.data.data;
        if (delivery.status === 'success') {
          toast.success(`Test ping succeeded! Target server responded with HTTP ${delivery.response_status || 200}`);
        } else {
          toast.error(`Target server failed test: ${delivery.last_error || 'HTTP ' + (delivery.response_status || 'Error')}`);
        }
        if (activeEndpointForDeliveries?.id === ep.id) {
          fetchDeliveries(ep.id);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to dispatch test webhook';
      toast.error(msg);
    } finally {
      setTestingId(null);
    }
  };

  const handleOpenDeliveries = (ep: WebhookEndpoint) => {
    setActiveEndpointForDeliveries(ep);
    fetchDeliveries(ep.id);
  };

  const fetchDeliveries = async (endpointId: string) => {
    try {
      setLoadingDeliveries(true);
      const res = await apiClient.get(`/admin/webhooks/${endpointId}/deliveries`, {
        params: { limit: 20 },
      });
      if (res.data?.success) {
        const payload = res.data.data;
        setDeliveries(payload?.items || payload?.rows || (Array.isArray(payload) ? payload : []));
      }
    } catch {
      toast.error('Failed to load delivery logs');
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    try {
      setRetryingDeliveryId(deliveryId);
      const res = await apiClient.post(`/admin/webhooks/deliveries/${deliveryId}/retry`);
      if (res.data?.success) {
        toast.success('Delivery retry queued successfully');
        if (activeEndpointForDeliveries) {
          fetchDeliveries(activeEndpointForDeliveries.id);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to retry delivery');
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14121F] dark:text-white tracking-tight flex items-center gap-2.5">
            <Webhook className="w-7 h-7 text-[#8410DC]" />
            Webhooks & Event Dispatches
          </h1>
          <p className="text-xs text-[#534F66] dark:text-slate-400 mt-1">
            SSRF-protected, HMAC-SHA256 signed event webhooks with automatic exponential backoff retries (1m, 5m, 30m, 2h, 6h).
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#8410DC] hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Webhook Endpoint
        </button>
      </div>

      {/* 1. Inbound Webhooks Reference */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div>
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-[#8410DC]" />
            1. Platform Inbound Webhook Receivers (Read-Only)
          </h2>
          <p className="text-[11px] text-[#7E7994] dark:text-slate-400 mt-0.5">
            Configure these destination URLs inside third-party services (couriers, WhatsApp, Razorpay) to receive events:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {inboundWebhooks.map((wh, idx) => {
            const Icon = wh.icon;
            return (
              <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-[#8410DC]" />
                    {wh.name}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{wh.desc}</p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={wh.url}
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-[#8410DC] dark:text-[#D6A8FF] outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(wh.url)}
                    className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition"
                    title="Copy URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Registered Outward Webhooks */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#8410DC]" />
              2. Registered Outward Webhooks ({endpoints.length})
            </h2>
            <p className="text-[11px] text-[#7E7994] dark:text-slate-400 mt-0.5">
              Target HTTP POST endpoints that receive real-time events like <code className="font-mono text-[#8410DC]">export.completed</code>, <code className="font-mono text-[#8410DC]">shipment.shipped</code>, etc.
            </p>
          </div>
          <button
            onClick={fetchEndpoints}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading && endpoints.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-[#8410DC]" />
            <span>Loading webhook configurations...</span>
          </div>
        ) : endpoints.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400 space-y-2">
            <p>No outward webhook endpoints registered yet.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-[#8410DC] font-semibold hover:underline"
            >
              Click here to register an endpoint
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map((ep) => {
              const isAutoPaused = (ep.consecutive_failures || 0) >= 10;
              return (
                <div
                  key={ep.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    !ep.is_active || isAutoPaused
                      ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {isAutoPaused && (
                    <div className="p-2.5 rounded-lg bg-rose-100 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                      <span>
                        Endpoint automatically paused after 10 consecutive delivery failures. Test connectivity before re-enabling.
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            ep.is_active && !isAutoPaused
                              ? 'bg-emerald-500 animate-pulse'
                              : 'bg-slate-400'
                          }`}
                        />
                        <span className="text-xs font-mono font-bold text-slate-900 dark:text-white break-all">
                          {ep.url}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            ep.is_active && !isAutoPaused
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-500/20'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {ep.is_active && !isAutoPaused ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      {ep.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                          {ep.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(ep)}
                        className="px-2.5 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                      >
                        {ep.is_active ? 'Pause' : 'Resume'}
                      </button>

                      <button
                        type="button"
                        disabled={testingId === ep.id}
                        onClick={() => handleTestEndpoint(ep)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/30 text-[#8410DC] dark:text-[#D6A8FF] border border-[#8410DC]/20 text-xs font-semibold rounded-lg hover:bg-purple-100 transition cursor-pointer"
                      >
                        {testingId === ep.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        Test Ping
                      </button>

                      <button
                        type="button"
                        disabled={rotatingId === ep.id}
                        onClick={() => handleRotateSecret(ep)}
                        className="flex items-center gap-1 px-2.5 py-1 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium transition cursor-pointer"
                        title="Rotate HMAC signing secret"
                      >
                        {rotatingId === ep.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCw className="w-3 h-3" />
                        )}
                        Rotate Secret
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDeliveries(ep)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 text-xs font-semibold transition cursor-pointer"
                      >
                        <History className="w-3 h-3" /> Logs
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteEndpoint(ep.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                        title="Delete Webhook"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-400 font-semibold mr-1">Events:</span>
                    {ep.events?.map((ev) => (
                      <span
                        key={ev}
                        className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-mono rounded text-[10px]"
                      >
                        {ev}
                      </span>
                    ))}
                    <span className="ml-auto text-[10px] text-slate-400 font-mono">
                      Secret: whsec_•••••••• (HMAC-SHA256)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deliveries Drawer / Section */}
      {activeEndpointForDeliveries && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-[#8410DC]" />
                Recent Delivery Logs for {activeEndpointForDeliveries.url}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Idempotent deliveries dispatched via HMAC-SHA256 signatures with 10s timeouts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchDeliveries(activeEndpointForDeliveries.id)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-600 dark:text-slate-300"
                title="Refresh logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDeliveries ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setActiveEndpointForDeliveries(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loadingDeliveries ? (
            <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#8410DC]" />
              <span>Fetching delivery history...</span>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No delivery events recorded yet for this endpoint. Send a &quot;Test Ping&quot; above to verify.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-800/50 font-semibold">
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">HTTP Code</th>
                    <th className="py-2.5 px-3">Attempts</th>
                    <th className="py-2.5 px-3">Dispatched At</th>
                    <th className="py-2.5 px-3">Error / Response</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deliveries.map((del) => (
                    <tr key={del.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {del.event}
                      </td>
                      <td className="py-2.5 px-3">
                        {del.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[10px]">
                            <Check className="w-3 h-3" /> Success
                          </span>
                        ) : del.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-500/20 text-[10px]">
                            <AlertCircle className="w-3 h-3" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/20 text-[10px]">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {del.response_status ? (
                          <span className={del.response_status >= 200 && del.response_status < 300 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                            {del.response_status}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {del.attempts} / 5
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {del.delivered_at || del.created_at ? new Date(del.delivered_at || del.created_at).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate font-mono text-[11px] text-slate-500">
                        {del.last_error || del.response_body || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {del.status === 'failed' && (
                          <button
                            type="button"
                            disabled={retryingDeliveryId === del.id}
                            onClick={() => handleRetryDelivery(del.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#8410DC] hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                          >
                            {retryingDeliveryId === del.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCw className="w-3 h-3" />
                            )}
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Secret Reveal-Once Modal */}
      {revealedSecret && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Webhook Signing Secret
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900">
                ⚠️ <strong>Security Notice:</strong> This secret will only be shown once. Copy and save it securely in your receiving application.
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 font-semibold">Endpoint:</span>
              <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">{revealedSecret.url}</p>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-500 font-semibold">HMAC Secret Key:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={revealedSecret.secret}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-[#8410DC] dark:text-[#D6A8FF] select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(revealedSecret.secret);
                    setSecretCopied(true);
                  }}
                  className="px-3 py-2 bg-[#8410DC] hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {secretCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {secretCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRevealedSecret(null);
                  setSecretCopied(false);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                I have saved my secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Webhook Endpoint Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Webhook className="w-5 h-5 text-[#8410DC]" />
                Register Outward Webhook Endpoint
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEndpoint} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Endpoint URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/webhooks/nanoshipy"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-[#8410DC] font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Protected against SSRF: Private IPs, loopbacks, and link-local ranges are blocked automatically.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production ERP Webhook Receiver"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-[#8410DC]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Subscribe to Events *
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {AVAILABLE_EVENTS.map((ev) => (
                    <label
                      key={ev.id}
                      className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(ev.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEvents((prev) => [...prev, ev.id]);
                          } else {
                            setSelectedEvents((prev) => prev.filter((id) => id !== ev.id));
                          }
                        }}
                        className="mt-0.5 rounded border-slate-300 text-[#8410DC] focus:ring-purple-500"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{ev.label} (<code className="font-mono text-[10px] text-[#8410DC]">{ev.id}</code>)</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{ev.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#8410DC] hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Webhook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
