'use client';

import React from 'react';

// For a real implementation, you would use a charting library like Recharts or Chart.js
// This is a placeholder visual representation for the requirement.
export default function ApiUsageChart({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">API Usage (Last 30 Days)</h3>
        <div className="flex items-center justify-center h-48 bg-gray-50 border border-dashed rounded text-gray-400">
          No usage data available for this key.
        </div>
      </div>
    );
  }

  // Aggregate logs by day for a simple bar chart visualization
  const aggregated: Record<string, number> = logs.reduce((acc: Record<string, number>, log: any) => {
    const date = new Date(log.created_at).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const maxCalls = Math.max(...Object.values(aggregated), 1);
  const chartData = Object.entries(aggregated).map(([date, count]) => ({ date, count }));

  return (
    <div className="bg-white p-6 rounded-lg shadow mt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">API Usage (Last 30 Days)</h3>
      
      <div className="flex items-end h-48 space-x-2 pb-2 border-b">
        {chartData.map((data, i) => (
          <div key={i} className="flex-1 flex flex-col items-center group relative">
            {/* Tooltip */}
            <div className="absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {data.count} calls
            </div>
            {/* Bar */}
            <div 
              className="w-full bg-[#8410DC] rounded-t hover:bg-[#8410DC] transition-colors"
              style={{ height: `${(data.count / maxCalls) * 100}%`, minHeight: '4px' }}
            ></div>
            {/* Label */}
            <div className="text-[10px] text-gray-500 mt-2 truncate w-full text-center">
              {data.date.split('/')[0]}/{data.date.split('/')[1]}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        Total API Calls: <span className="font-semibold text-gray-900">{logs.length}</span>
      </div>
    </div>
  );
}
