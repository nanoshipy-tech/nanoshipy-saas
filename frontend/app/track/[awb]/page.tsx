'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Package, MapPin, AlertTriangle, Clock, CheckCircle2,
  Truck, LocateFixed, ArrowDownToLine, BoxIcon, XCircle, Search,
  Copy, Check, Phone, Mail, ArrowRight, ShieldCheck, HelpCircle
} from 'lucide-react';
import { API_URL } from '@/lib/env';
import { resolveCourierLogo } from '@/lib/courierLogos';

interface TrackingEvent {
  id: string;
  status: string;
  raw_status: string;
  location: string | null;
  remark: string | null;
  event_timestamp: string;
  source: string;
}

interface PublicTrackingData {
  awb_number: string;
  order_id: string;
  recipient_name: string | null;
  current_status: string;
  is_delayed: boolean;
  estimated_delivery_date: string | null;
  carrier: string;
  provider: {
    display_name: string;
    logo_url: string | null;
  } | null;
  origin: string;
  destination: string;
  seller_branding?: {
    company_name: string;
    subdomain: string;
  };
  events: TrackingEvent[];
}

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string; glow: string;
  icon: React.ReactNode; progressStep: number;
}> = {
  created:                 { label: 'Order Booked',         color: 'text-purple-300',  bg: 'bg-purple-950/60',  border: 'border-purple-800/60', glow: 'shadow-purple-900/30', icon: <BoxIcon className="h-5 w-5" />,           progressStep: 1 },
  booked:                  { label: 'Order Booked',         color: 'text-purple-300',  bg: 'bg-purple-950/60',  border: 'border-purple-800/60', glow: 'shadow-purple-900/30', icon: <BoxIcon className="h-5 w-5" />,           progressStep: 1 },
  booked_awaiting_pickup:  { label: 'Awaiting Pickup',      color: 'text-purple-300',  bg: 'bg-purple-950/60',  border: 'border-purple-800/60', glow: 'shadow-purple-900/30', icon: <Clock className="h-5 w-5" />,             progressStep: 1 },
  awb_generated:           { label: 'AWB Allocated',        color: 'text-indigo-300',  bg: 'bg-indigo-950/60',  border: 'border-indigo-800/60', glow: 'shadow-indigo-900/30', icon: <Package className="h-5 w-5" />,           progressStep: 2 },
  pickup_scheduled:        { label: 'Pickup Scheduled',     color: 'text-indigo-300',  bg: 'bg-indigo-950/60',  border: 'border-indigo-800/60', glow: 'shadow-indigo-900/30', icon: <Clock className="h-5 w-5" />,             progressStep: 2 },
  picked_up:               { label: 'Picked Up by Courier', color: 'text-violet-300',  bg: 'bg-violet-950/60',  border: 'border-violet-800/60', glow: 'shadow-violet-900/30', icon: <ArrowDownToLine className="h-5 w-5" />,   progressStep: 3 },
  in_transit:              { label: 'In Transit',           color: 'text-amber-300',   bg: 'bg-amber-950/60',   border: 'border-amber-800/60',  glow: 'shadow-amber-900/30',  icon: <Truck className="h-5 w-5" />,             progressStep: 4 },
  out_for_delivery:        { label: 'Out for Delivery',     color: 'text-orange-300',  bg: 'bg-orange-950/60',  border: 'border-orange-800/60', glow: 'shadow-orange-900/30', icon: <LocateFixed className="h-5 w-5" />,       progressStep: 5 },
  delivered:               { label: 'Delivered',            color: 'text-emerald-300', bg: 'bg-emerald-950/60', border: 'border-emerald-800/60',glow: 'shadow-emerald-900/40',icon: <CheckCircle2 className="h-5 w-5" />,      progressStep: 6 },
  cancelled:               { label: 'Booking Cancelled',    color: 'text-rose-300',    bg: 'bg-rose-950/60',    border: 'border-rose-800/60',   glow: 'shadow-rose-900/30',   icon: <XCircle className="h-5 w-5" />,           progressStep: 0 },
  failed:                  { label: 'Delivery Issue',       color: 'text-rose-300',    bg: 'bg-rose-950/60',    border: 'border-rose-800/60',   glow: 'shadow-rose-900/30',   icon: <AlertTriangle className="h-5 w-5" />,     progressStep: 0 },
};

const MILESTONES = [
  { key: 'booked', label: 'Booked', desc: 'Order confirmed' },
  { key: 'picked_up', label: 'Picked Up', desc: 'Received by courier' },
  { key: 'in_transit', label: 'In Transit', desc: 'On the way' },
  { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'Out with delivery agent' },
  { key: 'delivered', label: 'Delivered', desc: 'Package delivered' },
];

function getMilestoneIndex(status: string): number {
  switch (status) {
    case 'created':
    case 'booked':
    case 'booked_awaiting_pickup':
      return 0;
    case 'awb_generated':
    case 'pickup_scheduled':
      return 0;
    case 'picked_up':
      return 1;
    case 'in_transit':
      return 2;
    case 'out_for_delivery':
      return 3;
    case 'delivered':
      return 4;
    default:
      return 2; // Default in transit
  }
}

function StepperProgress({ currentStatus }: { currentStatus: string }) {
  const isTerminal = ['cancelled', 'failed'].includes(currentStatus);
  const activeIdx = isTerminal ? -1 : getMilestoneIndex(currentStatus);

  if (isTerminal) {
    return (
      <div className="my-6 p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <XCircle className="h-5 w-5 text-rose-400" />
          <div>
            <p className="text-sm font-bold text-rose-300">Shipment Cancelled / Closed</p>
            <p className="text-xs text-rose-400/70">This consignment booking was cancelled or returned to origin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-8">
      <div className="relative flex items-center justify-between">
        {/* Connecting progress line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-white/10 z-0">
          <div
            className="h-full bg-gradient-to-r from-[#5B069A] via-[#8410DC] to-emerald-400 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, (activeIdx / (MILESTONES.length - 1)) * 100))}%` }}
          />
        </div>

        {MILESTONES.map((step, idx) => {
          const isCompleted = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          const isPending = idx > activeIdx;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                    : isCurrent
                    ? 'bg-gradient-to-r from-[#8410DC] to-[#A855F7] text-white shadow-lg shadow-purple-500/40 ring-4 ring-[#8410DC]/30 animate-pulse'
                    : 'bg-[#1e1b2e] border-2 border-white/20 text-white/40'
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>
              <div className="text-center mt-2">
                <p className={`text-xs font-bold ${
                  isCurrent ? 'text-white' : isCompleted ? 'text-white/90' : 'text-white/40'
                }`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-white/40 hidden md:block mt-0.5">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDateTime(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (_) {
    return ts;
  }
}

export default function PublicTrackingPage() {
  const { awb } = useParams() as { awb: string };
  const [data, setData] = useState<PublicTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!awb) return;
    setLoading(true);
    setError(null);

    fetch(`${API_URL}/track/${encodeURIComponent(awb.trim())}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.data) {
          throw new Error(json.error?.message || 'Tracking information not found for this consignment.');
        }
        setData(json.data);
      })
      .catch((err) => {
        setError(err.message || 'Could not retrieve tracking information');
      })
      .finally(() => setLoading(false));
  }, [awb]);

  const handleCopyAwb = () => {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cfg = data ? (STATUS_CONFIG[data.current_status] || STATUS_CONFIG['in_transit']) : null;
  const carrierName = data?.carrier || data?.provider?.display_name || 'Nanoshipy Express';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Consignment Header Card */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative purple glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#5B069A]/30 border border-[#8410DC]/40 text-[#D6A8FF] text-xs font-semibold">
                <Truck className="w-3.5 h-3.5" />
                <span>Nanoshipy Verified Waybill</span>
              </span>
              {data?.order_id && data.order_id !== 'N/A' && (
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/70 text-xs font-mono">
                  Ref: {data.order_id}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white font-mono tracking-tight">
                {awb}
              </h1>
              <button
                onClick={handleCopyAwb}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition text-xs font-medium border border-white/15 cursor-pointer"
                title="Copy AWB Tracking Number"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Origin -> Destination route */}
            {data && (
              <div className="flex items-center gap-2 text-sm text-white/70 pt-1">
                <span className="font-semibold text-white/90">{data.origin || 'Origin'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D6A8FF]" />
                <span className="font-semibold text-white/90">{data.destination || 'Destination'}</span>
              </div>
            )}
          </div>

          {/* Carrier Partner Badge */}
          {data && (
            <div className="flex flex-col sm:items-end justify-center space-y-2 border-t md:border-t-0 pt-4 md:pt-0 border-white/10">
              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">Carried By</span>
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-2.5">
                <div className="h-7 w-20 bg-white rounded-md p-1 flex items-center justify-center overflow-hidden shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveCourierLogo(carrierName, data.provider?.logo_url)}
                    alt={carrierName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-sm leading-tight">{carrierName}</p>
                  <p className="text-[11px] text-emerald-400 font-medium">Verified Logistics Partner</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 bg-white/5 border border-white/10 rounded-2xl">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 border-2 border-[#8410DC]/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-[#D6A8FF] rounded-full animate-spin border-t-transparent" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-white font-semibold text-base">Fetching live tracking updates...</p>
            <p className="text-white/40 text-xs">Querying courier checkpoints and milestone logs</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-rose-950/40 border border-rose-700/50 rounded-2xl p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-rose-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-white font-bold text-xl">Tracking Details Not Found</h2>
            <p className="text-rose-300/80 text-sm max-w-md mx-auto leading-relaxed">{error}</p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/track"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/20"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Another AWB</span>
            </Link>
          </div>
        </div>
      )}

      {/* Main Tracking Content */}
      {data && cfg && !loading && (
        <>
          {/* Current Status Card */}
          <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-6 sm:p-8 shadow-xl ${cfg.glow}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className={`h-14 w-14 rounded-2xl bg-black/30 flex items-center justify-center ${cfg.color} shadow-inner border border-white/10`}>
                  {cfg.icon}
                </div>
                <div>
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Current Shipment Status</p>
                  <h2 className={`text-2xl font-black ${cfg.color} tracking-tight`}>{cfg.label}</h2>
                  {data.estimated_delivery_date && (
                    <p className="text-white/70 text-xs mt-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#D6A8FF]" />
                      <span>Estimated Delivery: <strong>{new Date(data.estimated_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                    </p>
                  )}
                </div>
              </div>

              {data.is_delayed && (
                <div className="inline-flex items-center space-x-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full px-3.5 py-1.5 self-start sm:self-auto">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-amber-300 text-xs font-bold">POSSIBLE DELAY</span>
                </div>
              )}
            </div>

            {/* 5-Step Stepper Progress Bar */}
            <StepperProgress currentStatus={data.current_status} />
          </div>

          {/* Checkpoint Timeline */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-base">Consignment Checkpoints</h3>
                <p className="text-white/40 text-xs mt-0.5">
                  {data.events.length} milestone{data.events.length !== 1 ? 's' : ''} logged in Nanoshipy tracking network
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs font-semibold">
                Live Timeline
              </span>
            </div>

            {data.events.length === 0 ? (
              <div className="py-14 text-center space-y-2">
                <Truck className="h-10 w-10 text-white/20 mx-auto" />
                <p className="text-white font-semibold text-sm">Awaiting First Hub Scan</p>
                <p className="text-white/40 text-xs max-w-sm mx-auto">
                  Package has been booked. Once the courier partner completes the first origin scan, real-time location logs will appear here.
                </p>
              </div>
            ) : (
              <div className="px-6 py-6">
                <div className="relative">
                  {/* Vertical gradient timeline line */}
                  <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-[#8410DC] via-white/20 to-transparent" />

                  {data.events.map((event, index) => {
                    const evCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG['in_transit'];
                    const isLatest = index === 0;

                    return (
                      <div key={event.id || index} className="relative flex items-start space-x-4 pb-8 last:pb-2">
                        {/* Dot indicator */}
                        <div
                          className={`relative z-10 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
                            isLatest
                              ? 'bg-gradient-to-r from-[#8410DC] to-[#A855F7] text-white shadow-lg shadow-purple-900/50 ring-4 ring-[#8410DC]/30'
                              : 'bg-white/10 border border-white/25 text-white/40'
                          }`}
                        >
                          <div className={`h-2.5 w-2.5 rounded-full ${isLatest ? 'bg-white' : 'bg-white/40'}`} />
                        </div>

                        {/* Milestone details card */}
                        <div className="flex-1 min-w-0 bg-white/[0.03] hover:bg-white/[0.06] transition border border-white/10 rounded-xl p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`text-sm font-bold ${isLatest ? 'text-white' : 'text-white/80'}`}>
                              {event.raw_status || evCfg.label}
                            </span>
                            <span className="text-xs font-mono text-white/40">
                              {formatDateTime(event.event_timestamp)}
                            </span>
                          </div>

                          {event.location && (
                            <div className="flex items-center space-x-1.5 mt-2 text-white/70 text-xs">
                              <MapPin className="h-3.5 w-3.5 text-[#D6A8FF] shrink-0" />
                              <span className="font-medium">{event.location}</span>
                            </div>
                          )}

                          {event.remark && (
                            <p className="text-xs text-white/50 mt-1.5 leading-relaxed bg-black/20 p-2.5 rounded-lg border border-white/5">
                              {event.remark}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Need Help / Support Helpline Card */}
          <div className="bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-slate-900/40 border border-[#8410DC]/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-[#5B069A]/40 border border-[#8410DC]/50 flex items-center justify-center text-[#D6A8FF] shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-white">Need Delivery Assistance?</h4>
                <p className="text-xs text-white/50">
                  Our dedicated Nanoshipy logistics support desk is ready to help with your consignment.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <a
                href="tel:+918065340848"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-[#D6A8FF]" />
                <span>+91 80 6534 0848</span>
              </a>
              <a
                href="mailto:care@nanoshipy.com"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5B069A] hover:bg-[#8410DC] text-white text-xs font-bold transition shadow-lg shadow-purple-900/30 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>care@nanoshipy.com</span>
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
