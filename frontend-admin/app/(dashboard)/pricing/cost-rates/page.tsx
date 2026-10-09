'use client';

import { apiClient } from '@/lib/apiClient';
import React, { useState, useEffect } from 'react';
import CostRateImportModal from '@/components/pricing/CostRateImportModal';

export default function CostRatesPage() {
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [courier, setCourier] = useState<string>('');
  const [zone, setZone] = useState<string>('');

  const fetchRates = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (courier) params.courier = courier;
      if (zone) params.zone = zone;

      const res = await apiClient.get('/platform/cost-rates', { params });
      if (res.data?.success && res.data?.data) {
        setRates(res.data.data.rows || res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch cost rates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, [courier, zone]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Shipway Cost Rates (Internal)</h1>
          <p className="text-sm text-[#7E7994] dark:text-[#534F66]">View and manage carrier cost rates imported from Shipway CSV</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-[#8410DC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#730ec2] shadow-sm"
        >
          + Import Shipway CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border dark:bg-slate-900 dark:border-[#E8DEF2]">
        <input
          type="text"
          placeholder="Filter by Courier Name..."
          value={courier}
          onChange={(e) => setCourier(e.target.value)}
          className="rounded-lg border p-2 text-sm dark:bg-slate-800 dark:border-[#E8DEF2] dark:text-white"
        />
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="rounded-lg border p-2 text-sm dark:bg-slate-800 dark:border-[#E8DEF2] dark:text-white"
        >
          <option value="">All Zones</option>
          <option value="A">Zone A (Within City)</option>
          <option value="B">Zone B (Within State)</option>
          <option value="C">Zone C (Metro to Metro)</option>
          <option value="D">Zone D (Rest of India)</option>
          <option value="E">Zone E (NE / J&K)</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm dark:border-[#E8DEF2] dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-[#534F66]">
            <thead className="bg-slate-50 text-xs uppercase text-[#7E7994] dark:bg-slate-800 dark:text-[#534F66]">
              <tr>
                <th className="px-4 py-3">Courier Partner</th>
                <th className="px-4 py-3">Service Mode</th>
                <th className="px-4 py-3">Base Weight</th>
                <th className="px-4 py-3">Addl Increment</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Base Cost (₹)</th>
                <th className="px-4 py-3">Addl Cost (₹)</th>
                <th className="px-4 py-3">Effective From</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center">Loading cost rates...</td></tr>
              ) : rates.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-[#7E7994]">No cost rates found. Click "Import Shipway CSV" to populate.</td></tr>
              ) : (
                rates.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.courier_display_name}</td>
                    <td className="px-4 py-3 uppercase text-xs font-semibold">{row.service_mode}</td>
                    <td className="px-4 py-3">{row.base_weight_kg} kg</td>
                    <td className="px-4 py-3">+{row.additional_weight_increment_kg} kg</td>
                    <td className="px-4 py-3 font-bold text-[#8410DC] dark:text-[#D6A8FF]">{row.zone}</td>
                    <td className="px-4 py-3">₹{row.base_cost}</td>
                    <td className="px-4 py-3">₹{row.additional_cost}</td>
                    <td className="px-4 py-3 text-xs">{row.effective_from}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CostRateImportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchRates}
      />
    </div>
  );
}
