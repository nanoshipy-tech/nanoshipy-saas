'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileX,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExportModal from '@/components/exports/ExportModal';

interface ExportJob {
  id: string;
  tenant_id: string;
  requested_by?: string;
  entity: string;
  filters?: Record<string, any>;
  columns?: string[];
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'expired';
  total_rows?: number;
  file_key?: string;
  file_size?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export default function ExportsHistoryPage() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [selectedEntityForNew, setSelectedEntityForNew] = useState<string>('orders');
  const [showExportModal, setShowExportModal] = useState(false);
  const [entities, setEntities] = useState<{ key: string; label: string }[]>([]);
  const [selectedFailureReason, setSelectedFailureReason] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchEntities();
    fetchExports(page);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [page]);

  // Set up polling if any job is queued or processing
  useEffect(() => {
    const hasPendingJobs = jobs.some(
      (j) => j.status === 'queued' || j.status === 'processing'
    );

    if (hasPendingJobs) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(() => {
          fetchExports(page, true);
        }, 4000);
      }
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [jobs, page]);

  const fetchEntities = async () => {
    try {
      const res = await apiClient.get('/admin/exports/entities');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setEntities(res.data.data.map((e: any) => ({ key: e.key, label: e.label })));
      }
    } catch {
      // Fallback entity list
      setEntities([
        { key: 'orders', label: 'Orders & Dispatches' },
        { key: 'shipments', label: 'Shipments & Tracking' },
        { key: 'ndr', label: 'NDR Exceptions' },
        { key: 'cod_remittances', label: 'COD Remittances' },
        { key: 'wallet_transactions', label: 'Wallet Transactions' },
        { key: 'customers', label: 'Customers' },
        { key: 'support_tickets', label: 'Support Tickets' },
      ]);
    }
  };

  const fetchExports = async (currentPage = 1, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await apiClient.get('/admin/exports', {
        params: { page: currentPage, limit: 15 },
      });

      if (res.data?.success) {
        const payload = res.data.data;
        const items = payload?.items || payload?.rows || (Array.isArray(payload) ? payload : []);
        setJobs(items);
        if (payload?.pagination) {
          setPagination({
            total: payload.pagination.total || items.length,
            totalPages: payload.pagination.totalPages || 1,
          });
        }
      }
    } catch (err: any) {
      if (!isSilent) {
        toast.error('Failed to load export history');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleDownload = async (job: ExportJob) => {
    try {
      const res = await apiClient.get(`/admin/exports/${job.id}/download`);
      if (res.data?.success && res.data.data?.download_url) {
        window.open(res.data.data.download_url, '_blank');
      } else {
        toast.error('Download link unavailable');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Download failed or file expired';
      toast.error(msg);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatISTDate = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  const renderStatusBadge = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Queued
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700">
            <FileX className="w-3 h-3" /> Expired
          </span>
        );
      default:
        return <span className="text-slate-500">{status}</span>;
    }
  };

  const hasPending = jobs.some((j) => j.status === 'queued' || j.status === 'processing');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14121F] dark:text-white flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7 text-[#8410DC]" />
            Data Exports Hub
          </h1>
          <p className="text-xs text-[#534F66] dark:text-slate-400 font-medium mt-1">
            Asynchronous streaming Excel (.xlsx) exports with flat memory keyset pagination & webhook notifications
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchExports(page)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#14121F] dark:text-white font-semibold text-xs border border-slate-200 dark:border-slate-700 shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <div className="flex items-center gap-2">
            <select
              value={selectedEntityForNew}
              onChange={(e) => setSelectedEntityForNew(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-[#8410DC]"
            >
              {entities.map((ent) => (
                <option key={ent.key} value={ent.key}>
                  {ent.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#8410DC] hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Export
            </button>
          </div>
        </div>
      </div>

      {/* Auto-polling Banner if running */}
      {hasPending && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-[#8410DC] dark:text-[#D6A8FF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            <span>
              Background exports in progress. Auto-refreshing status every 4 seconds...
            </span>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white dark:bg-purple-900">
            Live Polling
          </span>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading && jobs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#8410DC]" />
            <span>Loading export jobs...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs space-y-3">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm">No export jobs recorded</p>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              Trigger your first Excel export from any list page (Orders, Shipments, NDR) or click &quot;New Export&quot; above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/50 font-semibold">
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Job ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Rows</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Requested At</th>
                  <th className="py-3 px-4">Expires At</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {jobs.map((job) => {
                  const isExpired = job.status === 'expired' || (job.expires_at && new Date(job.expires_at) < new Date());
                  const canDownload = job.status === 'completed' && !isExpired;

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white capitalize">
                        {job.entity.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {job.id.slice(0, 8)}…
                      </td>
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(job.status)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {job.total_rows !== undefined && job.total_rows !== null
                          ? Number(job.total_rows).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {formatFileSize(job.file_size)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {formatISTDate(job.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {job.expires_at ? formatISTDate(job.expires_at) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {canDownload ? (
                          <button
                            onClick={() => handleDownload(job)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8410DC] hover:bg-purple-700 text-white rounded-lg font-bold text-xs shadow-sm transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        ) : job.status === 'failed' ? (
                          <button
                            onClick={() =>
                              setSelectedFailureReason(
                                job.error_message || 'An unknown server error occurred during export processing.'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg font-medium hover:bg-rose-100 transition"
                          >
                            <Info className="w-3 h-3" /> Error Details
                          </button>
                        ) : job.status === 'processing' || job.status === 'queued' ? (
                          <span className="text-slate-400 italic">In progress…</span>
                        ) : (
                          <span className="text-slate-400 italic">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing Page {page} of {pagination.totalPages} ({pagination.total} total jobs)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal Triggered from Header */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        entity={selectedEntityForNew}
        entityLabel={entities.find((e) => e.key === selectedEntityForNew)?.label}
        onExportSuccess={() => {
          fetchExports(1);
        }}
      />

      {/* Error Reason Modal */}
      {selectedFailureReason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Export Failure Diagnostic</h3>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-rose-700 dark:text-rose-400 break-words">
              {selectedFailureReason}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedFailureReason(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl font-semibold text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
