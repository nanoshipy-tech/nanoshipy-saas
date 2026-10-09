'use client';

import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/env';
import { apiClient } from '../../lib/apiClient';
import { useFileUpload } from '../../lib/useFileUpload';
import { FileText, Trash2, UploadCloud, CheckCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../ui/ConfirmModal';

interface DocumentItem {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string;
  created_at?: string;
}

export const DocumentUploadCard = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docType, setDocType] = useState('pan');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });
  const [isDeleting, setIsDeleting] = useState(false);
  const { uploadFile, isUploading, uploadProgress } = useFileUpload();

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/company/profile/documents');
      const raw = res?.data?.data;
      const list = Array.isArray(raw) ? raw : raw?.documents || raw?.rows || [];
      setDocuments(Array.isArray(list) ? list : []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      setError('');
      await uploadFile('/company/profile/documents', file, 'document', { document_type: docType });
      toast.success('Document uploaded for verification');
      fetchDocuments();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to upload document';
      setError(msg);
      toast.error(msg);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/company/profile/documents/${deleteModal.id}`);
      toast.success('Document removed');
      setDeleteModal({ isOpen: false });
      fetchDocuments();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to delete document';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case 'rejected':
        return <Trash2 className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  const backendUrl = API_URL.replace('/api/v1', '');

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E8DEF2] mt-6">
      <div className="flex items-center justify-between border-b border-[#F2ECF7] pb-3 mb-4">
        <h3 className="text-sm font-bold text-[#14121F] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#5B069A]" />
          KYC Compliance & Verification Documents
        </h3>
        <button onClick={fetchDocuments} className="p-1 text-[#534F66] hover:text-[#14121F] rounded-lg">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs border border-rose-200 mb-4">{error}</div>}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-xl border border-[#E8DEF2] bg-white text-[#14121F] px-3.5 py-2.5 text-xs focus:border-[#5B069A] focus:outline-none"
        >
          <option value="pan">Company / Individual PAN Card</option>
          <option value="gst_certificate">GST Registration Certificate</option>
          <option value="bank_cheque">Bank Cancelled Cheque / Account Statement</option>
          <option value="address_proof">Registered Business Address Proof</option>
          <option value="cin_certificate">Certificate of Incorporation (CIN)</option>
          <option value="other">Other Supporting Documents</option>
        </select>

        <label
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] text-white font-semibold text-xs shadow-sm cursor-pointer hover:opacity-95 transition-all active:scale-[0.98] ${
            isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>{isUploading ? `Uploading ${uploadProgress}%...` : 'Upload Document'}</span>
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} disabled={isUploading} />
        </label>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-[#534F66] text-xs text-center py-4">Loading documents...</p>
        ) : (documents || []).length === 0 ? (
          <div className="text-center py-6 border border-dashed border-[#E8DEF2] rounded-2xl space-y-1">
            <FileText className="w-6 h-6 mx-auto text-[#7E7994]" />
            <p className="text-xs font-semibold text-[#14121F]">No KYC documents uploaded yet.</p>
            <p className="text-[11px] text-[#7E7994]">Upload PAN, GST, and Bank Cheque documents to activate full prepaid and COD courier access.</p>
          </div>
        ) : (
          (documents || []).map((doc) => {
            const fileUrl = doc.file_url ? (doc.file_url.startsWith('http') ? doc.file_url : `${backendUrl}${doc.file_url}`) : '#';
            return (
              <div key={doc.id || Math.random()} className="p-3.5 border border-[#E8DEF2] rounded-xl hover:bg-slate-50/50 transition space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-[#5B069A] shrink-0" />
                    <div>
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#5B069A] hover:underline">
                        {doc.file_name || 'Document'}
                      </a>
                      <div className="flex items-center space-x-2 text-[10px] text-[#7E7994] mt-0.5">
                        <span className="uppercase font-semibold">{(doc.document_type || 'Doc').replace(/_/g, ' ')}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold">
                          {getStatusIcon(doc.status)} <span className="capitalize">{doc.status || 'Pending'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  {doc.status !== 'verified' && (
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, id: doc.id })}
                      className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {doc.status === 'rejected' && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800">
                    <span className="font-bold">Rejection Reason:</span>{' '}
                    <span>{doc.rejection_reason || 'Document does not meet compliance requirements. Please re-upload a clear official copy.'}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={confirmDelete}
        title="Remove Document"
        description="Are you sure you want to remove this verification document?"
        confirmText="Remove Document"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
