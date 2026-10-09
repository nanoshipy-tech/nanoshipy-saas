'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, RotateCw, AlertTriangle, FileText, CheckCircle2, ShoppingBag, Printer, X, Check, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import { exportDataToCsv } from '@/lib/exportUtils';
import { openPdfDocument } from '@/lib/urlUtils';
import { Spinner } from '@/components/ui/Spinner';
import { ShipmentTable, ShipmentRecord } from '@/components/shipments/ShipmentTable';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const PRINT_LABEL_SIZES = [
  { id: '4x6', name: '4" x 6" Thermal Roll', desc: 'Direct thermal sticker / Zebra roll (Standard)', badge: '4x6' },
  { id: 'a4', name: 'A4 Single Full Label', desc: 'Full page standard inkjet / laser print', badge: 'A4' },
  { id: 'a4_2in1', name: 'A4 2-in-1 Dual Layout', desc: '2 half labels stacked on 1 A4 sheet', badge: 'A4 Dual' },
  { id: 'a6', name: 'A6 Standard Pocket', desc: 'A6 pocket courier document format', badge: 'A6' },
];

interface SummaryData {
  awb_generated: number;
  in_transit: number;
  delivered: number;
  cancelled: number;
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    awb_generated: 0,
    in_transit: 0,
    delivered: 0,
    cancelled: 0,
  });

  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Selection & Bulk actions state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [bulkFormatModalOpen, setBulkFormatModalOpen] = useState(false);
  const [bulkFormat, setBulkFormat] = useState('4x6');
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await apiClient.get('/shipments/summary');
      if (res?.data?.data) {
        setSummary({
          awb_generated: Number(res.data.data.awb_generated ?? res.data.data.created ?? 0),
          in_transit: Number(res.data.data.in_transit ?? res.data.data.picked_up ?? 0),
          delivered: Number(res.data.data.delivered ?? 0),
          cancelled: Number(res.data.data.cancelled ?? res.data.data.failed ?? 0),
        });
      }
    } catch (err) {
      console.error('Failed to load shipment summary statistics:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (status) params.status = status;
      if (search) params.search = search;

      const res = await apiClient.get('/shipments', { params });
      setShipments(res?.data?.data?.rows || []);
      setTotalPages(res?.data?.data?.pagination?.totalPages || 1);
      setSelectedIds([]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load shipments list');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    fetchShipments();
    fetchSummary();
  }, [fetchShipments]);

  const handleCancelShipment = (shipmentId: string) => {
    setCancelModal({ isOpen: true, id: shipmentId });
  };

  const confirmCancelShipment = async () => {
    if (!cancelModal.id) return;
    setIsCancelling(true);
    try {
      await apiClient.put(`/shipments/${cancelModal.id}/cancel`);
      toast.success('Shipment successfully cancelled');
      setCancelModal({ isOpen: false });
      fetchShipments();
      fetchSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel shipment');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchShipments();
  };

  const handleBulkLabelGenerate = async (formatToUse = bulkFormat) => {
    if (selectedIds.length === 0) return;
    const preOpenedWindow = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    setGeneratingBulk(true);
    try {
      const response = await apiClient.post('/shipments/bulk-label', {
        shipment_ids: selectedIds,
        format: formatToUse,
      });
      if (response.data && response.data.success) {
        const url = response.data.data.label_url;
        openPdfDocument(url, preOpenedWindow);
        toast.success(`Generated ${selectedIds.length} bulk labels in ${formatToUse.toUpperCase()} format`);
        setSelectedIds([]);
        setBulkFormatModalOpen(false);
      } else {
        if (preOpenedWindow && !preOpenedWindow.closed) {
          preOpenedWindow.close();
        }
        toast.error(response.data?.error?.message || 'Failed to generate bulk labels');
      }
    } catch (err: any) {
      if (preOpenedWindow && !preOpenedWindow.closed) {
        preOpenedWindow.close();
      }
      console.error('Bulk label generation error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to generate bulk labels');
    } finally {
      setGeneratingBulk(false);
    }
  };

  const handleExportShipments = () => {
    if (!shipments || shipments.length === 0) {
      toast.error('No shipments available to export.');
      return;
    }
    const cols = [
      { key: 'awb_number', header: 'AWB Number' },
      { key: 'order_reference', header: 'Order Reference' },
      { key: 'courier_name', header: 'Courier Provider' },
      { key: 'consignee_name', header: 'Consignee Name' },
      { key: 'destination_city', header: 'Destination City' },
      { key: 'destination_state', header: 'Destination State' },
      { key: 'destination_pincode', header: 'Pincode' },
      { key: 'payment_mode', header: 'Payment Mode' },
      { key: 'status', header: 'Status' },
      { key: 'created_at', header: 'Created Date' },
    ];
    exportDataToCsv(`nanoshipy_shipments_${new Date().toISOString().substring(0, 10)}.csv`, cols, shipments);
  };

  return (
    <div className="space-y-[14px]">
      {/* 4 KPI Cards: Active, Delivered today, In transit, Needs action */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px]">
        {/* Active */}
        <div
          onClick={() => { setStatus('awb_generated'); setPage(1); }}
          className={`nano-card flex flex-col justify-between cursor-pointer transition-colors ${
            status === 'awb_generated' ? 'ring-2 ring-[var(--brand)]' : ''
          }`}
        >
          <div className="nano-kpi-label">Active</div>
          <div className="nano-kpi-value my-1.5">
            {summaryLoading ? '...' : (summary?.awb_generated ?? 0)}
          </div>
          <div className="text-[12px] text-[var(--muted)]">Ready for courier dispatch</div>
        </div>

        {/* Delivered today */}
        <div
          onClick={() => { setStatus('delivered'); setPage(1); }}
          className={`nano-card flex flex-col justify-between cursor-pointer transition-colors ${
            status === 'delivered' ? 'ring-2 ring-[var(--brand)]' : ''
          }`}
        >
          <div className="nano-kpi-label">Delivered today</div>
          <div className="nano-kpi-value my-1.5 text-[var(--ok)]">
            {summaryLoading ? '...' : (summary?.delivered ?? 0)}
          </div>
          <div className="text-[12px] text-[var(--muted)]">Successfully handed over</div>
        </div>

        {/* In transit */}
        <div
          onClick={() => { setStatus('in_transit'); setPage(1); }}
          className={`nano-card flex flex-col justify-between cursor-pointer transition-colors ${
            status === 'in_transit' ? 'ring-2 ring-[var(--brand)]' : ''
          }`}
        >
          <div className="nano-kpi-label">In transit</div>
          <div className="nano-kpi-value my-1.5 text-[var(--info)]">
            {summaryLoading ? '...' : (summary?.in_transit ?? 0)}
          </div>
          <div className="text-[12px] text-[var(--muted)]">Active checkpoint transit</div>
        </div>

        {/* Needs action */}
        <div
          onClick={() => { setStatus('cancelled'); setPage(1); }}
          className={`nano-card flex flex-col justify-between cursor-pointer transition-colors ${
            status === 'cancelled' ? 'ring-2 ring-[var(--brand)]' : ''
          }`}
        >
          <div className="nano-kpi-label">Needs action</div>
          <div className="nano-kpi-value my-1.5 text-[var(--bad)]">
            {summaryLoading ? '...' : (summary?.cancelled ?? 0)}
          </div>
          <div className="text-[12px] text-[var(--muted)]">Exceptions & cancelled</div>
        </div>
      </div>

      {/* Segmented Filter Pills & Search */}
      <div className="nano-card flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="nano-segmented overflow-x-auto" role="group" aria-label="Shipment status tabs">
          {[
            { id: '', label: 'All shipments', count: (summary?.awb_generated ?? 0) + (summary?.in_transit ?? 0) + (summary?.delivered ?? 0) + (summary?.cancelled ?? 0) },
            { id: 'awb_generated', label: 'Active', count: summary?.awb_generated ?? 0 },
            { id: 'in_transit', label: 'In transit', count: summary?.in_transit ?? 0 },
            { id: 'delivered', label: 'Delivered', count: summary?.delivered ?? 0 },
            { id: 'cancelled', label: 'Cancelled', count: summary?.cancelled ?? 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatus(tab.id);
                setPage(1);
              }}
              aria-pressed={status === tab.id}
              className="nano-segmented-item flex items-center gap-1.5"
            >
              <span>{tab.label}</span>
              <span className="text-[11px] tabular-nums font-normal opacity-80">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:max-w-sm">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Filter by AWB or consignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nano-input pl-9 pr-7 text-[13px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button type="submit" className="nano-btn-secondary py-2 text-[13px]">
            Filter
          </button>
          <button
            type="button"
            onClick={handleExportShipments}
            className="nano-btn-secondary py-2 text-[13px] flex items-center gap-1.5 shrink-0"
            title="Download shipments as CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#8410DC]" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </form>
      </div>

      {/* Main Table Card */}
      <div className="nano-card">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <Spinner className="h-7 w-7 text-[var(--brand)]" />
            <p className="text-[12.5px] text-[var(--muted)]">Loading shipment records...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-[10px] text-[13px]" style={{ backgroundColor: 'var(--bad-bg)', color: 'var(--bad)' }}>
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Bulk actions bar if items are selected */}
            {selectedIds.length > 0 && (
              <div
                className="rounded-[10px] p-3 flex items-center justify-between"
                style={{ backgroundColor: 'var(--sidebar)', color: '#ffffff' }}
              >
                <span className="text-[13px] font-semibold">
                  {selectedIds.length} shipment{selectedIds.length > 1 ? 's' : ''} selected
                </span>
                <button
                  type="button"
                  onClick={() => setBulkFormatModalOpen(true)}
                  className="nano-btn-primary py-1.5 px-3 text-[12.5px]"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print labels
                </button>
              </div>
            )}

            <ShipmentTable
              shipments={shipments}
              onCancel={handleCancelShipment}
              selectedIds={selectedIds}
              onSelectChange={setSelectedIds}
            />

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
                <span className="text-[12.5px] text-[var(--muted)] tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="nano-btn-secondary py-1 px-3 text-[12px] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="nano-btn-secondary py-1 px-3 text-[12px] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Format Print Modal */}
      {bulkFormatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="nano-card w-full max-w-md shadow-xl">
            <h3 className="nano-card-title mb-1">Print shipping labels</h3>
            <p className="nano-card-subtitle mb-3">Choose standard thermal roll or desktop sheet layout:</p>
            <div className="space-y-2 mb-4">
              {PRINT_LABEL_SIZES.map((size) => (
                <div
                  key={size.id}
                  onClick={() => setBulkFormat(size.id)}
                  className={`p-3 rounded-[10px] border flex items-center justify-between cursor-pointer transition ${
                    bulkFormat === size.id ? 'border-[var(--brand)] bg-[var(--brand-soft)]/20' : 'border-[var(--line)]'
                  }`}
                >
                  <div>
                    <div className="text-[13px] font-bold text-[var(--ink)]">{size.name}</div>
                    <div className="text-[11.5px] text-[var(--muted)]">{size.desc}</div>
                  </div>
                  <span className="nano-pill nano-pill-muted">{size.badge}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkFormatModalOpen(false)}
                className="nano-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generatingBulk}
                onClick={() => handleBulkLabelGenerate()}
                className="nano-btn-primary"
              >
                {generatingBulk ? 'Generating...' : `Print ${selectedIds.length} labels`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={cancelModal.isOpen}
        title="Cancel shipment"
        message="Are you sure you want to cancel this consignment? The linked order will revert back to ready-to-ship status."
        confirmText={isCancelling ? 'Cancelling...' : 'Confirm cancellation'}
        onConfirm={confirmCancelShipment}
        onClose={() => setCancelModal({ isOpen: false })}
      />
    </div>
  );
}
