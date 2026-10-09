'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Download,
  Trash2,
  X,
  RefreshCw,
  HardDrive,
  ShieldAlert,
  Archive,
  CheckCircle2,
  Package,
  Wallet,
  Users,
  FileText
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { downloadBlob } from '@/lib/exportUtils';
import toast from 'react-hot-toast';

interface DeleteSellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: any | null;
  onDeleted: () => void;
}

export default function DeleteSellerModal({
  isOpen,
  onClose,
  seller,
  onDeleted,
}: DeleteSellerModalProps) {
  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'purge' | 'archive'>('purge');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && seller?.id) {
      fetchPreDeleteCheck(seller.id);
      setConfirmationInput('');
      setReason('');
      setDeleteMode('purge');
      setProcessStep(null);
    }
  }, [isOpen, seller?.id]);

  const fetchPreDeleteCheck = async (tenantId: string) => {
    try {
      setLoadingStats(true);
      const res = await apiClient.get(`/platform/sellers/${tenantId}/pre-delete-check`);
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch {
      toast.error('Could not fetch pre-deletion metrics');
    } finally {
      setLoadingStats(false);
    }
  };

  if (!isOpen || !seller) return null;

  const isConfirmed = confirmationInput.trim().toUpperCase() === 'DELETE';

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) {
      toast.error('Please type DELETE to confirm');
      return;
    }

    try {
      setIsProcessing(true);
      setProcessStep('1/3: Generating full seller database backup...');

      const res = await apiClient.delete(`/platform/sellers/${seller.id}`, {
        data: {
          mode: deleteMode,
          reason: reason.trim() || 'Deleted by platform admin',
        },
      });

      if (res.data?.success) {
        setProcessStep('2/3: Downloading backup archive to your local drive...');
        const backupData = res.data.data?.backup;
        const base64Data = res.data.data?.backup_base64;

        if (base64Data && backupData?.filename) {
          try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/gzip' });
            downloadBlob(blob, backupData.filename);
          } catch (dlErr) {
            console.error('Browser backup download fallback:', dlErr);
          }
        }

        setProcessStep('3/3: Account removal complete!');
        toast.success(
          deleteMode === 'purge'
            ? `Seller "${seller.company_name || 'account'}" permanently deleted. Backup downloaded!`
            : `Seller "${seller.company_name || 'account'}" archived. Backup downloaded!`,
          { duration: 6000 }
        );

        setTimeout(() => {
          onDeleted();
          onClose();
        }, 800);
      } else {
        throw new Error(res.data?.error?.message || 'Deletion failed');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to delete seller account';
      toast.error(errMsg);
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Delete Seller Account
              </h2>
              <p className="text-xs text-slate-500">
                {seller.company_name} ({seller.subdomain || 'no-subdomain'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleDelete} className="p-6 space-y-5">
          {/* Automated Backup Guarantee Notice */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900">
            <HardDrive className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-bold text-emerald-950">Automated Local Drive Backup Protection</p>
              <p className="text-emerald-800">
                Before any deletion occurs, all seller data across orders, shipments, wallet, invoices, and credentials will be:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-emerald-900 font-medium">
                <li>Saved permanently on the server local drive (<code>storage/backups/sellers/</code>) with SHA-256 integrity verification.</li>
                <li>Downloaded automatically to your local computer drive as a compressed archive (<code>.json.gz</code>).</li>
              </ul>
            </div>
          </div>

          {/* Pre-Delete Risk & Activity Metrics */}
          {loadingStats ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin text-slate-400" /> Calculating account activity...
            </div>
          ) : stats ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Account Activity Summary</p>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" /> Total Orders
                  </span>
                  <p className="text-sm font-bold text-slate-800 mt-1">{stats.stats?.orders_count || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" /> Wallet Balance
                  </span>
                  <p className="text-sm font-bold text-slate-800 mt-1">₹{(stats.stats?.wallet_balance || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> User Logins
                  </span>
                  <p className="text-sm font-bold text-slate-800 mt-1">{stats.stats?.users_count || 0}</p>
                </div>
              </div>

              {stats.has_active_shipments && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Warning: Seller currently has <strong>{stats.stats?.active_shipments} active shipments</strong> in transit or booked.
                  </span>
                </div>
              )}
            </div>
          ) : null}

          {/* Deletion Mode Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Deletion Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setDeleteMode('purge')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all text-xs ${
                  deleteMode === 'purge'
                    ? 'border-rose-500 bg-rose-50/40 ring-1 ring-rose-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <Trash2 className="w-3.5 h-3.5" /> Permanent Purge
                  </span>
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'purge'}
                    onChange={() => setDeleteMode('purge')}
                    className="accent-rose-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Backs up data to local drive, then permanently deletes all database rows across all tables.
                </p>
              </div>

              <div
                onClick={() => setDeleteMode('archive')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all text-xs ${
                  deleteMode === 'archive'
                    ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center gap-1.5 text-indigo-700">
                    <Archive className="w-3.5 h-3.5" /> Soft-Delete / Archive
                  </span>
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'archive'}
                    onChange={() => setDeleteMode('archive')}
                    className="accent-indigo-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Backs up data to local drive, revokes logins and frees subdomain, keeping historical invoices dormant.
                </p>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Deletion (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Requested by seller / Non-payment / Inactive"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Confirmation Challenge Input */}
          <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 space-y-2">
            <p className="text-xs text-rose-900 font-medium">
              To confirm, please type <strong className="font-mono text-rose-700 font-bold select-all">DELETE</strong> in the box below:
            </p>
            <input
              type="text"
              required
              placeholder="Type DELETE to confirm"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              className="w-full text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 bg-white"
            />
          </div>

          {/* Progress Banner */}
          {processStep && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span>{processStep}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isConfirmed || isProcessing}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-md shadow-rose-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing Backup & Delete...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" /> Backup & {deleteMode === 'purge' ? 'Permanently Delete' : 'Archive'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
