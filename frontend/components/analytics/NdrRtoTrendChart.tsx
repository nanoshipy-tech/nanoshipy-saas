'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TrendPoint {
  date: string;
  ndr_rate: number;
  rto_rate: number;
}

export default function NdrRtoTrendChart({ data = [] }: { data: TrendPoint[] }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-gray-900">NDR & RTO Rate Trend</h3>
          <p className="text-xs text-gray-500">Track exception and return delivery rates over time</p>
        </div>
      </div>
      
      <div className="h-72 w-full">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full bg-gray-50/50 rounded-xl border border-dashed text-gray-400 text-sm">
            No exception trends available for this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip 
                formatter={(value: any) => `${parseFloat(value).toFixed(2)}%`}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                }}
                labelStyle={{ fontWeight: 'bold', fontSize: '12px', color: '#1f2937' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', color: '#4b5563' }}
              />
              <Line 
                name="NDR Rate" 
                type="monotone" 
                dataKey="ndr_rate" 
                stroke="#f43f5e" 
                strokeWidth={2.5} 
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line 
                name="RTO Rate" 
                type="monotone" 
                dataKey="rto_rate" 
                stroke="#a855f7" 
                strokeWidth={2.5} 
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
