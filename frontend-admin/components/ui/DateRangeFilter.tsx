'use client';

import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  initialRange?: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getDefault30DaysRange = (): DateRange => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: formatDate(from),
    to: formatDate(to),
  };
};

export function DateRangeFilter({
  initialRange,
  onChange,
  className = '',
}: DateRangeFilterProps) {
  const [range, setRange] = useState<DateRange>(initialRange || getDefault30DaysRange());
  const [activePreset, setActivePreset] = useState<string>('last30');

  const applyPreset = (preset: 'last7' | 'last30' | 'thisMonth' | 'allTime') => {
    setActivePreset(preset);
    const to = new Date();
    const from = new Date();

    if (preset === 'last7') {
      from.setDate(from.getDate() - 7);
    } else if (preset === 'last30') {
      from.setDate(from.getDate() - 30);
    } else if (preset === 'thisMonth') {
      from.setDate(1);
    } else if (preset === 'allTime') {
      from.setFullYear(2024, 0, 1);
    }

    const newRange = {
      from: formatDate(from),
      to: formatDate(to),
    };
    setRange(newRange);
    onChange(newRange);
  };

  const handleCustomChange = (field: 'from' | 'to', value: string) => {
    setActivePreset('custom');
    const newRange = { ...range, [field]: value };
    setRange(newRange);
    onChange(newRange);
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      {/* Preset Pills */}
      <div className="flex items-center gap-1 bg-[#F6EFFF] p-1 rounded-xl border border-[#E8DEF2]">
        <button
          type="button"
          onClick={() => applyPreset('last7')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
            activePreset === 'last7'
              ? 'bg-[#5B069A] text-white shadow-xs'
              : 'text-[#534F66] hover:text-[#14121F]'
          }`}
        >
          7D
        </button>
        <button
          type="button"
          onClick={() => applyPreset('last30')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
            activePreset === 'last30'
              ? 'bg-[#5B069A] text-white shadow-xs'
              : 'text-[#534F66] hover:text-[#14121F]'
          }`}
        >
          30D (Default)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('thisMonth')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
            activePreset === 'thisMonth'
              ? 'bg-[#5B069A] text-white shadow-xs'
              : 'text-[#534F66] hover:text-[#14121F]'
          }`}
        >
          This Month
        </button>
        <button
          type="button"
          onClick={() => applyPreset('allTime')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
            activePreset === 'allTime'
              ? 'bg-[#5B069A] text-white shadow-xs'
              : 'text-[#534F66] hover:text-[#14121F]'
          }`}
        >
          All Time
        </button>
      </div>

      {/* Date Pickers */}
      <div className="flex items-center gap-1.5 bg-white border border-[#E8DEF2] px-3 py-1.5 rounded-xl shadow-2xs">
        <Calendar className="w-3.5 h-3.5 text-[#7E7994]" />
        <input
          type="date"
          value={range.from}
          onChange={(e) => handleCustomChange('from', e.target.value)}
          className="text-xs text-[#14121F] bg-transparent outline-hidden font-medium cursor-pointer"
        />
        <span className="text-[#A49EBA] font-bold">—</span>
        <input
          type="date"
          value={range.to}
          onChange={(e) => handleCustomChange('to', e.target.value)}
          className="text-xs text-[#14121F] bg-transparent outline-hidden font-medium cursor-pointer"
        />
      </div>
    </div>
  );
}
