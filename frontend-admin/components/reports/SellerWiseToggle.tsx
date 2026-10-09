'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Store, Globe, ChevronDown, RefreshCw } from 'lucide-react';

interface TenantSummary {
  tenant_id: string;
  company_name: string;
  subdomain: string;
  orders_count?: number;
  shipments_count?: number;
  ndr_count?: number;
  rto_count?: number;
}

interface SellerWiseToggleProps {
  viewMode: 'overall' | 'seller_wise';
  selectedTenantId: string;
  onToggleChange: (mode: 'overall' | 'seller_wise', tenantId: string) => void;
}

export function SellerWiseToggle({ viewMode, selectedTenantId, onToggleChange }: SellerWiseToggleProps) {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/platform/orders/seller-summary');
      if (res.data.success) {
        setTenants(res.data.data || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0f1120] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-2 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl w-full sm:w-auto">
        <button
          type="button"
          onClick={() => onToggleChange('overall', '')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            viewMode === 'overall'
              ? 'bg-white dark:bg-[#1a1d36] text-[#8410DC] dark:text-[#D6A8FF] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Overall Platform View
        </button>
        <button
          type="button"
          onClick={() => {
            const firstId = tenants[0]?.tenant_id || '';
            onToggleChange('seller_wise', selectedTenantId || firstId);
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            viewMode === 'seller_wise'
              ? 'bg-white dark:bg-[#1a1d36] text-[#8410DC] dark:text-[#D6A8FF] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          Seller-Wise Drilldown
        </button>
      </div>

      {viewMode === 'seller_wise' && (
        <div className="relative w-full sm:w-72">
          <select
            value={selectedTenantId}
            onChange={(e) => onToggleChange('seller_wise', e.target.value)}
            className="w-full appearance-none bg-slate-50 dark:bg-white/[0.04] border border-purple-200 dark:border-[#8410DC]/30 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC] pr-8"
          >
            <option value="" disabled>-- Select Seller / Tenant --</option>
            {tenants.map((t) => (
              <option key={t.tenant_id} value={t.tenant_id} className="bg-white dark:bg-[#0f1120] text-slate-900 dark:text-white">
                {t.company_name} ({t.subdomain})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-2.5" />
        </div>
      )}
    </div>
  );
}

export default SellerWiseToggle;
