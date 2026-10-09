'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Users2, UserPlus, Mail, RefreshCw, KeyRound, Trash2, CheckCircle2, Copy, Search, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  custom_role_id?: string;
  customRole?: { id: string; name: string; display_name: string };
  status: 'active' | 'disabled';
  last_login_at?: string;
  created_at: string;
}

interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  is_system: boolean;
}

export default function PlatformTeamPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('super_admin');
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchAdmins();
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await apiClient.get('/platform/roles');
      if (res.data?.success && res.data?.data) {
        setCustomRoles(res.data.data);
      }
    } catch {
      // silently ignore or fallback
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/platform/auth/admins');
      if (res.data?.success && res.data?.data) {
        setAdmins(res.data.data);
      }
    } catch {
      toast.error('Failed to load platform admins');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (adminId: string, value: string) => {
    try {
      setUpdatingId(adminId);
      const isCustomRole = customRoles.some(r => r.id === value);
      const payload = isCustomRole
        ? { custom_role_id: value }
        : { role: value, custom_role_id: null };

      const res = await apiClient.put(`/platform/auth/admins/${adminId}/role`, payload);
      if (res.data?.success) {
        toast.success('Admin role updated successfully');
        setAdmins(prev => prev.map(a => {
          if (a.id !== adminId) return a;
          if (isCustomRole) {
            const found = customRoles.find(r => r.id === value);
            return { ...a, custom_role_id: value, role: found?.name || a.role, customRole: found };
          }
          return { ...a, role: value, custom_role_id: undefined, customRole: undefined };
        }));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update admin role');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusToggle = async (admin: AdminUser) => {
    const newStatus = admin.status === 'active' ? 'disabled' : 'active';
    try {
      setUpdatingId(admin.id);
      const res = await apiClient.put(`/platform/auth/admins/${admin.id}/status`, { status: newStatus });
      if (res.data?.success) {
        toast.success(`Admin account ${newStatus === 'active' ? 'activated' : 'disabled'}`);
        setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, status: newStatus } : a));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update admin status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResetPassword = async (admin: AdminUser) => {
    if (!confirm(`Are you sure you want to reset password for ${admin.name} (${admin.email})?`)) return;
    try {
      setUpdatingId(admin.id);
      const res = await apiClient.post(`/platform/auth/admins/${admin.id}/reset-password`);
      if (res.data?.success && res.data?.data?.temp_password) {
        setTempPasswordModal({
          name: admin.name,
          email: admin.email,
          password: res.data.data.temp_password,
        });
        toast.success('Password reset successfully!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to reset password');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteAdmin = async (admin: AdminUser) => {
    if (!confirm(`CAUTION: Are you sure you want to permanently delete admin ${admin.name}? This action cannot be undone.`)) return;
    try {
      setUpdatingId(admin.id);
      const res = await apiClient.delete(`/platform/auth/admins/${admin.id}`);
      if (res.data?.success) {
        toast.success('Admin deleted successfully');
        setAdmins(prev => prev.filter(a => a.id !== admin.id));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete admin');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const isCustomRole = customRoles.some(r => r.id === selectedRoleId);
      const payload: any = {
        name,
        email,
      };
      if (isCustomRole) {
        payload.custom_role_id = selectedRoleId;
      } else {
        payload.role = selectedRoleId;
      }

      const res = await apiClient.post('/platform/auth/admins', payload);
      if (res.data?.success) {
        const createdAdmin = res.data.data;
        setShowInviteModal(false);
        setName('');
        setEmail('');
        setSelectedRoleId('super_admin');
        fetchAdmins();

        if (createdAdmin?.temp_password) {
          setTempPasswordModal({
            name: createdAdmin.name,
            email: createdAdmin.email,
            password: createdAdmin.temp_password,
          });
        }
        toast.success(`Platform Admin ${createdAdmin.name} created!`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create platform admin');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 3000);
  };

  const filteredAdmins = admins.filter(a => {
    const matchesSearch = !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || a.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#14121F] flex items-center gap-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <Users2 className="w-6 h-6 text-[#5B069A]" /> Platform Team & Administrator RBAC
          </h1>
          <p className="text-xs text-[#534F66] mt-0.5">Manage platform super admins, finance managers, KAMs, and support staff</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="ns-btn-primary shrink-0 flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Add Platform Admin
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7E7994]" />
          <input
            type="text"
            placeholder="Search by admin name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#E8DEF2] rounded-xl text-xs focus:outline-none focus:border-[#5B069A]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="border border-[#E8DEF2] rounded-xl px-3 py-2 text-xs text-[#14121F] focus:outline-none focus:border-[#5B069A]"
        >
          <option value="all">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="finance">Finance</option>
          <option value="key_account_manager">Key Account Manager</option>
          <option value="support">Support Agent</option>
          <option value="ops">Operations Manager</option>
          <option value="platform_staff">Platform Staff</option>
        </select>
      </div>

      {/* Temporary Password Modal */}
      {tempPasswordModal && (
        <div className="fixed inset-0 bg-[#14121F]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8DEF2] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F2ECF7] pb-3">
              <h3 className="text-base font-bold text-[#14121F] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" /> Temporary Admin Credentials
              </h3>
              <button onClick={() => setTempPasswordModal(null)} className="text-[#7E7994] hover:text-[#14121F] p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#534F66]">
              Share these login credentials securely with <strong>{tempPasswordModal.name}</strong> ({tempPasswordModal.email}). This password will not be shown again.
            </p>
            <div className="bg-[#F6F4F9] border border-[#E8DEF2] rounded-xl p-3 flex items-center justify-between">
              <code className="text-sm font-mono font-bold text-[#5B069A] select-all">
                {tempPasswordModal.password}
              </code>
              <button
                onClick={() => copyToClipboard(tempPasswordModal.password)}
                className="text-xs text-[#5B069A] font-semibold flex items-center gap-1 hover:underline ml-2"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => setTempPasswordModal(null)}
              className="w-full ns-btn-primary justify-center py-2.5 text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-[#14121F]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8DEF2] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F2ECF7] pb-3">
              <h3 className="text-base font-bold text-[#14121F]">Create Platform Admin</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-[#7E7994] hover:text-[#14121F] p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#14121F] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-[#E8DEF2] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#5B069A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14121F] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="admin@nanoshipy.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-[#E8DEF2] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#5B069A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14121F] mb-1">Assign Platform Role</label>
                <select
                  value={selectedRoleId}
                  onChange={e => setSelectedRoleId(e.target.value)}
                  className="w-full border border-[#E8DEF2] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#5B069A]"
                >
                  <optgroup label="System Roles">
                    <option value="super_admin">Super Admin (Full Root Access)</option>
                    <option value="finance">Finance Auditor (Wallets & Billing)</option>
                    <option value="key_account_manager">Key Account Manager (KAM)</option>
                    <option value="ops">Operations Manager</option>
                    <option value="support">Support Agent (Tickets & NDR)</option>
                    <option value="platform_staff">Platform Staff</option>
                  </optgroup>
                  {customRoles.filter(r => !r.is_system).length > 0 && (
                    <optgroup label="Custom Roles">
                      {customRoles.filter(r => !r.is_system).map(r => (
                        <option key={r.id} value={r.id}>
                          {r.display_name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full ns-btn-primary justify-center py-2.5 text-xs font-semibold"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {submitting ? 'Creating Admin...' : 'Create Platform Admin'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F5FB] border-b border-[#E8DEF2] text-[#534F66] font-semibold">
                <th className="py-3 px-4">Admin Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECF7]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#534F66]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#5B069A]" />
                    Loading platform administrators...
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#534F66]">
                    No platform administrators found.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map(a => (
                  <tr key={a.id} className="hover:bg-[#FDFBFE] transition-colors">
                    <td className="py-3 px-4 font-bold text-[#14121F]">{a.name}</td>
                    <td className="py-3 px-4 text-[#534F66] font-mono">{a.email}</td>
                    <td className="py-3 px-4">
                      <select
                        value={a.custom_role_id || a.role}
                        disabled={updatingId === a.id}
                        onChange={(e) => handleRoleChange(a.id, e.target.value)}
                        className="bg-white border border-[#E8DEF2] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#14121F] cursor-pointer focus:outline-none focus:border-[#5B069A] disabled:opacity-50"
                      >
                        <optgroup label="System Roles">
                          <option value="super_admin">Super Admin</option>
                          <option value="finance">Finance</option>
                          <option value="key_account_manager">KAM</option>
                          <option value="ops">Operations</option>
                          <option value="support">Support</option>
                          <option value="platform_staff">Platform Staff</option>
                        </optgroup>
                        {customRoles.filter(r => !r.is_system).length > 0 && (
                          <optgroup label="Custom Roles">
                            {customRoles.filter(r => !r.is_system).map(r => (
                              <option key={r.id} value={r.id}>
                                {r.display_name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleStatusToggle(a)}
                        disabled={updatingId === a.id}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                          a.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        {a.status}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-[#534F66]">
                      {a.last_login_at ? new Date(a.last_login_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleResetPassword(a)}
                          disabled={updatingId === a.id}
                          title="Reset Password"
                          className="p-1.5 text-[#5B069A] hover:bg-[#F2ECF7] rounded-lg transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAdmin(a)}
                          disabled={updatingId === a.id}
                          title="Delete Admin"
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
