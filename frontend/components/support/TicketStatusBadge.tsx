import React from 'react';

type Status = 'open' | 'in_progress' | 'waiting_on_tenant' | 'resolved' | 'closed';

export default function TicketStatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    open: 'bg-purple-50 text-[#5B069A] border-purple-100',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-100',
    waiting_on_tenant: 'bg-purple-50 text-purple-700 border-purple-100',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    closed: 'bg-gray-50 text-gray-500 border-gray-150',
  };

  const labels: Record<Status, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    waiting_on_tenant: 'Waiting on Tenant',
    resolved: 'Resolved',
    closed: 'Closed',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${styles[status] || styles.open}`}>
      {labels[status] || status}
    </span>
  );
}
