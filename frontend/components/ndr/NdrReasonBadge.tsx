import React from 'react';

interface NdrReasonBadgeProps {
  reasonCode: string;
}

export function NdrReasonBadge({ reasonCode }: NdrReasonBadgeProps) {
  const configs: Record<string, { label: string; pillClass: string }> = {
    CUSTOMER_UNAVAILABLE: { label: 'Unreachable', pillClass: 'nano-pill-warn' },
    ADDRESS_INCORRECT: { label: 'Wrong address', pillClass: 'nano-pill-bad' },
    CUSTOMER_REFUSED: { label: 'Refused', pillClass: 'nano-pill-bad' },
    COD_NOT_READY: { label: 'Cash not ready', pillClass: 'nano-pill-warn' },
    OTHER: { label: 'Other issue', pillClass: 'nano-pill-info' },
  };

  const config = configs[reasonCode] || { 
    label: reasonCode.replace(/_/g, ' ').toLowerCase(), 
    pillClass: 'nano-pill-info' 
  };

  return (
    <span className={`nano-pill ${config.pillClass}`}>
      {config.label}
    </span>
  );
}

