'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';
import { RtoTable, RtoRecordData } from '@/components/rto/RtoTable';
import { RotateCw, ArrowLeftRight, Search } from 'lucide-react';

export default function RtoPage() {
  const [rtoRecords, setRtoRecords] = useState<RtoRecordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination (Fix #35)
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchRtoRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        status: status || undefined,
        page,
        limit,
      };

      const res = await apiClient.get('/rto', { params });
      setRtoRecords(res.data.data.rows || []);
      const pag = res.data.data.pagination;
      if (pag) {
        setTotalPages(pag.totalPages || 1);
        setTotalCount(pag.total || 0);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load RTO returns list');
    } finally {
      setLoading(false);
    }
  }, [status, page, limit]);

  useEffect(() => {
    fetchRtoRecords();
  }, [fetchRtoRecords]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const statusTabs = [
    { label: 'All returns', value: '' },
    { label: 'Initiated', value: 'rto_initiated' },
    { label: 'In transit', value: 'rto_in_transit' },
    { label: 'Delivered to origin', value: 'rto_delivered' },
    { label: 'Lost', value: 'rto_lost' },
  ];

  const inTransitCount = rtoRecords.filter(r => r.status === 'rto_in_transit').length;
  const deliveredCount = rtoRecords.filter(r => r.status === 'rto_delivered').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="nano-page-title">Returns & RTO tracking</h1>
          <p className="nano-page-subtitle">Track and manage reverse consignments returning to origin warehouse.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRtoRecords}
            className="nano-btn-secondary inline-flex items-center gap-1.5"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Total RTO</span>
            <span className="nano-pill nano-pill-warn">Reverse</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">{loading ? '...' : totalCount}</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Total reverse consignments</div>
          </div>
        </div>

        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">In transit</span>
            <span className="nano-pill nano-pill-brand">On route</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value text-[var(--brand)]">{loading ? '...' : inTransitCount}</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Returning to warehouse</div>
          </div>
        </div>

        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Delivered</span>
            <span className="nano-pill nano-pill-ok">Restocked</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value text-[var(--ok)]">{loading ? '...' : deliveredCount}</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Received at origin hub</div>
          </div>
        </div>

        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Return loss</span>
            <span className="nano-pill nano-pill-ok">&lt; 0.5%</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">0</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Zero unrecovered losses</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="nano-card flex flex-wrap items-center justify-between gap-3 !py-3">
        <div className="nano-segmented flex-wrap">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatus(tab.value); setPage(1); }}
              className={`nano-segmented-btn ${status === tab.value ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="text-[12px] font-medium border border-[var(--line)] rounded-lg px-2.5 py-1 bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand)] cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
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
          <RtoTable rtoRecords={rtoRecords} />

          {/* Pagination */}
          <div className="nano-card flex flex-col sm:flex-row items-center justify-between !py-3 gap-3">
            <p className="text-[12px] text-[var(--muted)]">
              Showing <strong className="text-[var(--ink)]">{rtoRecords.length}</strong> of <strong className="text-[var(--ink)]">{totalCount}</strong> returns (Page {page} of {totalPages})
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="nano-btn-secondary !py-1 !px-3 !text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="nano-btn-secondary !py-1 !px-3 !text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
