'use client';
import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Webhook, Plus, Trash2, TestTube, CheckCircle, XCircle, ToggleLeft, ToggleRight, Copy, Eye, EyeOff, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const AVAILABLE_EVENTS = [
  { value: 'order.created', label: 'Order Created' },
  { value: 'order.updated', label: 'Order Updated' },
  { value: 'shipment.created', label: 'Shipment Created' },
  { value: 'shipment.dispatched', label: 'Shipment Dispatched' },
  { value: 'shipment.delivered', label: 'Shipment Delivered' },
  { value: 'shipment.rto_initiated', label: 'RTO Initiated' },
  { value: 'ndr.raised', label: 'NDR Raised' },
  { value: 'wallet.recharged', label: 'Wallet Recharged' },
  { value: 'wallet.debited', label: 'Wallet Debited' },
];

function CreateWebhookModal({ onClose, onCreate }: { onClose: () => void; onCreate: (wh: any) => void }) {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (event: string) =>
    setEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);

  const handleCreate = async () => {
    if (!url.startsWith('https://')) { setError('URL must start with https://'); return; }
    if (events.length === 0) { setError('Select at least one event'); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await apiClient.post('/seller-webhooks', { url, events, description });
      onCreate(data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create webhook');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8DEF2] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-[#14121F]">Add Webhook Endpoint</h3>
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
        <div>
          <label className="block text-xs font-semibold text-[#534F66] mb-1">Payload URL (HTTPS required)</label>
          <input className="w-full bg-slate-50 border border-[#E8DEF2] rounded-xl px-3.5 py-2.5 text-xs text-[#14121F] focus:outline-none focus:border-[#5B069A]"
            placeholder="https://api.yourdomain.com/webhooks/nanoshipy" value={url} onChange={e => setUrl(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#534F66] mb-1">Description (optional)</label>
          <input className="w-full bg-slate-50 border border-[#E8DEF2] rounded-xl px-3.5 py-2.5 text-xs text-[#14121F] focus:outline-none focus:border-[#5B069A]"
            placeholder="Production order sync" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#534F66] mb-2">Subscribed Events</label>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_EVENTS.map(ev => (
              <label key={ev.value} onClick={() => toggle(ev.value)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${events.includes(ev.value) ? 'border-[#5B069A] bg-violet-50/50 text-[#5B069A] font-semibold' : 'border-[#E8DEF2] text-[#534F66] hover:bg-slate-50'}`}>
                <input type="checkbox" checked={events.includes(ev.value)} onChange={() => {}} className="hidden" />
                <span>{ev.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-[#534F66] hover:text-[#14121F]">Cancel</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-[#5B069A] to-[#8410DC] text-white rounded-xl hover:opacity-95 disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]">
            {saving ? 'Registering...' : 'Register Webhook'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksIntegrationPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, any>>({});
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    apiClient.get('/seller-webhooks').then(({ data }) => {
      if (data.success) setWebhooks(data.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreated = (wh: any) => {
    setWebhooks(prev => [wh, ...prev]);
    if (wh.secret) setNewSecret({ id: wh.id, secret: wh.secret });
    setShowCreate(false);
    toast.success('Webhook registered successfully');
  };

  const confirmDeleteWebhook = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/seller-webhooks/${deleteModal.id}`);
      setWebhooks(prev => prev.filter(w => w.id !== deleteModal.id));
      toast.success('Webhook deleted');
      setDeleteModal({ isOpen: false });
    } catch {
      toast.error('Failed to delete webhook');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const { data } = await apiClient.post(`/seller-webhooks/${id}/test`);
      setTestResult(prev => ({ ...prev, [id]: data.data }));
      toast.success('Test ping sent');
    } catch {
      toast.error('Failed to trigger test ping');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={deleteModal.isOpen} 
        onClose={() => setDeleteModal({ isOpen: false })} 
        onConfirm={confirmDeleteWebhook}
        title="Delete Webhook"
        description="Are you sure you want to delete this webhook endpoint? Event deliveries to this destination will stop immediately."
        confirmText="Delete Webhook"
        variant="danger"
        isLoading={isDeleting}
      />
      {showCreate && <CreateWebhookModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Webhooks</h1>
          <p className="text-[#7E7994] text-sm mt-0.5">Receive real-time events at your HTTPS endpoints</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white text-sm font-semibold transition-all">
          <Plus className="w-4 h-4" /> Add Endpoint
        </button>
      </div>

      {/* Secret reveal banner */}
      {newSecret && (
        <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex-1">
            <p className="text-amber-400 font-semibold text-sm mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" /> Save your signing secret — it won't be shown again
            </p>
            <code className="block font-mono text-xs text-amber-300 bg-amber-500/10 px-3 py-2 rounded-xl mt-2 break-all">{newSecret.secret}</code>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(newSecret.secret); }}
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-all">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={() => setNewSecret(null)} className="text-amber-500 hover:text-amber-300 p-1 transition" title="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-white/[0.03] animate-pulse" />
          ))
        ) : webhooks.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-white border border-[#E8DEF2] border border-slate-200 dark:border-[#F2ECF7] p-12 text-center">
            <Webhook className="w-10 h-10 text-[#534F66] mx-auto mb-3" />
            <p className="text-[#534F66] font-medium">No webhooks yet</p>
            <p className="text-[#7E7994] text-sm mt-1">Add an endpoint to start receiving events</p>
          </div>
        ) : webhooks.map(wh => (
          <div key={wh.id} className="rounded-2xl bg-white dark:bg-white border border-[#E8DEF2] border border-slate-200 dark:border-[#F2ECF7] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wh.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <code className="text-slate-800 dark:text-slate-200 text-sm font-mono truncate">{wh.endpoint_url}</code>
                </div>
                {wh.description && <p className="text-[#7E7994] text-xs mb-2">{wh.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {(wh.events || []).map((ev: string) => (
                    <span key={ev} className="px-2 py-0.5 rounded-full bg-[#8410DC]/10 border border-[#8410DC]/20 text-[#D6A8FF] text-[10px] font-mono">{ev}</span>
                  ))}
                </div>
                {testResult[wh.id] && (
                  <p className={`text-xs mt-2 flex items-center gap-1.5 ${testResult[wh.id].success ? 'text-emerald-500' : 'text-rose-400'}`}>
                    {testResult[wh.id].success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {testResult[wh.id].success ? `Test successful (HTTP ${testResult[wh.id].status})` : `Test failed: ${testResult[wh.id].error}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleTest(wh.id)} disabled={testing === wh.id}
                  className="p-2 rounded-xl text-[#7E7994] hover:text-[#D6A8FF] hover:bg-[#8410DC]/10 transition-all"
                  title="Send test event">
                  {testing === wh.id ? <div className="w-4 h-4 border border-slate-400 border-t-transparent rounded-full animate-spin" /> : <TestTube className="w-4 h-4" />}
                </button>
                <button onClick={() => setDeleteModal({ isOpen: true, id: wh.id })}
                  className="p-2 rounded-xl text-[#7E7994] hover:text-rose-500 hover:bg-rose-50 transition-all"
                  title="Delete webhook">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
