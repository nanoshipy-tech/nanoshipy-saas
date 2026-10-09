'use client';

import React, { useState } from 'react';

const VALID_EVENTS = [
  'order.created',
  'order.status_changed',
  'shipment.created',
  'shipment.cancelled',
  'tracking.status_changed',
  'ndr.created',
  'ndr.action_taken',
  'rto.initiated',
  'wallet.low_balance',
];

export default function WebhookForm({ initialData = null, onSubmit, onCancel }) {
  const [targetUrl, setTargetUrl] = useState(initialData?.target_url || '');
  const [selectedEvents, setSelectedEvents] = useState(initialData?.subscribed_events || []);
  const [loading, setLoading] = useState(false);

  const toggleEvent = (event) => {
    setSelectedEvents(prev => 
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ target_url: targetUrl, subscribed_events: selectedEvents });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {initialData ? 'Update Webhook Endpoint' : 'Register New Webhook'}
      </h3>
      
      <div className="mb-4">
        <label htmlFor="url" className="block text-sm font-medium text-gray-700">Target URL</label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
            https://
          </span>
          <input
            type="url"
            id="url"
            required
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-purple-500 focus:border-[#8410DC] sm:text-sm border-gray-300 border"
            placeholder="api.your-store.com/webhooks/shipping"
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">Must be a publicly accessible HTTPS URL.</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Subscribed Events</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded p-4 bg-gray-50">
          {VALID_EVENTS.map(event => (
            <div key={event} className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id={`event-${event}`}
                  type="checkbox"
                  checked={selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="focus:ring-purple-500 h-4 w-4 text-[#8410DC] border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor={`event-${event}`} className="font-medium text-gray-700">{event}</label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading || selectedEvents.length === 0 || !targetUrl}
          className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#8410DC] text-sm font-medium text-white hover:bg-[#730ec2] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-indigo-300"
        >
          {loading ? 'Saving...' : (initialData ? 'Update Webhook' : 'Register Webhook')}
        </button>
      </div>
    </form>
  );
}
