'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { MapPin, Upload, FileText, CheckCircle2, AlertTriangle, Search, Loader2, Download, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PincodeMasterAdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');
  const [preview, setPreview] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<any>(null);

  // Search & List Pincodes
  const [pincodes, setPincodes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Manual Add Location Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    pincode: '',
    city: '',
    district: '',
    state: '',
    tier: 'Tier 1',
    is_serviceable: true,
  });

  // Deleting State
  const [deletingPincode, setDeletingPincode] = useState<string | null>(null);

  useEffect(() => {
    fetchPincodes();
  }, [searchTerm]);

  const fetchPincodes = async () => {
    setLoadingList(true);
    try {
      const res = await apiClient.get('/platform/pincodes', {
        params: { search: searchTerm, limit: 50 },
      });
      if (res.data.success) {
        setPincodes(res.data.data.pincodes || []);
        setTotalCount(res.data.data.pagination?.total ?? res.data.data.total ?? 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch pincodes:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = newLocation.pincode.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      toast.error('Pincode must be exactly 6 digits');
      return;
    }
    if (!newLocation.city.trim() || !newLocation.district.trim() || !newLocation.state.trim()) {
      toast.error('Please fill City, District and State');
      return;
    }

    setCreatingLocation(true);
    try {
      const res = await apiClient.post('/platform/pincodes', {
        pincode: cleanPin,
        city: newLocation.city.trim(),
        district: newLocation.district.trim(),
        state: newLocation.state.trim(),
        tier: newLocation.tier,
        is_serviceable: newLocation.is_serviceable,
      });

      if (res.data.success) {
        toast.success(`Location ${cleanPin} (${newLocation.city}) created successfully!`);
        setShowAddModal(false);
        setNewLocation({
          pincode: '',
          city: '',
          district: '',
          state: '',
          tier: 'Tier 1',
          is_serviceable: true,
        });
        fetchPincodes();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create location');
    } finally {
      setCreatingLocation(false);
    }
  };

  const handleDeleteLocation = async (pincode: string) => {
    if (!confirm(`Are you sure you want to remove pincode ${pincode} from serviceable master?`)) return;

    setDeletingPincode(pincode);
    try {
      const res = await apiClient.delete(`/platform/pincodes/${pincode}`);
      if (res.data.success) {
        toast.success(`Pincode ${pincode} deleted`);
        fetchPincodes();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete pincode');
    } finally {
      setDeletingPincode(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a valid CSV file');
      return;
    }

    setFile(selectedFile);
    setIsValidating(true);
    setValidationErrors([]);
    setPreview([]);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await apiClient.post('/platform/pincodes/validate-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        const previewRows = res.data.data.rows ? res.data.data.rows.map((r: any) => r.data) : (res.data.data.preview || []);
        setPreview(previewRows.slice(0, 5));
        const errs = (res.data.data.rows || [])
          .filter((r: any) => !r.isValid)
          .flatMap((r: any) => r.errors.map((e: string) => `Row ${r.rowNumber}: ${e}`));
        setValidationErrors(errs);
        if (errs.length === 0) {
          toast.success(`CSV Validated! Ready to import ${res.data.data.valid_rows_count || res.data.data.validRowsCount} pincodes.`);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'CSV validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a CSV file first');
      return;
    }

    setUploading(true);
    setUploadStats(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post(`/platform/pincodes/upload?mode=${uploadMode}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setUploadStats(res.data.data);
        const count = (res.data.data.success_count ?? (res.data.data.inserted + (res.data.data.updated || 0)));
        toast.success(`Successfully imported ${count} pincode records!`);
        setFile(null);
        setPreview([]);
        fetchPincodes();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/v1/platform/pincodes/template', '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] tracking-tight flex items-center gap-2">
            <MapPin className="w-6 h-6 text-[#8410DC]" />
            Pincode Master & Serviceable Locations
          </h1>
          <p className="text-sm text-[#7E7994] dark:text-[#534F66] mt-1">
            Manage India-wide 6-digit serviceable pincodes, cities, states, tier classifications, and bulk imports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#8410DC] hover:bg-[#700dbd] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Location / Pincode</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-[#E8DEF2] hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sample CSV</span>
          </button>
        </div>
      </div>

      {/* Manual Add Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#8410DC]" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Add Serviceable Location</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    6-Digit Pincode *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 560001"
                    value={newLocation.pincode}
                    onChange={(e) => setNewLocation({ ...newLocation, pincode: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-[#8410DC]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City / Location Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bengaluru"
                    value={newLocation.city}
                    onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-[#8410DC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    District *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bengaluru Urban"
                    value={newLocation.district}
                    onChange={(e) => setNewLocation({ ...newLocation, district: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-[#8410DC]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Karnataka"
                    value={newLocation.state}
                    onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-[#8410DC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City Tier
                  </label>
                  <select
                    value={newLocation.tier}
                    onChange={(e) => setNewLocation({ ...newLocation, tier: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-[#8410DC]"
                  >
                    <option value="Tier 1">Tier 1 (Metro / Hub)</option>
                    <option value="Tier 2">Tier 2 (Major City)</option>
                    <option value="Tier 3">Tier 3 (Rural / Remote)</option>
                  </select>
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newLocation.is_serviceable}
                      onChange={(e) => setNewLocation({ ...newLocation, is_serviceable: e.target.checked })}
                      className="rounded text-[#8410DC] focus:ring-[#8410DC]"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mark as Serviceable</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingLocation}
                  className="px-5 py-2 bg-[#8410DC] hover:bg-[#700dbd] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2"
                >
                  {creatingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {creatingLocation ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Upload Section */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-xs space-y-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
          <Upload className="w-4 h-4 text-[#8410DC]" />
          Bulk CSV Import Engine
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Select Pincode Master CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#8410DC] file:text-white hover:file:bg-[#700dbd] cursor-pointer"
            />
            <p className="text-[11px] text-[#7E7994] mt-1">
              Required CSV Columns: <code className="text-[#8410DC] dark:text-[#D6A8FF]">pincode, district, state, city</code> (Optional: <code className="text-[#8410DC] dark:text-[#D6A8FF]">is_serviceable</code>)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#14121F] mb-1">Import Mode</label>
            <select
              value={uploadMode}
              onChange={(e: any) => setUploadMode(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-[#8410DC]"
            >
              <option value="append">Append / Update Existing</option>
              <option value="replace">Wipe &amp; Replace Entire Database</option>
            </select>
          </div>
        </div>

        {isValidating && (
          <div className="flex items-center gap-2 text-xs text-[#8410DC] font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Validating CSV structure and checking for errors...</span>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>CSV Validation Warnings / Errors Detected:</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300 space-y-0.5 max-h-24 overflow-y-auto">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* CSV Preview Table */}
        {preview.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-[#14121F] uppercase tracking-wider">CSV Preview (First 5 Rows)</span>
              <button
                type="button"
                onClick={handleImport}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Importing...' : 'Confirm & Execute Import'}
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-[#E8DEF2] rounded-xl">
              <table className="w-full text-left text-xs text-slate-700 dark:text-[#14121F]">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Pincode</th>
                    <th className="px-4 py-2.5">State</th>
                    <th className="px-4 py-2.5">District</th>
                    <th className="px-4 py-2.5">City</th>
                    <th className="px-4 py-2.5">Serviceable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {preview.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2 font-mono font-bold text-[#8410DC] dark:text-[#D6A8FF]">{row.pincode}</td>
                      <td className="px-4 py-2">{row.state}</td>
                      <td className="px-4 py-2">{row.district}</td>
                      <td className="px-4 py-2">{row.city}</td>
                      <td className="px-4 py-2">{row.is_serviceable !== false ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {uploadStats && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>
                Import Finished! Processed: <strong>{uploadStats.total_processed || uploadStats.success_count}</strong>, Mode: <strong>{uploadStats.import_mode}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Database Search & Active Pincodes List */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#E8DEF2] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#8410DC]" />
              Active Pincode Master Database ({totalCount.toLocaleString()} Records)
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#534F66]" />
              <input
                type="text"
                placeholder="Search pincode, city, state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-[#E8DEF2] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-[#8410DC] w-48 md:w-64"
              />
            </div>
          </div>
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center p-8 text-[#534F66] gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#8410DC]" />
            <span className="text-xs">Loading database records...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-[#E8DEF2] rounded-xl">
            <table className="w-full text-left text-xs text-slate-700 dark:text-[#14121F]">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Pincode</th>
                  <th className="px-4 py-2.5">City / Location</th>
                  <th className="px-4 py-2.5">District</th>
                  <th className="px-4 py-2.5">State</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pincodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[#534F66]">
                      No pincodes found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  pincodes.map((row) => (
                    <tr key={row.id || row.pincode} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-2 font-mono font-bold text-[#8410DC] dark:text-[#D6A8FF]">{row.pincode}</td>
                      <td className="px-4 py-2 font-medium">{row.city}</td>
                      <td className="px-4 py-2">{row.district}</td>
                      <td className="px-4 py-2">{row.state}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${row.is_serviceable !== false ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                          {row.is_serviceable !== false ? 'Serviceable' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          disabled={deletingPincode === row.pincode}
                          onClick={() => handleDeleteLocation(row.pincode)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Delete Location"
                        >
                          {deletingPincode === row.pincode ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
