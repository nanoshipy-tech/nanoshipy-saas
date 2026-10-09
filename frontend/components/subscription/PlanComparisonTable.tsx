import React from 'react';
import { Check, X } from 'lucide-react';
import { PlanDetails } from './PlanCard';

interface PlanComparisonTableProps {
  plans: PlanDetails[];
}

export function PlanComparisonTable({ plans }: PlanComparisonTableProps) {
  return (
    <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-150 dark:divide-white/[0.06] text-left text-sm">
          <thead className="bg-slate-50/70 dark:bg-[#0f1117]/80 font-bold text-slate-700 dark:text-slate-300 text-xs">
            <tr>
              <th className="px-6 py-4">Features & Inclusions</th>
              {plans.map((plan) => (
                <th key={plan.id} className="px-6 py-4 text-center">
                  <span className="block font-black text-slate-800 dark:text-white">{plan.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-mono">
                    ₹{plan.price_monthly.toFixed(0)}/mo
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] bg-white dark:bg-[#131620] text-xs text-slate-650 dark:text-slate-300">
            {/* Orders */}
            <tr>
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">Monthly Shipment Volume</td>
              {plans.map((p) => (
                <td key={p.id} className="px-6 py-4 text-center font-medium">
                  {p.max_orders_per_month !== null ? `${p.max_orders_per_month} dispatches` : 'Unlimited'}
                </td>
              ))}
            </tr>
            {/* Users */}
            <tr>
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">Team User Seats</td>
              {plans.map((p) => (
                <td key={p.id} className="px-6 py-4 text-center font-medium">
                  {p.max_users !== null ? `${p.max_users} users` : 'Unlimited'}
                </td>
              ))}
            </tr>
            {/* Addresses */}
            <tr>
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">Pickup Locations</td>
              {plans.map((p) => (
                <td key={p.id} className="px-6 py-4 text-center font-medium">
                  {p.max_pickup_addresses !== null ? `${p.max_pickup_addresses} addresses` : 'Unlimited'}
                </td>
              ))}
            </tr>
            {/* Couriers */}
            <tr>
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">Courier Coverage</td>
              {plans.map((p) => (
                <td key={p.id} className="px-6 py-4 text-center capitalize font-semibold text-slate-800 dark:text-slate-200">
                  {p.courier_access_tier} Coverage
                </td>
              ))}
            </tr>
            {/* Support */}
            <tr>
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">Support Priority</td>
              {plans.map((p) => (
                <td key={p.id} className="px-6 py-4 text-center capitalize font-semibold text-slate-800 dark:text-slate-200">
                  {p.support_tier} Support
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
