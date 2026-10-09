'use client';

import { apiClient } from '@/lib/apiClient';
import React, { useState, useEffect, useRef } from 'react';
import MarkupConfigForm from '@/components/pricing/MarkupConfigForm';
import { Percent, Edit3, Trash2, ShieldCheck, AlertCircle, RefreshCw, Layers, Building2, Truck, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MarkupConfigPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // COD & RTO configuration state
  const [codConfig, setCodConfig] = useState<any>(null);
  const [rtoConfig, setRtoConfig] = useState<any>(null);
  const [savingCodRto, setSavingCodRto] = useState(false);
  const [codForm, setCodForm] = useState({ flat_charge: 30, percent_charge: 2, surcharge_percent: 10 });

  const formRef = useRef<HTMLDivElement>(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/platform/markup-config');
      if (res.data?.success && res.data?.data) {
        setRules(res.data.data.markups || []);
        if (res.data.data.cod) {
          setCodConfig(res.data.data.cod);
          setCodForm(prev => ({
            ...prev,
            flat_charge: parseFloat(res.data.data.cod.flat_charge || 30),
            percent_charge: parseFloat(res.data.data.cod.percent_charge || 2),
          }));
        }
        if (res.data.data.rto) {
          setRtoConfig(res.data.data.rto);
          setCodForm(prev => ({
            ...prev,
            surcharge_percent: parseFloat(res.data.data.rto.surcharge_percent || 10),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch markup rules:', err);
      toast.error('Failed to load markup configuration rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleEditClick = (rule: any) => {
    setEditingRule(rule);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this markup configuration rule?')) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await apiClient.delete(`/platform/markup-config/${id}`);
      if (res.data?.success) {
        toast.success('Markup rule deleted successfully!');
        if (editingRule?.id === id) {
          setEditingRule(null);
        }
        fetchRules();
      } else {
        toast.error(res.data?.error?.message || 'Failed to delete markup rule');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error deleting rule');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveCodRto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCodRto(true);
    try {
      const res = await apiClient.put('/platform/cod-rto-config', codForm);
      if (res.data?.success) {
        toast.success('COD & RTO charges updated successfully!');
        fetchRules();
      } else {
        toast.error(res.data?.error?.message || 'Failed to update COD/RTO configuration');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error updating configuration');
    } finally {
      setSavingCodRto(false);
    }
  };

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'seller':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><Building2 className="w-3 h-3" /> Seller</span>;
      case 'booking_office':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><Layers className="w-3 h-3" /> Booking Office</span>;
      case 'courier':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Truck className="w-3 h-3" /> Courier</span>;
      case 'courier_zone':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1"><Layers className="w-3 h-3" /> Courier+Zone</span>;
      case 'zone':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">Zone</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1"><Globe className="w-3 h-3" /> Global</span>;
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5 font-['Outfit',sans-serif]">
            <Percent className="w-7 h-7 text-[#8410DC]" /> Shipping Markup Configuration
          </h1>
          <p className="text-xs text-[#7E7994] font-bold mt-1">
            Dynamic carrier margin rules (Seller-wise → Booking Office → Courier+Zone → Courier → Global default)
          </p>
        </div>
        <button
          onClick={fetchRules}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 font-bold text-xs shadow-xs transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Rules
        </button>
      </div>

      {/* Form Anchor */}
      <div ref={formRef}>
        <MarkupConfigForm
          onSuccess={fetchRules}
          editingRule={editingRule}
          onCancelEdit={() => setEditingRule(null)}
        />
      </div>

      {/* Active Rules Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 p-4.5 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Saved Markup Rules ({rules.length})
            </h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Rules apply in order of specificity. Click &quot;Edit&quot; to modify or update any saved rule.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Target Entity / Detail</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Markup %</th>
                <th className="px-4 py-3">Flat Fee</th>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400 font-bold">
                    Loading markup rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400 font-bold">
                    No custom rules found. The system defaults to 30.00% global markup.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => {
                  let targetText = 'All Sellers & Couriers';
                  if (rule.scope === 'seller') {
                    targetText = rule.seller?.company_name
                      ? `${rule.seller.company_name} (${rule.seller.subdomain})`
                      : rule.seller_id;
                  } else if (rule.scope === 'booking_office') {
                    targetText = rule.booking_office?.company_name
                      ? `${rule.booking_office.company_name} (${rule.booking_office.subdomain})`
                      : rule.booking_office_id;
                  } else if (['courier', 'courier_zone'].includes(rule.scope)) {
                    const cName = rule.courier_provider?.display_name || rule.courier_provider?.provider_name;
                    const cKey = rule.courier_provider?.provider_key || rule.courier_provider?.provider_code;
                    targetText = cName ? `${cName} (${cKey || ''})` : rule.courier_provider_id || 'All Couriers';
                  }

                  return (
                    <tr
                      key={rule.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        editingRule?.id === rule.id ? 'bg-purple-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5">{getScopeBadge(rule.scope)}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-extrabold text-slate-900">{targetText}</p>
                        {rule.name && (
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{rule.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {rule.zone ? (
                          <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-purple-50 text-[#8410DC] border border-purple-100">
                            Zone {rule.zone}
                          </span>
                        ) : (
                          <span className="text-slate-400">All Zones</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-black text-sm text-emerald-600">
                          {rule.markup_percent}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {parseFloat(rule.flat_markup_amount) > 0 ? (
                          <span className="font-bold text-xs text-indigo-600">
                            +₹{parseFloat(rule.flat_markup_amount).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">
                        {rule.effective_from || 'Always'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditClick(rule)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#8410DC] font-black text-xs transition cursor-pointer flex items-center gap-1"
                            title="Edit this rule"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === rule.id}
                            onClick={() => handleDeleteRule(rule.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-xs transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            title="Delete this rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COD & RTO Settings Card */}
      <form onSubmit={handleSaveCodRto} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              COD Charges & RTO Surcharge Rules
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Applied automatically during order quote calculation for Cash on Delivery and Return to Origin shipments.
            </p>
          </div>
          <button
            type="submit"
            disabled={savingCodRto}
            className="px-4 py-2 rounded-xl bg-[#8410DC] hover:bg-[#6c0cb5] text-white font-extrabold text-xs shadow-xs cursor-pointer transition"
          >
            {savingCodRto ? 'Saving...' : 'Update COD / RTO Rules'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">COD Flat Minimum Fee (₹)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={codForm.flat_charge}
              onChange={e => setCodForm(prev => ({ ...prev, flat_charge: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-900 bg-slate-50 focus:bg-white outline-none focus:border-[#8410DC]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">COD Percentage of Order Value (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={codForm.percent_charge}
              onChange={e => setCodForm(prev => ({ ...prev, percent_charge: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-900 bg-slate-50 focus:bg-white outline-none focus:border-[#8410DC]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">RTO Return Surcharge (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={codForm.surcharge_percent}
              onChange={e => setCodForm(prev => ({ ...prev, surcharge_percent: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-900 bg-slate-50 focus:bg-white outline-none focus:border-[#8410DC]"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
