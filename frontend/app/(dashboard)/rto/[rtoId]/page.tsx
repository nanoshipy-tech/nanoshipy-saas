'use client';

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';
import { RtoStatusBadge } from '@/components/rto/RtoStatusBadge';
import {
  ArrowLeft, Calendar, User, ShieldAlert, Award, FileText, CheckCircle,
  Truck, ArrowRight, Clipboard, HelpCircle, PackageOpen
} from 'lucide-react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';

interface RtoDetail {
  id: string;
  initiated_reason: string;
  initiated_by: 'manual' | 'auto_ndr_threshold' | 'courier_initiated';
  status: string;
  rto_awb_number: string | null;
  received_at_warehouse_at: string | null;
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
      shipping_address_line1: string;
      shipping_city: string;
      shipping_state: string;
      shipping_pincode: string;
    };
  };
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual Action',
  auto_ndr_threshold: 'Auto NDR Threshold',
  courier_initiated: 'Courier Redirect',
};

export default function RtoDetailPage() {
  const { rtoId } = useParams() as { rtoId: string };
  const router = useRouter();
  const [rto, setRto] = useState<RtoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [newStatus, setNewStatus] = useState('rto_in_transit');
  const [notes, setNotes] = useState('');
  const [reverseAwb, setReverseAwb] = useState('');

  const fetchRtoDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/rto/${rtoId}`);
      setRto(res.data.data);
      if (res.data.data) {
        setNewStatus(res.data.data.status);
        setReverseAwb(res.data.data.rto_awb_number || '');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to retrieve RTO return details');
    } finally {
      setLoading(false);
    }
  }, [rtoId]);

  useEffect(() => {
    if (rtoId) fetchRtoDetails();
  }, [rtoId, fetchRtoDetails]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateLoading(true);

    try {
      await apiClient.put(`/rto/${rtoId}/status`, {
        status: newStatus,
        notes: notes.trim() || undefined,
        rto_awb_number: reverseAwb.trim() || undefined,
      });

      toast.success('RTO return status updated successfully!');
      setNotes('');
      fetchRtoDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update RTO status');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-[#8410DC]" />
      </div>
    );
  }

  if (error || !rto) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-lg mx-auto mt-12">
        <ShieldAlert className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-red-800">Return details not found</h3>
        <p className="text-xs text-red-600 mt-1">{error || 'RTO return shipment record could not be loaded.'}</p>
        <Link
          href="/rto"
          className="mt-4 inline-flex items-center space-x-1.5 text-xs text-[#8410DC] hover:text-[#4D0582] font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to return tracking list</span>
        </Link>
      </div>
    );
  }

  const isDelivered = rto.status === 'rto_delivered';

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header breadcrumbs */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/rto"
            className="p-2 border rounded-xl hover:bg-gray-50 transition"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-gray-900">Return Shipment (RTO) Details</h1>
              <RtoStatusBadge status={rto.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Parent AWB: <span className="font-mono font-semibold">{rto.shipment.awb_number}</span> · Courier: {rto.shipment.provider.display_name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Columns: Details (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* RTO Info Card */}
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-3 flex items-center space-x-2">
              <PackageOpen className="h-4.5 w-4.5 text-[#8410DC]" />
              <span>Return Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs text-gray-600">
              {/* Core trigger info */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trigger Mechanism</p>
                  <p className="text-xs font-semibold text-gray-800 mt-1">
                    {TRIGGER_LABELS[rto.initiated_by] || rto.initiated_by}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason for return</p>
                  <p className="text-xs text-gray-800 mt-1 leading-relaxed">
                    {rto.initiated_reason}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Initiated Date</p>
                  <p className="text-xs text-gray-800 mt-1 font-semibold">
                    {new Date(rto.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* Transit & Warehouse status */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reverse AWB Number</p>
                  <p className="text-xs font-mono font-semibold text-gray-800 mt-1">
                    {rto.rto_awb_number || 'No dedicated reverse AWB issued'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Warehouse Receipt Date</p>
                  <p className="text-xs text-gray-800 mt-1">
                    {rto.received_at_warehouse_at ? (
                      <span className="text-emerald-600 font-bold">
                        {new Date(rto.received_at_warehouse_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold italic">Pending warehouse delivery</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Original Order Info Card */}
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-3">Original Consignment Context</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Order Reference</p>
                <p className="text-gray-900 font-semibold mt-0.5">{rto.shipment.order.order_reference}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Original Customer</p>
                <p className="text-gray-900 font-semibold mt-0.5">{rto.shipment.order.customer_name}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Manual Status Update Form (1 Col) */}
        <div className="space-y-6">
          {isDelivered ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
              <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-emerald-800">Return Completed</h3>
              <p className="text-xs text-emerald-600 leading-relaxed">
                This reverse shipment is delivered. The returned inventory was received and verified in the origin warehouse.
              </p>
            </div>
          ) : (
            <form onSubmit={handleStatusUpdate} className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Update Return Status</h3>
                <p className="text-xs text-gray-400 mt-0.5">Submit manual override status checks for warehouse operations.</p>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Return Status State</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none cursor-pointer"
                >
                  <option value="rto_initiated">Return Initiated</option>
                  <option value="rto_in_transit">Return In Transit</option>
                  <option value="rto_delivered">Mark Delivered back to Warehouse</option>
                  <option value="rto_lost">Mark Return Shipment Lost</option>
                </select>
              </div>

              {/* Reverse AWB Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Reverse AWB Number (optional)</label>
                <input
                  type="text"
                  value={reverseAwb}
                  onChange={(e) => setReverseAwb(e.target.value)}
                  placeholder="e.g. REV-DEL-987654..."
                  className="w-full text-xs border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                />
              </div>

              {/* Actions notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">Action Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Scanned in warehouse, return verified. Box intact."
                  rows={3}
                  className="w-full text-xs border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={updateLoading}
                className="w-full bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:bg-blue-300 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition shadow-md"
              >
                <span>{updateLoading ? 'Updating Return status...' : 'Update Return Status'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
