'use client';
import React, { useState } from 'react';
import { Sparkles, Clock, CreditCard, ShieldCheck } from 'lucide-react';
import { resolveCourierLogo } from '@/lib/courierLogos';

// ─── CourierLogo — plain <img> with guaranteed SVG/CDN fallback ──────────
function CourierLogo({ displayName, serviceType, logoUrl }: { displayName: string; serviceType: string; logoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveCourierLogo(displayName, logoUrl, serviceType);
  const initials = displayName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const bg =
    serviceType === 'express' || displayName.toLowerCase().includes('express') ? 'bg-amber-100 text-amber-700'
    : serviceType === 'air' || displayName.toLowerCase().includes('air') ? 'bg-purple-100 text-[#8410DC]'
    : 'bg-emerald-100 text-emerald-700';

  if (!resolved || failed) {
    return (
      <div className={`w-20 h-14 rounded-xl flex items-center justify-center font-black text-lg select-none shrink-0 ${bg}`}>
        {initials}
      </div>
    );
  }

  return (
    <div className="w-20 h-14 rounded-xl bg-white border border-slate-200 dark:border-white/[0.08] shadow-xs flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt={`${displayName} logo`}
        width={72}
        height={46}
        className="object-contain w-full h-full"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RateQuote {
  courier_provider_id: string;
  display_name: string;
  logo_url?: string | null;
  service_type: string;
  price: number;
  cod_charge: number;
  estimated_days: number;
  is_allocated?: boolean;
  allocation_badge?: string;
  routing_reason?: string;
}

interface RateComparisonTableProps {
  rates: RateQuote[];
  selectedQuote: RateQuote | null;
  onSelectQuote: (rate: RateQuote) => void;
  booking: boolean;
  loading?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function RateComparisonTable({ rates, selectedQuote, onSelectQuote, booking, loading = false }: RateComparisonTableProps) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-48 mb-2"></div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] rounded-2xl p-5 h-24 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-32"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700/40 rounded w-20"></div>
            </div>
            <div className="h-6 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div className="bg-amber-50 dark:bg-amber-955/15 border border-amber-200 dark:border-amber-900/40 rounded-xl p-6 text-center text-sm text-amber-800 dark:text-amber-400">
        No rates available. Please check if there are active courier providers linked to your account.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
          {rates.length === 1 ? 'Allocated Courier Quote' : `Available Quotes (${rates.length})`}
        </h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {rates.length === 1 ? 'Single auto-routed courier for this delivery route' : 'Quotes are sorted from cheapest to most expensive'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {rates.map((rate, index) => {
          const isSelected =
            selectedQuote?.courier_provider_id === rate.courier_provider_id &&
            selectedQuote?.service_type === rate.service_type;

          const isBestValue = index === 0;

          return (
            <div
              key={`${rate.courier_provider_id}-${rate.service_type}`}
              onClick={() => !booking && onSelectQuote(rate)}
              className={`relative border rounded-2xl p-5 transition-all duration-300 cursor-pointer flex flex-col md:flex-row md:items-center md:justify-between gap-4 outline-none ${
                isSelected
                  ? 'border-[#8410DC] bg-purple-50/20 dark:bg-[#131620]/80 ring-2 ring-purple-600/20 shadow-md'
                  : 'border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#131620] hover:border-slate-300 dark:hover:border-white/[0.12] hover:shadow-md'
              }`}
            >
              {rate.is_allocated ? (
                <span className="absolute -top-2.5 left-4 bg-gradient-to-r from-[#5B069A] to-[#8410DC] text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full flex items-center space-x-1 shadow-sm">
                  <Sparkles className="h-2.5 w-2.5 text-yellow-300" />
                  <span>Auto-Allocated by Network</span>
                </span>
              ) : isBestValue ? (
                <span className="absolute -top-2.5 left-4 bg-emerald-600 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center space-x-1 shadow-sm">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>Cheapest</span>
                </span>
              ) : null}

              {/* Left: logo + courier info */}
              <div className="flex items-start space-x-4">
                {/* Courier brand logo */}
                <CourierLogo displayName={rate.display_name} serviceType={rate.service_type} logoUrl={rate.logo_url} />

                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-slate-900 dark:text-white">{rate.display_name}</h4>
                    {(() => {
                      const sType = String(rate.service_type || '').toLowerCase();
                      const dName = rate.display_name.toLowerCase();
                      let badgeLabel = rate.service_type;
                      if (/^\d+$/.test(badgeLabel)) {
                        badgeLabel = dName.includes('express') || dName.includes('air') ? 'Express' : 'Surface';
                      }
                      const isExpress = sType.includes('express') || dName.includes('express');
                      const isAir = sType.includes('air') || dName.includes('air');
                      return (
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                          isExpress
                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-900/30'
                            : isAir
                            ? 'bg-purple-100 dark:bg-purple-950/40 text-[#4D0582] dark:text-purple-300 border-purple-200/50 dark:border-indigo-900/30'
                            : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-900/30'
                        }`}>
                          {badgeLabel}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Delivery in {rate.estimated_days} days</span>
                    </span>
                    {rate.cod_charge > 0 && (
                      <span className="flex items-center space-x-1 text-[#8410DC] dark:text-[#D6A8FF] font-medium">
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>COD Charge: ₹{rate.cod_charge.toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: price + radio */}
              <div className="flex items-center justify-between md:justify-end gap-6 border-t border-slate-100 dark:border-white/[0.06] md:border-t-0 pt-3 md:pt-0">
                <div className="text-left md:text-right">
                  <div className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Freight</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">₹{(rate.price + rate.cod_charge).toFixed(2)}</div>
                </div>

                <div className="flex items-center">
                  <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'border-[#8410DC] bg-[#8410DC] text-white'
                      : 'border-slate-300 dark:border-white/[0.12] bg-white dark:bg-[#0f1117]'
                  }`}>
                    {isSelected && <ShieldCheck className="h-4 w-4" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
