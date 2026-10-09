import React from 'react';
import { RoleTable } from '@/components/roles/RoleTable';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function RolesPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Roles & Permissions</h1>
        <p className="mt-1 text-xs text-[#7E7994] dark:text-[#534F66]">
          Define tenant roles and configure granular authorization permissions for team members
        </p>
      </div>

      <SettingsNav />

      <RoleTable />
    </div>
  );
}
