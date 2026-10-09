'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { downloadReportFile } from '@/lib/exportUtils';
import {
  AlertCircle,
  Download,
  Filter,
  RefreshCw,
  Search,
  UserCheck,
  ExternalLink,
  Phone,
  Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SellerOverdueReportPage() {
  const [data, setData] = useState<{
    summary: { total_overdue_sellers: number; total_overdue_amount: number };
    sellers: any[];
    pagination: { total: number; page: number; limit: number; total_pages: number };
  }>({
    summary: { total_overdue_sellers: 0, total_overdue_amount: 0 },
    sellers: [],
    pagination: { total: 0, page: 1, limit: 20, total_pages: 1 },
  });

  const [kams, setKams] = useState<any[]>([]);
  const [selectedKam, setSelectedKam] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    fetchKams();
  }, []);

  useEffect(() => {
    fetchOverdueReport();
  }, [selectedKam, page]);

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

  const fetchOverdueReport = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, limit: 20 };
      if (selectedKam) params.kam_id = selectedKam;
      if (search) params.search = search;

      const res = await apiClient.get('/admin/reports/seller-overdue', { params });
      if (res.data.success) {
        const payload = res.data.data || {};
        const sellersList = Array.isArray(payload.sellers)
          ? payload.sellers
          : Array.isArray(payload.rows)
          ? payload.rows
          : [];
        setData({
          summary: {
            total_overdue_sellers: payload.summary?.total_overdue_sellers || sellersList.length || 0,
            total_overdue_amount: payload.summary?.total_overdue_amount ?? payload.summary?.total_overdue_value ?? 0,
          },
          sellers: sellersList,
          pagination: payload.pagination || { total: sellersList.length, page: 1, limit: 20, total_pages: 1 },
        });
      }
    } catch (err: any) {
      toast.error('Failed to load seller overdue report');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOverdueReport();
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const params: Record<string, any> = { format };
    if (selectedKam) params.kam_id = selectedKam;
    if (search) params.search = search;

    downloadReportFile(
      '/admin/reports/seller-overdue/export',
      params,
      `seller_overdue_${new Date().toISOString().split('T')[0]}.${format}`
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-3">
            <AlertCircle className="w-7 h-7 text-rose-600" /> Seller Overdue Statement Report
          </h1>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">
            Real-time reconciliation of unpaid seller invoices past their due date with KAM assignment scoping.
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
            onClick={fetchOverdueReport}
            className="p-2 rounded-xl bg-white border border-[#E8DEF2] hover:bg-slate-50 text-slate-700 transition-all shadow-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E8DEF2] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7E7994] uppercase tracking-wider">Total Overdue Sellers</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {data.summary.total_overdue_sellers}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-rose-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E8DEF2] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7E7994] uppercase tracking-wider">Total Overdue Amount</p>
            <p className="text-3xl font-extrabold text-rose-600 mt-1">
              ₹{Number(data.summary.total_overdue_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
            <span className="text-xl font-bold text-rose-600">₹</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-[#E8DEF2] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7E7994]" />
          <input
            type="text"
            placeholder="Search company or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E8DEF2] text-xs focus:outline-none focus:border-[#5B069A] text-slate-900"
          />
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <UserCheck className="w-4 h-4 text-[#7E7994]" />
            <select
              value={selectedKam}
              onChange={(e) => {
                setSelectedKam(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-[#E8DEF2] text-xs focus:outline-none focus:border-[#5B069A] bg-white text-slate-800"
            >
              <option value="">All Key Account Managers (KAM)</option>
              {kams.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.email})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overdue Sellers Table */}
      <div className="bg-white rounded-2xl border border-[#E8DEF2] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#7E7994]">Loading overdue sellers report...</div>
        ) : data.sellers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#7E7994]">No sellers have overdue invoices.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F2ECF7] bg-slate-50/50 text-[#534F66]">
                  <th className="py-3 px-4 font-semibold">Seller Company</th>
                  <th className="py-3 px-4 font-semibold">Assigned KAM</th>
                  <th className="py-3 px-4 font-semibold">State</th>
                  <th className="py-3 px-4 font-semibold text-right">Unpaid Invoices</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Overdue</th>
                  <th className="py-3 px-4 font-semibold">Oldest Due Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sellers.map((s) => (
                  <tr key={s.tenant_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{s.company_name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-[#7E7994] mt-0.5">
                        {s.support_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {s.support_email}
                          </span>
                        )}
                        {s.support_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {s.support_phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {s.kam ? (
                        <div>
                          <p className="font-semibold text-slate-800">{s.kam.name}</p>
                          <p className="text-[10px] text-[#7E7994]">{s.kam.email}</p>
                        </div>
                      ) : (
                        <span className="text-[#7E7994] italic text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{s.state || 'N/A'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800">
                      {s.overdue_invoices_count}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600 text-sm">
                      ₹{Number(s.total_overdue_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {s.oldest_due_date ? s.oldest_due_date.split('T')[0] : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/sellers?id=${s.tenant_id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition-all"
                      >
                        View Seller <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data.pagination.total_pages > 1 && (
          <div className="p-4 border-t border-[#F2ECF7] flex items-center justify-between text-xs text-[#7E7994]">
            <p>
              Showing Page <span className="font-semibold text-slate-900">{data.pagination.page}</span> of{' '}
              <span className="font-semibold text-slate-900">{data.pagination.total_pages}</span> (
              {data.pagination.total} total overdue sellers)
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
                disabled={page >= data.pagination.total_pages}
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
