'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Paperclip, Loader2, ArrowLeft, Send, Check, Search, X, Package, ChevronDown } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';

interface Attachment {
  file_name: string;
  file_url: string;
  file_size_bytes: number;
}

interface ShipmentOption {
  id: string;
  awb_number: string | null;
  status: string;
  order: {
    id: string;
    order_reference: string;
    customer_name: string;
  };
}

interface TicketFormProps {
  onBack: () => void;
  initialShipmentId?: string;
  initialAwb?: string;
}

const STATUS_COLORS: Record<string, string> = {
  delivered:     'bg-green-100 text-green-700',
  in_transit:    'bg-blue-100 text-blue-700',
  cancelled:     'bg-red-100 text-red-700',
  rto:           'bg-orange-100 text-orange-700',
  created:       'bg-gray-100 text-gray-600',
  awb_generated: 'bg-purple-100 text-purple-700',
};

function ShipmentStatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function TicketForm({ onBack, initialShipmentId, initialAwb }: TicketFormProps) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('shipment_issue');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage] = useState('');

  // Shipment selector state
  const [selectedShipment, setSelectedShipment] = useState<ShipmentOption | null>(null);
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [shipmentOptions, setShipmentOptions] = useState<ShipmentOption[]>([]);
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentDropdownOpen, setShipmentDropdownOpen] = useState(false);
  const [shipmentError, setShipmentError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch shipments matching search query
  const fetchShipments = useCallback(async (query: string) => {
    setShipmentLoading(true);
    try {
      const params: Record<string, any> = { limit: 20, all_time: true };
      if (query) params.search = query;
      const res = await apiClient.get('/shipments', { params });
      if (res.data.success) {
        setShipmentOptions(res.data.data.rows || []);
      }
    } catch {
      // silently fail — user can still type AWB manually
    } finally {
      setShipmentLoading(false);
    }
  }, []);

  // Auto-load initial shipment from URL params if provided
  useEffect(() => {
    if (initialShipmentId || initialAwb) {
      const ref = initialShipmentId || initialAwb || '';
      apiClient.get('/shipments', { params: { limit: 1, all_time: true, search: ref } })
        .then((res) => {
          const rows: ShipmentOption[] = res.data?.data?.rows || [];
          const found = rows.find(
            (s) => s.id === ref || s.awb_number === ref
          );
          if (found) {
            setSelectedShipment(found);
          }
        })
        .catch(() => {});
    }
  }, [initialShipmentId, initialAwb]);

  // Debounced search
  useEffect(() => {
    if (!shipmentDropdownOpen) return;
    const timer = setTimeout(() => {
      fetchShipments(shipmentSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [shipmentSearch, shipmentDropdownOpen, fetchShipments]);

  // Open dropdown and load default list
  const openDropdown = () => {
    setShipmentDropdownOpen(true);
    fetchShipments(shipmentSearch);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShipmentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectShipment = (shipment: ShipmentOption) => {
    setSelectedShipment(shipment);
    setShipmentDropdownOpen(false);
    setShipmentError('');
    setShipmentSearch('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Single file size exceeds the maximum limit of 5MB.');
      return;
    }

    // Cumulative 10MB check across all ticket attachments
    const currentTotalBytes = attachments.reduce((sum, a) => sum + (a.file_size_bytes || 0), 0);
    if (currentTotalBytes + file.size > 10 * 1024 * 1024) {
      toast.error(`Total attachments exceed 10MB cumulative limit. Please remove an existing attachment.`);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post('/support/tickets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setAttachments([...attachments, response.data.data]);
        toast.success(`File "${file.name}" uploaded successfully.`);
      }
    } catch (err: any) {
      if (err.response?.status === 413) {
        toast.error('Attachment payload too large (10MB limit exceeded). Please compress your photos.');
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to upload attachment.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (message.length < 10) {
      toast.error('Message details must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        subject,
        category,
        priority,
        message,
        attachments,
        related_shipment_id: selectedShipment ? selectedShipment.id : null,
      };

      const response = await apiClient.post('/support/tickets', payload);

      if (response.data.success) {
        toast.success(`Support Ticket #${response.data.data.ticket_number} created successfully.`);
        onBack();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden max-w-2xl mx-auto">
      <div className="p-6 border-b border-gray-50 flex items-center space-x-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-50 border border-gray-200/80 rounded-xl text-gray-500 transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-base font-black text-gray-900">Raise New Support Ticket</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Our dispatch support staff will review this request</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label htmlFor="ticket-subject" className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
            Subject Heading
          </label>
          <input
            id="ticket-subject"
            name="subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. NDR dispute for AWB-991823"
            className="w-full bg-gray-50 border border-gray-200/80 rounded-2xl px-4 py-2.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="ticket-category" className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
              Issue Category
            </label>
            <select
              id="ticket-category"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200/80 rounded-2xl px-3 py-2.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
            >
              <option value="shipment_issue">Shipment Delivery Issue</option>
              <option value="billing">Billing &amp; Finance</option>
              <option value="technical">Technical Glitch</option>
              <option value="account">Account &amp; Subscriptions</option>
              <option value="other">Other Query</option>
            </select>
          </div>

          <div>
            <label htmlFor="ticket-priority" className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
              Priority Urgency
            </label>
            <select
              id="ticket-priority"
              name="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200/80 rounded-2xl px-3 py-2.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
            >
              <option value="low">Low (72 hr SLA)</option>
              <option value="medium">Medium (24 hr SLA)</option>
              <option value="high">High (8 hr SLA)</option>
              <option value="urgent">Urgent (2 hr SLA)</option>
            </select>
          </div>
        </div>

        {/* Linked Shipment Selector (Optional for general/billing, recommended for delivery issues) */}
        <div ref={dropdownRef} className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 flex items-center space-x-1">
            <span className="text-gray-400">
              Linked Shipment
            </span>
            {category === 'shipment_issue' ? (
              <span className="text-[9px] font-semibold text-purple-600 ml-1">(Recommended for delivery issues)</span>
            ) : (
              <span className="text-[9px] font-semibold text-gray-400 ml-1">(Optional)</span>
            )}
          </label>

          {selectedShipment ? (
            // Selected shipment card
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-2xl px-4 py-2.5">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-[#8410DC] flex items-center justify-center flex-shrink-0">
                  <Package className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-[#4D0582] truncate">
                      {selectedShipment.awb_number || 'No AWB yet'}
                    </span>
                    <ShipmentStatusBadge status={selectedShipment.status} />
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">
                    {selectedShipment.order?.order_reference} · {selectedShipment.order?.customer_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedShipment(null); setShipmentDropdownOpen(false); }}
                className="ml-3 p-1 rounded-lg text-purple-400 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0"
                title="Change shipment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            // Picker trigger button
            <button
              type="button"
              onClick={openDropdown}
              className={`w-full flex items-center justify-between bg-gray-50 border rounded-2xl px-4 py-2.5 text-xs font-semibold text-left transition ${
                shipmentError ? 'border-red-400 bg-red-50' : 'border-gray-200/80 hover:border-[#8410DC] focus:border-[#8410DC]'
              }`}
            >
              <div className="flex items-center space-x-2 text-gray-400">
                <Search className="h-3.5 w-3.5" />
                <span>Search by AWB, Order Reference or Customer Name…</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            </button>
          )}

          {shipmentError && (
            <p className="text-[10px] text-red-500 font-semibold mt-1 pl-1">{shipmentError}</p>
          )}

          {/* Dropdown panel */}
          {shipmentDropdownOpen && !selectedShipment && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <div className="flex items-center space-x-2 bg-gray-50 rounded-xl px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="AWB, Order Ref, Customer name…"
                    value={shipmentSearch}
                    onChange={(e) => setShipmentSearch(e.target.value)}
                    className="flex-1 bg-transparent text-xs font-semibold text-gray-700 focus:outline-none placeholder-gray-400"
                  />
                  {shipmentLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8410DC]" />}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                {shipmentOptions.length === 0 && !shipmentLoading && (
                  <div className="p-4 text-center text-xs text-gray-400 font-semibold">
                    {shipmentSearch ? 'No shipments found matching your query.' : 'Type to search your shipments…'}
                  </div>
                )}
                {shipmentOptions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectShipment(s)}
                    className="w-full text-left flex items-center space-x-3 px-4 py-3 hover:bg-purple-50/50 transition group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-gray-100 group-hover:bg-[#8410DC] flex items-center justify-center flex-shrink-0 transition">
                      <Package className="h-3 w-3 text-gray-400 group-hover:text-white transition" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {s.awb_number || 'AWB Pending'}
                        </span>
                        <ShipmentStatusBadge status={s.status} />
                      </div>
                      <p className="text-[10px] text-gray-500 truncate">
                        {s.order?.order_reference} · {s.order?.customer_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="ticket-message" className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
            Detailed Explanation
          </label>
          <textarea
            id="ticket-message"
            name="message"
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Provide all background info, shipment identifiers, or transaction timestamps..."
            className="w-full bg-gray-50 border border-gray-200/80 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
          />
        </div>

        {/* Upload attachment area */}
        <div className="space-y-2">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
            Attachments (Max 5 files, up to 5MB each)
          </label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 border border-dashed border-gray-300 hover:border-[#8410DC] cursor-pointer rounded-2xl px-4 py-3 text-xs text-gray-500 transition bg-gray-50/50">
              <Paperclip className="h-4 w-4 text-gray-400" />
              <span>{uploading ? 'Uploading File...' : 'Attach Screen Grab'}</span>
              <input
                type="file"
                className="hidden"
                disabled={uploading || attachments.length >= 5}
                onChange={handleFileUpload}
              />
            </label>
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-[#8410DC]" />}
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="bg-purple-50 text-[#4D0582] text-xs px-3 py-1 rounded-xl flex items-center space-x-1 border border-purple-100 font-medium">
                  <Check className="h-3.5 w-3.5 text-[#8410DC]" />
                  <span className="truncate max-w-[150px]">{att.file_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-50">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedShipment}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition active:scale-95"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Raise Support Ticket</span>
          </button>
        </div>
      </form>
    </div>
  );
}
