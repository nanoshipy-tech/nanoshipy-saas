'use client';

import React from 'react';
import { FileText, Download, Eye, CreditCard, Scale, Truck } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR, formatDate } from '@/lib/formatters';

export interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_type: 'shipment' | 'monthly_statement' | 'manual';
  reference_type: string;
  reference_id: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  status: 'generated' | 'paid' | 'void';
  pdf_url: string | null;
  place_of_supply: string;
  created_at: string;
}

interface InvoiceTableProps {
  invoices: InvoiceData[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onViewDetails: (invoice: InvoiceData) => void;
}

export function InvoiceTable({ invoices, selectedIds, onSelectChange, onViewDetails }: InvoiceTableProps) {
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectChange(invoices.map((i) => i.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selectedIds, id]);
    } else {
      onSelectChange(selectedIds.filter((x) => x !== id));
    }
  };

  const handleDownloadPdf = async (e: React.MouseEvent, inv: InvoiceData) => {
    e.stopPropagation();
    try {
      const res = await apiClient.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${(inv.invoice_number || inv.id).replace(/\//g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded');
    } catch {
      toast.error('Failed to download invoice PDF');
    }
  };

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No invoices found"
        description="Consignment invoices, freight receipts, and monthly billing statements generated automatically will appear here."
      />
    );
  }

  const allSelected = invoices.length > 0 && selectedIds.length === invoices.length;

  return (
    <div className="nano-card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="nano-table">
          <thead>
            <tr>
              <th className="!w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="rounded border-[var(--line)] text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer bg-[var(--surface)] h-4 w-4"
                />
              </th>
              <th>Invoice Number</th>
              <th>Type</th>
              <th>Date</th>
              <th>Place of Supply</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const isChecked = selectedIds.includes(inv.id);

              return (
                <tr key={inv.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleSelectOne(inv.id, e.target.checked)}
                      className="rounded border-[var(--line)] text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer bg-[var(--surface)] h-4 w-4"
                    />
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="font-mono text-[12px] font-bold text-[var(--brand)] flex items-center space-x-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span>{inv.invoice_number}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {inv.reference_type === 'wallet_recharge' ? (
                      <span className="nano-pill nano-pill-ok inline-flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        Recharge
                      </span>
                    ) : inv.reference_type === 'weight_discrepancy' ? (
                      <span className="nano-pill nano-pill-warn inline-flex items-center gap-1">
                        <Scale className="w-3 h-3" />
                        Weight Adj.
                      </span>
                    ) : (
                      <span className="nano-pill nano-pill-brand inline-flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        Freight
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-[12px] text-[var(--muted)]">
                    {formatDate(inv.created_at)}
                  </td>
                  <td className="whitespace-nowrap text-[12px] text-[var(--muted)]">
                    {inv.place_of_supply || 'Delhi (07)'}
                  </td>
                  <td className="whitespace-nowrap font-bold text-[13px] text-[var(--ok)] tabular-nums">
                    {formatINR(inv.total_amount)}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={`nano-pill ${
                      inv.status === 'paid' ? 'nano-pill-ok' :
                      inv.status === 'generated' ? 'nano-pill-warn' : 'nano-pill-info'
                    }`}>
                      {inv.status === 'generated' ? 'Pending' : inv.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-right text-[12px] space-x-1.5">
                    <button
                      onClick={() => onViewDetails(inv)}
                      className="nano-btn-secondary !py-1 !px-2.5 !text-[12px] inline-flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Details</span>
                    </button>
                    <button
                      onClick={(e) => handleDownloadPdf(e, inv)}
                      className="nano-btn-secondary !py-1 !px-2.5 !text-[12px] inline-flex items-center gap-1 text-[var(--brand)]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>PDF</span>
                    </button>
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
