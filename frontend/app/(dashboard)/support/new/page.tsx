'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import TicketForm from '@/components/support/TicketForm';

export default function NewTicketPage() {
  const router = useRouter();
  return (
    <div className="py-6">
      <TicketForm onBack={() => router.push('/support')} />
    </div>
  );
}
