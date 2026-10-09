'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Users, Search, ShieldCheck, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Building2, Mail, ExternalLink, CreditCard, ChevronLeft, ChevronRight,
  X, Check, AlertTriangle, ArrowUpRight, Shield, Wallet, Settings, Package, ShoppingCart,
  Edit3, Save, Key, Eye, EyeOff, Copy, MapPin, Plus, Lock, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

import PaymentTermsTab from './PaymentTermsTab';
import DeleteSellerModal from '@/components/sellers/DeleteSellerModal';

export default function PlatformSellersPage() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Manage Seller Modal State
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [tenantDetails, setTenantDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'warehouses' | 'credentials' | 'status' | 'kyc' | 'wallet' | 'payment_terms' | 'danger'>('overview');

  // Delete Seller State & Automated Backup Modal
  const [sellerToDelete, setSellerToDelete] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Password Visibility & Change State
  const [showPassword, setShowPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Warehouses Management State
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({
    label: '',
    contact_name: '',
    contact_phone: '',
    address_line1: '',
    address_line2: '',
    pincode: '',
    city: '',
    state: '',
    is_default: true,
  });

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    company_name: '',
    legal_name: '',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    business_type: 'proprietorship',
    state: '',
    gstin: '',
    pan_number: '',
    status: 'active',
    kam_id: '',
    is_booking_office: false,
  });
  const [kams, setKams] = useState<any[]>([]);

  // Wallet adjustment form state
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // KYC update state
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingKyc, setSubmittingKyc] = useState(false);

  // Status update state
  const [submittingStatus, setSubmittingStatus] = useState(false);

  useEffect(() => {
    fetchSellers();
  }, [page, selectedStatus]);

  useEffect(() => {
    fetchKams();
  }, []);

  const fetchKams = async () => {
    try {
      const res = await apiClient.get('/platform/auth/admins');
      if (res.data.success) {
        setKams(res.data.data.admins || res.data.data || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20 };
      if (selectedStatus) params.status = selectedStatus;

      const res = await apiClient.get('/platform/sellers', { params });
      if (res.data.success) {
        const list = res.data.data.sellers || res.data.data.rows || res.data.data || [];
        setSellers(list);
        if (res.data.data.pagination) {
          setPagination(res.data.data.pagination);
        }
      }
    } catch {
      toast.error('Failed to load seller accounts');
    } finally {
      setLoading(false);
    }
  };

  const openManageTenant = async (seller: any, startInEdit = false) => {
    setSelectedTenant(seller);
    setActiveTab('overview');
    setIsEditingProfile(startInEdit);
    setAdjustAmount('');
    setAdjustReason('');
    setRejectionReason('');
    setShowPassword(false);
    setNewPasswordInput('');
    setIsChangingPassword(false);
    setShowAddWarehouse(false);
    fetchTenantWarehouses(seller.id);

    setEditForm({
      company_name: seller.company_name || seller.name || '',
      legal_name: seller.legal_name || seller.legal_business_name || '',
      owner_name: seller.owner_name || seller.owner?.name || '',
      owner_email: seller.owner_email || seller.owner?.email || seller.support_email || '',
      owner_phone: seller.owner_phone || seller.owner?.phone || seller.support_phone || '',
      business_type: seller.business_type || 'proprietorship',
      state: seller.state || '',
      gstin: seller.gstin || seller.gst_number || '',
      pan_number: seller.pan_number || '',
      status: seller.status || 'active',
      kam_id: seller.kam_id || '',
      is_booking_office: Boolean(seller.is_booking_office),
    });

    try {
      setDetailsLoading(true);
      const res = await apiClient.get(`/platform/sellers/${seller.id}`);
      if (res.data.success) {
        const d = res.data.data;
        setTenantDetails(d);
        if (d.warehouses) {
          setWarehouses(d.warehouses);
        }
        setEditForm({
          company_name: d.company_name || '',
          legal_name: d.legal_name || d.legal_business_name || '',
          owner_name: d.owner?.name || seller.owner_name || '',
          owner_email: d.owner?.email || d.support_email || '',
          owner_phone: d.owner?.phone || d.support_phone || '',
          business_type: d.business_type || 'proprietorship',
          state: d.state || '',
          gstin: d.gstin || d.gst_number || '',
          pan_number: d.pan_number || '',
          status: d.status || 'active',
          kam_id: d.kam_id || d.kam?.id || '',
          is_booking_office: Boolean(d.is_booking_office !== undefined ? d.is_booking_office : seller.is_booking_office),
        });
      } else {
        setTenantDetails(seller);
      }
    } catch {
      setTenantDetails(seller);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) {
      toast.error(`No ${label} available to copy`);
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const fetchTenantWarehouses = async (tenantId: string) => {
    try {
      setLoadingWarehouses(true);
      const res = await apiClient.get(`/platform/sellers/${tenantId}/addresses`);
      if (res.data.success) {
        setWarehouses(res.data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const handleUpdateSellerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant || !newPasswordInput.trim()) return;
    if (newPasswordInput.trim().length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    try {
      setSavingPassword(true);
      const res = await apiClient.post(`/platform/sellers/${selectedTenant.id}/password`, {
        new_password: newPasswordInput.trim(),
      });
      if (res.data.success) {
        toast.success('Seller password updated successfully!');
        const updatedPass = newPasswordInput.trim();
        setTenantDetails((prev: any) => ({
          ...prev,
          owner: {
            ...prev?.owner,
            viewable_password: updatedPass,
          },
        }));
        setNewPasswordInput('');
        setIsChangingPassword(false);
      } else {
        toast.error(res.data.message || 'Failed to update password');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    try {
      setSavingWarehouse(true);
      const res = await apiClient.post(`/platform/sellers/${selectedTenant.id}/addresses`, warehouseForm);
      if (res.data.success) {
        toast.success('Warehouse pickup address added successfully!');
        setShowAddWarehouse(false);
        setWarehouseForm({
          label: '',
          contact_name: '',
          contact_phone: '',
          address_line1: '',
          address_line2: '',
          pincode: '',
          city: '',
          state: '',
          is_default: true,
        });
        fetchTenantWarehouses(selectedTenant.id);
      } else {
        toast.error(res.data.message || 'Failed to add warehouse');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to add warehouse');
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleDeleteWarehouse = async (addressId: string) => {
    if (!selectedTenant) return;
    if (!confirm('Are you sure you want to delete this warehouse pickup address?')) return;
    try {
      const res = await apiClient.delete(`/platform/sellers/${selectedTenant.id}/addresses/${addressId}`);
      if (res.data.success) {
        toast.success('Warehouse address deleted');
        setWarehouses(prev => prev.filter(w => w.id !== addressId));
      } else {
        toast.error(res.data.message || 'Failed to delete warehouse');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete warehouse');
    }
  };

  const handleToggleBookingOffice = async (seller: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!seller) return;
    const currentStatus = Boolean(seller.is_booking_office);
    const nextStatus = !currentStatus;
    try {
      const res = await apiClient.put(`/platform/sellers/${seller.id}`, {
        is_booking_office: nextStatus,
      });
      if (res.data.success) {
        toast.success(`Booking Office ${nextStatus ? 'ENABLED' : 'DISABLED'} for ${seller.company_name || seller.name || 'seller'}`);
        setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, is_booking_office: nextStatus } : s));
        if (selectedTenant && selectedTenant.id === seller.id) {
          setSelectedTenant((prev: any) => ({ ...prev, is_booking_office: nextStatus }));
          setTenantDetails((prev: any) => ({ ...prev, is_booking_office: nextStatus }));
          setEditForm(prev => ({ ...prev, is_booking_office: nextStatus }));
        }
      } else {
        toast.error(res.data.message || 'Failed to update Booking Office status');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update Booking Office status');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    try {
      setSavingProfile(true);
      const res = await apiClient.put(`/platform/sellers/${selectedTenant.id}`, editForm);
      if (res.data.success) {
        toast.success('Seller profile updated successfully!');
        const updated = res.data.data;
        setTenantDetails(updated);
        setSelectedTenant((prev: any) => ({ ...prev, ...updated }));
        setIsEditingProfile(false);
        fetchSellers();
      } else {
        toast.error(res.data.message || 'Failed to update profile');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const closeManageTenant = () => {
    setSelectedTenant(null);
    setTenantDetails(null);
  };

  const handleUpdateStatus = async (newStatus: 'active' | 'suspended' | 'pending') => {
    if (!selectedTenant) return;
    try {
      setSubmittingStatus(true);
      const res = await apiClient.put(`/platform/sellers/${selectedTenant.id}/status`, {
        status: newStatus
      });
      if (res.data.success) {
        toast.success(`Tenant status updated to ${newStatus.toUpperCase()}`);
        setTenantDetails((prev: any) => ({ ...prev, status: newStatus }));
        fetchSellers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleUpdateKyc = async (newKycStatus: 'approved' | 'rejected' | 'pending') => {
    if (!selectedTenant) return;
    try {
      setSubmittingKyc(true);
      const res = await apiClient.put(`/platform/sellers/${selectedTenant.id}/kyc`, {
        kyc_status: newKycStatus,
        rejection_reason: newKycStatus === 'rejected' ? (rejectionReason || 'Rejected by platform admin') : null
      });
      if (res.data.success) {
        toast.success(`KYC status updated to ${newKycStatus.toUpperCase()}`);
        setTenantDetails((prev: any) => ({ ...prev, kyc_status: newKycStatus }));
        fetchSellers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update KYC status');
    } finally {
      setSubmittingKyc(false);
    }
  };

  const handleWalletAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    const amountNum = parseFloat(adjustAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    try {
      setSubmittingAdjust(true);
      const res = await apiClient.post(`/platform/sellers/${selectedTenant.id}/wallet/adjust`, {
        amount: amountNum,
        type: adjustType,
        reason: adjustReason || `Manual ${adjustType} adjustment by admin`
      });

      if (res.data.success) {
        toast.success(`Wallet successfully ${adjustType === 'credit' ? 'credited' : 'debited'}!`);
        setAdjustAmount('');
        setAdjustReason('');
        // Refresh details
        const refreshed = await apiClient.get(`/platform/sellers/${selectedTenant.id}`);
        if (refreshed.data.success) {
          setTenantDetails(refreshed.data.data);
        }
        fetchSellers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to adjust wallet');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleImpersonate = async () => {
    if (!selectedTenant) return;
    try {
      const res = await apiClient.post(`/platform/impersonate/${selectedTenant.id}`, {
        reason: 'Superadmin direct tenant inspection'
      });
      if (res.data.success && res.data.data?.token) {
        const token = res.data.data.token;
        const merchantPortalUrl = `https://app.nanoshipy.com/login?impersonate_token=${encodeURIComponent(token)}`;
        window.open(merchantPortalUrl, '_blank');
        toast.success('Opening merchant portal in new window...');
      } else {
        window.open(`https://app.nanoshipy.com`, '_blank');
      }
    } catch {
      window.open(`https://app.nanoshipy.com`, '_blank');
    }
  };

  const filteredSellers = sellers.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const company = (s.company_name || s.name || '').toLowerCase();
    const subdomain = (s.subdomain || '').toLowerCase();
    const email = (s.owner_email || s.email || '').toLowerCase();
    return company.includes(term) || subdomain.includes(term) || email.includes(term);
  });

  const totalCount = pagination.total || sellers.length;
  const activeCount = sellers.filter(s => s.status === 'active').length;
  const pendingCount = sellers.filter(s => s.status === 'pending' || s.kyc_status === 'pending').length;
  const suspendedCount = sellers.filter(s => s.status === 'suspended').length;

  return (
    <div className="space-y-4">
      {/* 4 KPI CARDS */}
      <section className="grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1" aria-label="Sellers Key Numbers">
        <div className="admin-kpi">
          <div className="l">Total sellers</div>
          <div className="v">{totalCount}</div>
          <div className="admin-delta up"><span>All registered accounts</span></div>
        </div>
        <div className="admin-kpi">
          <div className="l">Active sellers</div>
          <div className="v">{activeCount}</div>
          <div className="admin-delta up"><span>Currently shipping</span></div>
        </div>
        <div className="admin-kpi">
          <div className="l">Pending review</div>
          <div className="v">{pendingCount}</div>
          <div className="admin-delta dn"><span>Requires action</span></div>
        </div>
        <div className="admin-kpi">
          <div className="l">Suspended</div>
          <div className="v">{suspendedCount}</div>
          <div className="admin-delta dn"><span>Restricted access</span></div>
        </div>
      </section>

      {/* Toolbar & Filters */}
      <div className="admin-card flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search seller by name, city or email..."
            className="input-ref pl-10"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedStatus}
            onChange={e => { setSelectedStatus(e.target.value); setPage(1); }}
            className="input-ref w-auto py-2 font-semibold"
          >
            <option value="">All Account Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
          <button
            onClick={fetchSellers}
            disabled={loading}
            className="btn-ref py-2 px-3 text-[13px] shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Sellers Table */}
      <div className="admin-card p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px] font-semibold">Loading sellers...</div>
        ) : filteredSellers.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)] text-[13px]">No results match this filter.</div>
        ) : (
          <div className="table-ref-wrap">
            <table className="table-ref">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>City</th>
                  <th>Plan</th>
                  <th>Shipments (30d)</th>
                  <th>Wallet</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSellers.map((s) => (
                  <tr key={s.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="font-bold text-[var(--ink)]">
                      <div>
                        <p className="font-bold text-[13.5px] text-[var(--ink)] m-0">{s.company_name || s.name}</p>
                        <p className="text-[11.5px] text-[var(--muted)] m-0">{s.owner_email || s.email}</p>
                      </div>
                    </td>
                    <td className="text-[var(--muted)] text-[13px]">
                      {s.city || s.state || 'Chennai'}
                    </td>
                    <td>
                      <span className="pill p-info">{s.plan || 'Standard'}</span>
                    </td>
                    <td className="tabular-nums font-semibold text-[13.5px]">
                      {s.shipments_count || s.shipment_count || 124}
                    </td>
                    <td className="tabular-nums font-bold text-[13.5px]">
                      ₹{(s.wallet?.balance || s.balance || 0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`pill ${
                        s.status === 'active' ? 'p-ok' : s.status === 'suspended' ? 'p-bad' : 'p-warn'
                      }`}>
                        {s.status === 'active' ? 'Active' : s.status === 'suspended' ? 'Suspended' : 'Pending'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openManageTenant(s, false)}
                          className="btn-ref text-[12px] py-1 px-2.5 rounded-[8px]"
                        >
                          Manage
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSellerToDelete(s);
                            setIsDeleteModalOpen(true);
                          }}
                          className="btn-ref text-[12px] py-1 px-2 rounded-[8px] text-[var(--bad)] hover:border-[var(--bad)]"
                          title="Delete Seller Account & Backup"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MANAGE SELLER MODAL / DRAWER */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50/70 via-white to-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#8410DC] text-white flex items-center justify-center font-black text-base shadow-sm">
                  {(tenantDetails?.company_name || selectedTenant.company_name || 'T').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    {tenantDetails?.company_name || selectedTenant.company_name}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${tenantDetails?.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {tenantDetails?.status || 'ACTIVE'}
                    </span>
                  </h2>
                  <p className="text-[11px] font-mono text-slate-500">
                    {selectedTenant.subdomain}.nanoshipy.com • ID: {selectedTenant.id?.slice(0, 8)}...
                  </p>
                </div>
              </div>
              <button
                onClick={closeManageTenant}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 px-6 bg-slate-50/50 text-xs font-bold gap-4 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview & Profile', icon: Building2 },
                { id: 'credentials', label: 'Credentials & Login', icon: Key },
                { id: 'warehouses', label: 'Warehouses & Pickup', icon: MapPin },
                { id: 'kyc', label: 'KYC Management', icon: ShieldCheck },
                { id: 'status', label: 'Status & Permissions', icon: Settings },
                { id: 'wallet', label: 'Prepaid Wallet', icon: Wallet },
                { id: 'payment_terms', label: 'Payment Terms & Postpaid', icon: CreditCard },
                { id: 'danger', label: 'Danger Zone', icon: Trash2 },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 flex items-center gap-2 border-b-2 font-black whitespace-nowrap transition cursor-pointer ${activeTab === tab.id ? 'border-[#8410DC] text-[#8410DC]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-800">
              {detailsLoading ? (
                <div className="p-12 text-center font-bold text-slate-400">Loading full tenant details...</div>
              ) : activeTab === 'overview' ? (
                <div className="space-y-6">
                  {/* Quick Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100">
                      <p className="text-[10px] font-bold text-purple-700 uppercase">Wallet Balance</p>
                      <p className="text-lg font-black text-slate-900 mt-0.5">
                        ₹{(tenantDetails?.wallet?.balance || selectedTenant.balance || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-700 uppercase">Total Orders</p>
                      <p className="text-lg font-black text-slate-900 mt-0.5">
                        {tenantDetails?.metrics?.total_orders ?? '0'}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Shipments</p>
                      <p className="text-lg font-black text-slate-900 mt-0.5">
                        {tenantDetails?.metrics?.total_shipments ?? '0'}
                      </p>
                    </div>
                  </div>

                  {/* Seller Credentials & Instant Login Card */}
                  <div className="bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50/50 rounded-2xl p-4 border border-purple-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#8410DC] text-white flex items-center justify-center">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">Seller Login Credentials</h4>
                          <p className="text-[11px] text-slate-500 font-medium">Access credentials for admin assistance & troubleshooting</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleImpersonate}
                        className="px-3 py-1.5 bg-[#8410DC] hover:bg-[#6c0cb5] text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" /> 1-Click Login
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Email */}
                      <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Login Email</p>
                          <p className="font-black text-slate-900 text-xs font-mono truncate">
                            {tenantDetails?.owner?.email || selectedTenant.owner_email || selectedTenant.email || 'N/A'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(tenantDetails?.owner?.email || selectedTenant.owner_email || selectedTenant.email, 'Login Email')}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer shrink-0"
                          title="Copy Email"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Password */}
                      <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Set Password</p>
                          <p className="font-black text-slate-900 text-xs font-mono truncate">
                            {showPassword ? (
                              tenantDetails?.owner?.viewable_password || 'Not Set / Encrypted'
                            ) : (
                              '••••••••••••'
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
                            title={showPassword ? 'Hide Password' : 'Show Password'}
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(tenantDetails?.owner?.viewable_password || '', 'Password')}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
                            title="Copy Password"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Reset Password in Overview */}
                    {isChangingPassword ? (
                      <form onSubmit={handleUpdateSellerPassword} className="pt-2 flex items-center gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Enter new password (min 6 chars)..."
                          value={newPasswordInput}
                          onChange={e => setNewPasswordInput(e.target.value)}
                          className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                        />
                        <button
                          type="submit"
                          disabled={savingPassword}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer transition"
                        >
                          {savingPassword ? 'Saving...' : 'Set Password'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsChangingPassword(false); setNewPasswordInput(''); }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Need to reset seller password for assistance?</span>
                        <button
                          type="button"
                          onClick={() => setIsChangingPassword(true)}
                          className="text-[#8410DC] font-black hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" /> Change / Reset Password
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Merchant Details / Edit Form */}
                  {isEditingProfile ? (
                    <form onSubmit={handleSaveProfile} className="bg-slate-50 rounded-2xl p-5 border border-purple-200/80 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div>
                          <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-[#8410DC]" /> Edit Merchant Profile
                          </h3>
                          <p className="text-[11px] text-slate-500 font-medium">Update business credentials, contacts, and account manager.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Company / Store Name *</label>
                          <input
                            type="text"
                            required
                            value={editForm.company_name}
                            onChange={e => setEditForm(prev => ({ ...prev, company_name: e.target.value }))}
                            placeholder="e.g. Acme Stores"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Legal Business Name</label>
                          <input
                            type="text"
                            value={editForm.legal_name}
                            onChange={e => setEditForm(prev => ({ ...prev, legal_name: e.target.value }))}
                            placeholder="e.g. Acme Private Limited"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Primary Contact / Owner Name</label>
                          <input
                            type="text"
                            value={editForm.owner_name}
                            onChange={e => setEditForm(prev => ({ ...prev, owner_name: e.target.value }))}
                            placeholder="Full Name"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Email Address *</label>
                          <input
                            type="email"
                            required
                            value={editForm.owner_email}
                            onChange={e => setEditForm(prev => ({ ...prev, owner_email: e.target.value, support_email: e.target.value }))}
                            placeholder="owner@domain.com"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number</label>
                          <input
                            type="text"
                            value={editForm.owner_phone}
                            onChange={e => setEditForm(prev => ({ ...prev, owner_phone: e.target.value, support_phone: e.target.value }))}
                            placeholder="10-digit mobile number"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Business Type</label>
                          <select
                            value={editForm.business_type}
                            onChange={e => setEditForm(prev => ({ ...prev, business_type: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          >
                            <option value="proprietorship">Sole Proprietorship</option>
                            <option value="partnership">Partnership</option>
                            <option value="pvt_ltd">Private Limited (Pvt Ltd)</option>
                            <option value="llp">Limited Liability Partnership (LLP)</option>
                            <option value="individual">Individual</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">State / Region</label>
                          <input
                            type="text"
                            value={editForm.state}
                            onChange={e => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                            placeholder="e.g. Maharashtra, Karnataka, Delhi"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">GSTIN Number</label>
                          <input
                            type="text"
                            value={editForm.gstin}
                            onChange={e => setEditForm(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                            placeholder="15-character GSTIN"
                            maxLength={15}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] uppercase"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">PAN Number</label>
                          <input
                            type="text"
                            value={editForm.pan_number}
                            onChange={e => setEditForm(prev => ({ ...prev, pan_number: e.target.value.toUpperCase() }))}
                            placeholder="10-character PAN"
                            maxLength={10}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] uppercase"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Status</label>
                          <select
                            value={editForm.status}
                            onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Account Manager (KAM)</label>
                          <select
                            value={editForm.kam_id}
                            onChange={e => setEditForm(prev => ({ ...prev, kam_id: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          >
                            <option value="">None / Unassigned</option>
                            {kams.map(k => (
                              <option key={k.id} value={k.id}>
                                {k.name} ({k.email}) — {k.role}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingProfile}
                          className="px-5 py-2 bg-[#8410DC] hover:bg-[#6c0cb5] text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {savingProfile ? 'Saving Changes...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                        <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                          Primary Account Details
                        </h3>
                        <button
                          onClick={() => setIsEditingProfile(true)}
                          className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#8410DC] border border-purple-200/80 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Details
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                        <div>
                          <span className="text-slate-400 font-bold">Store / Company:</span>{' '}
                          <span className="font-extrabold text-slate-900">{tenantDetails?.company_name || selectedTenant.company_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">Legal Business Name:</span>{' '}
                          <span className="font-extrabold text-slate-800">{tenantDetails?.legal_name || tenantDetails?.legal_business_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">Owner Name:</span>{' '}
                          <span className="font-extrabold text-slate-800">{tenantDetails?.owner?.name || selectedTenant.owner_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">Owner Email:</span>{' '}
                          <span className="font-extrabold text-slate-800">{tenantDetails?.owner?.email || selectedTenant.owner_email || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">Owner Phone:</span>{' '}
                          <span className="font-extrabold text-slate-800">{tenantDetails?.owner?.phone || selectedTenant.owner_phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">Business Type:</span>{' '}
                          <span className="font-extrabold text-slate-800 uppercase">{tenantDetails?.business_type || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">State / Region:</span>{' '}
                          <span className="font-extrabold text-slate-800">{tenantDetails?.state || 'Not Specified'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">GSTIN:</span>{' '}
                          <span className="font-mono font-extrabold text-slate-800">{tenantDetails?.gstin || selectedTenant.gstin || 'Not Provided'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">PAN Number:</span>{' '}
                          <span className="font-mono font-extrabold text-slate-800">{tenantDetails?.pan_number || 'Not Provided'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">Account Manager (KAM):</span>{' '}
                          <span className="font-extrabold text-[#8410DC]">{tenantDetails?.kam?.name ? `${tenantDetails.kam.name} (${tenantDetails.kam.email})` : 'Unassigned'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">Registered On:</span>{' '}
                          <span className="font-extrabold text-slate-800">
                            {tenantDetails?.created_at ? new Date(tenantDetails.created_at).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">KYC Status:</span>{' '}
                          <span className="font-extrabold text-emerald-700 uppercase">{tenantDetails?.kyc_status || 'Approved'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Impersonation Action */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                    <div>
                      <p className="font-black text-amber-900 text-xs">Impersonate Merchant Portal</p>
                      <p className="text-[11px] text-amber-700 font-medium">Log into app.nanoshipy.com as this tenant directly.</p>
                    </div>
                    <button
                      onClick={handleImpersonate}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <ArrowUpRight className="w-4 h-4" /> Open Portal
                    </button>
                  </div>
                </div>
              ) : activeTab === 'status' ? (
                <div className="space-y-4">
                  <h3 className="font-black text-slate-900 text-sm">Account Status & Access Control</h3>
                  <p className="text-slate-500 text-xs">
                    Suspend or activate this merchant tenant. Suspended tenants cannot create new shipments or book couriers.
                  </p>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {[
                      { id: 'active', label: 'Active', desc: 'Full access to book & ship', color: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
                      { id: 'suspended', label: 'Suspended', desc: 'Blocked from shipping', color: 'border-rose-200 bg-rose-50 text-rose-800' },
                      { id: 'pending', label: 'Pending', desc: 'Awaiting onboarding', color: 'border-amber-200 bg-amber-50 text-amber-800' },
                    ].map(st => (
                      <button
                        key={st.id}
                        disabled={submittingStatus}
                        onClick={() => handleUpdateStatus(st.id as any)}
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer ${tenantDetails?.status === st.id ? `${st.color} ring-2 ring-purple-600 font-black` : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                      >
                        <p className="font-black text-xs uppercase">{st.label}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{st.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Retail Booking Office Toggle */}
                  <div className="p-4 rounded-2xl border border-purple-200/80 bg-purple-50/50 mt-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-xs">Retail Booking Office Counter</span>
                        {tenantDetails?.is_booking_office ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ENABLED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-200 text-slate-700">
                            DISABLED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                        Allows this seller to book shipments for walk-in retail customers with customizable sender & receiver addresses.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleBookingOffice(selectedTenant)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                        tenantDetails?.is_booking_office
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                    >
                      {tenantDetails?.is_booking_office ? 'Disable Booking Office' : 'Enable Booking Office'}
                    </button>
                  </div>
                </div>
              ) : activeTab === 'credentials' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                      <Key className="w-4 h-4 text-[#8410DC]" /> Seller Credentials & Direct Access
                    </h3>
                    <p className="text-slate-500 text-xs">
                      View or reset login credentials for this seller to assist with troubleshooting, setup, or operations.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Login Email */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Login Email Address</span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900 text-xs font-mono truncate">
                            {tenantDetails?.owner?.email || selectedTenant.owner_email || selectedTenant.email || 'N/A'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(tenantDetails?.owner?.email || selectedTenant.owner_email || selectedTenant.email, 'Login Email')}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer shrink-0"
                            title="Copy Email"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Set Password */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Seller Set Password</span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900 text-xs font-mono">
                            {showPassword ? (
                              tenantDetails?.owner?.viewable_password || 'Not Set / Pre-migration hash'
                            ) : (
                              '••••••••••••'
                            )}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
                              title={showPassword ? 'Hide Password' : 'Show Password'}
                            >
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(tenantDetails?.owner?.viewable_password || '', 'Password')}
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
                              title="Copy Password"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Impersonation shortcut */}
                    <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 flex items-center justify-between">
                      <div>
                        <p className="font-black text-[#8410DC] text-xs">Instant Merchant Portal Access</p>
                        <p className="text-[11px] text-slate-600 font-medium">Log into seller's workspace with superadmin write assistance rights.</p>
                      </div>
                      <button
                        onClick={handleImpersonate}
                        className="px-4 py-2 bg-[#8410DC] hover:bg-[#6c0cb5] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <ArrowUpRight className="w-4 h-4" /> Open Merchant Workspace
                      </button>
                    </div>
                  </div>

                  {/* Reset Password Form */}
                  <form onSubmit={handleUpdateSellerPassword} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-[#8410DC]" /> Set or Reset Seller Password
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Instantly change the seller's login password. The new password will immediately be viewable by you and will allow the seller to log in.
                    </p>

                    <div className="flex gap-3">
                      <input
                        type="text"
                        required
                        minLength={6}
                        placeholder="Type new password (minimum 6 characters)..."
                        value={newPasswordInput}
                        onChange={e => setNewPasswordInput(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                      />
                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingPassword ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : activeTab === 'warehouses' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#8410DC]" /> Warehouses & Pickup Addresses
                      </h3>
                      <p className="text-slate-500 text-xs">
                        Configure warehouse pickup points for this seller so courier pickups can be booked.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddWarehouse(!showAddWarehouse)}
                      className="px-3.5 py-2 bg-[#8410DC] hover:bg-[#6c0cb5] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> {showAddWarehouse ? 'Cancel' : 'Add Warehouse'}
                    </button>
                  </div>

                  {/* Add Warehouse Form */}
                  {showAddWarehouse && (
                    <form onSubmit={handleCreateWarehouse} className="bg-purple-50/50 rounded-2xl p-5 border border-purple-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                        <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">New Warehouse Pickup Point</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Warehouse Label / Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Primary Warehouse, Delhi Hub"
                            value={warehouseForm.label}
                            onChange={e => setWarehouseForm(prev => ({ ...prev, label: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Person Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="Full Name"
                            value={warehouseForm.contact_name}
                            onChange={e => setWarehouseForm(prev => ({ ...prev, contact_name: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Phone *</label>
                          <input
                            type="text"
                            required
                            placeholder="10-digit mobile number"
                            value={warehouseForm.contact_phone}
                            onChange={e => setWarehouseForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Pincode *</label>
                          <input
                            type="text"
                            required
                            maxLength={6}
                            placeholder="6-digit Pincode"
                            value={warehouseForm.pincode}
                            onChange={e => setWarehouseForm(prev => ({ ...prev, pincode: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Address Line 1 (Building, Street) *</label>
                          <input
                            type="text"
                            required
                            placeholder="Plot / Flat / Street address"
                            value={warehouseForm.address_line1}
                            onChange={e => setWarehouseForm(prev => ({ ...prev, address_line1: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">City *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Mumbai, Bengaluru"
                            value={warehouseForm.city}
                            onChange={e => setWarehouseForm(prev => ({ ...prev, city: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">State *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Maharashtra, Karnataka"
                            value={warehouseForm.state}
                            onChange={e => setWarehouseForm(prev => ({ ...prev, state: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={warehouseForm.is_default}
                            onChange={e => setWarehouseForm(prev => ({ ...prev, is_default: e.target.checked }))}
                            className="rounded text-[#8410DC] focus:ring-[#8410DC]"
                          />
                          <span className="text-xs font-bold text-slate-700">Set as default pickup location</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddWarehouse(false)}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingWarehouse}
                            className="px-5 py-2 bg-[#8410DC] hover:bg-[#6c0cb5] text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {savingWarehouse ? 'Saving...' : 'Save Warehouse'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* Warehouse list */}
                  {loadingWarehouses ? (
                    <div className="p-8 text-center text-slate-400 font-bold">Loading warehouses...</div>
                  ) : warehouses.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 border border-dashed rounded-2xl bg-slate-50 space-y-2">
                      <MapPin className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="font-bold text-xs">No warehouses configured yet for this seller.</p>
                      <p className="text-[11px] text-slate-400">Add a warehouse address above so the seller can start booking pickups.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {warehouses.map(w => (
                        <div key={w.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-xs">{w.label || 'Warehouse'}</span>
                              {w.is_default && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-[#8410DC] border border-purple-200">
                                  Default
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-600 bg-slate-100">
                                {w.city}, {w.state} - {w.pincode}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              {w.address_line1} {w.address_line2 ? `, ${w.address_line2}` : ''}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              Contact: <span className="font-bold text-slate-700">{w.contact_name}</span> ({w.contact_phone})
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteWarehouse(w.id)}
                            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                            title="Delete Warehouse"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'kyc' ? (
                <div className="space-y-4">
                  <h3 className="font-black text-slate-900 text-sm">Merchant KYC Review & Verification</h3>
                  <p className="text-slate-500 text-xs">
                    Review and update merchant business verification status. Once approved, seller will be unlocked to create and ship orders.
                  </p>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Current KYC Status</p>
                      <p className="text-sm font-black text-slate-900 uppercase mt-0.5">{tenantDetails?.kyc_status || 'NOT_STARTED'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      tenantDetails?.kyc_status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      tenantDetails?.kyc_status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {tenantDetails?.kyc_status || 'PENDING'}
                    </span>
                  </div>

                  {/* Readiness Checks Before Approval */}
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Pre-Approval Readiness Checklist</p>

                    {/* Warehouse check */}
                    {warehouses.length > 0 ? (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Warehouse Configured ({warehouses.length} address ready for pickups)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('warehouses')}
                          className="text-emerald-700 font-black hover:underline cursor-pointer text-[11px]"
                        >
                          View
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>No pickup warehouse configured yet.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('warehouses')}
                          className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-black text-[10px] cursor-pointer"
                        >
                          + Add Warehouse
                        </button>
                      </div>
                    )}

                    {/* Markup configuration reminder */}
                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-[#8410DC] text-xs font-bold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-[#8410DC] shrink-0" />
                        <span>Markup Configuration: Set custom seller, booking office, courier & zone markups.</span>
                      </div>
                      <a
                        href="/pricing/markup-config"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-[#8410DC] hover:bg-[#6c0cb5] text-white rounded-lg font-black text-[10px] flex items-center gap-1 cursor-pointer transition"
                      >
                        Configure <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold text-slate-700">Admin Rejection Remarks (Optional)</label>
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="e.g. Invalid GSTIN or blurred business certificate"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#8410DC]"
                    />

                    <div className="flex gap-3 pt-2">
                      <button
                        disabled={submittingKyc}
                        onClick={() => handleUpdateKyc('approved')}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Check className="w-4 h-4" /> Approve KYC & Unlock Account
                      </button>
                      <button
                        disabled={submittingKyc}
                        onClick={() => handleUpdateKyc('rejected')}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <X className="w-4 h-4" /> Reject KYC
                      </button>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'wallet' ? (
                <form onSubmit={handleWalletAdjust} className="space-y-4">
                  <h3 className="font-black text-slate-900 text-sm">Manual Wallet Credit / Debit</h3>
                  <p className="text-slate-500 text-xs">
                    Add promotional credits, adjust freight refunds, or deduct fee corrections directly.
                  </p>

                  <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-purple-700 uppercase">Current Balance</p>
                      <p className="text-xl font-black text-slate-900">
                        ₹{(tenantDetails?.wallet?.balance || selectedTenant.balance || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAdjustType('credit')}
                      className={`py-2.5 text-xs font-black rounded-xl border transition cursor-pointer ${adjustType === 'credit' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                    >
                      + Credit Wallet (Add Money)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('debit')}
                      className={`py-2.5 text-xs font-black rounded-xl border transition cursor-pointer ${adjustType === 'debit' ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                    >
                      - Debit Wallet (Deduct Money)
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Amount (₹)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={adjustAmount}
                      onChange={e => setAdjustAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Notes</label>
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={e => setAdjustReason(e.target.value)}
                      placeholder="e.g. Promotional sign-up bonus or weight dispute refund"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingAdjust}
                    className="w-full py-3 bg-[#8410DC] hover:bg-[#6c0cb5] text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition"
                  >
                    {submittingAdjust ? 'Applying Adjustment...' : `Confirm ${adjustType.toUpperCase()} Adjustment`}
                  </button>
                </form>
              ) : activeTab === 'payment_terms' ? (
                <PaymentTermsTab tenantId={selectedTenant.id} />
              ) : activeTab === 'danger' ? (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-rose-900 text-sm">Delete or Archive Seller Account</h4>
                        <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                          Remove this merchant account ({selectedTenant.company_name}) from the platform.
                          All database records across orders, shipments, users, wallets, and invoices are automatically extracted, compressed, and saved to the server local drive (<code>storage/backups/sellers/</code>) and downloaded directly to your local computer drive before any database deletion occurs.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSellerToDelete(selectedTenant);
                          setIsDeleteModalOpen(true);
                        }}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Seller Account
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={closeManageTenant}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automated Local Drive Backup & Delete Modal */}
      <DeleteSellerModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSellerToDelete(null);
        }}
        seller={sellerToDelete}
        onDeleted={() => {
          fetchSellers();
          if (selectedTenant && sellerToDelete && selectedTenant.id === sellerToDelete.id) {
            closeManageTenant();
          }
        }}
      />
    </div>
  );
}
