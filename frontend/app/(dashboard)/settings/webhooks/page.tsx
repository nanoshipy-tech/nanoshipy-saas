'use client';

import React, { useState, useEffect } from 'react';
import WebhookForm from '@/components/developer/WebhookForm';
import { apiClient as api } from '@/lib/apiClient';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/webhooks');
      setWebhooks(res.data.data);
    } catch (err) {
      toast.error('Failed to fetch webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      const res = await api.post('/webhooks', data);
      toast.success('Webhook registered successfully');
      setNewWebhookSecret({ secret: res.data.data.secret, url: res.data.data.target_url });
      setShowForm(false);
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to register webhook');
      throw err;
    }
  };

  const handleUpdate = async (id: string, data: any) => {
    try {
      await api.put(`/webhooks/${id}`, data);
      toast.success('Webhook updated successfully');
      setEditingWebhook(null);
      fetchWebhooks();
    } catch (err) {
      toast.error('Failed to update webhook');
      throw err;
    }
  };

  const confirmDeleteWebhook = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/webhooks/${deleteModal.id}`);
      toast.success('Webhook deleted');
      setDeleteModal({ isOpen: false });
      fetchWebhooks();
    } catch (err) {
      toast.error('Failed to delete webhook');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestPing = async (id) => {
    try {
      await api.post(`/webhooks/${id}/test`);
      toast.success('Test ping queued');
    } catch (err) {
      toast.error('Failed to queue test ping');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Webhooks</h1>
          <p className="mt-1 text-sm text-gray-500">Register endpoints to receive real-time event updates.</p>
        </div>
        {!showForm && !editingWebhook && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2]"
          >
            Add Webhook
          </button>
        )}
      </div>

      {newWebhookSecret && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
          <h3 className="text-sm font-medium text-yellow-800">Webhook Registered: {newWebhookSecret.url}</h3>
          <p className="mt-2 text-sm text-yellow-700">
            This is your webhook signing secret. Use it to verify the <code>X-Webhook-Signature</code> header on incoming payloads.
            <strong> It will not be shown again.</strong>
          </p>
          <div className="mt-3">
            <code className="bg-yellow-100 p-2 rounded text-sm break-all font-mono">
              {newWebhookSecret.secret}
            </code>
          </div>
          <button 
            onClick={() => setNewWebhookSecret(null)}
            className="mt-3 text-sm text-yellow-800 underline"
          >
            I have saved this secret
          </button>
        </div>
      )}

      {(showForm || editingWebhook) && (
        <div className="mb-8">
          <WebhookForm 
            initialData={editingWebhook}
            onSubmit={(data) => editingWebhook ? handleUpdate(editingWebhook.id, data) : handleCreate(data)}
            onCancel={() => { setShowForm(false); setEditingWebhook(null); }}
          />
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : webhooks.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No webhooks registered.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {webhooks.map((webhook) => (
              <li key={webhook.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#8410DC] truncate">{webhook.target_url}</p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${webhook.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex flex-wrap gap-2 text-sm text-gray-500">
                      {webhook.subscribed_events.map(event => (
                        <span key={event} className="bg-gray-100 px-2 py-1 rounded">{event}</span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 space-x-4">
                      <button onClick={() => handleTestPing(webhook.id)} className="text-[#8410DC] hover:underline">Ping</button>
                      <button onClick={() => setEditingWebhook(webhook)} className="text-gray-600 hover:underline">Edit</button>
                      <Link href={`/settings/webhooks/${webhook.id}`} className="text-[#8410DC] hover:underline">
                        Logs
                      </Link>
                      <button onClick={() => setDeleteModal({ isOpen: true, id: webhook.id })} className="text-rose-600 hover:underline">Delete</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={confirmDeleteWebhook}
        title="Delete Webhook"
        description="Are you sure you want to delete this webhook subscription? Automated event deliveries to this endpoint will stop immediately."
        confirmText="Delete Webhook"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
