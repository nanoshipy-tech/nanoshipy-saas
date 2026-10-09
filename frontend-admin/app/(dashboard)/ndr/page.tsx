'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { AlertTriangle, Search, RefreshCw, CheckCircle2, RotateCcw, SendHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { DateRangeFilter, getDefault30DaysRange, DateRange } from '@/components/ui/DateRangeFilter';
import SellerWiseToggle from '@/components/reports/SellerWiseToggle';

export default function AdminNdrQueuePage() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefault30DaysRange());
  const [ndrEvents, setNdrEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'overall' | 'seller_wise'>('overall');
  const [selectedTenantId, setSelectedTenantId] = useState('');

  useEffect(() => {
    fetchNdr();
  }, [viewMode, selectedTenantId, dateRange]);

  const fetchNdr = async () => {
    try {
      setLoading(true);
      const params: any = {
        view_mode: viewMode,
        from: dateRange.from,
        to: dateRange.to,
      };
      if (viewMode === 'seller_wise' && selectedTenantId) params.tenant_id = selectedTenantId;
      const res = await apiClient.get('/ndr', { params });
      if (res.data.success) {
        setNdrEvents(res.data.data?.rows || res.data.data || []);
      }
    } catch {
      toast.error('Failed to load NDR queue');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, actionType: 'reattempt' | 'mark_rto' | 'escalate_courier') => {
    try {
      const res = await apiClient.post(`/ndr/${id}/action`, { action_type: actionType });
      if (res.data.success) {
        toast.success(`NDR action '${actionType}' submitted`);
        fetchNdr();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to perform NDR action');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" /> NDR Queue & Failed Deliveries
          </h1>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">
            Manage non-delivery reports, courier escalations, buyer reattempts, and RTO flows
          </p>
        </div>
        <button
          onClick={fetchNdr}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-white border border-[#E8DEF2] hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-800 dark:text-white font-semibold text-xs transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh NDR
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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

      <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-[#534F66] text-xs">Loading NDR events...</div>
        ) : ndrEvents.length === 0 ? (
          <div className="p-12 text-center text-[#7E7994] text-xs">No pending NDR delivery exceptions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F2ECF7] text-[#534F66] bg-white/[0.02]">
                  <th className="py-3 px-4 font-semibold">Shipment / AWB</th>
                  <th className="py-3 px-4 font-semibold">Tenant</th>
                  <th className="py-3 px-4 font-semibold">NDR Reason</th>
                  <th className="py-3 px-4 font-semibold">Attempts</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {ndrEvents.map((n) => {
                  const isTerminal = ['resolved_delivered', 'resolved_rto'].includes(n.status);

                  return (
                    <tr key={n.id} className="hover:bg-[#F6EFFF]/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-700">
                        {n.shipment?.awb_number || n.awb_number || n.id.substring(0, 8)}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#14121F]">
                        {n.tenant?.company_name || n.tenant?.subdomain || 'Unnamed Merchant'}
                      </td>
                      <td className="py-3 px-4 text-[#14121F]">
                        {n.reason || n.raw_reason || 'Customer Unavailable'}
                      </td>
                      <td className="py-3 px-4 text-[#534F66] font-bold">
                        {n.attempt_number || n.attempt_count || 1}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            n.status === 'resolved_delivered'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : n.status === 'resolved_rto'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : n.status === 'action_taken'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {n.status || 'OPEN'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          disabled={isTerminal}
                          onClick={() => handleAction(n.id, 'escalate_courier')}
                          title={isTerminal ? 'Terminal state - no actions allowed' : 'Escalate issue directly with carrier ops'}
                          className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-700 border border-indigo-200 text-[10px] font-bold transition-all"
                        >
                          Escalate Courier
                        </button>
                        <button
                          disabled={isTerminal}
                          onClick={() => handleAction(n.id, 'reattempt')}
                          title={isTerminal ? 'Terminal state - no actions allowed' : 'Request courier reattempt'}
                          className="px-2 py-1 rounded-lg bg-[#F6EFFF] hover:bg-[#EAD9FF] disabled:opacity-40 disabled:cursor-not-allowed text-[#5B069A] border border-[#D6A8FF] text-[10px] font-bold transition-all"
                        >
                          Reattempt
                        </button>
                        <button
                          disabled={isTerminal}
                          onClick={() => handleAction(n.id, 'mark_rto')}
                          title={isTerminal ? 'Terminal state - no actions allowed' : 'Mark shipment for return to origin'}
                          className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-700 border border-rose-200 text-[10px] font-bold transition-all"
                        >
                          Raise RTO
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
