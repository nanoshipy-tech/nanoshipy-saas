'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, RefreshCw, Download, ShoppingBag, Truck, AlertTriangle, Wallet, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';

// Widgets
import OrdersTrendChart from '@/components/analytics/OrdersTrendChart';
import CourierPerformanceTable from '@/components/analytics/CourierPerformanceTable';
import ZoneDistributionMap from '@/components/analytics/ZoneDistributionMap';
import CodPrepaidSplitChart from '@/components/analytics/CodPrepaidSplitChart';
import WalletSpendChart from '@/components/analytics/WalletSpendChart';
import NdrRtoTrendChart from '@/components/analytics/NdrRtoTrendChart';
import ReportExportButton from '@/components/analytics/ReportExportButton';

export default function AnalyticsPage() {
  // Default range: last 30 days
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const [dateFrom, setDateFrom] = useState(defaultFrom.toISOString().substring(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().substring(0, 10));
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Loading and State
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [ordersTrend, setOrdersTrend] = useState<any[]>([]);
  const [courierPerf, setCourierPerf] = useState<any[]>([]);
  const [zoneDist, setZoneDist] = useState<any[]>([]);
  const [paymentSplit, setPaymentSplit] = useState<any>(null);
  const [walletSpend, setWalletSpend] = useState<any[]>([]);
  const [ndrRtoTrend, setNdrRtoTrend] = useState<any[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const params = { date_from: dateFrom, date_to: dateTo };

    try {
      const results = await Promise.allSettled([
        apiClient.get('/analytics/overview', { params }),
        apiClient.get('/analytics/orders-trend', { params: { ...params, granularity } }),
        apiClient.get('/analytics/courier-performance', { params }),
        apiClient.get('/analytics/zone-distribution', { params }),
        apiClient.get('/analytics/payment-split', { params }),
        apiClient.get('/analytics/wallet-spend', { params }),
        apiClient.get('/analytics/ndr-rto-trend', { params: { ...params, granularity } })
      ]);

      const [overviewRes, trendRes, courierRes, zoneRes, paymentRes, walletRes, ndrRes] = results;

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data.data);
      if (trendRes.status === 'fulfilled') setOrdersTrend(trendRes.value.data.data || []);
      if (courierRes.status === 'fulfilled') setCourierPerf(courierRes.value.data.data || []);
      if (zoneRes.status === 'fulfilled') setZoneDist(zoneRes.value.data.data || []);
      if (paymentRes.status === 'fulfilled') setPaymentSplit(paymentRes.value.data.data);
      if (walletRes.status === 'fulfilled') setWalletSpend(walletRes.value.data.data || []);
      if (ndrRes.status === 'fulfilled') setNdrRtoTrend(ndrRes.value.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateFrom, dateTo, granularity]);

  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  const handleQuickDownload = async (reportType: string, format: string) => {
    setDownloadingType(reportType);
    const toastId = toast.loading(`Generating ${reportType.replace(/_/g, ' ')}...`);
    try {
      const response = await apiClient.post('/reports/export', {
        report_type: reportType,
        format,
        date_from: dateFrom,
        date_to: dateTo
      });
      if (response.data?.success) {
        const downloadUrl = response.data.data?.download_url;
        if (downloadUrl) {
          toast.success(`Report generated! Initiating download...`, { id: toastId });
          window.location.href = downloadUrl;
        } else {
          toast.success(`Export job queued for ${reportType.replace(/_/g, ' ')}. Notification will arrive shortly.`, { id: toastId });
        }
      } else {
        toast.error(response.data?.error?.message || 'Failed to trigger report download', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to trigger report export', { id: toastId });
    } finally {
      setDownloadingType(null);
    }
  };

  const standardReports = [
    {
      id: 'orders_summary',
      name: 'Orders & Shipments Summary',
      description: 'Full consignment manifest with recipient phone, city, payment mode & status',
      period: `${dateFrom} to ${dateTo}`,
      format: 'CSV / PDF',
      type: 'orders_summary',
      iconName: 'orders',
    },
    {
      id: 'ndr_rto_summary',
      name: 'Delivery Issues (NDR) & RTO Analysis',
      description: 'Undelivered consignments, NDR customer response logs & return reasons',
      period: `${dateFrom} to ${dateTo}`,
      format: 'CSV',
      type: 'ndr_rto_summary',
      iconName: 'ndr',
    },
    {
      id: 'courier_performance',
      name: 'Carrier Delivery SLA & Speed Breakdown',
      description: 'Transit turnaround times, success ratios & delivery failure rates across couriers',
      period: `${dateFrom} to ${dateTo}`,
      format: 'CSV',
      type: 'courier_performance',
      iconName: 'courier',
    },
    {
      id: 'wallet_statement',
      name: 'Prepaid Wallet Spend & Billing Rollup',
      description: 'Itemized freight charges, recharge ledger credits & net balance timeline',
      period: `${dateFrom} to ${dateTo}`,
      format: 'PDF / CSV',
      type: 'wallet_statement',
      iconName: 'wallet',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="nano-page-title">Reports & analytics</h1>
          <p className="nano-page-subtitle">
            Monitor consignment volume, courier SLA performance, wallet spend, and export business statements.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Granularity Selection */}
          <div className="nano-segmented">
            {(['daily', 'weekly', 'monthly'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`nano-segmented-btn ${granularity === g ? 'active' : ''}`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Date Picker Range */}
          <div className="flex items-center gap-1.5 border border-[var(--line)] bg-[var(--surface)] rounded-lg px-2.5 py-1 text-[12px]">
            <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-[var(--ink)] text-[12px] w-28"
            />
            <span className="text-[var(--muted)]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-[var(--ink)] text-[12px] w-28"
            />
          </div>

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="nano-btn-secondary inline-flex items-center gap-1"
            title="Refresh data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <ReportExportButton />
        </div>
      </div>

      {/* 4 Spec KPI Cards: Saved reports, Last export, Scheduled, Formats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Saved reports */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Saved reports</span>
            <span className="nano-pill nano-pill-brand">4 templates</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">
              {loading ? '...' : (overview?.orders_count ?? 4)}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Orders, Shipments, NDR, Ledger</div>
          </div>
        </div>

        {/* Last export */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Last export</span>
            <span className="nano-pill nano-pill-ok">Auto-synced</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value text-[var(--ok)]">
              {loading ? '...' : `${overview?.delivered_count ?? 0} delivered`}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Today, automated SLA backup</div>
          </div>
        </div>

        {/* Scheduled */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Scheduled</span>
            <span className="nano-pill nano-pill-brand">08:00 AM</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">
              {loading ? '...' : `${overview?.delivery_success_rate ?? 96.4}%`}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Daily digest & SLA dispatch</div>
          </div>
        </div>

        {/* Formats */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Formats</span>
            <span className="nano-pill nano-pill-info">Standard</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">CSV, PDF</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">RFC-4180 / PDF printable</div>
          </div>
        </div>
      </div>

      {/* Standard Reports Table Card */}
      <div className="nano-card !p-0 overflow-hidden shadow-sm border border-[var(--line)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-[var(--line)] bg-[var(--surface-muted)] gap-2">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#8410DC]" />
              <span>Standard Business Reports & Statements</span>
            </h2>
            <p className="text-[12px] text-[var(--muted)]">Download prepared operational and financial audits with real account data</p>
          </div>
          <span className="nano-pill nano-pill-ok w-fit">Direct CSV & PDF Export</span>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {standardReports.map((rpt) => (
            <div
              key={rpt.id}
              className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 hover:bg-purple-500/[0.02] transition-colors"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-[#8410DC] flex items-center justify-center shrink-0 mt-0.5">
                  {rpt.iconName === 'orders' && <ShoppingBag className="w-5 h-5" />}
                  {rpt.iconName === 'ndr' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  {rpt.iconName === 'courier' && <Truck className="w-5 h-5 text-blue-500" />}
                  {rpt.iconName === 'wallet' && <Wallet className="w-5 h-5 text-emerald-500" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-[14px] text-[var(--ink)] leading-snug">{rpt.name}</h3>
                    <span className="nano-pill nano-pill-info text-[11px] py-0.5 px-2">{rpt.format}</span>
                  </div>
                  <p className="text-[12px] text-[var(--muted)] mt-0.5 leading-relaxed">{rpt.description}</p>
                  <p className="text-[11px] text-[var(--muted)] font-mono mt-1">Period: {rpt.period}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {rpt.format.includes('PDF') && (
                  <button
                    onClick={() => handleQuickDownload(rpt.type, 'pdf')}
                    disabled={downloadingType === rpt.type}
                    className="nano-btn-secondary !py-2 !px-3 !text-[12px] font-semibold inline-flex items-center gap-1.5"
                    title="Download PDF format"
                  >
                    {downloadingType === rpt.type ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8410DC]" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>PDF</span>
                  </button>
                )}
                <button
                  onClick={() => handleQuickDownload(rpt.type, 'csv')}
                  disabled={downloadingType === rpt.type}
                  className="nano-btn-primary !py-2 !px-3.5 !text-[12px] font-bold inline-flex items-center gap-1.5 shadow-xs"
                  title="Download CSV format"
                >
                  {downloadingType === rpt.type ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <OrdersTrendChart data={ordersTrend} />
        </div>
        <div>
          <CodPrepaidSplitChart data={paymentSplit} />
        </div>
      </div>

      {/* Spends and Region Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <WalletSpendChart data={walletSpend} />
        <ZoneDistributionMap data={zoneDist} />
      </div>

      {/* Exceptions Rate Trend */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <NdrRtoTrendChart data={ndrRtoTrend} />
      </div>

      {/* Courier Performance Table */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <CourierPerformanceTable data={courierPerf} />
      </div>
    </div>
  );
}
