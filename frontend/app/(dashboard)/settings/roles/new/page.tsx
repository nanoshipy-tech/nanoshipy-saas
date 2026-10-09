import React from 'react';
import { RoleForm } from '@/components/roles/RoleForm';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

export default function NewRolePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold">Create New Role</h2>
        </CardHeader>
        <CardContent>
          <RoleForm />
        </CardContent>
      </Card>
    </div>
  );
}
