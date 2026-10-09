'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Scale, RefreshCw, AlertCircle, CheckCircle2, XCircle, Plus, Upload, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default function MerchantWeightDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [shipmentId, setShipmentId] = useState('');
  const [declaredWeight, setDeclaredWeight] = useState('');
  const [chargedWeight, setChargedWeight] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/weight-disputes');
      if (res.data.success) {
        const raw = res.data.data;
        const list = Array.isArray(raw) ? raw : (raw?.rows || []);
        setDisputes(list);
      }
    } catch {
      toast.error('Failed to load weight disputes');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      const err = 'Invalid file type. Please upload a JPEG, PNG, WEBP photo or PDF document.';
      setFileError(err);
      toast.error(err);
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const err = `File exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please upload a smaller packaging photo.`;
      setFileError(err);
      toast.error(err);
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipmentId.trim()) {
      toast.error('Shipment ID is required');
      return;
    }
    if (!selectedFile) {
      toast.error('Please attach proof photo of package on a weighing scale');
      return;
    }

    try {
      setSubmitting(true);

      // Simulate or upload evidence key
      const evidenceKey = `weight-disputes/${Date.now()}-${selectedFile.name}`;

      const payload = {
        shipment_id: shipmentId.trim(),
        seller_declared_weight_kg: parseFloat(declaredWeight) || 0.5,
        carrier_charged_weight_kg: parseFloat(chargedWeight) || 1.0,
        seller_evidence_s3_key: evidenceKey,
        mime_type: selectedFile.type,
        file_size_bytes: selectedFile.size,
      };

      const res = await apiClient.post('/weight-disputes', payload);
      if (res.data.success) {
        toast.success('Weight discrepancy dispute filed successfully!');
        setShowModal(false);
        setShipmentId('');
        setDeclaredWeight('');
        setChargedWeight('');
        setSelectedFile(null);
        fetchDisputes();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to file dispute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-3">
            <Scale className="w-6 h-6 text-[#8410DC]" /> Weight Discrepancy Disputes
          </h1>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">
            Audit courier charged weight vs your declared package weight and submit scale proof evidence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchDisputes} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8410DC] hover:bg-[#6c0db5] text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]">
            <Plus className="w-4 h-4" /> File New Dispute
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading weight disputes...</div>
        ) : disputes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No weight disputes filed. You have no pending carrier discrepancies.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 bg-slate-50/50 dark:bg-slate-800/50 font-semibold">
                  <th className="py-3.5 px-4">Shipment / AWB</th>
                  <th className="py-3.5 px-4">Declared Weight</th>
                  <th className="py-3.5 px-4">Carrier Charged</th>
                  <th className="py-3.5 px-4">Discrepancy</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date Filed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {disputes.map((d: any) => {
                  const declared = parseFloat(d.seller_declared_weight_kg || 0);
                  const charged = parseFloat(d.carrier_charged_weight_kg || 0);
                  const diff = charged - declared;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#8410DC]">
                        {d.shipment?.awb_number || d.shipment_id?.substring(0, 12)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold">{declared.toFixed(3)} kg</td>
                      <td className="py-3.5 px-4 font-semibold text-rose-500">{charged.toFixed(3)} kg</td>
                      <td className="py-3.5 px-4 font-bold text-amber-600">+{diff.toFixed(3)} kg</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          d.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          d.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {d.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{new Date(d.created_at || Date.now()).toLocaleDateString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File Dispute Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#8410DC]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">File Weight Dispute</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDispute} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Shipment ID / AWB Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWB12345678 or shipment UUID"
                  value={shipmentId}
                  onChange={e => setShipmentId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Declared Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 0.5"
                    value={declaredWeight}
                    onChange={e => setDeclaredWeight(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Charged Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 1.2"
                    value={chargedWeight}
                    onChange={e => setChargedWeight(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Weighing Scale Photo / Proof Document *
                </label>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-[#8410DC] hover:file:bg-purple-200 cursor-pointer"
                />
                <p className="text-[10.5px] text-slate-400 mt-1">
                  Supported formats: JPG, PNG, WEBP, PDF. Maximum file size: 5MB.
                </p>
                {fileError && <p className="text-[11px] text-rose-600 font-medium mt-1">{fileError}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#8410DC] hover:bg-[#6c0db5] text-white font-bold shadow-md transition-all active:scale-[0.98]"
                >
                  {submitting ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
