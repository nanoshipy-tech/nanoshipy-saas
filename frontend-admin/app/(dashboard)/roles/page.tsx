'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Users,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AdminPermissionMatrix,
  AdminModuleConfig,
} from '@/components/roles/AdminPermissionMatrix';

interface PlatformRoleItem {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  admin_count: number;
  permission_keys: string[];
  created_at: string;
  updated_at: string;
}

export default function PlatformRolesPage() {
  const [roles, setRoles] = useState<PlatformRoleItem[]>([]);
  const [catalog, setCatalog] = useState<AdminModuleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<PlatformRoleItem | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesRes, catalogRes] = await Promise.all([
        apiClient.get('/platform/roles'),
        apiClient.get('/platform/roles/permissions-catalog'),
      ]);

      if (rolesRes.data?.success && rolesRes.data?.data) {
        setRoles(rolesRes.data.data);
      }
      if (catalogRes.data?.success && catalogRes.data?.data) {
        setCatalog(catalogRes.data.data);
      }
    } catch {
      toast.error('Failed to load roles and permissions catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRole(null);
    setDisplayName('');
    setDescription('');
    setSelectedPermissions([]);
    setModalOpen(true);
  };

  const handleOpenEditModal = (role: PlatformRoleItem) => {
    setEditingRole(role);
    setDisplayName(role.display_name);
    setDescription(role.description || '');
    setSelectedPermissions(role.permission_keys || []);
    setModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    try {
      setSubmitting(true);
      if (editingRole) {
        const res = await apiClient.put(`/platform/roles/${editingRole.id}`, {
          display_name: displayName.trim(),
          description: description.trim(),
          permission_keys: selectedPermissions,
        });

        if (res.data?.success) {
          toast.success('Role updated successfully');
          setRoles((prev) =>
            prev.map((r) => (r.id === editingRole.id ? res.data.data : r))
          );
          setModalOpen(false);
        }
      } else {
        const res = await apiClient.post('/platform/roles', {
          display_name: displayName.trim(),
          description: description.trim(),
          permission_keys: selectedPermissions,
        });

        if (res.data?.success) {
          toast.success('Custom role created successfully');
          setRoles((prev) => [...prev, res.data.data]);
          setModalOpen(false);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: PlatformRoleItem) => {
    if (role.is_system) {
      toast.error('System roles cannot be deleted');
      return;
    }
    if (role.admin_count > 0) {
      toast.error(
        `Cannot delete role '${role.display_name}'. It is currently assigned to ${role.admin_count} admin(s). Reassign them first.`
      );
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete role "${role.display_name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setDeletingId(role.id);
      const res = await apiClient.delete(`/platform/roles/${role.id}`);
      if (res.data?.success) {
        toast.success('Role deleted successfully');
        setRoles((prev) => prev.filter((r) => r.id !== role.id));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete role');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRoles = roles.filter(
    (r) =>
      r.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Platform Roles & Permissions
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-full">
              RBAC Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Define dynamic roles for platform staff and configure granular action permissions across all 27 admin modules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"
            title="Refresh Roles"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search roles by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Total Roles: <span className="font-semibold text-slate-900 dark:text-white">{roles.length}</span>
          </div>
          <div>
            System Roles: <span className="font-semibold text-slate-900 dark:text-white">{roles.filter((r) => r.is_system).length}</span>
          </div>
          <div>
            Custom Roles: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{roles.filter((r) => !r.is_system).length}</span>
          </div>
        </div>
      </div>

      {/* Roles Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-sm text-slate-500">Loading platform roles & permissions...</p>
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
          <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No roles found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            {searchQuery
              ? 'No roles match your search term. Try searching with different keywords.'
              : 'Create custom roles to grant tailored access to your team members.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                        {role.display_name}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400">{role.name}</span>
                    </div>
                  </div>

                  {role.is_system ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                      <Lock className="w-3 h-3" /> System
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-900/40">
                      Custom
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 min-h-[32px]">
                  {role.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      <strong className="text-slate-700 dark:text-slate-200">{role.admin_count}</strong> active staff
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      <strong className="text-slate-700 dark:text-slate-200">
                        {role.name === 'super_admin' ? 'All (Bypass)' : role.permission_keys?.length || 0}
                      </strong>{' '}
                      permissions
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEditModal(role)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors border border-slate-200 dark:border-slate-800"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {role.is_system && role.name === 'super_admin' ? 'View Permissions' : 'Configure'}
                </button>

                {!role.is_system && (
                  <button
                    onClick={() => handleDeleteRole(role)}
                    disabled={deletingId === role.id || role.admin_count > 0}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                      role.admin_count > 0
                        ? `Cannot delete role assigned to ${role.admin_count} administrator(s)`
                        : 'Delete Role'
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Creation / Editing Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingRole
                      ? editingRole.is_system && editingRole.name === 'super_admin'
                        ? `Role: ${editingRole.display_name}`
                        : `Edit Role: ${editingRole.display_name}`
                      : 'Create New Platform Role'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingRole?.is_system
                      ? 'System predefined role. Permissions are strictly mapped by policy.'
                      : 'Assign granular access to menus, forms, actions, and reports.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Role Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Logistics Auditor"
                    value={displayName}
                    disabled={editingRole?.is_system}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Handles NDR escalations and weight dispute audits"
                    value={description}
                    disabled={editingRole?.is_system}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Permission Matrix */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Module Permissions Matrix
                </label>
                {editingRole?.is_system && editingRole?.name === 'super_admin' ? (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                    <p className="font-semibold mb-1">Super Administrator Role</p>
                    <p>
                      Super Administrator possesses master wildcard (`*`) access across all platform modules, menus, actions, and settings by design.
                    </p>
                  </div>
                ) : (
                  <AdminPermissionMatrix
                    catalog={catalog}
                    selectedKeys={selectedPermissions}
                    onChange={setSelectedPermissions}
                    readOnly={editingRole?.is_system && editingRole.name === 'super_admin'}
                  />
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>

                {(!editingRole || !editingRole.is_system || editingRole.name !== 'super_admin') && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {editingRole ? 'Save Changes' : 'Create Role'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
