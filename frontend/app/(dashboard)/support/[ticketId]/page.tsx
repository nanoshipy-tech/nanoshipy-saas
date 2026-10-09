'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import TicketThread from '@/components/support/TicketThread';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.ticketId as string;

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<any>(null);

  const fetchTicketDetail = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/support/tickets/${ticketId}`);
      if (response.data.success) {
        setTicket(response.data.data);
      }
    } catch (err: any) {
      toast.error('Failed to load support ticket details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetail();
    }
  }, [ticketId]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push('/support')}
            className="p-2 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-gray-500 transition shadow-sm active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {loading ? 'Loading Ticket...' : ticket?.subject}
            </h2>
            <p className="text-xs text-gray-500">
              {loading ? 'Retrieving logs...' : `Ticket Number #${ticket?.ticket_number}`}
            </p>
          </div>
        </div>

        <button
          onClick={fetchTicketDetail}
          disabled={loading}
          className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-gray-500 transition shadow-sm active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main content thread */}
      {loading && !ticket ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-[#8410DC]" />
        </div>
      ) : ticket ? (
        <TicketThread ticket={ticket} onRefresh={fetchTicketDetail} />
      ) : (
        <div className="text-center py-12 text-gray-400 bg-white border rounded-2xl">
          Ticket detail not found or access denied.
        </div>
      )}
    </div>
  );
}
