'use client';

import React from 'react';

interface OrderStatusBadgeProps {
  status: 'pending' | 'processing' | 'ready_to_ship' | 'cancelled' | string;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const s = String(status || '').toLowerCase();

  let pillClass = 'nano-pill-muted';
  let label = status ? status.replace(/_/g, ' ') : 'Unknown';

  if (s === 'ready_to_ship' || s === 'completed' || s === 'delivered') {
    pillClass = 'nano-pill-ok';
    label = s === 'ready_to_ship' ? 'Ready to ship' : 'Delivered';
  } else if (s === 'processing' || s === 'booked' || s === 'in_transit') {
    pillClass = 'nano-pill-info';
    label = s === 'processing' ? 'Processing' : 'In transit';
  } else if (s === 'cancelled' || s === 'failed') {
    pillClass = 'nano-pill-bad';
    label = 'Cancelled';
  } else if (s === 'pending' || s === 'draft') {
    pillClass = 'nano-pill-warn';
    label = 'New';
  }

  return (
    <span className={`nano-pill ${pillClass}`}>
      {label}
    </span>
  );
};
