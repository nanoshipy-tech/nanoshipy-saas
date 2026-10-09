'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/lib/apiClient';
import { Users, UserPlus, Shield, Trash2, Mail, CheckCircle2, RefreshCw, X, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function TeamManagementPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id?: string; name?: string }>({ isOpen: false });
  const [isRemoving, setIsRemoving] = useState(false);

  // Invite form
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const [teamRes, rolesRes] = await Promise.allSettled([
        apiClient.get('/sub-users'),
        apiClient.get('/roles'),
      ]);

      if (teamRes.status === 'fulfilled') {
        const d = teamRes.value.data.data;
        setMembers(Array.isArray(d) ? d : d?.rows || []);
      }
      if (rolesRes.status === 'fulfilled') {
        const r = rolesRes.value.data.data;
        setRoles(Array.isArray(r) ? r : r?.rows || []);
      }
    } catch {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setInviting(true);
      const res = await apiClient.post('/sub-users', {
        name,
        email,
        role_id: roleId || undefined,
      });

      if (res.data.success) {
        toast.success('Team member invited successfully!');
        setShowInviteModal(false);
        setName('');
        setEmail('');
        fetchTeam();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const confirmRemoveMember = async () => {
    if (!deleteModal.id) return;
    setIsRemoving(true);
    try {
      await apiClient.delete(`/sub-users/${deleteModal.id}`);
      toast.success('Team member removed');
      setDeleteModal({ isOpen: false });
      fetchTeam();
    } catch {
      toast.error('Failed to remove team member');
    } finally {
      setIsRemoving(false);
    }
  };

  const inviteModalContent = (
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => setShowInviteModal(false)}
    >
      <div
        className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#2D2B3F] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-[#8410DC]/10 flex items-center justify-center text-[#8410DC] dark:text-[#D6A8FF]">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Invite Team Member</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Grant dashboard access with role permissions</p>
            </div>
          </div>
          <button
            onClick={() => setShowInviteModal(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F111A] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="teammate@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F111A] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assign Role</label>
            <select
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0F111A] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#8410DC] transition-colors"
            >
              {(roles || []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.display_name || r.name || 'Role'} {r.is_system_role ? '(System Role)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03] font-semibold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#8410DC] hover:bg-[#8410DC] disabled:bg-indigo-400 text-white font-semibold text-xs shadow-md transition-all"
            >
              {inviting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {inviting ? 'Sending Invite...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Team Members</h1>
          <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-0.5">Invite teammates and assign roles with custom module permissions</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8410DC] hover:bg-[#8410DC] text-white font-semibold text-xs shadow-md transition-all shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Invite Team Member
        </button>
      </div>

      {/* Full-Screen Portal Modal */}
      {showInviteModal && mounted && createPortal(inviteModalContent, document.body)}

      {/* Members List */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#F2ECF7] bg-white dark:bg-[#131620] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#F2ECF7] pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8410DC]" />
            Active Team Members ({(members || []).length})
          </h2>
          <button onClick={fetchTeam} className="p-1.5 text-[#534F66] hover:text-slate-600 rounded-lg">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#534F66] text-xs">Loading team members...</div>
        ) : (members || []).length === 0 ? (
          <div className="py-12 text-center text-[#534F66] text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-[#14121F] dark:text-slate-600" />
            <p className="font-semibold">No additional team members added yet.</p>
            <p className="text-[11px] text-[#7E7994]">Click &quot;Invite Team Member&quot; to give staff dashboard access with granular permissions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#F2ECF7] text-[#7E7994] dark:text-[#534F66]">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {(members || []).map((m: any) => (
                  <tr key={m.id || Math.random()} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 dark:text-white">{m.name || m.email || 'Team Member'}</p>
                      <p className="text-[10px] text-[#534F66]">{m.email || 'No email'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-[#8410DC]/10 text-[#8410DC] dark:text-[#D6A8FF] border border-purple-200 dark:border-[#8410DC]/20 capitalize">
                        {m.role?.name || m.role_name || m.role || 'Member'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                        {(m.status || 'ACTIVE').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#7E7994] dark:text-[#534F66]">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString('en-IN') : 'Recently'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, id: m.id, name: m.name || m.email })}
                        className="p-1.5 rounded-lg text-[#534F66] hover:text-rose-500 hover:bg-rose-50 transition-all"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={confirmRemoveMember}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${deleteModal.name || 'this member'} from your merchant team? They will immediately lose access to your dashboard.`}
        confirmText="Remove Member"
        variant="danger"
        isLoading={isRemoving}
      />
    </div>
  );
}
