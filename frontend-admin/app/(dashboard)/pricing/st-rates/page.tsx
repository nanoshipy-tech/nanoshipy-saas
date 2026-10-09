'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  MapPin, Plus, Search, Edit2, Trash2, Check, X,
  ShieldCheck, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

interface DistrictRate {
  id: string;
  destination_district: string;
  first_500g_rate: string | number;
  additional_500g_rate: string | number;
  above_10kg_per_kg_rate: string | number;
  cod_first_500g_rate: string | number;
  cod_additional_500g_rate: string | number;
  cod_above_10kg_per_kg_rate: string | number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function StCourierDistrictRatesPage() {
  const [rates, setRates] = useState<DistrictRate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<DistrictRate>>({});
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newFormData, setNewFormData] = useState({
    destination_district: '',
    first_500g_rate: '30.00',
    additional_500g_rate: '15.00',
    above_10kg_per_kg_rate: '25.00',
    cod_first_500g_rate: '50.00',
    cod_additional_500g_rate: '20.00',
    cod_above_10kg_per_kg_rate: '35.00',
    is_active: true,
  });
  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/platform/st-courier-district-rates');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setRates(res.data.data);
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error?.message || 'Failed to fetch ST Courier district rates' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleStartEdit = (rate: DistrictRate) => {
    setEditingId(rate.id);
    setEditFormData({ ...rate });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editFormData.destination_district) return;
    setSaving(true);
    setMsg(null);
    try {
      // Only send clean rate fields + id — exclude created_at / updated_at
      const payload = {
        id:                         editingId,
        destination_district:       editFormData.destination_district,
        first_500g_rate:            editFormData.first_500g_rate,
        additional_500g_rate:       editFormData.additional_500g_rate,
        above_10kg_per_kg_rate:     editFormData.above_10kg_per_kg_rate,
        cod_first_500g_rate:        editFormData.cod_first_500g_rate,
        cod_additional_500g_rate:   editFormData.cod_additional_500g_rate,
        cod_above_10kg_per_kg_rate: editFormData.cod_above_10kg_per_kg_rate,
        is_active:                  editFormData.is_active,
      };
      const res = await apiClient.post('/platform/st-courier-district-rates', payload);
      if (res.data?.success) {
        setMsg({ type: 'success', text: `Rate card for ${editFormData.destination_district} updated successfully!` });
        setEditingId(null);
        fetchRates();
      } else {
        throw new Error(res.data?.error?.message || 'Update failed');
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error?.message || err.message || 'Error updating rate' });
    } finally {
      setSaving(false);
    }
  };


  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormData.destination_district.trim()) {
      setMsg({ type: 'error', text: 'District name is required' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiClient.post('/platform/st-courier-district-rates', newFormData);
      if (res.data?.success) {
        setMsg({ type: 'success', text: `Rate card for ${newFormData.destination_district} created successfully!` });
        setIsAddingNew(false);
        setNewFormData({
          destination_district: '',
          first_500g_rate: '30.00',
          additional_500g_rate: '15.00',
          above_10kg_per_kg_rate: '25.00',
          cod_first_500g_rate: '50.00',
          cod_additional_500g_rate: '20.00',
          cod_above_10kg_per_kg_rate: '35.00',
          is_active: true,
        });
        fetchRates();
      } else {
        throw new Error(res.data?.error?.message || 'Creation failed');
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error?.message || err.message || 'Error creating rate card' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete rate card for "${name}"?`)) return;
    setSaving(true);
    try {
      const res = await apiClient.delete(`/platform/st-courier-district-rates/${id}`);
      if (res.data?.success) {
        setMsg({ type: 'success', text: `Rate card for ${name} removed` });
        fetchRates();
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error?.message || 'Error deleting rate card' });
    } finally {
      setSaving(false);
    }
  };

  const filteredRates = rates.filter((r) =>
    r.destination_district.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#8410DC] hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Pricing Hub
          </Link>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 font-['Outfit',sans-serif]">
            <MapPin className="w-7 h-7 text-[#8410DC]" /> ST Courier District-Wise Rate Cards
          </h1>
          <p className="text-xs text-[#7E7994] font-bold mt-0.5">
            Configurable slab (first 500g, additional 500g up to 10kg) and bulk pricing (&gt;10kg flat per-kg), plus distinct COD rate card for Tamil Nadu districts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRates}
            disabled={loading}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddingNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#8410DC] hover:bg-[#700dbb] text-white text-xs font-black rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Add District Rate Card
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {msg && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between gap-3 ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add New Modal / Card */}
      {isAddingNew && (
        <div className="bg-white border-2 border-purple-300 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#8410DC]" /> New District Rate Card Configuration
            </h3>
            <button
              onClick={() => setIsAddingNew(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateNew} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-4">
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Destination District Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chennai, Coimbatore, Madurai..."
                  value={newFormData.destination_district}
                  onChange={(e) => setNewFormData({ ...newFormData, destination_district: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                  required
                />
              </div>

              {/* Prepaid Card */}
              <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                <span className="text-[10px] font-black uppercase text-purple-700 block">
                  Prepaid: First 500g (₹)
                </span>
                <input
                  type="number"
                  step="0.50"
                  value={newFormData.first_500g_rate}
                  onChange={(e) => setNewFormData({ ...newFormData, first_500g_rate: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                <span className="text-[10px] font-black uppercase text-purple-700 block">
                  Prepaid: Addl 500g (₹)
                </span>
                <input
                  type="number"
                  step="0.50"
                  value={newFormData.additional_500g_rate}
                  onChange={(e) => setNewFormData({ ...newFormData, additional_500g_rate: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                <span className="text-[10px] font-black uppercase text-purple-700 block">
                  Prepaid: &gt;10kg /kg (₹)
                </span>
                <input
                  type="number"
                  step="0.50"
                  value={newFormData.above_10kg_per_kg_rate}
                  onChange={(e) => setNewFormData({ ...newFormData, above_10kg_per_kg_rate: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-700 block">
                  Status
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFormData.is_active}
                    onChange={(e) => setNewFormData({ ...newFormData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8410DC]"></div>
                </label>
              </div>

              {/* COD Card */}
              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-3">
                <span className="text-[10px] font-black uppercase text-amber-800 block">
                  COD: First 500g (₹)
                </span>
                <input
                  type="number"
                  step="0.50"
                  value={newFormData.cod_first_500g_rate}
                  onChange={(e) => setNewFormData({ ...newFormData, cod_first_500g_rate: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-3">
                <span className="text-[10px] font-black uppercase text-amber-800 block">
                  COD: Addl 500g (₹)
                </span>
                <input
                  type="number"
                  step="0.50"
                  value={newFormData.cod_additional_500g_rate}
                  onChange={(e) => setNewFormData({ ...newFormData, cod_additional_500g_rate: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-3">
                <span className="text-[10px] font-black uppercase text-amber-800 block">
                  COD: &gt;10kg /kg (₹)
                </span>
                <input
                  type="number"
                  step="0.50"
                  value={newFormData.cod_above_10kg_per_kg_rate}
                  onChange={(e) => setNewFormData({ ...newFormData, cod_above_10kg_per_kg_rate: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="flex items-end justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-black bg-[#8410DC] hover:bg-[#700dbb] text-white rounded-xl shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Rate Card'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search districts (e.g. Chennai, Coimbatore, Madurai)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <span className="text-xs font-bold text-[#7E7994]">
          Showing {filteredRates.length} configured districts
        </span>
      </div>

      {/* Rates Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">District</th>
                <th className="py-3 px-3 text-purple-700 bg-purple-50/50">Prepaid 1st 500g</th>
                <th className="py-3 px-3 text-purple-700 bg-purple-50/50">Prepaid Addl 500g</th>
                <th className="py-3 px-3 text-purple-700 bg-purple-50/50">Prepaid &gt;10kg/kg</th>
                <th className="py-3 px-3 text-amber-800 bg-amber-50/50">COD 1st 500g</th>
                <th className="py-3 px-3 text-amber-800 bg-amber-50/50">COD Addl 500g</th>
                <th className="py-3 px-3 text-amber-800 bg-amber-50/50">COD &gt;10kg/kg</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8410DC]" />
                    Loading ST Courier district rate cards...
                  </td>
                </tr>
              ) : filteredRates.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                    No district rate cards found. Click "Add District Rate Card" to configure.
                  </td>
                </tr>
              ) : (
                filteredRates.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors font-medium">
                      {/* District Name */}
                      <td className="py-3 px-4 font-black text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editFormData.destination_district || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, destination_district: e.target.value })}
                            className="px-2 py-1 text-xs border border-purple-300 rounded font-bold w-full"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[#8410DC]" />
                            <span>{r.destination_district}</span>
                          </div>
                        )}
                      </td>

                      {/* Prepaid 1st 500g */}
                      <td className="py-3 px-3 bg-purple-50/20 font-bold text-slate-800">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.50"
                            value={editFormData.first_500g_rate ?? ''}
                            onChange={(e) => setEditFormData({ ...editFormData, first_500g_rate: e.target.value })}
                            className="px-2 py-1 text-xs border border-purple-300 rounded w-20 font-bold"
                          />
                        ) : (
                          `₹${parseFloat(String(r.first_500g_rate)).toFixed(2)}`
                        )}
                      </td>

                      {/* Prepaid Addl 500g */}
                      <td className="py-3 px-3 bg-purple-50/20 font-bold text-slate-800">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.50"
                            value={editFormData.additional_500g_rate ?? ''}
                            onChange={(e) => setEditFormData({ ...editFormData, additional_500g_rate: e.target.value })}
                            className="px-2 py-1 text-xs border border-purple-300 rounded w-20 font-bold"
                          />
                        ) : (
                          `₹${parseFloat(String(r.additional_500g_rate)).toFixed(2)}`
                        )}
                      </td>

                      {/* Prepaid >10kg /kg */}
                      <td className="py-3 px-3 bg-purple-50/20 font-bold text-slate-800">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.50"
                            value={editFormData.above_10kg_per_kg_rate ?? ''}
                            onChange={(e) => setEditFormData({ ...editFormData, above_10kg_per_kg_rate: e.target.value })}
                            className="px-2 py-1 text-xs border border-purple-300 rounded w-20 font-bold"
                          />
                        ) : (
                          `₹${parseFloat(String(r.above_10kg_per_kg_rate)).toFixed(2)}/kg`
                        )}
                      </td>

                      {/* COD 1st 500g */}
                      <td className="py-3 px-3 bg-amber-50/20 font-bold text-amber-900">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.50"
                            value={editFormData.cod_first_500g_rate ?? ''}
                            onChange={(e) => setEditFormData({ ...editFormData, cod_first_500g_rate: e.target.value })}
                            className="px-2 py-1 text-xs border border-amber-300 rounded w-20 font-bold"
                          />
                        ) : (
                          `₹${parseFloat(String(r.cod_first_500g_rate)).toFixed(2)}`
                        )}
                      </td>

                      {/* COD Addl 500g */}
                      <td className="py-3 px-3 bg-amber-50/20 font-bold text-amber-900">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.50"
                            value={editFormData.cod_additional_500g_rate ?? ''}
                            onChange={(e) => setEditFormData({ ...editFormData, cod_additional_500g_rate: e.target.value })}
                            className="px-2 py-1 text-xs border border-amber-300 rounded w-20 font-bold"
                          />
                        ) : (
                          `₹${parseFloat(String(r.cod_additional_500g_rate)).toFixed(2)}`
                        )}
                      </td>

                      {/* COD >10kg /kg */}
                      <td className="py-3 px-3 bg-amber-50/20 font-bold text-amber-900">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.50"
                            value={editFormData.cod_above_10kg_per_kg_rate ?? ''}
                            onChange={(e) => setEditFormData({ ...editFormData, cod_above_10kg_per_kg_rate: e.target.value })}
                            className="px-2 py-1 text-xs border border-amber-300 rounded w-20 font-bold"
                          />
                        ) : (
                          `₹${parseFloat(String(r.cod_above_10kg_per_kg_rate)).toFixed(2)}/kg`
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={Boolean(editFormData.is_active)}
                            onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                            className="rounded text-[#8410DC]"
                          />
                        ) : r.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={handleSaveEdit}
                              disabled={saving}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={saving}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleStartEdit(r)}
                              className="p-1.5 text-slate-500 hover:text-[#8410DC] hover:bg-purple-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id, r.destination_district)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
