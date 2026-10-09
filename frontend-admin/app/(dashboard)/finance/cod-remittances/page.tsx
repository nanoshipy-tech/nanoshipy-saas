'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { DollarSign, RefreshCw, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminCodRemittancesPage() {
  const [remittances, setRemittances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRemittances();
  }, []);

  const fetchRemittances = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/cod-remittances');
      if (res.data.success) {
        setRemittances(res.data.data?.rows || res.data.data || []);
      }
    } catch {
      toast.error('Failed to load COD remittances');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCredit = async (id: string) => {
    try {
      setProcessingId(id);
      const res = await apiClient.post(`/cod-remittances/${id}/remit`);
      if (res.data.success) {
        toast.success('COD remittance auto-credited to seller wallet!');
        fetchRemittances();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to auto-credit COD remittance');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#14121F] flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-emerald-600" /> COD Remittances & Wallet Settlements
          </h1>
          <p className="text-xs text-[#534F66] mt-0.5">Automated COD cycle payouts, carrier reconciliation, and Auto-Credit triggers</p>
        </div>
        <button onClick={fetchRemittances} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#14121F] font-semibold text-xs border border-[#E8DEF2] shadow-sm transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Remittances
        </button>
      </div>

      <div className="bg-white border border-[#E8DEF2] border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-[#534F66] text-xs">Loading COD remittances...</div>
        ) : remittances.length === 0 ? (
          <div className="p-12 text-center text-[#7E7994] text-xs">No pending COD remittances recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F2ECF7] text-[#534F66] bg-white/[0.02]">
                  <th className="py-3 px-4 font-semibold">Remittance Ref</th>
                  <th className="py-3 px-4 font-semibold">Seller Tenant</th>
                  <th className="py-3 px-4 font-semibold">Collected COD Amount</th>
                  <th className="py-3 px-4 font-semibold">Deductions / Fees</th>
                  <th className="py-3 px-4 font-semibold">Net Remitted Amount</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {remittances.map(r => (
                  <tr key={r.id} className="hover:bg-[#F6EFFF]/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#5B069A]">
                      {r.remittance_number || r.id.substring(0, 8)}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#14121F]">{r.seller?.company_name || r.tenant?.company_name || r.tenant?.subdomain || 'Unnamed Merchant'}</td>
                    <td className="py-3 px-4 text-[#14121F] font-semibold">
                      ₹{parseFloat(r.total_cod_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-[#534F66]">
                      ₹{parseFloat(r.deductions || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-black text-emerald-700 text-sm">
                      ₹{parseFloat(r.net_remitted_amount || r.total_cod_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${r.status === 'remitted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {r.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {r.status !== 'remitted' && (
                        <button
                          onClick={() => handleAutoCredit(r.id)}
                          disabled={processingId === r.id}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 ml-auto transition-all"
                        >
                          {processingId === r.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          Auto-Credit COD
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
    </div>
  );
}
