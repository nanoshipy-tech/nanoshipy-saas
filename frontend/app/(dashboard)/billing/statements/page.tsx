'use client';

import React, { useState, useEffect } from 'react';
import { FileArchive, Download, ArrowLeft, Eye, AlertCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '@/lib/env';
import { apiClient } from '@/lib/apiClient';
import { useRouter } from 'next/navigation';
import { InvoiceData } from '@/components/billing/InvoiceTable';
import { InvoiceDetailPanel } from '@/components/billing/InvoiceDetailPanel';

export default function MonthlyStatementsPage() {
  const router = useRouter();
  const [statements, setStatements] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatement, setActiveStatement] = useState<InvoiceData | null>(null);

  useEffect(() => {
    fetchStatements();
  }, []);

  const fetchStatements = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/invoices/statements');
      setStatements(res.data.data.rows);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch statement records.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (e: React.MouseEvent, stmt: InvoiceData) => {
    e.stopPropagation();
    try {
      const res = await apiClient.get(`/invoices/${stmt.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement-${(stmt.invoice_number || stmt.id).replace(/\//g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Monthly statement downloaded');
    } catch {
      toast.error('Failed to download statement PDF');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => router.push('/billing')}
          className="p-2 bg-white border border-gray-200 hover:bg-slate-50 rounded-xl transition shadow-sm shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FileArchive className="h-5 w-5 text-purple-500" />
            <span>Monthly Rollup Statements</span>
          </h1>
          <p className="text-xs text-[#7E7994] mt-0.5">
            Consolidated account statements generated on the 1st of every month summarizing shipping spend and recharges.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-4 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : statements.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 mb-4">
            <FileArchive className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No statement rollups yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Your first monthly consolidated summary statement will appear here on the 1st of next month.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50/70 font-semibold text-gray-600 tracking-wider text-[11px] uppercase">
                <tr>
                  <th className="px-6 py-4">Statement Number</th>
                  <th className="px-6 py-4">Billing Period</th>
                  <th className="px-6 py-4">Consolidated Spend</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {statements.map((stmt) => {
                  const startStr = stmt.billing_period_start
                    ? new Date(stmt.billing_period_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                    : 'N/A';

                  return (
                    <tr key={stmt.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-gray-900 flex items-center space-x-1.5">
                          <FileText className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          <span>{stmt.invoice_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-semibold">
                        {startStr} Rollup
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-xs text-gray-900">
                        ₹{stmt.total_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {stmt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs space-x-1">
                        <button
                          onClick={() => setActiveStatement(stmt)}
                          className="inline-flex items-center space-x-1 text-slate-600 hover:text-purple-600 font-bold border rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View rollup</span>
                        </button>
                        <button
                          onClick={(e) => handleDownloadPdf(e, stmt)}
                          className="inline-flex items-center space-x-1 text-purple-600 hover:text-purple-800 font-bold border border-purple-100 hover:border-purple-200 bg-purple-50/50 rounded-lg px-2.5 py-1.5 transition cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download PDF</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail overlay */}
      {activeStatement && (
        <InvoiceDetailPanel
          invoice={activeStatement}
          onClose={() => setActiveStatement(null)}
        />
      )}
    </div>
  );
}
