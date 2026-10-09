'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { RoleForm } from '@/components/roles/RoleForm';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';

export default function EditRolePage() {
  const params = useParams();
  const [role, setRole] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    apiClient.get(`/roles/${params.roleId}`)
      .then(res => setRole(res.data.data))
      .catch(err => setErrorMsg('Failed to load role details.'))
      .finally(() => setIsLoading(false));
  }, [params.roleId]);

  if (isLoading) return <Spinner />;
  if (errorMsg) return <Alert type="error" message={errorMsg} />;
  if (!role) return <Alert type="error" message="Role not found." />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold">{role.is_editable ? 'Edit Role' : 'View System Role'}</h2>
        </CardHeader>
        <CardContent>
          <RoleForm initialData={role} />
        </CardContent>
      </Card>
    </div>
  );
}
