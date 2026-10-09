'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowDownToLine, AlertCircle, RefreshCw, FileSpreadsheet, CheckCircle2, AlertTriangle, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient, getAccessToken } from '@/lib/apiClient';
import { useAuth } from '@/lib/authStore';
import { BulkUploadDropzone } from '@/components/orders/BulkUploadDropzone';
import { ImportResultReport } from '@/components/orders/ImportResultReport';
import { Spinner } from '@/components/ui/Spinner';

interface ImportRecord {
  id: string;
  file_name: string;
  total_rows: number;
  success_count: number;
  failed_count: number;
  error_report_url: string | null;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
}

export default function BulkUploadPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const isBookingOffice = Boolean(user?.tenant?.is_booking_office);

  const [loading, setLoading] = useState(false);
  const [recentRecord, setRecentRecord] = useState<ImportRecord | null>(null);
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await apiClient.get('/orders/bulk-imports');
      const data = res.data?.data;
      const list = data?.items || data?.rows || (Array.isArray(data) ? data : []);
      setHistory(Array.isArray(list) ? list : []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDownloadTemplate = async () => {
    try {
      const response = await apiClient.get('/orders/template', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'orders-upload-template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Orders template downloaded');
    } catch {
      // Fallback: generate template client-side so it never fails
      const headers = [
        'order_reference', 'pickup_address_id', 'customer_name', 'customer_phone',
        'customer_email', 'shipping_address_line1', 'shipping_address_line2',
        'shipping_city', 'shipping_state', 'shipping_pincode', 'shipping_country',
        'order_value', 'payment_mode', 'cod_amount', 'weight_kg',
        'length_cm', 'width_cm', 'height_cm', 'product_name', 'sku', 'quantity', 'unit_price'
      ];
      const exampleRow = [
        'ORD-2026-001', '', 'Rahul Sharma', '9876543210', 'rahul@example.com',
        'Flat 101, Sunrise Apartments', 'Sector 56', 'Gurugram', 'Haryana', '122011',
        'India', '1499.00', 'prepaid', '0.00', '1.2', '30', '20', '15',
        'Running Shoes', 'SHO-RUN-10', '1', '1499.00'
      ];
      const csvStr = `${headers.join(',')}\n${exampleRow.join(',')}\n`;
      const blob = new Blob([csvStr], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'orders-upload-template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Orders template downloaded');
    }
  };

  const handleUpload = async (file: File) => {
    // 1. Enforce file size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      const msg = 'File exceeds the 5MB size limit. Please upload a smaller file.';
      setError(msg);
      toast.error(msg);
      return;
    }

    // 2. Enforce client-side row limit validation (500 rows)
    if (file.name.endsWith('.csv') || file.type.includes('csv')) {
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        const dataRows = lines.length > 0 ? lines.length - 1 : 0;
        if (dataRows > 500) {
          const msg = `File contains ${dataRows} rows. Maximum allowed is 500 rows per batch. Please split into smaller files.`;
          setError(msg);
          toast.error(msg);
          return;
        }
      } catch {
        // Fallback to server validation if text parsing encounters binary format
      }
    }

    setLoading(true);
    setError(null);
    setRecentRecord(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/orders/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success && res.data.data) {
        setRecentRecord(res.data.data);
        const successCount = res.data.data.success_count || 0;
        const failedCount = res.data.data.failed_count || 0;
        if (failedCount === 0) {
          toast.success(`Import completed: ${successCount} orders created successfully!`);
        } else {
          toast(`Import completed: ${successCount} succeeded, ${failedCount} failed. Check error log below.`, { icon: '⚠️' });
        }
        fetchHistory();
      } else {
        setError(res.data?.error?.message || 'Bulk upload failed. Please verify file format.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Bulk upload failed. Verify columns matching requirements.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-[#2A2440] pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/orders"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1C1F2E] transition border border-slate-200/60 dark:border-white/[0.06]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Bulk Orders Import</h1>
            <p className="text-xs text-slate-500 dark:text-[#A29DB8] mt-0.5">Upload CSV or Excel spreadsheets to create multiple shipments in batch.</p>
          </div>
        </div>
        {!isBookingOffice && (
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center justify-center space-x-2 bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#2A2440] hover:bg-slate-50 dark:hover:bg-[#1C1F2E] text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer shrink-0"
          >
            <ArrowDownToLine className="h-4 w-4 text-[#8410DC]" />
            <span>Download Template (.CSV)</span>
          </button>
        )}
      </div>

      {isBookingOffice ? (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-8 text-center max-w-2xl mx-auto my-8 space-y-4">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/50 rounded-2xl flex items-center justify-center mx-auto text-[#8410DC]">
            <Store className="w-7 h-7 text-[#8410DC]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Bulk Orders Import Disabled
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your account is configured as a <strong>Booking Office</strong>. In this mode, bulk spreadsheet importing is disabled. Please use Walk-in Retail Counter booking for processing walk-in customer parcels.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/walkin-booking"
              className="nano-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <Store className="w-4 h-4" />
              <span>Go to Walk-in Booking</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30 p-4 rounded-xl flex items-center space-x-3 text-xs">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload dropzone column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#2A2440] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Upload Spreadsheet</h2>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Max 500 rows / 5MB</span>
            </div>
            <BulkUploadDropzone onUpload={handleUpload} loading={loading} />
          </div>

          {recentRecord && (
            <ImportResultReport record={recentRecord} />
          )}
        </div>

        {/* Instructions panel */}
        <div>
          <div className="p-6 rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#2A2440] shadow-xs space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-[#2A2440] pb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#8410DC]" />
              Instructions & Constraints
            </h2>
            
            <ul className="list-disc pl-5 space-y-2.5 leading-relaxed">
              <li>Use the exact column headers from the <strong>Download Template</strong> file.</li>
              <li><strong>order_reference</strong>: Must be unique for your store, alphanumeric (e.g. <code>ORD-1001</code>).</li>
              <li><strong>pickup_address_id</strong>: Optional. Leave empty to automatically use your <strong>default warehouse</strong>.</li>
              <li><strong>shipping_pincode</strong>: Must be a valid 6-digit Indian PIN code.</li>
              <li><strong>payment_mode</strong>: Enter <code>prepaid</code> or <code>cod</code>.</li>
              <li><strong>weight_kg</strong>: Gross weight in kg (positive decimal up to 50 kg max).</li>
              <li><strong>Multiple Items</strong>: Repeat the same <code>order_reference</code> on consecutive rows to add multiple products to a single shipment.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Uploads History */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#2A2440] shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2A2440] pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Import History</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Log of past batch uploads and error reports</p>
          </div>
          <button
            onClick={fetchHistory}
            title="Refresh History"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1C1F2E]"
          >
            <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6 text-[#8410DC]" />
          </div>
        ) : (!history || history.length === 0) ? (
          <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
            No recent bulk imports found. Upload your first CSV above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-[#2A2440] text-xs">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">File Name</th>
                  <th className="py-2.5 text-center">Total</th>
                  <th className="py-2.5 text-center text-emerald-600 dark:text-emerald-400">Success</th>
                  <th className="py-2.5 text-center text-rose-600 dark:text-rose-400">Failed</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2A2440] text-slate-700 dark:text-slate-300">
                {(history || []).map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition">
                    <td className="py-3 whitespace-nowrap text-slate-500 dark:text-[#A29DB8]">
                      {record.created_at ? new Date(record.created_at).toLocaleString('en-IN') : '-'}
                    </td>
                    <td className="py-3 font-semibold text-slate-900 dark:text-white truncate max-w-xs">{record.file_name}</td>
                    <td className="py-3 text-center">{record.total_rows}</td>
                    <td className="py-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{record.success_count}</td>
                    <td className="py-3 text-center text-rose-600 dark:text-rose-400 font-semibold">{record.failed_count}</td>
                    <td className="py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${record.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : record.status === 'failed' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {record.error_report_url ? (() => {
                        const token = getAccessToken();
                        const sep = record.error_report_url.includes('?') ? '&' : '?';
                        const linkUrl = token ? `${record.error_report_url}${sep}token=${encodeURIComponent(token)}` : record.error_report_url;

                        return (
                          <a
                            href={linkUrl}
                            download={`import-errors-${record.id || 'batch'}.csv`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-semibold underline"
                          >
                            Error Log
                          </a>
                        );
                      })() : (
                        <span className="text-slate-400 dark:text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
