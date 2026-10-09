'use client';

import React, { useState } from 'react';
import { Download, Loader2, Calendar, FileText, ChevronDown } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { value: 'orders_summary', label: 'Orders Summary' },
  { value: 'shipments_summary', label: 'Shipments Summary' },
  { value: 'ndr_rto_summary', label: 'NDR & RTO Summary' },
  { value: 'wallet_statement', label: 'Wallet Statement' },
  { value: 'courier_performance', label: 'Courier Performance' }
];

const FORMATS = [
  { value: 'csv', label: 'CSV File' },
  { value: 'pdf', label: 'PDF Document' }
];

export default function ReportExportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState('orders_summary');
  const [format, setFormat] = useState('csv');
  
  // Default to past 30 days
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  
  const [dateFrom, setDateFrom] = useState(defaultFrom.toISOString().substring(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().substring(0, 10));
  const [loading, setLoading] = useState(false);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.post('/reports/export', {
        report_type: reportType,
        format,
        date_from: dateFrom,
        date_to: dateTo
      });

      if (response.data.success) {
        const downloadUrl = response.data.data?.download_url;
        if (downloadUrl) {
          toast.success('Report ready! Downloading now...');
          window.location.href = downloadUrl;
        } else {
          toast.success('Report export started! You will receive a notification with a download link shortly.', {
            duration: 6000
          });
        }
        setIsOpen(false);
      } else {
        toast.error(response.data.error?.message || 'Failed to start export');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to start export');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
      >
        <Download className="h-4 w-4" />
        <span>Export Reports</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl p-5 z-50 animate-in fade-in-50 slide-in-from-top-2 duration-150">
          <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center space-x-1.5">
            <FileText className="h-4 w-4 text-[#8410DC]" />
            <span>Generate Business Statement</span>
          </h4>
          
          <form onSubmit={handleExport} className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC]"
              >
                {REPORT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC]"
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                  Date Range
                </label>
                <div className="flex items-center bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-gray-500">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-gray-400" />
                  <span>Custom Range</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC]"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:bg-blue-400 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>{loading ? 'Queueing...' : 'Request Export'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
