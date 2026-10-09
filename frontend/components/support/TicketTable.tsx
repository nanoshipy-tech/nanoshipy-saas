import React from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, Clock } from 'lucide-react';
import TicketStatusBadge from './TicketStatusBadge';
import TicketPriorityBadge from './TicketPriorityBadge';

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  category: 'billing' | 'technical' | 'shipment_issue' | 'account' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_on_tenant' | 'resolved' | 'closed';
  created_at: string;
}

export default function TicketTable({ tickets = [] }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white border border-gray-100 rounded-2xl">
        <FileText className="h-10 w-10 text-gray-300 mb-2" />
        <p className="text-sm">No tickets found</p>
        <p className="text-xs text-gray-400">Need help? Raise a new support request using the button above.</p>
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
            <th className="py-4 px-6">Category</th>
            <th className="py-4 px-6 text-center">Priority</th>
            <th className="py-4 px-6 text-center">Status</th>
            <th className="py-4 px-6">Date Created</th>
            <th className="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 text-xs text-gray-700">
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="hover:bg-gray-50/30 transition-colors">
              <td className="py-4 px-6 font-bold text-gray-900">
                #{ticket.ticket_number}
              </td>
              <td className="py-4 px-6 max-w-xs truncate">
                <span className="font-semibold block text-gray-900">{ticket.subject}</span>
              </td>
              <td className="py-4 px-6 font-medium capitalize text-gray-500">
                {ticket.category.replace(/_/g, ' ')}
              </td>
              <td className="py-4 px-6 text-center">
                <TicketPriorityBadge priority={ticket.priority} />
              </td>
              <td className="py-4 px-6 text-center">
                <TicketStatusBadge status={ticket.status} />
              </td>
              <td className="py-4 px-6 text-gray-400 font-medium">
                <div className="flex items-center space-x-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                </div>
              </td>
              <td className="py-4 px-6 text-right">
                <Link
                  href={`/support/${ticket.id}`}
                  className="inline-flex items-center space-x-1 font-bold text-[#8410DC] hover:text-[#5B069A] hover:underline"
                >
                  <span>View Details</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
