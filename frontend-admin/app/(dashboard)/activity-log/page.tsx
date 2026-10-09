'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Download, RefreshCw, Users } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import PlatformActivityLogTable, { PlatformAuditEntry } from '@/components/settings/PlatformActivityLogTable';

// Reuse the tenant's ActivityLogFilters shape
interface Filters {
  action: string;
  entityType: string;
  tenantId: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  action: '', entityType: '', tenantId: '', dateFrom: '', dateTo: '',
};

const ENTITY_TYPES = [
  'shipment', 'order', 'invoice', 'wallet', 'user', 'ticket',
  'subscription', 'api_key', 'webhook', 'courier', 'address', 'role',
  'platform_setting', 'audit_log',
];

export default function PlatformActivityLogPage() {
  const [entries, setEntries] = useState<PlatformAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [scopeMode, setScopeMode] = useState<'all' | 'tenant'>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, limit: 50 });

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/platform/activity-log';
      const params: any = { page, limit: 50 };

      if (scopeMode === 'tenant' && filters.tenantId) {
        url = `/platform/activity-log/tenant/${filters.tenantId}`;
      } else {
        if (filters.tenantId) params.target_tenant_id = filters.tenantId;
      }
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entity_type = filters.entityType;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;

      const res = await apiClient.get(url, { params });
      if (res.data.success) {
        setEntries(res.data.data.items);
        setPagination(res.data.data.pagination);
      }
    } catch {
      toast.error('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [filters, page, scopeMode]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const handleFiltersChange = (update: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...update }));
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload: any = {};
      if (filters.action) payload.action = filters.action;
      if (filters.entityType) payload.entity_type = filters.entityType;
      if (filters.tenantId) payload.target_tenant_id = filters.tenantId;
      if (filters.dateFrom) payload.date_from = filters.dateFrom;
      if (filters.dateTo) payload.date_to = filters.dateTo;

      const res = await apiClient.post('/platform/activity-log/export', payload, { responseType: 'blob' });
      const rowCount = res.headers['x-export-row-count'];
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `platform-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${rowCount || '?'} rows`);
    } catch {
      toast.error('Failed to export platform activity log');
    } finally {
      setExporting(false);
    }
  };

  const handleDrillDown = (tenantId: string) => {
    setFilters(prev => ({ ...prev, tenantId }));
    setScopeMode('tenant');
    setPage(1);
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
            <h1 className="text-2xl font-bold text-[#14121F]">Platform Activity Log</h1>
            <p className="text-sm text-[#534F66] mt-0.5">
              Platform-wide audit trail — all admin actions and tenant-level events
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="platform-activity-log-refresh-btn"
            onClick={fetchLog}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-[#E8DEF2] text-[#14121F] rounded-lg text-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            id="platform-activity-log-export-btn"
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

      {/* Scope toggle + filter bar */}
      <div className="bg-white/5 border border-[#E8DEF2] rounded-xl p-4 space-y-3">
        {/* Scope mode toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#534F66] font-medium">Scope:</span>
          <div className="flex rounded-lg overflow-hidden border border-[#E8DEF2]">
            {[['all', 'All Tenants'], ['tenant', 'Specific Tenant']].map(([mode, label]) => (
              <button
                key={mode}
                id={`scope-toggle-${mode}`}
                onClick={() => { setScopeMode(mode as 'all' | 'tenant'); setPage(1); }}
                className={`px-4 py-1.5 text-xs font-medium transition ${
                  scopeMode === mode
                    ? 'bg-violet-600 text-white'
                    : 'bg-transparent text-[#534F66] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <input
            id="platform-activity-log-action-filter"
            type="text"
            value={filters.action}
            onChange={e => handleFiltersChange({ action: e.target.value })}
            placeholder="Search action…"
            className="bg-white/5 border border-[#E8DEF2] rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
          />
          <select
            id="platform-activity-log-entity-filter"
            value={filters.entityType}
            onChange={e => handleFiltersChange({ entityType: e.target.value })}
            className="bg-white/5 border border-[#E8DEF2] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
          >
            <option value="">All entity types</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            id="platform-activity-log-tenant-filter"
            type="text"
            value={filters.tenantId}
            onChange={e => handleFiltersChange({ tenantId: e.target.value })}
            placeholder="Tenant ID (UUID)"
            className="bg-white/5 border border-[#E8DEF2] rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition font-mono"
          />
          <input
            id="platform-activity-log-date-from-filter"
            type="date"
            value={filters.dateFrom}
            onChange={e => handleFiltersChange({ dateFrom: e.target.value })}
            className="bg-white/5 border border-[#E8DEF2] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
          />
          <input
            id="platform-activity-log-date-to-filter"
            type="date"
            value={filters.dateTo}
            onChange={e => handleFiltersChange({ dateTo: e.target.value })}
            className="bg-white/5 border border-[#E8DEF2] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
          />
        </div>

        {scopeMode === 'tenant' && filters.tenantId && (
          <div className="flex items-center gap-2 text-xs text-cyan-400">
            <Users className="w-3.5 h-3.5" />
            Viewing tenant: <span className="font-mono">{filters.tenantId}</span>
            <button onClick={() => { setFilters(EMPTY_FILTERS); setScopeMode('all'); }} className="text-[#7E7994] hover:text-red-400 transition text-xs">× Clear</button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-[#534F66]">
        <span>{loading ? 'Loading…' : `${pagination.total.toLocaleString()} total entries`}</span>
        <span>Page {page} of {pagination.total_pages}</span>
      </div>

      {/* Table */}
      <PlatformActivityLogTable
        entries={entries}
        loading={loading}
        onDrillDown={handleDrillDown}
      />

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
          <span className="text-sm text-[#534F66] px-2">{page} / {pagination.total_pages}</span>
          <button
            disabled={page >= pagination.total_pages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-[#E8DEF2] text-[#14121F] rounded-lg transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
