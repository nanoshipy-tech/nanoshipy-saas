'use client';

import React from 'react';

export default function WebhookDeliveryLog({ deliveries = [], onRedeliver }) {
  if (!deliveries || deliveries.length === 0) {
    return (
      <div className="text-gray-500 p-4 border rounded-lg bg-gray-50 text-sm">
        No delivery history available for this webhook.
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'delivered': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Delivered</span>;
      case 'pending': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
      case 'failed': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Failed</span>;
      case 'exhausted': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Exhausted</span>;
      default: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Event</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Response Code</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Attempt</th>
            <th scope="col" className="relative px-3 py-3.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {deliveries.map((delivery) => (
            <tr key={delivery.id}>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {new Date(delivery.created_at).toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                {delivery.event_key}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">
                {getStatusBadge(delivery.status)}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {delivery.response_status_code || '-'}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {delivery.attempt_number}
              </td>
              <td className="relative whitespace-nowrap px-3 py-4 text-right text-sm font-medium">
                {(delivery.status === 'failed' || delivery.status === 'exhausted') && onRedeliver && (
                  <button 
                    onClick={() => onRedeliver(delivery.id)}
                    className="text-[#8410DC] hover:text-indigo-900"
                  >
                    Retry
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
