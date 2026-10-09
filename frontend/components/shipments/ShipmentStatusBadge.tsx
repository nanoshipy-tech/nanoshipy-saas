'use client';

import React from 'react';

interface ShipmentStatusBadgeProps {
  status: string;
}

export function ShipmentStatusBadge({ status }: ShipmentStatusBadgeProps) {
  const s = String(status || '').toLowerCase();

  let pillClass = 'nano-pill-muted';
  let label = status ? status.replace(/_/g, ' ') : 'Unknown';

  if (s === 'delivered') {
    pillClass = 'nano-pill-ok';
    label = 'Delivered';
  } else if (s === 'in_transit' || s === 'booked' || s === 'shipped' || s === 'manifested' || s === 'picked_up') {
    pillClass = 'nano-pill-info';
    label = s === 'in_transit' ? 'In transit' : (s === 'picked_up' ? 'Picked up' : 'In transit');
  } else if (s === 'out_for_delivery') {
    pillClass = 'nano-pill-info';
    label = 'Out for delivery';
  } else if (s === 'failed_delivery' || s === 'cancelled' || s === 'failed' || s === 'rto' || s === 'ndr') {
    pillClass = 'nano-pill-bad';
    label = s === 'cancelled' ? 'Cancelled' : (s === 'rto' ? 'RTO' : 'Needs action');
  } else if (s === 'awb_generated' || s === 'pickup_scheduled' || s === 'pending' || s === 'created') {
    pillClass = 'nano-pill-warn';
    label = s === 'awb_generated' ? 'AWB active' : (s === 'pickup_scheduled' ? 'Pickup scheduled' : 'Pending');
  }

  return (
    <span className={`nano-pill ${pillClass}`}>
      {label}
    </span>
  );
}
