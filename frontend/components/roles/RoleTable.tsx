'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { usePermission } from '@/lib/usePermission';
import Link from 'next/link';
import toast from 'react-hot-toast';

export const RoleTable = () => {
  const canUpdate = usePermission('role.update');
  const canDelete = usePermission('role.delete');
  const canCreate = usePermission('role.create');

  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id?: string; name?: string }>({
    isOpen: false,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRoles = () => {
    setIsLoading(true);
    apiClient
      .get('/roles')
      .then((res) => {
        const raw = res?.data?.data;
        const list = Array.isArray(raw) ? raw : raw?.rows || raw?.roles || [];
        setRoles(Array.isArray(list) ? list : []);
      })
      .catch(() => setErrorMsg('Failed to load roles.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/roles/${deleteModal.id}`);
      toast.success(`Role "${deleteModal.name}" deleted successfully.`);
      setDeleteModal({ isOpen: false });
      loadRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete role.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      {errorMsg && <Alert type="error" message={errorMsg} />}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#14121F]">Roles & Permissions</h2>
        {canCreate && (
          <Link href="/settings/roles/new">
            <Button size="sm">Create Role</Button>
          </Link>
        )}
      </div>

      <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-[#F2ECF7]">
          <thead className="bg-slate-50/60">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-[#534F66] uppercase tracking-wider">Role Name</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-[#534F66] uppercase tracking-wider">Type</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-[#534F66] uppercase tracking-wider">Permissions</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-[#534F66] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#F2ECF7] text-[#14121F]">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-slate-50/50 transition">
                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-[#14121F]">{role.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-[#534F66]">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    role.is_editable ? 'bg-violet-50 text-[#5B069A] border border-violet-200' : 'bg-slate-100 text-[#534F66]'
                  }`}>
                    {role.is_editable ? 'Custom Role' : 'System Locked'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-[#534F66]">
                  {role.permissions ? role.permissions.length : 0} assigned
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-3">
                  {canUpdate && (
                    <Link href={`/settings/roles/${role.id}`} className="text-[#5B069A] hover:underline font-semibold">
                      {role.is_editable ? 'Edit' : 'View'}
                    </Link>
                  )}
                  {canDelete && role.is_editable && (
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, id: role.id, name: role.name })}
                      className="text-rose-600 hover:text-rose-700 font-semibold outline-none"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-xs text-[#7E7994]">No roles found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={confirmDelete}
        title="Delete Role"
        description={`Are you sure you want to delete the role "${deleteModal.name}"? This action cannot be undone.`}
        confirmText="Delete Role"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
