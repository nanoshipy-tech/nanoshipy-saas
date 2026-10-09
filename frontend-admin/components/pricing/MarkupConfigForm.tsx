'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Save, X, Layers, Percent, IndianRupee, ShieldAlert, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface MarkupConfigFormProps {
  onSuccess: () => void;
  editingRule?: any | null;
  onCancelEdit?: () => void;
}

export default function MarkupConfigForm({ onSuccess, editingRule, onCancelEdit }: MarkupConfigFormProps) {
  const [scope, setScope] = useState<'global' | 'seller' | 'booking_office' | 'courier' | 'courier_zone' | 'zone'>('global');
  const [sellerId, setSellerId] = useState<string>('');
  const [bookingOfficeId, setBookingOfficeId] = useState<string>('');
  const [courierProviderId, setCourierProviderId] = useState<string>('');
  const [zone, setZone] = useState<string>('A');
  const [markupPercent, setMarkupPercent] = useState<number>(30);
  const [flatMarkupAmount, setFlatMarkupAmount] = useState<number>(0);
  const [ruleName, setRuleName] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Dropdown options
  const [sellers, setSellers] = useState<any[]>([]);
  const [bookingOffices, setBookingOffices] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);

  useEffect(() => {
    // Fetch sellers and booking offices
    apiClient.get('/platform/sellers?limit=200')
      .then(res => {
        const list = res.data?.data?.sellers || res.data?.data?.rows || res.data?.data || [];
        setSellers(list);
        setBookingOffices(list.filter((s: any) => Boolean(s.is_booking_office)));
      })
      .catch(() => {});

    // Fetch courier providers
    apiClient.get('/platform/couriers')
      .then(res => {
        const list = res.data?.data?.providers || res.data?.data || [];
        setCouriers(list);
      })
      .catch(() => {});
  }, []);

  // When editingRule changes, populate fields
  useEffect(() => {
    if (editingRule) {
      setScope(editingRule.scope || 'global');
      setSellerId(editingRule.seller_id || '');
      setBookingOfficeId(editingRule.booking_office_id || '');
      setCourierProviderId(editingRule.courier_provider_id || '');
      setZone(editingRule.zone || 'A');
      setMarkupPercent(parseFloat(editingRule.markup_percent || 30));
      setFlatMarkupAmount(parseFloat(editingRule.flat_markup_amount || 0));
      setRuleName(editingRule.name || '');
    } else {
      resetForm();
    }
  }, [editingRule]);

  const resetForm = () => {
    setScope('global');
    setSellerId('');
    setBookingOfficeId('');
    setCourierProviderId('');
    setZone('A');
    setMarkupPercent(30);
    setFlatMarkupAmount(0);
    setRuleName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload: any = {
        scope,
        markup_percent: Number(markupPercent),
        flat_markup_amount: Number(flatMarkupAmount || 0),
        name: ruleName.trim() || null,
        seller_id: scope === 'seller' ? sellerId || null : null,
        booking_office_id: scope === 'booking_office' ? bookingOfficeId || null : null,
        courier_provider_id: ['courier', 'courier_zone'].includes(scope) ? courierProviderId || null : null,
        zone: ['zone', 'courier_zone'].includes(scope) ? zone : null,
      };

      if (editingRule?.id) {
        const res = await apiClient.put(`/platform/markup-config/${editingRule.id}`, payload);
        if (res.data?.success) {
          toast.success('Markup rule updated successfully!');
          onSuccess();
          if (onCancelEdit) onCancelEdit();
        } else {
          toast.error(res.data?.error?.message || 'Failed to update markup rule');
        }
      } else {
        const res = await apiClient.post('/platform/markup-config', payload);
        if (res.data?.success) {
          toast.success('New markup rule saved successfully!');
          resetForm();
          onSuccess();
        } else {
          toast.error(res.data?.error?.message || 'Failed to create markup rule');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Error saving markup rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-[#8410DC] flex items-center justify-center font-bold">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {editingRule ? 'Edit Markup Configuration Rule' : 'Configure New Markup Rule'}
            </h3>
            <p className="text-xs text-slate-500">
              Set markup percentages by Seller, Booking Office, Courier, Zone, or Global Default.
            </p>
          </div>
        </div>

        {editingRule && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
          >
            <X className="w-3.5 h-3.5" /> Cancel Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Scope Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Markup Rule Scope *
          </label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as any)}
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold bg-slate-50 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-[#8410DC]"
          >
            <option value="global">Global Default (All Sellers & Couriers)</option>
            <option value="seller">Seller-Wise (Specific Merchant Override)</option>
            <option value="booking_office">Booking Office-Wise (Retail Counter Branch)</option>
            <option value="courier">Courier-Wise (Delhivery, BlueDart, ST Courier...)</option>
            <option value="courier_zone">Courier + Zone-Wise (Carrier in Specific Zone)</option>
            <option value="zone">Zone-Wise (All Couriers in Specific Zone)</option>
          </select>
        </div>

        {/* Dynamic Seller Select */}
        {scope === 'seller' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Seller / Tenant Merchant *
            </label>
            <select
              required
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold bg-slate-50 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-[#8410DC]"
            >
              <option value="">-- Choose Seller Account --</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name || s.name} ({s.owner_email || s.email || s.subdomain})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic Booking Office Select */}
        {scope === 'booking_office' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Booking Office Counter *
            </label>
            <select
              required
              value={bookingOfficeId}
              onChange={(e) => setBookingOfficeId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold bg-slate-50 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-[#8410DC]"
            >
              <option value="">-- Choose Booking Office --</option>
              {bookingOffices.length === 0 ? (
                <option disabled>No booking offices enabled yet</option>
              ) : (
                bookingOffices.map((bo) => (
                  <option key={bo.id} value={bo.id}>
                    {bo.company_name || bo.name} ({bo.subdomain})
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {/* Dynamic Courier Select */}
        {['courier', 'courier_zone'].includes(scope) && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Courier Provider *
            </label>
            <select
              required
              value={courierProviderId}
              onChange={(e) => setCourierProviderId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold bg-slate-50 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-[#8410DC]"
            >
              <option value="">-- Choose Courier Provider --</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name || c.provider_name || c.name} ({c.provider_key || c.provider_code || c.key || ''})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic Zone Select */}
        {['zone', 'courier_zone'].includes(scope) && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Geographic Zone *
            </label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold bg-slate-50 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-[#8410DC]"
            >
              <option value="A">Zone A — Intra-City (Within City)</option>
              <option value="B">Zone B — Regional (Within State)</option>
              <option value="C">Zone C — Metro to Metro</option>
              <option value="D">Zone D — National (Rest of India)</option>
              <option value="E">Zone E — Special (North East / J&K)</option>
            </select>
          </div>
        )}

        {/* Markup Percentage */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Markup Percentage (%) *
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              max="500"
              required
              value={markupPercent}
              onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 p-2.5 pr-8 text-xs font-extrabold text-slate-900 bg-slate-50 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-[#8410DC]"
            />
            <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
          </div>
        </div>

        {/* Optional Flat Extra Markup */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Flat Extra Fee (₹ per shipment)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.50"
              min="0"
              value={flatMarkupAmount}
              onChange={(e) => setFlatMarkupAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-200 p-2.5 pr-8 text-xs font-extrabold text-slate-900 bg-slate-50 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-[#8410DC]"
            />
            <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
          </div>
        </div>

        {/* Rule Name / Description */}
        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Rule Description / Administrative Tag (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. VIP Seller 12% discounted margin or Kerala Monsoon special"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-900 bg-slate-50 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-[#8410DC]"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {editingRule && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 text-white font-extrabold text-xs shadow-sm cursor-pointer flex items-center gap-2 transition"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving Rule...' : editingRule ? 'Update Markup Rule' : 'Save Markup Rule'}
        </button>
      </div>
    </form>
  );
}
