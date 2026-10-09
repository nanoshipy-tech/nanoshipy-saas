'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';
import { ShipmentDetailPanel, ShipmentDetail } from '@/components/shipments/ShipmentDetailPanel';
import { TrackingData } from '@/components/shipments/TrackingTimeline';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function ShipmentDetailsPage() {
  const router = useRouter();
  const { shipmentId } = useParams();

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const fetchShipment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shipmentRes, trackingRes] = await Promise.allSettled([
        apiClient.get(`/shipments/${shipmentId}`),
        apiClient.get(`/shipments/${shipmentId}/tracking`),
      ]);

      if (shipmentRes.status === 'fulfilled') {
        setShipment(shipmentRes.value.data.data);
      } else {
        throw (shipmentRes as PromiseRejectedResult).reason;
      }

      if (trackingRes.status === 'fulfilled') {
        setTrackingData(trackingRes.value.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load shipment details:', err);
      setError(err.response?.data?.error?.message || 'Failed to retrieve shipment tracking details.');
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    if (shipmentId) {
      fetchShipment();
    }
  }, [shipmentId, fetchShipment]);

  const handleCancelShipment = () => {
    if (!shipment) return;
    setIsCancelModalOpen(true);
  };

  const confirmCancelShipment = async () => {
    setCancelling(true);
    try {
      await apiClient.put(`/shipments/${shipment!.id}/cancel`);
      toast.success('Shipment successfully cancelled!');
      setIsCancelModalOpen(false);
      fetchShipment();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel shipment');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Spinner className="h-8 w-8 text-[#8410DC]" />
        <p className="text-sm text-gray-500 font-medium">Loading tracking checkpoints...</p>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl flex items-start space-x-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div>
            <h4 className="font-bold text-gray-900 mb-1">Cannot Load Shipment</h4>
            <p className="text-gray-600">{error || 'Shipment not found'}</p>
          </div>
        </div>
        <div className="text-center">
          <Link
            href="/shipments"
            className="inline-flex items-center space-x-2 text-sm font-semibold text-[#8410DC] hover:text-[#4D0582] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Shipments List</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <div className="flex items-center space-x-3 border-b pb-4">
        <Link
          href="/shipments"
          className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Shipment Details</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            AWB: <strong className="text-gray-700">{shipment.awb_number || 'AWAITING_AWB'}</strong> • Carrier: {shipment.provider.display_name}
          </p>
        </div>
      </div>

      <ShipmentDetailPanel
        shipment={shipment}
        onCancel={handleCancelShipment}
        cancelling={cancelling}
        trackingData={trackingData}
      />

      <ConfirmModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={confirmCancelShipment}
        title="Cancel Courier Booking"
        description="Are you sure you want to cancel this courier booking AWB? This will cancel the pickup and revert the order status."
        confirmText="Yes, Cancel AWB"
        variant="danger"
        isLoading={cancelling}
      />
    </div>
  );
}
