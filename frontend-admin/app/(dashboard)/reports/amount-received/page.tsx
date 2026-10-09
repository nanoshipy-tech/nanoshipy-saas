'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { downloadReportFile } from '@/lib/exportUtils';
import { DateRangeFilter, getDefault30DaysRange, DateRange } from '@/components/ui/DateRangeFilter';
import {
  DollarSign,
  Download,
  Filter,
  RefreshCw,
  Search,
  UserCheck,
  MapPin,
  CheckCircle2,
  TrendingUp,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AmountReceivedReportPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefault30DaysRange());
  const [data, setData] = useState<{
    summary: { total_amount_received: number; total_transactions_count: number; total_unique_tenants: number };
    transactions: any[];
    pagination: { total: number; page: number; limit: number; total_pages: number };
  }>({
    summary: { total_amount_received: 0, total_transactions_count: 0, total_unique_tenants: 0 },
    transactions: [],
    pagination: { total: 0, page: 1, limit: 20, total_pages: 1 },
  });

  const [kams, setKams] = useState<any[]>([]);
  const [selectedKam, setSelectedKam] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [viewMode, setViewMode] = useState<'overall' | 'seller_wise'>('overall');
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    fetchKams();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [dateRange, selectedKam, selectedState, viewMode, page]);

  const fetchKams = async () => {
    try {
      const res = await apiClient.get('/platform/auth/admins');
      if (res.data.success) {
        const kamList = (res.data.data || []).filter(
          (a: any) => a.role === 'key_account_manager' || a.role === 'super_admin'
        );
        setKams(kamList);
      }
    } catch {
      // Non-critical
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        from: dateRange.from,
        to: dateRange.to,
        page,
        limit: 20,
      };
      if (selectedKam) params.kam_id = selectedKam;
      if (selectedState) params.state = selectedState;

      const res = await apiClient.get('/admin/reports/amount-received', { params });
      if (res.data.success) {
        const payload = res.data.data || {};
        const txList = Array.isArray(payload.transactions)
          ? payload.transactions
          : Array.isArray(payload.rows)
          ? payload.rows
          : [];

        setData({
          summary: {
            total_amount_received: Number(payload.summary?.total_amount_received || 0),
            total_transactions_count: Number(
              payload.summary?.total_transactions_count ||
              payload.summary?.total_transactions ||
              txList.length ||
              0
            ),
            total_unique_tenants: Number(
              payload.summary?.total_unique_tenants ||
              (payload.sellers ? payload.sellers.length : 0) ||
              0
            ),
          },
          transactions: txList,
          pagination: payload.pagination || {
            total: txList.length,
            page,
            limit: 20,
            total_pages: Math.max(1, Math.ceil(txList.length / 20)),
          },
        });
      }
    } catch {
      toast.error('Failed to load amount received report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const params: Record<string, any> = {
      from: dateRange.from,
      to: dateRange.to,
      format,
    };
    if (selectedKam) params.kam_id = selectedKam;
    if (selectedState) params.state = selectedState;

    downloadReportFile(
      '/admin/reports/amount-received/export',
      params,
      `amount_received_${dateRange.from}_to_${dateRange.to}.${format}`
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-emerald-600" /> Amount Received Report
          </h1>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">
            Wallet recharge ledger and revenue collection filtered by period, KAM, and seller states. Refunded transactions strictly excluded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#E8DEF2] hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-[#7E7994]" /> CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#5B069A] hover:bg-[#5B069A]/90 text-xs font-semibold text-white transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-white" /> Excel
          </button>
          <button
            onClick={fetchReport}
            className="p-2 rounded-xl bg-white border border-[#E8DEF2] hover:bg-slate-50 text-slate-700 transition-all shadow-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E8DEF2] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7E7994] uppercase tracking-wider">Total Amount Received</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1">
              ₹{Number(data.summary?.total_amount_received || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E8DEF2] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7E7994] uppercase tracking-wider">Successful Recharges</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {data.summary?.total_transactions_count || 0}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-[#5B069A]" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E8DEF2] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7E7994] uppercase tracking-wider">Unique Merchants</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {data.summary?.total_unique_tenants || 0}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <Layers className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-[#E8DEF2] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Date Range Picker */}
        <DateRangeFilter initialRange={dateRange} onChange={setDateRange} />

        {/* Dimension Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#7E7994]" />
            <select
              value={selectedKam}
              onChange={(e) => { setSelectedKam(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-[#E8DEF2] text-xs focus:outline-none focus:border-[#5B069A] bg-white text-slate-800"
            >
              <option value="">All KAMs</option>
              {kams.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#7E7994]" />
            <input
              type="text"
              placeholder="Filter State (e.g. Maharashtra)"
              value={selectedState}
              onChange={(e) => { setSelectedState(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-[#E8DEF2] text-xs focus:outline-none focus:border-[#5B069A] bg-white text-slate-800 w-44"
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-[#E8DEF2] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#7E7994]">Loading amount received report...</div>
        ) : !data.transactions || data.transactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#7E7994]">No recharge transactions found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F2ECF7] bg-slate-50/50 text-[#534F66]">
                  <th className="py-3 px-4 font-semibold">Transaction ID</th>
                  <th className="py-3 px-4 font-semibold">Merchant / Company</th>
                  <th className="py-3 px-4 font-semibold">State</th>
                  <th className="py-3 px-4 font-semibold">Assigned KAM</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount Received</th>
                  <th className="py-3 px-4 font-semibold text-right">Balance After</th>
                  <th className="py-3 px-4 font-semibold">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.transactions || []).map((tx, idx) => {
                  const txId = String(tx.id || tx.transaction_id || tx.order_id || idx);
                  return (
                    <tr key={txId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#5B069A]">
                        {txId.length > 13 ? `${txId.substring(0, 13)}...` : txId}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{tx.tenant?.company_name || tx.seller_name || 'Unnamed Merchant'}</p>
                        <p className="text-[11px] text-[#7E7994]">{tx.tenant?.support_email || ''}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{tx.tenant?.state || tx.state || 'N/A'}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {tx.tenant?.kam ? tx.tenant.kam.name : (tx.kam_name && tx.kam_name !== 'Unassigned' ? tx.kam_name : <span className="text-[#7E7994] italic">Unassigned</span>)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 text-sm">
                        +₹{Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-800">
                        ₹{Number(tx.balance_after || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {tx.created_at ? new Date(tx.created_at).toLocaleString('en-IN') : (tx.date || 'N/A')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {(data.pagination?.total_pages || 1) > 1 && (
          <div className="p-4 border-t border-[#F2ECF7] flex items-center justify-between text-xs text-[#7E7994]">
            <p>
              Showing Page <span className="font-semibold text-slate-900">{data.pagination?.page || 1}</span> of{' '}
              <span className="font-semibold text-slate-900">{data.pagination?.total_pages || 1}</span> (
              {data.pagination?.total || 0} total transactions)
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-[#E8DEF2] bg-white disabled:opacity-50 text-slate-800 font-semibold"
              >
                Previous
              </button>
              <button
                disabled={page >= (data.pagination?.total_pages || 1)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-[#E8DEF2] bg-white disabled:opacity-50 text-slate-800 font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
