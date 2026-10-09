'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AddressForm } from '@/components/addresses/AddressForm';

export default function EditAddressPage() {
  const params = useParams();
  const addressId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Edit Pickup Address</h1>
        <p className="mt-1 text-sm text-[#7E7994] dark:text-[#534F66]">
          Update the contact details and dispatch location of this pickup warehouse.
        </p>
      </div>
      
      {addressId ? (
        <AddressForm addressId={addressId} />
      ) : (
        <div className="p-8 text-center text-slate-400 font-bold">Loading address ID...</div>
      )}
    </div>
  );
}
