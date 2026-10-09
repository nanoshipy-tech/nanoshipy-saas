'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import {
  Ticket, Plus, Search, RefreshCw, Edit2, Trash2, CheckCircle2,
  XCircle, Copy, AlertCircle, Sparkles, Percent, DollarSign, Calendar, Users
} from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  benefit_type: 'bonus_credit' | 'discount';
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_recharge_amount: number;
  max_discount_amount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit_total: number | null;
  usage_limit_per_user: number;
  used_count: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState({
    total_coupons: 0,
    active_coupons: 0,
    total_redemptions: 0,
    total_benefit_given: '0.00',
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    benefit_type: 'bonus_credit' as 'bonus_credit' | 'discount',
    discount_type: 'percentage' as 'percentage' | 'flat',
    discount_value: '',
    min_recharge_amount: '',
    max_discount_amount: '',
    valid_from: '',
    valid_until: '',
    usage_limit_total: '',
    usage_limit_per_user: '1',
    is_active: true,
  });

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, [statusFilter]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;

      const res = await apiClient.get('/platform/coupons', { params });
      if (res.data?.success) {
        setCoupons(res.data.data.coupons || []);
        setStats(res.data.data.stats || {
          total_coupons: 0,
          active_coupons: 0,
          total_redemptions: 0,
          total_benefit_given: '0.00',
        });
      }
    } catch (err: any) {
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCoupons();
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      benefit_type: 'bonus_credit',
      discount_type: 'percentage',
      discount_value: '',
      min_recharge_amount: '500',
      max_discount_amount: '',
      valid_from: '',
      valid_until: '',
      usage_limit_total: '',
      usage_limit_per_user: '1',
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description || '',
      benefit_type: coupon.benefit_type,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value.toString(),
      min_recharge_amount: coupon.min_recharge_amount ? coupon.min_recharge_amount.toString() : '0',
      max_discount_amount: coupon.max_discount_amount ? coupon.max_discount_amount.toString() : '',
      valid_from: coupon.valid_from ? coupon.valid_from.substring(0, 10) : '',
      valid_until: coupon.valid_until ? coupon.valid_until.substring(0, 10) : '',
      usage_limit_total: coupon.usage_limit_total ? coupon.usage_limit_total.toString() : '',
      usage_limit_per_user: coupon.usage_limit_per_user.toString(),
      is_active: coupon.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.title || !formData.discount_value) {
      toast.error('Code, title, and value are required');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        code: formData.code.trim().toUpperCase(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        benefit_type: formData.benefit_type,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        min_recharge_amount: parseFloat(formData.min_recharge_amount) || 0,
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        valid_from: formData.valid_from || null,
        valid_until: formData.valid_until || null,
        usage_limit_total: formData.usage_limit_total ? parseInt(formData.usage_limit_total) : null,
        usage_limit_per_user: parseInt(formData.usage_limit_per_user) || 1,
        is_active: formData.is_active,
      };

      if (editingCoupon) {
        await apiClient.put(`/platform/coupons/${editingCoupon.id}`, payload);
        toast.success(`Coupon ${payload.code} updated successfully`);
      } else {
        await apiClient.post('/platform/coupons', payload);
        toast.success(`Coupon ${payload.code} created successfully`);
      }

      setShowModal(false);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      await apiClient.patch(`/platform/coupons/${coupon.id}/toggle`, {});
      toast.success(`Coupon ${coupon.code} ${coupon.is_active ? 'deactivated' : 'activated'}`);
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
    } catch (err: any) {
      toast.error('Failed to change status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/platform/coupons/${id}`);
      toast.success('Coupon deleted successfully');
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      toast.error('Failed to delete coupon');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied "${text}" to clipboard`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#8410DC]/10 flex items-center justify-center text-[#8410DC]">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Wallet Recharge Coupons
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create and manage promotional bonus and discount codes for merchant wallet recharges
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCoupons}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#8410DC] hover:bg-[#700dbb] text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create Coupon
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Coupons</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.total_coupons}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active Coupons</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {stats.active_coupons}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8410DC]">Total Redemptions</span>
          <div className="text-2xl font-black text-[#8410DC] mt-1">
            {stats.total_redemptions}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Total Benefits Given</span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            ₹{parseFloat(stats.total_benefit_given).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code or title..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-[#8410DC] text-slate-800 dark:text-slate-100"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                statusFilter === s
                  ? 'bg-[#8410DC] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Coupon Code</th>
                <th className="px-5 py-3.5">Title & Description</th>
                <th className="px-5 py-3.5">Benefit Type</th>
                <th className="px-5 py-3.5">Value</th>
                <th className="px-5 py-3.5">Min Recharge / Cap</th>
                <th className="px-5 py-3.5">Usage / Limit</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8410DC]" />
                    Loading coupons...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No coupon codes found. Click "Create Coupon" to create one.
                  </td>
                </tr>
              ) : (
                coupons.map(coupon => {
                  const isBonus = coupon.benefit_type === 'bonus_credit';
                  return (
                    <tr key={coupon.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-sm px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-[#8410DC] dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-800">
                            {coupon.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(coupon.code)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                            title="Copy code"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{coupon.title}</div>
                        {coupon.description && (
                          <div className="text-[11px] text-slate-400 max-w-xs truncate">{coupon.description}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isBonus ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Sparkles className="w-3 h-3" />
                            Bonus Wallet Credit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Percent className="w-3 h-3" />
                            Payment Discount
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {coupon.discount_type === 'percentage'
                            ? `${coupon.discount_value}%`
                            : `₹${parseFloat(coupon.discount_value.toString()).toFixed(2)}`}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[11px] space-y-0.5">
                        <div>Min: <strong className="text-slate-800 dark:text-slate-100">₹{coupon.min_recharge_amount}</strong></div>
                        {coupon.max_discount_amount && (
                          <div className="text-slate-400">Cap: ₹{coupon.max_discount_amount}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[11px]">
                        <span className="font-bold text-slate-900 dark:text-white">{coupon.used_count}</span>
                        <span className="text-slate-400"> / {coupon.usage_limit_total || '∞'} uses</span>
                        <div className="text-[10px] text-slate-400">{coupon.usage_limit_per_user} per merchant</div>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleStatus(coupon)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                            coupon.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {coupon.is_active ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right space-x-1">
                        <button
                          onClick={() => openEditModal(coupon)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#8410DC] hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Edit coupon"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Delete coupon"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#8410DC]/10 flex items-center justify-center text-[#8410DC]">
                  <Ticket className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Wallet Coupon'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Code & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. EXTRA100"
                    className="w-full font-mono font-bold px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white uppercase"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Auto-converted to uppercase</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Title / Campaign *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Diwali ₹100 Bonus"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Get ₹100 extra wallet credits on recharges of ₹500 or more"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white"
                />
              </div>

              {/* Benefit Type Selector */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1.5">
                  Coupon Benefit Mode *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      formData.benefit_type === 'bonus_credit'
                        ? 'border-[#8410DC] bg-purple-50/50 dark:bg-purple-950/20 text-[#8410DC]'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="benefit_type"
                      value="bonus_credit"
                      checked={formData.benefit_type === 'bonus_credit'}
                      onChange={() => setFormData({ ...formData, benefit_type: 'bonus_credit' })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs">Extra Bonus Credit (Recommended)</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Seller pays full recharge amount; extra bonus is added directly to their wallet balance.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      formData.benefit_type === 'discount'
                        ? 'border-[#8410DC] bg-purple-50/50 dark:bg-purple-950/20 text-[#8410DC]'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="benefit_type"
                      value="discount"
                      checked={formData.benefit_type === 'discount'}
                      onChange={() => setFormData({ ...formData, benefit_type: 'discount' })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs">Payment Discount</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Seller gets a direct discount on the checkout price while full recharge is credited.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Value & Calculation Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Value Type *
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={e => setFormData({ ...formData, discount_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white font-bold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Value ({formData.discount_type === 'percentage' ? '%' : '₹'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min={1}
                    max={formData.discount_type === 'percentage' ? 100 : 500000}
                    value={formData.discount_value}
                    onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder={formData.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 100'}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white font-black"
                  />
                </div>
              </div>

              {/* Min Recharge & Max Cap */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Min. Recharge Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.min_recharge_amount}
                    onChange={e => setFormData({ ...formData, min_recharge_amount: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">0 for no minimum</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Max Bonus / Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.max_discount_amount}
                    onChange={e => setFormData({ ...formData, max_discount_amount: e.target.value })}
                    placeholder="Optional cap (e.g. 500)"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Caps percentage calculations</span>
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Total Redemptions Cap
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.usage_limit_total}
                    onChange={e => setFormData({ ...formData, usage_limit_total: e.target.value })}
                    placeholder="Leave empty for unlimited"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Uses Per Merchant *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.usage_limit_per_user}
                    onChange={e => setFormData({ ...formData, usage_limit_per_user: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Valid Until (Expiry)
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#8410DC] text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="coupon_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#8410DC] rounded focus:ring-[#8410DC]"
                />
                <label htmlFor="coupon_active" className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Activate this coupon immediately
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#8410DC] hover:bg-[#700dbb] text-white rounded-xl font-bold shadow-sm transition disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : editingCoupon ? 'Save Changes' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
