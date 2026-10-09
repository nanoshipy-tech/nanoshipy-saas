'use client';

import React, { useState } from 'react';
import {
  X,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Printer,
  RotateCcw,
  Sparkles,
  MapPin,
  Globe,
  Check,
  Package,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { openPdfDocument, resolveAssetUrl } from '@/lib/urlUtils';
import toast from 'react-hot-toast';

interface BulkCourierAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrderIds: string[];
  onSuccess: () => void;
}

interface SuccessfulItem {
  order_id: string;
  order_reference: string;
  provider_key: string;
  courier_name: string;
  service_type: string;
  district?: string;
  awb_number: string;
  shipment_id: string;
  label_url?: string;
  status: string;
}

interface FailedItem {
  order_id: string;
  order_reference: string;
  provider_key?: string;
  reason: string;
}

interface SkippedItem {
  order_id: string;
  order_reference: string;
  awb_number?: string;
  courier_name?: string;
  reason: string;
}

interface AllocationResult {
  total: number;
  allocated_count: number;
  failed_count: number;
  skipped_count: number;
  breakdown: {
    st_courier: number;
    shipway: number;
  };
  successful: SuccessfulItem[];
  failed: FailedItem[];
  skipped: SkippedItem[];
}

export const BulkCourierAllocationModal: React.FC<BulkCourierAllocationModalProps> = ({
  isOpen,
  onClose,
  selectedOrderIds,
  onSuccess,
}) => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AllocationResult | null>(null);
  const [printingLabels, setPrintingLabels] = useState(false);
  const [downloadableLabelUrl, setDownloadableLabelUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartAllocation = async () => {
    if (selectedOrderIds.length === 0) return;
    setProcessing(true);
    setResult(null);

    try {
      const res = await apiClient.post('/orders/bulk-allocate-courier', {
        order_ids: selectedOrderIds,
      });

      if (res.data?.success && res.data?.data) {
        const data: AllocationResult = res.data.data;
        setResult(data);

        if (data.allocated_count > 0) {
          toast.success(`Successfully allocated & dispatched ${data.allocated_count} orders!`);
        } else {
          toast.error('No orders could be allocated. Please check error details.');
        }
      } else {
        toast.error('Unexpected response from bulk allocation server.');
      }
    } catch (err: any) {
      console.error('Bulk courier allocation error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to allocate couriers in bulk.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintAllLabels = async () => {
    if (!result || result.successful.length === 0) return;
    const shipmentIds = result.successful
      .map((s) => s.shipment_id)
      .filter(Boolean);

    if (shipmentIds.length === 0) {
      toast.error('No shipment IDs available to print labels.');
      return;
    }

    // Pre-open blank tab synchronously in user click gesture to prevent browser popup blockers!
    const preOpenedWindow = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;

    setPrintingLabels(true);
    try {
      const res = await apiClient.post('/shipments/bulk-label', {
        shipment_ids: shipmentIds,
        format: '4x6',
      });

      const labelUrl = res.data?.data?.label_url || res.data?.data?.pdf_url || res.data?.data?.url;
      if (res.data?.success && labelUrl) {
        setDownloadableLabelUrl(labelUrl);
        openPdfDocument(labelUrl, preOpenedWindow);
        toast.success(`Opened merged shipping labels PDF for ${shipmentIds.length} orders!`);
      } else {
        if (preOpenedWindow && !preOpenedWindow.closed) {
          preOpenedWindow.close();
        }
        toast.error(res.data?.error?.message || 'Failed to generate shipping labels PDF.');
      }
    } catch (err: any) {
      if (preOpenedWindow && !preOpenedWindow.closed) {
        preOpenedWindow.close();
      }
      console.error('Print all labels error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to print merged labels.');
    } finally {
      setPrintingLabels(false);
    }
  };

  const handleFinishAndClose = () => {
    onClose();
    if (result && result.allocated_count > 0) {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-[#1e1738] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5B069A] to-[#8410DC] flex items-center justify-center shadow-lg shadow-purple-900/30">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Bulk Courier Allocation & Dispatch
              </h3>
              <p className="text-xs text-slate-300">
                Automatic intelligent routing: ST Courier (Intra-TN) & Shipway (Rest of India)
              </p>
            </div>
          </div>
          <button
            disabled={processing}
            onClick={handleFinishAndClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: Confirmation / Pre-Dispatch Info */}
          {!result && (
            <>
              {/* Routing Policy Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/60 flex flex-col justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg bg-[#5B069A] text-white shrink-0 shadow-sm">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#14121F]">Tamil Nadu Intra-State</h4>
                      <p className="text-xs text-[#534F66] mt-0.5 leading-relaxed">
                        Orders where both origin and destination are in Tamil Nadu.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-100/80 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-purple-900 uppercase tracking-wide">
                      Assigned Courier:
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#5B069A] bg-white px-2.5 py-1 rounded-md border border-purple-200">
                      <Sparkles className="h-3 w-3 text-amber-500" /> ST Courier
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/60 flex flex-col justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 shadow-sm">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#14121F]">Rest of India / Interstate</h4>
                      <p className="text-xs text-[#534F66] mt-0.5 leading-relaxed">
                        Interstate shipments or Tamil Nadu addresses outside ST coverage.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-100/80 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-blue-900 uppercase tracking-wide">
                      Assigned Courier:
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200">
                      <Sparkles className="h-3 w-3 text-amber-500" /> National Multi-Carrier Fleet
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Count Notification */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {selectedOrderIds.length}
                  </span>
                  <div>
                    <div className="font-bold text-sm text-[#14121F]">
                      {selectedOrderIds.length} Orders Selected for Bulk Dispatch
                    </div>
                    <div className="text-xs text-slate-500">
                      AWBs will be allocated automatically and orders moved to Ready to Ship.
                    </div>
                  </div>
                </div>
              </div>

              {/* Loading State Spinner */}
              {processing && (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
                  <div className="w-10 h-10 border-3 border-purple-200 border-t-[#5B069A] rounded-full animate-spin" />
                  <div className="font-bold text-sm text-slate-800">
                    Allocating couriers, verifying serviceability & generating AWBs...
                  </div>
                  <div className="text-xs text-slate-400">
                    Please do not close this window or navigate away.
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 2: Post-Dispatch Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Total</div>
                  <div className="text-xl font-extrabold text-slate-800 mt-0.5">{result.total}</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-center">
                  <div className="text-[11px] font-semibold text-purple-700 uppercase">ST Courier (TN)</div>
                  <div className="text-xl font-extrabold text-[#5B069A] mt-0.5">
                    {result.breakdown.st_courier}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <div className="text-[11px] font-semibold text-blue-700 uppercase">National Network</div>
                  <div className="text-xl font-extrabold text-blue-700 mt-0.5">
                    {result.breakdown.shipway}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase">Successful</div>
                  <div className="text-xl font-extrabold text-emerald-600 mt-0.5">
                    {result.allocated_count}
                  </div>
                </div>
              </div>

              {/* Downloadable Label Banner */}
              {downloadableLabelUrl && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-2 text-xs">
                  <span className="text-purple-900 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-purple-600" />
                    Combined 4x6 labels ready for printing.
                  </span>
                  <a
                    href={resolveAssetUrl(downloadableLabelUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#5B069A] hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <Printer className="h-3.5 w-3.5" /> Open Labels PDF
                  </a>
                </div>
              )}

              {/* Successful Shipments List */}
              {result.successful.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/20 overflow-hidden">
                  <div className="px-4 py-2.5 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between text-xs font-semibold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Dispatched Successfully ({result.successful.length})
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-emerald-100/60 text-xs">
                    {result.successful.map((item) => (
                      <div
                        key={item.order_id}
                        className="px-4 py-2.5 flex items-center justify-between hover:bg-white/60 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Package className="h-4 w-4 text-slate-400" />
                          <div>
                            <span className="font-bold text-slate-800">
                              Ref: {item.order_reference}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {item.courier_name} {item.district ? `(${item.district})` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                            AWB: {item.awb_number}
                          </span>
                          {item.label_url && (
                            <button
                              type="button"
                              onClick={() => openPdfDocument(item.label_url)}
                              className="p-1 rounded bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer shadow-xs"
                              title="Open Label PDF"
                            >
                              <Printer className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failures or Warnings */}
              {result.failed.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/30 overflow-hidden">
                  <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center gap-1.5 text-xs font-semibold text-rose-900">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    Failed to Dispatch ({result.failed.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-rose-100 text-xs p-2 space-y-1">
                    {result.failed.map((fail, idx) => (
                      <div key={idx} className="p-2 bg-white rounded-lg border border-rose-100 text-rose-800">
                        <span className="font-bold">{fail.order_reference}: </span>
                        <span>{fail.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped Orders */}
              {result.skipped.length > 0 && (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-700">
                    Skipped Orders ({result.skipped.length}):
                  </div>
                  {result.skipped.map((s, idx) => (
                    <div key={idx} className="text-[11px] text-slate-500">
                      • <span className="font-medium text-slate-700">{s.order_reference}:</span> {s.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {!result ? (
            <>
              <button
                disabled={processing}
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={processing || selectedOrderIds.length === 0}
                onClick={handleStartAllocation}
                className="px-5 py-2.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4b0580] hover:to-[#6f0dba] text-white font-bold text-xs rounded-xl shadow-md shadow-purple-900/20 active:scale-[0.98] transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Confirm & Dispatch {selectedOrderIds.length} Orders</span>
              </button>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-500 font-medium">
                {result.allocated_count > 0 ? 'Dispatched and updated in real time' : 'Review errors above'}
              </div>
              <div className="flex items-center gap-2">
                {result.allocated_count > 0 && (
                  <button
                    disabled={printingLabels}
                    onClick={handlePrintAllLabels}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-sm active:scale-[0.98] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>{printingLabels ? 'Generating Labels...' : `Print All Labels (${result.allocated_count})`}</span>
                  </button>
                )}
                <button
                  onClick={handleFinishAndClose}
                  className="px-4 py-2 bg-[#14121F] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm active:scale-[0.98] transition cursor-pointer"
                >
                  Done & Refresh
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
