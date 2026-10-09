'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SpendPoint {
  date: string;
  amount: number;
}

export default function WalletSpendChart({ data = [] }: { data: SpendPoint[] }) {
  const totalSpend = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Wallet Spend Analysis</h3>
            <p className="text-xs text-gray-500">Track shipping spends and debit transactions</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Total Debit</span>
            <span className="text-base font-black text-[#8410DC]">₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        
        <div className="h-48 w-full">
          {data.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-gray-50/50 rounded-xl border border-dashed text-gray-400 text-sm">
              No wallet spend history found
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                />
                <Tooltip 
                  formatter={(value: any) => `₹${parseFloat(value).toFixed(2)}`}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#1f2937' }}
                  itemStyle={{ fontSize: '11px', color: '#ef4444' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSpend)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
