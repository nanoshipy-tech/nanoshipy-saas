'use client';

import React from 'react';
import { AddressForm } from '@/components/addresses/AddressForm';

export default function NewAddressPage() {
  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Add New Pickup Address</h1>
        <p className="mt-1 text-sm text-[#7E7994] dark:text-[#534F66]">
          Create a new warehouse or pickup hub for booking and dispatching shipments.
        </p>
      </div>
      
      <AddressForm />
    </div>
  );
}
