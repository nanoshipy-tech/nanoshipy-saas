'use client';

import React from 'react';
import Link from 'next/link';
import {
  DollarSign, TrendingUp, Percent, ShieldAlert,
  BarChart3, Settings, ArrowRight, Layers, CreditCard, MapPin, SlidersHorizontal
} from 'lucide-react';

const pricingModules = [
  {
    title: 'ST Courier District-Wise Rates',
    description: 'Configure destination district weight slabs (first 500g, additional 500g up to 10kg), bulk pricing (>10kg flat per-kg), and distinct COD rate cards.',
    href: '/pricing/st-rates',
    icon: MapPin,
    badge: 'District Slabs & Bulk',
    color: 'from-[#8410DC] to-purple-600',
    lightBg: 'bg-purple-50 text-[#8410DC] border-purple-200',
  },
  {
    title: 'Dynamic Markup Engine',
    description: 'Configure percentage and flat markups per courier provider, zone, and weight slab for merchant rate calculation.',
    href: '/pricing/markup-config',
    icon: TrendingUp,
    badge: 'Margin Rules',
    color: 'from-[#5B069A] to-[#8410DC]',
    lightBg: 'bg-purple-50 text-[#5B069A] border-purple-200',
  },
  {
    title: 'Courier Allocation & Shipping Rules',
    description: 'Create multi-courier priority rules (up to 5 couriers per rule) for individual sellers, booking offices, or globally by zone, weight & payment mode.',
    href: '/logistics/shipping-rules',
    icon: SlidersHorizontal,
    badge: 'Courier Automation',
    color: 'from-[#8410DC] to-indigo-600',
    lightBg: 'bg-purple-50 text-[#8410DC] border-purple-200',
  },
  {
    title: 'Carrier Cost Rates Master',
    description: 'Upload and manage foundational carrier cost rate cards (surface, express) across all zones (Within City, State, Metro, Rest of India, Special).',
    href: '/pricing/cost-rates',
    icon: Layers,
    badge: 'Base Cost Cards',
    color: 'from-purple-600 to-violet-600',
    lightBg: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    title: 'COD & RTO Fee Rules',
    description: 'Set COD collection percentages, minimum COD fees, and reverse logistics / RTO markup rules.',
    href: '/pricing/cod-rto-config',
    icon: ShieldAlert,
    badge: 'Risk & Surcharges',
    color: 'from-amber-600 to-orange-600',
    lightBg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    title: 'Platform Margin & Profitability Report',
    description: 'Analyze platform gross margin, average markup per shipment, courier cost vs sell rate analytics, and revenue trends.',
    href: '/pricing/margin-report',
    icon: BarChart3,
    badge: 'Analytics & BI',
    color: 'from-emerald-600 to-teal-600',
    lightBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    title: 'Seller Rate Cards Directory',
    description: 'View customized or plan-specific rate cards assigned to merchant accounts with zone-wise price breakdowns.',
    href: '/rate-cards',
    icon: DollarSign,
    badge: 'Merchant Pricing',
    color: 'from-cyan-600 to-[#8410DC]',
    lightBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
];

export default function PricingHubPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 font-['Outfit',sans-serif]">
          <DollarSign className="w-7 h-7 text-[#8410DC]" /> Pricing, Markups & Profitability Hub
        </h1>
        <p className="text-xs text-[#7E7994] font-bold mt-0.5">
          Centralized command center for carrier cost cards, dynamic markup formulas, COD/RTO surcharge rules, and profit margin reporting.
        </p>
      </div>

      {/* Grid of Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {pricingModules.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className="group block bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-purple-300 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${m.lightBg}`}>
                    {m.badge}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 group-hover:text-[#8410DC] transition-colors font-['Outfit',sans-serif]">
                  {m.title}
                </h3>
                <p className="text-xs text-[#534F66] font-bold mt-2 leading-relaxed">
                  {m.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-black text-[#8410DC] group-hover:translate-x-1 transition-transform">
                <span>Configure Module</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
