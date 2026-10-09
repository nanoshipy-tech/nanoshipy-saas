'use client';

import React, { useState, useEffect } from 'react';
import WebhookDeliveryLog from '@/components/developer/WebhookDeliveryLog';
import { apiClient as api } from '@/lib/apiClient';
import { toast } from 'react-hot-toast';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function WebhookDeliveryHistoryPage() {
  const { id } = useParams();
  const router = useRouter();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchDeliveries();
  }, [id]);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/webhooks/${id}/deliveries`);
      setDeliveries(res.data.data);
    } catch (err) {
      toast.error('Failed to fetch delivery logs');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeliver = async (deliveryId) => {
    // In a full implementation, you might have an endpoint specifically for retrying a delivery:
    // POST /webhooks/deliveries/:id/redeliver
    // For now, this is a placeholder showing intent.
    toast.error('Manual redelivery endpoint not fully implemented yet');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <Link href="/settings/webhooks" className="text-sm text-[#8410DC] hover:underline">
          &larr; Back to Webhooks
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Webhook Delivery Logs</h1>
          <p className="mt-1 text-sm text-gray-500">History of payloads sent to this endpoint.</p>
        </div>
        <button onClick={fetchDeliveries} className="text-sm text-gray-600 hover:text-gray-900">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-gray-500 bg-white shadow rounded-lg">Loading...</div>
      ) : (
        <WebhookDeliveryLog deliveries={deliveries} onRedeliver={handleRedeliver} />
      )}
    </div>
  );
}
