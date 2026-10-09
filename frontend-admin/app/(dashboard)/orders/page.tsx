'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { ShoppingCart, Search, Filter, RefreshCw, Eye, Package, ChevronLeft, ChevronRight, Truck, CheckCircle2, Download } from 'lucide-react';
import toast from 'react-hot-toast';

import SellerWiseToggle from '@/components/reports/SellerWiseToggle';
import { DateRangeFilter, getDefault30DaysRange, DateRange } from '@/components/ui/DateRangeFilter';
import ExportModal from '@/components/exports/ExportModal';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'overall' | 'seller_wise'>('overall');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getDefault30DaysRange());
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter, viewMode, selectedTenantId, dateRange]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20,
        view_mode: viewMode,
        from: dateRange.from,
        to: dateRange.to,
      };
      if (statusFilter) params.status = statusFilter;
      if (viewMode === 'seller_wise' && selectedTenantId) params.tenant_id = selectedTenantId;

      let res;
      try {
        res = await apiClient.get('/platform/orders', { params });
      } catch (err: any) {
        if (err.response?.status === 404) {
          res = await apiClient.get('/orders', { params });
        } else {
          throw err;
        }
      }

      if (res?.data?.success) {
        const payload = res.data.data;
        const rows = payload?.items || payload?.rows || (Array.isArray(payload) ? payload : []);
        setOrders(Array.isArray(rows) ? rows : []);
        if (payload?.pagination) {
          setPagination({
            total: payload.pagination.total || 0,
            totalPages: payload.pagination.total_pages || payload.pagination.totalPages || 1,
          });
        }
      }
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };


  const handlePushToShipway = async (orderId: string, tenantId?: string) => {
    try {
      setPushingId(orderId);
      const res = await apiClient.post('/shipments', {
        order_id: orderId,
        service_type: 'express',
        tenant_id: tenantId,
      });
      if (res.data.success) {
        toast.success(`Order successfully dispatched! AWB: ${res.data.data?.awb_number || 'Generated'}`);
        fetchOrders();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to dispatch order');
    } finally {
      setPushingId(null);
    }
  };

  const filtered = orders.filter(o => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (o.order_reference || o.order_number || o.id || '').toLowerCase().includes(term) ||
      (o.customer_name || '').toLowerCase().includes(term) ||
      (o.customer_phone || '').toLowerCase().includes(term) ||
      (o.tenant?.company_name || o.tenant?.subdomain || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14121F] flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-[#5B069A]" /> Platform Orders & Dispatch Hub
          </h1>
          <p className="text-xs text-[#534F66] font-medium mt-0.5">Real-time cross-tenant order monitoring & courier dispatch</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8410DC] hover:bg-purple-700 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export to Excel
          </button>
          <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#14121F] font-semibold text-xs border border-[#E8DEF2] shadow-sm transition-all cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Orders
          </button>
        </div>
      </div>

      <SellerWiseToggle
        viewMode={viewMode}
        selectedTenantId={selectedTenantId}
        onToggleChange={(mode, tenantId) => {
          setViewMode(mode);
          setSelectedTenantId(tenantId);
          setPage(1);
        }}
      />

      <div className="bg-white border border-[#E8DEF2] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-[#E8DEF2] rounded-xl px-4 py-2 text-xs font-semibold text-[#14121F] focus:outline-none focus:border-[#5B069A] w-full sm:w-48"
          >
            <option value="" className="bg-white text-[#14121F]">All Order Statuses</option>
            <option value="draft" className="bg-white text-[#14121F]">Draft</option>
            <option value="ready_to_ship" className="bg-white text-[#14121F]">Ready to Ship</option>
            <option value="shipped" className="bg-white text-[#14121F]">Shipped</option>
            <option value="delivered" className="bg-white text-[#14121F]">Delivered</option>
            <option value="cancelled" className="bg-white text-[#14121F]">Cancelled</option>
          </select>

          <DateRangeFilter initialRange={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#7E7994]" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search Order # or Customer..."
            className="w-full bg-slate-50 border border-[#E8DEF2] rounded-xl pl-9 pr-4 py-2 text-xs text-[#14121F] placeholder-[#7E7994] focus:outline-none focus:border-[#5B069A]"
          />
        </div>
      </div>

      <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-[#534F66] text-xs">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[#7E7994] text-xs">No orders recorded in system.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F2ECF7] text-[#534F66] bg-slate-50/60 font-semibold">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Tenant</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECF7] text-[#14121F]">
                {filtered.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#5B069A]">
                      <div className="flex flex-col gap-0.5">
                        <span>{o.order_reference || o.order_number || (typeof o.id === 'string' ? o.id.substring(0, 8) : o.id)}</span>
                        <div>
                          {o.booking_type === 'booking_office' ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Booking Office
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Seller Panel
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#14121F] font-bold">{o.tenant?.company_name || o.tenant?.subdomain || 'Direct Merchant'}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#14121F]">{o.customer_name || 'Walk-in Customer'}</p>
                      <p className="text-[10px] text-[#7E7994]">{o.customer_phone || '-'}</p>
                    </td>
                    <td className="py-3 px-4 uppercase text-[10px] font-bold text-[#534F66]">
                      {o.counter_payment_method || o.payment_method || o.payment_mode || 'COD'}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      ₹{Number(o.order_value || o.counter_amount_collected || o.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-violet-50 text-[#5B069A] border border-violet-200">
                        {o.status || 'READY'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {o.status !== 'shipped' && o.status !== 'delivered' && o.status !== 'cancelled' && (
                        <button
                          onClick={() => handlePushToShipway(o.id, o.tenant_id || o.tenant?.id)}
                          disabled={pushingId === o.id}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 text-white font-semibold text-[11px] flex items-center gap-1.5 ml-auto transition-all shadow-sm active:scale-[0.98]"
                        >
                          {pushingId === o.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                          Dispatch Courier
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[#F2ECF7] flex items-center justify-between text-xs text-[#7E7994]">
          <span>
            Page <strong className="text-[#14121F]">{page}</strong> of <strong className="text-[#14121F]">{pagination.totalPages || 1}</strong> (Total {pagination.total || filtered.length} orders)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-[#14121F] font-semibold flex items-center gap-1 transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages || 1, p + 1))}
              disabled={page >= (pagination.totalPages || 1)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-[#14121F] font-semibold flex items-center gap-1 transition-all"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        entity="orders"
        entityLabel="Orders"
        activeFilters={{
          status: statusFilter || undefined,
          view_mode: viewMode,
          tenant_id: selectedTenantId || undefined,
          from: dateRange.from,
          to: dateRange.to,
          search: searchTerm || undefined,
        }}
      />
    </div>
  );
}
