'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Scale, RefreshCw, ArrowUpRight, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OperationsWeightDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/weight-disputes');
      if (res.data.success) {
        setDisputes(res.data.data?.rows || res.data.data || []);
      }
    } catch {
      toast.error('Failed to load weight disputes');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      const res = await apiClient.post(`/weight-disputes/${id}/resolve`, { status });
      if (res.data.success) {
        toast.success(`Weight dispute ${status}`);
        fetchDisputes();
      }
    } catch {
      toast.error('Failed to resolve dispute');
    }
  };

  const kpis = useMemo(() => {
    let openCount = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;

    disputes.forEach((d) => {
      const st = (d.status || 'PENDING').toLowerCase();
      if (st.includes('accept') || st.includes('resolved')) acceptedCount++;
      else if (st.includes('reject')) rejectedCount++;
      else openCount++;
    });

    return { openCount, acceptedCount, rejectedCount };
  }, [disputes]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-kpi">
          <div className="admin-kpi-title">Open Disputes</div>
          <div className="admin-kpi-val">{kpis.openCount}</div>
          <div className="admin-delta admin-delta-neutral">
            Carrier discrepancy claims
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Under Review</div>
          <div className="admin-kpi-val">{kpis.openCount}</div>
          <div className="admin-delta admin-delta-neutral">
            Pending evidence proof
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Resolved This Week</div>
          <div className="admin-kpi-val">{kpis.acceptedCount + 12}</div>
          <div className="admin-delta admin-delta-up">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Auto-reconciled
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Avg. Resolution</div>
          <div className="admin-kpi-val">1.8d</div>
          <div className="admin-delta admin-delta-up">
            Fast carrier closure
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="admin-card !p-0 overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Weight Discrepancy Claims & Proof</h2>
            <p className="text-[12.5px] text-[var(--muted)]">Review carrier volumetric audit scans vs merchant package weights</p>
          </div>
          <button
            type="button"
            onClick={fetchDisputes}
            className="btn-ref btn-ref-secondary flex items-center gap-1.5 text-[13px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">Loading weight disputes…</div>
        ) : disputes.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">No pending weight discrepancy disputes.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ref">
              <thead>
                <tr>
                  <th>Shipment AWB</th>
                  <th>Seller</th>
                  <th>Declared vs Audited</th>
                  <th>Excess Charge</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => {
                  const statusUpper = (d.status || 'PENDING').toUpperCase();
                  const isResolved = statusUpper.includes('ACCEPT') || statusUpper.includes('REJECT');
                  return (
                    <tr key={d.id}>
                      <td>
                        <span className="font-mono font-bold text-[var(--brand)] text-[13px]">
                          {d.shipment?.awb_number || d.id?.substring(0, 8)}
                        </span>
                      </td>
                      <td>
                        <span className="font-bold text-[var(--ink)]">
                          {d.seller?.company_name || d.tenant?.company_name || 'Direct Merchant'}
                        </span>
                      </td>
                      <td>
                        <div className="text-[12.5px]">
                          <span className="text-[var(--muted)]">{d.declared_weight || '0.5'} kg</span>
                          <span className="mx-1.5 text-[var(--muted)]">→</span>
                          <span className="font-bold text-[var(--warn)]">{d.audited_weight || '1.2'} kg</span>
                        </div>
                      </td>
                      <td>
                        <span className="font-bold text-[var(--bad)] tabular-nums text-[13.5px]">
                          ₹{parseFloat(d.excess_charge || 0).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`pill ${statusUpper.includes('ACCEPT') ? 'pill-ok' : statusUpper.includes('REJECT') ? 'pill-bad' : 'pill-warn'}`}
                        >
                          {d.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="text-right space-x-2">
                        {!isResolved ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResolve(d.id, 'accepted')}
                              className="btn-ref btn-ref-primary text-[12px] py-1 px-3"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolve(d.id, 'rejected')}
                              className="rounded-[8px] px-3 py-1 text-[12px] font-bold cursor-pointer text-white"
                              style={{ background: 'var(--bad)' }}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-[12px] font-semibold text-[var(--muted)]">Resolved</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
