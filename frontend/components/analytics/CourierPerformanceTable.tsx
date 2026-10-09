'use strict';

import React from 'react';
import { Truck } from 'lucide-react';
import { resolveCourierLogo } from '@/lib/courierLogos';

interface CourierStats {
  courier_id: string;
  courier_name: string;
  provider_key: string;
  shipments_count: number;
  delivered_count: number;
  ndr_count: number;
  rto_count: number;
  delivery_success_rate: number;
  ndr_rate: number;
  avg_delivery_time_hours: number | null;
}

export default function CourierPerformanceTable({ data = [] }: { data: CourierStats[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">Courier Performance Overview</h3>
          <p className="text-xs text-gray-500">Delivery success, exception rates, and speed analysis</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <Truck className="h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm">No courier performance data available for this range</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="py-4 px-6">Courier Partner</th>
                <th className="py-4 px-6 text-right">Shipments</th>
                <th className="py-4 px-6 text-right">Delivered</th>
                <th className="py-4 px-6 text-right">Success Rate</th>
                <th className="py-4 px-6 text-right">NDR Rate</th>
                <th className="py-4 px-6 text-right">Avg. Transit Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs text-gray-700">
              {data.map((c) => (
                <tr key={c.courier_id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="py-4 px-6 font-semibold text-gray-900 flex items-center space-x-2.5">
                    <div className="h-7 w-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden p-1 shrink-0">
                      <img
                        src={resolveCourierLogo(c.courier_name || c.provider_key)}
                        alt={c.courier_name}
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <span>{c.courier_name}</span>
                  </td>
                  <td className="py-4 px-6 text-right font-medium">{c.shipments_count}</td>
                  <td className="py-4 px-6 text-right">{c.delivered_count}</td>
                  <td className="py-4 px-6 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      c.delivery_success_rate >= 90 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : c.delivery_success_rate >= 75
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}>
                      {c.delivery_success_rate}%
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right text-rose-600 font-medium">
                    {c.ndr_rate}%
                  </td>
                  <td className="py-4 px-6 text-right font-medium">
                    {c.avg_delivery_time_hours 
                      ? `${c.avg_delivery_time_hours} hrs` 
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
