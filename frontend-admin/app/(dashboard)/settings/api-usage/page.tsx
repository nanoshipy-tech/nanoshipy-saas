'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Key, Activity, RefreshCw } from 'lucide-react';

export default function AdminApiUsagePage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApiUsage();
  }, []);

  const fetchApiUsage = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/platform/webhook-logs');
      if (res.data.success) {
        setLogs(res.data.data?.rows || res.data.data || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#14121F] flex items-center gap-3">
            <Activity className="w-6 h-6 text-[#D6A8FF]" /> Platform API Usage & Webhook Logs
          </h1>
          <p className="text-xs text-[#534F66] mt-0.5">Real-time throughput, endpoint response times, and API call logs</p>
        </div>
        <button onClick={fetchApiUsage} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#14121F] text-xs font-semibold border border-[#E8DEF2] shadow-sm transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
        </button>
      </div>

      <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-[#534F66] text-xs">Loading API usage logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-[#7E7994] text-xs">No recent API calls or webhooks logged.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F2ECF7] text-[#534F66] bg-slate-50/60">
                  <th className="py-3 px-4 font-semibold">Source Provider</th>
                  <th className="py-3 px-4 font-semibold">Event Type</th>
                  <th className="py-3 px-4 font-semibold">Status Code</th>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECF7]">
                {logs.map((l, i) => (
                  <tr key={l.id || i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#5B069A] uppercase">{l.provider || l.source || 'DEVELOPER_API'}</td>
                    <td className="py-3 px-4 text-[#14121F] font-mono font-medium">{l.event_type || l.endpoint || 'POST /api/v1/orders'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${Number(l.status_code || 200) < 400 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {l.status_code || 200}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#534F66]">
                      {new Date(l.created_at || Date.now()).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
