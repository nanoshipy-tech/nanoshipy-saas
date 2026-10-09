'use client';

import React from 'react';
import { Calendar, User, Monitor, Hash, ChevronRight } from 'lucide-react';

export interface ActivityLogEntry {
  id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  platform_admin_id?: string;
  target_tenant_id?: string;
  ip_address?: string;
  metadata?: Record<string, any>;
  created_at: string;
  actor?: { id: string; name: string; email: string };
}

interface ActivityLogTableProps {
  entries: ActivityLogEntry[];
  loading: boolean;
  showTenantColumn?: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-emerald-500/20 text-emerald-300',
  logout: 'bg-slate-500/20 text-slate-400',
  shipment_created: 'bg-[#8410DC]/20 text-purple-300',
  order_created: 'bg-[#8410DC]/20 text-purple-300',
  invoice_: 'bg-amber-500/20 text-amber-300',
  wallet_: 'bg-green-500/20 text-green-300',
  settings_updated: 'bg-violet-500/20 text-violet-300',
  impersonation_: 'bg-red-500/20 text-red-300',
  ticket_: 'bg-cyan-500/20 text-cyan-300',
};

function getActionColor(action: string): string {
  for (const [prefix, cls] of Object.entries(ACTION_COLORS)) {
    if (action.startsWith(prefix) || action === prefix) return cls;
  }
  return 'bg-slate-500/20 text-slate-400';
}

function formatMetadata(meta: Record<string, any> | undefined): string {
  if (!meta || Object.keys(meta).length === 0) return '—';
  return Object.entries(meta)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}

export default function ActivityLogTable({
  entries,
  loading,
  showTenantColumn = false,
}: ActivityLogTableProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Monitor className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No activity log entries found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Time</div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Entity</th>
            {showTenantColumn && (
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tenant</th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-1"><User className="w-3 h-3" /> Actor</div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">IP</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {entries.map(entry => (
            <React.Fragment key={entry.id}>
              <tr
                className="hover:bg-white/5 transition cursor-pointer"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                {/* Time */}
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                  {new Date(entry.created_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })}
                </td>

                {/* Action */}
                <td className="px-4 py-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-mono ${getActionColor(entry.action)}`}>
                    {entry.action}
                  </span>
                </td>

                {/* Entity */}
                <td className="px-4 py-3">
                  {entry.entity_type ? (
                    <div>
                      <span className="text-slate-300 text-xs">{entry.entity_type}</span>
                      {entry.entity_id && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Hash className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-500 text-xs font-mono">{entry.entity_id.slice(0, 8)}…</span>
                        </div>
                      )}
                    </div>
                  ) : <span className="text-slate-600">—</span>}
                </td>

                {/* Tenant column (admin only) */}
                {showTenantColumn && (
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                    {entry.target_tenant_id ? entry.target_tenant_id.slice(0, 8) + '…' : '—'}
                  </td>
                )}

                {/* Actor */}
                <td className="px-4 py-3">
                  {entry.actor ? (
                    <div>
                      <span className="text-slate-300 text-xs">{entry.actor.name}</span>
                      <div className="text-slate-500 text-xs">{entry.actor.email}</div>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-xs font-mono">
                      {(entry.user_id || entry.platform_admin_id || '—').slice(0, 8)}{entry.user_id || entry.platform_admin_id ? '…' : ''}
                    </span>
                  )}
                </td>

                {/* IP */}
                <td className="px-4 py-3 text-slate-500 text-xs font-mono">{entry.ip_address || '—'}</td>

                {/* Details toggle */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-slate-500 text-xs">
                    <span className="truncate max-w-[180px]">{formatMetadata(entry.metadata)}</span>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <ChevronRight className={`w-3 h-3 transition-transform ${expandedId === entry.id ? 'rotate-90' : ''}`} />
                    )}
                  </div>
                </td>
              </tr>

              {/* Expanded metadata row */}
              {expandedId === entry.id && entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <tr className="bg-white/3">
                  <td colSpan={showTenantColumn ? 7 : 6} className="px-6 py-3">
                    <div className="bg-slate-900/60 rounded-lg p-3 border border-white/5">
                      <p className="text-xs font-medium text-slate-400 mb-2">Metadata</p>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
