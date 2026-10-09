import { API_URL } from '../../lib/env';
import React from 'react';
import { CreditCard, Download, ExternalLink } from 'lucide-react';

export interface CreditNoteData {
  id: string;
  credit_note_number: string;
  original_invoice_id: string;
  reason: string;
  amount: number;
  reference_type: string;
  reference_id: string | null;
  pdf_url: string | null;
  created_at: string;
  originalInvoice?: {
    invoice_number: string;
  };
}

interface CreditNoteTableProps {
  creditNotes: CreditNoteData[];
}

export function CreditNoteTable({ creditNotes }: CreditNoteTableProps) {
  if (creditNotes.length === 0) {
    return (
      <div className="bg-white dark:bg-[#131620] border border-slate-100 dark:border-white/[0.06] rounded-2xl p-12 text-center shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-100/50 dark:border-indigo-900/30 flex items-center justify-center text-indigo-550 dark:text-[#D6A8FF] mb-4">
          <CreditCard className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">No credit notes</h3>
        <p className="text-sm text-slate-555 dark:text-slate-400 max-w-sm mx-auto">
          Adjustments and refunds for cancelled shipments or RTO will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 dark:divide-white/[0.06] text-left text-sm">
          <thead className="bg-slate-50/70 dark:bg-[#0f1117]/80 font-semibold text-slate-600 dark:text-slate-350 tracking-wider text-[11px] uppercase">
            <tr>
              <th className="px-6 py-4">Credit Note</th>
              <th className="px-6 py-4">Original Invoice</th>
              <th className="px-6 py-4">Reason</th>
              <th className="px-6 py-4">Refund Amount</th>
              <th className="px-6 py-4">Date Issued</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] bg-white dark:bg-[#131620]">
            {creditNotes.map((cn) => {
              const formattedDate = new Date(cn.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <tr key={cn.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center space-x-1.5">
                      <CreditCard className="h-3.5 w-3.5 shrink-0" />
                      <span>{cn.credit_note_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-400">
                    {cn.originalInvoice?.invoice_number || 'Linked Invoice'}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                    {cn.reason}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-xs text-rose-600 dark:text-rose-400">
                    -₹{cn.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {formattedDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                    {cn.pdf_url && (
                      <a
                        href={`${API_URL}/credit-notes/${cn.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-400 hover:text-rose-650 dark:hover:text-rose-400 border border-slate-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition outline-none"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download PDF</span>
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
