'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';
import {
  Banknote,
  RotateCw,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowDownRight,
  Receipt,
  FileText,
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

interface CodRemittanceBatch {
  id: string;
  batch_reference: string;
  shipment_ids: string[];
  gross_cod_amount: number | string;
  platform_fee_deducted: number | string;
  net_amount: number | string;
  remittance_mode: 'wallet_credit' | 'bank_payout';
  payout_reference?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completed_at?: string | null;
  created_at: string;
}

export default function CodRemittancesPage() {
  const [batches, setBatches] = useState<CodRemittanceBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<CodRemittanceBatch | null>(null);

  const fetchRemittances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/wallet/cod-remittances');
      if (res.data?.success) {
        const raw = res.data.data;
        const list = Array.isArray(raw) ? raw : (raw?.rows || raw?.batches || []);
        setBatches(list);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to retrieve COD remittance batches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRemittances();
  }, [fetchRemittances]);

  const filteredBatches = batches.filter((b) => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  // Calculate high-level KPIs
  const totalGross = batches.reduce((sum, b) => sum + parseFloat(String(b.gross_cod_amount || 0)), 0);
  const totalFees = batches.reduce((sum, b) => sum + parseFloat(String(b.platform_fee_deducted || 0)), 0);
  const totalNet = batches.reduce((sum, b) => sum + parseFloat(String(b.net_amount || 0)), 0);
  const pendingCount = batches.filter((b) => b.status === 'pending' || b.status === 'processing').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-[#5B069A] border border-purple-200">
            <Clock className="w-3 h-3 animate-spin" /> Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">COD Remittance & Settlements</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-violet-100 text-violet-700 uppercase tracking-wider">
              Cash on Delivery
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track courier cash collections, platform fee deductions, and bank payout reconciliation statements.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchRemittances}
            disabled={loading}
            className="flex items-center space-x-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Batches</span>
          </button>
          <Link
            href="/wallet"
            className="flex items-center space-x-1 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <span>View Wallet</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Gross COD Collected</span>
          <h3 className="text-2xl font-black text-slate-900">₹{totalGross.toFixed(2)}</h3>
          <p className="text-[10px] text-slate-400">Total order values received by carriers</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Platform Fee Deductions</span>
          <h3 className="text-2xl font-black text-rose-600">₹{totalFees.toFixed(2)}</h3>
          <p className="text-[10px] text-slate-400">Remittance handling & freight clawbacks</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Payout Amount</span>
          <h3 className="text-2xl font-black text-emerald-600">₹{totalNet.toFixed(2)}</h3>
          <p className="text-[10px] text-slate-400">Credited to wallet or bank account</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Batches in Pipeline</span>
          <h3 className="text-2xl font-black text-[#8410DC]">{pendingCount}</h3>
          <p className="text-[10px] text-slate-400">Pending courier reconciliation</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
        <span className="text-slate-400 pl-2">Filter:</span>
        {['all', 'completed', 'processing', 'pending', 'failed'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg capitalize transition ${
              statusFilter === st
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <Spinner className="h-8 w-8 text-[#8410DC]" />
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No COD Remittance Batches Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once cash on delivery shipments are delivered and reconciled against carrier settlement files, payout statements will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Batch Ref</th>
                  <th className="px-5 py-3.5">Created Date</th>
                  <th className="px-5 py-3.5">Shipments</th>
                  <th className="px-5 py-3.5">Gross COD</th>
                  <th className="px-5 py-3.5">Platform Fee</th>
                  <th className="px-5 py-3.5">Net Payout</th>
                  <th className="px-5 py-3.5">Payout Mode</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5 font-bold text-[#8410DC]">{b.batch_reference}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {new Date(b.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-semibold">
                      {(b.shipment_ids || []).length} orders
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      ₹{parseFloat(String(b.gross_cod_amount || 0)).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-rose-600">
                      -₹{parseFloat(String(b.platform_fee_deducted || 0)).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 font-black text-emerald-600">
                      ₹{parseFloat(String(b.net_amount || 0)).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <span className="capitalize">{b.remittance_mode.replace('_', ' ')}</span>
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(b.status)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedBatch(b)}
                        className="px-2.5 py-1 text-xs font-bold text-[#8410DC] hover:text-[#4D0582] bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Slide-Over Drawer */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Batch Details</h3>
                  <p className="text-xs text-[#8410DC] font-mono">{selectedBatch.batch_reference}</p>
                </div>
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Status</span>
                  <span>{getStatusBadge(selectedBatch.status)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Remittance Mode</span>
                  <span className="font-semibold capitalize">{selectedBatch.remittance_mode.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Payout Reference / UTR</span>
                  <span className="font-mono font-semibold">{selectedBatch.payout_reference || 'Pending Bank Process'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Completed At</span>
                  <span className="font-semibold">
                    {selectedBatch.completed_at
                      ? new Date(selectedBatch.completed_at).toLocaleString('en-IN')
                      : 'In Progress'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Gross COD Collected</span>
                  <span className="font-bold">₹{parseFloat(String(selectedBatch.gross_cod_amount)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Platform Fees & Deductions</span>
                  <span className="font-bold text-rose-600">-₹{parseFloat(String(selectedBatch.platform_fee_deducted)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-sm font-black">
                  <span>Net Payout</span>
                  <span className="text-emerald-600">₹{parseFloat(String(selectedBatch.net_amount)).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-700">Included Shipments ({selectedBatch.shipment_ids?.length || 0})</h4>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  {(selectedBatch.shipment_ids || []).map((id, idx) => (
                    <div key={id} className="text-[11px] font-mono text-slate-600 flex justify-between">
                      <span>#{idx + 1} {id}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedBatch(null)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
