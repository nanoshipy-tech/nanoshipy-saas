'use client';

import { apiClient } from '@/lib/apiClient';
import React, { useState, useEffect } from 'react';
import MarginReportChart from '@/components/pricing/MarginReportChart';
import { BarChart3, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function MarginReportPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const fetchReport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params: any = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await apiClient.get('/platform/margin-report', { params });
      if (res.data?.success && res.data?.data) {
        setReportData(res.data.data);
      } else if (res.data?.data) {
        setReportData(res.data.data);
      } else {
        setReportData({
          total_sell: 0,
          total_cost: 0,
          total_margin: 0,
          shipping_margin_percent: 0,
          cod_margin: 0,
          rto_margin: 0,
          by_courier: [],
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch margin report:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to load margin report');
      setReportData({
        total_sell: 0,
        total_cost: 0,
        total_margin: 0,
        shipping_margin_percent: 0,
        cod_margin: 0,
        rto_margin: 0,
        by_courier: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateFrom, dateTo]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Back to Pricing Hub"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 font-['Outfit',sans-serif]">
              <BarChart3 className="w-6 h-6 text-[#8410DC]" />
              Margin & Revenue Analytics
            </h1>
          </div>
          <p className="text-sm text-[#7E7994]">
            Internal Platform Admin report — Cost vs Sell Margin by courier and date range
          </p>
        </div>

        <button
          onClick={fetchReport}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Date Filter */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-200 p-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-200 p-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        {(dateFrom || dateTo) && (
          <div className="flex items-end">
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-[#7E7994] bg-white rounded-xl border border-slate-200 flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#8410DC]" />
          <p className="text-sm font-semibold">Loading margin analytics...</p>
        </div>
      ) : (
        <MarginReportChart data={reportData} />
      )}
    </div>
  );
}
