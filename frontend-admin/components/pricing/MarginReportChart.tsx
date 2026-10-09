'use client';

import React from 'react';

interface CourierBreakdown {
  courier: string;
  sell: number;
  cost: number;
  margin: number;
  margin_percent: number;
}

interface MarginReportChartProps {
  data: {
    total_sell?: number;
    total_sell_revenue?: number;
    total_cost?: number;
    total_margin?: number;
    shipping_margin_percent?: number;
    margin_percent?: number;
    cod_margin?: number;
    rto_margin?: number;
    by_courier?: CourierBreakdown[];
  } | null | undefined;
}

const safeNum = (v: any): number => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const fmt = (v: any): string => safeNum(v).toLocaleString('en-IN');
const fmtDec = (v: any, dec = 1): string => safeNum(v).toFixed(dec);

export default function MarginReportChart({ data }: MarginReportChartProps) {
  const safeData = data || {
    total_sell: 0,
    total_cost: 0,
    total_margin: 0,
    shipping_margin_percent: 0,
    cod_margin: 0,
    rto_margin: 0,
    by_courier: [],
  };

  const totalSell = safeNum(safeData.total_sell ?? safeData.total_sell_revenue);
  const totalCost = safeNum(safeData.total_cost);
  const totalMargin = safeNum(safeData.total_margin);
  const marginPercent = safeNum(safeData.shipping_margin_percent ?? safeData.margin_percent);
  const codMargin = safeNum(safeData.cod_margin);
  const rtoMargin = safeNum(safeData.rto_margin);
  const byCourier = Array.isArray(safeData.by_courier) ? safeData.by_courier : [];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-xs border-slate-200/80 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Sell Revenue</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-['Outfit',sans-serif]">₹{fmt(totalSell)}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-xs border-slate-200/80 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Carrier Cost</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-['Outfit',sans-serif]">₹{fmt(totalCost)}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-xs border-slate-200/80 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Platform Margin</p>
          <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-['Outfit',sans-serif]">₹{fmt(totalMargin)}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">{fmtDec(marginPercent)}% net margin</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-xs border-slate-200/80 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">COD & RTO Revenue</p>
          <p className="mt-1 text-lg font-black text-[#8410DC] dark:text-[#D6A8FF] font-['Outfit',sans-serif]">COD: ₹{fmt(codMargin)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">RTO Surcharge: ₹{fmt(rtoMargin)}</p>
        </div>
      </div>

      {/* Courier Margin Table */}
      <div className="rounded-xl border bg-white shadow-xs border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="border-b p-4 border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-['Outfit',sans-serif]">Margin Breakdown by Courier Partner</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Courier Partner</th>
                <th className="px-4 py-3">Total Sell (₹)</th>
                <th className="px-4 py-3">Carrier Cost (₹)</th>
                <th className="px-4 py-3">Margin (₹)</th>
                <th className="px-4 py-3">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {byCourier.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-medium">
                    No rate snapshot records found for the selected period.
                  </td>
                </tr>
              ) : (
                byCourier.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.courier || 'Unknown'}</td>
                    <td className="px-4 py-3">₹{fmt(item.sell)}</td>
                    <td className="px-4 py-3">₹{fmt(item.cost)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">₹{fmt(item.margin)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{fmtDec(item.margin_percent)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
