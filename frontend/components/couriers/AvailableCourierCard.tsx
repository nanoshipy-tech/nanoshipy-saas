'use client';

import React, { useState } from 'react';
import { resolveCourierLogo } from '@/lib/courierLogos';

interface CourierProps {
  courier: {
    id: string;
    provider_key: string;
    display_name: string;
    logo_url: string | null;
    supports_cod: boolean;
    supports_prepaid: boolean;
    max_weight_kg: number | null;
    service_types: string[];
    priority: number;
  };
}

export function AvailableCourierCard({ courier }: CourierProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoSrc = resolveCourierLogo(courier.display_name || courier.provider_key, courier.logo_url);

  return (
    <div className="bg-white dark:bg-[#131620] rounded-xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-6 transition-all duration-300 hover:shadow-md hover:border-purple-100 dark:hover:border-indigo-950/50 hover:-translate-y-1">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{courier.display_name}</h3>
          <span className="inline-block text-xs font-semibold text-slate-400 dark:text-slate-550 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] px-2 py-0.5 rounded uppercase tracking-wider">
            Key: {courier.provider_key}
          </span>
        </div>
        <div className="w-16 h-12 bg-white rounded-lg flex items-center justify-center p-1 border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden shrink-0">
          {!imgFailed && logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={courier.display_name}
              className="w-full h-full object-contain"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full bg-purple-50 text-[#8410DC] font-bold flex items-center justify-center text-base rounded">
              {courier.display_name.charAt(0)}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Capabilities */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Capabilities</h4>
          <div className="flex flex-wrap gap-1.5">
            {courier.supports_cod && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                COD
              </span>
            )}
            {courier.supports_prepaid && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-950/20 text-[#5B069A] dark:text-[#D6A8FF] border border-purple-100 dark:border-indigo-900/30">
                Prepaid
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">
              Max Weight: {courier.max_weight_kg ? `${courier.max_weight_kg} kg` : 'Unlimited'}
            </span>
          </div>
        </div>

        {/* Service Types */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Service Types</h4>
          <div className="flex flex-wrap gap-1.5">
            {courier.service_types.map((type) => {
              const bgClass =
                type === 'surface'
                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border-amber-100 dark:border-amber-900/30'
                  : type === 'air'
                  ? 'bg-purple-50 dark:bg-purple-950/20 text-[#5B069A] dark:text-[#D6A8FF] border-purple-100 dark:border-indigo-900/30'
                  : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 border-rose-100 dark:border-rose-900/30';
              return (
                <span
                  key={type}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border capitalize ${bgClass}`}
                >
                  {type}
                </span>
              );
            })}
          </div>
        </div>

        {/* Priority Badge */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-450 dark:text-slate-500">
          <span>Internal Priority Score</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">{courier.priority}</span>
        </div>
      </div>
    </div>
  );
}
