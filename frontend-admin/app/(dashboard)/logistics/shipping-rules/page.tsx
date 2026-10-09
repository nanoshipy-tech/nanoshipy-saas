'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Sliders, Plus, RefreshCw, Search, ShieldCheck, Check, X,
  Trash2, Edit3, ArrowUp, ArrowDown, ChevronRight, Truck,
  Building2, Layers, AlertCircle, Sparkles, Filter, Store,
  CreditCard, Scale, Globe
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CourierOption {
  courier_key: string;
  name: string;
  weight_slab?: string;
  category: string;
  mode: string;
  provider_key: string;
}

interface CourierPriority {
  priority: number;
  courier_key: string;
  name: string;
  service_type?: string;
}

interface ShippingRule {
  id: string;
  name: string;
  priority: number;
  is_active: boolean;
  scope: 'global' | 'seller' | 'booking_office';
  tenant_id: string | null;
  pickup_address_id: string | null;
  payment_mode: 'all' | 'prepaid' | 'cod' | 'to_pay';
  zone: string;
  min_weight_kg: number;
  max_weight_kg: number;
  min_order_value?: number;
  max_order_value?: number;
  strategy: string;
  courier_priorities: CourierPriority[];
  tenant?: {
    id: string;
    company_name: string;
    subdomain: string;
  };
  pickupAddress?: {
    id: string;
    label: string;
    city: string;
    state: string;
    district?: string;
    pincode: string;
  };
  created_at: string;
}

export default function ShippingRulesPage() {
  const [rules, setRules] = useState<ShippingRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [availableCouriers, setAvailableCouriers] = useState<CourierOption[]>([]);
  const [sellersList, setSellersList] = useState<any[]>([]);
  const [officesList, setOfficesList] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    priority: number;
    scope: 'global' | 'seller' | 'booking_office';
    tenant_id: string;
    pickup_address_id: string;
    payment_mode: 'all' | 'prepaid' | 'cod' | 'to_pay';
    zone: string;
    min_weight_kg: number;
    max_weight_kg: number;
    courier_priorities: { courier_key: string; name: string }[];
  }>({
    name: '',
    priority: 1,
    scope: 'global',
    tenant_id: '',
    pickup_address_id: '',
    payment_mode: 'all',
    zone: 'all',
    min_weight_kg: 0.0,
    max_weight_kg: 999.0,
    courier_priorities: [
      { courier_key: '80622', name: 'Delhivery Surface' },
      { courier_key: '80593', name: 'XpressBees Surface' },
      { courier_key: '7377', name: 'Blue Dart Express (Air)' },
    ],
  });

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/platform/shipping-rules');
      if (res.data?.success) {
        setRules(res.data.data.rules || []);
      }
    } catch (err: any) {
      toast.error('Failed to load shipping allocation rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      // 1. Fetch available couriers
      const couriersRes = await apiClient.get('/platform/shipping-rules/couriers');
      if (couriersRes.data?.success) {
        setAvailableCouriers(couriersRes.data.data || []);
      }

      // 2. Fetch approved sellers
      const sellersRes = await apiClient.get('/platform/sellers?limit=100');
      if (sellersRes.data?.success) {
        const list = sellersRes.data.data?.tenants || sellersRes.data.data?.items || sellersRes.data.data || [];
        setSellersList(Array.isArray(list) ? list : []);
      }

      // 3. Fetch booking offices
      const officesRes = await apiClient.get('/counter-booking/offices');
      if (officesRes.data?.success) {
        const off = officesRes.data.data?.offices || officesRes.data.data || [];
        setOfficesList(Array.isArray(off) ? off : []);
      }
    } catch (err) {
      console.warn('Failed to load rule creation metadata:', err);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchMetadata();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingRuleId(null);
    setFormData({
      name: '',
      priority: rules.length + 1,
      scope: 'global',
      tenant_id: '',
      pickup_address_id: '',
      payment_mode: 'all',
      zone: 'all',
      min_weight_kg: 0.0,
      max_weight_kg: 999.0,
      courier_priorities: [
        { courier_key: '80622', name: 'Delhivery Surface 500g' },
        { courier_key: '80593', name: 'XpressBees Surface 500g' },
        { courier_key: '7377', name: 'Blue Dart Express Air' },
      ],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: ShippingRule) => {
    setEditingRuleId(rule.id);
    const existingPriorities = (rule.courier_priorities || []).map(cp => ({
      courier_key: cp.courier_key,
      name: cp.name,
    }));

    setFormData({
      name: rule.name,
      priority: rule.priority,
      scope: rule.scope,
      tenant_id: rule.tenant_id || '',
      pickup_address_id: rule.pickup_address_id || '',
      payment_mode: rule.payment_mode,
      zone: rule.zone,
      min_weight_kg: Number(rule.min_weight_kg) || 0.0,
      max_weight_kg: Number(rule.max_weight_kg) || 999.0,
      courier_priorities: existingPriorities.length > 0 ? existingPriorities : [
        { courier_key: '80622', name: 'Delhivery Surface 500g' },
      ],
    });
    setIsModalOpen(true);
  };

  const handleCourierSlotChange = (index: number, courierKey: string) => {
    const selectedObj = availableCouriers.find(c => c.courier_key === courierKey);
    const updated = [...formData.courier_priorities];
    updated[index] = {
      courier_key: courierKey,
      name: selectedObj?.name || courierKey,
    };
    setFormData(prev => ({ ...prev, courier_priorities: updated }));
  };

  const handleAddCourierSlot = () => {
    if (formData.courier_priorities.length >= 5) {
      toast.error('Maximum 5 prioritized couriers can be configured per rule.');
      return;
    }
    // Find first unused courier from catalog
    const usedKeys = new Set(formData.courier_priorities.map(c => c.courier_key));
    const nextUnused = availableCouriers.find(c => !usedKeys.has(c.courier_key)) || availableCouriers[0];
    if (nextUnused) {
      setFormData(prev => ({
        ...prev,
        courier_priorities: [
          ...prev.courier_priorities,
          { courier_key: nextUnused.courier_key, name: nextUnused.name },
        ],
      }));
    }
  };

  const handleRemoveCourierSlot = (index: number) => {
    if (formData.courier_priorities.length <= 1) {
      toast.error('At least 1 courier must be allocated for this rule.');
      return;
    }
    const updated = formData.courier_priorities.filter((_, idx) => idx !== index);
    setFormData(prev => ({ ...prev, courier_priorities: updated }));
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please enter a rule name.');
      return;
    }
    if (formData.scope === 'seller' && !formData.tenant_id) {
      toast.error('Please select an individual seller for this seller-specific rule.');
      return;
    }
    if (formData.scope === 'booking_office' && !formData.pickup_address_id) {
      toast.error('Please select an individual booking office for this office-specific rule.');
      return;
    }
    if (formData.courier_priorities.length === 0) {
      toast.error('Please configure at least 1 courier priority.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        priority: formData.priority,
        scope: formData.scope,
        tenant_id: formData.scope === 'seller' ? formData.tenant_id : null,
        pickup_address_id: formData.scope === 'booking_office' ? formData.pickup_address_id : null,
        payment_mode: formData.payment_mode,
        zone: formData.zone,
        min_weight_kg: formData.min_weight_kg,
        max_weight_kg: formData.max_weight_kg,
        courier_priorities: formData.courier_priorities,
      };

      if (editingRuleId) {
        const res = await apiClient.put(`/platform/shipping-rules/${editingRuleId}`, payload);
        if (res.data?.success) {
          toast.success('Shipping allocation rule updated successfully!');
          setIsModalOpen(false);
          fetchRules();
        }
      } else {
        const res = await apiClient.post('/platform/shipping-rules', payload);
        if (res.data?.success) {
          toast.success('New shipping allocation rule created successfully!');
          setIsModalOpen(false);
          fetchRules();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save shipping rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (rule: ShippingRule) => {
    try {
      const res = await apiClient.patch(`/platform/shipping-rules/${rule.id}/toggle`);
      if (res.data?.success) {
        toast.success(res.data.message || 'Status updated');
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
      }
    } catch {
      toast.error('Failed to toggle rule status');
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete shipping rule "${name}"?`)) return;
    try {
      const res = await apiClient.delete(`/platform/shipping-rules/${id}`);
      if (res.data?.success) {
        toast.success('Rule deleted successfully');
        setRules(prev => prev.filter(r => r.id !== id));
      }
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const filteredRules = rules.filter(r => {
    if (selectedScope !== 'all' && r.scope !== selectedScope) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = r.name.toLowerCase().includes(term);
    const sellerMatch = r.tenant?.company_name?.toLowerCase().includes(term);
    const officeMatch = r.pickupAddress?.label?.toLowerCase().includes(term) || r.pickupAddress?.city?.toLowerCase().includes(term);
    const courierMatch = (r.courier_priorities || []).some(cp => cp.name.toLowerCase().includes(term));
    return nameMatch || sellerMatch || officeMatch || courierMatch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 font-['Outfit',sans-serif]">
            <Sliders className="w-7 h-7 text-[#8410DC]" /> Shipping & Courier Allocation Rules
          </h1>
          <p className="text-xs text-[#7E7994] font-medium mt-1">
            Configure multi-courier priority rules (up to 5 couriers per rule) for individual sellers, booking offices, or globally by zone, weight, & payment mode.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchRules}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 text-white font-bold text-xs shadow-sm transition active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Shipping Rule
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Total Rules</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{rules.length}</div>
          <div className="text-[11px] text-slate-400 font-medium">Configured in platform</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Active Rules</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{rules.filter(r => r.is_active).length}</div>
          <div className="text-[11px] text-slate-400 font-medium">Auto-evaluating live</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Seller-Specific</span>
            <Store className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600">{rules.filter(r => r.scope === 'seller').length}</div>
          <div className="text-[11px] text-slate-400 font-medium">Tailored for sellers</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Booking Offices</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{rules.filter(r => r.scope === 'booking_office').length}</div>
          <div className="text-[11px] text-slate-400 font-medium">Walk-in counters</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search rule, merchant, or courier..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#8410DC]"
            />
          </div>

          <select
            value={selectedScope}
            onChange={e => setSelectedScope(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#8410DC]"
          >
            <option value="all">All Scopes</option>
            <option value="global">🌐 Global Platform</option>
            <option value="seller">🏷️ Specific Seller</option>
            <option value="booking_office">🏢 Specific Booking Office</option>
          </select>
        </div>

        <div className="text-xs font-bold text-slate-500">
          Showing <span className="text-slate-900">{filteredRules.length}</span> of {rules.length} rules
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center text-slate-400 font-bold text-xs flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#8410DC]" />
            <span>Loading shipping allocation rules...</span>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-black text-slate-800">No Shipping Rules Configured</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Create your first shipping allocation rule to auto-allocate specific couriers (e.g., Priority 1 Blue Dart, Priority 2 Delhivery) zone-wise, weight-wise, and COD/prepaid-wise.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8410DC] text-white font-bold text-xs hover:bg-[#6f0cb8] transition"
            >
              <Plus className="w-4 h-4" /> Create Rule Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-16 text-center">Rank</th>
                  <th className="py-3 px-4">Rule Name & Scope</th>
                  <th className="py-3 px-4">Target Account</th>
                  <th className="py-3 px-4">Conditions (Zone / Weight / Pay)</th>
                  <th className="py-3 px-4">Courier Priorities Fallback (1 - 5)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredRules.map((rule) => {
                  const priorities = rule.courier_priorities || [];

                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/70 transition">
                      {/* Priority Rank */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-purple-50 text-[#8410DC] font-black text-xs border border-purple-200">
                          #{rule.priority}
                        </span>
                      </td>

                      {/* Rule Name & Scope */}
                      <td className="py-4 px-4">
                        <div className="font-black text-slate-900 text-xs">{rule.name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {rule.scope === 'global' && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              🌐 Global Rule
                            </span>
                          )}
                          {rule.scope === 'seller' && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              🏷️ Individual Seller
                            </span>
                          )}
                          {rule.scope === 'booking_office' && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              🏢 Booking Office
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Target Account */}
                      <td className="py-4 px-4">
                        {rule.scope === 'global' ? (
                          <span className="text-slate-400 font-medium">All Merchants & Offices</span>
                        ) : rule.scope === 'seller' ? (
                          <div>
                            <p className="font-bold text-slate-900">{rule.tenant?.company_name || 'Specific Seller'}</p>
                            <p className="text-[10px] text-slate-400">{rule.tenant?.subdomain || rule.tenant_id?.slice(0, 8)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-bold text-slate-900">{rule.pickupAddress?.label || rule.pickupAddress?.city || 'Booking Counter'}</p>
                            <p className="text-[10px] text-slate-400">{rule.pickupAddress?.pincode} • {rule.pickupAddress?.district || rule.pickupAddress?.state}</p>
                          </div>
                        )}
                      </td>

                      {/* Conditions */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                            {rule.payment_mode === 'all' ? 'Any Payment' : rule.payment_mode.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                            {rule.min_weight_kg} - {rule.max_weight_kg >= 999 ? '∞' : rule.max_weight_kg} kg
                          </span>
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-[#8410DC] text-[10px] font-bold border border-purple-200">
                            {rule.zone === 'all' ? 'All Zones' : rule.zone}
                          </span>
                        </div>
                      </td>

                      {/* Courier Priorities Chain (1 - 5) */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1 max-w-md">
                          {priorities.map((cp, idx) => (
                            <React.Fragment key={idx}>
                              <span
                                className={`px-2 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1 shadow-2xs ${
                                  idx === 0
                                    ? 'bg-purple-100/80 text-[#5B069A] border-purple-300 font-extrabold'
                                    : idx === 1
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                                title={`Priority ${idx + 1}: ${cp.name} (Code: ${cp.courier_key})`}
                              >
                                <span className="opacity-70 text-[9px]">P{idx + 1}:</span>
                                <span>{cp.name}</span>
                                <span className="text-[8px] opacity-60 font-mono">[{cp.courier_key}]</span>
                              </span>
                              {idx < priorities.length - 1 && (
                                <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(rule)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition cursor-pointer border ${
                            rule.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {rule.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1.5 text-slate-500 hover:text-[#8410DC] rounded-lg hover:bg-purple-50 transition cursor-pointer"
                            title="Edit Rule"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT RULE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#8410DC] flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 font-['Outfit',sans-serif]">
                    {editingRuleId ? 'Edit Shipping Allocation Rule' : 'Create Shipping Allocation Rule'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Configure fallback priority order for up to 5 couriers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRule} className="p-6 space-y-5">
              {/* Rule Name & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-black text-slate-700">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. North Zone COD Heavy Express"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">Evaluation Priority #</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                  />
                  <p className="text-[10px] text-slate-400">Lower = runs first</p>
                </div>
              </div>

              {/* Scope Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700">Rule Scope Target *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scope: 'global' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      formData.scope === 'global'
                        ? 'border-[#8410DC] bg-purple-50 text-[#8410DC] ring-1 ring-[#8410DC]'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" /> Global
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scope: 'seller' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      formData.scope === 'seller'
                        ? 'border-[#8410DC] bg-purple-50 text-[#8410DC] ring-1 ring-[#8410DC]'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" /> Specific Seller
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scope: 'booking_office' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      formData.scope === 'booking_office'
                        ? 'border-[#8410DC] bg-purple-50 text-[#8410DC] ring-1 ring-[#8410DC]'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> Booking Office
                  </button>
                </div>
              </div>

              {/* Specific Seller / Booking Office Dropdowns */}
              {formData.scope === 'seller' && (
                <div className="space-y-1.5 bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200">
                  <label className="text-xs font-black text-blue-900">Select Individual Seller *</label>
                  <select
                    value={formData.tenant_id}
                    onChange={e => setFormData({ ...formData, tenant_id: e.target.value })}
                    className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                  >
                    <option value="">-- Choose Seller Account --</option>
                    {sellersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.company_name || s.name || s.subdomain} ({s.email || s.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.scope === 'booking_office' && (
                <div className="space-y-1.5 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
                  <label className="text-xs font-black text-amber-900">Select Individual Booking Office Branch *</label>
                  <select
                    value={formData.pickup_address_id}
                    onChange={e => setFormData({ ...formData, pickup_address_id: e.target.value })}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                  >
                    <option value="">-- Choose Booking Office Hub --</option>
                    {officesList.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label || o.city || 'Counter'} ({o.pincode} - {o.district || o.state})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rule Match Conditions (Zone / Weight / Payment Mode) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">Payment Mode</label>
                  <select
                    value={formData.payment_mode}
                    onChange={e => setFormData({ ...formData, payment_mode: e.target.value as any })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#8410DC]"
                  >
                    <option value="all">Any Payment (Prepaid & COD)</option>
                    <option value="prepaid">Prepaid Only</option>
                    <option value="cod">Cash on Delivery (COD) Only</option>
                    <option value="to_pay">To-Pay (Counter Walk-in)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">Weight Slab (kg)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.min_weight_kg}
                      onChange={e => setFormData({ ...formData, min_weight_kg: parseFloat(e.target.value) || 0 })}
                      placeholder="Min"
                      className="w-1/2 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                    <span className="text-slate-400 font-bold">-</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.max_weight_kg}
                      onChange={e => setFormData({ ...formData, max_weight_kg: parseFloat(e.target.value) || 999 })}
                      placeholder="Max"
                      className="w-1/2 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">Delivery Zone</label>
                  <select
                    value={formData.zone}
                    onChange={e => setFormData({ ...formData, zone: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#8410DC]"
                  >
                    <option value="all">All Zones</option>
                    <option value="intra_state">Intra-State / Tamil Nadu (Zone A)</option>
                    <option value="regional">Regional / Neighboring (Zone B)</option>
                    <option value="metro">Metro to Metro (Zone C)</option>
                    <option value="rest_of_india">Rest of India (Zone D)</option>
                    <option value="special">Special / NE / J&K (Zone E)</option>
                  </select>
                </div>
              </div>

              {/* COURIER ALLOCATION CHAIN (UP TO 5 COURIERS) */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-[#8410DC]" /> Prioritized Fallback Courier Chain (Up to 5)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Evaluated in sequence: if Priority 1 is unserviceable, Priority 2 is selected automatically.
                    </p>
                  </div>

                  {formData.courier_priorities.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddCourierSlot}
                      className="text-xs font-bold text-[#8410DC] hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Fallback Slot ({formData.courier_priorities.length}/5)
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {formData.courier_priorities.map((slot, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl border transition ${
                        index === 0
                          ? 'border-purple-300 bg-purple-50/50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        index === 0
                          ? 'bg-[#8410DC] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        #{index + 1}
                      </span>

                      <div className="flex-1">
                        <select
                          value={slot.courier_key}
                          onChange={e => handleCourierSlotChange(index, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                        >
                          {availableCouriers.map(c => (
                            <option key={c.courier_key} value={c.courier_key}>
                              {c.name} [Code: {c.courier_key}] ({c.mode}) — {c.category}
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="text-[11px] font-bold text-slate-400 shrink-0">
                        {index === 0 ? 'Primary' : `Fallback ${index}`}
                      </span>

                      {formData.courier_priorities.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCourierSlot(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          title="Remove this fallback priority"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : (editingRuleId ? 'Update Shipping Rule' : 'Create & Activate Rule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
