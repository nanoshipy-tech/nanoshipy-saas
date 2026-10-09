import React from 'react';
import Link from 'next/link';
import { Eye, ShieldAlert, ArrowLeftRight } from 'lucide-react';
import { RtoStatusBadge } from './RtoStatusBadge';

export interface RtoRecordData {
  id: string;
  initiated_reason: string;
  initiated_by: 'manual' | 'auto_ndr_threshold' | 'courier_initiated';
  status: string;
  rto_awb_number: string | null;
  received_at_warehouse_at: string | null;
  created_at: string;
  shipment: {
    id: string;
    awb_number: string | null;
    order: {
      order_reference: string;
      customer_name: string;
    };
    provider: {
      display_name: string;
    };
  };
}

interface RtoTableProps {
  rtoRecords: RtoRecordData[];
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual Action',
  auto_ndr_threshold: 'Auto NDR Threshold',
  courier_initiated: 'Courier Redirect',
};

import { EmptyState } from '@/components/ui/EmptyState';

export function RtoTable({ rtoRecords }: RtoTableProps) {
  if (rtoRecords.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="No return shipments (RTO) found"
        description="Undelivered shipments that have been marked for return-to-origin will appear here for reverse transit tracking and warehouse verification."
      />
    );
  }

  return (
    <div className="nano-card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="nano-table">
          <thead>
            <tr>
              <th>AWB / Courier</th>
              <th>Order Ref / Customer</th>
              <th>Return Trigger</th>
              <th>Status</th>
              <th>Reverse AWB</th>
              <th>Received at Origin</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rtoRecords.map((rto) => {
              const formattedReceivedDate = rto.received_at_warehouse_at
                ? new Date(rto.received_at_warehouse_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : null;

              return (
                <tr key={rto.id}>
                  <td className="whitespace-nowrap">
                    <div className="font-mono text-[13px] font-semibold text-[var(--ink)]">
                      {rto.shipment.awb_number || 'No AWB'}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">{rto.shipment.provider.display_name}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="text-[13px] font-semibold text-[var(--ink)]">
                      {rto.shipment.order.order_reference}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">{rto.shipment.order.customer_name}</div>
                  </td>
                  <td>
                    <div className="text-[12px] font-semibold text-[var(--ink)]">
                      {TRIGGER_LABELS[rto.initiated_by] || rto.initiated_by}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5 truncate max-w-xs" title={rto.initiated_reason}>
                      {rto.initiated_reason}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <RtoStatusBadge status={rto.status} />
                  </td>
                  <td className="whitespace-nowrap font-mono text-[12px] text-[var(--muted)]">
                    {rto.rto_awb_number || 'N/A'}
                  </td>
                  <td className="whitespace-nowrap text-[12px]">
                    {formattedReceivedDate ? (
                      <span className="text-[var(--ok)] font-medium">{formattedReceivedDate}</span>
                    ) : (
                      <span className="text-[var(--warn)] font-medium">Pending Receipt</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Link
                      href={`/rto/${rto.id}`}
                      className="nano-btn-secondary !py-1 !px-2.5 !text-[12px] inline-flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Manage</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
