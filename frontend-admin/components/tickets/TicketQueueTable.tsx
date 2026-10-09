import React from 'react';
import Link from 'next/link';
import { ShieldAlert, AlertTriangle, ArrowRight, User, Clock } from 'lucide-react';
import TicketStatusBadge from './TicketStatusBadge';
import TicketPriorityBadge from './TicketPriorityBadge';

interface UserDetail {
  id: string;
  name: string;
  email: string;
}

interface Ticket {
  id: string;
  tenant_id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_on_tenant' | 'resolved' | 'closed';
  sla_due_at: string | null;
  created_at: string;
  creator: UserDetail;
  assignee: UserDetail | null;
}

export default function TicketQueueTable({ tickets = [] }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white border border-gray-100 rounded-2xl">
        <ShieldAlert className="h-10 w-10 text-gray-300 mb-2" />
        <p className="text-sm">No tickets in the support queue</p>
        <p className="text-xs text-gray-400">All queries resolved or unassigned ticket queue is empty.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            <th className="py-4 px-6">Ticket No</th>
            <th className="py-4 px-6">Subject</th>
            <th className="py-4 px-6">Tenant ID</th>
            <th className="py-4 px-6">Priority</th>
            <th className="py-4 px-6">Status</th>
            <th className="py-4 px-6">Assignee</th>
            <th className="py-4 px-6">SLA Deadline</th>
            <th className="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 text-xs text-gray-700">
          {tickets.map((ticket) => {
            const isBreached = ticket.sla_due_at && new Date(ticket.sla_due_at) < new Date() && ticket.status !== 'resolved' && ticket.status !== 'closed';
            return (
              <tr key={ticket.id} className="hover:bg-gray-50/30 transition-colors">
                <td className="py-4 px-6 font-bold text-gray-900">
                  #{ticket.ticket_number}
                </td>
                <td className="py-4 px-6 max-w-xs truncate">
                  <span className="font-semibold block text-gray-900">{ticket.subject}</span>
                  <span className="text-[10px] text-gray-400">By: {ticket.creator?.name}</span>
                </td>
                <td className="py-4 px-6 font-mono text-[10px] text-gray-500">
                  {ticket.tenant_id.substring(0, 8)}...
                </td>
                <td className="py-4 px-6">
                  <TicketPriorityBadge priority={ticket.priority} />
                </td>
                <td className="py-4 px-6">
                  <TicketStatusBadge status={ticket.status} />
                </td>
                <td className="py-4 px-6 font-medium text-gray-600">
                  <div className="flex items-center space-x-1">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    <span>{ticket.assignee?.name || 'Unassigned'}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  {ticket.sla_due_at ? (
                    <div className="flex items-center space-x-1 font-semibold">
                      {isBreached ? (
                        <span className="text-rose-600 inline-flex items-center space-x-0.5">
                          <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                          <span>Breached</span>
                        </span>
                      ) : (
                        <span className="text-gray-500 inline-flex items-center space-x-0.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{new Date(ticket.sla_due_at).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">N/A</span>
                  )}
                </td>
                <td className="py-4 px-6 text-right">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="inline-flex items-center space-x-1 font-bold text-[#8410DC] hover:text-[#5B069A] hover:underline"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
