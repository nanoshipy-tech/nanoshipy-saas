import React, { useState } from 'react';
import { Send, MapPin, Phone, RefreshCw, Trash2, ArrowRight } from 'lucide-react';

interface NdrActionPanelProps {
  onActionSubmit: (data: {
    action_type: string;
    notes?: string;
    updated_address_line1?: string;
    updated_phone?: string;
  }) => Promise<void>;
  loading: boolean;
}

export function NdrActionPanel({ onActionSubmit, loading }: NdrActionPanelProps) {
  const [actionType, setActionType] = useState('reattempt');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (actionType === 'update_address' && !address.trim()) {
      setError('New address is required');
      return;
    }

    if (actionType === 'update_phone') {
      const trimmedPhone = phone.trim();
      if (!trimmedPhone) {
        setError('New phone number is required');
        return;
      }
      // Simple E.164 verification pattern
      if (!/^\+?[1-9]\d{1,14}$/.test(trimmedPhone)) {
        setError('Phone number must be in E.164 format (e.g. +919876543210)');
        return;
      }
    }

    try {
      await onActionSubmit({
        action_type: actionType,
        notes: notes.trim() || undefined,
        updated_address_line1: actionType === 'update_address' ? address.trim() : undefined,
        updated_phone: actionType === 'update_phone' ? phone.trim() : undefined,
      });
      // Clear inputs on success
      setNotes('');
      setAddress('');
      setPhone('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit action');
    }
  };

  const actionConfigs: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
    reattempt: {
      label: 'Reattempt Delivery',
      icon: <RefreshCw className="h-4 w-4" />,
      color: 'border-[#8410DC] dark:border-[#8410DC] bg-purple-50/50 dark:bg-purple-950/20 text-[#5B069A] dark:text-[#D6A8FF]',
      desc: 'Instruct the courier provider to reschedule or attempt delivery again.'
    },
    update_address: {
      label: 'Correct Delivery Address',
      icon: <MapPin className="h-4 w-4" />,
      color: 'border-amber-500 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-955/15 text-amber-700 dark:text-amber-400',
      desc: 'Correct spelling errors, wrong house numbers, or add landmarks.'
    },
    update_phone: {
      label: 'Update Customer Phone',
      icon: <Phone className="h-4 w-4" />,
      color: 'border-violet-500 dark:border-violet-600 bg-violet-50/50 dark:bg-violet-955/15 text-violet-700 dark:text-violet-400',
      desc: 'Provide an alternative or corrected phone number for dispatch contact.'
    },
    mark_rto: {
      label: 'Initiate RTO (Return)',
      icon: <Trash2 className="h-4 w-4" />,
      color: 'border-red-500 dark:border-rose-600 bg-red-50/50 dark:bg-rose-955/15 text-red-705 dark:text-rose-400',
      desc: 'Abandon delivery and trigger the reverse shipment back to warehouse.'
    },
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Submit Operational Directive</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Determine the corrective actions for this delivery exception.</p>
      </div>

      {error && (
        <div className="text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-955/20 border border-rose-200 dark:border-rose-900/30 rounded-xl px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Selector Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(actionConfigs).map(([key, cfg]) => {
          const isSelected = actionType === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setActionType(key); setError(null); }}
              className={`flex flex-col items-start text-left p-3.5 border rounded-xl transition-all outline-none ${
                isSelected
                  ? `${cfg.color} ring-2 ring-current/20 border-transparent font-semibold shadow-sm`
                  : 'border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.02] text-slate-650 dark:text-slate-350'
              }`}
            >
              <div className="flex items-center space-x-2">
                {cfg.icon}
                <span className="text-xs font-bold">{cfg.label}</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed font-normal">{cfg.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Dynamic Action Fields */}
      {actionType === 'update_address' && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">New Address Line 1</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Plot No 42, 3rd Floor, Sector 4..."
            className="w-full text-xs border border-slate-250 dark:border-white/[0.08] rounded-xl px-4 py-2.5 bg-white dark:bg-[#0f1117] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
          />
        </div>
      )}

      {actionType === 'update_phone' && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">New Phone Number (E.164 format)</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +919876543210"
            className="w-full text-xs border border-slate-250 dark:border-white/[0.08] rounded-xl px-4 py-2.5 bg-white dark:bg-[#0f1117] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
          />
        </div>
      )}

      {/* Notes / Remarks */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Operational Action Notes / Rationale</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Provide context (e.g. Customer requested attempt tomorrow morning, or customer refused delivery due to COD charge dispute...)"
          rows={3}
          className="w-full text-xs border border-slate-250 dark:border-white/[0.08] rounded-xl px-4 py-2.5 bg-white dark:bg-[#0f1117] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:bg-indigo-300 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition shadow-md outline-none"
      >
        <span>{loading ? 'Transmitting Directive...' : 'Transmit Operational Directive'}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
