'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Package, CheckCircle2, AlertTriangle, XCircle,
  Upload, Search, Filter, Trash2, RefreshCw,
  FileText, ShieldCheck, MapPin, Tag, Plus, Check, X
} from 'lucide-react';
import toast from 'react-hot-toast';

const TN_DISTRICTS = [
  'All',
  'Chennai',
  'Coimbatore',
  'Madurai',
  'Salem',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tiruppur',
  'Erode',
  'Vellore',
  'Thoothukudi',
  'Dindigul',
  'Thanjavur',
  'Ranipet',
  'Virudhunagar',
  'Karur',
  'Nilgiris',
  'Kanchipuram',
  'Chengalpattu',
  'Tiruvallur',
];

export default function AwbPoolPage() {
  const [stats, setStats] = useState<any>(null);
  const [awbs, setAwbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter & Pagination States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Upload Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploadDistrict, setUploadDistrict] = useState('All');
  const [uploadPaymentMode, setUploadPaymentMode] = useState('both');
  const [uploadBatchId, setUploadBatchId] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchAwbs();
  }, [page, statusFilter, districtFilter, paymentFilter]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await apiClient.get('/platform/st-courier-awb/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch AWB pool stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchAwbs = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 25 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (districtFilter !== 'all') params.origin_district = districtFilter;
      if (paymentFilter !== 'all') params.payment_mode = paymentFilter;
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/platform/st-courier-awb', { params });
      if (res.data.success) {
        setAwbs(res.data.data.awbs || []);
        setTotalPages(res.data.data.totalPages || 1);
        setTotalCount(res.data.data.total || 0);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load AWB inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAwbs();
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadText.trim()) {
      toast.error('Please enter or paste at least one AWB number.');
      return;
    }

    try {
      setUploading(true);
      const payload = {
        awb_text: uploadText,
        origin_district: uploadDistrict,
        payment_mode: uploadPaymentMode,
        batch_id: uploadBatchId.trim() || undefined,
        notes: uploadNotes.trim() || undefined,
      };

      const res = await apiClient.post('/platform/st-courier-awb/upload', payload);
      if (res.data.success) {
        toast.success(res.data.message || 'AWBs uploaded successfully');
        setUploadModalOpen(false);
        setUploadText('');
        setUploadBatchId('');
        setUploadNotes('');
        fetchStats();
        fetchAwbs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload AWBs');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAwb = async (id: string, awbNumber: string) => {
    if (!confirm(`Are you sure you want to delete available AWB "${awbNumber}" from the pool?`)) {
      return;
    }

    try {
      const res = await apiClient.delete(`/platform/st-courier-awb/${id}`);
      if (res.data.success) {
        toast.success(`AWB ${awbNumber} deleted`);
        fetchStats();
        fetchAwbs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete AWB');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                ST Courier AWB Inventory Pool
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Pre-allocated physical sticker rolls for Intra-Tamil Nadu fulfillment with atomic concurrency locking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchStats(); fetchAwbs(); }}
            className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Refresh Pool"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload AWBs
          </button>
        </div>
      </div>

      {/* Low Stock Warning Alert */}
      {stats?.isLowStock && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-amber-900 dark:text-amber-200">
              Low AWB Inventory Warning:
            </span>{' '}
            <span className="text-amber-800 dark:text-amber-300">
              You have fewer than 50 available AWBs remaining in the pool ({stats?.summary?.available || 0} left). Upload fresh rolls to prevent order booking interruptions.
            </span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-sm mb-1">
            <span>Total Stock</span>
            <Package className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {statsLoading ? '...' : stats?.summary?.total?.toLocaleString() || 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">All uploaded AWBs</p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-sm mb-1">
            <span>Available (Ready)</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {statsLoading ? '...' : stats?.summary?.available?.toLocaleString() || 0}
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Ready for order auto-assignment</p>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 text-sm mb-1">
            <span>Assigned to Orders</span>
            <Tag className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {statsLoading ? '...' : stats?.summary?.assigned?.toLocaleString() || 0}
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Actively allocated to shipments</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-sm mb-1">
            <span>Cancelled / Void</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
            {statsLoading ? '...' : stats?.summary?.cancelled?.toLocaleString() || 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">Voided or cancelled shipments</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by AWB number, Batch ID, or notes..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-sm font-medium transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available Only</option>
            <option value="assigned">Assigned Only</option>
            <option value="cancelled">Cancelled Only</option>
          </select>

          <select
            value={districtFilter}
            onChange={(e) => { setDistrictFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm outline-none"
          >
            <option value="all">All Districts</option>
            {TN_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm outline-none"
          >
            <option value="all">All Payment Modes</option>
            <option value="both">Both (COD & Prepaid)</option>
            <option value="prepaid">Prepaid Only</option>
            <option value="cod">COD Only</option>
          </select>

          <span className="ml-auto text-xs text-slate-500">
            Showing {awbs.length} of {totalCount} AWBs
          </span>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">AWB Number</th>
                <th className="py-3.5 px-4">Origin District</th>
                <th className="py-3.5 px-4">Payment Mode</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Assigned Shipment</th>
                <th className="py-3.5 px-4">Batch ID</th>
                <th className="py-3.5 px-4">Created At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading AWB Inventory...
                  </td>
                </tr>
              ) : awbs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    No AWBs found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                awbs.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {row.awb_number}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {row.origin_district || 'All'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {row.payment_mode}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {row.status === 'available' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Available
                        </span>
                      )}
                      {row.status === 'assigned' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <Check className="w-3 h-3 mr-1" /> Assigned
                        </span>
                      )}
                      {row.status === 'cancelled' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <X className="w-3 h-3 mr-1" /> Cancelled
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {row.shipment ? (
                        <span title={`Shipment ID: ${row.shipment.id}`}>
                          {row.shipment.awb_number || row.shipment.id.slice(0, 8)}
                        </span>
                      ) : row.shipment_id ? (
                        <span>{row.shipment_id.slice(0, 8)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      {row.batch_id || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {new Date(row.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.status === 'available' ? (
                        <button
                          onClick={() => handleDeleteAwb(row.id, row.awb_number)}
                          className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                          title="Delete AWB from pool"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Locked</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm">
          <div className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Bulk Upload ST Courier AWBs
                  </h3>
                  <p className="text-xs text-slate-500">
                    Paste pre-printed physical barcode sticker numbers from ST Courier roll.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  AWB Numbers (One per line or comma-separated) *
                </label>
                <textarea
                  required
                  rows={6}
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  placeholder={`STC100200301\nSTC100200302\nSTC100200303\n...`}
                  className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Origin District Allocation
                  </label>
                  <select
                    value={uploadDistrict}
                    onChange={(e) => setUploadDistrict(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none"
                  >
                    {TN_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={uploadPaymentMode}
                    onChange={(e) => setUploadPaymentMode(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none"
                  >
                    <option value="both">Both (Prepaid & COD)</option>
                    <option value="prepaid">Prepaid Only</option>
                    <option value="cod">COD Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Batch Reference / Roll Number
                  </label>
                  <input
                    type="text"
                    value={uploadBatchId}
                    onChange={(e) => setUploadBatchId(e.target.value)}
                    placeholder="e.g. ROLL-MADURAI-01"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Internal Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="e.g. Received from branch on 12 Sep"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving to Pool...
                    </>
                  ) : (
                    'Add AWBs to Pool'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
