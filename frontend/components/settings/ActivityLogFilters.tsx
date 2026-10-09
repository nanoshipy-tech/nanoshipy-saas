'use client';

import React from 'react';
import { Search, Calendar, Tag, User, X } from 'lucide-react';

export interface ActivityLogFilters {
  action: string;
  entityType: string;
  userId: string;
  tenantId: string;
  dateFrom: string;
  dateTo: string;
}

interface ActivityLogFiltersProps {
  filters: ActivityLogFilters;
  onChange: (filters: ActivityLogFilters) => void;
  showTenantFilter?: boolean;
  showUserFilter?: boolean;
}

const COMMON_ENTITY_TYPES = [
  'shipment', 'order', 'invoice', 'wallet', 'user', 'ticket',
  'subscription', 'api_key', 'webhook', 'courier', 'address', 'role',
];

export default function ActivityLogFilters({
  filters,
  onChange,
  showTenantFilter = false,
  showUserFilter = true,
}: ActivityLogFiltersProps) {
  const set = (key: keyof ActivityLogFilters, val: string) =>
    onChange({ ...filters, [key]: val });

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const clearAll = () =>
    onChange({ action: '', entityType: '', userId: '', tenantId: '', dateFrom: '', dateTo: '' });

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* Action search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="activity-log-action-filter"
            type="text"
            value={filters.action}
            onChange={e => set('action', e.target.value)}
            placeholder="Search action…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition"
          />
        </div>

        {/* Entity type dropdown */}
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            id="activity-log-entity-type-filter"
            value={filters.entityType}
            onChange={e => set('entityType', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition appearance-none"
          >
            <option value="">All entity types</option>
            {COMMON_ENTITY_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="activity-log-date-from-filter"
            type="date"
            value={filters.dateFrom}
            onChange={e => set('dateFrom', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
          />
        </div>

        {/* Date to */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="activity-log-date-to-filter"
            type="date"
            value={filters.dateTo}
            onChange={e => set('dateTo', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
          />
        </div>

        {/* User ID (optional) */}
        {showUserFilter && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="activity-log-user-filter"
              type="text"
              value={filters.userId}
              onChange={e => set('userId', e.target.value)}
              placeholder="User ID (UUID)"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition font-mono"
            />
          </div>
        )}

        {/* Tenant ID (admin only) */}
        {showTenantFilter && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="activity-log-tenant-filter"
              type="text"
              value={filters.tenantId}
              onChange={e => set('tenantId', e.target.value)}
              placeholder="Tenant ID (UUID)"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition font-mono"
            />
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition"
        >
          <X className="w-3.5 h-3.5" />
          Clear all filters
        </button>
      )}
    </div>
  );
}
