'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { downloadReportFile } from '@/lib/exportUtils';
import { DateRangeFilter, getDefault30DaysRange, DateRange } from '@/components/ui/DateRangeFilter';
import {
  BarChart3,
  Download,
  Filter,
  RefreshCw,
  Search,
  MapPin,
  Users,
  Truck,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Building2,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function OperationsReportPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefault30DaysRange());
  const [activeTab, setActiveTab] = useState<'district' | 'kam' | 'detailed'>('district');

  // Filter options
  const [kams, setKams] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  // Selected filters
  const [selectedKam, setSelectedKam] = useState<string>('');
  const [selectedCourier, setSelectedCourier] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('');
  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Report Data
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [data, setData] = useState<{
    summary: {
      from: string;
      to: string;
      total_shipments: number;
      total_order_value: number;
      total_freight_charge: number;
      total_cod_charge: number;
      total_return_freight: number;
      delivered_count: number;
      rto_count: number;
    };
    district_breakdown: any[];
    kam_breakdown: any[];
    rows: any[];
    pagination: { total: number; page: number; limit: number; total_pages: number };
  }>({
    summary: {
      from: '',
      to: '',
      total_shipments: 0,
      total_order_value: 0,
      total_freight_charge: 0,
      total_cod_charge: 0,
      total_return_freight: 0,
      delivered_count: 0,
      rto_count: 0,
    },
    district_breakdown: [],
    kam_breakdown: [],
    rows: [],
    pagination: { total: 0, page: 1, limit: 50, total_pages: 1 },
  });

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [dateRange, selectedKam, selectedCourier, selectedStatus, selectedPaymentMode, districtFilter, page]);

  const fetchFilterOptions = async () => {
    try {
      const res = await apiClient.get('/admin/reports/operations/filter-options');
      if (res.data?.success) {
        setKams(res.data.data.kams || []);
        setCouriers(res.data.data.couriers || []);
        setStatuses(res.data.data.statuses || []);
      }
    } catch {
      // Non-critical fallback
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        from: dateRange.from,
        to: dateRange.to,
        page,
        limit: 50,
      };

      if (selectedKam) params.kam_id = selectedKam;
      if (selectedCourier) params.courier_id = selectedCourier;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedPaymentMode) params.payment_mode = selectedPaymentMode;
      if (districtFilter.trim()) params.district = districtFilter.trim();
      if (searchQuery.trim()) params.awb = searchQuery.trim();

      const res = await apiClient.get('/admin/reports/operations', { params });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch {
      toast.error('Failed to load operations report');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReport();
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const params: Record<string, any> = {
      from: dateRange.from,
      to: dateRange.to,
      format,
      view_mode: activeTab,
    };

    if (selectedKam) params.kam_id = selectedKam;
    if (selectedCourier) params.courier_id = selectedCourier;
    if (selectedStatus) params.status = selectedStatus;
    if (selectedPaymentMode) params.payment_mode = selectedPaymentMode;
    if (districtFilter.trim()) params.district = districtFilter.trim();
    if (searchQuery.trim()) params.awb = searchQuery.trim();

    const modeName = activeTab === 'district' ? 'district_wise' : activeTab === 'kam' ? 'kam_wise' : 'shipments_ledger';
    const filename = `operations_${modeName}_${dateRange.from}_to_${dateRange.to}.${format}`;

    downloadReportFile(
      '/admin/reports/operations/export',
      params,
      filename
    );
  };

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E8DEF2] shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F6EFFF] text-[#5B069A] border border-[#D6A8FF] text-[11.5px] font-bold uppercase tracking-wider mb-2">
            <Truck className="w-3.5 h-3.5" /> Operations & Intelligence
          </div>
          <h1 className="text-[26px] font-extrabold text-[#14121F] tracking-tight font-heading">
            District & KAM-Wise Operations Report
          </h1>
          <p className="text-[13.5px] text-[#534F66] font-medium mt-1">
            Real-time logistics analytics, freight reconciliations, delivery metrics, and export center.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchReport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E8DEF2] hover:bg-[#F6EFFF] text-[#14121F] font-bold text-xs transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#5B069A] text-[#5B069A] hover:bg-[#F6EFFF] font-bold text-xs transition-all shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all hover:opacity-95"
            style={{ background: 'linear-gradient(135deg, #5B069A 0%, #8410DC 100%)' }}
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Shipments */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8DEF2] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#534F66] uppercase tracking-wider">Shipments</span>
            <div className="w-8 h-8 rounded-lg bg-[#F6EFFF] flex items-center justify-center text-[#5B069A]">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#14121F]">
              {data.summary.total_shipments.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-[#534F66]">
              <span className="text-emerald-600 flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> {data.summary.delivered_count} Del.
              </span>
              <span>•</span>
              <span className="text-rose-600 flex items-center gap-0.5">
                <RotateCcw className="w-3 h-3" /> {data.summary.rto_count} RTO
              </span>
            </div>
          </div>
        </div>

        {/* Total Order Value */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8DEF2] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#534F66] uppercase tracking-wider">Order Value</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#14121F]">
              {formatINR(data.summary.total_order_value)}
            </div>
            <div className="text-[11px] font-medium text-[#534F66] mt-1">Total Merchandise GMV</div>
          </div>
        </div>

        {/* Total Freight */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8DEF2] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#534F66] uppercase tracking-wider">Freight Cost</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#14121F]">
              {formatINR(data.summary.total_freight_charge)}
            </div>
            <div className="text-[11px] font-medium text-[#534F66] mt-1">Base + Weight Charges</div>
          </div>
        </div>

        {/* Total COD Charges */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8DEF2] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#534F66] uppercase tracking-wider">COD Fees</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#14121F]">
              {formatINR(data.summary.total_cod_charge)}
            </div>
            <div className="text-[11px] font-medium text-[#534F66] mt-1">Courier COD Collection</div>
          </div>
        </div>

        {/* Total Return Freight */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8DEF2] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#534F66] uppercase tracking-wider">RTO Freight</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#14121F]">
              {formatINR(data.summary.total_return_freight)}
            </div>
            <div className="text-[11px] font-medium text-[#534F66] mt-1">Reverse Logistics Incurred</div>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8DEF2] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Date Range Filter */}
          <DateRangeFilter initialRange={dateRange} onChange={setDateRange} />

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[260px] flex-1 max-w-xs">
            <Search className="w-4 h-4 text-[#79747E] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search AWB or Order Ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#FBF8FD] border border-[#E8DEF2] rounded-xl text-xs font-semibold text-[#14121F] placeholder:text-[#9A94A7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8410DC]/20 focus:border-[#8410DC] transition-all"
            />
          </form>
        </div>

        {/* Second Filter Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-3 border-t border-[#F2ECF7]">
          {/* KAM Filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#534F66] uppercase tracking-wider mb-1">
              Account Manager (KAM)
            </label>
            <select
              value={selectedKam}
              onChange={(e) => {
                setSelectedKam(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#FBF8FD] border border-[#E8DEF2] rounded-xl text-xs font-semibold text-[#14121F] focus:outline-none focus:ring-2 focus:ring-[#8410DC]/20"
            >
              <option value="">All KAMs</option>
              {kams.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#534F66] uppercase tracking-wider mb-1">
              District
            </label>
            <input
              type="text"
              placeholder="Filter district..."
              value={districtFilter}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#FBF8FD] border border-[#E8DEF2] rounded-xl text-xs font-semibold text-[#14121F] focus:outline-none focus:ring-2 focus:ring-[#8410DC]/20"
            />
          </div>

          {/* Courier Filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#534F66] uppercase tracking-wider mb-1">
              Courier Partner
            </label>
            <select
              value={selectedCourier}
              onChange={(e) => {
                setSelectedCourier(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#FBF8FD] border border-[#E8DEF2] rounded-xl text-xs font-semibold text-[#14121F] focus:outline-none focus:ring-2 focus:ring-[#8410DC]/20"
            >
              <option value="">All Couriers</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#534F66] uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#FBF8FD] border border-[#E8DEF2] rounded-xl text-xs font-semibold text-[#14121F] focus:outline-none focus:ring-2 focus:ring-[#8410DC]/20 capitalize"
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Mode Filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#534F66] uppercase tracking-wider mb-1">
              Payment Mode
            </label>
            <select
              value={selectedPaymentMode}
              onChange={(e) => {
                setSelectedPaymentMode(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#FBF8FD] border border-[#E8DEF2] rounded-xl text-xs font-semibold text-[#14121F] focus:outline-none focus:ring-2 focus:ring-[#8410DC]/20"
            >
              <option value="">All Modes</option>
              <option value="cod">COD</option>
              <option value="prepaid">Prepaid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-[#E8DEF2] bg-white rounded-t-2xl px-6 pt-3 gap-6">
        <button
          onClick={() => setActiveTab('district')}
          className={`pb-3 text-xs font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'district'
              ? 'border-[#5B069A] text-[#5B069A]'
              : 'border-transparent text-[#534F66] hover:text-[#14121F]'
          }`}
        >
          <MapPin className="w-4 h-4" /> District-Wise Breakdown ({data.district_breakdown.length})
        </button>

        <button
          onClick={() => setActiveTab('kam')}
          className={`pb-3 text-xs font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'kam'
              ? 'border-[#5B069A] text-[#5B069A]'
              : 'border-transparent text-[#534F66] hover:text-[#14121F]'
          }`}
        >
          <Users className="w-4 h-4" /> KAM-Wise Breakdown ({data.kam_breakdown.length})
        </button>

        <button
          onClick={() => setActiveTab('detailed')}
          className={`pb-3 text-xs font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'detailed'
              ? 'border-[#5B069A] text-[#5B069A]'
              : 'border-transparent text-[#534F66] hover:text-[#14121F]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Master Shipments Ledger ({data.pagination.total})
        </button>
      </div>

      {/* Table Content Area */}
      <div className="bg-white rounded-b-2xl border border-t-0 border-[#E8DEF2] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-[#534F66] gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-[#5B069A]" />
            <p className="text-xs font-bold">Compiling operations intelligence...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: DISTRICT-WISE TABLE */}
            {activeTab === 'district' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FBF8FD] text-[#534F66] font-bold border-b border-[#E8DEF2] uppercase text-[10.5px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">District</th>
                      <th className="py-3.5 px-4">State</th>
                      <th className="py-3.5 px-4 text-center">Total Orders</th>
                      <th className="py-3.5 px-4 text-center">Delivered</th>
                      <th className="py-3.5 px-4 text-center">RTO</th>
                      <th className="py-3.5 px-4 text-center">Success %</th>
                      <th className="py-3.5 px-4 text-right">Order Value</th>
                      <th className="py-3.5 px-4 text-right">Freight Cost</th>
                      <th className="py-3.5 px-4 text-right">COD Fees</th>
                      <th className="py-3.5 px-4 text-right">Return Freight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECF7] font-medium text-[#14121F]">
                    {data.district_breakdown.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-xs text-[#534F66] font-bold">
                          No district records found matching selected criteria.
                        </td>
                      </tr>
                    ) : (
                      data.district_breakdown.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#FDFBFE] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#14121F] flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[#5B069A]" /> {row.district}
                          </td>
                          <td className="py-3 px-4 text-[#534F66]">{row.state}</td>
                          <td className="py-3 px-4 text-center font-bold">{row.total_orders}</td>
                          <td className="py-3 px-4 text-center text-emerald-600 font-semibold">{row.delivered_orders}</td>
                          <td className="py-3 px-4 text-center text-rose-600 font-semibold">{row.rto_orders}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {row.delivery_rate_pct}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold">{formatINR(row.total_order_value)}</td>
                          <td className="py-3 px-4 text-right text-indigo-700">{formatINR(row.total_freight_charge)}</td>
                          <td className="py-3 px-4 text-right text-amber-700">{formatINR(row.total_cod_charge)}</td>
                          <td className="py-3 px-4 text-right text-rose-700">{formatINR(row.total_return_freight)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: KAM-WISE TABLE */}
            {activeTab === 'kam' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FBF8FD] text-[#534F66] font-bold border-b border-[#E8DEF2] uppercase text-[10.5px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">KAM Name</th>
                      <th className="py-3.5 px-4 text-center">Assigned Merchants</th>
                      <th className="py-3.5 px-4 text-center">Total Shipments</th>
                      <th className="py-3.5 px-4 text-center">Delivered</th>
                      <th className="py-3.5 px-4 text-center">RTO</th>
                      <th className="py-3.5 px-4 text-center">Delivery %</th>
                      <th className="py-3.5 px-4 text-right">Order Value</th>
                      <th className="py-3.5 px-4 text-right">Freight Cost</th>
                      <th className="py-3.5 px-4 text-right">COD Fees</th>
                      <th className="py-3.5 px-4 text-right">Return Freight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECF7] font-medium text-[#14121F]">
                    {data.kam_breakdown.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-xs text-[#534F66] font-bold">
                          No KAM records found matching selected criteria.
                        </td>
                      </tr>
                    ) : (
                      data.kam_breakdown.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#FDFBFE] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#14121F] flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-[#5B069A]" /> {row.kam_name}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#F6EFFF] text-[#5B069A] border border-[#D6A8FF]">
                              {row.assigned_sellers_count} Sellers
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold">{row.total_orders}</td>
                          <td className="py-3 px-4 text-center text-emerald-600 font-semibold">{row.delivered_orders}</td>
                          <td className="py-3 px-4 text-center text-rose-600 font-semibold">{row.rto_orders}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {row.delivery_rate_pct}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold">{formatINR(row.total_order_value)}</td>
                          <td className="py-3 px-4 text-right text-indigo-700">{formatINR(row.total_freight_charge)}</td>
                          <td className="py-3 px-4 text-right text-amber-700">{formatINR(row.total_cod_charge)}</td>
                          <td className="py-3 px-4 text-right text-rose-700">{formatINR(row.total_return_freight)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: MASTER SHIPMENTS LEDGER (15 EXACT SPECIFIED COLUMNS) */}
            {activeTab === 'detailed' && (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[#FBF8FD] text-[#534F66] font-bold border-b border-[#E8DEF2] uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3.5 px-3">AWB Number</th>
                        <th className="py-3.5 px-3">Order Number</th>
                        <th className="py-3.5 px-3">Courier Name</th>
                        <th className="py-3.5 px-3">Tenant Name</th>
                        <th className="py-3.5 px-3 text-right">Order Value</th>
                        <th className="py-3.5 px-3 text-center">COD/Prepaid</th>
                        <th className="py-3.5 px-3 text-right">Freight Charge</th>
                        <th className="py-3.5 px-3 text-center">Status</th>
                        <th className="py-3.5 px-3">Created Date</th>
                        <th className="py-3.5 px-3 text-center">Zone</th>
                        <th className="py-3.5 px-3 text-right">COD Charge</th>
                        <th className="py-3.5 px-3 text-right">Return Freight</th>
                        <th className="py-3.5 px-3">KAM Name</th>
                        <th className="py-3.5 px-3">District</th>
                        <th className="py-3.5 px-3">State</th>
                        <th className="py-3.5 px-3 max-w-[200px]">Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2ECF7] font-medium text-[#14121F]">
                      {data.rows.length === 0 ? (
                        <tr>
                          <td colSpan={16} className="py-12 text-center text-xs text-[#534F66] font-bold">
                            No shipment records found for the selected parameters.
                          </td>
                        </tr>
                      ) : (
                        data.rows.map((row) => (
                          <tr key={row.shipment_id} className="hover:bg-[#FDFBFE] transition-colors">
                            <td className="py-2.5 px-3 font-bold text-[#5B069A]">{row.awb_number}</td>
                            <td className="py-2.5 px-3 font-semibold">{row.order_number}</td>
                            <td className="py-2.5 px-3">{row.courier_name}</td>
                            <td className="py-2.5 px-3 font-medium">{row.tenant_name}</td>
                            <td className="py-2.5 px-3 text-right font-bold">{formatINR(row.order_value)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  row.payment_mode === 'COD'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {row.payment_mode}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-indigo-700">{formatINR(row.freight_charge)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[#534F66]">{row.created_date}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-[#5B069A]">{row.zone}</td>
                            <td className="py-2.5 px-3 text-right text-amber-700">{formatINR(row.cod_charge)}</td>
                            <td className="py-2.5 px-3 text-right text-rose-700">{formatINR(row.return_freight_charge)}</td>
                            <td className="py-2.5 px-3 font-semibold text-[#14121F]">{row.kam_name}</td>
                            <td className="py-2.5 px-3 font-medium text-emerald-800">{row.district}</td>
                            <td className="py-2.5 px-3 text-[#534F66]">{row.state}</td>
                            <td className="py-2.5 px-3 max-w-[200px] truncate text-[#534F66]" title={row.address}>
                              {row.address}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Toolbar */}
                {data.pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-[#E8DEF2] bg-[#FBF8FD]">
                    <div className="text-xs font-semibold text-[#534F66]">
                      Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to{' '}
                      {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
                      {data.pagination.total} records
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        disabled={data.pagination.page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg border border-[#E8DEF2] bg-white text-xs font-bold text-[#14121F] hover:bg-[#F6EFFF] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-bold text-[#5B069A] px-2">
                        {data.pagination.page} / {data.pagination.total_pages}
                      </span>
                      <button
                        disabled={data.pagination.page >= data.pagination.total_pages}
                        onClick={() => setPage((p) => Math.min(data.pagination.total_pages, p + 1))}
                        className="px-3 py-1.5 rounded-lg border border-[#E8DEF2] bg-white text-xs font-bold text-[#14121F] hover:bg-[#F6EFFF] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
