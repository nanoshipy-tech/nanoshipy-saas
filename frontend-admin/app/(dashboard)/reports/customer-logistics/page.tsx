'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Truck, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomerLogisticsReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    fetchSellers();
    fetchReport();
  }, []);

  const fetchSellers = async () => {
    try {
      const res = await apiClient.get('/platform/orders/seller-summary');
      if (res.data?.success) setTenants(res.data.data || []);
    } catch {}
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await apiClient.get('/platform/reports/customer-logistics', { params });
      if (res.data?.success) {
        setData(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load Customer Logistics report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.append('format', 'csv');
      if (selectedTenantId) params.append('tenant_id', selectedTenantId);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const response = await apiClient.get(`/platform/reports/customer-logistics?${params.toString()}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `customer_logistics_${new Date().toISOString().substring(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Customer Logistics report downloaded!');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E8DEF2] shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14121F] flex items-center gap-3 font-heading">
            <Truck className="w-6 h-6 text-[#5B069A]" /> Customer-Wise Logistics Report
          </h1>
          <p className="text-xs text-[#534F66] font-medium mt-1">
            Granular shipment logistics audit including AWB, weights, attempt dates, NDR reasons, charges, and zone matrix.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E8DEF2] hover:bg-[#F6EFFF] text-[#14121F] font-bold text-xs transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all"
            style={{ background: 'linear-gradient(135deg, #5B069A 0%, #8410DC 100%)' }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-[#E8DEF2] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="bg-[#F8F7FD] border border-[#E8DEF2] rounded-xl px-4 py-2 text-xs font-bold text-[#14121F] focus:outline-none focus:border-[#5B069A]"
          >
            <option value="">All Sellers / Tenants</option>
            {tenants.map(t => (
              <option key={t.tenant_id} value={t.tenant_id}>{t.company_name}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#534F66] font-medium">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-[#F8F7FD] border border-[#E8DEF2] rounded-xl px-3 py-1.5 text-xs text-[#14121F] font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#534F66] font-medium">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-[#F8F7FD] border border-[#E8DEF2] rounded-xl px-3 py-1.5 text-xs text-[#14121F] font-medium"
            />
          </div>

          <button
            onClick={fetchReport}
            className="px-4 py-2 rounded-xl text-white font-bold text-xs shadow-sm hover:opacity-95 transition-all"
            style={{ background: '#14121F' }}
          >
            Apply Filters
          </button>
        </div>

        <div className="text-xs font-bold text-[#534F66]">
          Shipments Found: <span className="text-[#14121F] font-extrabold">{data.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-[#534F66] text-xs font-semibold">Loading Logistics Report...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-[#534F66] text-xs font-semibold">No logistics rows found for selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F2ECF7] text-[#534F66] bg-[#F8F7FD] font-bold">
                  <th className="py-3.5 px-4 font-bold">AWB / Order</th>
                  <th className="py-3.5 px-4 font-bold">Seller</th>
                  <th className="py-3.5 px-4 font-bold">Pickup Date</th>
                  <th className="py-3.5 px-4 font-bold">Weight (Kg)</th>
                  <th className="py-3.5 px-4 font-bold">1st Attempt / Delivery</th>
                  <th className="py-3.5 px-4 font-bold">NDR Reason</th>
                  <th className="py-3.5 px-4 font-bold">Payment</th>
                  <th className="py-3.5 px-4 font-bold">Total Freight Cost</th>
                  <th className="py-3.5 px-4 font-bold">Zone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECF7] text-[#14121F] font-medium">
                {data.map((row) => (
                  <tr key={row.shipment_id} className="hover:bg-[#F6EFFF]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-mono font-bold text-[#5B069A]">{row.awb}</p>
                      <p className="text-[10px] text-[#7E7994]">Order: {row.order_number}</p>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#14121F]">
                      {row.tenant_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#534F66]">
                      {row.pickup_date}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#14121F]">
                      {row.actual_weight_kg} kg
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-[#14121F] font-semibold">{row.delivery_date !== 'N/A' ? row.delivery_date : 'Pending'}</p>
                      <p className="text-[10px] text-[#7E7994]">1st attempt: {row.first_attempt_date}</p>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-amber-600">
                      {row.ndr_reason}
                    </td>
                    <td className="py-3.5 px-4 uppercase text-[10px] font-bold text-[#7E7994]">
                      {row.payment_mode} (₹{row.shipment_value_inr})
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-[#16a34a]">
                      ₹{row.total_freight_cost}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#5B069A]">
                      {row.zone}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
