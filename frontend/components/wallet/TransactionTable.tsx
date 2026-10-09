'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR, formatDateTime } from '@/lib/formatters';

export interface WalletTransactionData {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  reference_type: 'recharge' | 'shipment_debit' | 'shipment_refund' | 'manual_credit' | 'manual_debit' | 'adjustment';
  reference_id: string | null;
  description: string;
  created_at: string;
}

interface TransactionTableProps {
  transactions: WalletTransactionData[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
}

const REF_LABELS: Record<string, string> = {
  recharge: 'Recharge',
  shipment_debit: 'Dispatch Debit',
  shipment_refund: 'Refund',
  manual_credit: 'Manual Adjust',
  manual_debit: 'Manual Adjust',
  adjustment: 'System Adjust',
};

export function TransactionTable({ transactions, pagination, onPageChange }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="No transaction records"
        description="Statements, wallet recharges, and automated courier booking debits will be displayed here as you ship."
      />
    );
  }

  return (
    <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#F2ECF7] text-left text-xs">
          <thead className="bg-slate-50/60 font-semibold text-[#534F66] uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-6 py-3.5">Transaction ID</th>
              <th className="px-6 py-3.5">Timestamp</th>
              <th className="px-6 py-3.5">Description</th>
              <th className="px-6 py-3.5">Ref Type</th>
              <th className="px-6 py-3.5">Amount</th>
              <th className="px-6 py-3.5 text-right">Balance After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2ECF7] bg-white text-[#14121F]">
            {transactions.map((tx) => {
              const isCredit = tx.type === 'credit';

              return (
                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-[#7E7994]">
                    {tx.id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-[#534F66] font-medium">
                    {formatDateTime(tx.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-semibold text-[#14121F] leading-normal max-w-xs md:max-w-md truncate">
                      {tx.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-slate-50 text-[#534F66] border-[#E8DEF2]">
                      {REF_LABELS[tx.reference_type] || tx.reference_type}
                    </span>
                    {tx.reference_id && (
                      <span className="block text-[9px] text-[#7E7994] mt-1 font-mono">
                        ID: {tx.reference_id.substring(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center space-x-1 font-extrabold text-xs ${isCredit ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {isCredit ? (
                        <>
                          <ArrowUpRight className="h-3 w-3 shrink-0" />
                          <span>+{formatINR(tx.amount)}</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownLeft className="h-3 w-3 shrink-0" />
                          <span>-{formatINR(tx.amount)}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-xs text-[#14121F]">
                    {formatINR(tx.balance_after)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50/60 border-t border-[#F2ECF7] text-xs font-semibold text-[#534F66]">
          <span>
            Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} transactions)
          </span>
          <div className="flex items-center space-x-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange && onPageChange(pagination.page - 1)}
              className="px-3 py-1.5 rounded-lg border border-[#E8DEF2] bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange && onPageChange(pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg border border-[#E8DEF2] bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
