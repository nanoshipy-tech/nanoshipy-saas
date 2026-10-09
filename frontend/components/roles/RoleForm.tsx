'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { PermissionMatrix, PermissionCatalogue } from './PermissionMatrix';

interface Props {
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    is_editable: boolean;
    permissions: { key: string }[];
  };
}

export const RoleForm = ({ initialData }: Props) => {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<PermissionCatalogue>({});
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [selectedKeys, setSelectedKeys] = useState<string[]>(initialData?.permissions.map(p => p.key) || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const isSystemRole = initialData ? !initialData.is_editable : false;

  useEffect(() => {
    apiClient.get('/permissions')
      .then(res => setCatalogue(res.data.data))
      .catch(() => setErrorMsg('Failed to load permission catalogue.'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSystemRole) return;
    
    setIsSubmitting(true);
    setErrorMsg('');
    
    try {
      const payload = { name, description, permission_keys: selectedKeys };
      if (initialData) {
        await apiClient.put(`/roles/${initialData.id}`, payload);
      } else {
        await apiClient.post('/roles', payload);
      }
      router.push('/settings/roles');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to save role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && <Alert type="error" message={errorMsg} />}
      {isSystemRole && <Alert type="info" message="This is a system role. It cannot be modified." />}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          label="Role Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          disabled={isSystemRole}
          required 
        />
        <Input 
          label="Description (optional)" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          disabled={isSystemRole} 
        />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Permissions</h2>
        <PermissionMatrix 
          catalogue={catalogue} 
          selectedKeys={selectedKeys} 
          onChange={setSelectedKeys} 
          disabled={isSystemRole} 
        />
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 dark:border-white/[0.06]">
        <Button variant="outline" type="button" onClick={() => router.push('/settings/roles')}>
          Cancel
        </Button>
        {!isSystemRole && (
          <Button type="submit" isLoading={isSubmitting}>
            {initialData ? 'Update Role' : 'Create Role'}
          </Button>
        )}
      </div>
    </form>
  );
};
