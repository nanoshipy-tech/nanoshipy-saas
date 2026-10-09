import React, { useState } from 'react';
import Link from 'next/link';
import { Truck, Calendar, MapPin, Printer, AlertTriangle, FileText, CheckCircle2, ChevronRight, XCircle, ExternalLink } from 'lucide-react';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';
import { TrackingTimeline, TrackingData } from './TrackingTimeline';
import { apiClient } from '@/lib/apiClient';

export interface ShipmentDetail {
  id: string;
  awb_number: string | null;
  courier_shipment_id: string | null;
  service_type: string;
  selected_rate: string;
  declared_weight_kg: string;
  charged_weight_kg: string | null;
  weight_discrepancy_flag: boolean;
  is_delayed_flag: boolean;
  status: string;
  label_url: string | null;
  estimated_delivery_date: string | null;
  created_at: string;
  provider: {
    display_name: string;
    provider_key: string;
    logo_url: string | null;
  };
  pickupAddress: {
    label: string;
    contact_name: string;
    contact_phone: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  order: {
    id: string;
    order_reference: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    shipping_address_line1: string;
    shipping_address_line2: string | null;
    shipping_city: string;
    shipping_state: string;
    shipping_pincode: string;
    shipping_country: string;
    order_value: string;
    payment_mode: string;
  };
  statusHistory: Array<{
    id: string;
    old_status: string | null;
    new_status: string;
    source: string;
    note: string | null;
    created_at: string;
  }>;
}

interface ShipmentDetailPanelProps {
  shipment: ShipmentDetail;
  onCancel: () => void;
  cancelling: boolean;
  trackingData?: TrackingData | null;
}

export function ShipmentDetailPanel({ shipment, onCancel, cancelling, trackingData }: ShipmentDetailPanelProps) {
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

  const [printingLabel, setPrintingLabel] = useState(false);

  const handlePrint = async () => {
    setPrintingLabel(true);
    try {
      const res = await apiClient.post(`/shipments/${shipment.id}/label?format=4x6&force=true`);
      const url = res.data?.data?.label_url || shipment.label_url;
      if (url) window.open(url, '_blank');
    } catch {
      if (shipment.label_url) window.open(shipment.label_url, '_blank');
    } finally {
      setPrintingLabel(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <Link
          href="/shipments"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
        >
          <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
          Back to Shipments
        </Link>
      </div>

      <div className="space-y-6">
        {/* Core Shipment Hero Details Card */}
        <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-white/[0.06] pb-4 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Waybill Reference</span>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {shipment.awb_number ? (
                    <Link
                      href={`/track/${shipment.awb_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5B069A] dark:text-[#D6A8FF] hover:underline inline-flex items-center gap-1.5"
                      title="Open Live Tracking Page"
                    >
                      <span>{shipment.awb_number}</span>
                      <ExternalLink className="h-4 w-4 opacity-70" />
                    </Link>
                  ) : (
                    'Awaiting AWB Generation'
                  )}
                </h2>
                <ShipmentStatusBadge status={shipment.status} />
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handlePrint}
                disabled={printingLabel}
                className="flex items-center space-x-2 bg-white dark:bg-[#0f1117] border border-slate-250 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.02] text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition outline-none cursor-pointer disabled:opacity-60"
              >
                <Printer className="h-4 w-4 text-slate-500 dark:text-slate-455" />
                <span>{printingLabel ? 'Generating...' : 'Print Label'}</span>
              </button>

              {cancellable && (
                <button
                  disabled={cancelling}
                  onClick={onCancel}
                  className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-955/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 px-4 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 outline-none"
                >
                  <XCircle className="h-4 w-4" />
                  <span>{cancelling ? 'Cancelling...' : 'Cancel Booking'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Courier Provider</span>
              <div className="font-bold text-slate-900 dark:text-white mt-1 flex items-center space-x-2">
                <Truck className="h-4 w-4 text-[#8410DC] dark:text-[#D6A8FF]" />
                <span>{shipment.provider.display_name}</span>
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Service Type / Option</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-1 capitalize">{shipment.service_type}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Rate Charged</span>
              <div className="font-bold text-emerald-600 dark:text-emerald-450 mt-1">₹{parseFloat(shipment.selected_rate).toFixed(2)}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Estimated Delivery Date</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-1">
                {shipment.estimated_delivery_date
                  ? new Date(shipment.estimated_delivery_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Pending Pickup'}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Weight (Declared)</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-1">
                {parseFloat(shipment.declared_weight_kg || '0').toFixed(3)} kg
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Weight (Charged)</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-1">
                {shipment.charged_weight_kg ? `${parseFloat(shipment.charged_weight_kg).toFixed(3)} kg` : 'Pending Reconciliation'}
              </div>
            </div>
          </div>

          {shipment.weight_discrepancy_flag && (
            <div className="bg-amber-50 dark:bg-amber-955/15 border border-amber-250 dark:border-amber-900/40 rounded-xl p-4 flex items-center space-x-3 text-sm text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
              <span>
                <strong>Weight Discrepancy Flagged:</strong> The courier-reported actual weight differs from your declared weight. Please audit order dimensions.
              </span>
            </div>
          )}
        </div>

        {/* Origin & Destination Addresses */}
        <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-white/[0.06] pb-2 flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-[#8410DC] dark:text-[#D6A8FF]" />
            <span>Addresses</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            {/* Origin */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pickup Warehouse (Origin)</div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{shipment.pickupAddress.label}</p>
                <p className="text-slate-650 dark:text-slate-350 mt-1">{shipment.pickupAddress.address_line1}</p>
                {shipment.pickupAddress.address_line2 && <p className="text-slate-650 dark:text-slate-350">{shipment.pickupAddress.address_line2}</p>}
                <p className="text-slate-655 dark:text-slate-350">{shipment.pickupAddress.city}, {shipment.pickupAddress.state} - {shipment.pickupAddress.pincode}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Contact: {shipment.pickupAddress.contact_name} ({shipment.pickupAddress.contact_phone})
                </p>
              </div>
            </div>

            {/* Destination */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Delivery Destination</div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{shipment.order.customer_name}</p>
                <p className="text-slate-655 dark:text-slate-350 mt-1">{shipment.order.shipping_address_line1}</p>
                {shipment.order.shipping_address_line2 && <p className="text-slate-655 dark:text-slate-350">{shipment.order.shipping_address_line2}</p>}
                <p className="text-slate-655 dark:text-slate-350">{shipment.order.shipping_city}, {shipment.order.shipping_state} - {shipment.order.shipping_pincode}</p>
                <p className="text-slate-655 dark:text-slate-350">{shipment.order.shipping_country}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Contact: {shipment.order.customer_phone}
                  {shipment.order.customer_email && ` | ${shipment.order.customer_email}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Linked Order Info */}
        <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-white/[0.06] pb-2 flex items-center space-x-2">
            <FileText className="h-4 w-4 text-[#8410DC] dark:text-[#D6A8FF]" />
            <span>Linked Order Details</span>
          </h3>
          <div className="flex items-center justify-between text-sm mt-4">
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Order Reference</span>
              <div className="mt-1 font-bold text-slate-900 dark:text-white">{shipment.order.order_reference}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Order Subtotal</span>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white">₹{parseFloat(shipment.order.order_value).toFixed(2)}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Payment Mode</span>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white uppercase">{shipment.order.payment_mode}</div>
            </div>
            <div>
              <Link
                href={`/orders/${shipment.order.id}`}
                className="text-xs font-bold text-[#8410DC] dark:text-[#D6A8FF] hover:text-[#4D0582] dark:hover:text-indigo-350 hover:underline flex items-center space-x-0.5 outline-none"
              >
                <span>View Full Order</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* History timelines (Right 1 column) */}
      <div className="space-y-6">
        {/* Live Courier Tracking Timeline */}
        <TrackingTimeline
          shipmentId={shipment.id}
          initialData={trackingData || null}
        />

        {/* Internal Status History */}
        <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-white/[0.06] pb-4 mb-4">Status Transition Log</h3>
          
          {shipment.statusHistory.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic text-center py-6">No status transitions recorded yet.</p>
          ) : (
            <div className="relative border-l border-slate-200 dark:border-white/[0.06] ml-3.5 space-y-6">
              {shipment.statusHistory.map((log, index) => {
                const isFirst = index === 0;

                return (
                  <div key={log.id} className="relative pl-6">
                    {/* Timeline icon dot */}
                    <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      isFirst ? 'bg-[#8410DC] border-purple-200 dark:border-indigo-900' : 'bg-slate-100 dark:bg-slate-800 border-white dark:border-slate-900'
                    }`}>
                      {isFirst && <CheckCircle2 className="h-2 w-2 text-white" />}
                    </span>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isFirst ? 'text-[#8410DC] dark:text-[#D6A8FF]' : 'text-slate-800 dark:text-slate-200'}`}>
                          {log.new_status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-450 dark:text-slate-500">
                          {new Date(log.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {log.note && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{log.note}</p>}
                      <span className="text-[9px] text-slate-450 dark:text-slate-500 bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] px-1.5 py-0.5 rounded-md mt-1.5 inline-block font-medium">
                        Source: {log.source}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
