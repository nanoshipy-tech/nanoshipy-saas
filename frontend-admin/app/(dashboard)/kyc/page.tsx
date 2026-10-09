'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/apiClient';
import { ShieldCheck, RefreshCw, FileText, ExternalLink, X, Eye, Check, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminKycQueuePage() {
  const [kycList, setKycList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null);
  const [sellerDetails, setSellerDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchKycQueue();
  }, []);

  const fetchKycQueue = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/kyc/platform/queue');
      if (res.data.success) {
        setKycList(res.data.data?.rows || res.data.data || []);
      }
    } catch {
      toast.error('Failed to load KYC queue');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReviewModal = async (seller: any) => {
    setSelectedSeller(seller);
    setLoadingDetails(true);
    try {
      const res = await apiClient.get(`/kyc/platform/${seller.id}`);
      if (res.data.success) {
        setSellerDetails(res.data.data);
      }
    } catch {
      toast.error('Failed to load seller KYC documents');
    } finally {
      setLoadingDetails(false);
    }
  };

  const resolveDocUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = process.env.NEXT_PUBLIC_API_URL || 'https://app.nanoshipy.com';
    return `${base.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleApproveReject = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await apiClient.post(`/kyc/platform/${id}/${action}`, action === 'reject' ? { reason: 'Document verification failed' } : {});
      if (res.data.success) {
        toast.success(`KYC document ${action}d!`);
        setSelectedSeller(null);
        setSellerDetails(null);
        fetchKycQueue();
      }
    } catch {
      toast.error(`Failed to ${action} KYC document`);
    }
  };

  const pendingCount = kycList.filter(k => (k.kyc_status || 'PENDING').toUpperCase() === 'PENDING').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-kpi">
          <div className="admin-kpi-title">Pending KYC</div>
          <div className="admin-kpi-val">{pendingCount}</div>
          <div className="admin-delta admin-delta-neutral">
            Needs review
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Verified Today</div>
          <div className="admin-kpi-val">12</div>
          <div className="admin-delta admin-delta-up">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Active sellers
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Rejected Today</div>
          <div className="admin-kpi-val">0</div>
          <div className="admin-delta admin-delta-neutral">
            Low dispute rate
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-title">Avg. Review Time</div>
          <div className="admin-kpi-val">42m</div>
          <div className="admin-delta admin-delta-up">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Fast SLA
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="admin-card !p-0 overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">KYC Document Approvals</h2>
            <p className="text-[12.5px] text-[var(--muted)]">Review business GSTIN, PAN card, and bank passbook submissions</p>
          </div>
          <button
            type="button"
            onClick={fetchKycQueue}
            className="btn-ref btn-ref-secondary flex items-center gap-1.5 text-[13px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">Loading KYC submissions…</div>
        ) : kycList.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">No pending KYC document submissions.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ref">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Documents</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {kycList.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <div>
                        <span className="font-bold text-[var(--ink)] block">
                          {k.company_name || k.subdomain || 'Direct Merchant'}
                        </span>
                        <span className="text-[11.5px] text-[var(--muted)] font-mono">
                          {k.subdomain ? `${k.subdomain}.nanoshipy.com` : 'ID: ' + k.id?.slice(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="text-[12.5px] text-[var(--muted)] tabular-nums">
                        {new Date(k.kyc_submitted_at || Date.now()).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${(k.kyc_status || 'PENDING').toUpperCase() === 'APPROVED' ? 'pill-ok' : (k.kyc_status || 'PENDING').toUpperCase() === 'REJECTED' ? 'pill-bad' : 'pill-warn'}`}>
                        {k.kyc_status || 'PENDING'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleOpenReviewModal(k)}
                        className="btn-ref btn-ref-secondary inline-flex items-center gap-1.5 text-[12px] py-1 px-2.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Docs
                      </button>
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleApproveReject(k.id, 'approve')}
                        className="btn-ref btn-ref-primary text-[12px] py-1 px-3"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveReject(k.id, 'reject')}
                        className="rounded-[8px] px-3 py-1 text-[12px] font-bold cursor-pointer transition-colors"
                        style={{ background: 'var(--bad)', color: '#fff' }}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Documents Modal */}
      {selectedSeller && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className="rounded-[16px] max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-scale-in border"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="text-[16px] font-bold text-[var(--ink)]">KYC Document Review</h3>
                <p className="text-[12.5px] text-[var(--muted)]">
                  {selectedSeller.company_name} ({selectedSeller.subdomain || 'merchant'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedSeller(null); setSellerDetails(null); }}
                className="p-1.5 rounded-[8px] hover:bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-12 text-center text-[13px] text-[var(--muted)]">Loading KYC verification details…</div>
            ) : sellerDetails ? (
              <div className="space-y-4 text-[13px]">
                <div
                  className="grid grid-cols-2 gap-3 p-3.5 rounded-[12px] border"
                  style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}
                >
                  <div>
                    <span className="text-[var(--muted)] block text-[11px] font-semibold">Legal Business Name</span>
                    <span className="font-bold text-[var(--ink)]">{sellerDetails.business_details?.legal_business_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted)] block text-[11px] font-semibold">Business Type</span>
                    <span className="font-bold text-[var(--ink)] uppercase">{sellerDetails.business_details?.business_type || 'Individual'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted)] block text-[11px] font-semibold">PAN Number</span>
                    <span className="font-mono font-bold text-[var(--brand)]">{sellerDetails.business_details?.pan_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted)] block text-[11px] font-semibold">GSTIN</span>
                    <span className="font-mono font-bold text-[var(--brand)]">{sellerDetails.business_details?.gst_number || 'Unregistered'}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-[var(--ink)] mb-2.5 text-[13px]">Uploaded Verification Documents</h4>
                  {sellerDetails.documents && sellerDetails.documents.length > 0 ? (
                    <div className="space-y-2">
                      {sellerDetails.documents.map((d: any) => {
                        const targetUrl = resolveDocUrl(d.signed_url || d.s3_object_key);
                        return (
                          <div
                            key={d.id}
                            className="flex items-center justify-between p-3 rounded-[10px] border"
                            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
                          >
                            <div className="flex items-center gap-2.5">
                              <FileText className="w-4 h-4 text-[var(--brand)]" />
                              <div>
                                <span className="font-bold text-[var(--ink)] block uppercase text-[11.5px]">{d.document_type?.replace(/_/g, ' ')}</span>
                                <span className="text-[11px] text-[var(--muted)]">{new Date(d.uploaded_at || Date.now()).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                            {targetUrl ? (
                              <a
                                href={targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-ref btn-ref-secondary inline-flex items-center gap-1.5 text-[12px] py-1.5 px-3"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> View
                              </a>
                            ) : (
                              <span className="text-[11.5px] text-[var(--muted)] font-medium italic">File unavailable</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-5 text-center text-[var(--muted)] border border-dashed rounded-[10px]" style={{ borderColor: 'var(--line)' }}>
                      No documents uploaded yet.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-[13px] text-[var(--bad)]">Failed to load details.</div>
            )}

            <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
              <button
                type="button"
                onClick={() => { setSelectedSeller(null); setSellerDetails(null); }}
                className="btn-ref btn-ref-secondary text-[13px]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleApproveReject(selectedSeller.id, 'approve')}
                className="btn-ref btn-ref-primary text-[13px]"
              >
                Approve KYC
              </button>
              <button
                type="button"
                onClick={() => handleApproveReject(selectedSeller.id, 'reject')}
                className="rounded-[10px] px-3.5 py-2 text-[13px] font-bold cursor-pointer text-white"
                style={{ background: 'var(--bad)' }}
              >
                Reject KYC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
