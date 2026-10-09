'use client';

import { apiClient } from '@/lib/apiClient';
import React, { useState, useEffect } from 'react';

export default function CodRtoConfigPage() {
  const [flatCharge, setFlatCharge] = useState<number>(40.00);
  const [percentCharge, setPercentCharge] = useState<number>(2.50);
  const [surchargePercent, setSurchargePercent] = useState<number>(5.00);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/platform/markup-config');
      if (res.data?.success && res.data?.data) {
        if (res.data.data.cod) {
          setFlatCharge(parseFloat(res.data.data.cod.flat_charge));
          setPercentCharge(parseFloat(res.data.data.cod.percent_charge));
        }
        if (res.data.data.rto) {
          setSurchargePercent(parseFloat(res.data.data.rto.surcharge_percent));
        }
      }
    } catch (err) {
      console.error('Failed to fetch COD/RTO config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const res = await apiClient.put('/platform/cod-rto-config', {
        flat_charge: Number(flatCharge),
        percent_charge: Number(percentCharge),
        surcharge_percent: Number(surchargePercent),
      });

      if (!res.data?.success) {
        throw new Error(res.data?.error?.message || 'Failed to update COD/RTO config');
      }

      setMsg({ type: 'success', text: 'COD & RTO Policy updated successfully!' });
      fetchConfig();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error?.message || err.message || 'Error updating config' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">COD & RTO Policy Configuration</h1>
        <p className="text-sm text-[#7E7994] dark:text-[#534F66]">
          Configure COD fees (Whichever is higher: Flat vs %) and RTO Surcharge Percentage
        </p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl rounded-xl bg-white p-6 shadow-sm border space-y-6 dark:bg-slate-900 dark:border-[#E8DEF2]">
        {msg && (
          <div className={`rounded-lg p-3 text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'}`}>
            {msg.text}
          </div>
        )}

        {/* COD Policy */}
        <div className="border-b pb-6 dark:border-[#E8DEF2]">
          <h3 className="text-lg font-bold text-slate-900 dark:text-[#14121F] mb-2">COD Charge Policy</h3>
          <p className="text-xs text-[#7E7994] mb-4">Rule: Max(Flat Charge, Order Value × Percent Charge)</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-[#534F66] mb-1">COD Minimum Flat Charge (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={flatCharge}
                onChange={(e) => setFlatCharge(parseFloat(e.target.value))}
                className="w-full rounded-lg border p-2 text-sm dark:bg-slate-800 dark:border-[#E8DEF2] dark:text-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-[#534F66] mb-1">COD Percentage Charge (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={percentCharge}
                onChange={(e) => setPercentCharge(parseFloat(e.target.value))}
                className="w-full rounded-lg border p-2 text-sm dark:bg-slate-800 dark:border-[#E8DEF2] dark:text-white font-semibold"
              />
            </div>
          </div>
        </div>

        {/* RTO Policy */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-[#14121F] mb-2">RTO Surcharge Policy</h3>
          <p className="text-xs text-[#7E7994] mb-4">Rule: RTO Sell Price = Forward Sell Price × (1 + Surcharge %)</p>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-[#534F66] mb-1">RTO Surcharge Percentage (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={surchargePercent}
              onChange={(e) => setSurchargePercent(parseFloat(e.target.value))}
              className="w-full rounded-lg border p-2 text-sm dark:bg-slate-800 dark:border-[#E8DEF2] dark:text-white font-semibold"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#8410DC] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#730ec2] disabled:opacity-50"
          >
            {saving ? 'Saving Changes...' : 'Save Policy Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
