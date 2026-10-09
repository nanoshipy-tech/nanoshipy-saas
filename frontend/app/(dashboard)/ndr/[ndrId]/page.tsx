'use client';

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';
import { NdrActionPanel } from '@/components/ndr/NdrActionPanel';
import { NdrReasonBadge } from '@/components/ndr/NdrReasonBadge';
import {
  ArrowLeft, Calendar, User, Phone, Mail, MapPin, Truck, HelpCircle,
  AlertTriangle, CheckCircle, ClipboardList
} from 'lucide-react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';

interface NdrActionLog {
  id: string;
  action_type: string;
  notes: string | null;
  updated_address_line1: string | null;
  updated_phone: string | null;
  created_at: string;
  performer: {
    name: string;
    email: string;
  };
}

interface NdrDetail {
  id: string;
  reason_code: string;
  raw_reason: string;
  attempt_number: number;
  status: 'open' | 'action_taken' | 'resolved_delivered' | 'resolved_rto';
  sla_due_at: string;
  created_at: string;
  shipment: {
    id: string;
    awb_number: string | null;
    status: string;
    provider: {
      display_name: string;
    };
    order: {
      order_reference: string;
      customer_name: string;
      customer_phone: string;
      customer_email: string;
      shipping_address_line1: string;
      shipping_address_line2: string;
      shipping_city: string;
      shipping_state: string;
      shipping_pincode: string;
      shipping_country: string;
    };
  };
  actions: NdrActionLog[];
}

const ACTION_LABELS: Record<string, string> = {
  reattempt: 'Reattempt Requested',
  update_address: 'Address Corrected',
  update_phone: 'Phone Number Updated',
  mark_rto: 'RTO Return Initiated',
  call_customer: 'Customer Contacted',
  no_action: 'No Action Taken Logged',
};

export default function NdrDetailPage() {
  const { ndrId } = useParams() as { ndrId: string };
  const router = useRouter();
  const [ndr, setNdr] = useState<NdrDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNdrDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/ndr/${ndrId}`);
      setNdr(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to retrieve NDR details');
    } finally {
      setLoading(false);
    }
  }, [ndrId]);

  useEffect(() => {
    fetchNdrDetails();
  }, [fetchNdrDetails]);

  const handleActionSubmit = async (actionData: any) => {
    setActionLoading(true);
    try {
      await apiClient.post(`/ndr/${ndrId}/action`, actionData);
      toast.success('Operational directive transmitted successfully!');
      fetchNdrDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to transmit action');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-[#8410DC]" />
      </div>
    );
  }

  if (error || !ndr) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-lg mx-auto mt-12">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-red-800">Failed to Load Details</h3>
        <p className="text-xs text-red-600 mt-1">{error || 'NDR exception event could not be found.'}</p>
        <Link
          href="/ndr"
          className="mt-4 inline-flex items-center space-x-1.5 text-xs text-[#8410DC] hover:text-[#4D0582] font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to NDR list</span>
        </Link>
      </div>
    );
  }

  const isClosed = ['resolved_delivered', 'resolved_rto'].includes(ndr.status);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header breadcrumbs */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/ndr"
            className="p-2 border rounded-xl hover:bg-gray-50 transition"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-gray-900">NDR Exception Details</h1>
              <NdrReasonBadge reasonCode={ndr.reason_code} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              AWB: <span className="font-mono font-semibold">{ndr.shipment.awb_number}</span> · Courier: {ndr.shipment.provider.display_name}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400">Attempt Count: </span>
          <span className="text-sm font-black text-gray-800">{ndr.attempt_number}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details & Action (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Shipment & Customer Info Card */}
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-3 flex items-center space-x-2">
              <Truck className="h-4 w-4 text-[#8410DC]" />
              <span>Consignment & Delivery Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs text-gray-600">
              {/* Customer */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Receiver Information</p>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="font-semibold text-gray-800">{ndr.shipment.order.customer_name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{ndr.shipment.order.customer_phone}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="truncate">{ndr.shipment.order.customer_email}</span>
                </div>
              </div>

              {/* Destination address */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Delivery Destination</p>
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <p className="font-medium text-gray-800">{ndr.shipment.order.shipping_address_line1}</p>
                    {ndr.shipment.order.shipping_address_line2 && <p>{ndr.shipment.order.shipping_address_line2}</p>}
                    <p>
                      {ndr.shipment.order.shipping_city}, {ndr.shipment.order.shipping_state} - {ndr.shipment.order.shipping_pincode}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{ndr.shipment.order.shipping_country}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border rounded-xl p-4 mt-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Courier Exception Remark</p>
              <p className="text-xs text-slate-700 mt-1.5 leading-relaxed italic">
                "{ndr.raw_reason}"
              </p>
            </div>
          </div>

          {/* Action form */}
          {isClosed ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
              <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-emerald-800">Exception Resolved</h3>
              <p className="text-xs text-emerald-600 max-w-sm mx-auto">
                This NDR exception is closed. The consignment has been successfully resolved via:
                <strong className="block mt-1 uppercase text-xs">{ndr.status.replace('_', ' ')}</strong>
              </p>
            </div>
          ) : (
            <NdrActionPanel
              onActionSubmit={handleActionSubmit}
              loading={actionLoading}
            />
          )}

        </div>

        {/* Right Column: Historical Logs (1 Col) */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-4 mb-4 flex items-center space-x-2">
              <ClipboardList className="h-4 w-4 text-[#8410DC]" />
              <span>Operational History Log</span>
            </h3>

            {ndr.actions.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-8">
                No corrective actions logged yet. Input a directive to attempt resolve.
              </p>
            ) : (
              <div className="relative border-l border-gray-200 ml-3.5 space-y-6">
                {ndr.actions.map((act) => (
                  <div key={act.id} className="relative pl-6">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#8410DC] ring-4 ring-blue-50" />
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-800">
                          {ACTION_LABELS[act.action_type] || act.action_type}
                        </span>
                        <span className="text-[9px] text-gray-400">
                          {new Date(act.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      
                      {act.notes && (
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                          "{act.notes}"
                        </p>
                      )}

                      {act.updated_address_line1 && (
                        <div className="mt-1.5 text-[10px] bg-slate-50 border p-1.5 rounded-lg text-slate-600 leading-normal">
                          <strong className="block text-[9px] uppercase tracking-wider text-[#534F66] font-bold mb-0.5">Updated Address:</strong>
                          {act.updated_address_line1}
                        </div>
                      )}

                      {act.updated_phone && (
                        <div className="mt-1.5 text-[10px] bg-slate-50 border p-1.5 rounded-lg text-slate-600 leading-normal">
                          <strong className="block text-[9px] uppercase tracking-wider text-[#534F66] font-bold mb-0.5">Updated Phone:</strong>
                          {act.updated_phone}
                        </div>
                      )}

                      <span className="text-[9px] text-gray-400 mt-1 inline-block">
                        Performed by: {act.performer.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
