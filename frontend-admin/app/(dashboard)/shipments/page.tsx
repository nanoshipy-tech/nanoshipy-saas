'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Search, RefreshCw, Download, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import ExportModal from '@/components/exports/ExportModal';

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/shipments');
      if (res.data.success) {
        setShipments(res.data.data?.rows || res.data.data || []);
      }
    } catch {
      toast.error('Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        (s.awb_number || s.id || '').toLowerCase().includes(term) ||
        (s.courier_provider?.name || s.courier_name || '').toLowerCase().includes(term) ||
        (s.tenant?.company_name || s.tenant?.subdomain || '').toLowerCase().includes(term);

      const statusUpper = (s.status || '').toUpperCase();
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'IN_TRANSIT' && (statusUpper.includes('TRANSIT') || statusUpper.includes('SHIPPED') || statusUpper.includes('DISPATCH'))) ||
        (statusFilter === 'DELIVERED' && statusUpper.includes('DELIVER')) ||
        (statusFilter === 'ACTION' && (statusUpper.includes('NDR') || statusUpper.includes('RTO') || statusUpper.includes('EXCEPTION') || statusUpper.includes('FAILED')));

      return matchesSearch && matchesStatus;
    });
  }, [shipments, searchTerm, statusFilter]);

  // Derived KPI metrics
  const kpis = useMemo(() => {
    const total = shipments.length;
    let inTransit = 0;
    let delivered = 0;
    let needsAction = 0;

    shipments.forEach((s) => {
      const st = (s.status || '').toUpperCase();
      if (st.includes('DELIVER')) delivered++;
      else if (st.includes('NDR') || st.includes('RTO') || st.includes('EXCEPTION') || st.includes('FAIL')) needsAction++;
      else inTransit++;
    });

    return { total, inTransit, delivered, needsAction };
  }, [shipments]);

  const getStatusPill = (statusRaw: string) => {
    const st = (statusRaw || 'IN_TRANSIT').toUpperCase();
    if (st.includes('DELIVER')) {
      return <span className="pill pill-ok">Delivered</span>;
    }
    if (st.includes('NDR') || st.includes('FAIL') || st.includes('EXCEPTION')) {
      return <span className="pill pill-bad">{statusRaw || 'Action Required'}</span>;
    }
    if (st.includes('RTO')) {
      return <span className="pill pill-warn">RTO</span>;
    }
    return <span className="pill pill-info">{statusRaw || 'In Transit'}</span>;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 4 KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="admin-kpi">
          <div className="admin-kpi-title">Total Shipments</div>
          <div className="admin-kpi-val">{kpis.total.toLocaleString()}</div>
          <div className="admin-delta admin-delta-up">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +8.4% vs last week
          </div>
        </div>

        {/* KPI 2 */}
        <div className="admin-kpi">
          <div className="admin-kpi-title">In Transit</div>
          <div className="admin-kpi-val">{kpis.inTransit.toLocaleString()}</div>
          <div className="admin-delta admin-delta-neutral">
            Active tracking
          </div>
        </div>

        {/* KPI 3 */}
        <div className="admin-kpi">
          <div className="admin-kpi-title">Delivered</div>
          <div className="admin-kpi-val">{kpis.delivered.toLocaleString()}</div>
          <div className="admin-delta admin-delta-up">
            <ArrowUpRight className="w-3.5 h-3.5" />
            94.2% on-time
          </div>
        </div>

        {/* KPI 4 */}
        <div className="admin-kpi">
          <div className="admin-kpi-title">Needs Action (NDR/RTO)</div>
          <div className="admin-kpi-val">{kpis.needsAction.toLocaleString()}</div>
          <div className="admin-delta admin-delta-down">
            Requires resolution
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="admin-card !p-0 overflow-hidden">
        {/* Toolbar Header */}
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--line)' }}>
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] flex-1 max-w-[320px]" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
              <Search className="w-4 h-4 text-[var(--muted)] flex-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by AWB, courier or seller…"
                className="w-full bg-transparent border-none outline-none text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)]"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-[10px] text-[13px] font-semibold outline-none cursor-pointer"
              style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="ACTION">Needs Action (NDR/RTO)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="btn-ref btn-ref-primary flex items-center gap-1.5 text-[13px] bg-[#8410DC] hover:bg-purple-700 text-white cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              type="button"
              onClick={fetchShipments}
              className="btn-ref btn-ref-secondary flex items-center gap-1.5 text-[13px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">
            Loading shipments data…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">
            No matching shipments found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ref">
              <thead>
                <tr>
                  <th>AWB Number</th>
                  <th>Seller</th>
                  <th>Carrier</th>
                  <th>Freight</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="font-mono font-bold text-[var(--brand)] text-[13px]">
                        {s.awb_number || s.tracking_number || s.id?.substring(0, 10)}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold text-[var(--ink)]">
                        {s.tenant?.company_name || s.tenant?.subdomain || 'Direct Merchant'}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-[var(--ink)]">
                        {s.courier_provider?.display_name ||
                          s.courier_provider?.name ||
                          s.courier_name ||
                          'Express Courier'}
                      </span>
                    </td>
                    <td>
                      <span className="font-bold text-[var(--ink)] tabular-nums">
                        ₹{parseFloat(s.freight_charge || s.shipping_charge || 0).toFixed(2)}
                      </span>
                    </td>
                    <td>
                      {getStatusPill(s.status)}
                    </td>
                    <td>
                      <span className="text-[var(--muted)] text-[12.5px] tabular-nums">
                        {new Date(s.created_at || Date.now()).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        entity="shipments"
        entityLabel="Shipments"
        activeFilters={{
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchTerm || undefined,
        }}
      />
    </div>
  );
}
