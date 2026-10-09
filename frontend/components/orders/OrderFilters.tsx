'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Calendar, MapPin, Layers, RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface Address {
  id: string;
  label: string;
}

interface OrderFiltersProps {
  onFilterChange: (filters: Record<string, any>) => void;
}

const STATUS_TABS = [
  { label: 'All Orders', value: '' },
  { label: 'Pending', value: 'pending', dot: 'bg-amber-500' },
  { label: 'Processing', value: 'processing', dot: 'bg-[#8410DC]' },
  { label: 'Ready to Ship', value: 'ready_to_ship', dot: 'bg-emerald-500' },
  { label: 'Cancelled', value: 'cancelled', dot: 'bg-rose-500' },
];

export const OrderFilters: React.FC<OrderFiltersProps> = ({ onFilterChange }) => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [pickupAddressId, setPickupAddressId] = useState('');
  const [source, setSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    apiClient.get('/addresses?limit=100')
      .then(({ data }) => setAddresses(data.data.addresses || []))
      .catch(err => console.error('Failed to load addresses for filters', err));
  }, []);

  const handleApply = (newStatus?: string) => {
    const activeStatus = newStatus !== undefined ? newStatus : status;
    onFilterChange({
      search: search.trim() || undefined,
      status: activeStatus || undefined,
      payment_mode: paymentMode || undefined,
      pickup_address_id: pickupAddressId || undefined,
      source: source || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  };

  const handleStatusTabClick = (val: string) => {
    setStatus(val);
    handleApply(val);
  };

  const handleReset = () => {
    setSearch('');
    setStatus('');
    setPaymentMode('');
    setPickupAddressId('');
    setSource('');
    setDateFrom('');
    setDateTo('');
    setShowAdvanced(false);
    onFilterChange({});
  };

  const hasActiveFilters = Boolean(
    search || status || paymentMode || pickupAddressId || source || dateFrom || dateTo
  );

  return (
    <div className="bg-white rounded-2xl border border-[#E8DEF2] shadow-xs p-3.5 space-y-3">
      {/* Top Row: Quick Status Tabs & Filter Count */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleStatusTabClick(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  active
                    ? 'bg-[#5B069A] text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-purple-50/60 hover:text-[#5B069A]'
                }`}
              >
                {tab.dot && <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-md transition cursor-pointer shrink-0"
          >
            <X className="w-3 h-3" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Main Filter Toolbar: Search, Payment Dropdown, Advanced Toggle, and Apply */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Compact Search Field */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            placeholder="Search reference, customer name, phone..."
            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50/70 border border-[#E8DEF2] rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#8410DC] outline-none transition"
          />
        </div>

        {/* Payment Mode Selector */}
        <select
          value={paymentMode}
          onChange={(e) => {
            setPaymentMode(e.target.value);
            onFilterChange({
              search: search.trim() || undefined,
              status: status || undefined,
              payment_mode: e.target.value || undefined,
              pickup_address_id: pickupAddressId || undefined,
              source: source || undefined,
              date_from: dateFrom || undefined,
              date_to: dateTo || undefined,
            });
          }}
          className="text-xs bg-slate-50/70 border border-[#E8DEF2] rounded-xl px-2.5 py-1.5 text-slate-700 focus:bg-white focus:border-[#8410DC] outline-none transition cursor-pointer"
        >
          <option value="">All Payments</option>
          <option value="prepaid">Prepaid</option>
          <option value="cod">COD</option>
        </select>

        {/* Advanced Filters Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
            showAdvanced || pickupAddressId || source || dateFrom || dateTo
              ? 'bg-purple-50 border-purple-300 text-[#5B069A]'
              : 'bg-white border-[#E8DEF2] text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>More Filters</span>
          {(pickupAddressId || source || dateFrom || dateTo) && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#8410DC]" />
          )}
        </button>

        {/* Apply Button */}
        <button
          type="button"
          onClick={() => handleApply()}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] text-white text-xs font-bold shadow-xs hover:opacity-95 transition cursor-pointer flex items-center gap-1"
        >
          <span>Filter</span>
        </button>
      </div>

      {/* Collapsible Advanced Filters Drawer */}
      {showAdvanced && (
        <div className="pt-2.5 border-t border-[#F2ECF7] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 animate-in fade-in duration-150">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Pickup Location
            </label>
            <select
              value={pickupAddressId}
              onChange={(e) => setPickupAddressId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-[#E8DEF2] rounded-lg p-1.5 text-slate-700 outline-none"
            >
              <option value="">All Locations</option>
              {addresses.map((addr) => (
                <option key={addr.id} value={addr.id}>{addr.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Order Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-[#E8DEF2] rounded-lg p-1.5 text-slate-700 outline-none"
            >
              <option value="">All Sources</option>
              <option value="manual">Manual Entry</option>
              <option value="bulk_import">Bulk CSV Import</option>
              <option value="api">API / Storefront</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-[#E8DEF2] rounded-lg p-1.5 text-slate-700 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-[#E8DEF2] rounded-lg p-1.5 text-slate-700 outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
