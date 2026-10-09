'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Activity } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import ActivityLogTable, { ActivityLogEntry } from '@/components/settings/ActivityLogTable';
import ActivityLogFilters, { ActivityLogFilters as FiltersState } from '@/components/settings/ActivityLogFilters';

const EMPTY_FILTERS: FiltersState = {
  action: '', entityType: '', userId: '', tenantId: '', dateFrom: '', dateTo: '',
};

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, limit: 50 });

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entity_type = filters.entityType;
      if (filters.userId) params.user_id = filters.userId;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;

      const res = await apiClient.get('/activity-log', { params });
      if (res.data.success) {
        setEntries(res.data.data.items);
        setPagination(res.data.data.pagination);
      }
    } catch {
      toast.error('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  // Reset to page 1 when filters change
  const handleFiltersChange = (f: FiltersState) => {
    setFilters(f);
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload: any = {};
      if (filters.action) payload.action = filters.action;
      if (filters.entityType) payload.entity_type = filters.entityType;
      if (filters.dateFrom) payload.date_from = filters.dateFrom;
      if (filters.dateTo) payload.date_to = filters.dateTo;

      const res = await apiClient.post('/activity-log/export', payload, { responseType: 'blob' });
      const rowCount = res.headers['x-export-row-count'];
      
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Exported ${rowCount || '?'} rows`);
    } catch {
      toast.error('Failed to export activity log');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#14121F]">Activity Log</h1>
            <p className="text-sm text-[#534F66] mt-0.5">
              Complete audit trail of all actions on your account
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="activity-log-refresh-btn"
            onClick={fetchLog}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-[#E8DEF2] text-[#14121F] rounded-lg text-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            id="activity-log-export-btn"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
          >
            {exporting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <ActivityLogFilters
        filters={filters}
        onChange={handleFiltersChange}
        showTenantFilter={false}
        showUserFilter={true}
      />

      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm text-[#534F66]">
        <span>
          {loading ? 'Loading…' : `${pagination.total.toLocaleString()} total entries`}
        </span>
        <span>
          Page {page} of {pagination.total_pages}
        </span>
      </div>

      {/* Table */}
      <ActivityLogTable entries={entries} loading={loading} showTenantColumn={false} />

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-[#E8DEF2] text-[#14121F] rounded-lg transition"
          >
            Previous
          </button>
          <span className="text-sm text-[#534F66] px-2">
            {page} / {pagination.total_pages}
          </span>
          <button
            disabled={page >= pagination.total_pages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-[#E8DEF2] text-[#14121F] rounded-lg transition"
          >
            Next
          </button>
        </div>
      )}

      {/* Export cap note */}
      <p className="text-center text-xs text-slate-600">
        CSV exports are capped at 50,000 rows. Use a narrower date range to export larger datasets.
      </p>
    </div>
  );
}
