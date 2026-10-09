'use client';

import React from 'react';
import { DollarSign, CheckCircle2, Clock, AlertCircle, ArrowUpRight, Building2 } from 'lucide-react';

interface RemittanceBatch {
  id: string;
  seller_id: string;
  batch_reference: string;
  gross_cod_amount: number;
  platform_fee_deducted: number;
  net_amount: number;
  remittance_mode: 'wallet_credit' | 'bank_payout';
  payout_reference?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  tenant?: { company_name: string; subdomain: string };
}

interface CodRemittanceTableProps {
  batches: RemittanceBatch[];
  loading: boolean;
  onProcessBatch?: (batchId: string) => void;
  processingId?: string | null;
}

export function CodRemittanceTable({ batches, loading, onProcessBatch, processingId }: CodRemittanceTableProps) {
  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs font-semibold">Loading COD Remittances...</div>;
  }

  if (!batches || batches.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs font-semibold">
        No COD remittance cycles found.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Remitted</span>;
      case 'processing':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#8410DC]/10 text-[#8410DC] dark:text-[#D6A8FF] border border-[#8410DC]/20 flex items-center gap-1 w-fit"><Clock className="w-3 h-3 animate-spin" /> Processing</span>;
      case 'failed':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3" /> Failed</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Pending Review</span>;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02] font-bold">
            <th className="py-3.5 px-4 font-bold">Batch Reference</th>
            <th className="py-3.5 px-4 font-bold">Seller / Tenant</th>
            <th className="py-3.5 px-4 font-bold">Gross COD Collected</th>
            <th className="py-3.5 px-4 font-bold">Platform Fee Deducted</th>
            <th className="py-3.5 px-4 font-bold">Net Remittance</th>
            <th className="py-3.5 px-4 font-bold">Mode</th>
            <th className="py-3.5 px-4 font-bold">Status</th>
            <th className="py-3.5 px-4 font-bold text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-800 dark:text-slate-200 font-medium">
          {batches.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
              <td className="py-3.5 px-4 font-mono font-bold text-[#8410DC] dark:text-[#D6A8FF]">
                {b.batch_reference}
              </td>
              <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {b.tenant?.company_name || 'Tenant Seller'}
              </td>
              <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                ₹{parseFloat(String(b.gross_cod_amount || 0)).toFixed(2)}
              </td>
              <td className="py-3.5 px-4 font-bold text-rose-600 dark:text-rose-400">
                -₹{parseFloat(String(b.platform_fee_deducted || 0)).toFixed(2)}
              </td>
              <td className="py-3.5 px-4 font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                ₹{parseFloat(String(b.net_amount || 0)).toFixed(2)}
              </td>
              <td className="py-3.5 px-4 font-semibold capitalize text-slate-500">
                {b.remittance_mode?.replace('_', ' ') || 'Wallet Credit'}
              </td>
              <td className="py-3.5 px-4">
                {getStatusBadge(b.status)}
              </td>
              <td className="py-3.5 px-4 text-right">
                {b.status === 'pending' && onProcessBatch && (
                  <button
                    onClick={() => onProcessBatch(b.id)}
                    disabled={processingId === b.id}
                    className="px-3.5 py-1.5 rounded-xl bg-[#8410DC] hover:bg-[#8410DC] text-white font-bold text-xs transition-all shadow-sm disabled:opacity-50"
                  >
                    {processingId === b.id ? 'Remitting...' : 'Process Remittance'}
                  </button>
                )}
                {b.status === 'completed' && (
                  <span className="text-[11px] font-semibold text-slate-400">Done</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CodRemittanceTable;
