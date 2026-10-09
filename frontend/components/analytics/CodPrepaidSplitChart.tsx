'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PaymentDetail {
  count: number;
  amount: number;
  percentage: number;
}

interface PaymentData {
  cod: PaymentDetail;
  prepaid: PaymentDetail;
}

const COLORS = ['#f59e0b', '#3b82f6'];

export default function CodPrepaidSplitChart({ data }: { data: PaymentData | null }) {
  if (!data) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 mb-2">COD vs. Prepaid Split</h3>
        <div className="flex items-center justify-center h-56 bg-gray-50/50 rounded-xl border border-dashed text-gray-400 text-sm">
          Loading split metrics...
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'COD Share', value: data.cod.amount, count: data.cod.count },
    { name: 'Prepaid Share', value: data.prepaid.amount, count: data.prepaid.count },
  ];

  const totalValue = data.cod.amount + data.prepaid.amount;

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-gray-900">COD vs. Prepaid Split</h3>
        <p className="text-xs text-gray-500 mb-4">Value and volume split of payment modes</p>
        
        <div className="h-48 w-full relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any) => `₹${parseFloat(value).toLocaleString('en-IN')}`}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                }}
                labelStyle={{ fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="absolute text-center">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Value</span>
            <span className="text-lg font-black text-gray-900">₹{Math.round(totalValue).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase">COD</span>
            <span className="text-xs font-semibold text-gray-900">
              ₹{data.cod.amount.toLocaleString('en-IN')} ({data.cod.percentage}%)
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded bg-[#8410DC]" />
          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase">Prepaid</span>
            <span className="text-xs font-semibold text-gray-900">
              ₹{data.prepaid.amount.toLocaleString('en-IN')} ({data.prepaid.percentage}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
