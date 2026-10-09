import React from 'react';
import Link from 'next/link';
import { Eye, Clock, AlertTriangle, UserCheck } from 'lucide-react';
import { NdrReasonBadge } from './NdrReasonBadge';

export interface NdrRecord {
  id: string;
  reason_code: string;
  raw_reason: string;
  attempt_number: number;
  status: 'open' | 'action_taken' | 'resolved_delivered' | 'resolved_rto';
  sla_due_at: string;
  created_at: string;
  shipment: {
    id: string;
    awb_number: string | null;
    status: string;
    order: {
      order_reference: string;
      customer_name: string;
    };
    provider: {
      display_name: string;
    };
  };
}

interface NdrTableProps {
  ndrEvents: NdrRecord[];
  selectedIds?: string[];
  onSelectChange?: (selectedIds: string[]) => void;
}

const STATUS_CONFIG: Record<string, { label: string; pillClass: string }> = {
  open: { label: 'Open', pillClass: 'nano-pill-bad' },
  action_taken: { label: 'Action transmitted', pillClass: 'nano-pill-brand' },
  resolved_delivered: { label: 'Delivered', pillClass: 'nano-pill-ok' },
  resolved_rto: { label: 'RTO initiated', pillClass: 'nano-pill-warn' },
};

import { EmptyState } from '@/components/ui/EmptyState';

export function NdrTable({ ndrEvents, selectedIds = [], onSelectChange }: NdrTableProps) {
  const showCheckboxes = !!onSelectChange;
  const allSelected = ndrEvents.length > 0 && selectedIds.length === ndrEvents.length;

  const toggleAll = () => {
    if (!onSelectChange) return;
    if (allSelected) {
      onSelectChange([]);
    } else {
      // Only select open or action_taken events (cannot perform bulk action on already resolved ones)
      const actionable = ndrEvents.filter(n => ['open', 'action_taken'].includes(n.status)).map(n => n.id);
      onSelectChange(actionable);
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectChange) return;
    if (selectedIds.includes(id)) {
      onSelectChange(selectedIds.filter(x => x !== id));
    } else {
      onSelectChange([...selectedIds, id]);
    }
  };

  if (ndrEvents.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="No delivery exceptions (NDR) found"
        description="Shipments experiencing delivery failures will appear here for address correction, reattempts, or RTO conversion."
      />
    );
  }

  return (
    <div className="nano-card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="nano-table">
          <thead>
            <tr>
              {showCheckboxes && (
                <th className="!w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-[var(--line)] text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer h-4 w-4 bg-[var(--surface)]"
                  />
                </th>
              )}
              <th>AWB / Courier</th>
              <th>Order Ref / Customer</th>
              <th>Exception Reason</th>
              <th className="text-center">Attempt</th>
              <th>Status</th>
              <th>SLA Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ndrEvents.map((ndr) => {
              const isActionable = ['open', 'action_taken'].includes(ndr.status);
              const isSlaBreached = isActionable && new Date(ndr.sla_due_at) < new Date();

              return (
                <tr key={ndr.id}>
                  {showCheckboxes && (
                    <td>
                      {isActionable ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ndr.id)}
                          onChange={() => toggleOne(ndr.id)}
                          className="rounded border-[var(--line)] text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer h-4 w-4 bg-[var(--surface)]"
                        />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                    </td>
                  )}
                  <td className="whitespace-nowrap">
                    <div className="font-mono text-[13px] font-semibold text-[var(--ink)]">
                      {ndr.shipment.awb_number || 'No AWB'}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">{ndr.shipment.provider.display_name}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="text-[13px] font-semibold text-[var(--ink)]">
                      {ndr.shipment.order.order_reference}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">{ndr.shipment.order.customer_name}</div>
                  </td>
                  <td>
                    <NdrReasonBadge reasonCode={ndr.reason_code} />
                    <div className="text-[11px] text-[var(--muted)] mt-1 max-w-xs truncate" title={ndr.raw_reason}>
                      {ndr.raw_reason}
                    </div>
                  </td>
                  <td className="text-center font-bold text-[var(--ink)]">
                    {ndr.attempt_number}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={`nano-pill ${STATUS_CONFIG[ndr.status]?.pillClass || 'nano-pill-info'}`}>
                      {STATUS_CONFIG[ndr.status]?.label || ndr.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {isActionable ? (
                      isSlaBreached ? (
                        <span className="nano-pill nano-pill-bad inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>BREACHED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--muted)]">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Due: {new Date(ndr.sla_due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </span>
                      )
                    ) : (
                      <span className="text-[12px] text-[var(--muted)]">Resolved</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Link
                      href={`/ndr/${ndr.id}`}
                      className="nano-btn-secondary !py-1 !px-2.5 !text-[12px] inline-flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Take Action</span>
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
