import React from 'react';

interface RtoStatusBadgeProps {
  status: string;
}

export function RtoStatusBadge({ status }: RtoStatusBadgeProps) {
  const configs: Record<string, { label: string; pillClass: string }> = {
    rto_initiated: { label: 'Return Initiated', pillClass: 'nano-pill-warn' },
    rto_in_transit: { label: 'Return In Transit', pillClass: 'nano-pill-brand' },
    rto_delivered: { label: 'Returned to Origin', pillClass: 'nano-pill-ok' },
    rto_lost: { label: 'Return Lost', pillClass: 'nano-pill-bad' },
  };

  const config = configs[status] || { 
    label: status.replace(/_/g, ' '), 
    pillClass: 'nano-pill-info' 
  };

  return (
    <span className={`nano-pill ${config.pillClass}`}>
      {config.label}
    </span>
  );
}
