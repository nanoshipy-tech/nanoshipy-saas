'use client';

import React from 'react';
import { Calendar, Hash, ChevronRight, Monitor } from 'lucide-react';

// Redefine here to avoid cross-app import issues
export interface PlatformAuditEntry {
  id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  platform_admin_id?: string;
  target_tenant_id?: string;
  ip_address?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface PlatformActivityLogTableProps {
  entries: PlatformAuditEntry[];
  loading: boolean;
  onDrillDown?: (tenantId: string) => void;
}

const ACTION_COLORS: Record<string, string> = {
  platform_setting_updated: 'bg-violet-500/20 text-violet-300',
  viewed_tenant_activity_log: 'bg-cyan-500/20 text-cyan-300',
  impersonation_: 'bg-red-500/20 text-red-300',
  ticket_: 'bg-amber-500/20 text-amber-300',
  tenant_: 'bg-[#8410DC]/20 text-purple-300',
};

function getActionColor(action: string): string {
  for (const [prefix, cls] of Object.entries(ACTION_COLORS)) {
    if (action.startsWith(prefix) || action === prefix) return cls;
  }
  return 'bg-slate-500/20 text-slate-400';
}

export default function PlatformActivityLogTable({
  entries,
  loading,
  onDrillDown,
}: PlatformActivityLogTableProps) {
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
        <p className="text-sm">No platform activity log entries found</p>
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
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tenant</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Entity</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Admin</th>
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
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                  {new Date(entry.created_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })}
                </td>

                <td className="px-4 py-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-mono ${getActionColor(entry.action)}`}>
                    {entry.action}
                  </span>
                </td>

                {/* Tenant — with drill-down button */}
                <td className="px-4 py-3">
                  {entry.target_tenant_id ? (
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-slate-300">
                        {entry.target_tenant_id.slice(0, 8)}…
                      </span>
                      {onDrillDown && (
                        <button
                          onClick={e => { e.stopPropagation(); onDrillDown(entry.target_tenant_id!); }}
                          className="p-0.5 text-slate-500 hover:text-cyan-400 transition"
                          title="View tenant activity log"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>

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

                <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                  {entry.platform_admin_id ? entry.platform_admin_id.slice(0, 8) + '…' : '—'}
                </td>

                <td className="px-4 py-3 text-slate-500 text-xs font-mono">{entry.ip_address || '—'}</td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-slate-500 text-xs">
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <ChevronRight className={`w-3 h-3 transition-transform ${expandedId === entry.id ? 'rotate-90' : ''}`} />
                    )}
                  </div>
                </td>
              </tr>

              {expandedId === entry.id && entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <tr className="bg-white/3">
                  <td colSpan={7} className="px-6 py-3">
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
