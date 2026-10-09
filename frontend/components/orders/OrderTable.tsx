'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, Edit3, XSquare, ClipboardList, CheckCircle, PackageOpen, Package, Printer, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { OrderStatusBadge } from './OrderStatusBadge';
import { apiClient } from '../../lib/apiClient';
import { openPdfDocument } from '../../lib/urlUtils';
import { ConfirmModal } from '../ui/ConfirmModal';
import { EmptyState } from '../ui/EmptyState';
import { BulkCourierAllocationModal } from './BulkCourierAllocationModal';
import { formatINR, formatDate } from '../../lib/formatters';
import { useAuth } from '../../lib/authStore';

export interface OrderListItem {
  id: string;
  order_reference: string;
  created_at: string;
  customer_name: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  payment_mode: 'prepaid' | 'cod';
  order_value: string;
  status: 'pending' | 'processing' | 'ready_to_ship' | 'cancelled';
}

interface OrderTableProps {
  orders: OrderListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({ orders, pagination, onPageChange, onRefresh }) => {
  const { user } = useAuth();
  const isBookingOffice = Boolean(user?.tenant?.is_booking_office);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [isBulkAllocateOpen, setIsBulkAllocateOpen] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  // Modal confirmation states
  const [cancelModalState, setCancelModalState] = useState<{
    isOpen: boolean;
    orderId?: string;
    isBulk?: boolean;
  }>({ isOpen: false });

  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length && orders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((o) => o.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkPrintOrders = async () => {
    if (selectedIds.length === 0) return;
    const preOpenedWindow = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    setBulkPrinting(true);
    try {
      const res = await apiClient.post('/orders/bulk-pdf', { order_ids: selectedIds });
      if (res.data?.success && res.data?.data?.pdf_url) {
        openPdfDocument(res.data.data.pdf_url, preOpenedWindow);
        toast.success(`Generated combined invoice PDF for ${res.data.data.count || selectedIds.length} orders`);
      } else {
        if (preOpenedWindow && !preOpenedWindow.closed) {
          preOpenedWindow.close();
        }
        toast.error('Failed to generate bulk order invoices');
      }
    } catch (err: any) {
      if (preOpenedWindow && !preOpenedWindow.closed) {
        preOpenedWindow.close();
      }
      console.error('Bulk order printing error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to print bulk order invoices');
    } finally {
      setBulkPrinting(false);
    }
  };

  const handlePrintSingleOrder = async (orderId: string, orderRef: string) => {
    setPrintingOrderId(orderId);
    const preOpenedWindow = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try {
      const pdfUrl = `/orders/${orderId}/pdf`;
      openPdfDocument(pdfUrl, preOpenedWindow);
      toast.success(`Opening invoice for order ${orderRef}`);
    } catch (err: any) {
      if (preOpenedWindow && !preOpenedWindow.closed) {
        preOpenedWindow.close();
      }
      console.error('Single order print error:', err);
      toast.error('Failed to open order invoice');
    } finally {
      setPrintingOrderId(null);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          apiClient.put(`/orders/${id}/status`, { status: newStatus, note: `Bulk updated to ${newStatus}` }).catch(() => null)
        )
      );
      toast.success(`${selectedIds.length} orders updated to ${newStatus.replace('_', ' ')}`);
      setSelectedIds([]);
      onRefresh();
    } catch {
      toast.error('Some orders failed to update.');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (cancelModalState.isBulk) {
      if (selectedIds.length === 0) return;
      setBulkProcessing(true);
      try {
        await Promise.all(
          selectedIds.map((id) =>
            apiClient.delete(`/orders/${id}`, { data: { note: 'Bulk cancelled from dashboard' } }).catch(() => null)
          )
        );
        toast.success(`${selectedIds.length} orders cancelled successfully`);
        setSelectedIds([]);
        onRefresh();
      } catch {
        toast.error('Some orders could not be cancelled.');
      } finally {
        setBulkProcessing(false);
        setCancelModalState({ isOpen: false });
      }
    } else if (cancelModalState.orderId) {
      const id = cancelModalState.orderId;
      setTransitioningId(id);
      try {
        await apiClient.delete(`/orders/${id}`, { data: { note: 'Cancelled by merchant dashboard' } });
        toast.success('Order cancelled successfully');
        onRefresh();
      } catch (err: any) {
        toast.error(err.response?.data?.error?.message || 'Failed to cancel order');
      } finally {
        setTransitioningId(null);
        setCancelModalState({ isOpen: false });
      }
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setTransitioningId(id);
    try {
      await apiClient.put(`/orders/${id}/status`, { status: newStatus, note: `Status updated to ${newStatus}` });
      toast.success(`Order moved to ${newStatus.replace('_', ' ')}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    } finally {
      setTransitioningId(null);
    }
  };

  if (orders.length === 0 && pagination.total === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="No orders found"
        description="You haven't received or imported any orders yet. Add orders manually or upload in bulk."
        actionText="Create Order"
        actionHref="/orders/new"
      />
    );
  }

  return (
    <>
      <div className="w-full relative">
        {/* Floating Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-[#14121F] text-white flex flex-wrap items-center justify-between gap-3 text-xs shadow-md border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#5B069A] flex items-center justify-center font-bold text-[10px]">
                {selectedIds.length}
              </span>
              <span className="font-semibold">Orders selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={bulkProcessing || bulkPrinting}
                onClick={() => setIsBulkAllocateOpen(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-lg transition disabled:opacity-50 active:scale-[0.98] flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Allocate couriers in bulk: Intra-TN to ST Courier, Interstate to Shipway"
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Allocate Courier (Bulk)</span>
              </button>
              <button
                disabled={bulkProcessing || bulkPrinting}
                onClick={handleBulkPrintOrders}
                className="px-3 py-1.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] font-semibold rounded-lg transition disabled:opacity-50 active:scale-[0.98] flex items-center gap-1.5 cursor-pointer shadow-sm text-white"
                title="Print merged invoices / packing slips for all selected orders"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{bulkPrinting ? 'Generating PDFs...' : 'Print Orders'}</span>
              </button>
              <button
                disabled={bulkProcessing || bulkPrinting}
                onClick={() => handleBulkStatusChange('ready_to_ship')}
                className="px-3 py-1.5 bg-[#5B069A] hover:bg-[#8410DC] font-semibold rounded-lg transition disabled:opacity-50 active:scale-[0.98]"
              >
                Mark Ready to Ship
              </button>
              <Link
                href={`/orders/${selectedIds[0]}/ship`}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 font-semibold rounded-lg transition active:scale-[0.98]"
              >
                Dispatch Single
              </Link>
              <button
                disabled={bulkProcessing}
                onClick={() => setCancelModalState({ isOpen: true, isBulk: true })}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 font-semibold rounded-lg transition disabled:opacity-50 active:scale-[0.98]"
              >
                Cancel Selected
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-slate-400 hover:text-white"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[1100px] divide-y divide-[#F2ECF7] text-left">
            <thead className="bg-slate-50/80 border-b border-[#E8DEF2]">
              <tr>
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === orders.length}
                    onChange={toggleSelectAll}
                    className="rounded border-[#E8DEF2] text-[#5B069A] focus:ring-[#5B069A] cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Reference</th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Destination</th>
                <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3.5 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5 text-right text-xs font-bold text-slate-700 uppercase tracking-wider pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#F2ECF7] text-[#14121F]">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-xs text-[#7E7994]">
                    No orders found matching filters.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-purple-50/20 transition">
                    <td className="px-4 py-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelect(order.id)}
                        className="rounded border-[#E8DEF2] text-[#5B069A] focus:ring-[#5B069A] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-[13px] font-mono font-bold text-[#5B069A]">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        {order.order_reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-[12px] font-medium text-slate-600">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-[13px] font-bold text-slate-900">
                      {order.customer_name}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] font-medium text-slate-700 max-w-[220px] truncate" title={`${order.shipping_city}, ${order.shipping_state} (${order.shipping_pincode})`}>
                      {order.shipping_city}, {order.shipping_state} ({order.shipping_pincode})
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {order.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <span className="px-2.5 py-0.5 rounded-lg text-[13px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 inline-block">
                        {formatINR(order.order_value)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs font-medium pr-6">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Direct Ship Button */}
                        {['pending', 'processing', 'ready_to_ship', 'cancelled'].includes(order.status) && (
                          <Link
                            href={`/orders/${order.id}/ship`}
                            title={order.status === 'cancelled' ? 'Re-Ship Order' : 'Ship Now / Book Courier'}
                            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer mr-1"
                          >
                            <Package className="h-3.5 w-3.5" />
                            <span>{order.status === 'cancelled' ? 'Re-Ship' : 'Ship'}</span>
                          </Link>
                        )}

                        {/* Details button */}
                        <Link
                          href={`/orders/${order.id}`}
                          title="View Details"
                          className="p-2 text-slate-600 hover:text-[#5B069A] rounded-xl hover:bg-slate-100 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        {/* Print Invoice button */}
                        <button
                          disabled={printingOrderId === order.id}
                          onClick={() => handlePrintSingleOrder(order.id, order.order_reference)}
                          title="Print Order Invoice"
                          className="p-2 text-slate-600 hover:text-[#5B069A] rounded-xl hover:bg-purple-50 transition cursor-pointer outline-none"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {/* Edit button (allowed for pending, processing, ready_to_ship, cancelled) */}
                        {['pending', 'processing', 'ready_to_ship', 'cancelled'].includes(order.status) && (
                          <Link
                            href={`/orders/${order.id}/edit`}
                            title="Edit Order"
                            className="p-2 text-slate-600 hover:text-amber-600 rounded-xl hover:bg-amber-50 transition"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Link>
                        )}

                        {/* Quick status transition actions */}
                        {order.status === 'pending' && (
                          <button
                            disabled={transitioningId === order.id}
                            onClick={() => handleStatusChange(order.id, 'processing')}
                            title="Mark Processing"
                            className="p-2 text-slate-600 hover:text-[#5B069A] rounded-xl hover:bg-violet-50 transition cursor-pointer outline-none"
                          >
                            <ClipboardList className="h-4 w-4" />
                          </button>
                        )}

                        {order.status === 'processing' && (
                          <button
                            disabled={transitioningId === order.id}
                            onClick={() => handleStatusChange(order.id, 'ready_to_ship')}
                            title="Mark Ready to Ship"
                            className="p-2 text-slate-600 hover:text-emerald-600 rounded-xl hover:bg-emerald-50 transition cursor-pointer outline-none"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}

                        {/* Cancel action */}
                        {['pending', 'processing', 'ready_to_ship', 'shipped'].includes(order.status) && (
                          <button
                            disabled={transitioningId === order.id}
                            onClick={() => setCancelModalState({ isOpen: true, orderId: order.id })}
                            title="Cancel Order & Waybill"
                            className="p-2 text-slate-600 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition cursor-pointer outline-none"
                          >
                            <XSquare className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {pagination && pagination.total_pages > 1 && (
          <div className="bg-slate-50/60 border-t border-[#F2ECF7] px-6 py-3.5 flex items-center justify-between">
            <div className="text-xs text-[#534F66]">
              Showing <span className="font-semibold text-[#14121F]">{orders.length}</span> of <span className="font-semibold text-[#14121F]">{pagination.total}</span> orders
            </div>
            <div className="flex space-x-1">
              <button
                disabled={pagination.page === 1}
                onClick={() => onPageChange(pagination.page - 1)}
                className="text-xs bg-white border border-[#E8DEF2] text-[#534F66] px-3 py-1.5 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer outline-none"
              >
                Previous
              </button>
              {(() => {
                const total = Math.max(1, Number(pagination?.total_pages) || 1);
                const current = Math.max(1, Math.min(Number(pagination?.page) || 1, total));
                const delta = 2;
                const range: number[] = [];
                for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
                  range.push(i);
                }
                const pages: (number | string)[] = [];
                pages.push(1);
                if (range.length > 0 && range[0] > 2) {
                  pages.push('ellipsis-start');
                }
                pages.push(...range);
                if (range.length > 0 && range[range.length - 1] < total - 1) {
                  pages.push('ellipsis-end');
                }
                if (total > 1 && !pages.includes(total)) {
                  pages.push(total);
                }

                return pages.map((p, idx) => {
                  if (typeof p === 'string') {
                    return (
                      <span key={p} className="text-xs px-2 py-1.5 text-slate-400 select-none font-bold">
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => onPageChange(p)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer outline-none ${
                        current === p
                          ? 'bg-gradient-to-r from-[#5B069A] to-[#8410DC] text-white shadow-xs'
                          : 'bg-white border border-[#E8DEF2] text-[#534F66] hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                });
              })()}
              <button
                disabled={pagination.page === pagination.total_pages}
                onClick={() => onPageChange(pagination.page + 1)}
                className="text-xs bg-white border border-[#E8DEF2] text-[#534F66] px-3 py-1.5 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer outline-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={cancelModalState.isOpen}
        onClose={() => setCancelModalState({ isOpen: false })}
        onConfirm={handleConfirmCancel}
        title={cancelModalState.isBulk ? 'Cancel Selected Orders' : 'Cancel Order'}
        description={
          cancelModalState.isBulk
            ? `Are you sure you want to cancel ${selectedIds.length} selected orders? This action will set their status to cancelled.`
            : 'Are you sure you want to cancel this order? This action cannot be reversed.'
        }
        confirmText="Yes, Cancel"
        variant="danger"
        isLoading={bulkProcessing || transitioningId !== null}
      />

      <BulkCourierAllocationModal
        isOpen={isBulkAllocateOpen}
        onClose={() => setIsBulkAllocateOpen(false)}
        selectedOrderIds={selectedIds}
        onSuccess={() => {
          setSelectedIds([]);
          onRefresh();
        }}
      />
    </>
  );
};
