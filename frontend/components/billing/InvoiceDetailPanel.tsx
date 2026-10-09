'use client';

import React, { useState } from 'react';
import { X, Receipt, Download } from 'lucide-react';
import { InvoiceData } from './InvoiceTable';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/formatters';

interface LineItem {
  id: string;
  description: string;
  hsn_sac_code: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface InvoiceDetailPanelProps {
  invoice: InvoiceData & { lineItems?: LineItem[] };
  onClose: () => void;
}

export function InvoiceDetailPanel({ invoice, onClose }: InvoiceDetailPanelProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const res = await apiClient.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${(invoice.invoice_number || invoice.id).replace(/\//g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice PDF downloaded');
    } catch {
      toast.error('Failed to download invoice PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#14121F]/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Slide-out Panel */}
      <div className="absolute inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col justify-between border-l border-[#E8DEF2] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F2ECF7] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="h-5 w-5 text-[#5B069A]" />
            <h2 className="text-sm font-bold text-[#14121F]">Tax Invoice Breakdown</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-[#7E7994] hover:text-[#14121F] transition outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Summary Card */}
          <div className="bg-slate-50 border border-[#E8DEF2] rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-[#7E7994] uppercase tracking-wider">Invoice Number</p>
                <p className="text-sm font-mono font-bold text-[#5B069A] mt-1">{invoice.invoice_number}</p>
              </div>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                {invoice.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-[#534F66]">
              <div>
                <p className="text-[10px] text-[#7E7994] font-bold uppercase tracking-wider">Date Issued</p>
                <p className="font-semibold text-[#14121F] mt-0.5">
                  {formatDate(invoice.created_at)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#7E7994] font-bold uppercase tracking-wider">Place of Supply</p>
                <p className="font-semibold text-[#14121F] mt-0.5">{invoice.place_of_supply || 'Delhi (07)'}</p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-[#7E7994] uppercase tracking-wider">Itemized charges</p>
            {invoice.lineItems && invoice.lineItems.length > 0 ? (
              <div className="divide-y divide-[#F2ECF7] border border-[#E8DEF2] rounded-xl overflow-hidden">
                {invoice.lineItems.map((item) => (
                  <div key={item.id} className="p-4 bg-white hover:bg-slate-50/50 transition flex justify-between items-start text-xs gap-3">
                    <div className="space-y-0.5">
                      <p className="font-bold text-[#14121F]">{item.description}</p>
                      <p className="text-[10px] text-[#7E7994]">
                        SAC: {item.hsn_sac_code || '996812'} · Qty: {item.quantity} · Rate: {formatINR(item.unit_price)}
                      </p>
                    </div>
                    <span className="font-bold text-[#14121F]">
                      {formatINR(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#7E7994] italic">No line items associated.</p>
            )}
          </div>

          {/* Tax Breaks */}
          <div className="border-t border-[#F2ECF7] pt-5 space-y-3">
            <p className="text-[10px] font-bold text-[#7E7994] uppercase tracking-wider">Tax & Invoice Totals</p>
            <div className="space-y-2 text-xs text-[#534F66]">
              <div className="flex justify-between">
                <span>Subtotal (net value)</span>
                <span className="font-semibold text-[#14121F]">{formatINR(invoice.subtotal)}</span>
              </div>
              {Number(invoice.cgst_amount || 0) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>CGST (9%)</span>
                    <span>{formatINR(invoice.cgst_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST (9%)</span>
                    <span>{formatINR(invoice.sgst_amount)}</span>
                  </div>
                </>
              )}
              {Number(invoice.igst_amount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>IGST (18%)</span>
                  <span>{formatINR(invoice.igst_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-[#14121F] border-t border-[#F2ECF7] pt-2 mt-2">
                <span>Total Invoice Value (gross)</span>
                <span className="text-emerald-700 font-extrabold">{formatINR(invoice.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-[#F2ECF7] flex items-center justify-end">
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="w-full bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition shadow-sm outline-none cursor-pointer active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            <span>{downloading ? 'Generating Invoice PDF...' : 'Download Invoice PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
