'use client';

import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Printer, Copy, FileText, XCircle, Truck, X, Sparkles, Check, Download, ExternalLink, LifeBuoy } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import { openPdfDocument } from '@/lib/urlUtils';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR, formatDateTime } from '@/lib/formatters';
import { resolveCourierLogo } from '@/lib/courierLogos';

export interface ShipmentRecord {
  id: string;
  awb_number: string | null;
  service_type: string;
  selected_rate: string;
  status: string;
  label_url: string | null;
  created_at: string;
  updated_at?: string;
  provider?: {
    display_name?: string;
    provider_key?: string;
  };
  courierProvider?: {
    display_name?: string;
    name?: string;
  };
  courier_name?: string;
  courier_partner?: string;
  order: {
    id: string;
    order_reference: string;
    customer_name: string;
  };
}

interface ShipmentTableProps {
  shipments: ShipmentRecord[];
  onCancel: (shipmentId: string) => void;
  selectedIds?: string[];
  onSelectChange?: (selectedIds: string[]) => void;
}

const LABEL_SIZES = [
  { id: '4x6', name: '4" × 6" Thermal Standard', desc: 'Standard thermal roll (Zebra / TSC / TVS)', badge: 'Recommended' },
  { id: '4x4', name: '4" × 4" Thermal Square', desc: 'Compact square courier label', badge: 'Thermal' },
  { id: '3x5', name: '3" × 5" Compact Thermal', desc: 'Small parcel thermal label', badge: 'Compact' },
  { id: 'a4', name: 'A4 Single Full Label', desc: 'Full page standard inkjet / laser print', badge: 'A4' },
  { id: 'a4_4in1', name: 'A4 4-in-1 Quad Grid', desc: '4 quadrant labels on 1 A4 sheet (Paper Saver)', badge: 'Economy' },
  { id: 'a4_2in1', name: 'A4 2-in-1 Dual Layout', desc: '2 half labels stacked on 1 A4 sheet', badge: 'A4 Dual' },
  { id: 'a6', name: 'A6 Standard Pocket', desc: 'A6 pocket courier document format', badge: 'A6' },
];

export function ShipmentTable({ shipments, onCancel, selectedIds = [], onSelectChange }: ShipmentTableProps) {
  const router = useRouter();
  const [activePrintShipment, setActivePrintShipment] = useState<ShipmentRecord | null>(null);
  const [selectedFormat, setSelectedFormat] = useState('4x6');
  const [generatingLabel, setGeneratingLabel] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('AWB copied to clipboard!');
  };

  const showCheckboxes = !!onSelectChange;
  const allSelected = shipments.length > 0 && selectedIds.length === shipments.length;

  const toggleAll = () => {
    if (!onSelectChange) return;
    if (allSelected) {
      onSelectChange([]);
    } else {
      onSelectChange(shipments.map((s) => s.id));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectChange) return;
    if (selectedIds.includes(id)) {
      onSelectChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectChange([...selectedIds, id]);
    }
  };

  const handleGenerateAndPrint = async (format: string) => {
    if (!activePrintShipment) return;
    const preOpenedWindow = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try {
      setGeneratingLabel(true);
      const res = await apiClient.post(`/shipments/${activePrintShipment.id}/label?format=${format}&force=true`);
      if (res.data?.success && res.data?.data?.label_url) {
        openPdfDocument(res.data.data.label_url, preOpenedWindow);
        toast.success(`Label generated in ${format.toUpperCase()} format!`);
        setActivePrintShipment(null);
      } else if (activePrintShipment.label_url) {
        openPdfDocument(activePrintShipment.label_url, preOpenedWindow);
        setActivePrintShipment(null);
      } else {
        if (preOpenedWindow && !preOpenedWindow.closed) {
          preOpenedWindow.close();
        }
        toast.error('No shipping label available to print.');
      }
    } catch (err: any) {
      // Fallback to opening current label if available
      if (activePrintShipment.label_url) {
        openPdfDocument(activePrintShipment.label_url, preOpenedWindow);
        setActivePrintShipment(null);
      } else {
        if (preOpenedWindow && !preOpenedWindow.closed) {
          preOpenedWindow.close();
        }
        toast.error(err.response?.data?.error?.message || 'Failed to generate label');
      }
    } finally {
      setGeneratingLabel(false);
    }
  };

  if (shipments.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="No shipments found"
        description="Start booking couriers for your orders to generate shipments, tracking records, and shipping labels."
        actionText="View Orders"
        actionHref="/orders"
      />
    );
  }

  return (
    <>
      <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F2ECF7] text-left">
            <thead className="bg-slate-50/75 font-bold text-[#534F66] uppercase tracking-wider text-xs">
              <tr>
                {showCheckboxes && (
                  <th className="px-6 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-[#E8DEF2] text-[#5B069A] focus:ring-[#5B069A] cursor-pointer h-4 w-4 bg-white"
                    />
                  </th>
                )}
                <th className="px-6 py-4">AWB & Courier Partner</th>
                <th className="px-6 py-4">Order & Consignee</th>
                <th className="px-6 py-4">Freight Rate</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Booking Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECF7] bg-white text-[#14121F]">
              {shipments.map((shipment) => {
                const cancellable = [
                  'created',
                  'awb_generated',
                  'pickup_scheduled',
                  'manifested',
                  'pickup_generated',
                  'processing',
                  'booked',
                  'ready_for_pickup'
                ].includes(shipment.status);
                const isSelected = selectedIds.includes(shipment.id);

                const courierName =
                  shipment.provider?.display_name ||
                  shipment.courierProvider?.display_name ||
                  shipment.courier_name ||
                  shipment.courier_partner ||
                  (shipment.service_type ? `${shipment.service_type.toUpperCase()} Express` : 'Courier Express');

                const logoSrc = resolveCourierLogo(courierName, null, shipment.service_type);

                return (
                  <tr key={shipment.id} className={`hover:bg-slate-50/70 transition ${isSelected ? 'bg-violet-50/40' : ''}`}>
                    {showCheckboxes && (
                      <td className="px-6 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(shipment.id)}
                          className="rounded border-[#E8DEF2] text-[#5B069A] focus:ring-[#5B069A] cursor-pointer h-4 w-4 bg-white"
                        />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-[#E8DEF2] p-1.5 flex items-center justify-center shrink-0 shadow-2xs">
                          <img
                            src={logoSrc}
                            alt={courierName}
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-1.5">
                            {shipment.awb_number ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E8DEF2] bg-purple-50/50 hover:bg-purple-50 hover:border-[#8410DC] transition group">
                                <Link
                                  href={`/track/${shipment.awb_number}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs font-bold text-[#5B069A] group-hover:text-[#8410DC] flex items-center gap-1"
                                  title="Track consignment live"
                                >
                                  <span>{shipment.awb_number}</span>
                                  <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 transition" />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(shipment.awb_number!)}
                                  className="text-[#7E7994] hover:text-[#5B069A] transition outline-none p-0.5 rounded cursor-pointer"
                                  title="Copy AWB"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-[#7E7994] italic bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                Awaiting AWB
                              </span>
                            )}
                          </div>
                          <span className="text-[13.5px] font-bold text-[#14121F] mt-1">
                            {courierName}
                          </span>
                          <span className="text-[11.5px] text-[#7E7994] font-medium capitalize">
                            {shipment.service_type || 'Standard'} Express
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {shipment.order ? (
                        <div>
                          <Link
                            href={`/orders/${shipment.order.id}`}
                            className="text-[#5B069A] hover:text-[#8410DC] hover:underline font-mono font-bold text-[13px] inline-flex items-center gap-1"
                          >
                            <span>#{shipment.order.order_reference}</span>
                          </Link>
                          <div className="text-[13.5px] font-bold text-[#14121F] mt-0.5">
                            {shipment.order.customer_name || 'Consignee'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#7E7994] font-medium">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 text-sm font-mono inline-block">
                        {formatINR(shipment.selected_rate)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <ShipmentStatusBadge status={shipment.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-[#534F66]">
                      <div className="font-semibold text-[#14121F] text-[12.5px]">
                        {formatDateTime(shipment.created_at)}
                      </div>
                      {shipment.updated_at && shipment.updated_at !== shipment.created_at && (
                        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[#7E7994]">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>Updated {formatDateTime(shipment.updated_at)}</span>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Link
                          href={`/shipments/${shipment.id}`}
                          className="p-2 text-[#534F66] hover:text-[#5B069A] rounded-xl hover:bg-slate-100 transition outline-none"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        <button
                          onClick={() => {
                            setActivePrintShipment(shipment);
                            setSelectedFormat('4x6');
                          }}
                          className="p-2 text-[#534F66] hover:text-[#5B069A] rounded-xl hover:bg-purple-50 transition outline-none cursor-pointer"
                          title="Print Label (Multiple Sizes)"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {cancellable && (
                          <button
                            onClick={() => onCancel(shipment.id)}
                            className="p-2 text-[#534F66] hover:text-rose-600 rounded-xl hover:bg-rose-50 transition outline-none cursor-pointer"
                            title="Cancel Booking"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            const param = shipment.awb_number
                              ? `awb=${encodeURIComponent(shipment.awb_number)}`
                              : `shipment_id=${encodeURIComponent(shipment.id)}`;
                            router.push(`/support?${param}`);
                          }}
                          className="p-2 text-[#534F66] hover:text-[#5B069A] rounded-xl hover:bg-purple-50 transition outline-none cursor-pointer"
                          title="Raise Support Ticket for this Shipment"
                        >
                          <LifeBuoy className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT LABEL MULTI-SIZE SELECTION MODAL */}
      {activePrintShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50/80 via-white to-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#5B069A] text-white flex items-center justify-center font-black shadow-xs">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Print Shipping Label
                  </h3>
                  <p className="text-xs font-mono text-slate-500">
                    AWB: {activePrintShipment.awb_number || 'PENDING'} • {activePrintShipment.order?.order_reference}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActivePrintShipment(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* NanoShipy Branding Tag */}
              <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#5B069A]" />
                  <p className="text-xs font-black text-purple-900">
                    NanoShipy Verified Label Template
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full">
                  High Precision
                </span>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  Select Print Label Size & Format:
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {LABEL_SIZES.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedFormat(s.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedFormat === s.id ? 'border-[#5B069A] bg-purple-50/50 ring-2 ring-[#5B069A]/30 font-bold' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-900">{s.name}</p>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {s.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${selectedFormat === s.id ? 'border-[#5B069A] bg-[#5B069A] text-white' : 'border-slate-300'}`}>
                        {selectedFormat === s.id && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setActivePrintShipment(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                disabled={generatingLabel}
                onClick={() => handleGenerateAndPrint(selectedFormat)}
                className="px-5 py-2.5 bg-[#5B069A] hover:bg-[#4a047d] text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-xs cursor-pointer transition"
              >
                <Download className="w-4 h-4" />
                {generatingLabel ? 'Rendering PDF...' : `Generate & Print (${selectedFormat.toUpperCase()})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
