'use client';

import React from 'react';
import { Scale, CheckCircle2, XCircle, Clock, AlertTriangle, Building2 } from 'lucide-react';

interface Dispute {
  id: string;
  seller_id: string;
  shipment_id: string;
  awb: string;
  declared_weight_kg: number;
  courier_weight_kg: number;
  disputed_charge: number;
  status: 'open' | 'pending' | 'under_review' | 'accepted' | 'rejected' | 'reversed' | 'waived';
  seller_note?: string;
  admin_note?: string;
  raised_at: string;
  seller?: { company_name: string };
}


interface WeightDisputeTableProps {
  disputes: Dispute[];
  loading: boolean;
  onResolve?: (disputeId: string, resolution: 'accepted' | 'rejected' | 'waived') => void;
  resolvingId?: string | null;
}

export function WeightDisputeTable({ disputes, loading, onResolve, resolvingId }: WeightDisputeTableProps) {
  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs font-semibold">Loading Weight Disputes...</div>;
  }

  if (!disputes || disputes.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs font-semibold">
        No weight discrepancy disputes reported.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Charge Accepted</span>;
      case 'waived':
      case 'reversed':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#8410DC]/10 text-[#8410DC] dark:text-[#D6A8FF] border border-[#8410DC]/20 flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Waived / Reversed</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Dispute Rejected</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3" /> Action Required</span>;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02] font-bold">
            <th className="py-3.5 px-4 font-bold">AWB Number</th>
            <th className="py-3.5 px-4 font-bold">Seller</th>
            <th className="py-3.5 px-4 font-bold">Declared Weight</th>
            <th className="py-3.5 px-4 font-bold">Courier Reported Weight</th>
            <th className="py-3.5 px-4 font-bold">Difference</th>
            <th className="py-3.5 px-4 font-bold">Disputed Charge</th>
            <th className="py-3.5 px-4 font-bold">Status</th>
            <th className="py-3.5 px-4 font-bold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-800 dark:text-slate-200 font-medium">
          {disputes.map((d) => {
            const diff = parseFloat(String(d.courier_weight_kg || 0)) - parseFloat(String(d.declared_weight_kg || 0));
            return (
              <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <td className="py-3.5 px-4 font-mono font-bold text-[#8410DC] dark:text-[#D6A8FF]">
                  {d.awb}
                </td>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {d.seller?.company_name || 'Seller'}
                </td>
                <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                  {parseFloat(String(d.declared_weight_kg || 0)).toFixed(3)} kg
                </td>
                <td className="py-3.5 px-4 font-bold text-amber-600 dark:text-amber-400">
                  {parseFloat(String(d.courier_weight_kg || 0)).toFixed(3)} kg
                </td>
                <td className="py-3.5 px-4 font-extrabold text-rose-600 dark:text-rose-400">
                  +{diff.toFixed(3)} kg
                </td>
                <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                  ₹{parseFloat(String(d.disputed_charge || 0)).toFixed(2)}
                </td>
                <td className="py-3.5 px-4">
                  {getStatusBadge(d.status)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  {(d.status === 'open' || d.status === 'pending' || d.status === 'under_review') && onResolve && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onResolve(d.id, 'accepted')}
                        disabled={resolvingId === d.id}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all"
                      >
                        Accept Charge
                      </button>
                      <button
                        onClick={() => onResolve(d.id, 'waived')}
                        disabled={resolvingId === d.id}
                        className="px-3 py-1 rounded-lg bg-[#8410DC] hover:bg-[#8410DC] text-white font-bold text-[11px] transition-all"
                      >
                        Waive Charge
                      </button>

                    </div>
                  )}
                  {(d.status === 'accepted' || d.status === 'waived' || d.status === 'reversed') && (
                    <span className="text-[11px] font-semibold text-slate-400">Resolved</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default WeightDisputeTable;
