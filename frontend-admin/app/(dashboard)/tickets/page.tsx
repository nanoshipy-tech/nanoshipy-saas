'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, AlertTriangle, Clock, Eye } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';

import TicketQueueTable from '@/components/tickets/TicketQueueTable';

export default function PlatformTicketsPage() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [tenantId, setTenantId] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [slaBreached, setSlaBreached] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTickets = async () => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (tenantId.trim()) params.tenant_id = tenantId.trim();
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (slaBreached) params.sla_breached = slaBreached;

    try {
      const [ticketsRes, summaryRes] = await Promise.all([
        apiClient.get('/platform/tickets', { params }),
        apiClient.get('/platform/tickets/summary')
      ]);

      if (ticketsRes.data.success) {
        setTickets(ticketsRes.data.data.tickets || []);
        setTotalPages(ticketsRes.data.data.pages || 1);
      }
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
    } catch {
      toast.error('Failed to load tickets queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [tenantId, status, priority, slaBreached, page]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#14121F] flex items-center space-x-2">
            <ShieldAlert className="h-5.5 w-5.5 text-[#8410DC] dark:text-[#D6A8FF]" />
            <span>Support Tickets Queue</span>
          </h2>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] font-medium mt-0.5">
            Cross-tenant support console. Respond to queries and track SLAs
          </p>
        </div>

        <button
          onClick={fetchTickets}
          disabled={loading}
          className="p-2.5 bg-white dark:bg-white border border-[#E8DEF2] hover:bg-slate-50 dark:hover:bg-white/[0.06] border border-slate-200 dark:border-[#E8DEF2] rounded-xl text-slate-700 dark:text-slate-200 transition shadow-sm active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Overview Summary Card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Open Tickets', value: summary?.open ?? 0, color: 'text-[#8410DC] dark:text-[#D6A8FF]' },
          { label: 'In Progress', value: summary?.in_progress ?? 0, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'SLA Breached', value: summary?.sla_breached ?? 0, color: 'text-rose-600 dark:text-rose-400' },
          { label: 'Avg First Response', value: summary ? `${summary.avg_first_response_hours || 0} hrs` : '0 hrs', color: 'text-emerald-600 dark:text-emerald-400' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-white border border-[#E8DEF2] p-5 rounded-2xl border border-slate-200 dark:border-[#E8DEF2] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-[#7E7994] dark:text-[#534F66] tracking-wider block">
              {stat.label}
            </span>
            <h4 className={`text-2xl font-black ${stat.color} mt-1.5`}>
              {loading ? '...' : stat.value}
            </h4>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-white border border-[#E8DEF2] p-4 rounded-2xl border border-slate-200 dark:border-[#E8DEF2] shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] text-[#7E7994] dark:text-[#534F66] font-bold uppercase tracking-wider block mb-1">
            Search Tenant ID
          </label>
          <input
            type="text"
            placeholder="e.g. UUID tenant id"
            value={tenantId}
            onChange={(e) => { setTenantId(e.target.value); setPage(1); }}
            className="w-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-[#E8DEF2] rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#8410DC]"
          />
        </div>

        <div>
          <label className="text-[10px] text-[#7E7994] dark:text-[#534F66] font-bold uppercase tracking-wider block mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-[#E8DEF2] rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
          >
            <option value="" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">All Statuses</option>
            <option value="open" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">Open</option>
            <option value="in_progress" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">In Progress</option>
            <option value="waiting_on_tenant" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">Waiting on Tenant</option>
            <option value="resolved" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">Resolved</option>
            <option value="closed" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">Closed</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] text-[#7E7994] dark:text-[#534F66] font-bold uppercase tracking-wider block mb-1">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}
            className="bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-[#E8DEF2] rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
          >
            <option value="" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">All Priorities</option>
            <option value="low" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">Low</option>
            <option value="medium" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">Medium</option>
            <option value="high" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">High</option>
            <option value="urgent" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">Urgent</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] text-[#7E7994] dark:text-[#534F66] font-bold uppercase tracking-wider block mb-1">
            SLA Warning
          </label>
          <select
            value={slaBreached}
            onChange={(e) => { setSlaBreached(e.target.value); setPage(1); }}
            className="bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-[#E8DEF2] rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
          >
            <option value="" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">All Deadlines</option>
            <option value="true" className="bg-white dark:bg-white border border-[#E8DEF2] text-slate-900 dark:text-white">Breached SLA Only</option>
          </select>
        </div>
      </div>

      {/* Tickets List table */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-white border border-[#E8DEF2] rounded-2xl border border-slate-200 dark:border-[#E8DEF2]">
          <RefreshCw className="h-6 w-6 animate-spin text-[#8410DC] dark:text-[#D6A8FF]" />
        </div>
      ) : (
        <TicketQueueTable tickets={tickets} />
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-4">
          <button
            onClick={() => setPage(Math.max(page - 1, 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-slate-200 dark:border-[#E8DEF2] rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition text-slate-900 dark:text-white"
          >
            Prev
          </button>
          <span className="text-xs font-bold text-[#7E7994] dark:text-[#534F66]">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(page + 1, totalPages))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-slate-200 dark:border-[#E8DEF2] rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition text-slate-900 dark:text-white"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
