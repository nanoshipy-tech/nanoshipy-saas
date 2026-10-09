'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import {
  ShoppingBag, RefreshCw, CheckCircle2, Trash2, ArrowLeft, ShieldCheck,
  Clock, AlertTriangle, Package, Truck, ExternalLink, Copy, Info,
  ChevronRight, Box, Key, Globe, Link2, HelpCircle, Check, Eye, EyeOff
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type ConnectionOption = 'oauth' | 'manual';
type Tab = 'overview' | 'orders' | 'logs';

const STATUS_COLORS: Record<string, string> = {
  created:        'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  pending:        'bg-amber-50  text-amber-700  dark:bg-amber-500/10 dark:text-amber-400',
  ready_to_ship:  'bg-blue-50   text-blue-700   dark:bg-blue-500/10  dark:text-blue-400',
  shipped:        'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  delivered:      'bg-green-50  text-green-700  dark:bg-green-500/10  dark:text-green-400',
  cancelled:      'bg-rose-50   text-rose-600   dark:bg-rose-500/10   dark:text-rose-400',
};

function ShopifyIntegrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Connection state
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeOption, setActiveOption] = useState<ConnectionOption>('oauth');

  // Option A (OAuth / Custom App) Form state
  const [oauthDomain, setOauthDomain] = useState('');
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [showOauthSecret, setShowOauthSecret] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showOauthGuide, setShowOauthGuide] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [copiedScopes, setCopiedScopes] = useState(false);

  // Fulfillment push state
  const [fulfillingOrderId, setFulfillingOrderId] = useState<string | null>(null);
  const [refreshingScopes, setRefreshingScopes] = useState(false);
  const [showTokenUpdate, setShowTokenUpdate] = useState(false);
  const [newAccessToken, setNewAccessToken] = useState('');
  const [updatingToken, setUpdatingToken] = useState(false);

  // Option B (Manual Token) Form state
  const [manualDomain, setManualDomain] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [manualWebhookSecret, setManualWebhookSecret] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Connected view state
  const [tab, setTab] = useState<Tab>('overview');
  const [syncing, setSyncing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Check URL query parameters for OAuth redirection results
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const connectedParam = searchParams.get('connected');
    const shopParam = searchParams.get('shop');

    if (errorParam) {
      toast.error(`Shopify Connection Error: ${decodeURIComponent(errorParam)}`, { duration: 6000 });
      setOauthError(decodeURIComponent(errorParam));
    } else if (connectedParam === 'success') {
      toast.success(`Successfully connected ${shopParam ? decodeURIComponent(shopParam) : 'Shopify store'}!`, { duration: 5000 });
      // Clean query params
      router.replace('/integrations/shopify');
    }
  }, [searchParams, router]);

  // Fetch connection status on mount
  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const fetchConnectionStatus = async () => {
    try {
      setLoading(true);
      // Try dedicated shopify endpoint first
      const res = await apiClient.get('/integrations/shopify/status');
      if (res.data?.success && res.data.data?.connected) {
        setConnection(res.data.data);
        fetchOrders();
        fetchLogs();
      } else {
        // Fallback check legacy storefront table if applicable
        const legacyRes = await apiClient.get('/integrations/storefront').catch(() => null);
        const legacyShopify = legacyRes?.data?.data?.find((c: any) => c.platform === 'shopify' && c.status === 'connected');
        if (legacyShopify) {
          setConnection({
            id: legacyShopify.id,
            shop_domain: legacyShopify.store_url,
            connection_method: 'manual',
            status: legacyShopify.status,
            webhook_registered: true,
            connected_at: legacyShopify.created_at,
            last_synced_at: legacyShopify.last_synced_at,
          });
          fetchOrders(legacyShopify.id);
          fetchLogs(legacyShopify.id);
        } else {
          setConnection(null);
        }
      }
    } catch (err: any) {
      loggerError('Failed to fetch Shopify integration status', err);
    } finally {
      setLoading(false);
    }
  };

  const loggerError = (msg: string, err: any) => {
    const errMsg = err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || 'Error occurred';
    console.error(msg, errMsg);
  };

  const fetchOrders = useCallback(async (connectionId?: string) => {
    try {
      setLoadingOrders(true);
      // 1. Dedicated shopify orders endpoint
      const res = await apiClient.get('/integrations/shopify/orders?limit=50').catch(() => null);
      if (res?.data?.success) {
        setOrders(res.data.data?.data || res.data.data || []);
        setOrdersTotal(res.data.data?.count || (res.data.data?.data?.length || 0));
        return;
      }
      // 2. Legacy fallback
      const connId = connectionId || connection?.id;
      if (connId) {
        const legacyRes = await apiClient.get(`/integrations/storefront/${connId}/orders?limit=50`).catch(() => null);
        if (legacyRes?.data?.success) {
          setOrders(legacyRes.data.data?.data || legacyRes.data.data || []);
          setOrdersTotal(legacyRes.data.data?.count || (legacyRes.data.data?.data?.length || 0));
          return;
        }
      }
      // 3. Fallback: general orders with source api/shopify
      const generalRes = await apiClient.get('/orders?source=api&limit=25').catch(() => null);
      if (generalRes?.data?.success) {
        const rows = generalRes.data.data?.rows || generalRes.data.data || [];
        const shopifyOrders = rows.filter((o: any) => o.storefront_connection_id || o.order_reference?.startsWith('SHP-') || o.order_reference?.startsWith('#'));
        setOrders(shopifyOrders);
        setOrdersTotal(shopifyOrders.length);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingOrders(false);
    }
  }, [connection]);

  const fetchLogs = async (connectionId?: string) => {
    try {
      // 1. Dedicated shopify logs endpoint
      const res = await apiClient.get('/integrations/shopify/logs').catch(() => null);
      if (res?.data?.success && res.data.data?.data) {
        setLogs(res.data.data.data || []);
        return;
      }
      // 2. Legacy fallback
      const connId = connectionId || connection?.id;
      if (connId) {
        const legacyRes = await apiClient.get(`/integrations/storefront/${connId}/logs`).catch(() => null);
        if (legacyRes?.data?.success) {
          setLogs(legacyRes.data.data?.data || legacyRes.data.data || []);
        }
      }
    } catch {
      /* ignore */
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Option A: OAuth Authorization Handler
  // ─────────────────────────────────────────────────────────────
  const handleOAuthConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setOauthError(null);

    const rawDomain = oauthDomain.trim();
    const rawClientId = oauthClientId.trim();
    const rawClientSecret = oauthClientSecret.trim();

    if (!rawDomain) {
      setOauthError('Please enter your Shopify store domain.');
      return;
    }

    let cleanDomain = rawDomain.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].replace(/\/+$/, '');
    if (!cleanDomain.includes('.')) cleanDomain = `${cleanDomain}.myshopify.com`;

    if (!cleanDomain.endsWith('.myshopify.com')) {
      const msg = `Shopify requires your permanent ".myshopify.com" domain (e.g. "${cleanDomain.split('.')[0]}.myshopify.com"), not a custom domain like "${cleanDomain}".`;
      setOauthError(msg);
      return;
    }

    try {
      setOauthLoading(true);
      const res = await apiClient.post('/integrations/shopify/oauth/authorize', {
        shop: cleanDomain,
        client_id: rawClientId || undefined,
        client_secret: rawClientSecret || undefined,
      });

      if (res.data?.success && res.data.data?.authorize_url) {
        toast.loading('Redirecting to Shopify for authorization...');
        window.location.href = res.data.data.authorize_url;
      } else {
        throw new Error(res.data?.error?.message || 'Failed to generate authorization URL');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'OAuth initialization failed';
      const formatted = typeof msg === 'object' ? JSON.stringify(msg) : String(msg);
      setOauthError(formatted);
      toast.error(formatted);
      setOauthLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Push Fulfillment to Shopify Handler
  // ─────────────────────────────────────────────────────────────
  const handlePushFulfillment = async (orderId: string) => {
    try {
      setFulfillingOrderId(orderId);
      const res = await apiClient.post(`/integrations/shopify/orders/${orderId}/fulfill`);
      if (res.data?.success) {
        toast.success(res.data.data?.message || 'Tracking & fulfillment updated on Shopify successfully!');
        await fetchOrders();
      } else {
        toast.error(res.data?.error?.message || 'Shopify fulfillment update failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to update fulfillment on Shopify');
    } finally {
      setFulfillingOrderId(null);
    }
  };

  const handleRefreshScopes = async () => {
    try {
      setRefreshingScopes(true);
      const res = await apiClient.post('/integrations/shopify/refresh-scopes');
      if (res.data?.success && res.data.data?.success) {
        if (res.data.data?.has_write_fulfillments) {
          toast.success('Shopify permissions verified! write_fulfillments is active.');
        } else {
          toast.error(res.data.data?.message || 'write_fulfillments is still missing in your Shopify app.');
        }
        await fetchConnectionStatus();
      } else if (res.data?.data?.isTokenInvalid || res.data?.isTokenInvalid) {
        setShowTokenUpdate(true);
        toast.error(res.data?.data?.message || 'Access token invalid or expired. Please update your token.', { duration: 7000 });
      } else {
        toast.error(res.data?.data?.message || res.data?.error?.message || 'Failed to verify scopes');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to verify scopes with Shopify';
      if (/Invalid API key or access token/i.test(errMsg) || err.response?.status === 401) {
        setShowTokenUpdate(true);
        toast.error('Your Shopify access token is expired or was regenerated. Please paste your new Admin API access token below.', { duration: 7000 });
      } else {
        toast.error(errMsg);
      }
    } finally {
      setRefreshingScopes(false);
    }
  };

  const handleUpdateToken = async () => {
    const rawToken = newAccessToken.trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '');
    if (!rawToken) {
      toast.error('Please enter your Admin API access token.');
      return;
    }
    if (!rawToken.startsWith('shpat_')) {
      toast.error('Shopify Admin API access token must start with "shpat_".');
      return;
    }
    try {
      setUpdatingToken(true);
      const res = await apiClient.post('/integrations/shopify/manual-connect', {
        shop_domain: connection.shop_domain,
        access_token: rawToken,
      });
      if (res.data?.success) {
        toast.success('Shopify access token updated and verified successfully!');
        setNewAccessToken('');
        setShowTokenUpdate(false);
        await fetchConnectionStatus();
      } else {
        toast.error(res.data?.error?.message || 'Failed to update access token');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Token update failed');
    } finally {
      setUpdatingToken(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Option B: Manual Access Token Handler
  // ─────────────────────────────────────────────────────────────
  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const rawDomain = manualDomain.trim();
    const rawToken  = manualToken.trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '');
    const rawSecret = manualWebhookSecret.trim();

    if (!rawDomain) {
      setManualError('Please enter your Shopify store domain.');
      return;
    }
    if (!rawToken) {
      setManualError('Please enter your Admin API access token.');
      return;
    }

    let cleanDomain = rawDomain.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].replace(/\/+$/, '');
    if (!cleanDomain.includes('.')) cleanDomain = `${cleanDomain}.myshopify.com`;

    if (!cleanDomain.endsWith('.myshopify.com')) {
      const msg = `Shopify Admin API requires your permanent ".myshopify.com" domain (e.g. "${cleanDomain.split('.')[0]}.myshopify.com"), not a custom domain like "${cleanDomain}".`;
      setManualError(msg);
      return;
    }

    if (rawToken.startsWith('shpss_')) {
      const msg = `You entered an API Secret Key (shpss_...). This is NOT the access token. Shopify requires an Admin API Access Token starting with "shpat_". Go to: Shopify Admin → Apps → Develop apps → Your App → API credentials → click "Install app" → copy "Admin API access token".`;
      setManualError(msg);
      return;
    }

    if (!rawToken.startsWith('shpat_')) {
      const msg = `Your token starts with "${rawToken.substring(0, 6)}...". Shopify Admin API Access Tokens always start with "shpat_". Please ensure you clicked "Install app" in your Shopify Custom App and copied the Admin API access token.`;
      setManualError(msg);
      return;
    }

    try {
      setManualLoading(true);
      const res = await apiClient.post('/integrations/shopify/manual-connect', {
        shop_domain: cleanDomain,
        access_token: rawToken,
        webhook_secret: rawSecret || undefined,
      });

      if (res.data?.success) {
        toast.success('Shopify store connected successfully via Manual Access Token!');
        setConnection(res.data.data);
        setManualDomain('');
        setManualToken('');
        setManualWebhookSecret('');
        setManualError(null);
        fetchOrders(res.data.data.id);
        fetchLogs(res.data.data.id);
      } else {
        throw new Error(res.data?.error?.message || 'Connection failed');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to connect Shopify store';
      const formatted = typeof msg === 'object' ? JSON.stringify(msg) : String(msg);
      setManualError(formatted);
      toast.error(formatted);
    } finally {
      setManualLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Disconnect Handler
  // ─────────────────────────────────────────────────────────────
  const confirmDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await apiClient.delete('/integrations/shopify/disconnect');
      // Also clean legacy connection if any
      if (connection?.id) {
        await apiClient.delete(`/integrations/storefront/${connection.id}`).catch(() => {});
      }
      toast.success('Shopify store disconnected successfully.');
      setConnection(null);
      setOrders([]);
      setLogs([]);
      setIsDisconnectModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to disconnect store');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Manual Sync Trigger
  // ─────────────────────────────────────────────────────────────
  const handleSyncNow = async () => {
    if (!connection) return;
    try {
      setSyncing(true);
      const res = await apiClient.post('/integrations/shopify/sync');
      if (res.data?.success) {
        const { imported, total_fetched } = res.data.data || {};
        toast.success(`Shopify sync complete: ${imported || 0} imported out of ${total_fetched || 0} fetched orders!`);
      } else {
        toast.success('Shopify order sync triggered! Refreshing orders...');
      }
      await fetchOrders();
      await fetchLogs();
    } catch (err: any) {
      // Fallback: try legacy sync
      if (connection?.id) {
        await apiClient.post(`/integrations/storefront/${connection.id}/sync`).catch(() => {});
      }
      toast.error(err.response?.data?.error?.message || err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin" />
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading Shopify integration status...</span>
      </div>
    );
  }

  const webhookEndpointUrl = `https://api.nanoshipy.com/api/integrations/shopify/webhooks/orders`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
      {/* Back button */}
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-[#A29DB8] dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Stores & Channels
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#2A2440] pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shopify Integration</h1>
              {connection && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-[#A29DB8] mt-0.5">
              Sync orders automatically & push AWB tracking updates directly to your Shopify customers
            </p>
          </div>
        </div>

        {connection && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowTokenUpdate(!showTokenUpdate)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white font-semibold text-xs transition-all border border-slate-200 dark:border-white/10"
            >
              <Key className="w-3.5 h-3.5 text-amber-500" />
              <span>{showTokenUpdate ? 'Cancel Token Update' : 'Update Access Token'}</span>
            </button>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Orders Now'}
            </button>
            <button
              onClick={() => setIsDisconnectModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        )}
      </div>

      {connection ? (
        /* ═════════════════════════════════════════════════════════════
           CONNECTED VIEW
        ═════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Update Token Box */}
          {showTokenUpdate && (
            <div className="p-5 rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/60 dark:bg-[#131620] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Update Shopify Admin API Access Token</h3>
                </div>
                <button
                  onClick={() => setShowTokenUpdate(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  ✕ Close
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                When you grant new scopes (like <strong>write_fulfillments</strong>) or reinstall the app in Shopify, Shopify creates a new access token. Copy your token from Shopify Admin &rarr; <strong>Settings</strong> &rarr; <strong>Apps and sales channels</strong> &rarr; <strong>Develop apps</strong> &rarr; your App &rarr; <strong>API credentials</strong> and paste it below:
              </p>
              <div className="flex items-center gap-2 flex-col sm:flex-row">
                <input
                  type="password"
                  value={newAccessToken}
                  onChange={(e) => setNewAccessToken(e.target.value)}
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-[#2A2440] bg-white dark:bg-[#090b10] text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleUpdateToken}
                  disabled={updatingToken || !newAccessToken.trim()}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  {updatingToken ? 'Saving & Verifying...' : 'Save & Verify Token'}
                </button>
              </div>
            </div>
          )}
          {/* Status Banner */}
          <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    {connection.shop_domain}
                  </p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    connection.connection_method === 'oauth'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                  }`}>
                    {connection.connection_method === 'oauth' ? 'OAuth 2.0 Connect' : 'Custom App Access Token'}
                  </span>
                  {(connection.has_write_fulfillments ?? Boolean(connection.scopes && connection.scopes.includes('write_fulfillments'))) ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> Fulfillment Sync Ready
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> Missing Fulfillment Scope
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-[#A29DB8] font-mono mt-0.5">
                  Shopify Store URL: https://{connection.shop_domain}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs shrink-0 border-t sm:border-t-0 border-emerald-200 dark:border-emerald-500/20 pt-3 sm:pt-0">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Webhooks</p>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {connection.webhook_registered ? 'Registered & Active' : 'Active'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Last Synced</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString('en-IN') : 'Just now'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#2A2440] pb-1">
            {(['overview', 'orders', 'logs'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all capitalize ${
                  tab === t
                    ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#131620]'
                    : 'text-slate-500 dark:text-[#A29DB8] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t === 'orders' ? `Imported Orders (${ordersTotal})` : t === 'logs' ? 'Sync Activity Logs' : 'Integration Overview'}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview */}
          {tab === 'overview' && (() => {
            const hasWriteFulfillments = connection.has_write_fulfillments ?? Boolean(connection.scopes && connection.scopes.includes('write_fulfillments'));

            return (
              <div className="space-y-4">
                {/* Missing write_fulfillments Warning Banner */}
                {!hasWriteFulfillments && (
                  <div className="p-5 rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-xs space-y-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1.5 flex-1">
                        <h3 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                          Action Required: Missing "write_fulfillments" Permission in Shopify
                        </h3>
                        <p className="text-amber-950/80 dark:text-amber-200/90 leading-relaxed">
                          Your orders currently remain <strong>Unfulfilled</strong> on Shopify because your Shopify App does not have permission to push tracking numbers and create fulfillments.
                        </p>
                        <div className="bg-white/90 dark:bg-black/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-1.5 mt-2">
                          <p className="font-bold text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400">Follow these 5 steps in Shopify Admin:</p>
                          <ol className="list-decimal list-inside space-y-1 text-xs">
                            <li>Open <strong>Shopify Admin</strong> &rarr; <strong>Settings</strong> &rarr; <strong>Apps and sales channels</strong> &rarr; <strong>Develop apps</strong>.</li>
                            <li>Click your app &rarr; <strong>Configuration</strong> &rarr; <strong>Admin API integration</strong>.</li>
                            <li>Search for <strong>Order fulfillment</strong> and check both <strong>write_fulfillments</strong> and <strong>read_fulfillments</strong>.</li>
                            <li>Click <strong>Save</strong> (top right in Shopify).</li>
                            <li>Switch to the <strong>API credentials</strong> tab and click <strong>Install app</strong> (or <strong>Reinstall app</strong>) so Shopify applies the new scopes.</li>
                          </ol>
                        </div>
                        <div className="pt-2 flex items-center gap-3 flex-wrap">
                          <button
                            onClick={handleRefreshScopes}
                            disabled={refreshingScopes}
                            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingScopes ? 'animate-spin' : ''}`} />
                            {refreshingScopes ? 'Verifying with Shopify...' : 'Verify Permissions Now'}
                          </button>
                          <button
                            onClick={() => setShowTokenUpdate(true)}
                            className="px-4 py-2 rounded-xl bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/15 text-slate-800 dark:text-white font-semibold text-xs transition-all flex items-center gap-1.5 border border-amber-300 dark:border-white/10 shadow-sm"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-500" />
                            Update Access Token (If Regenerated)
                          </button>
                          <span className="text-[11px] text-amber-700 dark:text-amber-400">
                            Tests your live Shopify store scopes directly
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#2A2440] bg-white dark:bg-[#131620] shadow-sm">
                    <p className="text-slate-400 dark:text-slate-500 font-medium">Connection Method</p>
                    <p className="font-bold text-slate-900 dark:text-white mt-1 text-sm">
                      {connection.connection_method === 'oauth' ? 'Official OAuth App' : 'Custom App Token (AES-256)'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#A29DB8] mt-1">Credentials encrypted at rest</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#2A2440] bg-white dark:bg-[#131620] shadow-sm">
                    <p className="text-slate-400 dark:text-slate-500 font-medium">Orders Imported</p>
                    <p className="font-bold text-slate-900 dark:text-white mt-1 text-sm">{ordersTotal} Orders</p>
                    <p className="text-[11px] text-slate-500 dark:text-[#A29DB8] mt-1">Synced to Nanoshipy & Shipway</p>
                  </div>
                  <div className={`p-4 rounded-2xl border shadow-sm ${
                    hasWriteFulfillments
                      ? 'border-slate-200 dark:border-[#2A2440] bg-white dark:bg-[#131620]'
                      : 'border-amber-300 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5'
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className="text-slate-400 dark:text-slate-500 font-medium">Auto-Fulfillment Sync</p>
                      <button
                        onClick={handleRefreshScopes}
                        disabled={refreshingScopes}
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${refreshingScopes ? 'animate-spin' : ''}`} />
                        Verify
                      </button>
                    </div>
                    {hasWriteFulfillments ? (
                      <>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 text-sm flex items-center gap-1">
                          <Check className="w-4 h-4" /> Enabled & Active
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#A29DB8] mt-1">AWBs pushed to Shopify automatically</p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-amber-600 dark:text-amber-400 mt-1 text-sm flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Missing Permission
                        </p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">Needs write_fulfillments scope</p>
                      </>
                    )}
                  </div>
                </div>

              {/* Webhook Endpoint Info */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#2A2440] bg-white dark:bg-[#131620] shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Automated Shopify Webhook Receiver
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Webhooks are automatically registered for <code>orders/create</code>, <code>orders/cancelled</code>, and <code>orders/fulfilled</code>.
                  Every incoming order payload is HMAC-SHA256 verified and mapped directly into Nanoshipy:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-50 dark:bg-[#090b10] border border-slate-200 dark:border-[#2A2440] rounded-xl px-4 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-mono select-all truncate">
                    {webhookEndpointUrl}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(webhookEndpointUrl);
                      toast.success('Webhook endpoint URL copied to clipboard!');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy URL
                  </button>
                </div>
              </div>

              {/* How Fulfillment Flow Works */}
              <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 text-xs space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-300">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Complete Order & Fulfillment Lifecycle
                </div>
                <ul className="space-y-1.5 text-blue-950/80 dark:text-blue-200/80 list-disc list-inside leading-relaxed">
                  <li><strong>Instant Import:</strong> When a customer places an order on your Shopify store, Nanoshipy creates an order record under your seller account immediately via webhook.</li>
                  <li><strong>Shipway Multi-Courier Routing:</strong> The order is fed into Nanoshipy's smart courier rate comparison and routing engine (ST Courier for TN, Shipway National Express for Rest of India).</li>
                  <li><strong>AWB Generation & Auto-Fulfillment:</strong> Once you generate an AWB or manifest, the tracking number and carrier URL are automatically updated in Shopify.</li>
                  <li><strong>Customer Notification:</strong> Shopify marks the order as <em>Fulfilled</em> and sends your customer their tracking link automatically.</li>
                </ul>
              </div>
            </div>
            );
          })()}

          {/* Tab 2: Orders */}
          {tab === 'orders' && (
            <div className="rounded-2xl border border-slate-200 dark:border-[#2A2440] bg-white dark:bg-[#131620] overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-[#2A2440] flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" /> Shopify Order Feed ({orders.length})
                </h2>
                <button
                  onClick={() => fetchOrders()}
                  disabled={loadingOrders}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingOrders ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {loadingOrders ? (
                <div className="py-12 flex justify-center items-center gap-2 text-sm text-slate-500 dark:text-[#A29DB8]">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" /> Loading orders...
                </div>
              ) : orders.length === 0 ? (
                <div className="py-14 text-center">
                  <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-[#3A3550] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Shopify orders recorded yet</p>
                  <p className="text-xs text-slate-500 dark:text-[#A29DB8] mt-1">
                    New orders placed in your Shopify store will appear here automatically. You can also click <strong>"Sync Orders Now"</strong>.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-[#2A2440] text-slate-400 dark:text-[#A29DB8]">
                        <th className="py-3 px-4">Order Ref</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Fulfillment / AWB</th>
                        <th className="py-3 px-4">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {orders.map((order: any) => {
                        const shipments: any[] = order.shipments || [];
                        const activeShipment = shipments.find((s: any) => !['cancelled', 'failed'].includes(s.status));
                        const isFulfilled = !!activeShipment?.awb_number;

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 dark:text-white font-mono">
                                {order.order_reference}
                              </span>
                              {order.external_order_id && (
                                <p className="text-[10px] text-slate-400">ID: #{order.external_order_id}</p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-800 dark:text-slate-200">{order.customer_name}</p>
                              <p className="text-[10px] text-slate-400">{order.customer_phone}</p>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                              ₹{parseFloat(order.order_value || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                order.payment_mode === 'cod'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                              }`}>
                                {order.payment_mode || 'prepaid'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                STATUS_COLORS[order.status] || STATUS_COLORS.created
                              }`}>
                                {order.status?.replace(/_/g, ' ') || 'created'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {isFulfilled ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                    <Truck className="w-2.5 h-2.5" /> Fulfilled
                                  </span>
                                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{activeShipment.awb_number}</p>
                                  <button
                                    onClick={() => handlePushFulfillment(order.id)}
                                    disabled={fulfillingOrderId === order.id}
                                    className="mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                  >
                                    <RefreshCw className={`w-2.5 h-2.5 ${fulfillingOrderId === order.id ? 'animate-spin' : ''}`} />
                                    {fulfillingOrderId === order.id ? 'Updating...' : 'Re-sync Shopify'}
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                                    <Box className="w-2.5 h-2.5" /> Ready to Ship
                                  </span>
                                  <div className="mt-1.5">
                                    <Link
                                      href={`/orders/${order.id}/ship`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8410DC] hover:bg-[#700ebc] text-white text-[10px] font-bold shadow-sm transition-all"
                                    >
                                      Ship Now <ChevronRight className="w-3 h-3" />
                                    </Link>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {order.created_at
                                ? new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Logs */}
          {tab === 'logs' && (
            <div className="rounded-2xl border border-slate-200 dark:border-[#2A2440] bg-white dark:bg-[#131620] overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-[#2A2440] flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" /> Recent Sync & Webhook Logs
                </h2>
                <button
                  onClick={() => fetchLogs()}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh Logs
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-[#A29DB8]">
                  No sync logs recorded yet. Incoming order webhooks and manual syncs will be logged here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-[#2A2440] text-slate-400 dark:text-[#A29DB8]">
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Trigger</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Imported</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {logs.map((log: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {new Date(log.started_at || log.created_at || log.timestamp).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                              {log.trigger || 'webhook'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              (log.orders_failed || 0) > 0
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            }`}>
                              {(log.orders_failed || 0) > 0 ? 'PARTIAL' : 'SUCCESS'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {log.orders_imported || 0}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-[#A29DB8] truncate max-w-sm">
                            {log.message || 'Completed successfully'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ═════════════════════════════════════════════════════════════
           DISCONNECTED VIEW (Two Connection Options)
        ═════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Two Option Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option A Card */}
            <div
              onClick={() => setActiveOption('oauth')}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                activeOption === 'oauth'
                  ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-md'
                  : 'border-slate-200 dark:border-[#2A2440] bg-white dark:bg-[#131620] hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Link2 className="w-5 h-5" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  activeOption === 'oauth'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  Option A
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3">
                Connect with Client ID & Secret
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#A29DB8] mt-1 leading-relaxed">
                Enter your Shopify App Client ID (API Key) & Secret Key for secure OAuth authorization directly from your store.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span>{activeOption === 'oauth' ? 'Selected' : 'Select Option A'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Option B Card */}
            <div
              onClick={() => setActiveOption('manual')}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                activeOption === 'manual'
                  ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-md'
                  : 'border-slate-200 dark:border-[#2A2440] bg-white dark:bg-[#131620] hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Key className="w-5 h-5" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  activeOption === 'manual'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  Option B
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3">
                I have an Access Token
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#A29DB8] mt-1 leading-relaxed">
                Paste your existing <code>shpat_...</code> Admin API token from your Shopify custom app ("Develop apps") directly.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span>{activeOption === 'manual' ? 'Selected' : 'Select Option B'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Active Option Form Card */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#2A2440] bg-white dark:bg-[#131620] shadow-sm">
            {activeOption === 'oauth' ? (
              /* ── OPTION A FORM: OAuth & Client ID/Secret Connect ── */
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                      A
                    </span>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Connect via Shopify OAuth (Client ID & Secret)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#A29DB8] mt-1">
                    Enter your Shopify store domain and Custom App Client credentials. You will be redirected to your Shopify Admin to approve permissions.
                  </p>
                </div>

                {/* Step-by-Step Custom App Guide Accordion */}
                <div className="rounded-xl border border-slate-200 dark:border-[#2A2440] overflow-hidden bg-slate-50/50 dark:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setShowOauthGuide(!showOauthGuide)}
                    className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                      How to get your Shopify App Client ID & Secret (4 quick steps)
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 text-xs">
                      {showOauthGuide ? 'Hide Guide' : 'Show Guide'}
                    </span>
                  </button>

                  {showOauthGuide && (
                    <div className="p-4 border-t border-slate-200 dark:border-[#2A2440] text-xs text-slate-600 dark:text-slate-300 space-y-3">
                      <ol className="space-y-2.5 list-decimal list-inside leading-relaxed">
                        <li>Log in to your <strong>Shopify Admin</strong> and navigate to <strong>Settings → Apps and sales channels → Develop apps</strong>.</li>
                        <li>Click <strong>"Create an app"</strong> and name it (e.g., <em>Nanoshipy Logistics</em>).</li>
                        <li>In <strong>Configuration → Admin API integration</strong>, select these scopes:
                          <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono text-[11px]">
                            {['read_orders', 'write_orders', 'read_fulfillments', 'write_fulfillments'].map((scope) => (
                              <span key={scope} className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 font-semibold">
                                {scope}
                              </span>
                            ))}
                          </div>
                        </li>
                        <li>In <strong>App setup → Allowed redirection URL(s)</strong>, add this exact URL:
                          <div className="mt-1.5 flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-[#1C1830] font-mono text-[11px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#2A2440]">
                            <span className="truncate flex-1">https://api.nanoshipy.com/api/integrations/shopify/oauth/callback</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText('https://api.nanoshipy.com/api/integrations/shopify/oauth/callback');
                                setCopiedRedirect(true);
                                toast.success('Redirect URL copied to clipboard!');
                                setTimeout(() => setCopiedRedirect(false), 2000);
                              }}
                              className="px-2 py-0.5 rounded bg-white dark:bg-[#131620] text-blue-600 dark:text-blue-400 font-semibold text-[10px] border border-slate-200 dark:border-[#2A2440] shrink-0 flex items-center gap-1"
                            >
                              {copiedRedirect ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedRedirect ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </li>
                        <li>In <strong>API credentials</strong>, copy your <strong>Client ID (API key)</strong> and <strong>Client Secret (API secret key)</strong> and paste them below!</li>
                      </ol>
                    </div>
                  )}
                </div>

                <form onSubmit={handleOAuthConnect} className="space-y-4 max-w-xl">
                  {/* Store Domain */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Shopify Store Domain <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="your-store-name.myshopify.com"
                        value={oauthDomain}
                        onChange={(e) => {
                          setOauthDomain(e.target.value);
                          if (oauthError) setOauthError(null);
                        }}
                        className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#2A2440] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-400 font-medium"
                      />
                      <Globe className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter your permanent <code>.myshopify.com</code> store domain
                    </p>
                  </div>

                  {/* Client ID */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Shopify Client ID / API Key
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2f4a5c89e1b234567890abcdef123456"
                      value={oauthClientId}
                      onChange={(e) => {
                        setOauthClientId(e.target.value);
                        if (oauthError) setOauthError(null);
                      }}
                      className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#2A2440] rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      From your Shopify Custom App &gt; API credentials &gt; Client ID
                    </p>
                  </div>

                  {/* Client Secret */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Shopify Client Secret / API Secret Key
                    </label>
                    <div className="relative">
                      <input
                        type={showOauthSecret ? 'text' : 'password'}
                        placeholder="e.g. shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={oauthClientSecret}
                        onChange={(e) => {
                          setOauthClientSecret(e.target.value);
                          if (oauthError) setOauthError(null);
                        }}
                        className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#2A2440] rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOauthSecret(!showOauthSecret)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        {showOauthSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Required for your custom app to sign and verify webhook events
                    </p>
                  </div>

                  {oauthError && (
                    <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Authorization Error</p>
                        <p className="mt-0.5 leading-relaxed">{oauthError}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={oauthLoading}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md disabled:opacity-50"
                    >
                      {oauthLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      {oauthLoading ? 'Redirecting to Shopify...' : 'Authorize & Connect with Shopify'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* ── OPTION B FORM: Manual Access Token ── */
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                      B
                    </span>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Connect via Manual Access Token
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#A29DB8] mt-1">
                    Direct connection for custom apps created inside your Shopify store. Paste your credentials below.
                  </p>
                </div>

                {/* Step-by-Step Custom App Accordion Guide */}
                <div className="rounded-xl border border-slate-200 dark:border-[#2A2440] overflow-hidden bg-slate-50/50 dark:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-emerald-500" />
                      How to generate an Admin API Access Token in Shopify (5 quick steps)
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs">
                      {showGuide ? 'Hide Guide' : 'Show Guide'}
                    </span>
                  </button>

                  {showGuide && (
                    <div className="p-4 border-t border-slate-200 dark:border-[#2A2440] text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
                      <ol className="space-y-2 list-decimal list-inside leading-relaxed">
                        <li>Log in to your <strong>Shopify Admin</strong> and navigate to <strong>Settings → Apps and sales channels → Develop apps</strong>.</li>
                        <li>Click <strong>"Create an app"</strong> and give it a name (e.g., <em>Nanoshipy Shipping</em>).</li>
                        <li>Under <strong>Configuration → Admin API integration</strong>, select these scopes:
                          <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono text-[11px]">
                            {['read_orders', 'write_fulfillments', 'read_fulfillments', 'read_shop'].map((scope) => (
                              <span key={scope} className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold">
                                {scope}
                              </span>
                            ))}
                          </div>
                        </li>
                        <li>Click <strong>"Save"</strong>, go to the <strong>"API credentials"</strong> tab, and click the green <strong>"Install app"</strong> button.</li>
                        <li>Copy the <strong>"Admin API access token"</strong> (starts with <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded">shpat_</code>). ⚠️ Shopify shows this token only once!</li>
                      </ol>

                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p>
                          <strong>Common mistake:</strong> Do not copy the "API Key" or "Secret Key" (starts with <code className="font-mono">shpss_</code>). You must copy the <strong>Admin API access token</strong> (<code className="font-mono">shpat_...</code>).
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleManualConnect} className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Shopify Store Domain
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="your-store-name.myshopify.com"
                      value={manualDomain}
                      onChange={(e) => {
                        setManualDomain(e.target.value);
                        if (manualError) setManualError(null);
                      }}
                      className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#2A2440] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-400 font-medium"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter your <code>.myshopify.com</code> domain
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Admin API Access Token <span className="font-normal text-slate-400">(starts with shpat_...)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        required
                        placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={manualToken}
                        onChange={(e) => {
                          setManualToken(e.target.value);
                          if (manualError) setManualError(null);
                        }}
                        className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#2A2440] rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Webhook Signing Secret <span className="font-normal text-slate-400">(Optional, for custom app HMAC verification)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Optional (e.g. shpss_... from your custom app credentials)"
                      value={manualWebhookSecret}
                      onChange={(e) => setManualWebhookSecret(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#2A2440] rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Located in your Shopify Custom App under API credentials or Webhook subscriptions.
                    </p>
                  </div>

                  {manualError && (
                    <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Connection Failed</p>
                        <p className="mt-0.5 leading-relaxed">{manualError}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={manualLoading}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md disabled:opacity-50"
                    >
                      {manualLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      {manualLoading ? 'Verifying & Connecting...' : 'Validate & Connect Shopify Store'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      <ConfirmModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        onConfirm={confirmDisconnect}
        title="Disconnect Shopify Store"
        description="Are you sure you want to disconnect this Shopify store? Real-time webhook order sync and automated fulfillment updates will be immediately discontinued."
        confirmText="Yes, Disconnect Store"
        variant="danger"
        isLoading={isDisconnecting}
      />
    </div>
  );
}

export default function ShopifyIntegrationPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center items-center gap-3">
          <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
          <span className="text-xs text-slate-500">Loading Shopify Integration...</span>
        </div>
      }
    >
      <ShopifyIntegrationContent />
    </Suspense>
  );
}
