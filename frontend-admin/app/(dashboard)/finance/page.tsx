'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import {
  DollarSign, RefreshCw, CheckCircle2, Wallet, Scale, FileText,
  ArrowRight, ArrowUpRight, ArrowDownRight, Zap, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminFinancePage() {
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
        toast.success('COD remittance credited to seller wallet!');
        fetchRemittances();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to process remittance');
    } finally {
      setProcessingId(null);
    }
  };

  const kpis = useMemo(() => {
    let totalDue = 0;
    let paidWeek = 0;
    let pendingCount = 0;
    let failedCount = 0;

    remittances.forEach((r) => {
      const net = parseFloat(r.net_remitted_amount || r.total_cod_amount || 0);
      const st = (r.status || 'PENDING').toLowerCase();
      if (st === 'remitted' || st === 'paid' || st === 'completed') {
        paidWeek += net;
      } else if (st === 'failed') {
        failedCount++;
      } else {
        totalDue += net;
        pendingCount++;
      }
    });

    return { totalDue, paidWeek, pendingCount, failedCount };
  }, [remittances]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-kpi">
          <div className="admin-kpi-title">Due Today</div>
          <div className="admin-kpi-val">₹{kpis.totalDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div className="admin-delta admin-delta-neutral">
            {kpis.pendingCount} batches pending
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Paid This Week</div>
          <div className="admin-kpi-val">₹{kpis.paidWeek.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div className="admin-delta admin-delta-up">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Disbursed to wallets
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Pending Batches</div>
          <div className="admin-kpi-val">{kpis.pendingCount}</div>
          <div className="admin-delta admin-delta-neutral">
            Ready for settlement
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Failed Transfers</div>
          <div className="admin-kpi-val">{kpis.failedCount}</div>
          <div className="admin-delta admin-delta-up">
            Zero bank failures
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Link
          href="/finance/wallet"
          className="admin-card !p-3.5 flex items-center justify-between group hover:border-[var(--brand)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[var(--brand)]" style={{ background: 'var(--bg)' }}>
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-[var(--ink)]">Seller Wallets</h4>
              <p className="text-[11.5px] text-[var(--muted)]">Inspect ledger balances & topups</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--brand)] transition-colors" />
        </Link>

        <Link
          href="/operations/weight-disputes"
          className="admin-card !p-3.5 flex items-center justify-between group hover:border-[var(--brand)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[var(--brand)]" style={{ background: 'var(--bg)' }}>
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-[var(--ink)]">Weight Disputes</h4>
              <p className="text-[11.5px] text-[var(--muted)]">Carrier weight deductions & proof</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--brand)] transition-colors" />
        </Link>

        <Link
          href="/reports"
          className="admin-card !p-3.5 flex items-center justify-between group hover:border-[var(--brand)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[var(--brand)]" style={{ background: 'var(--bg)' }}>
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-[var(--ink)]">Billing Statements</h4>
              <p className="text-[11.5px] text-[var(--muted)]">Export financial audit statements</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--brand)] transition-colors" />
        </Link>
      </div>

      {/* Main Table: COD Remittance Batches */}
      <div className="admin-card !p-0 overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">COD Remittance Payout Batches</h2>
            <p className="text-[12.5px] text-[var(--muted)]">Automated carrier remittance reconciliations and wallet credit actions</p>
          </div>
          <button
            type="button"
            onClick={fetchRemittances}
            className="btn-ref btn-ref-secondary flex items-center gap-1.5 text-[13px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">Loading COD remittances…</div>
        ) : remittances.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">No active COD remittances recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ref">
              <thead>
                <tr>
                  <th>Ref #</th>
                  <th>Seller</th>
                  <th>Collected COD</th>
                  <th>Freight Deductions</th>
                  <th>Net Remitted</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {remittances.map((r) => {
                  const isPaid = (r.status || '').toLowerCase() === 'remitted' || (r.status || '').toLowerCase() === 'paid';
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="font-mono font-bold text-[var(--brand)] text-[13px]">
                          {r.remittance_number || r.id?.substring(0, 8)}
                        </span>
                      </td>
                      <td>
                        <span className="font-bold text-[var(--ink)]">
                          {r.seller?.company_name || r.tenant?.company_name || r.tenant?.subdomain || 'Merchant'}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold text-[var(--ink)] tabular-nums">
                          ₹{parseFloat(r.total_cod_amount || 0).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className="text-[var(--muted)] tabular-nums">
                          ₹{parseFloat(r.deductions || 0).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className="font-bold text-[var(--ink)] tabular-nums text-[14px]">
                          ₹{parseFloat(r.net_remitted_amount || r.total_cod_amount || 0).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${isPaid ? 'pill-ok' : 'pill-warn'}`}>
                          {r.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="text-right">
                        {!isPaid ? (
                          <button
                            type="button"
                            onClick={() => handleAutoCredit(r.id)}
                            disabled={processingId === r.id}
                            className="btn-ref btn-ref-primary text-[12px] py-1 px-3"
                          >
                            {processingId === r.id ? 'Processing…' : 'Credit Wallet'}
                          </button>
                        ) : (
                          <span className="text-[12px] font-semibold text-[var(--ok)] inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Credited
                          </span>
                        )}
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
