'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { RotateCcw, Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import SellerWiseToggle from '@/components/reports/SellerWiseToggle';
import { DateRangeFilter, getDefault30DaysRange, DateRange } from '@/components/ui/DateRangeFilter';

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'overall' | 'seller_wise'>('overall');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getDefault30DaysRange());
  const [activeTab, setActiveTab] = useState<'all' | 'in_transit' | 'delivered'>('all');

  useEffect(() => {
    fetchReturns();
  }, [viewMode, selectedTenantId, dateRange, activeTab]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const params: any = {
        view_mode: viewMode,
        from: dateRange.from,
        to: dateRange.to,
      };
      if (activeTab !== 'all') {
        params.tab = activeTab;
      }
      if (viewMode === 'seller_wise' && selectedTenantId) params.tenant_id = selectedTenantId;
      const res = await apiClient.get('/rto', { params });
      if (res.data.success) {
        setReturns(res.data.data?.rows || res.data.data || []);
      }
    } catch {
      toast.error('Failed to load RTO records');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-rose-600 dark:text-rose-400" /> RTO & Return Shipments
          </h1>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">Return-to-origin tracking, reverse logistics, and warehouse delivery receipts</p>
        </div>
        <button onClick={fetchReturns} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-white border border-[#E8DEF2] hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-800 dark:text-white font-semibold text-xs border border-slate-200 dark:border-[#E8DEF2] transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Returns
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E8DEF2]">
        <SellerWiseToggle
          viewMode={viewMode}
          selectedTenantId={selectedTenantId}
          onToggleChange={(mode, tenantId) => {
            setViewMode(mode);
            setSelectedTenantId(tenantId);
          }}
        />
        <DateRangeFilter initialRange={dateRange} onChange={setDateRange} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8DEF2] pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'all'
              ? 'bg-[#5B069A] text-white shadow-sm'
              : 'text-[#534F66] hover:bg-[#F6EFFF]'
          }`}
        >
          All Returns
        </button>
        <button
          onClick={() => setActiveTab('in_transit')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'in_transit'
              ? 'bg-[#5B069A] text-white shadow-sm'
              : 'text-[#534F66] hover:bg-[#F6EFFF]'
          }`}
        >
          Returns in Transit
        </button>
        <button
          onClick={() => setActiveTab('delivered')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'delivered'
              ? 'bg-[#5B069A] text-white shadow-sm'
              : 'text-[#534F66] hover:bg-[#F6EFFF]'
          }`}
        >
          Returns Delivered
        </button>
      </div>


      <div className="bg-white border border-[#E8DEF2] border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-[#534F66] text-xs">Loading return records...</div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center text-[#7E7994] text-xs">No RTO return shipments recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F2ECF7] text-[#534F66] bg-white/[0.02]">
                  <th className="py-3 px-4 font-semibold">RTO AWB</th>
                  <th className="py-3 px-4 font-semibold">Tenant</th>
                  <th className="py-3 px-4 font-semibold">RTO Reason</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Initiated Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {returns.map(r => (
                  <tr key={r.id} className="hover:bg-[#F6EFFF]/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-rose-700">
                      {r.rto_awb_number || r.awb_number || r.id.substring(0, 8)}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#14121F]">{r.tenant?.company_name || r.tenant?.subdomain || 'Unnamed Merchant'}</td>
                    <td className="py-3 px-4 text-[#14121F]">{r.rto_reason || 'Undelivered 3 Attempts'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                        {r.status || 'RTO_IN_TRANSIT'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#7E7994]">
                      {new Date(r.created_at || Date.now()).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
