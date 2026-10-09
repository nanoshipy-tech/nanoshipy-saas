'use strict';

import React from 'react';
import { MapPin } from 'lucide-react';

interface ZoneData {
  state: string;
  city: string;
  shipments_count: number;
}

export default function ZoneDistributionMap({ data = [] }: { data: ZoneData[] }) {
  // Aggregate by state
  const stateSummary = data.reduce((acc, row) => {
    const s = row.state;
    acc[s] = (acc[s] || 0) + row.shipments_count;
    return acc;
  }, {} as Record<string, number>);

  const totalShipments = Object.values(stateSummary).reduce((sum, count) => sum + count, 0);

  const sortedStates = Object.entries(stateSummary)
    .map(([state, count]) => ({
      state,
      count,
      percentage: totalShipments > 0 ? parseFloat(((count / totalShipments) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Regional Distribution</h3>
            <p className="text-xs text-gray-500">Distribution of shipments across states</p>
          </div>
          <MapPin className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
          {sortedStates.length === 0 ? (
            <div className="flex items-center justify-center h-48 bg-gray-50/50 rounded-xl border border-dashed text-gray-400 text-sm">
              No regional data available
            </div>
          ) : (
            sortedStates.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>{item.state}</span>
                  <span>{item.count} ({item.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#8410DC] h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-50 text-[10px] text-gray-400 uppercase tracking-wider font-bold">
          Top City: <span className="text-gray-700 font-bold">{data[0]?.city || 'N/A'}</span> ({data[0]?.shipments_count || 0} shipments)
        </div>
      )}
    </div>
  );
}
