'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, CreditCard, ChevronRight, FileArchive, Search, AlertCircle, Truck, Scale, RefreshCw, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import { InvoiceTable, InvoiceData } from '@/components/billing/InvoiceTable';
import { CreditNoteTable, CreditNoteData } from '@/components/billing/CreditNoteTable';
import { InvoiceDetailPanel } from '@/components/billing/InvoiceDetailPanel';
import Link from 'next/link';

export default function BillingHistoryPage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'credit_notes'>('invoices');
  
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteData[]>([]);
  
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ this_month_spend: 0, pending_invoices: 0 });

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [codRemitted, setCodRemitted] = useState<number>(0);
  const [codPending, setCodPending] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'shipment' | 'wallet_recharge' | 'weight_discrepancy'>('all');

  useEffect(() => {
    fetchBillingData();
  }, []);

  const displayedInvoices = invoices.filter((inv) => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'shipment') return inv.reference_type === 'shipment';
    if (categoryFilter === 'wallet_recharge') return inv.reference_type === 'wallet_recharge';
    if (categoryFilter === 'weight_discrepancy') return inv.reference_type === 'weight_discrepancy';
    return true;
  });

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, invoicesRes, cnRes, walletRes, remittancesRes] = await Promise.all([
        apiClient.get('/billing/summary').catch(() => null),
        apiClient.get('/invoices', { params: { page: 1, limit: 50 } }),
        apiClient.get('/credit-notes').catch(() => null),
        apiClient.get('/wallet').catch(() => null),
        apiClient.get('/wallet/remittances').catch(() => null),
      ]);

      if (statsRes?.data?.success) {
        setStats(statsRes.data.data);
      }

      if (walletRes?.data?.success) {
        setWalletBalance(parseFloat(walletRes.data.data.balance || 0));
      }

      if (remittancesRes?.data?.success) {
        const data = remittancesRes.data.data;
        const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.rows) ? data.rows : []));
        let remitted = 0;
        let pending = 0;
        items.forEach((item: any) => {
          const amt = parseFloat(item.net_amount || item.amount || item.gross_cod_amount || 0);
          if (String(item.status || '').toLowerCase() === 'completed') {
            remitted += amt;
          } else {
            pending += amt;
          }
        });
        setCodRemitted(remitted);
        setCodPending(pending);
      }

      if (invoicesRes?.data?.success) {
        const rows = invoicesRes.data.data.rows || invoicesRes.data.data || [];
        setInvoices(rows);
      }

      if (cnRes?.data?.success) {
        setCreditNotes(cnRes.data.data.rows || cnRes.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to retrieve billing records');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = async () => {
    if (selectedInvoiceIds.length === 0) return;
    try {
      setExporting(true);
      const res = await apiClient.post('/invoices/bulk-export', { invoice_ids: selectedInvoiceIds });
      if (res.data.success && res.data.data.merged_pdf_url) {
        window.open(res.data.data.merged_pdf_url, '_blank');
        toast.success('Invoices merged and exported successfully');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error occurred during bulk merge.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="nano-page-title">Billing & invoices</h1>
          <p className="nano-page-subtitle">
            Manage your shipment receipts, GST tax splits, credit notes, and monthly statements.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchBillingData}
            className="nano-btn-secondary inline-flex items-center gap-1.5"
            title="Refresh billing records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/billing/statements"
            className="nano-btn-secondary inline-flex items-center gap-1.5"
          >
            <FileArchive className="h-3.5 w-3.5" />
            <span>Rollups</span>
          </Link>
          <Link
            href="/wallet"
            className="nano-btn-primary inline-flex items-center gap-1.5"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Top up wallet</span>
          </Link>
        </div>
      </div>

      {/* 4 Spec KPI Cards: Wallet, Freight this month, COD remitted, COD pending */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Wallet */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Wallet</span>
            <span className="nano-pill nano-pill-brand">Prepaid</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value text-[var(--brand)]">
              ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1 flex items-center justify-between">
              <span>Auto-debit active</span>
              <Link href="/wallet" className="text-[var(--brand)] hover:underline inline-flex items-center gap-0.5">
                Top up <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Freight this month */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Freight this month</span>
            <span className="nano-pill nano-pill-brand">This month</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">
              ₹{stats.this_month_spend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Generated tax invoices</div>
          </div>
        </div>

        {/* COD remitted */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">COD remitted</span>
            <span className="nano-pill nano-pill-ok">Completed</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value text-[var(--ok)]">
              ₹{codRemitted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Transferred to merchant bank</div>
          </div>
        </div>

        {/* COD pending */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">COD pending</span>
            <span className="nano-pill nano-pill-warn">In cycle</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">
              ₹{codPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Remittance SLA: 48h</div>
          </div>
        </div>
      </div>

      {/* Tabs & Bulk Action Section */}
      <div className="nano-card flex flex-wrap items-center justify-between gap-3 !py-3">
        {/* Tabs */}
        <div className="nano-segmented flex-wrap" role="group" aria-label="Billing filter tabs">
          <button
            type="button"
            onClick={() => { setActiveTab('invoices'); setCategoryFilter('all'); }}
            className={`nano-segmented-item ${activeTab === 'invoices' && categoryFilter === 'all' ? 'active' : ''}`}
          >
            All Invoices
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('invoices'); setCategoryFilter('shipment'); }}
            className={`nano-segmented-item ${activeTab === 'invoices' && categoryFilter === 'shipment' ? 'active' : ''}`}
          >
            Freight Bills
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('invoices'); setCategoryFilter('wallet_recharge'); }}
            className={`nano-segmented-item ${activeTab === 'invoices' && categoryFilter === 'wallet_recharge' ? 'active' : ''}`}
          >
            Recharge Receipts
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('invoices'); setCategoryFilter('weight_discrepancy'); }}
            className={`nano-segmented-item ${activeTab === 'invoices' && categoryFilter === 'weight_discrepancy' ? 'active' : ''}`}
          >
            Weight Adjustments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credit_notes')}
            className={`nano-segmented-item ${activeTab === 'credit_notes' ? 'active' : ''}`}
          >
            Credit Notes
          </button>
        </div>

        {/* Bulk Export action if invoices selected */}
        {activeTab === 'invoices' && selectedInvoiceIds.length > 0 && (
          <button
            onClick={handleBulkExport}
            disabled={exporting}
            className="nano-btn-primary inline-flex items-center gap-1.5 !text-[12px]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? 'Merging PDFs...' : `Export Selected (${selectedInvoiceIds.length})`}</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="nano-card flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-[var(--brand)] border-t-transparent" />
        </div>
      ) : error ? (
        <div className="nano-card !border-[var(--bad)] text-[var(--bad)] text-[13px] !p-4 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : activeTab === 'invoices' ? (
        <InvoiceTable
          invoices={displayedInvoices}
          selectedIds={selectedInvoiceIds}
          onSelectChange={setSelectedInvoiceIds}
          onViewDetails={(inv) => setActiveInvoice(inv)}
        />
      ) : (
        <CreditNoteTable creditNotes={creditNotes} />
      )}

      {/* Slide-out detail sheet */}
      {activeInvoice && (
        <InvoiceDetailPanel
          invoice={activeInvoice}
          onClose={() => setActiveInvoice(null)}
        />
      )}
    </div>
  );
}
