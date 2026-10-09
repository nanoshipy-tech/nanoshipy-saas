'use client';

import React, { useState, useCallback } from 'react';
import {
  MapPin, RefreshCw, Package, CheckCircle2, Truck, AlertTriangle,
  Clock, Radio, LocateFixed, BoxIcon, ArrowDownToLine, XCircle
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

export interface TrackingEvent {
  id: string;
  status: string;
  raw_status: string;
  location: string | null;
  remark: string | null;
  event_timestamp: string;
  source: 'webhook' | 'poll' | 'manual';
  ingested_at: string;
}

export interface TrackingData {
  shipment_id: string;
  awb_number: string | null;
  current_status: string;
  is_delayed: boolean;
  events: TrackingEvent[];
}

interface TrackingTimelineProps {
  shipmentId: string;
  initialData?: TrackingData | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; dot: string }> = {
  created: { label: 'Order Created', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-white/[0.04]', icon: <BoxIcon className="h-3.5 w-3.5" />, dot: 'bg-slate-400' },
  awb_generated: { label: 'AWB Generated', color: 'text-[#8410DC] dark:text-[#D6A8FF]', bg: 'bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-indigo-900/30', icon: <Package className="h-3.5 w-3.5" />, dot: 'bg-[#8410DC]' },
  pickup_scheduled: { label: 'Pickup Scheduled', color: 'text-indigo-650 dark:text-[#D6A8FF]', bg: 'bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-indigo-900/30', icon: <Clock className="h-3.5 w-3.5" />, dot: 'bg-[#8410DC]' },
  picked_up: { label: 'Picked Up', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-955/20 border border-violet-100 dark:border-violet-900/30', icon: <ArrowDownToLine className="h-3.5 w-3.5" />, dot: 'bg-violet-500' },
  in_transit: { label: 'In Transit', color: 'text-amber-650 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-955/15 border border-amber-200/50 dark:border-amber-900/30', icon: <Truck className="h-3.5 w-3.5" />, dot: 'bg-amber-500' },
  out_for_delivery: { label: 'Out for Delivery', color: 'text-orange-655 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-955/15 border border-orange-200/50 dark:border-orange-900/30', icon: <LocateFixed className="h-3.5 w-3.5" />, dot: 'bg-orange-500' },
  delivered: { label: 'Delivered', color: 'text-emerald-600 dark:text-emerald-450', bg: 'bg-emerald-50 dark:bg-emerald-955/15 border border-emerald-100 dark:border-emerald-900/30', icon: <CheckCircle2 className="h-3.5 w-3.5" />, dot: 'bg-emerald-555' },
  cancelled: { label: 'Cancelled', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-955/15 border border-rose-200/50 dark:border-rose-900/30', icon: <XCircle className="h-3.5 w-3.5" />, dot: 'bg-rose-500' },
  failed: { label: 'Failed', color: 'text-red-700 dark:text-rose-455', bg: 'bg-red-50 dark:bg-rose-955/15 border border-red-200/50 dark:border-rose-900/30', icon: <AlertTriangle className="h-3.5 w-3.5" />, dot: 'bg-red-500' },
};

const SOURCE_LABELS: Record<string, string> = {
  webhook: 'Live Push',
  poll: 'Polled',
  manual: 'Manual',
};

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TrackingTimeline({ shipmentId, initialData }: TrackingTimelineProps) {
  const [data, setData] = useState<TrackingData | null>(initialData || null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollMessage, setPollMessage] = useState<string | null>(null);

  const fetchTracking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/shipments/${shipmentId}/tracking`);
      setData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load tracking events');
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  const handleManualPoll = async () => {
    setPolling(true);
    setPollMessage(null);
    try {
      const res = await apiClient.post(`/shipments/${shipmentId}/tracking/poll`);
      if (res.data.data?.queued) {
        setPollMessage('Tracking refresh queued! Updates will appear shortly.');
        // Auto-refresh after 4s
        setTimeout(() => fetchTracking(), 4000);
      } else {
        setPollMessage(res.data.data?.reason || 'No AWB assigned yet.');
      }
    } catch (err: any) {
      setPollMessage(err.response?.data?.error?.message || 'Failed to trigger refresh');
    } finally {
      setPolling(false);
    }
  };

  const events = data?.events || [];

  return (
    <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-[#0f1117]/80">
        <div className="flex items-center space-x-2">
          <Radio className="h-4 w-4 text-[#8410DC] animate-pulse" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">Live Tracking Timeline</h3>
          {data?.is_delayed && (
            <span className="flex items-center space-x-1 bg-amber-100 dark:bg-amber-955/25 text-amber-750 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" />
              <span>DELAYED</span>
            </span>
          )}
        </div>
        <button
          onClick={handleManualPoll}
          disabled={polling || loading}
          className="flex items-center space-x-1.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:bg-indigo-300 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-sm outline-none"
          title="Fetch latest tracking from courier"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${polling ? 'animate-spin' : ''}`} />
          <span>{polling ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Poll message */}
      {pollMessage && (
        <div className="mx-6 mt-3 text-xs text-[#5B069A] dark:text-[#D6A8FF] bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-indigo-900/30 rounded-xl px-4 py-2.5 font-medium">
          {pollMessage}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mx-6 mt-3 text-xs text-rose-700 dark:text-rose-455 bg-rose-50 dark:bg-rose-955/20 border border-rose-200 dark:border-rose-900/30 rounded-xl px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
          <div className="h-14 w-14 bg-slate-100 dark:bg-white/[0.02] rounded-2xl flex items-center justify-center mb-4 border border-slate-200 dark:border-white/[0.04]">
            <Truck className="h-6 w-6 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-white mb-1">No tracking events yet</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
            Tracking checkpoints will appear here once the courier picks up the shipment or sends an update.
          </p>
          <button
            onClick={handleManualPoll}
            disabled={polling}
            className="mt-4 text-xs text-indigo-650 dark:text-[#D6A8FF] hover:text-indigo-805 dark:hover:text-purple-300 font-semibold flex items-center space-x-1 outline-none"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${polling ? 'animate-spin' : ''}`} />
            <span>Check Now</span>
          </button>
        </div>
      )}

      {/* Timeline */}
      {events.length > 0 && (
        <div className="px-6 py-5">
          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[11px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-indigo-200 dark:from-indigo-950 via-slate-200 dark:via-white/[0.04] to-slate-100 dark:to-white/[0.01] rounded-full" />

            <div className="space-y-5">
              {events.map((event, index) => {
                const cfg = STATUS_CONFIG[event.status] || STATUS_CONFIG['in_transit'];
                const isLatest = index === 0;

                return (
                  <div key={event.id} className="relative flex items-start space-x-4">
                    {/* Timeline dot */}
                    <div className={`relative z-10 flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isLatest
                        ? `${cfg.dot} border-white shadow-md ring-2 ring-offset-1 ring-indigo-100 dark:ring-indigo-950`
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-350 dark:border-white/[0.06]'
                    }`}>
                      <span className={isLatest ? 'text-white' : 'text-slate-400'}>
                        {isLatest ? cfg.icon : <span className="h-1.5 w-1.5 rounded-full bg-slate-400 block" />}
                      </span>
                    </div>

                    {/* Content card */}
                    <div className={`flex-1 rounded-xl px-4 py-3 border transition-all ${
                      isLatest
                        ? `${cfg.bg} border-current/20 shadow-sm`
                        : 'bg-slate-50/50 dark:bg-[#0f1117]/50 border-slate-100 dark:border-white/[0.04]'
                    }`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className={`text-xs font-bold ${isLatest ? cfg.color : 'text-slate-700 dark:text-slate-300'}`}>
                            {cfg.label}
                          </span>
                          {event.location && (
                            <span className="flex items-center space-x-0.5 text-[11px] text-slate-550 dark:text-slate-400 bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] px-1.5 py-0.5 rounded-full">
                              <MapPin className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500" />
                              <span>{event.location}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                          {formatDateTime(event.event_timestamp)}
                        </span>
                      </div>

                      {event.remark && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{event.remark}</p>
                      )}

                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-[9px] text-slate-450 dark:text-slate-500 bg-white dark:bg-[#131620] border border-slate-100 dark:border-white/[0.04] px-1.5 py-0.5 rounded-md font-medium">
                          {SOURCE_LABELS[event.source] || event.source}
                        </span>
                        <span className="text-[9px] text-slate-350 dark:text-slate-600">
                          Raw: {event.raw_status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
