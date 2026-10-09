'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import {
  BarChart3, Download, FileSpreadsheet, Users, Truck, ArrowRight,
  RefreshCw, Check, ArrowUpRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ReportItem {
  id: string;
  name: string;
  category: string;
  description: string;
  format: 'CSV' | 'XLSX' | 'PDF';
  period: string;
  exportEndpoint: string;
  linkHref?: string;
}

const REPORTS_LIST: ReportItem[] = [
  {
    id: 'customer_db',
    name: 'Customer & Seller Database',
    category: 'Sellers',
    description: 'All onboarded merchant profiles, contact details, KYC status, and wallet limits.',
    format: 'CSV',
    period: 'All-time',
    exportEndpoint: '/platform/sellers/export',
    linkHref: '/reports/customer-database',
  },
  {
    id: 'seller_overdue',
    name: 'Seller Overdue Statement',
    category: 'Billing & AR',
    description: 'Outstanding invoice receivables and overdue balances across sellers.',
    format: 'XLSX',
    period: 'Last 30 days',
    exportEndpoint: '/admin/reports/seller-overdue/export',
    linkHref: '/reports/seller-overdue',
  },
  {
    id: 'amount_received',
    name: 'Amount Received Ledger',
    category: 'Finance',
    description: 'Reconciled incoming wallet recharge payments, bank transfers, and gateway settlements.',
    format: 'CSV',
    period: 'Current Month',
    exportEndpoint: '/admin/reports/amount-received/export',
    linkHref: '/reports/amount-received',
  },
  {
    id: 'operations_summary',
    name: 'Shipments & Logistics Performance',
    category: 'Operations',
    description: 'Aggregated courier volume, delivery turnaround, NDR conversion, and RTO rates.',
    format: 'CSV',
    period: 'Last 14 days',
    exportEndpoint: '/admin/dashboard/shipment-summary/export',
    linkHref: '/reports/customer-logistics',
  },
  {
    id: 'remittance_batches',
    name: 'COD Remittance Audit Log',
    category: 'Finance',
    description: 'Carrier collected cash on delivery reconciliations and merchant wallet disbursement records.',
    format: 'CSV',
    period: 'Current Cycle',
    exportEndpoint: '/cod-remittances/export',
    linkHref: '/finance',
  },
];

export default function ReportsOverviewPage() {
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const handleDownload = async (item: ReportItem) => {
    try {
      setDownloading((prev) => ({ ...prev, [item.id]: true }));
      const response = await apiClient.get(item.exportEndpoint, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: item.format === 'XLSX' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.id}_${new Date().toISOString().split('T')[0]}.${item.format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${item.name} downloaded successfully!`);
    } catch (err: any) {
      toast.error('Direct download not available — opening report view');
      if (item.linkHref) {
        window.location.href = item.linkHref;
      }
    } finally {
      setDownloading((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-kpi">
          <div className="admin-kpi-title">Saved Reports</div>
          <div className="admin-kpi-val">18</div>
          <div className="admin-delta admin-delta-neutral">
            Standard templates
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Last Export</div>
          <div className="admin-kpi-val">Today 08:30</div>
          <div className="admin-delta admin-delta-up">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Automated sync
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Scheduled Exports</div>
          <div className="admin-kpi-val">4 Active</div>
          <div className="admin-delta admin-delta-neutral">
            Daily &amp; Weekly
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Formats Available</div>
          <div className="admin-kpi-val">CSV, XLSX</div>
          <div className="admin-delta admin-delta-up">
            Audit-ready
          </div>
        </div>
      </div>

      {/* Main Reports Table */}
      <div className="admin-card !p-0 overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Standard Platform Reports &amp; Exports</h2>
            <p className="text-[12.5px] text-[var(--muted)]">Download system-wide operational, billing, and margin reconciliation statements</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-ref">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Category</th>
                <th>Description</th>
                <th>Period</th>
                <th>Format</th>
                <th className="text-right">Export</th>
              </tr>
            </thead>
            <tbody>
              {REPORTS_LIST.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="font-bold text-[var(--ink)] block">
                      {r.name}
                    </span>
                  </td>
                  <td>
                    <span className="pill pill-neutral">
                      {r.category}
                    </span>
                  </td>
                  <td>
                    <span className="text-[12.5px] text-[var(--muted)] line-clamp-1 max-w-[340px]">
                      {r.description}
                    </span>
                  </td>
                  <td>
                    <span className="text-[12.5px] text-[var(--ink)] font-semibold">
                      {r.period}
                    </span>
                  </td>
                  <td>
                    <span className="pill pill-info font-mono">
                      {r.format}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDownload(r)}
                      disabled={downloading[r.id]}
                      className="btn-ref btn-ref-secondary inline-flex items-center gap-1.5 text-[12px] py-1 px-3 cursor-pointer"
                    >
                      <Download className={`w-3.5 h-3.5 ${downloading[r.id] ? 'animate-bounce' : ''}`} />
                      {downloading[r.id] ? 'Exporting…' : 'Download'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
