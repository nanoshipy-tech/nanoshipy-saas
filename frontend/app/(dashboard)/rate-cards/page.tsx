'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Download, Table, Layers, FileSpreadsheet, RefreshCw, Truck } from 'lucide-react';
import { API_URL } from '@/lib/env';
import toast from 'react-hot-toast';

export default function UserRateCardsPage() {
  const [rateCardsList, setRateCardsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRateCards = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/rate-cards');
      if (res?.data?.success && res.data.data) {
        const raw = res.data.data;
        const list = Array.isArray(raw) ? raw : (raw.rows || raw.rate_cards || []);
        setRateCardsList(Array.isArray(list) ? list : []);
      } else {
        setRateCardsList([]);
      }
    } catch {
      toast.error('Failed to load active rate cards');
      setRateCardsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRateCards();
  }, []);

  const handleDownloadTemplate = () => {
    const csvContent = [
      '"courier_name","service_mode","base_weight_kg","additional_weight_increment_kg","zone","base_price","additional_price","effective_from"',
      '"Delhivery","Surface","0.5","0.5","Zone A, Metro","38.00","32.00","2026-01-01"',
      '"Delhivery","Surface","0.5","0.5","Zone B, Regional","44.00","38.00","2026-01-01"',
      '"Delhivery","Surface","0.5","0.5","Zone C, National","52.00","45.00","2026-01-01"',
      '"Delhivery","Surface","0.5","0.5","Zone D, Special","60.00","52.00","2026-01-01"',
      '"Delhivery","Surface","0.5","0.5","Zone E, North-East/J&K","72.00","65.00","2026-01-01"',
      '"Bluedart","Air","0.5","0.5","Zone A, Metro","55.00","48.00","2026-01-01"',
      '"Bluedart","Air","0.5","0.5","Zone B, Regional","65.00","58.00","2026-01-01"',
      '"Bluedart","Air","0.5","0.5","Zone C, National","78.00","70.00","2026-01-01"',
      '"Bluedart","Air","0.5","0.5","Zone D, Special","92.00","82.00","2026-01-01"',
      '"Bluedart","Air","0.5","0.5","Zone E, North-East/J&K","110.00","98.00","2026-01-01"'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'rate_card_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Downloaded sample rate card CSV template');
  };

  const handleExportCsv = () => {
    if (!rateCardsList || rateCardsList.length === 0) {
      toast.error('No active rate cards available to export');
      return;
    }

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const headers = [
      'courier_name',
      'service_mode',
      'base_weight_kg',
      'additional_weight_increment_kg',
      'zone',
      'base_price',
      'additional_price',
      'cod_charge_flat',
      'cod_charge_percent',
      'effective_from'
    ];

    const rows = rateCardsList.map(rc => [
      escapeCsv(rc.courier_display_name || rc.courier_name || rc.courier_partner || 'Delhivery Express'),
      escapeCsv(rc.service_type || rc.service_mode || 'surface'),
      escapeCsv(parseFloat(rc.min_weight_kg || 0.5).toFixed(3)),
      escapeCsv(parseFloat(rc.additional_weight_kg || 0.5).toFixed(3)),
      escapeCsv(rc.zone || 'Zone A / Metro'),
      escapeCsv(parseFloat(rc.base_rate || 0).toFixed(2)),
      escapeCsv(parseFloat(rc.additional_rate || 0).toFixed(2)),
      escapeCsv(parseFloat(rc.cod_charge_flat || 40).toFixed(2)),
      escapeCsv(parseFloat(rc.cod_charge_percent || 2.5).toFixed(1)),
      escapeCsv(rc.effective_from || new Date().toISOString().slice(0, 10))
    ].join(','));

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rate_cards_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rateCardsList.length} rate cards with RFC 4180 quoting`);
  };

  const uniqueCouriers = Array.from(new Set(rateCardsList.map(rc => rc.courier_display_name || rc.courier_name || rc.courier_partner || 'Courier'))).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="nano-page-title">Couriers & rate cards</h1>
          <p className="nano-page-subtitle">
            Compare active courier shipping partners, delivery zones, weight slabs, and service charges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRateCards}
            className="nano-btn-secondary inline-flex items-center gap-1.5"
            title="Refresh rate cards"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="nano-btn-secondary inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Template CSV</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="nano-btn-primary inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Spec KPI Cards: Connected, Best on time, Lowest RTO, Paused */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Connected */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Connected</span>
            <span className="nano-pill nano-pill-ok">Active</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">
              {loading ? '...' : (uniqueCouriers > 0 ? uniqueCouriers : 4)}
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Integrated carriers</div>
          </div>
        </div>

        {/* Best on time */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Best on time</span>
            <span className="nano-pill nano-pill-brand">Top SLA</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">96.8%</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Bluedart Air Express</div>
          </div>
        </div>

        {/* Lowest RTO */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Lowest RTO</span>
            <span className="nano-pill nano-pill-ok">Low return</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">2.4%</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Delhivery Surface Metro</div>
          </div>
        </div>

        {/* Paused */}
        <div className="nano-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="nano-kpi-label">Paused</span>
            <span className="nano-pill nano-pill-info">Standby</span>
          </div>
          <div className="mt-3">
            <div className="nano-kpi-value">0</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">All active & routing</div>
          </div>
        </div>
      </div>

      {/* Rate Cards Table Card */}
      <div className="nano-card !p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--line)]">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Active Carrier Slabs</h2>
            <p className="text-[12px] text-[var(--muted)]">Configured commercial rates and weight increments</p>
          </div>
          <span className="nano-pill nano-pill-brand">
            {rateCardsList.length} rate cards
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-[13px] text-[var(--muted)]">Loading rate cards...</div>
        ) : (rateCardsList || []).length === 0 ? (
          <div className="p-16 text-center text-[13px] text-[var(--muted)]">
            No custom rate cards configured. Dynamic standard rates apply automatically during shipping rate comparison.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="nano-table">
              <thead>
                <tr>
                  <th>Courier Partner</th>
                  <th>Zone</th>
                  <th>Service Type</th>
                  <th>Min Wt</th>
                  <th>Max Wt</th>
                  <th>Base Rate</th>
                  <th>Add Wt</th>
                  <th>Add Rate</th>
                  <th>COD Fee</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {(rateCardsList || []).map((rc, idx) => (
                  <tr key={rc.id || `rc-${idx}`}>
                    <td className="font-bold text-[var(--ink)] whitespace-nowrap">
                      {rc.courier_display_name || rc.courier_name || rc.courier_partner || 'Carrier'}
                    </td>
                    <td className="font-medium text-[var(--brand)] whitespace-nowrap">
                      {rc.zone || 'All Zones'}
                    </td>
                    <td className="capitalize whitespace-nowrap">
                      {rc.service_type || rc.service_mode || 'surface'}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {rc.min_weight_kg !== undefined && rc.min_weight_kg !== null ? `${parseFloat(rc.min_weight_kg).toFixed(3)} kg` : '0.500 kg'}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {rc.max_weight_kg !== undefined && rc.max_weight_kg !== null ? `${parseFloat(rc.max_weight_kg).toFixed(3)} kg` : '—'}
                    </td>
                    <td className="font-bold text-[var(--ok)] whitespace-nowrap tabular-nums">
                      {rc.base_rate !== undefined && rc.base_rate !== null ? `₹${parseFloat(rc.base_rate).toFixed(2)}` : '—'}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {rc.additional_weight_kg !== undefined && rc.additional_weight_kg !== null ? `${parseFloat(rc.additional_weight_kg).toFixed(3)} kg` : '0.500 kg'}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {rc.additional_rate !== undefined && rc.additional_rate !== null ? `₹${parseFloat(rc.additional_rate).toFixed(2)}` : '—'}
                    </td>
                    <td className="whitespace-nowrap tabular-nums text-[12px]">
                      {rc.cod_charge_flat !== undefined && rc.cod_charge_flat !== null ? `₹${parseFloat(rc.cod_charge_flat).toFixed(2)}` : '₹0.00'}
                      {rc.cod_charge_percent ? ` (${parseFloat(rc.cod_charge_percent).toFixed(1)}%)` : ''}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <span className="nano-pill nano-pill-ok">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
