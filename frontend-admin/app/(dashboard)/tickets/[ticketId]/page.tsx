'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Loader2, 
  RefreshCw, 
  User, 
  ShieldAlert, 
  Clock, 
  Lock, 
  Paperclip, 
  Send, 
  Check, 
  ExternalLink,
  LifeBuoy
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';

// Badges
import TicketStatusBadge from '@/components/tickets/TicketStatusBadge';
import TicketPriorityBadge from '@/components/tickets/TicketPriorityBadge';

// Forms & Dropdowns
import InternalNoteForm from '@/components/tickets/InternalNoteForm';
import AssignTicketDropdown from '@/components/tickets/AssignTicketDropdown';

interface Attachment {
  file_name: string;
  file_url: string;
  file_size_bytes: number;
}

interface Message {
  id: string;
  sender_type: 'tenant_user' | 'platform_admin';
  sender_id: string;
  message: string;
  is_internal_note: boolean;
  created_at: string;
  attachments?: Attachment[];
}

interface Ticket {
  id: string;
  tenant_id: string;
  ticket_number: string;
  subject: string;
  category: 'billing' | 'technical' | 'shipment_issue' | 'account' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_on_tenant' | 'resolved' | 'closed';
  created_at: string;
  sla_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  assigned_to: string | null;
  messages: Message[];
}

export default function PlatformTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.ticketId as string;

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Forms state
  const [replyMessage, setReplyMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Status/Priority overrides state
  const [statusVal, setStatusVal] = useState('');
  const [priorityVal, setPriorityVal] = useState('');
  const [updatingParams, setUpdatingParams] = useState(false);

  const fetchTicketDetail = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await apiClient.get(`/platform/tickets/${ticketId}`);
      if (response.data.success) {
        const t = response.data.data;
        setTicket(t);
        setStatusVal(t.status);
        setPriorityVal(t.priority);
      }
    } catch (err: any) {
      toast.error('Failed to load support ticket details.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetail();
    }
  }, [ticketId]);

  useEffect(() => {
    if (ticket?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticket?.messages?.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds the maximum limit of 5MB.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Support attachments endpoint
      const response = await apiClient.post('/platform/tickets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setAttachments([...attachments, response.data.data]);
        toast.success(`File "${file.name}" uploaded successfully.`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyMessage.trim()) {
      toast.error('Please enter a reply message.');
      return;
    }

    setReplying(true);
    try {
      const response = await apiClient.post(`/platform/tickets/${ticketId}/reply`, {
        message: replyMessage.trim(),
        attachments,
      });

      if (response.data.success) {
        setReplyMessage('');
        setAttachments([]);
        toast.success('Official reply sent.');
        await fetchTicketDetail(true);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to send reply.');
    } finally {
      setReplying(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const response = await apiClient.put(`/platform/tickets/${ticketId}/status`, {
        status: 'resolved',
      });
      if (response.data.success) {
        toast.success('Ticket marked as resolved.');
        fetchTicketDetail();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to resolve ticket.');
    } finally {
      setResolving(false);
    }
  };

  const handleParamsUpdate = async (newStatus: string, newPriority: string) => {
    setUpdatingParams(true);
    try {
      const response = await apiClient.put(`/platform/tickets/${ticketId}/status`, {
        status: newStatus,
        priority: newPriority,
      });

      if (response.data.success) {
        toast.success('Ticket configuration updated successfully.');
        setStatusVal(newStatus);
        setPriorityVal(newPriority);
        fetchTicketDetail();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update ticket configuration.');
    } finally {
      setUpdatingParams(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push('/support');
              }
            }}
            className="p-2 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-gray-500 transition shadow-sm active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {loading ? 'Loading Ticket...' : ticket?.subject}
            </h2>
            <p className="text-xs text-gray-500">
              {loading ? 'Retrieving logs...' : `Ticket Number #${ticket?.ticket_number}`}
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchTicketDetail()}
          disabled={loading}
          className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-gray-500 transition shadow-sm active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !ticket ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-[#8410DC]" />
        </div>
      ) : ticket ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          
          {/* Main Discussion panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden flex flex-col h-[550px]">
              
              {/* Messages thread list */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/20">
                {ticket.messages.map((msg) => {
                  const isTenant = msg.sender_type === 'tenant_user';
                  const isNote = msg.is_internal_note;
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex items-start space-x-3.5 max-w-[85%] ${
                        isTenant ? '' : 'ml-auto flex-row-reverse space-x-reverse'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white flex-shrink-0 ${
                        isTenant ? 'bg-[#8410DC]' : isNote ? 'bg-amber-600' : 'bg-gray-800'
                      }`}>
                        {isTenant ? <User className="h-4 w-4" /> : isNote ? <Lock className="h-4 w-4" /> : <LifeBuoy className="h-4 w-4" />}
                      </div>

                      <div className="space-y-1">
                        <div className={`p-4 rounded-2xl border text-xs shadow-sm ${
                          isTenant 
                            ? 'bg-white border-gray-100 text-gray-800' 
                            : isNote
                            ? 'bg-amber-50 border-amber-100 text-amber-900'
                            : 'bg-gray-800 border-gray-800 text-white'
                        }`}>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          
                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed divide-y divide-gray-100 border-gray-100/50 space-y-2">
                              {msg.attachments.map((att, idx) => (
                                <a 
                                  key={idx}
                                  href={att.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center justify-between text-[10px] font-bold py-1 hover:underline ${
                                    isTenant ? 'text-[#8410DC]' : 'text-blue-200'
                                  }`}
                                >
                                  <span className="truncate max-w-[120px]">{att.file_name}</span>
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <span className="text-[9px] font-bold text-gray-400 block px-2 uppercase tracking-wide text-right">
                          {isNote ? 'INTERNAL NOTE · ' : ''} {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply panel */}
              <div className="p-4 border-t border-gray-100 bg-white">
                {ticket.status === 'closed' ? (
                  <div className="flex items-center justify-center p-4 bg-gray-50 border border-gray-150 text-gray-500 text-xs rounded-2xl font-bold space-x-1.5">
                    <Lock className="h-4 w-4" />
                    <span>This ticket is closed and resolved. No replies allowed.</span>
                  </div>
                ) : (
                  <form onSubmit={handleReply} className="space-y-3">
                    
                    {ticket.status !== 'resolved' && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleResolve}
                          disabled={resolving}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-xl shadow-md transition"
                        >
                          {resolving ? 'Resolving...' : 'Mark Resolved'}
                        </button>
                      </div>
                    )}

                    <div className="relative">
                      <textarea
                        rows={2}
                        required
                        placeholder="Write support response to client... (Ctrl+Enter to send)"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleReply();
                          }
                        }}
                        className="w-full bg-gray-50 border border-gray-200/80 rounded-2xl pl-4 pr-12 py-3 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                      />
                      <div className="absolute right-3.5 bottom-3.5 flex items-center space-x-2">
                        <label className="p-1 hover:bg-gray-200/50 rounded-lg cursor-pointer text-gray-400 hover:text-gray-600 transition">
                          <Paperclip className="h-4 w-4" />
                          <input 
                            type="file" 
                            className="hidden" 
                            disabled={uploading || attachments.length >= 5} 
                            onChange={handleFileUpload}
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={replying}
                          className="p-1.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:bg-blue-400 text-white rounded-lg transition active:scale-95 shadow-md"
                        >
                          {replying ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {attachments.map((att, idx) => (
                          <div key={idx} className="bg-purple-50 text-[#4D0582] text-[10px] px-2.5 py-0.5 rounded-lg flex items-center space-x-1 border border-purple-100 font-medium">
                            <Check className="h-3 w-3 text-[#8410DC]" />
                            <span className="truncate max-w-[120px]">{att.file_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </form>
                )}
              </div>

            </div>

            {/* Platform Internal Notes block */}
            {ticket.status !== 'closed' && (
              <InternalNoteForm ticketId={ticket.id} onSuccess={fetchTicketDetail} />
            )}

          </div>

          {/* Ticket Metadata Sidebar */}
          <div className="space-y-6">
            
            {/* Assignee / Delegation */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 space-y-4">
              <AssignTicketDropdown 
                ticketId={ticket.id} 
                assignedToId={ticket.assigned_to} 
                onSuccess={fetchTicketDetail} 
              />
            </div>

            {/* Overrides control panel */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Manage Parameters</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                    Status State
                  </label>
                  <select
                    value={statusVal}
                    disabled={updatingParams}
                    onChange={(e) => handleParamsUpdate(e.target.value, priorityVal)}
                    className="w-full bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC]"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_on_tenant">Waiting on Tenant</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                    Priority Override
                  </label>
                  <select
                    value={priorityVal}
                    disabled={updatingParams}
                    onChange={(e) => handleParamsUpdate(statusVal, e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Technical Metadata logs */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">SLA Audit Logs</h3>
              
              <div className="space-y-3 divide-y divide-gray-50 text-xs">
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400 font-medium">Tenant ID</span>
                  <span className="font-mono text-gray-600 font-bold text-[10px]">
                    {ticket.tenant_id}
                  </span>
                </div>
                
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400 font-medium">SLA Due Date</span>
                  <span className="font-semibold text-gray-700 flex items-center space-x-1">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span>
                      {ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : 'N/A'}
                    </span>
                  </span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400 font-medium">First Response</span>
                  <span className="font-semibold text-gray-700">
                    {ticket.first_response_at ? new Date(ticket.first_response_at).toLocaleString() : 'Pending'}
                  </span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400 font-medium">Resolution Date</span>
                  <span className="font-semibold text-gray-700">
                    {ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString() : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="text-center py-12 text-gray-400 bg-white border rounded-2xl shadow-sm">
          Support ticket details not found.
        </div>
      )}

    </div>
  );
}
