'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';
import { NdrTable, NdrRecord } from '@/components/ndr/NdrTable';
import { BulkNdrActionBar } from '@/components/ndr/BulkNdrActionBar';
import { RotateCw, AlertTriangle, ShieldAlert, Users, Phone, MapPin, Search } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface SummaryData {
  total_open: number;
  by_reason: {
    CUSTOMER_UNAVAILABLE: number;
    ADDRESS_INCORRECT: number;
    CUSTOMER_REFUSED: number;
    COD_NOT_READY: number;
    OTHER: number;
  };
  aging_over_sla: number;
}

export default function NdrPage() {
  const [ndrEvents, setNdrEvents] = useState<NdrRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    total_open: 0,
    by_reason: { CUSTOMER_UNAVAILABLE: 0, ADDRESS_INCORRECT: 0, CUSTOMER_REFUSED: 0, COD_NOT_READY: 0, OTHER: 0 },
    aging_over_sla: 0,
  });

  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [status, setStatus] = useState<string>('open');
  const [reasonCode, setReasonCode] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await apiClient.get('/ndr/summary');
      setSummary(res.data.data);
    } catch (err) {
      console.error('Failed to load NDR summary statistics:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchNdrEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        status: status || undefined,
        reason_code: reasonCode || undefined,
        page,
        limit: 10,
      };

      const res = await apiClient.get('/ndr', { params });
      setNdrEvents(res.data.data.rows);
      setTotalPages(res.data.data.pagination.totalPages);
      setSelectedIds([]); // Clear selection when list page changes
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load NDR exceptions list');
    } finally {
      setLoading(false);
    }
  }, [status, reasonCode, page]);

  useEffect(() => {
    fetchNdrEvents();
    fetchSummary();
  }, [fetchNdrEvents]);

  const handleBulkAction = async (actionType: 'reattempt' | 'mark_rto', notes: string) => {
    setActionLoading(true);
    try {
      const res = await apiClient.post('/ndr/bulk-action', {
        ndr_ids: selectedIds,
        action_type: actionType,
        notes,
      });

      const { processed, failed } = res.data.data;
      if (failed === 0) {
        toast.success(`Successfully processed ${processed} exceptions in bulk!`);
      } else {
        toast.error(`Processed: ${processed}, Failed: ${failed} exceptions.`);
      }

      fetchNdrEvents();
      fetchSummary();
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to execute bulk action');
    } finally {
      setActionLoading(false);
    }
  };

  const statusOptions = [
    { label: 'All exceptions', value: '' },
    { label: 'Open', value: 'open' },
    { label: 'Action taken', value: 'action_taken' },
    { label: 'Delivered', value: 'resolved_delivered' },
    { label: 'RTO', value: 'resolved_rto' },
  ];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="nano-page-title">Delivery issues (NDR)</h1>
          <p className="nano-page-subtitle">Non-delivery reports requiring merchant action to prevent RTO.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchNdrEvents(); fetchSummary(); }}
            className="nano-btn-secondary inline-flex items-center gap-1.5"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Spec KPI Cards: Open, Unreachable, Wrong address, Refused */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Open */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Open</span>
            <span className="nano-pill nano-pill-bad">Action needed</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">
              {summaryLoading ? '...' : (summary.total_open ?? 0).toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">
              {summary.aging_over_sla > 0 ? `${summary.aging_over_sla} over SLA` : 'Pending courier update'}
            </div>
          </div>
        </div>

        {/* Unreachable */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Unreachable</span>
            <span className="nano-pill nano-pill-warn">Call required</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">
              {summaryLoading ? '...' : (summary.by_reason?.CUSTOMER_UNAVAILABLE ?? 0).toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Customer phone unanswered</div>
          </div>
        </div>

        {/* Wrong address */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Wrong address</span>
            <span className="nano-pill nano-pill-bad">Needs update</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">
              {summaryLoading ? '...' : (summary.by_reason?.ADDRESS_INCORRECT ?? 0).toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Pincode or street incorrect</div>
          </div>
        </div>

        {/* Refused */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Refused</span>
            <span className="nano-pill nano-pill-bad">High RTO risk</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">
              {summaryLoading ? '...' : (summary.by_reason?.CUSTOMER_REFUSED ?? 0).toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Refused by consignee</div>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="nano-card flex flex-wrap items-center justify-between gap-3 !py-3">
        {/* Status segmented tab buttons */}
        <div className="nano-segmented flex-wrap">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatus(opt.value); setPage(1); }}
              className={`nano-segmented-btn ${status === opt.value ? 'active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Reason code filter */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--muted)] font-medium">Reason:</span>
          <select
            value={reasonCode}
            onChange={(e) => { setReasonCode(e.target.value); setPage(1); }}
            className="text-[12px] font-medium border border-[var(--line)] rounded-lg px-3 py-1.5 bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand)] cursor-pointer"
          >
            <option value="">All reasons</option>
            <option value="CUSTOMER_UNAVAILABLE">Customer Unavailable</option>
            <option value="ADDRESS_INCORRECT">Wrong Address</option>
            <option value="CUSTOMER_REFUSED">Customer Refused</option>
            <option value="COD_NOT_READY">COD Cash Not Ready</option>
            <option value="OTHER">Other Issues</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="nano-card !border-[var(--bad)] text-[var(--bad)] text-[13px] !p-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="nano-card flex justify-center items-center py-20">
          <Spinner className="h-7 w-7 text-[var(--brand)]" />
        </div>
      ) : (
        <>
          <NdrTable
            ndrEvents={ndrEvents}
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="nano-card flex items-center justify-between !py-3">
              <p className="text-[12px] text-[var(--muted)]">
                Page <span className="font-semibold text-[var(--ink)]">{page}</span> of <span className="font-semibold text-[var(--ink)]">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="nano-btn-secondary !py-1 !px-3 !text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="nano-btn-secondary !py-1 !px-3 !text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Action Bar */}
      <BulkNdrActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        onBulkAction={handleBulkAction}
        loading={actionLoading}
      />
    </div>
  );
}
