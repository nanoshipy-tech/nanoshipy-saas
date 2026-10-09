'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Layers, RefreshCw, CheckCircle2, XCircle, ShoppingBag, Store, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PlatformIntegrationsPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalogue();
  }, []);

  const fetchCatalogue = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/platform/catalogue');
      if (res.data.success) {
        setIntegrations(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load platform integrations catalogue');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGlobal = async (id: string, currentStatus: boolean) => {
    try {
      setTogglingId(id);
      const res = await apiClient.put(`/platform/catalogue/${id}`, { is_active: !currentStatus });
      if (res.data.success) {
        toast.success(`Integration ${!currentStatus ? 'enabled' : 'disabled'} globally!`);
        fetchCatalogue();
      }
    } catch {
      toast.error('Failed to toggle integration status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#14121F] flex items-center gap-3">
            <Layers className="w-6 h-6 text-[#8410DC] dark:text-[#D6A8FF]" /> Platform Integration Catalogue
          </h1>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] font-medium mt-0.5">Configure & enable sales channel integrations (Shopify, WooCommerce, Amazon, Custom API) across the platform</p>
        </div>
        <button
          onClick={fetchCatalogue}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-white border border-[#E8DEF2] hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-800 dark:text-white font-semibold text-xs border border-slate-200 dark:border-[#E8DEF2] transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Catalogue
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => (
          <div key={item.id} className="bg-white dark:bg-white border border-[#E8DEF2] border border-slate-200 dark:border-[#E8DEF2] rounded-2xl p-6 flex items-start justify-between gap-4 shadow-sm hover:border-[#8410DC]/30 transition-all">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-[#8410DC]/10 border border-purple-200 dark:border-[#8410DC]/20 text-[#8410DC] dark:text-[#D6A8FF] flex items-center justify-center font-bold text-lg">
                {item.integration_key === 'shopify' ? <ShoppingBag className="w-6 h-6" /> : item.integration_key === 'woocommerce' ? <Store className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#14121F]">{item.display_name}</h3>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-[#534F66] font-bold uppercase">{item.integration_key}</span>
                </div>
                <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-1 font-medium">
                  Supported Webhooks: {item.config?.webhooks_supported?.join(', ') || 'Standard Order Sync'}
                </p>
                <div className="flex items-center gap-2 mt-3 text-[11px] font-bold">
                  {item.is_active ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Active for All Sellers</span>
                  ) : (
                    <span className="text-[#534F66] flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Disabled Platform-wide</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleToggleGlobal(item.id, item.is_active)}
              disabled={togglingId === item.id}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                item.is_active
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-500/20'
                  : 'bg-[#8410DC] hover:bg-[#8410DC] text-white'
              }`}
            >
              {togglingId === item.id ? 'Updating...' : item.is_active ? 'Disable' : 'Enable Globally'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
