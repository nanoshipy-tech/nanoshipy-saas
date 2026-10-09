'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  MapPin, CheckCircle2, AlertTriangle, XCircle,
  Upload, Search, Filter, Trash2, RefreshCw,
  FileText, ShieldCheck, Plus, Check, X, ArrowRight, Truck
} from 'lucide-react';
import toast from 'react-hot-toast';

const TN_DISTRICTS = [
  'All',
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kanchipuram',
  'Kanyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Tiruvallur',
  'Tiruvannamalai',
  'Tiruvarur',
  'Vellore',
  'Viluppuram',
  'Virudhunagar',
];

export default function StCourierPincodesPage() {
  const [pincodes, setPincodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [districts, setDistricts] = useState<string[]>([]);

  // Filter & Pagination
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkDistrict, setBulkDistrict] = useState('All');
  const [uploading, setUploading] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newPin, setNewPin] = useState({
    pincode: '',
    district: '',
    city: '',
    hub_name: '',
  });
  const [adding, setAdding] = useState(false);

  // Serviceability Test Tool State
  const [testPin, setTestPin] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchPincodes();
  }, [page, districtFilter]);

  const fetchPincodes = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/platform/st-courier-pincodes', {
        params: {
          page,
          limit: 50,
          search,
          district: districtFilter,
        },
      });

      if (res.data?.success) {
        setPincodes(res.data.data.pincodes || []);
        setTotalCount(res.data.data.total || 0);
        setTotalActive(res.data.data.totalActive || 0);
        setTotalPages(res.data.data.totalPages || 1);
        if (res.data.data.districts && res.data.data.districts.length > 0) {
          setDistricts(res.data.data.districts);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to load serviceable pincodes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPincodes();
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      toast.error('Please paste at least one 6-digit pincode');
      return;
    }

    try {
      setUploading(true);
      const res = await apiClient.post('/platform/st-courier-pincodes/bulk', {
        rawText: bulkText,
        defaultDistrict: bulkDistrict === 'All' ? null : bulkDistrict,
      });

      toast.success(res.data.message || 'Pincodes uploaded successfully');
      setBulkModalOpen(false);
      setBulkText('');
      setPage(1);
      fetchPincodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.pincode || newPin.pincode.length !== 6) {
      toast.error('Pincode must be exactly 6 digits');
      return;
    }

    try {
      setAdding(true);
      await apiClient.post('/platform/st-courier-pincodes', newPin);
      toast.success('Pincode saved successfully');
      setAddModalOpen(false);
      setNewPin({ pincode: '', district: '', city: '', hub_name: '' });
      fetchPincodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to add pincode');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, pin: string) => {
    if (!confirm(`Are you sure you want to remove pincode ${pin} from ST Courier serviceable list?`)) return;

    try {
      await apiClient.delete(`/platform/st-courier-pincodes/${id}`);
      toast.success(`Pincode ${pin} removed`);
      fetchPincodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete pincode');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('CAUTION: Are you sure you want to clear ALL ST Courier serviceable pincodes? All Tamil Nadu orders will fallback to default routing until replenished.')) return;

    try {
      await apiClient.delete('/platform/st-courier-pincodes');
      toast.success('All serviceable pincodes cleared');
      fetchPincodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to clear pincodes');
    }
  };

  const handleTestServiceability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPin.trim() || testPin.trim().length !== 6) {
      toast.error('Enter a valid 6-digit pincode');
      return;
    }

    try {
      setTesting(true);
      const res = await apiClient.get(`/platform/st-courier-pincodes/check/${testPin.trim()}`);
      setTestResult(res.data?.data);
    } catch (err: any) {
      toast.error('Lookup failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            ST Courier Serviceable Pincodes & Shipway Auto-Routing
          </h1>
          <p className="text-sm text-[#7E7994] dark:text-[#534F66] mt-1">
            Maintain the whitelist of Tamil Nadu pincodes serviced by ST Courier. Any Tamil Nadu delivery pincode not in this list will automatically route through Shipway (National Express Network).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-purple-500" />
            Add Single Pincode
          </button>
          <button
            onClick={() => setBulkModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Bulk Paste / Upload Pincodes
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-purple-900 dark:text-purple-200">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-purple-950 dark:text-purple-100">
              Active Routing Policy: ST Courier Serviceable vs Shipway Fallback
            </p>
            <p className="mt-0.5 text-purple-800 dark:text-purple-300">
              1. If destination is in Tamil Nadu & included in this list → Assigned to <strong>ST Courier (Intra-State Network)</strong>.<br />
              2. If destination is in Tamil Nadu but <em>not</em> in this list → Automatically routed to <strong>Shipway (Delhivery, Blue Dart, Xpressbees)</strong>.<br />
              3. All interstate / Rest of India shipments continue routing through <strong>Shipway</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards & Real-Time Test Tool */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#7E7994] dark:text-[#534F66]">
            <span>Total Whitelisted Pincodes</span>
            <MapPin className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{totalActive}</span>
            <span className="text-xs text-emerald-600 font-semibold">Active in ST Network</span>
          </div>
          <p className="text-[11px] text-[#7E7994] mt-2">Pincodes dispatched directly to ST Courier</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#7E7994] dark:text-[#534F66]">
            <span>Covered Tamil Nadu Districts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{districts.length}</span>
            <span className="text-xs text-slate-500">Districts</span>
          </div>
          <p className="text-[11px] text-[#7E7994] mt-2">From Chennai, Coimbatore, Madurai to Karur</p>
        </div>

        {/* Quick Route Simulator */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-xs font-semibold text-slate-900 dark:text-white block mb-2">
            Pincode Route Simulator
          </span>
          <form onSubmit={handleTestServiceability} className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              placeholder="e.g. 641001"
              value={testPin}
              onChange={(e) => setTestPin(e.target.value.replace(/\D/g, ''))}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={testing}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold"
            >
              Check
            </button>
          </form>

          {testResult && (
            <div className={`mt-2 p-2 rounded-lg text-xs flex items-center justify-between ${
              testResult.serviceable ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
            }`}>
              <span className="font-semibold">
                {testResult.serviceable ? '✓ ST Courier' : '➔ Shipway Fallback'}
              </span>
              <span className="text-[10px] opacity-80">
                {testResult.serviceable ? `${testResult.details?.district || 'Serviceable'}` : 'Unserviceable in ST'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by 6-digit pincode, district, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={districtFilter}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
            >
              <option value="all">All Districts</option>
              {TN_DISTRICTS.filter(d => d !== 'All').map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchPincodes()}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {totalCount > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-red-600 hover:text-red-700 text-xs font-semibold rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Pincodes Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
            Loading serviceable pincodes...
          </div>
        ) : pincodes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No serviceable pincodes found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click &quot;Bulk Paste / Upload Pincodes&quot; to paste a list of ST Courier serviceable pincodes in Tamil Nadu.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Pincode</th>
                  <th className="py-3 px-4 font-semibold">District</th>
                  <th className="py-3 px-4 font-semibold">City / Region</th>
                  <th className="py-3 px-4 font-semibold">Delivery Hub</th>
                  <th className="py-3 px-4 font-semibold">Routing Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pincodes.map((pin) => (
                  <tr key={pin.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {pin.pincode}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {pin.district || 'Tamil Nadu'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {pin.city || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {pin.hub_name || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <Check className="w-3 h-3" />
                        ST Courier Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(pin.id, pin.pincode)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                        title="Delete Pincode"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:divide-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Showing Page {page} of {totalPages} ({totalCount} total)</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Upload Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-600" />
                Bulk Add Serviceable Pincodes
              </h3>
              <button onClick={() => setBulkModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#7E7994]">
              Paste 6-digit pincodes separated by comma, space, or newline. Missing district names will be automatically resolved from the Master Pincode Directory.
            </p>

            <form onSubmit={handleBulkUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default District (Optional)
                </label>
                <select
                  value={bulkDistrict}
                  onChange={(e) => setBulkDistrict(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
                >
                  {TN_DISTRICTS.map(d => (
                    <option key={d} value={d}>{d === 'All' ? 'Auto-Resolve District' : d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pincodes List
                </label>
                <textarea
                  rows={8}
                  placeholder={`600001, 600002\n600004\n641001\n625001`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50"
                >
                  {uploading ? 'Processing Pincodes...' : 'Save Serviceable Pincodes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Pincode Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                Add Single Serviceable Pincode
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingle} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pincode (6 Digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 641001"
                  value={newPin.pincode}
                  onChange={(e) => setNewPin(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g, '') }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  District (Leave blank to auto-resolve)
                </label>
                <select
                  value={newPin.district}
                  onChange={(e) => setNewPin(prev => ({ ...prev, district: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
                >
                  <option value="">Auto-Detect from Pincode</option>
                  {TN_DISTRICTS.filter(d => d !== 'All').map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  City / Town (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Coimbatore"
                  value={newPin.city}
                  onChange={(e) => setNewPin(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Hub (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Peelamedu Hub"
                  value={newPin.hub_name}
                  onChange={(e) => setNewPin(prev => ({ ...prev, hub_name: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Save Pincode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
