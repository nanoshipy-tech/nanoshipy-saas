import React from 'react';
import { Check, Flame, HelpCircle } from 'lucide-react';

export interface PlanDetails {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number | null;
  max_orders_per_month: number | null;
  max_users: number | null;
  max_pickup_addresses: number | null;
  courier_access_tier: 'basic' | 'standard' | 'all';
  support_tier: 'email' | 'priority' | 'dedicated';
  is_active: boolean;
  is_default: boolean;
}

interface PlanCardProps {
  plan: PlanDetails;
  isCurrent: boolean;
  isPending: boolean;
  onSelect: (planId: string, cycle: 'monthly' | 'yearly') => void;
  loading: boolean;
  cycle: 'monthly' | 'yearly';
}

export function PlanCard({ plan, isCurrent, isPending, onSelect, loading, cycle }: PlanCardProps) {
  const price = cycle === 'yearly' && plan.price_yearly !== null ? plan.price_yearly : plan.price_monthly;
  const cycleLabel = cycle === 'yearly' ? '/year' : '/month';

  const isProOrEnterprise = plan.slug === 'pro' || plan.slug === 'enterprise';

  return (
    <div className={`relative bg-white dark:bg-[#131620] border rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 ${
      isCurrent
        ? 'ring-2 ring-indigo-500 border-transparent shadow-lg shadow-indigo-500/10'
        : 'border-slate-200 dark:border-white/[0.06] hover:border-slate-350 dark:hover:border-white/[0.12] hover:shadow-md'
    }`}>
      {isCurrent && (
        <span className="absolute top-0 right-6 -translate-y-1/2 bg-[#8410DC] text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
          Active Plan
        </span>
      )}
      
      {isPending && (
        <span className="absolute top-0 right-6 -translate-y-1/2 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
          Scheduled Downgrade
        </span>
      )}

      {/* Header */}
      <div>
        <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{plan.name}</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {plan.slug === 'free' && 'For early validation dispatches.'}
          {plan.slug === 'growth' && 'For growing digital merchants.'}
          {plan.slug === 'pro' && 'For larger enterprise accounts.'}
          {plan.slug === 'enterprise' && 'Custom setup details.'}
        </p>

        {/* Pricing */}
        <div className="mt-5 flex items-baseline">
          <span className="text-3xl font-black text-slate-900 dark:text-white">₹{price.toFixed(0)}</span>
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1.5">{cycleLabel}</span>
        </div>

        {/* Limits */}
        <ul className="mt-6 space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
          <li className="flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>
              <strong>{plan.max_orders_per_month !== null ? plan.max_orders_per_month : 'Unlimited'}</strong> orders/month
            </span>
          </li>
          <li className="flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>
              <strong>{plan.max_users !== null ? plan.max_users : 'Unlimited'}</strong> user seats
            </span>
          </li>
          <li className="flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>
              <strong>{plan.max_pickup_addresses !== null ? plan.max_pickup_addresses : 'Unlimited'}</strong> pickup address
            </span>
          </li>
          <li className="flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="capitalize">
              <strong>{plan.courier_access_tier}</strong> courier access
            </span>
          </li>
          <li className="flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="capitalize">
              <strong>{plan.support_tier}</strong> support tier
            </span>
          </li>
        </ul>
      </div>

      {/* Button CTA */}
      <div className="mt-8 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
        {isCurrent ? (
          <button
            disabled
            className="w-full bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 text-xs font-bold py-3 rounded-xl cursor-default outline-none"
          >
            Current Active Plan
          </button>
        ) : (
          <button
            onClick={() => onSelect(plan.id, cycle)}
            disabled={loading}
            className={`w-full text-xs font-bold py-3 rounded-xl transition duration-200 outline-none ${
              isProOrEnterprise
                ? 'bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                : 'bg-purple-50 dark:bg-purple-950/20 text-[#8410DC] dark:text-[#D6A8FF] hover:bg-purple-100 dark:hover:bg-purple-950/40 border border-purple-200/50 dark:border-indigo-900/30'
            }`}
          >
            {isPending ? 'Revert Switch' : 'Switch to Plan'}
          </button>
        )}
      </div>
    </div>
  );
}
