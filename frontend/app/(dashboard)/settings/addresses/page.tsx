'use client';

import React from 'react';
import { AddressTable } from '@/components/addresses/AddressTable';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function AddressesPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Pickup Addresses</h1>
        <p className="mt-1 text-xs text-[#7E7994] dark:text-[#534F66]">
          Manage your warehouses, fulfillment centers, and pickup locations
        </p>
      </div>

      <SettingsNav />
      
      <AddressTable />
    </div>
  );
}
